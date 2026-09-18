const express = require('express');
const { z } = require('zod');
const { Decimal } = require('decimal.js');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');
const { computeNetRealisation } = require('../services/netRealisation');
const { distanceBetween } = require('../services/recommendations');

const router = express.Router();

const offerSchema = z.object({
  lotId: z.string(),
  buyerId: z.string().optional(),        // buyer-created offer
  demandId: z.string().optional(),       // farmer accepting a matching demand
  recommendationId: z.string().optional(),
  pricePerQuintal: z.number().positive().optional(),
  quantityQuintals: z.number().positive().optional(),
  pickupBy: z.string().optional(),
  paymentTerms: z.string().optional(),
  message: z.string().optional(),
});

router.get('/', requireAuth, async (req, res) => {
  let where = {};
  if (req.user.role === 'BUYER') where.buyerId = req.user.buyer.id;
  else if (req.user.role === 'FARMER') where.lot = { farmerId: req.user.farmer.id };
  const offers = await prisma.offer.findMany({
    where,
    include: {
      lot: { include: { farmer: { include: { user: { select: { name: true } } } } } },
      buyer: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ offers });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;

  const lot = await prisma.lot.findUnique({ where: { id: d.lotId } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });

  let buyerId = d.buyerId;
  let pricePerQuintal = d.pricePerQuintal;
  let quantity = d.quantityQuintals || Number(lot.quantityQuintals);
  let demand = null;

  // If demandId provided, derive buyer + price
  if (d.demandId) {
    demand = await prisma.buyerDemand.findUnique({ where: { id: d.demandId } });
    if (!demand) return res.status(404).json({ error: 'Demand not found' });
    buyerId = demand.buyerId;
    pricePerQuintal = pricePerQuintal ?? Number(demand.pricePerQuintal);
    quantity = quantity ?? Math.min(Number(lot.quantityQuintals), Number(demand.quantityQuintals));
  }

  // If buyer role, self-generate
  if (!buyerId && req.user.role === 'BUYER') buyerId = req.user.buyer.id;

  if (!buyerId) return res.status(400).json({ error: 'buyerId or demandId required' });
  if (!pricePerQuintal) return res.status(400).json({ error: 'pricePerQuintal required' });

  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
  if (!buyer) return res.status(404).json({ error: 'Buyer not found' });

  // Authorization: Farmer of the lot OR the buyer themselves can create.
  const isFarmer = req.user.role === 'FARMER' && lot.farmerId === req.user.farmer?.id;
  const isBuyer = req.user.role === 'BUYER' && buyerId === req.user.buyer?.id;
  if (!isFarmer && !isBuyer && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Not authorized to create this offer' });

  // Compute expected net realisation for this offer
  const buyerLoc = demand?.location || `${buyer.city || ''} ${buyer.state || ''}`.trim();
  const distanceKm = distanceBetween(lot.pickupLocation, buyerLoc);
  const nr = computeNetRealisation({
    quantityQuintals: quantity,
    pricePerQuintal,
    distanceKm,
    quality: lot.quality,
    mode: 'sell_now',
  });

  const offer = await prisma.offer.create({
    data: {
      lotId: lot.id,
      buyerId,
      createdById: req.user.id,
      pricePerQuintal,
      quantityQuintals: quantity,
      pickupBy: d.pickupBy ? new Date(d.pickupBy) : null,
      paymentTerms: d.paymentTerms || 'net_7',
      message: d.message,
      expectedNetRealisation: nr.netRealisation.toString(),
    },
    include: { buyer: true, lot: true },
  });

  // Mark lot as OFFERED if still available
  if (lot.status === 'AVAILABLE') {
    await prisma.lot.update({ where: { id: lot.id }, data: { status: 'OFFERED' } });
  }

  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'offer.create', entity: 'Offer', entityId: offer.id, metadata: { lotId: lot.id, buyerId } },
  });

  res.json({ offer, netRealisation: nr.netRealisation.toString() });
});

router.post('/:id/accept', requireAuth, async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { lot: true, buyer: true } });
  if (!offer) return res.status(404).json({ error: 'Not found' });

  // Only farmer of lot can accept
  if (req.user.role !== 'FARMER' || offer.lot.farmerId !== req.user.farmer?.id) {
    return res.status(403).json({ error: 'Only the lot owner (farmer) can accept' });
  }
  if (offer.status !== 'PENDING') return res.status(400).json({ error: `Offer already ${offer.status.toLowerCase()}` });

  const amount = new Decimal(offer.pricePerQuintal).mul(offer.quantityQuintals).toDecimalPlaces(2);
  const txCode = `TXN-${Date.now().toString(36).toUpperCase()}`;

  const { updatedOffer, transaction } = await prisma.$transaction(async (tx) => {
    const updatedOffer = await tx.offer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
    await tx.offer.updateMany({ where: { lotId: offer.lotId, id: { not: offer.id }, status: 'PENDING' }, data: { status: 'REJECTED' } });
    await tx.lot.update({ where: { id: offer.lotId }, data: { status: 'ACCEPTED' } });
    const transaction = await tx.transaction.create({
      data: {
        code: txCode,
        lotId: offer.lotId,
        offerId: offer.id,
        amount: amount.toString(),
        status: 'CONFIRMED',
        shipment: {
          create: {
            pickupLocation: offer.lot.pickupLocation,
            destination: offer.buyer.city ? `${offer.buyer.city}${offer.buyer.state ? ', ' + offer.buyer.state : ''}` : 'Buyer address',
            distanceKm: distanceBetween(offer.lot.pickupLocation, offer.buyer.city || '') || 60,
            cost: '0',
            status: 'PENDING',
          },
        },
        payment: {
          create: {
            amount: amount.toString(),
            provider: 'mock',
            status: 'PENDING',
          },
        },
        blockchainEvents: {
          create: {
            eventType: 'OFFER_ACCEPTED',
            payload: { lotId: offer.lotId, offerId: offer.id, price: offer.pricePerQuintal.toString() },
            provider: 'mock',
            isDemo: true,
          },
        },
      },
    });
    return { updatedOffer, transaction };
  });

  await prisma.auditLog.create({ data: { userId: req.user.id, action: 'offer.accept', entity: 'Offer', entityId: offer.id, metadata: { transactionId: transaction.id } } });
  res.json({ offer: updatedOffer, transaction });
});

router.post('/:id/reject', requireAuth, async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { lot: true } });
  if (!offer) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'FARMER' || offer.lot.farmerId !== req.user.farmer?.id) return res.status(403).json({ error: 'Only the lot owner (farmer) can reject' });
  if (offer.status !== 'PENDING') return res.status(400).json({ error: `Offer already ${offer.status.toLowerCase()}` });
  const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status: 'REJECTED' } });
  res.json({ offer: updated });
});

module.exports = router;

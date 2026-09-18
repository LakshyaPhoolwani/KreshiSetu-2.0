const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { computeRecommendationsForLot, persistRecommendations, serializeResult } = require('../services/recommendations');

const router = express.Router();

const lotSchema = z.object({
  crop: z.string().min(1),
  variety: z.string().optional(),
  quantityQuintals: z.number().positive(),
  quality: z.enum(['Grade A', 'Grade B', 'Mixed lot']),
  qualityConfidence: z.number().min(0).max(100).optional(),
  harvestDate: z.string().optional(),
  pickupLocation: z.string().min(1),
  pickupLatitude: z.number().optional(),
  pickupLongitude: z.number().optional(),
  timeline: z.string().min(1),
  askPricePerQuintal: z.number().optional(),
});

function requireFarmer(req, res, next) {
  if (!req.user.farmer) return res.status(403).json({ error: 'Only farmers can manage lots' });
  next();
}

async function nextLotCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = (await prisma.lot.count()) + 1;
  return `LOT-${yy}${mm}-${String(seq).padStart(4, '0')}`;
}

// List lots — farmer sees own; admin sees all; buyer sees AVAILABLE
router.get('/', requireAuth, async (req, res) => {
  const { status, crop } = req.query;
  let where = {};
  if (req.user.role === 'FARMER') where.farmerId = req.user.farmer.id;
  else if (req.user.role === 'BUYER') where.status = { in: ['AVAILABLE', 'OFFERED'] };
  if (status) where.status = status;
  if (crop) where.crop = { equals: crop, mode: 'insensitive' };
  const lots = await prisma.lot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      farmer: { include: { user: { select: { name: true, email: true } } } },
      _count: { select: { offers: true, recommendations: true } },
    },
  });
  res.json({ lots });
});

router.post('/', requireAuth, requireFarmer, async (req, res) => {
  const parsed = lotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const code = await nextLotCode();
  const lot = await prisma.lot.create({
    data: {
      code,
      farmerId: req.user.farmer.id,
      crop: d.crop,
      variety: d.variety,
      quantityQuintals: d.quantityQuintals,
      quality: d.quality,
      qualityConfidence: d.qualityConfidence ?? 90,
      harvestDate: d.harvestDate ? new Date(d.harvestDate) : null,
      pickupLocation: d.pickupLocation,
      pickupLatitude: d.pickupLatitude,
      pickupLongitude: d.pickupLongitude,
      timeline: d.timeline,
      askPricePerQuintal: d.askPricePerQuintal,
      status: 'AVAILABLE',
    },
  });
  // Precompute recommendations synchronously so UI receives them immediately
  try {
    const result = await computeRecommendationsForLot(lot.id);
    await persistRecommendations(lot.id, result);
    res.json({ lot, recommendations: serializeResult(result) });
  } catch (e) {
    console.warn('[lots] recommendation compute failed', e.message);
    res.json({ lot, recommendations: null });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const lot = await prisma.lot.findUnique({
    where: { id: req.params.id },
    include: {
      farmer: { include: { user: { select: { name: true, email: true } } } },
      recommendations: { orderBy: { rank: 'asc' } },
      offers: { include: { buyer: true }, orderBy: { createdAt: 'desc' } },
      transactions: true,
    },
  });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  // Access check
  if (req.user.role === 'FARMER' && lot.farmerId !== req.user.farmer.id) return res.status(403).json({ error: 'Forbidden' });
  res.json({ lot });
});

router.patch('/:id', requireAuth, requireFarmer, async (req, res) => {
  const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  if (lot.farmerId !== req.user.farmer.id) return res.status(403).json({ error: 'Forbidden' });
  const updates = {};
  const allowed = ['crop', 'variety', 'quantityQuintals', 'quality', 'qualityConfidence', 'pickupLocation', 'timeline', 'askPricePerQuintal', 'status'];
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  const updated = await prisma.lot.update({ where: { id: lot.id }, data: updates });
  res.json({ lot: updated });
});

// Recompute recommendations for a lot
router.post('/:id/recommendations', requireAuth, async (req, res) => {
  const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  if (req.user.role === 'FARMER' && lot.farmerId !== req.user.farmer.id) return res.status(403).json({ error: 'Forbidden' });
  const result = await computeRecommendationsForLot(lot.id);
  await persistRecommendations(lot.id, result);
  res.json(serializeResult(result));
});

module.exports = router;

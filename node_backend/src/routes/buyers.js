const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (_req, res) => {
  const buyers = await prisma.buyer.findMany({
    include: { user: { select: { name: true, email: true } }, _count: { select: { demands: true } } },
    orderBy: { companyName: 'asc' },
  });
  res.json({ buyers });
});

router.get('/demand', requireAuth, async (req, res) => {
  const { crop, active } = req.query;
  const where = {};
  if (crop) where.crop = { equals: crop, mode: 'insensitive' };
  if (active === 'true') where.active = true;
  if (req.user.role === 'BUYER' && req.user.buyer) where.buyerId = req.user.buyer.id;
  const demands = await prisma.buyerDemand.findMany({
    where,
    include: { buyer: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ demands });
});

const demandSchema = z.object({
  crop: z.string().min(1),
  quantityQuintals: z.number().positive(),
  minQuality: z.string().min(1),
  location: z.string().min(1),
  requiredBy: z.string(),
  pricePerQuintal: z.number().positive(),
  notes: z.string().optional(),
});

router.post('/demand', requireAuth, requireRole('BUYER'), async (req, res) => {
  const parsed = demandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const d = parsed.data;
  const demand = await prisma.buyerDemand.create({
    data: {
      buyerId: req.user.buyer.id,
      crop: d.crop,
      quantityQuintals: d.quantityQuintals,
      minQuality: d.minQuality,
      location: d.location,
      requiredBy: new Date(d.requiredBy),
      pricePerQuintal: d.pricePerQuintal,
      notes: d.notes,
    },
  });
  res.json({ demand });
});

router.patch('/demand/:id', requireAuth, requireRole('BUYER'), async (req, res) => {
  const existing = await prisma.buyerDemand.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.buyerId !== req.user.buyer.id) return res.status(403).json({ error: 'Forbidden' });
  const allowed = ['quantityQuintals', 'minQuality', 'location', 'requiredBy', 'pricePerQuintal', 'notes', 'active'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = k === 'requiredBy' ? new Date(req.body[k]) : req.body[k];
  const updated = await prisma.buyerDemand.update({ where: { id: existing.id }, data: updates });
  res.json({ demand: updated });
});

module.exports = router;

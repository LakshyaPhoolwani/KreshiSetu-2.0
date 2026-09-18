const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');
const { computeRecommendationsForLot, serializeResult } = require('../services/recommendations');

const router = express.Router();

router.get('/lot/:lotId', requireAuth, async (req, res) => {
  const lot = await prisma.lot.findUnique({ where: { id: req.params.lotId }, include: { farmer: true } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  const role = req.user.role;
  const isOwner = role === 'FARMER' && lot.farmerId === req.user.farmer?.id;
  const isFpo = role === 'FPO' && req.user.fpo && lot.farmer.fpoId === req.user.fpo.id;
  if (!isOwner && !isFpo && role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const result = await computeRecommendationsForLot(lot.id);
  res.json(serializeResult(result));
});

module.exports = router;

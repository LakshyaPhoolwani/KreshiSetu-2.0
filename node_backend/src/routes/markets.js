const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (_req, res) => {
  const markets = await prisma.market.findMany({
    orderBy: { name: 'asc' },
    include: {
      prices: { orderBy: { recordedAt: 'desc' }, take: 5 },
    },
  });
  res.json({ markets, note: 'Demo/seeded prices. Live e-NAM/Agmarknet integration not yet enabled.' });
});

router.get('/prices', requireAuth, async (req, res) => {
  const { crop } = req.query;
  const where = crop ? { crop: { equals: crop, mode: 'insensitive' } } : {};
  const prices = await prisma.marketPrice.findMany({
    where,
    include: { market: true },
    orderBy: { recordedAt: 'desc' },
    take: 60,
  });
  res.json({ prices, note: 'Demo/seeded prices. Live e-NAM/Agmarknet integration not yet enabled.' });
});

router.get('/:id/prices', requireAuth, async (req, res) => {
  const prices = await prisma.marketPrice.findMany({
    where: { marketId: req.params.id },
    orderBy: { recordedAt: 'desc' },
    take: 30,
  });
  res.json({ prices });
});

module.exports = router;

// Backwards-compatible endpoints for the pre-migration frontend.
// These mirror the old FastAPI shape so the existing React UI keeps working
// while the new Prisma-backed endpoints power the same data.

const express = require('express');
const { prisma } = require('../db');
const { computeNetRealisation, RATES } = require('../services/netRealisation');
const { computeRecommendationsForLot, distanceBetween, serializeResult } = require('../services/recommendations');
const { requireAuth, optionalAuth } = require('../auth');

const router = express.Router();

// GET /api/dashboard — legacy shape (no auth needed to keep first-load working)
router.get('/dashboard-legacy', optionalAuth, async (_req, res) => {
  // Pick the first demo farmer's active lot
  const farmer = await prisma.farmer.findFirst({ include: { user: true } });
  const lot = farmer ? await prisma.lot.findFirst({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' } }) : null;
  if (!lot) return res.json({ farmer: {}, analysis: null, alerts: [], stats: {} });
  const rec = await computeRecommendationsForLot(lot.id);
  const analysis = legacyAnalysis(rec);
  res.json({
    farmer: {
      name: farmer.user.name,
      location: `${farmer.village || ''}${farmer.district ? ', ' + farmer.district : ''}`.replace(/^, /, '') || 'India',
      verified: farmer.user.verified,
      lot: lot.code,
      crop: lot.crop,
      quantity: Number(lot.quantityQuintals),
      quality: lot.quality,
    },
    analysis,
    alerts: [
      { title: 'Demand rising', text: 'Multiple buyers have posted matching demand this week', type: 'demand' },
      { title: 'Best window', text: 'Recommended market has the strongest net realisation today', type: 'price' },
    ],
    stats: { active_lots: 1, offers: await prisma.offer.count({ where: { lotId: lot.id, status: 'PENDING' } }), shipments: 1, payment: '₹ pending' },
  });
});

// POST /api/analyze — accepts old payload shape, returns old shape
router.post('/analyze', optionalAuth, async (req, res) => {
  const { crop = 'Onion', quantity = 12, location = 'Nashik, Maharashtra', quality = 'Grade A', timeline = 'Within 7 days' } = req.body || {};
  const markets = await prisma.market.findMany({
    include: { prices: { orderBy: { recordedAt: 'desc' }, take: 1, where: { crop: { equals: crop, mode: 'insensitive' } } } },
  });
  const options = [];
  for (const m of markets) {
    const p = m.prices[0];
    if (!p) continue;
    const distanceKm = distanceBetween(location, m.location);
    const nr = computeNetRealisation({ quantityQuintals: quantity, pricePerQuintal: p.pricePerQuintal, distanceKm, quality, mode: 'sell_now' });
    options.push({
      id: m.id,
      market: m.name,
      location: `${m.location} · ${Math.round(distanceKm)} km`,
      price: Number(p.pricePerQuintal),
      distance: Math.round(distanceKm),
      travel: `${Math.floor(distanceKm / 40)}h ${Math.round(((distanceKm / 40) % 1) * 60)}m`,
      transport: Number(nr.transportCost),
      storage: 0,
      buyer: 'Market',
      demand: Number(p.pricePerQuintal) > 2700 ? 'High' : 'Medium',
      timing: 'Pickup in 2 days',
      revenue: Number(nr.grossRevenue),
      commission: Number(nr.commissionCost),
      packaging: Number(nr.packagingCost),
      loss: Number(nr.spoilageCost),
      net: Number(nr.netRealisation),
      confidence: 88,
    });
  }
  options.sort((a, b) => b.net - a.net);
  const bestOption = options[0];
  const storeQty = quantity;
  const storeForecastPrice = bestOption ? bestOption.price * 1.08 : 2920;
  const storeNr = computeNetRealisation({ quantityQuintals: storeQty, pricePerQuintal: storeForecastPrice, distanceKm: bestOption?.distance || 60, quality, storageDays: 30, mode: 'store' });
  const store = {
    id: 'store',
    market: bestOption ? `Store 30 days → ${bestOption.market}` : 'Store 30 days',
    price: Math.round(storeForecastPrice),
    revenue: Number(storeNr.grossRevenue),
    transport: Number(storeNr.transportCost),
    storage: Number(storeNr.storageCost),
    commission: Number(storeNr.commissionCost),
    packaging: Number(storeNr.packagingCost),
    loss: Number(storeNr.spoilageCost),
    net: Number(storeNr.netRealisation),
    confidence: 72,
    buyer: bestOption?.buyer || 'Market',
    demand: 'Rising',
    timing: 'Sell after 30 days',
  };
  res.json({
    input: { crop, quantity, location, quality, timeline },
    options,
    store,
    recommended: options[0] || null,
    sell_now_net: options[0]?.net || 0,
    store_net: Number(storeNr.netRealisation),
    generated_at: new Date().toISOString(),
    demo_notice: 'Prices are seeded demo data.',
  });
});

// Legacy /api/dashboard (no auth) — combines farmer + analyze so old UI keeps working
router.get('/dashboard', async (_req, res) => {
  const farmer = await prisma.farmer.findFirst({ include: { user: true } });
  const lot = farmer ? await prisma.lot.findFirst({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' } }) : null;
  if (!lot) {
    return res.json({
      farmer: { name: 'Guest', location: 'India', verified: false, lot: '-', crop: 'Onion', quantity: 12, quality: 'Grade A' },
      analysis: emptyAnalysis(),
      alerts: [],
      stats: { active_lots: 0, offers: 0, shipments: 0, payment: '₹0 pending' },
    });
  }
  const rec = await computeRecommendationsForLot(lot.id);
  res.json({
    farmer: {
      name: farmer.user.name,
      location: `${farmer.village || ''}${farmer.district ? ', ' + farmer.district : ''}`.replace(/^, /, '') || 'India',
      verified: farmer.user.verified,
      lot: lot.code,
      crop: lot.crop,
      quantity: Number(lot.quantityQuintals),
      quality: lot.quality,
    },
    analysis: legacyAnalysis(rec),
    alerts: [
      { title: 'Demand rising', text: 'Buyers have posted matching demand this week', type: 'demand' },
      { title: 'Best window', text: `Best net realisation is at ${rec.sellNowBest?.marketName || 'top market'}`, type: 'price' },
    ],
    stats: {
      active_lots: 1,
      offers: await prisma.offer.count({ where: { lotId: lot.id, status: 'PENDING' } }),
      shipments: 1,
      payment: '₹ 18,460 pending',
    },
  });
});

// Legacy /api/offers — creates a real Offer bound to demo buyer if none provided
router.post('/offers', optionalAuth, async (req, res) => {
  const { option_id, farmer: farmerName } = req.body || {};
  // Find any active buyer for demo
  const buyer = await prisma.buyer.findFirst();
  const farmer = await prisma.farmer.findFirst({ include: { user: true } });
  const lot = farmer ? await prisma.lot.findFirst({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' } }) : null;
  if (!buyer || !lot || !farmer) return res.json({ id: 'OF-DEMO', status: 'Offer queued', message: 'Demo mode: no live buyer yet.', option_id, created_at: new Date().toISOString() });
  const price = lot.askPricePerQuintal || 2500;
  const offer = await prisma.offer.create({
    data: {
      lotId: lot.id,
      buyerId: buyer.id,
      createdById: farmer.userId,
      pricePerQuintal: price,
      quantityQuintals: lot.quantityQuintals,
      paymentTerms: 'net_7',
      message: `Farmer-initiated offer for ${option_id || 'top option'}`,
    },
  });
  res.json({
    id: `OF-${offer.id.slice(-6).toUpperCase()}`,
    real_id: offer.id,
    status: 'Offer sent',
    message: 'Your offer is ready for buyer confirmation.',
    option_id,
    created_at: offer.createdAt.toISOString(),
  });
});

// Legacy /api/role/:role
router.get('/role/:role', async (req, res) => {
  const roleMap = {
    buyer: ['3 matching lots', '2 offers awaiting response', 'Next pickup: soon'],
    fpo: ['42 farmers onboarded', '8 active lots', '₹ 4.8L aggregated value'],
    admin: ['128 verified users', '4 disputes to review', '99.2% audit completeness'],
    farmer: ['Your produce is ready to sell', '3 transparent options', '1 active shipment'],
  };
  res.json({ role: req.params.role, updated: 'Just now', items: roleMap[req.params.role] || roleMap.farmer });
});

// Legacy /api/assistant/chat — SSE for old UI. Uses new AI service under the hood.
router.post('/assistant/chat', async (req, res) => {
  const { message = '', context } = req.body || {};
  // Pull latest lot for context
  const farmer = await prisma.farmer.findFirst();
  const lot = farmer ? await prisma.lot.findFirst({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' } }) : null;
  let analysisContext = null;
  if (lot) {
    const rec = await computeRecommendationsForLot(lot.id);
    analysisContext = serializeResult(rec);
  }
  const { generateAiExplanation } = require('../services/aiChat');
  const { text } = await generateAiExplanation({ userMessage: message, analysisContext, language: (context && context.language) || 'en' });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // Chunk the text into words for streaming feel
  const words = text.split(/(\s+)/);
  for (const w of words) {
    res.write(`data: ${JSON.stringify({ text: w })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});

// Legacy status endpoints — noop
router.get('/status', async (_req, res) => res.json([]));
router.post('/status', async (req, res) => res.json({ id: 'legacy', client_name: req.body?.client_name || 'demo', timestamp: new Date().toISOString() }));

// ----- helpers -----
function emptyAnalysis() {
  return {
    input: {}, options: [], store: null, recommended: null, sell_now_net: 0, store_net: 0, generated_at: new Date().toISOString(),
  };
}
function legacyAnalysis(rec) {
  const opts = rec.options.map((o) => ({
    id: o.marketId || o.demandId || o.buyerId || 'opt',
    market: o.marketName,
    location: `${o.location} · ${Math.round(o.distanceKm)} km`,
    price: Number(o.pricePerQuintal.toFixed ? o.pricePerQuintal.toFixed(0) : o.pricePerQuintal),
    distance: Math.round(o.distanceKm),
    travel: o.travelTime,
    transport: Number(o.nr.transportCost),
    storage: Number(o.nr.storageCost),
    buyer: o.buyerName || 'Market',
    demand: o.demand,
    timing: o.timing,
    revenue: Number(o.nr.grossRevenue),
    commission: Number(o.nr.commissionCost),
    packaging: Number(o.nr.packagingCost),
    loss: Number(o.nr.spoilageCost),
    net: Number(o.nr.netRealisation),
    confidence: o.confidence,
  }));
  const store = rec.storeOption;
  return {
    input: { crop: rec.lot.crop, quantity: Number(rec.lot.quantityQuintals), location: rec.lot.pickupLocation, quality: rec.lot.quality, timeline: rec.lot.timeline },
    options: opts,
    store: store ? {
      id: 'store',
      market: store.marketName,
      price: Number(store.pricePerQuintal.toFixed ? store.pricePerQuintal.toFixed(0) : store.pricePerQuintal),
      revenue: Number(store.nr.grossRevenue),
      transport: Number(store.nr.transportCost),
      storage: Number(store.nr.storageCost),
      commission: Number(store.nr.commissionCost),
      packaging: Number(store.nr.packagingCost),
      loss: Number(store.nr.spoilageCost),
      net: Number(store.nr.netRealisation),
      confidence: store.confidence,
      buyer: store.buyerName || 'Market',
      demand: store.demand,
      timing: store.timing,
    } : null,
    recommended: opts[0] || null,
    sell_now_net: Number(rec.sellNowBest?.nr.netRealisation || 0),
    store_net: Number(rec.storeOption?.nr.netRealisation || 0),
    generated_at: new Date().toISOString(),
  };
}

module.exports = router;

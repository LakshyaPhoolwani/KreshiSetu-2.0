const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');
const { computeRecommendationsForLot, serializeResult } = require('../services/recommendations');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'FARMER') return farmerDashboard(req, res);
  if (req.user.role === 'BUYER') return buyerDashboard(req, res);
  if (req.user.role === 'FPO') return fpoDashboard(req, res);
  if (req.user.role === 'ADMIN') return adminDashboard(req, res);
  res.json({ role: req.user.role });
});

async function farmerDashboard(req, res) {
  const farmerId = req.user.farmer.id;
  const [lots, offers, transactions] = await Promise.all([
    prisma.lot.findMany({ where: { farmerId }, orderBy: { createdAt: 'desc' }, include: { recommendations: { orderBy: { rank: 'asc' }, take: 3 } } }),
    prisma.offer.findMany({
      where: { lot: { farmerId } },
      include: { buyer: true, lot: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { lot: { farmerId } },
      include: { lot: true, shipment: true, payment: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const activeLot = lots.find((l) => ['AVAILABLE', 'OFFERED', 'ACCEPTED', 'IN_TRANSIT', 'PAYMENT_PENDING'].includes(l.status)) || lots[0];
  let analysis = null;
  if (activeLot) {
    try {
      const result = await computeRecommendationsForLot(activeLot.id);
      analysis = serializeResult(result);
    } catch (e) { /* ignore */ }
  }

  const pendingPaymentSum = transactions
    .filter((t) => t.payment && t.payment.status !== 'SUCCESS')
    .reduce((s, t) => s + Number(t.payment.amount), 0);

  res.json({
    farmer: {
      name: req.user.name,
      role: req.user.role,
      verified: req.user.verified,
      village: req.user.farmer.village,
      district: req.user.farmer.district,
    },
    stats: {
      activeLots: lots.filter((l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED').length,
      offers: offers.filter((o) => o.status === 'PENDING').length,
      shipments: transactions.filter((t) => t.shipment && t.shipment.status !== 'DELIVERED').length,
      paymentPendingAmount: pendingPaymentSum,
    },
    lots,
    activeLot,
    analysis,
    offers,
    transactions,
    alerts: buildFarmerAlerts(analysis, offers),
    demoNotice: 'Data uses seeded demo markets/buyers. Farmer remains the final decision-maker.',
  });
}

function buildFarmerAlerts(analysis, offers) {
  const alerts = [];
  if (analysis?.comparison) {
    const diff = analysis.comparison.difference;
    if (analysis.comparison.preferred === 'sell_now' && diff > 0) {
      alerts.push({ title: 'Sell-now is stronger today', text: `Storing 30 days lowers expected net by ₹${Math.round(diff).toLocaleString('en-IN')}`, type: 'price' });
    } else if (analysis.comparison.preferred === 'store') {
      alerts.push({ title: 'Storage may pay off', text: `Storing 30 days could add ₹${Math.round(Math.abs(diff)).toLocaleString('en-IN')} — forecast, not guaranteed`, type: 'forecast' });
    }
  }
  const pending = offers.filter((o) => o.status === 'PENDING');
  if (pending.length) alerts.push({ title: `${pending.length} offer${pending.length > 1 ? 's' : ''} awaiting your review`, text: 'Compare net realisation before accepting', type: 'demand' });
  return alerts;
}

async function buyerDashboard(req, res) {
  const buyerId = req.user.buyer.id;
  const [demands, matches, offers] = await Promise.all([
    prisma.buyerDemand.findMany({ where: { buyerId }, orderBy: { createdAt: 'desc' } }),
    prisma.buyerMatch.findMany({
      where: { demand: { buyerId } },
      include: { lot: { include: { farmer: { include: { user: { select: { name: true } } } } } }, demand: true },
      orderBy: { matchScore: 'desc' },
      take: 20,
    }),
    prisma.offer.findMany({ where: { buyerId }, include: { lot: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  res.json({
    buyer: { name: req.user.name, companyName: req.user.buyer.companyName, verified: req.user.verified },
    stats: {
      activeDemands: demands.filter((d) => d.active).length,
      matches: matches.length,
      pendingOffers: offers.filter((o) => o.status === 'PENDING').length,
      accepted: offers.filter((o) => o.status === 'ACCEPTED').length,
    },
    demands, matches, offers,
  });
}

async function fpoDashboard(req, res) {
  const [farmers, lots] = await Promise.all([
    prisma.farmer.findMany({ where: { fpoId: req.user.fpo.id }, include: { user: { select: { name: true, verified: true } } } }),
    prisma.lot.findMany({ where: { farmer: { fpoId: req.user.fpo.id } }, orderBy: { createdAt: 'desc' } }),
  ]);
  res.json({
    fpo: { name: req.user.fpo.name },
    stats: {
      farmers: farmers.length,
      activeLots: lots.filter((l) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED').length,
      aggregatedQuintals: lots.reduce((s, l) => s + Number(l.quantityQuintals), 0),
    },
    farmers, lots,
  });
}

async function adminDashboard(_req, res) {
  const [users, lots, offers, transactions] = await Promise.all([
    prisma.user.count(),
    prisma.lot.count(),
    prisma.offer.count(),
    prisma.transaction.findMany({ include: { payment: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  res.json({
    stats: {
      totalUsers: users,
      totalLots: lots,
      totalOffers: offers,
      recentTransactions: transactions.length,
    },
    recentTransactions: transactions,
  });
}

module.exports = router;

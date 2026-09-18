const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  let where = {};
  if (req.user.role === 'FARMER') where.lot = { farmerId: req.user.farmer.id };
  else if (req.user.role === 'BUYER') where.offer = { buyerId: req.user.buyer.id };
  const txs = await prisma.transaction.findMany({
    where,
    include: { lot: true, offer: { include: { buyer: true } }, shipment: true, payment: true, blockchainEvents: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ transactions: txs });
});

router.get('/:id', requireAuth, async (req, res) => {
  const tx = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: {
      lot: { include: { farmer: { include: { user: { select: { name: true } } } } } },
      offer: { include: { buyer: { include: { user: { select: { name: true } } } } } },
      shipment: true,
      payment: true,
      blockchainEvents: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!tx) return res.status(404).json({ error: 'Not found' });
  res.json({ transaction: tx });
});

// Advance shipment status (demo helper — in prod, transporter posts)
router.post('/:id/shipment/advance', requireAuth, async (req, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { shipment: true, lot: true } });
  if (!tx || !tx.shipment) return res.status(404).json({ error: 'Not found' });
  const flow = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  const idx = flow.indexOf(tx.shipment.status);
  const next = flow[Math.min(idx + 1, flow.length - 1)];
  const shipmentUpd = await prisma.shipment.update({
    where: { id: tx.shipment.id },
    data: {
      status: next,
      pickedUpAt: next === 'PICKED_UP' ? new Date() : tx.shipment.pickedUpAt,
      deliveredAt: next === 'DELIVERED' ? new Date() : tx.shipment.deliveredAt,
    },
  });
  const txStatusMap = { PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED', ASSIGNED: 'LOGISTICS_PENDING' };
  const newTxStatus = txStatusMap[next] || tx.status;
  const txUpd = await prisma.transaction.update({ where: { id: tx.id }, data: { status: newTxStatus } });
  await prisma.blockchainEvent.create({
    data: { transactionId: tx.id, eventType: `SHIPMENT_${next}`, payload: { shipmentId: shipmentUpd.id }, provider: 'mock', isDemo: true },
  });
  res.json({ transaction: txUpd, shipment: shipmentUpd });
});

// Simulate payment settlement — labelled MOCK
router.post('/:id/payment/settle', requireAuth, async (req, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { payment: true } });
  if (!tx || !tx.payment) return res.status(404).json({ error: 'Not found' });
  const payment = await prisma.payment.update({
    where: { id: tx.payment.id },
    data: { status: 'SUCCESS', paidAt: new Date(), reference: `MOCK-PAY-${Date.now()}` },
  });
  const txUpd = await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } });
  await prisma.blockchainEvent.create({
    data: { transactionId: tx.id, eventType: 'PAYMENT_SETTLED', payload: { reference: payment.reference, amount: payment.amount.toString() }, provider: 'mock', isDemo: true },
  });
  res.json({ transaction: txUpd, payment, notice: 'MOCK payment settlement. No real money moved.' });
});

module.exports = router;

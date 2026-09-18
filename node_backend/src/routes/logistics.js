// Logistics provider routes: shipments awaiting pickup, update shipment status.
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/queue', requireAuth, requireRole('LOGISTICS_PROVIDER', 'ADMIN'), async (_req, res) => {
  const shipments = await prisma.shipment.findMany({
    where: { status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    include: {
      transaction: {
        include: {
          lot: { include: { farmer: { include: { user: { select: { name: true, phone: true } } } } } },
          offer: { include: { buyer: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ shipments });
});

const FLOW = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
const statusSchema = z.object({ status: z.enum(FLOW), transporter: z.string().optional() });

router.post('/shipments/:id/status', requireAuth, requireRole('LOGISTICS_PROVIDER', 'ADMIN'), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
  if (!shipment) return res.status(404).json({ error: 'Not found' });
  const now = new Date();
  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: parsed.data.status,
      transporter: parsed.data.transporter ?? shipment.transporter ?? req.user.name,
      pickedUpAt: parsed.data.status === 'PICKED_UP' ? now : shipment.pickedUpAt,
      deliveredAt: parsed.data.status === 'DELIVERED' ? now : shipment.deliveredAt,
    },
  });
  const txStatusMap = { ASSIGNED: 'LOGISTICS_PENDING', PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED' };
  const newTxStatus = txStatusMap[parsed.data.status];
  if (newTxStatus) await prisma.transaction.update({ where: { id: shipment.transactionId }, data: { status: newTxStatus } });
  await prisma.blockchainEvent.create({
    data: { transactionId: shipment.transactionId, eventType: `SHIPMENT_${parsed.data.status}`, payload: { shipmentId: shipment.id, transporter: updated.transporter }, provider: 'mock', isDemo: true },
  });
  res.json({ shipment: updated });
});

module.exports = router;

// Quality assessor routes: view lots awaiting attestation, submit quality attestation.
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Queue: lots that have not been marked as verified quality (confidence < 90)
router.get('/queue', requireAuth, requireRole('QUALITY_ASSESSOR', 'ADMIN'), async (_req, res) => {
  const lots = await prisma.lot.findMany({
    where: { status: { in: ['DRAFT', 'AVAILABLE', 'OFFERED'] } },
    orderBy: { createdAt: 'desc' },
    include: { farmer: { include: { user: { select: { name: true } } } } },
  });
  res.json({ lots });
});

const attestSchema = z.object({
  quality: z.enum(['Grade A', 'Grade B', 'Mixed lot']),
  qualityConfidence: z.number().min(0).max(100),
  parameters: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

router.post('/lots/:id/attest', requireAuth, requireRole('QUALITY_ASSESSOR', 'ADMIN'), async (req, res) => {
  const parsed = attestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
  if (!lot) return res.status(404).json({ error: 'Lot not found' });
  const updated = await prisma.lot.update({
    where: { id: lot.id },
    data: { quality: parsed.data.quality, qualityConfidence: parsed.data.qualityConfidence },
  });
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'quality.attest',
      entity: 'Lot',
      entityId: lot.id,
      metadata: { ...parsed.data, previousQuality: lot.quality, previousConfidence: Number(lot.qualityConfidence) },
    },
  });
  res.json({ lot: updated, attestedBy: req.user.name });
});

router.get('/history', requireAuth, requireRole('QUALITY_ASSESSOR', 'ADMIN'), async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'quality.attest', userId: req.user.role === 'ADMIN' ? undefined : req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({ history: logs });
});

module.exports = router;

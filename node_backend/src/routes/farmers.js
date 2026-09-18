// Farmer profile & farm management
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/me', requireAuth, requireRole('FARMER'), async (req, res) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id: req.user.farmer.id },
    include: { user: true, farms: true, fpo: true },
  });
  res.json({ farmer });
});

const profileSchema = z.object({
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  aadhaarRef: z.string().optional(),
  language: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
});

router.patch('/me', requireAuth, requireRole('FARMER'), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const d = parsed.data;
  const farmerUpdates = {};
  for (const k of ['village', 'district', 'state', 'pincode', 'latitude', 'longitude', 'aadhaarRef']) if (k in d) farmerUpdates[k] = d[k];
  const userUpdates = {};
  for (const k of ['language', 'phone', 'name']) if (k in d) userUpdates[k] = d[k];
  const farmer = await prisma.farmer.update({
    where: { id: req.user.farmer.id },
    data: {
      ...farmerUpdates,
      user: Object.keys(userUpdates).length ? { update: userUpdates } : undefined,
    },
    include: { user: true, farms: true },
  });
  res.json({ farmer });
});

const farmSchema = z.object({
  name: z.string().min(1),
  areaAcres: z.number().positive(),
  soilType: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

router.post('/me/farms', requireAuth, requireRole('FARMER'), async (req, res) => {
  const parsed = farmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const farm = await prisma.farm.create({ data: { ...parsed.data, farmerId: req.user.farmer.id } });
  res.json({ farm });
});

module.exports = router;

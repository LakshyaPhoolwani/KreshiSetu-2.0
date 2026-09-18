const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  requireAuth,
} = require('../auth');

const router = express.Router();

const ROLES = ['FARMER', 'FPO', 'BUYER', 'ADMIN', 'QUALITY_ASSESSOR', 'LOGISTICS_PROVIDER'];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(ROLES),
  phone: z.string().optional(),
  language: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setAuthCookies(res, access, refresh) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('access_token', access, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 15 * 60 * 1000, path: '/' });
  res.cookie('refresh_token', refresh, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    phone: u.phone,
    language: u.language,
    verified: u.verified,
    farmerId: u.farmer?.id || null,
    buyerId: u.buyer?.id || null,
    fpoId: u.fpo?.id || null,
  };
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { email, password, name, role, phone, language } = parsed.data;
  const emailLc = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: emailLc } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: emailLc,
      passwordHash,
      name,
      role,
      phone,
      language: language || 'en',
      verified: role === 'ADMIN',
      farmer: role === 'FARMER' ? { create: {} } : undefined,
      buyer: role === 'BUYER' ? { create: { companyName: name } } : undefined,
      fpo: role === 'FPO' ? { create: { name } } : undefined,
    },
    include: { farmer: true, buyer: true, fpo: true },
  });

  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  setAuthCookies(res, access, refresh);
  res.json({ user: publicUser(user), accessToken: access, refreshToken: refresh });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { farmer: true, buyer: true, fpo: true },
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  setAuthCookies(res, access, refresh);
  res.json({ user: publicUser(user), accessToken: access, refreshToken: refresh });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Missing refresh token' });
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const access = signAccessToken(user);
    res.cookie('access_token', access, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 15 * 60 * 1000, path: '/' });
    res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_EXP = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES || '7d';

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_EXP });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXP });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  if (req.cookies && req.cookies.access_token) return req.cookies.access_token;
  return null;
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token type' });
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { farmer: true, buyer: true, fpo: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Optional auth: attaches user if token valid, otherwise proceeds anonymously.
async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    if (payload.type === 'access') {
      req.user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { farmer: true, buyer: true, fpo: true },
      });
    }
  } catch { /* ignore */ }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  requireAuth,
  requireRole,
  optionalAuth,
};

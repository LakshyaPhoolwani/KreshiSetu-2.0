// Seed demo data + demo user accounts. Idempotent.
const bcrypt = require('bcryptjs');
const { prisma } = require('./db');
const { Decimal } = require('decimal.js');

const DEMO = {
  users: [
    { email: 'admin@krishisetu.dev', password: 'admin123', name: 'KrishiSetu Admin', role: 'ADMIN', verified: true },
    { email: 'rajesh@krishisetu.dev', password: 'farmer123', name: 'Rajesh Patil', role: 'FARMER', verified: true },
    { email: 'priya@krishisetu.dev', password: 'farmer123', name: 'Priya Kadam', role: 'FARMER', verified: true },
    { email: 'freshcart@krishisetu.dev', password: 'buyer123', name: 'FreshCart Foods', role: 'BUYER', verified: true, company: 'FreshCart Foods', city: 'Nashik', state: 'Maharashtra' },
    { email: 'harbor@krishisetu.dev', password: 'buyer123', name: 'Harbor Foods Co.', role: 'BUYER', verified: true, company: 'Harbor Foods Co.', city: 'Mumbai', state: 'Maharashtra' },
    { email: 'greenbasket@krishisetu.dev', password: 'buyer123', name: 'GreenBasket Retail', role: 'BUYER', verified: true, company: 'GreenBasket Retail', city: 'Pune', state: 'Maharashtra' },
    { email: 'fpo@krishisetu.dev', password: 'fpo123', name: 'Nashik Farmers Collective', role: 'FPO', verified: true },
    { email: 'quality@krishisetu.dev', password: 'quality123', name: 'Anil Deshmukh', role: 'QUALITY_ASSESSOR', verified: true },
    { email: 'logistics@krishisetu.dev', password: 'logistics123', name: 'GreenLine Logistics', role: 'LOGISTICS_PROVIDER', verified: true },
  ],
  markets: [
    { name: 'Lasalgaon Mandi', location: 'Lasalgaon, Nashik', district: 'Nashik', state: 'Maharashtra', prices: [{ crop: 'Onion', grade: 'Grade A', price: 2420 }, { crop: 'Tomato', grade: 'Grade A', price: 1800 }] },
    { name: 'Pune APMC', location: 'Pune, Maharashtra', district: 'Pune', state: 'Maharashtra', prices: [{ crop: 'Onion', grade: 'Grade A', price: 2680 }, { crop: 'Tomato', grade: 'Grade A', price: 1920 }] },
    { name: 'Mumbai Vashi', location: 'Vashi, Mumbai', district: 'Mumbai', state: 'Maharashtra', prices: [{ crop: 'Onion', grade: 'Grade A', price: 2790 }, { crop: 'Tomato', grade: 'Grade A', price: 2050 }] },
    { name: 'Nashik APMC', location: 'Nashik, Maharashtra', district: 'Nashik', state: 'Maharashtra', prices: [{ crop: 'Onion', grade: 'Grade A', price: 2380 }] },
  ],
  demands: [
    { buyerEmail: 'freshcart@krishisetu.dev', crop: 'Onion', qty: 60, minQuality: 'Grade A', location: 'Nashik, Maharashtra', requireInDays: 5, price: 2450 },
    { buyerEmail: 'harbor@krishisetu.dev', crop: 'Onion', qty: 120, minQuality: 'Grade A', location: 'Vashi, Mumbai', requireInDays: 8, price: 2760 },
    { buyerEmail: 'greenbasket@krishisetu.dev', crop: 'Onion', qty: 80, minQuality: 'Grade A', location: 'Pune, Maharashtra', requireInDays: 4, price: 2650 },
  ],
};

async function seedIfNeeded() {
  console.log('[seed] ensuring demo users …');
  const users = {};
  for (const u of DEMO.users) {
    let existing = await prisma.user.findUnique({
      where: { email: u.email.toLowerCase() },
      include: { farmer: true, buyer: true, fpo: true },
    });
    if (existing) { users[u.email] = existing; continue; }
    const passwordHash = await bcrypt.hash(u.password, 10);
    const created = await prisma.user.create({
      data: {
        email: u.email.toLowerCase(),
        passwordHash,
        name: u.name,
        role: u.role,
        verified: u.verified || false,
        farmer: u.role === 'FARMER' ? { create: { village: 'Pimpalgaon', district: 'Nashik', state: 'Maharashtra', pincode: '422209' } } : undefined,
        buyer: u.role === 'BUYER' ? { create: { companyName: u.company || u.name, city: u.city, state: u.state, kycStatus: 'verified' } } : undefined,
        fpo: u.role === 'FPO' ? { create: { name: u.name, district: 'Nashik', state: 'Maharashtra' } } : undefined,
      },
      include: { farmer: true, buyer: true, fpo: true },
    });
    users[u.email] = created;
  }

  // Everything below (markets, demands, lot) only runs on truly fresh DB
  const marketCount = await prisma.market.count();
  if (marketCount > 0) {
    console.log('[seed] markets already present; skipping domain seed');
    return;
  }
  console.log('[seed] planting domain data …');

  // Attach farmers to FPO
  const fpo = users['fpo@krishisetu.dev'].fpo;
  await prisma.farmer.updateMany({ where: { userId: { in: [users['rajesh@krishisetu.dev'].id, users['priya@krishisetu.dev'].id] } }, data: { fpoId: fpo.id } });

  // Markets + prices
  for (const m of DEMO.markets) {
    const market = await prisma.market.create({
      data: { name: m.name, location: m.location, district: m.district, state: m.state, isDemo: true },
    });
    for (const p of m.prices) {
      await prisma.marketPrice.create({
        data: { marketId: market.id, crop: p.crop, grade: p.grade, pricePerQuintal: p.price, source: 'demo' },
      });
    }
  }

  // Buyer demands
  for (const d of DEMO.demands) {
    const buyerUser = users[d.buyerEmail];
    if (!buyerUser?.buyer) continue;
    await prisma.buyerDemand.create({
      data: {
        buyerId: buyerUser.buyer.id,
        crop: d.crop,
        quantityQuintals: d.qty,
        minQuality: d.minQuality,
        location: d.location,
        requiredBy: new Date(Date.now() + d.requireInDays * 86400 * 1000),
        pricePerQuintal: d.price,
        active: true,
      },
    });
  }

  // Rajesh's demo lot
  const rajesh = users['rajesh@krishisetu.dev'].farmer;
  await prisma.lot.create({
    data: {
      code: 'LOT-2409-0001',
      farmerId: rajesh.id,
      crop: 'Onion',
      variety: 'Pimpalgaon Red',
      quantityQuintals: new Decimal(120),   // 12 tonnes ≈ 120 quintals
      quality: 'Grade A',
      qualityConfidence: 92,
      harvestDate: new Date(Date.now() - 3 * 86400 * 1000),
      pickupLocation: 'Pimpalgaon, Nashik, Maharashtra',
      pickupLatitude: 20.145,
      pickupLongitude: 74.238,
      timeline: 'Within 7 days',
      askPricePerQuintal: 2500,
      status: 'AVAILABLE',
    },
  });

  console.log('[seed] complete. Demo users:');
  for (const u of DEMO.users) console.log(`  ${u.role.padEnd(20)} ${u.email}  /  ${u.password}`);
}

module.exports = { seedIfNeeded };

if (require.main === module) {
  seedIfNeeded().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

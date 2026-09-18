// Deterministic buyer matching + top-3 recommendation engine.

const { Decimal } = require('decimal.js');
const { prisma } = require('../db');
const { computeNetRealisation, haversineKm, estimateTravelTime, confidenceFor } = require('./netRealisation');

// Approx city centroid coords for demo mandis when latitude is missing
const CITY_COORDS = {
  Nashik: [19.9975, 73.7898],
  Pune: [18.5204, 73.8567],
  Mumbai: [19.076, 72.8777],
  Lasalgaon: [20.145, 74.238],
  Vashi: [19.077, 73.0],
};

function coordsFor(text = '') {
  const key = Object.keys(CITY_COORDS).find((k) => text.toLowerCase().includes(k.toLowerCase()));
  return key ? CITY_COORDS[key] : null;
}

function distanceBetween(a, b) {
  const from = coordsFor(a);
  const to = coordsFor(b);
  if (from && to) return haversineKm(from[0], from[1], to[0], to[1]);
  // fallback estimate: 60 km baseline
  return 60;
}

function demandLabelFor(demand) {
  if (!demand) return 'Medium';
  const daysLeft = (new Date(demand.requiredBy).getTime() - Date.now()) / (86400 * 1000);
  if (daysLeft <= 3) return 'High';
  if (daysLeft <= 7) return 'Rising';
  return 'Medium';
}

/**
 * Compute a set of ranked recommendations for a lot.
 * Options considered:
 *   1. Each buyer demand matching this crop (bought straight)
 *   2. Each market with a recent price for this crop
 *   3. A "store 30 days" option (if best current market has a forecast >= +8%)
 */
async function computeRecommendationsForLot(lotId) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw Object.assign(new Error('Lot not found'), { status: 404 });

  const [buyerDemands, marketPrices] = await Promise.all([
    prisma.buyerDemand.findMany({
      where: { crop: { equals: lot.crop, mode: 'insensitive' }, active: true },
      include: { buyer: true },
      orderBy: { pricePerQuintal: 'desc' },
    }),
    prisma.marketPrice.findMany({
      where: { crop: { equals: lot.crop, mode: 'insensitive' } },
      include: { market: true },
      orderBy: { recordedAt: 'desc' },
    }),
  ]);

  // Deduplicate market prices — latest per market
  const latestPerMarket = new Map();
  for (const p of marketPrices) {
    if (!latestPerMarket.has(p.marketId)) latestPerMarket.set(p.marketId, p);
  }

  const options = [];

  // Buyer-direct options
  for (const d of buyerDemands) {
    const buyerLocation = `${d.location}`;
    const distanceKm = distanceBetween(lot.pickupLocation, buyerLocation);
    const nr = computeNetRealisation({
      quantityQuintals: lot.quantityQuintals,
      pricePerQuintal: d.pricePerQuintal,
      distanceKm,
      quality: lot.quality,
      mode: 'sell_now',
    });
    const demand = demandLabelFor(d);
    options.push({
      type: 'SELL_NOW',
      channel: 'buyer',
      buyerId: d.buyerId,
      buyerName: d.buyer.companyName,
      demandId: d.id,
      marketId: null,
      marketName: `Direct to ${d.buyer.companyName}`,
      location: buyerLocation,
      distanceKm,
      travelTime: estimateTravelTime(distanceKm),
      pricePerQuintal: new Decimal(d.pricePerQuintal),
      demand,
      timing: `Required by ${new Date(d.requiredBy).toDateString()}`,
      nr,
      confidence: confidenceFor({ demand, distanceKm, quality: lot.quality, mode: 'sell_now' }),
      reason: `Direct buyer demand at ₹${new Decimal(d.pricePerQuintal).toFixed(0)}/quintal for ${new Decimal(d.quantityQuintals).toFixed(0)}q; delivery ${estimateTravelTime(distanceKm)} away.`,
    });
  }

  // Market options
  for (const [, mp] of latestPerMarket) {
    const marketLoc = mp.market.location;
    const distanceKm = distanceBetween(lot.pickupLocation, marketLoc);
    const nr = computeNetRealisation({
      quantityQuintals: lot.quantityQuintals,
      pricePerQuintal: mp.pricePerQuintal,
      distanceKm,
      quality: lot.quality,
      mode: 'sell_now',
    });
    // demand heuristic for mandi: higher price => higher demand
    const priceNum = Number(mp.pricePerQuintal);
    const demand = priceNum > 2700 ? 'High' : priceNum > 2500 ? 'Rising' : 'Medium';
    options.push({
      type: 'SELL_NOW',
      channel: 'market',
      buyerId: null,
      buyerName: null,
      demandId: null,
      marketId: mp.marketId,
      marketName: mp.market.name,
      location: marketLoc,
      distanceKm,
      travelTime: estimateTravelTime(distanceKm),
      pricePerQuintal: new Decimal(mp.pricePerQuintal),
      demand,
      timing: 'Pickup available within 2–3 days',
      nr,
      confidence: confidenceFor({ demand, distanceKm, quality: lot.quality, mode: 'sell_now' }),
      reason: `Latest ${mp.market.name} price ₹${new Decimal(mp.pricePerQuintal).toFixed(0)}/quintal, ${distanceKm.toFixed(0)} km away.`,
    });
  }

  // Sort by net realisation desc
  options.sort((a, b) => Number(b.nr.netRealisation.minus(a.nr.netRealisation)));

  // Store-and-sell option: use best market's price + 8% forecast
  let storeOption = null;
  if (options.length > 0) {
    const bestMarket = options.find((o) => o.channel === 'market') || options[0];
    const forecastPrice = new Decimal(bestMarket.pricePerQuintal).mul(1.08);
    const storeNr = computeNetRealisation({
      quantityQuintals: lot.quantityQuintals,
      pricePerQuintal: forecastPrice,
      distanceKm: bestMarket.distanceKm,
      quality: lot.quality,
      storageDays: 30,
      mode: 'store',
    });
    storeOption = {
      type: 'STORE_AND_SELL',
      channel: 'store',
      buyerId: null,
      buyerName: bestMarket.buyerName,
      demandId: null,
      marketId: bestMarket.marketId,
      marketName: `Store 30 days → ${bestMarket.marketName}`,
      location: bestMarket.location,
      distanceKm: bestMarket.distanceKm,
      travelTime: bestMarket.travelTime,
      pricePerQuintal: forecastPrice.toDecimalPlaces(2),
      demand: 'Rising',
      timing: 'Sell after ~30 days',
      nr: storeNr,
      confidence: confidenceFor({ demand: 'Rising', distanceKm: bestMarket.distanceKm, quality: lot.quality, mode: 'store' }),
      reason: `Forecast +8% future price (₹${forecastPrice.toFixed(0)}/q) vs current best. Includes 30-day storage & 3.5% spoilage; forecast is an estimate.`,
    };
  }

  const topThree = options.slice(0, 3);
  const sellNowBest = options[0] || null;

  return {
    lot,
    options,
    topThree,
    storeOption,
    sellNowBest,
    comparison: sellNowBest && storeOption ? {
      sellNowNet: sellNowBest.nr.netRealisation,
      storeNet: storeOption.nr.netRealisation,
      difference: sellNowBest.nr.netRealisation.minus(storeOption.nr.netRealisation),
      preferred: sellNowBest.nr.netRealisation.gte(storeOption.nr.netRealisation) ? 'sell_now' : 'store',
    } : null,
  };
}

// Save recommendations to DB so AI + audit have consistent snapshot
async function persistRecommendations(lotId, result) {
  await prisma.recommendation.deleteMany({ where: { lotId } });
  const items = [...result.topThree];
  if (result.storeOption) items.push(result.storeOption);
  await prisma.$transaction(
    items.map((o, idx) =>
      prisma.recommendation.create({
        data: {
          lotId,
          rank: idx + 1,
          type: o.type,
          marketId: o.marketId,
          buyerId: o.buyerId,
          distanceKm: o.distanceKm,
          travelTime: o.travelTime,
          grossRevenue: o.nr.grossRevenue,
          transportCost: o.nr.transportCost,
          storageCost: o.nr.storageCost,
          commissionCost: o.nr.commissionCost,
          packagingCost: o.nr.packagingCost,
          spoilageCost: o.nr.spoilageCost,
          otherCost: o.nr.otherCost,
          netRealisation: o.nr.netRealisation,
          effectivePricePerQuintal: o.nr.effectivePricePerQuintal,
          confidence: o.confidence,
          reason: o.reason,
        },
      })
    )
  );

  // Persist buyer matches (for buyer-channel options)
  const matches = result.options.filter((o) => o.demandId);
  if (matches.length) {
    await prisma.buyerMatch.deleteMany({ where: { lotId } });
    await prisma.$transaction(
      matches.map((m) =>
        prisma.buyerMatch.create({
          data: {
            lotId,
            demandId: m.demandId,
            matchScore: m.confidence,
            reason: m.reason,
          },
        })
      )
    );
  }
}

function serializeOption(o) {
  return {
    type: o.type,
    channel: o.channel,
    buyerId: o.buyerId,
    buyerName: o.buyerName,
    demandId: o.demandId,
    marketId: o.marketId,
    marketName: o.marketName,
    location: o.location,
    distanceKm: Number(o.distanceKm.toFixed ? o.distanceKm.toFixed(2) : o.distanceKm),
    travelTime: o.travelTime,
    pricePerQuintal: Number(o.pricePerQuintal.toFixed(2)),
    demand: o.demand,
    timing: o.timing,
    confidence: o.confidence,
    reason: o.reason,
    breakdown: {
      grossRevenue: Number(o.nr.grossRevenue.toFixed(2)),
      transportCost: Number(o.nr.transportCost.toFixed(2)),
      commissionCost: Number(o.nr.commissionCost.toFixed(2)),
      packagingCost: Number(o.nr.packagingCost.toFixed(2)),
      spoilageCost: Number(o.nr.spoilageCost.toFixed(2)),
      storageCost: Number(o.nr.storageCost.toFixed(2)),
      otherCost: Number(o.nr.otherCost.toFixed(2)),
      netRealisation: Number(o.nr.netRealisation.toFixed(2)),
      effectivePricePerQuintal: Number(o.nr.effectivePricePerQuintal.toFixed(2)),
    },
  };
}

function serializeResult(result) {
  return {
    lotId: result.lot.id,
    lotCode: result.lot.code,
    crop: result.lot.crop,
    quantityQuintals: Number(result.lot.quantityQuintals),
    quality: result.lot.quality,
    options: result.options.map(serializeOption),
    topThree: result.topThree.map(serializeOption),
    storeOption: result.storeOption ? serializeOption(result.storeOption) : null,
    sellNowBest: result.sellNowBest ? serializeOption(result.sellNowBest) : null,
    comparison: result.comparison ? {
      sellNowNet: Number(result.comparison.sellNowNet.toFixed(2)),
      storeNet: Number(result.comparison.storeNet.toFixed(2)),
      difference: Number(result.comparison.difference.toFixed(2)),
      preferred: result.comparison.preferred,
    } : null,
    generatedAt: new Date().toISOString(),
    demoNotice: 'Prices and demand come from clearly-labelled demo/seeded data. Farmer remains the final decision-maker.',
  };
}

module.exports = { computeRecommendationsForLot, persistRecommendations, serializeOption, serializeResult, distanceBetween };

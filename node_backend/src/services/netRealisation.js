// Net realisation engine — Decimal-safe
// All formulas are deterministic and transparent. Used by AI as a tool.

const { Decimal } = require('decimal.js');

// Standardized rates (demo, but transparent and consistent)
const RATES = {
  transportPerQuintalPerKm: new Decimal(2.4),   // ₹ per quintal per km
  commissionPct: new Decimal(0.012),             // 1.2%
  packagingPerQuintal: new Decimal(85),          // ₹ per quintal (bags/loading)
  spoilagePctFresh: new Decimal(0.018),          // 1.8% for immediate sale
  spoilagePctStored: new Decimal(0.035),         // 3.5% after 30 days storage
  storagePerQuintalPerDay: new Decimal(5.33),    // ₹ per quintal per day (~₹160/30d)
  otherPerQuintal: new Decimal(12),              // insurance/handling misc
  qualityMultipliers: { 'Grade A': 1.0, 'Grade B': 0.9, 'Mixed lot': 0.8 },
};

function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null)) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function estimateTravelTime(distanceKm) {
  // 40 km/h average incl loading stops
  const hours = distanceKm / 40;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/**
 * Compute net realisation for a lot sold at a given market/buyer.
 * @param {Object} args
 * @param {Decimal|number|string} args.quantityQuintals
 * @param {Decimal|number|string} args.pricePerQuintal
 * @param {number} args.distanceKm
 * @param {string} args.quality        "Grade A" | "Grade B" | "Mixed lot"
 * @param {number} args.storageDays    default 0 (sell now)
 * @param {"sell_now"|"store"} args.mode
 */
function computeNetRealisation({ quantityQuintals, pricePerQuintal, distanceKm, quality, storageDays = 0, mode = 'sell_now' }) {
  const qty = new Decimal(quantityQuintals);
  const price = new Decimal(pricePerQuintal);
  const dist = new Decimal(distanceKm || 0);
  const qMult = new Decimal(RATES.qualityMultipliers[quality] ?? 0.85);
  const effectivePrice = price.mul(qMult);

  const grossRevenue = qty.mul(effectivePrice);
  const transportCost = qty.mul(RATES.transportPerQuintalPerKm).mul(dist);
  const commissionCost = grossRevenue.mul(RATES.commissionPct);
  const packagingCost = qty.mul(RATES.packagingPerQuintal);
  const spoilagePct = mode === 'store' ? RATES.spoilagePctStored : RATES.spoilagePctFresh;
  const spoilageCost = grossRevenue.mul(spoilagePct);
  const storageCost = mode === 'store' ? qty.mul(RATES.storagePerQuintalPerDay).mul(new Decimal(storageDays)) : new Decimal(0);
  const otherCost = qty.mul(RATES.otherPerQuintal);

  const netRealisation = grossRevenue
    .minus(transportCost)
    .minus(commissionCost)
    .minus(packagingCost)
    .minus(spoilageCost)
    .minus(storageCost)
    .minus(otherCost);

  const effectivePricePerQuintal = qty.eq(0) ? new Decimal(0) : netRealisation.div(qty);

  return {
    grossRevenue: round(grossRevenue),
    transportCost: round(transportCost),
    commissionCost: round(commissionCost),
    packagingCost: round(packagingCost),
    spoilageCost: round(spoilageCost),
    storageCost: round(storageCost),
    otherCost: round(otherCost),
    netRealisation: round(netRealisation),
    effectivePricePerQuintal: round(effectivePricePerQuintal),
    inputs: {
      qualityMultiplier: qMult.toFixed(2),
      pricePerQuintal: price.toFixed(2),
      effectivePricePerQuintal: round(effectivePrice).toFixed(2),
      distanceKm: dist.toFixed(2),
      storageDays,
      mode,
    },
    rates: {
      transportPerQuintalPerKm: RATES.transportPerQuintalPerKm.toString(),
      commissionPct: RATES.commissionPct.toString(),
      packagingPerQuintal: RATES.packagingPerQuintal.toString(),
      spoilagePct: spoilagePct.toString(),
      storagePerQuintalPerDay: RATES.storagePerQuintalPerDay.toString(),
      otherPerQuintal: RATES.otherPerQuintal.toString(),
    },
  };
}

function round(dec) {
  return new Decimal(dec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function confidenceFor({ demand, distanceKm, quality, mode }) {
  let base = 82;
  if (demand === 'High') base += 8;
  else if (demand === 'Rising') base += 4;
  else if (demand === 'Low') base -= 6;
  if (distanceKm < 60) base += 3;
  else if (distanceKm > 200) base -= 6;
  if (quality === 'Grade A') base += 3;
  else if (quality === 'Mixed lot') base -= 5;
  if (mode === 'store') base -= 8; // future price uncertainty
  return Math.max(35, Math.min(96, base));
}

module.exports = { computeNetRealisation, haversineKm, estimateTravelTime, confidenceFor, RATES };

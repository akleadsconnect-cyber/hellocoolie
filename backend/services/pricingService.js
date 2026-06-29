const { pool } = require('../config/db');

// ── Get current season (festival or normal) ─────────────────
const getCurrentSeason = async () => {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT * FROM surge_config
     WHERE is_active = TRUE AND start_date <= $1 AND end_date >= $1
     ORDER BY created_at DESC LIMIT 1`,
    [today]
  );
  return result.rows[0] || null;
};

// ── Get city tier pricing ───────────────────────────────────
const getCityTierPricing = async (cityTier = 'y') => {
  const result = await pool.query(
    'SELECT * FROM city_tier_pricing WHERE city_tier = $1',
    [cityTier]
  );
  return result.rows[0];
};

// ── Calculate full fare breakdown ───────────────────────────
const calculateFare = async ({ cityTier = 'y', bagCount, bagWeight, dropLocation }) => {
  const pricing = await getCityTierPricing(cityTier);
  const surge   = await getCurrentSeason();

  const baseFare = parseFloat(pricing.base_fare);

  // Bag fare per bag based on weight
  const bagFareMap = {
    normal:    parseFloat(pricing.bag_fare_normal),
    medium:    parseFloat(pricing.bag_fare_medium),
    heavy:     parseFloat(pricing.bag_fare_heavy),
    very_heavy:parseFloat(pricing.bag_fare_very_heavy),
  };
  const bagFarePerBag = bagFareMap[bagWeight] || bagFareMap.normal;
  const bagFare = bagFarePerBag * bagCount;

  // Distance fare
  const distanceFareMap = {
    platform: parseFloat(pricing.distance_platform),
    exit:     parseFloat(pricing.distance_exit),
    auto:     parseFloat(pricing.distance_auto),
  };
  const distanceFare = distanceFareMap[dropLocation] || 0;

  const subtotal = baseFare + bagFare + distanceFare;

  // Platform fee
  let platformFeePct = parseFloat(pricing.platform_fee_pct);
  let seasonType = 'normal';
  if (surge) {
    platformFeePct = parseFloat(surge.platform_fee_pct);
    seasonType = surge.season_type;
  }

  const platformFee  = Math.round(subtotal * platformFeePct / 100);
  const porterAmount = subtotal - platformFee;
  const totalAmount  = subtotal;

  // Two porter logic — 5+ bags: fare is DOUBLED (2 base fares + bags split per porter)
  const twoPorterSuggested = bagCount >= 5;

  // If two porter accepted, double the base fare and each porter carries half bags
  let finalBaseFare   = baseFare;
  let finalBagFare    = bagFare;
  let finalSubtotal   = subtotal;
  let porterCount     = 1;

  if (twoPorterSuggested) {
    // 2 porters = 2x base fare, bag fare stays same (shared between porters)
    finalBaseFare  = baseFare * 2;
    finalSubtotal  = finalBaseFare + finalBagFare + distanceFare;
    porterCount    = 2;
  }

  const finalPlatformFee  = Math.round(finalSubtotal * platformFeePct / 100);
  const finalPorterAmount = finalSubtotal - finalPlatformFee; // total porter earnings (split between 2)
  const finalTotal        = finalSubtotal;

  return {
    baseFare:      finalBaseFare,
    bagFare:       finalBagFare,
    distanceFare,
    subtotal:      finalSubtotal,
    platformFeePct,
    platformFee:   finalPlatformFee,
    porterAmount:  finalPorterAmount,
    totalAmount:   finalTotal,
    seasonType,
    cityTier,
    twoPorterSuggested,
    porterCount,
    breakdown: {
      base:     twoPorterSuggested ? `₹${baseFare} × 2 porters = ₹${finalBaseFare}` : `₹${baseFare}`,
      bags:     `₹${bagFarePerBag} × ${bagCount} bags = ₹${finalBagFare}`,
      distance: `₹${distanceFare}`,
      platform: `${platformFeePct}% = ₹${finalPlatformFee}`,
      total:    `₹${finalTotal}`,
      porter:   twoPorterSuggested
        ? `₹${finalPorterAmount} total (₹${Math.round(finalPorterAmount/2)} each porter)`
        : `₹${finalPorterAmount}`,
    },
  };
};

module.exports = { calculateFare, getCurrentSeason, getCityTierPricing };

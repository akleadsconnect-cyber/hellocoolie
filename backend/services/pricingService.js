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

  // Two porter suggestion
  const twoPorterSuggested = bagCount >= 5;

  return {
    baseFare,
    bagFare,
    distanceFare,
    subtotal,
    platformFeePct,
    platformFee,
    porterAmount,
    totalAmount,
    seasonType,
    cityTier,
    twoPorterSuggested,
    breakdown: {
      base:     `₹${baseFare}`,
      bags:     `₹${bagFarePerBag} × ${bagCount} bags = ₹${bagFare}`,
      distance: `₹${distanceFare}`,
      platform: `${platformFeePct}% = ₹${platformFee}`,
      total:    `₹${totalAmount}`,
      porter:   `₹${porterAmount} (${100 - platformFeePct}%)`,
    },
  };
};

module.exports = { calculateFare, getCurrentSeason, getCityTierPricing };

const LoyaltyLedger = require('../models/LoyaltyLedger');
const loyaltyService = require('../services/loyalty.service');
const { TIER_THRESHOLDS } = require('../models/Shop');

async function getSummary(req, res, next) {
  try {
    const shop = req.shop;
    const currentIndex = TIER_THRESHOLDS.findIndex((t) => t.tier === shop.tier);
    const nextTier = TIER_THRESHOLDS[currentIndex - 1]; // thresholds are ordered highest -> lowest

    res.json({
      success: true,
      tier: shop.tier,
      crateCoins: shop.crateCoins,
      monthlyOrderValue: shop.monthlyOrderValue,
      nextTier: nextTier
        ? { tier: nextTier.tier, amountNeeded: Math.max(nextTier.min - shop.monthlyOrderValue, 0) }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

async function getLedger(req, res, next) {
  try {
    const entries = await LoyaltyLedger.find({ shop: req.shop._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, entries });
  } catch (err) {
    next(err);
  }
}

async function redeemCoins(req, res, next) {
  try {
    const { coins, reason } = req.body;
    const balance = await loyaltyService.redeem(req.shop, coins, reason);
    await req.shop.save();
    res.json({ success: true, crateCoins: balance });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getLedger, redeemCoins };

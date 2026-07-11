const LoyaltyLedger = require('../models/LoyaltyLedger');

const COINS_PER_RUPEE = 0.1; // ₹1 spent → 0.1 crate coin (₹10 spent → 1 coin)

/**
 * Credits coins for a completed order, updates the shop's rolling monthly
 * order value (which drives tier progression), and writes an audit row.
 * Mutates `shop` in memory — caller is responsible for shop.save().
 */
async function earnForOrder(shop, order) {
  const coins = Math.round(order.total * COINS_PER_RUPEE);

  shop.crateCoins += coins;
  shop.monthlyOrderValue += order.total;
  const newTier = shop.recomputeTier();

  await LoyaltyLedger.create({
    shop: shop._id,
    type: 'earn',
    coins,
    order: order._id,
    reason: `Earned on order ${order.docketId}`,
    balanceAfter: shop.crateCoins,
  });

  return { coinsEarned: coins, tier: newTier };
}

async function redeem(shop, coins, reason) {
  if (shop.crateCoins < coins) {
    throw new Error('Insufficient crate coins.');
  }
  shop.crateCoins -= coins;

  await LoyaltyLedger.create({
    shop: shop._id,
    type: 'redeem',
    coins: -coins,
    reason,
    balanceAfter: shop.crateCoins,
  });

  return shop.crateCoins;
}

async function referralBonus(shop, coins = 500) {
  shop.crateCoins += coins;
  await LoyaltyLedger.create({
    shop: shop._id,
    type: 'referral_bonus',
    coins,
    reason: 'Referral bonus',
    balanceAfter: shop.crateCoins,
  });
  return shop.crateCoins;
}

module.exports = { earnForOrder, redeem, referralBonus, COINS_PER_RUPEE };

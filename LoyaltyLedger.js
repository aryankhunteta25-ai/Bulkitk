const mongoose = require('mongoose');

const loyaltyLedgerSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    type: { type: String, enum: ['earn', 'redeem', 'referral_bonus'], required: true },
    coins: { type: Number, required: true }, // positive for earn, negative for redeem
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    reason: String,
    balanceAfter: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoyaltyLedger', loyaltyLedgerSchema);

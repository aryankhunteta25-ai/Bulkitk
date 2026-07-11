const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const shopSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    gstin: { type: String, trim: true, uppercase: true },

    defaultAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },

    // Loyalty
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    crateCoins: { type: Number, default: 0 },
    monthlyOrderValue: { type: Number, default: 0 }, // rolling value used for tier progression

    // Credit line (Udhaar)
    creditLimit: { type: Number, default: 20000 },
    creditUsed: { type: Number, default: 0 },
    creditRepaymentDueDate: { type: Date },

    staffAccounts: [
      {
        name: String,
        phone: String,
        role: { type: String, enum: ['counter', 'manager'], default: 'counter' },
      },
    ],

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shopSchema.virtual('creditAvailable').get(function () {
  return Math.max(this.creditLimit - this.creditUsed, 0);
});

shopSchema.set('toJSON', { virtuals: true });

shopSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

shopSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

// Tier thresholds based on rolling monthly order value (₹)
const TIER_THRESHOLDS = [
  { tier: 'platinum', min: 150000 },
  { tier: 'gold', min: 60000 },
  { tier: 'silver', min: 20000 },
  { tier: 'bronze', min: 0 },
];

shopSchema.methods.recomputeTier = function () {
  const match = TIER_THRESHOLDS.find((t) => this.monthlyOrderValue >= t.min);
  this.tier = match ? match.tier : 'bronze';
  return this.tier;
};

module.exports = mongoose.model('Shop', shopSchema);
module.exports.TIER_THRESHOLDS = TIER_THRESHOLDS;

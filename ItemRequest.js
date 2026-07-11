const mongoose = require('mongoose');

const itemRequestSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    itemName: { type: String, required: true },
    brand: String,
    quantityNeeded: String,
    notes: String,
    status: {
      type: String,
      enum: ['submitted', 'sourcing', 'quoted', 'fulfilled', 'declined'],
      default: 'submitted',
    },
    quotedPricePerPack: Number,
    respondedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ItemRequest', itemRequestSchema);

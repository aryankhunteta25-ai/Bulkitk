const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String, // snapshot, in case product name/price changes later
    packUnit: String,
    qty: { type: Number, required: true, min: 1 },
    unitPrice: Number, // after slab discount
    lineTotal: Number,
    appliedSlabDiscountPercent: { type: Number, default: 0 },
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const ORDER_DOCKET_PREFIX = 'BLK';

const orderSchema = new mongoose.Schema(
  {
    docketId: { type: String, unique: true, index: true }, // e.g. BLK-88421
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    deliveryAddress: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },

    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ['credit_line', 'upi', 'card'],
      required: true,
    },
    coinsEarned: { type: Number, default: 0 },

    deliverySlot: {
      type: String,
      enum: ['express_24h', 'scheduled'],
      default: 'express_24h',
    },
    scheduledFor: Date,

    status: {
      type: String,
      enum: ['confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'confirmed',
    },
    timeline: [timelineEventSchema],

    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' },

    // Route info computed via Google Directions API when dispatched
    route: {
      distanceMeters: Number,
      durationSeconds: Number,
      polyline: String, // encoded polyline, decode client-side to draw on Google Maps
      originLat: Number,
      originLng: Number,
      destinationLat: Number,
      destinationLng: Number,
    },

    // Live ETA — recomputed periodically from the partner's live location via Distance Matrix
    liveEta: {
      minutesRemaining: Number,
      lastComputedAt: Date,
    },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function (next) {
  if (!this.docketId) {
    const rand = Math.floor(10000 + Math.random() * 90000);
    this.docketId = `${ORDER_DOCKET_PREFIX}-${rand}`;
  }
  if (this.isNew) {
    this.timeline.push({ status: 'confirmed', note: 'Order confirmed by Bulk It.' });
  }
  next();
});

/** Google Maps deep link for one-tap turn-by-turn navigation to the shop */
orderSchema.methods.navigationUrl = function () {
  const lat = this.route?.destinationLat;
  const lng = this.route?.destinationLng;
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
};

module.exports = mongoose.model('Order', orderSchema);

const mongoose = require('mongoose');

const slabSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true }, // pack-unit qty at/above which slab applies
    discountPercent: { type: Number, required: true },
    freeDelivery: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        'grocery_staples',
        'personal_care',
        'household',
        'beverages',
        'snacks_biscuits',
        'dairy_frozen',
      ],
    },
    packUnit: { type: String, required: true }, // e.g. "carton", "sack", "case", "box"
    packSize: { type: String, required: true }, // e.g. "24 packs of 1kg"
    pricePerPack: { type: Number, required: true }, // ₹ per pack unit before slabs
    slabs: [slabSchema], // sorted ascending by minQty
    stockAvailable: { type: Number, default: 9999 }, // in pack units, at nearest hub
    isActive: { type: Boolean, default: true },

    images: [{ type: String }], // image URLs (hosted externally — S3/Cloudinary etc.)

    // ===== Marketplace: who listed this product =====
    sourceType: {
      type: String,
      enum: ['platform', 'vendor'],
      default: 'platform',
      index: true,
    },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

    // Platform-added products are auto-approved. Vendor-added products start
    // 'pending' and only appear in the public catalog once an admin approves them.
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    rejectionReason: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', brand: 'text' });

/** Only what should ever be visible in the shop-owner-facing catalog. */
productSchema.statics.PUBLIC_CATALOG_FILTER = {
  isActive: true,
  approvalStatus: 'approved',
};

/**
 * Given a quantity (in pack units), returns the best applicable slab.
 */
productSchema.methods.bestSlabFor = function (qty) {
  const applicable = (this.slabs || [])
    .filter((s) => qty >= s.minQty)
    .sort((a, b) => b.minQty - a.minQty);
  return applicable[0] || null;
};

productSchema.methods.priceFor = function (qty) {
  const slab = this.bestSlabFor(qty);
  const unitPrice = slab
    ? +(this.pricePerPack * (1 - slab.discountPercent / 100)).toFixed(2)
    : this.pricePerPack;
  return {
    unitPrice,
    lineTotal: +(unitPrice * qty).toFixed(2),
    appliedSlab: slab,
  };
};

productSchema.methods.adjustStock = function (delta) {
  this.stockAvailable = Math.max(this.stockAvailable + delta, 0);
  return this.stockAvailable;
};

module.exports = mongoose.model('Product', productSchema);

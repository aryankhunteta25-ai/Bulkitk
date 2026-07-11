const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema(
  {
    vendorName: { type: String, required: true, trim: true }, // business/company name
    contactName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    gstin: { type: String, trim: true, uppercase: true },

    warehouseCity: { type: String },
    warehouseState: { type: String },

    commissionRate: { type: Number, default: 8 }, // % Bulk It takes on vendor sales

    // A vendor must be verified by the platform before any of their products go live,
    // regardless of individual product approval status.
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    rating: { type: Number, default: 0 },
    totalProductsListed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

vendorSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

vendorSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('Vendor', vendorSchema);

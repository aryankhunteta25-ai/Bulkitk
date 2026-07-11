require('dotenv').config();
const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');

async function seed() {
  await connectDB();

  // --- Admin account ---
  const existingAdmin = await Admin.findOne({ email: 'admin@bulkit.in' });
  if (!existingAdmin) {
    const passwordHash = await Admin.hashPassword('admin123');
    await Admin.create({
      name: 'Bulk It Catalog Team',
      email: 'admin@bulkit.in',
      passwordHash,
      role: 'superadmin',
    });
    console.log('Seeded admin: admin@bulkit.in / admin123');
  }

  // --- Sample vendor (verified) ---
  let vendor = await Vendor.findOne({ phone: '9888800000' });
  if (!vendor) {
    const passwordHash = await Vendor.hashPassword('vendor123');
    vendor = await Vendor.create({
      vendorName: 'Marwar Foods Distributors',
      contactName: 'Suresh Choudhary',
      phone: '9888800000',
      email: 'suresh@marwarfoods.example',
      passwordHash,
      gstin: '08AACR9988A1Z2',
      warehouseCity: 'Jodhpur',
      warehouseState: 'Rajasthan',
      isVerified: true,
    });
    console.log('Seeded vendor: phone 9888800000 / vendor123 (verified)');
  }

  // --- One pending vendor-submitted product, so the admin approval queue isn't empty ---
  const existingVendorProduct = await Product.findOne({ vendor: vendor._id });
  if (!existingVendorProduct) {
    await Product.create({
      name: 'MDH Deggi Mirch Masala 100g',
      brand: 'MDH',
      category: 'grocery_staples',
      packUnit: 'box',
      packSize: '48 packs of 100g',
      pricePerPack: 1180,
      slabs: [{ minQty: 4, discountPercent: 4 }],
      stockAvailable: 80,
      sourceType: 'vendor',
      vendor: vendor._id,
      approvalStatus: 'pending',
    });
    console.log('Seeded one pending vendor product for the admin approval queue.');
  }

  console.log('Marketplace seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

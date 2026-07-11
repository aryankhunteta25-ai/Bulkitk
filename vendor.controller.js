const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const { generateRoleToken } = require('../utils/generateToken');

async function register(req, res, next) {
  try {
    const { vendorName, contactName, phone, email, password, gstin, warehouseCity, warehouseState } = req.body;

    const existing = await Vendor.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone number already registered as a vendor.' });
    }

    const passwordHash = await Vendor.hashPassword(password);
    const vendor = await Vendor.create({
      vendorName,
      contactName,
      phone,
      email,
      passwordHash,
      gstin,
      warehouseCity,
      warehouseState,
    });

    // Vendors are NOT auto-verified — an admin must verify them before their
    // products can go live, even if individual products get approved.
    res.status(201).json({
      success: true,
      message: 'Vendor account created. Verification by Bulk It is pending before you can list products.',
      token: generateRoleToken(vendor._id, 'vendor'),
      vendor,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const vendor = await Vendor.findOne({ phone }).select('+passwordHash');

    if (!vendor || !(await vendor.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });
    }

    res.json({ success: true, token: generateRoleToken(vendor._id, 'vendor'), vendor });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ success: true, vendor: req.vendor });
}

/** Vendor dashboard tool: quick counts across their own catalog. */
async function dashboard(req, res, next) {
  try {
    const vendorId = req.vendor._id;
    const [total, pending, approved, rejected, lowStock] = await Promise.all([
      Product.countDocuments({ vendor: vendorId }),
      Product.countDocuments({ vendor: vendorId, approvalStatus: 'pending' }),
      Product.countDocuments({ vendor: vendorId, approvalStatus: 'approved' }),
      Product.countDocuments({ vendor: vendorId, approvalStatus: 'rejected' }),
      Product.countDocuments({ vendor: vendorId, approvalStatus: 'approved', stockAvailable: { $lt: 20 } }),
    ]);

    res.json({
      success: true,
      vendor: {
        vendorName: req.vendor.vendorName,
        isVerified: req.vendor.isVerified,
        rating: req.vendor.rating,
      },
      products: { total, pending, approved, rejected, lowStock },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, dashboard };

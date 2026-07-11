const Vendor = require('../models/Vendor');
const Product = require('../models/Product');

async function listVendors(req, res, next) {
  try {
    const { verified } = req.query;
    const query = {};
    if (verified !== undefined) query.isVerified = verified === 'true';

    const vendors = await Vendor.find(query).sort({ createdAt: -1 });
    res.json({ success: true, vendors });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/vendors/:id/verify — unlocks the vendor's ability to have products go live */
async function verifyVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    const io = req.app.get('io');
    io.to(`vendor_${vendor._id}`).emit('vendor:verified', { vendorId: vendor._id });

    res.json({ success: true, vendor });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/vendors/:id/suspend — deactivates vendor + pulls their products off the catalog */
async function suspendVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    await Product.updateMany({ vendor: vendor._id }, { isActive: false });

    res.json({ success: true, message: 'Vendor suspended and their listings deactivated.', vendor });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVendors, verifyVendor, suspendVendor };

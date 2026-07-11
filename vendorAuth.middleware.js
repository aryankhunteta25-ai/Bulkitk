const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

async function protectVendor(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }

    const vendor = await Vendor.findById(decoded.id);
    if (!vendor || !vendor.isActive) {
      return res.status(401).json({ success: false, message: 'Vendor account not found or inactive.' });
    }

    req.vendor = vendor;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = { protectVendor };

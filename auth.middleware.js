const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const shop = await Shop.findById(decoded.id);

    if (!shop || !shop.isActive) {
      return res.status(401).json({ success: false, message: 'Account not found or inactive.' });
    }

    req.shop = shop;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = { protect };

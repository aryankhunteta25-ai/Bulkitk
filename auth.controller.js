const Shop = require('../models/Shop');
const generateToken = require('../utils/generateToken');

async function register(req, res, next) {
  try {
    const { shopName, ownerName, phone, email, password, gstin } = req.body;

    const existing = await Shop.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    const passwordHash = await Shop.hashPassword(password);
    const shop = await Shop.create({ shopName, ownerName, phone, email, passwordHash, gstin });

    return res.status(201).json({
      success: true,
      token: generateToken(shop._id),
      shop,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const shop = await Shop.findOne({ phone }).select('+passwordHash');

    if (!shop || !(await shop.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });
    }

    return res.json({
      success: true,
      token: generateToken(shop._id),
      shop,
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ success: true, shop: req.shop });
}

module.exports = { register, login, me };

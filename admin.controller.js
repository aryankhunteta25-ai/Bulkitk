const Admin = require('../models/Admin');
const { generateRoleToken } = require('../utils/generateToken');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+passwordHash');

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    res.json({ success: true, token: generateRoleToken(admin._id, 'admin'), admin });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ success: true, admin: req.admin });
}

module.exports = { login, me };

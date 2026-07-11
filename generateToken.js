const jwt = require('jsonwebtoken');

/** Shop-owner tokens (unchanged shape, kept for backward compatibility). */
function generateToken(shopId) {
  return jwt.sign({ id: shopId, role: 'shop' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

/** Vendor / Admin tokens carry an explicit role claim so middleware can tell them apart. */
function generateRoleToken(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

module.exports = generateToken;
module.exports.generateToken = generateToken;
module.exports.generateRoleToken = generateRoleToken;

const router = require('express').Router();
const { body } = require('express-validator');
const { protectVendor } = require('../middleware/vendorAuth.middleware');
const validate = require('../middleware/validate.middleware');
const { register, login, me, dashboard } = require('../controllers/vendor.controller');

router.post(
  '/register',
  [
    body('vendorName').notEmpty(),
    body('contactName').notEmpty(),
    body('phone').isLength({ min: 10, max: 13 }),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  register
);

router.post('/login', [body('phone').notEmpty(), body('password').notEmpty()], validate, login);

router.get('/me', protectVendor, me);
router.get('/dashboard', protectVendor, dashboard);

module.exports = router;

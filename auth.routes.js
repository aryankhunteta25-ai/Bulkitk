const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');

router.post(
  '/register',
  [
    body('shopName').notEmpty(),
    body('ownerName').notEmpty(),
    body('phone').isLength({ min: 10, max: 13 }),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  register
);

router.post(
  '/login',
  [body('phone').notEmpty(), body('password').notEmpty()],
  validate,
  login
);

router.get('/me', protect, me);

module.exports = router;

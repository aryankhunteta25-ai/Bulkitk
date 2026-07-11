const router = require('express').Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  placeOrder,
  listOrders,
  getOrder,
  getNavigationLink,
} = require('../controllers/order.controller');

router.use(protect);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }),
    body('addressId').notEmpty(),
    body('paymentMethod').isIn(['credit_line', 'upi', 'card']),
  ],
  validate,
  placeOrder
);

router.get('/', listOrders);
router.get('/:id', getOrder);
router.get('/:id/navigation', getNavigationLink);

module.exports = router;

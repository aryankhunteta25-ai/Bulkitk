const router = require('express').Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  createAddress,
  listAddresses,
  updateAddress,
  deleteAddress,
} = require('../controllers/address.controller');

router.use(protect);

router.get('/', listAddresses);

router.post(
  '/',
  [
    body('addressLine').notEmpty(),
    body('city').notEmpty(),
    body('state').notEmpty(),
    body('pincode').notEmpty(),
  ],
  validate,
  createAddress
);

router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

module.exports = router;

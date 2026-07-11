const router = require('express').Router();
const { protectAdmin } = require('../middleware/adminAuth.middleware');
const { listVendors, verifyVendor, suspendVendor } = require('../controllers/adminVendor.controller');

router.use(protectAdmin);

router.get('/', listVendors); // ?verified=true|false
router.post('/:id/verify', verifyVendor);
router.patch('/:id/suspend', suspendVendor);

module.exports = router;

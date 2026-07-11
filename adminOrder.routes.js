const router = require('express').Router();
const { protectAdmin } = require('../middleware/adminAuth.middleware');
const { updateStatus } = require('../controllers/order.controller');

router.use(protectAdmin);

// Moves a docket through confirmed -> packed -> out_for_delivery -> delivered.
// Properly admin-gated now that a real Admin model/auth layer exists.
router.patch('/:id/status', updateStatus);

module.exports = router;

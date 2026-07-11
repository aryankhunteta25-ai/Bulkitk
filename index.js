const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/addresses', require('./address.routes'));
router.use('/catalog', require('./catalog.routes'));
router.use('/orders', require('./order.routes'));
router.use('/item-requests', require('./itemRequest.routes'));
router.use('/loyalty', require('./loyalty.routes'));
router.use('/calls', require('./call.routes'));
router.use('/tracking', require('./tracking.routes'));

// ===== Marketplace: vendor accounts + product-add tools (platform side & vendor side) =====
router.use('/vendors', require('./vendor.routes'));
router.use('/vendor-products', require('./vendorProduct.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/admin/products', require('./adminProduct.routes'));
router.use('/admin/vendors', require('./adminVendor.routes'));
router.use('/admin/orders', require('./adminOrder.routes'));
router.use('/admin/item-requests', require('./adminItemRequest.routes'));

router.get('/health', (req, res) => res.json({ success: true, message: 'Bulk It API is running.' }));

module.exports = router;

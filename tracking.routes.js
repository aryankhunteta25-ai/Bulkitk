const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { getSnapshot } = require('../controllers/tracking.controller');

router.get('/orders/:id', protect, getSnapshot);

module.exports = router;

const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { getSummary, getLedger, redeemCoins } = require('../controllers/loyalty.controller');

router.use(protect);

router.get('/summary', getSummary);
router.get('/ledger', getLedger);
router.post('/redeem', redeemCoins);

module.exports = router;

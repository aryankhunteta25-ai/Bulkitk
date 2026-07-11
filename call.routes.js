const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const { callRider, twimlBridge } = require('../controllers/call.controller');

router.post('/orders/:id/call-rider', protect, callRider);

// Public webhook — Twilio itself calls this, so no auth middleware here.
router.get('/twiml/bridge', twimlBridge);
router.post('/twiml/bridge', twimlBridge);

module.exports = router;

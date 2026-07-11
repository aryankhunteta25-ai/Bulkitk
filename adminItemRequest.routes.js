const router = require('express').Router();
const { protectAdmin } = require('../middleware/adminAuth.middleware');
const { respondToRequest } = require('../controllers/itemRequest.controller');

router.use(protectAdmin);

// Quote/fulfil/decline a shop's "request any item" submission.
router.patch('/:id/respond', respondToRequest);

module.exports = router;

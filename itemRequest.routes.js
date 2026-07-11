const router = require('express').Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createRequest, listRequests } = require('../controllers/itemRequest.controller');

router.use(protect);

router.post('/', [body('itemName').notEmpty()], validate, createRequest);
router.get('/', listRequests);

module.exports = router;

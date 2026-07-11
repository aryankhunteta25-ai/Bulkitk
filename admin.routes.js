const router = require('express').Router();
const { body } = require('express-validator');
const { protectAdmin } = require('../middleware/adminAuth.middleware');
const validate = require('../middleware/validate.middleware');
const { login, me } = require('../controllers/admin.controller');

// No public /register — admin accounts are created via `npm run seed:admin` (see scripts/seedAdmin.js)
// or by a superadmin through an internal tool, never through an open API route.
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], validate, login);
router.get('/me', protectAdmin, me);

module.exports = router;

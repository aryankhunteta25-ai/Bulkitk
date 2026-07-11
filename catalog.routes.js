const router = require('express').Router();
const { listProducts, getProduct } = require('../controllers/catalog.controller');

// Catalog is browsable without auth (like a public price list); ordering requires auth.
router.get('/', listProducts);
router.get('/:id', getProduct);

module.exports = router;

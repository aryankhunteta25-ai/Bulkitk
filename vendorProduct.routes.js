const router = require('express').Router();
const { body } = require('express-validator');
const { protectVendor } = require('../middleware/vendorAuth.middleware');
const validate = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const {
  createProduct,
  listMine,
  updateProduct,
  adjustStock,
  deleteProduct,
  bulkUpload,
  csvTemplate,
} = require('../controllers/vendorProduct.controller');

router.use(protectVendor);

router.get('/csv-template', csvTemplate); // tool: download the exact upload format
router.post('/bulk-upload', upload.single('file'), bulkUpload); // tool: bulk add via CSV

router.get('/', listMine);
router.post(
  '/',
  [
    body('name').notEmpty(),
    body('category').notEmpty(),
    body('packUnit').notEmpty(),
    body('packSize').notEmpty(),
    body('pricePerPack').isFloat({ gt: 0 }),
  ],
  validate,
  createProduct
);
router.patch('/:id', updateProduct);
router.patch('/:id/stock', adjustStock); // tool: quick stock adjustment
router.delete('/:id', deleteProduct);

module.exports = router;

const router = require('express').Router();
const { body } = require('express-validator');
const { protectAdmin } = require('../middleware/adminAuth.middleware');
const validate = require('../middleware/validate.middleware');
const upload = require('../middleware/upload.middleware');
const {
  createProduct,
  listProducts,
  listPending,
  approveProduct,
  rejectProduct,
  toggleActive,
  adjustStock,
  bulkUpload,
  csvTemplate,
} = require('../controllers/adminProduct.controller');

router.use(protectAdmin);

router.get('/csv-template', csvTemplate); // tool: shared template format
router.post('/bulk-upload', upload.single('file'), bulkUpload); // tool: bulk add, auto-approved

router.get('/', listProducts); // full catalog view, filter by ?status=&sourceType=&vendorId=
router.get('/pending', listPending); // tool: vendor-submission approval queue

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

router.post('/:id/approve', approveProduct);
router.post('/:id/reject', rejectProduct);
router.patch('/:id/toggle-active', toggleActive);
router.patch('/:id/stock', adjustStock); // tool: quick stock adjustment

module.exports = router;

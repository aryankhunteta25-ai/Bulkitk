const Product = require('../models/Product');
const { parseProductCsv, buildCsvTemplate } = require('../services/csvImport.service');

/** POST /api/admin/products — Bulk It's own catalog team adds a product directly (auto-approved) */
async function createProduct(req, res, next) {
  try {
    const { name, brand, category, packUnit, packSize, pricePerPack, stockAvailable, slabs, images } = req.body;

    const product = await Product.create({
      name,
      brand,
      category,
      packUnit,
      packSize,
      pricePerPack,
      stockAvailable: stockAvailable ?? 100,
      slabs: slabs || [],
      images: images || [],
      sourceType: 'platform',
      createdByAdmin: req.admin._id,
      approvalStatus: 'approved', // platform's own listings skip the queue
      approvedBy: req.admin._id,
      approvedAt: new Date(),
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/products?status=&sourceType=&vendorId= — full catalog view, incl. pending */
async function listProducts(req, res, next) {
  try {
    const { status, sourceType, vendorId, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status) query.approvalStatus = status;
    if (sourceType) query.sourceType = sourceType;
    if (vendorId) query.vendor = vendorId;

    const products = await Product.find(query)
      .populate('vendor', 'vendorName phone isVerified')
      .populate('createdByAdmin', 'name')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);
    res.json({ success: true, products, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/products/pending — the approval queue */
async function listPending(req, res, next) {
  try {
    const products = await Product.find({ approvalStatus: 'pending' })
      .populate('vendor', 'vendorName phone isVerified')
      .sort({ createdAt: 1 }); // oldest first — FIFO queue
    res.json({ success: true, products, count: products.length });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/products/:id/approve */
async function approveProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.approvalStatus = 'approved';
    product.approvedBy = req.admin._id;
    product.approvedAt = new Date();
    product.rejectionReason = undefined;
    await product.save();

    if (product.vendor) {
      const io = req.app.get('io');
      io.to(`vendor_${product.vendor}`).emit('product:approved', { productId: product._id, name: product.name });
    }

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/products/:id/reject  body: { reason } */
async function rejectProduct(req, res, next) {
  try {
    const { reason } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.approvalStatus = 'rejected';
    product.rejectionReason = reason || 'Did not meet Bulk It catalog guidelines.';
    await product.save();

    if (product.vendor) {
      const io = req.app.get('io');
      io.to(`vendor_${product.vendor}`).emit('product:rejected', {
        productId: product._id,
        name: product.name,
        reason: product.rejectionReason,
      });
    }

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/products/:id/toggle-active — pull a product off the catalog without deleting it */
async function toggleActive(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    product.isActive = !product.isActive;
    await product.save();
    res.json({ success: true, isActive: product.isActive });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/products/:id/stock */
async function adjustStock(req, res, next) {
  try {
    const { delta, setTo } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    if (setTo !== undefined) product.stockAvailable = Math.max(Number(setTo), 0);
    else product.adjustStock(Number(delta));

    await product.save();
    res.json({ success: true, stockAvailable: product.stockAvailable });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/products/bulk-upload — platform's own CSV tool, auto-approved */
async function bulkUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach a CSV file under the "file" field.' });
    }

    const { valid, errors } = parseProductCsv(req.file.buffer);

    const created = await Product.insertMany(
      valid.map((row) => ({
        ...row,
        sourceType: 'platform',
        createdByAdmin: req.admin._id,
        approvalStatus: 'approved',
        approvedBy: req.admin._id,
        approvedAt: new Date(),
      }))
    );

    res.status(errors.length ? 207 : 201).json({
      success: true,
      insertedCount: created.length,
      errorCount: errors.length,
      errors,
      message: `${created.length} product(s) added directly to the catalog.${errors.length ? ` ${errors.length} row(s) had errors and were skipped.` : ''}`,
    });
  } catch (err) {
    next(err);
  }
}

function csvTemplate(req, res) {
  const csv = buildCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulkit-product-template.csv"');
  res.send(csv);
}

module.exports = {
  createProduct,
  listProducts,
  listPending,
  approveProduct,
  rejectProduct,
  toggleActive,
  adjustStock,
  bulkUpload,
  csvTemplate,
};

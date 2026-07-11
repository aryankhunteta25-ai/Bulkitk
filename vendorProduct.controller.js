const Product = require('../models/Product');
const { parseProductCsv, buildCsvTemplate } = require('../services/csvImport.service');

/** POST /api/vendor-products — submit a single product for approval */
async function createProduct(req, res, next) {
  try {
    if (!req.vendor.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your vendor account is pending Bulk It verification. You can prepare listings, but they will stay pending until you are verified.',
      });
    }

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
      sourceType: 'vendor',
      vendor: req.vendor._id,
      approvalStatus: 'pending',
    });

    await req.vendor.updateOne({ $inc: { totalProductsListed: 1 } });

    const io = req.app.get('io');
    io.to('admin_team').emit('product:submitted', {
      productId: product._id,
      name: product.name,
      vendorName: req.vendor.vendorName,
    });

    res.status(201).json({
      success: true,
      message: 'Product submitted. It will appear in the catalog once approved by Bulk It.',
      product,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/vendor-products — this vendor's own listings, any approval status */
async function listMine(req, res, next) {
  try {
    const { status } = req.query;
    const query = { vendor: req.vendor._id };
    if (status) query.approvalStatus = status;

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/vendor-products/:id — edit a listing (re-submits for approval if price/details change) */
async function updateProduct(req, res, next) {
  try {
    const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Listing not found.' });

    const editableFields = ['name', 'brand', 'category', 'packUnit', 'packSize', 'pricePerPack', 'slabs', 'images'];
    let materialChange = false;
    editableFields.forEach((f) => {
      if (req.body[f] !== undefined) {
        materialChange = true;
        product[f] = req.body[f];
      }
    });

    // Any material edit to an already-approved listing goes back to pending —
    // vendors can't silently change price/details on a live product.
    if (materialChange && product.approvalStatus === 'approved') {
      product.approvalStatus = 'pending';
    }

    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/vendor-products/:id/stock — quick stock-level tool */
async function adjustStock(req, res, next) {
  try {
    const { delta, setTo } = req.body;
    const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Listing not found.' });

    if (setTo !== undefined) {
      product.stockAvailable = Math.max(Number(setTo), 0);
    } else {
      product.adjustStock(Number(delta));
    }
    await product.save();

    res.json({ success: true, stockAvailable: product.stockAvailable });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, vendor: req.vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Listing not found.' });
    res.json({ success: true, message: 'Listing removed.' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/vendor-products/bulk-upload — CSV tool, multipart file field "file" */
async function bulkUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach a CSV file under the "file" field.' });
    }
    if (!req.vendor.isVerified) {
      return res.status(403).json({ success: false, message: 'Your vendor account must be verified before bulk uploading.' });
    }

    const { valid, errors } = parseProductCsv(req.file.buffer);

    const created = await Product.insertMany(
      valid.map((row) => ({
        ...row,
        sourceType: 'vendor',
        vendor: req.vendor._id,
        approvalStatus: 'pending',
      }))
    );

    if (created.length) {
      await req.vendor.updateOne({ $inc: { totalProductsListed: created.length } });
      const io = req.app.get('io');
      io.to('admin_team').emit('product:bulkSubmitted', {
        vendorName: req.vendor.vendorName,
        count: created.length,
      });
    }

    res.status(errors.length ? 207 : 201).json({
      success: true,
      insertedCount: created.length,
      errorCount: errors.length,
      errors,
      message: `${created.length} product(s) submitted for approval.${errors.length ? ` ${errors.length} row(s) had errors and were skipped.` : ''}`,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/vendor-products/csv-template — download the exact column format expected */
function csvTemplate(req, res) {
  const csv = buildCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulkit-product-template.csv"');
  res.send(csv);
}

module.exports = { createProduct, listMine, updateProduct, adjustStock, deleteProduct, bulkUpload, csvTemplate };

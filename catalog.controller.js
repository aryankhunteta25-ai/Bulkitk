const Product = require('../models/Product');

async function listProducts(req, res, next) {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    // Shop owners only ever see approved + active listings, whether the
    // product came from the platform catalog team or a verified vendor.
    const query = { ...Product.PUBLIC_CATALOG_FILTER };

    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const products = await Product.find(query)
      .populate('vendor', 'vendorName rating')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.json({ success: true, products, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...Product.PUBLIC_CATALOG_FILTER }).populate(
      'vendor',
      'vendorName rating'
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct };

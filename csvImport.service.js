const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const REQUIRED_COLUMNS = ['name', 'category', 'packUnit', 'packSize', 'pricePerPack'];

function isTruthy(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
const VALID_CATEGORIES = [
  'grocery_staples',
  'personal_care',
  'household',
  'beverages',
  'snacks_biscuits',
  'dairy_frozen',
];

/**
 * Parses a product bulk-upload CSV buffer into validated row objects.
 * Expected columns: name, brand, category, packUnit, packSize, pricePerPack,
 * stockAvailable, slab1MinQty, slab1DiscountPercent, slab2MinQty, slab2DiscountPercent
 *
 * Returns { valid: [...], errors: [{ row, message }] } — callers decide whether
 * to insert only the valid rows or reject the whole file on any error.
 */
function parseProductCsv(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const valid = [];
  const errors = [];

  records.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexing
    const missing = REQUIRED_COLUMNS.filter((c) => !row[c]);
    if (missing.length) {
      errors.push({ row: rowNum, message: `Missing required column(s): ${missing.join(', ')}` });
      return;
    }
    if (!VALID_CATEGORIES.includes(row.category)) {
      errors.push({ row: rowNum, message: `Invalid category "${row.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }
    const pricePerPack = Number(row.pricePerPack);
    if (Number.isNaN(pricePerPack) || pricePerPack <= 0) {
      errors.push({ row: rowNum, message: `Invalid pricePerPack "${row.pricePerPack}"` });
      return;
    }

    const slabs = [];
    if (row.slab1MinQty && row.slab1DiscountPercent) {
      slabs.push({ minQty: Number(row.slab1MinQty), discountPercent: Number(row.slab1DiscountPercent) });
    }
    if (row.slab2MinQty && row.slab2DiscountPercent) {
      slabs.push({
        minQty: Number(row.slab2MinQty),
        discountPercent: Number(row.slab2DiscountPercent),
        freeDelivery: isTruthy(row.slab2FreeDelivery),
      });
    }

    valid.push({
      name: row.name,
      brand: row.brand || '',
      category: row.category,
      packUnit: row.packUnit,
      packSize: row.packSize,
      pricePerPack,
      stockAvailable: row.stockAvailable ? Number(row.stockAvailable) : 100,
      slabs,
      images: row.imageUrl ? [row.imageUrl] : [],
    });
  });

  return { valid, errors };
}

/** Downloadable CSV template so admins/vendors know the exact expected format. */
function buildCsvTemplate() {
  const columns = [
    'name',
    'brand',
    'category',
    'packUnit',
    'packSize',
    'pricePerPack',
    'stockAvailable',
    'slab1MinQty',
    'slab1DiscountPercent',
    'slab2MinQty',
    'slab2DiscountPercent',
    'slab2FreeDelivery',
    'imageUrl',
  ];
  const sampleRow = {
    name: 'Tata Salt 1kg',
    brand: 'Tata',
    category: 'grocery_staples',
    packUnit: 'carton',
    packSize: '24 packs of 1kg',
    pricePerPack: 575,
    stockAvailable: 200,
    slab1MinQty: 5,
    slab1DiscountPercent: 3,
    slab2MinQty: 10,
    slab2DiscountPercent: 6,
    slab2FreeDelivery: true,
    imageUrl: 'https://example.com/images/tata-salt.jpg',
  };
  return stringify([sampleRow], { header: true, columns });
}

module.exports = { parseProductCsv, buildCsvTemplate, VALID_CATEGORIES };

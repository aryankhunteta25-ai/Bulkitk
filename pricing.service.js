const DELIVERY_FEE_DEFAULT = 99;

/**
 * items: [{ product (doc), qty }]
 * Returns line items with slab-applied pricing plus order-level totals.
 */
function priceCart(items) {
  let subtotal = 0;
  let discountTotal = 0;
  let anyFreeDelivery = false;

  const lineItems = items.map(({ product, qty }) => {
    const { unitPrice, lineTotal, appliedSlab } = product.priceFor(qty);
    const listLineTotal = product.pricePerPack * qty;

    subtotal += listLineTotal;
    discountTotal += listLineTotal - lineTotal;
    if (appliedSlab?.freeDelivery) anyFreeDelivery = true;

    return {
      product: product._id,
      name: product.name,
      packUnit: product.packUnit,
      qty,
      unitPrice,
      lineTotal,
      appliedSlabDiscountPercent: appliedSlab?.discountPercent || 0,
    };
  });

  const deliveryFee = anyFreeDelivery ? 0 : DELIVERY_FEE_DEFAULT;
  const total = +(subtotal - discountTotal + deliveryFee).toFixed(2);

  return {
    lineItems,
    subtotal: +subtotal.toFixed(2),
    discountTotal: +discountTotal.toFixed(2),
    deliveryFee,
    total,
  };
}

module.exports = { priceCart, DELIVERY_FEE_DEFAULT };

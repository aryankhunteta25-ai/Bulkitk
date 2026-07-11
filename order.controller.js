const Order = require('../models/Order');
const Product = require('../models/Product');
const Address = require('../models/Address');
const DeliveryPartner = require('../models/DeliveryPartner');
const { priceCart } = require('../services/pricing.service');
const loyaltyService = require('../services/loyalty.service');
const googleMaps = require('../services/googleMaps.service');

/**
 * POST /api/orders
 * body: { items: [{ productId, qty }], addressId, paymentMethod, deliverySlot, scheduledFor }
 */
async function placeOrder(req, res, next) {
  try {
    const { items, addressId, paymentMethod, deliverySlot, scheduledFor } = req.body;
    const shop = req.shop;

    if (!items?.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const address = await Address.findOne({ _id: addressId, shop: shop._id });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Delivery address not found.' });
    }

    // Load products and validate stock
    const productDocs = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
    const cartItems = items.map((i) => {
      const product = productDocs.find((p) => p._id.toString() === i.productId);
      if (!product) throw Object.assign(new Error(`Product ${i.productId} not found.`), { statusCode: 404 });
      if (product.stockAvailable < i.qty) {
        throw Object.assign(new Error(`${product.name} has only ${product.stockAvailable} in stock.`), { statusCode: 409 });
      }
      return { product, qty: i.qty };
    });

    const { lineItems, subtotal, discountTotal, deliveryFee, total } = priceCart(cartItems);

    // Credit-line check — this is the real enforcement behind the "Udhaar" feature
    if (paymentMethod === 'credit_line') {
      const available = shop.creditLimit - shop.creditUsed;
      if (total > available) {
        return res.status(402).json({
          success: false,
          message: `Order total ₹${total} exceeds available credit of ₹${available}.`,
        });
      }
    }

    const order = await Order.create({
      shop: shop._id,
      deliveryAddress: address._id,
      items: lineItems,
      subtotal,
      discountTotal,
      deliveryFee,
      total,
      paymentMethod,
      deliverySlot: deliverySlot || 'express_24h',
      scheduledFor,
    });

    // Deduct stock
    await Promise.all(
      cartItems.map(({ product, qty }) =>
        Product.findByIdAndUpdate(product._id, { $inc: { stockAvailable: -qty } })
      )
    );

    // Reserve credit if paying on Udhaar
    if (paymentMethod === 'credit_line') {
      shop.creditUsed += total;
      if (!shop.creditRepaymentDueDate) {
        shop.creditRepaymentDueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      }
    }

    // Loyalty coins accrue on confirmation (kept simple; could be moved to `delivered`)
    const { coinsEarned } = await loyaltyService.earnForOrder(shop, order);
    order.coinsEarned = coinsEarned;

    // Compute the warehouse → shop route for navigation + initial ETA, if geocoded
    if (address.lat && address.lng) {
      try {
        const originLat = Number(process.env.WAREHOUSE_LAT);
        const originLng = Number(process.env.WAREHOUSE_LNG);
        const route = await googleMaps.getRoute({
          originLat,
          originLng,
          destLat: address.lat,
          destLng: address.lng,
        });
        order.route = {
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          polyline: route.polyline,
          originLat,
          originLng,
          destinationLat: address.lat,
          destinationLng: address.lng,
        };
        order.liveEta = {
          minutesRemaining: Math.round(route.durationSeconds / 60),
          lastComputedAt: new Date(),
        };
      } catch (mapsErr) {
        console.warn('[GoogleMaps] route computation failed:', mapsErr.message);
      }
    }

    await order.save();
    await shop.save();

    // Real-time: tell anyone already subscribed to this shop's order feed
    const io = req.app.get('io');
    io.to(`shop_${shop._id}`).emit('order:created', { order });

    res.status(201).json({ success: true, order, shop });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await Order.find({ shop: req.shop._id })
      .populate('deliveryAddress')
      .populate('deliveryPartner')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id })
      .populate('deliveryAddress')
      .populate('deliveryPartner');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    res.json({
      success: true,
      order,
      navigationUrl: order.navigationUrl(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orders/:id/status
 * Used by warehouse/ops dashboard (or an admin token) to move the docket through
 * confirmed -> packed -> out_for_delivery -> delivered. Broadcasts in real time.
 */
async function updateStatus(req, res, next) {
  try {
    const { status, deliveryPartnerId, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.status = status;
    order.timeline.push({ status, note });

    if (status === 'out_for_delivery' && deliveryPartnerId) {
      order.deliveryPartner = deliveryPartnerId;
    }

    await order.save();

    const io = req.app.get('io');
    io.to(`order_${order._id}`).emit('order:statusUpdate', {
      orderId: order._id,
      status: order.status,
      timeline: order.timeline,
    });
    io.to(`shop_${order.shop}`).emit('order:statusUpdate', {
      orderId: order._id,
      status: order.status,
    });

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

/** GET /api/orders/:id/navigation — Google Maps deep link for the assigned rider */
async function getNavigationLink(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const url = order.navigationUrl();
    if (!url) {
      return res.status(409).json({ success: false, message: 'Route not yet computed for this order.' });
    }
    res.json({ success: true, navigationUrl: url });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeOrder, listOrders, getOrder, updateStatus, getNavigationLink };

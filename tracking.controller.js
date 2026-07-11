const Order = require('../models/Order');

/**
 * GET /api/tracking/orders/:id
 * One-shot snapshot (used when the tracking screen first loads, before the
 * socket connection takes over for live updates).
 */
async function getSnapshot(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id }).populate('deliveryPartner');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    res.json({
      success: true,
      status: order.status,
      timeline: order.timeline,
      liveEta: order.liveEta,
      route: order.route,
      partnerLocation: order.deliveryPartner?.currentLocation || null,
      navigationUrl: order.navigationUrl(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSnapshot };

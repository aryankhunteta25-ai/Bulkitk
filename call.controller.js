const Order = require('../models/Order');
const { initiateBridgedCall, bridgeTwiml } = require('../services/call.service');

/**
 * POST /api/calls/orders/:id/call-rider
 * Shop owner taps "Call rider" in the app. We never expose the rider's real
 * number to the shop, or the shop's number to the rider — Twilio bridges both
 * legs through Bulk It's own caller ID.
 */
async function callRider(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, shop: req.shop._id }).populate('deliveryPartner');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.deliveryPartner) {
      return res.status(409).json({ success: false, message: 'No delivery partner assigned yet.' });
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const call = await initiateBridgedCall({
      shopPhone: req.shop.phone,
      riderPhone: order.deliveryPartner.phone,
      publicBaseUrl,
    });

    res.json({ success: true, message: 'Connecting the call now — your phone will ring shortly.', call });
  } catch (err) {
    next(err);
  }
}

/** Twilio fetches this URL for the second call leg (rider). Not called by the app directly. */
function twimlBridge(req, res) {
  const to = req.query.to;
  res.type('text/xml');
  res.send(bridgeTwiml(to));
}

module.exports = { callRider, twimlBridge };

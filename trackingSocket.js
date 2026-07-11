const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');
const googleMaps = require('../services/googleMaps.service');

// Simple in-memory throttle so we don't hit the Distance Matrix API on every
// single GPS ping (riders can ping every few seconds). Keyed by orderId.
const lastEtaComputeAt = new Map();
const ETA_RECOMPUTE_INTERVAL_MS = 20 * 1000;

function registerTrackingSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    // Shop owner's app joins its own room to receive order/status pushes
    socket.on('shop:subscribe', ({ shopId }) => {
      socket.join(`shop_${shopId}`);
    });

    // Tracking screen joins the specific order's room for live location + ETA
    socket.on('order:subscribe', ({ orderId }) => {
      socket.join(`order_${orderId}`);
    });

    // Ops/warehouse dashboard joins to see new item requests, order queue, etc.
    socket.on('ops:subscribe', () => {
      socket.join('ops_team');
    });

    // Bulk It's internal catalog/admin dashboard — new vendor product submissions land here.
    socket.on('admin:subscribe', () => {
      socket.join('admin_team');
    });

    // Vendor's own dashboard — gets live approve/reject/verification notifications.
    socket.on('vendor:subscribe', ({ vendorId }) => {
      socket.join(`vendor_${vendorId}`);
    });

    /**
     * Delivery partner's app emits this every few seconds while an order is
     * out_for_delivery. We update MongoDB, recompute ETA (throttled), and
     * broadcast to everyone watching this order — this IS the "real-time
     * everything" pipe for the tracking screen.
     */
    socket.on('partner:locationUpdate', async ({ partnerId, orderId, lat, lng }) => {
      try {
        await DeliveryPartner.findByIdAndUpdate(partnerId, {
          currentLocation: { type: 'Point', coordinates: [lng, lat] },
          lastLocationUpdate: new Date(),
        });

        const payload = { orderId, partnerId, lat, lng, at: new Date() };

        const shouldRecomputeEta =
          !lastEtaComputeAt.has(orderId) ||
          Date.now() - lastEtaComputeAt.get(orderId) > ETA_RECOMPUTE_INTERVAL_MS;

        if (shouldRecomputeEta && orderId) {
          lastEtaComputeAt.set(orderId, Date.now());
          const order = await Order.findById(orderId);
          if (order?.route?.destinationLat) {
            try {
              const eta = await googleMaps.getLiveEta({
                originLat: lat,
                originLng: lng,
                destLat: order.route.destinationLat,
                destLng: order.route.destinationLng,
              });
              order.liveEta = { minutesRemaining: eta.minutesRemaining, lastComputedAt: new Date() };
              await order.save();
              payload.liveEta = order.liveEta;
            } catch (etaErr) {
              console.warn('[Socket] ETA recompute failed:', etaErr.message);
            }
          }
        }

        io.to(`order_${orderId}`).emit('order:locationUpdate', payload);
      } catch (err) {
        console.error('[Socket] partner:locationUpdate error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] disconnected: ${socket.id}`);
    });
  });
}

module.exports = registerTrackingSocket;

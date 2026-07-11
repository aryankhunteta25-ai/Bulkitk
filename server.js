require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const createApp = require('./app');
const connectDB = require('./config/db');
const registerTrackingSocket = require('./sockets/trackingSocket');

async function start() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });

  registerTrackingSocket(io);

  // Controllers reach the socket instance via req.app.get('io') to broadcast
  // order/status/tracking events after a DB write.
  app.set('io', io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`[Bulk It API] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

start().catch((err) => {
  console.error('[Fatal] failed to start server:', err);
  process.exit(1);
});

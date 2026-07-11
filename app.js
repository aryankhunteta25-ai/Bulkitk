const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // needed for Twilio's form-encoded webhook

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { config } = require('./src/config/index.js');
const { logger } = require('./src/utils/logger.js');
const { sendError } = require('./src/utils/response.js');
const { authMiddleware } = require('./src/middleware/auth.js');
const { handleHealthRoute } = require('./src/routes/health.routes.js');
const { handleCurrentMetrics, handleHistoricalMetrics } = require('./src/routes/metrics.routes.js');
const { metricsService } = require('./src/services/metrics.service.js');

function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/health') {
      return handleHealthRoute(req, res);
    }

    authMiddleware(req, res, () => {
      if (pathname === '/api2/json/status/current') {
        return handleCurrentMetrics(req, res);
      } else if (pathname === '/api2/json/rrddata') {
        return handleHistoricalMetrics(req, res);
      } else {
        return sendError(res, 404, 'Not Found');
      }
    });

  } catch (err) {
    logger.error('Request error:', err);
    sendError(res, 500, 'Internal Server Error');
  }
}

async function startServer() {
  await metricsService.start();
  metricsService.collect();

  let server;

  if (config.tlsEnabled) {
    try {
      const options = {
        key: fs.readFileSync(path.resolve(config.tlsKeyPath)),
        cert: fs.readFileSync(path.resolve(config.tlsCertPath))
      };
      server = https.createServer(options, handleRequest);
    } catch (err) {
      logger.error(`Failed to load TLS certificates: ${err.message}`);
      process.exit(1);
    }
  } else {
    server = http.createServer(handleRequest);
  }

  server.listen(config.port, config.host, () => {
    logger.info(`windows-monitor-agent listening on ${config.tlsEnabled ? 'https' : 'http'}://${config.host}:${config.port}`);
  });

  const shutdown = () => {
    logger.info('Shutting down...');
    metricsService.stop();
    server.close(() => {
      logger.info('Server stopped.');
      process.exit(0);
    });
    
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { config } from "./src/config/index.js";
import { logger } from "./src/utils/logger.js";
import { sendError } from "./src/utils/response.js";
import { authMiddleware } from "./src/middleware/auth.js";
import { handleHealthRoute } from "./src/routes/health.routes.js";
import { handleCurrentMetrics, handleHistoricalMetrics } from "./src/routes/metrics.routes.js";
import { metricsService } from "./src/services/metrics.service.js";

function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Unauthenticated routes
    if (pathname === "/health") {
      return handleHealthRoute(req, res);
    }

    // Authenticated routes
    authMiddleware(req, res, () => {
      if (pathname === "/api2/json/status/current") {
        return handleCurrentMetrics(req, res);
      } else if (pathname === "/api2/json/rrddata") {
        return handleHistoricalMetrics(req, res);
      } else {
        return sendError(res, 404, "Not Found");
      }
    });

  } catch (err) {
    logger.error("Request error:", err);
    sendError(res, 500, "Internal Server Error");
  }
}

async function startServer() {
  await metricsService.start();
  // Kick off an initial collection immediately
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
    logger.info("Shutting down...");
    metricsService.stop();
    server.close(() => {
      logger.info("Server stopped.");
      process.exit(0);
    });
    
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch(err => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

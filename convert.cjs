const fs = require('fs');

// 1. package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.type;
pkg.engines = { node: '>=13.0.0' };
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

// 2. src/config/index.js
fs.writeFileSync('src/config/index.js', `const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');

function loadEnv() {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\\r?\\n/).forEach(line => {
      const match = line.match(/^\\s*([\\w.-]+)\\s*=\\s*(.*)?\\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const config = {
  port: parseInt(process.env.PORT || '9001', 10),
  host: process.env.HOST || '0.0.0.0',
  monitorToken: process.env.MONITOR_TOKEN || 'monitoring-token-332100185',
  metricsIntervalMs: parseInt(process.env.METRICS_INTERVAL_MS || '60000', 10),
  metricsStaleAfterMs: parseInt(process.env.METRICS_STALE_AFTER_MS || '120000', 10),
  historyRetentionHours: parseInt(process.env.HISTORY_RETENTION_HOURS || '24', 10),
  tlsEnabled: process.env.TLS_ENABLED === 'true',
  tlsCertPath: process.env.TLS_CERT_PATH || 'certs/server.crt',
  tlsKeyPath: process.env.TLS_KEY_PATH || 'certs/server.key',
  logLevel: process.env.LOG_LEVEL || 'info',
  dataPath: path.resolve(__dirname, '../../data')
};

if (!config.monitorToken || config.monitorToken === 'REPLACE_WITH_SECURE_RANDOM_TOKEN') {
  console.warn('WARNING: MONITOR_TOKEN is using a default or insecure value.');
}

module.exports = { config };
`);

// 3. src/utils/logger.js
fs.writeFileSync('src/utils/logger.js', `const { config } = require('../config/index.js');

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = levels[config.logLevel] !== undefined ? levels[config.logLevel] : 1;

const logger = {
  debug: (...args) => {
    if (currentLevel <= 0) console.log(new Date().toISOString(), '[DEBUG]', ...args);
  },
  info: (...args) => {
    if (currentLevel <= 1) console.log(new Date().toISOString(), '[INFO]', ...args);
  },
  warn: (...args) => {
    if (currentLevel <= 2) console.warn(new Date().toISOString(), '[WARN]', ...args);
  },
  error: (...args) => {
    if (currentLevel <= 3) console.error(new Date().toISOString(), '[ERROR]', ...args);
  }
};

module.exports = { logger };
`);

// 4. src/utils/response.js
fs.writeFileSync('src/utils/response.js', `function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

module.exports = { sendJson, sendError };
`);

// 5. src/middleware/auth.js
fs.writeFileSync('src/middleware/auth.js', `const { config } = require('../config/index.js');
const { sendError } = require('../utils/response.js');
const crypto = require('crypto');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['api-key'] || req.headers['x-api-key'];
  if (!authHeader) {
    return sendError(res, 401, 'Missing api-key header');
  }

  const token = authHeader;
  
  if (!config.monitorToken) {
    return sendError(res, 500, 'Server configuration error: Token not set');
  }

  const expectedToken = Buffer.from(config.monitorToken);
  const providedToken = Buffer.from(token);

  if (expectedToken.length !== providedToken.length || !crypto.timingSafeEqual(expectedToken, providedToken)) {
    return sendError(res, 401, 'Invalid token');
  }

  next();
}

module.exports = { authMiddleware };
`);

// 6. src/collectors/windows.collector.js
fs.writeFileSync('src/collectors/windows.collector.js', `const child_process = require('child_process');
const { promisify } = require('util');
const path = require('path');

const ps1Path = path.resolve(__dirname, '../../scripts/metrics.ps1');

async function collectMetrics() {
  if (process.env.MOCK_COLLECTOR === 'true') {
    return {
      name: 'MOCK-PC',
      cpu: 0.25,
      cpus: 4,
      mem: 2048,
      maxmem: 8192,
      disk: 500,
      maxdisk: 1000,
      uptime: 3600,
      diskinfo: [
        { drive: 'C:', total: 1000, used: 500, free: 500, usage: 50 }
      ]
    };
  }
  if (process.env.MOCK_COLLECTOR_ERROR === 'true') {
    throw new Error('Failed to collect Windows metrics: Command failed');
  }

  try {
    const execFileAsync = promisify(child_process.execFile);
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    );

    if (stderr) {
      console.warn('PowerShell stderr:', stderr);
    }

    return JSON.parse(stdout.trim());
  } catch (err) {
    throw new Error(\`Failed to collect Windows metrics: \${err.message}\`);
  }
}

module.exports = { collectMetrics };
`);

// 7. src/services/history.service.js
fs.writeFileSync('src/services/history.service.js', `const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { config } = require('../config/index.js');
const { logger } = require('../utils/logger.js');

const dataDir = config.dataPath;
const historyFile = path.join(dataDir, 'history.jsonl');

class HistoryService {
  constructor() {
    this.history = [];
    this.retentionMs = config.historyRetentionHours * 60 * 60 * 1000;
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async load() {
    if (!fs.existsSync(historyFile)) {
      return;
    }

    const cutoffTime = Date.now() - this.retentionMs;

    try {
      const fileStream = fs.createReadStream(historyFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.time * 1000 >= cutoffTime) {
            this.history.push(entry);
          }
        } catch (e) {
          logger.warn('Failed to parse history line, skipping:', e.message);
        }
      }
      
      this.history.sort((a, b) => a.time - b.time);
      logger.info(\`Loaded \${this.history.length} historical records.\`);
      
      await this.rewriteFile();
      
    } catch (err) {
      logger.error('Error loading history:', err);
    }
  }

  async append(metric) {
    const timestamp = Math.floor(Date.now() / 1000);
    
    if (this.history.length > 0 && this.history[this.history.length - 1].time === timestamp) {
      return;
    }

    const entry = {
      time: timestamp,
      cpu: metric.cpu,
      mem: metric.mem,
      maxmem: metric.maxmem,
      disk: metric.disk,
      maxdisk: metric.maxdisk
    };

    this.history.push(entry);

    try {
      await fs.promises.appendFile(historyFile, JSON.stringify(entry) + '\\n');
    } catch (err) {
      logger.error('Failed to append history to file:', err);
    }

    this.prune();
  }

  async prune() {
    const cutoffTime = Math.floor((Date.now() - this.retentionMs) / 1000);
    const initialLength = this.history.length;
    
    this.history = this.history.filter(entry => entry.time >= cutoffTime);
    
    if (this.history.length < initialLength) {
      await this.rewriteFile();
    }
  }

  async rewriteFile() {
    const tempFile = \`\${historyFile}.tmp\`;
    try {
      const content = this.history.map(entry => JSON.stringify(entry)).join('\\n') + (this.history.length > 0 ? '\\n' : '');
      await fs.promises.writeFile(tempFile, content);
      await fs.promises.rename(tempFile, historyFile);
    } catch (err) {
      logger.error('Failed to rewrite history file:', err);
    }
  }

  getHistory(timeframeStr) {
    let timeframeMs = 60 * 60 * 1000;
    if (timeframeStr === 'day') {
      timeframeMs = 24 * 60 * 60 * 1000;
    } else if (timeframeStr === 'week') {
      timeframeMs = 7 * 24 * 60 * 60 * 1000;
    }

    const cutoffTime = Math.floor((Date.now() - timeframeMs) / 1000);
    return this.history.filter(entry => entry.time >= cutoffTime);
  }
}

const historyService = new HistoryService();
module.exports = { historyService };
`);

// 8. src/services/metrics.service.js
fs.writeFileSync('src/services/metrics.service.js', `const { collectMetrics } = require('../collectors/windows.collector.js');
const { historyService } = require('./history.service.js');
const { config } = require('../config/index.js');
const { logger } = require('../utils/logger.js');

class MetricsService {
  constructor() {
    this.currentMetrics = null;
    this.lastCollectedAt = 0;
    this.isRunning = false;
    this.timer = null;
  }

  async start() {
    await historyService.load();
    this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNext() {
    this.timer = setTimeout(() => {
      this.collect();
    }, config.metricsIntervalMs);
  }

  async collect() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    try {
      const data = await collectMetrics();
      this.currentMetrics = data;
      this.lastCollectedAt = Date.now();
      
      await historyService.append(data);
      
    } catch (err) {
      logger.error('Metrics collection failed:', err.message);
    } finally {
      this.isRunning = false;
      this.scheduleNext();
    }
  }

  getCurrentMetrics() {
    if (!this.currentMetrics) {
      return { error: 'Metrics not available yet', status: 503 };
    }

    const age = Date.now() - this.lastCollectedAt;
    if (age > config.metricsStaleAfterMs) {
      return { error: 'Metrics are stale', status: 503 };
    }

    const data = {
      ...this.currentMetrics,
      status: 'running'
    };

    return { data };
  }
}

const metricsService = new MetricsService();
module.exports = { metricsService };
`);

// 9. src/routes/health.routes.js
fs.writeFileSync('src/routes/health.routes.js', `const { sendJson } = require('../utils/response.js');

function handleHealthRoute(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  sendJson(res, 200, {
    status: 'ok',
    service: 'windows-monitor-agent'
  });
}

module.exports = { handleHealthRoute };
`);

// 10. src/routes/metrics.routes.js
fs.writeFileSync('src/routes/metrics.routes.js', `const { metricsService } = require('../services/metrics.service.js');
const { historyService } = require('../services/history.service.js');
const { sendJson, sendError } = require('../utils/response.js');

function handleCurrentMetrics(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const result = metricsService.getCurrentMetrics();
  
  if (result.error) {
    return sendError(res, result.status, result.error);
  }

  sendJson(res, 200, { data: result.data });
}

function handleHistoricalMetrics(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  const timeframe = url.searchParams.get('timeframe') || 'hour';

  const history = historyService.getHistory(timeframe);

  sendJson(res, 200, { data: history });
}

module.exports = { handleCurrentMetrics, handleHistoricalMetrics };
`);

// 11. server.js
fs.writeFileSync('server.js', `const http = require('http');
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
    const url = new URL(req.url, \`http://\${req.headers.host}\`);
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
      logger.error(\`Failed to load TLS certificates: \${err.message}\`);
      process.exit(1);
    }
  } else {
    server = http.createServer(handleRequest);
  }

  server.listen(config.port, config.host, () => {
    logger.info(\`windows-monitor-agent listening on \${config.tlsEnabled ? 'https' : 'http'}://\${config.host}:\${config.port}\`);
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
`);

// Also update tests to use CommonJS
const fixTest = (file, content) => {
    let replaced = content.replace(/import test from "node:test";\\r?\\nimport assert from "node:assert";/g, 'const test = require("node:test");\\nconst assert = require("node:assert");');
    replaced = replaced.replace(/import fs from "node:fs";/g, 'const fs = require("fs");');
    replaced = replaced.replace(/import path from "node:path";/g, 'const path = require("path");');
    replaced = replaced.replace(/import child_process from "node:child_process";/g, 'const child_process = require("child_process");');
    
    // Replace all import { x, y } from "./path.js" with const { x, y } = require("./path.js")
    replaced = replaced.replace(/import\s+{([^}]+)}\s+from\s+"([^"]+)";/g, 'const {$1} = require("$2");');
    
    fs.writeFileSync(file, replaced);
};

if (fs.existsSync('tests/auth.test.js')) fixTest('tests/auth.test.js', fs.readFileSync('tests/auth.test.js', 'utf8'));
if (fs.existsSync('tests/collector.test.js')) fixTest('tests/collector.test.js', fs.readFileSync('tests/collector.test.js', 'utf8'));
if (fs.existsSync('tests/history.test.js')) fixTest('tests/history.test.js', fs.readFileSync('tests/history.test.js', 'utf8'));
if (fs.existsSync('tests/metrics.test.js')) fixTest('tests/metrics.test.js', fs.readFileSync('tests/metrics.test.js', 'utf8'));

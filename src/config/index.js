const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');

function loadEnv() {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
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
  // Default polling 1 jam (3600000 ms). Stale harus > interval (default 2 jam)
  metricsIntervalMs: parseInt(process.env.METRICS_INTERVAL_MS || '3600000', 10),
  metricsStaleAfterMs: parseInt(process.env.METRICS_STALE_AFTER_MS || '7200000', 10),
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

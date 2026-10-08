const { collectMetrics } = require('../collectors/windows.collector.js');
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

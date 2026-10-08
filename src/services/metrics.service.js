import { collectMetrics } from "../collectors/windows.collector.js";
import { historyService } from "./history.service.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

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
      
      // Save to history
      await historyService.append(data);
      
    } catch (err) {
      logger.error("Metrics collection failed:", err.message);
    } finally {
      this.isRunning = false;
      this.scheduleNext();
    }
  }

  getCurrentMetrics() {
    if (!this.currentMetrics) {
      return { error: "Metrics not available yet", status: 503 };
    }

    const age = Date.now() - this.lastCollectedAt;
    if (age > config.metricsStaleAfterMs) {
      return { error: "Metrics are stale", status: 503 };
    }

    const data = {
      ...this.currentMetrics,
      status: "running"
    };

    return { data };
  }
}

export const metricsService = new MetricsService();

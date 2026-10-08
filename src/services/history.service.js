import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const dataDir = config.dataPath;
const historyFile = path.join(dataDir, "history.jsonl");

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
          // entry.time is in seconds
          if (entry.time * 1000 >= cutoffTime) {
            this.history.push(entry);
          }
        } catch (e) {
          logger.warn("Failed to parse history line, skipping:", e.message);
        }
      }
      
      // Sort in case of out of order
      this.history.sort((a, b) => a.time - b.time);
      logger.info(`Loaded ${this.history.length} historical records.`);
      
      // Rewrite to drop old entries immediately if necessary
      await this.rewriteFile();
      
    } catch (err) {
      logger.error("Error loading history:", err);
    }
  }

  async append(metric) {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Check for duplicates
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
      await fs.promises.appendFile(historyFile, JSON.stringify(entry) + "\n");
    } catch (err) {
      logger.error("Failed to append history to file:", err);
    }

    this.prune();
  }

  async prune() {
    const cutoffTime = Math.floor((Date.now() - this.retentionMs) / 1000);
    const initialLength = this.history.length;
    
    // Filter out old records
    this.history = this.history.filter(entry => entry.time >= cutoffTime);
    
    if (this.history.length < initialLength) {
      await this.rewriteFile();
    }
  }

  async rewriteFile() {
    const tempFile = `${historyFile}.tmp`;
    try {
      const content = this.history.map(entry => JSON.stringify(entry)).join("\n") + (this.history.length > 0 ? "\n" : "");
      await fs.promises.writeFile(tempFile, content);
      await fs.promises.rename(tempFile, historyFile);
    } catch (err) {
      logger.error("Failed to rewrite history file:", err);
    }
  }

  getHistory(timeframeStr) {
    let timeframeMs = 60 * 60 * 1000; // default to hour
    if (timeframeStr === "day") {
      timeframeMs = 24 * 60 * 60 * 1000;
    } else if (timeframeStr === "week") {
      timeframeMs = 7 * 24 * 60 * 60 * 1000;
    }

    const cutoffTime = Math.floor((Date.now() - timeframeMs) / 1000);
    return this.history.filter(entry => entry.time >= cutoffTime);
  }
}

export const historyService = new HistoryService();

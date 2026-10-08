const test = require("node:test");
const assert = require("node:assert");
const { metricsService } = require("../src/services/metrics.service.js");

test("Metrics Service", async (t) => {

  await t.test("returns 503 if no metrics collected yet", (t) => {
    metricsService.currentMetrics = null;
    const result = metricsService.getCurrentMetrics();
    assert.strictEqual(result.error, "Metrics not available yet");
    assert.strictEqual(result.status, 503);
  });

  await t.test("returns current metrics when valid", (t) => {
    metricsService.currentMetrics = { cpu: 0.5, mem: 1000 };
    metricsService.lastCollectedAt = Date.now();
    
    const result = metricsService.getCurrentMetrics();
    assert.ok(result.data);
    assert.strictEqual(result.data.cpu, 0.5);
    assert.strictEqual(result.data.status, "running");
  });

  await t.test("returns 503 if metrics are stale", (t) => {
    metricsService.currentMetrics = { cpu: 0.5, mem: 1000 };
    metricsService.lastCollectedAt = Date.now() - 300000; // 5 minutes ago
    
    const result = metricsService.getCurrentMetrics();
    assert.strictEqual(result.error, "Metrics are stale");
    assert.strictEqual(result.status, 503);
  });

});

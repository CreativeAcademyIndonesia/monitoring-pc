import test from "node:test";
import assert from "node:assert";
import child_process from "node:child_process";
import { collectMetrics } from "../src/collectors/windows.collector.js";

test("Windows Collector", async (t) => {
  await t.test("parses valid JSON from powershell", async (t) => {
    process.env.MOCK_COLLECTOR = "true";
    process.env.MOCK_COLLECTOR_ERROR = "false";

    const data = await collectMetrics();
    assert.strictEqual(data.name, "MOCK-PC");
    assert.strictEqual(data.cpu, 0.25);
    assert.strictEqual(data.cpus, 4);
    assert.strictEqual(data.diskinfo[0].usage, 50);
  });

  await t.test("throws error on powershell failure", async (t) => {
    process.env.MOCK_COLLECTOR = "false";
    process.env.MOCK_COLLECTOR_ERROR = "true";

    try {
      await collectMetrics();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.match(err.message, /Failed to collect Windows metrics/);
    }
  });

  t.after(() => {
    delete process.env.MOCK_COLLECTOR;
    delete process.env.MOCK_COLLECTOR_ERROR;
  });
});

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { historyService } from "../src/services/history.service.js";

const testDataDir = path.join(process.cwd(), "data");
const testFile = path.join(testDataDir, "history.jsonl");

test("History Service", async (t) => {
  // Ensure fresh state
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
  historyService.history = [];

  await t.test("appends metrics correctly", async (t) => {
    const metric1 = { cpu: 0.1, mem: 1024, maxmem: 2048, disk: 500, maxdisk: 1000 };
    await historyService.append(metric1);

    assert.strictEqual(historyService.history.length, 1);
    assert.strictEqual(historyService.history[0].cpu, 0.1);
    
    // Check file
    const content = fs.readFileSync(testFile, "utf-8");
    assert.ok(content.includes('"cpu":0.1'));
  });

  await t.test("retrieves historical metrics within timeframe", async (t) => {
    const history = historyService.getHistory("hour");
    assert.strictEqual(history.length, 1);
  });

  await t.test("survives process restart (load)", async (t) => {
    // Clear memory
    historyService.history = [];
    
    // Load from file
    await historyService.load();
    
    assert.strictEqual(historyService.history.length, 1);
    assert.strictEqual(historyService.history[0].cpu, 0.1);
  });
  
  t.after(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });
});

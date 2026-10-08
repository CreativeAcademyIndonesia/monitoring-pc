import child_process from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ps1Path = path.resolve(__dirname, "../../scripts/metrics.ps1");

export async function collectMetrics() {
  if (process.env.MOCK_COLLECTOR === "true") {
    return {
      name: "MOCK-PC",
      cpu: 0.25,
      cpus: 4,
      mem: 2048,
      maxmem: 8192,
      disk: 500,
      maxdisk: 1000,
      uptime: 3600,
      diskinfo: [
        { drive: "C:", total: 1000, used: 500, free: 500, usage: 50 }
      ]
    };
  }
  if (process.env.MOCK_COLLECTOR_ERROR === "true") {
    throw new Error("Failed to collect Windows metrics: Command failed");
  }

  try {
    const execFileAsync = promisify(child_process.execFile);
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1Path],
      { timeout: 30000, maxBuffer: 1024 * 1024 } // 30s timeout, 1MB buffer
    );

    if (stderr) {
      console.warn("PowerShell stderr:", stderr);
    }

    const data = JSON.parse(stdout.trim());
    return data;
  } catch (err) {
    throw new Error(`Failed to collect Windows metrics: ${err.message}`);
  }
}

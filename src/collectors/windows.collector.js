const child_process = require('child_process');
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
    throw new Error(`Failed to collect Windows metrics: ${err.message}`);
  }
}

module.exports = { collectMetrics };

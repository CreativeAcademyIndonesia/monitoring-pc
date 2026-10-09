const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

const ps1Path = path.resolve(__dirname, '../../scripts/metrics.ps1');
const TIMEOUT_MS = 30000;

// Gunakan path absolut powershell.exe agar tidak bergantung pada PATH (Win 7/10/11)
function getPowerShellPath() {
  const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  // Jika Node 32-bit berjalan di Windows 64-bit, pakai Sysnative agar dapat PowerShell 64-bit
  const candidates = [
    path.join(sysRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  ];
  for (let i = 0; i < candidates.length; i++) {
    try { if (fs.existsSync(candidates[i])) return candidates[i]; } catch (e) { /* ignore */ }
  }
  return 'powershell.exe';
}

function runPowerShell() {
  return new Promise(function (resolve, reject) {
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-NoLogo',
      '-InputFormat', 'None', // PENTING untuk PowerShell 2.0 (Windows 7): jangan tunggu stdin
      '-ExecutionPolicy', 'Bypass',
      '-File', ps1Path
    ];

    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = child_process.spawn(getPowerShellPath(), args, {
      windowsHide: true,
      // stdin di-'ignore' agar PowerShell 2.0 tidak hang menunggu input
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(function () {
      if (finished) return;
      finished = true;
      try { child.kill(); } catch (e) { /* ignore */ }
      reject(new Error('Timeout ' + TIMEOUT_MS + 'ms' +
        (stderr ? ' | STDERR: ' + stderr.trim() : '') +
        (stdout ? ' | STDOUT: ' + stdout.trim() : '')));
    }, TIMEOUT_MS);

    child.stdout.on('data', function (d) { stdout += d.toString(); });
    child.stderr.on('data', function (d) { stderr += d.toString(); });

    child.on('error', function (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', function (code) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error('Exit code ' + code +
          (stderr ? ' | STDERR: ' + stderr.trim() : '') +
          (stdout ? ' | STDOUT: ' + stdout.trim() : '')));
      }
      resolve({ stdout: stdout, stderr: stderr });
    });
  });
}

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
    const result = await runPowerShell();

    if (result.stderr && result.stderr.trim()) {
      console.warn('PowerShell stderr:', result.stderr.trim());
    }

    // Ambil baris yang berupa JSON saja (abaikan noise/BOM)
    const out = result.stdout.replace(/^\uFEFF/, '').trim();
    const start = out.indexOf('{');
    const end = out.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Output bukan JSON | STDOUT: ' + out);
    }
    return JSON.parse(out.substring(start, end + 1));
  } catch (err) {
    throw new Error('Failed to collect Windows metrics: ' + err.message);
  }
}

module.exports = { collectMetrics };

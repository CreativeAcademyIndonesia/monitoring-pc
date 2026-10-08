# Windows Monitor Agent

A lightweight, Proxmox-compatible Windows Monitoring REST API designed to expose system metrics to a centralized Linux monitoring server. 

## Features
- Collects CPU, Memory, Disk, and Uptime metrics natively via PowerShell & WMI/CIM.
- Exposes metrics in a JSON format structurally identical to Proxmox VE.
- Includes historical metric retention (RRD-like data).
- Uses lightweight ES Modules.
- Fully compatible with PM2 for background process management.
- Bearer Token authentication.
- Secure, read-only endpoint design.

## System Requirements
- **Node.js**: v18.0.0 or higher.
- **PowerShell**: v3.0 or higher (for `ConvertTo-Json`).
- **OS**: Windows 10, Windows 11, Windows Server (2012+).
  - *Windows 7 Compatibility*: Supported if WMF 5.1 (PowerShell 5.1) is installed, but modern Node.js versions (v18+) will not run natively on Windows 7. You must use a legacy Node runtime or isolate Windows 7 machines differently. Note: Using EOL runtimes poses security risks.

## Installation

1. Clone or copy the repository to your Windows machine (e.g., `C:\monitoring\windows-monitor-agent`).
2. Run `npm install` (if dependencies are added in the future; currently, only built-in modules are used).
3. Copy `.env.example` to `.env` and generate a secure token:
   ```cmd
   copy .env.example .env
   ```
4. Open `.env` and set `MONITOR_TOKEN` to a secure random string.

## PM2 Startup Instructions

PM2 is highly recommended to run this API in the background.

```powershell
# Install PM2 globally
npm install -g pm2

# Start the agent
pm2 start ecosystem.config.cjs

# Save the PM2 list
pm2 save
```

### Autostart on Windows
PM2's built-in `pm2 startup` does not work reliably on Windows. Instead, use Windows Task Scheduler to run `pm2 resurrect` on system boot:

1. Open Task Scheduler.
2. Create a Basic Task triggered "When the computer starts".
3. Action: "Start a program".
4. Program: `C:\Users\YourUser\AppData\Roaming\npm\pm2.cmd` (Check your actual path).
5. Arguments: `resurrect`.

See `scripts/setup-autostart.ps1` for more details.

## Firewall Configuration

To allow the centralized Linux server to scrape metrics, open the API port (default: 9001) in Windows Firewall.

You can use the provided script (Run as Administrator):
```powershell
.\scripts\setup-firewall.ps1 -Port 9001 -AllowIP "192.168.1.50"
```
*(Replace `192.168.1.50` with your Linux server's IP to restrict access, or omit `-AllowIP` to allow all IPs).*

## API Endpoints

### 1. Current Metrics
Returns the latest collected metrics in a Proxmox-compatible schema.

**Request:**
```bash
curl -sS \
  -H 'API-KEY: monitoring-token-332100185' \
  'http://WINDOWS_HOST:9001/api2/json/status/current'
```

**Response:**
```json
{
  "data": {
    "status": "running",
    "name": "WINDOWS-PC-01",
    "cpu": 0.1534,
    "cpus": 8,
    "mem": 4326744064,
    "maxmem": 17179869184,
    "disk": 128849018880,
    "maxdisk": 536870912000,
    "uptime": 1999771,
    "diskinfo": [
      {
        "drive": "C:",
        "used": 128849018880,
        "total": 536870912000,
        "free": 408021893120,
        "usage": 24
      }
    ]
  }
}
```

### 2. Historical Metrics
Returns a time-series array of metrics. Supports `timeframe=hour`, `timeframe=day`, or `timeframe=week`.

**Request:**
```bash
curl -sS \
  -H 'API-KEY: monitoring-token-332100185' \
  'http://WINDOWS_HOST:9001/api2/json/rrddata?timeframe=hour'
```

**Response:**
```json
{
  "data": [
    {
      "time": 1791442800,
      "cpu": 0.12,
      "mem": 4294967296,
      "maxmem": 17179869184,
      "disk": 128849018880,
      "maxdisk": 536870912000
    }
  ]
}
```

### 3. Health Check
Unauthenticated endpoint to check if the API is responsive.

**Request:**
```bash
curl -sS 'http://WINDOWS_HOST:9001/health'
```

**Response:**
```json
{
  "status": "ok",
  "service": "windows-monitor-agent"
}
```

## Security Recommendations
- **Always set a strong `MONITOR_TOKEN`.**
- **Restrict Firewall Access:** Only allow the Linux monitoring server's IP.
- **Enable TLS:** Configure `TLS_ENABLED=true` in `.env` and provide `server.crt` and `server.key` paths if you are querying across untrusted networks.
- **Do not run as SYSTEM:** The PM2 process should ideally run under a dedicated service account that has enough privileges to query WMI/CIM but not full system control.

## Testing
To run automated tests locally:
```bash
npm test
```
*(Tests use mocked PowerShell outputs and do not require actual Windows system modifications).*

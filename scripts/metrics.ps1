try {
  $ErrorActionPreference = "Stop"

  $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
  $processors = @(Get-WmiObject Win32_Processor -ErrorAction Stop)
  $disks = @(Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop)

  # Hitung CPU
  $totalCpus = 0
  $cpuLoadSum = 0
  foreach ($cpu in $processors) {
      $cores = $cpu.NumberOfLogicalProcessors
      if ($null -eq $cores -or $cores -eq 0) { $cores = 1 }
      $totalCpus += $cores
      $load = $cpu.LoadPercentage
      if ($null -eq $load) { $load = 0 }
      $cpuLoadSum += ($load * $cores)
  }
  
  $cpuUsageRatio = 0
  if ($totalCpus -gt 0) {
      $cpuUsageRatio = ($cpuLoadSum / $totalCpus) / 100.0
  }
  # Pastikan pakai titik (bukan koma) untuk desimal
  $cpuStr = [string]$cpuUsageRatio
  $cpuStr = $cpuStr.Replace(",", ".")

  # Hitung Memory
  $memTotal = 0
  $memFree = 0
  if ($null -ne $os.TotalVisibleMemorySize) { $memTotal = [int64]$os.TotalVisibleMemorySize * 1024 }
  if ($null -ne $os.FreePhysicalMemory) { $memFree = [int64]$os.FreePhysicalMemory * 1024 }
  $memUsed = $memTotal - $memFree

  # Uptime (Parse WMI Date secara aman tanpa ConvertToDateTime)
  $uptimeSeconds = 0
  if ($null -ne $os.LastBootUpTime -and $os.LastBootUpTime.Length -ge 14) {
      $bootStr = $os.LastBootUpTime.Substring(0, 14)
      $lastBoot = [datetime]::ParseExact($bootStr, "yyyyMMddHHmmss", $null)
      $uptimeSeconds = [int]([DateTime]::Now - $lastBoot).TotalSeconds
      if ($uptimeSeconds -lt 0) { $uptimeSeconds = 0 }
  }

  # Hitung Disk
  $totalDiskSize = [int64]0
  $totalDiskUsed = [int64]0
  $diskJsonArray = @()

  foreach ($d in $disks) {
      if ($null -ne $d.Size -and $d.Size -gt 0) {
          $size = [int64]$d.Size
          $free = 0
          if ($null -ne $d.FreeSpace) { $free = [int64]$d.FreeSpace }
          $used = $size - $free
          
          $usage = 0
          if ($size -gt 0) {
              $usage = [math]::Round(($used / $size) * 100)
          }
          
          $totalDiskSize += $size
          $totalDiskUsed += $used
          
          $dName = $d.DeviceID
          $diskJsonArray += "{`"drive`":`"$dName`",`"used`":$used,`"total`":$size,`"free`":$free,`"usage`":$usage}"
      }
  }

  $disksStr = $diskJsonArray -join ","
  $compName = $env:COMPUTERNAME

  $json = "{`"name`":`"$compName`",`"cpu`":$cpuStr,`"cpus`":$totalCpus,`"mem`":$memUsed,`"maxmem`":$memTotal,`"disk`":$totalDiskUsed,`"maxdisk`":$totalDiskSize,`"uptime`":$uptimeSeconds,`"diskinfo`":[$disksStr]}"
  Write-Output $json
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}

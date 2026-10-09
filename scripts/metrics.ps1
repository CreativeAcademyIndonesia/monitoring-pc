try {
  $ErrorActionPreference = "Stop"

  # Gunakan Get-WmiObject karena 100% didukung dari Windows 7 sampai Windows 11
  $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
  $processors = @(Get-WmiObject Win32_Processor -ErrorAction Stop)
  $disks = @(Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop)

  # Hitung CPU
  $totalCpus = 0
  $cpuLoadSum = 0
  foreach ($cpu in $processors) {
      $cores = $cpu.NumberOfLogicalProcessors
      if ($null -eq $cores) { $cores = 1 }
      $totalCpus += $cores
      $load = $cpu.LoadPercentage
      if ($null -eq $load) { $load = 0 }
      $cpuLoadSum += ($load * $cores)
  }
  
  $cpuUsageRatio = 0
  if ($totalCpus -gt 0) {
      $cpuUsageRatio = ($cpuLoadSum / $totalCpus) / 100.0
  }
  # Format supaya desimalnya menggunakan titik, bukan koma (tergantung region)
  $cpuStr = [System.Math]::Round($cpuUsageRatio, 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)

  # Hitung Memory
  $memTotal = [uint64]$os.TotalVisibleMemorySize * 1024
  $memFree = [uint64]$os.FreePhysicalMemory * 1024
  $memUsed = $memTotal - $memFree

  # Uptime
  $lastBoot = $os.ConvertToDateTime($os.LastBootUpTime)
  $uptimeSeconds = [int]([DateTime]::Now - $lastBoot).TotalSeconds
  if ($uptimeSeconds -lt 0) { $uptimeSeconds = 0 }

  # Hitung Disk
  $diskInfo = @()
  $totalDiskSize = [uint64]0
  $totalDiskUsed = [uint64]0
  
  $diskJsonArray = @()

  foreach ($d in $disks) {
      $size = [uint64]$d.Size
      $free = [uint64]$d.FreeSpace
      $used = $size - $free
      
      $usage = 0
      if ($size -gt 0) {
          $usage = [math]::Round(($used / $size) * 100)
      }
      
      $totalDiskSize += $size
      $totalDiskUsed += $used
      
      # Build disk JSON manual
      $dName = $d.DeviceID
      $diskJsonArray += "{`"drive`":`"$dName`",`"used`":$used,`"total`":$size,`"free`":$free,`"usage`":$usage}"
  }

  $disksStr = $diskJsonArray -join ","

  $compName = $env:COMPUTERNAME

  # Build main JSON manual untuk kompatibilitas Windows 7 (tanpa ConvertTo-Json)
  $json = "{`"name`":`"$compName`",`"cpu`":$cpuStr,`"cpus`":$totalCpus,`"mem`":$memUsed,`"maxmem`":$memTotal,`"disk`":$totalDiskUsed,`"maxdisk`":$totalDiskSize,`"uptime`":$uptimeSeconds,`"diskinfo`":[$disksStr]}"

  Write-Output $json
} catch {
  Write-Error $_.Exception.Message
  exit 1
}

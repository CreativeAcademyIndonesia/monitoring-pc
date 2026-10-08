try {
  $ErrorActionPreference = "Stop"

  $isWmi = $false
  
  $os = $null
  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  } catch {
    $isWmi = $true
    $os = Get-WmiObject Win32_OperatingSystem -ErrorAction Stop
  }

  if ($isWmi) {
    $processors = @(Get-WmiObject Win32_Processor)
    $disks = @(Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3")
  } else {
    $processors = @(Get-CimInstance Win32_Processor)
    $disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3")
  }

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

  $memTotal = [uint64]$os.TotalVisibleMemorySize * 1024
  $memFree = [uint64]$os.FreePhysicalMemory * 1024
  $memUsed = $memTotal - $memFree

  $lastBoot = $null
  if ($isWmi) {
    $lastBoot = $os.ConvertToDateTime($os.LastBootUpTime)
  } else {
    $lastBoot = $os.LastBootUpTime
  }
  
  $uptimeSeconds = [int]([DateTime]::Now - $lastBoot).TotalSeconds
  if ($uptimeSeconds -lt 0) { $uptimeSeconds = 0 }

  $diskInfo = @()
  $totalDiskSize = [uint64]0
  $totalDiskUsed = [uint64]0

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
      
      $diskInfo += @{
          drive = $d.DeviceID
          total = $size
          free = $free
          used = $used
          usage = $usage
      }
  }

  $result = @{
      name = $env:COMPUTERNAME
      cpu = [math]::Round($cpuUsageRatio, 4)
      cpus = $totalCpus
      mem = $memUsed
      maxmem = $memTotal
      disk = $totalDiskUsed
      maxdisk = $totalDiskSize
      uptime = $uptimeSeconds
      diskinfo = $diskInfo
  }

  $json = $result | ConvertTo-Json -Depth 5 -Compress
  Write-Output $json
} catch {
  Write-Error $_.Exception.Message
  exit 1
}

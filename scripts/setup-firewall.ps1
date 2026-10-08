param(
    [int]$Port = 3001,
    [string]$AllowIP = ""
)

$RuleName = "Windows Monitor Agent (Port $Port)"

# Remove existing rule if any
Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

if ($AllowIP -ne "") {
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -RemoteAddress $AllowIP
    Write-Host "Firewall rule created for port $Port, allowing IP $AllowIP"
} else {
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow
    Write-Host "WARNING: Firewall rule created for port $Port, allowing ALL IPs. Consider restricting to specific IPs."
}

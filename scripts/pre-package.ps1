# 打包前释放 dist\win-unpacked 占用（Windows）
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$winUnpacked = Join-Path $root 'release\win-unpacked'

$names = @('TraceMark', 'TraceMark', 'electron')
foreach ($n in $names) {
  Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force
}

Get-CimInstance Win32_Process |
  Where-Object { $_.ExecutablePath -like "*$root*" -or $_.CommandLine -like "*win-unpacked*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

if (Test-Path $winUnpacked) {
  Remove-Item -Recurse -Force $winUnpacked -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  if (Test-Path $winUnpacked) {
    Write-Host "WARN: Could not remove $winUnpacked"
    Write-Host "Close TraceMark / TraceMark, Explorer windows under release\, then retry."
    exit 1
  }
  Write-Host "Removed $winUnpacked"
}

Write-Host "pre-package: OK"

# Kill all Node and npm processes
Write-Host "Stopping all Node processes..."

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Write-Host "Killing node process: $($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Node processes killed"
    Start-Sleep -Seconds 2
} else {
    Write-Host "No node processes running"
}

$npmProcesses = Get-Process npm -ErrorAction SilentlyContinue
if ($npmProcesses) {
    $npmProcesses | ForEach-Object {
        Write-Host "Killing npm process: $($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "✅ All processes cleared successfully"

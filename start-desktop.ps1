# Helix CME Electron Startup Script for Windows
Write-Host "Starting Helix CME Desktop Application..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
} catch {
    Write-Host "Docker is not running. Please start Docker first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start Docker services
Write-Host "Starting Docker services..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker-compose up -d

# Wait for services to be ready
Write-Host "Waiting 30 seconds for services to start..." -ForegroundColor Yellow
Start-Sleep 30

Write-Host "All services should be ready!" -ForegroundColor Green

# Start Electron
Write-Host "Starting Electron desktop app..." -ForegroundColor Cyan
Set-Location electron
npm run electron-dev

Write-Host "Helix CME Desktop Application closed." -ForegroundColor Green

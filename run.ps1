# PowerShell script to run both backend and frontend
# Usage: .\run.ps1

Write-Host "Starting Leave Management System..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Function to start backend
function Start-Backend {
    Write-Host "Starting Backend Server..." -ForegroundColor Cyan
    Set-Location backend
    if (!(Test-Path "node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        npm install
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"
    Set-Location ..
}

# Function to start frontend
function Start-Frontend {
    Write-Host "Starting Frontend Server..." -ForegroundColor Cyan
    Set-Location frontend
    if (!(Test-Path "node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"
    Set-Location ..
}

# Check if .env files exist
if (!(Test-Path "backend\.env")) {
    Write-Host "Warning: backend\.env file not found!" -ForegroundColor Yellow
    Write-Host "Please create backend\.env with your configuration. See SETUP.md" -ForegroundColor Yellow
}

if (!(Test-Path "frontend\.env.local")) {
    Write-Host "Warning: frontend\.env.local file not found!" -ForegroundColor Yellow
    Write-Host "Please create frontend\.env.local with your configuration. See SETUP.md" -ForegroundColor Yellow
}

# Start servers
Start-Backend
Start-Sleep -Seconds 2
Start-Frontend

Write-Host ""
Write-Host "Both servers are starting in separate windows..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this script (servers will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")







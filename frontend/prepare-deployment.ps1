# Prepare for Deployment Script
Write-Host "🚀 Preparing for deployment..." -ForegroundColor Cyan

# Step 1: Stop any running processes
Write-Host "`n⏹️  Step 1: Stopping Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Step 2: Clean build cache
Write-Host "`n🧹 Step 2: Cleaning build cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue
Write-Host "✅ Build cache cleared" -ForegroundColor Green

# Step 3: Verify dependencies
Write-Host "`n📦 Step 3: Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules missing - run 'npm install'" -ForegroundColor Yellow
}

# Step 4: Test build
Write-Host "`n🔨 Step 4: Testing production build..." -ForegroundColor Yellow
Write-Host "Running: npm run build" -ForegroundColor White
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Build successful! Ready for deployment." -ForegroundColor Green
    Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Set environment variables (.env.local)" -ForegroundColor White
    Write-Host "   2. Run: npm start (to test production build)" -ForegroundColor White
    Write-Host "   3. Deploy to your server" -ForegroundColor White
} else {
    Write-Host "`n❌ Build failed. Please fix errors before deploying." -ForegroundColor Red
    exit 1
}









# Clean Build Script for Next.js
# This script completely cleans the build cache and prepares for deployment

Write-Host "🧹 Cleaning Next.js build cache..." -ForegroundColor Cyan

# Stop any running Node processes
Write-Host "⏹️  Stopping Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Remove build directories
Write-Host "🗑️  Removing build directories..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue

# Clear npm cache (optional, uncomment if needed)
# Write-Host "🧹 Clearing npm cache..." -ForegroundColor Yellow
# npm cache clean --force

Write-Host "✅ Build cache cleaned successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Run: npm install (if needed)" -ForegroundColor White
Write-Host "   2. Run: npm run build (to test build)" -ForegroundColor White
Write-Host "   3. Run: npm run dev (to start dev server)" -ForegroundColor White
Write-Host ""




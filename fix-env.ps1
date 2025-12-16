# PowerShell script to help fix environment variable issues
Write-Host "🔍 Checking Environment Setup..." -ForegroundColor Cyan
Write-Host ""

# Check if frontend .env.local exists
$envFile = "frontend\.env.local"
if (Test-Path $envFile) {
    Write-Host "✅ frontend/.env.local exists" -ForegroundColor Green
    Write-Host ""
    Write-Host "Current contents:" -ForegroundColor Yellow
    Get-Content $envFile
    Write-Host ""
    
    # Check for placeholder values
    $content = Get-Content $envFile -Raw
    if ($content -match "your_supabase" -or $content -match "your.*_here") {
        Write-Host "⚠️  WARNING: Placeholder values detected!" -ForegroundColor Red
        Write-Host "You need to replace placeholders with actual Supabase values." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Get your values from: https://supabase.com/dashboard" -ForegroundColor Cyan
        Write-Host "  Settings → API → Copy Project URL and anon key" -ForegroundColor Cyan
    } else {
        Write-Host "✅ No placeholder values found" -ForegroundColor Green
    }
} else {
    Write-Host "❌ frontend/.env.local does NOT exist" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating template file..." -ForegroundColor Yellow
    
    $template = @"
# Supabase Configuration
# Get these from: https://supabase.com/dashboard/project/_/settings/api

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
"@
    
    # Create the file
    if (-not (Test-Path "frontend")) {
        Write-Host "Error: frontend folder not found!" -ForegroundColor Red
        exit 1
    }
    
    $template | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "✅ Created frontend/.env.local" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit this file and replace placeholders with your Supabase values!" -ForegroundColor Yellow
    Write-Host "   File location: $((Get-Item $envFile).FullName)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Make sure frontend/.env.local has REAL Supabase values (not placeholders)" -ForegroundColor White
Write-Host "2. RESTART your Next.js server (stop with Ctrl+C, then run 'npm run dev' again)" -ForegroundColor White
Write-Host "3. Check the browser - the error should be gone" -ForegroundColor White
Write-Host ""
Write-Host "Need Supabase credentials?" -ForegroundColor Yellow
Write-Host "  → Visit: https://supabase.com/dashboard" -ForegroundColor Cyan
Write-Host "  → Create project (if you don't have one)" -ForegroundColor Cyan
Write-Host "  → Go to Settings → API" -ForegroundColor Cyan
Write-Host "  → Copy Project URL and anon public key" -ForegroundColor Cyan
Write-Host ""







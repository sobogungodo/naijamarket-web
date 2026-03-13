# NaijaMarket Intel - Theme Fix Deploy (Simple Version)
# Run from: C:\Users\sobog\Documents\naijamarket-web\naijamarket-web
# No regex — just file copies + git push

$ROOT = "C:\Users\sobog\Documents\naijamarket-web\naijamarket-web"
$TFIX = "$ROOT\theme-fix"
$SRC  = "$ROOT\src"

Write-Host "=== Theme Fix Deploy ===" -ForegroundColor Cyan

# Step 1 - Copy component files
Write-Host "[1/4] Copying component files..." -ForegroundColor Yellow

Copy-Item "$TFIX\src\components\PublicPageShell.tsx" "$SRC\components\PublicPageShell.tsx" -Force
Write-Host "  OK: PublicPageShell.tsx" -ForegroundColor Green

# Create blog components folder if missing
if (!(Test-Path "$SRC\components\blog")) {
    New-Item -ItemType Directory -Path "$SRC\components\blog" | Out-Null
}
Copy-Item "$TFIX\src\components\blog\BlogNavbar.tsx" "$SRC\components\blog\BlogNavbar.tsx" -Force
Write-Host "  OK: BlogNavbar.tsx" -ForegroundColor Green

# Step 2 - Copy layout.tsx and PublicNavbar.tsx from Downloads if present
Write-Host "[2/4] Checking Downloads for layout.tsx and PublicNavbar.tsx..." -ForegroundColor Yellow

if (Test-Path "$HOME\Downloads\layout.tsx") {
    Copy-Item "$HOME\Downloads\layout.tsx" "$SRC\app\layout.tsx" -Force
    Write-Host "  OK: layout.tsx from Downloads" -ForegroundColor Green
} else {
    Write-Host "  SKIP: layout.tsx not in Downloads (use previously saved version)" -ForegroundColor Gray
}

if (Test-Path "$HOME\Downloads\PublicNavbar.tsx") {
    Copy-Item "$HOME\Downloads\PublicNavbar.tsx" "$SRC\components\PublicNavbar.tsx" -Force
    Write-Host "  OK: PublicNavbar.tsx from Downloads" -ForegroundColor Green
} else {
    Write-Host "  SKIP: PublicNavbar.tsx not in Downloads (use previously saved version)" -ForegroundColor Gray
}

# Step 3 - Verify all key files exist
Write-Host "[3/4] Verifying files..." -ForegroundColor Yellow

$files = @(
    "$SRC\app\layout.tsx",
    "$SRC\components\PublicNavbar.tsx",
    "$SRC\components\PublicPageShell.tsx",
    "$SRC\components\blog\BlogNavbar.tsx"
)

$allGood = $true
foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "  OK: $f" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $f" -ForegroundColor Red
        $allGood = $false
    }
}

if (!$allGood) {
    Write-Host "Some files are missing. Fix above then re-run." -ForegroundColor Red
    exit 1
}

# Step 4 - Git push
Write-Host "[4/4] Pushing to Git..." -ForegroundColor Yellow
Set-Location $ROOT
git add .
git commit -m "fix: theme toggle propagates to all public pages"
git push

Write-Host ""
Write-Host "=== Done! Vercel deploying now (~60 seconds) ===" -ForegroundColor Cyan
Write-Host "Test: https://www.naijamarketintel.com/pricing" -ForegroundColor White
Write-Host "Test: https://www.naijamarketintel.com/privacy" -ForegroundColor White
Write-Host "Test: https://www.naijamarketintel.com/blog"    -ForegroundColor White

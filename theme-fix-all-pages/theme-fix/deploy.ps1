# =============================================================================
# NaijaMarket Intel — Theme Fix Deploy Script
# Fixes theme propagation across ALL public pages in one run.
# Run this from: C:\Users\sobog\Documents\naijamarket-web\naijamarket-web
# =============================================================================

$ROOT = "C:\Users\sobog\Documents\naijamarket-web\naijamarket-web"
$SRC  = "$ROOT\src"

Write-Host "`n=== NaijaMarket Intel Theme Fix ===" -ForegroundColor Cyan
Write-Host "Root: $ROOT`n"

# ─── Step 1: Copy the component files ────────────────────────────────────────
Write-Host "[1/5] Copying component files..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# PublicNavbar (already from previous session — copy from Downloads if present)
$navSrc = "$HOME\Downloads\PublicNavbar.tsx"
if (Test-Path $navSrc) {
    Copy-Item $navSrc "$SRC\components\PublicNavbar.tsx" -Force
    Write-Host "  ✅ PublicNavbar.tsx -> src/components/" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  PublicNavbar.tsx not found in Downloads — ensure it's already at src/components/PublicNavbar.tsx" -ForegroundColor Yellow
}

# PublicPageShell
Copy-Item "$scriptDir\src\components\PublicPageShell.tsx" "$SRC\components\PublicPageShell.tsx" -Force
Write-Host "  ✅ PublicPageShell.tsx -> src/components/" -ForegroundColor Green

# BlogNavbar
$blogNavDir = "$SRC\components\blog"
if (!(Test-Path $blogNavDir)) { New-Item -ItemType Directory -Path $blogNavDir | Out-Null }
Copy-Item "$scriptDir\src\components\blog\BlogNavbar.tsx" "$blogNavDir\BlogNavbar.tsx" -Force
Write-Host "  ✅ BlogNavbar.tsx -> src/components/blog/" -ForegroundColor Green

# layout.tsx
$layoutSrc = "$HOME\Downloads\layout.tsx"
if (Test-Path $layoutSrc) {
    Copy-Item $layoutSrc "$SRC\app\layout.tsx" -Force
    Write-Host "  ✅ layout.tsx -> src/app/" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  layout.tsx not in Downloads — ensure src/app/layout.tsx already has forcedTheme removed" -ForegroundColor Yellow
}

# ─── Step 2: Patch page.tsx (home) — swap inline nav import ──────────────────
Write-Host "`n[2/5] Patching src/app/page.tsx..." -ForegroundColor Yellow

$pagePath = "$SRC\app\page.tsx"
if (Test-Path $pagePath) {
    $content = Get-Content $pagePath -Raw -Encoding UTF8

    # Check if PublicNavbar already imported
    if ($content -notmatch "PublicNavbar") {
        # Add import after the last existing import line
        $content = $content -replace '(import .+ from .+;\r?\n)(?!import)', '$1import PublicNavbar from "@/components/PublicNavbar";`n'
        Write-Host "  ✅ Added PublicNavbar import" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  PublicNavbar already imported — skipping" -ForegroundColor Gray
    }

    # Replace the inline <nav ...> block up to </nav> with <PublicNavbar />
    # This regex targets the sticky top-0 z-50 nav pattern used in landing page
    $navPattern = '<nav\s[^>]*sticky[^>]*>[\s\S]*?</nav>'
    if ($content -match $navPattern) {
        $content = $content -replace $navPattern, '<PublicNavbar />'
        Write-Host "  ✅ Replaced inline <nav> with <PublicNavbar />" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Could not auto-detect <nav> block in page.tsx" -ForegroundColor Yellow
        Write-Host "     → Manually replace your <nav ...>...</nav> block with <PublicNavbar />" -ForegroundColor Yellow
    }

    $content | Out-File $pagePath -Encoding utf8 -NoNewline
} else {
    Write-Host "  ❌ src/app/page.tsx not found!" -ForegroundColor Red
}

# ─── Step 3: Patch pricing/page.tsx ──────────────────────────────────────────
Write-Host "`n[3/5] Patching src/app/pricing/page.tsx..." -ForegroundColor Yellow

$pricingPath = "$SRC\app\pricing\page.tsx"
if (Test-Path $pricingPath) {
    $content = Get-Content $pricingPath -Raw -Encoding UTF8

    if ($content -notmatch "PublicNavbar") {
        $content = $content -replace '(import .+ from .+;\r?\n)(?!import)', '$1import PublicNavbar from "@/components/PublicNavbar";`n'
        Write-Host "  ✅ Added PublicNavbar import" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  PublicNavbar already imported — skipping" -ForegroundColor Gray
    }

    $navPattern = '<nav\s[^>]*sticky[^>]*>[\s\S]*?</nav>'
    if ($content -match $navPattern) {
        $content = $content -replace $navPattern, '<PublicNavbar />'
        Write-Host "  ✅ Replaced inline <nav> with <PublicNavbar />" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Could not auto-detect <nav> block in pricing/page.tsx" -ForegroundColor Yellow
        Write-Host "     → Manually replace your <nav ...>...</nav> block with <PublicNavbar />" -ForegroundColor Yellow
    }

    $content | Out-File $pricingPath -Encoding utf8 -NoNewline
} else {
    Write-Host "  ❌ src/app/pricing/page.tsx not found — pricing page may not have its own nav" -ForegroundColor Gray
}

# ─── Step 4: Verify blog pages already import BlogNavbar ─────────────────────
Write-Host "`n[4/5] Checking blog pages..." -ForegroundColor Yellow

$blogPages = @(
    "$SRC\app\blog\page.tsx",
    "$SRC\app\blog\[slug]\page.tsx"
)

foreach ($bp in $blogPages) {
    if (Test-Path $bp) {
        $c = Get-Content $bp -Raw -Encoding UTF8
        if ($c -match "BlogNavbar") {
            Write-Host "  ✅ $bp — already uses BlogNavbar (now fixed via component update)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $bp — does NOT import BlogNavbar (may need manual check)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ $bp — file not found" -ForegroundColor Red
    }
}

# ─── Step 5: Git commit + push ───────────────────────────────────────────────
Write-Host "`n[5/5] Pushing to Git..." -ForegroundColor Yellow
Set-Location $ROOT
git add .
git commit -m "fix: Theme toggle propagates to ALL public pages (PublicNavbar + next-themes)"
git push

Write-Host "`n=== Done! Vercel will deploy in ~60 seconds ===" -ForegroundColor Cyan
Write-Host "Test these pages after deploy:" -ForegroundColor White
Write-Host "  https://www.naijamarketintel.com"          -ForegroundColor Gray
Write-Host "  https://www.naijamarketintel.com/pricing"  -ForegroundColor Gray
Write-Host "  https://www.naijamarketintel.com/privacy"  -ForegroundColor Gray
Write-Host "  https://www.naijamarketintel.com/blog"     -ForegroundColor Gray
Write-Host "  https://www.naijamarketintel.com/about"    -ForegroundColor Gray

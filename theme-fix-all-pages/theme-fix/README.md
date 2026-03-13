# Theme Fix — All Public Pages
# NaijaMarket Intel | March 2026

## What This Package Fixes
Theme toggle now propagates correctly across ALL public pages.
Changing Light/Dark/Auto on the home page persists to pricing, blog,
privacy, terms, about, contact — and survives page navigation + hard refresh.

## Files In This Package
```
layout.tsx                          → src/app/layout.tsx               (download from previous step)
src/components/PublicNavbar.tsx     → src/components/PublicNavbar.tsx   (download from previous step)
src/components/PublicPageShell.tsx  → src/components/PublicPageShell.tsx
src/components/blog/BlogNavbar.tsx  → src/components/blog/BlogNavbar.tsx
deploy.ps1                          → Run from project root
```

## How To Deploy (2 minutes)

### Option A — Automated (recommended)
1. Download this ZIP and extract into your project root:
   C:\Users\sobog\Documents\naijamarket-web\naijamarket-web\

2. Make sure layout.tsx and PublicNavbar.tsx from previous step
   are already saved (or in your Downloads folder)

3. Open PowerShell in your project root and run:
   powershell -ExecutionPolicy Bypass -File deploy.ps1

4. Done. Vercel deploys in ~60 seconds.

### Option B — Manual
1. Copy PublicPageShell.tsx → src/components/PublicPageShell.tsx
2. Copy BlogNavbar.tsx → src/components/blog/BlogNavbar.tsx
3. In src/app/page.tsx:
   - Add:    import PublicNavbar from "@/components/PublicNavbar";
   - Remove: entire <nav ...>...</nav> block
   - Add:    <PublicNavbar />
4. Repeat step 3 for src/app/pricing/page.tsx (if it has its own nav)
5. git add . && git commit -m "fix: theme propagation" && git push

## Why It Works Now
| Before (broken) | After (fixed) |
|----------------|---------------|
| forcedTheme="dark" in layout.tsx locked all pages | Removed — ThemeProvider uses defaultTheme only |
| Each nav had its own useState + localStorage | All navs use useTheme() from next-themes (shared state) |
| PublicPageShell had no toggle | Uses PublicNavbar which has the toggle |
| Theme reset on page navigation | Anti-flash script in layout.tsx head applies theme before hydration |

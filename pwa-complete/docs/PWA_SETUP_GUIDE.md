# 📱 NaijaMarket Intel - Complete PWA Setup Guide

## Overview

This guide covers the complete PWA (Progressive Web App) implementation for NaijaMarket Intel, including:

- ✅ **A. PWA Manifest** - App identity and installation
- ✅ **B. Service Worker** - Offline support and caching
- ✅ **C. Push Notifications** - Real-time price alerts
- ✅ **D. Responsive Design** - Mobile-first CSS
- ✅ **E. Touch Gestures** - Pull-to-refresh, swipe navigation
- ✅ **F. Icon Generation** - All required PNG sizes

---

## 📂 File Structure

```
public/
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── favicon.ico             # Favicon
└── icons/
    ├── icon.svg            # Source SVG
    ├── icon-72x72.png      # Generated
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    ├── icon-512x512.png
    ├── icon-maskable-192x192.png
    ├── icon-maskable-512x512.png
    ├── apple-touch-icon.png
    ├── badge-72x72.png
    ├── badge-96x96.png
    ├── badge-128x128.png
    ├── shortcut-prices.png
    ├── shortcut-alerts.png
    ├── shortcut-markets.png
    ├── shortcut-trends.png
    ├── action-view.png
    └── action-dismiss.png

src/
├── hooks/
│   └── usePWA.ts           # PWA React hook
├── components/
│   ├── Providers.tsx       # Updated with PWA
│   ├── PWAInstallBanner.tsx
│   ├── PWAUpdateBanner.tsx
│   ├── OfflineIndicator.tsx
│   ├── PullToRefresh.tsx
│   ├── SwipeableNav.tsx
│   └── BottomNavigation.tsx
├── styles/
│   └── mobile-responsive.css
├── lib/
│   └── push-notifications.ts
└── app/
    ├── layout-metadata.ts
    ├── offline/
    │   └── page.tsx
    └── api/
        └── push/
            ├── subscribe/route.ts
            └── unsubscribe/route.ts

scripts/
├── generate-icons.js       # Icon generation
└── generate-vapid-keys.js  # Push notification keys

prisma/
└── schema-additions.prisma # Push subscription model
```

---

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
cd C:\Users\olawal\Desktop\naijamarket-web

# Install new dependencies
npm install web-push sharp --save
npm install @types/web-push --save-dev
```

### Step 2: Copy Files

Copy all files from this package to your project:

```bash
# Copy public files
xcopy /E /I pwa-complete\public public

# Copy src files
xcopy /E /I pwa-complete\src\hooks src\hooks
xcopy /E /I pwa-complete\src\components src\components
xcopy /E /I pwa-complete\src\styles src\styles
xcopy /E /I pwa-complete\src\lib src\lib
xcopy /E /I pwa-complete\src\app\offline src\app\offline
xcopy /E /I pwa-complete\src\app\api\push src\app\api\push

# Copy scripts
xcopy /E /I pwa-complete\scripts scripts
```

### Step 3: Generate Icons

```bash
# Generate all PNG icons from SVG
node scripts/generate-icons.js
```

This creates all required icon sizes:
- Standard icons (72-512px)
- Maskable icons (192, 512px)
- Badge icons (for notifications)
- Shortcut icons
- Apple touch icon
- Favicon

### Step 4: Generate VAPID Keys

```bash
# Generate keys for push notifications
node scripts/generate-vapid-keys.js
```

This outputs:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Add to .env.local
- `VAPID_PRIVATE_KEY` - Add to .env.local (keep secret!)
- `VAPID_EMAIL` - Your contact email

### Step 5: Update Environment Variables

Add to `.env.local`:

```env
# Push Notifications (from generate-vapid-keys.js output)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your_public_key_here"
VAPID_PRIVATE_KEY="your_private_key_here"
VAPID_EMAIL="mailto:admin@naijamarketintel.ng"
```

Add to Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

### Step 6: Update Database Schema

Add push subscription table to Azure SQL:

```sql
CREATE TABLE dbo.push_subscriptions (
    id NVARCHAR(100) NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id NVARCHAR(100) NOT NULL,
    endpoint NVARCHAR(500) NOT NULL,
    p256dh_key NVARCHAR(200) NOT NULL,
    auth_key NVARCHAR(100) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_push_subscriptions_consumers 
        FOREIGN KEY (user_id) 
        REFERENCES dbo.consumers(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT UQ_push_subscriptions_user_endpoint 
        UNIQUE (user_id, endpoint)
);

CREATE INDEX IX_push_subscriptions_user_active 
    ON dbo.push_subscriptions(user_id, is_active);
```

### Step 7: Update Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model Push_Subscription {
  id          String   @id @default(cuid())
  user_id     String
  endpoint    String   @db.VarChar(500)
  p256dh_key  String   @db.VarChar(200)
  auth_key    String   @db.VarChar(100)
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  user        Consumer @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, endpoint])
  @@index([user_id, is_active])
  @@map("push_subscriptions")
}
```

Run migration:

```bash
npx prisma generate
```

### Step 8: Update Layout

Update `src/app/layout.tsx`:

```tsx
import { Providers } from '@/components/Providers';
import { metadata, viewport } from './layout-metadata';
import '@/styles/mobile-responsive.css';

export { metadata, viewport };

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Step 9: Update next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
  
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### Step 10: Deploy

```bash
git add .
git commit -m "Add complete PWA support with offline mode, push notifications, and mobile optimization"
git push
```

---

## ✅ Testing Checklist

### PWA Installation
- [ ] Visit https://naijamarketintel.ng on Chrome
- [ ] Wait 3-5 seconds for install banner
- [ ] Click "Install App"
- [ ] App appears on desktop/home screen
- [ ] App opens in standalone mode (no browser UI)

### iOS Installation
- [ ] Open in Safari
- [ ] Tap Share button
- [ ] Tap "Add to Home Screen"
- [ ] App icon appears on home screen

### Offline Mode
- [ ] Install app
- [ ] Turn off WiFi/data
- [ ] App shows offline indicator
- [ ] Cached prices still visible
- [ ] Offline page loads for uncached routes
- [ ] App reconnects when online

### Push Notifications
- [ ] Click "Enable Notifications" in app
- [ ] Accept browser permission
- [ ] Receive test notification
- [ ] Clicking notification opens correct page

### Mobile UX
- [ ] Pull-to-refresh works
- [ ] Bottom navigation visible on mobile
- [ ] Touch targets are 44px minimum
- [ ] No horizontal scroll
- [ ] Text readable without zooming

### Chrome DevTools Audit
1. Open DevTools (F12)
2. Go to Application tab
3. Check Manifest section
4. Check Service Workers section
5. Run Lighthouse PWA audit (should score 90%+)

---

## 🔧 Troubleshooting

### Install prompt not showing?
- Clear localStorage: `localStorage.removeItem('pwa-install-dismissed')`
- Ensure HTTPS (Vercel provides this)
- Check manifest.json loads: `/manifest.json`
- Check service worker registered: DevTools → Application → Service Workers

### Service worker not registering?
- Check console for errors
- Ensure sw.js is in public folder
- Try hard refresh: Ctrl+Shift+R
- Check scope is correct

### Push notifications not working?
- Check VAPID keys are set in env
- Check Notification permission: `Notification.permission`
- Check subscription in database
- Test with: `webPush.sendNotification(subscription, payload)`

### Icons not generating?
- Ensure Sharp is installed: `npm install sharp`
- Check icon.svg exists in public/icons/
- Run: `node scripts/generate-icons.js`

---

## 📊 Performance Tips

1. **Cache Strategy**: API responses cached for 5 minutes, prices for 2 minutes
2. **Icon Optimization**: Use SVG source, generate PNGs at build time
3. **Lazy Loading**: Service worker registered after page load
4. **Background Sync**: Automatic when returning online
5. **Periodic Sync**: Prices refresh every hour in background

---

## 🎉 Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| PWA Manifest | ✅ | App identity, shortcuts, screenshots |
| Service Worker | ✅ | Offline caching, background sync |
| Install Prompt | ✅ | Custom banner with Nigerian context |
| Push Notifications | ✅ | Price alerts, validation requests |
| Offline Page | ✅ | Shows cached prices when offline |
| Pull-to-Refresh | ✅ | Mobile gesture support |
| Bottom Navigation | ✅ | Mobile-first navigation |
| Responsive CSS | ✅ | Mobile-first breakpoints |
| Touch Targets | ✅ | 44px minimum for accessibility |
| Safe Areas | ✅ | Support for notched phones |

---

## 📱 Nigerian Market Considerations

- **Low Bandwidth**: Aggressive caching, compressed assets
- **Offline-First**: Works without internet
- **Data Saver**: Minimal data usage
- **3G Support**: Fast on slow networks
- **Pidgin English**: User-friendly messages
- **Local Context**: Nigerian market names, Naira formatting

---

**Setup complete! Your PWA is ready for Nigerian traders! 🇳🇬**

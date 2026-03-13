// src/app/layout-metadata.ts
// Export this metadata from your layout.tsx

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'NaijaMarket Intel - Nigerian Commodity Prices',
    template: '%s | NaijaMarket Intel'
  },
  description: 'Real-time commodity prices from 226 Nigerian markets. Track food prices, building materials, and manufacturing costs across 37 states.',
  keywords: [
    'Nigerian commodity prices',
    'food prices Nigeria',
    'market prices Lagos',
    'rice price today',
    'garri price',
    'tomato price Nigeria',
    'building materials Nigeria',
    'cement price',
    'Mile 12 market prices',
    'Onitsha market prices'
  ],
  authors: [{ name: 'NaijaMarket Intel', url: 'https://naijamarketintel.ng' }],
  creator: 'Giggababytes Oy',
  publisher: 'NaijaMarket Intel',
  
  // PWA metadata
  applicationName: 'NaijaMarket Intel',
  manifest: '/manifest.json',
  
  // App links
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NaijaMarket',
    startupImage: [
      {
        url: '/splash/apple-splash-2048-2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)'
      },
      {
        url: '/splash/apple-splash-1668-2388.png',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)'
      },
      {
        url: '/splash/apple-splash-1536-2048.png',
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)'
      },
      {
        url: '/splash/apple-splash-1125-2436.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)'
      },
      {
        url: '/splash/apple-splash-1242-2688.png',
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)'
      },
      {
        url: '/splash/apple-splash-750-1334.png',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)'
      },
      {
        url: '/splash/apple-splash-640-1136.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)'
      }
    ]
  },
  
  // Format detection
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true
  },
  
  // Icons
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: '/favicon.ico'
  },
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://naijamarketintel.ng',
    siteName: 'NaijaMarket Intel',
    title: 'NaijaMarket Intel - Nigerian Commodity Prices',
    description: 'Real-time commodity prices from 226 Nigerian markets. Track food, building materials, and manufacturing costs.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NaijaMarket Intel - Track Nigerian commodity prices'
      }
    ]
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'NaijaMarket Intel',
    description: 'Real-time Nigerian commodity prices from 226 markets',
    images: ['/og-image.png'],
    creator: '@naijamarketng'
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  
  // Verification
  verification: {
    google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code'
  },
  
  // Other
  category: 'business'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22c55e' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
  ]
};

// Additional head elements to add to your layout
export const additionalHeadElements = `
  <!-- Apple-specific meta tags -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="NaijaMarket" />
  
  <!-- Microsoft Tiles -->
  <meta name="msapplication-TileColor" content="#0a0a0a" />
  <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
  <meta name="msapplication-config" content="/browserconfig.xml" />
  
  <!-- Preconnect to external domains -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  
  <!-- DNS prefetch for API -->
  <link rel="dns-prefetch" href="https://api.naijamarketintel.ng" />
`;

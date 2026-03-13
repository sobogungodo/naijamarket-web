// src/components/Providers.tsx
// Main providers wrapper with PWA registration and global state

'use client';

import { ReactNode, useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { PWAInstallBanner } from './PWAInstallBanner';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAUpdateBanner } from './PWAUpdateBanner';
import { BottomNavigation } from './BottomNavigation';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Check if running in standalone/PWA mode
  useEffect(() => {
    const checkStandalone = () => {
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(standalone);
      
      // Add class to body for standalone-specific styling
      if (standalone) {
        document.body.classList.add('standalone-mode');
      }
    };
    
    checkStandalone();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);
    
    return () => mediaQuery.removeEventListener('change', checkStandalone);
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });

        console.log('[App] Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour

      } catch (error) {
        console.error('[App] Service Worker registration failed:', error);
      }
    };

    // Register after page load for better performance
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
      return () => window.removeEventListener('load', registerServiceWorker);
    }
  }, []);

  // Fetch alert count for badge
  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const response = await fetch('/api/alerts/unread-count', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setAlertCount(data.count || 0);
        }
      } catch (error) {
        // Silently fail - not critical
      }
    };

    fetchAlertCount();
    
    // Refresh count periodically
    const interval = setInterval(fetchAlertCount, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Handle app visibility changes (for syncing when coming back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // App became visible - trigger sync if we have a service worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_ON_VISIBLE'
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {/* Global PWA components */}
        <OfflineIndicator position="top" />
        <PWAInstallBanner delayMs={5000} position="bottom" />
        <PWAUpdateBanner />
        
        {/* Main content */}
        <div className="min-h-screen bg-gray-950">
          {children}
        </div>
        
        {/* Bottom navigation (mobile only) */}
        <BottomNavigation alertCount={alertCount} />
      </ThemeProvider>
    </SessionProvider>
  );
}

export default Providers;

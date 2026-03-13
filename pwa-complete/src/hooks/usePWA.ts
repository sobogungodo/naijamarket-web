// src/hooks/usePWA.ts
// Comprehensive PWA hook for install prompts, push notifications, and online status

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UsePWAReturn {
  // Install
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  installApp: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  
  // Online status
  isOnline: boolean;
  
  // Service Worker
  swRegistration: ServiceWorkerRegistration | null;
  swUpdateAvailable: boolean;
  updateServiceWorker: () => void;
  
  // Push Notifications
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  pushPermission: NotificationPermission | 'unsupported';
  subscribeToPush: () => Promise<PushSubscriptionData | null>;
  unsubscribeFromPush: () => Promise<boolean>;
  
  // Display mode
  displayMode: 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui';
}

// VAPID public key (you'll need to generate this - see docs)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// Helper: Convert base64 to Uint8Array for push subscription
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

export function usePWA(): UsePWAReturn {
  // Install state
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  
  // Online state
  const [isOnline, setIsOnline] = useState(true);
  
  // Service Worker state
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  
  // Push state
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  
  // Display mode
  const [displayMode, setDisplayMode] = useState<'browser' | 'standalone' | 'fullscreen' | 'minimal-ui'>('browser');

  // ========================================================================
  // Initialize PWA features
  // ========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if iOS
    const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && 
                        !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
      
      // Set display mode
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        setDisplayMode('fullscreen');
      } else if (window.matchMedia('(display-mode: standalone)').matches) {
        setDisplayMode('standalone');
      } else if (window.matchMedia('(display-mode: minimal-ui)').matches) {
        setDisplayMode('minimal-ui');
      } else {
        setDisplayMode('browser');
      }
    };
    checkInstalled();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);
    
    // Check online status
    setIsOnline(navigator.onLine);
    
    // Check push notification support
    const pushSupported = 'PushManager' in window && 'serviceWorker' in navigator;
    setIsPushSupported(pushSupported);
    
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    
    return () => {
      mediaQuery.removeEventListener('change', checkInstalled);
    };
  }, []);

  // ========================================================================
  // Service Worker Registration
  // ========================================================================
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('[PWA] Service Worker registered:', registration.scope);
        setSwRegistration(registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New service worker available');
                setSwUpdateAvailable(true);
              }
            });
          }
        });
        
        // Check push subscription status
        if ('PushManager' in window) {
          const subscription = await registration.pushManager.getSubscription();
          setIsPushSubscribed(!!subscription);
        }
        
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };
    
    // Register after page load for better performance
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  // ========================================================================
  // Install Prompt Handler
  // ========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setIsInstallable(true);
      console.log('[PWA] Install prompt available');
    };
    
    const handleAppInstalled = () => {
      console.log('[PWA] App was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
      
      // Track installation
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'pwa_install', {
          event_category: 'PWA',
          event_label: 'App Installed'
        });
      }
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // ========================================================================
  // Online/Offline Status
  // ========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWA] Back online');
      
      // Trigger background sync if supported
      if (swRegistration && 'sync' in swRegistration) {
        (swRegistration as any).sync.register('sync-alerts').catch(console.error);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWA] Gone offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [swRegistration]);

  // ========================================================================
  // Actions
  // ========================================================================
  
  // Install the app
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) {
      console.log('[PWA] No install prompt available');
      return false;
    }
    
    try {
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      
      console.log('[PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      
      deferredPromptRef.current = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    }
  }, []);
  
  // Dismiss install prompt (for 7 days)
  const dismissInstallPrompt = useCallback(() => {
    setIsInstallable(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    console.log('[PWA] Install prompt dismissed');
  }, []);
  
  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [swRegistration]);
  
  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (): Promise<PushSubscriptionData | null> => {
    if (!swRegistration || !isPushSupported) {
      console.log('[PWA] Push not supported');
      return null;
    }
    
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission !== 'granted') {
        console.log('[PWA] Push notification permission denied');
        return null;
      }
      
      // Subscribe to push
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      console.log('[PWA] Push subscription created:', subscription.endpoint);
      setIsPushSubscribed(true);
      
      // Convert to JSON-friendly format
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
        }
      };
      
      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData),
        credentials: 'include'
      });
      
      return subscriptionData;
    } catch (error) {
      console.error('[PWA] Push subscription error:', error);
      return null;
    }
  }, [swRegistration, isPushSupported]);
  
  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) return false;
    
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          credentials: 'include'
        });
        
        setIsPushSubscribed(false);
        console.log('[PWA] Unsubscribed from push notifications');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Push unsubscribe error:', error);
      return false;
    }
  }, [swRegistration]);

  return {
    // Install
    isInstallable,
    isInstalled,
    isIOS,
    installApp,
    dismissInstallPrompt,
    
    // Online status
    isOnline,
    
    // Service Worker
    swRegistration,
    swUpdateAvailable,
    updateServiceWorker,
    
    // Push Notifications
    isPushSupported,
    isPushSubscribed,
    pushPermission,
    subscribeToPush,
    unsubscribeFromPush,
    
    // Display mode
    displayMode
  };
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default usePWA;

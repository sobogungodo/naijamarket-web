"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PushSubscriptionState {
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  isSupported: boolean;
}

interface UsePWAReturn {
  // Install
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<boolean>;
  dismissInstall: () => void;
  isDismissed: boolean;

  // Online status
  isOnline: boolean;

  // Service worker
  swRegistration: ServiceWorkerRegistration | null;
  swStatus: "loading" | "registered" | "error" | "unsupported";
  updateAvailable: boolean;
  updateSW: () => void;

  // Push notifications
  push: PushSubscriptionState;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
}

// ============================================================================
// VAPID public key (set in env: NEXT_PUBLIC_VAPID_PUBLIC_KEY)
// ============================================================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================================
// Hook
// ============================================================================

export function usePWA(): UsePWAReturn {
  // Install state
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Online state
  const [isOnline, setIsOnline] = useState(true);

  // Service worker state
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swStatus, setSwStatus] = useState<"loading" | "registered" | "error" | "unsupported">("loading");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  // Push state
  const [push, setPush] = useState<PushSubscriptionState>({
    isSubscribed: false,
    subscription: null,
    isSupported: false,
  });

  // ========================================================================
  // SERVICE WORKER REGISTRATION
  // ========================================================================

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] SW registered, scope:", registration.scope);
        setSwRegistration(registration);
        setSwStatus("registered");

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available
              waitingWorker.current = newWorker;
              setUpdateAvailable(true);
              console.log("[PWA] Update available");
            }
          });
        });

        // Check existing push subscription
        registration.pushManager.getSubscription().then((sub) => {
          setPush({
            isSubscribed: !!sub,
            subscription: sub,
            isSupported: "PushManager" in window,
          });
        });
      })
      .catch((err) => {
        console.error("[PWA] SW registration failed:", err);
        setSwStatus("error");
      });

    // Listen for controller change (after update)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] New SW active, reloading...");
      window.location.reload();
    });
  }, []);

  // ========================================================================
  // INSTALL PROMPT
  // ========================================================================

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Check if dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
      }
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
      console.log("[PWA] Install prompt captured");
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Detect successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt.current = null;
      console.log("[PWA] App installed!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // ========================================================================
  // ONLINE STATUS
  // ========================================================================

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;

    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      console.log("[PWA] Install choice:", outcome);
      deferredPrompt.current = null;
      setIsInstallable(false);
      return outcome === "accepted";
    } catch (err) {
      console.error("[PWA] Install error:", err);
      return false;
    }
  }, []);

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }, []);

  const updateSW = useCallback(() => {
    if (waitingWorker.current) {
      waitingWorker.current.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!swRegistration || !VAPID_PUBLIC_KEY) {
      console.error("[PWA] No SW registration or VAPID key");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("[PWA] Notification permission denied");
        return false;
      }

      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to backend
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (response.ok) {
        setPush({
          isSubscribed: true,
          subscription,
          isSupported: true,
        });
        console.log("[PWA] Push subscription successful");
        return true;
      }

      return false;
    } catch (err) {
      console.error("[PWA] Push subscribe error:", err);
      return false;
    }
  }, [swRegistration]);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!push.subscription) return false;

    try {
      await push.subscription.unsubscribe();

      // Notify backend
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: push.subscription.endpoint,
        }),
      });

      setPush({
        isSubscribed: false,
        subscription: null,
        isSupported: true,
      });

      console.log("[PWA] Push unsubscribed");
      return true;
    } catch (err) {
      console.error("[PWA] Unsubscribe error:", err);
      return false;
    }
  }, [push.subscription]);

  return {
    isInstallable,
    isInstalled,
    installApp,
    dismissInstall,
    isDismissed,
    isOnline,
    swRegistration,
    swStatus,
    updateAvailable,
    updateSW,
    push,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

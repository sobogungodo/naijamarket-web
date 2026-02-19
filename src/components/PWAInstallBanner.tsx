"use client";

import { useState, useEffect } from "react";
import { usePWA } from "@/hooks/usePWA";
import { Download, X, Smartphone, Zap, Bell, WifiOff } from "lucide-react";

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, installApp, dismissInstall, isDismissed } = usePWA();
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Show after 5 seconds on page
  useEffect(() => {
    if (isInstalled || isDismissed || !isInstallable) return;

    const timer = setTimeout(() => setShowBanner(true), 5000);
    return () => clearTimeout(timer);
  }, [isInstalled, isDismissed, isInstallable]);

  // Check if iOS Safari (no beforeinstallprompt event)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !isInStandalone && !isDismissed) {
      const timer = setTimeout(() => setShowIOSGuide(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [isDismissed]);

  const handleInstall = async () => {
    const accepted = await installApp();
    if (accepted) setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    dismissInstall();
  };

  // Already installed or nothing to show
  if (isInstalled) return null;
  if (!showBanner && !showIOSGuide) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-[#1a1a1a] border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Install NaijaMarket</h3>
              <p className="text-gray-400 text-sm">Get the app experience</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center p-2 bg-[#0f0f0f] rounded-lg">
              <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-[11px] text-gray-400">Instant Launch</p>
            </div>
            <div className="text-center p-2 bg-[#0f0f0f] rounded-lg">
              <WifiOff className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <p className="text-[11px] text-gray-400">Works Offline</p>
            </div>
            <div className="text-center p-2 bg-[#0f0f0f] rounded-lg">
              <Bell className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-[11px] text-gray-400">Push Alerts</p>
            </div>
          </div>

          {showIOSGuide ? (
            // iOS Safari instructions
            <div className="space-y-3">
              <p className="text-gray-300 text-sm">
                Tap{" "}
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-800 rounded text-blue-400 text-xs">
                  Share ↗
                </span>{" "}
                then{" "}
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-800 rounded text-white text-xs">
                  Add to Home Screen
                </span>
              </p>
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            // Android / Desktop install button
            <button
              onClick={handleInstall}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

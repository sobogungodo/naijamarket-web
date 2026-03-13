// src/components/PWAInstallBanner.tsx
// Animated install prompt with Nigerian-friendly messaging

'use client';

import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { X, Download, Smartphone, Share, Plus } from 'lucide-react';

interface PWAInstallBannerProps {
  delayMs?: number;  // Delay before showing (default: 3000ms)
  position?: 'top' | 'bottom';
}

export function PWAInstallBanner({ 
  delayMs = 3000, 
  position = 'bottom' 
}: PWAInstallBannerProps) {
  const { isInstallable, isInstalled, isIOS, installApp, dismissInstallPrompt } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Check if user dismissed recently (within 7 days)
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        return; // Don't show if dismissed recently
      }
    }
    
    // Show after delay if installable or iOS (can always install on iOS)
    if ((isInstallable || isIOS) && !isInstalled) {
      const timer = setTimeout(() => {
        setIsAnimating(true);
        setTimeout(() => setIsVisible(true), 50);
      }, delayMs);
      
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, isIOS, delayMs]);

  // Handle install click
  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    
    const installed = await installApp();
    if (installed) {
      handleDismiss();
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsAnimating(false);
      dismissInstallPrompt();
    }, 300);
  };

  // Don't render if not animating
  if (!isAnimating) return null;

  // Position styles
  const positionClasses = position === 'top' 
    ? 'top-0 rounded-b-2xl' 
    : 'bottom-0 rounded-t-2xl';

  return (
    <>
      {/* Install Banner */}
      <div 
        className={`
          fixed left-0 right-0 z-50 mx-auto max-w-lg
          ${positionClasses}
          bg-gradient-to-r from-green-900/95 to-emerald-900/95
          backdrop-blur-lg border border-green-500/20
          shadow-2xl shadow-green-500/10
          transition-all duration-300 ease-out
          ${isVisible 
            ? 'translate-y-0 opacity-100' 
            : position === 'top' ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'
          }
        `}
        role="alert"
        aria-live="polite"
      >
        <div className="px-4 py-4">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Content */}
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
            </div>
            
            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-lg leading-tight">
                Install NaijaMarket
              </h3>
              <p className="text-green-200/80 text-sm mt-0.5">
                {isIOS 
                  ? 'Add to Home Screen for quick access'
                  : 'Get instant price alerts & offline access'
                }
              </p>
            </div>
          </div>
          
          {/* Install Button */}
          <button
            onClick={handleInstall}
            className="
              w-full mt-4 py-3 px-4
              bg-gradient-to-r from-green-500 to-emerald-500
              hover:from-green-400 hover:to-emerald-400
              active:from-green-600 active:to-emerald-600
              text-white font-semibold text-base
              rounded-xl shadow-lg shadow-green-500/25
              transition-all duration-200
              flex items-center justify-center gap-2
              focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-green-900
            "
          >
            <Download className="w-5 h-5" />
            {isIOS ? 'Show Me How' : 'Install App'}
          </button>
          
          {/* Benefits */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-green-200/60">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Works offline
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              No data charges
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Instant alerts
            </span>
          </div>
        </div>
      </div>

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div 
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowIOSGuide(false)}
        >
          <div 
            className="bg-gray-900 rounded-t-3xl w-full max-w-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Add to Home Screen</h3>
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Steps */}
            <div className="px-6 py-6 space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Tap the Share button</p>
                  <p className="text-gray-400 text-sm mt-1">
                    At the bottom of Safari, tap the share icon
                  </p>
                  <div className="mt-2 p-3 bg-gray-800 rounded-xl inline-flex items-center gap-2">
                    <Share className="w-6 h-6 text-blue-400" />
                    <span className="text-gray-300 text-sm">Share</span>
                  </div>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Scroll and tap &quot;Add to Home Screen&quot;</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Scroll down the share menu and select this option
                  </p>
                  <div className="mt-2 p-3 bg-gray-800 rounded-xl inline-flex items-center gap-2">
                    <Plus className="w-6 h-6 text-gray-400" />
                    <span className="text-gray-300 text-sm">Add to Home Screen</span>
                  </div>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Tap &quot;Add&quot; to confirm</p>
                  <p className="text-gray-400 text-sm mt-1">
                    The app will appear on your home screen
                  </p>
                </div>
              </div>
            </div>
            
            {/* Done button */}
            <div className="px-6 pb-8">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl transition-colors"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Animation keyframes */}
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
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}

export default PWAInstallBanner;

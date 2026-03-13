// src/components/OfflineIndicator.tsx
// Shows when user is offline with reconnection status

'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showReconnecting?: boolean;
}

export function OfflineIndicator({ 
  position = 'top',
  showReconnecting = true 
}: OfflineIndicatorProps) {
  const { isOnline } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setIsVisible(true);
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowReconnected(true);
      
      // Hide offline indicator
      setIsVisible(false);
      
      // Show "reconnected" message briefly
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Position classes
  const positionClasses = position === 'top'
    ? 'top-0 rounded-b-lg'
    : 'bottom-0 rounded-t-lg';

  // Don't render if online and no reconnected message
  if (isOnline && !showReconnected) return null;

  return (
    <>
      {/* Offline Banner */}
      {isVisible && (
        <div 
          className={`
            fixed left-0 right-0 z-[100]
            ${positionClasses}
            bg-gradient-to-r from-red-900/95 to-orange-900/95
            backdrop-blur-lg border-b border-red-500/30
            shadow-lg
            animate-slide-in
          `}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center justify-center gap-3 px-4 py-3">
            <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
            <div className="text-center">
              <p className="text-white font-medium text-sm">
                You&apos;re offline
              </p>
              <p className="text-red-200/70 text-xs">
                Some features may not be available. Cached data still accessible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reconnected Toast */}
      {showReconnected && showReconnecting && (
        <div 
          className={`
            fixed left-1/2 -translate-x-1/2 z-[100]
            ${position === 'top' ? 'top-4' : 'bottom-4'}
            bg-green-900/95 backdrop-blur-lg
            border border-green-500/30
            rounded-full shadow-lg
            px-6 py-3
            animate-bounce-in
          `}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-green-100 font-medium text-sm">
              Back online!
            </span>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateY(${position === 'top' ? '-100%' : '100%'});
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: translateX(-50%) scale(0.8);
            opacity: 0;
          }
          50% {
            transform: translateX(-50%) scale(1.05);
          }
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out forwards;
        }
      `}</style>
    </>
  );
}

// Minimal inline version for embedding in headers
export function OfflineIndicatorInline() {
  const { isOnline } = usePWA();
  
  if (isOnline) return null;
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full">
      <WifiOff className="w-3.5 h-3.5 text-red-400" />
      <span className="text-red-400 text-xs font-medium">Offline</span>
    </div>
  );
}

export default OfflineIndicator;

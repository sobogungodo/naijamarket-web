// src/components/PWAUpdateBanner.tsx
// Shows when a new version of the app is available

'use client';

import { usePWA } from '@/hooks/usePWA';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { useState } from 'react';

export function PWAUpdateBanner() {
  const { swUpdateAvailable, updateServiceWorker } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!swUpdateAvailable || isDismissed) return null;

  const handleUpdate = () => {
    setIsUpdating(true);
    updateServiceWorker();
  };

  return (
    <div 
      className="
        fixed bottom-20 left-4 right-4 z-50
        mx-auto max-w-md
        bg-gradient-to-r from-blue-900/95 to-indigo-900/95
        backdrop-blur-lg border border-blue-500/30
        rounded-2xl shadow-2xl shadow-blue-500/10
        animate-slide-up
      "
      role="alert"
    >
      <div className="px-4 py-4">
        {/* Close button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss update notification"
        >
          <X className="w-4 h-4" />
        </button>
        
        {/* Content */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          
          <div className="flex-1">
            <p className="text-white font-medium text-sm">
              New version available
            </p>
            <p className="text-blue-200/70 text-xs mt-0.5">
              Refresh to get the latest features
            </p>
          </div>
          
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="
              px-4 py-2
              bg-blue-500 hover:bg-blue-400
              disabled:bg-blue-600 disabled:cursor-not-allowed
              text-white font-medium text-sm
              rounded-lg transition-colors
              flex items-center gap-2
            "
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
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
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default PWAUpdateBanner;

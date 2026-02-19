"use client";

import { usePWA } from "@/hooks/usePWA";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineIndicator() {
  const { isOnline, updateAvailable, updateSW } = usePWA();

  if (isOnline && !updateAvailable) return null;

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-600 text-black text-center py-1.5 px-4 text-sm font-medium flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>You&apos;re offline — showing cached data</span>
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && isOnline && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-emerald-600 text-white text-center py-1.5 px-4 text-sm font-medium flex items-center justify-center gap-3 shadow-lg">
          <RefreshCw className="w-4 h-4" />
          <span>New version available</span>
          <button
            onClick={updateSW}
            className="px-3 py-0.5 bg-white text-emerald-700 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors"
          >
            Update
          </button>
        </div>
      )}
    </>
  );
}

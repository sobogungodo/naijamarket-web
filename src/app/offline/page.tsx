"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, Home, ArrowLeft } from "lucide-react";

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-redirect back after 1 second
      setTimeout(() => window.location.reload(), 1000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
      {/* Status indicator */}
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${
        isOnline ? "bg-emerald-500/20" : "bg-amber-500/20"
      }`}>
        <WifiOff className={`w-10 h-10 ${isOnline ? "text-emerald-400" : "text-amber-400"}`} />
      </div>

      <h1 className="text-white text-2xl font-bold mb-2">
        {isOnline ? "Back Online!" : "You're Offline"}
      </h1>

      <p className="text-gray-400 text-base max-w-sm mb-8">
        {isOnline
          ? "Connection restored. Redirecting..."
          : "No internet connection. Check your mobile data or WiFi and try again."}
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying..." : "Try Again"}
        </button>

        <button
          onClick={() => window.history.back()}
          className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>

      {/* Branding */}
      <div className="mt-12 text-gray-600 text-xs">
        <p className="font-semibold">
          <span className="text-white">N</span>
          <span className="text-emerald-500">M</span>
          {" "}NaijaMarket Intel
        </p>
        <p className="mt-1">Nigeria&apos;s Commodity Intelligence Platform</p>
      </div>
    </div>
  );
}

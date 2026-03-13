// src/app/offline/page.tsx
// Offline fallback page with cached prices and retry functionality

'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, TrendingUp, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

interface CachedPrice {
  item_name: string;
  market_name: string;
  price: number;
  unit: string;
  cached_at: string;
}

export default function OfflinePage() {
  const [cachedPrices, setCachedPrices] = useState<CachedPrice[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Try to load cached prices from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem('naijamarket-cached-prices');
      if (cached) {
        const prices = JSON.parse(cached);
        setCachedPrices(prices.slice(0, 10)); // Show max 10 items
      }
    } catch (error) {
      console.error('Failed to load cached prices:', error);
    }
  }, []);

  // Auto-retry when back online
  useEffect(() => {
    const handleOnline = () => {
      window.location.href = '/';
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Manual retry
  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      const response = await fetch('/api/health', { 
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        window.location.href = '/';
      }
    } catch (error) {
      console.log('Still offline');
    } finally {
      setIsRetrying(false);
    }
  };

  // Format price in Naira
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-800">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">NaijaMarket</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 rounded-full">
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-xs font-medium">Offline</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 max-w-lg mx-auto">
        {/* Offline Message */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-10 h-10 text-gray-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            You&apos;re Offline
          </h1>
          
          <p className="text-gray-400 mb-6">
            No wahala! Your internet connection is unavailable. 
            {cachedPrices.length > 0 && ' Here are your last viewed prices:'}
          </p>
          
          {/* Retry Button */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="
              inline-flex items-center gap-2
              px-6 py-3
              bg-green-500 hover:bg-green-400
              disabled:bg-green-600 disabled:cursor-not-allowed
              text-white font-semibold
              rounded-xl transition-all
              shadow-lg shadow-green-500/25
            "
          >
            <RefreshCw className={`w-5 h-5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Checking...' : 'Try Again'}
          </button>
          
          {retryCount > 2 && (
            <p className="text-gray-500 text-sm mt-3">
              Still no connection. Try moving to an area with better network.
            </p>
          )}
        </div>

        {/* Cached Prices */}
        {cachedPrices.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Cached Prices
              </h2>
              <span className="text-xs text-gray-500">
                May not be current
              </span>
            </div>
            
            <div className="space-y-3">
              {cachedPrices.map((price, index) => (
                <div 
                  key={index}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">
                        {price.item_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-500 text-sm">
                          {price.market_name}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-green-400 font-bold">
                        {formatPrice(price.price)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        per {price.unit}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-3 text-xs text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>Cached {formatRelativeTime(price.cached_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Tips while offline:</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Move to an area with better network coverage</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Turn airplane mode on/off to reset your connection</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Try switching between WiFi and mobile data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">•</span>
              <span>Cached prices are available while offline</span>
            </li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-gray-900/95 backdrop-blur border-t border-gray-800">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-gray-500 text-xs">
            We&apos;ll automatically reconnect when you&apos;re back online
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  trend: "up" | "down" | "stable";
  unit: string;
}

export default function PriceTicker() {
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch ticker data on mount and refresh every 5 minutes
  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const response = await fetch("/api/ticker");
        const data = await response.json();
        if (data.success && data.data) {
          setTickerData(data.data);
        } else {
          setTickerData([]);
        }
      } catch (error) {
        console.error("Failed to fetch ticker data:", error);
        setTickerData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTickerData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTickerData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Format price with Naira symbol
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `₦${price.toLocaleString()}`;
    }
    return `₦${price.toFixed(1)}`;
  };

  // Format change percentage
  const formatChange = (change: number): string => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] py-2 px-4">
        <div className="flex items-center gap-8 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-20 bg-gray-800 rounded"></div>
              <div className="h-4 w-16 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tickerData.length === 0) return null;

  // Double the items for seamless loop
  const doubledData = [...tickerData, ...tickerData];

  return (
    <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex items-center gap-8 py-2 px-4 animate-scroll whitespace-nowrap"
        style={{
          animation: "scroll 60s linear infinite",
        }}
      >
        {doubledData.map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2 flex-shrink-0">
            {/* Symbol */}
            <span className={`font-mono text-sm font-semibold ${
              item.trend === "up" ? "text-emerald-400" : 
              item.trend === "down" ? "text-red-400" : 
              "text-gray-400"
            }`}>
              {item.symbol}
            </span>
            
            {/* Price */}
            <span className="text-white font-mono text-sm">
              {formatPrice(item.price)}
            </span>
            
            {/* Change */}
            <span className={`text-xs font-mono ${
              item.change > 0 ? "text-emerald-400" : 
              item.change < 0 ? "text-red-400" : 
              "text-gray-500"
            }`}>
              {formatChange(item.change)}
            </span>
          </div>
        ))}
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          display: flex;
          width: max-content;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

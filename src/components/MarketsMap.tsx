"use client";

import { useEffect, useRef, useState } from "react";

// Types
interface Market {
  id: string;
  name: string;
  state: string;
  status: string;
  latitude: number;
  longitude: number;
  items?: number;
}

interface MarketsMapProps {
  markets: Market[];
  height?: string;
}

export default function MarketsMap({ markets, height = "300px" }: MarketsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  // Nigeria center coordinates
  const nigeriaCenter: [number, number] = [9.0820, 8.6753];
  const defaultZoom = 6;

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    let isMounted = true;

    const initMap = async () => {
      try {
        // Dynamically import Leaflet
        const L = await import("leaflet");

        if (!isMounted || !mapRef.current) return;

        // Check if map already exists
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        // Add Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
          document.head.appendChild(link);
        }

        // Fix default marker icons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        // Create map
        const map = L.map(mapRef.current).setView(nigeriaCenter, defaultZoom);
        mapInstanceRef.current = map;

        // Add tile layer (OpenStreetMap - FREE)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Create custom icons
        const activeIcon = L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const inactiveIcon = L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        // Add markers for each market
        markets.forEach((market) => {
          if (market.latitude && market.longitude) {
            const icon = market.status === "Active" ? activeIcon : inactiveIcon;
            const marker = L.marker([market.latitude, market.longitude], { icon }).addTo(map);

            // Add popup
            const popupContent = `
              <div style="min-width: 150px; font-family: system-ui, sans-serif;">
                <strong style="font-size: 14px; display: block; margin-bottom: 4px;">${market.name}</strong>
                <span style="color: #666; display: block;">${market.state} State</span>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                  <span style="display: inline-flex; align-items: center; gap: 4px; color: ${market.status === "Active" ? "#16a34a" : "#dc2626"};">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${market.status === "Active" ? "#22c55e" : "#ef4444"};"></span>
                    ${market.status}
                  </span>
                </div>
                ${market.items ? `<div style="margin-top: 4px; color: #888; font-size: 12px;">${market.items} items tracked</div>` : ""}
              </div>
            `;
            marker.bindPopup(popupContent);
          }
        });

        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load map:", err);
        setError("Failed to load map");
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markets]);

  if (error) {
    return (
      <div
        className="bg-terminal-surface border border-terminal-border rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-red-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-terminal-border" style={{ height }}>
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-terminal-surface flex items-center justify-center z-10"
          style={{ height }}
        >
          <div className="text-center">
            <div className="animate-pulse">
              <div className="w-12 h-12 bg-naija-green/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-naija-green/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Loading map...</p>
            </div>
          </div>
        </div>
      )}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}


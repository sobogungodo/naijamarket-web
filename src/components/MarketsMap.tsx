"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

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

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

export default function MarketsMap({ markets, height = "300px" }: MarketsMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  // Nigeria center coordinates
  const nigeriaCenter: [number, number] = [9.0820, 8.6753];
  const defaultZoom = 6;

  useEffect(() => {
    setIsClient(true);
    // Import Leaflet on client side only
    import("leaflet").then((leaflet) => {
      setL(leaflet.default as unknown as typeof import("leaflet"));
      
      // Fix default marker icons
      delete (leaflet.default.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
    });
  }, []);

  if (!isClient || !L) {
    return (
      <div 
        className="bg-terminal-surface border border-terminal-border rounded-xl flex items-center justify-center"
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
    );
  }

  // Create custom icons for active/inactive markets
  const activeIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const inactiveIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  return (
    <div className="rounded-xl overflow-hidden border border-terminal-border" style={{ height }}>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
      />
      <MapContainer
        center={nigeriaCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markets.map((market) => (
          market.latitude && market.longitude ? (
            <Marker
              key={market.id}
              position={[market.latitude, market.longitude]}
              icon={market.status === "Active" ? activeIcon : inactiveIcon}
            >
              <Popup>
                <div className="text-sm min-w-[150px]">
                  <strong className="text-base block mb-1">{market.name}</strong>
                  <span className="text-gray-600 block">{market.state} State</span>
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className={`inline-flex items-center gap-1 ${market.status === "Active" ? "text-green-600" : "text-red-600"}`}>
                      <span className={`w-2 h-2 rounded-full ${market.status === "Active" ? "bg-green-500" : "bg-red-500"}`}></span>
                      {market.status}
                    </span>
                  </div>
                  {market.items && (
                    <div className="mt-1 text-gray-500 text-xs">
                      {market.items} items tracked
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

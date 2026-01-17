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
  const [L, setL] = useState<any>(null);

  // Nigeria center coordinates
  const nigeriaCenter: [number, number] = [9.0820, 8.6753];
  const defaultZoom = 6;

  useEffect(() => {
    setIsClient(true);
    // Import Leaflet on client side only
    import("leaflet").then((leaflet) => {
      setL(leaflet.default);
      
      // Fix default marker icons
      delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
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
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  // Create custom icons
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
                <div className="text-sm">
                  <strong className="text-base">{market.name}</strong>
                  <br />
                  <span className="text-gray-600">{market.state}</span>
                  <br />
                  <span className={market.status === "Active" ? "text-green-600" : "text-red-600"}>
                    ● {market.status}
                  </span>
                  {market.items && (
                    <>
                      <br />
                      <span className="text-gray-500">{market.items} items tracked</span>
                    </>
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


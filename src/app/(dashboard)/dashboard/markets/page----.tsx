"use client";

import { 
  MapPin, 
  Search, 
  Grid3X3, 
  List,
  Clock,
  Package,
  TrendingUp,
  Users,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import MarketsMap from "@/components/MarketsMap";

// ============================================================================
// MARKETS PAGE
// ============================================================================

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Markets Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            226 markets across 37 states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-terminal-surface border border-terminal-border rounded-lg text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors">
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button className="p-2 bg-naija-green/20 border border-naija-green/50 rounded-lg text-naija-green">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-lg px-4 py-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search markets by name or state..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
          />
        </div>
        <select className="bg-terminal-surface border border-terminal-border text-sm text-gray-400 rounded-lg px-4 py-2 outline-none focus:border-naija-green">
          <option>All Regions</option>
          <option>North West (NW)</option>
          <option>North East (NE)</option>
          <option>North Central (NC)</option>
          <option>South West (SW)</option>
          <option>South East (SE)</option>
          <option>South South (SS)</option>
        </select>
        <select className="bg-terminal-surface border border-terminal-border text-sm text-gray-400 rounded-lg px-4 py-2 outline-none focus:border-naija-green">
          <option>All States</option>
          <option>Lagos</option>
          <option>Kano</option>
          <option>FCT Abuja</option>
          <option>Rivers</option>
          <option>Anambra</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Markets", value: "226", icon: MapPin, color: "text-naija-green" },
          { label: "Active Today", value: "198", icon: TrendingUp, color: "text-price-up" },
          { label: "Price Updates", value: "12,847", icon: Package, color: "text-naija-gold" },
          { label: "Active Traders", value: "3,421", icon: Users, color: "text-naija-blue" },
        ].map((stat) => (
          <div key={stat.label} className="bg-terminal-surface border border-terminal-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-mono font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Interactive Map */}
      <MarketsMap markets={marketsWithCoords} height="350px" />

      {/* Markets Grid */}
      <div className="grid grid-cols-3 gap-4">
        {marketsData.map((market) => (
          <Link
            key={market.id}
            href={`/dashboard/markets/${market.id}`}
            className="group bg-terminal-surface border border-terminal-border rounded-xl p-4 hover:border-naija-green/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white group-hover:text-naija-green transition-colors">
                  {market.name}
                </h3>
                <p className="text-xs text-gray-500">{market.state}</p>
              </div>
              <span className={`px-2 py-0.5 text-2xs rounded ${
                market.status === "Active" 
                  ? "bg-price-up/20 text-price-up" 
                  : "bg-terminal-muted text-gray-500"
              }`}>
                {market.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-2xs text-gray-500 mb-1">Items Tracked</div>
                <div className="text-lg font-mono text-white">{market.items}</div>
              </div>
              <div>
                <div className="text-2xs text-gray-500 mb-1">Avg. Change</div>
                <div className={`text-lg font-mono ${
                  market.avgChange >= 0 ? "text-price-up" : "text-price-down"
                }`}>
                  {market.avgChange >= 0 ? "+" : ""}{market.avgChange}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-terminal-border">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {market.lastUpdate}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-naija-green">
                View Details
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Region Summary */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border">
          <h2 className="text-sm font-semibold text-white">Markets by Region</h2>
        </div>
        <div className="grid grid-cols-6 divide-x divide-terminal-border">
          {regions.map((region) => (
            <div key={region.code} className="p-4 text-center hover:bg-terminal-elevated transition-colors cursor-pointer">
              <div className="text-2xl mb-1">{region.emoji}</div>
              <div className="text-sm font-semibold text-white">{region.code}</div>
              <div className="text-2xs text-gray-500">{region.name}</div>
              <div className="text-lg font-mono text-naija-green mt-2">{region.markets}</div>
              <div className="text-2xs text-gray-500">markets</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA (with GPS coordinates for map)
// ============================================================================

const marketsData = [
  { id: "mile-12", name: "Mile 12 Market", state: "Lagos", status: "Active", items: 156, avgChange: 2.3, lastUpdate: "2 min ago", latitude: 6.5833, longitude: 3.3833 },
  { id: "onitsha", name: "Onitsha Main Market", state: "Anambra", status: "Active", items: 203, avgChange: -1.2, lastUpdate: "5 min ago", latitude: 6.1667, longitude: 6.7833 },
  { id: "iddo", name: "Iddo Market", state: "Lagos", status: "Active", items: 89, avgChange: 0.8, lastUpdate: "8 min ago", latitude: 6.4698, longitude: 3.3877 },
  { id: "ariaria", name: "Ariaria Market", state: "Abia", status: "Active", items: 178, avgChange: 3.1, lastUpdate: "3 min ago", latitude: 5.1167, longitude: 7.3667 },
  { id: "alaba", name: "Alaba International", state: "Lagos", status: "Active", items: 134, avgChange: -0.5, lastUpdate: "12 min ago", latitude: 6.4631, longitude: 3.1897 },
  { id: "wuse", name: "Wuse Market", state: "FCT", status: "Active", items: 98, avgChange: 1.7, lastUpdate: "6 min ago", latitude: 9.0765, longitude: 7.4983 },
  { id: "kano-main", name: "Kano Main Market", state: "Kano", status: "Active", items: 167, avgChange: 4.2, lastUpdate: "4 min ago", latitude: 12.0022, longitude: 8.5167 },
  { id: "jos-main", name: "Jos Main Market", state: "Plateau", status: "Active", items: 112, avgChange: -2.1, lastUpdate: "15 min ago", latitude: 9.8965, longitude: 8.8583 },
  { id: "bodija", name: "Bodija Market", state: "Oyo", status: "Inactive", items: 145, avgChange: 0, lastUpdate: "2 hours ago", latitude: 7.4167, longitude: 3.9000 },
];

// Transform for map component
const marketsWithCoords = marketsData.map(m => ({
  id: m.id,
  name: m.name,
  state: m.state,
  status: m.status,
  latitude: m.latitude,
  longitude: m.longitude,
  items: m.items,
}));

const regions = [
  { code: "NW", name: "North West", emoji: "🏜️", markets: 42 },
  { code: "NE", name: "North East", emoji: "🌍", markets: 28 },
  { code: "NC", name: "North Central", emoji: "⛰️", markets: 35 },
  { code: "SW", name: "South West", emoji: "🌴", markets: 48 },
  { code: "SE", name: "South East", emoji: "🌿", markets: 38 },
  { code: "SS", name: "South South", emoji: "🌊", markets: 35 },
];

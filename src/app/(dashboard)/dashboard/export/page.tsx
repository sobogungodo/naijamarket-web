"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  MapPin,
  Package,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Clock,
  TrendingUp,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ExportOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  formats: string[];
  requiredTier: string[];
  estimatedRows?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "prices",
    name: "Price Data",
    description: "Current and historical commodity prices across all markets",
    icon: TrendingUp,
    formats: ["CSV", "XLSX", "JSON"],
    requiredTier: ["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
    estimatedRows: "~50,000 records",
  },
  {
    id: "markets",
    name: "Market Directory",
    description: "Complete list of markets with locations, coordinates, and operating hours",
    icon: MapPin,
    formats: ["CSV", "XLSX", "JSON"],
    requiredTier: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
    estimatedRows: "226 markets",
  },
  {
    id: "items",
    name: "Items Catalog",
    description: "Full commodity catalog with categories, units, and baseline prices",
    icon: Package,
    formats: ["CSV", "XLSX", "JSON"],
    requiredTier: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
    estimatedRows: "524 items",
  },
  {
    id: "trends",
    name: "Price Trends",
    description: "Historical price trends and volatility analysis by item and region",
    icon: TrendingUp,
    formats: ["CSV", "XLSX"],
    requiredTier: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
    estimatedRows: "~100,000 records",
  },
  {
    id: "regional",
    name: "Regional Report",
    description: "Aggregated price indices and statistics by Nigerian region",
    icon: MapPin,
    formats: ["CSV", "XLSX", "PDF"],
    requiredTier: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
    estimatedRows: "6 regions × 30 days",
  },
];

const DATE_RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "1y", label: "Last year" },
  { id: "all", label: "All time" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hasTierAccess(userTier: string, requiredTiers: string[]): boolean {
  const userTierIndex = TIER_HIERARCHY.indexOf(userTier.toUpperCase());
  return requiredTiers.some(tier => {
    const requiredIndex = TIER_HIERARCHY.indexOf(tier.toUpperCase());
    return userTierIndex >= requiredIndex;
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ExportDataPage() {
  const { data: session } = useSession();
  const [selectedExport, setSelectedExport] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("CSV");
  const [dateRange, setDateRange] = useState<string>("30d");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<{id: string; name: string; date: string; size: string}[]>([
    { id: "1", name: "prices_2026-01-08.csv", date: "2026-01-08 14:32", size: "2.4 MB" },
    { id: "2", name: "markets_2026-01-07.xlsx", date: "2026-01-07 09:15", size: "156 KB" },
    { id: "3", name: "items_catalog_2026-01-05.json", date: "2026-01-05 16:45", size: "89 KB" },
  ]);

  // Get user tier
  const user = session?.user as { tier?: string } | undefined;
  const userTier = user?.tier || "FREE";

  // Handle export
  const handleExport = async () => {
    if (!selectedExport) return;

    setIsExporting(true);
    setExportSuccess(null);

    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const option = EXPORT_OPTIONS.find(o => o.id === selectedExport);
      const filename = `${selectedExport}_${new Date().toISOString().split('T')[0]}.${selectedFormat.toLowerCase()}`;
      
      // Add to history
      setExportHistory(prev => [{
        id: Date.now().toString(),
        name: filename,
        date: new Date().toLocaleString(),
        size: Math.floor(Math.random() * 5000 + 100) + " KB",
      }, ...prev.slice(0, 9)]);

      setExportSuccess(`Successfully exported ${option?.name} as ${selectedFormat}`);
      
      // In real implementation, trigger download here
      // window.location.href = `/api/export?type=${selectedExport}&format=${selectedFormat}&range=${dateRange}`;
      
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Check if user can export at all
  const canExportAnything = EXPORT_OPTIONS.some(opt => hasTierAccess(userTier, opt.requiredTier));

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Download className="w-7 h-7 text-emerald-400" />
          Export Data
        </h1>
        <p className="text-gray-400 mt-1">
          Download market data in multiple formats for analysis and reporting
        </p>
      </div>

      {/* Tier Check */}
      {!canExportAnything && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <Lock className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-amber-400 font-semibold text-lg">Upgrade Required</h3>
              <p className="text-gray-300 mt-1">
                Data export is available for SILVER tier and above. Upgrade your subscription to access bulk data downloads.
              </p>
              <button className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors">
                Upgrade to SILVER
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Export Options */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">Available Exports</h2>
          
          {EXPORT_OPTIONS.map((option) => {
            const hasAccess = hasTierAccess(userTier, option.requiredTier);
            const isSelected = selectedExport === option.id;
            const Icon = option.icon;

            return (
              <div
                key={option.id}
                onClick={() => hasAccess && setSelectedExport(option.id)}
                className={`
                  relative bg-[#1a1a1a] border rounded-xl p-4 transition-all
                  ${isSelected ? "border-emerald-500 bg-emerald-500/5" : "border-gray-800"}
                  ${hasAccess ? "cursor-pointer hover:border-gray-700" : "opacity-60 cursor-not-allowed"}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${isSelected ? "bg-emerald-500/20" : "bg-gray-800"}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? "text-emerald-400" : "text-gray-400"}`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">{option.name}</h3>
                      {!hasAccess && <Lock className="w-4 h-4 text-gray-500" />}
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{option.description}</p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">{option.formats.join(", ")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">{option.estimatedRows}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                {!hasAccess && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                      {option.requiredTier[0]}+
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Export Configuration */}
        <div className="space-y-6">
          {/* Format Selection */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Export Format
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {["CSV", "XLSX", "JSON"].map((format) => (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(format)}
                  disabled={!canExportAnything}
                  className={`
                    py-2 px-3 rounded-lg text-sm font-medium transition-colors
                    ${selectedFormat === format
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              Date Range
            </h3>
            <div className="space-y-2">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id)}
                  disabled={!canExportAnything}
                  className={`
                    w-full py-2 px-3 rounded-lg text-sm text-left transition-colors
                    ${dateRange === range.id
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={!selectedExport || isExporting || !canExportAnything}
            className={`
              w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
              ${selectedExport && canExportAnything
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Data
              </>
            )}
          </button>

          {/* Success Message */}
          {exportSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm">{exportSuccess}</span>
            </div>
          )}
        </div>
      </div>

      {/* Export History */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          Recent Exports
        </h2>
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Filename</th>
                <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Date</th>
                <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Size</th>
                <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {exportHistory.map((item) => (
                <tr key={item.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="text-white text-sm">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{item.date}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{item.size}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-emerald-400 hover:text-emerald-300 text-sm">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
  CheckCircle2,
  RefreshCw,
  Lock,
  Clock,
  TrendingUp,
  AlertCircle,
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
    id: "markets",
    name: "Market Directory",
    description: "Complete list of markets with locations, coordinates, and operating hours",
    icon: MapPin,
    formats: ["CSV", "JSON"],
    requiredTier: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  },
  {
    id: "items",
    name: "Items Catalog",
    description: "Full commodity catalog with categories, units, and baseline prices",
    icon: Package,
    formats: ["CSV", "JSON"],
    requiredTier: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  },
  {
    id: "prices",
    name: "Price Data",
    description: "Current and historical commodity prices across all markets",
    icon: TrendingUp,
    formats: ["CSV", "JSON"],
    requiredTier: ["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  },
  {
    id: "trends",
    name: "Price Trends",
    description: "Historical price trends and volatility analysis by item and region",
    icon: TrendingUp,
    formats: ["CSV", "JSON"],
    requiredTier: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  },
  {
    id: "regional",
    name: "Regional Report",
    description: "Aggregated price indices and statistics by Nigerian region",
    icon: MapPin,
    formats: ["CSV", "JSON"],
    requiredTier: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  },
];

const DATE_RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "1y", label: "Last year" },
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
  const [exportError, setExportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rowCount: number; estimatedSize: string } | null>(null);
  const [exportHistory, setExportHistory] = useState<{id: string; name: string; date: string; size: string}[]>([]);

  const user = session?.user as { tier?: string; phone?: string } | undefined;
  const userTier = user?.tier || "FREE";
  const canExportAnything = EXPORT_OPTIONS.some(opt => hasTierAccess(userTier, opt.requiredTier));

  // Fetch preview when selection changes
  const fetchPreview = async (type: string) => {
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, range: dateRange, tier: userTier }),
      });
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
      }
    } catch (err) {
      console.error("Preview fetch error:", err);
    }
  };

  // Handle export selection
  const handleSelectExport = (id: string) => {
    setSelectedExport(id);
    setExportSuccess(null);
    setExportError(null);
    fetchPreview(id);
  };

  // Handle actual export/download
  const handleExport = async () => {
    if (!selectedExport) return;

    setIsExporting(true);
    setExportSuccess(null);
    setExportError(null);

    try {
      const params = new URLSearchParams({
        type: selectedExport,
        format: selectedFormat,
        range: dateRange,
        tier: userTier,
      });

      const response = await fetch(`/api/export?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      // Get the filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const defaultFilename = `export_${selectedExport}_${new Date().toISOString().slice(0, 10)}.${selectedFormat.toLowerCase()}`;
      const filename: string = filenameMatch?.[1] ?? defaultFilename;

      // Get rows exported
      const rowsExported = response.headers.get("X-Rows-Exported") || "0";

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Add to history
      setExportHistory(prev => [{
        id: Date.now().toString(),
        name: filename,
        date: new Date().toLocaleString(),
        size: `${rowsExported} rows`,
      }, ...prev.slice(0, 9)]);

      setExportSuccess(`Successfully exported ${rowsExported} rows as ${selectedFormat}`);

    } catch (error: any) {
      console.error("Export error:", error);
      setExportError(error.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 md:p-6 mb-6">
          <div className="flex items-start gap-4">
            <Lock className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-amber-400 font-semibold text-lg">Upgrade Required</h3>
              <p className="text-gray-300 mt-1">
                Data export is available for SILVER tier and above.
              </p>
              <button className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors">
                Upgrade to SILVER
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
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
                onClick={() => hasAccess && handleSelectExport(option.id)}
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
                      {isSelected && preview && (
                        <div className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-emerald-400">~{preview.rowCount.toLocaleString()} rows</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
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

        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Format */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Export Format
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {["CSV", "JSON"].map((format) => (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(format)}
                  disabled={!canExportAnything}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors
                    ${selectedFormat === format ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}
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
                  onClick={() => {
                    setDateRange(range.id);
                    if (selectedExport) fetchPreview(selectedExport);
                  }}
                  disabled={!canExportAnything}
                  className={`w-full py-2 px-3 rounded-lg text-sm text-left transition-colors
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
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
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

          {/* Success/Error Messages */}
          {exportSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm">{exportSuccess}</span>
            </div>
          )}
          {exportError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">{exportError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Export History */}
      {exportHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Exports
          </h2>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Filename</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Date</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Size</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

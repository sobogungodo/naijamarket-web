// ============================================================================
// src/app/(dashboard)/dashboard/reports/page.tsx
// NaijaMarket Intel - Market Intelligence Reports Dashboard
// Version: 2.0.0 - Fixed report generation with real API integration
// Bloomberg Equivalent: NI <GO>
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  ChevronRight,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Crown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MapPin,
  Scale,
  Plus,
  Trash2,
  Play,
  Pause,
  Eye,
  FileSpreadsheet,
  FileCode,
  Bell,
  Send,
  Lock,
  Truck,
  Settings,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReportType {
  id: string;
  name: string;
  description: string;
  frequency: string;
  sections: string[];
  estimatedPages: number;
  icon: string;
  minTier: string;
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  expiresAt: string;
  format: string;
  fileSize: string;
  downloadUrl: string;
  sections: string[];
  metrics: ReportMetrics;
}

interface ReportMetrics {
  totalItems: number;
  totalMarkets: number;
  priceChanges: {
    increases: number;
    decreases: number;
    unchanged: number;
  };
  topGainers: PriceMovement[];
  topLosers: PriceMovement[];
  categoryBreakdown: CategoryMetric[];
  regionalData: RegionalMetric[];
  nfpiIndex: NFPIData;
  nbsComparison?: NBSComparison;
}

interface PriceMovement {
  item: string;
  market: string;
  state: string;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  changeAmount: number;
}

interface CategoryMetric {
  category: string;
  avgPrice: number;
  avgChange: number;
  itemCount: number;
  trend: "up" | "down" | "stable";
}

interface RegionalMetric {
  region: string;
  states: string[];
  avgInflation: number;
  topItem: string;
  marketCount: number;
}

interface NFPIData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  basketItems: Array<{
    item: string;
    weight: number;
    price: number;
    change: number;
  }>;
}

interface NBSComparison {
  naijaMarketInflation: number;
  nbsOfficialInflation: number;
  difference: number;
  insight: string;
}

interface ScheduledReport {
  id: string;
  reportType: string;
  format: string;
  frequency: string;
  deliveryMethod: string;
  deliveryAddress: {
    email?: string;
    phone?: string;
  };
  deliveryTime: string;
  deliveryDay?: number;
  nextDelivery: string;
  lastDelivery: string | null;
  isActive: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_COLORS: Record<string, string> = {
  FREE: "text-gray-400 bg-gray-800",
  SILVER: "text-gray-300 bg-gray-700",
  GOLD: "text-yellow-400 bg-yellow-900/30",
  BUSINESS: "text-blue-400 bg-blue-900/30",
  BUSINESS_PLUS: "text-blue-400 bg-blue-900/30",
  CORPORATE: "text-purple-400 bg-purple-900/30",
  ENTERPRISE: "text-emerald-400 bg-emerald-900/30",
  OGA_BOSS: "text-emerald-400 bg-emerald-900/30",
  GOVERNMENT: "text-emerald-400 bg-emerald-900/30",
};

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "BUSINESS_PLUS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

const REPORT_ICONS: Record<string, React.ReactNode> = {
  daily_market_summary: <BarChart3 className="w-6 h-6" />,
  weekly_trend_analysis: <TrendingUp className="w-6 h-6" />,
  market_comparison: <MapPin className="w-6 h-6" />,
  arbitrage_opportunities: <Scale className="w-6 h-6" />,
  inflation_impact: <TrendingDown className="w-6 h-6" />,
  supply_chain_intelligence: <Truck className="w-6 h-6" />,
  custom_analytics: <Settings className="w-6 h-6" />,
};

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-5 h-5" />,
  excel: <FileSpreadsheet className="w-5 h-5" />,
  html: <FileCode className="w-5 h-5" />,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Static report types (always available, tier-checked on generation)
const STATIC_REPORT_TYPES: ReportType[] = [
  {
    id: "daily_market_summary",
    name: "Daily Market Summary",
    description: "Comprehensive daily overview of price movements across all tracked commodities",
    frequency: "Daily",
    estimatedPages: 5,
    sections: ["Executive Summary", "Top Gainers", "Top Losers", "Market Activity", "Category Breakdown"],
    icon: "📊",
    minTier: "BUSINESS",
  },
  {
    id: "weekly_trend_analysis",
    name: "Weekly Trend Analysis",
    description: "Week-over-week price trends with statistical analysis and forecasts",
    frequency: "Weekly",
    estimatedPages: 12,
    sections: ["Weekly Summary", "Price Trends", "Volatility Analysis", "Forecasts"],
    icon: "📈",
    minTier: "BUSINESS",
  },
  {
    id: "market_comparison",
    name: "Market Comparison Report",
    description: "Side-by-side comparison of prices across different markets",
    frequency: "On-demand",
    estimatedPages: 8,
    sections: ["Comparison Summary", "Price Tables", "Cheapest Markets", "Recommendations"],
    icon: "🏪",
    minTier: "BUSINESS",
  },
  {
    id: "arbitrage_opportunities",
    name: "Arbitrage Opportunities",
    description: "Identifies profitable price differences between markets",
    frequency: "Daily",
    estimatedPages: 10,
    sections: ["Top Opportunities", "Profit Analysis", "Risk Assessment", "Market Pairs"],
    icon: "💰",
    minTier: "CORPORATE",
  },
  {
    id: "inflation_impact",
    name: "Inflation Impact Report",
    description: "Tracks commodity price inflation with NBS data correlation",
    frequency: "Monthly",
    estimatedPages: 15,
    sections: ["Overall Inflation", "Category Rates", "Item Analysis", "NBS Comparison"],
    icon: "📉",
    minTier: "CORPORATE",
  },
  {
    id: "supply_chain_intelligence",
    name: "Supply Chain Intelligence",
    description: "Analyzes supply patterns, shortages, and logistics data",
    frequency: "Weekly",
    estimatedPages: 20,
    sections: ["Supply Overview", "Shortage Warnings", "Trend Analysis", "Recommendations"],
    icon: "🚚",
    minTier: "ENTERPRISE",
  },
  {
    id: "custom_analytics",
    name: "Custom Analytics Report",
    description: "Fully customizable report with your selected metrics and timeframes",
    frequency: "On-demand",
    estimatedPages: 25,
    sections: ["Custom Metrics", "Filtered Data", "Analysis", "Export"],
    icon: "⚙️",
    minTier: "ENTERPRISE",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "scheduled">("generate");
  const [reportTypes, setReportTypes] = useState<ReportType[]>(STATIC_REPORT_TYPES);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [reportsRemaining, setReportsRemaining] = useState(10);
  const [canSchedule, setCanSchedule] = useState(false);
  const [userTier, setUserTier] = useState("FREE");
  const [error, setError] = useState<string | null>(null);

  // Generation form state
  const [selectedReportType, setSelectedReportType] = useState<string>("daily_market_summary");
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "excel" | "html">("pdf");
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Schedule form state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: "daily_market_summary",
    format: "pdf",
    frequency: "weekly",
    deliveryMethod: "email",
    email: "",
    phone: "",
    deliveryTime: "09:00",
    deliveryDay: 1, // Monday
  });

  // Preview state
  const [previewReport, setPreviewReport] = useState<GeneratedReport | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Get user tier from session
  useEffect(() => {
    if (session?.user) {
      const user = session.user as any;
      const tier = user.tier || user.subscription_tier || "FREE";
      setUserTier(tier.toUpperCase());
      
      // Check if tier can schedule
      const tierIndex = TIER_HIERARCHY.indexOf(tier.toUpperCase());
      setCanSchedule(tierIndex >= TIER_HIERARCHY.indexOf("CORPORATE"));
      
      // Set reports remaining based on tier
      if (tierIndex >= TIER_HIERARCHY.indexOf("ENTERPRISE")) {
        setReportsRemaining(999);
      } else if (tierIndex >= TIER_HIERARCHY.indexOf("CORPORATE")) {
        setReportsRemaining(50);
      } else if (tierIndex >= TIER_HIERARCHY.indexOf("BUSINESS")) {
        setReportsRemaining(20);
      } else {
        setReportsRemaining(0);
      }
    }
    setLoading(false);
  }, [session]);

  // Check if user has access to a report
  const hasAccess = (minTier: string) => {
    const userTierIndex = TIER_HIERARCHY.indexOf(userTier);
    const minTierIndex = TIER_HIERARCHY.indexOf(minTier);
    return userTierIndex >= minTierIndex;
  };

  // Check if user has minimum BUSINESS tier for any reports
  const hasReportAccess = () => {
    const tierIndex = TIER_HIERARCHY.indexOf(userTier);
    return tierIndex >= TIER_HIERARCHY.indexOf("BUSINESS");
  };

  // ============================================================================
  // GENERATE REPORT - Updated to use new API
  // ============================================================================
  
  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast.error("Please select a report type");
      return;
    }

    const selectedReport = reportTypes.find(r => r.id === selectedReportType);
    if (!selectedReport) {
      toast.error("Invalid report type");
      return;
    }

    if (!hasAccess(selectedReport.minTier)) {
      toast.error(`This report requires ${selectedReport.minTier} tier or higher`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const requestBody: any = {
        reportType: selectedReportType,
        outputFormat: selectedFormat,
      };

      // Add custom date range if applicable
      if (selectedReportType === "custom_analytics" && customDateRange.startDate && customDateRange.endDate) {
        requestBody.parameters = {
          startDate: customDateRange.startDate,
          endDate: customDateRange.endDate,
        };
      }

      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      // Check response type
      const contentType = response.headers.get("Content-Type") || "";

      if (selectedFormat === "html") {
        // HTML format returns JSON for preview
        const data = await response.json();
        setPreviewData(data);
        setShowPreview(true);
        toast.success("Report preview loaded!");
      } else {
        // PDF/Excel returns blob for download
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = `NaijaMarket_${selectedReport.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}`;
        filename += selectedFormat === "pdf" ? ".pdf" : ".xlsx";

        // Try to extract filename from header
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Report downloaded: ${filename}`);
        
        // Update reports remaining
        setReportsRemaining(prev => Math.max(0, prev - 1));

        // Add to history (simplified)
        const newReport: GeneratedReport = {
          id: `RPT_${Date.now()}`,
          type: selectedReportType,
          title: selectedReport.name,
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          format: selectedFormat,
          fileSize: `${(blob.size / 1024).toFixed(1)} KB`,
          downloadUrl: "",
          sections: selectedReport.sections,
          metrics: {
            totalItems: 0,
            totalMarkets: 0,
            priceChanges: { increases: 0, decreases: 0, unchanged: 0 },
            topGainers: [],
            topLosers: [],
            categoryBreakdown: [],
            regionalData: [],
            nfpiIndex: { currentValue: 0, previousValue: 0, changePercent: 0, trend: "stable", basketItems: [] },
          },
        };
        setGeneratedReports(prev => [newReport, ...prev]);
      }
    } catch (err: any) {
      console.error("Report generation error:", err);
      setError(err.message || "Failed to generate report");
      toast.error(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  // Download report
  const handleDownload = async (report: GeneratedReport) => {
    // Re-generate the report for download
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportType: report.type,
          outputFormat: report.format,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      if (report.format === "html") {
        const data = await response.json();
        setPreviewData(data);
        setShowPreview(true);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.title.replace(/\s+/g, "_")}.${report.format === "pdf" ? "pdf" : "xlsx"}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Report downloaded!");
      }
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  };

  // Create schedule
  const handleCreateSchedule = async () => {
    toast.info("Scheduled delivery coming soon! This feature is under development.");
    setShowScheduleModal(false);
  };

  // Toggle schedule active status
  const handleToggleSchedule = async (scheduleId: string, isActive: boolean) => {
    setScheduledReports(prev =>
      prev.map(s => (s.id === scheduleId ? { ...s, isActive: !isActive } : s))
    );
    toast.success(`Schedule ${!isActive ? "activated" : "paused"}`);
  };

  // Delete schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Delete this scheduled report?")) return;
    setScheduledReports(prev => prev.filter(s => s.id !== scheduleId));
    toast.success("Schedule deleted");
  };

  // Format helpers
  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ============================================================================
  // ACCESS DENIED VIEW
  // ============================================================================

  if (!loading && !hasReportAccess()) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-orange-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Access Reports</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Intelligence reports are available from BUSINESS tier and above. Generate professional PDF and Excel reports
            with market insights, price analysis, and actionable recommendations.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-gray-500">Your current tier:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[userTier] || TIER_COLORS.FREE}`}>
              {userTier}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { tier: "BUSINESS", reports: "3 Report Types", price: "₦25,000/mo" },
              { tier: "CORPORATE", reports: "5 Report Types", price: "₦75,000/mo" },
              { tier: "ENTERPRISE", reports: "All 7 Reports", price: "₦150,000/mo" },
            ].map((plan) => (
              <div
                key={plan.tier}
                className="bg-[#1a1a1a] border border-terminal-border rounded-xl p-4"
              >
                <p className={`font-bold ${TIER_COLORS[plan.tier]?.split(" ")[0] || "text-white"}`}>{plan.tier}</p>
                <p className="text-sm text-gray-400 mt-1">{plan.reports}</p>
                <p className="text-lg font-semibold text-white mt-2">{plan.price}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/dashboard/subscription")}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-xl transition-all"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading || status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-naija-green animate-spin" />
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Intelligence Reports</h1>
          <p className="text-gray-500">Generate professional market intelligence reports</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Reports Remaining</p>
            <p className="text-xl font-bold text-naija-gold">{reportsRemaining === 999 ? "Unlimited" : reportsRemaining}</p>
          </div>
          <div className={`px-4 py-2 rounded-lg ${TIER_COLORS[userTier] || TIER_COLORS.FREE}`}>
            <span className="font-medium">{userTier}</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-terminal-border">
        {[
          { id: "generate", label: "Generate Report", icon: <Plus className="w-4 h-4" /> },
          { id: "history", label: "Report History", icon: <Clock className="w-4 h-4" /> },
          { id: "scheduled", label: "Scheduled", icon: <Bell className="w-4 h-4" />, badge: scheduledReports.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-naija-green text-naija-green"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-2 py-0.5 bg-naija-green/20 text-naija-green text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Type Selection */}
          <div className="lg:col-span-2">
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select Report Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportTypes.map((type) => {
                  const isAccessible = hasAccess(type.minTier);
                  const isSelected = selectedReportType === type.id;
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => isAccessible && setSelectedReportType(type.id)}
                      disabled={!isAccessible}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                        isSelected
                          ? "border-naija-green bg-naija-green/10"
                          : isAccessible
                            ? "border-terminal-border hover:border-gray-600 bg-[#1a1a1a]"
                            : "border-terminal-border bg-[#0d0d0d] opacity-60 cursor-not-allowed"
                      }`}
                    >
                      {/* Lock icon for inaccessible */}
                      {!isAccessible && (
                        <div className="absolute top-3 right-3">
                          <Lock className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected ? "bg-naija-green/20 text-naija-green" : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {REPORT_ICONS[type.id] || <FileText className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{type.name}</h3>
                          <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-naija-green">
                              {type.frequency}
                            </span>
                            <span className="text-xs text-gray-600">
                              ~{type.estimatedPages} pages
                            </span>
                            {!isAccessible && (
                              <span className="text-xs text-yellow-500">
                                Requires {type.minTier}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-naija-green" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range */}
              {selectedReportType === "custom_analytics" && (
                <div className="mt-6 p-4 bg-[#1a1a1a] rounded-xl">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Select Date Range</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={customDateRange.startDate}
                        onChange={(e) =>
                          setCustomDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                      <input
                        type="date"
                        value={customDateRange.endDate}
                        onChange={(e) =>
                          setCustomDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Format & Generate */}
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Output Format</h2>
              <div className="space-y-3">
                {(["pdf", "excel", "html"] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      selectedFormat === format
                        ? "border-naija-green bg-naija-green/10"
                        : "border-terminal-border hover:border-gray-600"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        selectedFormat === format ? "bg-naija-green/20 text-naija-green" : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {FORMAT_ICONS[format]}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white">{format.toUpperCase()}</p>
                      <p className="text-xs text-gray-500">
                        {format === "pdf"
                          ? "Professional document"
                          : format === "excel"
                          ? "Spreadsheet with data"
                          : "Web preview"}
                      </p>
                    </div>
                    {selectedFormat === format && <Check className="w-5 h-5 text-naija-green ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
              <button
                onClick={handleGenerateReport}
                disabled={generating || !selectedReportType || (reportsRemaining <= 0 && reportsRemaining !== 999)}
                className="w-full py-4 bg-gradient-to-r from-naija-green to-emerald-600 hover:from-naija-green/90 hover:to-emerald-600/90 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Generate Report
                  </>
                )}
              </button>
              {reportsRemaining <= 0 && reportsRemaining !== 999 && (
                <p className="text-center text-orange-400 text-sm mt-3">
                  Monthly limit reached.{" "}
                  <button onClick={() => router.push("/dashboard/subscription")} className="underline">
                    Upgrade
                  </button>
                </p>
              )}
            </div>

            {/* Schedule Option */}
            {canSchedule && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-600 hover:border-naija-green text-gray-400 hover:text-naija-green rounded-xl transition-all"
              >
                <Calendar className="w-5 h-5" />
                Schedule Delivery
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {generatedReports.length === 0 ? (
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-12 text-center">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Reports Yet</h3>
              <p className="text-gray-500 mb-4">Generate your first report to see it here</p>
              <button
                onClick={() => setActiveTab("generate")}
                className="px-6 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
              >
                Generate Report
              </button>
            </div>
          ) : (
            generatedReports.map((report) => (
              <div
                key={report.id}
                className="bg-terminal-surface border border-terminal-border rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1a1a1a] rounded-lg">
                    {FORMAT_ICONS[report.format] || <FileText className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{report.title}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(report.generatedAt)} • {report.fileSize} • {report.format.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(report)}
                    className="flex items-center gap-2 px-4 py-2 bg-naija-green/20 hover:bg-naija-green/30 text-naija-green rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "scheduled" && (
        <div className="space-y-4">
          {!canSchedule ? (
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-12 text-center">
              <Crown className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Scheduled Reports</h3>
              <p className="text-gray-500 mb-4">
                Scheduled delivery is available for CORPORATE tier and above
              </p>
              <button
                onClick={() => router.push("/dashboard/subscription")}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Upgrade to Corporate
              </button>
            </div>
          ) : scheduledReports.length === 0 ? (
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Scheduled Reports</h3>
              <p className="text-gray-500 mb-4">Set up automated report delivery</p>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-6 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
              >
                Create Schedule
              </button>
            </div>
          ) : (
            scheduledReports.map((schedule) => (
              <div
                key={schedule.id}
                className={`bg-terminal-surface border rounded-xl p-4 flex items-center justify-between ${
                  schedule.isActive ? "border-naija-green/30" : "border-terminal-border"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${schedule.isActive ? "bg-naija-green/20" : "bg-gray-800"}`}>
                    {REPORT_ICONS[schedule.reportType] || <FileText className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">
                      {reportTypes.find(r => r.id === schedule.reportType)?.name || schedule.reportType}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {schedule.frequency} • {schedule.format.toUpperCase()} • {schedule.deliveryMethod}
                    </p>
                    <p className="text-xs text-gray-600">
                      Next: {schedule.nextDelivery ? formatDate(schedule.nextDelivery) : "Not scheduled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSchedule(schedule.id, schedule.isActive)}
                    className={`p-2 rounded-lg transition-colors ${
                      schedule.isActive
                        ? "bg-naija-green/20 text-naija-green hover:bg-naija-green/30"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {schedule.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.id)}
                    className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-terminal-border">
              <h2 className="text-lg font-bold text-white">Schedule Report Delivery</h2>
              <p className="text-sm text-gray-500">Receive reports automatically via email or WhatsApp</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Report Type */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Report Type</label>
                <select
                  value={scheduleForm.reportType}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, reportType: e.target.value }))}
                  className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                >
                  {reportTypes.filter(r => hasAccess(r.minTier)).map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {["daily", "weekly", "monthly"].map(freq => (
                    <button
                      key={freq}
                      onClick={() => setScheduleForm(prev => ({ ...prev, frequency: freq }))}
                      className={`px-4 py-2 rounded-lg border capitalize transition-colors ${
                        scheduleForm.frequency === freq
                          ? "border-naija-green bg-naija-green/10 text-naija-green"
                          : "border-terminal-border text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Method */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Delivery Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
                    { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" /> },
                    { id: "both", label: "Both", icon: <Send className="w-4 h-4" /> },
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setScheduleForm(prev => ({ ...prev, deliveryMethod: method.id }))}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        scheduleForm.deliveryMethod === method.id
                          ? "border-naija-green bg-naija-green/10 text-naija-green"
                          : "border-terminal-border text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {method.icon}
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email */}
              {(scheduleForm.deliveryMethod === "email" || scheduleForm.deliveryMethod === "both") && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Email Address</label>
                  <input
                    type="email"
                    value={scheduleForm.email}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
              )}

              {/* Phone */}
              {(scheduleForm.deliveryMethod === "whatsapp" || scheduleForm.deliveryMethod === "both") && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={scheduleForm.phone}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+234 XXX XXX XXXX"
                    className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder:text-gray-600"
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-terminal-border flex justify-end gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchedule}
                className="px-6 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-terminal-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{previewData.reportName || "Report Preview"}</h2>
                <p className="text-sm text-gray-500">Generated {previewData.generatedAt ? formatDate(previewData.generatedAt) : "now"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedFormat("pdf");
                    handleGenerateReport();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-[#0a0a0a] rounded-lg p-4">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-auto">
                  {JSON.stringify(previewData.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

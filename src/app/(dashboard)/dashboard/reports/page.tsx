// ============================================================================
// src/app/(dashboard)/dashboard/reports/page.tsx
// NaijaMarket Intel - Market Intelligence Reports Dashboard
// Version: 1.0.0
// Bloomberg Equivalent: NI <GO>
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  Settings,
  Plus,
  Trash2,
  Play,
  Pause,
  Eye,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  Bell,
  Send,
  Building2,
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
  CORPORATE: "text-purple-400 bg-purple-900/30",
  ENTERPRISE: "text-emerald-400 bg-emerald-900/30",
};

const REPORT_ICONS: Record<string, React.ReactNode> = {
  weekly: <BarChart3 className="w-6 h-6" />,
  monthly: <TrendingUp className="w-6 h-6" />,
  regional: <MapPin className="w-6 h-6" />,
  inflation: <Scale className="w-6 h-6" />,
  custom: <Calendar className="w-6 h-6" />,
};

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-5 h-5" />,
  excel: <FileSpreadsheet className="w-5 h-5" />,
  html: <FileCode className="w-5 h-5" />,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [reportsRemaining, setReportsRemaining] = useState(10);
  const [canSchedule, setCanSchedule] = useState(false);
  const [userTier, setUserTier] = useState("FREE");
  const [error, setError] = useState<string | null>(null);

  // Generation form state
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "excel" | "html">("pdf");
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Schedule form state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: "weekly",
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
  const [showPreview, setShowPreview] = useState(false);

  // Get user tier from session
  useEffect(() => {
    if (session?.user) {
      const tier = (
        (session.user as { tier?: string })?.tier ||
        (session.user as { subscriptionTier?: string })?.subscriptionTier ||
        "FREE"
      ).toString().toUpperCase();
      setUserTier(tier);
    }
  }, [session]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch report types and user data
      const response = await fetch("/api/reports?action=types");
      const data = await response.json();

      if (data.success) {
        setReportTypes(data.reportTypes || []);
        setReportsRemaining(data.reportsRemaining || 0);
        setCanSchedule(data.canSchedule || false);
        if (data.reportTypes?.length > 0) {
          setSelectedReportType(data.reportTypes[0].id);
        }
      } else if (response.status === 403) {
        setError(data.error || "Reports require BUSINESS tier or higher");
      }

      // Fetch scheduled reports if allowed
      if (canSchedule) {
        const scheduleResponse = await fetch("/api/reports/schedule");
        const scheduleData = await scheduleResponse.json();
        if (scheduleData.success) {
          setScheduledReports(scheduleData.schedules || []);
        }
      }
    } catch {
      setError("Failed to load reports data");
    } finally {
      setLoading(false);
    }
  }, [canSchedule]);

  useEffect(() => {
    if (status !== "loading") {
      fetchData();
    }
  }, [status, fetchData]);

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedReportType) return;

    setGenerating(true);
    setError(null);

    try {
      const body: {
        reportType: string;
        format: string;
        dateRange?: { startDate: string; endDate: string };
      } = {
        reportType: selectedReportType,
        format: selectedFormat,
      };

      if (selectedReportType === "custom" && customDateRange.startDate && customDateRange.endDate) {
        body.dateRange = customDateRange;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedReports(prev => [data.report, ...prev]);
        setReportsRemaining(data.reportsRemaining);
        setPreviewReport(data.report);
        setShowPreview(true);
        setActiveTab("history");
      } else {
        setError(data.error || "Failed to generate report");
      }
    } catch {
      setError("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  // Download report
  const handleDownload = async (report: GeneratedReport) => {
    const url = `/api/reports/${report.id}?format=${report.format}`;
    
    if (report.format === "html") {
      window.open(url, "_blank");
    } else if (report.format === "pdf") {
      // For PDF, fetch the HTML and generate client-side
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.pdfData?.htmlContent) {
        // Open HTML in new window for printing as PDF
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(data.pdfData.htmlContent);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      }
    } else {
      // CSV/Excel - direct download
      window.location.href = url;
    }
  };

  // Create schedule
  const handleCreateSchedule = async () => {
    try {
      const response = await fetch("/api/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleForm),
      });

      const data = await response.json();

      if (data.success) {
        setScheduledReports(prev => [...prev, data.schedule]);
        setShowScheduleModal(false);
        setScheduleForm({
          reportType: "weekly",
          format: "pdf",
          frequency: "weekly",
          deliveryMethod: "email",
          email: "",
          phone: "",
          deliveryTime: "09:00",
          deliveryDay: 1,
        });
      } else {
        setError(data.error || "Failed to create schedule");
      }
    } catch {
      setError("Failed to create schedule");
    }
  };

  // Toggle schedule active status
  const handleToggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/reports/schedule?id=${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const data = await response.json();

      if (data.success) {
        setScheduledReports(prev =>
          prev.map(s => (s.id === scheduleId ? { ...s, isActive: !isActive } : s))
        );
      }
    } catch {
      setError("Failed to update schedule");
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Delete this scheduled report?")) return;

    try {
      const response = await fetch(`/api/reports/schedule?id=${scheduleId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setScheduledReports(prev => prev.filter(s => s.id !== scheduleId));
      }
    } catch {
      setError("Failed to delete schedule");
    }
  };

  // Format helpers
  const formatCurrency = (amount: number): string => {
    return `₦${amount.toLocaleString("en-NG")}`;
  };

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

  if (!loading && error?.includes("BUSINESS")) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-orange-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Market Intelligence Reports</h1>
          <p className="text-gray-400 mb-6">
            Generate professional PDF, Excel, and HTML reports with comprehensive market analysis
          </p>

          <div className="bg-[#141414] rounded-xl p-6 mb-6 text-left">
            <h3 className="text-lg font-semibold text-white mb-4">Report Features Include:</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                "Weekly Market Summary",
                "Monthly Commodity Analysis",
                "Regional Price Reports",
                "NBS Inflation Comparison",
                "NFPI Index Tracking",
                "Top Movers Analysis",
                "Category Breakdown",
                "Scheduled Delivery",
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="text-center">
              <p className="text-gray-500 text-sm">Your Plan</p>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[userTier]}`}>
                {userTier}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600" />
            <div className="text-center">
              <p className="text-gray-500 text-sm">Required</p>
              <span className="px-3 py-1 rounded-full text-sm font-medium text-blue-400 bg-blue-900/30">
                BUSINESS+
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/subscribe")}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all"
          >
            Upgrade to BUSINESS
          </button>
          <p className="text-gray-500 text-sm mt-4">Starting at ₦25,000/month</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-naija-green animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-naija-green" />
            <h1 className="text-2xl font-bold text-white">Market Intelligence Reports</h1>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Bloomberg NI &lt;GO&gt; • Generate professional reports with market insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-gray-500 text-xs">Reports Remaining</p>
            <p className="text-xl font-bold text-naija-green">
              {reportsRemaining === 999 ? "∞" : reportsRemaining}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${TIER_COLORS[userTier]}`}>
            {userTier}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && !error.includes("BUSINESS") && (
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
                {reportTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedReportType(type.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedReportType === type.id
                        ? "border-naija-green bg-naija-green/10"
                        : "border-terminal-border hover:border-gray-600 bg-[#1a1a1a]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedReportType === type.id ? "bg-naija-green/20 text-naija-green" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {REPORT_ICONS[type.id] || <FileText className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{type.name}</h3>
                        <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-600">
                            {type.frequency}
                          </span>
                          <span className="text-xs text-gray-600">
                            ~{type.estimatedPages} pages
                          </span>
                        </div>
                      </div>
                      {selectedReportType === type.id && (
                        <Check className="w-5 h-5 text-naija-green" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              {selectedReportType === "custom" && (
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
                disabled={generating || !selectedReportType || reportsRemaining <= 0}
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
              {reportsRemaining <= 0 && (
                <p className="text-center text-orange-400 text-sm mt-3">
                  Monthly limit reached.{" "}
                  <button onClick={() => router.push("/subscribe")} className="underline">
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
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Reports Generated</h3>
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
                className="bg-terminal-surface border border-terminal-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="p-3 bg-naija-green/10 rounded-lg">
                  {REPORT_ICONS[report.type] || <FileText className="w-6 h-6 text-naija-green" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{report.title}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500">
                      Generated: {formatDate(report.generatedAt)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {report.fileSize}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      report.format === "pdf"
                        ? "bg-red-900/30 text-red-400"
                        : report.format === "excel"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-blue-900/30 text-blue-400"
                    }`}>
                      {report.format.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPreviewReport(report);
                      setShowPreview(true);
                    }}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(report)}
                    className="p-2 bg-naija-green/10 text-naija-green hover:bg-naija-green/20 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
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
            <div className="bg-terminal-surface border border-orange-500/30 rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Scheduled Delivery</h3>
              <p className="text-gray-500 mb-4">
                Automatically receive reports via Email or WhatsApp
              </p>
              <p className="text-gray-400 text-sm mb-4">
                Requires <span className="text-purple-400 font-medium">CORPORATE</span> tier or higher
              </p>
              <button
                onClick={() => router.push("/subscribe")}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Upgrade to CORPORATE
              </button>
            </div>
          ) : scheduledReports.length === 0 ? (
            <div className="bg-terminal-surface border border-terminal-border rounded-xl p-12 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Scheduled Reports</h3>
              <p className="text-gray-500 mb-4">Set up automatic report delivery</p>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-6 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
              >
                Create Schedule
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Schedule
                </button>
              </div>
              {scheduledReports.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`bg-terminal-surface border rounded-xl p-4 ${
                    schedule.isActive ? "border-terminal-border" : "border-gray-700 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${schedule.isActive ? "bg-naija-green/10" : "bg-gray-800"}`}>
                      {REPORT_ICONS[schedule.reportType] || <FileText className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {reportTypes.find((t) => t.id === schedule.reportType)?.name || schedule.reportType}
                        </h3>
                        {!schedule.isActive && (
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">Paused</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {schedule.frequency === "weekly"
                            ? `Every ${DAY_NAMES[schedule.deliveryDay || 0]} at ${schedule.deliveryTime}`
                            : schedule.frequency === "monthly"
                            ? `Day ${schedule.deliveryDay || 1} at ${schedule.deliveryTime}`
                            : `Daily at ${schedule.deliveryTime}`}
                        </span>
                        <span className="flex items-center gap-1">
                          {schedule.deliveryMethod === "email" ? (
                            <Mail className="w-3 h-3" />
                          ) : schedule.deliveryMethod === "whatsapp" ? (
                            <MessageSquare className="w-3 h-3" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {schedule.deliveryMethod}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          schedule.format === "pdf"
                            ? "bg-red-900/30 text-red-400"
                            : schedule.format === "excel"
                            ? "bg-green-900/30 text-green-400"
                            : "bg-blue-900/30 text-blue-400"
                        }`}>
                          {schedule.format.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Next delivery: {formatDate(schedule.nextDelivery)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSchedule(schedule.id, schedule.isActive)}
                        className={`p-2 rounded-lg transition-colors ${
                          schedule.isActive
                            ? "text-yellow-400 hover:bg-yellow-900/20"
                            : "text-emerald-400 hover:bg-emerald-900/20"
                        }`}
                        title={schedule.isActive ? "Pause" : "Resume"}
                      >
                        {schedule.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-terminal-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Schedule Report Delivery</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Report Type */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Report Type</label>
                <select
                  value={scheduleForm.reportType}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, reportType: e.target.value }))}
                  className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                >
                  {reportTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Format</label>
                <div className="flex gap-2">
                  {(["pdf", "excel", "html"] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setScheduleForm((prev) => ({ ...prev, format }))}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                        scheduleForm.format === format
                          ? "border-naija-green bg-naija-green/10 text-naija-green"
                          : "border-terminal-border text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Frequency</label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Day Selection */}
              {scheduleForm.frequency === "weekly" && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Day of Week</label>
                  <select
                    value={scheduleForm.deliveryDay}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, deliveryDay: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                  >
                    {DAY_NAMES.map((day, idx) => (
                      <option key={idx} value={idx}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scheduleForm.frequency === "monthly" && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Day of Month</label>
                  <select
                    value={scheduleForm.deliveryDay}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, deliveryDay: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Delivery Time (WAT)</label>
                <input
                  type="time"
                  value={scheduleForm.deliveryTime}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, deliveryTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white"
                />
              </div>

              {/* Delivery Method */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Delivery Method</label>
                <div className="flex gap-2">
                  {[
                    { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
                    { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" /> },
                    { id: "both", label: "Both", icon: <Send className="w-4 h-4" /> },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setScheduleForm((prev) => ({ ...prev, deliveryMethod: method.id }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
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
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, email: e.target.value }))}
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
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, phone: e.target.value }))}
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

      {/* Preview Modal */}
      {showPreview && previewReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-terminal-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{previewReport.title}</h2>
                <p className="text-sm text-gray-500">Generated {formatDate(previewReport.generatedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewReport)}
                  className="flex items-center gap-2 px-4 py-2 bg-naija-green hover:bg-naija-green/90 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download {previewReport.format.toUpperCase()}
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
              {/* Preview Content */}
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[#1a1a1a] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-naija-gold">{previewReport.metrics.totalItems}</p>
                    <p className="text-sm text-gray-500">Items Tracked</p>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-naija-gold">{previewReport.metrics.totalMarkets}</p>
                    <p className="text-sm text-gray-500">Markets</p>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-red-400">{previewReport.metrics.priceChanges.increases}</p>
                    <p className="text-sm text-gray-500">Price Increases</p>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">{previewReport.metrics.priceChanges.decreases}</p>
                    <p className="text-sm text-gray-500">Price Decreases</p>
                  </div>
                </div>

                {/* NFPI & NBS */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">NFPI Index</h3>
                    <div className="flex items-end gap-4">
                      <p className="text-4xl font-bold text-naija-green">
                        {previewReport.metrics.nfpiIndex.currentValue.toFixed(1)}
                      </p>
                      <p className={`text-lg font-medium ${
                        previewReport.metrics.nfpiIndex.changePercent >= 0 ? "text-red-400" : "text-emerald-400"
                      }`}>
                        {formatPercent(previewReport.metrics.nfpiIndex.changePercent)}
                      </p>
                    </div>
                  </div>
                  {previewReport.metrics.nbsComparison && (
                    <div className="bg-[#1a1a1a] rounded-xl p-4">
                      <h3 className="text-sm font-medium text-gray-400 mb-3">vs NBS Official</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-orange-400">
                            {previewReport.metrics.nbsComparison.naijaMarketInflation.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">NaijaMarket</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-400">
                            {previewReport.metrics.nbsComparison.nbsOfficialInflation.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">NBS Official</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Movers */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Top Gainers
                    </h3>
                    <div className="space-y-2">
                      {previewReport.metrics.topGainers.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">{item.item}</p>
                            <p className="text-xs text-gray-500">{item.market}</p>
                          </div>
                          <p className="text-sm font-medium text-red-400">{formatPercent(item.changePercent)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl p-4">
                    <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Top Losers
                    </h3>
                    <div className="space-y-2">
                      {previewReport.metrics.topLosers.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-white">{item.item}</p>
                            <p className="text-xs text-gray-500">{item.market}</p>
                          </div>
                          <p className="text-sm font-medium text-emerald-400">{formatPercent(item.changePercent)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Regional */}
                <div className="bg-[#1a1a1a] rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Regional Breakdown
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {previewReport.metrics.regionalData.map((region, idx) => (
                      <div key={idx} className="bg-terminal-bg rounded-lg p-3">
                        <p className="font-medium text-white text-sm">{region.region}</p>
                        <p className={`text-lg font-bold ${
                          region.avgInflation >= 0 ? "text-red-400" : "text-emerald-400"
                        }`}>
                          {formatPercent(region.avgInflation)}
                        </p>
                        <p className="text-xs text-gray-500">{region.marketCount} markets</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

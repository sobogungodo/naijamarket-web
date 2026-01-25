"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/settings/page.tsx
// NaijaMarket Intel - User Settings Page
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Crown,
  Bell,
  BellRing,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Calendar,
  Newspaper,
  Settings2,
  Palette,
  Globe,
  Clock,
  DollarSign,
  Shield,
  Key,
  Smartphone,
  LogOut,
  Trash2,
  Download,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Lock,
  Unlock,
  Activity,
  Database,
  UserX,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  Edit3,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    avatar: string | null;
  };
  subscription: {
    tier: string;
    status: string;
    expiresAt: string | null;
    features: string[];
  };
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    whatsappAlerts: boolean;
    priceDropAlerts: boolean;
    priceRiseAlerts: boolean;
    weeklyDigest: boolean;
    monthlyReport: boolean;
    marketNews: boolean;
    systemUpdates: boolean;
  };
  priceAlerts: {
    enabled: boolean;
    threshold: number;
    frequency: "instant" | "hourly" | "daily";
    quietHoursStart: string;
    quietHoursEnd: string;
    maxAlertsPerDay: number;
  };
  preferences: {
    theme: "dark" | "light" | "system";
    language: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
    defaultMarket: string | null;
    defaultCategory: string | null;
    defaultState: string | null;
  };
  dataPrivacy: {
    shareAnonymousData: boolean;
    allowMarketingEmails: boolean;
    showProfilePublicly: boolean;
    exportFormat: "csv" | "xlsx" | "json";
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string | null;
    activeSessions: number;
  };
}

type SettingsSection = 
  | "profile" 
  | "subscription" 
  | "notifications" 
  | "priceAlerts" 
  | "preferences" 
  | "dataPrivacy" 
  | "security";

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

const TIER_COLORS: Record<string, string> = {
  FREE: "text-gray-400 bg-gray-800",
  SILVER: "text-slate-300 bg-slate-700",
  GOLD: "text-yellow-400 bg-yellow-900/50",
  BUSINESS: "text-blue-400 bg-blue-900/50",
  CORPORATE: "text-purple-400 bg-purple-900/50",
  ENTERPRISE: "text-emerald-400 bg-emerald-900/50",
};

const TIER_PRICES: Record<string, string> = {
  FREE: "₦0/mo",
  SILVER: "₦2,500/mo",
  GOLD: "₦7,500/mo",
  BUSINESS: "₦25,000/mo",
  CORPORATE: "₦75,000/mo",
  ENTERPRISE: "₦150,000/mo",
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Get user tier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = ((session?.user as any)?.tier || 
                   (session?.user as any)?.subscriptionTier || 
                   "FREE").toString().toUpperCase();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/settings");
      const result = await response.json();
      
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSettings();
    }
  }, [status, fetchSettings]);

  // Save settings
  const saveSettings = async (section?: SettingsSection, data?: Partial<UserSettings[keyof UserSettings]>) => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: data || settings?.[section || "profile"] }),
      });

      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
        setHasChanges(false);
        setMessage({ type: "success", text: "Settings saved successfully" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save settings" });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  // Handle setting change
  const updateSetting = <T extends keyof UserSettings>(
    section: T,
    key: keyof UserSettings[T],
    value: UserSettings[T][keyof UserSettings[T]]
  ) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  // Change password
  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (passwords.new.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "changePassword",
          data: {
            currentPassword: passwords.current,
            newPassword: passwords.new,
            confirmPassword: passwords.confirm,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: "success", text: "Password changed successfully" });
        setShowPasswordForm(false);
        setPasswords({ current: "", new: "", confirm: "" });
        fetchSettings();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to change password" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setSaving(false);
    }
  };

  // Toggle 2FA
  const toggle2FA = async () => {
    try {
      setSaving(true);
      const action = settings?.security.twoFactorEnabled ? "disable2FA" : "enable2FA";
      
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: "success", text: result.message });
        fetchSettings();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update 2FA settings" });
    } finally {
      setSaving(false);
    }
  };

  // Export data
  const handleExportData = async () => {
    try {
      setMessage({ type: "success", text: "Preparing data export..." });
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportData",
          data: { format: settings?.dataPrivacy.exportFormat },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: "success", text: "Data export ready! Check your email." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to export data" });
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE MY ACCOUNT") {
      setMessage({ type: "error", text: "Please type 'DELETE MY ACCOUNT' to confirm" });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteAccount",
          data: { confirmation: deleteConfirmText },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: "success", text: "Account deletion scheduled. Logging out..." });
        setTimeout(() => signOut({ callbackUrl: "/" }), 2000);
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete account" });
    } finally {
      setSaving(false);
    }
  };

  // Logout all sessions
  const handleLogoutAllSessions = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logoutAllSessions" }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: "success", text: result.message });
        fetchSettings();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to logout sessions" });
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "subscription" as const, label: "Subscription", icon: Crown },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "priceAlerts" as const, label: "Price Alerts", icon: Activity },
    { id: "preferences" as const, label: "Preferences", icon: Settings2 },
    { id: "dataPrivacy" as const, label: "Data & Privacy", icon: Database },
    { id: "security" as const, label: "Security", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings2 className="w-6 h-6 text-emerald-400" />
                Settings
              </h1>
              <p className="text-gray-400 text-sm mt-1">Manage your account and preferences</p>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="text-yellow-400 text-sm flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}
              <button
                onClick={() => saveSettings(activeSection)}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg flex items-center gap-2 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === "success" ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Menu */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-2 sticky top-24">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                    activeSection === item.id ? "rotate-90" : ""
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {/* Profile Section */}
            {activeSection === "profile" && settings && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  Profile Information
                </h2>
                
                {/* Avatar */}
                <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-800">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-3xl font-bold">
                      {settings.profile.firstName?.[0] || settings.profile.email?.[0]?.toUpperCase() || "U"}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-emerald-600 rounded-full hover:bg-emerald-700">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {settings.profile.firstName} {settings.profile.lastName}
                    </h3>
                    <p className="text-gray-400">{settings.profile.email}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-2 ${TIER_COLORS[userTier]}`}>
                      <Crown className="w-3 h-3" />
                      {userTier}
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={settings.profile.firstName}
                        onChange={(e) => updateSetting("profile", "firstName", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="Enter first name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={settings.profile.lastName}
                        onChange={(e) => updateSetting("profile", "lastName", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        value={settings.profile.email}
                        onChange={(e) => updateSetting("profile", "email", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="tel"
                        value={settings.profile.phone}
                        onChange={(e) => updateSetting("profile", "phone", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="+234..."
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Company</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={settings.profile.company}
                        onChange={(e) => updateSetting("profile", "company", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="Enter company name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Role / Title</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={settings.profile.role}
                        onChange={(e) => updateSetting("profile", "role", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="e.g., Procurement Manager"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subscription Section */}
            {activeSection === "subscription" && settings && (
              <div className="space-y-6">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    Your Subscription
                  </h2>
                  
                  {/* Current Plan */}
                  <div className={`p-6 rounded-xl border-2 mb-6 ${
                    userTier === "ENTERPRISE" ? "border-emerald-500 bg-emerald-900/20" :
                    userTier === "CORPORATE" ? "border-purple-500 bg-purple-900/20" :
                    userTier === "BUSINESS" ? "border-blue-500 bg-blue-900/20" :
                    userTier === "GOLD" ? "border-yellow-500 bg-yellow-900/20" :
                    userTier === "SILVER" ? "border-slate-400 bg-slate-900/20" :
                    "border-gray-600 bg-gray-900/20"
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Crown className={`w-6 h-6 ${
                            userTier === "ENTERPRISE" ? "text-emerald-400" :
                            userTier === "CORPORATE" ? "text-purple-400" :
                            userTier === "BUSINESS" ? "text-blue-400" :
                            userTier === "GOLD" ? "text-yellow-400" :
                            userTier === "SILVER" ? "text-slate-300" :
                            "text-gray-400"
                          }`} />
                          <span className="text-2xl font-bold">{userTier}</span>
                        </div>
                        <p className="text-gray-400 mt-1">{TIER_PRICES[userTier]}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          settings.subscription.status === "active" 
                            ? "bg-emerald-900/50 text-emerald-400" 
                            : "bg-red-900/50 text-red-400"
                        }`}>
                          {settings.subscription.status === "active" ? "Active" : "Inactive"}
                        </span>
                        {settings.subscription.expiresAt && (
                          <p className="text-sm text-gray-500 mt-2">
                            Renews: {new Date(settings.subscription.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-4">
                      <p className="text-sm text-gray-400 mb-3">Your features:</p>
                      <div className="grid md:grid-cols-2 gap-2">
                        {settings.subscription.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Options */}
                  {userTier !== "ENTERPRISE" && (
                    <div>
                      <h3 className="font-semibold mb-4">Upgrade your plan</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {Object.entries(TIER_PRICES).filter(([tier]) => {
                          const tiers = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"];
                          return tiers.indexOf(tier) > tiers.indexOf(userTier);
                        }).slice(0, 2).map(([tier, price]) => (
                          <button
                            key={tier}
                            onClick={() => router.push(`/subscribe?tier=${tier.toLowerCase()}`)}
                            className={`p-4 rounded-xl border text-left hover:scale-[1.02] transition-transform ${
                              tier === "ENTERPRISE" ? "border-emerald-500/50 hover:border-emerald-500" :
                              tier === "CORPORATE" ? "border-purple-500/50 hover:border-purple-500" :
                              tier === "BUSINESS" ? "border-blue-500/50 hover:border-blue-500" :
                              tier === "GOLD" ? "border-yellow-500/50 hover:border-yellow-500" :
                              "border-gray-600 hover:border-gray-500"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{tier}</span>
                              <span className="text-emerald-400">{price}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Click to upgrade →</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === "notifications" && settings && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  Notification Preferences
                </h2>
                
                <div className="space-y-6">
                  {/* Delivery Methods */}
                  <div>
                    <h3 className="font-semibold mb-4 text-gray-300">Delivery Methods</h3>
                    <div className="space-y-4">
                      <ToggleSwitch
                        label="Email Alerts"
                        description="Receive notifications via email"
                        icon={<Mail className="w-5 h-5" />}
                        checked={settings.notifications.emailAlerts}
                        onChange={(v) => updateSetting("notifications", "emailAlerts", v)}
                      />
                      <ToggleSwitch
                        label="SMS Alerts"
                        description="Receive notifications via SMS (GOLD+ only)"
                        icon={<Phone className="w-5 h-5" />}
                        checked={settings.notifications.smsAlerts}
                        onChange={(v) => updateSetting("notifications", "smsAlerts", v)}
                        disabled={!["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"].includes(userTier)}
                      />
                      <ToggleSwitch
                        label="WhatsApp Alerts"
                        description="Receive notifications via WhatsApp (GOLD+ only)"
                        icon={<MessageSquare className="w-5 h-5" />}
                        checked={settings.notifications.whatsappAlerts}
                        onChange={(v) => updateSetting("notifications", "whatsappAlerts", v)}
                        disabled={!["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"].includes(userTier)}
                      />
                    </div>
                  </div>

                  {/* Alert Types */}
                  <div className="border-t border-gray-800 pt-6">
                    <h3 className="font-semibold mb-4 text-gray-300">Alert Types</h3>
                    <div className="space-y-4">
                      <ToggleSwitch
                        label="Price Drop Alerts"
                        description="Get notified when prices decrease"
                        icon={<TrendingDown className="w-5 h-5 text-emerald-400" />}
                        checked={settings.notifications.priceDropAlerts}
                        onChange={(v) => updateSetting("notifications", "priceDropAlerts", v)}
                      />
                      <ToggleSwitch
                        label="Price Rise Alerts"
                        description="Get notified when prices increase"
                        icon={<TrendingUp className="w-5 h-5 text-red-400" />}
                        checked={settings.notifications.priceRiseAlerts}
                        onChange={(v) => updateSetting("notifications", "priceRiseAlerts", v)}
                      />
                      <ToggleSwitch
                        label="Weekly Digest"
                        description="Receive a weekly summary of market trends"
                        icon={<Calendar className="w-5 h-5" />}
                        checked={settings.notifications.weeklyDigest}
                        onChange={(v) => updateSetting("notifications", "weeklyDigest", v)}
                      />
                      <ToggleSwitch
                        label="Monthly Report"
                        description="Detailed monthly analysis report"
                        icon={<FileSpreadsheet className="w-5 h-5" />}
                        checked={settings.notifications.monthlyReport}
                        onChange={(v) => updateSetting("notifications", "monthlyReport", v)}
                      />
                      <ToggleSwitch
                        label="Market News"
                        description="Breaking news affecting commodity prices"
                        icon={<Newspaper className="w-5 h-5" />}
                        checked={settings.notifications.marketNews}
                        onChange={(v) => updateSetting("notifications", "marketNews", v)}
                      />
                      <ToggleSwitch
                        label="System Updates"
                        description="Platform updates and new features"
                        icon={<Settings2 className="w-5 h-5" />}
                        checked={settings.notifications.systemUpdates}
                        onChange={(v) => updateSetting("notifications", "systemUpdates", v)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Price Alerts Section */}
            {activeSection === "priceAlerts" && settings && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Price Alert Settings
                </h2>
                
                <div className="space-y-6">
                  <ToggleSwitch
                    label="Enable Price Alerts"
                    description="Receive alerts when prices change significantly"
                    icon={<BellRing className="w-5 h-5" />}
                    checked={settings.priceAlerts.enabled}
                    onChange={(v) => updateSetting("priceAlerts", "enabled", v)}
                  />

                  {settings.priceAlerts.enabled && (
                    <>
                      {/* Threshold */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Alert Threshold (% change)
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="1"
                            max="20"
                            value={settings.priceAlerts.threshold}
                            onChange={(e) => updateSetting("priceAlerts", "threshold", parseInt(e.target.value))}
                            className="flex-1 accent-emerald-500"
                          />
                          <span className="text-lg font-bold text-emerald-400 w-16 text-right">
                            {settings.priceAlerts.threshold}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          You&apos;ll be alerted when prices change by this amount or more
                        </p>
                      </div>

                      {/* Frequency */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Alert Frequency</label>
                        <div className="grid grid-cols-3 gap-3">
                          {(["instant", "hourly", "daily"] as const).map((freq) => (
                            <button
                              key={freq}
                              onClick={() => updateSetting("priceAlerts", "frequency", freq)}
                              className={`p-3 rounded-lg border text-center transition-colors ${
                                settings.priceAlerts.frequency === freq
                                  ? "border-emerald-500 bg-emerald-900/30 text-emerald-400"
                                  : "border-gray-700 hover:border-gray-600"
                              }`}
                            >
                              <span className="capitalize">{freq}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quiet Hours */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Quiet Hours (No alerts)</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Start</label>
                            <input
                              type="time"
                              value={settings.priceAlerts.quietHoursStart}
                              onChange={(e) => updateSetting("priceAlerts", "quietHoursStart", e.target.value)}
                              className="w-full px-4 py-2 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <span className="text-gray-500 mt-5">to</span>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">End</label>
                            <input
                              type="time"
                              value={settings.priceAlerts.quietHoursEnd}
                              onChange={(e) => updateSetting("priceAlerts", "quietHoursEnd", e.target.value)}
                              className="w-full px-4 py-2 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Max Alerts */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Maximum Alerts Per Day
                        </label>
                        <select
                          value={settings.priceAlerts.maxAlertsPerDay}
                          onChange={(e) => updateSetting("priceAlerts", "maxAlertsPerDay", parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        >
                          <option value={5}>5 alerts</option>
                          <option value={10}>10 alerts</option>
                          <option value={20}>20 alerts</option>
                          <option value={50}>50 alerts</option>
                          <option value={100}>Unlimited (100+)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Preferences Section */}
            {activeSection === "preferences" && settings && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-emerald-400" />
                  Display Preferences
                </h2>
                
                <div className="space-y-6">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => updateSetting("preferences", "theme", "dark")}
                        className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                          settings.preferences.theme === "dark"
                            ? "border-emerald-500 bg-emerald-900/30"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <Moon className="w-6 h-6" />
                        <span>Dark</span>
                      </button>
                      <button
                        onClick={() => updateSetting("preferences", "theme", "light")}
                        className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                          settings.preferences.theme === "light"
                            ? "border-emerald-500 bg-emerald-900/30"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <Sun className="w-6 h-6" />
                        <span>Light</span>
                      </button>
                      <button
                        onClick={() => updateSetting("preferences", "theme", "system")}
                        className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-colors ${
                          settings.preferences.theme === "system"
                            ? "border-emerald-500 bg-emerald-900/30"
                            : "border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <Monitor className="w-6 h-6" />
                        <span>System</span>
                      </button>
                    </div>
                  </div>

                  {/* Language & Region */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Language</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <select
                          value={settings.preferences.language}
                          onChange={(e) => updateSetting("preferences", "language", e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        >
                          <option value="en">English</option>
                          <option value="pcm">Pidgin English</option>
                          <option value="yo">Yoruba</option>
                          <option value="ig">Igbo</option>
                          <option value="ha">Hausa</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Timezone</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <select
                          value={settings.preferences.timezone}
                          onChange={(e) => updateSetting("preferences", "timezone", e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Africa/Lagos">West Africa Time (WAT)</option>
                          <option value="UTC">UTC</option>
                          <option value="Europe/London">London (GMT/BST)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Currency & Date Format */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Currency Display</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <select
                          value={settings.preferences.currency}
                          onChange={(e) => updateSetting("preferences", "currency", e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                        >
                          <option value="NGN">Nigerian Naira (₦)</option>
                          <option value="USD">US Dollar ($)</option>
                          <option value="EUR">Euro (€)</option>
                          <option value="GBP">British Pound (£)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Date Format</label>
                      <select
                        value={settings.preferences.dateFormat}
                        onChange={(e) => updateSetting("preferences", "dateFormat", e.target.value)}
                        className="w-full px-4 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (25/01/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (01/25/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-01-25)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Privacy Section */}
            {activeSection === "dataPrivacy" && settings && (
              <div className="space-y-6">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    Data & Privacy
                  </h2>
                  
                  <div className="space-y-4">
                    <ToggleSwitch
                      label="Share Anonymous Usage Data"
                      description="Help us improve by sharing anonymous usage statistics"
                      icon={<Activity className="w-5 h-5" />}
                      checked={settings.dataPrivacy.shareAnonymousData}
                      onChange={(v) => updateSetting("dataPrivacy", "shareAnonymousData", v)}
                    />
                    <ToggleSwitch
                      label="Marketing Emails"
                      description="Receive promotional offers and updates"
                      icon={<Mail className="w-5 h-5" />}
                      checked={settings.dataPrivacy.allowMarketingEmails}
                      onChange={(v) => updateSetting("dataPrivacy", "allowMarketingEmails", v)}
                    />
                    <ToggleSwitch
                      label="Public Profile"
                      description="Allow other users to see your profile"
                      icon={settings.dataPrivacy.showProfilePublicly ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      checked={settings.dataPrivacy.showProfilePublicly}
                      onChange={(v) => updateSetting("dataPrivacy", "showProfilePublicly", v)}
                    />
                  </div>
                </div>

                {/* Export Data */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-emerald-400" />
                    Export Your Data
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Download a copy of all your data including profile, alerts, and activity history.
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <select
                      value={settings.dataPrivacy.exportFormat}
                      onChange={(e) => updateSetting("dataPrivacy", "exportFormat", e.target.value as "csv" | "xlsx" | "json")}
                      className="px-4 py-2 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                    >
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel (XLSX)</option>
                      <option value="json">JSON</option>
                    </select>
                    <button
                      onClick={handleExportData}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Security Section */}
            {activeSection === "security" && settings && (
              <div className="space-y-6">
                {/* Password */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Key className="w-5 h-5 text-emerald-400" />
                    Password
                  </h2>
                  
                  {!showPasswordForm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400">
                          Last changed: {settings.security.lastPasswordChange 
                            ? new Date(settings.security.lastPasswordChange).toLocaleDateString() 
                            : "Never"}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPasswordForm(true)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Change Password
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Current Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type={showPasswords.current ? "text" : "password"}
                            value={passwords.current}
                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                            className="w-full pl-10 pr-12 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">New Password</label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type={showPasswords.new ? "text" : "password"}
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                            className="w-full pl-10 pr-12 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                            placeholder="Enter new password (min 8 characters)"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Confirm New Password</label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type={showPasswords.confirm ? "text" : "password"}
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                            className="w-full pl-10 pr-12 py-3 bg-[#252525] border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleChangePassword}
                          disabled={saving}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Update Password
                        </button>
                        <button
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswords({ current: "", new: "", confirm: "" });
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        settings.security.twoFactorEnabled ? "bg-emerald-900/50" : "bg-gray-800"
                      }`}>
                        <Smartphone className={`w-6 h-6 ${
                          settings.security.twoFactorEnabled ? "text-emerald-400" : "text-gray-500"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">Two-Factor Authentication</h3>
                        <p className="text-sm text-gray-400">
                          {settings.security.twoFactorEnabled 
                            ? "Your account is protected with 2FA" 
                            : "Add an extra layer of security"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggle2FA}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        settings.security.twoFactorEnabled
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : settings.security.twoFactorEnabled ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      {settings.security.twoFactorEnabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-400" />
                      Active Sessions
                    </h3>
                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                      {settings.security.activeSessions} active
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    These are the devices currently logged into your account.
                  </p>
                  <button
                    onClick={handleLogoutAllSessions}
                    className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out all other sessions
                  </button>
                </div>

                {/* Delete Account */}
                <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-6">
                  <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Delete Account
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
                    >
                      <UserX className="w-4 h-4" />
                      Delete My Account
                    </button>
                  ) : (
                    <div className="space-y-4 p-4 bg-red-900/30 rounded-lg">
                      <p className="text-sm text-red-300">
                        Type <strong>DELETE MY ACCOUNT</strong> to confirm:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full px-4 py-2 bg-[#1a1a1a] border border-red-700 rounded-lg focus:outline-none focus:border-red-500"
                        placeholder="Type confirmation text"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={saving || deleteConfirmText !== "DELETE MY ACCOUNT"}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg flex items-center gap-2"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Permanently Delete
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText("");
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOGGLE SWITCH COMPONENT
// ============================================================================

interface ToggleSwitchProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ label, description, icon, checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <div className={`flex items-center justify-between p-4 bg-[#252525] rounded-lg ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${checked ? "bg-emerald-900/50 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>
          {icon}
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`w-14 h-8 rounded-full transition-colors relative ${
          checked ? "bg-emerald-600" : "bg-gray-700"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`} />
      </button>
    </div>
  );
}

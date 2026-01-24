// ============================================================================
// src/app/subscribe/page.tsx
// NaijaMarket Intel - Subscription Upgrade Page
// Version: 2.0.1 - Production Ready (TypeScript Strict) - FIXED
// Date: 2026-01-24
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Loader2,
  Crown,
  Zap,
  Building2,
  Rocket,
  ArrowLeft,
  CreditCard,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface TierData {
  code: string;
  name: string;
  price: number;
  priceFormatted: string;
  billing: string;
  duration: number;
  durationUnit: string;
  billingCycle: string;
  queryLimit: number | null;
  maxMarkets: number;
}

// ============================================================================
// TIER FEATURES
// ============================================================================

const TIER_FEATURES: Record<string, string[]> = {
  FREE: [
    "3 price queries per week",
    "3 markets access",
    "Basic price data",
    "WhatsApp support",
  ],
  SILVER: [
    "5 price queries per day",
    "3 markets access",
    "Price history (7 days)",
    "WhatsApp support",
  ],
  GOLD: [
    "15 price queries per day",
    "3 markets access",
    "Price history (30 days)",
    "Price alerts",
    "Email support",
  ],
  BUSINESS: [
    "30 price queries per day",
    "5 markets access",
    "Price history (90 days)",
    "Price alerts",
    "Priority support",
    "Excel exports",
  ],
  CORPORATE: [
    "Unlimited queries",
    "6 markets access",
    "Full price history",
    "Advanced analytics",
    "API access",
    "Dedicated support",
    "Custom reports",
  ],
  ENTERPRISE: [
    "Unlimited queries",
    "All 226 markets",
    "Full price history",
    "Advanced analytics",
    "Full API access",
    "Dedicated account manager",
    "Custom integrations",
    "SLA guarantee",
  ],
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  FREE: <Zap className="w-6 h-6" />,
  SILVER: <Zap className="w-6 h-6" />,
  GOLD: <Crown className="w-6 h-6" />,
  BUSINESS: <Building2 className="w-6 h-6" />,
  CORPORATE: <Building2 className="w-6 h-6" />,
  ENTERPRISE: <Rocket className="w-6 h-6" />,
};

const DEFAULT_COLORS = { bg: "bg-gray-500/10", border: "border-gray-500/30", text: "text-gray-400" };

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  FREE: { bg: "bg-gray-500/10", border: "border-gray-500/30", text: "text-gray-400" },
  SILVER: { bg: "bg-gray-400/10", border: "border-gray-400/30", text: "text-gray-300" },
  GOLD: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400" },
  BUSINESS: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  CORPORATE: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
  ENTERPRISE: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
};

// Tier order for comparison
const TIER_ORDER = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SubscribePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [tiers, setTiers] = useState<TierData[]>([]);
  const [currentTier, setCurrentTier] = useState<string>("FREE");
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"paystack" | "flutterwave" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tiers and user subscription on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch available tiers
        const tiersResponse = await fetch("/api/subscribe?action=tiers");
        const tiersData = await tiersResponse.json();

        if (tiersData.success && tiersData.tiers) {
          setTiers(tiersData.tiers);
        }

        // Fetch user's current subscription if logged in
        if (session?.user?.phone) {
          const subResponse = await fetch(`/api/subscribe?phone=${encodeURIComponent(session.user.phone)}`);
          const subData = await subResponse.json();

          if (subData.success && subData.subscription) {
            setCurrentTier(subData.subscription.tier || "FREE");
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load subscription data");
      } finally {
        setLoading(false);
      }
    };

    if (sessionStatus !== "loading") {
      fetchData();
    }
  }, [session, sessionStatus]);

  // Handle tier selection
  const handleSelectTier = (tierCode: string) => {
    if (tierCode === currentTier) return;
    if (TIER_ORDER.indexOf(tierCode) <= TIER_ORDER.indexOf(currentTier)) return;
    setSelectedTier(tierCode);
    setSelectedProvider(null);
    setError(null);
  };

  // Handle payment
  const handlePayment = async () => {
    if (!selectedTier || !selectedProvider) {
      setError("Please select a tier and payment provider");
      return;
    }

    if (!session?.user?.phone && !session?.user?.email) {
      setError("Please log in to upgrade your subscription");
      router.push("/login");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier: selectedTier,
          provider: selectedProvider,
          phone: session.user.phone,
          email: session.user.email,
          name: session.user.name,
          consumerId: session.user.id,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        // Redirect to payment provider
        window.location.href = data.paymentUrl;
      } else {
        setError(data.error || "Failed to initialize payment");
        setProcessing(false);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError("An error occurred. Please try again.");
      setProcessing(false);
    }
  };

  // Check if tier is upgradeable
  const isUpgradeable = (tierCode: string) => {
    return TIER_ORDER.indexOf(tierCode) > TIER_ORDER.indexOf(currentTier);
  };

  // Loading state
  if (loading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Upgrade Your Plan</h1>
          <p className="text-gray-400">
            Choose the plan that best fits your needs. Upgrade anytime to unlock more features.
          </p>
        </div>

        {/* Current Plan Badge */}
        <div className="mb-8 p-4 bg-[#111] border border-gray-800 rounded-lg inline-block">
          <span className="text-gray-400 text-sm">Current Plan: </span>
          <span className={`font-semibold ${TIER_COLORS[currentTier]?.text || "text-white"}`}>
            {currentTier}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {tiers.map((tier) => {
            const colors: { bg: string; border: string; text: string } = TIER_COLORS[tier.code] ?? DEFAULT_COLORS;
            const isCurrent = tier.code === currentTier;
            const canUpgrade = isUpgradeable(tier.code);
            const isSelected = selectedTier === tier.code;

            return (
              <div
                key={tier.code}
                className={`relative rounded-xl border-2 p-6 transition-all ${
                  isSelected
                    ? `${colors.border} ${colors.bg} ring-2 ring-offset-2 ring-offset-[#0a0a0a] ${colors.border.replace("border-", "ring-")}`
                    : isCurrent
                    ? `${colors.border} ${colors.bg}`
                    : "border-gray-800 bg-[#111] hover:border-gray-700"
                }`}
              >
                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-emerald-500 text-black text-xs font-semibold rounded-full">
                    Current Plan
                  </div>
                )}

                {/* Tier Icon & Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <span className={colors.text}>{TIER_ICONS[tier.code]}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <p className="text-sm text-gray-400">{tier.billing}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">{tier.priceFormatted}</span>
                  {tier.price > 0 && (
                    <span className="text-gray-400 text-sm">/{tier.billingCycle === "weekly" ? "week" : "month"}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {TIER_FEATURES[tier.code]?.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.text}`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-800 text-gray-500 rounded-lg cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : canUpgrade ? (
                  <button
                    onClick={() => handleSelectTier(tier.code)}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                      isSelected
                        ? "bg-emerald-500 text-black"
                        : "bg-[#1a1a1a] text-white hover:bg-[#222] border border-gray-700"
                    }`}
                  >
                    {isSelected ? "Selected" : `Upgrade to ${tier.name}`}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-800 text-gray-500 rounded-lg cursor-not-allowed"
                  >
                    Not Available
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment Provider Selection */}
        {selectedTier && (
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Select Payment Method</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Paystack */}
              <button
                onClick={() => setSelectedProvider("paystack")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProvider === "paystack"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-gray-700 bg-[#0a0a0a] hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className={`w-6 h-6 ${selectedProvider === "paystack" ? "text-emerald-400" : "text-gray-400"}`} />
                  <div className="text-left">
                    <p className={`font-semibold ${selectedProvider === "paystack" ? "text-emerald-400" : "text-white"}`}>
                      Paystack
                    </p>
                    <p className="text-xs text-gray-400">Cards, Bank Transfer, USSD</p>
                  </div>
                </div>
              </button>

              {/* Flutterwave */}
              <button
                onClick={() => setSelectedProvider("flutterwave")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedProvider === "flutterwave"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-gray-700 bg-[#0a0a0a] hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className={`w-6 h-6 ${selectedProvider === "flutterwave" ? "text-emerald-400" : "text-gray-400"}`} />
                  <div className="text-left">
                    <p className={`font-semibold ${selectedProvider === "flutterwave" ? "text-emerald-400" : "text-white"}`}>
                      Flutterwave
                    </p>
                    <p className="text-xs text-gray-400">Cards, Bank Transfer, Mobile Money</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={!selectedProvider || processing}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
                selectedProvider && !processing
                  ? "bg-emerald-500 hover:bg-emerald-600 text-black"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Pay {tiers.find((t) => t.code === selectedTier)?.priceFormatted || ""}
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500 mt-4">
              You will be redirected to complete payment securely.
            </p>
          </div>
        )}

        {/* Support Note */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            Need help choosing a plan?{" "}
            <a
              href="https://wa.me/2348012345678"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Crown,
  Zap,
  Building2,
  Rocket,
  Check,
  X,
  ArrowLeft,
  Loader2,
  Star,
  TrendingUp,
  Shield,
  Headphones,
  Download,
  BarChart3,
  Globe,
  Users,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// SUBSCRIPTION TIERS CONFIGURATION
// ============================================================================

interface TierFeature {
  name: string;
  included: boolean;
  highlight?: boolean;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  billingCycle: "weekly" | "monthly" | "forever";
  priceDisplay: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  borderColor: string;
  queryLimit: string;
  maxMarkets: number;
  features: TierFeature[];
  popular?: boolean;
  enterprise?: boolean;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    billingCycle: "forever",
    priceDisplay: "₦0",
    description: "Perfect for trying out the service",
    icon: <Star className="w-6 h-6" />,
    color: "text-gray-400",
    bgGradient: "from-gray-800/50 to-gray-900/50",
    borderColor: "border-gray-700",
    queryLimit: "3/week",
    maxMarkets: 3,
    features: [
      { name: "3 price queries per week", included: true },
      { name: "Access to 3 markets", included: true },
      { name: "Basic price information", included: true },
      { name: "Price trends", included: false },
      { name: "Price alerts", included: false },
      { name: "Excel export", included: false },
      { name: "API access", included: false },
      { name: "Dedicated support", included: false },
    ],
  },
  {
    id: "SILVER",
    name: "Silver",
    price: 500,
    billingCycle: "weekly",
    priceDisplay: "₦500/week",
    description: "For regular market shoppers",
    icon: <Shield className="w-6 h-6" />,
    color: "text-slate-300",
    bgGradient: "from-slate-700/50 to-slate-800/50",
    borderColor: "border-slate-600",
    queryLimit: "5/day",
    maxMarkets: 3,
    features: [
      { name: "5 price queries per day", included: true },
      { name: "Access to 3 markets", included: true },
      { name: "Price trends (7 days)", included: true },
      { name: "Favorite markets", included: true, highlight: true },
      { name: "Price alerts", included: false },
      { name: "Excel export", included: false },
      { name: "API access", included: false },
      { name: "Dedicated support", included: false },
    ],
  },
  {
    id: "GOLD",
    name: "Gold",
    price: 2000,
    billingCycle: "monthly",
    priceDisplay: "₦2,000/month",
    description: "For bulk buyers & small businesses",
    icon: <Crown className="w-6 h-6" />,
    color: "text-yellow-400",
    bgGradient: "from-yellow-900/30 to-amber-900/30",
    borderColor: "border-yellow-600/50",
    queryLimit: "15/day",
    maxMarkets: 3,
    features: [
      { name: "15 price queries per day", included: true },
      { name: "Access to 3 markets", included: true },
      { name: "Price trends (30 days)", included: true },
      { name: "Price alerts", included: true, highlight: true },
      { name: "Market comparison", included: true, highlight: true },
      { name: "Export to Excel", included: false },
      { name: "API access", included: false },
      { name: "Dedicated support", included: false },
    ],
    popular: true,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 15000,
    billingCycle: "monthly",
    priceDisplay: "₦15,000/month",
    description: "For restaurants & retailers",
    icon: <Building2 className="w-6 h-6" />,
    color: "text-blue-400",
    bgGradient: "from-blue-900/30 to-indigo-900/30",
    borderColor: "border-blue-600/50",
    queryLimit: "30/day",
    maxMarkets: 5,
    features: [
      { name: "30 price queries per day", included: true },
      { name: "Access to 5 markets", included: true },
      { name: "Price trends (90 days)", included: true },
      { name: "Bulk buyer procurement tool", included: true, highlight: true },
      { name: "Advanced price alerts", included: true },
      { name: "Export to Excel", included: true, highlight: true },
      { name: "API access", included: false },
      { name: "Priority support", included: true },
    ],
  },
  {
    id: "CORPORATE",
    name: "Corporate",
    price: 50000,
    billingCycle: "monthly",
    priceDisplay: "₦50,000/month",
    description: "For procurement teams & enterprises",
    icon: <Zap className="w-6 h-6" />,
    color: "text-emerald-400",
    bgGradient: "from-emerald-900/30 to-teal-900/30",
    borderColor: "border-emerald-500/50",
    queryLimit: "Unlimited",
    maxMarkets: 6,
    features: [
      { name: "Unlimited price queries", included: true, highlight: true },
      { name: "Access to 6 markets", included: true },
      { name: "Full historical data", included: true },
      { name: "Shopping calculator", included: true, highlight: true },
      { name: "Team accounts (3 users)", included: true },
      { name: "Excel & PDF export", included: true },
      { name: "API access (1,000 calls/day)", included: false },
      { name: "Dedicated account manager", included: true, highlight: true },
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 150000,
    billingCycle: "monthly",
    priceDisplay: "₦150,000/month",
    description: "For large organizations & data licensing",
    icon: <Rocket className="w-6 h-6" />,
    color: "text-purple-400",
    bgGradient: "from-purple-900/30 to-pink-900/30",
    borderColor: "border-purple-500/50",
    queryLimit: "Unlimited + API",
    maxMarkets: 8,
    features: [
      { name: "Unlimited everything", included: true, highlight: true },
      { name: "Access to ALL 8+ markets", included: true, highlight: true },
      { name: "Full historical data (all time)", included: true },
      { name: "NFPI Index access", included: true, highlight: true },
      { name: "Team accounts (unlimited)", included: true },
      { name: "White-label reports", included: true },
      { name: "Full API access (unlimited)", included: true, highlight: true },
      { name: "24/7 dedicated support", included: true },
    ],
    enterprise: true,
  },
];

// ============================================================================
// TIER RANKING (for upgrade comparison)
// ============================================================================

const TIER_RANK: Record<string, number> = {
  FREE: 6,
  SILVER: 5,
  GOLD: 4,
  BUSINESS: 3,
  CORPORATE: 2,
  ENTERPRISE: 1,
};

// ============================================================================
// PAYMENT PROVIDERS
// ============================================================================

interface PaymentProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
}

const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "paystack",
    name: "Paystack",
    logo: "💳",
    description: "Cards, Bank Transfer, USSD",
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    logo: "🦋",
    description: "Cards, Bank Transfer, Mobile Money",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State
  const [currentTier, setCurrentTier] = useState<string>("FREE");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "payment" | "processing">("select");

  // Fetch user's current tier
  useEffect(() => {
    if (session?.user) {
      // Get tier from session or API
      const userTier = (session.user as any).subscription_tier || "FREE";
      setCurrentTier(userTier.toUpperCase());
    }
  }, [session]);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/subscribe");
    }
  }, [status, router]);

  // Check if tier is an upgrade
  const isUpgrade = (tierId: string): boolean => {
    return TIER_RANK[tierId] < TIER_RANK[currentTier];
  };

  // Check if tier is downgrade
  const isDowngrade = (tierId: string): boolean => {
    return TIER_RANK[tierId] > TIER_RANK[currentTier];
  };

  // Handle tier selection
  const handleSelectTier = (tierId: string) => {
    if (tierId === currentTier) return;
    if (isDowngrade(tierId)) return; // Don't allow downgrade through this UI
    
    setSelectedTier(tierId);
    setStep("payment");
    setError(null);
  };

  // Handle provider selection
  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  // Handle payment initiation
  const handleInitiatePayment = async () => {
    if (!selectedTier || !selectedProvider) return;
    
    setIsLoading(true);
    setError(null);
    setStep("processing");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier: selectedTier,
          provider: selectedProvider,
          phone: (session?.user as any)?.phone || "",
          email: session?.user?.email || "",
          name: session?.user?.name || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      // Redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.reference) {
        // For bank transfer, show instructions
        setError(`Payment Reference: ${data.reference}\n\nPlease transfer to:\nBank: GTBank\nAccount: 0123456789\nName: NaijaMarket Intel`);
        setStep("select");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setStep("payment");
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to tier selection
  const handleBack = () => {
    setSelectedTier(null);
    setSelectedProvider(null);
    setStep("select");
    setError(null);
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Get selected tier details
  const selectedTierDetails = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
  const currentTierDetails = SUBSCRIPTION_TIERS.find(t => t.id === currentTier);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Current Plan:</span>
              <span className={`font-semibold ${currentTierDetails?.color || "text-gray-400"}`}>
                {currentTierDetails?.icon}
              </span>
              <span className={`font-semibold ${currentTierDetails?.color || "text-gray-400"}`}>
                {currentTier}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Upgrade Your Plan
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Unlock more features and get unlimited access to real-time commodity prices across Nigerian markets.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Step: Select Tier */}
        {step === "select" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const isCurrent = tier.id === currentTier;
              const canUpgrade = isUpgrade(tier.id);
              const isDisabled = isCurrent || isDowngrade(tier.id);

              return (
                <div
                  key={tier.id}
                  className={`
                    relative rounded-2xl border-2 p-6 transition-all duration-300
                    ${isCurrent 
                      ? `${tier.borderColor} bg-gradient-to-b ${tier.bgGradient} ring-2 ring-offset-2 ring-offset-[#0a0a0a] ring-emerald-500/50` 
                      : canUpgrade
                        ? `border-gray-700 hover:${tier.borderColor} hover:bg-gradient-to-b hover:${tier.bgGradient} cursor-pointer`
                        : "border-gray-800 opacity-50 cursor-not-allowed"
                    }
                  `}
                  onClick={() => !isDisabled && handleSelectTier(tier.id)}
                >
                  {/* Popular Badge */}
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {/* Current Plan Badge */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded-full">
                        CURRENT PLAN
                      </span>
                    </div>
                  )}

                  {/* Enterprise Badge */}
                  {tier.enterprise && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">
                        BEST VALUE
                      </span>
                    </div>
                  )}

                  {/* Tier Icon & Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg bg-gray-800/50 ${tier.color}`}>
                      {tier.icon}
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${tier.color}`}>{tier.name}</h3>
                      <p className="text-sm text-gray-500">{tier.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-white">{tier.priceDisplay}</span>
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-6 p-3 bg-gray-800/30 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase">Queries</p>
                      <p className="font-semibold text-white">{tier.queryLimit}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase">Markets</p>
                      <p className="font-semibold text-white">{tier.maxMarkets}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li 
                        key={idx} 
                        className={`flex items-center gap-2 text-sm ${
                          feature.included 
                            ? feature.highlight 
                              ? tier.color 
                              : "text-gray-300"
                            : "text-gray-600"
                        }`}
                      >
                        {feature.included ? (
                          <Check className={`w-4 h-4 flex-shrink-0 ${feature.highlight ? tier.color : "text-emerald-500"}`} />
                        ) : (
                          <X className="w-4 h-4 flex-shrink-0 text-gray-700" />
                        )}
                        <span>{feature.name}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    disabled={isDisabled}
                    className={`
                      w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200
                      ${isCurrent
                        ? "bg-gray-700 text-gray-400 cursor-default"
                        : canUpgrade
                          ? `bg-gradient-to-r ${tier.bgGradient} border ${tier.borderColor} hover:opacity-90 text-white`
                          : "bg-gray-800 text-gray-600 cursor-not-allowed"
                      }
                    `}
                  >
                    {isCurrent ? "Current Plan" : canUpgrade ? "Upgrade Now" : "Not Available"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Step: Payment Selection */}
        {step === "payment" && selectedTierDetails && (
          <div className="max-w-lg mx-auto">
            <div className={`rounded-2xl border-2 ${selectedTierDetails.borderColor} bg-gradient-to-b ${selectedTierDetails.bgGradient} p-6 mb-6`}>
              {/* Selected Plan Summary */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl bg-gray-800/50 ${selectedTierDetails.color}`}>
                  {selectedTierDetails.icon}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${selectedTierDetails.color}`}>
                    {selectedTierDetails.name} Plan
                  </h2>
                  <p className="text-gray-400">{selectedTierDetails.description}</p>
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Plan Price</span>
                  <span className="text-white font-semibold">
                    ₦{selectedTierDetails.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Billing Cycle</span>
                  <span className="text-white capitalize">{selectedTierDetails.billingCycle}</span>
                </div>
                <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between items-center">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    ₦{selectedTierDetails.price.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Provider Selection */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                  Select Payment Method
                </h3>
                <div className="space-y-3">
                  {PAYMENT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleSelectProvider(provider.id)}
                      className={`
                        w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
                        flex items-center gap-4
                        ${selectedProvider === provider.id
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                        }
                      `}
                    >
                      <span className="text-3xl">{provider.logo}</span>
                      <div>
                        <p className="font-semibold text-white">{provider.name}</p>
                        <p className="text-sm text-gray-400">{provider.description}</p>
                      </div>
                      {selectedProvider === provider.id && (
                        <Check className="ml-auto w-5 h-5 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 rounded-lg font-semibold border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleInitiatePayment}
                  disabled={!selectedProvider || isLoading}
                  className={`
                    flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200
                    flex items-center justify-center gap-2
                    ${selectedProvider
                      ? "bg-emerald-500 hover:bg-emerald-600 text-black"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }
                  `}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₦{selectedTierDetails.price.toLocaleString()}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Security Note */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Secure payment powered by {selectedProvider === "paystack" ? "Paystack" : "Flutterwave"}</span>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="max-w-md mx-auto text-center">
            <div className="mb-6">
              <Loader2 className="w-16 h-16 animate-spin text-emerald-500 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
            <p className="text-gray-400">
              Please wait while we redirect you to the payment page...
            </p>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 mb-2">Need help choosing a plan?</p>
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://wa.me/2348012345678" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2"
            >
              <Headphones className="w-4 h-4" />
              <span>Contact Support</span>
            </a>
            <span className="text-gray-700">•</span>
            <Link 
              href="/faq"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View FAQ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

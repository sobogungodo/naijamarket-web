// ============================================================================
// /app/(dashboard)/dashboard/tokens/page.tsx
// Token Wallet - Pay-Per-Query Token System (Feature #12 - Akon Playbook)
// ============================================================================
// FIX: Uses session.user.id (not consumer_id) to match NextAuth session
// ============================================================================

"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import {
  Coins,
  Wallet,
  ShoppingCart,
  History,
  TrendingUp,
  Gift,
  Zap,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface WalletData {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  totalExpired: number;
  welcomeBonusClaimed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TokenPack {
  id: number;
  name: string;
  tokens: number;
  price: number;
  bonus: number;
  savings: number;
  isPopular: boolean;
  description: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference: string | null;
  paymentAmount: number | null;
  paymentStatus: string;
  createdAt: string;
}

interface SessionUser {
  name?: string;
  email?: string | null;
  id?: string;
  phone?: string;
  tier?: string;
  status?: string;
  consumer_id?: string;  // fallback field name
}

// ============================================================================
// HELPERS
// ============================================================================

function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

function getTransactionIcon(type: string) {
  switch (type) {
    case "PURCHASE":
      return <ShoppingCart className="w-4 h-4" />;
    case "WELCOME_BONUS":
      return <Gift className="w-4 h-4" />;
    case "QUERY_USED":
      return <Zap className="w-4 h-4" />;
    case "EXPIRED":
      return <Clock className="w-4 h-4" />;
    case "REFUND":
      return <ArrowDownRight className="w-4 h-4" />;
    default:
      return <Coins className="w-4 h-4" />;
  }
}

function getTransactionColor(type: string): string {
  switch (type) {
    case "PURCHASE":
    case "WELCOME_BONUS":
    case "REFUND":
      return "text-emerald-400";
    case "QUERY_USED":
      return "text-orange-400";
    case "EXPIRED":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

function getTransactionSign(type: string): string {
  switch (type) {
    case "PURCHASE":
    case "WELCOME_BONUS":
    case "REFUND":
      return "+";
    case "QUERY_USED":
    case "EXPIRED":
      return "-";
    default:
      return "";
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TokenWalletPage() {
  const { data: session, status } = useSession();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"buy" | "history">("buy");
  const [dataSource, setDataSource] = useState<string>("");

  // ========================================================================
  // KEY FIX: Get consumer ID from session using the CORRECT field name
  // Session structure: { user: { id: "CON_XXX", phone: "234...", tier: "CORPORATE" } }
  // ========================================================================
  const user = session?.user as SessionUser | undefined;
  const consumerId = user?.id || user?.consumer_id || null;
  const userTier = user?.tier?.toUpperCase() || "FREE";
  const userName = user?.name || "User";

  // ========================================================================
  // FETCH WALLET DATA
  // ========================================================================
  const fetchWallet = useCallback(async (showRefresh = false) => {
    if (!consumerId) {
      console.log("[TokenWallet] No consumer ID in session, skipping fetch");
      return;
    }

    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      console.log("[TokenWallet] Fetching wallet for:", consumerId);
      const res = await fetch(`/api/tokens/wallet?consumerId=${encodeURIComponent(consumerId)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load wallet");
      }

      setWallet(data.wallet);
      setPacks(data.packs || []);
      setTransactions(data.transactions || []);
      setDataSource(data.source || "unknown");
      console.log("[TokenWallet] Loaded successfully. Source:", data.source, "Balance:", data.wallet?.balance);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load wallet";
      console.error("[TokenWallet] Error:", message);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [consumerId]);

  // ========================================================================
  // EFFECTS
  // ========================================================================
  useEffect(() => {
    if (status === "authenticated" && consumerId) {
      fetchWallet();
    } else if (status === "authenticated" && !consumerId) {
      console.warn("[TokenWallet] Authenticated but no consumer ID found in session");
      setLoading(false);
      setError("Unable to identify your account. Please log out and log back in.");
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, consumerId, fetchWallet]);

  // ========================================================================
  // PURCHASE HANDLER
  // ========================================================================
  const handlePurchase = async (pack: TokenPack) => {
    console.log("[TokenWallet] Buy clicked:", pack.name, "Price:", pack.price, "PackID:", pack.id);
    console.log("[TokenWallet] ConsumerID:", consumerId);
    
    if (!consumerId) {
      console.error("[TokenWallet] No consumer ID — cannot purchase");
      setError("Unable to identify your account. Please log out and log back in.");
      return;
    }
    
    setPurchasing(pack.id);
    setError(null);

    try {
      console.log("[TokenWallet] Calling /api/tokens/purchase...");
      const res = await fetch("/api/tokens/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumerId,
          packId: pack.id,
          amount: pack.price,
        }),
      });

      console.log("[TokenWallet] Purchase API status:", res.status);
      const data = await res.json();
      console.log("[TokenWallet] Purchase API response:", JSON.stringify(data).substring(0, 500));

      if (data.success && data.paymentUrl) {
        console.log("[TokenWallet] Redirecting to Paystack:", data.paymentUrl);
        window.location.href = data.paymentUrl;
        return;
      } else if (data.success) {
        console.log("[TokenWallet] Direct credit — refreshing wallet");
        await fetchWallet(true);
      } else {
        console.error("[TokenWallet] Purchase failed:", data.error);
        setError(data.error || "Purchase failed. Please try again.");
      }
    } catch (err) {
      console.error("[TokenWallet] Purchase exception:", err);
      setError("Failed to initiate purchase. Check your connection and try again.");
    } finally {
      setPurchasing(null);
    }
  };

  // ========================================================================
  // LOADING STATE
  // ========================================================================
  if (status === "loading" || (loading && status === "authenticated")) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
            <Coins className="w-7 h-7 text-emerald-500 animate-pulse" />
          </div>
          <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
        <p className="mt-4 text-gray-400 text-sm">Loading your token wallet...</p>
      </div>
    );
  }

  // ========================================================================
  // UNAUTHENTICATED
  // ========================================================================
  if (status === "unauthenticated") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <p className="text-gray-400">Please log in to access your token wallet.</p>
      </div>
    );
  }

  // ========================================================================
  // ERROR STATE
  // ========================================================================
  if (error && !wallet) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchWallet()}
          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const balance = wallet?.balance ?? 0;

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ================================================================ */}
      {/* HEADER                                                          */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            Token Wallet
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pay-per-query tokens for instant price lookups
          </p>
        </div>
        <button
          onClick={() => fetchWallet(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ================================================================ */}
      {/* BALANCE CARDS                                                   */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Main Balance */}
        <div className="md:col-span-2 bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/20 rounded-xl p-4 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <p className="text-sm text-emerald-400/70 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Available Tokens
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-5xl font-bold text-white tabular-nums">
                {balance}
              </span>
              <span className="text-lg text-emerald-400/50">tokens</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {balance === 0
                ? "Purchase tokens to make price queries"
                : balance <= 3
                  ? "Running low — consider buying more"
                  : "Ready for price lookups"}
            </p>
          </div>
        </div>

        {/* Purchased */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            Total Purchased
          </p>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">
            {wallet?.totalPurchased ?? 0}
          </p>
          <p className="text-xs text-gray-600 mt-1">lifetime tokens</p>
        </div>

        {/* Used */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-orange-400" />
            Tokens Used
          </p>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">
            {wallet?.totalUsed ?? 0}
          </p>
          <p className="text-xs text-gray-600 mt-1">queries made</p>
        </div>
      </div>

      {/* Welcome bonus banner */}
      {wallet && !wallet.welcomeBonusClaimed && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
          <div>
            <p className="text-sm text-yellow-200 font-medium">Welcome Bonus Available!</p>
            <p className="text-xs text-yellow-200/60">
              You have 3 free tokens waiting. Make your first price query to claim them.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TABS                                                            */}
      {/* ================================================================ */}
      <div className="flex items-center gap-1 bg-gray-800/40 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("buy")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === "buy"
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 inline mr-1.5" />
          Buy Tokens
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            activeTab === "history"
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <History className="w-3.5 h-3.5 inline mr-1.5" />
          History
          {transactions.length > 0 && (
            <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
              {transactions.length}
            </span>
          )}
        </button>
      </div>

      {/* ================================================================ */}
      {/* BUY TOKENS TAB                                                  */}
      {/* ================================================================ */}
      {activeTab === "buy" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Token Packs</h2>
            <p className="text-xs text-gray-500">1 token = 1 price query</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className={`relative bg-gray-800/40 border rounded-xl p-5 transition-all hover:border-emerald-500/40 hover:bg-gray-800/60 ${
                  pack.isPopular
                    ? "border-emerald-500/30 ring-1 ring-emerald-500/10"
                    : "border-gray-700/50"
                }`}
              >
                {/* Popular badge */}
                {pack.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Star className="w-2.5 h-2.5" />
                      BEST VALUE
                    </span>
                  </div>
                )}

                {/* Pack info */}
                <div className="text-center mb-4 mt-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 mb-3">
                    <Coins className={`w-6 h-6 ${pack.isPopular ? "text-emerald-400" : "text-gray-400"}`} />
                  </div>
                  <h3 className="text-white font-semibold">{pack.name}</h3>
                  <div className="flex items-baseline justify-center gap-1 mt-1">
                    <span className="text-3xl font-bold text-white">{pack.tokens}</span>
                    {pack.bonus > 0 && (
                      <span className="text-emerald-400 text-sm font-medium">+{pack.bonus}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">tokens</p>
                </div>

                {/* Price */}
                <div className="text-center mb-4">
                  <p className="text-xl font-bold text-white">{formatNaira(pack.price)}</p>
                  {pack.savings > 0 && (
                    <p className="text-xs text-emerald-400 mt-0.5">
                      Save {pack.savings}%
                    </p>
                  )}
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {formatNaira(Math.round(pack.price / (pack.tokens + pack.bonus)))}/query
                  </p>
                </div>

                {/* Buy button */}
                <button
                  onClick={() => handlePurchase(pack)}
                  disabled={purchasing === pack.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    pack.isPopular
                      ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  } disabled:opacity-50`}
                >
                  {purchasing === pack.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Buy Now
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {packs.length === 0 && (
            <div className="text-center py-12 bg-gray-800/20 border border-gray-700/30 rounded-xl">
              <Coins className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Token packs are being set up. Check back soon!</p>
            </div>
          )}

          {/* Info banner */}
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">How Token Queries Work</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-500">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>Each token gets you one real-time price lookup for any commodity in any market</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>Tokens never expire. Use them at your own pace without subscription pressure</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>Works on both WhatsApp and web. Buy here, use anywhere</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HISTORY TAB                                                     */}
      {/* ================================================================ */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Transaction History</h2>

          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-gray-800/20 border border-gray-700/30 rounded-xl">
              <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No transactions yet</p>
              <p className="text-gray-600 text-xs mt-1">Your token purchase and usage history will appear here</p>
            </div>
          ) : (
            <div className="bg-gray-800/20 border border-gray-700/30 rounded-xl divide-y divide-gray-800">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gray-800/60 ${getTransactionColor(tx.type)}`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-sm text-white">{tx.description}</p>
                      <p className="text-xs text-gray-600">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono font-medium ${getTransactionColor(tx.type)}`}>
                      {getTransactionSign(tx.type)}{tx.amount} tokens
                    </p>
                    {tx.paymentAmount && (
                      <p className="text-xs text-gray-600">{formatNaira(tx.paymentAmount)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* FOOTER INFO                                                     */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
        <div className="flex items-center gap-4">
          <span>Account: {userName}</span>
          <span>Tier: {userTier}</span>
        </div>
        <div className="flex items-center gap-2">
          {dataSource === "demo" && (
            <span className="text-yellow-500/70 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Demo data
            </span>
          )}
          {dataSource === "database" && (
            <span className="text-emerald-500/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Live
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

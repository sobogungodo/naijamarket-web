/*
================================================================================
NAIJAMARKET INTEL - TOKEN WALLET DASHBOARD PAGE
================================================================================
File: src/app/dashboard/tokens/page.tsx
Location: Your Next.js project (naijamarket-web)

Features:
  - Token balance display with animated counter
  - Token pack purchase cards with Paystack checkout
  - Transaction history table with filters
  - Low balance warnings
  - Payment success/failure handling via URL params
================================================================================
*/

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ============================================================================
// TYPES
// ============================================================================
interface TokenPack {
    pack_id: string;
    pack_name: string;
    display_name: string;
    tokens: number;
    bonus_tokens: number;
    price_naira: number;
    price_per_query: number;
    savings_percent: number;
    is_popular: boolean;
    description_en: string;
    description_pidgin: string;
}

interface TokenWallet {
    wallet_id: string;
    consumer_phone: string;
    consumer_name: string;
    token_balance: number;
    total_purchased: number;
    total_spent: number;
    total_amount_paid: number;
    total_queries_made: number;
    last_purchase_at: string | null;
    last_query_at: string | null;
    wallet_status: string;
    recent_transactions: TokenTransaction[];
}

interface TokenTransaction {
    transaction_id: string;
    transaction_type: string;
    tokens_amount: number;
    token_balance_after: number;
    pack_id: string | null;
    payment_amount: number | null;
    payment_provider: string | null;
    query_id: string | null;
    market_name: string | null;
    item_name: string | null;
    price_returned: number | null;
    description: string;
    channel: string;
    created_at: string;
    pack_display_name: string | null;
}

// ============================================================================
// API CONFIG
// ============================================================================
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://func-naijamarket-tokens.azurewebsites.net/api";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            ...(options.headers || {}),
        },
    });
    return res.json();
}

// ============================================================================
// TOKEN WALLET PAGE (wrapped in Suspense for useSearchParams)
// ============================================================================
function TokenWalletContent() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();

    const [wallet, setWallet] = useState<TokenWallet | null>(null);
    const [packs, setPacks] = useState<TokenPack[]>([]);
    const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [txFilter, setTxFilter] = useState<string>("ALL");
    const [txPage, setTxPage] = useState(0);
    const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

    const phone = (session?.user as any)?.phone_number || "";

    // Check for payment callback
    useEffect(() => {
        const payment = searchParams.get("payment");
        const ref = searchParams.get("reference");
        if (payment === "success") {
            setNotification({
                type: "success",
                message: `Payment successful! Your tokens will be credited shortly. Reference: ${ref || "N/A"}`,
            });
            // Clear URL params
            window.history.replaceState({}, "", "/dashboard/tokens");
        } else if (payment === "failed") {
            setNotification({
                type: "error",
                message: "Payment was not completed. Please try again.",
            });
            window.history.replaceState({}, "", "/dashboard/tokens");
        }
    }, [searchParams]);

    // Load wallet and packs
    const loadData = useCallback(async () => {
        if (!phone) return;
        setLoading(true);
        try {
            const [walletRes, packsRes] = await Promise.all([
                apiFetch(`/tokens/wallet/${encodeURIComponent(phone)}`),
                apiFetch("/tokens/packs"),
            ]);

            if (walletRes.status === "success") {
                setWallet(walletRes.wallet);
            }
            if (packsRes.status === "success") {
                setPacks(packsRes.packs);
            }
        } catch (err) {
            console.error("Load error:", err);
        }
        setLoading(false);
    }, [phone]);

    useEffect(() => { loadData(); }, [loadData]);

    // Load transactions
    const loadTransactions = useCallback(async () => {
        if (!phone) return;
        try {
            const typeParam = txFilter !== "ALL" ? `&type=${txFilter}` : "";
            const res = await apiFetch(
                `/tokens/history/${encodeURIComponent(phone)}?limit=20&offset=${txPage * 20}${typeParam}`
            );
            if (res.status === "success") {
                setTransactions(res.transactions);
                setTotalTransactions(res.total);
            }
        } catch (err) {
            console.error("Transaction load error:", err);
        }
    }, [phone, txFilter, txPage]);

    useEffect(() => { loadTransactions(); }, [loadTransactions]);

    // Purchase handler
    const handlePurchase = async (packId: string) => {
        setPurchasing(packId);
        try {
            const res = await apiFetch("/tokens/purchase", {
                method: "POST",
                body: JSON.stringify({
                    phone,
                    pack_id: packId,
                    channel: "WEB",
                    callback_url: `${window.location.origin}/dashboard/tokens?payment=success`,
                }),
            });

            if (res.status === "success" && res.payment?.authorization_url) {
                // Redirect to Paystack checkout
                window.location.href = res.payment.authorization_url;
            } else {
                setNotification({
                    type: "error",
                    message: res.message || "Failed to initialize payment",
                });
            }
        } catch (err) {
            setNotification({ type: "error", message: "Payment error. Please try again." });
        }
        setPurchasing(null);
    };

    // ========================================================================
    // RENDER
    // ========================================================================
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading your token wallet...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Notification Banner */}
            {notification && (
                <div
                    className={`p-4 rounded-lg border ${
                        notification.type === "success"
                            ? "bg-green-900/30 border-green-700 text-green-300"
                            : "bg-red-900/30 border-red-700 text-red-300"
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <span>{notification.type === "success" ? "✅" : "❌"} {notification.message}</span>
                        <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">🪙 Token Wallet</h1>
                <p className="text-gray-400 mt-1">Buy tokens to query prices on-demand — no subscription needed</p>
            </div>

            {/* Wallet Balance Card */}
            <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/30 rounded-xl border border-green-700/50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Main Balance */}
                    <div className="md:col-span-2">
                        <p className="text-green-400 text-sm font-medium uppercase tracking-wider">Token Balance</p>
                        <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-5xl font-bold text-white">
                                {wallet?.token_balance ?? 0}
                            </span>
                            <span className="text-green-400 text-lg">tokens</span>
                        </div>
                        {wallet && wallet.token_balance <= 3 && wallet.token_balance > 0 && (
                            <p className="text-yellow-400 text-sm mt-2">⚠️ Low balance — buy more tokens below</p>
                        )}
                        {wallet && wallet.token_balance === 0 && (
                            <p className="text-red-400 text-sm mt-2">🚨 No tokens — buy a pack to start querying</p>
                        )}
                    </div>

                    {/* Stats */}
                    <div>
                        <p className="text-gray-400 text-xs uppercase">Total Spent</p>
                        <p className="text-white text-xl font-semibold">₦{(wallet?.total_amount_paid ?? 0).toLocaleString()}</p>
                        <p className="text-gray-500 text-xs mt-1">{wallet?.total_queries_made ?? 0} queries made</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase">Tokens Used</p>
                        <p className="text-white text-xl font-semibold">{wallet?.total_spent ?? 0}</p>
                        <p className="text-gray-500 text-xs mt-1">of {wallet?.total_purchased ?? 0} purchased</p>
                    </div>
                </div>
            </div>

            {/* Token Packs */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">💰 Buy Token Packs</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {packs.map((pack) => (
                        <div
                            key={pack.pack_id}
                            className={`relative rounded-xl border p-5 transition-all hover:scale-[1.02] ${
                                pack.is_popular
                                    ? "bg-green-900/30 border-green-500 ring-1 ring-green-500/50"
                                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                            }`}
                        >
                            {/* Popular badge */}
                            {pack.is_popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                                        MOST POPULAR
                                    </span>
                                </div>
                            )}

                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">{pack.display_name}</h3>
                                <div className="mt-3">
                                    <span className="text-3xl font-bold text-white">₦{pack.price_naira.toLocaleString()}</span>
                                </div>
                                <div className="mt-2 space-y-1">
                                    <p className="text-green-400 font-semibold">
                                        {pack.tokens} tokens
                                        {pack.bonus_tokens > 0 && (
                                            <span className="text-yellow-400"> +{pack.bonus_tokens} bonus!</span>
                                        )}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        ₦{pack.price_per_query?.toFixed(0) ?? "?"} per query
                                    </p>
                                    {pack.savings_percent > 0 && (
                                        <p className="text-emerald-400 text-sm font-medium">
                                            Save {pack.savings_percent}%
                                        </p>
                                    )}
                                </div>
                                <p className="text-gray-500 text-xs mt-3">{pack.description_en}</p>

                                <button
                                    onClick={() => handlePurchase(pack.pack_id)}
                                    disabled={purchasing !== null}
                                    className={`mt-4 w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                                        pack.is_popular
                                            ? "bg-green-500 hover:bg-green-400 text-black"
                                            : "bg-gray-700 hover:bg-gray-600 text-white"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {purchasing === pack.pack_id ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                                            Processing...
                                        </span>
                                    ) : (
                                        `Buy Now — ₦${pack.price_naira.toLocaleString()}`
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">❓ How Pay-Per-Query Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { icon: "💰", title: "Buy Tokens", desc: "Choose a pack and pay with your bank card or transfer" },
                        { icon: "🔍", title: "Query Prices", desc: "Each price check costs 1 token — WhatsApp or website" },
                        { icon: "📊", title: "Get Results", desc: "Instantly see verified market prices with trends" },
                        { icon: "🔄", title: "Top Up Anytime", desc: "Buy more tokens whenever you need — no commitment" },
                    ].map((step, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl mb-2">{step.icon}</div>
                            <h3 className="text-white font-medium">{step.title}</h3>
                            <p className="text-gray-400 text-sm mt-1">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transaction History */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">📜 Transaction History</h2>
                    <div className="flex gap-2">
                        {["ALL", "PURCHASE", "QUERY_DEBIT", "BONUS", "REFUND"].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => { setTxFilter(filter); setTxPage(0); }}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                    txFilter === filter
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                                }`}
                            >
                                {filter === "QUERY_DEBIT" ? "QUERIES" : filter}
                            </button>
                        ))}
                    </div>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <p className="text-4xl mb-2">🪙</p>
                        <p>No transactions yet. Buy your first token pack above!</p>
                    </div>
                ) : (
                    <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Date</th>
                                    <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Type</th>
                                    <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Description</th>
                                    <th className="text-right px-4 py-3 text-gray-400 text-xs uppercase">Tokens</th>
                                    <th className="text-right px-4 py-3 text-gray-400 text-xs uppercase">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr key={tx.transaction_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                        <td className="px-4 py-3 text-gray-400 text-sm">
                                            {new Date(tx.created_at).toLocaleDateString("en-NG", {
                                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <TypeBadge type={tx.transaction_type} />
                                        </td>
                                        <td className="px-4 py-3 text-white text-sm max-w-[300px] truncate">
                                            {tx.description}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${
                                            tx.tokens_amount > 0 ? "text-green-400" : "text-red-400"
                                        }`}>
                                            {tx.tokens_amount > 0 ? "+" : ""}{tx.tokens_amount}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 text-sm font-mono">
                                            {tx.token_balance_after}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalTransactions > 20 && (
                            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-700">
                                <span className="text-gray-500 text-sm">
                                    Showing {txPage * 20 + 1}-{Math.min((txPage + 1) * 20, totalTransactions)} of {totalTransactions}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTxPage(Math.max(0, txPage - 1))}
                                        disabled={txPage === 0}
                                        className="px-3 py-1 rounded bg-gray-700 text-gray-400 text-sm disabled:opacity-30"
                                    >
                                        ← Prev
                                    </button>
                                    <button
                                        onClick={() => setTxPage(txPage + 1)}
                                        disabled={(txPage + 1) * 20 >= totalTransactions}
                                        className="px-3 py-1 rounded bg-gray-700 text-gray-400 text-sm disabled:opacity-30"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Type badge component
function TypeBadge({ type }: { type: string }) {
    const config: Record<string, { label: string; color: string }> = {
        PURCHASE: { label: "Purchase", color: "bg-blue-900/50 text-blue-300 border-blue-700" },
        QUERY_DEBIT: { label: "Query", color: "bg-orange-900/50 text-orange-300 border-orange-700" },
        REFUND: { label: "Refund", color: "bg-purple-900/50 text-purple-300 border-purple-700" },
        BONUS: { label: "Bonus", color: "bg-yellow-900/50 text-yellow-300 border-yellow-700" },
        PROMO: { label: "Promo", color: "bg-green-900/50 text-green-300 border-green-700" },
        ADMIN_CREDIT: { label: "Credit", color: "bg-teal-900/50 text-teal-300 border-teal-700" },
        ADMIN_DEBIT: { label: "Debit", color: "bg-red-900/50 text-red-300 border-red-700" },
        EXPIRY: { label: "Expired", color: "bg-gray-800 text-gray-400 border-gray-600" },
    };
    const c = config[type] || { label: type, color: "bg-gray-800 text-gray-400 border-gray-600" };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${c.color}`}>
            {c.label}
        </span>
    );
}

// Default export with Suspense wrapper
export default function TokensPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
                </div>
            }
        >
            <TokenWalletContent />
        </Suspense>
    );
}

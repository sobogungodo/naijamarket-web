// ============================================================================
// src/app/subscribe/callback/page.tsx
// NaijaMarket Intel - Payment Callback Page
// Version: 2.0.1 - Production Ready (TypeScript Strict) - FIXED
// Date: 2026-01-24
// ============================================================================

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  RefreshCw,
  Home,
  LayoutDashboard,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface PaymentInfo {
  reference: string;
  status: string;
  providerStatus?: string;
  amount?: number;
  tier?: string;
  tierName?: string;
  phone?: string;
  provider?: string;
}

interface SubscriptionInfo {
  tier?: string;
  tierName?: string;
  maxMarkets?: number;
  queryLimit?: number | null;
  billingCycle?: string;
}

// ============================================================================
// CALLBACK CONTENT COMPONENT
// ============================================================================

function CallbackContent() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get("reference") || searchParams.get("ref");
      const provider = searchParams.get("provider");
      const trxref = searchParams.get("trxref"); // Paystack sends this

      // Use trxref if reference is not available (Paystack callback)
      const paymentRef = reference || trxref;

      if (!paymentRef || !provider) {
        setStatus("failed");
        setMessage("Missing payment information. Please try again.");
        return;
      }

      try {
        const response = await fetch(
          `/api/subscribe/verify?reference=${encodeURIComponent(paymentRef)}&provider=${encodeURIComponent(provider)}`
        );

        const data = await response.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Payment successful! Your subscription has been upgraded.");
          setPayment(data.payment);
          setSubscription(data.subscription);
        } else if (data.payment?.status === "PENDING") {
          setStatus("pending");
          setMessage(data.message || "Payment is being processed. Please wait...");
          setPayment(data.payment);
        } else {
          setStatus("failed");
          setMessage(data.message || data.error || "Payment verification failed.");
          setPayment(data.payment);
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("failed");
        setMessage("Unable to verify payment. Please contact support.");
      }
    };

    verifyPayment();
  }, [searchParams]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Verifying Payment</h1>
          <p className="text-gray-400">Please wait while we confirm your payment...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111] border border-emerald-500/30 rounded-xl p-8 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-400 mb-6">{message}</p>

          {/* Payment Details */}
          {payment && (
            <div className="bg-[#0a0a0a] rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Payment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="text-white font-mono">{payment.reference}</span>
                </div>
                {payment.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="text-emerald-400">₦{payment.amount.toLocaleString()}</span>
                  </div>
                )}
                {payment.tierName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan</span>
                    <span className="text-white">{payment.tierName}</span>
                  </div>
                )}
                {payment.provider && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider</span>
                    <span className="text-white capitalize">{payment.provider}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subscription Details */}
          {subscription && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-emerald-400 mb-3">Your New Plan</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tier</span>
                  <span className="text-white font-semibold">{subscription.tierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Markets</span>
                  <span className="text-white">{subscription.maxMarkets} markets</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Query Limit</span>
                  <span className="text-white">
                    {subscription.queryLimit === null ? "Unlimited" : `${subscription.queryLimit}/day`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Billing</span>
                  <span className="text-white capitalize">{subscription.billingCycle}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              Go to Dashboard
            </Link>
            <Link
              href="/dashboard/watchlist"
              className="flex items-center justify-center gap-2 w-full bg-[#1a1a1a] hover:bg-[#222] text-white py-3 px-4 rounded-lg transition-colors border border-gray-700"
            >
              View Watchlist
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pending state
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111] border border-yellow-500/30 rounded-xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Processing</h1>
          <p className="text-gray-400 mb-6">{message}</p>

          {payment && (
            <div className="bg-[#0a0a0a] rounded-lg p-4 mb-6 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="text-white font-mono">{payment.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-yellow-400">Pending</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Check Status Again
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full bg-[#1a1a1a] hover:bg-[#222] text-white py-3 px-4 rounded-lg transition-colors border border-gray-700"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </Link>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Your payment is being processed. This usually takes a few minutes.
            If your subscription is not updated within 30 minutes, please contact support.
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111] border border-red-500/30 rounded-xl p-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
        <p className="text-gray-400 mb-6">{message}</p>

        {payment && (
          <div className="bg-[#0a0a0a] rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Reference</span>
                <span className="text-white font-mono">{payment.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-red-400">{payment.providerStatus || "Failed"}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/subscribe"
            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full bg-[#1a1a1a] hover:bg-[#222] text-white py-3 px-4 rounded-lg transition-colors border border-gray-700"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If you believe this is an error, please{" "}
          <a
            href="https://wa.me/2348012345678"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT WITH SUSPENSE
// ============================================================================

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

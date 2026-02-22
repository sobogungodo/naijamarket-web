// ============================================================================
// /app/(dashboard)/dashboard/tokens/callback/page.tsx
// Token Purchase Callback - Handles Paystack redirect after payment
// ============================================================================

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Coins, ArrowLeft } from "lucide-react";
import Link from "next/link";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference") || searchParams.get("ref") || searchParams.get("trxref") || "";

  const [status, setStatus] = useState<"verifying" | "success" | "failed" | "error">("verifying");
  const [message, setMessage] = useState("");
  const [tokensAdded, setTokensAdded] = useState(0);
  const [packName, setPackName] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No payment reference found.");
      return;
    }

    const verifyPayment = async () => {
      try {
        const res = await fetch("/api/tokens/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Payment verified! Tokens added to your wallet.");
          setTokensAdded(data.tokensAdded || 0);
          setPackName(data.packName || "Token Pack");
        } else {
          setStatus("failed");
          setMessage(data.error || "Payment verification failed.");
        }
      } catch {
        setStatus("error");
        setMessage("Unable to verify payment. Please contact support.");
      }
    };

    verifyPayment();
  }, [reference]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center">

        {/* Verifying */}
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white">Verifying Payment...</h2>
            <p className="text-sm text-gray-400">
              Please wait while we confirm your payment with Paystack.
            </p>
            <p className="text-xs text-gray-600 font-mono">Ref: {reference}</p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Payment Successful!</h2>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 inline-block">
              <div className="flex items-center gap-2 justify-center">
                <Coins className="w-5 h-5 text-emerald-400" />
                <span className="text-3xl font-bold text-emerald-400">+{tokensAdded}</span>
                <span className="text-gray-400">tokens</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{packName}</p>
            </div>
            <p className="text-sm text-gray-400">{message}</p>
            <Link
              href="/dashboard/tokens"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Token Wallet
            </Link>
          </div>
        )}

        {/* Failed */}
        {(status === "failed" || status === "error") && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {status === "failed" ? "Payment Failed" : "Verification Error"}
            </h2>
            <p className="text-sm text-gray-400">{message}</p>
            {reference && <p className="text-xs text-gray-600 font-mono">Ref: {reference}</p>}
            <div className="flex items-center gap-3 justify-center">
              <Link
                href="/dashboard/tokens"
                className="inline-flex items-center gap-2 px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Try Again
              </Link>
            </div>
            <p className="text-xs text-gray-600">
              If you were charged, your tokens will be credited automatically within 15 minutes.
              Contact support if the issue persists.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TokenCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

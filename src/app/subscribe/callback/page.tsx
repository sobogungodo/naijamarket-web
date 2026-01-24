"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Home,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// PAYMENT CALLBACK PAGE
// ============================================================================

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("");
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      // Get parameters from URL
      const provider = searchParams.get("provider");
      const reference = searchParams.get("reference") || searchParams.get("tx_ref") || searchParams.get("trxref");
      const paystackStatus = searchParams.get("status"); // Paystack adds this
      const flutterwaveStatus = searchParams.get("status"); // Flutterwave adds this

      // Check for explicit failure status
      if (paystackStatus === "cancelled" || flutterwaveStatus === "cancelled") {
        setStatus("failed");
        setMessage("Payment was cancelled. You can try again when you're ready.");
        return;
      }

      if (!reference) {
        setStatus("failed");
        setMessage("Invalid payment reference. Please contact support.");
        return;
      }

      try {
        // Verify payment with our API
        const response = await fetch(`/api/subscribe/verify?reference=${reference}&provider=${provider}`);
        const data = await response.json();

        if (data.success && data.payment) {
          if (data.payment.status === "COMPLETED" || data.payment.status === "success") {
            setStatus("success");
            setMessage(`Your subscription has been upgraded to ${data.payment.tier}!`);
            setPaymentDetails(data.payment);
          } else if (data.payment.status === "PENDING" || data.payment.status === "pending") {
            setStatus("pending");
            setMessage("Your payment is being processed. This may take a few minutes.");
            setPaymentDetails(data.payment);
          } else {
            setStatus("failed");
            setMessage(data.payment.failure_reason || "Payment verification failed. Please contact support.");
          }
        } else {
          setStatus("failed");
          setMessage(data.error || "Unable to verify payment. Please contact support.");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("failed");
        setMessage("An error occurred while verifying your payment. Please contact support.");
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Loading State */}
        {status === "loading" && (
          <div className="text-center">
            <div className="mb-6">
              <Loader2 className="w-20 h-20 animate-spin text-emerald-500 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
            <p className="text-gray-400">Please wait while we confirm your payment...</p>
          </div>
        )}

        {/* Success State */}
        {status === "success" && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-emerald-400">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">{message}</p>

            {/* Payment Details */}
            {paymentDetails && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Payment Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="text-white font-mono text-sm">{paymentDetails.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan</span>
                    <span className="text-emerald-400 font-semibold">{paymentDetails.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="text-white">₦{paymentDetails.amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/watchlist"
                className="w-full py-3 px-4 border border-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>View My Watchlist</span>
              </Link>
            </div>
          </div>
        )}

        {/* Pending State */}
        {status === "pending" && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                <RefreshCw className="w-12 h-12 text-yellow-500 animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-yellow-400">Payment Pending</h1>
            <p className="text-gray-400 mb-6">{message}</p>

            {/* Payment Details */}
            {paymentDetails && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Payment Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="text-white font-mono text-sm">{paymentDetails.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plan</span>
                    <span className="text-yellow-400 font-semibold">{paymentDetails.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="text-white">₦{paymentDetails.amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="text-yellow-400">Processing...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Check Again</span>
              </button>
              <Link
                href="/dashboard"
                className="w-full py-3 px-4 border border-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                <span>Go to Dashboard</span>
              </Link>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Your account will be upgraded automatically once payment is confirmed.
            </p>
          </div>
        )}

        {/* Failed State */}
        {status === "failed" && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Payment Failed</h1>
            <p className="text-gray-400 mb-6">{message}</p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href="/subscribe"
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Try Again</span>
              </Link>
              <Link
                href="/dashboard"
                className="w-full py-3 px-4 border border-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                <span>Go to Dashboard</span>
              </Link>
            </div>

            {/* Support */}
            <p className="text-sm text-gray-500 mt-6">
              Need help?{" "}
              <a
                href="https://wa.me/2348012345678"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

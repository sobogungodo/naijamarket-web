"use client";

import { useState } from "react";
import { usePWA } from "@/hooks/usePWA";
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle, Smartphone } from "lucide-react";

export default function PushNotificationManager() {
  const { push, subscribeToPush, unsubscribeFromPush, swStatus, isInstalled } = usePWA();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleToggle = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (push.isSubscribed) {
        const ok = await unsubscribeFromPush();
        setMessage(ok ? "Push notifications disabled" : "Failed to unsubscribe");
      } else {
        const ok = await subscribeToPush();
        if (ok) {
          setMessage("Push notifications enabled! You'll receive price alerts here.");
        } else {
          setMessage("Permission denied or subscription failed. Check browser settings.");
        }
      }
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Not supported
  if (swStatus === "unsupported" || !push.isSupported) {
    return (
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
            <BellOff className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h3 className="text-white font-medium">Push Notifications</h3>
            <p className="text-gray-500 text-sm">Not supported in this browser</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            push.isSubscribed ? "bg-emerald-500/20" : "bg-gray-800"
          }`}>
            {push.isSubscribed ? (
              <Bell className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div>
            <h3 className="text-white font-medium">Push Notifications</h3>
            <p className="text-gray-500 text-sm">
              {push.isSubscribed
                ? "Price alerts sent to this device"
                : "Get price alerts even when the app is closed"}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            push.isSubscribed
              ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
              : "bg-emerald-500 text-black hover:bg-emerald-400"
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : push.isSubscribed ? (
            <>
              <BellOff className="w-4 h-4" />
              Disable
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Enable
            </>
          )}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`mt-3 flex items-center gap-2 text-sm ${
          message.includes("enabled") || message.includes("disabled")
            ? "text-emerald-400"
            : "text-amber-400"
        }`}>
          {message.includes("enabled") || message.includes("disabled") ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message}
        </div>
      )}

      {/* Install hint */}
      {!isInstalled && !push.isSubscribed && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <Smartphone className="w-3.5 h-3.5" />
          Tip: Install the app for the best notification experience
        </div>
      )}
    </div>
  );
}

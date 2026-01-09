// src/app/dashboard/page.tsx
// NaijaMarket Intel - User Dashboard

"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  const user = session.user as any;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <span className="text-xl font-bold text-white">NaijaMarket Intel</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-emerald-400">{user?.tier || "FREE"} Plan</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome back, {user?.name?.split(" ")[0] || "Trader"}! 👋
          </h1>
          <p className="text-emerald-100">
            Track real-time commodity prices across Nigerian markets
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="🏪"
            label="Markets"
            value="226"
            color="blue"
          />
          <StatCard
            icon="📦"
            label="Categories"
            value="128"
            color="purple"
          />
          <StatCard
            icon="🛒"
            label="Items"
            value="610"
            color="orange"
          />
          <StatCard
            icon="💰"
            label="Price Updates"
            value="347"
            color="green"
          />
        </div>

        {/* Quick Actions */}
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <ActionCard
            icon="🔍"
            title="Price Query"
            description="Check current prices for any commodity"
            href="/prices"
          />
          <ActionCard
            icon="📈"
            title="Price Trends"
            description="View historical price movements"
            href="/trends"
          />
          <ActionCard
            icon="🔔"
            title="Price Alerts"
            description="Set alerts for target prices"
            href="/alerts"
          />
          <ActionCard
            icon="📸"
            title="Market Snapshot"
            description="Overview of any market"
            href="/snapshot"
          />
          <ActionCard
            icon="⚖️"
            title="Compare Markets"
            description="Compare prices across markets"
            href="/compare"
          />
          <ActionCard
            icon="⭐"
            title="My Favorites"
            description="Your saved markets and items"
            href="/favorites"
          />
        </div>

        {/* Subscription Banner */}
        {user?.tier === "FREE" && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Upgrade Your Plan
                </h3>
                <p className="text-gray-400">
                  Get unlimited queries, price alerts, and more!
                </p>
              </div>
              <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors">
                View Plans →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
    orange: "from-orange-500/20 to-orange-600/20 border-orange-500/30",
    green: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Action Card Component
function ActionCard({ icon, title, description, href }: { icon: string; title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      className="block bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-500/50 rounded-xl p-5 transition-all group"
    >
      <span className="text-3xl mb-3 block">{icon}</span>
      <h3 className="text-white font-semibold mb-1 group-hover:text-emerald-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-gray-400">{description}</p>
    </a>
  );
}

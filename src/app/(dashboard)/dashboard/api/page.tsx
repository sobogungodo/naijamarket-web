"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Lock,
  Clock,
  Activity,
  Shield,
  ExternalLink,
  Code,
  BookOpen,
  Zap,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface APIKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string | null;
  requests: number;
  status: "active" | "revoked";
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

const API_LIMITS: Record<string, { requests: number; rateLimit: string }> = {
  FREE: { requests: 0, rateLimit: "N/A" },
  SILVER: { requests: 0, rateLimit: "N/A" },
  GOLD: { requests: 0, rateLimit: "N/A" },
  BUSINESS: { requests: 1000, rateLimit: "100/min" },
  CORPORATE: { requests: 10000, rateLimit: "500/min" },
  ENTERPRISE: { requests: 100000, rateLimit: "2000/min" },
  OGA_BOSS: { requests: -1, rateLimit: "Unlimited" },
  GOVERNMENT: { requests: -1, rateLimit: "Unlimited" },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hasTierAccess(userTier: string, minTier: string): boolean {
  const userTierIndex = TIER_HIERARCHY.indexOf(userTier.toUpperCase());
  const minTierIndex = TIER_HIERARCHY.indexOf(minTier.toUpperCase());
  return userTierIndex >= minTierIndex;
}

function maskKey(key: string): string {
  if (key.length < 12) return key;
  return key.slice(0, 8) + "..." + key.slice(-4);
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "nm_live_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function APIKeysPage() {
  const { data: session } = useSession();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: "1",
      name: "Production Key",
      key: "nm_live_Kx7mN2pQ9rT4vW8yB3cE6fH1jL5nP0sU",
      created: "2026-01-05",
      lastUsed: "2026-01-09 08:45",
      requests: 2847,
      status: "active",
    },
    {
      id: "2",
      name: "Development Key",
      key: "nm_live_aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV",
      created: "2026-01-02",
      lastUsed: "2026-01-08 14:22",
      requests: 156,
      status: "active",
    },
  ]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Get user tier
  const user = session?.user as { tier?: string } | undefined;
  const userTier = user?.tier || "FREE";
  const hasAPIAccess = hasTierAccess(userTier, "BUSINESS");
  const limits = API_LIMITS[userTier as keyof typeof API_LIMITS] ?? { requests: 0, rateLimit: "N/A" };

  // Toggle key visibility
  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  // Copy key to clipboard
  const copyToClipboard = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Create new key
  const createNewKey = () => {
    if (!newKeyName.trim()) return;

    const key = generateKey();
    const today = new Date().toISOString().slice(0, 10);
    const newApiKey: APIKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key,
      created: today,
      lastUsed: null,
      requests: 0,
      status: "active",
    };

    setApiKeys(prev => [newApiKey, ...prev]);
    setNewKey(key);
    setNewKeyName("");
  };

  // Revoke key
  const revokeKey = (keyId: string) => {
    setApiKeys(prev => prev.map(k => 
      k.id === keyId ? { ...k, status: "revoked" as const } : k
    ));
  };

  // Delete key
  const deleteKey = (keyId: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== keyId));
  };

  // Calculate total usage
  const totalRequests = apiKeys.reduce((sum, k) => sum + k.requests, 0);
  const activeKeys = apiKeys.filter(k => k.status === "active").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="w-7 h-7 text-emerald-400" />
            API Keys
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your API keys for programmatic access to NaijaMarket data
          </p>
        </div>

        {hasAPIAccess && (
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Key
          </button>
        )}
      </div>

      {/* No Access Message */}
      {!hasAPIAccess && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <Lock className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-amber-400 font-semibold text-lg">API Access Requires BUSINESS Tier</h3>
              <p className="text-gray-300 mt-1">
                Programmatic API access is available for BUSINESS tier and above. 
                Upgrade to integrate NaijaMarket data into your applications.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="bg-[#1a1a1a] rounded-lg p-3">
                  <div className="text-amber-400 font-semibold">BUSINESS</div>
                  <div className="text-gray-400 text-sm">1,000 requests/day</div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-3">
                  <div className="text-amber-400 font-semibold">CORPORATE</div>
                  <div className="text-gray-400 text-sm">10,000 requests/day</div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-3">
                  <div className="text-amber-400 font-semibold">ENTERPRISE</div>
                  <div className="text-gray-400 text-sm">100,000 requests/day</div>
                </div>
              </div>
              <button className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors">
                Upgrade to BUSINESS
              </button>
            </div>
          </div>
        </div>
      )}

      {hasAPIAccess && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Key className="w-4 h-4" />
                Active Keys
              </div>
              <div className="text-2xl font-bold text-white">{activeKeys}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Activity className="w-4 h-4" />
                Total Requests
              </div>
              <div className="text-2xl font-bold text-white">{totalRequests.toLocaleString()}</div>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Zap className="w-4 h-4" />
                Daily Limit
              </div>
              <div className="text-2xl font-bold text-white">
                {limits.requests === -1 ? "∞" : limits.requests.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <RefreshCw className="w-4 h-4" />
                Rate Limit
              </div>
              <div className="text-2xl font-bold text-white">{limits.rateLimit}</div>
            </div>
          </div>

          {/* API Keys List */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-medium">Your API Keys</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-4 hover:bg-gray-800/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{apiKey.name}</span>
                        <span className={`
                          text-xs px-2 py-0.5 rounded
                          ${apiKey.status === "active" 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-red-500/20 text-red-400"
                          }
                        `}>
                          {apiKey.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <code className="bg-gray-900 px-3 py-1 rounded text-sm font-mono text-gray-300">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="p-1 text-gray-400 hover:text-white"
                          title={visibleKeys.has(apiKey.id) ? "Hide" : "Show"}
                        >
                          {visibleKeys.has(apiKey.id) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="p-1 text-gray-400 hover:text-white"
                          title="Copy"
                        >
                          {copiedKey === apiKey.key ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created: {apiKey.created}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Last used: {apiKey.lastUsed || "Never"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {apiKey.requests.toLocaleString()} requests
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {apiKey.status === "active" && (
                        <button
                          onClick={() => revokeKey(apiKey.id)}
                          className="px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => deleteKey(apiKey.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {apiKeys.length === 0 && (
                <div className="p-8 text-center">
                  <Key className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No API keys yet</p>
                  <p className="text-gray-500 text-sm">Create your first key to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Documentation Links */}
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="#"
              className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">API Documentation</span>
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-400 ml-auto" />
              </div>
              <p className="text-gray-400 text-sm">
                Complete guide to all API endpoints, parameters, and responses
              </p>
            </a>

            <a
              href="#"
              className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-medium">Code Examples</span>
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-400 ml-auto" />
              </div>
              <p className="text-gray-400 text-sm">
                Sample code in Python, JavaScript, and cURL
              </p>
            </a>

            <a
              href="#"
              className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="text-white font-medium">Security Best Practices</span>
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-400 ml-auto" />
              </div>
              <p className="text-gray-400 text-sm">
                Learn how to securely store and use your API keys
              </p>
            </a>
          </div>
        </>
      )}

      {/* Create New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Create New API Key</h3>
            </div>
            
            <div className="p-4">
              {newKey ? (
                <div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Key Created Successfully</span>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">
                      Copy your key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-sm font-mono text-gray-300 overflow-x-auto">
                        {newKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newKey)}
                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                      >
                        {copiedKey === newKey ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewKey(null);
                    }}
                    className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production, Development, Testing"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-gray-500 text-xs mt-2">
                    Give your key a descriptive name to identify its purpose
                  </p>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowNewKeyModal(false)}
                      className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNewKey}
                      disabled={!newKeyName.trim()}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

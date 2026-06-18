"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  Truck, 
  MapPin, 
  RefreshCw,
  Filter,
  AlertCircle,
  Lock,
  DollarSign,
  Percent,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================================================
// CONSTANTS
// ============================================================================

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
  "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
  "Sokoto","Taraba","Yobe","Zamfara"
];

// ============================================================================
// TYPES
// ============================================================================

interface ArbitrageOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  buyMarket: {
    id: string;
    name: string;
    state: string;
    price: number;
    updatedAt: string;
  };
  sellMarket: {
    id: string;
    name: string;
    state: string;
    price: number;
    updatedAt: string;
  };
  grossProfit: number;
  transportCost: number;
  netProfit: number;
  profitPercentage: number;
  distance: number;
  confidence: {
    score: number;
    label: string;
    color: string;
  };
  transportLabel: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ConfidenceBadge({ score, label }: { score: number; label: string }) {
  const getBgColor = () => {
    if (score >= 75) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 50) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-mono rounded border ${getBgColor()}`}>
      {score}% {label}
    </span>
  );
}

function ProfitBadge({ percentage }: { percentage: number }) {
  const isGreat = percentage >= 10;
  const isGood = percentage >= 5;
  const isFair = percentage >= 2;
  
  return (
    <span className={`
      px-3 py-1 text-sm font-bold rounded-md
      ${isGreat ? "bg-emerald-500 text-black" : isGood ? "bg-emerald-500/20 text-emerald-400" : isFair ? "bg-amber-500/20 text-amber-400" : "bg-gray-700/50 text-gray-300"}
    `}>
      +{percentage}%
    </span>
  );
}

function OpportunityCard({ 
  opportunity, 
  expanded, 
  onToggle 
}: { 
  opportunity: ArbitrageOpportunity; 
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-emerald-500/30 transition-colors">
      {/* Main Row */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[22%_18%_2%_18%_16%_8%_3%] items-center gap-x-2">
          {/* Item Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold truncate text-sm">{opportunity.itemName}</h3>
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                {opportunity.categoryName}
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5 font-mono">
              {opportunity.unit}
            </p>
          </div>

          {/* Buy Price */}
          <div className="hidden md:block text-right">
            <p className="text-emerald-400 font-mono text-sm tabular-nums">₦{opportunity.buyMarket.price.toLocaleString()}</p>
            <p className="text-gray-500 text-[11px] truncate">{opportunity.buyMarket.name}</p>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex justify-center">
            <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
          </div>

          {/* Sell Price */}
          <div className="hidden md:block text-right">
            <p className="text-amber-400 font-mono text-sm tabular-nums">₦{opportunity.sellMarket.price.toLocaleString()}</p>
            <p className="text-gray-500 text-[11px] truncate">{opportunity.sellMarket.name}</p>
          </div>

          {/* Net Profit */}
          <div className="text-right">
            <p className="text-emerald-400 font-bold font-mono text-sm tabular-nums">
              ₦{opportunity.netProfit.toLocaleString()}
            </p>
            <p className="text-gray-500 text-[11px]">Net Profit</p>
          </div>

          {/* Profit Badge */}
          <div className="flex justify-end">
            <ProfitBadge percentage={opportunity.profitPercentage} />
          </div>

          {/* Chevron */}
          <div className="flex justify-end">
            <button className="p-1 hover:bg-gray-800 rounded">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Buy Side */}
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-emerald-400 font-semibold">BUY HERE</span>
              </div>
              <h4 className="text-white font-semibold">{opportunity.buyMarket.name}</h4>
              <p className="text-gray-500 text-sm">{opportunity.buyMarket.state}</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-2">
                ₦{opportunity.buyMarket.price.toLocaleString()}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(opportunity.buyMarket.updatedAt).toLocaleDateString()}
              </p>
            </div>

            {/* Transport */}
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
              <Truck className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-gray-400 text-sm">{opportunity.distance} km</p>
              <p className="text-white font-mono">₦{opportunity.transportCost.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">{opportunity.transportLabel}</p>
            </div>

            {/* Sell Side */}
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-amber-400 font-semibold">SELL HERE</span>
              </div>
              <h4 className="text-white font-semibold">{opportunity.sellMarket.name}</h4>
              <p className="text-gray-500 text-sm">{opportunity.sellMarket.state}</p>
              <p className="text-2xl font-bold text-amber-400 font-mono mt-2">
                ₦{opportunity.sellMarket.price.toLocaleString()}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(opportunity.sellMarket.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Profit Breakdown */}
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
            <h4 className="text-gray-400 text-sm mb-3">PROFIT BREAKDOWN</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-500 text-xs">Gross Profit</p>
                <p className="text-white font-mono">₦{opportunity.grossProfit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Transport Cost</p>
                <p className="text-red-400 font-mono">-₦{opportunity.transportCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Net Profit</p>
                <p className="text-emerald-400 font-bold font-mono">₦{opportunity.netProfit.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Data Confidence</p>
                <ConfidenceBadge score={opportunity.confidence.score} label={opportunity.confidence.label} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ArbitragePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [itemFilter, setItemFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minProfit, setMinProfit] = useState(1);
  const [buyStateFilter, setBuyStateFilter] = useState("");
  const [sellStateFilter, setSellStateFilter] = useState("");
  
  // Tier info
  const [tierInfo, setTierInfo] = useState<{
    tier: string;
    minProfitFloor: number;
    appliedMinProfit: number;
    maxResults: number;
  } | null>(null);

  // Fetch opportunities
  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tier = (session?.user as { tier?: string })?.tier || "FREE";
      const params = new URLSearchParams({
        tier,
        minProfit: String(minProfit),
        ...(itemFilter && { item: itemFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(buyStateFilter && { buyState: buyStateFilter }),
        ...(sellStateFilter && { sellState: sellStateFilter }),
      });
      
      const response = await fetch(`/api/arbitrage?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "upgrade_required") {
          setError("upgrade_required");
        } else {
          setError(data.message || "Failed to fetch opportunities");
        }
        return;
      }
      
      setOpportunities(data.data.opportunities);
      setTierInfo(data.data.tierInfo);
      
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchOpportunities();
    } else if (status === "unauthenticated") {
      // Allow guest access with FREE tier
      fetchOpportunities();
    }
  }, [status]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Upgrade Required State
  if (error === "upgrade_required") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Arbitrage Opportunities</h1>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Find profitable price spreads across Nigerian markets. This feature requires a GOLD subscription or higher.
            </p>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 md:p-6 max-w-md mx-auto">
              <h3 className="text-amber-400 font-semibold mb-4">What you get with GOLD:</h3>
              <ul className="text-left space-y-3 text-gray-300">
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  View 2%+ profit opportunities (set your own minimum)
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  Transport cost calculations
                </li>
                <li className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  Net profit analysis
                </li>
              </ul>
              <button
                onClick={() => router.push("/subscribe")}
                className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-lg transition-colors"
              >
                Upgrade to GOLD
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Arbitrage Opportunities</h1>
                  <p className="text-gray-500 text-sm font-mono">ARBI &lt;GO&gt;</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {tierInfo && (
                <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
                  {tierInfo.tier} • {tierInfo.appliedMinProfit}%+ profits • {opportunities.length} found
                  {buyStateFilter && <span className="text-emerald-400"> • from {buyStateFilter}</span>}
                  {sellStateFilter && <span className="text-amber-400"> • to {sellStateFilter}</span>}
                </span>
              )}
              <button
                onClick={fetchOpportunities}
                disabled={loading}
                className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Filter by item..."
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-40"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-gray-300"
              >
                <option value="" className="bg-[#1a1a1a]">All Food Categories</option>
                <option value="CAT001" className="bg-[#1a1a1a]">Grains & Cereals</option>
                <option value="CAT002" className="bg-[#1a1a1a]">Vegetables & Peppers</option>
                <option value="CAT003" className="bg-[#1a1a1a]">Oils & Fats</option>
                <option value="CAT004" className="bg-[#1a1a1a]">Frozen Foods & Poultry</option>
                <option value="CAT005" className="bg-[#1a1a1a]">Beverages</option>
                <option value="CAT006" className="bg-[#1a1a1a]">Plantain</option>
                <option value="CAT007" className="bg-[#1a1a1a]">Seasoning & Spices</option>
                <option value="CAT008" className="bg-[#1a1a1a]">Dried Fish & Stockfish</option>
                <option value="CAT009" className="bg-[#1a1a1a]">Flour & Bakery</option>
                <option value="CAT010" className="bg-[#1a1a1a]">Bread</option>
                <option value="CAT013" className="bg-[#1a1a1a]">Dairy & Milk</option>
                <option value="CAT014" className="bg-[#1a1a1a]">Tubers & Yam</option>
                <option value="CAT015" className="bg-[#1a1a1a]">Beans & Legumes</option>
                <option value="CAT070" className="bg-[#1a1a1a]">Poultry & Livestock</option>
                <option value="CAT103" className="bg-[#1a1a1a]">Fish (NBS)</option>
              </select>
            </div>
            
            {/* Min Profit Margin Selector */}
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2">
              <Percent className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500 text-sm">Min Profit:</span>
              <select
                value={minProfit}
                onChange={(e) => setMinProfit(Number(e.target.value))}
                className="bg-transparent border-none outline-none text-sm text-emerald-400 font-mono cursor-pointer"
              >
                <option value={0} className="bg-[#1a1a1a]">0% (All)</option>
                <option value={1} className="bg-[#1a1a1a]">1%+</option>
                <option value={2} className="bg-[#1a1a1a]">2%+</option>
                <option value={3} className="bg-[#1a1a1a]">3%+</option>
                <option value={5} className="bg-[#1a1a1a]">5%+</option>
                <option value={10} className="bg-[#1a1a1a]">10%+</option>
                <option value={15} className="bg-[#1a1a1a]">15%+</option>
                <option value={20} className="bg-[#1a1a1a]">20%+</option>
              </select>
            </div>

            {/* Buy From State */}
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2">
              <TrendingDown className="w-4 h-4 text-emerald-500/60" />
              <select
                value={buyStateFilter}
                onChange={(e) => setBuyStateFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-gray-300 cursor-pointer"
              >
                <option value="" className="bg-[#1a1a1a]">Buy from: Any State</option>
                {NIGERIAN_STATES.map(s => (
                  <option key={`buy-${s}`} value={s} className="bg-[#1a1a1a]">{s}</option>
                ))}
              </select>
            </div>

            {/* Sell To State */}
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-amber-500/60" />
              <select
                value={sellStateFilter}
                onChange={(e) => setSellStateFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-gray-300 cursor-pointer"
              >
                <option value="" className="bg-[#1a1a1a]">Sell to: Any State</option>
                {NIGERIAN_STATES.map(s => (
                  <option key={`sell-${s}`} value={s} className="bg-[#1a1a1a]">{s}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={fetchOpportunities}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Scanning markets for opportunities...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
              <p className="text-gray-400">{error}</p>
              <button
                onClick={fetchOpportunities}
                className="mt-4 text-emerald-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No opportunities found matching your criteria</p>
              <p className="text-gray-500 text-sm mt-2">
                Try adjusting your filters or check back later
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column Headers */}
            <div className="hidden md:grid grid-cols-[22%_18%_2%_18%_16%_8%_3%] items-center gap-x-2 px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
              <div>Commodity</div>
              <div className="text-right">Buy From</div>
              <div></div>
              <div className="text-right">Sell To</div>
              <div className="text-right">Net Profit</div>
              <div className="text-right">ROI</div>
              <div></div>
            </div>
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                expanded={expandedId === opp.id}
                onToggle={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-gray-500 text-xs text-center">
            Transport costs based on 2024-2025 Nigeria logistics rates. Data confidence reflects price freshness. 
            Always verify prices before making trading decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

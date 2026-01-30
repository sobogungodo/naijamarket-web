// src/app/dashboard/analytics-pro/page.tsx
// NAIJAMARKET INTEL - Enhanced Analytics Dashboard (Bloomberg-Style)
// Version: 2.0
// Features: Market Heatmap, Volatility Tracker, Commodity Comparison, NFPI Deep-Dive

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, 
  ComposedChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, Map, BarChart3,
  Calendar, Download, ExternalLink, RefreshCw, Filter,
  ChevronDown, AlertTriangle, CheckCircle, Clock,
  Zap, Target, Globe, Layers
} from 'lucide-react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface NFPIData {
  index_date: string;
  nfpi_value: number;
  nfpi_northwest: number;
  nfpi_northeast: number;
  nfpi_northcentral: number;
  nfpi_southwest: number;
  nfpi_southeast: number;
  nfpi_southsouth: number;
  daily_change: number;
  nfpi_7day_ma: number;
}

interface TopMover {
  item_name: string;
  market_name: string;
  category: string;
  current_avg_price: number;
  price_change_percent: number;
  movement_type: 'GAINER' | 'LOSER' | 'STABLE';
}

interface MarketHeatmapData {
  market_name: string;
  state: string;
  region: string;
  latitude: number;
  longitude: number;
  activity_score: number;
  coverage_percent: number;
  hours_since_update: number;
  data_status: 'ACTIVE' | 'STALE' | 'INACTIVE';
  items_tracked: number;
  active_traders: number;
}

interface VolatilityData {
  price_date: string;
  item_name: string;
  market_name: string;
  current_price: number;
  daily_change_percent: number;
  weekly_change_percent: number;
  volatility_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface PlatformKPIs {
  active_traders: number;
  active_validators: number;
  active_consumers: number;
  submissions_today: number;
  submissions_week: number;
  submissions_month: number;
  approval_rate_30d: number;
  markets_active_week: number;
  total_markets: number;
  items_active_week: number;
  total_items: number;
  minutes_since_last_price: number;
}

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_FEATURES: Record<string, {
  daysAccess: number;
  hasHeatmap: boolean;
  hasVolatility: boolean;
  hasComparison: boolean;
  hasPowerBI: boolean;
  hasExport: boolean;
  maxComparisons: number;
}> = {
  FREE: { daysAccess: 3, hasHeatmap: false, hasVolatility: false, hasComparison: false, hasPowerBI: false, hasExport: false, maxComparisons: 0 },
  SILVER: { daysAccess: 7, hasHeatmap: false, hasVolatility: false, hasComparison: true, hasPowerBI: false, hasExport: false, maxComparisons: 2 },
  GOLD: { daysAccess: 14, hasHeatmap: true, hasVolatility: false, hasComparison: true, hasPowerBI: false, hasExport: true, maxComparisons: 5 },
  BUSINESS: { daysAccess: 30, hasHeatmap: true, hasVolatility: true, hasComparison: true, hasPowerBI: false, hasExport: true, maxComparisons: 10 },
  CORPORATE: { daysAccess: 90, hasHeatmap: true, hasVolatility: true, hasComparison: true, hasPowerBI: false, hasExport: true, maxComparisons: 20 },
  ENTERPRISE: { daysAccess: 365, hasHeatmap: true, hasVolatility: true, hasComparison: true, hasPowerBI: true, hasExport: true, maxComparisons: 999 },
};

// =============================================================================
// COLOR SCHEMES (Bloomberg-inspired)
// =============================================================================

const COLORS = {
  primary: '#FF6B00',      // NaijaMarket Orange
  secondary: '#1E3A5F',    // Deep Blue
  success: '#10B981',      // Green
  danger: '#EF4444',       // Red
  warning: '#F59E0B',      // Amber
  neutral: '#6B7280',      // Gray
  
  // Regional colors
  northwest: '#3B82F6',
  northeast: '#8B5CF6', 
  northcentral: '#EC4899',
  southwest: '#F97316',
  southeast: '#14B8A6',
  southsouth: '#84CC16',
  
  // Chart gradients
  gradient1: ['#FF6B00', '#FF8C40'],
  gradient2: ['#1E3A5F', '#3B5998'],
  
  // Heatmap colors
  heatmapActive: '#10B981',
  heatmapStale: '#F59E0B',
  heatmapInactive: '#EF4444',
};

const REGION_COLORS: Record<string, string> = {
  'North-West': COLORS.northwest,
  'North-East': COLORS.northeast,
  'North-Central': COLORS.northcentral,
  'South-West': COLORS.southwest,
  'South-East': COLORS.southeast,
  'South-South': COLORS.southsouth,
};

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
  </div>
);

const FeatureLocked = ({ feature, requiredTier }: { feature: string; requiredTier: string }) => (
  <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-700 flex flex-col items-center justify-center min-h-[300px]">
    <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
      <Zap className="w-8 h-8 text-orange-500" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{feature}</h3>
    <p className="text-gray-400 text-center mb-4">
      Upgrade to {requiredTier} tier to unlock this feature
    </p>
    <a 
      href="/subscribe" 
      className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
    >
      Upgrade Now
    </a>
  </div>
);

const KPICard = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  change?: number; 
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
        <Icon className="w-6 h-6 text-orange-500" />
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${
          trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
           trend === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
    </div>
    <div className="text-3xl font-bold text-white mb-1">{value}</div>
    <div className="text-sm text-gray-400">{title}</div>
  </div>
);

// =============================================================================
// CHART COMPONENTS
// =============================================================================

// NFPI Trend Chart with Regional Breakdown
const NFPITrendChart = ({ data, daysAccess }: { data: NFPIData[]; daysAccess: number }) => {
  const [showRegions, setShowRegions] = useState(false);
  
  const filteredData = data.slice(0, daysAccess);
  
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">NaijaFood Price Index (NFPI)</h3>
          <p className="text-sm text-gray-400">Tracking {daysAccess} days of price movements</p>
        </div>
        <button
          onClick={() => setShowRegions(!showRegions)}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <Layers className="w-4 h-4" />
          {showRegions ? 'Hide Regions' : 'Show Regions'}
        </button>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData}>
            <defs>
              <linearGradient id="nfpiGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="index_date" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F3F4F6'
              }}
              formatter={(value: number) => [value.toFixed(2), '']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            />
            <Legend />
            
            {/* Main NFPI Line */}
            <Area
              type="monotone"
              dataKey="nfpi_value"
              name="NFPI"
              stroke={COLORS.primary}
              strokeWidth={3}
              fill="url(#nfpiGradient)"
            />
            
            {/* 7-Day Moving Average */}
            <Line
              type="monotone"
              dataKey="nfpi_7day_ma"
              name="7-Day MA"
              stroke={COLORS.warning}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
            
            {/* Regional Lines (conditional) */}
            {showRegions && (
              <>
                <Line type="monotone" dataKey="nfpi_northwest" name="North-West" stroke={COLORS.northwest} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="nfpi_northeast" name="North-East" stroke={COLORS.northeast} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="nfpi_northcentral" name="North-Central" stroke={COLORS.northcentral} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="nfpi_southwest" name="South-West" stroke={COLORS.southwest} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="nfpi_southeast" name="South-East" stroke={COLORS.southeast} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="nfpi_southsouth" name="South-South" stroke={COLORS.southsouth} strokeWidth={1.5} dot={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* NFPI Summary Stats */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {filteredData[0]?.nfpi_value?.toFixed(2) || '-'}
            </div>
            <div className="text-xs text-gray-400">Current NFPI</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              (filteredData[0]?.daily_change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {filteredData[0]?.daily_change >= 0 ? '+' : ''}{filteredData[0]?.daily_change?.toFixed(2) || '0'}
            </div>
            <div className="text-xs text-gray-400">Daily Change</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {filteredData[0]?.nfpi_7day_ma?.toFixed(2) || '-'}
            </div>
            <div className="text-xs text-gray-400">7-Day MA</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {filteredData.length}
            </div>
            <div className="text-xs text-gray-400">Days Tracked</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Market Heatmap Component
const MarketHeatmap = ({ data }: { data: MarketHeatmapData[] }) => {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  
  const regions = [...new Set(data.map(m => m.region))];
  const filteredData = selectedRegion 
    ? data.filter(m => m.region === selectedRegion)
    : data;
  
  // Treemap data structure
  const treemapData = regions.map(region => ({
    name: region,
    children: data
      .filter(m => m.region === region)
      .map(m => ({
        name: m.market_name,
        size: m.activity_score,
        state: m.state,
        status: m.data_status,
        items: m.items_tracked,
        traders: m.active_traders,
        coverage: m.coverage_percent,
      }))
  }));
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return COLORS.heatmapActive;
      case 'STALE': return COLORS.heatmapStale;
      case 'INACTIVE': return COLORS.heatmapInactive;
      default: return COLORS.neutral;
    }
  };
  
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, status, coverage } = props;
    
    if (width < 50 || height < 30) return null;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: getStatusColor(status),
            stroke: '#1F2937',
            strokeWidth: 2,
            opacity: 0.8,
          }}
        />
        {width > 80 && height > 40 && (
          <>
            <text
              x={x + width / 2}
              y={y + height / 2 - 8}
              textAnchor="middle"
              fill="#fff"
              fontSize={12}
              fontWeight="bold"
            >
              {name?.substring(0, 15)}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#fff"
              fontSize={10}
            >
              {coverage?.toFixed(0)}% coverage
            </text>
          </>
        )}
      </g>
    );
  };
  
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-orange-500" />
            Market Activity Heatmap
          </h3>
          <p className="text-sm text-gray-400">Real-time market coverage and activity</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={selectedRegion || ''}
            onChange={(e) => setSelectedRegion(e.target.value || null)}
            className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
          >
            <option value="">All Regions</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Status Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-400">Active (&lt;24h)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-sm text-gray-400">Stale (24-72h)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-400">Inactive (&gt;72h)</span>
        </div>
      </div>
      
      {/* Treemap Visualization */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#1F2937"
            content={<CustomTreemapContent />}
          />
        </ResponsiveContainer>
      </div>
      
      {/* Market Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">
            {data.filter(m => m.data_status === 'ACTIVE').length}
          </div>
          <div className="text-xs text-gray-400">Active Markets</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-500">
            {data.filter(m => m.data_status === 'STALE').length}
          </div>
          <div className="text-xs text-gray-400">Stale Markets</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {data.reduce((sum, m) => sum + m.active_traders, 0)}
          </div>
          <div className="text-xs text-gray-400">Active Traders</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">
            {(data.reduce((sum, m) => sum + m.coverage_percent, 0) / data.length).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400">Avg Coverage</div>
        </div>
      </div>
    </div>
  );
};

// Volatility Tracker Component
const VolatilityTracker = ({ data }: { data: VolatilityData[] }) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  const items = [...new Set(data.map(d => d.item_name))];
  const filteredData = selectedItem 
    ? data.filter(d => d.item_name === selectedItem)
    : data;
  
  // Group by item for the volatility overview
  const itemVolatility = items.map(item => {
    const itemData = data.filter(d => d.item_name === item);
    const avgDaily = itemData.reduce((sum, d) => sum + Math.abs(d.daily_change_percent), 0) / itemData.length;
    const avgWeekly = itemData.reduce((sum, d) => sum + Math.abs(d.weekly_change_percent), 0) / itemData.length;
    const highVolCount = itemData.filter(d => d.volatility_level === 'HIGH').length;
    
    return {
      item,
      avgDailyVolatility: avgDaily,
      avgWeeklyVolatility: avgWeekly,
      highVolatilityDays: highVolCount,
      volatilityScore: avgDaily * 0.5 + avgWeekly * 0.3 + (highVolCount / itemData.length) * 20,
    };
  }).sort((a, b) => b.volatilityScore - a.volatilityScore);
  
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Price Volatility Tracker
          </h3>
          <p className="text-sm text-gray-400">Monitor price stability across commodities</p>
        </div>
        
        <select
          value={selectedItem || ''}
          onChange={(e) => setSelectedItem(e.target.value || null)}
          className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600"
        >
          <option value="">All Commodities</option>
          {items.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volatility Bar Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={itemVolatility.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9CA3AF" />
              <YAxis 
                type="category" 
                dataKey="item" 
                stroke="#9CA3AF"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Bar 
                dataKey="avgDailyVolatility" 
                name="Daily Volatility %" 
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Volatility Radar Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={itemVolatility.slice(0, 6)}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="item" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis stroke="#9CA3AF" />
              <Radar
                name="Volatility Score"
                dataKey="volatilityScore"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.3}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Volatility Alerts */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-3">⚠️ High Volatility Alerts</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data
            .filter(d => d.volatility_level === 'HIGH')
            .slice(0, 6)
            .map((alert, idx) => (
              <div 
                key={idx}
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{alert.item_name}</span>
                  <span className={`text-sm ${alert.daily_change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {alert.daily_change_percent >= 0 ? '+' : ''}{alert.daily_change_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{alert.market_name}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// Top Movers Component
const TopMovers = ({ gainers, losers }: { gainers: TopMover[]; losers: TopMover[] }) => {
  const [view, setView] = useState<'gainers' | 'losers'>('gainers');
  
  const movers = view === 'gainers' ? gainers : losers;
  
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Top Movers</h3>
        
        <div className="flex bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setView('gainers')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'gainers' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'losers' 
                ? 'bg-red-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingDown className="w-4 h-4 inline mr-1" />
            Losers
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        {movers.slice(0, 8).map((mover, idx) => (
          <div 
            key={idx}
            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-mono w-6">{idx + 1}</span>
              <div>
                <div className="font-medium text-white">{mover.item_name}</div>
                <div className="text-xs text-gray-400">{mover.market_name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-white">
                ₦{mover.current_avg_price.toLocaleString()}
              </div>
              <div className={`text-sm ${
                mover.price_change_percent >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {mover.price_change_percent >= 0 ? '+' : ''}{mover.price_change_percent.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Power BI Link Button (ENTERPRISE only)
const PowerBILink = () => {
  const powerbiUrl = process.env.NEXT_PUBLIC_POWERBI_REPORT_URL;
  
  return (
    <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-6 border border-blue-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Power BI Executive Dashboard
          </h3>
          <p className="text-sm text-blue-200 mt-1">
            Advanced analytics with drill-down capabilities
          </p>
        </div>
        <a
          href={powerbiUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-white text-blue-900 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
        >
          Open in Power BI
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">Executive</div>
          <div className="text-xs text-blue-200">KPI Overview</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">Trader</div>
          <div className="text-xs text-blue-200">Performance</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">Market</div>
          <div className="text-xs text-blue-200">Intelligence</div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function AnalyticsProPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Data states
  const [nfpiData, setNfpiData] = useState<NFPIData[]>([]);
  const [gainers, setGainers] = useState<TopMover[]>([]);
  const [losers, setLosers] = useState<TopMover[]>([]);
  const [heatmapData, setHeatmapData] = useState<MarketHeatmapData[]>([]);
  const [volatilityData, setVolatilityData] = useState<VolatilityData[]>([]);
  const [kpis, setKpis] = useState<PlatformKPIs | null>(null);
  
  // User tier (from session or default)
  const userTier = (session?.user as any)?.subscription_tier || 'FREE';
  const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES.FREE;
  
  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch(`/api/analytics-pro?tier=${userTier}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      
      setNfpiData(data.nfpi || []);
      setGainers(data.gainers || []);
      setLosers(data.losers || []);
      setHeatmapData(data.heatmap || []);
      setVolatilityData(data.volatility || []);
      setKpis(data.kpis || null);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userTier]);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchDashboardData();
      
      // Auto-refresh every 5 minutes
      const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [status, router, fetchDashboardData]);
  
  // Export handler
  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    if (!tierFeatures.hasExport) {
      alert('Export requires GOLD tier or higher. Please upgrade.');
      return;
    }
    
    window.location.href = `/api/export?type=analytics&format=${format}&tier=${userTier}`;
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Target className="w-6 h-6 text-orange-500" />
                Analytics Pro
              </h1>
              <p className="text-sm text-gray-400">
                {userTier} tier • {tierFeatures.daysAccess} days data access
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Last Updated */}
              {lastUpdated && (
                <div className="text-sm text-gray-400 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              
              {/* Refresh Button */}
              <button
                onClick={fetchDashboardData}
                disabled={refreshing}
                className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Export Dropdown */}
              {tierFeatures.hasExport && (
                <div className="relative group">
                  <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden group-hover:block">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 rounded-t-lg"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 rounded-b-lg"
                    >
                      Export as Excel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* KPI Cards Row */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard
              title="Active Traders"
              value={kpis.active_traders.toLocaleString()}
              icon={Activity}
            />
            <KPICard
              title="Submissions Today"
              value={kpis.submissions_today.toLocaleString()}
              change={((kpis.submissions_today / (kpis.submissions_week / 7)) - 1) * 100}
              trend={kpis.submissions_today > (kpis.submissions_week / 7) ? 'up' : 'down'}
              icon={TrendingUp}
            />
            <KPICard
              title="Markets Active"
              value={`${kpis.markets_active_week}/${kpis.total_markets}`}
              icon={Globe}
            />
            <KPICard
              title="Data Freshness"
              value={kpis.minutes_since_last_price < 60 ? `${kpis.minutes_since_last_price}m` : `${Math.round(kpis.minutes_since_last_price / 60)}h`}
              icon={Clock}
              trend={kpis.minutes_since_last_price < 30 ? 'up' : 'down'}
            />
          </div>
        )}
        
        {/* Power BI Link (ENTERPRISE only) */}
        {tierFeatures.hasPowerBI && (
          <div className="mb-8">
            <PowerBILink />
          </div>
        )}
        
        {/* NFPI Trend Chart (All tiers) */}
        <div className="mb-8">
          <NFPITrendChart data={nfpiData} daysAccess={tierFeatures.daysAccess} />
        </div>
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Movers */}
          <TopMovers gainers={gainers} losers={losers} />
          
          {/* Market Heatmap */}
          {tierFeatures.hasHeatmap ? (
            <MarketHeatmap data={heatmapData} />
          ) : (
            <FeatureLocked feature="Market Activity Heatmap" requiredTier="GOLD" />
          )}
        </div>
        
        {/* Volatility Tracker (BUSINESS+) */}
        <div className="mb-8">
          {tierFeatures.hasVolatility ? (
            <VolatilityTracker data={volatilityData} />
          ) : (
            <FeatureLocked feature="Price Volatility Tracker" requiredTier="BUSINESS" />
          )}
        </div>
        
        {/* Upgrade CTA for non-ENTERPRISE */}
        {userTier !== 'ENTERPRISE' && (
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-8 border border-orange-500/30 text-center">
            <h3 className="text-2xl font-bold text-white mb-2">
              Unlock Full Analytics Power
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Upgrade to ENTERPRISE for 365 days of historical data, Power BI integration, 
              unlimited exports, and priority support.
            </p>
            <a
              href="/subscribe"
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              <Zap className="w-5 h-5" />
              Upgrade to ENTERPRISE
            </a>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>NaijaMarket Intel © 2026 | Data refreshes every 5 minutes</p>
          <p className="mt-1">
            Powered by Giggababytes Oy • Built for Nigerian commodity markets
          </p>
        </div>
      </footer>
    </div>
  );
}

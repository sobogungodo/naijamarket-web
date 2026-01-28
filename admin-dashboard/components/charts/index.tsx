'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { cn, formatNaira, formatCompactNumber } from '@/lib/utils';

// ============================================
// CHART COLORS
// ============================================

export const CHART_COLORS = {
  primary: '#008751',     // Naija green
  secondary: '#fcd116',   // Naija gold
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  red: '#ef4444',
  gray: '#6b7280',
};

export const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.cyan,
];

// ============================================
// CUSTOM TOOLTIP
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}

export function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-dash-card border border-dash-border rounded-lg p-3 shadow-xl">
      {label && (
        <p className="text-sm font-medium text-dash-text mb-2">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-dash-muted">{entry.name}:</span>
            <span className="font-mono text-dash-text">
              {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// AREA CHART COMPONENT
// ============================================

interface AreaChartData {
  name: string;
  [key: string]: string | number;
}

interface AreaChartProps {
  data: AreaChartData[];
  dataKeys: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  gradient?: boolean;
  stacked?: boolean;
  formatter?: (value: number, name: string) => string;
  className?: string;
}

export function AreaChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  gradient = true,
  stacked = false,
  formatter,
  className,
}: AreaChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {gradient && (
            <defs>
              {dataKeys.map((dk, index) => (
                <linearGradient key={dk.key} id={`gradient-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
          )}
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
          )}
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCompactNumber(value)}
          />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
          {dataKeys.map((dk, index) => (
            <Area
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              name={dk.name}
              stroke={dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              fill={gradient ? `url(#gradient-${dk.key})` : dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              fillOpacity={gradient ? 1 : 0.2}
              strokeWidth={2}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// LINE CHART COMPONENT
// ============================================

interface LineChartProps {
  data: AreaChartData[];
  dataKeys: Array<{
    key: string;
    name: string;
    color?: string;
    dashed?: boolean;
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  formatter?: (value: number, name: string) => string;
  className?: string;
}

export function LineChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  showDots = true,
  formatter,
  className,
}: LineChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
          )}
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCompactNumber(value)}
          />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
          {dataKeys.map((dk, index) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              name={dk.name}
              stroke={dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              strokeWidth={2}
              strokeDasharray={dk.dashed ? '5 5' : undefined}
              dot={showDots ? { fill: dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length], r: 4 } : false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// BAR CHART COMPONENT
// ============================================

interface BarChartProps {
  data: AreaChartData[];
  dataKeys: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  layout?: 'vertical' | 'horizontal';
  formatter?: (value: number, name: string) => string;
  className?: string;
}

export function BarChartComponent({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  layout = 'horizontal',
  formatter,
  className,
}: BarChartProps) {
  const isVertical = layout === 'vertical';

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: isVertical ? 80 : 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
          )}
          {isVertical ? (
            <>
              <XAxis
                type="number"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompactNumber(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompactNumber(value)}
              />
            </>
          )}
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
          {dataKeys.map((dk, index) => (
            <Bar
              key={dk.key}
              dataKey={dk.key}
              name={dk.name}
              fill={dk.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              radius={[4, 4, 0, 0]}
              stackId={stacked ? 'stack' : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// PIE/DONUT CHART COMPONENT
// ============================================

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  formatter?: (value: number, name: string) => string;
  className?: string;
  centerLabel?: string;
  centerValue?: string | number;
}

export function PieChartComponent({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 80,
  showLegend = true,
  showLabels = false,
  formatter,
  className,
  centerLabel,
  centerValue,
}: PieChartProps) {
  return (
    <div className={cn('w-full relative', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={showLabels ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : undefined}
            labelLine={showLabels}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              return (
                <div className="bg-dash-card border border-dash-border rounded-lg p-3 shadow-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.payload.color || CHART_COLOR_ARRAY[0] }}
                    />
                    <span className="text-dash-muted">{item.name}:</span>
                    <span className="font-mono text-dash-text">
                      {formatter ? formatter(item.value as number, item.name as string) : (item.value as number).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center label for donut chart */}
      {centerLabel && innerRadius > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            {centerValue && (
              <div className="text-2xl font-bold text-dash-text font-mono">
                {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
              </div>
            )}
            <div className="text-xs text-dash-muted uppercase tracking-wide">
              {centerLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSED CHART (MIXED BAR + LINE)
// ============================================

interface ComposedChartProps {
  data: AreaChartData[];
  bars: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  lines: Array<{
    key: string;
    name: string;
    color?: string;
    yAxisId?: string;
  }>;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showSecondYAxis?: boolean;
  formatter?: (value: number, name: string) => string;
  className?: string;
}

export function ComposedChartComponent({
  data,
  bars,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  showSecondYAxis = false,
  formatter,
  className,
}: ComposedChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: showSecondYAxis ? 60 : 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.5} />
          )}
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCompactNumber(value)}
          />
          {showSecondYAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompactNumber(value)}
            />
          )}
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
              iconType="circle"
            />
          )}
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color || CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length]}
              radius={[4, 4, 0, 0]}
              yAxisId="left"
            />
          ))}
          {lines.map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || CHART_COLOR_ARRAY[(bars.length + index) % CHART_COLOR_ARRAY.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              yAxisId={line.yAxisId || 'left'}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// MINI SPARKLINE CHART
// ============================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showArea?: boolean;
}

export function Sparkline({
  data,
  color = CHART_COLORS.primary,
  height = 40,
  width = 100,
  showArea = true,
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={showArea ? `url(#sparkline-gradient-${color.replace('#', '')})` : 'transparent'}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

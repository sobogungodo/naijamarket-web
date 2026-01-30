/**
 * ============================================================================
 * NAIJAMARKET INTEL - DATA FETCHING HOOKS
 * ============================================================================
 * 
 * React hooks for fetching data from the API routes.
 * Uses SWR for caching and revalidation.
 * 
 * Usage:
 *   const { data, error, isLoading, mutate } = useDashboardStats();
 *   const { data: validators } = useValidators({ status: 'ACTIVE' });
 * 
 * ============================================================================
 */

'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  return res.json();
};

const postFetcher = async (url: string, data: object) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = new Error('An error occurred while posting the data.');
    throw error;
  }
  return res.json();
};

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  totalTraders: number;
  activeTraders: number;
  totalValidators: number;
  activeValidators: number;
  totalSubmissions: number;
  submissionsToday: number;
  pendingValidations: number;
  approvalRate: number;
  totalEarningsDistributed: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
  weeklyPayoutAmount: number;
  totalFraudAlerts: number;
  criticalAlerts: number;
  unresolvedAlerts: number;
  resolutionRate: number;
  activeMarkets: number;
  topMarketBySubmissions: string;
}

export interface Validator {
  validator_id: string;
  phone_number: string;
  full_name: string;
  market_id: string;
  market_name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING';
  tier: string;
  total_votes: number;
  correct_votes: number;
  accuracy_rate: number;
  avg_response_time_sec: number;
  total_earnings: number;
  pending_balance: number;
  registered_at: string;
  last_vote_at: string;
}

export interface Trader {
  trader_id: string;
  phone_number: string;
  full_name: string;
  market_id: string;
  market_name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING';
  reputation_score: number;
  total_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  total_earnings: number;
  pending_balance: number;
  registered_at: string;
  last_submission_at: string;
}

export interface FraudAlert {
  alert_id: string;
  alert_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  user_id: string;
  user_phone: string;
  user_name: string;
  user_type: 'TRADER' | 'VALIDATOR';
  market_id: string;
  market_name: string;
  description: string;
  evidence: object;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface Payout {
  payout_id: string;
  user_id: string;
  user_phone: string;
  user_name: string;
  user_type: 'TRADER' | 'VALIDATOR';
  amount: number;
  payment_method: string;
  bank_name?: string;
  account_number?: string;
  network?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failure_reason?: string;
  retry_count: number;
  transaction_ref?: string;
  created_at: string;
  processed_at?: string;
}

export interface PlatformConfig {
  version: string;
  validation: {
    timeoutMinutes: number;
    validatorsRequired: number;
    consensusRequired: number;
    maxDailyValidations: number;
  };
  rewards: {
    traderApprovedSubmission: number;
    validatorCorrectVote: number;
  };
  payout: {
    minimumBalance: number;
    frequencyDays: number;
    maxRetries: number;
  };
  gps: {
    defaultMarketRadius: number;
    maxGpsAgeSeconds: number;
  };
  fraudDetection: {
    enabled: boolean;
    priceDeviationThreshold: number;
    collusionWindowDays: number;
  };
}

// ============================================================================
// HOOKS
// ============================================================================

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 60000, // 1 minute
};

/**
 * Fetch dashboard statistics
 */
export function useDashboardStats(config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: DashboardStats }>(
    '/api/dashboard/stats',
    fetcher,
    { ...defaultConfig, ...config }
  );
  
  return {
    stats: data?.data,
    error,
    isLoading,
    mutate,
  };
}

/**
 * Fetch validators with optional filters
 */
export function useValidators(
  filters?: { status?: string; market?: string; search?: string },
  config?: SWRConfiguration
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.market) params.set('market', filters.market);
  if (filters?.search) params.set('search', filters.search);
  
  const url = `/api/validators${params.toString() ? `?${params}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: Validator[];
    pagination: { total: number; limit: number; offset: number };
  }>(url, fetcher, { ...defaultConfig, ...config });
  
  const suspendValidator = useCallback(
    async (validatorId: string, reason: string, adminId: string) => {
      const result = await postFetcher('/api/validators', {
        action: 'suspend',
        validatorId,
        reason,
        adminId,
      });
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  return {
    validators: data?.data || [],
    total: data?.pagination?.total || 0,
    error,
    isLoading,
    mutate,
    suspendValidator,
  };
}

/**
 * Fetch traders with optional filters
 */
export function useTraders(
  filters?: { status?: string; market?: string; search?: string; minReputation?: number },
  config?: SWRConfiguration
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.market) params.set('market', filters.market);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.minReputation) params.set('minReputation', String(filters.minReputation));
  
  const url = `/api/traders${params.toString() ? `?${params}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: Trader[];
    pagination: { total: number; limit: number; offset: number };
  }>(url, fetcher, { ...defaultConfig, ...config });
  
  const suspendTrader = useCallback(
    async (traderId: string, reason: string, adminId: string) => {
      const result = await postFetcher('/api/traders', {
        action: 'suspend',
        traderId,
        reason,
        adminId,
      });
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  return {
    traders: data?.data || [],
    total: data?.pagination?.total || 0,
    error,
    isLoading,
    mutate,
    suspendTrader,
  };
}

/**
 * Fetch fraud alerts with optional filters
 */
export function useFraudAlerts(
  filters?: { status?: string; severity?: string; type?: string },
  config?: SWRConfiguration
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.type) params.set('type', filters.type);
  
  const url = `/api/fraud${params.toString() ? `?${params}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: FraudAlert[];
    stats: { total: number; critical: number; pending: number };
    pagination: { total: number };
  }>(url, fetcher, { ...defaultConfig, refreshInterval: 30000, ...config }); // Refresh every 30s for fraud
  
  const resolveAlert = useCallback(
    async (alertId: string, resolution: 'RESOLVED' | 'DISMISSED', notes: string, adminId: string) => {
      const result = await postFetcher('/api/fraud', {
        action: 'resolve',
        alertId,
        resolution,
        notes,
        adminId,
      });
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  return {
    alerts: data?.data || [],
    stats: data?.stats,
    total: data?.pagination?.total || 0,
    error,
    isLoading,
    mutate,
    resolveAlert,
  };
}

/**
 * Fetch payouts with optional filters
 */
export function usePayouts(
  filters?: { status?: string; userType?: string },
  config?: SWRConfiguration
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.userType) params.set('userType', filters.userType);
  
  const url = `/api/payouts${params.toString() ? `?${params}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: Payout[];
    stats: {
      totalPending: number;
      pendingAmount: number;
      totalCompleted: number;
      totalFailed: number;
    };
    config: {
      minimumBalance: number;
      frequencyDays: number;
      maxRetries: number;
    };
  }>(url, fetcher, { ...defaultConfig, ...config });
  
  const retryPayout = useCallback(
    async (payoutId: string) => {
      const result = await postFetcher('/api/payouts', {
        action: 'retry',
        payoutId,
      });
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  const processBatch = useCallback(
    async (payoutIds: string[]) => {
      const result = await postFetcher('/api/payouts', {
        action: 'batch',
        payoutIds,
      });
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  return {
    payouts: data?.data || [],
    stats: data?.stats,
    payoutConfig: data?.config,
    error,
    isLoading,
    mutate,
    retryPayout,
    processBatch,
  };
}

/**
 * Fetch platform configuration
 */
export function usePlatformConfig(config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: PlatformConfig;
  }>('/api/config', fetcher, { ...defaultConfig, refreshInterval: 300000, ...config }); // Refresh every 5 mins
  
  const updateConfig = useCallback(
    async (section: string, updates: object, adminId: string) => {
      const result = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, updates, adminId }),
      }).then(r => r.json());
      
      if (result.success) mutate();
      return result;
    },
    [mutate]
  );
  
  return {
    config: data?.data,
    error,
    isLoading,
    mutate,
    updateConfig,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Combined hook for user management (both traders and validators)
 */
export function useUsers(
  type: 'traders' | 'validators' | 'all',
  filters?: { status?: string; market?: string; search?: string }
) {
  const tradersResult = useTraders(type !== 'validators' ? filters : undefined);
  const validatorsResult = useValidators(type !== 'traders' ? filters : undefined);
  
  if (type === 'traders') {
    return {
      users: tradersResult.traders.map(t => ({ ...t, userType: 'TRADER' as const })),
      total: tradersResult.total,
      isLoading: tradersResult.isLoading,
      error: tradersResult.error,
    };
  }
  
  if (type === 'validators') {
    return {
      users: validatorsResult.validators.map(v => ({ ...v, userType: 'VALIDATOR' as const })),
      total: validatorsResult.total,
      isLoading: validatorsResult.isLoading,
      error: validatorsResult.error,
    };
  }
  
  // All users
  return {
    users: [
      ...tradersResult.traders.map(t => ({ ...t, userType: 'TRADER' as const })),
      ...validatorsResult.validators.map(v => ({ ...v, userType: 'VALIDATOR' as const })),
    ],
    total: tradersResult.total + validatorsResult.total,
    isLoading: tradersResult.isLoading || validatorsResult.isLoading,
    error: tradersResult.error || validatorsResult.error,
  };
}

export default {
  useDashboardStats,
  useValidators,
  useTraders,
  useFraudAlerts,
  usePayouts,
  usePlatformConfig,
  useUsers,
};

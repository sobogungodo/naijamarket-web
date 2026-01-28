// ============================================
// NAIJAMARKET ADMIN DASHBOARD - TYPE DEFINITIONS
// ============================================

// ----- USER & AUTH TYPES -----
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  avatar?: string;
  lastLogin: Date;
  createdAt: Date;
  isActive: boolean;
}

export type AdminRole = 'super_admin' | 'admin' | 'supervisor' | 'analyst' | 'viewer';

export interface AdminPermissions {
  canViewDashboard: boolean;
  canViewFraud: boolean;
  canTakeAction: boolean;
  canManageUsers: boolean;
  canApprovePayouts: boolean;
  canViewFinancials: boolean;
  canExportData: boolean;
  canChangeSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  super_admin: {
    canViewDashboard: true,
    canViewFraud: true,
    canTakeAction: true,
    canManageUsers: true,
    canApprovePayouts: true,
    canViewFinancials: true,
    canExportData: true,
    canChangeSettings: true,
  },
  admin: {
    canViewDashboard: true,
    canViewFraud: true,
    canTakeAction: true,
    canManageUsers: true,
    canApprovePayouts: true,
    canViewFinancials: true,
    canExportData: true,
    canChangeSettings: false,
  },
  supervisor: {
    canViewDashboard: true,
    canViewFraud: true,
    canTakeAction: true,
    canManageUsers: false,
    canApprovePayouts: false,
    canViewFinancials: true,
    canExportData: true,
    canChangeSettings: false,
  },
  analyst: {
    canViewDashboard: true,
    canViewFraud: true,
    canTakeAction: false,
    canManageUsers: false,
    canApprovePayouts: false,
    canViewFinancials: true,
    canExportData: true,
    canChangeSettings: false,
  },
  viewer: {
    canViewDashboard: true,
    canViewFraud: false,
    canTakeAction: false,
    canManageUsers: false,
    canApprovePayouts: false,
    canViewFinancials: false,
    canExportData: false,
    canChangeSettings: false,
  },
};

// ----- DASHBOARD STATS TYPES -----
export interface DashboardStats {
  overview: OverviewStats;
  trends: TrendData[];
  recentActivity: ActivityItem[];
  alerts: SystemAlert[];
}

export interface OverviewStats {
  // User metrics
  totalTraders: number;
  activeTraders: number;
  totalValidators: number;
  activeValidators: number;
  newUsersToday: number;
  
  // Submission metrics
  totalSubmissions: number;
  submissionsToday: number;
  pendingValidations: number;
  approvalRate: number;
  
  // Financial metrics
  totalPendingPayout: number;
  totalPaidOut: number;
  pendingPayoutCount: number;
  avgPayoutAmount: number;
  
  // Market coverage
  marketsActive: number;
  commoditiesTracked: number;
  pricePointsToday: number;
  
  // System health
  apiResponseTime: number;
  errorRate: number;
  queueDepth: number;
  
  // Trends (vs yesterday)
  tradersChange: number;
  submissionsChange: number;
  payoutsChange: number;
}

export interface TrendData {
  date: string;
  submissions: number;
  validations: number;
  approvals: number;
  rejections: number;
  payouts: number;
}

export interface ActivityItem {
  id: string;
  type: 'submission' | 'validation' | 'payout' | 'fraud_alert' | 'user_action';
  description: string;
  timestamp: Date;
  user?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// ----- TRADER TYPES -----
export interface Trader {
  id: string;
  phoneNumber: string;
  name: string;
  marketId: string;
  marketName: string;
  reputation: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  pendingBalance: number;
  totalEarned: number;
  totalPaid: number;
  registeredAt: Date;
  lastActive: Date;
  status: UserStatus;
  fraudFlags: FraudFlag[];
  bankVerified: boolean;
  gpsVerified: boolean;
}

export type UserStatus = 'active' | 'suspended' | 'banned' | 'pending_review';

export interface FraudFlag {
  id: string;
  type: FraudType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export type FraudType = 
  | 'gps_spoofing'
  | 'price_manipulation'
  | 'duplicate_submission'
  | 'rapid_submission'
  | 'collusion_suspected'
  | 'fake_account'
  | 'multiple_accounts';

// ----- VALIDATOR TYPES -----
export interface Validator {
  id: string;
  phoneNumber: string;
  name: string;
  marketIds: string[];
  marketNames: string[];
  accuracyRate: number;
  totalValidations: number;
  correctVotes: number;
  incorrectVotes: number;
  pendingBalance: number;
  totalEarned: number;
  totalPaid: number;
  tier: ValidatorTier;
  registeredAt: Date;
  lastActive: Date;
  status: UserStatus;
  collusionScore: number;
}

export type ValidatorTier = 'gold' | 'silver' | 'bronze' | 'probation';

// ----- SUBMISSION TYPES -----
export interface Submission {
  id: string;
  traderId: string;
  traderPhone: string;
  traderName: string;
  marketId: string;
  marketName: string;
  commodityId: string;
  commodityName: string;
  price: number;
  unit: string;
  gpsLatitude: number;
  gpsLongitude: number;
  gpsAccuracy: number;
  distanceFromMarket: number;
  submittedAt: Date;
  status: SubmissionStatus;
  validationDeadline?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  
  // Validation details
  validations: ValidationVote[];
  consensusReached: boolean;
  
  // Fraud indicators
  priceDeviation: number;
  fraudFlags: FraudFlag[];
  instantApproval: boolean;
}

export type SubmissionStatus = 
  | 'pending_validation'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'flagged_fraud'
  | 'manual_review';

export interface ValidationVote {
  validatorId: string;
  validatorName: string;
  vote: 'approve' | 'reject';
  reason?: string;
  votedAt: Date;
  responseTime: number; // seconds
}

// ----- FINANCIAL TYPES -----
export interface PayoutRecord {
  id: string;
  recipientId: string;
  recipientType: 'trader' | 'validator';
  recipientPhone: string;
  recipientName: string;
  amount: number;
  network: MobileNetwork;
  status: PayoutStatus;
  reference: string;
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  batchId?: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type MobileNetwork = 'MTN' | 'Airtel' | 'Glo' | '9mobile';

export interface PayoutBatch {
  id: string;
  createdAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  totalAmount: number;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  createdBy: string;
}

export interface FinancialSummary {
  totalPending: number;
  totalProcessing: number;
  totalPaid: number;
  totalFailed: number;
  
  pendingCount: number;
  processingCount: number;
  paidCount: number;
  failedCount: number;
  
  tradersPending: number;
  validatorsPending: number;
  
  todayPayout: number;
  weekPayout: number;
  monthPayout: number;
  
  byNetwork: {
    network: MobileNetwork;
    amount: number;
    count: number;
    successRate: number;
  }[];
  
  recentPayouts: PayoutRecord[];
  failedPayouts: PayoutRecord[];
}

// ----- MARKET TYPES -----
export interface Market {
  id: string;
  name: string;
  state: string;
  lga: string;
  gpsLatitude: number;
  gpsLongitude: number;
  radiusMeters: number;
  category: MarketCategory;
  operatingDays: string[];
  openingTime: string;
  closingTime: string;
  traderCount: number;
  validatorCount: number;
  submissionsToday: number;
  lastPriceUpdate?: Date;
  isActive: boolean;
}

export type MarketCategory = 
  | 'food'
  | 'building_materials'
  | 'manufacturing'
  | 'electronics'
  | 'textiles'
  | 'general';

// ----- COMMODITY TYPES -----
export interface Commodity {
  id: string;
  name: string;
  category: CommodityCategory;
  unit: string;
  baselinePrice: number;
  minPrice: number;
  maxPrice: number;
  priceDeviationThreshold: number;
  isActive: boolean;
  lastUpdated: Date;
}

export type CommodityCategory = 
  | 'grains'
  | 'vegetables'
  | 'tubers'
  | 'oils'
  | 'proteins'
  | 'cement'
  | 'steel'
  | 'wood'
  | 'textiles'
  | 'electronics';

// ----- FRAUD DETECTION TYPES -----
export interface FraudAlert {
  id: string;
  type: FraudType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  
  // Related entities
  submissionId?: string;
  traderId?: string;
  validatorId?: string;
  marketId?: string;
  
  // Evidence
  evidence: FraudEvidence[];
  
  // Resolution
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  actionTaken?: FraudAction;
}

export interface FraudEvidence {
  type: string;
  description: string;
  value: string | number;
  threshold?: string | number;
  timestamp: Date;
}

export type FraudAction = 
  | 'user_warned'
  | 'user_suspended'
  | 'user_banned'
  | 'submission_rejected'
  | 'payout_blocked'
  | 'no_action'
  | 'escalated';

export interface FraudStats {
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  resolvedToday: number;
  falsePositiveRate: number;
  
  byType: {
    type: FraudType;
    count: number;
    trend: number;
  }[];
  
  bySeverity: {
    severity: string;
    count: number;
  }[];
  
  recentAlerts: FraudAlert[];
  topOffenders: {
    userId: string;
    userType: 'trader' | 'validator';
    userName: string;
    alertCount: number;
    severity: string;
  }[];
}

// ----- SYSTEM HEALTH TYPES -----
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  lastChecked: Date;
  
  services: ServiceStatus[];
  
  metrics: {
    apiResponseTime: number;
    errorRate: number;
    successRate: number;
    queueDepth: number;
    activeConnections: number;
  };
  
  recentErrors: SystemError[];
  uptime: {
    current: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Date;
  errorMessage?: string;
}

export interface SystemError {
  id: string;
  service: string;
  message: string;
  stackTrace?: string;
  timestamp: Date;
  count: number;
  resolved: boolean;
}

// ----- API RESPONSE TYPES -----
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// ----- FILTER & SORT TYPES -----
export interface FilterOptions {
  search?: string;
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  market?: string[];
  severity?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

// ----- CHART DATA TYPES -----
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesData {
  timestamp: string;
  [key: string]: string | number;
}

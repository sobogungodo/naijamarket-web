// ============================================================================
// NAIJAMARKET INTEL - TYPE DEFINITIONS
// ============================================================================

// ============================================
// USER & AUTH TYPES
// ============================================

export interface WebUser {
  web_user_id: string;
  email: string;
  phone_number?: string;
  consumer_id?: string;
  trader_id?: string;
  validator_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
  company_name?: string;
  company_size?: CompanySize;
  industry?: string;
  job_title?: string;
  subscription_tier: SubscriptionTier;
  subscription_end?: Date;
  is_verified: boolean;
  verified_at?: Date;
  two_factor_enabled: boolean;
  last_login_at?: Date;
  login_count: number;
  preferences_json?: UserPreferences;
  notification_settings?: NotificationSettings;
  timezone: string;
  language: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
export type CompanySize = 'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  default_market?: string;
  default_category?: string;
  currency_display: 'symbol' | 'code';
  number_format: 'comma' | 'space';
  chart_style: 'line' | 'candle' | 'area';
  compact_mode: boolean;
}

export interface NotificationSettings {
  email_alerts: boolean;
  sms_alerts: boolean;
  push_alerts: boolean;
  price_alerts: boolean;
  weekly_digest: boolean;
  marketing: boolean;
}

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export type SubscriptionTier = 
  | 'FREE' 
  | 'BASIC' 
  | 'STANDARD' 
  | 'PREMIUM' 
  | 'PRO' 
  | 'ENTERPRISE';

export interface SubscriptionTierInfo {
  tier_id: string;
  tier_name: SubscriptionTier;
  tier_rank: number;
  price_ngn?: number;
  billing_cycle: BillingCycle;
  query_limit: number;
  query_period: 'DAY' | 'WEEK' | 'MONTH';
  max_markets: number;
  features: string[];
  api_access: boolean;
  priority_support: boolean;
}

export type BillingCycle = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'FOREVER';

// ============================================
// MARKET & LOCATION TYPES
// ============================================

export interface Market {
  market_id: string;
  region_id?: string;
  market_name: string;
  state: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  opening_hours?: string;
  status: MarketStatus;
  created_at: Date;
  coordinate_source?: string;
}

export type MarketStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface Region {
  region_code: string;
  region_name: string;
  emoji?: string;
  states_list?: string;
  total_markets: number;
  state_count: number;
}

export interface State {
  state_name: string;
  region_code: string;
  region_name: string;
  market_count: number;
  status: 'ACTIVE' | 'INACTIVE';
}

// ============================================
// ITEM & CATEGORY TYPES
// ============================================

export interface Category {
  category_id: string;
  category_name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  display_order: number;
}

export interface Item {
  item_id: string;
  item_name: string;
  category_id: string;
  unit?: string;
  measurement?: string;
  whole_sale_price?: number;
  ave_measurement_price?: number;
  average_unit_price?: number;
  status: 'ACTIVE' | 'INACTIVE';
  min_price?: number;
  max_price?: number;
}

export interface Brand {
  brand_id: string;
  brand_name: string;
  category_id?: string;
  category?: string;
  country_of_origin?: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// ============================================
// PRICE TYPES
// ============================================

export interface Price {
  price_id: string;
  submission_id?: string;
  market_id: string;
  market_name: string;
  state?: string;
  category_id: string;
  category_name: string;
  item_id: string;
  item_name: string;
  brand_id?: string;
  brand_name?: string;
  price: number;
  unit?: string;
  currency: string;
  validated_at: Date;
  validators_count?: number;
  approval_count?: number;
  previous_price?: number;
  price_change_amount?: number;
  price_change_percent?: number;
  price_trend: PriceTrend;
  confidence_score?: number;
  data_source?: DataSource;
}

export type PriceTrend = '↑' | '↓' | '→' | 'UP' | 'DOWN' | 'STABLE';
export type DataSource = 'TRADER_SUBMISSION' | 'NBS_HISTORICAL' | 'AGGREGATED' | 'MANUAL';

export interface PriceHistory {
  history_id: string;
  item_id: string;
  item_name: string;
  market_id: string;
  market_name: string;
  price_naira: number;
  observation_date: Date;
  year: number;
  month: number;
  data_source: string;
}

export interface PriceBaseline {
  baseline_id: string;
  item_id: string;
  item_name: string;
  market_id: string;
  market_name: string;
  avg_price_24h?: number;
  avg_price_7d?: number;
  avg_price_30d?: number;
  acceptable_min?: number;
  acceptable_max?: number;
  volatility_score?: number;
  is_seasonal: boolean;
}

// ============================================
// NFPI (NaijaFood Price Index) TYPES
// ============================================

export interface NFPIWeekly {
  week_id: string;
  week_start: Date;
  week_end: Date;
  is_baseline: boolean;
  national_index: number;
  national_change_pct?: number;
  national_change_direction: 'UP' | 'DOWN' | 'STABLE';
  nw_index?: number;
  ne_index?: number;
  nc_index?: number;
  sw_index?: number;
  se_index?: number;
  ss_index?: number;
  grains_index?: number;
  proteins_index?: number;
  vegetables_index?: number;
  oils_index?: number;
  basket_value_naira?: number;
  baseline_value?: number;
  data_quality_score?: number;
  items_with_data?: number;
  total_submissions?: number;
  top_gainers?: TopMover[];
  top_losers?: TopMover[];
  insight?: string;
  calculated_at: Date;
  published_at?: Date;
}

export interface TopMover {
  item_name: string;
  price_change_pct: number;
  current_price: number;
}

// ============================================
// WATCHLIST TYPES
// ============================================

export interface Watchlist {
  watchlist_id: string;
  web_user_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_public: boolean;
  items_count: number;
  color?: string;
  icon?: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface WatchlistItem {
  watchlist_item_id: string;
  watchlist_id: string;
  item_id: string;
  item_name: string;
  market_id: string;
  market_name: string;
  target_price?: number;
  alert_above?: number;
  alert_below?: number;
  notes?: string;
  sort_order: number;
  added_at: Date;
  last_price?: number;
  last_price_at?: Date;
  price_change_pct?: number;
}

// ============================================
// PRICE ALERT TYPES
// ============================================

export interface PriceAlert {
  alert_id: string;
  consumer_id?: string;
  web_user_id?: string;
  phone_number?: string;
  market_id: string;
  market_name: string;
  item_id: string;
  item_name: string;
  target_price: number;
  alert_type: AlertType;
  status: AlertStatus;
  created_at: Date;
  triggered_at?: Date;
  triggered_price?: number;
  notification_sent: boolean;
  notification_sent_at?: Date;
  expires_at?: Date;
}

export type AlertType = 'ABOVE' | 'BELOW' | 'CHANGE_PERCENT';
export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'DELETED';

// ============================================
// API TYPES
// ============================================

export interface ApiKey {
  api_key_id: string;
  web_user_id: string;
  key_prefix: string;
  name: string;
  description?: string;
  permissions: ApiPermission[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  allowed_ips?: string[];
  allowed_origins?: string[];
  is_test_key: boolean;
  status: ApiKeyStatus;
  last_used_at?: Date;
  requests_today: number;
  requests_total: number;
  created_at: Date;
  expires_at?: Date;
}

export type ApiPermission = 
  | 'prices:read'
  | 'prices:write'
  | 'markets:read'
  | 'items:read'
  | 'alerts:read'
  | 'alerts:write'
  | 'watchlists:read'
  | 'watchlists:write'
  | 'analytics:read'
  | 'admin';

export type ApiKeyStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'EXPIRED';

export interface ApiUsageLog {
  log_id: number;
  api_key_id?: string;
  web_user_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
  created_at: Date;
}

// ============================================
// COMMAND & SEARCH TYPES
// ============================================

export interface CommandHistory {
  command_id: number;
  web_user_id: string;
  command_text: string;
  command_type?: CommandType;
  parsed_params?: Record<string, unknown>;
  execution_time_ms?: number;
  result_count?: number;
  was_successful: boolean;
  error_message?: string;
  created_at: Date;
}

export type CommandType = 
  | 'PRICES'
  | 'GRAPH'
  | 'SNAPSHOT'
  | 'NFPI'
  | 'MARKETS'
  | 'ITEMS'
  | 'TRENDS'
  | 'ALERTS'
  | 'WATCHLIST'
  | 'EXPORT'
  | 'HELP';

export interface SavedQuery {
  query_id: string;
  web_user_id: string;
  name: string;
  description?: string;
  query_type: string;
  filters_json: QueryFilters;
  columns_json?: string[];
  sort_json?: SortConfig;
  is_default: boolean;
  run_count: number;
  last_run_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface QueryFilters {
  markets?: string[];
  categories?: string[];
  items?: string[];
  brands?: string[];
  states?: string[];
  regions?: string[];
  date_from?: string;
  date_to?: string;
  price_min?: number;
  price_max?: number;
  trend?: PriceTrend;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: ApiMeta;
}

// ============================================
// CHART & ANALYTICS TYPES
// ============================================

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PriceChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketHeatmapData {
  market_id: string;
  market_name: string;
  state: string;
  avg_change_pct: number;
  items_count: number;
  submissions_count: number;
  last_update: Date;
}

export interface DashboardStats {
  total_markets: number;
  total_items: number;
  total_prices_today: number;
  avg_price_change_pct: number;
  top_gainers: Price[];
  top_losers: Price[];
  latest_nfpi: NFPIWeekly;
  price_submissions_24h: number;
  active_validators: number;
  data_freshness_score: number;
}

// ============================================
// SESSION & AUTH TYPES
// ============================================

export interface WebSession {
  session_id: string;
  web_user_id: string;
  device_fingerprint?: string;
  user_agent?: string;
  ip_address?: string;
  country?: string;
  city?: string;
  is_mobile: boolean;
  created_at: Date;
  expires_at: Date;
  last_activity_at: Date;
  revoked: boolean;
}

export interface JWTPayload {
  sub: string; // web_user_id
  email: string;
  name?: string;
  tier: SubscriptionTier;
  permissions: string[];
  iat: number;
  exp: number;
}

// ============================================
// FORM TYPES
// ============================================

export interface LoginFormData {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  phone_number?: string;
  accept_terms: boolean;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  token: string;
  password: string;
  confirm_password: string;
}

export interface CreateAlertFormData {
  market_id: string;
  item_id: string;
  target_price: number;
  alert_type: AlertType;
}

export interface CreateWatchlistFormData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

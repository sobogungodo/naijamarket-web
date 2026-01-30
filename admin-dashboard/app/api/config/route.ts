/**
 * Platform Configuration API Route
 * GET /api/config - Get current platform configuration
 * PUT /api/config - Update platform configuration
 * 
 * This configuration is synchronized with validators.txt CONFIG
 * Changes here should be reflected in the Google Apps Script
 */

import { NextRequest, NextResponse } from 'next/server';
import { SHEETS_CONFIG } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

// Platform configuration - synchronized with validators.txt CONFIG
const PLATFORM_CONFIG = {
  version: '5.5-REGISTRATION',
  lastUpdated: '2026-01-29T00:00:00Z',
  
  // ============================================================================
  // VALIDATION SETTINGS (from validators.txt CONFIG.VALIDATION)
  // ============================================================================
  validation: {
    timeoutMinutes: SHEETS_CONFIG.VALIDATION.TIMEOUT_MINUTES, // 30
    validatorsRequired: SHEETS_CONFIG.VALIDATION.VALIDATORS_REQUIRED, // 3
    consensusRequired: SHEETS_CONFIG.VALIDATION.CONSENSUS_REQUIRED, // 2
    maxDailyValidations: SHEETS_CONFIG.VALIDATION.MAX_DAILY_VALIDATIONS, // 10
    
    // Additional settings for dashboard
    autoAssignValidators: true,
    excludeRecentValidators: true,
    recentValidatorHours: 24,
  },
  
  // ============================================================================
  // REWARDS SETTINGS (from validators.txt CONFIG.REWARDS)
  // ============================================================================
  rewards: {
    // Trader rewards
    traderApprovedSubmission: SHEETS_CONFIG.REWARDS.TRADER_APPROVED, // ₦20
    
    // Validator rewards
    validatorCorrectVote: SHEETS_CONFIG.REWARDS.VALIDATOR_CORRECT, // ₦100
    validatorIncorrectVote: SHEETS_CONFIG.REWARDS.VALIDATOR_INCORRECT, // ₦0
    
    // Bonus rewards (not in script yet, for future)
    traderStreakBonus: 50, // ₦50 for 10 consecutive approvals
    validatorAccuracyBonus: 100, // ₦100 for 95%+ accuracy in a week
  },
  
  // ============================================================================
  // PAYOUT SETTINGS (from validators.txt CONFIG.PAYOUT)
  // ============================================================================
  payout: {
    minimumBalance: SHEETS_CONFIG.PAYOUT.MINIMUM_BALANCE, // ₦500
    frequencyDays: SHEETS_CONFIG.PAYOUT.FREQUENCY_DAYS, // 14 (bi-weekly)
    paymentMethods: SHEETS_CONFIG.PAYOUT.PAYMENT_METHODS, // ['BANK_TRANSFER', 'AIRTIME']
    defaultMethod: SHEETS_CONFIG.PAYOUT.DEFAULT_METHOD, // 'BANK_TRANSFER'
    maxRetries: SHEETS_CONFIG.PAYOUT.MAX_RETRIES, // 3
    
    // Schedule (from script trigger configuration)
    scheduleDays: [1, 15], // 1st and 15th of each month
    scheduleHour: 17, // 5 PM (18:00 WAT = 17:00 UTC)
    
    // VTPass configuration
    vtpassEnabled: true,
    flutterwaveEnabled: false,
  },
  
  // ============================================================================
  // GPS SETTINGS (from validators.txt CONFIG.GPS)
  // ============================================================================
  gps: {
    defaultLatitude: SHEETS_CONFIG.GPS.DEFAULT_LATITUDE, // 6.4541
    defaultLongitude: SHEETS_CONFIG.GPS.DEFAULT_LONGITUDE, // 3.3947
    defaultAccuracy: SHEETS_CONFIG.GPS.DEFAULT_ACCURACY, // 10
    defaultMarketRadius: SHEETS_CONFIG.GPS.DEFAULT_MARKET_RADIUS, // 500m
    maxGpsAgeSeconds: SHEETS_CONFIG.GPS.MAX_GPS_AGE_SECONDS, // 300 (5 minutes)
    suspiciousVelocityKmh: SHEETS_CONFIG.GPS.SUSPICIOUS_VELOCITY_KMH, // 120
  },
  
  // ============================================================================
  // FRAUD DETECTION SETTINGS
  // ============================================================================
  fraudDetection: {
    enabled: true,
    
    // Price manipulation
    priceDeviationThreshold: SHEETS_CONFIG.FRAUD.PRICE_DEVIATION_THRESHOLD, // 30%
    
    // Collusion detection
    collusionWindowDays: SHEETS_CONFIG.FRAUD.COLLUSION_WINDOW_DAYS, // 7
    collusionThresholdPercent: 80, // Flag if validator approves >80% from same trader
    
    // GPS spoofing
    gpsRadiusMeters: SHEETS_CONFIG.FRAUD.GPS_RADIUS_METERS, // 500
    impossibleTravelEnabled: true,
    
    // Rapid submission
    rapidSubmissionThreshold: SHEETS_CONFIG.FRAUD.RAPID_SUBMISSION_THRESHOLD, // 5 per hour
    rapidSubmissionWindowHours: 1,
    
    // Auto actions
    autoSuspendOnCritical: true,
    autoFlagOnHigh: true,
    
    // Alert severity thresholds
    severityThresholds: {
      critical: 90, // Score >= 90 = Critical
      high: 70,     // Score >= 70 = High
      medium: 50,   // Score >= 50 = Medium
      low: 0,       // Score < 50 = Low
    },
  },
  
  // ============================================================================
  // REPUTATION SETTINGS
  // ============================================================================
  reputation: {
    // Trader reputation
    traderStartingScore: 50,
    traderApprovalPoints: 2,
    traderRejectionPoints: -2,
    traderInstantApprovalThreshold: 80,
    traderManualReviewThreshold: 30,
    
    // Validator tiers
    validatorTiers: {
      STANDARD: { minAccuracy: 0, maxDaily: 10 },
      SILVER: { minAccuracy: 75, maxDaily: 15 },
      GOLD: { minAccuracy: 85, maxDaily: 20 },
      PLATINUM: { minAccuracy: 95, maxDaily: 30 },
    },
  },
  
  // ============================================================================
  // REGISTRATION SETTINGS (from validators.txt CONFIG.REGISTRATION)
  // ============================================================================
  registration: {
    sessionTimeoutMinutes: 30,
    maxInviteAttempts: 3,
    maxBankAttempts: 3,
    tcVersion: '1.0',
    
    // KYC requirements
    requireFullName: true,
    requireDateOfBirth: true,
    requireAddress: true,
    requireState: true,
    requireBankDetails: true,
    requireTermsAcceptance: true,
  },
  
  // ============================================================================
  // NOTIFICATION SETTINGS
  // ============================================================================
  notifications: {
    // Email alerts
    emailEnabled: true,
    adminEmail: 'admin@naijamarket.com',
    alertOnCriticalFraud: true,
    alertOnPayoutFailure: true,
    alertOnSystemError: true,
    
    // Daily reports
    dailyReportEnabled: true,
    dailyReportTime: '09:00',
    
    // Slack integration
    slackEnabled: false,
    slackWebhookUrl: '',
    slackChannel: '#alerts',
  },
  
  // ============================================================================
  // MARKETS (Phase 1)
  // ============================================================================
  markets: [
    { id: 'MKT_001', name: 'Mile 12 Market', state: 'Lagos', status: 'ACTIVE' },
    { id: 'MKT_002', name: 'Onitsha Main Market', state: 'Anambra', status: 'ACTIVE' },
    { id: 'MKT_003', name: 'Iddo Market', state: 'Lagos', status: 'ACTIVE' },
    { id: 'MKT_004', name: 'Ariaria Market', state: 'Abia', status: 'ACTIVE' },
    { id: 'MKT_005', name: 'Alaba International', state: 'Lagos', status: 'ACTIVE' },
    { id: 'MKT_006', name: 'Wuse Market', state: 'FCT Abuja', status: 'ACTIVE' },
    { id: 'MKT_007', name: 'Kano Main Market', state: 'Kano', status: 'ACTIVE' },
    { id: 'MKT_008', name: 'Jos Main Market', state: 'Plateau', status: 'ACTIVE' },
  ],
  
  // ============================================================================
  // NETWORK PREFIXES (from validators.txt CONFIG.NETWORK_PREFIXES)
  // ============================================================================
  networkPrefixes: {
    MTN: ['0703', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'],
    AIRTEL: ['0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904', '0907', '0912'],
    GLO: ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
    '9MOBILE': ['0809', '0817', '0818', '0909', '0908'],
  },
  
  // ============================================================================
  // NIGERIAN STATES (from validators.txt CONFIG.STATES)
  // ============================================================================
  states: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
    'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
    'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ],
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: PLATFORM_CONFIG,
    timestamp: new Date().toISOString(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { section, updates, adminId } = body;
    
    // In a real implementation, this would:
    // 1. Validate the updates
    // 2. Update the Google Sheets configuration
    // 3. Trigger a webhook to update the Google Apps Script CONFIG
    // 4. Log the change to an audit trail
    
    // For now, we just acknowledge the request
    console.log(`Config update request from ${adminId}:`, section, updates);
    
    return NextResponse.json({
      success: true,
      message: 'Configuration update acknowledged. Changes will sync to WhatsApp bot on next deployment.',
      section,
      updates,
      adminId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Config update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

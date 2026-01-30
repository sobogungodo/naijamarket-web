/**
 * Fraud Alerts API Route
 * GET /api/fraud - List fraud alerts
 * POST /api/fraud/:id/resolve - Resolve an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFraudAlerts, resolveFraudAlert } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const type = searchParams.get('type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let alerts = await getFraudAlerts({ status, severity, type });
    
    // Get total before pagination
    const total = alerts.length;
    
    // Apply pagination
    alerts = alerts.slice(offset, offset + limit);
    
    // Parse evidence JSON for each alert
    alerts = alerts.map(alert => ({
      ...alert,
      evidence: typeof alert.evidence === 'string' 
        ? tryParseJSON(alert.evidence) 
        : alert.evidence,
    }));
    
    return NextResponse.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
        medium: alerts.filter(a => a.severity === 'MEDIUM').length,
        low: alerts.filter(a => a.severity === 'LOW').length,
        pending: alerts.filter(a => a.status === 'PENDING').length,
        investigating: alerts.filter(a => a.status === 'INVESTIGATING').length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Fraud alerts API error:', error);
    
    // Return mock data if Google Sheets is not configured
    if (String(error).includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({
        success: true,
        data: getMockFraudAlerts(),
        pagination: { total: 12, limit: 100, offset: 0, hasMore: false },
        stats: { total: 12, critical: 2, high: 3, medium: 4, low: 3, pending: 8, investigating: 4 },
        timestamp: new Date().toISOString(),
        mock: true,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, resolution, notes, adminId } = body;
    
    if (action === 'resolve') {
      const success = await resolveFraudAlert(alertId, resolution, notes, adminId);
      return NextResponse.json({ success });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Fraud alert action error:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}

function tryParseJSON(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function getMockFraudAlerts() {
  const types = ['GPS_SPOOFING', 'PRICE_MANIPULATION', 'COLLUSION', 'RAPID_SUBMISSION'];
  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const statuses = ['PENDING', 'INVESTIGATING', 'PENDING', 'PENDING'];
  const markets = ['Mile 12 Market', 'Onitsha Main Market', 'Iddo Market', 'Ariaria Market'];
  
  return Array.from({ length: 12 }, (_, i) => ({
    alert_id: `FRD_${3000 + i}`,
    alert_type: types[i % 4],
    severity: severities[i % 4],
    status: statuses[i % 4],
    user_id: `USR_${1000 + i}`,
    user_phone: `080${50000000 + i}`,
    user_name: `User ${i + 1}`,
    user_type: i % 2 === 0 ? 'TRADER' : 'VALIDATOR',
    market_id: `MKT_${(i % 4) + 1}`,
    market_name: markets[i % 4],
    description: getAlertDescription(types[i % 4]),
    evidence: getAlertEvidence(types[i % 4]),
    created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
  }));
}

function getAlertDescription(type: string): string {
  const descriptions: Record<string, string> = {
    GPS_SPOOFING: 'User submitted from coordinates that do not match their device location history. Possible GPS spoofing detected.',
    PRICE_MANIPULATION: 'Submitted price deviates more than 30% from the market baseline. Possible price manipulation.',
    COLLUSION: 'Pattern detected: This validator has approved 95% of submissions from the same trader over 7 days.',
    RAPID_SUBMISSION: 'User submitted 8 prices within 1 hour, exceeding the 5/hour limit. Possible automated submission.',
  };
  return descriptions[type] || 'Suspicious activity detected.';
}

function getAlertEvidence(type: string): object {
  const evidence: Record<string, object> = {
    GPS_SPOOFING: {
      submitted_lat: 6.4541,
      submitted_lng: 3.3947,
      device_lat: 6.5244,
      device_lng: 3.3792,
      distance_meters: 8234,
      market_radius: 500,
    },
    PRICE_MANIPULATION: {
      submitted_price: 85000,
      baseline_price: 52000,
      deviation_percent: 63.5,
      threshold_percent: 30,
      item: 'Rice 50kg',
    },
    COLLUSION: {
      validator_phone: '08012345678',
      trader_phone: '08087654321',
      total_validations: 47,
      approvals: 45,
      approval_rate: 95.7,
      window_days: 7,
    },
    RAPID_SUBMISSION: {
      submission_count: 8,
      time_window_hours: 1,
      threshold: 5,
      submission_times: ['10:05', '10:12', '10:18', '10:24', '10:31', '10:38', '10:45', '10:52'],
    },
  };
  return evidence[type] || {};
}

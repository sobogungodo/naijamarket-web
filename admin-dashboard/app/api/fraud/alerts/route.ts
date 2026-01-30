import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, execute, getFraudAlerts } from '@/lib/db';

// ============================================
// FRAUD ALERTS API
// GET /api/fraud/alerts
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status') || 'open';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build dynamic query
    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = { limit };

    if (severity && severity !== 'all') {
      whereClause += ` AND fa.Severity = @severity`;
      params.severity = severity;
    }

    if (status && status !== 'all') {
      whereClause += ` AND fa.Status = @status`;
      params.status = status;
    }

    if (type && type !== 'all') {
      whereClause += ` AND fa.Type = @type`;
      params.type = type;
    }

    const alertsQuery = `
      SELECT TOP (@limit)
        fa.Id,
        fa.Type,
        fa.Severity,
        fa.Title,
        fa.Description,
        fa.DetectedAt,
        fa.Status,
        fa.SubmissionId,
        fa.TraderId,
        fa.ValidatorId,
        fa.MarketId,
        fa.AssignedTo,
        fa.ResolvedBy,
        fa.ResolvedAt,
        fa.Resolution,
        fa.ActionTaken,
        t.Name as TraderName,
        t.PhoneNumber as TraderPhone,
        v.Name as ValidatorName,
        m.Name as MarketName
      FROM dbo.FraudAlerts fa
      LEFT JOIN dbo.Traders t ON fa.TraderId = t.Id
      LEFT JOIN dbo.Validators v ON fa.ValidatorId = v.Id
      LEFT JOIN dbo.Markets m ON fa.MarketId = m.Id
      ${whereClause}
      ORDER BY 
        CASE fa.Severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        fa.DetectedAt DESC
    `;

    const alerts = await query(alertsQuery, params);

    // Get summary stats
    const statsQuery = `
      SELECT 
        COUNT(*) as totalAlerts,
        SUM(CASE WHEN Status = 'open' THEN 1 ELSE 0 END) as openAlerts,
        SUM(CASE WHEN Severity = 'critical' AND Status = 'open' THEN 1 ELSE 0 END) as criticalAlerts,
        SUM(CASE WHEN Severity = 'high' AND Status = 'open' THEN 1 ELSE 0 END) as highAlerts,
        SUM(CASE WHEN ResolvedAt >= CAST(GETUTCDATE() AS DATE) THEN 1 ELSE 0 END) as resolvedToday
      FROM dbo.FraudAlerts
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        stats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Fraud alerts API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch fraud alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new fraud alert
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, severity, title, description, traderId, validatorId, submissionId, marketId } = body;

    // Validate required fields
    if (!type || !severity || !title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, severity, title' },
        { status: 400 }
      );
    }

    const insertQuery = `
      INSERT INTO dbo.FraudAlerts (
        Id, Type, Severity, Title, Description, 
        TraderId, ValidatorId, SubmissionId, MarketId,
        DetectedAt, Status, CreatedBy
      )
      VALUES (
        NEWID(), @type, @severity, @title, @description,
        @traderId, @validatorId, @submissionId, @marketId,
        GETUTCDATE(), 'open', @createdBy
      );
      
      SELECT SCOPE_IDENTITY() as id;
    `;

    await execute(insertQuery, {
      type,
      severity,
      title,
      description,
      traderId,
      validatorId,
      submissionId,
      marketId,
      createdBy: session.user?.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Fraud alert created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create fraud alert error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create fraud alert' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update fraud alert (resolve, assign, etc.)
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { alertId, action, resolution, actionTaken, assignedTo } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: alertId, action' },
        { status: 400 }
      );
    }

    let updateQuery = '';
    const params: Record<string, unknown> = { 
      alertId,
      updatedBy: session.user?.email,
    };

    switch (action) {
      case 'resolve':
        updateQuery = `
          UPDATE dbo.FraudAlerts
          SET 
            Status = 'resolved',
            ResolvedAt = GETUTCDATE(),
            ResolvedBy = @updatedBy,
            Resolution = @resolution,
            ActionTaken = @actionTaken
          WHERE Id = @alertId
        `;
        params.resolution = resolution;
        params.actionTaken = actionTaken;
        break;

      case 'assign':
        updateQuery = `
          UPDATE dbo.FraudAlerts
          SET 
            Status = 'investigating',
            AssignedTo = @assignedTo
          WHERE Id = @alertId
        `;
        params.assignedTo = assignedTo;
        break;

      case 'dismiss':
        updateQuery = `
          UPDATE dbo.FraudAlerts
          SET 
            Status = 'false_positive',
            ResolvedAt = GETUTCDATE(),
            ResolvedBy = @updatedBy,
            Resolution = 'Dismissed as false positive'
          WHERE Id = @alertId
        `;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    await execute(updateQuery, params);

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update fraud alert error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update fraud alert' },
      { status: 500 }
    );
  }
}

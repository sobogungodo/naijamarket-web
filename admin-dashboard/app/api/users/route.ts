import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission } from '@/lib/auth';
import { query, execute, getTraders, updateTraderStatus } from '@/lib/db';
import { AdminRole } from '@/types';

// ============================================
// USERS API
// GET /api/users - List traders and validators
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
    const userType = searchParams.get('type') || 'traders'; // traders | validators
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const marketId = searchParams.get('market') || '';
    const minReputation = searchParams.get('minReputation');
    const maxReputation = searchParams.get('maxReputation');

    if (userType === 'traders') {
      const result = await getTraders(page, pageSize, {
        search,
        status: status || undefined,
        marketId: marketId || undefined,
        minReputation: minReputation ? parseInt(minReputation) : undefined,
        maxReputation: maxReputation ? parseInt(maxReputation) : undefined,
      });

      return NextResponse.json({
        success: true,
        data: {
          items: result.items,
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Validators query
    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = {
      offset: (page - 1) * pageSize,
      pageSize,
    };

    if (search) {
      whereClause += ` AND (v.Name LIKE @search OR v.PhoneNumber LIKE @search)`;
      params.search = `%${search}%`;
    }

    if (status) {
      whereClause += ` AND v.Status = @status`;
      params.status = status;
    }

    const validatorsQuery = `
      SELECT 
        v.Id,
        v.PhoneNumber,
        v.Name,
        v.AccuracyRate,
        v.TotalValidations,
        v.CorrectVotes,
        v.IncorrectVotes,
        v.PendingBalance,
        v.TotalEarned,
        v.TotalPaid,
        v.Tier,
        v.RegisteredAt,
        v.LastActive,
        v.Status,
        v.CollusionScore
      FROM dbo.Validators v
      ${whereClause}
      ORDER BY v.LastActive DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY;
      
      SELECT COUNT(*) as total FROM dbo.Validators v ${whereClause};
    `;

    const results = await query(validatorsQuery, params);

    return NextResponse.json({
      success: true,
      data: {
        items: results,
        total: 0, // Would need to handle multiple result sets
        page,
        pageSize,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update user status
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

    // Check permissions
    const userRole = (session.user as { role?: AdminRole })?.role || 'viewer';
    if (!hasPermission(userRole, 'canTakeAction')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, userType, action, reason } = body;

    if (!userId || !userType || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, userType, action' },
        { status: 400 }
      );
    }

    let newStatus = '';
    switch (action) {
      case 'activate':
        newStatus = 'active';
        break;
      case 'suspend':
        newStatus = 'suspended';
        break;
      case 'ban':
        newStatus = 'banned';
        break;
      case 'review':
        newStatus = 'pending_review';
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    const tableName = userType === 'trader' ? 'Traders' : 'Validators';

    const updateQuery = `
      UPDATE dbo.${tableName}
      SET 
        Status = @status,
        UpdatedAt = GETUTCDATE(),
        StatusReason = @reason
      WHERE Id = @userId;
      
      INSERT INTO dbo.AuditLog (EntityType, EntityId, Action, NewValue, Reason, PerformedBy, PerformedAt)
      VALUES (@userType, @userId, 'STATUS_CHANGE', @status, @reason, @performedBy, GETUTCDATE());
    `;

    await execute(updateQuery, {
      userId,
      status: newStatus,
      reason,
      userType,
      performedBy: session.user?.email,
    });

    return NextResponse.json({
      success: true,
      message: `User ${action}d successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// ============================================
// GET User Stats Summary
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
    const { action } = body;

    if (action === 'stats') {
      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM dbo.Traders) as totalTraders,
          (SELECT COUNT(*) FROM dbo.Traders WHERE Status = 'active' AND LastActive >= DATEADD(day, -7, GETUTCDATE())) as activeTraders,
          (SELECT COUNT(*) FROM dbo.Traders WHERE CAST(RegisteredAt AS DATE) = CAST(GETUTCDATE() AS DATE)) as newTradersToday,
          (SELECT COUNT(*) FROM dbo.Traders WHERE Status = 'suspended') as suspendedTraders,
          (SELECT COUNT(*) FROM dbo.Validators) as totalValidators,
          (SELECT COUNT(*) FROM dbo.Validators WHERE Status = 'active' AND LastActive >= DATEADD(day, -7, GETUTCDATE())) as activeValidators,
          (SELECT COUNT(*) FROM dbo.Validators WHERE Tier = 'gold') as goldValidators,
          (SELECT COUNT(*) FROM dbo.Validators WHERE CAST(RegisteredAt AS DATE) = CAST(GETUTCDATE() AS DATE)) as newValidatorsToday,
          (SELECT AVG(CAST(Reputation AS FLOAT)) FROM dbo.Traders) as avgTraderReputation,
          (SELECT AVG(AccuracyRate) FROM dbo.Validators) as avgValidatorAccuracy
      `;

      const stats = await query(statsQuery);

      return NextResponse.json({
        success: true,
        data: stats[0] || {},
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('User stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}

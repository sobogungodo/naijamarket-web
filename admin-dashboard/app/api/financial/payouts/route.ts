import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission } from '@/lib/auth';
import { query, execute, getPendingPayouts } from '@/lib/db';
import { AdminRole } from '@/types';

// ============================================
// FINANCIAL / PAYOUTS API
// GET /api/financial/payouts
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

    // Check permissions
    const userRole = (session.user as { role?: AdminRole })?.role || 'viewer';
    if (!hasPermission(userRole, 'canViewFinancials')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to view financials' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const network = searchParams.get('network') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Build query
    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = {
      offset: (page - 1) * pageSize,
      pageSize,
    };

    if (status !== 'all') {
      whereClause += ` AND r.Status = @status`;
      params.status = status;
    }

    if (network !== 'all') {
      whereClause += ` AND r.Network = @network`;
      params.network = network;
    }

    const payoutsQuery = `
      SELECT 
        r.Id,
        r.RecipientId,
        r.RecipientType,
        r.RecipientPhone,
        r.RecipientName,
        r.Amount,
        r.Network,
        r.Status,
        r.Reference,
        r.CreatedAt,
        r.ProcessedAt,
        r.FailedAt,
        r.FailureReason,
        r.RetryCount,
        r.BatchId
      FROM dbo.RewardsLedger r
      ${whereClause}
      ORDER BY r.CreatedAt DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY;
    `;

    const payouts = await query(payoutsQuery, params);

    // Get count
    const countQuery = `SELECT COUNT(*) as total FROM dbo.RewardsLedger r ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = (countResult[0] as { total: number })?.total || 0;

    // Get summary stats
    const summaryQuery = `
      SELECT 
        SUM(CASE WHEN Status = 'pending' THEN Amount ELSE 0 END) as totalPending,
        SUM(CASE WHEN Status = 'processing' THEN Amount ELSE 0 END) as totalProcessing,
        SUM(CASE WHEN Status = 'completed' THEN Amount ELSE 0 END) as totalPaid,
        SUM(CASE WHEN Status = 'failed' THEN Amount ELSE 0 END) as totalFailed,
        COUNT(CASE WHEN Status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN Status = 'processing' THEN 1 END) as processingCount,
        COUNT(CASE WHEN Status = 'completed' THEN 1 END) as paidCount,
        COUNT(CASE WHEN Status = 'failed' THEN 1 END) as failedCount,
        SUM(CASE WHEN RecipientType = 'trader' AND Status = 'pending' THEN Amount ELSE 0 END) as tradersPending,
        SUM(CASE WHEN RecipientType = 'validator' AND Status = 'pending' THEN Amount ELSE 0 END) as validatorsPending
      FROM dbo.RewardsLedger
    `;

    const summaryResult = await query(summaryQuery);
    const summary = summaryResult[0] || {};

    // Get network breakdown
    const networkQuery = `
      SELECT 
        Network as network,
        SUM(Amount) as amount,
        COUNT(*) as count,
        CAST(SUM(CASE WHEN Status = 'completed' THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100 AS DECIMAL(5,2)) as successRate
      FROM dbo.RewardsLedger
      GROUP BY Network
    `;

    const networkBreakdown = await query(networkQuery);

    return NextResponse.json({
      success: true,
      data: {
        payouts,
        summary,
        byNetwork: networkBreakdown,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financial API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch financial data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Process payouts or create batch
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

    // Check permissions
    const userRole = (session.user as { role?: AdminRole })?.role || 'viewer';
    if (!hasPermission(userRole, 'canApprovePayouts')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to process payouts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, payoutIds, batchId } = body;

    switch (action) {
      case 'create_batch': {
        // Create a new payout batch
        const batchQuery = `
          DECLARE @batchId UNIQUEIDENTIFIER = NEWID();
          
          -- Create batch record
          INSERT INTO dbo.PayoutBatches (
            Id, CreatedAt, Status, CreatedBy
          )
          VALUES (
            @batchId, GETUTCDATE(), 'pending', @createdBy
          );
          
          -- Update pending payouts with batch ID
          UPDATE dbo.RewardsLedger
          SET BatchId = @batchId
          WHERE Status = 'pending' AND BatchId IS NULL;
          
          -- Update batch totals
          UPDATE pb
          SET 
            TotalAmount = (SELECT SUM(Amount) FROM dbo.RewardsLedger WHERE BatchId = @batchId),
            TotalRecords = (SELECT COUNT(*) FROM dbo.RewardsLedger WHERE BatchId = @batchId)
          FROM dbo.PayoutBatches pb
          WHERE pb.Id = @batchId;
          
          SELECT @batchId as batchId;
        `;

        const result = await query(batchQuery, { createdBy: session.user?.email });

        return NextResponse.json({
          success: true,
          message: 'Payout batch created',
          data: { batchId: (result[0] as { batchId: string })?.batchId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'process_batch': {
        if (!batchId) {
          return NextResponse.json(
            { success: false, error: 'batchId required for process_batch action' },
            { status: 400 }
          );
        }

        // Mark batch as processing
        const processQuery = `
          UPDATE dbo.PayoutBatches
          SET Status = 'processing', ProcessedAt = GETUTCDATE()
          WHERE Id = @batchId;
          
          UPDATE dbo.RewardsLedger
          SET Status = 'processing'
          WHERE BatchId = @batchId AND Status = 'pending';
        `;

        await execute(processQuery, { batchId });

        // In production, this would trigger the VTPass API integration
        // For now, we'll simulate success

        return NextResponse.json({
          success: true,
          message: 'Batch processing started',
          data: { batchId },
          timestamp: new Date().toISOString(),
        });
      }

      case 'retry_failed': {
        // Retry failed payouts
        const retryQuery = `
          UPDATE dbo.RewardsLedger
          SET 
            Status = 'pending',
            RetryCount = RetryCount + 1,
            FailedAt = NULL,
            FailureReason = NULL
          WHERE Status = 'failed' AND RetryCount < 3
          ${payoutIds?.length ? 'AND Id IN (@payoutIds)' : ''}
        `;

        await execute(retryQuery, { payoutIds: payoutIds?.join(',') });

        return NextResponse.json({
          success: true,
          message: 'Failed payouts queued for retry',
          timestamp: new Date().toISOString(),
        });
      }

      case 'cancel': {
        if (!payoutIds?.length) {
          return NextResponse.json(
            { success: false, error: 'payoutIds required for cancel action' },
            { status: 400 }
          );
        }

        const cancelQuery = `
          UPDATE dbo.RewardsLedger
          SET Status = 'cancelled'
          WHERE Id IN (SELECT value FROM STRING_SPLIT(@payoutIds, ','))
            AND Status = 'pending';
        `;

        await execute(cancelQuery, { payoutIds: payoutIds.join(',') });

        return NextResponse.json({
          success: true,
          message: 'Payouts cancelled',
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Process payout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process payout action' },
      { status: 500 }
    );
  }
}

// ============================================
// GET Financial Summary for Dashboard
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const summaryQuery = `
      SELECT 
        -- Today
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger 
         WHERE Status = 'completed' AND CAST(ProcessedAt AS DATE) = CAST(GETUTCDATE() AS DATE)) as todayPayout,
        
        -- This week
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger 
         WHERE Status = 'completed' AND ProcessedAt >= DATEADD(day, -7, GETUTCDATE())) as weekPayout,
        
        -- This month
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger 
         WHERE Status = 'completed' AND ProcessedAt >= DATEADD(month, -1, GETUTCDATE())) as monthPayout,
        
        -- All time
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger 
         WHERE Status = 'completed') as allTimePayout,
        
        -- Pending
        (SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger 
         WHERE Status = 'pending') as pendingAmount,
        (SELECT COUNT(*) FROM dbo.RewardsLedger 
         WHERE Status = 'pending') as pendingCount,
        
        -- Average payout
        (SELECT AVG(Amount) FROM dbo.RewardsLedger 
         WHERE Status = 'completed') as avgPayout
    `;

    const summary = await query(summaryQuery);

    return NextResponse.json({
      success: true,
      data: summary[0] || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch financial summary' },
      { status: 500 }
    );
  }
}

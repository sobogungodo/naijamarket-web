import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// ADMIN COMMODITIES API — Food Items Only
// GET  /api/commodities — List food items + latest prices
// POST /api/commodities — Add item
// PUT  /api/commodities — Update item
// ============================================

export async function GET(request: NextRequest) {
  try {
    // 1. All food items from Items_Catalog
    const items = await query<any>(`
      SELECT 
        item_id, item_name, category_id, Unit, measurement,
        whole_sale_Price, Ave_Measurement_Price, Average_Unit_Price,
        status, Max_whole_sale_Price, min_price, max_price,
        created_at, super_category
      FROM dbo.Items_Catalog
      WHERE super_category = 'Food'
      ORDER BY category_id, item_name
    `);

    // 2. Summary stats
    const stats = await query<any>(`
      SELECT
        COUNT(*) AS total_items,
        COUNT(DISTINCT category_id) AS total_categories,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_items
      FROM dbo.Items_Catalog
      WHERE super_category = 'Food'
    `);

    // 3. Items by category (for pie chart)
    const byCategory = await query<any>(`
      SELECT category_id, COUNT(*) AS count
      FROM dbo.Items_Catalog
      WHERE super_category = 'Food'
      GROUP BY category_id
      ORDER BY count DESC
    `);

    // 4. Latest average price per item (last 7 days only for speed)
    const latestPrices = await query<any>(`
      SELECT 
        item_id,
        item_name,
        COUNT(DISTINCT market_id) AS markets_count,
        ROUND(AVG(price_naira), 2) AS avg_price,
        MIN(price_naira) AS min_current,
        MAX(price_naira) AS max_current,
        ROUND(AVG(price_change_pct), 2) AS avg_change_pct,
        COUNT(*) AS price_points
      FROM dbo.Daily_Prices WITH (NOLOCK)
      WHERE price_date >= DATEADD(day, -7, GETDATE())
        AND category_id IN (SELECT DISTINCT category_id FROM dbo.Items_Catalog WHERE super_category = 'Food')
      GROUP BY item_id, item_name
    `);

    // 5. Category name lookup (from ref.Categories if exists, else use IDs)
    let categoryNames: Record<string, string> = {};
    try {
      const cats = await query<any>(`SELECT category_id, category_name FROM ref.Categories`);
      cats.forEach((c: any) => { categoryNames[c.category_id] = c.category_name; });
    } catch {
      // Fallback: derive from item names
      categoryNames = {};
    }

    // Build price lookup
    const priceMap = new Map(latestPrices.map((p: any) => [p.item_id, p]));

    // Enrich items
    const enrichedItems = items.map((item: any) => {
      const price = priceMap.get(item.item_id) || {};
      return {
        ...item,
        category_name: categoryNames[item.category_id] || item.category_id,
        current_avg_price: price.avg_price || item.whole_sale_Price || 0,
        current_min: price.min_current || item.min_price || 0,
        current_max: price.max_current || item.max_price || 0,
        markets_with_data: price.markets_count || 0,
        price_change_pct: price.avg_change_pct || 0,
        recent_price_points: price.price_points || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedItems,
        summary: {
          total_items: stats[0]?.total_items || 0,
          total_categories: stats[0]?.total_categories || 0,
          active_items: stats[0]?.active_items || 0,
          total_markets: 226,
        },
        by_category: byCategory.map((c: any) => ({
          ...c,
          category_name: categoryNames[c.category_id] || c.category_id,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Commodities API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_name, category_id, Unit, measurement, whole_sale_Price, min_price, max_price } = body;

    if (!item_name || !category_id) {
      return NextResponse.json({ success: false, error: 'item_name and category_id required' }, { status: 400 });
    }

    const lastId = await query<any>(`
      SELECT TOP 1 item_id FROM dbo.Items_Catalog WHERE super_category = 'Food' ORDER BY item_id DESC
    `);
    const lastNum = lastId.length > 0 ? parseInt(lastId[0].item_id.replace('ITM', '')) : 0;
    const newId = 'ITM' + String(lastNum + 1).padStart(5, '0');

    await execute(`
      INSERT INTO dbo.Items_Catalog (item_id, item_name, category_id, Unit, measurement, whole_sale_Price, min_price, max_price, status, super_category, created_at)
      VALUES (@item_id, @item_name, @category_id, @Unit, @measurement, @whole_sale_Price, @min_price, @max_price, 'ACTIVE', 'Food', GETDATE())
    `, {
      item_id: newId,
      item_name,
      category_id,
      Unit: Unit || 'bag',
      measurement: measurement || 'kg',
      whole_sale_Price: parseFloat(whole_sale_Price) || 0,
      min_price: parseFloat(min_price) || 0,
      max_price: parseFloat(max_price) || 0,
    });

    return NextResponse.json({ success: true, item_id: newId, message: `${item_name} added` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, status, item_name, category_id, Unit, whole_sale_Price, min_price, max_price } = body;

    if (!item_id) return NextResponse.json({ success: false, error: 'item_id required' }, { status: 400 });

    if (status && Object.keys(body).length === 2) {
      await execute(`UPDATE dbo.Items_Catalog SET status = @status WHERE item_id = @item_id`, { item_id, status });
      return NextResponse.json({ success: true, message: `${item_id} → ${status}` });
    }

    await execute(`
      UPDATE dbo.Items_Catalog SET
        item_name = ISNULL(@item_name, item_name),
        category_id = ISNULL(@category_id, category_id),
        Unit = ISNULL(@Unit, Unit),
        whole_sale_Price = ISNULL(@whole_sale_Price, whole_sale_Price),
        min_price = ISNULL(@min_price, min_price),
        max_price = ISNULL(@max_price, max_price),
        status = ISNULL(@status, status)
      WHERE item_id = @item_id
    `, {
      item_id,
      item_name: item_name || null,
      category_id: category_id || null,
      Unit: Unit || null,
      whole_sale_Price: whole_sale_Price ? parseFloat(whole_sale_Price) : null,
      min_price: min_price ? parseFloat(min_price) : null,
      max_price: max_price ? parseFloat(max_price) : null,
      status: status || null,
    });

    return NextResponse.json({ success: true, message: `${item_id} updated` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

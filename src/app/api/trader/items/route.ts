import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    const sheets = getSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Items_Catalog!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return NextResponse.json({ items: [] });

    const headers = rows[0];
    const itemIdIdx = headers.indexOf('item_id');
    const itemNameIdx = headers.indexOf('item_name');
    const categoryIdx = headers.indexOf('super_category') !== -1 ? headers.indexOf('super_category') : headers.indexOf('category');
    const categoryIdIdx = headers.indexOf('category_id');
    const defaultUnitIdx = headers.indexOf('default_unit');
    const statusIdx = headers.indexOf('status');

    const items = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowCategoryId = row[categoryIdIdx] || row[categoryIdx]?.toLowerCase().replace(/\s+/g, '_');
      const status = row[statusIdx];
      
      if (categoryId && rowCategoryId !== categoryId) continue;
      if (status && status !== 'ACTIVE') continue;
      
      items.push({
        id: row[itemIdIdx] || `item_${i}`,
        name: row[itemNameIdx] || 'Unknown Item',
        categoryId: rowCategoryId,
        defaultUnit: row[defaultUnitIdx] || 'unit'
      });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ items });

  } catch (error) {
    console.error('Items error:', error);
    return NextResponse.json({ items: [] });
  }
}

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';

const CATEGORY_ICONS: { [key: string]: string } = {
  'Food': '🍚', 'FOOD': '🍚',
  'Building': '🧱', 'BUILDING': '🧱', 'Building Materials': '🧱',
  'Manufacturing': '🏭', 'MANUFACTURING': '🏭',
  'Electronics': '📱', 'ELECTRONICS': '📱',
  'Textiles': '👕', 'TEXTILES': '👕',
  'Household': '🏠', 'HOUSEHOLD': '🏠',
};

export async function GET() {
  try {
    const sheets = getSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Items_Catalog!A:Z',
    });

    const rows = response.data.values || [];
    
    if (rows.length < 2) {
      return NextResponse.json({
        categories: [
          { id: 'food', name: 'Food', icon: '🍚' },
          { id: 'building', name: 'Building Materials', icon: '🧱' },
          { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
        ]
      });
    }

    const headers = rows[0];
    const categoryIdx = headers.indexOf('super_category') !== -1 ? headers.indexOf('super_category') : headers.indexOf('category');
    const categoryIdIdx = headers.indexOf('category_id');

    const categoriesMap = new Map<string, { id: string; name: string; icon: string }>();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const categoryName = row[categoryIdx];
      const categoryId = row[categoryIdIdx] || categoryName?.toLowerCase().replace(/\s+/g, '_');
      
      if (categoryName && !categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: categoryId,
          name: categoryName,
          icon: CATEGORY_ICONS[categoryName] || '📦'
        });
      }
    }

    return NextResponse.json({ categories: Array.from(categoriesMap.values()) });

  } catch (error) {
    console.error('Categories error:', error);
    return NextResponse.json({
      categories: [
        { id: 'food', name: 'Food', icon: '🍚' },
        { id: 'building', name: 'Building Materials', icon: '🧱' },
        { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
      ]
    });
  }
}

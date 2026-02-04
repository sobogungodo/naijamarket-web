import { NextResponse } from 'next/server';

const UNITS = [
  { id: 'bag', name: 'Bag (50kg)', symbol: 'bag' },
  { id: 'bag_25kg', name: 'Bag (25kg)', symbol: '25kg bag' },
  { id: 'basket', name: 'Basket', symbol: 'basket' },
  { id: 'bunch', name: 'Bunch', symbol: 'bunch' },
  { id: 'carton', name: 'Carton', symbol: 'carton' },
  { id: 'dozen', name: 'Dozen', symbol: 'doz' },
  { id: 'gallon', name: 'Gallon (25L)', symbol: '25L' },
  { id: 'kg', name: 'Kilogram', symbol: 'kg' },
  { id: 'litre', name: 'Litre', symbol: 'L' },
  { id: 'mudu', name: 'Mudu', symbol: 'mudu' },
  { id: 'paint', name: 'Paint Bucket', symbol: 'paint' },
  { id: 'piece', name: 'Piece', symbol: 'pc' },
  { id: 'sheet', name: 'Sheet', symbol: 'sheet' },
  { id: 'ton', name: 'Ton', symbol: 'ton' },
  { id: 'tuber', name: 'Tuber', symbol: 'tuber' },
  { id: 'unit', name: 'Unit', symbol: 'unit' },
];

export async function GET() {
  return NextResponse.json({ units: UNITS });
}

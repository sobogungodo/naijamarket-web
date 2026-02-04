// ============================================================================
// FILE: src/app/api/trader/auth/test-db/route.ts
// PURPOSE: Diagnostic endpoint to test Azure SQL connection and OTP_Sessions
// DELETE THIS FILE AFTER DEBUGGING
// ============================================================================

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Basic connection
  try {
    const connectionTest = await prisma.$queryRaw`SELECT 1 as test`;
    results.tests.connection = { success: true, result: connectionTest };
  } catch (error: any) {
    results.tests.connection = { success: false, error: error.message };
  }

  // Test 2: Check if OTP_Sessions table exists
  try {
    const tableCheck = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'OTP_Sessions'
    `;
    results.tests.otpTableExists = { 
      success: true, 
      exists: Array.isArray(tableCheck) && tableCheck.length > 0,
      result: tableCheck 
    };
  } catch (error: any) {
    results.tests.otpTableExists = { success: false, error: error.message };
  }

  // Test 3: Check OTP_Sessions columns
  try {
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OTP_Sessions'
      ORDER BY ORDINAL_POSITION
    `;
    results.tests.otpColumns = { success: true, columns };
  } catch (error: any) {
    results.tests.otpColumns = { success: false, error: error.message };
  }

  // Test 4: Try to count rows in OTP_Sessions
  try {
    const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM OTP_Sessions`;
    results.tests.otpCount = { success: true, result: count };
  } catch (error: any) {
    results.tests.otpCount = { success: false, error: error.message };
  }

  // Test 5: Check Traders_register table
  try {
    const traderCheck = await prisma.$queryRaw`
      SELECT TOP 1 phone_number, full_name, registration_status 
      FROM Traders_register 
      WHERE phone_number = '358465526959'
    `;
    results.tests.traderLookup = { success: true, result: traderCheck };
  } catch (error: any) {
    results.tests.traderLookup = { success: false, error: error.message };
  }

  // Test 6: Try INSERT into OTP_Sessions
  try {
    const testPhone = 'TEST_' + Date.now();
    const testOtp = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    await prisma.$executeRaw`
      INSERT INTO OTP_Sessions (phone, otp, expires_at, trader_name, created_at)
      VALUES (${testPhone}, ${testOtp}, ${expiresAt}, 'Test Trader', GETUTCDATE())
    `;
    
    // Clean up test record
    await prisma.$executeRaw`DELETE FROM OTP_Sessions WHERE phone = ${testPhone}`;
    
    results.tests.otpInsert = { success: true, message: 'INSERT and DELETE worked' };
  } catch (error: any) {
    results.tests.otpInsert = { success: false, error: error.message };
  }

  // Summary
  const allPassed = Object.values(results.tests).every((t: any) => t.success);
  results.summary = allPassed ? '✅ All tests passed!' : '❌ Some tests failed';

  return NextResponse.json(results, { status: allPassed ? 200 : 500 });
}

// ============================================================================
// src/app/api/reports/debug/route.ts
// Debug endpoint to check session tier - DELETE AFTER DEBUGGING
// ============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();
  
  // Log everything for debugging
  console.log("Full session:", JSON.stringify(session, null, 2));
  
  // Check all possible tier locations
  const user = session?.user as Record<string, unknown> | undefined;
  
  const tierInfo = {
    hasSession: !!session,
    hasUser: !!session?.user,
    userEmail: session?.user?.email,
    userName: session?.user?.name,
    
    // All possible tier property names
    tier: user?.tier,
    subscriptionTier: user?.subscriptionTier,
    subscription_tier: user?.subscription_tier,
    userTier: user?.userTier,
    plan: user?.plan,
    subscription: user?.subscription,
    membership: user?.membership,
    
    // Full user object keys
    userKeys: user ? Object.keys(user) : [],
    
    // Full user object
    fullUser: user,
  };
  
  return NextResponse.json({
    success: true,
    debug: tierInfo,
    message: "Check the 'tier' or related fields to see where your subscription is stored",
  });
}

export const dynamic = "force-dynamic";

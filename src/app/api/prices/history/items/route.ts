// ============================================================================
// src/app/api/prices/history/items/route.ts
// Which dashboard item names currently resolve to a PHN v2 history series.
// The prices table gates each row's chart affordance on this set.
//
// FAIL-CLOSED: returns { items: [] } unless PHN_V2_ENABLED === "true", mirroring
// the gate on /api/prices/history itself. So while the feature is gated, no row
// advertises a chart — the client sees an empty set and hides every affordance.
// Flipping the flag lights up exactly the 90 names (53 v2 + 37 aliases) with no
// client change.
//
// No DB call: the set is a hand-verified static snapshot (src/lib/phnV2Items),
// so this is trivially cacheable and cannot fail at the data layer.
// ============================================================================

import { NextResponse } from "next/server";
import { HISTORY_ITEM_NAMES } from "@/lib/phnV2Items";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = process.env.PHN_V2_ENABLED === "true";
  return NextResponse.json({ items: enabled ? HISTORY_ITEM_NAMES : [] });
}

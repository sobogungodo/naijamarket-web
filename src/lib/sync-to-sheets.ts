// ============================================================================
// src/lib/sync-to-sheets.ts
// NaijaMarket Intel - Sync Consumer to Google Sheets via Apps Script Web App
// Version: 2.0.0
// Date: 2026-02-20
//
// PURPOSE: After web registration writes to Azure SQL, this calls your
// Apps Script web app to append the same consumer to Google Sheets.
// WhatsApp bot then recognizes the user immediately.
//
// SETUP: Set GOOGLE_SHEETS_SYNC_WEBHOOK in Vercel env vars
//        (the Apps Script web app deployment URL)
// ============================================================================

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_SYNC_WEBHOOK || "";
const SYNC_API_KEY = process.env.INTERNAL_SYNC_API_KEY || "";

// ============================================================================
// TYPES
// ============================================================================

export interface ConsumerSyncData {
  consumer_id: string;
  phone_number: string;
  preferred_language?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  gender?: string;
  age_range?: string;
  registration_date?: string;
  registration_source?: string;
  subscription_tier?: string;
  daily_query_limit?: number;
  max_markets?: number;
  account_status?: string;
}

interface SyncResult {
  success: boolean;
  method: string;
  action?: string;
  error?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function syncConsumerToSheets(data: ConsumerSyncData): Promise<SyncResult> {
  if (!WEBHOOK_URL) {
    console.warn("[SYNC-TO-SHEETS] GOOGLE_SHEETS_SYNC_WEBHOOK not set - skipping");
    return { success: false, method: "NONE", error: "Webhook URL not configured" };
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: SYNC_API_KEY,
        source: "WEB_REGISTRATION",
        timestamp: new Date().toISOString(),
        data: {
          consumer_id: data.consumer_id,
          phone_number: data.phone_number,
          preferred_language: data.preferred_language || "EN",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          full_name: data.full_name || [data.first_name, data.last_name].filter(Boolean).join(" "),
          gender: data.gender || "",
          age_range: data.age_range || "",
          registration_date: data.registration_date || new Date().toISOString().split("T")[0],
          registration_source: data.registration_source || "WEB",
          subscription_tier: data.subscription_tier || "FREE",
          daily_query_limit: data.daily_query_limit || 3,
          max_markets: data.max_markets || 2,
          account_status: data.account_status || "ACTIVE",
        },
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout - Apps Script can be slow on cold start
    });

    const responseText = await response.text();
    
    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        console.log(`[SYNC-TO-SHEETS] Done: ${result.action || "SYNCED"} ${data.consumer_id}`);
        return { success: true, method: "APPS_SCRIPT", action: result.action };
      } catch {
        console.log(`[SYNC-TO-SHEETS] Consumer ${data.consumer_id} synced`);
        return { success: true, method: "APPS_SCRIPT" };
      }
    } else {
      console.error(`[SYNC-TO-SHEETS] Failed HTTP ${response.status}: ${responseText}`);
      return { success: false, method: "APPS_SCRIPT", error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    console.error(`[SYNC-TO-SHEETS] Error: ${error.message}`);
    return { success: false, method: "APPS_SCRIPT", error: error.message };
  }
}

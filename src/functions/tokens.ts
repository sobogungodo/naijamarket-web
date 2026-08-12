/*
================================================================================
NAIJAMARKET INTEL - PAY-PER-QUERY API ENDPOINTS
================================================================================
Deploy to: func-naijamarket-api
Routes:
  GET  /api/tokens/packs          - List available token packs
  GET  /api/tokens/wallet/:phone  - Get wallet balance & info
  POST /api/tokens/purchase       - Process token purchase (after payment)
  POST /api/tokens/deduct         - Deduct token for a query
  GET  /api/tokens/history/:phone - Transaction history
  POST /api/tokens/webhook        - Paystack/Flutterwave payment webhook

File: src/functions/tokens.ts
Add to your existing func-naijamarket-api project
================================================================================
*/

// ============================================================================
// FILE: src/functions/tokens.ts
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import sql from "mssql";

// Connection config (reuse from existing db.ts or inline)
const dbConfig: sql.config = {
    server: process.env.SQL_SERVER || "naijafood.database.windows.net",
    database: process.env.SQL_DATABASE || "NaijaMarketIntel",
    user: process.env.SQL_USER || "",
    password: process.env.SQL_PASSWORD || "",
    options: {
        encrypt: true,
        trustServerCertificate: false,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
    if (!pool || !pool.connected) {
        pool = await new sql.ConnectionPool(dbConfig).connect();
    }
    return pool;
}

function jsonResponse(data: any, status: number = 200): HttpResponseInit {
    return {
        status,
        headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
        },
        body: JSON.stringify(data),
    };
}

function normalizePhone(phone: string): string {
    if (!phone) return "";
    let p = phone.replace(/\s+/g, "").replace(/^whatsapp:/, "");
    if (p.startsWith("0")) p = "+234" + p.substring(1);
    if (p.startsWith("234")) p = "+" + p;
    if (!p.startsWith("+")) p = "+" + p;
    return p;
}

// ============================================================================
// 1. GET /api/tokens/packs - List available token packs
// ============================================================================
async function getTokenPacks(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT 
                pack_id, pack_name, display_name, tokens, bonus_tokens,
                price_naira, price_per_query, savings_percent,
                is_popular, description_en, description_pidgin, min_tier, sort_order
            FROM dbo.Token_Packs
            WHERE is_active = 1 AND pack_id != 'PROMO_FREE'
            ORDER BY sort_order
        `);

        return jsonResponse({
            status: "success",
            packs: result.recordset,
            count: result.recordset.length,
        });
    } catch (error: any) {
        ctx.error("getTokenPacks error:", error);
        return jsonResponse({ status: "error", message: "Failed to load token packs" }, 500);
    }
}

app.http("tokens-packs", {
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    route: "tokens/packs",
    handler: getTokenPacks,
});


// ============================================================================
// 2. GET /api/tokens/wallet/:phone - Get wallet balance
// ============================================================================
async function getTokenWallet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        const phone = normalizePhone(req.params.phone || "");
        if (!phone) return jsonResponse({ status: "error", message: "Phone number required" }, 400);

        const db = await getPool();
        const result = await db.request()
            .input("phone", sql.VarChar(20), phone)
            .execute("dbo.sp_GetOrCreateTokenWallet");

        const wallet = result.recordset[0];
        if (!wallet) {
            return jsonResponse({ status: "error", message: "Could not create wallet" }, 500);
        }

        // Get recent transactions (last 5)
        const txResult = await db.request()
            .input("ConsumerPhone", sql.VarChar(20), phone)
            .input("Limit", sql.Int, 5)
            .input("Offset", sql.Int, 0)
            .execute("dbo.sp_GetTokenTransactions");

        return jsonResponse({
            status: "success",
            wallet: {
                ...wallet,
                recent_transactions: txResult.recordsets[0] || [],
            },
        });
    } catch (error: any) {
        ctx.error("getTokenWallet error:", error);
        return jsonResponse({ status: "error", message: "Failed to load wallet" }, 500);
    }
}

app.http("tokens-wallet", {
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    route: "tokens/wallet/{phone}",
    handler: getTokenWallet,
});


// ============================================================================
// 3. POST /api/tokens/purchase - Initialize token purchase
//    Body: { phone, pack_id, channel, callback_url }
//    Returns: Paystack/Flutterwave payment link
// ============================================================================
async function purchaseTokens(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        const body: any = await req.json();
        const phone = normalizePhone(body.phone || "");
        const packId = body.pack_id;
        const channel = body.channel || "WEB";
        const callbackUrl = body.callback_url || process.env.PAYMENT_CALLBACK_URL || "";

        if (!phone || !packId) {
            return jsonResponse({ status: "error", message: "phone and pack_id required" }, 400);
        }

        // Get pack details
        const db = await getPool();
        const packResult = await db.request()
            .input("packId", sql.VarChar(30), packId)
            .query(`SELECT * FROM dbo.Token_Packs WHERE pack_id = @packId AND is_active = 1`);

        const pack = packResult.recordset[0];
        if (!pack) {
            return jsonResponse({ status: "error", message: "Invalid token pack" }, 400);
        }

        // Generate unique reference
        const reference = `PPQ-${Date.now()}-${phone.slice(-4)}`;

        // Create Paystack payment initialization
        const paystackKey = process.env.PAYSTACK_SECRET_KEY;
        
        if (!paystackKey) {
            return jsonResponse({ 
                status: "error", 
                message: "Payment provider not configured" 
            }, 500);
        }

        // Get consumer email if available
        const consumerResult = await db.request()
            .input("phone", sql.VarChar(20), phone)
            .query(`SELECT email FROM dbo.Consumers WHERE phone_number = @phone`);
        
        const email = consumerResult.recordset[0]?.email || `${phone.replace("+", "")}@naijamarket.ng`;

        const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${paystackKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: email,
                amount: Math.round(pack.price_naira * 100), // Paystack uses kobo
                reference: reference,
                callback_url: callbackUrl || `${process.env.WEBSITE_URL}/dashboard/tokens?payment=success`,
                metadata: {
                    consumer_phone: phone,
                    pack_id: packId,
                    pack_name: pack.pack_name,
                    tokens: pack.tokens + pack.bonus_tokens,
                    channel: channel,
                    custom_fields: [
                        { display_name: "Phone", variable_name: "phone", value: phone },
                        { display_name: "Pack", variable_name: "pack", value: pack.display_name },
                        { display_name: "Tokens", variable_name: "tokens", value: String(pack.tokens + pack.bonus_tokens) },
                    ],
                },
            }),
        });

        const paystackData: any = await paystackResponse.json();

        if (!paystackData.status) {
            ctx.error("Paystack init failed:", paystackData);
            return jsonResponse({ 
                status: "error", 
                message: "Payment initialization failed",
                detail: paystackData.message 
            }, 500);
        }

        return jsonResponse({
            status: "success",
            payment: {
                authorization_url: paystackData.data.authorization_url,
                access_code: paystackData.data.access_code,
                reference: paystackData.data.reference,
            },
            pack: {
                pack_id: pack.pack_id,
                display_name: pack.display_name,
                tokens: pack.tokens + pack.bonus_tokens,
                price: pack.price_naira,
            },
        });
    } catch (error: any) {
        ctx.error("purchaseTokens error:", error);
        return jsonResponse({ status: "error", message: "Purchase initialization failed" }, 500);
    }
}

app.http("tokens-purchase", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    route: "tokens/purchase",
    handler: purchaseTokens,
});


// ============================================================================
// 4. POST /api/tokens/deduct - Deduct token for a query
//    Body: { phone, query_id, market_name, item_name, price_returned, channel }
// ============================================================================
async function deductToken(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        const body: any = await req.json();
        const phone = normalizePhone(body.phone || "");

        if (!phone) {
            return jsonResponse({ status: "error", message: "Phone number required" }, 400);
        }

        const db = await getPool();
        const result = await db.request()
            .input("ConsumerPhone", sql.VarChar(20), phone)
            .input("QueryId", sql.VarChar(50), body.query_id || null)
            .input("MarketName", sql.NVarChar(200), body.market_name || null)
            .input("ItemName", sql.NVarChar(300), body.item_name || null)
            .input("PriceReturned", sql.Decimal(18, 2), body.price_returned || null)
            .input("Channel", sql.VarChar(20), body.channel || "WHATSAPP")
            .execute("dbo.sp_DeductQueryToken");

        const deductResult = result.recordset[0];

        // Map SP response to appropriate HTTP status
        if (deductResult.status === "NO_WALLET") {
            return jsonResponse(deductResult, 404);
        }
        if (deductResult.status === "INSUFFICIENT") {
            return jsonResponse(deductResult, 402); // Payment Required
        }
        if (deductResult.status === "SUSPENDED") {
            return jsonResponse(deductResult, 403);
        }
        if (deductResult.status === "ERROR") {
            return jsonResponse(deductResult, 500);
        }

        return jsonResponse(deductResult);
    } catch (error: any) {
        ctx.error("deductToken error:", error);
        return jsonResponse({ status: "error", message: "Token deduction failed" }, 500);
    }
}

app.http("tokens-deduct", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    route: "tokens/deduct",
    handler: deductToken,
});


// ============================================================================
// 5. GET /api/tokens/history/:phone - Transaction history
//    Query params: ?limit=20&offset=0&type=PURCHASE
// ============================================================================
async function getTokenHistory(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        const phone = normalizePhone(req.params.phone || "");
        if (!phone) return jsonResponse({ status: "error", message: "Phone required" }, 400);

        const limit = Math.min(parseInt(req.query.get("limit") || "20"), 100);
        const offset = parseInt(req.query.get("offset") || "0");
        const typeFilter = req.query.get("type") || null;

        const db = await getPool();
        const result = await db.request()
            .input("ConsumerPhone", sql.VarChar(20), phone)
            .input("Limit", sql.Int, limit)
            .input("Offset", sql.Int, offset)
            .input("TypeFilter", sql.VarChar(20), typeFilter)
            .execute("dbo.sp_GetTokenTransactions");

        return jsonResponse({
            status: "success",
            transactions: result.recordsets[0] || [],
            total: result.recordsets[1]?.[0]?.total_transactions || 0,
            limit,
            offset,
        });
    } catch (error: any) {
        ctx.error("getTokenHistory error:", error);
        return jsonResponse({ status: "error", message: "Failed to load history" }, 500);
    }
}

app.http("tokens-history", {
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    route: "tokens/history/{phone}",
    handler: getTokenHistory,
});


// ============================================================================
// 6. POST /api/tokens/webhook - Paystack Payment Webhook
//    Paystack sends: { event: "charge.success", data: { reference, ... } }
// ============================================================================
async function paymentWebhook(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Verify Paystack signature
        const crypto = await import("crypto");
        const paystackKey = process.env.PAYSTACK_SECRET_KEY || "";
        const rawBody = await req.text();
        const hash = crypto
            .createHmac("sha512", paystackKey)
            .update(rawBody)
            .digest("hex");
        
        const signature = req.headers.get("x-paystack-signature");
        
        if (hash !== signature) {
            ctx.warn("Invalid webhook signature");
            return jsonResponse({ status: "error", message: "Invalid signature" }, 401);
        }

        const payload = JSON.parse(rawBody);
        ctx.log("Paystack webhook received:", payload.event, payload.data?.reference);

        // Only process successful charges
        if (payload.event !== "charge.success") {
            return jsonResponse({ status: "ok", message: "Event ignored" });
        }

        const data = payload.data;
        const reference = data.reference;
        const metadata = data.metadata || {};
        const phone = normalizePhone(metadata.consumer_phone || "");
        const packId = metadata.pack_id;
        const channel = metadata.channel || "WEB";

        if (!phone || !packId) {
            ctx.error("Webhook missing metadata:", { reference, phone, packId });
            return jsonResponse({ status: "error", message: "Missing metadata" }, 400);
        }

        // Verify amount matches pack price
        const db = await getPool();
        const packResult = await db.request()
            .input("packId", sql.VarChar(30), packId)
            .query(`SELECT * FROM dbo.Token_Packs WHERE pack_id = @packId`);
        
        const pack = packResult.recordset[0];
        if (!pack) {
            ctx.error("Webhook: invalid pack_id:", packId);
            return jsonResponse({ status: "error", message: "Invalid pack" }, 400);
        }

        const expectedAmount = Math.round(pack.price_naira * 100); // kobo
        if (data.amount !== expectedAmount) {
            ctx.error("Amount mismatch:", { expected: expectedAmount, received: data.amount });
            return jsonResponse({ status: "error", message: "Amount mismatch" }, 400);
        }

        // Process the purchase via stored procedure
        const purchaseResult = await db.request()
            .input("ConsumerPhone", sql.VarChar(20), phone)
            .input("PackId", sql.VarChar(30), packId)
            .input("PaymentReference", sql.VarChar(100), reference)
            .input("PaymentProvider", sql.VarChar(30), "PAYSTACK")
            .input("Channel", sql.VarChar(20), channel)
            .execute("dbo.sp_PurchaseTokenPack");

        const result = purchaseResult.recordset[0];

        if (result.status === "ERROR") {
            ctx.error("sp_PurchaseTokenPack failed:", result.message);
            return jsonResponse({ status: "error", message: result.message }, 500);
        }

        ctx.log("Token purchase SUCCESS:", {
            phone,
            pack: packId,
            tokens: result.tokens_credited,
            reference,
        });

        // WhatsApp purchase confirmation retired with Twilio. The token wallet is
        // currently OFF (double-credit bug), so there is no live purchase to notify;
        // wire a Meta template (e.g. a token_purchase_confirmed UTILITY template)
        // here when the wallet is re-enabled. Credit already committed above.

        return jsonResponse({ status: "success", message: "Payment processed" });
    } catch (error: any) {
        ctx.error("paymentWebhook error:", error);
        return jsonResponse({ status: "error", message: "Webhook processing failed" }, 500);
    }
}

app.http("tokens-webhook", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "tokens/webhook",
    handler: paymentWebhook,
});

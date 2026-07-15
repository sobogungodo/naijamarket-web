import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { listBasket, addToBasket, setQuantity, removeFromBasket, clearBasket } from "@/lib/basket";

export const runtime = "nodejs";

// Shared identity resolver — B's POST/PATCH/DELETE reuse this verbatim.
// Mirrors the mobile favorites route: token → consumer_id → phone_number
// re-read from Consumers (token phone can be stale). Returns naked digits.
async function resolvePhoneFromSession(): Promise<
  | { ok: true; phone: string; consumer_id: string }
  | { ok: false; status: 401 | 404; error: string }
> {
  const session = await getServerSession(authOptions);
  const consumer_id = session?.user?.id;
  if (!consumer_id) return { ok: false, status: 401, error: "not authenticated" };

  const rows = await prisma.$queryRaw<Array<{ phone_number: string | null; phone: string | null }>>`
    SELECT phone_number, phone FROM Consumers WHERE consumer_id = ${consumer_id}
  `;
  const raw = rows[0]?.phone_number || rows[0]?.phone || "";
  if (!raw) return { ok: false, status: 404, error: "no phone on file" };

  return { ok: true, phone: raw.replace(/\+/g, ""), consumer_id };
}

export async function GET(req: NextRequest) {
  try {
    const id = await resolvePhoneFromSession();
    if (!id.ok) return NextResponse.json({ error: id.error }, { status: id.status });

    const items = await listBasket({ phone: id.phone });

    const debug = req.nextUrl.searchParams.get("debug") === "1";
    return NextResponse.json({
      items,
      ...(debug ? { phone: id.phone, consumer_id: id.consumer_id } : {}),
    });
  } catch (e) {
    console.error("[GET /api/consumer/basket]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const id = await resolvePhoneFromSession();
    if (!id.ok) return NextResponse.json({ error: id.error }, { status: id.status });

    let body: { item_id?: unknown; quantity?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const item_id = typeof body.item_id === "string" ? body.item_id.trim() : "";
    if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

    const qRaw = Number(body.quantity ?? 1);
    const quantity = Number.isFinite(qRaw) && qRaw > 0 ? Math.floor(qRaw) : 1;

    // Validate item_id against the consumer-visible catalog and derive name/unit
    // server-side — never trust client name/unit (currentPriceFor keys price on name).
    const rows = await prisma.$queryRaw<Array<{ item_id: string; item_name: string; unit: string | null }>>`
      SELECT TOP 1 item_id, item_name, unit
      FROM Latest_Prices_Summary
      WHERE item_id = ${item_id}
        AND is_nbs_ref = 0 AND is_food = 1 AND price_naira > 0
    `;
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "unknown item" }, { status: 404 });

    const result = await addToBasket({
      phone: id.phone,
      item_id: row.item_id,
      item_name: row.item_name,
      unit: row.unit,
      quantity,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[POST /api/consumer/basket]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = await resolvePhoneFromSession();
    if (!id.ok) return NextResponse.json({ error: id.error }, { status: id.status });

    let body: { item_id?: unknown; quantity?: unknown };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

    const item_id = typeof body.item_id === "string" ? body.item_id.trim() : "";
    if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

    const qRaw = Number(body.quantity);
    if (!Number.isFinite(qRaw)) return NextResponse.json({ error: "quantity required" }, { status: 400 });

    // quantity <= 0 soft-deletes the line (basket.ts semantics) — intentional.
    const result = await setQuantity({ phone: id.phone, item_id, quantity: Math.floor(qRaw) });
    if (!result.ok) return NextResponse.json({ error: "no active line for item_id" }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[PATCH /api/consumer/basket]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = await resolvePhoneFromSession();
    if (!id.ok) return NextResponse.json({ error: id.error }, { status: id.status });

    // ?item_id=X removes one line. ?all=1 clears the basket. Bare DELETE is
    // rejected — clearing is destructive and must be explicit.
    const item_id = (req.nextUrl.searchParams.get("item_id") || "").trim();
    const all = req.nextUrl.searchParams.get("all") === "1";

    if (!item_id && !all) {
      return NextResponse.json({ error: "item_id or all=1 required" }, { status: 400 });
    }

    if (!item_id) {
      const result = await clearBasket({ phone: id.phone });
      return NextResponse.json(result, { status: 200 });
    }

    const result = await removeFromBasket({ phone: id.phone, item_id });
    // removeFromBasket returns ok:true always — `removed` is the real signal.
    if (result.removed === 0) return NextResponse.json({ error: "no active line for item_id" }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[DELETE /api/consumer/basket]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

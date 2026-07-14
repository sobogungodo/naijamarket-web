import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { listBasket } from "@/lib/basket";

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

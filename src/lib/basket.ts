// ============================================================================
// NAIJAMARKET INTEL - CANONICAL BASKET HELPER
// File: src/lib/basket.ts
// Purpose: single source of truth for reading/writing Consumer_Basket so web,
//          WhatsApp and mobile share one basket (cross-surface continuity),
//          mirroring lib/favorites.ts. There is intentionally NO Prisma model
//          for Consumer_Basket — all access is via $queryRaw / $executeRaw.
//
// How a basket differs from favorites (the two basket-specific semantics):
//   1. QUANTITY  — a re-add of the same item is NOT a rejected duplicate; it
//      INCREMENTS quantity (upsert-increment) on the UX_ConsBasket_Identity
//      collision.
//   2. PRICE-AT-ADD — the current price is captured ONCE at first add
//      (price_at_add / price_at_add_date) and is NEVER overwritten on re-add,
//      so listBasket can surface price movement ("up 3% since you added it").
//
// Identity / auth invariant (verbatim from favorites.ts / watchlist commit):
//   the caller passes a SESSION-DERIVED phone (never a client value); every
//   lookup keys on  REPLACE(phone_number,'+','') = REPLACE(${phone},'+','').
//   The phone is stored on the row AS-PASSED (naked); both sides are normalized
//   at read/update time. No login holds DELETE — every removal is a soft-delete
//   (is_active = 0) via UPDATE only.
// ============================================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface AddBasketInput {
  /** Session-derived phone (e.g. session.user.phone). Never a client value. */
  phone: string;
  /** Canonical catalog ids/name passed by the caller (already resolved). */
  item_id: string;
  item_name: string;
  unit?: string | null;
  category_id?: string | null;
  /** Amount to add; defaults to 1. Re-add increments by this amount. */
  quantity?: number;
}

export type AddReason = "added" | "incremented";

export interface AddBasketResult {
  ok: boolean;
  reason: AddReason;
  /** Present only on a fresh INSERT (reason "added"). */
  basket_id?: string;
  /** Quantity of the line AFTER this operation. */
  new_quantity: number;
}

export interface SetQuantityInput {
  phone: string;
  item_id: string;
  quantity: number;
}

export interface SetQuantityResult {
  ok: boolean;
  /** Resulting quantity (0 when quantity <= 0 soft-deleted the line). */
  quantity: number;
}

export interface RemoveBasketInput {
  phone: string;
  item_id: string;
}

export interface RemoveBasketResult {
  ok: boolean;
  /** Rows soft-deleted (0 or 1). */
  removed: number;
}

export interface ClearBasketResult {
  ok: boolean;
  /** Active rows soft-deleted for this phone. */
  cleared: number;
}

/** One basket line + live price movement (the price-movement feature). */
export interface BasketLine {
  basket_id: string;
  item_id: string;
  item_name: string | null;
  quantity: number;
  unit: string | null;
  /** Price captured at first add (set-once). NULL if no price then. */
  price_at_add: number | null;
  price_at_add_date: Date | null;
  /** Current national-average price (recomputed at view). NULL if none now. */
  current_price: number | null;
  /** ((current - at_add) / at_add) * 100. NULL when either price is missing. */
  delta_pct: number | null;
}

/** Raw shape as returned by $queryRaw before numeric coercion. */
interface RawBasketRow {
  basket_id: string;
  item_id: string;
  item_name: string | null;
  quantity: number | bigint;
  unit: string | null;
  price_at_add: unknown;
  price_at_add_date: Date | null;
}

// ----------------------------------------------------------------------------
// ID MINTER (owned here — never imported from a route). Mirrors favId() but
// parametrized: genId("BSK") -> "BSK_<base36 time>_<base36 rand>".
// ----------------------------------------------------------------------------

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ----------------------------------------------------------------------------
// UNIQUE-VIOLATION DETECTION
// A re-add of the same (phone_number, item_id) trips UX_ConsBasket_Identity.
// Via $executeRaw, Prisma surfaces the underlying SQL Server error number 2601
// (unique index) or 2627 (unique constraint / PK). Treat as "already present"
// and fall through to the increment/resurrect path — NOT an error.
// ----------------------------------------------------------------------------

function isUniqueViolation(e: unknown): boolean {
  const anyE = e as { message?: string; meta?: { message?: string } };
  const s = `${anyE?.message ?? ""} ${anyE?.meta?.message ?? ""}`;
  return (
    s.includes("2601") ||
    s.includes("2627") ||
    s.includes("UX_ConsBasket_Identity") ||
    s.includes("duplicate key")
  );
}

// ----------------------------------------------------------------------------
// CONSUMER_ID LOOKUP (same naked-phone key as favorites.ts)
// ----------------------------------------------------------------------------

async function lookupConsumerId(phone: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ consumer_id: string | null }>>`
    SELECT TOP 1 consumer_id
    FROM Consumers
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
  `;
  return rows[0]?.consumer_id ?? null;
}

// ----------------------------------------------------------------------------
// PRICE CAPTURE (exact-match on canonical item_name — the favorites.py:70 form,
// NOT fuzzy LIKE). AVG over zero rows returns one row with NULL avg_p, so a
// missing price yields null (never rejects the add).
// ----------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  return v == null ? null : Number(v);
}

async function currentPriceFor(itemName: string): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ avg_p: unknown }>>`
    SELECT AVG(price_naira) AS avg_p
    FROM Latest_Prices_Summary
    WHERE item_name = ${itemName}
      AND is_nbs_ref = 0
      AND is_food = 1
      AND price_naira > 0
  `;
  return toNum(rows[0]?.avg_p);
}

// ----------------------------------------------------------------------------
// ADD (upsert-increment)
// INSERT a fresh line; on UX_ConsBasket_Identity collision the item is already
// in the basket -> increment quantity and resurrect if soft-deleted, WITHOUT
// touching price_at_add / price_at_add_date (set-once: movement measures from
// the ORIGINAL add). UPDATE ... OUTPUT returns the post-increment quantity in
// one round-trip. No is_active filter on the UPDATE so a soft-deleted line is
// resurrected (is_active = 1) rather than duplicated.
// ----------------------------------------------------------------------------

export async function addToBasket({
  phone,
  item_id,
  item_name,
  unit,
  category_id,
  quantity = 1,
}: AddBasketInput): Promise<AddBasketResult> {
  const nakedPhone = phone.replace(/\+/g, "");
  const consumer_id = await lookupConsumerId(nakedPhone);
  const basket_id = genId("BSK");
  const qty = quantity && quantity > 0 ? Math.floor(quantity) : 1;

  // Capture the current price ONCE, now. null price -> null date (paired).
  const price_at_add = await currentPriceFor(item_name);
  const priceDate =
    price_at_add === null ? Prisma.sql`NULL` : Prisma.sql`SYSUTCDATETIME()`;

  try {
    await prisma.$executeRaw`
      INSERT INTO Consumer_Basket
        (basket_id, phone_number, consumer_id, item_id, item_name, category_id,
         quantity, unit, price_at_add, price_at_add_date,
         is_active, created_at, updated_at)
      VALUES
        (${basket_id}, ${nakedPhone}, ${consumer_id}, ${item_id}, ${item_name}, ${category_id ?? null},
         ${qty}, ${unit ?? null}, ${price_at_add}, ${priceDate},
         1, SYSUTCDATETIME(), SYSUTCDATETIME())
    `;
    return { ok: true, reason: "added", basket_id, new_quantity: qty };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;

    // COLLISION: already in basket. Increment + resurrect; price_at_add / date
    // are deliberately UNTOUCHED (set-once). OUTPUT gives the new quantity.
    const rows = await prisma.$queryRaw<Array<{ quantity: number | bigint }>>`
      UPDATE Consumer_Basket
      SET quantity = quantity + ${qty},
          is_active = 1,
          updated_at = SYSUTCDATETIME()
      OUTPUT inserted.quantity AS quantity
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
        AND item_id = ${item_id}
    `;
    const new_quantity = rows[0] ? Number(rows[0].quantity) : qty;
    return { ok: true, reason: "incremented", new_quantity };
  }
}

// ----------------------------------------------------------------------------
// SET QUANTITY (web +/- controls). quantity <= 0 -> soft-delete the line.
// ----------------------------------------------------------------------------

export async function setQuantity({
  phone,
  item_id,
  quantity,
}: SetQuantityInput): Promise<SetQuantityResult> {
  const nakedPhone = phone.replace(/\+/g, "");

  if (quantity <= 0) {
    const removed = await prisma.$executeRaw`
      UPDATE Consumer_Basket
      SET is_active = 0, updated_at = SYSUTCDATETIME()
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
        AND item_id = ${item_id}
        AND is_active = 1
    `;
    return { ok: Number(removed) > 0, quantity: 0 };
  }

  const q = Math.floor(quantity);
  const updated = await prisma.$executeRaw`
    UPDATE Consumer_Basket
    SET quantity = ${q}, updated_at = SYSUTCDATETIME()
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
      AND item_id = ${item_id}
      AND is_active = 1
  `;
  return { ok: Number(updated) > 0, quantity: q };
}

// ----------------------------------------------------------------------------
// REMOVE (soft-delete a single line)
// ----------------------------------------------------------------------------

export async function removeFromBasket({
  phone,
  item_id,
}: RemoveBasketInput): Promise<RemoveBasketResult> {
  const nakedPhone = phone.replace(/\+/g, "");
  const removed = await prisma.$executeRaw`
    UPDATE Consumer_Basket
    SET is_active = 0, updated_at = SYSUTCDATETIME()
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
      AND item_id = ${item_id}
      AND is_active = 1
  `;
  return { ok: true, removed: Number(removed) };
}

// ----------------------------------------------------------------------------
// CLEAR (soft-delete ALL active lines for the phone)
// ----------------------------------------------------------------------------

export async function clearBasket({
  phone,
}: {
  phone: string;
}): Promise<ClearBasketResult> {
  const nakedPhone = phone.replace(/\+/g, "");
  const cleared = await prisma.$executeRaw`
    UPDATE Consumer_Basket
    SET is_active = 0, updated_at = SYSUTCDATETIME()
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
      AND is_active = 1
  `;
  return { ok: true, cleared: Number(cleared) };
}

// ----------------------------------------------------------------------------
// LIST (+ price movement). One round-trip for the lines, then ONE aggregate
// price query over all distinct item_names in the basket (WHERE item_name IN
// (...)) rather than N per-line queries. delta_pct is guarded against a null or
// zero price_at_add.
// ----------------------------------------------------------------------------

export async function listBasket({
  phone,
}: {
  phone: string;
}): Promise<BasketLine[]> {
  const nakedPhone = phone.replace(/\+/g, "");

  const rows = await prisma.$queryRaw<RawBasketRow[]>`
    SELECT basket_id, item_id, item_name, quantity, unit,
           price_at_add, price_at_add_date
    FROM Consumer_Basket
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${nakedPhone}, '+', '')
      AND is_active = 1
    ORDER BY created_at ASC
  `;
  if (rows.length === 0) return [];

  // Distinct, non-null item_names -> one aggregate current-price query.
  const names = Array.from(
    new Set(rows.map((r) => r.item_name).filter((n): n is string => !!n))
  );

  const priceMap = new Map<string, number>();
  if (names.length > 0) {
    const priceRows = await prisma.$queryRaw<Array<{ item_name: string; avg_p: unknown }>>(
      Prisma.sql`
        SELECT item_name, AVG(price_naira) AS avg_p
        FROM Latest_Prices_Summary
        WHERE item_name IN (${Prisma.join(names)})
          AND is_nbs_ref = 0
          AND is_food = 1
          AND price_naira > 0
        GROUP BY item_name
      `
    );
    for (const pr of priceRows) {
      const v = toNum(pr.avg_p);
      if (v !== null) priceMap.set(pr.item_name, v);
    }
  }

  return rows.map((r) => {
    const price_at_add = toNum(r.price_at_add);
    const current_price = r.item_name ? priceMap.get(r.item_name) ?? null : null;
    const delta_pct =
      price_at_add && current_price !== null
        ? ((current_price - price_at_add) / price_at_add) * 100
        : null;
    return {
      basket_id: r.basket_id,
      item_id: r.item_id,
      item_name: r.item_name,
      quantity: Number(r.quantity),
      unit: r.unit,
      price_at_add,
      price_at_add_date: r.price_at_add_date,
      current_price,
      delta_pct,
    };
  });
}

// ============================================================================
// NAIJAMARKET INTEL - CANONICAL FAVORITES HELPER
// File: src/lib/favorites.ts
// Purpose: single source of truth for reading/writing Consumer_Favorites so
//          web, WhatsApp and mobile share one favorites set (cross-surface
//          continuity). There is intentionally NO Prisma model for
//          Consumer_Favorites — all access is via $queryRaw / $executeRaw.
//          prisma.markets / prisma.items_Catalog are used (typed) only to
//          resolve names to canonical catalog rows.
//
// Identity / auth invariant (verbatim from watchlist security commit 21884a9):
//   the caller passes a SESSION-DERIVED phone (never a client value); every
//   lookup keys on  REPLACE(phone_number,'+','') = REPLACE(${phone},'+','').
//   The phone is stored on the row AS-PASSED; both sides are normalized at
//   read/delete time.
// ============================================================================

import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type FavoriteType = "market" | "item";

export interface ResolvedMarket {
  market_id: string;
  market_name: string | null;
  state: string | null;
  region_id: string | null;
}

export interface ResolvedItem {
  item_id: string;
  item_name: string | null;
  category_id: string | null;
}

export interface FavoriteInput {
  /** Session-derived phone (e.g. session.user.phone). Never a client value. */
  phone: string;
  type: FavoriteType;
  name: string;
}

export type AddReason = "added" | "already_exists" | "unresolved";

export interface AddFavoriteResult {
  ok: boolean;
  reason: AddReason;
  favorite_id?: string;
}

export interface RemoveFavoriteResult {
  ok: boolean;
  removed: number;
  reason?: "unresolved";
}

/** Identity-only row (no prices — the route does the live approved_Prices join). */
export interface FavoriteIdentityRow {
  favorite_id: string;
  favorite_type: string;
  market_id: string | null;
  market_name: string | null;
  state: string | null;
  item_id: string | null;
  item_name: string | null;
  category_id: string | null;
}

// ----------------------------------------------------------------------------
// ID MINTER (owned here — never imported from a route)
// ----------------------------------------------------------------------------

export function favId(): string {
  return `FAV_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ----------------------------------------------------------------------------
// UNIQUE-VIOLATION DETECTION
// A duplicate favorite trips UX_ConsFav_Identity (unique on
// phone_number, favorite_type, item_id, market_id). Via $executeRaw, Prisma
// surfaces the underlying SQL Server error whose number is 2601 (unique index)
// or 2627 (unique constraint / PK). Treat that as idempotent success, not error.
// ----------------------------------------------------------------------------

function isUniqueViolation(e: unknown): boolean {
  const anyE = e as { message?: string; meta?: { message?: string } };
  const s = `${anyE?.message ?? ""} ${anyE?.meta?.message ?? ""}`;
  return (
    s.includes("2601") ||
    s.includes("2627") ||
    s.includes("UX_ConsFav_Identity") ||
    s.includes("duplicate key")
  );
}

// ----------------------------------------------------------------------------
// CONSUMER_ID LOOKUP (same naked-phone key as 21884a9)
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
// RESOLVERS (name -> canonical catalog row)
// ----------------------------------------------------------------------------

/**
 * Resolve a market by name (optionally scoped by state). Deterministic pick on
 * duplicates: sort by market_id ascending and take the lowest. Same input =>
 * same market_id on every surface, surviving the known duplicate (name,state)
 * groups. Returns null when nothing matches (caller must reject).
 */
export async function resolveMarket(
  name: string,
  state?: string
): Promise<ResolvedMarket | null> {
  const rows = await prisma.markets.findMany({
    where: { market_name: name, ...(state ? { state } : {}) },
  });
  if (rows.length === 0) return null;

  const picked = [...rows].sort((a, b) =>
    a.market_id < b.market_id ? -1 : a.market_id > b.market_id ? 1 : 0
  )[0];
  if (!picked) return null;

  return {
    market_id: picked.market_id,
    market_name: picked.market_name ?? null,
    state: picked.state ?? null,
    region_id: picked.region_id ?? null,
  };
}

/** Resolve an item by name (item_name is unique). Returns null when unmatched. */
export async function resolveItem(name: string): Promise<ResolvedItem | null> {
  const item = await prisma.items_Catalog.findFirst({
    where: { item_name: name },
  });
  if (!item) return null;
  return {
    item_id: item.item_id,
    item_name: item.item_name ?? null,
    category_id: item.category_id ?? null,
  };
}

// ----------------------------------------------------------------------------
// ADD
// ----------------------------------------------------------------------------

export async function addFavorite({
  phone,
  type,
  name,
}: FavoriteInput): Promise<AddFavoriteResult> {
  const consumer_id = await lookupConsumerId(phone);
  const id = favId();

  if (type === "market") {
    const m = await resolveMarket(name);
    if (!m) return { ok: false, reason: "unresolved" };

    try {
      // Invariant: market row -> market_* set, item_* NULL. region_code = region_id
      // when available (else NULL).
      await prisma.$executeRaw`
        INSERT INTO Consumer_Favorites
          (favorite_id, phone_number, consumer_id, favorite_type,
           market_id, market_name, state, region_code,
           item_id, item_name, category_id,
           is_active, created_at, updated_at)
        VALUES
          (${id}, ${phone}, ${consumer_id}, 'market',
           ${m.market_id}, ${m.market_name}, ${m.state}, ${m.region_id},
           NULL, NULL, NULL,
           1, SYSUTCDATETIME(), SYSUTCDATETIME())
      `;
      return { ok: true, reason: "added", favorite_id: id };
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: true, reason: "already_exists" };
      throw e;
    }
  }

  // type === "item"
  const it = await resolveItem(name);
  if (!it) return { ok: false, reason: "unresolved" };

  try {
    // Invariant: item row -> item_* set, market_* NULL.
    await prisma.$executeRaw`
      INSERT INTO Consumer_Favorites
        (favorite_id, phone_number, consumer_id, favorite_type,
         market_id, market_name, state, region_code,
         item_id, item_name, category_id,
         is_active, created_at, updated_at)
      VALUES
        (${id}, ${phone}, ${consumer_id}, 'item',
         NULL, NULL, NULL, NULL,
         ${it.item_id}, ${it.item_name}, ${it.category_id},
         1, SYSUTCDATETIME(), SYSUTCDATETIME())
    `;
    return { ok: true, reason: "added", favorite_id: id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, reason: "already_exists" };
    throw e;
  }
}

// ----------------------------------------------------------------------------
// REMOVE
// ----------------------------------------------------------------------------

export async function removeFavorite({
  phone,
  type,
  name,
}: FavoriteInput): Promise<RemoveFavoriteResult> {
  if (type === "market") {
    const m = await resolveMarket(name);
    if (!m) return { ok: false, removed: 0, reason: "unresolved" };

    const removed = await prisma.$executeRaw`
      DELETE FROM Consumer_Favorites
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
        AND favorite_type = 'market'
        AND market_id = ${m.market_id}
    `;
    return { ok: true, removed: Number(removed) };
  }

  const it = await resolveItem(name);
  if (!it) return { ok: false, removed: 0, reason: "unresolved" };

  const removed = await prisma.$executeRaw`
    DELETE FROM Consumer_Favorites
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
      AND favorite_type = 'item'
      AND item_id = ${it.item_id}
  `;
  return { ok: true, removed: Number(removed) };
}

// ----------------------------------------------------------------------------
// LIST (identity only — no price joins; that is the route's job)
// ----------------------------------------------------------------------------

export async function listFavorites({
  phone,
}: {
  phone: string;
}): Promise<FavoriteIdentityRow[]> {
  return prisma.$queryRaw<FavoriteIdentityRow[]>`
    SELECT favorite_id, favorite_type,
           market_id, market_name, state,
           item_id, item_name, category_id
    FROM Consumer_Favorites
    WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
      AND is_active = 1
    ORDER BY created_at ASC
  `;
}

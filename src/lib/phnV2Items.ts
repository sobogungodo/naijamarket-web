// ============================================================================
// src/lib/phnV2Items.ts
// Single source of truth for which dashboard item names resolve to a PHN v2
// price-history series. Imported by:
//   - api/prices/history/items/route.ts  (the set the client gates on)
//   - api/prices/history/route.ts         (resolve incoming name -> v2 name)
//   - components/PriceHistoryModal.tsx     (excluded-item empty state)
//   - (dashboard)/dashboard/prices/page.tsx (row clickability)
//
// Pure constants + pure functions only. No DB, no env, no server-only imports,
// so it is safe in both server routes and client components.
//
// MAINTENANCE: V2_ITEM_NAMES is a snapshot of
//   SELECT DISTINCT item_name_standard FROM dbo.Price_History_NBS_v2_national
// (53 rows: 42 base + 11 DERIVED_PACK bag SKUs, verified live 2026-07-24).
// Regenerate it whenever PHN v2 is rebuilt
// with a changed item roster. A name that drifts out of sync fails safe: it
// simply resolves to null and renders the honest empty state, never a wrong
// series.
// ============================================================================

// The 53 canonical v2 item_name_standard values: 42 per-unit base items, plus
// the 11 DERIVED_PACK bag SKUs added 2026-07-24. Each is its OWN DISTINCT
// item_name_standard in Price_History_NBS_v2_national (the bag names carry their
// own PACK_* item_id), so each is a canonical name here — not a RELABEL_ALIAS.
export const V2_ITEM_NAMES: readonly string[] = [
  "Beans - Brown (per kg)",
  "Beans - White Black Eye (per kg)",
  "Beef - Bone In (per kg)",
  "Beef - Boneless (per kg)",
  "Bread - Sliced 500g",
  "Bread - Unsliced 500g",
  "Catfish - Dried (per kg)",
  "Catfish - Fresh Obokun (per kg)",
  "Catfish - Smoked (per kg)",
  "Chicken Feet (per kg)",
  "Chicken Wings (per kg)",
  "Eggs - Agric Medium (1 pc)",
  "Eggs - Agric Medium (Crate)",
  "Evaporated Milk - Carnation 170g",
  "Evaporated Milk - Peak 170g",
  "Garri - White (per kg)",
  "Garri - Yellow (per kg)",
  "Groundnut Oil - 1 Litre Bottle",
  "Irish Potato (per kg)",
  "Mackerel - Frozen (per kg)",
  "Maize - White (per kg)",
  "Maize - Yellow (per kg)",
  "Mudfish - Dried (per kg)",
  "Mudfish - Fresh Aro (per kg)",
  "Onions - Bulb (per kg)",
  "Palm Oil - 1 Litre Bottle",
  "Plantain - Ripe (per kg)",
  "Plantain - Unripe (per kg)",
  "Rice - Agric/Local (per kg)",
  "Rice - Imported Premium (per kg)",
  "Rice - Local Long Grain (per kg)",
  "Rice - Medium Grain (per kg)",
  "Rice - Ofada/Broken (per kg)",
  "Sardine - Dried (per kg)",
  "Sardine - Iced/Fresh (per kg)",
  "Sweet Potato (per kg)",
  "Tilapia - Fresh (per kg)",
  "Titus/Mackerel - Frozen (per kg)",
  "Tomatoes - Fresh (per kg)",
  "Vegetable Oil - 1 Litre Bottle",
  "Wheat Flour - Golden Penny 2kg",
  "Yam Tuber (per kg)",
  // -- 11 DERIVED_PACK bag SKUs (bag = the per-kg series x pack size; each has
  //    its own PACK_* item_id and its own item_name_standard in v2_national).
  //    These are NEW v2 names, not aliases: a bag is its own series, so it lives
  //    here. It must NOT go in RELABEL_ALIASES, whose values must be an existing
  //    per-unit canonical — a bag has none, and aliasing a bag to its per-kg
  //    name would resolve the click to the wrong (per-kg) item_id. --
  "Beans - Brown (100kg)",
  "Beans - White Black Eye (100kg)",
  "Garri - White (50kg)",
  "Garri - Yellow (50kg)",
  "Maize - White (100kg)",
  "Maize - Yellow (100kg)",
  "Rice - Agric/Local (50kg)",
  "Rice - Local Long Grain (50kg)",
  "Rice - Ofada/Broken (50kg)",
  "Rice - Imported Premium (50kg)",
  "Wheat Flour - Golden Penny (50kg)",
];

// 37 hand-verified relabel aliases: dashboard item_name -> v2 item_name_standard.
// Every key exists verbatim in Latest_Prices_Summary; every value is one of the
// 42 base names above (never a bag SKU); every pair is the same commodity at the same unit (verified live
// 2026-07-23). 32 are exact same-unit relabels; the final 5 (bread, milk,
// wheat flour) carry a cosmetic unit-string difference (loaf/piece, unit/tin,
// 2kg/pack) that denotes the identical physical pack — accepted by Prof.
//
// EXCLUDED, deliberately absent: pack-size variants (Beans 100kg, Garri 50kg —
// unit mismatch, the ITM01018 trap), different cut/variety/species (Beef
// Kidney, Beans Oloyin, Eggs Turkey), the three "(NBS 1 Litre)" oils (the v2
// oil label is a known-wrong 75cl-vs-1L artifact, step-7 fix), and both frozen
// chicken labels (ITM01018, priced by unit — see EXCLUDED_ITEM_LABELS).
export const RELABEL_ALIASES: Readonly<Record<string, string>> = {
  // -- 32 clean same-unit relabels --
  "Beans - Brown (NBS per kg)": "Beans - Brown (per kg)",
  "Beans - White Black Eye (NBS per kg)": "Beans - White Black Eye (per kg)",
  "Beef Bone-in (NBS per kg)": "Beef - Bone In (per kg)",
  "Beef Boneless (NBS per kg)": "Beef - Boneless (per kg)",
  "Broken Rice Ofada (NBS per kg)": "Rice - Ofada/Broken (per kg)",
  "Catfish Dried (NBS per kg)": "Catfish - Dried (per kg)",
  "Catfish Fresh Obokun (NBS per kg)": "Catfish - Fresh Obokun (per kg)",
  "Catfish Smoked (NBS per kg)": "Catfish - Smoked (per kg)",
  "Chicken Feet (NBS per kg)": "Chicken Feet (per kg)",
  "Chicken Wings (NBS per kg)": "Chicken Wings (per kg)",
  "Dried Fish Sardine (NBS per kg)": "Sardine - Dried (per kg)",
  "Egg Medium (NBS per piece)": "Eggs - Agric Medium (1 pc)",
  "Garri - White (NBS per kg)": "Garri - White (per kg)",
  "Garri - Yellow (NBS per kg)": "Garri - Yellow (per kg)",
  "Iced Sardine (NBS per kg)": "Sardine - Iced/Fresh (per kg)",
  "Irish Potato (NBS per kg)": "Irish Potato (per kg)",
  "Mackerel Frozen (NBS per kg)": "Mackerel - Frozen (per kg)",
  "Maize Grain - White (NBS per kg)": "Maize - White (per kg)",
  "Maize Grain - Yellow (NBS per kg)": "Maize - Yellow (per kg)",
  "Mudfish Aro Fresh (NBS per kg)": "Mudfish - Fresh Aro (per kg)",
  "Mudfish Dried (NBS per kg)": "Mudfish - Dried (per kg)",
  "Onion Bulb (NBS per kg)": "Onions - Bulb (per kg)",
  "Plantain Ripe (NBS per kg)": "Plantain - Ripe (per kg)",
  "Plantain Unripe (NBS per kg)": "Plantain - Unripe (per kg)",
  "Rice - Agric (NBS per kg)": "Rice - Agric/Local (per kg)",
  "Rice - Imported High Quality (NBS per kg)": "Rice - Imported Premium (per kg)",
  "Rice - Medium Grained (NBS per kg)": "Rice - Medium Grain (per kg)",
  "Sweet Potato (NBS per kg)": "Sweet Potato (per kg)",
  "Tilapia Fish Fresh (NBS per kg)": "Tilapia - Fresh (per kg)",
  "Titus Frozen (NBS per kg)": "Titus/Mackerel - Frozen (per kg)",
  "Tomato (NBS per kg)": "Tomatoes - Fresh (per kg)",
  "Yam Tuber (NBS per kg)": "Yam Tuber (per kg)",
  // -- 5 flagged: identical pack, cosmetic unit-string difference --
  "Bread Sliced 500g (NBS)": "Bread - Sliced 500g",
  "Bread Unsliced 500g (NBS)": "Bread - Unsliced 500g",
  "Evaporated Milk Carnation 170g (NBS)": "Evaporated Milk - Carnation 170g",
  "Evaporated Milk Peak 170g (NBS)": "Evaporated Milk - Peak 170g",
  "Wheat Flour Golden Penny 2kg (NBS)": "Wheat Flour - Golden Penny 2kg",
};

// Both frozen-chicken labels are ITM01018 — excluded from PHN v2 by design
// (NBS prices it by unit, which will not convert to the per-kg basis). They
// resolve to NO series and MUST keep the excluded-item empty state, not the
// generic "no data" one.
export const EXCLUDED_ITEM_LABELS: readonly string[] = [
  "Chicken - Frozen (per kg)",
  "Frozen Chicken (NBS per unit)",
];

// The names the client gates row-clickability on when the feature is enabled:
// the 53 v2 names plus the 37 relabel keys. Excluded items are intentionally
// NOT here — they are handled separately so their row opens the excluded state.
export const HISTORY_ITEM_NAMES: readonly string[] = [
  ...V2_ITEM_NAMES,
  ...Object.keys(RELABEL_ALIASES),
];

const V2_SET = new Set(V2_ITEM_NAMES);
const EXCLUDED_SET = new Set(EXCLUDED_ITEM_LABELS);

export function isExcludedItemLabel(name: string): boolean {
  return EXCLUDED_SET.has(name);
}

// Resolve an incoming dashboard item name to its v2 item_name_standard, or null
// if it has no v2 series (including the excluded items and everything off-map).
// This is what makes the relabel map take effect at query time.
export function resolveV2ItemName(name: string | null | undefined): string | null {
  if (!name) return null;
  if (V2_SET.has(name)) return name;
  return RELABEL_ALIASES[name] ?? null;
}

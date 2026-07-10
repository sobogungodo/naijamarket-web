// ============================================================================
// ONE-OFF MIGRATION: legacy Consumers.favorite_markets/favorite_items JSON
//   -> canonical Consumer_Favorites, THROUGH the real addFavorite() helper
//   (so it exercises the real resolvers + the one-ID invariant + the
//    UX_ConsFav_Identity idempotency path — no hand-built inserts).
//
// The only legacy record with non-empty favorites at migration time is phone
// +358417203868:
//   markets: "Balogun Market" (-> MKT0009/Lagos), "Oja Oba Ilorin" (-> MKT0208/Kwara)
//   item:    "Beans - Brown (100kg)" (-> ITM00008)
//
// Run (loads .env for the app DATABASE_URL; runs as the app login):
//   node --env-file=.env --import tsx scripts/migrate-legacy-favorites.ts
// ============================================================================

import { addFavorite, type FavoriteType } from "../src/lib/favorites";

const PHONE = "+358417203868";

const TARGETS: Array<{ type: FavoriteType; name: string }> = [
  { type: "market", name: "Balogun Market" },
  { type: "market", name: "Oja Oba Ilorin" },
  { type: "item", name: "Beans - Brown (100kg)" },
];

async function main() {
  for (const t of TARGETS) {
    const res = await addFavorite({ phone: PHONE, type: t.type, name: t.name });
    console.log(`${t.type.padEnd(6)} :: ${t.name.padEnd(24)} => ${JSON.stringify(res)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION FAILED:", e);
    process.exit(1);
  });

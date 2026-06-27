// ============================================================================
// src/lib/i18n.ts — EN + Naija Pidgin string table for the consumer web.
//
// Mirrors the naijamarket-mobile lib/i18n.ts pattern exactly: every key holds
// { en, pcm }, and t(key, lang, vars?) returns the chosen string with {var}
// interpolation. PCM follows the shipped WA voice (func-naijamarket-wa
// shared/i18n.py) and the mobile app, so all three surfaces read the same.
//
// t() falls back to en for any missing lang/key, so a not-yet-translated
// string is never broken — it just shows English.
// ============================================================================

export type Lang = "en" | "pcm";

export const STRINGS = {
  // ── Common ────────────────────────────────────────────────────────────────
  common_loading:     { en: "Loading…",                          pcm: "Loading…" },
  common_error:       { en: "Something went wrong. Try again.",  pcm: "Something go wrong. Try again." },
  common_retry:       { en: "Try Again",                         pcm: "Try Again" },
  common_cancel:      { en: "Cancel",                            pcm: "Cancel" },
  common_save:        { en: "Save",                              pcm: "Save" },
  common_saving:      { en: "Saving…",                           pcm: "We dey save…" },
  common_saved:       { en: "Saved",                             pcm: "Don save" },
  common_done:        { en: "Done",                              pcm: "Done" },
  common_confirm:     { en: "Confirm",                           pcm: "Confirm" },
  common_close:       { en: "Close",                             pcm: "Close" },
  common_back:        { en: "Back",                              pcm: "Back" },
  common_search:      { en: "Search",                            pcm: "Search" },
  common_yes:         { en: "Yes",                               pcm: "Yes" },
  common_no:          { en: "No",                                pcm: "No" },
  common_view_all:    { en: "View all",                          pcm: "See all" },
  common_see_more:    { en: "See more",                          pcm: "See more" },
  common_refresh:     { en: "Refresh",                           pcm: "Refresh" },
  common_no_data:     { en: "No data available",                pcm: "No data dey" },
  common_per:         { en: "per",                               pcm: "per" },
  common_updated:     { en: "Updated",                           pcm: "Updated" },

  // ── Language switcher ──────────────────────────────────────────────────────
  lang_label:         { en: "Language",                          pcm: "Language" },
  lang_english:       { en: "English",                           pcm: "English" },
  lang_pidgin:        { en: "Naija Pidgin",                      pcm: "Naija Pidgin" },
  lang_changed:       { en: "Language updated",                  pcm: "Language don change" },

  // ── Bottom navigation (mobile, top-level routes) ───────────────────────────
  nav_home:           { en: "Home",                              pcm: "Home" },
  nav_prices:         { en: "Prices",                            pcm: "Prices" },
  nav_trends:         { en: "Trends",                            pcm: "Trends" },
  nav_alerts:         { en: "Alerts",                            pcm: "Alerts" },
  nav_account:        { en: "Account",                           pcm: "Account" },
  nav_settings:       { en: "Settings",                          pcm: "Settings" },
  nav_logout:         { en: "Log Out",                           pcm: "Log Out" },

  // ── Dashboard home ─────────────────────────────────────────────────────────
  dash_title:          { en: "Market Snapshot",                  pcm: "Market Snapshot" },
  dash_last_updated:   { en: "Last updated:",                    pcm: "Last update:" },
  dash_your_activity:  { en: "Your Activity",                    pcm: "Your Activity" },
  dash_manage_watchlist:{ en: "Manage Watchlist",               pcm: "Manage Watchlist" },
  dash_recent_queries: { en: "RECENT QUERIES",                   pcm: "RECENT SEARCH" },
  dash_live_prices:    { en: "Live Prices — Lagos Markets",      pcm: "Live Price — Lagos Market" },

  // ── Page chrome shared by the consumer tools ───────────────────────────────
  page_loading:        { en: "Loading…",                         pcm: "We dey load…" },
  page_error:          { en: "Could not load data. Please try again.", pcm: "Data no load. Abeg try again." },
  page_empty:          { en: "Nothing to show yet.",             pcm: "Nothing dey here yet." },
  page_search_ph:      { en: "Search a commodity (e.g. rice, beans)…", pcm: "Search commodity (e.g. rice, beans)…" },

  // ── Alerts ─────────────────────────────────────────────────────────────────
  alerts_title:        { en: "Price Alerts",                     pcm: "Price Alerts" },
  alerts_subtitle:     { en: "Get notified when prices reach your target levels", pcm: "We go tell you when price reach your target" },
  alerts_new:          { en: "New Alert",                        pcm: "New Alert" },
  alerts_none:         { en: "No Price Alerts Yet",              pcm: "You No Get Price Alert Yet" },
  alerts_active:       { en: "Active",                           pcm: "Active" },

  // ── Compare ────────────────────────────────────────────────────────────────
  compare_title:       { en: "Compare Markets",                  pcm: "Compare Market" },
  compare_subtitle:    { en: "Compare a commodity across markets", pcm: "Compare one commodity for different market" },
  compare_pick:        { en: "Pick a commodity to compare",      pcm: "Choose commodity to compare" },

  // ── Forecast ───────────────────────────────────────────────────────────────
  forecast_title:      { en: "Seasonal Forecast",               pcm: "Seasonal Forecast" },
  forecast_subtitle:   { en: "Projected prices based on recent trends", pcm: "Price wey we expect based on how e dey go" },
  forecast_disclaimer: { en: "Forecast is indicative only — not a guarantee.", pcm: "Na just estimate — no be promise." },

  // ── Watchlist ──────────────────────────────────────────────────────────────
  watchlist_title:     { en: "My Watchlist",                     pcm: "My Watchlist" },
  watchlist_subtitle:  { en: "Commodities you are tracking",     pcm: "Commodities wey you dey track" },
  watchlist_empty:     { en: "Your watchlist is empty. Add a commodity to start tracking.", pcm: "Your watchlist empty. Add commodity to start track am." },
  watchlist_add:       { en: "Add to Watchlist",                 pcm: "Add to Watchlist" },

  // ── Prices ─────────────────────────────────────────────────────────────────
  prices_title:        { en: "Latest Prices",                    pcm: "Latest Price" },
  prices_subtitle:     { en: "Real-time commodity prices across markets", pcm: "Real-time commodity price for different market" },
} as const;

// ── Dashboard sidebar feature links — keyed by stable href so NavLink can
//    translate with zero call-site changes. Falls back to the English label
//    prop for any href not listed here.
export const NAV_LABELS: Record<string, { en: string; pcm: string }> = {
  "/dashboard":               { en: "Dashboard",      pcm: "Dashboard" },
  "/dashboard/snapshot":      { en: "Snapshot",       pcm: "Snapshot" },
  "/dashboard/prices":        { en: "Prices",         pcm: "Prices" },
  "/dashboard/markets":       { en: "Markets",        pcm: "Markets" },
  "/dashboard/compare":       { en: "Compare",        pcm: "Compare" },
  "/dashboard/inflation":     { en: "Inflation",      pcm: "Inflation" },
  "/dashboard/watchlist":     { en: "Watchlist",      pcm: "Watchlist" },
  "/dashboard/arbitrage":     { en: "Arbitrage",      pcm: "Buy-Sell Deal" },
  "/dashboard/screener":      { en: "Screener",       pcm: "Screener" },
  "/dashboard/heatmap":       { en: "Heatmap",        pcm: "Heatmap" },
  "/dashboard/morning-brief": { en: "Morning Brief",  pcm: "Morning Gist" },
  "/dashboard/bulk-buyer":    { en: "Bulk Buyer",     pcm: "Big Buy" },
  "/dashboard/analytics":     { en: "Analytics",      pcm: "Analytics" },
  "/dashboard/forecast":      { en: "Forecast",       pcm: "Price Guess" },
  "/dashboard/reports":       { en: "Reports",        pcm: "Reports" },
  "/dashboard/supplier":      { en: "Supplier Intel", pcm: "Supplier Intel" },
  "/dashboard/revenue":       { en: "Revenue",        pcm: "Revenue" },
  "/dashboard/api":           { en: "API Keys",       pcm: "API Keys" },
  "/dashboard/api-portal":    { en: "API Portal",     pcm: "API Portal" },
  "/dashboard/tokens":        { en: "Token Wallet",   pcm: "Token Wallet" },
  "/dashboard/history":       { en: "Query History",  pcm: "Search History" },
  "/dashboard/export":        { en: "Export Data",    pcm: "Export Data" },
  "/dashboard/alerts":        { en: "Price Alerts",   pcm: "Price Alerts" },
  "/dashboard/settings":      { en: "Settings",       pcm: "Settings" },
};

export function navLabel(href: string, lang: Lang, fallback: string): string {
  const e = NAV_LABELS[href];
  return e ? (e[lang] ?? e.en) : fallback;
}

export type StringKey = keyof typeof STRINGS;

export function t(
  key: StringKey,
  lang: Lang,
  vars?: Record<string, string | number>
): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  let str: string = (entry as Record<Lang, string>)[lang] ?? entry.en;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return str;
}

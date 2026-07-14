"""
shared/i18n.py — EN + Naija Pidgin strings for all consumer flows
"""
from shared.lang import VALID_LANGS, DEFAULT_LANG

def t(lang, key, **kwargs):
    lang = lang if lang in VALID_LANGS else DEFAULT_LANG
    entry = S.get(key, {})
    text = entry.get(lang) or entry.get(DEFAULT_LANG, f"[{key}]")
    try:
        return text.format(**kwargs) if kwargs else text
    except Exception:
        return text

S = {
    # Language toggle
    "lang_prompt": {
        "en":  "🌐 *LANGUAGE*\n\n*1* English\n*2* Naija Pidgin\n\nReply 1 or 2\n\n_Reply with a number_",
        "pcm": "🌐 *TONGUE*\n\n*1* English\n*2* Naija Pidgin\n\nSend 1 or 2\n\n_Type the number_",
    },
    "lang_set_en":  {"en":  "✅ Language set to *English*",          "pcm": "✅ Language set to *English*"},
    "lang_set_pcm": {"en":  "✅ Language changed to *Naija Pidgin*!", "pcm": "✅ E don change to *Naija Pidgin*! 🇳🇬"},

    # FIRST CONTACT — one-time greeting on a brand-new number's very first message
    "first_contact_welcome": {
        "en": (
            "👋 *Welcome to NaijaMarket Intel!*\n\n"
            "Thank you for contacting us.\n"
            "Tell us how we can help:\n\n"
            "1️⃣ Check food prices\n"
            "2️⃣ Become a price reporter (earn ₦50 per submission)\n"
            "3️⃣ Talk to a human\n\n"
            "👋 _How far! Make we show you wetin dey happen for market today._"
        ),
        "pcm": (
            "👋 *Welcome to NaijaMarket Intel!*\n\n"
            "Thank you for contacting us.\n"
            "Tell us how we can help:\n\n"
            "1️⃣ Check food prices\n"
            "2️⃣ Become a price reporter (earn ₦50 per submission)\n"
            "3️⃣ Talk to a human\n\n"
            "👋 _How far! Make we show you wetin dey happen for market today._"
        ),
    },

    # MENU
    "menu_header": {
        "en":  "🇳🇬 *NaijaMarket Intel*\n────────────────\nPlan: *{tier}* | {quota}\n\n*1* 💰 Prices — Live market prices\n*2* 🔄 Arbitrage — Buy cheap, sell higher\n*3* 🔔 Alerts — Price movement alerts\n*4* ⚖️ Compare — Compare across states\n*5* 📈 Trend — Price history tracker\n*6* 📊 Snapshot — State market overview\n*7* 📉 NFPI — National food inflation\n*8* 🏭 Bulk Buyer — Best bulk prices\n*9* 🔮 Forecast — Price predictions\n*10* 📰 Daily Brief — Today's movers\n\n━━━━━━━━━━━━━━━━━━━━━━\n🛒 *a* 🛒 basket — Shopping list total\n*b* 🎁 invite — Share & earn\n*c* 📊 status — Your account info\n*d* 🔄 upgrade — Change plan\n*e* ⭐ favorites — Saved commodities\n*f* 🧮 calc — Price calculator\n*g* 📤 export — Download data\n*h* ⬇️ downgrade — Reduce plan\n*i* 🕐 history — Recent searches\n━━━━━━━━━━━━━━━━━━━━━━\nReply with a number or letter",
        "pcm": "🇳🇬 *NaijaMarket Intel*\n────────────────\nPlan: *{tier}* | {quota}\n\n*1* 💰 Prices — Check market price\n*2* 🔄 Arbitrage — Buy cheap sell dear\n*3* 🔔 Alerts — Price move alert\n*4* ⚖️ Compare — Compare price for states\n*5* 📈 Trend — Price history\n*6* 📊 Snapshot — State market gist\n*7* 📉 NFPI — Food inflation data\n*8* 🏭 Bulk Buyer — Best bulk price\n*9* 🔮 Forecast — Price guess\n*10* 📰 Daily Brief — Today market gist\n\n━━━━━━━━━━━━━━━━━━━━━━\n*a* 🛒 basket — Shopping list\n*b* 🎁 invite — Share and earn\n*c* 📊 status — Your account\n*d* 🔄 upgrade — Change plan\n*e* ⭐ favorites — Saved commodities\n*f* 🧮 calc — Price calculator\n*g* 📤 export — Download data\n*h* ⬇️ downgrade — Reduce plan\n*i* 🕐 history — Recent searches\n━━━━━━━━━━━━━━━━━━━━━━\nSend number or letter",
    },

    # PRICES
    "prices_title":       {"en": "💰 *PRICES*\n────────────────\n\nSelect a state:\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                           "pcm":"💰 *PRICE CHECK*\n────────────────\n\nChoose state:\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "prices_pick_market": {"en": "📍 *{state}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                           "pcm":"📍 *{state}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "prices_pick_cat":    {"en": "🏪 *{market}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                           "pcm":"🏪 *{market}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "prices_pick_item":   {"en": "📦 *{cat}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                           "pcm":"📦 *{cat}*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "prices_result":      {"en": "💰 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n🏪 {market}\n\n💵 *₦{price:,.0f}* per {unit}\n{arrow} {change:.1f}% ({trend})\n\n📊 Week:  ₦{wlo:,.0f} – ₦{whi:,.0f}\n📊 Month: ₦{mlo:,.0f} – ₦{mhi:,.0f}\n\n📅 {date}\n━━━━━━━━━━━━━━━━━━━━━━\n*prices* — Check another | *menu* — Menu",
                           "pcm":"💰 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n🏪 {market}\n\n💵 *₦{price:,.0f}* per {unit}\n{arrow} {change:.1f}% (e {trend})\n\n📊 Week:  ₦{wlo:,.0f} – ₦{whi:,.0f}\n📊 Month: ₦{mlo:,.0f} – ₦{mhi:,.0f}\n\n📅 {date}\n━━━━━━━━━━━━━━━━━━━━━━\n*prices* — Check another | *menu* — Menu"},
    "prices_no_data":     {"en": "⚠️ No price data available. Try again later.\n\n_Type *menu* to go back_",
                           "pcm":"⚠️ No price data dey now. Try again later.\n\n_Type *menu* to go back_"},
    "prices_no_state":    {"en": "⚠️ No states found for '{q}'. Try another.",
                           "pcm":"⚠️ No state found for '{q}'. Try another."},

    # ARBITRAGE
    "arbi_title":   {"en": "🔄 *ARBITRAGE*\n────────────────\n\nType a commodity to find buy-low/sell-high opportunities:\n\n_Examples: rice, beans, yam, tomato_\n\n*0* — Menu\n\n_Type a commodity name_",
                     "pcm":"🔄 *BUY-SELL DEAL*\n────────────────\n\nType commodity to find where to buy cheap and sell dear:\n\n_Examples: rice, beans, yam, tomato_\n\n*0* — Menu\n\n_Type commodity name_"},
    "arbi_result":  {"en": "🔄 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🟢 BUY at: *{buy_mkt}* ({buy_st})\n   ₦{buy_p:,.0f} per {unit}\n\n🔴 SELL at: *{sell_mkt}* ({sell_st})\n   ₦{sell_p:,.0f} per {unit}\n\n💰 Spread: *₦{spread:,.0f}* ({pct:.1f}%){transport}\n━━━━━━━━━━━━━━━━━━━━━━\n\n*Market ladder:*\n{ladder}\n\n*arbi* — Search again | *menu* — Menu",
                     "pcm":"🔄 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🟢 BUY for: *{buy_mkt}* ({buy_st})\n   ₦{buy_p:,.0f} per {unit}\n\n🔴 SELL for: *{sell_mkt}* ({sell_st})\n   ₦{sell_p:,.0f} per {unit}\n\n💰 Gain: *₦{spread:,.0f}* ({pct:.1f}%){transport}\n━━━━━━━━━━━━━━━━━━━━━━\n\n*Market price list:*\n{ladder}\n\n*arbi* — Search again | *menu* — Menu"},
    "arbi_not_found":{"en":"⚠️ No item found for '{q}'.\n\n*0* — Menu",
                      "pcm":"⚠️ No commodity found for '{q}'.\n\n*0* — Menu"},

    # ALERTS
    "alerts_menu":   {"en": "🔔 *PRICE ALERTS*\n────────────────\n\nActive alerts: *{cnt}*\n\n*1* — Set new alert\n*2* — View my alerts\n*3* — Delete an alert\n\n*0* — Menu\n\n_Reply with a number_",
                      "pcm":"🔔 *PRICE ALERT*\n────────────────\n\nAlerts wey dey: *{cnt}*\n\n*1* — Set new alert\n*2* — See my alerts\n*3* — Delete alert\n\n*0* — Menu\n\n_Type the number_"},
    "alerts_set_item":{"en":"🔔 *NEW ALERT*\n\nType the commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Cancel\n\n_Type commodity name_",
                       "pcm":"🔔 *NEW ALERT*\n\nType the commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Cancel\n\n_Type commodity name_"},
    "alerts_set_price":{"en":"✅ *{item}*\n\nEnter your target price (₦):\n\n*0* — Cancel",
                        "pcm":"✅ *{item}*\n\nType the price wey you want (₦):\n\n*0* — Cancel"},
    "alerts_set_type": {"en": "💰 Target: ₦{price:,.0f}\n\nAlert type:\n*1* — BELOW target (good buy)\n*2* — ABOVE target (good sell)\n\n*0* — Cancel\n\n_Reply with a number_",
                        "pcm":"💰 Target: ₦{price:,.0f}\n\nWhich one:\n*1* — BELOW (good to buy)\n*2* — ABOVE (good to sell)\n\n*0* — Cancel\n\n_Type the number_"},
    "alerts_saved":    {"en": "✅ *Alert set!*\n\nItem: *{item}*\nType: *{atype}* ₦{price:,.0f}\n\nWe'll message you on WhatsApp the moment price goes {atype_lo} ₦{price:,.0f}.\n\nYou have *{cnt}* active alert(s).\n\n*myalerts* — Manage | *menu* — Menu",
                        "pcm":"✅ *Alert don set!*\n\nItem: *{item}*\nType: *{atype}* ₦{price:,.0f}\n\nWe go send you WhatsApp message sharp sharp when price go {atype_lo} ₦{price:,.0f}.\n\nYou get *{cnt}* active alert(s).\n\n*myalerts* — Manage | *menu* — Menu"},
    "alerts_none":     {"en": "ℹ️ You have no active alerts.\n\nType *alerts* to set one.\n\n*menu* — Menu",
                        "pcm":"ℹ️ You no get any alert now.\n\nType *alerts* to set one.\n\n*menu* — Menu"},
    "alerts_upgrade":  {"en": "⚠️ *Price alerts require GOLD or above.*\n\nType *upgrade*.\n\n*menu* — Menu",
                        "pcm":"⚠️ *Price alert na for GOLD plan and above.*\n\nType *upgrade*.\n\n*menu* — Menu"},
    "alerts_limit":    {"en": "⚠️ *You've reached your alert limit of {limit}.*\n\nType *upgrade* for more alerts.\n\n*menu* — Menu",
                        "pcm":"⚠️ *You don reach your alert limit ({limit}).*\n\nType *upgrade* to fit add more.\n\n*menu* — Menu"},
    "alerts_deleted":  {"en": "✅ Alert for *{item}* deleted.\n\n*alerts* — Manage | *menu* — Menu",
                        "pcm":"✅ Alert for *{item}* don delete.\n\n*alerts* — Manage | *menu* — Menu"},

    # COMPARE
    "compare_title":  {"en": "⚖️ *COMPARE PRICES*\n────────────────\n\nType a commodity to compare prices across markets:\n\n_Examples: rice, beans, garri, onions_\n\n*0* — Menu\n\n_Reply with a number_",
                       "pcm":"⚖️ *COMPARE PRICE*\n────────────────\n\nType commodity to compare price for different market:\n\n_Examples: rice, beans, garri, onions_\n\n*0* — Menu\n\n_Type the number_"},
    "compare_result": {"en": "⚖️ *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🇳🇬 Nat avg: *₦{avg:,.0f}*\n\n{lines}\n\n🟢 Below avg | 🔴 Above avg\n━━━━━━━━━━━━━━━━━━━━━━\n*compare* — Search again | *menu* — Menu",
                       "pcm":"⚖️ *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🇳🇬 National avg: *₦{avg:,.0f}*\n\n{lines}\n\n🟢 Cheap pass avg | 🔴 Costly pass avg\n━━━━━━━━━━━━━━━━━━━━━━\n*compare* — Search again | *menu* — Menu"},

    # TREND
    "trend_title":  {"en": "📈 *PRICE TREND*\n────────────────\n\nType a commodity name to see price history:\n\n_Examples: rice, beans, tomato, palm oil_\n\n*0* — Menu\n\n_Type a commodity name_",
                     "pcm":"📈 *PRICE TREND*\n────────────────\n\nType commodity name to see how price don dey change:\n\n_Examples: rice, beans, tomato, palm oil_\n\n*0* — Menu\n\n_Type commodity name_"},
    "trend_result": {"en": "📈 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n📊 {mkts} markets tracked\n━━━━━━━━━━━━━━━━━━━━━━\n*trend* — Search again | *menu* — Menu",
                     "pcm":"📈 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n📊 {mkts} market dey track am\n━━━━━━━━━━━━━━━━━━━━━━\n*trend* — Search again | *menu* — Menu"},

    # SNAPSHOT
    "snapshot_title":  {"en": "📊 *MARKET SNAPSHOT*\n────────────────\n\nSelect a state:\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                        "pcm":"📊 *MARKET SNAP*\n────────────────\n\nChoose state:\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "snapshot_result": {"en": "📊 *{state} SNAPSHOT*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🏪 {mkts} markets | 📈 {up} up | 📉 {dn} down\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*snapshot* — Another state | *menu* — Menu",
                        "pcm":"📊 *{state} SNAP*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🏪 {mkts} market | 📈 {up} dey go up | 📉 {dn} dey go down\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*snapshot* — Another state | *menu* — Menu"},
    "snapshot_locked": {"en": "⚠️ *Snapshot requires SILVER or above.*\n\nType *upgrade* to subscribe.\n\n*menu* — Menu",
                        "pcm":"⚠️ *Snapshot na for SILVER plan and above.*\n\nType *upgrade* to subscribe.\n\n*menu* — Menu"},

    # NFPI
    "nfpi_result": {"en": "📊 *NAIJAFOOD PRICE INDEX*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📦 Basket value: *₦{basket:,.0f}*\n{index_line}📅 Updated: {date}\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*menu* — Menu",
                    "pcm":"📊 *NAIJA FOOD PRICE INDEX*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📦 Basket value: *₦{basket:,.0f}*\n{index_line}📅 Updated: {date}\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*menu* — Menu"},

    # BRIEF
    "brief_result": {"en": "📰 *DAILY BRIEF* — {date}\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔼 *TOP RISERS*\n{risers}\n\n🔽 *TOP FALLERS*\n{fallers}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*menu* — Menu",
                     "pcm":"📰 *TODAY NEWS* — {date}\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔼 *PRICE WEY GO UP*\n{risers}\n\n🔽 *PRICE WEY COME DOWN*\n{fallers}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*menu* — Menu"},

    # CALC
    "calc_title":   {"en": "🧮 *PRICE CALCULATOR*\n────────────────\n\nType a commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Menu\n\n_Type a commodity name_",
                     "pcm":"🧮 *PRICE CALCULATOR*\n────────────────\n\nType commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Menu\n\n_Type commodity name_"},
    "calc_qty":     {"en": "✅ *{item}*\nAvg price: ₦{price:,.0f} per {unit}\n\nHow many {unit}s do you want to buy?\n\n*0* — Cancel",
                     "pcm":"✅ *{item}*\nAvg price: ₦{price:,.0f} per {unit}\n\nHow many {unit} you wan buy?\n\n*0* — Cancel"},
    "calc_result":  {"en": "🧮 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\nUnit price: *₦{up:,.0f}* per {unit}\nQuantity:   *{qty:,.0f}* {unit}s\n━━━━━━━━━━━━━━━━━━━━━━\n💰 Total: *₦{total:,.0f}*\n\n*calc* — New calculation | *menu* — Menu",
                     "pcm":"🧮 *{item}*\n━━━━━━━━━━━━━━━━━━━━━━\n\nPrice per {unit}: *₦{up:,.0f}*\nQuantity: *{qty:,.0f}* {unit}\n━━━━━━━━━━━━━━━━━━━━━━\n💰 Total: *₦{total:,.0f}*\n\n*calc* — New calculation | *menu* — Menu"},

    # FORECAST
    "forecast_title":   {"en": "🔮 *PRICE FORECAST*\n────────────────\n\nType a commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Menu\n\n_Type a commodity name_",
                          "pcm":"🔮 *PRICE GUESS*\n────────────────\n\nType commodity name:\n\n_Example: rice, beans, tomato_\n\n*0* — Menu\n\n_Type commodity name_"},
    "forecast_locked":  {"en": "⚠️ *Forecast requires GOLD or above.*\n\nType *upgrade*.\n\n*menu* — Menu",
                          "pcm":"⚠️ *Forecast na for GOLD plan and above.*\n\nType *upgrade*.\n\n*menu* — Menu"},
    "forecast_result":  {"en": "🔮 *{item} FORECAST*\n━━━━━━━━━━━━━━━━━━━━━━\n\nNow:   *₦{now:,.0f}*  {arrow} {direction}\nWeek 1: ₦{wk1:,.0f}\nWeek 2: ₦{wk2:,.0f}\nMonth:  ₦{mo1:,.0f}\n\n_Based on current {pct:+.1f}% trend_\n\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ _Forecast is indicative only_\n\n*forecast* — Another | *menu* — Menu",
                          "pcm":"🔮 *{item} PRICE GUESS*\n━━━━━━━━━━━━━━━━━━━━━━\n\nNow:   *₦{now:,.0f}*  {arrow} e dey {direction}\nWeek 1: ₦{wk1:,.0f}\nWeek 2: ₦{wk2:,.0f}\nMonth:  ₦{mo1:,.0f}\n\n_Based on current {pct:+.1f}% trend_\n\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ _Na just estimate, no be promise_\n\n*forecast* — Another | *menu* — Menu"},

    # BULK
    "bulk_title":   {"en": "🏭 *BULK BUYER*\n────────────────\n\nType a commodity to find best bulk prices:\n\n_Example: rice, beans, yam_\n\n*0* — Menu\n\n_Type a commodity name_",
                     "pcm":"🏭 *BIG BUY*\n────────────────\n\nType commodity to find best price for big quantity:\n\n_Example: rice, beans, yam_\n\n*0* — Menu\n\n_Type commodity name_"},
    "bulk_locked":  {"en": "⚠️ *Bulk Buyer requires BUSINESS or above.*\n\nType *upgrade*.\n\n*menu* — Menu",
                     "pcm":"⚠️ *Big Buy na for BUSINESS plan and above.*\n\nType *upgrade*.\n\n*menu* — Menu"},
    "bulk_result":  {"en": "🏭 *{item} — BULK SOURCING*\n━━━━━━━━━━━━━━━━━━━━━━\n\nUnit: per {unit} | ⭐ = high confidence\n\n{lines}\n\n💰 vs nat avg: *save ₦{savings:,.0f}* at cheapest\n━━━━━━━━━━━━━━━━━━━━━━\n*bulk* — Search again | *menu* — Menu",
                     "pcm":"🏭 *{item} — BIG BUY*\n━━━━━━━━━━━━━━━━━━━━━━\n\nPer {unit} | ⭐ = trustworthy price\n\n{lines}\n\n💰 Vs national avg: *save ₦{savings:,.0f}* for cheapest\n━━━━━━━━━━━━━━━━━━━━━━\n*bulk* — Search again | *menu* — Menu"},

    # FAVORITES
    "fav_menu":   {"en": "⭐ *FAVORITES*\n────────────────\n\n*1* — View my favorites\n*2* — Add a favorite\n*3* — Check prices for favorites\n\n*0* — Menu\n\n_Reply with a number_",
                   "pcm":"⭐ *MY FAVORITES*\n────────────────\n\n*1* — See my favorites\n*2* — Add favorite\n*3* — Check price for favorites\n\n*0* — Menu\n\n_Type the number_"},
    "fav_none":   {"en": "ℹ️ No favorites yet.\n\nSend *2* to add one.\n\n*0* — Menu",
                   "pcm":"ℹ️ You never save any favorite.\n\nSend *2* to add one.\n\n*0* — Menu"},
    "fav_added":  {"en": "✅ *{item}* added to favorites!\n\n*favorites* — Manage | *menu* — Menu",
                   "pcm":"✅ *{item}* don enter your favorites!\n\n*favorites* — Manage | *menu* — Menu"},
    "fav_add_prompt":{"en":"⭐ Type a commodity to add to favorites:\n\n_Example: rice, beans_\n\n*0* — Cancel\n\n_Type commodity name_",
                      "pcm":"⭐ Type commodity wey you want save:\n\n_Example: rice, beans_\n\n*0* — Cancel\n\n_Type commodity name_"},

    # FILTER
    "filter_state":  {"en": "🔍 *FILTER PRICES*\n────────────────\n\nSelect a state:\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                      "pcm":"🔍 *FILTER PRICE*\n────────────────\n\nChoose state:\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "filter_result": {"en": "🔍 *{state} — {cat}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*filter* — New filter | *menu* — Menu",
                      "pcm":"🔍 *{state} — {cat}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n*filter* — New filter | *menu* — Menu"},

    # EXPORT
    "export_locked": {"en": "⚠️ *Export requires BUSINESS or above.*\n\nType *upgrade*.\n\n*menu* — Menu",
                      "pcm":"⚠️ *Export na for BUSINESS plan and above.*\n\nType *upgrade*.\n\n*menu* — Menu"},

    # STATUS
    "status_result": {"en": "📋 *YOUR SUBSCRIPTION*\n──────────────────────\nPlan: *{tier}*\nExpires: *{end}*\n{pending_line}\nType *upgrade* to change plan\nType *downgrade* to schedule downgrade\nType *menu* to go back",
                      "pcm":"📋 *YOUR SUBSCRIPTION*\n──────────────────────\nPlan: *{tier}*\nExpires: *{end}*\n{pending_line}\nType *upgrade* to change plan\nType *downgrade* to schedule downgrade\nType *menu* to go back"},

    # DOWNGRADE
    "downgrade_menu":      {"en": "📉 *DOWNGRADE SUBSCRIPTION*\n─────────────────────────\n\nCurrent Plan: *{tier}*\nExpires: *{end}*\n{pending_block}\n📊 *Available lower tiers:*\n\n{lines}\n\n*0* — Back to menu\n\n⚠️ *Downgrade Policy:*\nYour current plan continues until end of billing period. No refunds.\n\n_Reply with a number_",
                             "pcm":"📉 *DOWNGRADE SUBSCRIPTION*\n─────────────────────────\n\nYour Plan now: *{tier}*\nExpires: *{end}*\n{pending_block}\n📊 *Lower plans wey dey:*\n\n{lines}\n\n*0* — Back to menu\n\n⚠️ *Downgrade Rule:*\nYour current plan go continue till billing period end. No refund.\n\n_Type the number_"},
    "downgrade_confirm":   {"en": "⚠️ *CONFIRM DOWNGRADE*\n─────────────────────────\n\n📉 From: *{from_tier}*\n📊 To: *{to_tier}*\n\n📅 Your *{from_tier}* benefits continue until:\n   *{end}*\n\nAfter that date, you move to *{to_tier}*.\n\n⚠️ *No refunds will be issued.*\n\nReply *confirm* to schedule\nReply *cancel* to keep current plan",
                             "pcm":"⚠️ *CONFIRM DOWNGRADE*\n─────────────────────────\n\n📉 From: *{from_tier}*\n📊 To: *{to_tier}*\n\n📅 Your *{from_tier}* go still work till:\n   *{end}*\n\nAfter that date, you go move to *{to_tier}*.\n\n⚠️ *No refund go happen.*\n\nReply *confirm* to confirm\nReply *cancel* to keep your plan"},
    "downgrade_scheduled": {"en": "✅ *DOWNGRADE SCHEDULED*\n─────────────────────────\n\n📉 From: *{from_tier}*\n📊 To: *{to_tier}*\n📅 Effective: *{end}*\n\nYour *{from_tier}* benefits remain active until then.\n\n💡 Changed your mind?\nType *cancel-downgrade* before the date.\n\n_Type *menu* to go back_",
                             "pcm":"✅ *DOWNGRADE DON SCHEDULE*\n─────────────────────────\n\n📉 From: *{from_tier}*\n📊 To: *{to_tier}*\n📅 When: *{end}*\n\nYour *{from_tier}* go still dey active till then.\n\n💡 You change mind?\nType *cancel-downgrade* before the date.\n\n_Type *menu* to go back_"},
    "downgrade_cancelled": {"en": "✅ *DOWNGRADE CANCELLED*\n\nYou will remain on *{tier}* after your current billing period.\n\n_Type *menu* to go back_",
                             "pcm":"✅ *DOWNGRADE DON CANCEL*\n\nYou go remain for *{tier}* after your billing period.\n\n_Type *menu* to go back_"},

    # UPGRADE/TOKENS
    "upgrade_menu":    {"en": "⬆️ *UPGRADE SUBSCRIPTION*\n────────────────\n\nCurrent: *{tier}*\n\n{lines}\n\n*0* — Menu\n\nReply with a number to select a plan.\n\n_Reply with a number_",
                        "pcm":"⬆️ *UPGRADE PLAN*\n────────────────\n\nYour Plan now: *{tier}*\n\n{lines}\n\n*0* — Menu\n\nSend number to pick plan.\n\n_Type the number_"},
    "upgrade_top":     {"en": "🏆 You are already on *ENTERPRISE* — the highest plan!\n\n*menu* — Menu",
                        "pcm":"🏆 You don reach top! *ENTERPRISE* na the highest plan!\n\n*menu* — Menu"},
    "upgrade_link":    {"en": "💳 *PAYMENT LINK READY*\n────────────────\n\nPlan:   *{label} (₦{price:,})*\nRef:    {ref}\n\n👉 Tap to pay:\n{url}\n\n_Your subscription activates automatically after payment._\n\n*back* — Choose different plan\n*menu* — Main menu",
                        "pcm":"💳 *PAYMENT LINK DON READY*\n────────────────\n\nPlan: *{label} (₦{price:,})*\nRef: {ref}\n\n👉 Tap to pay:\n{url}\n\n_Your subscription go activate automatic after payment._\n\n*back* — Choose different plan\n*menu* — Main menu"},

    # GENERIC
    "invalid_choice": {"en": "❌ Invalid choice. Send a number from the list.", "pcm": "❌ Na wrong number. Send correct number from list."},
    "expiry_warning_3d": {"en": "⚠️ Your *{tier}* plan expires in *{days} day(s)*. Type *renew* to continue uninterrupted.\n\n", "pcm": "⚠️ Your *{tier}* plan go expire in *{days} day(s)*. Type *renew* make e no cut.\n\n"},
    "expiry_warning_1d": {"en": "🚨 Your *{tier}* plan expires *tomorrow*. Type *renew* now to avoid interruption.\n\n", "pcm": "🚨 Your *{tier}* plan go expire *tomorrow*. Type *renew* now now.\n\n"},
    "expiry_today":      {"en": "🚨 Your *{tier}* plan *expired today*. Type *renew* to reactivate.\n\n", "pcm": "🚨 Your *{tier}* plan don *expire today*. Type *renew* to reactivate.\n\n"},
    "digest_on_confirm":  {"en": "✅ *Daily Digest ON*\n\nYou will receive a morning market brief at 8:30 AM WAT every day.\n\nType *digest off* to stop anytime.\n\n*menu* — Menu", "pcm": "✅ *Daily Digest ON*\n\nYou go receive morning market brief every day for 8:30 AM.\n\nType *digest off* to stop.\n\n*menu* — Menu"},
    "digest_off_confirm": {"en": "✅ *Daily Digest OFF*\n\nYou will no longer receive morning updates.\n\nType *digest on* to reactivate.\n\n*menu* — Menu", "pcm": "✅ *Daily Digest OFF*\n\nYou no go receive morning update again.\n\nType *digest on* to start again.\n\n*menu* — Menu"},
    "digest_already_on":  {"en": "ℹ️ Daily Digest is already active. Type *digest off* to stop.\n\n*menu* — Menu", "pcm": "ℹ️ Daily Digest don already dey on. Type *digest off* to stop.\n\n*menu* — Menu"},
    "digest_already_off": {"en": "ℹ️ Daily Digest is already off. Type *digest on* to activate.\n\n*menu* — Menu", "pcm": "ℹ️ Daily Digest don already dey off. Type *digest on* to activate.\n\n*menu* — Menu"},
    "basket_title":   {"en": "🛒 *BASKET BUILDER*\n────────────────\n\nType commodity names one at a time.\nI'll track the total cost.\n\n*done* — See total | *clear* — Reset | *0* — Menu\n\n_Type first commodity:_", "pcm": "🛒 *BASKET BUILDER*\n────────────────\n\nType commodity name one by one.\nI go count the total.\n\n*done* — See total | *clear* — Reset | *0* — Menu\n\n_Type first commodity:_"},
    "basket_added":   {"en": "✅ *{name}* added\n₦{price:,.0f} per {unit}\n\nBasket: *{count} item(s)* | Running total: *₦{total:,.0f}*\n\nType next commodity, *done* to finish, or *clear* to reset.", "pcm": "✅ *{name}* don enter\n₦{price:,.0f} per {unit}\n\nBasket: *{count} item(s)* | Total so far: *₦{total:,.0f}*\n\nType next commodity, *done* to finish, or *clear* to reset."},
    "basket_not_found":{"en": "⚠️ *{q}* not found. Try a different name or type *done* to finish.", "pcm": "⚠️ No find *{q}*. Try another name or type *done* to finish."},
    "basket_summary":  {"en": "🛒 *BASKET SUMMARY*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💰 *{count} items | Total: ₦{total:,.0f}*\n\n_Prices are national averages_\n\n*basket* — Add more | *menu* — Menu", "pcm": "🛒 *BASKET SUMMARY*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{lines}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💰 *{count} items | Total: ₦{total:,.0f}*\n\n_Na national average price_\n\n*basket* — Add more | *menu* — Menu"},
    "basket_empty":    {"en": "🛒 Your basket is empty. Type a commodity name to start.", "pcm": "🛒 Your basket empty. Type commodity name to start."},
    "basket_cleared":  {"en": "✅ Basket cleared. Type a commodity name to start fresh.", "pcm": "✅ Basket don clear. Type commodity name to start fresh."},
    "basket_added_persisted": {"en": "✅ *{item_name}* added to your basket\nQuantity: *{quantity}* | ₦{price} per {unit}\n\nType next commodity, *done* to see basket, or *clear* to reset.", "pcm": "✅ *{item_name}* don enter your basket\nQuantity: *{quantity}* | ₦{price} per {unit}\n\nType next commodity, *done* to see basket, or *clear* to reset."},
    "basket_status":   {"en": "🛒 Basket has *{count} item(s)* | Total: *₦{total:,.0f}*\n\nType next commodity, *done* to finish, or *clear* to reset.", "pcm": "🛒 Basket get *{count} item(s)* | Total: *₦{total:,.0f}*\n\nType next commodity, *done* to finish, or *clear* to reset."},
    "basket_narrow":   {"en": "🔍 Found *{n}* items matching \"{q}\". Please type a more specific name (e.g. add a type or unit) to pick one.", "pcm": "🔍 I see *{n}* items wey match \"{q}\". Abeg type the name more specific (add the type or unit) make I fit pick one."},
    "basket_picklist": {"en": "🔍 Found *{count}* matches for \"{q}\".\n\n{lines}\n\n_Reply with a number (1–{shown}) to add it{more}._", "pcm": "🔍 I see *{count}* item wey match \"{q}\".\n\n{lines}\n\n_Reply with number (1–{shown}) to add am{more}._"},
    "basket_pick_range": {"en": "⚠️ Reply with a number between *1* and *{n}*, or type a commodity name to search again.", "pcm": "⚠️ Reply with number between *1* and *{n}*, or type commodity name to search again."},
    "basket_more_hint": {"en": ", or type more letters to narrow", "pcm": ", or type more letters to narrow"},
    "invite_code":      {"en": "🎁 *YOUR REFERRAL CODE*\n────────────────\n\nHi {name}! Your code is:\n\n*{code}*\n\nShare this message with a friend:\n_\"Join NaijaMarket Intel — track food prices across 282 Nigerian markets. Use my code *{code}* when you register. WhatsApp: wa.me/2349131095009\"_\n\n*menu* — Menu", "pcm": "🎁 *YOUR REFERRAL CODE*\n────────────────\n\n{name}! Your code na:\n\n*{code}*\n\nSend this message to your friend:\n_\"Join NaijaMarket Intel — check food prices for 282 markets for Nigeria. Use my code *{code}* when you register. WhatsApp: wa.me/2349131095009\"_\n\n*menu* — Menu"},
    "invite_ref_prompt":  {"en": "🎁 *Got a referral code?*\n\nType it now to activate, or type *skip* to continue.", "pcm": "🎁 *You get referral code?*\n\nType am now, or type *skip* to continue."},
    "invite_ref_ok":      {"en": "✅ Referral code accepted! Your friend will be notified.\n\n_Setting up your account..._", "pcm": "✅ Referral code don work! We go tell your friend.\n\n_We dey set up your account..._"},
    "invite_ref_invalid": {"en": "⚠️ Code not found. Type a valid code or *skip* to continue.", "pcm": "⚠️ Code no correct. Type correct code or *skip* to continue."},
    "history_list":  {"en": "🕐 *YOUR RECENT SEARCHES*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{body}\n\n━━━━━━━━━━━━━━━━━━━━━━\nType a number to search again\n*0* — Menu", "pcm": "🕐 *YOUR RECENT SEARCHES*\n━━━━━━━━━━━━━━━━━━━━━━\n\n{body}\n\n━━━━━━━━━━━━━━━━━━━━━━\nType number to search again\n*0* — Menu"},
    "history_empty": {"en": "🕐 No search history yet. Start by checking a price!\n\n*0* — Menu", "pcm": "🕐 You never search anything yet. Go check price first!\n\n*0* — Menu"},
    "error_generic":  {"en": "❌ Error. Type *menu* to go back.",              "pcm": "❌ Something happen. Type *menu* to go back."},
    "error_retry_search": {"en": "❌ Couldn't fetch that. Type a different commodity name:\n\n*0* — Menu", "pcm": "❌ E no work. Try another name:\n\n*0* — Menu"},
    "not_found":      {"en": "⚠️ No item found for '{q}'.\n\n*0* — Menu",      "pcm": "⚠️ No item found for '{q}'.\n\n*0* — Menu"},
    "back_menu":      {"en": "_Type *menu* to go back_",                       "pcm": "_Type *menu* to go back_"},

    # REGION
    "region_title":  {"en": "🗺️ *SELECT REGION*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Reply with a number_",
                      "pcm":"🗺️ *PICK REGION*\n────────────────\n\n{lines}\n\n*0* — Menu\n\n_Type the number_"},
    "state_title":   {"en": "📍 *{region}*\n────────────────\n\n{lines}\n\n*back* — Regions | *0* — Menu\n\n_Reply with a number_",
                      "pcm":"📍 *{region}*\n────────────────\n\n{lines}\n\n*back* — Region | *0* — Menu\n\n_Type the number_"},

    # UNIVERSAL INPUT PROMPT — appended to every numbered list
    "input_prompt": {
        "en":  "\n\n_Reply with a number or type a keyword_",
        "pcm": "\n\n_Type number or keyword_",
    },
    "input_prompt_number": {
        "en":  "\n\n_Reply with a number_",
        "pcm": "\n\n_Type the number_",
    },
}


def footer(lang: str, number_only: bool = True) -> str:
    """Returns the input prompt footer for numbered lists."""
    key = "input_prompt_number" if number_only else "input_prompt"
    return t(lang, key)


# ── NEW KEYS: G1-WA [1f]-[1o] ────────────────────────────────────────────────

S.update({

    # FRESHNESS [1l]
    "fresh_today": {
        "en":  "🕐 _Updated today_",
        "pcm": "🕐 _Updated today_",
    },
    "fresh_stale": {
        "en":  "⚠️ _Prices from {days_ago} — may not reflect today's market_",
        "pcm": "⚠️ _Prices from {days_ago} — e no be today price_",
    },
    "fresh_yesterday": {
        "en":  "⚠️ _Prices from yesterday — may not reflect current market_",
        "pcm": "⚠️ _Prices from yesterday — e no be today price_",
    },

    # WELCOME FLOW [1h]
    "welcome_greeting": {
        "en": (
            "🇳🇬 *Welcome to NaijaMarket Intel!*\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "Real-time food commodity prices from *282 markets* across Nigeria.\n\n"
            "Before we start — what language do you prefer?\n\n"
            "*1* 🇬🇧 English\n"
            "*2* 🇳🇬 Naija Pidgin\n\n"
            "_Reply with a number_"
        ),
        "pcm": (
            "🇳🇬 *Welcome to NaijaMarket Intel!*\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "We dey give you real market price from *282 market* for Nigeria.\n\n"
            "Before we start — which language you want?\n\n"
            "*1* 🇬🇧 English\n"
            "*2* 🇳🇬 Naija Pidgin\n\n"
            "_Type the number_"
        ),
    },
    "welcome_invalid": {
        "en":  "❌ Please reply *1* for English or *2* for Pidgin.",
        "pcm": "❌ Send *1* for English or *2* for Pidgin.",
    },

    # HELP [1i]
    "help_text": {
        "en": (
            "ℹ️ *NAIJAMARKET HELP*\n"
            "────────────────\n"
            "*What I can do:*\n"
            "💰 *prices* — Live prices from 282 markets\n"
            "🔄 *arbitrage* — Buy-low/sell-high opportunities\n"
            "🔔 *alerts* — Price alert notifications\n"
            "⚖️ *compare* — Compare prices across states\n"
            "📈 *trend* — Price history\n"
            "📊 *snapshot* — Full market snapshot\n"
            "📰 *brief* — Daily price brief\n\n"
            "*Navigation:*\n"
            "• *menu* or *0* — Main menu\n"
            "• *back* — Go back one step\n"
            "• *lang* — Switch language\n"
            "• *help* — This message\n"
            "• *report* — Report a wrong price\n\n"
            "📧 support@naijamarketintel.ng\n"
            "🌐 naijamarketintel.ng\n"
            "────────────────\n"
            "_Type *menu* to start_"
        ),
        "pcm": (
            "ℹ️ *NAIJAMARKET HELP*\n"
            "────────────────\n"
            "*Wetin I fit do:*\n"
            "💰 *prices* — Live price from 282 market\n"
            "🔄 *arbitrage* — Where to buy cheap and sell dear\n"
            "🔔 *alerts* — Alert you when price change\n"
            "⚖️ *compare* — Compare price for different state\n"
            "📈 *trend* — Price history\n"
            "📊 *snapshot* — Full market snap\n"
            "📰 *brief* — Today price news\n\n"
            "*How to move around:*\n"
            "• *menu* or *0* — Go back to menu\n"
            "• *back* — Go one step back\n"
            "• *lang* — Change language\n"
            "• *help* — This message\n"
            "• *report* — Report wrong price\n\n"
            "📧 support@naijamarketintel.ng\n"
            "🌐 naijamarketintel.ng\n"
            "────────────────\n"
            "_Type *menu* to start_"
        ),
    },

    # REPORT WRONG PRICE [1j]
    "report_start": {
        "en":  "🚩 *REPORT WRONG PRICE*\n────────────────\nHelp us keep data accurate!\n\nWhich commodity has the wrong price?\n\n_Type commodity name (e.g. Rice 50kg)_\n\n*0* — Cancel",
        "pcm": "🚩 *REPORT WRONG PRICE*\n────────────────\nHelp us keep data correct!\n\nWhich commodity get wrong price?\n\n_Type commodity name (e.g. Rice 50kg)_\n\n*0* — Cancel",
    },
    "report_market": {
        "en":  "📦 *{item}*\n\nWhich market? (e.g. Mile 12 Lagos, Onitsha)\n\n*0* — Cancel",
        "pcm": "📦 *{item}*\n\nWhich market? (e.g. Mile 12 Lagos, Onitsha)\n\n*0* — Cancel",
    },
    "report_price": {
        "en":  "📍 *{item}* at *{market}*\n\nWhat price did you see there? (₦)\n\n_Type the price in Naira_\n\n*0* — Cancel",
        "pcm": "📍 *{item}* for *{market}*\n\nWetin be the price wey you see? (₦)\n\n_Type the Naira price_\n\n*0* — Cancel",
    },
    "report_saved": {
        "en":  "✅ *Thank you!*\n\nYour report has been logged:\n📦 {item} @ {market}: ₦{price:,.0f}\n\nOur team will investigate and update.\n\n_Type *menu* to continue_",
        "pcm": "✅ *Thank you!*\n\nYour report don save:\n📦 {item} @ {market}: ₦{price:,.0f}\n\nOur team go check and update am.\n\n_Type *menu* to continue_",
    },
    "report_invalid_price": {
        "en":  "❌ Please enter a valid price in Naira (numbers only).\n\n*0* — Cancel",
        "pcm": "❌ Type the Naira price as number only.\n\n*0* — Cancel",
    },

    # SHARE CARD [1n]
    "share_card": {
        "en": (
            "📊 *NaijaMarket Intel*\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "{item} @ {market}\n"
            "₦{price:,.0f} per {unit}\n"
            "{arrow} {change:.1f}% ({trend})\n\n"
            "Week: ₦{wlo:,.0f} – ₦{whi:,.0f}\n"
            "📅 {date}\n"
            "🌐 naijamarketintel.ng\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "_Copy and share with your group_ 📤"
        ),
        "pcm": (
            "📊 *NaijaMarket Intel*\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "{item} @ {market}\n"
            "₦{price:,.0f} per {unit}\n"
            "{arrow} {change:.1f}% ({trend})\n\n"
            "Week: ₦{wlo:,.0f} – ₦{whi:,.0f}\n"
            "📅 {date}\n"
            "🌐 naijamarketintel.ng\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "_Copy share with your group_ 📤"
        ),
    },
    "share_none": {
        "en":  "ℹ️ No recent price to share. Check a price first then type *share*.\n\n_Type *prices* to start_",
        "pcm": "ℹ️ No price to share now. Check price first, then type *share*.\n\n_Type *prices* to start_",
    },

    # SEARCH [1k]
    "search_found": {
        "en":  "🔍 Found *{item}*. Starting price check...",
        "pcm": "🔍 Found *{item}*. Checking price...",
    },
    "search_not_found": {
        "en":  "🔍 No match for '*{q}*'.\n\nTry: *prices*, *alerts*, *compare*, or type *menu*.",
        "pcm": "🔍 No match for '*{q}*'.\n\nTry: *prices*, *alerts*, *compare*, or type *menu*.",
    },

    # RATE LIMIT [1o]
    "rate_limit": {
        "en":  "⏳ You're sending messages too fast. Please wait a minute before trying again.",
        "pcm": "⏳ You dey send message too fast. Wait small before you try again.",
    },

    # SESSION EXPIRY [1m]
    "session_expired": {
        "en":  "⏰ Your session timed out. No worries — let's start fresh.\n\n_Type *menu* to continue_",
        "pcm": "⏰ Your session don expire. No worry — make we start again.\n\n_Type *menu* to continue_",
    },
    "empty_data": {
        "en":  "📭 No data available right now. Please try again in a few minutes.\n\n_Type *menu* to go back_",
        "pcm": "📭 No data dey now. Try again in few minutes.\n\n_Type *menu* to go back_",
    },

    "welcome_ask_name": {
        "en":  "What is your name?\n\n_Type your full name_\n\n*0* - Cancel",
        "pcm": "Wetin be your name?\n\n_Type your full name_\n\n*0* - Cancel",
    },
    "welcome_name_invalid": {
        "en":  "Please enter a valid name (at least 2 characters).\n\n_Type your name_",
        "pcm": "Type your real name (at least 2 letters).\n\n_Type your name_",
    },
    "welcome_ask_age": {
        "en":  "*What is your age range?*\n\n*1* - Under 25\n*2* - 25-34\n*3* - 35-44\n*4* - 45-54\n*5* - 55 and above\n\n_Reply with a number_",
        "pcm": "*How old you be?*\n\n*1* - Under 25\n*2* - 25-34\n*3* - 35-44\n*4* - 45-54\n*5* - 55 and above\n\n_Type the number_",
    },
    "welcome_age_invalid": {
        "en":  "Please reply with a number from 1 to 5.\n\n_Reply with a number_",
        "pcm": "Send number from 1 to 5.\n\n_Type the number_",
    },
    "welcome_sample": {
        "en": (
            "\U0001f1f3\U0001f1ec *Welcome to NaijaMarket Intel!*\n"
            "_The Bloomberg of Nigerian Commodities_\n\n"
            "*SAMPLE PRICES - Lagos today:*\n"
            "------------------------\n"
            "{sample_lines}\n"
            "------------------------\n\n"
            "Get real-time prices from *282 markets* across Nigeria — completely free.\n\n"
            "Reply:\n"
            "*1* \u2014 Register (free, takes 30 seconds)\n"
            "*2* \u2014 Exit"
        ),
        "pcm": (
            "Welcome, *{first_name}*!\n\n"
            "*SAMPLE PRICE - Lagos today:*\n"
            "------------------------\n"
            "{sample_lines}\n"
            "------------------------\n\n"
            "See wetin you fit do:\n"
            "*prices* - Check any commodity\n"
            "*alerts* - Alert you when price move\n"
            "*arbitrage* - Find where to buy cheap and sell dear\n"
            "*trend* - See price history\n\n"
            "Type *menu* to see everything.\n\n"
            "\u2139\ufe0f Na *sample price* be dis. Type *register* to see real live price (e dey free).\n\n"
            "_Type any keyword or type *menu*_"
        ),
    },
    "welcome_complete": {
        "en": (
            "\U0001f389 *Welcome to NaijaMarket Intel, {full_name}!*\n\n"
            "\u2705 You now have *3 free searches per week* as a FREE user.\n\n"
            "Type *1* or *menu* to go to the main menu."
        ),
        "pcm": (
            "\U0001f389 *Welcome to NaijaMarket Intel, {first_name}!*\n\n"
            "\u2705 You don get *3 free price check per week*\n\n"
            "*1* \U0001f4b0 Prices - Check any price\n"
            "*2* \U0001f514 Alerts - Alert you when price move\n"
            "*3* \U0001f504 Arbitrage - Find where to buy cheap\n\n"
            "Type *menu* to see everything."
        ),
    },

})

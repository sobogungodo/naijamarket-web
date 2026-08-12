// Creates the pending Meta WhatsApp UTILITY message templates in Business Manager
// via the Graph API, so the only remaining step is Meta's async approval review.
//
// Run:   node scripts/create-wa-templates.mjs            (submits templates)
//        node scripts/create-wa-templates.mjs --dry-run  (prints payloads only)
//
// Env:
//   META_ACCESS_TOKEN  — same token the app sends with (System User token)
//   META_WABA_ID       — WhatsApp Business Account ID (NOT the phone number id)
//   META_GRAPH_VERSION — optional, defaults to v22.0 (matches src/lib/whatsapp.ts)
//
// Notes:
//   • Templates already-existing in the account are reported and skipped (not an error).
//   • Approval is Meta's own async review — this only submits them for review.
//   • Bodies mirror docs/meta-whatsapp-templates-todo.md and the wrappers in
//     src/lib/whatsapp.ts. Keep the three in sync.

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v22.0";
const TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.META_WABA_ID;
const DRY_RUN = process.argv.includes("--dry-run");

// Each template: name (must match the wrapper's template string), body with {{n}}
// placeholders, and one example row of sample values for Meta's reviewer.
const TEMPLATES = [
  {
    name: "add_on_activated",
    body:
      "✅ Add-On Activated!\n\n" +
      "{{1}} is now active.\n" +
      "Payment: {{2}}\n\n" +
      "Type *mystatus* to see details.",
    example: ["Morning Brief", "₦2,000"],
  },
  {
    name: "morning_brief_activated",
    body:
      "✅ Morning Brief Activated!\n\n" +
      "You'll receive daily market prices at 5:30 AM.\n" +
      "Payment: {{1}}\n" +
      "Valid until: {{2}}\n\n" +
      "🌅 See you tomorrow morning!",
    example: ["₦2,000", "20 Aug 2026"],
  },
  {
    name: "payment_failed",
    body:
      "❌ Payment Failed\n\n" +
      "We couldn't process your payment of {{1}}.\n\n" +
      "📋 Reason: {{2}}\n\n" +
      "Type *upgrade* to retry.",
    example: ["₦5,000", "Card declined"],
  },
  {
    // Fresh UTILITY name — replaces the old MARKETING-category `renewal_failed`.
    name: "subscription_renewal_failed",
    body:
      "⚠️ Subscription Renewal Failed\n\n" +
      "We couldn't renew your subscription.\n\n" +
      "You have {{1}} days before downgrade to FREE.\n\n" +
      "Type *upgrade* to renew now.",
    example: ["3"],
  },
  {
    name: "refund_processed",
    body:
      "💰 Refund Processed\n\n" +
      "Your refund of {{1}} has been processed.\n" +
      "Please allow 3–5 business days to see it in your account.",
    example: ["₦5,000"],
  },
  {
    name: "subscription_expired_grace",
    body:
      "🔶 Subscription Expired\n\n" +
      "Your {{1}} plan has expired.\n\n" +
      "You still have access until {{2}} (grace period).\n" +
      "After that, your account will be downgraded to FREE.\n\n" +
      "Type *upgrade* to renew and keep your access.",
    example: ["Gold", "23 Aug 2026"],
  },
  {
    name: "subscription_downgraded",
    body:
      "🔴 Subscription Downgraded\n\n" +
      "Your {{1}} plan has been downgraded to FREE due to non-renewal.\n\n" +
      "FREE tier includes:\n" +
      "• 3 price queries per week\n" +
      "• Yesterday's prices only\n\n" +
      "Type *upgrade* anytime to reactivate your plan.",
    example: ["Gold"],
  },
];

function payloadFor(t) {
  return {
    name: t.name,
    language: "en",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: t.body,
        ...(t.example.length ? { example: { body_text: [t.example] } } : {}),
      },
    ],
  };
}

async function main() {
  if (DRY_RUN) {
    for (const t of TEMPLATES) {
      console.log(`\n=== ${t.name} ===`);
      console.log(JSON.stringify(payloadFor(t), null, 2));
    }
    console.log(`\n[dry-run] ${TEMPLATES.length} template(s) — nothing sent.`);
    return;
  }

  if (!TOKEN || !WABA_ID) {
    console.error("Missing env: META_ACCESS_TOKEN and META_WABA_ID are required.");
    console.error("Tip: run with --dry-run to preview the payloads without credentials.");
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates`;
  let created = 0;
  let existed = 0;
  const failures = [];

  for (const t of TEMPLATES) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadFor(t)),
      });
      const data = await res.json();

      if (res.ok) {
        created++;
        console.log(`✅ created: ${t.name} (id=${data.id ?? "?"}, status=${data.status ?? "PENDING"})`);
      } else {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        if (/already exists/i.test(msg)) {
          existed++;
          console.log(`↷ exists:  ${t.name} (skipped)`);
        } else {
          failures.push({ name: t.name, msg });
          console.error(`❌ failed:  ${t.name} — ${msg}`);
        }
      }
    } catch (err) {
      failures.push({ name: t.name, msg: err?.message || String(err) });
      console.error(`❌ error:   ${t.name} — ${err?.message || err}`);
    }
  }

  console.log(`\nDone. created=${created} existed=${existed} failed=${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(1);
});

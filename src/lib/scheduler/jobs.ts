/**
 * Scheduler seam — canonical registry of scheduled jobs.
 * Single source of truth: vercel.json (Vercel Cron), and later AWS EventBridge /
 * Supabase pg_cron, are DERIVED from this list. Schedules are UTC 5-field cron.
 */
export interface ScheduledJob {
  name: string;
  path: string;
  schedule: string; // 5-field UNIX cron, UTC
  description: string;
  onVercel: boolean; // currently declared in vercel.json
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  { name: "alerts-process",      path: "/api/alerts/process",            schedule: "*/15 * * * *", onVercel: true,  description: "Check price alerts; push + email" },
  { name: "subscriptions-expiry",path: "/api/subscriptions/check-expiry",schedule: "0 6 * * *",    onVercel: true,  description: "Grace/downgrade expiring subs; WhatsApp reminders" },
  { name: "morning-brief",       path: "/api/morning-brief/send",        schedule: "30 4 * * *",   onVercel: true,  description: "WhatsApp morning price briefs" },
  { name: "social-daily",        path: "/api/social/post",               schedule: "0 6 * * *",    onVercel: true,  description: "Daily top-movers card to FB/IG/X" },
  { name: "social-weekly",       path: "/api/social/post-weekly",        schedule: "0 6 * * 1",    onVercel: true,  description: "Weekly bulk-staples card" },
  // Known CRON_SECRET-guarded routes not currently scheduled in vercel.json:
  { name: "push-send",           path: "/api/push/send",                 schedule: "",             onVercel: false, description: "Web-push dispatch (triggered externally today)" },
  { name: "fmcg-alerts",         path: "/api/fmcg-alerts/send",          schedule: "",             onVercel: false, description: "FMCG alerts dispatch" },
];

export const vercelJobs = (): ScheduledJob[] => SCHEDULED_JOBS.filter((j) => j.onVercel);

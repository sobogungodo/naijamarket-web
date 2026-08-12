/**
 * Scheduler seam — translate the canonical registry into AWS EventBridge
 * Scheduler expressions. This is the portability payoff: the same SCHEDULED_JOBS
 * that produce vercel.json also produce the AWS mirror's schedule set.
 */
import { vercelJobs } from "./jobs";

export function unixToEventBridgeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`expected 5-field cron, got: ${expr}`);
  let [min, hr, dom, mon, dow] = parts as [string, string, string, string, string];
  if (dow !== "*") {
    // map UNIX 0-6 (Sun=0) -> EventBridge 1-7 (Sun=1); leave step/list forms untouched if present
    if (/^\d+$/.test(dow)) dow = String(Number(dow) + 1);
    dom = "?"; // EventBridge requires exactly one of dom/dow to be ?
  } else {
    dow = "?";
  }
  return `cron(${min} ${hr} ${dom} ${mon} ${dow} *)`;
}

export function toEventBridgeSchedules(): { name: string; scheduleExpression: string; targetPath: string }[] {
  return vercelJobs().map((j) => ({
    name: j.name,
    scheduleExpression: unixToEventBridgeCron(j.schedule),
    targetPath: j.path,
  }));
}

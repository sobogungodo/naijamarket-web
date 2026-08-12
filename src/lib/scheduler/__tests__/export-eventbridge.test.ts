import { unixToEventBridgeCron, toEventBridgeSchedules } from "../export-eventbridge";

test("translates a daily 06:00 cron", () => {
  // UNIX "0 6 * * *" -> EventBridge cron(0 6 * * ? *)  (dom=* => dow=?)
  expect(unixToEventBridgeCron("0 6 * * *")).toBe("cron(0 6 * * ? *)");
});
test("translates a weekly Monday cron (dow set -> dom becomes ?)", () => {
  // UNIX "0 6 * * 1" -> EventBridge cron(0 6 ? * 2 *)  (UNIX Mon=1 -> EB Mon=2)
  expect(unixToEventBridgeCron("0 6 * * 1")).toBe("cron(0 6 ? * 2 *)");
});
test("translates every-15-min", () => {
  expect(unixToEventBridgeCron("*/15 * * * *")).toBe("cron(*/15 * * * ? *)");
});
test("exports one schedule per vercel job with the target path", () => {
  const out = toEventBridgeSchedules();
  expect(out.length).toBeGreaterThanOrEqual(5);
  expect(out.every((s) => s.scheduleExpression.startsWith("cron(") && s.targetPath.startsWith("/api/"))).toBe(true);
});

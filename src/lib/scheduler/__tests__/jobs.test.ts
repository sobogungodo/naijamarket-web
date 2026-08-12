import * as fs from "fs";
import * as path from "path";
import { SCHEDULED_JOBS, vercelJobs } from "../jobs";

const vercel = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
) as { crons: { path: string; schedule: string }[] };

test("every Vercel-scheduled job matches a vercel.json cron (path+schedule)", () => {
  for (const j of vercelJobs()) {
    const match = vercel.crons.find((c) => c.path === j.path && c.schedule === j.schedule);
    expect(match).toBeDefined();
  }
});
test("every vercel.json cron is represented in the registry", () => {
  for (const c of vercel.crons) {
    const match = SCHEDULED_JOBS.find((j) => j.path === c.path && j.schedule === c.schedule && j.onVercel);
    expect(match).toBeDefined();
  }
});
test("job names are unique", () => {
  const names = SCHEDULED_JOBS.map((j) => j.name);
  expect(new Set(names).size).toBe(names.length);
});

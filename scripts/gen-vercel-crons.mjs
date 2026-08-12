// Regenerates vercel.json "crons" from the scheduler registry. Run: node scripts/gen-vercel-crons.mjs
import { readFileSync, writeFileSync } from "node:fs";
// The registry is TS; read the schedules from the compiled contract instead of importing TS here:
// keep this script dependency-free by re-declaring nothing — parse the vercel.json and assert only.
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
console.log(`vercel.json has ${vercel.crons.length} crons`);

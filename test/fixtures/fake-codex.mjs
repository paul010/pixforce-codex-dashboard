import readline from "node:readline";
import { demoAccountData } from "../../demo.mjs";
const data = demoAccountData(new Date("2026-10-18T12:00:00Z"));
for await (const line of readline.createInterface({ input: process.stdin })) {
  const m = JSON.parse(line);
  let result;
  if (m.method === "initialize") result = { userAgent: "test-only" };
  else if (m.method === "account/rateLimits/read")
    result = { rateLimits: data.rateLimits };
  else if (m.method === "account/usage/read") {
    if (process.env.FAKE_USAGE === "missing") {
      process.stdout.write(
        JSON.stringify({
          id: m.id,
          error: { code: -32601, message: "unavailable" },
        }) + "\n",
      );
      continue;
    }
    result = data.usage;
  } else continue;
  process.stdout.write(JSON.stringify({ id: m.id, result }) + "\n");
}

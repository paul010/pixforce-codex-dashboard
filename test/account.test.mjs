import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAccountData } from "../account.mjs";
const fixture = fileURLToPath(
  new URL("./fixtures/fake-codex.mjs", import.meta.url),
);
const spawnFake = (missing) => (_command, _args, options) =>
  spawn(process.execPath, [fixture], {
    ...options,
    env: { ...process.env, FAKE_USAGE: missing ? "missing" : "" },
  });
test("independent account client reads quota and lifetime data", async () => {
  const j = await readAccountData({ spawnProcess: spawnFake(false) });
  assert.equal(j.usage.summary.lifetimeTokens, 1234567890);
  assert.equal(j.partial, false);
});
test("an unsupported usage method does not turn tokens into zero", async () => {
  const j = await readAccountData({ spawnProcess: spawnFake(true) });
  assert.equal(j.usage, null);
  assert.equal(j.partial, true);
  assert.equal(j.rateLimits.primary.usedPercent, 37);
});
test("a missing Codex executable fails with a bounded error", async () => {
  await assert.rejects(
    readAccountData({
      command: "pixforce-missing-executable-test",
      timeout: 1000,
    }),
    /无法启动/,
  );
});

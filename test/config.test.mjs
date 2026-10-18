import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config.mjs";

test("default account preview never activates hardware", () => {
  const c = loadConfig({}, [], {});
  assert.equal(c.hardware, false);
  assert.equal(c.device, null);
  assert.equal(loadConfig({}, ["--demo"], {}).demo, true);
  assert.throws(() => loadConfig({}, ["--activate"], {}), /PIXFORCE_IP/);
  assert.throws(() => loadConfig({}, ["--demo", "--activate"], {}), /演示/);
});
test("hardware config requires explicit addresses and valid ports", () => {
  const env = { PIXFORCE_IP: "192.0.2.2", PIXFORCE_HOST_IP: "192.0.2.1" };
  const c = loadConfig(env, ["--activate"], {});
  assert.equal(c.hostIP, "192.0.2.1");
  assert.throws(
    () => loadConfig({ ...env, PIXFORCE_HTTP_PORT: "NaN" }, ["--activate"], {}),
    /PIXFORCE_HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...env, PIXFORCE_FPS: "60" }, ["--activate"], {}),
    /PIXFORCE_FPS/,
  );
});

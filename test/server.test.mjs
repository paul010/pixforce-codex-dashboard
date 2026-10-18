import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";
import { once } from "node:events";
import { startDashboard } from "../server.mjs";

test("demo serves synthetic data, rejects cross-site writes, and switches scenes", async () => {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const app = await startDashboard(
    {
      demo: true,
      hardware: false,
      httpPort: port,
      fps: 8,
      device: null,
      hostIP: null,
    },
    {
      readAccount: () => {
        throw Error("Demo must not read an account");
      },
    },
  );
  const base = `http://127.0.0.1:${port}`;
  try {
    await app.refresh();
    const state = await (await fetch(base + "/api/state")).json();
    assert.equal(state.demo, true);
    assert.equal(state.tokensTotal, 1234567890);
    assert.equal(state.sentPackets, 0);
    assert.equal(state.scenes.length, 19);
    assert.equal(
      (await fetch(base + "/api/control", { method: "POST", body: "{}" }))
        .status,
      403,
    );
    const hostStatus = await new Promise((resolve, reject) =>
      http
        .get(base, { headers: { Host: "example.invalid" } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on("error", reject),
    );
    assert.equal(hostStatus, 403);
    const html = await (await fetch(base)).text();
    const token = html.match(/const token\s*=\s*['"]([a-f0-9]+)['"]/)[1];
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: base,
    };
    assert.equal(
      (
        await fetch(base + "/api/control", {
          method: "POST",
          headers: { ...headers, Origin: "https://example.invalid" },
          body: "{}",
        })
      ).status,
      403,
    );
    const changed = await (
      await fetch(base + "/api/control", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "scene", scene: "cats" }),
      })
    ).json();
    assert.equal(changed.state.scene, "cats");
    assert.equal(
      (
        await fetch(base + "/api/control", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "activate" }),
        })
      ).status,
      400,
    );
  } finally {
    await app.stop();
  }
});

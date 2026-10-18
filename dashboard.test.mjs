import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { once } from "node:events";
import { frame, decode, apps } from "./c1.mjs";
import { render, bitmap, SCENES } from "./render.mjs";
import { startBroker, mqttPacket, mqttString } from "./mqtt.mjs";
import { activityDays, accountMetrics, compactTokens } from "./metrics.mjs";
test("C1 已知查询帧与脱敏示例响应的 CRC", () => {
  assert.equal(frame(1).toString("hex"), "0003017e80");
  const r = decode(
    Buffer.from(
      fs
        .readFileSync(
          new URL("./test/fixtures/c1-info.hex", import.meta.url),
          "utf8",
        )
        .trim(),
      "hex",
    ),
  );
  assert.equal(r.op, 1);
  assert.equal(r.payload.subarray(-3).toString("utf8"), "\x02C1");
});
test("拒绝破损帧，避免错误协议进入控制路径", () => {
  const good = frame(24);
  const bad = Buffer.from(good);
  bad[3] ^= 1;
  assert.throws(() => decode(bad), /CRC/);
  assert.throws(() => decode(good.subarray(1)), /length/);
});
test("C1 应用列表格式兼容读取", () => {
  const r = apps(
    Buffer.from(
      fs
        .readFileSync(
          new URL("./test/fixtures/apps.hex", import.meta.url),
          "utf8",
        )
        .trim(),
      "hex",
    ),
  );
  assert.deepEqual(
    r.map((a) => [a.id, a.type]),
    [
      [1, 1],
      [4, 5],
      [5, 8],
      [6, 21],
    ],
  );
  assert.equal(r[0].name, "时钟");
});
test("19 种画面在缺失数据、额度用尽和长时间运行时都保持合法像素", () => {
  assert.equal(SCENES.length, 19);
  for (const s of SCENES)
    for (const t of [0, 0.125, 3.5, 123456.7])
      for (const q of [
        null,
        { name: "7d", pct: 100, resets_at: "2027-01-01T00:00:00Z" },
      ]) {
        const p = render(s.id, t, {
          quota: q,
          stale: q === null,
          now: new Date("2026-10-18T12:00:00Z"),
        });
        assert.equal(p.length, 256);
        assert.ok(
          p.every(
            (rgb) =>
              rgb.length === 3 &&
              rgb.every((x) => Number.isInteger(x) && x >= 0 && x <= 255),
          ),
        );
        assert.ok(p.some((rgb) => rgb.some((x) => x > 0)));
      }
});
test("近 14 天按上海日期排列，缺失与确认零用量保持区别", () => {
  const a = activityDays(
    [
      { startDate: "2026-10-18", tokens: 0 },
      { startDate: "2026-10-17", tokens: 100 },
      { startDate: "2026-10-05", tokens: 50 },
      { startDate: "2026-10-04", tokens: 900 },
      { startDate: "2026-10-19", tokens: 1000 },
      { startDate: "2026-10-16", tokens: null },
    ],
    new Date("2026-10-17T16:30:00Z"),
  );
  assert.equal(a.days.length, 14);
  assert.equal(a.start, "2026-10-05");
  assert.equal(a.end, "2026-10-18");
  assert.equal(a.days[13].tokens, 0);
  assert.equal(a.days[11].tokens, null);
  assert.equal(a.knownDays, 3);
  assert.equal(a.activeDays, 2);
  assert.equal(a.total, 150);
  assert.equal(a.peak, 100);
});
test("账户累计值不使用会话统计替代，主额度独立于 Spark", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const m = accountMetrics(
    {
      rateLimitsByLimitId: {
        codex: {
          primary: {
            usedPercent: 8,
            windowDurationMins: 10080,
            resetsAt: 2000000000,
          },
        },
        codex_bengalfox: {
          primary: {
            usedPercent: 90,
            windowDurationMins: 300,
            resetsAt: 2000000000,
          },
        },
      },
      usage: { summary: { lifetimeTokens: 1234567890 }, dailyUsageBuckets: [] },
    },
    now,
  );
  assert.equal(m.quota.pct, 8);
  assert.equal(m.quota.name, "7d");
  assert.equal(m.tokensTotal, 1234567890);
  assert.equal(
    accountMetrics({ usage: { summary: { lifetimeTokens: null } } }, now)
      .tokensTotal,
    null,
  );
  assert.equal(
    accountMetrics({ usage: { summary: { lifetimeTokens: 0 } } }, now)
      .tokensTotal,
    0,
  );
  assert.equal(accountMetrics(null, now).activity.total, null);
});
test("三只猫具有不同花纹且会动，统计画面可呈现实际数据", () => {
  const cats = ["guoqing", "beiguo", "diandian"];
  const frames = cats.map((id) => render(id, 3.5));
  assert.notDeepEqual(frames[0], frames[1]);
  assert.notDeepEqual(frames[1], frames[2]);
  for (const id of [...cats, "cats"])
    assert.notDeepEqual(render(id, 3.5), render(id, 4.5));
  const a = activityDays(
    [
      { startDate: "2026-10-17", tokens: 100 },
      { startDate: "2026-10-18", tokens: 0 },
    ],
    new Date("2026-10-18T12:00:00Z"),
  );
  assert.notDeepEqual(
    render("activity", 3.5),
    render("activity", 3.5, { activity: a, activityStale: false }),
  );
  assert.notDeepEqual(
    render("tokens", 3.5),
    render("tokens", 3.5, { tokensTotal: 1234567890, tokensStale: false }),
  );
  assert.equal(compactTokens(null), "--");
  assert.equal(compactTokens(0), "0");
  assert.equal(compactTokens(1234567890), "1.23B");
  for (const n of [999, 1000, 999999, 1e9, 1e12])
    assert.ok(compactTokens(n).length <= 7);
});
test("RGB565 帧符合 Awtrix DrawBMP 线序", () => {
  const p = Array.from({ length: 256 }, () => [0, 0, 0]);
  p[0] = [255, 0, 0];
  p[1] = [0, 255, 0];
  p[32] = [0, 0, 255];
  const b = bitmap(p);
  assert.equal(b.length, 519);
  assert.deepEqual([...b.subarray(0, 7)], [1, 0, 0, 0, 0, 32, 8]);
  assert.equal(b.readUInt16BE(7), 0xf800);
  assert.equal(b.readUInt16BE(9), 0x07e0);
  assert.equal(b.readUInt16BE(71), 0x001f);
});
test(
  "局域网 MQTT 接收分段订阅并只向订阅设备发送画面",
  { timeout: 5000 },
  async (t) => {
    const broker = startBroker({ port: 0, device: "127.0.0.1" });
    let socket;
    t.after(() => {
      socket?.destroy();
      broker.close();
    });
    await once(broker.server, "listening");
    socket = net.createConnection(broker.server.address().port, "127.0.0.1");
    await once(socket, "connect");
    let data = Buffer.alloc(0);
    socket.on("data", (c) => (data = Buffer.concat([data, c])));
    async function waitFor(condition) {
      const deadline = Date.now() + 2000;
      while (!condition()) {
        if (Date.now() > deadline) throw Error("MQTT test response timeout");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const connect = mqttPacket(
      0x10,
      Buffer.concat([
        mqttString("MQTT"),
        Buffer.from([4, 2, 0, 15]),
        mqttString("test-c1"),
      ]),
    );
    socket.write(connect);
    await waitFor(() => data.length >= 4);
    assert.equal(data.subarray(0, 4).toString("hex"), "20020000");
    data = Buffer.alloc(0);
    const peer = [...broker.peers][0],
      before = peer.bytesRead;
    const sub = mqttPacket(
      0x82,
      Buffer.concat([
        Buffer.from([0, 1]),
        mqttString("awtrixmatrix/#"),
        Buffer.from([0]),
      ]),
    );
    socket.write(sub.subarray(0, 3));
    await waitFor(() => peer.bytesRead >= before + 3);
    assert.equal(peer.subscribed, false);
    socket.write(sub.subarray(3));
    await waitFor(() => data.length >= 5);
    assert.equal(peer.subscribed, true);
    assert.equal(data.toString("hex"), "9003000100");
    data = Buffer.alloc(0);
    assert.equal(broker.send(Buffer.from([8])), 1);
    await waitFor(() => data.length > 0);
    assert.ok(data.includes(Buffer.from("awtrixmatrix/codex")));
    assert.equal(data.at(-1), 8);
  },
);

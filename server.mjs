import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { C1, apps } from "./c1.mjs";
import { startBroker } from "./mqtt.mjs";
import { SCENES, render, bitmap } from "./render.mjs";
import { accountMetrics } from "./metrics.mjs";
import { readAccountData } from "./account.mjs";
import { loadConfig } from "./config.mjs";
import { demoAccountData } from "./demo.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SEQUENCE = [
  "quota",
  "cats",
  "tokens",
  "guoqing",
  "activity",
  "beiguo",
  "clock",
  "diandian",
  "quota",
  "robot",
  "rocket",
  "tokens",
  "pacman",
  "matrix",
  "reset",
  "cats",
  "comet",
  "activity",
  "fireworks",
  "wave",
  "heart",
  "stars",
  "rainbow",
];

export async function startDashboard(
  config,
  { readAccount = readAccountData } = {},
) {
  const token = crypto.randomBytes(24).toString("hex");
  const hosts = new Set([
    `127.0.0.1:${config.httpPort}`,
    `localhost:${config.httpPort}`,
  ]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  const metricTimes = { quota: 0, tokens: 0, activity: 0 };
  const state = {
    device: config.device,
    macIP: config.hostIP,
    demo: config.demo,
    hardware: config.hardware,
    mqtt: config.hardware ? "waiting" : "preview",
    topics: [],
    enabled: !config.hardware,
    scene: "auto",
    currentScene: "quota",
    fps: config.fps,
    frames: 0,
    quota: null,
    quotaStale: true,
    tokensTotal: null,
    tokensStale: true,
    activity: null,
    activityStale: true,
    dataSource: config.demo ? "synthetic-demo" : "waiting",
    lastDataAt: null,
    lastError: null,
    activation: null,
    startedAt: new Date().toISOString(),
  };
  let pixels = render("clock", 0),
    refreshing = false,
    stopping = false,
    wasActivated = false,
    clockId = null,
    frameNo = 0;
  let broker = null;
  if (config.hardware) {
    broker = startBroker({
      port: config.mqttPort,
      device: config.device,
      host: config.hostIP,
      onState: (status, topics) => {
        state.mqtt = status;
        if (topics) state.topics = topics;
      },
      onMessage: (topic) => {
        if (topic === "matrixClient")
          state.lastDeviceMessageAt = new Date().toISOString();
      },
    });
    await new Promise((resolve, reject) => {
      broker.server.once("listening", resolve);
      broker.server.once("error", reject);
    });
  }
  function publicState() {
    return {
      ...state,
      scenes: SCENES,
      pixels,
      sentPackets: broker?.sent || 0,
      deviceClients: broker?.peers.size || 0,
    };
  }
  function acceptMetric(name, value, available) {
    if (available) {
      state[name === "tokens" ? "tokensTotal" : name] = value;
      metricTimes[name] = Date.now();
    }
    state[`${name}Stale`] = !available;
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const data = config.demo ? demoAccountData() : await readAccount();
      const m = accountMetrics(data);
      acceptMetric("quota", m.quota, !!m.quota);
      acceptMetric("tokens", m.tokensTotal, m.tokensTotal !== null);
      acceptMetric("activity", m.activity, m.activity.knownDays > 0);
      state.lastDataAt = new Date().toISOString();
      state.dataSource = config.demo ? "synthetic-demo" : "Codex App Server";
      const missing = [
        state.quotaStale ? "额度" : null,
        state.tokensStale ? "累计 Token" : null,
        state.activityStale ? "活动" : null,
      ].filter(Boolean);
      state.dataError = missing.length
        ? `部分数据未返回：${missing.join("、")}`
        : null;
    } catch {
      for (const name of Object.keys(metricTimes)) state[`${name}Stale`] = true;
      state.dataError =
        "账户统计暂不可用，请检查 codex login status 与 App Server 支持情况";
    } finally {
      refreshing = false;
    }
  }
  async function activate() {
    if (!config.hardware)
      throw Error("当前为网页预览；连接实物请配置 .env 并运行 npm run clock");
    const c = await new C1(`ws://${config.device}/ws`).connect();
    try {
      let list = apps(await c.request(24));
      clockId = list.find((a) => a.type === 1)?.id ?? null;
      if (clockId === null) throw Error("未找到原时钟应用，停止修改");
      let app = list.find((a) => a.type === 7);
      if (!app) {
        await c.request(21, Buffer.from([0, 7]));
        list = apps(await c.request(24));
        app = list.find((a) => a.type === 7);
      }
      if (!app) throw Error("未能创建 Awtrix 接收应用");
      const cfg = await c.request(25, Buffer.from([app.id]));
      const nameLen = cfg[3],
        baseLen = 4 + nameLen + 5;
      if (cfg.length < baseLen + 3 || cfg.readUInt16BE(1) !== 7)
        throw Error("接收应用配置格式不兼容");
      const ip = Buffer.from(config.hostIP),
        port = Buffer.alloc(2);
      port.writeUInt16BE(config.mqttPort);
      const next = Buffer.concat([
        cfg.subarray(0, baseLen),
        Buffer.from([ip.length]),
        ip,
        port,
      ]);
      next.writeUInt16BE(0, 4 + nameLen); // Keep the receiver out of the original automatic playlist.
      next[4 + nameLen + 2] |= 0x20; // C1 configured flag; preserve all other flags.
      if (!cfg.equals(next)) await c.request(26, next);
      if (!(await c.request(25, Buffer.from([app.id]))).equals(next))
        throw Error("设备配置回读不一致");
      // Re-enter through the clock: replaying the active receiver alone can keep
      // its previous MQTT connection alive after changing the address or port.
      const clockReply = await c.request(16, Buffer.from([clockId]));
      if (clockReply.toString("hex") !== "00") throw Error("无法切回原时钟以重新连接");
      const reply = await c.request(16, Buffer.from([app.id]));
      if (reply.toString("hex") !== "00") throw Error("设备拒绝播放接收应用");
      state.activation = {
        appId: app.id,
        readback: true,
        at: new Date().toISOString(),
      };
      state.enabled = true;
      wasActivated = true;
      state.lastError = null;
    } finally {
      c.close();
    }
  }
  async function resumeClock() {
    state.enabled = false;
    if (!config.hardware || clockId === null) return;
    const c = await new C1(`ws://${config.device}/ws`).connect();
    try {
      await c.request(16, Buffer.from([clockId]));
    } finally {
      c.close();
    }
  }
  function json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  const server = http.createServer(async (req, res) => {
    if (!hosts.has(req.headers.host)) {
      res.writeHead(403);
      return res.end();
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
      });
      return res.end(
        fs
          .readFileSync(path.join(ROOT, "index.html"), "utf8")
          .replace("__TOKEN__", token),
      );
    }
    if (req.method === "GET" && url.pathname === "/api/state")
      return json(res, 200, publicState());
    if (req.method === "POST" && url.pathname === "/api/control") {
      if (
        req.headers.authorization !== `Bearer ${token}` ||
        (req.headers.origin && !origins.has(req.headers.origin))
      )
        return json(res, 403, { error: "无效的本地操作凭证" });
      let text = "",
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2048) return json(res, 413, { error: "请求过大" });
        text += chunk;
      }
      try {
        const b = JSON.parse(text);
        if (b.action === "scene") {
          if (!["auto", ...SCENES.map((s) => s.id)].includes(b.scene))
            throw Error("未知画面");
          if (!state.enabled) {
            if (config.hardware) await activate();
            else state.enabled = true;
          }
          state.scene = b.scene;
        } else if (b.action === "activate") await activate();
        else if (b.action === "clock") await resumeClock();
        else if (b.action === "refresh") await refresh();
        else if (b.action === "fps") {
          if (![4, 8].includes(b.fps)) throw Error("无效帧率");
          state.fps = b.fps;
        } else throw Error("未知操作");
        state.lastError = null;
        return json(res, 200, { ok: true, state: publicState() });
      } catch (e) {
        state.lastError = e.message;
        return json(res, 400, { error: e.message });
      }
    }
    res.writeHead(404);
    res.end();
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.httpPort, "127.0.0.1", resolve);
    });
  } catch (e) {
    broker?.close();
    throw e;
  }
  const tick = setInterval(() => {
    const t = (Date.now() - Date.parse(state.startedAt)) / 1000;
    state.currentScene =
      state.scene === "auto"
        ? SEQUENCE[Math.floor(t / 7) % SEQUENCE.length]
        : state.scene;
    for (const [name, at] of Object.entries(metricTimes)) {
      if (Date.now() - at > 180000) state[`${name}Stale`] = true;
      if (Date.now() - at > 300000)
        state[name === "tokens" ? "tokensTotal" : name] = null;
    }
    if (state.quota && Date.parse(state.quota.resets_at) <= Date.now()) {
      state.quota = null;
      state.quotaStale = true;
    }
    pixels = render(state.currentScene, t, {
      quota: state.quota,
      stale: state.quotaStale,
      tokensTotal: state.tokensTotal,
      tokensStale: state.tokensStale,
      activity: state.activity,
      activityStale: state.activityStale,
    });
    if (
      state.enabled &&
      broker?.peers.size &&
      frameNo++ % Math.max(1, Math.round(8 / state.fps)) === 0
    ) {
      const delivered = broker.send(bitmap(pixels));
      broker.send(Buffer.from([8]));
      if (delivered) state.frames++;
    }
  }, 125);
  const refreshTimer = setInterval(refresh, 60000);
  refresh();
  if (config.hardware)
    activate().catch((e) => {
      state.lastError = e.message;
    });
  async function stop() {
    if (stopping) return;
    stopping = true;
    clearInterval(tick);
    clearInterval(refreshTimer);
    if (wasActivated)
      try {
        await resumeClock();
      } catch {}
    broker?.close();
    await new Promise((resolve) => server.close(resolve));
  }
  return { server, state, refresh, stop };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const config = loadConfig();
    const app = await startDashboard(config);
    console.log(
      `PixForce Dashboard: http://127.0.0.1:${config.httpPort}/ (${config.demo ? "DEMO" : config.hardware ? "hardware" : "account preview"})`,
    );
    let exiting = false;
    const stop = async () => {
      if (exiting) return;
      exiting = true;
      const deadline = setTimeout(() => process.exit(0), 8000);
      deadline.unref();
      await app.stop();
      process.exit(0);
    };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

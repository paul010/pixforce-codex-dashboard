import { spawn } from "node:child_process";
import readline from "node:readline";

// Independent stdio client. It does not read auth files or conversation logs.
export function readAccountData({
  command = process.env.CODEX_BIN || "codex",
  timeout = 25000,
  spawnProcess = spawn,
} = {}) {
  return new Promise((resolve, reject) => {
    let child,
      lines,
      timer,
      settled = false,
      initialized = false;
    const replies = new Map();
    const cleanup = () => {
      clearTimeout(timer);
      lines?.close();
      child?.stdin.destroy();
      child?.kill();
    };
    const finish = (force = false) => {
      if (settled || (!force && (!replies.has(1) || !replies.has(2)))) return;
      settled = true;
      const limits = replies.get(1),
        usage = replies.get(2);
      cleanup();
      if (!limits && !usage)
        return reject(
          new Error(
            "Codex 账户接口未返回数据；请确认 codex 已登录且版本支持 App Server",
          ),
        );
      resolve({
        rateLimits: limits?.rateLimits || {},
        rateLimitsByLimitId: limits?.rateLimitsByLimitId || {},
        usage: usage || null,
        partial: !limits || !usage,
      });
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          "无法启动 Codex App Server；请检查 CODEX_BIN 和 codex login status",
        ),
      );
    };
    try {
      child = spawnProcess(command, ["app-server"], {
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      });
    } catch {
      return fail();
    }
    const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
    child.once("error", fail);
    child.stdin.on("error", () => {});
    child.once("exit", () => finish(true));
    lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      let m;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.id === 0 && !initialized) {
        if (m.error) return fail();
        initialized = true;
        send({ method: "initialized", params: {} });
        send({ id: 1, method: "account/rateLimits/read", params: null });
        send({ id: 2, method: "account/usage/read", params: null });
        return;
      }
      if (m.id !== 1 && m.id !== 2) return;
      replies.set(m.id, m.error ? null : m.result || null);
      finish();
    });
    timer = setTimeout(() => finish(true), timeout);
    send({
      id: 0,
      method: "initialize",
      params: {
        clientInfo: {
          name: "pixforce_dashboard",
          title: "PixForce Codex Dashboard",
          version: "0.1.0",
        },
        capabilities: { experimentalApi: true },
      },
    });
  });
}

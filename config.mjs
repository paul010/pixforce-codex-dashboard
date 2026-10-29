import os from "node:os";
import net from "node:net";

export function loadConfig(
  env = process.env,
  args = process.argv.slice(2),
  interfaces = os.networkInterfaces(),
) {
  const port = (key, defaultValue) => {
    const n = env[key] === undefined ? defaultValue : Number(env[key]);
    if (!Number.isInteger(n) || n < 1 || n > 65535)
      throw Error(`${key} 必须是 1–65535`);
    return n;
  };
  const demo = args.includes("--demo"),
    hardware = args.includes("--activate");
  if (demo && hardware) throw Error("演示模式不能连接设备");
  const device = env.PIXFORCE_IP || null;
  if (hardware && net.isIP(device || "") !== 4)
    throw Error("连接设备前请在 .env 设置 PIXFORCE_IP（时钟的 IPv4 地址）");
  const hostIP =
    env.PIXFORCE_HOST_IP ||
    Object.values(interfaces)
      .flat()
      .find(
        (a) =>
          a.family === "IPv4" &&
          !a.internal &&
          device &&
          a.address.startsWith(device.split(".").slice(0, 3).join(".") + "."),
      )?.address ||
    null;
  if (hardware && net.isIP(hostIP || "") !== 4)
    throw Error("请设置 PIXFORCE_HOST_IP 为时钟能访问的本机局域网 IPv4 地址");
  const fps = Number(env.PIXFORCE_FPS || 8);
  if (![4, 8].includes(fps)) throw Error("PIXFORCE_FPS 只能是 4 或 8");
  return {
    demo,
    hardware,
    device,
    hostIP,
    metricsFile: env.PIXFORCE_METRICS_FILE || null,
    httpPort: port("PIXFORCE_HTTP_PORT", 8788),
    mqttPort: port("PIXFORCE_MQTT_PORT", 18884),
    fps,
  };
}

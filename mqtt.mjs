import net from "node:net";
export function mqttPacket(type, body = Buffer.alloc(0)) {
  let n = body.length,
    a = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n) b |= 128;
    a.push(b);
  } while (n);
  return Buffer.concat([Buffer.from([type, ...a]), body]);
}
export function mqttString(s) {
  let b = Buffer.from(s),
    h = Buffer.alloc(2);
  h.writeUInt16BE(b.length);
  return Buffer.concat([h, b]);
}
export function publish(topic, payload) {
  return mqttPacket(0x30, Buffer.concat([mqttString(topic), payload]));
}
export function startBroker({
  port,
  device,
  host = "0.0.0.0",
  onState,
  onMessage,
}) {
  const peers = new Set();
  let sent = 0;
  const server = net.createServer((socket) => {
    const ip = socket.remoteAddress?.replace("::ffff:", "");
    if (ip !== device) {
      socket.destroy();
      return;
    }
    socket.setNoDelay(true);
    socket.setTimeout(45000, () => socket.destroy());
    let buffer = Buffer.alloc(0);
    socket.subscribed = false;
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 65536) {
        socket.destroy();
        return;
      }
      while (buffer.length >= 2) {
        let size = 0,
          mul = 1,
          pos = 1,
          complete = false;
        for (let i = 0; i < 4 && pos < buffer.length; i++) {
          const b = buffer[pos++];
          size += (b & 127) * mul;
          mul *= 128;
          if (!(b & 128)) {
            complete = true;
            break;
          }
        }
        if (!complete || buffer.length < pos + size) return;
        const header = buffer[0],
          type = header >> 4,
          b = buffer.subarray(pos, pos + size);
        buffer = buffer.subarray(pos + size);
        if (type === 1) {
          if (b.length < 10) {
            socket.destroy();
            return;
          }
          socket.write(Buffer.from([0x20, 2, 0, 0]));
          peers.add(socket);
          onState?.("connected");
        } else if (type === 8) {
          if (b.length < 5) {
            socket.destroy();
            return;
          }
          let p = 2,
            topics = [];
          while (p + 2 <= b.length) {
            let n = b.readUInt16BE(p);
            p += 2;
            if (p + n + 1 > b.length) {
              socket.destroy();
              return;
            }
            topics.push(b.subarray(p, p + n).toString());
            p += n + 1;
          }
          socket.write(
            mqttPacket(
              0x90,
              Buffer.concat([b.subarray(0, 2), Buffer.alloc(topics.length)]),
            ),
          );
          socket.subscribed = topics.some((t) => t.startsWith("awtrixmatrix/"));
          onState?.(
            socket.subscribed ? "subscribed" : "other-subscription",
            topics,
          );
        } else if (type === 3) {
          if (b.length < 2) continue;
          let n = b.readUInt16BE(),
            p = 2 + n;
          if (p > b.length) continue;
          const topic = b.subarray(2, p).toString(),
            qos = (header >> 1) & 3;
          if (qos) {
            if (p + 2 > b.length) continue;
            const id = b.subarray(p, p + 2);
            p += 2;
            socket.write(mqttPacket(0x40, id));
          }
          onMessage?.(topic, b.subarray(p));
        } else if (type === 12) socket.write(Buffer.from([0xd0, 0]));
        else if (type === 14) socket.end();
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      peers.delete(socket);
      const active = [...peers].filter((peer) => !peer.destroyed);
      onState?.(active.some((peer) => peer.subscribed)
        ? "subscribed"
        : active.length ? "connected" : "disconnected");
    });
  });
  server.listen(port, host);
  return {
    server,
    peers,
    get sent() {
      return sent;
    },
    send(payload) {
      let delivered = 0;
      for (const s of peers)
        if (s.subscribed && !s.destroyed && s.writableLength < 8192) {
          s.write(publish("awtrixmatrix/codex", payload));
          sent++;
          delivered++;
        }
      return delivered;
    },
    close() {
      for (const s of peers) s.destroy();
      server.close();
    },
  };
}

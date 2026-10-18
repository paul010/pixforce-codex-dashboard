export function crc16(data) {
  let crc = 0xffff;
  for (const b of data) {
    crc ^= b;
    for (let i = 0; i < 8; i++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}
export function frame(op, payload = Buffer.alloc(0)) {
  const d = Buffer.concat([Buffer.from([op]), payload]);
  const b = Buffer.alloc(d.length + 4);
  b.writeUInt16BE(d.length + 2);
  d.copy(b, 2);
  b.writeUInt16LE(crc16(d), b.length - 2);
  return b;
}
export function decode(b) {
  if (
    b.length < 5 ||
    b.readUInt16BE() + 2 !== b.length ||
    b.readUInt16LE(b.length - 2) !== crc16(b.subarray(2, -2))
  )
    throw Error("C1 invalid length or CRC");
  return { op: b[2], payload: b.subarray(3, -2) };
}
export class C1 {
  constructor(url) {
    if (!url) throw Error("C1 WebSocket URL is required");
    this.url = url;
    this.pending = null;
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((ok, no) => {
      const t = setTimeout(() => no(Error("C1 connect timeout")), 5000);
      this.ws.onopen = () => {
        clearTimeout(t);
        ok();
      };
      this.ws.onerror = () => {
        clearTimeout(t);
        no(Error("C1 WebSocket error"));
      };
    });
    this.ws.onmessage = async (e) => {
      try {
        const b = Buffer.from(await e.data.arrayBuffer());
        const m = decode(b);
        if (this.pending && m.op === this.pending.op) {
          clearTimeout(this.pending.timer);
          this.pending.ok(m.payload);
          this.pending = null;
        }
      } catch (err) {
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending.no(err);
          this.pending = null;
        }
      }
    };
    return this;
  }
  request(op, payload = Buffer.alloc(0)) {
    if (this.pending) throw Error("One request at a time");
    return new Promise((ok, no) => {
      this.pending = {
        op,
        ok,
        no,
        timer: setTimeout(() => {
          this.pending = null;
          no(Error(`C1 opcode ${op} timeout`));
        }, 6000),
      };
      this.ws.send(frame(op, payload));
    });
  }
  close() {
    this.ws?.close();
  }
}
export function apps(data) {
  const rows = [];
  let p = 1;
  for (let i = 0; i < data[0]; i++) {
    const id = data[p++],
      type = data.readUInt16BE(p);
    p += 2;
    const n = data[p++],
      name = data.subarray(p, p + n).toString("utf8");
    p += n;
    const seconds = data.readUInt16BE(p),
      flags = data[p + 2];
    p += 3;
    rows.push({ id, type, name, seconds, flags });
  }
  if (p !== data.length) throw Error("Unknown app list format");
  return rows;
}

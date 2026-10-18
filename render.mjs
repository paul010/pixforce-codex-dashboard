import { compactTokens } from "./metrics.mjs";
import { CATS, drawCat } from "./cats.mjs";
export const WIDTH = 32,
  HEIGHT = 8;
const FONT = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  K: ["101", "110", "100", "110", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "%": ["101", "001", "010", "100", "101"],
  ":": ["0", "1", "0", "1", "0"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["000", "000", "000", "000", "000"],
};
FONT["."] = ["0", "0", "0", "0", "1"];
FONT.Q = ["111", "101", "101", "111", "001"];
export const SCENES = [
  { id: "quota", name: "Codex 额度" },
  { id: "tokens", name: "累计 Token" },
  { id: "activity", name: "近 14 天活动" },
  { id: "cats", name: "三只猫一起玩" },
  ...CATS.map((c) => ({ id: c.id, name: `${c.name} · 猫咪动画` })),
  { id: "clock", name: "像素时钟" },
  { id: "reset", name: "额度重置倒计时" },
  { id: "robot", name: "像素机器人" },
  { id: "rocket", name: "火箭巡航" },
  { id: "pacman", name: "吃豆人" },
  { id: "matrix", name: "代码雨" },
  { id: "comet", name: "彩虹彗星" },
  { id: "fireworks", name: "像素烟花" },
  { id: "wave", name: "海浪" },
  { id: "heart", name: "心跳" },
  { id: "stars", name: "星际穿梭" },
  { id: "rainbow", name: "彩虹流动" },
];
const cyan = [40, 220, 180],
  white = [185, 225, 230];
export function hsv(h, s = 1, v = 1) {
  h = ((h % 1) + 1) % 1;
  let i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  return [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6].map((x) => Math.round(x * 220));
}
function make() {
  let pixels = Array.from({ length: 256 }, () => [0, 0, 0]);
  return {
    pixels,
    p(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && x < 32 && y >= 0 && y < 8)
        pixels[y * 32 + x] = c.map((v) =>
          Math.max(0, Math.min(255, Math.round(v))),
        );
    },
    text(text, x, y, c) {
      for (const ch of text) {
        const f = FONT[ch] || FONT[" "];
        for (let yy = 0; yy < 5; yy++)
          for (let xx = 0; xx < f[yy].length; xx++)
            if (f[yy][xx] === "1") this.p(x + xx, y + yy, c);
        x += f[0].length + 1;
      }
    },
    sprite(rows, x, y, c) {
      rows.forEach((r, yy) =>
        [...r].forEach((z, xx) => {
          if (z === "1") this.p(x + xx, y + yy, c);
        }),
      );
    },
  };
}
export function render(
  scene,
  t,
  {
    quota = null,
    stale = true,
    tokensTotal = null,
    tokensStale = true,
    activity = null,
    activityStale = true,
    now = new Date(),
  } = {},
) {
  const c = make(),
    { pixels } = c;
  const bot = [
    "0011100",
    "0111110",
    "1101011",
    "1111111",
    "0111110",
    "0100010",
    "1100011",
  ];
  if (scene === "quota") {
    const value = quota ? Math.max(0, 100 - quota.pct) : null;
    c.sprite(bot, 0, 0, stale ? [55, 70, 75] : cyan);
    const label = value === null ? "--%" : `${Math.round(value)}%`;
    c.text(quota?.name === "7d" ? "7D" : "5H", 9, 0, [75, 110, 130]);
    c.text(
      label,
      17,
      0,
      stale ? [90, 90, 90] : value < 15 ? [240, 70, 50] : white,
    );
    for (let x = 9; x < 32; x++) c.p(x, 7, [10, 28, 32]);
    if (value !== null)
      for (let x = 0; x < Math.round((23 * value) / 100); x++)
        c.p(
          9 + x,
          7,
          stale
            ? [55, 65, 70]
            : hsv(0.43 + 0.08 * Math.sin(t + x * 0.3), 1, 0.75),
        );
  } else if (scene === "cats") {
    CATS.forEach((cat, i) => drawCat(c, cat.id, 1 + i * 11, t + i * 1.7));
  } else if (CATS.some((cat) => cat.id === scene)) {
    const cat = CATS.find((cat) => cat.id === scene);
    drawCat(c, scene, 1 + Math.round((1 + Math.sin(t * 0.8)) * 6), t);
    c.text(cat.label, 24, 1, [105, 165, 155]);
  } else if (scene === "tokens") {
    const label = t % 7 < 1.25 ? "TOTAL" : compactTokens(tokensTotal),
      w =
        [...label].reduce((n, ch) => n + (FONT[ch]?.[0].length || 3) + 1, 0) -
        1;
    c.text(
      label,
      Math.floor((32 - w) / 2),
      1,
      tokensStale ? [80, 90, 95] : [245, 192, 90],
    );
    for (let x = 0; x < 32; x++)
      if ((x + Math.floor(t * 6)) % 8 === 0)
        c.p(x, 7, tokensStale ? [45, 50, 55] : [110, 115, 70]);
  } else if (scene === "activity") {
    if (t % 7 < 1.25) c.text("14D", 10, 1, [110, 170, 180]);
    else if (!activity?.knownDays) c.text("--", 12, 1, [85, 90, 95]);
    else
      activity.days.forEach((d, i) => {
        const x = 2 + i * 2,
          color = activityStale
            ? [65, 80, 85]
            : i === 13
              ? [235, 200, 100]
              : hsv(0.47 + i * 0.004, 0.8, 0.78);
        if (d.tokens === null) {
          c.p(x, 5, [45, 50, 60]);
          c.p(x, 7, [45, 50, 60]);
        } else if (d.tokens === 0) c.p(x, 7, color);
        else {
          const h = Math.max(1, Math.round((d.tokens / activity.peak) * 7));
          for (let y = 7; y >= 8 - h; y--) c.p(x, y, color);
        }
      });
  } else if (scene === "clock") {
    const h = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    c.text(h, 7, 1, white);
    for (let x = 0; x < 32; x++)
      if ((x + Math.floor(t * 5)) % 7 === 0) c.p(x, 7, cyan);
  } else if (scene === "reset") {
    const sec = quota
      ? Math.max(0, (Date.parse(quota.resets_at) - now.getTime()) / 1000)
      : null;
    const label =
      sec === null
        ? "--:--"
        : sec > 86400
          ? `${Math.floor(sec / 86400)}D${String(Math.floor(sec / 3600) % 24).padStart(2, "0")}`
          : `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor(sec / 60) % 60).padStart(2, "0")}`;
    c.text(label, 6, 1, stale ? [85, 85, 90] : [240, 180, 75]);
    c.p(2, 2, cyan);
    c.p(1, 3, cyan);
    c.p(2, 4, cyan);
    c.p(3, 3, cyan);
  } else if (scene === "robot") {
    const x = 2 + Math.round((Math.sin(t * 0.7) + 1) * 9),
      y = Math.round(Math.sin(t * 3) * 0.4);
    c.sprite(bot, x, y, hsv(t * 0.025 + 0.42));
    if (Math.floor(t * 2) % 9 === 0) {
      c.p(x + 2, y + 2, [0, 0, 0]);
      c.p(x + 4, y + 2, [0, 0, 0]);
    }
    c.text("AI", 25, 1, [80, 140, 170]);
  } else if (scene === "rocket") {
    for (let i = 0; i < 13; i++)
      c.p((i * 11 - t * (3 + (i % 3)) + 64) % 32, (i * 3) % 8, [
        30 + i * 4,
        45 + i * 4,
        70 + i * 5,
      ]);
    const x = 10 + Math.sin(t) * 4;
    c.sprite(
      ["00011000", "00111100", "11111111", "11111111", "00111100", "00011000"],
      x,
      1,
      [150, 210, 230],
    );
    for (let i = 0; i < 6; i++)
      c.p(
        x - i,
        3 + (i % 2),
        hsv(0.03 + 0.05 * Math.sin(t * 12 + i), 1, 1 - i * 0.12),
      );
  } else if (scene === "pacman") {
    const x = ((t * 6) % 42) - 7;
    for (let i = 0; i < 8; i++) c.p(i * 4, 4, [150, 95, 50]);
    c.sprite(
      Math.floor(t * 7) % 2
        ? [
            "0011100",
            "0111110",
            "1111000",
            "1110000",
            "1111000",
            "0111110",
            "0011100",
          ]
        : [
            "0011100",
            "0111110",
            "1111111",
            "1111111",
            "1111111",
            "0111110",
            "0011100",
          ],
      x,
      0,
      [230, 180, 25],
    );
  } else if (scene === "matrix") {
    for (let x = 0; x < 32; x++) {
      const y = ((t * (3 + (x % 4)) + x * 17) % 15) - 5;
      for (let n = 0; n < 6; n++)
        c.p(x, y - n, [
          n === 0 ? 130 : 0,
          Math.max(0, 210 - n * 35),
          n === 0 ? 160 : 22,
        ]);
    }
  } else if (scene === "comet") {
    for (let i = 0; i < 30; i++) {
      const x = ((t * 11 - i + 96) % 40) - 4;
      const y = 3.5 + Math.sin((x + t * 3) * 0.25) * 2.8;
      c.p(x, y, hsv(t * 0.09 - i * 0.014, 1, 1 - i / 34));
    }
  } else if (scene === "fireworks") {
    for (let k = 0; k < 3; k++) {
      const age = (t + k * 0.83) % 2.5,
        center = 5 + k * 11;
      for (let a = 0; a < 14; a++) {
        const angle = (a * Math.PI) / 7;
        c.p(
          center + Math.cos(angle) * age * 5,
          3 + Math.sin(angle) * age * 3,
          hsv(k * 0.31 + t * 0.02, 1, Math.max(0, 1 - age / 2.5)),
        );
      }
    }
  } else if (scene === "wave") {
    for (let x = 0; x < 32; x++) {
      const top = 3 + Math.sin(x * 0.3 - t * 2) * 1.8;
      for (let y = Math.round(top); y < 8; y++)
        c.p(
          x,
          y,
          hsv(
            0.52 + (y - top) * 0.015,
            0.85,
            Math.max(0.12, 0.8 - (y - top) * 0.15),
          ),
        );
    }
  } else if (scene === "heart") {
    const v = 0.4 + 0.6 * Math.pow(Math.max(0, Math.sin(t * 5)), 3),
      heart = [
        "0110110",
        "1111111",
        "1111111",
        "0111110",
        "0011100",
        "0001000",
      ];
    c.sprite(heart, 12, 1, [220 * v, 35 * v, 75 * v]);
    for (let x = 0; x < 32; x++)
      if (x < 8 || x > 23)
        c.p(x, 4 + Math.sin(x + t * 7) * (x % 4 === 0 ? 2 : 0), [55, 120, 110]);
  } else if (scene === "stars") {
    for (let i = 0; i < 24; i++) {
      const a = i * 2.399,
        r = (t * (2 + (i % 3)) + i * 1.7) % 18;
      c.p(
        16 + Math.cos(a) * r,
        3.5 + Math.sin(a) * r * 0.32,
        hsv(0.5 + i * 0.01, 0.25, 0.3 + r / 25),
      );
    }
  } else if (scene === "rainbow") {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 32; x++)
        c.p(
          x,
          y,
          hsv(x / 48 + y / 20 - t * 0.15, 0.85, 0.4 + 0.2 * Math.sin(t + y)),
        );
  }
  return pixels;
}
export function bitmap(pixels) {
  if (pixels.length !== 256) throw Error("Expected 32x8 pixels");
  const b = Buffer.alloc(519);
  b[0] = 1;
  b[5] = 32;
  b[6] = 8;
  pixels.forEach(([r, g, bl], i) =>
    b.writeUInt16BE(((r & 248) << 8) | ((g & 252) << 3) | (bl >> 3), 7 + i * 2),
  );
  return b;
}

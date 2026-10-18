// 32×8 专用程序像素造型。参考已有国庆、贝果、点点素材的花纹特征。
export const CATS = [
  { id: "guoqing", name: "国庆", label: "GQ" },
  { id: "beiguo", name: "贝果", label: "BG" },
  { id: "diandian", name: "点点", label: "DD" },
];
export function drawCat(c, id, x, t) {
  const tabby = id === "guoqing",
    tuxedo = id === "beiguo";
  const fur = tabby ? [170, 165, 145] : tuxedo ? [65, 79, 94] : [205, 218, 215];
  const dark = tabby ? [55, 65, 62] : [50, 63, 78],
    light = [210, 224, 220],
    eye = tabby ? [150, 220, 90] : [100, 214, 200];
  const phase = Math.floor(t * 4),
    blink = Math.floor(t * 2) % 13 === 0,
    sleep = t % 12 > 9;
  const p = (xx, yy, color) => c.p(x + xx, yy, color);
  for (const [y, row] of [
    "0100010",
    "0111110",
    "1111111",
    "1111111",
    "0111110",
    "0111110",
    "0111110",
  ].entries())
    for (let xx = 0; xx < row.length; xx++) if (row[xx] === "1") p(xx, y, fur);
  if (tabby) {
    for (const [xx, y] of [
      [2, 1],
      [4, 1],
      [3, 2],
      [0, 3],
      [6, 3],
      [1, 5],
      [5, 5],
    ])
      p(xx, y, dark);
  } else if (tuxedo) {
    p(3, 1, light);
    p(3, 2, light);
    for (let xx = 2; xx <= 4; xx++) p(xx, 3, light);
    for (let xx = 1; xx <= 5; xx++) p(xx, 4, light);
    for (let y = 5; y <= 6; y++)
      for (let xx = 2; xx <= 4; xx++) p(xx, y, light);
    p(4, 4, dark);
  } else {
    p(2, 1, dark);
    p(4, 1, dark);
    p(1, 4, dark);
    p(5, 5, dark);
  }
  p(1, 2, blink || sleep ? dark : eye);
  p(5, 2, blink || sleep ? dark : eye);
  p(3, 4, tabby ? [210, 125, 120] : dark);
  const paw = phase % 2;
  p(1 + paw, 7, fur);
  p(4 + paw, 7, fur);
  p(7, 6, tabby ? fur : dark);
  p(8, 5, tabby ? dark : dark);
  p(8, phase % 3 === 0 ? 3 : 4, tabby ? fur : dark);
  if (Math.floor(t) % 8 === 5) {
    p(0, 5, fur);
    p(0, 4, fur);
  }
}

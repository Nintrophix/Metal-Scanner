// Rasterises the Irontronics mark (same geometry as public/favicon.svg) to PNG icons.
// Zero dependencies: analytic coverage with 4×4 supersampling, PNG via zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const ACCENT = [0x5a, 0x5f, 0xe6];
const plate = [[5, 5.5], [19, 5.5], [19, 11.5], [12.5, 11.5], [12.5, 18.5], [7.3, 18.5], [5, 16.2]];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inRoundRect(x, y, s, r) {
  const cx = Math.min(Math.max(x, r), s - r), cy = Math.min(Math.max(y, r), s - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, { inset = 0, square = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let bg = 0, white = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      // Map to the 24-unit design grid, with optional safe-area inset (maskable / touch icons).
      const u = ((x + (sx + 0.5) / S) / size) * 24;
      const v = ((y + (sy + 0.5) / S) / size) * 24;
      const gu = (u - inset) * (24 / (24 - 2 * inset));
      const gv = (v - inset) * (24 / (24 - 2 * inset));
      const inBg = square ? true : inRoundRect(u, v, 24, 5.5);
      if (!inBg) continue;
      bg++;
      if (inPoly(gu, gv, plate) && (gu - 8.7) ** 2 + (gv - 9) ** 2 > 1.55 ** 2) white++;
    }
    const n = S * S, i = (y * size + x) * 4;
    const a = bg / n, w = bg ? white / bg : 0;
    px[i] = Math.round(ACCENT[0] * (1 - w) + 255 * w);
    px[i + 1] = Math.round(ACCENT[1] * (1 - w) + 255 * w);
    px[i + 2] = Math.round(ACCENT[2] * (1 - w) + 255 * w);
    px[i + 3] = Math.round(a * 255);
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = [
  ['public/favicon-32.png', 32, {}],
  ['public/icon-192.png', 192, {}],
  ['public/icon-512.png', 512, {}],
  ['public/apple-touch-icon.png', 180, { square: true, inset: 2 }],
];
for (const [file, size, opts] of out) {
  writeFileSync(file, png(size, render(size, opts)));
  console.log('wrote', file);
}

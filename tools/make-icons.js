/**
 * make-icons.js —— 用纯 Node 生成扩展图标（无第三方依赖）
 * 运行：node tools/make-icons.js
 * 产物：icons/16.png、icons/48.png、icons/128.png
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------------------- PNG 编码 ---------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------- 图形 ---------------------------- */

/** 圆角矩形的内部判定（归一化坐标 0..1） */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
}

function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** 白色下载箭头 + 底座 */
function inGlyph(x, y) {
  if (x >= 0.455 && x <= 0.545 && y >= 0.255 && y <= 0.555) return true; // 箭杆
  if (inTriangle(x, y, 0.325, 0.515, 0.675, 0.515, 0.5, 0.705)) return true; // 箭头
  if (inRoundRect(x, y, 0.295, 0.765, 0.705, 0.825, 0.03)) return true; // 底座
  return false;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3;
  const step = 1 / (size * samples);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bgCoverage = 0;
      let glyphCoverage = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px * samples + sx + 0.5) * step;
          const y = (py * samples + sy + 0.5) * step;
          if (inRoundRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.24)) {
            bgCoverage += 1;
            if (inGlyph(x, y)) glyphCoverage += 1;
          }
        }
      }

      const total = samples * samples;
      bgCoverage /= total;
      glyphCoverage /= total;

      // 对角线渐变：#ff7a18 -> #ff2d55
      const t = Math.min(Math.max((px / size + py / size) / 2, 0), 1);
      const r = 255;
      const g = Math.round(122 + (45 - 122) * t);
      const b = Math.round(24 + (85 - 24) * t);

      const mix = bgCoverage > 0 ? Math.min(glyphCoverage / bgCoverage, 1) : 0;
      const index = (py * size + px) * 4;
      rgba[index] = Math.round(r + (255 - r) * mix);
      rgba[index + 1] = Math.round(g + (255 - g) * mix);
      rgba[index + 2] = Math.round(b + (255 - b) * mix);
      rgba[index + 3] = Math.round(bgCoverage * 255);
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const buffer = render(size);
  fs.writeFileSync(path.join(outDir, `${size}.png`), buffer);
  console.log(`icons/${size}.png  ${buffer.length} bytes`);
}

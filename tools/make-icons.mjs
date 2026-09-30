// 仮アイコンの生成（開発用・Node）。icons/icon.svg と同じ図形を PNG に描く。
// 使い方: node tools/make-icons.mjs
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../icons');
const BG = [31, 111, 92];
const FG = [255, 255, 255];

// 100×100 の座標系で描く図形：開いたノートとチェックマーク
const SEGMENTS = [
  // ノートの外枠
  [[24, 30], [24, 72], 5],
  [[24, 72], [76, 72], 5],
  [[76, 72], [76, 30], 5],
  [[24, 30], [50, 36], 5],
  [[50, 36], [76, 30], 5],
  [[50, 36], [50, 72], 4],
  // チェックマーク
  [[56, 52], [62, 59], 5],
  [[62, 59], [71, 45], 5],
  // 罫線
  [[31, 47], [43, 49], 3],
  [[31, 57], [43, 59], 3],
];

const distToSegment = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// 0〜1 の被覆率（縁を1px幅でぼかす）
const coverage = (x, y, scale) => {
  let c = 0;
  for (const [a, b, w] of SEGMENTS) {
    const d = distToSegment(x, y, a, b) - w / 2;
    c = Math.max(c, Math.max(0, Math.min(1, 0.5 - d * scale)));
  }
  return c;
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const scale = size / 100;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const c = coverage((x + 0.5) / scale, (y + 0.5) / scale, scale);
      for (let k = 0; k < 3; k++) raw[row + 1 + x * 3 + k] = Math.round(BG[k] + (FG[k] - BG[k]) * c);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="rgb(${BG})"/>
  <g stroke="#fff" stroke-linecap="round" fill="none">
${SEGMENTS.map(([a, b, w]) => `    <line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${w}"/>`).join('\n')}
  </g>
</svg>
`;

await writeFile(path.join(OUT, 'icon.svg'), svg);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await writeFile(path.join(OUT, name), png(size));
  console.log(name, size);
}

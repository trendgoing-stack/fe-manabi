// 図データ（JSON）から SVG を生成する汎用レンダラー。
// 色はクラス経由で CSS 変数を使い、ライト／ダークに追従する。文字は textContent で入れる。
import { h } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';
const U = 60; // グリッド1単位の px
const FONT = 13;
const PAD = 16;
let seq = 0;

function s(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v != null) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

/** 文字列のおおよその表示幅（全角1em、半角0.6em） */
export function textWidth(str, size = FONT) {
  let w = 0;
  for (const ch of String(str)) w += /[ -~｡-ﾟ]/.test(ch) ? 0.6 : 1;
  return w * size;
}

/** 描画先。要素を溜めながら外接矩形を広げ、最後に viewBox を決める */
class Canvas {
  constructor() {
    this.layers = { back: [], mid: [], front: [] };
    this.box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    this.marker = `fig-arrow-${++seq}`;
  }
  extend(x0, y0, x1, y1) {
    const b = this.box;
    b.x0 = Math.min(b.x0, x0);
    b.y0 = Math.min(b.y0, y0);
    b.x1 = Math.max(b.x1, x1);
    b.y1 = Math.max(b.y1, y1);
  }
  add(el, layer = 'mid') {
    this.layers[layer].push(el);
    return el;
  }
  /** 文字（背景付きにすると線の上でも読める） */
  text(x, y, str, { anchor = 'middle', bg = false, cls = 'fig-text', size = FONT, layer = 'front' } = {}) {
    const w = textWidth(str, size);
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    if (bg) this.add(s('rect', { x: x0 - 3, y: y - size / 2 - 3, width: w + 6, height: size + 6, rx: 3, class: 'fig-label-bg' }), layer);
    this.add(s('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central', class: cls, 'font-size': size }, str), layer);
    this.extend(x0 - 4, y - size / 2 - 4, x0 + w + 4, y + size / 2 + 4);
  }
  line(x1, y1, x2, y2, { arrow = false, dashed = false, cls = 'fig-line', layer = 'back' } = {}) {
    this.add(s('line', { x1, y1, x2, y2, class: cls + (dashed ? ' fig-dashed' : ''), 'marker-end': arrow ? `url(#${this.marker})` : null }), layer);
    this.extend(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
  }
  path(d, bbox, { arrow = false, dashed = false, cls = 'fig-line', layer = 'back' } = {}) {
    this.add(s('path', { d, class: cls + (dashed ? ' fig-dashed' : ''), 'marker-end': arrow ? `url(#${this.marker})` : null }), layer);
    this.extend(...bbox);
  }
  toSvg(label) {
    const b = this.box;
    const x = b.x0 - PAD;
    const y = b.y0 - PAD;
    const w = Math.ceil(b.x1 - b.x0 + PAD * 2);
    const hgt = Math.ceil(b.y1 - b.y0 + PAD * 2);
    // 画面幅に収まらない図は82%まで縮め、それでも入らなければ横スクロールにする
    const svg = s('svg', {
      viewBox: `${x} ${y} ${w} ${hgt}`,
      class: 'figure-svg',
      role: 'img',
      'aria-label': label,
      style: `width:100%;max-width:${w}px;min-width:${Math.round(w * 0.82)}px`,
    });
    const defs = s('defs');
    const m = s('marker', { id: this.marker, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' });
    m.append(s('path', { d: 'M0,0 L10,5 L0,10 z', class: 'fig-arrowhead' }));
    defs.append(m);
    svg.append(defs, ...this.layers.back, ...this.layers.mid, ...this.layers.front);
    return svg;
  }
}

// ---- 幾何 ----

/** 中心 (cx,cy)、幅 w・高さ h の矩形の境界上で、(tx,ty) の方向にある点 */
function clipRect(cx, cy, w, hh, tx, ty) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? hh / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

function clipCircle(cx, cy, r, tx, ty) {
  const d = Math.hypot(tx - cx, ty - cy) || 1;
  return [cx + ((tx - cx) / d) * r, cy + ((ty - cy) / d) * r];
}

/** 線分 (x1,y1)-(x2,y2) が、中心 (cx,cy)・幅 w・高さ h の矩形と交わるか */
function segmentHitsRect(x1, y1, x2, y2, cx, cy, w, hh) {
  const [l, r, t, b] = [cx - w / 2, cx + w / 2, cy - hh / 2, cy + hh / 2];
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - l], [dx, r - x1], [-dy, y1 - t], [dy, b - y1]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const u = q / p;
      if (p < 0) t0 = Math.max(t0, u);
      else t1 = Math.min(t1, u);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/**
 * 2点間を結ぶ。a・b の形は {x, y, w, hh, clip(tx,ty)}。
 * 途中の要素（others）を横切る場合は、弧にして避ける。往復の矢印は少しずらす。
 */
function connect(c, a, b, { arrow = true, dashed = false, offset = 0, label = null, others = [] } = {}) {
  let [x1, y1] = a.clip(b.x, b.y);
  let [x2, y2] = b.clip(a.x, a.y);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  if (!offset && others.some((o) => o !== a && o !== b && segmentHitsRect(x1, y1, x2, y2, o.x, o.y, o.w + 8, o.hh + 8))) {
    offset = Math.max(40, len * 0.22);
    // 弧の側に寄せた端点で取り直す
    [x1, y1] = a.clip(a.x + (b.x - a.x) / 2 + nx * offset * 2, a.y + (b.y - a.y) / 2 + ny * offset * 2);
    [x2, y2] = b.clip(a.x + (b.x - a.x) / 2 + nx * offset * 2, a.y + (b.y - a.y) / 2 + ny * offset * 2);
  }
  let mx = (x1 + x2) / 2;
  let my = (y1 + y2) / 2;
  if (offset) {
    const cx = (a.x + b.x) / 2 + nx * offset * 2;
    const cy = (a.y + b.y) / 2 + ny * offset * 2;
    c.path(`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, [Math.min(x1, x2, cx), Math.min(y1, y2, cy), Math.max(x1, x2, cx), Math.max(y1, y2, cy)], { arrow, dashed });
    mx = (x1 + 2 * cx + x2) / 4;
    my = (y1 + 2 * cy + y2) / 4;
  } else {
    c.line(x1, y1, x2, y2, { arrow, dashed });
  }
  if (label) {
    // ラベルの箱が線に触れない距離だけ、線の法線方向に離す
    const side = offset >= 0 ? 1 : -1;
    const size = 12;
    const away = Math.abs(nx) * (textWidth(label, size) / 2 + 3) + Math.abs(ny) * (size / 2 + 3) + 3;
    c.text(mx + nx * away * side, my + ny * away * side, label, { bg: true, size });
  }
}

// ---- 図の種類ごと ----

function drawTree(c, fig) {
  const LEVEL = 1.25 * U;
  let slot = 0;
  // 葉（と null の空き位置）に左から順に x を割り当て、親は子の中央に置く
  const layout = (node, depth) => {
    if (node === null) return { x: slot++ * 0.9 * U, depth, empty: true };
    const kids = (node.children ?? []).map((ch) => layout(ch, depth + 1));
    const x = kids.length ? (kids[0].x + kids[kids.length - 1].x) / 2 : slot++ * 0.9 * U;
    return { x, depth, label: node.label, kids };
  };
  const root = layout(fig.root, 0);
  const draw = (n) => {
    const y = n.depth * LEVEL;
    const r = Math.max(17, textWidth(n.label) / 2 + 9);
    c.add(s('circle', { cx: n.x, cy: y, r, class: 'fig-node' }));
    c.text(n.x, y, n.label);
    c.extend(n.x - r, y - r, n.x + r, y + r);
    for (const k of n.kids) {
      if (k.empty) continue;
      const ky = k.depth * LEVEL;
      const kr = Math.max(17, textWidth(k.label) / 2 + 9);
      const [x1, y1] = clipCircle(n.x, y, r, k.x, ky);
      const [x2, y2] = clipCircle(k.x, ky, kr, n.x, y);
      c.line(x1, y1, x2, y2);
      draw(k);
    }
  };
  draw(root);
}

function drawState(c, fig) {
  const nodes = new Map();
  for (const st of fig.states) {
    const x = st.x * U;
    const y = st.y * U;
    const w = Math.max(56, textWidth(st.label) + 26);
    const hh = 38;
    nodes.set(st.id, { x, y, w, hh, clip: (tx, ty) => clipRect(x, y, w, hh, tx, ty) });
    c.add(s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: 19, class: 'fig-node' }));
    if (st.final) c.add(s('rect', { x: x - w / 2 + 4, y: y - hh / 2 + 4, width: w - 8, height: hh - 8, rx: 15, class: 'fig-node-inner' }));
    c.text(x, y, st.label);
    c.extend(x - w / 2, y - hh / 2, x + w / 2, y + hh / 2);
    if (st.initial) {
      // 開始の印（黒丸から矢印）
      const sx = x - w / 2 - 34;
      c.add(s('circle', { cx: sx, cy: y, r: 5, class: 'fig-dot' }));
      c.line(sx + 5, y, x - w / 2, y, { arrow: true });
      c.extend(sx - 6, y - 6, sx + 6, y + 6);
    }
  }
  const pairs = new Set(fig.transitions.map((t) => `${t.from}>${t.to}`));
  for (const t of fig.transitions) {
    const a = nodes.get(t.from);
    const b = nodes.get(t.to);
    if (!a || !b) continue;
    if (t.from === t.to) {
      // 自己遷移：上側にループ
      const x0 = a.x - 12;
      const x1 = a.x + 12;
      const y0 = a.y - a.hh / 2;
      c.path(`M${x0},${y0} C${x0 - 18},${y0 - 44} ${x1 + 18},${y0 - 44} ${x1},${y0}`, [x0 - 18, y0 - 44, x1 + 18, y0], { arrow: true });
      if (t.label) c.text(a.x, y0 - 40, t.label, { bg: true, size: 12 });
      continue;
    }
    const both = pairs.has(`${t.to}>${t.from}`);
    connect(c, a, b, { offset: both ? 9 : 0, label: t.label, others: [...nodes.values()] });
  }
}

function drawArrow(c, fig) {
  const R = 16;
  const nodes = new Map();
  for (const n of fig.nodes) {
    const x = n.x * U;
    const y = n.y * U;
    nodes.set(n.id, { x, y, w: R * 2, hh: R * 2, clip: (tx, ty) => clipCircle(x, y, R, tx, ty) });
    c.add(s('circle', { cx: x, cy: y, r: R, class: 'fig-node' }));
    c.text(x, y, n.label ?? n.id);
    c.extend(x - R, y - R, x + R, y + R);
  }
  for (const a of fig.activities) {
    const from = nodes.get(a.from);
    const to = nodes.get(a.to);
    if (from && to) connect(c, from, to, { dashed: !!a.dummy, label: a.label ?? null, others: [...nodes.values()] });
  }
}

function drawGantt(c, fig) {
  const ROW = 30;
  const COL = Math.max(22, Math.min(40, 480 / fig.span));
  const labelW = Math.max(...fig.tasks.map((t) => textWidth(t.label))) + 16;
  const top = 26;
  const height = fig.tasks.length * ROW;
  const step = fig.span > 24 ? 5 : fig.span > 12 ? 2 : 1;
  // 目盛りと縦線
  for (let i = 0; i <= fig.span; i++) {
    const x = labelW + i * COL;
    c.line(x, top, x, top + height, { cls: i % step ? 'fig-grid-minor' : 'fig-grid' });
    if (i % step === 0) c.text(x, top - 12, String(i), { size: 11, cls: 'fig-text-muted' });
  }
  c.text(labelW + fig.span * COL + 6, top - 12, fig.unit ?? '', { anchor: 'start', size: 11, cls: 'fig-text-muted' });
  fig.tasks.forEach((t, i) => {
    const y = top + i * ROW;
    c.text(labelW - 10, y + ROW / 2, t.label, { anchor: 'end' });
    c.add(s('rect', { x: labelW + t.start * COL, y: y + 7, width: t.length * COL, height: ROW - 14, rx: 3, class: t.kind === 'actual' ? 'fig-bar-actual' : 'fig-bar' }));
    c.line(labelW, y + ROW, labelW + fig.span * COL, y + ROW, { cls: 'fig-grid-minor' });
  });
  c.line(labelW, top, labelW + fig.span * COL, top, { cls: 'fig-grid' });
  if (fig.marker != null) {
    const x = labelW + fig.marker * COL;
    c.line(x, top - 4, x, top + height + 4, { cls: 'fig-marker', layer: 'front' });
  }
  c.extend(0, 0, labelW + fig.span * COL + 20, top + height + 4);
}

const NET_SIZE = {
  internet: [104, 46], cloud: [104, 46], router: [40, 40], switch: [70, 26], fw: [56, 36], server: [40, 50], pc: [46, 34], ap: [34, 34],
};

function drawNetwork(c, fig) {
  for (const z of fig.zones ?? []) {
    const x = z.x * U;
    const y = z.y * U;
    c.add(s('rect', { x, y, width: z.w * U, height: z.h * U, rx: 8, class: 'fig-zone' }), 'back');
    c.text(x + 8, y + 12, z.label, { anchor: 'start', size: 12, cls: 'fig-text-muted', layer: 'back' });
    c.extend(x, y, x + z.w * U, y + z.h * U);
  }
  const nodes = new Map();
  for (const n of fig.nodes) {
    const x = n.x * U;
    const y = n.y * U;
    let [w, hh] = NET_SIZE[n.kind] ?? [50, 36];
    if (n.kind === 'internet' || n.kind === 'cloud') w = Math.max(w, textWidth(n.label, 12) + 30);
    const round = n.kind === 'router' || n.kind === 'ap';
    nodes.set(n.id, { x, y, w, hh, clip: round ? (tx, ty) => clipCircle(x, y, w / 2, tx, ty) : (tx, ty) => clipRect(x, y, w, hh, tx, ty) });
    if (n.kind === 'internet' || n.kind === 'cloud') {
      c.add(s('ellipse', { cx: x, cy: y, rx: w / 2, ry: hh / 2, class: 'fig-node' }));
      c.text(x, y, n.label, { size: 12 });
    } else {
      if (round) c.add(s('circle', { cx: x, cy: y, r: w / 2, class: 'fig-node' }));
      else c.add(s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: n.kind === 'switch' ? 4 : 6, class: n.kind === 'fw' ? 'fig-node fig-fw' : 'fig-node' }));
      if (n.kind === 'router') c.text(x, y, '⇄', { size: 15 });
      if (n.kind === 'ap') c.text(x, y, '≋', { size: 15 });
      if (n.kind === 'fw') c.text(x, y, '▦', { size: 16, cls: 'fig-text-muted' });
      if (n.kind === 'server') c.add(s('line', { x1: x - 12, y1: y - 8, x2: x + 12, y2: y - 8, class: 'fig-line' }));
      c.text(x, y + hh / 2 + 12, n.label, { size: 12 });
    }
    c.extend(x - w / 2, y - hh / 2, x + w / 2, y + hh / 2);
  }
  for (const l of fig.links) {
    const a = nodes.get(l.from);
    const b = nodes.get(l.to);
    if (a && b) connect(c, a, b, { arrow: false, label: l.label ?? null, others: [...nodes.values()] });
  }
}

function drawEr(c, fig) {
  const LINE = 20;
  const nodes = new Map();
  for (const e of fig.entities) {
    const attrs = e.attrs ?? [];
    const plain = (a) => a.replace(/^_(.*)_$/, '$1').replace(/^\{(.*)\}$/, '$1');
    const w = Math.max(textWidth(e.name), ...attrs.map((a) => textWidth(plain(a)))) + 28;
    const hh = 30 + attrs.length * LINE + (attrs.length ? 8 : 0);
    const x = e.x * U;
    const y = e.y * U;
    nodes.set(e.id, { x, y, clip: (tx, ty) => clipRect(x, y, w, hh, tx, ty), w, hh });
    const left = x - w / 2;
    const top = y - hh / 2;
    c.add(s('rect', { x: left, y: top, width: w, height: hh, rx: 4, class: 'fig-node' }));
    c.text(x, top + 15, e.name, { cls: 'fig-text fig-bold' });
    if (attrs.length) c.add(s('line', { x1: left, y1: top + 30, x2: left + w, y2: top + 30, class: 'fig-line' }), 'front');
    attrs.forEach((a, i) => {
      const ty = top + 30 + 4 + LINE * i + LINE / 2;
      const label = plain(a);
      c.text(left + 12, ty, label, { anchor: 'start', size: 12 });
      const pk = /^_.*_$/.test(a);
      const fk = /^\{.*\}$/.test(a);
      if (pk || fk) {
        const uw = textWidth(label, 12);
        c.add(s('line', { x1: left + 12, y1: ty + 8, x2: left + 12 + uw, y2: ty + 8, class: fk ? 'fig-line fig-dotted' : 'fig-line' }), 'front');
      }
    });
    c.extend(left, top, left + w, top + hh);
  }
  for (const r of fig.relations) {
    const a = nodes.get(r.from);
    const b = nodes.get(r.to);
    if (!a || !b) continue;
    const [x1, y1] = a.clip(b.x, b.y);
    const [x2, y2] = b.clip(a.x, a.y);
    c.line(x1, y1, x2, y2);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    // 多重度は線の端の近く、線から少し離して書く
    const place = (px, py, dir, mul) => c.text(px + ux * 14 * dir - uy * 11, py + uy * 14 * dir + ux * 11, mul, { size: 13, cls: 'fig-text fig-bold', bg: true });
    if (r.fromMul) place(x1, y1, 1, r.fromMul);
    if (r.toMul) place(x2, y2, -1, r.toMul);
    if (r.label) c.text((x1 + x2) / 2 + uy * 12, (y1 + y2) / 2 - ux * 12, r.label, { size: 12, bg: true });
  }
}

// 論理回路：ゲートは中心 (x,y)、幅 GW・高さ GH の記号で描く
const GW = 54;
const GH = 40;

function gatePath(op, x, y) {
  const l = x - GW / 2;
  const t = y - GH / 2;
  const b = y + GH / 2;
  const body = { NOT: null };
  if (op === 'AND' || op === 'NAND') {
    body.d = `M${l},${t} H${x} A${GH / 2},${GH / 2} 0 0 1 ${x},${b} H${l} Z`;
    body.out = x + GH / 2;
  } else if (op === 'OR' || op === 'NOR' || op === 'XOR') {
    const r = l + GW - 6;
    body.d = `M${l},${t} Q${l + GW * 0.55},${t} ${r},${y} Q${l + GW * 0.55},${b} ${l},${b} Q${l + 12},${y} ${l},${t} Z`;
    body.out = r;
    if (op === 'XOR') body.extra = `M${l - 7},${t} Q${l + 5},${y} ${l - 7},${b}`;
  } else {
    body.d = `M${l},${t} L${l + GW - 14},${y} L${l},${b} Z`;
    body.out = l + GW - 14;
  }
  body.bubble = op === 'NAND' || op === 'NOR' || op === 'NOT';
  return body;
}

function drawLogic(c, fig) {
  const outPoint = new Map();
  for (const i of fig.inputs) {
    const x = i.x * U;
    const y = i.y * U;
    c.text(x - 6, y, i.label, { anchor: 'end', cls: 'fig-text fig-bold' });
    c.add(s('circle', { cx: x, cy: y, r: 3, class: 'fig-dot' }), 'front');
    outPoint.set(i.id, [x, y]);
    c.extend(x - 20, y - 8, x + 4, y + 8);
  }
  for (const g of fig.gates) {
    const x = g.x * U;
    const y = g.y * U;
    const p = gatePath(g.op, x, y);
    c.add(s('path', { d: p.d, class: 'fig-node' }));
    if (p.extra) c.add(s('path', { d: p.extra, class: 'fig-line' }));
    let out = p.out;
    if (p.bubble) {
      c.add(s('circle', { cx: out + 5, cy: y, r: 5, class: 'fig-node' }));
      out += 10;
    }
    outPoint.set(g.id, [out, y]);
    c.extend(x - GW / 2 - 8, y - GH / 2, out, y + GH / 2);
  }
  // 配線：出力点から水平に進み、入力ピンの手前で縦に曲がる
  // lane：縦に曲がる位置をピンごとにずらし、同じゲートへの配線どうしが重ならないようにする
  // 一つの出力が複数の入力に分岐する箇所には、接続を示す黒丸を打つ
  const fanout = new Map();
  for (const g of fig.gates) for (const src of g.in) fanout.set(src, (fanout.get(src) ?? 0) + 1);
  for (const o of fig.outputs) fanout.set(o.from, (fanout.get(o.from) ?? 0) + 1);
  const wire = (from, tx, ty, lane = 0, layer = 'back', branch = false) => {
    const [fx, fy] = from;
    const mx = Math.max(fx + 12, tx - 14 - lane * 9);
    if (branch && fy !== ty) c.add(s('circle', { cx: mx, cy: fy, r: 3, class: 'fig-dot' }), 'front');
    c.path(`M${fx},${fy} H${mx} V${ty} H${tx}`, [Math.min(fx, tx), Math.min(fy, ty), Math.max(fx, tx), Math.max(fy, ty)], { layer });
  };
  for (const g of fig.gates) {
    const x = g.x * U;
    const y = g.y * U;
    const n = g.in.length;
    g.in.forEach((src, k) => {
      const from = outPoint.get(src);
      if (!from) return;
      const py = n === 1 ? y : y - GH / 2 + (GH * (k + 1)) / (n + 1);
      const px = x - GW / 2 + (g.op === 'OR' || g.op === 'NOR' || g.op === 'XOR' ? 6 : 0);
      // 上から来る配線は上のピンほど内側、下から来る配線は下のピンほど内側で曲げる
      const lane = from[1] <= py ? k : n - 1 - k;
      wire(from, g.op === 'XOR' ? px - 7 : px, py, lane, 'back', fanout.get(src) > 1);
    });
  }
  for (const o of fig.outputs) {
    const from = outPoint.get(o.from);
    if (!from) continue;
    const x = o.x * U;
    const y = o.y * U;
    wire(from, x, y);
    c.add(s('circle', { cx: x, cy: y, r: 3, class: 'fig-dot' }), 'front');
    c.text(x + 8, y, o.label, { anchor: 'start', cls: 'fig-text fig-bold' });
  }
}

// ---- 解説用の図種 ----

/** layers：積み重ねた階層。levels[0] が最上段。{label, note?, hl?}。arrow: [上端の説明, 下端の説明] で縦矢印を付ける */
function drawLayers(c, fig) {
  const rowH = 40;
  const step = rowH + 4;
  const W = Math.max(200, Math.max(...fig.levels.map((l) => textWidth(l.label))) + 36);
  fig.levels.forEach((l, i) => {
    const y = i * step;
    c.add(s('rect', { x: 0, y, width: W, height: rowH, rx: 6, class: l.hl ? 'fig-bar-actual' : 'fig-bar' }));
    c.text(W / 2, y + rowH / 2, l.label, { cls: l.hl ? 'fig-on-accent fig-bold' : 'fig-text fig-bold' });
    if (l.note) c.text(W + 12, y + rowH / 2, l.note, { anchor: 'start', size: 12, cls: 'fig-text-muted' });
  });
  c.extend(0, 0, W, fig.levels.length * step);
  if (fig.arrow) {
    const x = -24;
    c.line(x, 6, x, fig.levels.length * step - 10, { arrow: true });
    if (fig.arrow[0]) c.text(x, -8, fig.arrow[0], { size: 11, cls: 'fig-text-muted' });
    if (fig.arrow[1]) c.text(x, fig.levels.length * step + 2, fig.arrow[1], { size: 11, cls: 'fig-text-muted' });
  }
}

/**
 * flow：流れ図。steps[]: {id, label, kind?: process|decision|terminal, col?, row?, next?: [{to, label?}]}
 * col・row は省略すると「同じ列で並び順に下へ」。next を省略すると次の要素へつなぐ（terminal は終端）。
 */
function drawFlow(c, fig) {
  const COL_W = 200;
  const ROW_H = 76;
  const nodes = new Map();
  let autoRow = 0;
  for (const st of fig.steps) {
    const row = st.row ?? autoRow;
    autoRow = row + 1;
    const decision = st.kind === 'decision';
    const tw = textWidth(st.label) + 28;
    const w = decision ? Math.max(110, tw + 34) : Math.max(90, tw);
    const hh = decision ? 54 : 38;
    const x = (st.col ?? 0) * COL_W;
    const y = row * ROW_H;
    nodes.set(st.id, { x, y, w, hh, clip: (tx, ty) => clipRect(x, y, w, hh, tx, ty) });
    if (decision) c.add(s('polygon', { points: `${x},${y - hh / 2} ${x + w / 2},${y} ${x},${y + hh / 2} ${x - w / 2},${y}`, class: 'fig-node' }));
    else c.add(s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: st.kind === 'terminal' ? 19 : 4, class: 'fig-node' }));
    c.text(x, y, st.label);
    c.extend(x - w / 2, y - hh / 2, x + w / 2, y + hh / 2);
  }
  fig.steps.forEach((st, i) => {
    const nexts = st.next ?? (st.kind !== 'terminal' && i < fig.steps.length - 1 ? [{ to: fig.steps[i + 1].id }] : []);
    for (const n of nexts) {
      const a = nodes.get(st.id);
      const b = nodes.get(n.to);
      if (a && b) connect(c, a, b, { label: n.label ?? null, others: [...nodes.values()] });
    }
  });
}

/**
 * venn：円の集合。sets[]: {label, x, y, r}（単位はグリッド）。regions[]: {x, y, label}（領域内の注記）。
 * shade: 塗る領域＝指定した集合 index の共通部分（例 [0,1] は A∩B）。
 */
function drawVenn(c, fig) {
  const id = `venn-${++seq}`;
  const sets = fig.sets.map((st) => ({ ...st, px: st.x * U, py: st.y * U, pr: st.r * U }));
  if (fig.shade?.length) {
    const defs = s('defs');
    fig.shade.forEach((i, k) => {
      const cp = s('clipPath', { id: `${id}-${k}` });
      cp.append(s('circle', { cx: sets[i].px, cy: sets[i].py, r: sets[i].pr }));
      defs.append(cp);
    });
    // 入れ子のグループで clipPath を重ね、共通部分だけを塗る
    let inner = s('rect', { x: -3000, y: -3000, width: 6000, height: 6000, class: 'fig-venn-shade' });
    for (let k = fig.shade.length - 1; k >= 0; k--) {
      const g = s('g', { 'clip-path': `url(#${id}-${k})` });
      g.append(inner);
      inner = g;
    }
    c.add(defs, 'back');
    c.add(inner, 'back');
  }
  for (const st of sets) {
    c.add(s('circle', { cx: st.px, cy: st.py, r: st.pr, class: 'fig-venn' }));
    c.extend(st.px - st.pr, st.py - st.pr, st.px + st.pr, st.py + st.pr);
    c.text(st.px + (st.lx ?? 0) * U, st.py - st.pr - 14, st.label, { cls: 'fig-text fig-bold' });
  }
  for (const r of fig.regions ?? []) c.text(r.x * U, r.y * U, r.label, { size: 12 });
}

/** bar：棒グラフ。bars[]: {label, value, kind?}。line: {values[], max?, label?} を右軸の折れ線として重ねる（パレート図の累積比など） */
function drawBar(c, fig) {
  const H = 150;
  const colW = Math.max(36, Math.min(64, 420 / fig.bars.length));
  const left = 44;
  const width = fig.bars.length * colW;
  const max = fig.max ?? Math.max(...fig.bars.map((b) => b.value));
  const y = (v) => H - (v / max) * H;
  const ticks = fig.ticks ?? 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    c.line(left, y(v), left + width, y(v), { cls: i ? 'fig-grid-minor' : 'fig-grid' });
    c.text(left - 6, y(v), String(+v.toFixed(1)), { anchor: 'end', size: 11, cls: 'fig-text-muted' });
  }
  fig.bars.forEach((b, i) => {
    const x = left + i * colW + colW * 0.18;
    const w = colW * 0.64;
    c.add(s('rect', { x, y: y(b.value), width: w, height: H - y(b.value), rx: 2, class: b.kind === 'actual' ? 'fig-bar-actual' : 'fig-bar' }));
    c.text(x + w / 2, y(b.value) - 9, String(b.value), { size: 11 });
    c.text(x + w / 2, H + 14, b.label, { size: 11 });
  });
  if (fig.line) {
    const lmax = fig.line.max ?? 100;
    const pts = fig.line.values.map((v, i) => [left + i * colW + colW / 2, H - (v / lmax) * H]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    c.path(`M${pts.map((p) => p.join(',')).join(' L')}`, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { cls: 'fig-line fig-line-accent', layer: 'mid' });
    for (const [px, py] of pts) c.add(s('circle', { cx: px, cy: py, r: 3, class: 'fig-dot' }), 'front');
    for (let i = 0; i <= ticks; i++) c.text(left + width + 6, y((max / ticks) * i), String(+((lmax / ticks) * i).toFixed(1)), { anchor: 'start', size: 11, cls: 'fig-text-muted' });
    c.text(left + width + 6, -14, `${fig.line.label ?? '折れ線'}（右軸）`, { anchor: 'start', size: 11, cls: 'fig-text-muted' });
  }
  if (fig.unit) c.text(left - 6, -14, fig.unit, { anchor: 'end', size: 11, cls: 'fig-text-muted' });
  c.extend(0, -20, left + width + (fig.line ? 40 : 10), H + 28);
}

/** seq：箱の並び。rows[]: {title?, cells:[{text, kind?: hl|dim|empty, note?}]}。配列・スタック・キュー・パケットの構造など */
function drawSeq(c, fig) {
  const cellH = 34;
  const titleW = Math.max(0, ...fig.rows.map((r) => (r.title ? textWidth(r.title) + 14 : 0)));
  let y = 0;
  for (const r of fig.rows) {
    const hasNote = r.cells.some((x) => x.note);
    if (r.title) c.text(titleW - 10, y + cellH / 2, r.title, { anchor: 'end' });
    let x = titleW;
    for (const cell of r.cells) {
      const w = Math.max(fig.cellW ?? 44, textWidth(cell.text ?? '') + 16);
      const cls = cell.kind === 'hl' ? 'fig-bar-actual' : cell.kind === 'dim' ? 'fig-cell-dim' : 'fig-node';
      c.add(s('rect', { x, y, width: w, height: cellH, class: cls + (cell.kind === 'empty' ? ' fig-dashed' : '') }));
      if (cell.text) c.text(x + w / 2, y + cellH / 2, cell.text, { cls: cell.kind === 'hl' ? 'fig-on-accent fig-bold' : 'fig-text' });
      if (cell.note) c.text(x + w / 2, y + cellH + 12, cell.note, { size: 11, cls: 'fig-text-muted' });
      x += w;
    }
    c.extend(0, y, x, y + cellH + (hasNote ? 24 : 0));
    y += cellH + (hasNote ? 24 : 0) + 18;
  }
}

const DRAW = { tree: drawTree, state: drawState, arrow: drawArrow, gantt: drawGantt, network: drawNetwork, er: drawEr, logic: drawLogic, layers: drawLayers, flow: drawFlow, venn: drawVenn, bar: drawBar, seq: drawSeq };
const NAMES = { tree: '木構造', state: '状態遷移図', arrow: 'アローダイアグラム', gantt: 'ガントチャート', network: 'ネットワーク構成図', er: 'E-R図', logic: '論理回路', layers: '階層図', flow: '流れ図', venn: 'ベン図', bar: '棒グラフ', seq: '並びの図' };

/**
 * @param {import('../types.js').FigureData & {caption?:string}} fig
 * @returns {HTMLElement}
 */
export function renderFigure(fig) {
  const draw = DRAW[fig?.type];
  if (!draw) return h('p', { class: 'notice warn' }, `この図（${fig?.type ?? '不明'}）は表示できません。`);
  const c = new Canvas();
  try {
    draw(c, fig);
  } catch {
    return h('p', { class: 'notice warn' }, '図を表示できませんでした。');
  }
  const label = fig.caption ?? NAMES[fig.type];
  return h('figure', { class: 'q-figure' }, h('div', { class: 'scroll-x' }, c.toSvg(label)), fig.caption ? h('figcaption', null, fig.caption) : null);
}

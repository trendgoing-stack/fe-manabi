// 自作のSVGグラフ。色はCSS変数で指定し、ライト／ダークの切り替えに追従する。
import { pct } from '../dom.js';

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

/**
 * 週別正答率の折れ線グラフ。回答のない週は点を打たず、線も途切れさせる。
 * @param {{start:string, n:number, ok:number}[]} weeks  古い順
 */
export function weeklyChart(weeks) {
  const W = 340;
  const H = 170;
  const m = { l: 34, r: 10, t: 12, b: 26 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const x = (i) => m.l + (weeks.length > 1 ? (pw * i) / (weeks.length - 1) : pw / 2);
  const y = (p) => m.t + ph * (1 - p / 100);
  const label = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;

  const answered = weeks.filter((w) => w.n > 0);
  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'chart',
    role: 'img',
    'aria-label': answered.length
      ? '週別の正答率。' + answered.map((w) => `${label(w.start)}の週 ${pct(w.ok, w.n)}%`).join('、')
      : '週別の正答率（記録なし）',
  });

  for (const p of [0, 50, 100]) {
    svg.append(
      s('line', { x1: m.l, x2: W - m.r, y1: y(p), y2: y(p), class: 'chart-grid' }),
      s('text', { x: m.l - 6, y: y(p) + 4, 'text-anchor': 'end', class: 'chart-text' }, `${p}%`),
    );
  }
  weeks.forEach((w, i) => {
    if (i % 3 === 0 || i === weeks.length - 1) {
      svg.append(s('text', { x: x(i), y: H - 8, 'text-anchor': i === weeks.length - 1 ? 'end' : 'middle', class: 'chart-text' }, label(w.start)));
    }
  });

  // 回答のある週が連続する区間ごとに線を引く
  let run = [];
  const flush = () => {
    if (run.length > 1) svg.append(s('polyline', { points: run.join(' '), class: 'chart-line' }));
    run = [];
  };
  weeks.forEach((w, i) => {
    if (w.n > 0) run.push(`${x(i).toFixed(1)},${y(pct(w.ok, w.n)).toFixed(1)}`);
    else flush();
  });
  flush();

  weeks.forEach((w, i) => {
    if (!w.n) return;
    const dot = s('circle', { cx: x(i), cy: y(pct(w.ok, w.n)), r: 4, class: 'chart-dot' });
    dot.append(s('title', null, `${label(w.start)}の週：${pct(w.ok, w.n)}%（${w.ok}/${w.n}）`));
    svg.append(dot);
  });
  return svg;
}

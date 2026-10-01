import { pick, pickBy } from '../lib/pick.mjs';

/** 全角や桁区切りを含む数字を数値にする */
const num = (s) => Number(String(s).normalize('NFKC').replace(/,/g, ''));

/** 問題文を一つの文字列にする（NFKC 正規化済み） */
const stemText = (q) => q.stem.join('').normalize('NFKC');

/** 「1〜9、20〜25」の形の文字列を番号の集合にする */
const parseRanges = (s) => {
  const set = new Set();
  for (const part of String(s).normalize('NFKC').split(/[、,]/)) {
    const m = part.match(/^\s*(\d+)\s*[〜~]\s*(\d+)\s*$/);
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) set.add(i);
    else if (/^\s*\d+\s*$/.test(part)) set.add(Number(part));
    else throw new Error(`範囲を読み取れない: ${part}`);
  }
  return set;
};

export const checks = {
  // 状態遷移図をたどり、受け付けられない出来事を含む系列を探す
  'a-tech-0225': (q) => {
    const { states, transitions } = q.figure;
    const start = states.find((s) => s.initial).id;
    const accepts = (text) => {
      let cur = start;
      for (const ev of text.split('→')) {
        const t = transitions.filter((x) => x.from === cur && x.label === ev);
        if (t.length > 1) throw new Error(`${q.id}: 状態 ${cur} の出来事 ${ev} が非決定的`);
        if (!t.length) return false;
        cur = t[0].to;
      }
      return true;
    };
    return pickBy(q, (text) => !accepts(text));
  },

  // 連続する二つの遷移の組：各遷移について、遷移先から出ている遷移の数を合計する
  'a-tech-0226': (q) => {
    const { transitions } = q.figure;
    const pairs = transitions.reduce((sum, t1) => sum + transitions.filter((t2) => t2.from === t1.to).length, 0);
    return pick(q, pairs);
  },

  // トップダウンテスト：結合済みのモジュールから呼ばれる未完成のモジュールの数
  'a-tech-0227': (q) => {
    const text = stemText(q);
    const done = new Set(text.match(/モジュール(.+?)は完成しており/)[1].split(/[、,\s]+/).filter(Boolean));
    for (const l of text.match(/第3階層のうち(.+?)だけが完成/)[1].split(/[、,\s]+/)) done.add(l);
    let stubs = 0;
    const walk = (node) => {
      if (!node) return;
      const integrated = done.has(node.label);
      for (const ch of node.children ?? []) {
        if (!ch) continue;
        if (integrated && !done.has(ch.label)) stubs++;
        if (done.has(ch.label)) walk(ch);
      }
    };
    walk(q.figure.root);
    return pick(q, stubs);
  },

  // 命令網羅率：実行された命令の和集合÷全命令数
  'a-tech-0229': (q) => {
    const total = num(stemText(q).match(/(\d+)個の命令からなる/)[1]);
    const union = new Set();
    for (const row of q.table.rows) for (const i of parseRanges(row[1])) union.add(i);
    return pick(q, Math.round((union.size / total) * 100));
  },

  // 限界値分析：各同値クラスの存在する側の境界値を重複なく数える
  'a-tech-0230': (q) => {
    const text = stemText(q).split('この機能を')[0];
    const ranges = [...text.matchAll(/(\d+)〜(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (ranges.length !== 4) throw new Error(`${q.id}: 有効クラスを ${ranges.length} 個しか読み取れない`);
    const values = new Set();
    for (const [lo, hi] of ranges) values.add(lo).add(hi);
    const min = Math.min(...ranges.map((r) => r[0]));
    const max = Math.max(...ranges.map((r) => r[1]));
    // 有効範囲が連続していることを確かめ、両端の外側の無効クラスの境界を加える
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) if (sorted[i][0] !== sorted[i - 1][1] + 1) throw new Error(`${q.id}: 範囲に隙間がある`);
    values.add(min - 1).add(max + 1);
    return pick(q, values.size);
  },

  // エラー埋込み法：もともとのエラーの推定総数から発見数を引く
  'a-tech-0231': (q) => {
    const text = stemText(q);
    const seeded = num(text.match(/意図的なエラーを(\d+)個/)[1]);
    const foundSeeded = num(text.match(/うち(\d+)個と/)[1]);
    const foundNative = num(text.match(/もともとあったエラー(\d+)個/)[1]);
    const totalNative = foundNative / (foundSeeded / seeded);
    return pick(q, Math.round(totalNative - foundNative));
  },

  // ベロシティ：平均で割って切り上げる
  'a-tech-0235': (q) => {
    const text = stemText(q);
    const pts = text.match(/ストーリーポイントは、([\d、]+)であった/)[1].split('、').map(Number);
    const remain = num(text.match(/合計は(\d+)ポイント/)[1]);
    const velocity = pts.reduce((a, b) => a + b, 0) / pts.length;
    return pick(q, Math.ceil(remain / velocity));
  },

  // 3方向マージ：両方が祖先から変更し、互いに異なる行を競合として数える
  'a-tech-0240': (q) => {
    const conflicts = q.table.rows.filter(([, base, x, y]) => x !== base && y !== base && x !== y).length;
    return pick(q, conflicts);
  },
};

// インタプリタの動作確認（開発用）。使い方: node tools/pseudo/test.mjs
import assert from 'node:assert/strict';
import { run, traceAt } from './interp.mjs';

const t = (name, fn) => {
  try {
    fn();
    console.log('ok  ', name);
  } catch (e) {
    console.log('FAIL', name, '-', e.message);
    process.exitCode = 1;
  }
};

t('再帰（階乗）', () => {
  const code = ['○整数型: fact(整数型: n)', '  if (n ≦ 1)', '    return 1', '  endif', '  return n × fact(n − 1)'];
  assert.equal(run(code, { call: 'fact', args: [5] }).value, 120);
});

t('配列・for・要素数', () => {
  const code = [
    '○整数型: total(整数型の配列: data)',
    '  整数型: i, s ← 0',
    '  for (i を 1 から dataの要素数 まで 1 ずつ増やす)',
    '    s ← s ＋ data[i]',
    '  endfor',
    '  return s',
  ];
  assert.equal(run(code, { call: 'total', args: [[3, 1, 4, 1, 5]] }).value, 14);
});

t('while・elseif・mod・÷', () => {
  const code = [
    '○整数型: f(整数型: n)',
    '  整数型: c ← 0',
    '  while (n ≠ 1)',
    '    if (n mod 2 ＝ 0)',
    '      n ← n ÷ 2',
    '    elseif (n ＞ 100)',
    '      n ← n − 1',
    '    else',
    '      n ← 3 × n ＋ 1',
    '    endif',
    '    c ← c ＋ 1',
    '  endwhile',
    '  return c',
  ];
  assert.equal(run(code, { call: 'f', args: [6] }).value, 8);
  assert.equal(run(code, { call: 'f', args: [7] }).value, 16);
});

t('do-while と減らす for', () => {
  const code = [
    '○整数型の配列: rev(整数型の配列: a)',
    '  整数型の配列: b ← {}',
    '  整数型: i',
    '  for (i を aの要素数 から 1 まで 1 ずつ減らす)',
    '    b の末尾に a[i] の値を追加する',
    '  endfor',
    '  整数型: k ← 0',
    '  do',
    '    k ← k ＋ 1',
    '  while (k ＜ 3)',
    '  b の末尾に k を追加する',
    '  return b',
  ];
  assert.deepEqual(run(code, { call: 'rev', args: [[1, 2, 3]] }).value, [3, 2, 1, 3]);
});

t('二次元配列・大域変数・出力・実行回数', () => {
  const code = [
    '大域: 整数型: cnt ← 0',
    '○show(整数型の二次元配列: m)',
    '  整数型: i, j',
    '  for (i を 1 から 2 まで 1 ずつ増やす)',
    '    for (j を 1 から 2 まで 1 ずつ増やす)',
    '      cnt ← cnt ＋ m[i, j]   /* 合計 */',
    '    endfor',
    '  endfor',
    '  cnt を出力する',
  ];
  const r = run(code, { call: 'show', args: [[[1, 2], [3, 4]]] });
  assert.deepEqual(r.output, ['10']);
  assert.equal(r.counts.get(6), 4);
});

t('トレース表', () => {
  const code = ['○整数型: g(整数型: n)', '  整数型: i, s ← 0', '  for (i を 1 から n まで 1 ずつ増やす)', '    s ← s ＋ i', '  endfor', '  return s'];
  assert.deepEqual(traceAt(code, { call: 'g', args: [3] }, 4, ['i', 's']), [['1', '0'], ['2', '1'], ['3', '3']]);
});

t('範囲外の要素番号はエラー', () => {
  const code = ['○整数型: h(整数型の配列: a)', '  return a[0]'];
  assert.throws(() => run(code, { call: 'h', args: [[1]] }), /範囲外/);
});

t('文字列と論理演算', () => {
  const code = ['○論理型: p(文字列型: s)', '  return s[1] ＝ "a" and not (sの文字数 ＜ 2)'];
  assert.equal(run(code, { call: 'p', args: ['ab'] }).value, true);
  assert.equal(run(code, { call: 'p', args: ['a'] }).value, false);
});

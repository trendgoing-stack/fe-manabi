import { pick } from '../lib/pick.mjs';

// 問題文・表から数値を読むためのヘルパー
const num = (s) => Number(String(s).replace(/[,，]/g, ''));
const text = (q) => q.stem.join('\n');

/** 問題文の中で、正規表現の最初のキャプチャを数値として返す。見つからなければ例外 */
const read = (q, re) => {
  const m = text(q).match(re);
  if (!m) throw new Error(`${q.id}: 問題文から ${re} を読み取れない`);
  return num(m[1]);
};

/** 表の1列目が name の行の、列 col の値を数値として返す */
const cell = (q, name, col = 1) => {
  const row = q.table.rows.find((r) => r[0] === name);
  if (!row) throw new Error(`${q.id}: 表に「${name}」がない`);
  return num(row[col]);
};

/** 四捨五入して浮動小数点の誤差を除く */
const round = (v, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

export const checks = {
  // TCO = 初期の費用の合計 + 年額の費用の合計 × 年数
  'a-strat-0048': (q) => {
    const years = read(q, /稼働開始から(\d+)年間/);
    let initial = 0;
    let annual = 0;
    for (const [name, amount] of q.table.rows) {
      if (name.includes('（初期）')) initial += num(amount);
      else if (name.includes('（年額）')) annual += num(amount);
      else throw new Error(`a-strat-0048: 費目「${name}」の区分が分からない`);
    }
    return pick(q, initial + annual * years);
  },

  // 内製案と外製案の、開発費用 + 稼働後の保守費用の合計を比べる
  'a-strat-0049': (q) => {
    const rate = read(q, /1人月当たり([\d,]+)万円/);
    const years = read(q, /稼働後(\d+)年間/);
    const [inPeople, inMonths] = text(q).match(/要員(\d+)人が(\d+)か月従事/).slice(1).map(num);
    const inMaintPerMonth = read(q, /毎月([\d.]+)人月/);
    const outFee = read(q, /委託費は([\d,]+)万円/);
    const [outPeople, outMonths] = text(q).match(/自社の要員(\d+)人が(\d+)か月従事/).slice(1).map(num);
    const outMaintPerYear = read(q, /年額([\d,]+)万円/);

    const inhouse = inPeople * inMonths * rate + inMaintPerMonth * 12 * rate * years;
    const outsource = outFee + outPeople * outMonths * rate + outMaintPerYear * years;
    const diff = round(Math.abs(inhouse - outsource));
    if (diff === 0) throw new Error('a-strat-0049: 両案が同額');
    const cheaper = inhouse < outsource ? '内製案' : '外製案';
    return pick(q, `${cheaper}が${diff.toLocaleString('en-US')}万円少ない`);
  },

  // 総合評価点 = Σ(重み × 評価点)。最大の会社が一意であることも確かめる
  'a-strat-0051': (q) => {
    const companies = q.table.header.slice(2);
    const scores = companies.map((_, j) =>
      round(q.table.rows.reduce((sum, r) => sum + num(r[1]) * num(r[j + 2]), 0)),
    );
    const best = Math.max(...scores);
    const winners = companies.filter((_, j) => scores[j] === best);
    if (winners.length !== 1) throw new Error('a-strat-0051: 最高点の会社が一意でない');
    return pick(q, winners[0]);
  },

  // LTV = (月額料金 − 月当たり原価・配送費) × 継続月数 − 獲得費用
  'a-strat-0056': (q) => {
    const fee = read(q, /月額([\d,]+)円/);
    const cost = read(q, /合計は([\d,]+)円/);
    const months = read(q, /平均して(\d+)か月/);
    const acquisition = read(q, /平均([\d,]+)円掛かって/);
    return pick(q, (fee - cost) * months - acquisition);
  },

  // 広告後の売上 − 広告前の売上 − 広告費（万円）。率は%のまま整数演算に寄せる
  'a-strat-0063': (q) => {
    const visitors = read(q, /訪問者数が([\d,]+)人/);
    const rate = read(q, /購入率）が([\d.]+)%/);
    const price = read(q, /平均購入額が([\d,]+)円/);
    const adCost = read(q, /1か月([\d,]+)万円の広告/);
    const growth = read(q, /訪問者数は([\d.]+)%増える/);
    const newRate = read(q, /購入率は([\d.]+)%に下がる/);
    const before = (visitors * rate * price) / 100;
    const after = (visitors * (100 + growth) * newRate * price) / 100 / 100;
    return pick(q, round((after - before) / 10000 - adCost));
  },

  // 損益分岐点比率(%) = 固定費 ÷ (1 − 変動費 ÷ 売上高) ÷ 売上高 × 100 = 固定費 ÷ (売上高 − 変動費) × 100
  'a-strat-0064': (q) => {
    const sales = read(q, /売上高は([\d,]+)万円/);
    const variable = read(q, /変動費は([\d,]+)万円/);
    const fixed = read(q, /固定費は([\d,]+)万円/);
    const bep = fixed / (1 - variable / sales);
    return pick(q, `${round((bep / sales) * 100)}%`);
  },

  // 総平均法：受入金額の合計 ÷ 受入数量の合計 を単価として、月末在庫数量に掛ける
  'a-strat-0065': (q) => {
    let inQty = 0;
    let inAmount = 0;
    let outQty = 0;
    for (const [, kind, qty, price] of q.table.rows) {
      if (kind === '前月繰越' || kind === '仕入') {
        inQty += num(qty);
        inAmount += num(qty) * num(price);
      } else if (kind === '払出') outQty += num(qty);
      else throw new Error(`a-strat-0065: 取引「${kind}」が分からない`);
    }
    return pick(q, round(((inQty - outQty) * inAmount) / inQty));
  },

  // 指数平滑法：F(t+1) = F(t) + α × (A(t) − F(t)) を4月→5月→6月と2回適用する
  'a-strat-0067': (q) => {
    const alpha = read(q, /平滑化係数を([\d.]+)とし/);
    let forecast = read(q, /4月の予測値が([\d,]+)個/);
    const actuals = [read(q, /4月の実績値が([\d,]+)個/), read(q, /5月の実績値が([\d,]+)個/)];
    for (const actual of actuals) forecast += alpha * (actual - forecast);
    return pick(q, round(forecast));
  },

  // デシジョンツリー：各案の期待値（改良費を含む）を求め、最大の期待値を返す
  'a-strat-0068': (q) => {
    const p1 = read(q, /成功する確率は([\d.]+)であり/);
    const gain = read(q, /成功すれば([\d,]+)万円の利益/);
    const loss = read(q, /失敗すれば([\d,]+)万円の損失/);
    const improve = read(q, /([\d,]+)万円を掛けて改良/);
    const p2 = read(q, /成功する確率は([\d.]+)になり/);
    const ev = (p) => p * gain - (1 - p) * loss;
    const plans = [ev(p1), ev(p2) - improve, 0].map((v) => round(v));
    const best = Math.max(...plans);
    if (plans.filter((v) => v === best).length !== 1) throw new Error('a-strat-0068: 期待値が最大の案が一意でない');
    return pick(q, best);
  },
};

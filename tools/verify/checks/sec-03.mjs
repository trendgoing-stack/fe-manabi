import { pick, pickBy } from '../lib/pick.mjs';

const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
const DAY_MIN = 24 * 60;
const at = (day, hm) => {
  const [h, m] = hm.split(':').map(Number);
  return DAYS.indexOf(day) * DAY_MIN + h * 60 + m;
};
const fmt = (t) => {
  const d = Math.floor(t / DAY_MIN);
  const r = t % DAY_MIN;
  return `${DAYS[d]}曜日${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
};

/** RPOから戻すべき時点、業務再開までの時間、承認者を求める */
function recovery(stem, table) {
  const s = stem.join('');
  const row = (k) => table.rows.find((r) => r[0] === k)[1];
  const rpo = Number(s.match(/RPO（目標復旧時点）は(\d+)時間/)[1]);
  const rto = Number(s.match(/RTO（目標復旧時間）は(\d+)時間/)[1]);
  const [, fd, fhm] = s.match(/(.)曜日の(\d+:\d+)に受注サーバのディスクが故障/);
  const fail = at(fd, fhm);

  const [, fullDay, fullHm] = row('フルバックアップ').match(/毎週(.)曜日の(\d+:\d+)に取得/);
  const full = at(fullDay, fullHm);
  const [, d1, d2, hms] = row('増分バックアップ').match(/(.)曜日から(.)曜日までの毎日、(.+)に取得/);
  const incs = [];
  for (let d = DAYS.indexOf(d1); d <= DAYS.indexOf(d2); d++) {
    for (const hm of hms.split('と')) incs.push(at(DAYS[d], hm));
  }
  incs.sort((a, b) => a - b);
  const restore = row('復元の作業時間');
  const fullH = Number(restore.match(/フルバックアップの復元に(\d+)時間/)[1]);
  const incMin = Number(restore.match(/1つ当たり(\d+)分/)[1]);
  const confirmH = Number(row('復元後の確認').match(/(\d+)時間かかる/)[1]);

  if (!(full < fail)) throw new Error('フルバックアップが故障より後');
  const required = fail - rpo * 60;
  // フル以降・故障前の増分を順に適用し、required 以降の状態に達した時点で止める
  const usable = incs.filter((t) => t > full && t <= fail);
  const k = usable.findIndex((t) => t >= required);
  if (k < 0) throw new Error('RPOを満たすバックアップがない');
  const n = k + 1;
  const hours = fullH + (n * incMin) / 60 + confirmH;
  const approver = hours <= rto ? '情報システム課長' : '社長';
  return { required: fmt(required), hours, approver };
}

/** リスク値＝max(C,I,A)×脅威×脆弱性。基準以上を大きい順に */
function riskOrder(stem, table) {
  const th = Number(stem.join('').match(/リスク値が(\d+)以上/)[1]);
  const vals = table.rows.map(([name, c, i, a, t, v]) => ({
    name,
    risk: Math.max(+c, +i, +a) * +t * +v,
  }));
  const need = vals.filter((x) => x.risk >= th).sort((a, b) => b.risk - a.risk);
  for (let j = 1; j < need.length; j++) {
    if (need[j].risk === need[j - 1].risk) throw new Error('リスク値が同じで順が決まらない');
  }
  return need.map((x) => x.name).join(' → ');
}

export const checks = {
  'b-sec-0043': (q) => {
    const { required, hours, approver } = recovery(q.stem, q.table);
    return pickBy(q, (t) => t.includes(`(a) ${required}　`) && t.includes(`(b) ${hours}時間`) && t.endsWith(approver));
  },
  'b-sec-0046': (q) => pick(q, riskOrder(q.stem, q.table)),
};

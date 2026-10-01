import { pick, pickBy } from '../lib/pick.mjs';

const num = (s) => Number(String(s).replace(/,/g, ''));
const sec = (t) => t.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 表1のバックアップ運用を数週間分たどり、NAS-Bの保存量の最大値を求める */
function maxBackup(table) {
  const row = (k) => table.rows.find((r) => r[0] === k)[1];
  const full = num(row('取得対象').match(/([\d,]+)Gバイト/)[1]);
  const inc = num(row('増分バックアップ').match(/平均([\d,]+)Gバイト/)[1]);
  const [, d1, d2] = row('増分バックアップ').match(/(.)曜日〜(.)曜日/);
  const days = DAYS.indexOf(d2) - DAYS.indexOf(d1) + 1;
  const keep = Number(row('保持').match(/最大(\d+)世代/)[1]);
  const del = row('古い世代の削除');
  if (!/取得を始める前に/.test(del)) throw new Error('削除の時点が想定と異なる');
  // 削除後に残す世代数：これから取得する分を含めて n 世代 → 既存は n-1 世代
  const m = del.match(/これから取得するフルバックアップを含めて(\d+)世代/);
  if (!m) throw new Error('削除後の世代数が読み取れない');
  const remain = Number(m[1]) - 1;
  const gens = []; // 各世代のデータ量
  let max = 0;
  const total = () => gens.reduce((a, x) => a + x, 0);
  for (let w = 0; w < 10; w++) {
    while (gens.length > remain) gens.shift(); // 日曜：取得前に最も古い世代を削除
    gens.push(full);
    max = Math.max(max, total());
    for (let i = 0; i < days; i++) {
      gens[gens.length - 1] += inc;
      max = Math.max(max, total());
    }
    if (gens.length > keep) throw new Error('保持の上限を超えている');
  }
  return max;
}

/** 同じ送信元・通信先へのPOSTが4回以上、ほぼ等間隔に続く組を探す */
function beacon(table) {
  const groups = new Map();
  for (const [t, src, host, method, result] of table.rows) {
    if (method !== 'POST' || result !== '許可') continue;
    const k = `${src}|${host}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(sec(t));
  }
  const hits = [...groups].filter(([, ts]) => {
    if (ts.length < 4) return false;
    const gaps = ts.slice(1).map((x, i) => x - ts[i]);
    return Math.max(...gaps) - Math.min(...gaps) <= 5;
  });
  if (hits.length !== 1) throw new Error('定期通信の組が一つに決まらない');
  const [src, host] = hits[0][0].split('|');
  // 感染端末は配布ドメインから許可された応答を受け取っていること
  if (!table.rows.some((r) => r[1] === src && r[2] === 'files.example.net' && r[4] === '許可' && num(r[5]) > 0)) throw new Error('配布元からの受信がない');
  return [src, host];
}

/** 時計のずれを補正して並べた順序 */
function order(stem, table) {
  const off = {};
  for (const m of stem.join('').matchAll(/(VPN装置|Webサーバ|ファイアウォール|DBサーバ)が(\d+)分(遅れ|進ん)/g)) {
    off[m[1]] = (m[3] === '遅れ' ? 1 : -1) * Number(m[2]) * 60;
  }
  const evs = table.rows.map(([no, dev, t]) => ({ no, t: sec(t) + (off[dev] ?? 0) }));
  evs.sort((a, b) => a.t - b.t);
  return evs.map((e) => e.no).join(' → ');
}

/** 規則(1)：直接アクセス可、かつ攻撃コード・悪用の情報あり、かつ台帳に該当機器あり */
function topPriority(table) {
  return table.rows.filter((r) => r[5] === '可' && r[3] !== 'なし' && r[4] !== 'なし').map((r) => r[0]).join('、');
}

/** 攻撃元IP（3つ以上のIDに失敗）と成功ID、手口 */
function spray(table) {
  const byIp = new Map();
  for (const [, id, ip, res] of table.rows) {
    if (!byIp.has(ip)) byIp.set(ip, []);
    byIp.get(ip).push({ id, res });
  }
  const attackers = [...byIp].filter(([, rs]) => new Set(rs.filter((r) => r.res === '失敗').map((r) => r.id)).size >= 3);
  if (attackers.length !== 1) throw new Error('攻撃元が一つに決まらない');
  const rs = attackers[0][1];
  const ok = rs.filter((r) => r.res === '成功').map((r) => r.id);
  if (ok.length !== 1) throw new Error('成功IDが一つに決まらない');
  const perId = new Map();
  for (const r of rs) perId.set(r.id, (perId.get(r.id) ?? 0) + 1);
  const method = Math.max(...perId.values()) === 1 ? 'パスワードスプレー' : '総当たり';
  return [method, ok[0]];
}

/** ワームの感染範囲（USBメモリ接続 or 同セグメントで未適用） */
function infected(table) {
  const pcs = table.rows.map(([name, seg, p, u]) => ({ name, seg, unpatched: p === '未適用', usb: u === 'あり' }));
  const inf = new Set(pcs.filter((x) => x.usb).map((x) => x.name));
  let changed = true;
  while (changed) {
    changed = false;
    for (const x of pcs) {
      if (inf.has(x.name) || !x.unpatched) continue;
      if (pcs.some((y) => inf.has(y.name) && y.seg === x.seg)) {
        inf.add(x.name);
        changed = true;
      }
    }
  }
  inf.delete('PC-A1');
  return [...inf].sort().join('、');
}

/** フル・差分・増分が混在する運用で、故障直前の状態への復元に読み込む量 */
function diffRestore(stem, table) {
  const s = stem.join('');
  const full = Number(s.match(/フルバックアップのデータ量は(\d+)Gバイト/)[1]);
  const failDay = DAYS.indexOf(s.match(/(.)曜日の昼に/)[1]);
  // 日曜〜故障前夜までの各夜のバックアップとデータ量
  const backups = [];
  let sinceFull = 0;
  let sinceLast = 0;
  for (let i = 0; i < failDay; i++) {
    const [day, kind, change] = table.rows[i];
    if (DAYS.indexOf(day) !== i) throw new Error('曜日の並びが想定と異なる');
    const c = kind === 'フル' ? 0 : num(change.replace('Gバイト', ''));
    sinceFull += c;
    sinceLast += c;
    if (kind === 'フル') { backups.push({ kind, size: full }); sinceFull = 0; }
    else if (kind === '差分') backups.push({ kind, size: sinceFull });
    else if (kind === '増分') backups.push({ kind, size: sinceLast });
    else throw new Error(`不明な種類 ${kind}`);
    sinceLast = 0;
  }
  // 最新から遡る：差分ならフルと二つ、増分なら一つ前へ、フルで終わり
  let sum = 0;
  for (let i = backups.length - 1; i >= 0; i--) {
    const b = backups[i];
    sum += b.size;
    if (b.kind === 'フル') return sum;
    if (b.kind === '差分') {
      const f = backups.slice(0, i).reverse().find((x) => x.kind === 'フル');
      return sum + f.size;
    }
  }
  throw new Error('フルバックアップがない');
}

export const checks = {
  'b-sec-0021': (q) => pick(q, maxBackup(q.setTable)),
  'b-sec-0024': (q) => {
    const [src, host] = beacon(q.setTable);
    return pickBy(q, (t) => t.includes(src) && t.includes(host));
  },
  'b-sec-0026': (q) => pick(q, order(q.setStem, q.setTable)),
  'b-sec-0029': (q) => pick(q, topPriority(q.setTable)),
  'b-sec-0033': (q) => {
    const [method, id] = spray(q.setTable);
    return pickBy(q, (t) => t.includes(method) && t.endsWith(id));
  },
  'b-sec-0035': (q) => pick(q, infected(q.setTable)),
  'b-sec-0037': (q) => pick(q, diffRestore(q.stem, q.table)),
};

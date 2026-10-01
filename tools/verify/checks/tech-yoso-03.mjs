import { pick, pickBy } from '../lib/pick.mjs';

/** 問題の table を、見出しをキーにしたオブジェクトの配列にする */
const rowsOf = (q) =>
  q.table.rows.map((r) => Object.fromEntries(q.table.header.map((h, i) => [h, r[i]])));

/** "a.b.c.d" を32ビットの符号なし整数にする */
const toInt = (ip) => ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);

/** アドレス addr が network/prefix に含まれるか */
const inNetwork = (addr, network, prefix) => {
  const size = 2 ** (32 - prefix);
  return Math.floor(toInt(addr) / size) === Math.floor(toInt(network) / size);
};

/** サブネットマスク "255.255.255.224" のプレフィックス長 */
const prefixOf = (mask) => toInt(mask).toString(2).replace(/0+$/, '').length;

/** 図の network で、from から to への経路（ノードidの配列）を幅優先探索で求める */
const pathOf = (fig, from, to) => {
  const adj = new Map(fig.nodes.map((n) => [n.id, []]));
  for (const l of fig.links) {
    adj.get(l.from).push(l.to);
    adj.get(l.to).push(l.from);
  }
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nx of adj.get(cur)) {
      if (!prev.has(nx)) {
        prev.set(nx, cur);
        queue.push(nx);
      }
    }
  }
  const path = [];
  for (let c = to; c !== null; c = prev.get(c)) path.unshift(c);
  return path;
};

export const checks = {
  // E-R図から外部キーの置き方を決める（1対多は多の側に外部キー、多対多は新しい表）
  'a-tech-0190': (q) => {
    const ents = new Map(q.figure.entities.map((e) => [e.id, e]));
    const keyOf = (id) => ents.get(id).attrs.find((a) => /^_.*_$/.test(a)).slice(1, -1);
    const needs = [];
    for (const r of q.figure.relations) {
      if (r.fromMul === '1' && r.toMul === '*') needs.push(`${keyOf(r.from)}を表「${ents.get(r.to).name}」に`);
      else if (r.fromMul === '*' && r.toMul === '1') needs.push(`${keyOf(r.to)}を表「${ents.get(r.from).name}」に`);
      else needs.push(`${keyOf(r.from)}と${keyOf(r.to)}の組を主キーとする表を新たに設ける`);
    }
    return pickBy(q, (t) => needs.every((s) => t.includes(s)));
  },

  // SELECT DISTINCT 顧客コード, 商品コード ... WHERE 数量 >= 3
  'a-tech-0192': (q) => {
    const set = new Set(
      rowsOf(q)
        .filter((r) => Number(r['数量']) >= 3)
        .map((r) => `${r['顧客コード']}|${r['商品コード']}`),
    );
    return pick(q, set.size);
  },

  // 東店会員 UNION 西店会員（西店会員は問題文の M03、M05、M08、M09）
  'a-tech-0193': (q) => {
    const west = ['M03', 'M05', 'M08', 'M09'];
    const set = new Set([...rowsOf(q).map((r) => r['会員番号']), ...west]);
    return pick(q, set.size);
  },

  // UPDATE 後の SUM(在庫数)
  'a-tech-0194': (q) => {
    let sum = 0;
    for (const r of rowsOf(q)) {
      let n = Number(r['在庫数']);
      if (r['区分'] === 'B' && n < 20) n += 10;
      sum += n;
    }
    return pick(q, sum);
  },

  // プライベートIPアドレス（10/8、172.16/12、192.168/16）
  'a-tech-0199': (q) =>
    pickBy(q, (t) =>
      inNetwork(t, '10.0.0.0', 8) || inNetwork(t, '172.16.0.0', 12) || inNetwork(t, '192.168.0.0', 16),
    ),

  // PC1 から SV への経路で最初に通るルータが、フレームの宛先になる
  'a-tech-0200': (q) => {
    const fig = q.figure;
    const byId = new Map(fig.nodes.map((n) => [n.id, n]));
    const path = pathOf(fig, 'pc1', 'sv');
    const first = path.map((id) => byId.get(id)).find((n) => n.kind === 'router');
    return pickBy(q, (t) => t === `${first.label}のMACアドレス`);
  },

  // ウィンドウサイズ ÷ RTT（Mビット/秒）
  'a-tech-0204': (q) => pick(q, (64 * 1000 * 8) / 0.02 / 1e6),

  // 192.168.5.77/27 と同じサブネットで、ネットワークアドレスとブロードキャストアドレス以外
  'a-tech-0208': (q) => {
    const host = '192.168.5.77';
    const prefix = prefixOf('255.255.255.224');
    const size = 2 ** (32 - prefix);
    return pickBy(q, (t) => {
      const off = toInt(t) % size;
      return inNetwork(t, host, prefix) && off !== 0 && off !== size - 1;
    });
  },

  // 本人拒否と他人受入の期待回数の合計が最小の設定
  'a-tech-0214': (q) => {
    let best = null;
    for (const r of rowsOf(q)) {
      const v = (1200 * Number(r['本人拒否率（%）'])) / 100 + (1000 * Number(r['他人受入率（%）'])) / 100;
      if (best === null || v < best.v) best = { v, name: r['設定'] };
    }
    return pick(q, best.name);
  },

  // FWのルールを番号順に照合する。所属は図の zones から求める
  'a-tech-0219': (q) => {
    const fig = q.figure;
    const lan = fig.zones.find((z) => z.label === '社内LAN');
    const inZone = (n, z) => n.x >= z.x && n.x <= z.x + z.w && n.y >= z.y && n.y <= z.y + z.h;
    const labelOf = new Map(fig.nodes.map((n) => [n.label, n]));
    const matches = (pattern, host) => {
      if (pattern === '全て') return true;
      if (pattern === '社内LAN') return host !== 'インターネット' && inZone(labelOf.get(host), lan);
      return pattern === host;
    };
    const rules = rowsOf(q).sort((a, b) => Number(a['番号']) - Number(b['番号']));
    const passes = (text) => {
      const [, src, dst, svc] = text.match(/^(.+?)から(.+?)への(.+)$/);
      const rule = rules.find(
        (r) => matches(r['送信元'], src) && matches(r['宛先'], dst) && (r['サービス'] === '全て' || r['サービス'] === svc),
      );
      return rule['動作'] === '許可';
    };
    return pickBy(q, passes);
  },

  // リスク値 = 資産価値×脅威×脆弱性 が24以上で、資産価値が2以下の資産を除いた数
  'a-tech-0222': (q) => {
    const n = rowsOf(q).filter((r) => {
      const v = Number(r['資産価値']);
      return v * Number(r['脅威']) * Number(r['脆弱性']) >= 24 && v > 2;
    }).length;
    return pick(q, n);
  },
};

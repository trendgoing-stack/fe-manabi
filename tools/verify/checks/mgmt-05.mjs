import { pick } from '../lib/pick.mjs';

export const checks = {
  // 品質コスト：不適合コスト＝内部失敗（テストで見つかった不具合の修正）＋外部失敗（稼働後の障害対応・補償）
  'a-mgmt-0070': (q) => {
    const cost = Object.fromEntries(q.table.rows.map(([k, v]) => [k, Number(v)]));
    const internalFailure = cost['テストで見つかった不具合の修正'];
    const externalFailure = cost['稼働後に発生した障害の調査と修正'] + cost['稼働後の障害で顧客に支払った補償'];
    return pick(q, internalFailure + externalFailure);
  },
};

# CONTENT.md — 問題の書き方

基本情報まなび帳に同梱する問題・解説・用語定義は**すべてオリジナル**です。IPAが公開している過去問（問題文・選択肢・図表・解説）を転載したり、数値や語句だけを差し替えたりしてはいけません。題材・数値・設定は独自に設計します。

基準：基本情報技術者試験シラバス Ver.9.2（試験要綱 Ver.5.6）。

## ファイル

- `data/questions/a/*.json`：科目A。`data/questions/b/*.json`：科目B
- 1ファイル20〜30問を目安にし、追加したら `data/meta.json` の `files[]` に足す（コード変更は不要）
- ファイルの形：

```json
{ "schemaVersion": 1, "items": [ { …問題… }, { …問題… } ] }
```

## 問題のスキーマ

型定義は `js/types.js`（JSDoc）。

| フィールド | 必須 | 内容 |
|---|---|---|
| `id` | ○ | `a-tech-0012`／`a-mgmt-0003`／`a-strat-0007`／`b-algo-0001`／`b-sec-0001`。全ファイルで一意。**一度出したら変えない** |
| `subject` | ○ | `"A"`／`"B"` |
| `field` | ○ | `"technology"`／`"management"`／`"strategy"` |
| `category` | ○ | 下の固定リストから1つ |
| `syllabusRef` | ○ | シラバス中分類名（下の対応表） |
| `difficulty` | ○ | 1（用語の基本）／2（理解・簡単な計算）／3（応用・複数段階の計算） |
| `stem` | ○ | 問題文。段落ごとの文字列配列 |
| `table` | | `{ "header": [], "rows": [[]] }` |
| `code` | | 擬似言語のコード（フェーズ4） |
| `figure` | | 図データ（フェーズ3） |
| `choices` | ○ | 長さ4。`{ "text", "why" }`。`why` はその選択肢が正しい／誤りである理由を1文で |
| `answer` | ○ | 0〜3（`choices` のindex） |
| `fixedOrder` | | `true` なら並べ替えない（数値の昇順、組合せ形式など）。省略時 false |
| `explanation` | ○ | 解説。ア〜エの記号や「1番目の選択肢」に触れず、内容で書く |
| `terms` | ○ | 用語集のid配列（フェーズ3まで空配列でよい） |
| `tags` | ○ | 絞り込み用。`"計算"` `"用語"` など |
| `asOf` | | 法令・制度・規格に依存する場合の基準年月 `YYYY-MM` |
| `verification` | ○ | `{ "status", "methods": [], "verifiedAt", "script"?, "note"? }` |
| `needsUserCheck` | | 一次情報で確認できなかった場合 `true` |
| `retired` | | `true` なら出題しない（履歴のために残す） |
| `source` | ○ | `"original"` 固定 |

### カテゴリと `syllabusRef`

| field | category | syllabusRef（中分類） |
|---|---|---|
| technology | 基礎理論 | 基礎理論 |
| technology | アルゴリズムとプログラミング | アルゴリズムとプログラミング |
| technology | コンピュータ構成要素 | コンピュータ構成要素／ハードウェア |
| technology | システム構成要素 | システム構成要素 |
| technology | ソフトウェア | ソフトウェア |
| technology | UIと情報メディア | ユーザーインタフェース／情報メディア |
| technology | データベース | データベース |
| technology | ネットワーク | ネットワーク |
| technology | セキュリティ | セキュリティ |
| technology | システム開発技術 | システム開発技術 |
| technology | 開発管理 | ソフトウェア開発管理技術 |
| management | プロジェクトマネジメント | プロジェクトマネジメント |
| management | サービスマネジメント | サービスマネジメント |
| management | システム監査 | システム監査 |
| strategy | システム戦略 | システム戦略／システム企画 |
| strategy | 経営戦略 | 経営戦略マネジメント／技術戦略マネジメント／ビジネスインダストリ |
| strategy | 企業と法務 | 企業活動／法務 |

### 文章記法

- 上付き `2^{10}`、下付き `log_{2}N`、分数は `a/b`
- HTMLタグは書かない（レンダラーは `textContent` で描画するため、そのまま文字として出る）
- 数式中の乗算は `×`、除算は `÷` または `/`

### 書き方のルール

1. 正解は**一意**にする。「最も適切なものはどれか」で複数が正解になり得る選択肢を置かない
2. 「適切なもの」「誤っているもの」を問題文の末尾で明示し、`answer` と取り違えない
3. 4つの選択肢は長さと書きぶりをそろえる。正解だけ長い・正解だけ限定表現が無い、を避ける
4. 数値の選択肢は昇順に並べて `fixedOrder: true`
5. 誤答は「よくある取り違え」から作る（隣接概念、計算の途中値、単位の誤り）
6. 1ファイル内で `answer` の位置が偏らないようにする（0〜3がほぼ均等）
7. 法令・制度・規格に依存する問題は `asOf` を付ける
8. 正解や選択肢の意味が変わる修正は、新しい `id` で追加し、旧 `id` は `retired: true`

### 例

```json
{
  "id": "a-tech-0001",
  "subject": "A",
  "field": "technology",
  "category": "システム構成要素",
  "syllabusRef": "システム構成要素",
  "difficulty": 2,
  "stem": [
    "稼働率が0.9の装置Xと、稼働率が0.8の装置Yを並列に接続したシステムがある。少なくとも一方が動作していればシステムは稼働する。",
    "このシステム全体の稼働率は幾らか。"
  ],
  "choices": [
    { "text": "0.72", "why": "二つの稼働率を掛けた値で、直列接続の場合の稼働率である。" },
    { "text": "0.85", "why": "二つの稼働率の平均であり、稼働率の計算にはならない。" },
    { "text": "0.90", "why": "装置Xだけの稼働率であり、装置Yによる冗長化が反映されていない。" },
    { "text": "0.98", "why": "両方が同時に停止する確率 0.1×0.2=0.02 を1から引いた値である。" }
  ],
  "answer": 3,
  "fixedOrder": true,
  "explanation": "並列システムは、すべての装置が同時に停止したときだけ停止する。停止確率は (1−0.9)×(1−0.8)=0.02 なので、稼働率は 1−0.02=0.98 となる。",
  "terms": [],
  "tags": ["計算", "稼働率"],
  "verification": { "status": "unverified", "methods": [], "verifiedAt": null },
  "source": "original"
}
```

## 科目Bの `set` 形式（フェーズ4で実装）

共通の題材に複数の設問がぶら下がる形。`items` に問題と混在して置ける。

```json
{
  "setId": "b-sec-set-0001",
  "subject": "B",
  "title": "在宅勤務用端末の運用見直し",
  "stem": ["A社は…（事例本文）"],
  "code": null,
  "questions": [ { "id": "b-sec-0001", "…": "通常の問題と同じフィールド" } ]
}
```

擬似言語コードは `code: { "lines": ["○整数型: total(整数型の配列: data)", "  整数型: i, s ← 0", "…"] }` のように行の配列で持ち、解説からは「行3」の形で参照する。

## 図データ（フェーズ3で実装）

SVGを手描きせず、`figure: { "type": "tree" | "state" | "er" | "network" | "logic" | "gantt" | "arrow", … }` のデータからレンダラーが生成する。型ごとの記述例はフェーズ3で追記する。

## 検証ルール

ステータス：`unverified` → `ai-verified`（パス1〜3をすべて通過）→ `user-verified`（本人確認）。解消しない不一致は `disputed`。

| パス | 内容 | `methods` に入れる値 |
|---|---|---|
| 1 独立解答 | 作成担当とは別のエージェントが、`answer`・`why`・`explanation` を伏せた状態で解く。`node tools/verify/strip.mjs <file>` で伏せたJSONを出力する | `independent-solve` |
| 2 実行検証 | 計算で確かめられる問題は `tools/verify/checks/*.mjs` に計算を書き、`node tools/verify/run.mjs` で `answer` と照合する | `script` |
| 3 品質検査 | 正解の一意性、正誤の取り違え、選択肢長の偏り | `quality-review` |
| 法令等 | WebSearchで一次情報を確認。できなければ `needsUserCheck: true` | `web-source` |

- 独立解答の結果は `node tools/verify/compare.mjs <解答JSON>…` で `answer` と照合する
- パス3の指摘を直し終えたら `node tools/verify/promote.mjs <解答JSON>… [--web=id,…]` で、一致した問題だけを `ai-verified` にする
- 最後に `node tools/validate.mjs`（または `tools/validate.html`）でエラー0件を確認する
- 不一致は原因を分析して修正し、再検証する（最大2回）。それでも残れば `disputed`
- バッチごとの結果は `VERIFICATION.md` に記録する
- 出題されるのは `ai-verified` 以上。設定で「未検証を含める」をONにすると `unverified` も出る。`disputed` と `retired` は常に出ない

### 実行検証スクリプトの書き方

`tools/verify/checks/<問題ファイル名>.mjs`：

```js
import { pick } from '../lib/pick.mjs';

export const checks = {
  // 関数は「正解であるべき choices の index」を返す
  'a-tech-0001': (q) => pick(q, (1 - (1 - 0.9) * (1 - 0.8)).toFixed(2)),
};
```

`pick(q, value)` は、`text` が `value` と一致する選択肢（数値は数値として比較）がちょうど1つあるときにそのindexを返し、0個または複数なら例外を投げる。問題側には `"verification": { …, "script": "tools/verify/checks/<名前>.mjs" }` を付ける。

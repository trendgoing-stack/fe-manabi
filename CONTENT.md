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
| `code` | | 擬似言語のコード（「科目B」の節） |
| `figure` | | 図データ（「図データ」の節） |
| `choices` | ○ | 長さ4。`{ "text", "why" }`。`why` はその選択肢が正しい／誤りである理由を1文で |
| `answer` | ○ | 0〜3（`choices` のindex） |
| `fixedOrder` | | `true` なら並べ替えない（数値の昇順、組合せ形式など）。省略時 false |
| `explanation` | ○ | 解説。ア〜エの記号や「1番目の選択肢」に触れず、内容で書く |
| `terms` | ○ | 用語集のid配列。作成時は空配列でよく、`node tools/link-terms.mjs` で自動的に付く |
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

## 科目B

科目Bは「アルゴリズムとプログラミング」と「情報セキュリティ」の2分野。本試験は20問（アルゴリズムとプログラミング16問、情報セキュリティ4問）。

- `subject` は `"B"`、`field` は `"technology"`
- アルゴリズムの問題：`category`・`syllabusRef` とも「アルゴリズムとプログラミング」、id は `b-algo-0001` 形式
- セキュリティの問題：`category`・`syllabusRef` とも「セキュリティ」、id は `b-sec-0001` 形式
- 科目Aより長い事例・コードを読ませ、理解して処理を追う力を問う。用語の暗記だけで解ける問題にしない

### `set` 形式（共通の題材＋複数の設問）

`items` に単独の問題と混在して置ける。設問は通常の問題と同じフィールドを持つ（`stem` はその設問の問い）。題材の `stem`・`code`・`table`・`figure` は、出題時に設問の上に表示される。

```json
{
  "setId": "b-sec-set-0001",
  "subject": "B",
  "title": "在宅勤務用端末の運用見直し",
  "stem": ["A社は…（事例本文。段落ごとの配列）"],
  "questions": [
    { "id": "b-sec-0001", "subject": "B", "field": "technology", "category": "セキュリティ", "syllabusRef": "セキュリティ", "…": "通常の問題と同じ" },
    { "id": "b-sec-0002", "…": "…" }
  ]
}
```

- 1つの set の設問は2〜3問。演習ではまとめて続けて出題し、模擬試験でも set 単位で選ぶ
- 各設問は、その設問だけを読んでも何を問われているか分かるように書く（題材は共通）

### 擬似言語コード

`code: { "lines": [ … ] }` に1行ずつ書く。表示では行番号（1始まり）が付き、インデントはそのまま保たれる。

```json
"code": { "lines": [
  "○整数型: total(整数型の配列: data)",
  "  整数型: i, s ← 0",
  "  for (i を 1 から dataの要素数 まで 1 ずつ増やす)",
  "    s ← s ＋ data[i]",
  "  endfor",
  "  return s"
] }
```

記法は IPA「試験で使用する情報技術に関する用語・プログラム言語など Ver.5.0」別紙2（擬似言語の記述形式）に従う。**実行検証のため、次の範囲で書く**（`tools/pseudo/interp.mjs` が解釈できる範囲）。

| 項目 | 書き方 |
|---|---|
| 手続・関数の宣言 | `○手続名(型: 引数, …)`、`○戻り値の型: 関数名(型: 引数, …)` |
| 型 | `整数型` `実数型` `文字型` `文字列型` `論理型`、配列は `整数型の配列` `整数型の二次元配列` など |
| 変数宣言 | `整数型: i, s ← 0`（初期値は任意）。大域変数は手続の外に `大域: 整数型: cnt ← 0` |
| 代入 | `変数 ← 式`、`a[i] ← 式`、`m[i, j] ← 式` |
| 選択 | `if (条件式)` … `elseif (条件式)` … `else` … `endif` |
| 前判定の繰返し | `while (条件式)` … `endwhile` |
| 後判定の繰返し | `do` … `while (条件式)`（**do の中では while 文を使わない**） |
| 繰返し | `for (i を 1 から n まで 1 ずつ増やす)` … `endfor`、`for (i を n から 1 まで 1 ずつ減らす)` |
| 戻り値 | `return 式`、`return` |
| 配列への追加 | `b の末尾に x の値を追加する` |
| 出力 | `x を出力する`（複数なら `x, y を出力する`） |
| 要素数・文字数 | `dataの要素数`、`sの文字数` |
| 配列の内容 | `{1, 2, 3}`、二次元は `{{1, 2}, {3, 4}}`、空は `{}` |
| 演算子 | `＋ − × ÷ mod`、`＝ ≠ ＜ ＞ ≦ ≧`、`and or not`、`.`（メンバ） |
| 定数 | `true` `false` `未定義` `未定義の値`、文字列は `"abc"` |
| 注釈 | `/* 注釈 */`、`// 注釈` |

- 変数名・手続名は半角英字で始める（`data`、`count`、`isPrime` など）
- 配列の要素番号は1から始まる。**問題文に「配列の要素番号は1から始まる」と必ず書く**
- `÷` は、両辺が整数なら商の整数部分（0の方向に切り捨て）、それ以外は通常の割り算。整数どうしの割り算を使う問題は、問題文に「÷ は商の整数部分を求める」などと書く
- `mod` は剰余。負の数の剰余は使わない
- 配列を引数に渡すと、呼び出された側での変更が呼び出し元にも反映される（参照渡し）。単純な値は値渡し
- 空欄補充は、コード中の空欄を `［ a ］` のように書き、選択肢で埋める内容を示す。検証スクリプトでは、選択肢ごとに空欄を埋めたコードを実行して、条件を満たすのが正解の選択肢だけであることを確かめる
- 解説でコードの行を指すときは「**3行目**」のように「n行目」と書く（タップで該当行が強調表示される）

### トレース表（任意）

変数の値の推移を学習者が自分で書き込み、正解と照合できる。`trace` を付けた問題だけ「トレース表で確かめる」ボタンが出る。

```json
"trace": {
  "caption": "total({3, 1, 4}) を実行したとき、4行目を実行する直前の値",
  "vars": ["i", "s"],
  "rows": [["1", "0"], ["2", "3"], ["3", "4"]]
}
```

`rows` は `tools/pseudo/interp.mjs` の `traceAt()` で生成した値と一致させる（検証スクリプトで照合する）。数値は半角、配列は `{1, 2}`、未定義は「未定義」。

### 実行検証（科目B）

`tools/verify/checks/<ファイル名>.mjs` で `tools/pseudo/interp.mjs` の `run()`・`traceAt()` を使い、問題の `code.lines`（set なら題材の `code`）を実際に実行して正解を求める。

```js
import { pick } from '../lib/pick.mjs';
import { run } from '../../pseudo/interp.mjs';

export const checks = {
  'b-algo-0001': (q) => pick(q, run(q.code.lines, { call: 'total', args: [[3, 1, 4]] }).value),
};
```

set の設問では、検証関数の引数 `q` に題材のフィールド（`setCode`・`setStem`・`setTable`）が追加される。

## 図データ

SVGを手描きせず、問題の `figure` に書いたデータから `js/render/figure.js` がSVGを生成する。色はCSS変数で指定されるため、ライト／ダークの切り替えに自動で追従する。横に長い図は図だけが横スクロールする。

共通：

- `figure.type` は `tree`／`state`／`arrow`／`gantt`／`network`／`er`／`logic`／`layers`／`flow`／`venn`／`bar`／`seq` のいずれか（後ろの5種は「解説用の図種」）
- `figure.caption`（任意）：図の下に出す短い説明（例：「図　受注処理の状態遷移」）
- `tree` と `gantt` 以外は、要素の位置を**グリッド座標** `x`, `y`（右が x の正、下が y の正。小数可）で指定する。1単位はおよそ60px。中心どうしの間隔は横2以上、縦1.5以上を目安にする
- 表は図ではなく `table` を使う。1問に `table` と `figure` を両方付けてよい
- ラベルは短く（全角8文字程度まで）。記号（A、B、①…）を使い、説明は問題文に書く

### tree（木構造）

位置は自動で決まる。`children` に `null` を入れると、その位置を空けたまま描く（2分木の左右を表す）。

```json
{ "type": "tree", "root": { "label": "50", "children": [
  { "label": "30", "children": [ { "label": "20" }, null ] },
  { "label": "70", "children": [ { "label": "60" }, { "label": "80" } ] }
] } }
```

### state（状態遷移図）

```json
{ "type": "state",
  "states": [
    { "id": "s0", "label": "待機", "x": 0, "y": 0, "initial": true },
    { "id": "s1", "label": "処理中", "x": 3, "y": 0 },
    { "id": "s2", "label": "完了", "x": 6, "y": 0, "final": true }
  ],
  "transitions": [
    { "from": "s0", "to": "s1", "label": "受付" },
    { "from": "s1", "to": "s1", "label": "再試行" },
    { "from": "s1", "to": "s2", "label": "終了" },
    { "from": "s2", "to": "s0", "label": "リセット" }
  ] }
```

`from` と `to` が同じなら自己遷移のループを描く。同じ2状態間の往復は、2本の矢印を少しずらして描く。オートマトンの状態遷移図にも使う（`label` に入力記号を書く）。

### arrow（アローダイアグラム）

結合点を丸、作業を矢印で描く。`dummy: true` はダミー作業（破線）。`label` は「A 3」のように作業名と日数を書く。

```json
{ "type": "arrow",
  "nodes": [ { "id": "1", "x": 0, "y": 1 }, { "id": "2", "x": 2.5, "y": 0 }, { "id": "3", "x": 2.5, "y": 2 }, { "id": "4", "x": 5, "y": 1 } ],
  "activities": [
    { "from": "1", "to": "2", "label": "A 3" }, { "from": "1", "to": "3", "label": "B 5" },
    { "from": "2", "to": "3", "dummy": true },
    { "from": "2", "to": "4", "label": "C 4" }, { "from": "3", "to": "4", "label": "D 2" }
  ] }
```

結合点の `label` を省略すると `id` を表示する。

### gantt（ガントチャート）

```json
{ "type": "gantt", "unit": "日", "span": 12,
  "tasks": [
    { "label": "設計", "start": 0, "length": 4 },
    { "label": "製造", "start": 4, "length": 5 },
    { "label": "試験", "start": 7, "length": 5, "kind": "actual" }
  ],
  "marker": 8 }
```

`start` は0始まり。`kind` は `plan`（既定）／`actual`（実績。濃い色で描く）。`marker` は現在日の縦線（任意）。

### network（ネットワーク構成図）

`kind` は `internet`／`router`／`switch`／`fw`（ファイアウォール）／`server`／`pc`／`ap`（無線アクセスポイント）／`cloud`。`zones` は破線の枠（DMZ、社内LAN など）で、`x`, `y` は左上、`w`, `h` は幅と高さ。

```json
{ "type": "network",
  "nodes": [
    { "id": "net", "label": "インターネット", "kind": "internet", "x": 0, "y": 1 },
    { "id": "fw", "label": "FW", "kind": "fw", "x": 2.5, "y": 1 },
    { "id": "web", "label": "Webサーバ", "kind": "server", "x": 5, "y": 0 },
    { "id": "pc", "label": "PC", "kind": "pc", "x": 5, "y": 2 }
  ],
  "links": [ { "from": "net", "to": "fw" }, { "from": "fw", "to": "web" }, { "from": "fw", "to": "pc", "label": "LAN" } ],
  "zones": [ { "label": "DMZ", "x": 4, "y": -0.6, "w": 2, "h": 1.2 } ] }
```

### er（E-R図）

エンティティを箱（名前と属性）で、リレーションシップを線と多重度（`1` または `*`）で描く。属性の主キーは `"_社員番号_"` のように前後に `_` を付けると下線で描く。外部キーは `"{部門番号}"` のように波括弧で囲むと点線の下線で描く。

```json
{ "type": "er",
  "entities": [
    { "id": "dept", "name": "部門", "attrs": ["_部門番号_", "部門名"], "x": 0, "y": 0 },
    { "id": "emp", "name": "社員", "attrs": ["_社員番号_", "氏名", "{部門番号}"], "x": 4, "y": 0 }
  ],
  "relations": [ { "from": "dept", "to": "emp", "fromMul": "1", "toMul": "*" } ] }
```

### logic（論理回路）

`op` は `AND`／`OR`／`NOT`／`NAND`／`NOR`／`XOR`。`in` は入力の id（入力端子または他のゲート）を上から順に並べる。`outputs[].from` は出力に接続するゲートの id。左から右へ信号が流れるように、入力→ゲート→出力の順に `x` を大きくする。

```json
{ "type": "logic",
  "inputs": [ { "id": "A", "label": "A", "x": 0, "y": 0 }, { "id": "B", "label": "B", "x": 0, "y": 2 } ],
  "gates": [
    { "id": "g1", "op": "NAND", "x": 2.5, "y": 1, "in": ["A", "B"] },
    { "id": "g2", "op": "NOT", "x": 4.5, "y": 1, "in": ["g1"] }
  ],
  "outputs": [ { "id": "X", "label": "X", "x": 6.5, "y": 1, "from": "g2" } ] }
```

### 解説用の図種（layers／flow／venn／bar／seq）

主に解説テキストで使う。問題の `figure` でも使える。

- `layers`（階層図）：`levels[]` は上から順。`{label, note?, hl?}`（`hl` は強調、`note` は右の注記）。`arrow: ["上位", "下位"]` で左に縦矢印を付ける
- `flow`（流れ図）：`steps[]` は `{id, label, kind?, col?, row?, next?}`。`kind` は `process`（既定）／`decision`（ひし形）／`terminal`（角丸）。`col`・`row` は省略すると同じ列で並び順に下へ置く。`next: [{to, label?}]` を省略すると次の要素につなぐ（`terminal` は終端）。分岐は `col` を -1・1 にずらす
- `venn`（ベン図）：`sets[]`（1〜3個）は `{label, x, y, r}`（グリッド単位）。`shade: [0, 1]` は指定した集合の共通部分を塗る。`regions[]` は `{x, y, label}`
- `bar`（棒グラフ）：`bars[]` は `{label, value, kind?}`。`max`・`ticks`・`unit` は任意。`line: {values, max?, label?}` で右軸の折れ線（パレート図の累積比など）を重ねる。`values` は `bars` と同じ長さ
- `seq`（並びの図）：`rows[]` は `{title?, cells:[{text, kind?, note?}]}`。`kind` は `hl`（強調）／`dim`（薄く）／`empty`（破線の空き）。配列・スタック・キュー・パケットの構造などに使う

```json
{ "type": "layers", "arrow": ["上位", "下位"], "levels": [ { "label": "アプリケーション層", "note": "HTTP", "hl": true }, { "label": "トランスポート層", "note": "TCP" } ] }
```

## 解説テキスト（学ぶタブ）

`data/text/<章id>.json`（例：`t01-kiso.json`）。章を足したら `data/meta.json` の `textFiles[]` に `"text/t01-kiso.json"` の形で足す（一覧の並びが目次の並びになる）。Service Worker は `textFiles[]` を自動でキャッシュする。

```json
{ "schemaVersion": 1, "id": "t01", "subject": "A", "field": "technology", "category": "基礎理論",
  "title": "第1章 基礎理論", "summary": "この章で学ぶこと（2〜3文）",
  "sections": [
    { "id": "t01-01", "title": "1.1 2進数と基数変換", "points": ["要点1", "要点2"],
      "blocks": [ { "type": "p", "text": "本文" } ],
      "questionTags": ["基数変換"],
      "verification": { "status": "unverified", "methods": [], "verifiedAt": null } }
  ] }
```

- `id` は `t` + 2桁、節の `id` は `<章id>-<2桁連番>`。`category` は固定リストの名前。科目Bの章は `subject: "B"`
- `blocks[].type`：
  - `h`（小見出し）・`p`（段落）：`text`。`^{}` `_{}` 記法が使える。段落中の用語集の用語は、**その節で最初に出た1回だけ**自動でタップできるようになる（定義ポップアップ）
  - `list`（箇条書き）・`steps`（番号付きの手順、`title` 任意）：`items[]`
  - `figure`：`figure`（図データ）。`table`：`table`（`header`・`rows`）と任意の `title`
  - `code`：`lines[]`（擬似言語。問題と同じ表示）
  - `note`：`kind` は `point`（既定）／`pitfall`（取り違えに注意）／`tip`（コツ）、`text`、任意の `title`
  - `example`：`text`（問い）・`answer`（折りたたみで表示）・任意の `title`・`figure`
- `questionTags`：「この節の問題を解く」で優先する問題の `tags`。該当が3問未満なら章のカテゴリ全体から出す
- `verification` は問題と同じ。文章は独立解答の対象外なので、検証済みにするには `methods` に `quality-review`（別エージェントによる事実関係の検査）が要る
- 文章・図・例題はすべてオリジナル。HTMLは使わない（`tools/validate-core.js` の `checkText` が検査する）

## 用語集

`data/glossary.json`：

```json
{ "schemaVersion": 1, "terms": [
  { "id": "g-0001", "term": "稼働率", "reading": "かどうりつ", "category": "システム構成要素",
    "definition": "システムが正常に動作している時間の割合。MTBF÷(MTBF＋MTTR) で求める。",
    "aliases": [], "related": ["g-0002"] }
] }
```

- `id`：`g-` ＋4桁。一意・不変
- `reading`：ひらがな（五十音順の並べ替えと索引に使う）。英字略語は読み方をひらがなで（例：「エムティービーエフ」→「えむてぃーびーえふ」）
- `category`：問題と同じカテゴリ名
- `definition`：オリジナルの定義文。1〜3文、120字程度まで。辞書や教科書の文を写さない
- `aliases`：表記ゆれ・別名（解説中の用語を見つけるときにも使う）
- `related`：関連する用語の id
- `linkScope`（任意）：`"category"` なら同じカテゴリの問題だけ、`"field"` なら同じ分野の問題だけで解説にリンクする。「ロック」「ビュー」のように一般語としても使う用語に付ける
- 別名には、上位概念・下位概念・対比される用語・法律名を入れない（タップしたときに別の意味の定義が出てしまうため）
- 問題の `terms[]` は、解説にその用語（または別名）が出てくる用語集の id。`node tools/link-terms.mjs` で自動的に付ける。解説の中の該当語はタップで定義を表示できる

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

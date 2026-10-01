# 基本情報まなび帳

基本情報技術者試験（科目A・科目B）の学習に使う、自分専用のPWAです。ビルド不要のバニラJavaScript（ES Modules）＋HTML＋CSSだけで動き、外部ライブラリ・外部CDN・アクセス解析は使いません。

- 問題・解説・用語定義はすべてオリジナルで、IPAの過去問ではありません
- 学習記録は端末の localStorage にだけ保存し、外部には送信しません
- 基準：シラバス Ver.9.2／試験要綱 Ver.5.6（2026-10-01 確認）。正確な出題範囲・仕様は [IPAの公式情報](https://www.ipa.go.jp/shiken/syllabus/gaiyou.html) を参照してください

## 現在の状態

| フェーズ | 内容 | 状態 |
|---|---|---|
| 1 | 演習（一問一答）、誤りフラグ、回答記録、中断復帰、今日の復習、最小Service Worker、科目A 100問 | 完了 |
| 2 | 苦手分析、学習記録、設定、エクスポート／インポート、バックアップ推奨バナー、科目A 累計200問 | 完了 |
| 3 | 模擬試験、用語集（約300語）・暗記カード、図表、科目A 累計360問 | 完了 |
| 4 | 科目B（擬似言語の表示、set 形式、トレース表、模擬試験）、擬似言語インタプリタによる実行検証、科目B 120問 | 完了 |
| 5 | ヘルプ、ドキュメント仕上げ、全問の最終検証 | 未着手 |

## 公開（GitHub Pages）

1. GitHub のリポジトリ → Settings → Pages
2. Source を「Deploy from a branch」、Branch を `main`／`/(root)` にして保存
3. `https://<ユーザー名>.github.io/fe-manabi/` で開く

パスはすべて相対パスなので、リポジトリ名が変わっても動きます。

## ホーム画面への追加（iPhone）

1. Safari で上のURLを開く
2. 共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから起動する

Safari のタブで開いた場合とホーム画面から起動した場合では、保存データが別になります。ブラウザのタブは一定期間使わないとデータが消えることがあるため、ホーム画面からの利用を勧めます。

## 更新の手順

1. 問題を追加・修正する（`data/questions/**`。ファイルを足したら `data/meta.json` の `files[]` にも足す）。用語集を変えたら `node tools/link-terms.mjs` で `terms[]` を付け直す
2. 検証する

   ```bash
   node tools/validate.mjs
   ```

   ```bash
   node tools/verify/run.mjs
   ```

3. `data/meta.json` の `dataVersion` と `counts` を更新する
4. `sw.js` の `VERSION` を `dataVersion` と同じ値にする（アプリのコードだけを変えたときも両方を上げる）。JSファイルを足したら `sw.js` の `APP_SHELL` にも足す
5. commit して push する
6. 端末でアプリを開き、「更新があります（タップで再読み込み）」のバナーをタップする

バナーは演習の出題中には出ません。出題を終えるか中断すると表示されます。

## 開発

```bash
python tools/serve.py
```

`http://localhost:8765/` で開きます。localhost では Service Worker を登録しません（キャッシュが開発の邪魔になるため）。Service Worker を試すときは `http://localhost:8765/?sw=1` で開きます。

| パス | 内容 |
|---|---|
| `index.html`、`css/`、`js/` | アプリ本体 |
| `data/` | `meta.json` と問題データ |
| `sw.js`、`manifest.json`、`icons/` | PWA |
| `tools/validate.html`、`tools/validate.mjs` | データ検証（開発用。アプリからはリンクせず、キャッシュもしない） |
| `tools/verify/` | 実行検証スクリプト、独立解答の照合 |
| `tools/pseudo/` | 擬似言語インタプリタ（科目Bのコードを実行して正解を確かめる）と動作テスト |
| `tools/link-terms.mjs` | 問題の解説に出てくる用語を用語集と結び付ける（`terms[]` を自動で付ける） |
| `tools/figures.html` | すべての図の表示確認（開発用） |
| `tools/serve.py` | キャッシュを無効にした開発用サーバ |
| `tools/make-icons.mjs` | 仮アイコンの生成 |

関連文書：[CONTENT.md](CONTENT.md)（問題の書き方）、[VERIFICATION.md](VERIFICATION.md)（検証ログ）、[TESTING.md](TESTING.md)（実機確認チェックリスト）

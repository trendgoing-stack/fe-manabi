// 用語の音声ファイル（試作）を、Gemini の音声合成（無料枠）で作る。
// 使い方：node tools/gen-audio-gemini.mjs g-0001 g-0038 ...   （用語の id を並べる）
// API キーは環境変数 GEMINI_API_KEY か、プロジェクト直下の .env.local（Git に入らない）から読む。キーは画面にもファイルにも出さない。
// 注意：読み上げる文章（用語の定義）を、作成時だけ Google へ送る。アプリの動作中に通信はしない。
// 無料枠では送った内容が Google の製品改善に使われる（このアプリの用語・解説は自作の学習用テキストで、個人情報は含まない）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReadings, termFullText } from '../js/speech-text.js';

const MODEL = process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';
const VOICES = (process.env.GEMINI_VOICES ?? 'Charon,Sadaltager').split(',').map((v) => v.trim());
const STYLE = '次の文章を、落ち着いた口調で、はっきりと一定の速さで読み上げてください。';
const OUT = new URL('../audio/pilot-gemini/', import.meta.url);
const SAMPLE_RATE = 24000;

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const file = new URL('../.env.local', import.meta.url);
  if (!existsSync(file)) return '';
  const m = /^GEMINI_API_KEY=(.*)$/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

const key = loadKey();
if (!key) {
  console.error('API キーがありません。.env.local の GEMINI_API_KEY= の右にキーを貼り付けて保存してください。');
  process.exit(1);
}
const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('用語の id を指定してください（例：g-0001 g-0038）');
  process.exit(1);
}

/** 16bit モノラルの PCM に WAV のヘッダーを付ける */
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // モノラル
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(text, voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: `${STYLE}\n\n${text}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (part) return Buffer.from(part.inlineData.data, 'base64');
      if (attempt >= 3) throw new Error(`音声が返りませんでした：${JSON.stringify(json).slice(0, 300)}`);
    } else {
      const msg = (await res.text()).slice(0, 400);
      // 無料枠の上限（429）や一時的な混雑（5xx）は待ってやり直す。それ以外は止める
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= 4) throw new Error(`HTTP ${res.status}：${msg}`);
      console.error(`  HTTP ${res.status}。${attempt * 20}秒待ってやり直します…`);
      await new Promise((r) => setTimeout(r, attempt * 20000));
      continue;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

const glossary = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8')).terms;
const readings = buildReadings(glossary);
mkdirSync(OUT, { recursive: true });
const items = [];
for (const id of ids) {
  const t = glossary.find((g) => g.id === id);
  if (!t) throw new Error(`用語 ${id} が見つかりません`);
  const text = termFullText(t, readings);
  const clips = [];
  for (const voice of VOICES) {
    const file = `${id}-${voice.toLowerCase()}.wav`;
    const path = fileURLToPath(new URL(file, OUT));
    if (!(existsSync(path) && statSync(path).size > 44)) {
      writeFileSync(path, wav(await synth(text, voice))); // 作成済みは飛ばす（途中から再開できる）
      console.log(`作成：${file}`);
      await new Promise((r) => setTimeout(r, 3000)); // 無料枠の毎分の上限に当たりにくくする
    }
    clips.push({ voice, file });
  }
  items.push({ id, term: t.term, text, clips });
}

// 聞き比べ用の簡単なページ（アプリ本体とは無関係の確認用）
const page = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>音声の聞き比べ（試作）</title>
<style>body{font-family:sans-serif;margin:16px;line-height:1.6;color:#222;background:#fff}h2{font-size:1.05rem;margin:22px 0 4px}p.t{font-size:.85rem;color:#555;margin:0 0 6px}audio{display:block;width:100%;margin:4px 0 10px}small{color:#555}</style></head><body>
<h1 style="font-size:1.2rem">音声の聞き比べ（Gemini・試作）</h1>
<p><small>モデル：${MODEL}</small></p>
${items
  .map(
    (it) =>
      `<h2>${it.term}</h2><p class="t">${it.text.replace(/</g, '&lt;')}</p>` +
      it.clips.map((c) => `<small>${c.voice}</small><audio controls preload="none" src="${c.file}"></audio>`).join(''),
  )
  .join('\n')}
</body></html>
`;
writeFileSync(new URL('index.html', OUT), page);
console.log(`完了：${items.length}語。audio/pilot-gemini/index.html で聞き比べられます。`);

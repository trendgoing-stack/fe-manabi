// 用語の音声ファイル（試作）を作る。Edge の高品質音声（edge-tts）で mp3 にする。
// 使い方：node tools/gen-audio.mjs g-0001 g-0038 ...   （用語の id を並べる）
// 事前に：python -m pip install --user edge-tts
// 注意：読み上げる文章（用語の定義）を、作成時だけ Microsoft の音声合成サービスへ送る。アプリの動作中に通信はしない。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildReadings, termFullText } from '../js/speech-text.js';

const VOICES = [
  { id: 'nanami', voice: 'ja-JP-NanamiNeural', label: 'Nanami（女性）' },
  { id: 'keita', voice: 'ja-JP-KeitaNeural', label: 'Keita（男性）' },
];
const OUT = new URL('../audio/pilot/', import.meta.url);
const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('用語の id を指定してください（例：g-0001 g-0038）');
  process.exit(1);
}

const glossary = JSON.parse(readFileSync(new URL('../data/glossary.json', import.meta.url), 'utf8')).terms;
const readings = buildReadings(glossary);
mkdirSync(OUT, { recursive: true });
const index = {};
for (const id of ids) {
  const t = glossary.find((g) => g.id === id);
  if (!t) throw new Error(`用語 ${id} が見つかりません`);
  const text = termFullText(t, readings);
  // 日本語を引数で渡すと Windows で文字化けするため、UTF-8 のファイル経由で渡す
  const textFile = join(tmpdir(), `festudy-audio-${id}.txt`);
  writeFileSync(textFile, text, 'utf8');
  index[id] = { term: t.term, clips: [] };
  for (const v of VOICES) {
    const file = `${id}-${v.id}.mp3`;
    index[id].clips.push({ voice: v.id, label: v.label, file });
    if (existsSync(fileURLToPath(new URL(file, OUT))) && statSync(fileURLToPath(new URL(file, OUT))).size > 0) continue; // 作成済みは飛ばす（途中から再開できる）
    // ネットワークが一時的に切れることがあるので、数回やり直す
    for (let attempt = 1; ; attempt++) {
      try {
        execFileSync('python', ['-m', 'edge_tts', '--voice', v.voice, '--file', textFile, '--write-media', fileURLToPath(new URL(file, OUT))], { stdio: 'ignore' });
        break;
      } catch (e) {
        if (attempt >= 8) throw e;
      }
    }
  }
  rmSync(textFile);
  console.log(`${id} ${t.term}：${text}`);
}
writeFileSync(new URL('index.json', OUT), JSON.stringify(index, null, 2) + '\n');

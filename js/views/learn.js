// 学ぶタブ：解説テキスト（章の目次 → 章の節一覧 → 節）。用語集・暗記カードは glossary.js / cards.js
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app, availableQuestions, startSession } from '../state.js';
import { FIELDS } from '../categories.js';
import { richText } from '../render/text.js';
import { renderSectionBody } from '../render/lesson.js';
import { filterQuestions, shuffled, groupSets, takeWhole, DEFAULT_CRITERIA } from '../selector.js';
import { today } from '../date.js';
import { toast } from '../ui/toast.js';
import { learnNav } from './glossary.js';

const PRACTICE_COUNT = 10;

const chapterOf = (id) => app.data.texts.find((c) => c.id === id);
const readMark = (done, total) =>
  h('span', { class: 'read-mark' + (done === total && total ? ' is-done' : '') }, done === total && total ? '読了' : `${done}/${total}`);

/** 章の節 id → 「次に読む節」を章をまたいで探すための一列の並び */
const flatSections = () => app.data.texts.flatMap((c) => c.sections.map((s) => ({ chapter: c, section: s })));

/** 節に対応する問題。questionTags に当たる問題を優先し、足りなければ章のカテゴリ全体で補う */
export function practiceQuestions(chapter, section) {
  const criteria = { ...DEFAULT_CRITERIA, subject: chapter.subject, categories: [chapter.category] };
  const pool = filterQuestions(availableQuestions(), criteria, storage.getStats(), today());
  const tags = new Set(section?.questionTags ?? []);
  const tagged = tags.size ? pool.filter((q) => q.tags?.some((t) => tags.has(t))) : [];
  return tagged.length >= 3 ? tagged : pool;
}

function practiceButton(chapter, section) {
  const qs = practiceQuestions(chapter, section);
  return h(
    'button',
    {
      type: 'button',
      class: 'btn big',
      disabled: !qs.length,
      onClick: () => startSession('drill', section ? section.title : chapter.title, takeWhole(groupSets(shuffled(qs)), PRACTICE_COUNT)),
    },
    qs.length ? `この${section ? '節' : '章'}の問題を解く（${Math.min(PRACTICE_COUNT, qs.length)}問）` : '対応する問題がありません',
  );
}

export function learnView(root, [chapterId, sectionId]) {
  const chapter = chapterId ? chapterOf(chapterId) : null;
  if (!chapter) return indexView(root);
  const section = sectionId ? chapter.sections.find((s) => s.id === sectionId) : null;
  return section ? sectionView(root, chapter, section) : chapterView(root, chapter);
}

function indexView(root) {
  const read = storage.getRead();
  root.append(h('h1', null, '学ぶ'), learnNav('learn'));
  if (!app.data.texts.length) {
    root.append(h('p', { class: 'muted' }, '解説テキストは準備中です。用語集と暗記カードは上のタブから使えます。'));
    return;
  }
  const all = app.data.texts.flatMap((c) => c.sections);
  root.append(h('p', { class: 'muted small' }, `読了 ${all.filter((s) => read[s.id]).length}/${all.length}節。章を選んでください。`));
  for (const f of FIELDS) {
    const chapters = app.data.texts.filter((c) => c.field === f.id && c.subject === 'A');
    if (chapters.length) root.append(h('h2', { class: `field-heading field-${f.id}` }, f.label), chapterList(chapters, read));
  }
  const b = app.data.texts.filter((c) => c.subject === 'B');
  if (b.length) root.append(h('h2', { class: 'field-heading' }, '科目B'), chapterList(b, read));
}

function chapterList(chapters, read) {
  return h(
    'section',
    { class: 'card' },
    h(
      'ul',
      { class: 'lesson-chapters' },
      chapters.map((c) =>
        h(
          'li',
          null,
          h(
            'a',
            { href: `#/learn/${encodeURIComponent(c.id)}` },
            h('span', { class: 'grow' }, h('span', { class: 'term-name' }, c.title), h('br'), h('span', { class: 'muted small' }, `${c.sections.length}節`)),
            readMark(c.sections.filter((s) => read[s.id]).length, c.sections.length),
          ),
        ),
      ),
    ),
  );
}

function chapterView(root, chapter) {
  const read = storage.getRead();
  root.append(
    h('header', { class: 'run-head' }, h('a', { class: 'btn small', href: '#/learn' }, '目次'), h('span', { class: 'run-progress' }, chapter.category), h('span')),
    h('h1', null, richText(chapter.title)),
    h('p', null, richText(chapter.summary)),
    h(
      'section',
      { class: 'card' },
      h(
        'ul',
        { class: 'lesson-chapters' },
        chapter.sections.map((s) =>
          h(
            'li',
            null,
            h('a', { href: `#/learn/${encodeURIComponent(chapter.id)}/${encodeURIComponent(s.id)}` }, h('span', { class: 'grow' }, richText(s.title)), h('span', { class: 'read-mark' + (read[s.id] ? ' is-done' : '') }, read[s.id] ? '読了' : '未読')),
          ),
        ),
      ),
    ),
    h('div', { class: 'btn-col' }, practiceButton(chapter, null)),
  );
}

function sectionView(root, chapter, section) {
  const flat = flatSections();
  const i = flat.findIndex((x) => x.section.id === section.id);
  const link = (x, label) =>
    x ? h('a', { class: 'btn', href: `#/learn/${encodeURIComponent(x.chapter.id)}/${encodeURIComponent(x.section.id)}` }, label) : h('span');
  const mark = h('button', { type: 'button', class: 'btn big' });
  const drawMark = () => {
    const done = !!storage.getRead()[section.id];
    mark.className = 'btn big' + (done ? '' : ' primary');
    mark.textContent = done ? '読了を取り消す' : '読んだ';
    mark.onclick = () => {
      if (storage.setRead(section.id, !done) && !done) toast('読了にしました');
      drawMark();
    };
  };
  drawMark();

  // 要約／詳細の切り替え（選択は端末に保存する）
  let summary = storage.getMeta().learnMode === 'summary';
  const body = h('div');
  const hint = h('p', { class: 'muted small' });
  const modeBar = h('div', { class: 'chips subnav', role: 'group', 'aria-label': '表示の詳しさ' });
  const drawBody = () => {
    fill(body, renderSectionBody(section, summary));
    hint.textContent = summary
      ? '要約表示：要点・図・表・注意点だけを表示しています。説明や例題は「詳細」で読めます。'
      : '下線の用語をタップすると定義を表示します。';
    const chip = (label, on, value) =>
      h('button', { type: 'button', class: 'chip' + (on ? ' is-on' : ''), 'aria-pressed': String(on), onClick: () => { summary = value; storage.saveMeta({ learnMode: value ? 'summary' : 'detail' }); drawBody(); } }, label);
    fill(modeBar, chip('要約', summary, true), chip('詳細', !summary, false));
  };
  drawBody();

  root.append(
    h('header', { class: 'run-head' }, h('a', { class: 'btn small', href: `#/learn/${encodeURIComponent(chapter.id)}` }, '章'), h('span', { class: 'run-progress' }, chapter.category), h('span')),
    h('h1', null, richText(section.title)),
    modeBar,
    section.points?.length ? h('ul', { class: 'lesson-points' }, section.points.map((p) => h('li', null, richText(p)))) : null,
    body,
    hint,
    h('div', { class: 'btn-col' }, mark, practiceButton(chapter, section)),
    h('div', { class: 'lesson-nav' }, link(flat[i - 1], '← 前の節'), link(flat[i + 1], '次の節 →')),
  );
}

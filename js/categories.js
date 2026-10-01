// 分野・カテゴリの固定リスト（シラバス Ver.9.2 の中分類に対応）

/** @type {{id: import('./types.js').Field, label: string, short: string}[]} */
export const FIELDS = [
  { id: 'technology', label: 'テクノロジ系', short: 'テクノロジ' },
  { id: 'management', label: 'マネジメント系', short: 'マネジメント' },
  { id: 'strategy', label: 'ストラテジ系', short: 'ストラテジ' },
];

/** @type {{name: string, field: import('./types.js').Field, syllabusRefs: string[]}[]} */
export const CATEGORIES = [
  { name: '基礎理論', field: 'technology', syllabusRefs: ['基礎理論'] },
  { name: 'アルゴリズムとプログラミング', field: 'technology', syllabusRefs: ['アルゴリズムとプログラミング'] },
  { name: 'コンピュータ構成要素', field: 'technology', syllabusRefs: ['コンピュータ構成要素', 'ハードウェア'] },
  { name: 'システム構成要素', field: 'technology', syllabusRefs: ['システム構成要素'] },
  { name: 'ソフトウェア', field: 'technology', syllabusRefs: ['ソフトウェア'] },
  { name: 'UIと情報メディア', field: 'technology', syllabusRefs: ['ユーザーインタフェース', '情報メディア'] },
  { name: 'データベース', field: 'technology', syllabusRefs: ['データベース'] },
  { name: 'ネットワーク', field: 'technology', syllabusRefs: ['ネットワーク'] },
  { name: 'セキュリティ', field: 'technology', syllabusRefs: ['セキュリティ'] },
  { name: 'システム開発技術', field: 'technology', syllabusRefs: ['システム開発技術'] },
  { name: '開発管理', field: 'technology', syllabusRefs: ['ソフトウェア開発管理技術'] },
  { name: 'プロジェクトマネジメント', field: 'management', syllabusRefs: ['プロジェクトマネジメント'] },
  { name: 'サービスマネジメント', field: 'management', syllabusRefs: ['サービスマネジメント'] },
  { name: 'システム監査', field: 'management', syllabusRefs: ['システム監査'] },
  { name: 'システム戦略', field: 'strategy', syllabusRefs: ['システム戦略', 'システム企画'] },
  { name: '経営戦略', field: 'strategy', syllabusRefs: ['経営戦略マネジメント', '技術戦略マネジメント', 'ビジネスインダストリ'] },
  { name: '企業と法務', field: 'strategy', syllabusRefs: ['企業活動', '法務'] },
];

/** 科目Bの集計用カテゴリ（科目Aの同名カテゴリと分けて集計する） */
export const B_CATEGORIES = ['アルゴリズムとプログラミング', 'セキュリティ'];
export const B_PREFIX = '科目B ';

/** 成績集計のキー。科目Bの問題は「科目B アルゴリズムとプログラミング」のように分ける */
export const statKey = (id, category) => (String(id).startsWith('b-') ? B_PREFIX + category : category);

export const fieldLabel = (id) => FIELDS.find((f) => f.id === id)?.label ?? id;
export const categoriesOf = (field) => CATEGORIES.filter((c) => c.field === field);

export const FLAG_KINDS = [
  { id: 'wrong-answer', label: '正解が違う' },
  { id: 'unclear', label: '問題文が不明瞭' },
  { id: 'typo', label: '誤字' },
  { id: 'other', label: 'その他' },
];

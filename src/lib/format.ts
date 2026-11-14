import { KP_KIND_NAMES, MONDAI_BY_ID, ROLE_NAMES, sessionLabel, type KpKind, type KpRole, type MondaiType } from './domain';
import { PATTERN_NAMES, type Pattern } from './analysis';

export { sessionLabel };

export const KIND_NAMES: Record<string, string> = { ...KP_KIND_NAMES, text_function: '文章语法功能' };

export function kindName(kind: string): string {
  return KIND_NAMES[kind as KpKind] ?? kind;
}

export function roleName(role: string): string {
  return ROLE_NAMES[role as KpRole] ?? role;
}

export function patternName(p: string | null | undefined): string {
  return p ? (PATTERN_NAMES[p as Pattern] ?? p) : '-';
}

export function mondaiName(t: string): string {
  return MONDAI_BY_ID[t as MondaiType]?.nameZh ?? t;
}

export function mondaiNameJa(t: string): string {
  return MONDAI_BY_ID[t as MondaiType]?.nameJa ?? t;
}

/** 间隔（场）→ 年 */
export function gapYears(g: number | null | undefined, digits = 1): string {
  if (g === null || g === undefined || Number.isNaN(g)) return '-';
  return `${(g / 2).toFixed(digits).replace(/\.0$/, '')} 年`;
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return v.toFixed(digits).replace(/\.0$/, '');
}

export function compact(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('zh-CN');
}

export const GROUP_NAMES: Record<string, string> = {
  grammar: '语法・句型',
  vocab: '词汇',
  kanji: '汉字',
  word_formation: '构词（词缀）',
  reading_skill: '阅读信息提取方式',
  listening_skill: '听力信息提取方式',
  listening_scene: '听力场景',
  utterance_function: '即时应答话语功能',
  reading_feature: '汉字读音考点',
  text_function: '文章语法功能',
};

export const SOURCE_NAMES: Record<string, string> = {
  jlptpracticetest: 'JLPT Practice Test',
  mojitest: 'MOJiTest',
};

export function kpHref(id: string): string {
  return `/kp/${encodeURIComponent(id)}`;
}

/** 下次考试日期：12 月第一个周日 / 7 月第一个周日 */
export function examDate(sessionId: string): string {
  const [y, m] = sessionId.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  return `${y}年${m}月${d.getUTCDate()}日`;
}

// 语法考点词典的加载与匹配。
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export interface GrammarEntry {
  id: string;
  label: string;
  level: string;
  category: string; // 类别代码
  categoryName: string;
  zh: string;
  basic: boolean;
  regex: RegExp;
}

export interface GrammarDict {
  entries: GrammarEntry[];
  byId: Map<string, GrammarEntry>;
  categories: Record<string, string>;
}

interface RawItem {
  id: string;
  lb?: string;
  l: string;
  c: string;
  zh: string;
  re: string;
  b?: boolean;
}

const NO_TILDE_CATS = new Set(['conj', 'demo', 'adv', 'keigo']);

export function loadGrammarDict(path: string): GrammarDict {
  const doc = parse(readFileSync(path, 'utf8')) as { categories: Record<string, string>; items: RawItem[] };
  const entries: GrammarEntry[] = [];
  const byId = new Map<string, GrammarEntry>();
  for (const it of doc.items) {
    if (byId.has(it.id)) throw new Error(`grammar.yaml 中 id 重复: ${it.id}`);
    if (!doc.categories[it.c]) throw new Error(`未知类别 ${it.c} (${it.id})`);
    let regex: RegExp;
    try {
      regex = new RegExp(it.re, 'gu');
    } catch (e) {
      throw new Error(`正则无效 ${it.id}: ${(e as Error).message}`);
    }
    const label = it.lb ?? (NO_TILDE_CATS.has(it.c) ? it.id : `〜${it.id}`);
    const entry: GrammarEntry = {
      id: it.id,
      label,
      level: String(it.l),
      category: it.c,
      categoryName: doc.categories[it.c],
      zh: it.zh,
      basic: Boolean(it.b),
      regex,
    };
    entries.push(entry);
    byId.set(it.id, entry);
  }
  return { entries, byId, categories: doc.categories };
}

/** 统一形式：去空白、统一波浪线、去掉选项中的括号说明与标点干扰。 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[～~]/g, '〜')
    .replace(/[｡]/g, '。')
    .replace(/[()（）]/g, '');
}

export interface GrammarHit {
  id: string;
  start: number;
  end: number;
}

/**
 * 在文本中查找语法考点。重叠时优先保留更长的匹配（同长度按词典顺序）。
 * includeBasic=false 时跳过 b:true 的基础句型（用于台词、★题片段等长文本）。
 */
export function matchGrammar(dict: GrammarDict, text: string, includeBasic = true): GrammarHit[] {
  const s = normalizeForMatch(text);
  if (!s) return [];
  const cands: (GrammarHit & { order: number })[] = [];
  dict.entries.forEach((e, order) => {
    if (!includeBasic && e.basic) return;
    e.regex.lastIndex = 0;
    for (let m = e.regex.exec(s); m; m = e.regex.exec(s)) {
      if (m[0].length === 0) {
        e.regex.lastIndex++;
        continue;
      }
      cands.push({ id: e.id, start: m.index, end: m.index + m[0].length, order });
    }
  });
  cands.sort((a, b) => b.end - b.start - (a.end - a.start) || a.order - b.order);
  const chosen: GrammarHit[] = [];
  for (const c of cands) {
    if (chosen.some((h) => h.id === c.id)) continue;
    if (chosen.some((h) => c.start < h.end && h.start < c.end)) continue;
    chosen.push({ id: c.id, start: c.start, end: c.end });
  }
  return chosen.sort((a, b) => a.start - b.start);
}

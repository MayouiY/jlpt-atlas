// 考点出现规律分析与预测（纯函数，建库脚本与测试共用）。
// 时间轴以“已举行的场次序号”为单位（每年两场，间隔 2 场 ≈ 1 年）。

export type Pattern = 'never' | 'single' | 'rare' | 'regular' | 'irregular';

export const PATTERN_NAMES: Record<Pattern, string> = {
  never: '从未考查',
  single: '仅考过一次',
  rare: '考过两次',
  regular: '规律复现',
  irregular: '不规律复现',
};

export interface GapStats {
  tested: number; // 总考查次数（同一场多次计多次）
  sessions: number; // 出现过的场次数
  first: number | null; // 首次出现的场次下标
  last: number | null; // 最近出现的场次下标
  appearances: number[]; // 出现场次下标列表
  gaps: number[]; // 相邻两次出现的间隔（场）
  meanGap: number | null;
  medianGap: number | null;
  minGap: number | null;
  maxGap: number | null;
  gapCv: number | null; // 间隔变异系数（标准差/均值），越小越规律
  sinceLast: number | null; // 距离最近一次出现已经过了几场（0 = 上一场刚考）
  pattern: Pattern;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function std(xs: number[]): number | null {
  const m = mean(xs);
  if (m === null) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** hits[i] = 第 i 场考查次数；total = 观察的场次数（默认 hits.length） */
export function gapStats(hits: number[], total = hits.length): GapStats {
  const appearances: number[] = [];
  let tested = 0;
  for (let i = 0; i < total; i++) {
    const h = hits[i] ?? 0;
    if (h > 0) appearances.push(i);
    tested += h;
  }
  const gaps = appearances.slice(1).map((v, i) => v - appearances[i]);
  const meanGap = mean(gaps);
  const sd = std(gaps);
  const gapCv = meanGap && sd !== null ? sd / meanGap : null;
  const last = appearances.length ? appearances[appearances.length - 1] : null;
  let pattern: Pattern;
  if (appearances.length === 0) pattern = 'never';
  else if (appearances.length === 1) pattern = 'single';
  else if (appearances.length === 2) pattern = 'rare';
  else pattern = gapCv !== null && gapCv <= 0.5 ? 'regular' : 'irregular';
  return {
    tested,
    sessions: appearances.length,
    first: appearances.length ? appearances[0] : null,
    last,
    appearances,
    gaps,
    meanGap,
    medianGap: median(gaps),
    minGap: gaps.length ? Math.min(...gaps) : null,
    maxGap: gaps.length ? Math.max(...gaps) : null,
    gapCv,
    sinceLast: last === null ? null : total - 1 - last,
    pattern,
  };
}

// ───────────── 预测 ─────────────

export const FEATURE_NAMES = ['平滑出现率', '近期加权出现率', '到期程度', '上一场已考', '历史出现次数(log)', '从未出现'] as const;

export interface FeatureOptions {
  alpha: number; // 贝叶斯平滑强度
  lambda: number; // 近期衰减系数
}

export const DEFAULT_FEATURE_OPTIONS: FeatureOptions = { alpha: 4, lambda: 0.8 };

/**
 * 以前 t 场（下标 0..t-1）的历史预测第 t 场。
 * baseRate：同类考点的平均出现率，用于平滑。
 */
export function featuresAt(hits: number[], t: number, baseRate: number, opt = DEFAULT_FEATURE_OPTIONS): number[] {
  let seen = 0;
  let wSum = 0;
  let wHit = 0;
  let last = -1;
  const app: number[] = [];
  for (let i = 0; i < t; i++) {
    const h = (hits[i] ?? 0) > 0 ? 1 : 0;
    const w = opt.lambda ** (t - 1 - i);
    wSum += w;
    wHit += w * h;
    if (h) {
      seen++;
      last = i;
      app.push(i);
    }
  }
  const smoothed = (seen + opt.alpha * baseRate) / (t + opt.alpha);
  const recency = wSum ? wHit / wSum : 0;
  let due = 0;
  if (app.length >= 2) {
    const g = (app[app.length - 1] - app[0]) / (app.length - 1);
    due = Math.min(3, (t - last) / Math.max(1, g));
  } else if (app.length === 1) due = Math.min(3, (t - last) / Math.max(4, t / 2));
  const lastHit = last === t - 1 ? 1 : 0;
  return [smoothed, recency, due, lastHit, Math.log1p(seen), seen === 0 ? 1 : 0];
}

export interface LogisticModel {
  w: number[];
  b: number;
  mu: number[];
  sigma: number[];
}

/** 带 L2 正则的逻辑回归（批量梯度下降，特征先标准化）。 */
export function trainLogistic(X: number[][], y: number[], iterations = 400, lr = 0.5, l2 = 1e-3): LogisticModel {
  const d = X[0]?.length ?? 0;
  const mu = Array<number>(d).fill(0);
  const sigma = Array<number>(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) mu[j] += x[j] / X.length;
  for (const x of X) for (let j = 0; j < d; j++) sigma[j] += (x[j] - mu[j]) ** 2 / X.length;
  for (let j = 0; j < d; j++) sigma[j] = Math.sqrt(sigma[j]) || 1;
  const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sigma[j]));
  const w = Array<number>(d).fill(0);
  const pos = y.reduce((a, b) => a + b, 0);
  let b = Math.log((pos + 1) / (y.length - pos + 1));
  for (let it = 0; it < iterations; it++) {
    const gw = Array<number>(d).fill(0);
    let gb = 0;
    for (let i = 0; i < Z.length; i++) {
      let s = b;
      for (let j = 0; j < d; j++) s += w[j] * Z[i][j];
      const p = 1 / (1 + Math.exp(-s));
      const e = p - y[i];
      gb += e;
      for (let j = 0; j < d; j++) gw[j] += e * Z[i][j];
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / Z.length + l2 * w[j]);
    b -= (lr * gb) / Z.length;
  }
  return { w, b, mu, sigma };
}

export function predictProba(m: LogisticModel, x: number[]): number {
  let s = m.b;
  for (let j = 0; j < x.length; j++) s += m.w[j] * ((x[j] - m.mu[j]) / m.sigma[j]);
  return 1 / (1 + Math.exp(-s));
}

export interface SeriesItem {
  id: string;
  hits: number[];
  /** 该考点最早可被视为“已知”的场次下标（如词汇在首次出现后才进入候选集）；语法词典条目为 0 */
  knownFrom: number;
}

export function baseRateAt(items: SeriesItem[], t: number): number {
  let num = 0;
  let den = 0;
  for (const it of items) {
    if (it.knownFrom > t - 1) continue;
    for (let i = 0; i < t; i++) {
      num += (it.hits[i] ?? 0) > 0 ? 1 : 0;
      den++;
    }
  }
  return den ? num / den : 0;
}

/** 用前 t 场数据训练模型（样本：每个候选考点在 minT..t-1 每一场的出现与否）。 */
export function fitModelBefore(items: SeriesItem[], t: number, minT = 6): LogisticModel | null {
  const X: number[][] = [];
  const y: number[] = [];
  for (let s = minT; s < t; s++) {
    const base = baseRateAt(items, s);
    for (const it of items) {
      if (it.knownFrom > s - 1) continue; // 在第 s 场之前尚未出现过的词汇不在候选集中
      X.push(featuresAt(it.hits, s, base));
      y.push((it.hits[s] ?? 0) > 0 ? 1 : 0);
    }
  }
  if (X.length < 50 || y.every((v) => v === y[0])) return null;
  return trainLogistic(X, y);
}

export interface Scored {
  id: string;
  score: number;
  features: number[];
}

export function scoreAt(items: SeriesItem[], t: number, model: LogisticModel | null): Scored[] {
  const base = baseRateAt(items, t);
  const out: Scored[] = [];
  for (const it of items) {
    if (it.knownFrom > t - 1) continue;
    const f = featuresAt(it.hits, t, base);
    out.push({ id: it.id, features: f, score: model ? predictProba(model, f) : f[0] });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export interface BacktestRow {
  t: number;
  k: number;
  hits: number;
  actual: number; // 该场实际考查且在候选集中的考点数
  candidates: number;
  precision: number;
  recall: number;
  basePrecision: number; // 仅按历史出现次数排序的基线
  baseRecall: number;
  randomPrecision: number; // 随机抽取的期望命中率
}

/** 滚动回测：对每个目标场次只用其之前的数据训练、打分，评估 Top-K 命中情况。 */
export function backtest(items: SeriesItem[], targets: number[], ks: number[], minT = 6): BacktestRow[] {
  const rows: BacktestRow[] = [];
  for (const t of targets) {
    const model = fitModelBefore(items, t, minT);
    const ranked = scoreAt(items, t, model);
    const baseline = [...ranked].sort((a, b) => b.features[4] - a.features[4] || b.features[1] - a.features[1] || a.id.localeCompare(b.id));
    const hitsAt = new Map(items.map((it) => [it.id, (it.hits[t] ?? 0) > 0]));
    const actual = ranked.filter((r) => hitsAt.get(r.id)).length;
    for (const k of ks) {
      const top = ranked.slice(0, k).filter((r) => hitsAt.get(r.id)).length;
      const btop = baseline.slice(0, k).filter((r) => hitsAt.get(r.id)).length;
      rows.push({
        t,
        k,
        hits: top,
        actual,
        candidates: ranked.length,
        precision: top / k,
        recall: actual ? top / actual : 0,
        basePrecision: btop / k,
        baseRecall: actual ? btop / actual : 0,
        randomPrecision: ranked.length ? actual / ranked.length : 0,
      });
    }
  }
  return rows;
}

/** 题型类考点（每场都会出现）：预测下一场的题数，用近期加权平均。 */
export function expectedCount(counts: number[], t: number, lambda = 0.7): number {
  let wSum = 0;
  let wc = 0;
  for (let i = 0; i < t; i++) {
    const w = lambda ** (t - 1 - i);
    wSum += w;
    wc += w * (counts[i] ?? 0);
  }
  return wSum ? wc / wSum : 0;
}

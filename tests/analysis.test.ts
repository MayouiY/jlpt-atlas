import { describe, expect, it } from 'vitest';
import { backtest, expectedCount, featuresAt, fitModelBefore, gapStats, median, predictProba, scoreAt, trainLogistic, type SeriesItem } from '../src/lib/analysis';

describe('gapStats', () => {
  it('计算出现场次、间隔与规律', () => {
    // 第 0、4、8、12 场出现：每 4 场（约 2 年）一次
    const hits = Array(16).fill(0);
    [0, 4, 8, 12].forEach((i) => (hits[i] = 1));
    const g = gapStats(hits);
    expect(g.sessions).toBe(4);
    expect(g.gaps).toEqual([4, 4, 4]);
    expect(g.meanGap).toBe(4);
    expect(g.gapCv).toBe(0);
    expect(g.pattern).toBe('regular');
    expect(g.sinceLast).toBe(3);
  });

  it('区分从未出现、仅一次、两次与不规律', () => {
    expect(gapStats([0, 0, 0]).pattern).toBe('never');
    expect(gapStats([0, 1, 0]).pattern).toBe('single');
    expect(gapStats([1, 0, 1]).pattern).toBe('rare');
    const irregular = Array(20).fill(0);
    [0, 1, 15, 16].forEach((i) => (irregular[i] = 1));
    expect(gapStats(irregular).pattern).toBe('irregular');
  });

  it('同一场多次考查计入 tested', () => {
    const g = gapStats([2, 0, 1]);
    expect(g.tested).toBe(3);
    expect(g.sessions).toBe(2);
  });

  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('featuresAt', () => {
  it('只使用目标场次之前的数据', () => {
    const hits = [1, 0, 1, 0, 1, 1];
    const a = featuresAt(hits, 4, 0.1);
    const b = featuresAt([...hits.slice(0, 4), 0, 0], 4, 0.1);
    expect(a).toEqual(b);
  });

  it('上一场已考与从未出现标志', () => {
    expect(featuresAt([0, 0, 1], 3, 0.1)[3]).toBe(1);
    expect(featuresAt([0, 0, 0], 3, 0.1)[5]).toBe(1);
  });
});

describe('logistic regression', () => {
  it('能拟合可分数据', () => {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 200; i++) {
      const v = i / 200;
      X.push([v, 1 - v]);
      y.push(v > 0.5 ? 1 : 0);
    }
    const m = trainLogistic(X, y, 600, 0.8);
    expect(predictProba(m, [0.9, 0.1])).toBeGreaterThan(0.8);
    expect(predictProba(m, [0.1, 0.9])).toBeLessThan(0.2);
  });
});

describe('scoring & backtest', () => {
  const T = 24;
  const items: SeriesItem[] = [];
  // 高频考点（每 2 场一次）与低频考点
  for (let k = 0; k < 10; k++) items.push({ id: `hot${k}`, hits: Array.from({ length: T }, (_, i) => ((i + k) % 2 === 0 ? 1 : 0)), knownFrom: 0 });
  for (let k = 0; k < 40; k++) items.push({ id: `cold${k}`, hits: Array.from({ length: T }, (_, i) => (i === (k % T) ? 1 : 0)), knownFrom: 0 });

  it('高频考点排在前面', () => {
    const model = fitModelBefore(items, T - 1);
    const ranked = scoreAt(items, T - 1, model);
    expect(ranked.slice(0, 10).filter((r) => r.id.startsWith('hot')).length).toBeGreaterThanOrEqual(8);
  });

  it('回测输出命中率并优于随机', () => {
    const rows = backtest(items, [T - 3, T - 2, T - 1], [10]);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.precision).toBeGreaterThanOrEqual(0);
      expect(r.precision).toBeLessThanOrEqual(1);
    }
    const avg = rows.reduce((a, r) => a + r.precision, 0) / rows.length;
    const rnd = rows.reduce((a, r) => a + r.randomPrecision, 0) / rows.length;
    expect(avg).toBeGreaterThan(rnd);
  });

  it('词汇等考点在首次出现之前不进入候选集', () => {
    const late: SeriesItem = { id: 'late', hits: [0, 0, 0, 0, 1, 0], knownFrom: 4 };
    expect(scoreAt([late], 4, null)).toHaveLength(0);
    expect(scoreAt([late], 5, null)).toHaveLength(1);
  });

  it('expectedCount 近期加权', () => {
    expect(expectedCount([5, 5, 5, 5], 4)).toBeCloseTo(5);
    expect(expectedCount([0, 0, 0, 6], 4)).toBeGreaterThan(expectedCount([6, 0, 0, 0], 4));
  });
});

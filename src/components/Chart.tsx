import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, VisualMapComponent, MarkLineComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, MarkLineComponent, DataZoomComponent, CanvasRenderer]);

export interface Tokens {
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  muted: string;
  grid: string;
  baseline: string;
  border: string;
  series: string[];
  seq: string[];
  font: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    surface: v('--surface-1'),
    surface2: v('--surface-2'),
    text: v('--text-primary'),
    text2: v('--text-secondary'),
    muted: v('--axis-muted'),
    grid: v('--grid'),
    baseline: v('--baseline'),
    border: v('--border'),
    series: [v('--series-1'), v('--series-2'), v('--series-3'), v('--series-4')],
    seq: [v('--seq-100'), v('--seq-250'), v('--seq-400'), v('--seq-550'), v('--seq-700')],
    font: v('--font'),
  };
}

/** 主题变化（系统深浅色或手动切换）时触发重绘 */
export function useThemeVersion(): number {
  const [ver, setVer] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const bump = () => setVer((x) => x + 1);
    mq.addEventListener('change', bump);
    const obs = new MutationObserver(bump);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', bump);
      obs.disconnect();
    };
  }, []);
  return ver;
}

/** 通用的坐标轴/提示框样式：细线、实线网格、文字用文本色。 */
export function baseOption(t: Tokens) {
  return {
    animationDuration: 300,
    textStyle: { fontFamily: t.font, color: t.text2 },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      textStyle: { color: t.text, fontSize: 13 },
      extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 8px;',
    },
    axisCommon: {
      axisLine: { lineStyle: { color: t.baseline } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 12 },
      splitLine: { lineStyle: { color: t.grid, type: 'solid' as const, width: 1 } },
    },
  };
}

interface Props {
  option: (t: Tokens) => echarts.EChartsCoreOption;
  height: number;
  ariaLabel: string;
  deps: unknown[];
  onClick?: (params: unknown) => void;
}

export function Chart({ option, height, ariaLabel, deps, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const themeVer = useThemeVersion();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option(readTokens()), true);
    chart.off('click');
    if (onClick) chart.on('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeVer, ...deps]);

  return <div ref={ref} className="chart" style={{ height }} role="img" aria-label={ariaLabel} />;
}

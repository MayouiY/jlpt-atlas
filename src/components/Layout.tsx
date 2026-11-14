import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getMeta } from '../lib/queries';
import { sessionLabel } from '../lib/format';

const NAV = [
  { to: '/', label: '总览', icon: '◎', end: true },
  { to: '/explore', label: '考点检索', icon: '⌕' },
  { to: '/recurrence', label: '复现规律', icon: '↻' },
  { to: '/predict', label: '下次预测', icon: '➚' },
  { to: '/sessions', label: '历年场次', icon: '▤' },
  { to: '/about', label: '数据与方法', icon: 'ⓘ' },
];

type Theme = 'auto' | 'light' | 'dark';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('jlpt-atlas-theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function Layout() {
  const meta = getMeta();
  const loc = useLocation();
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('jlpt-atlas-theme', theme);
    } catch {
      /* 存储不可用时忽略 */
    }
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const next: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const themeLabel: Record<Theme, string> = { auto: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' };
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">JLPT Atlas</span>
          <span className="brand-sub">N1・N2 历年考点图谱</span>
        </div>
        <nav className="nav" aria-label="主导航">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <span className="nav-icon" aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            数据截至 {sessionLabel(meta.data_cutoff)}
            <br />共 {meta.held_sessions} 场 · {Number(meta.question_count).toLocaleString('zh-CN')} 题
          </span>
          <button type="button" className="theme-toggle" onClick={() => setTheme(next[theme])}>
            {themeLabel[theme]}
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

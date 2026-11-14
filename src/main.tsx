import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { loadDb } from './lib/db';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Explore } from './pages/Explore';
import { KpDetail } from './pages/KpDetail';
import { Recurrence } from './pages/Recurrence';
import { Predict } from './pages/Predict';
import { Sessions, SessionDetail } from './pages/Sessions';
import { About } from './pages/About';

function App() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  useEffect(() => {
    loadDb().then(
      () => setState('ready'),
      (e: Error) => setState(e),
    );
  }, []);
  if (state === 'loading') return <div className="loading">正在加载考点数据库…</div>;
  if (state instanceof Error) return <div className="loading">数据库加载失败：{state.message}</div>;
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="explore" element={<Explore />} />
          <Route path="kp/:id" element={<KpDetail />} />
          <Route path="recurrence" element={<Recurrence />} />
          <Route path="predict" element={<Predict />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:level/:session" element={<SessionDetail />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<div className="empty">页面不存在</div>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

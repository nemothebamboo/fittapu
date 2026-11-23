import { useState } from 'react';
import { DataProvider, useData } from './store';
import Today from './screens/Today';
import Week from './screens/Week';
import Progress from './screens/Progress';
import Report from './screens/Report';
import Settings from './screens/Settings';
import { Icon } from './components/ui';

const TABS = [
  { id: 'today', label: 'Ma' },
  { id: 'week', label: 'Hét' },
  { id: 'progress', label: 'Haladás' },
  { id: 'report', label: 'Jelentés' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Shell() {
  const { ready } = useData();
  const [tab, setTab] = useState<Tab>(() => (new Date().getDay() === 0 && new Date().getHours() >= 17 ? 'report' : 'today'));
  const [settings, setSettings] = useState(false);
  if (!ready) return <div className="loading">Fittapu…</div>;
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Fittapu</span>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Mentés és beállítások"><Icon name="gear" size={22} /></button>
      </header>
      <main>
        {tab === 'today' && <Today />}
        {tab === 'week' && <Week />}
        {tab === 'progress' && <Progress />}
        {tab === 'report' && <Report />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
            <Icon name={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

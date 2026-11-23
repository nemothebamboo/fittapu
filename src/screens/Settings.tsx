import { useRef, useState } from 'react';
import { useData } from '../store';
import { Modal } from '../components/ui';
import { defaultBlocks } from '../schedule';
import { iso } from '../dates';
import type { ExportData } from '../types';

export default function Settings({ onClose }: { onClose: () => void }) {
  const { exportAll, importAll, saveTemplate } = useData();
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const json = () => JSON.stringify(exportAll());
  const name = `fittapu-mentes-${iso(new Date())}.json`;

  const save = async () => {
    const blob = new Blob([json()], { type: 'application/json' });
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Fittapu mentés' }); setMsg('Mentés megosztva.'); return; } catch { /* mégse */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setMsg('Mentés letöltve.');
  };
  const doImport = async (text: string) => {
    try {
      const data = JSON.parse(text) as ExportData;
      if (!confirm('Az import felülírja az ezen az eszközön lévő összes adatot. Folytatod?')) return;
      await importAll(data);
      setMsg('Import kész ✓');
      setPaste('');
    } catch (e) {
      setMsg(`Hiba: ${(e as Error).message}`);
    }
  };

  return (
    <Modal title="Mentés és beállítások" onClose={onClose}>
      <div className="form">
        <p className="muted">Az adatok csak ezen az eszközön vannak. Hetente ments, és így viheted át gépre vagy vissza.</p>
        <button className="btn primary" onClick={save}>Mentés fájlba (JSON)</button>
        <button className="btn" onClick={async () => { await navigator.clipboard.writeText(json()); setMsg('Mentés a vágólapon.'); }}>Mentés vágólapra</button>
        <hr />
        <button className="btn" onClick={() => file.current?.click()}>Visszatöltés fájlból</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await doImport(await f.text()); e.target.value = ''; }} />
        <label>…vagy illeszd be a mentést
          <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"app":"fittapu", ...}' />
        </label>
        {paste && <button className="btn" onClick={() => doImport(paste)}>Beillesztett mentés betöltése</button>}
        <hr />
        <button className="btn danger" onClick={() => confirm('Visszaállítod az alapértelmezett heti tervet? (A már saját tervvel rendelkező hetek maradnak.)') && (saveTemplate(defaultBlocks()), setMsg('Alaphét visszaállítva.'))}>Gyári alaphét visszaállítása</button>
        {msg && <p className="msg">{msg}</p>}
        <p className="muted small">Fittapu v1 · offline működik · adat: IndexedDB</p>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { supabase } from '../../lib/supabase';
import { StartImport, StartVersion, publishedStartList, reviewStartImport, startPdf } from '../../utils/startLists';
import { StartListRows } from '../public/StartListView';

export function StartListManager({ eventId }: { eventId: string }) {
  const { classes, arenas, documents, addDocument, updateDocument, setViewingDocumentId, startHeads, startVersions, startListsError, importStartLists, unpublishStartList } = useEquestrian();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<StartImport[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<StartVersion[]>([]);
  const [historyClass, setHistoryClass] = useState('');
  const targets = classes.filter(c => c.eventId === eventId).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const label = (id: string) => {
    const c = targets.find(c => c.id === id);
    return c ? `${c.date} · ${arenas.find(a => a.id === c.arenaId)?.name || 'Pista'} · Prueba ${c.number} · ${c.name}` : id;
  };
  const changeText = (value: string) => { setText(value); setPreview(null); setConfirmed(false); setMessage(''); };
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function loadHistory(classId: string) {
    const { data, error } = await supabase.from('start_list_versions').select('*').eq('class_id', classId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    setHistory(data as StartVersion[]); setHistoryClass(classId);
  }
  function exportTemplate() {
    const template = targets.map(c => ({ id: crypto.randomUUID(), classId: c.id, eventId, date: c.date, arenaId: c.arenaId, number: c.number,
      expectedRevision: startHeads.find(h => h.class_id === c.id)?.revision ?? null,
      sourceName: '', reviewed: false, uncertainties: ['Completar y revisar contra el PDF original'], entries: [] }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `pruebas-${eventId}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6 space-y-4">
    <h2 className="text-xl font-bold text-[#123E59]">Órdenes de ingreso</h2>
    <p className="text-sm text-neutral-600">Pasá el PDF y la plantilla de pruebas por ChatGPT. Revisá la extracción y resolvé los datos inciertos antes de importar el lote. No hace falta cargar los participantes uno por uno.</p>
    <p className="text-sm text-neutral-600">La cantidad pública será automática mientras haya un listado publicado. La cantidad manual de la prueba se conserva. Cada reemplazo guarda una versión anterior y no modifica ningún PDF.</p>
    <p className="text-sm text-neutral-600">También podés agregar un PDF por prueba. Si hay listado estructurado, el PDF queda disponible para descargar; si solo hay PDF, se abre como siempre.</p>
    {startListsError && <p role="alert" className="text-red-700">{startListsError}</p>}
    <div className="divide-y divide-neutral-100">{targets.map(c => {
      const list = publishedStartList(c.id, startHeads, startVersions);
      const head = startHeads.find(h => h.class_id === c.id);
      const pdf = startPdf(documents, c.id);
      return <div key={c.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
        <div className="min-w-0 break-words"><p className="font-semibold">{label(c.id)}</p><p className="text-neutral-500">{list ? `${list.entries.length} participantes · ${list.source_name}` : 'Sin listado estructurado publicado'} · Manual: {c.participantCount ?? 'sin definir'}</p></div>
        <div className="flex flex-wrap gap-3">
          <label className={`relative inline-flex items-center min-h-11 text-[#123E59] underline rounded focus-within:ring-2 focus-within:ring-[#123E59] ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
            {pdf ? 'Reemplazar PDF' : 'Agregar PDF'}
            <input type="file" accept=".pdf,application/pdf" aria-label={`${pdf ? 'Reemplazar' : 'Agregar'} PDF de Prueba ${c.number}`} disabled={busy} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default" onChange={e => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              if (!file.name.toLowerCase().endsWith('.pdf') && file.type.toLowerCase() !== 'application/pdf') { setMessage('Seleccioná un archivo PDF.'); return; }
              if (!file.size || file.size > 25 * 1024 * 1024) { setMessage('El PDF debe tener contenido y pesar hasta 25 MB.'); return; }
              if (pdf && !window.confirm(`¿Reemplazar el PDF de Prueba ${c.number}? El listado estructurado no se modifica.`)) return;
              void run(async () => {
                if (pdf) await updateDocument(pdf.id, { mimeType: 'application/pdf' }, file);
                else await addDocument({ eventId, classId: c.id, eventDate: c.date, name: `Listado Prueba ${c.number}`, type: 'START_LIST', fileUrl: '', mimeType: 'application/pdf' }, file);
                setMessage(`PDF de Prueba ${c.number} guardado. El listado estructurado se conserva.`);
              });
            }} />
          </label>
          {pdf && <button disabled={busy} className="min-h-11 underline text-[#123E59]" onClick={() => setViewingDocumentId(pdf.id)}>Ver PDF</button>}
          <button disabled={busy || !!startListsError} className="min-h-11 underline text-[#123E59] disabled:opacity-50" onClick={() => void run(() => loadHistory(c.id))}>Versiones</button>
          {list && head && <button disabled={busy} className="min-h-11 underline text-red-700" onClick={() => {
            if (window.confirm(`¿Retirar el listado de Prueba ${c.number}? Se conservarán las versiones y volverá a mostrarse el documento anterior si existe.`)) void run(async () => { await unpublishStartList(c.id, head.revision); setPreview(null); setConfirmed(false); setMessage('Listado retirado. Versiones conservadas.'); });
          }}>Retirar publicación</button>}
        </div>
      </div>;
    })}</div>
    {historyClass && <div className="border border-neutral-200 rounded-lg p-3 space-y-2"><h3 className="font-semibold">Versiones · {label(historyClass)}</h3><p className="text-xs text-neutral-500">Hasta 100 versiones recientes. Restaurar crea una nueva versión después de revisarla.</p>
      {!history.length && <p className="text-sm">Todavía no hay versiones.</p>}
      {history.map(v => <div key={v.id} className="flex flex-wrap gap-2 justify-between text-sm"><span>{new Date(v.created_at).toLocaleString('es-AR')} · {v.entries.length} participantes · {v.source_name}</span><button disabled={busy} className="underline min-h-11 text-[#123E59]" onClick={() => { const c = targets.find(c => c.id === v.class_id)!; changeText(JSON.stringify([{ id: crypto.randomUUID(), classId: c.id, eventId, date: c.date, arenaId: c.arenaId, number: c.number, expectedRevision: startHeads.find(h => h.class_id === c.id)?.revision ?? null, sourceName: v.source_name, reviewed: true, uncertainties: [], entries: v.entries }], null, 2)); }}>Preparar restauración</button></div>)}
    </div>}
    <button className="min-h-11 underline text-[#123E59] font-semibold" onClick={exportTemplate} disabled={!targets.length || busy}>Descargar plantilla de pruebas para ChatGPT</button>
    <label className="block text-sm font-semibold">Lote revisado (JSON)<textarea className="block w-full min-h-48 mt-2 rounded-lg border border-neutral-300 p-3 text-xs font-mono" value={text} disabled={busy} onChange={e => changeText(e.target.value)} placeholder="Pegá el lote extraído y revisado con ChatGPT" /></label>
    <label className="block text-sm">O seleccioná el archivo JSON<input type="file" accept=".json,application/json" disabled={busy} className="block max-w-full my-2" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setMessage('El lote supera 10 MB.'); return; } changeText(await file.text()); e.target.value = ''; }} /></label>
    <button disabled={busy || !!startListsError} className="min-h-11 px-4 rounded-lg border border-neutral-300 font-semibold disabled:opacity-50" onClick={() => { try { setPreview(reviewStartImport(JSON.parse(text), classes, startHeads, eventId)); setConfirmed(false); setMessage(''); } catch (error) { setPreview(null); setMessage((error as Error).message); } }}>Revisar importación</button>
    {preview && <div className="space-y-4">
      {preview.map(item => <div key={item.classId} className="border border-neutral-200 rounded-lg p-3"><h3 className="font-semibold text-[#123E59]">{label(item.classId)}</h3><p className="text-sm text-neutral-600">{item.sourceName} · {item.entries.length} participantes · {startHeads.find(h => h.class_id === item.classId)?.version_id ? 'Reemplazará el listado publicado; la versión anterior se conserva.' : 'Nueva publicación.'}</p>{!item.entries.length && <p className="text-amber-800">Se publicará un listado vacío con 0 participantes.</p>}<div className="max-h-96 overflow-y-auto"><StartListRows entries={item.entries} /></div></div>)}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Verifiqué todas las filas contra el PDF original, la asociación de cada prueba y los reemplazos indicados, incluidos los listados vacíos.</label>
      <button disabled={busy || !confirmed || !!startListsError} className="min-h-11 px-4 rounded-lg bg-[#123E59] text-white font-semibold disabled:opacity-50" onClick={() => void run(async () => { await importStartLists(preview); setPreview(null); setText(''); setConfirmed(false); setHistory([]); setHistoryClass(''); setMessage('Lote publicado. Versiones anteriores y PDFs conservados.'); })}>{busy ? 'Guardando…' : 'Publicar lote revisado'}</button>
    </div>}
    {message && <p role="status" className="text-sm font-semibold break-words">{message}</p>}
  </section>;
}

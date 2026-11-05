import { useCallback, useEffect, useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import type { DocumentType, EquestrianEvent } from '../../types/equestrian';
import { getDaysBetween, formatDayHeader } from '../../utils/dateUtils';
import { filterAdminDocuments } from '../../utils/adminDocuments';
import { DocumentManagerModal } from './DocumentManagerModal';
import { StartListManager } from './StartListManager';
import { ResultsManager } from './ResultsManager';

export function DocumentWorkspace({ event, onDirtyChange, onBusyChange }: { event: EquestrianEvent; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const { classes, documents, arenas, startHeads, resultHeads, startListsError, resultsError } = useEquestrian();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [date, setDate] = useState('');
  const [classId, setClassId] = useState('');
  const [upload, setUpload] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, type, date, classId]);
  const [action, setAction] = useState<{ type: 'START_LIST' | 'RESULT'; classId?: string; mode: 'import' | 'manage' } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);
  const dirtyChanged = useCallback((value: boolean) => setDirty(value), []);
  const closeAction = () => {
    if (busy) return;
    if (dirty && !window.confirm('¿Descartar la importación sin guardar y volver a documentos?')) return;
    setDirty(false);
    setAction(null);
  };
  const eventClasses = classes.filter(c => c.eventId === event.id).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const visibleClasses = eventClasses.filter(c => !date || c.date === date);
  const { files, structured } = filterAdminDocuments(event.id, documents, classes, startHeads, resultHeads, { search, type, date, classId });
  const total = files.length + structured.length;
  const pages = Math.max(1, Math.ceil(total / 12));
  const currentPage = Math.min(page, pages);
  const rows = [...files.map(file => ({ file, structured: null })), ...structured.map(item => ({ file: null, structured: item }))].slice((currentPage - 1) * 12, currentPage * 12);
  const pageFiles = rows.flatMap(row => row.file ? [row.file] : []);
  const pageStructured = rows.flatMap(row => row.structured ? [row.structured] : []);
  const control = 'block w-full min-w-0 min-h-11 mt-1 px-3 border border-neutral-300 rounded-lg bg-white text-sm';
  const label = (id: string) => {
    const entry = eventClasses.find(c => c.id === id);
    return entry ? `${entry.date} · Prueba ${entry.number} · ${entry.name} · ${arenas.find(a => a.id === entry.arenaId)?.name || 'Pista'}` : id;
  };
  if (action) return <div className="space-y-3 min-w-0">
    <button className="min-h-11 px-3 border rounded-lg text-sm font-semibold text-[#123E59]" disabled={busy} onClick={closeAction}>Volver a documentos</button>
    {dirty && <p className="text-xs text-neutral-500">Terminá o descartá el JSON antes de volver.</p>}
    {action.type === 'START_LIST' ? <StartListManager key={`${action.mode}:${action.classId || ''}`} eventId={event.id} mode={action.mode} classId={action.classId} onDirtyChange={dirtyChanged} onBusyChange={setBusy} />
      : <ResultsManager key={`${action.mode}:${action.classId || ''}`} eventId={event.id} mode={action.mode} classId={action.classId} onDirtyChange={dirtyChanged} onBusyChange={setBusy} />}
  </div>;
  return <section className="space-y-4 min-w-0">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <h2 className="text-xl font-bold text-[#123E59]">Documentos</h2>
      <div className="flex flex-wrap gap-2">
        <button className="min-h-11 px-3 rounded-lg bg-[#123E59] text-white text-sm font-semibold" onClick={() => setUpload(true)}>Cargar archivo</button>
        <label className="sr-only" htmlFor="import-json-type">Importar JSON</label>
        <select id="import-json-type" aria-label="Importar JSON" className="min-h-11 max-w-full px-3 border rounded-lg bg-white text-sm font-semibold text-[#123E59]" value="" onChange={e => { if (e.target.value) setAction({ type: e.target.value as 'START_LIST' | 'RESULT', mode: 'import' }); }}>
          <option value="" disabled>Importar JSON…</option><option value="START_LIST">Órdenes de ingreso</option><option value="RESULT">Resultados</option>
        </select>
      </div>
    </div>
    <div className="bg-white border rounded-xl p-3 grid sm:grid-cols-2 gap-3">
      <label className="text-xs font-semibold sm:col-span-2">Buscar documentos
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} className={control} placeholder="Nombre, jornada o prueba" />
      </label>
      <label className="text-xs font-semibold">Tipo de documento
        <select value={type} onChange={e => setType(e.target.value as DocumentType | '')} className={control}>
          <option value="">Todos los tipos</option><option value="PROGRAM">Anteprogramas</option><option value="REGULATION">Reglamentos</option><option value="START_LIST">Órdenes de ingreso</option><option value="RESULT">Resultados</option><option value="OTHER">Otros documentos</option>
        </select>
      </label>
      <label className="text-xs font-semibold">Jornada
        <select value={date} onChange={e => { setDate(e.target.value); setClassId(''); }} className={control}>
          <option value="">Todas las jornadas</option>{getDaysBetween(event.startDate, event.endDate).map(day => <option key={day} value={day}>{formatDayHeader(day).fullFormatted}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold sm:col-span-2">Prueba
        <select value={classId} onChange={e => setClassId(e.target.value)} className={control}>
          <option value="">Todas las pruebas</option>{visibleClasses.map(c => <option key={c.id} value={c.id}>{label(c.id)}</option>)}
        </select>
      </label>
      {(search || type || date || classId) && <button className="min-h-11 text-sm text-[#123E59] underline sm:col-span-2" onClick={() => { setSearch(''); setType(''); setDate(''); setClassId(''); }}>Restablecer filtros</button>}
    </div>
    {(startListsError || resultsError) && <p role="alert" className="text-sm text-red-700">{startListsError || resultsError}</p>}
    <div className="bg-white border rounded-xl p-3 min-w-0">
      {!!pageFiles.length && <DocumentManagerModal isOpen embedded event={event} onClose={() => {}} visibleIds={pageFiles.map(d => d.id)} />}
      {!!pageStructured.length && <div className="mt-3 border-t pt-3">
        <h3 className="text-xs font-bold uppercase text-neutral-500 mb-2">Datos estructurados e historial ({structured.length})</h3>
        <ul className="divide-y">{pageStructured.map(item => <li key={`${item.type}:${item.classId}`} className="py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#123E59]">{item.type === 'START_LIST' ? 'Orden de ingreso' : 'Resultados'}</p><p className="text-xs break-words">{label(item.classId)}</p><p className="text-xs text-neutral-500">{item.published ? 'Publicado' : 'Sin publicación · historial conservado'}</p></div>
          <button className="min-h-11 px-3 border rounded-lg text-sm font-semibold text-[#123E59]" onClick={() => setAction({ type: item.type, classId: item.classId, mode: 'manage' })}>Administrar</button>
        </li>)}</ul>
      </div>}
      {!files.length && !structured.length && <p className="text-sm text-neutral-500 py-3">No hay documentos para estos filtros. Podés cargar un archivo o importar JSON.</p>}
    </div>
    {pages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>Página {currentPage} de {pages} · {total} documentos</span><div className="flex gap-2">
        <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 px-3 border rounded-lg disabled:opacity-40">Anterior</button>
        <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="min-h-11 px-3 border rounded-lg disabled:opacity-40">Siguiente</button>
      </div></div>}
    {upload && <DocumentManagerModal isOpen uploadOnly event={event} initialDate={date} initialClassId={classId} onClose={() => setUpload(false)} />}
  </section>;
}

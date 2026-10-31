import { useState } from 'react';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedStartList, startPdf, StartEntry } from '../../utils/startLists';

export function StartListRows({ entries }: { entries: StartEntry[] }) {
  return <ol className="divide-y divide-neutral-200" aria-label="Orden de ingreso">
    {entries.map(row => <li key={row.position} className="grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-x-3 gap-y-1 py-5">
      <span className="row-span-3 sm:row-span-1 text-neutral-500 tabular-nums">{row.position}.</span>
      <span className="font-bold text-[#123E59] break-words [overflow-wrap:anywhere]">{row.horse}</span>
      <span className="col-start-2 sm:col-start-auto text-neutral-700 break-words [overflow-wrap:anywhere]">{row.rider}</span>
      {row.club && <span className="col-start-2 sm:col-start-auto text-sm text-neutral-500 sm:text-right break-words [overflow-wrap:anywhere]">{row.club}</span>}
    </li>)}
  </ol>;
}
export function StartListView({ classId }: { classId: string }) {
  const { classes, arenas, events, startHeads, startVersions, documents, startListsError, refreshData, setSelectedEventId } = useEquestrian();
  const [search, setSearch] = useState('');
  const entry = classes.find(c => c.id === classId);
  const list = publishedStartList(classId, startHeads, startVersions);
  const pdf = startPdf(documents, classId);
  const close = () => { if (entry) setSelectedEventId(entry.eventId); window.location.hash = ''; };
  const query = search.trim().toLocaleLowerCase();
  const rows = list?.entries.filter(row => `${row.horse} ${row.rider} ${row.club || ''} ${row.position}`.toLocaleLowerCase().includes(query)) || [];
  const downloadUrl = pdf ? `${pdf.fileUrl}${pdf.fileUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(`Listado-${entry?.number || classId}.pdf`)}` : '';
  return <main className="min-h-screen bg-white text-neutral-900 px-4 sm:px-8 py-5 sm:py-8">
    <div className="max-w-5xl mx-auto">
      <button onClick={close} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18} />Volver al concurso</button>
      {startListsError ? <div role="alert" className="py-8">{startListsError}<button className="underline ml-2 min-h-11" onClick={() => void refreshData()}>Reintentar</button></div> : !entry || !list ? <p className="py-8">Este listado no está publicado.</p> : <>
        <p className="text-sm text-neutral-500 mt-6 break-words">{events.find(e => e.id === entry.eventId)?.name} · {entry.date.split('-').reverse().join('/')} · {arenas.find(a => a.id === entry.arenaId)?.name}</p>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#A61E4D]">Prueba {entry.number}</p><h1 className="font-display text-2xl sm:text-3xl font-bold text-[#123E59] break-words">{entry.name}</h1></div>
          {pdf && <a href={downloadUrl} download aria-label="Descargar listado en PDF" title="Descargar listado en PDF" className="shrink-0 min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg border border-neutral-200 text-[#123E59]"><Download size={20} /></a>}
        </div>
        <h2 className="font-semibold mt-5">Orden de ingreso <span className="text-neutral-500 font-normal">· {list.entries.length} participantes</span></h2>
        <label className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 mt-5 mb-3"><Search size={18} className="text-neutral-400" /><input aria-label="Buscar jinete, caballo o club" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jinete, caballo o club" className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none" /></label>
        <div className="hidden sm:grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-3 border-b border-neutral-300 py-3 text-xs uppercase font-semibold text-[#123E59]"><span>Orden</span><span>Caballo</span><span>Jinete</span><span className="text-right">Club</span></div>
        <StartListRows entries={rows} />
        {!list.entries.length && <p className="py-8 text-neutral-500">Listado publicado sin participantes.</p>}
        {!!list.entries.length && !rows.length && <p className="py-8 text-neutral-500">No hay coincidencias.</p>}
      </>}
    </div>
  </main>;
}

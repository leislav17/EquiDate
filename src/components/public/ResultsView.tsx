import { useState } from 'react';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedResults, resultPdf, type ResultEntry, type ResultColumn } from '../../utils/results';

export function ResultRows({ entries, columns }: { entries: ResultEntry[]; columns: ResultColumn[] }) {
  return <div className="overflow-x-auto rounded-lg border border-neutral-200">
    <table className="w-full min-w-[600px] text-sm text-left">
      <thead className="bg-[#123E59] text-white"><tr>
        {['Puesto', 'Caballo', 'Jinete', 'Club', ...columns.map(c => c.label)].map((label, index) => <th key={index} scope="col" className="px-3 py-3 font-semibold whitespace-nowrap">{label}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-neutral-200">{entries.map(row => <tr key={row.position}>
        <td className="px-3 py-4 tabular-nums align-top">{row.rank || ''}</td>
        <td className="px-3 py-4 font-bold text-[#123E59] align-top break-words">{row.horse}</td>
        <td className="px-3 py-4 align-top break-words">{row.rider}</td>
        <td className="px-3 py-4 text-neutral-500 align-top break-words">{row.club || ''}</td>
        {columns.map(col => <td key={col.key} className="px-3 py-4 tabular-nums align-top whitespace-nowrap">{Object.hasOwn(row.values || {}, col.key) ? row.values![col.key] : ''}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
export function ResultsView({ classId }: { classId: string }) {
  const { classes, arenas, events, resultHeads, resultVersions, documents, resultsError, refreshData, setSelectedEventId } = useEquestrian();
  const [search, setSearch] = useState('');
  const entry = classes.find(c => c.id === classId);
  const result = publishedResults(classId, resultHeads, resultVersions);
  const pdf = resultPdf(documents, classId);
  const query = search.trim().toLocaleLowerCase();
  const rows = result?.entries.filter(r => `${r.rider} ${r.horse} ${r.club || ''} ${r.rank || ''}`.toLocaleLowerCase().includes(query)) || [];
  const close = () => { if (entry) setSelectedEventId(entry.eventId); window.location.hash = ''; };
  const downloadUrl = pdf ? `${pdf.fileUrl}${pdf.fileUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(`Resultados-${entry?.number || classId}.pdf`)}` : '';
  return <section aria-label="Resultados de la prueba" className="min-h-[calc(100vh-64px)] bg-white px-4 sm:px-8 py-5 sm:py-8"><div className="max-w-5xl mx-auto">
    <button onClick={close} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18} />Volver al concurso</button>
    {resultsError ? <div role="alert" className="py-8">{resultsError}<button onClick={() => void refreshData()} className="ml-2 underline min-h-11">Reintentar</button></div> : !entry || !result ? <p className="py-8">Estos resultados no están publicados.</p> : <>
      <p className="text-sm text-neutral-500 mt-6 break-words">{events.find(e => e.id === entry.eventId)?.name} · {entry.date.split('-').reverse().join('/')} · {arenas.find(a => a.id === entry.arenaId)?.name}</p>
      <div className="flex items-start justify-between gap-3 mt-2"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[#A61E4D]">Prueba {entry.number}</p><h1 className="font-display text-2xl sm:text-3xl font-bold text-[#123E59] break-words">{entry.name}</h1></div>
        {pdf && <a href={downloadUrl} download aria-label="Descargar resultados en PDF" title="Descargar resultados en PDF" className="min-w-11 min-h-11 shrink-0 flex items-center justify-center rounded-lg border text-[#123E59]"><Download size={20} /></a>}
      </div>
      <h2 className="font-semibold mt-5">Resultados <span className="font-normal text-neutral-500">· {result.entries.length} participantes</span></h2>
      <label className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 mt-5 mb-3"><Search size={18} className="text-neutral-400" /><input aria-label="Buscar en resultados" placeholder="Buscar jinete, caballo o club" className="min-h-11 w-full min-w-0 bg-transparent text-sm" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <ResultRows entries={rows} columns={result.columns} />
      {!result.entries.length && <p className="py-8 text-neutral-500">Resultados publicados sin participantes.</p>}
      {!!result.entries.length && !rows.length && <p className="py-8 text-neutral-500">No hay coincidencias.</p>}
    </>}
  </div></section>;
}

import { Fragment, useState } from 'react';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedResults, resultPdf, resultColumnGroups, type ResultEntry, type ResultColumn, type ResultDetails } from '../../utils/results';

export function ResultDetailsPanel({ details = {} }: { details?: ResultDetails }) {
  const fields = [['Definición', details.definition], ['Altura', details.height], ['Tiempo permitido', details.allowedTime], ['Tiempo óptimo', details.optimalTime]].filter(([,value]) => value);
  if (!fields.length && !details.rounds?.length) return null;
  return <div className="mt-4 space-y-3 text-sm text-neutral-700" aria-label="Condiciones de la prueba">
    <dl className="flex flex-wrap gap-x-6 gap-y-2">{fields.map(([label,value]) => <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="font-semibold break-words">{value}</dd></div>)}</dl>
    {details.rounds?.map((round,i) => <div key={i}><p className="font-semibold text-[#123E59]">{round.label}</p><dl className="flex flex-wrap gap-x-6 gap-y-1">{round.allowedTime && <div><dt className="text-xs text-neutral-500">Tiempo permitido</dt><dd>{round.allowedTime}</dd></div>}{round.optimalTime && <div><dt className="text-xs text-neutral-500">Tiempo óptimo</dt><dd>{round.optimalTime}</dd></div>}</dl></div>)}
  </div>;
}

export function ResultRows({ entries, columns }: { entries: ResultEntry[]; columns: ResultColumn[] }) {
  const groups = resultColumnGroups(columns);
  const grouped = groups.some(g => g.label);
  const multipleRounds = groups.filter(g => g.label).length > 1;
  const hasCategory = entries.some(row => row.category);
  const value = (row: ResultEntry, key: string) => Object.hasOwn(row.values || {}, key) ? row.values![key] : '';
  return <>
    <div className="sm:hidden">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-lg bg-[#123E59] px-2 py-3 text-xs uppercase font-semibold text-white"><span>Puesto</span><span>Caballo / Jinete / Club{columns.length > 0 && <span className="block mt-1 font-normal normal-case">{grouped ? groups.filter(g => g.label).map(g => g.label).join(' · ') : 'Faltas y tiempos de la prueba'}</span>}</span></div>
      <ol aria-label="Resultados" className="divide-y divide-neutral-200">{entries.map(row => <li key={row.position} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-5">
        <span className={`${row.qualified === true ? 'text-[#A61E4D] font-bold' : 'text-neutral-500'} tabular-nums break-words [overflow-wrap:anywhere]`} aria-label={row.qualified === true ? `Puesto ${row.rank || ''}, clasificado` : undefined}>{row.rank || ''}</span>
        <div className="min-w-0 space-y-1"><p className="font-bold text-[#123E59] break-words [overflow-wrap:anywhere]">{row.horse}</p><p className="text-neutral-700 break-words [overflow-wrap:anywhere]">{row.rider}</p>{row.club && <p className="text-sm text-neutral-500 break-words [overflow-wrap:anywhere]">{row.club}</p>}{row.category && <p className="text-xs text-neutral-500">Categoría: {row.category}</p>}
          {!!columns.length && <div className={`grid gap-3 pt-3 ${multipleRounds ? 'grid-cols-2' : 'grid-cols-1'}`}>{groups.map((group, index) => <div key={index} className={`min-w-0 ${!group.label ? 'col-span-full' : ''}`}>{group.label && <p className="text-xs font-bold text-[#123E59] mb-2">{group.label}</p>}<dl className="grid grid-cols-2 gap-2">{group.columns.map(col => <div key={col.key} className="min-w-0"><dt className="text-xs text-neutral-500">{col.label}</dt><dd className="text-sm tabular-nums break-words [overflow-wrap:anywhere]">{value(row, col.key)}</dd></div>)}</dl></div>)}</div>}
        </div>
      </li>)}</ol>
    </div>
    <div className="hidden sm:block overflow-x-auto rounded-lg">
      <table className="w-full min-w-[600px] text-sm text-left">
        <thead className="bg-[#123E59] text-white"><tr>
          {['Puesto', 'Caballo', 'Jinete', 'Club', ...(hasCategory ? ['Categoría'] : [])].map(label => <th key={label} scope="col" rowSpan={grouped ? 2 : 1} className="px-3 py-3 font-semibold whitespace-nowrap">{label}</th>)}
          {groups.map((group,i) => group.label ? <th key={i} scope="colgroup" colSpan={group.columns.length} className="px-3 pt-3 pb-2 text-center font-semibold border-l border-white/20">{group.label}</th> : <Fragment key={i}>{group.columns.map(col => <th key={col.key} scope="col" rowSpan={grouped ? 2 : 1} className="px-3 py-3 text-right font-semibold whitespace-nowrap">{col.label}</th>)}</Fragment>)}
        </tr>{grouped && <tr>{groups.filter(g => g.label).flatMap(g => g.columns).map(col => <th key={col.key} scope="col" className="px-3 pb-3 text-right font-semibold whitespace-nowrap">{col.label}</th>)}</tr>}</thead>
        <tbody className="divide-y divide-neutral-200">{entries.map(row => <tr key={row.position}>
          <td className={`px-3 py-5 tabular-nums align-top ${row.qualified === true ? 'text-[#A61E4D] font-bold' : 'text-neutral-500'}`} aria-label={row.qualified === true ? `Puesto ${row.rank || ''}, clasificado` : undefined}>{row.rank || ''}</td>
          <td className="px-3 py-5 font-bold text-[#123E59] align-top break-words">{row.horse}</td>
          <td className="px-3 py-5 align-top break-words">{row.rider}</td>
          <td className="px-3 py-5 text-neutral-500 align-top break-words">{row.club || ''}</td>
          {hasCategory && <td className="px-3 py-5 text-neutral-500 align-top break-words">{row.category || ''}</td>}
          {columns.map(col => <td key={col.key} className="px-3 py-5 tabular-nums align-top text-right whitespace-nowrap">{value(row, col.key)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
export function ResultsView({ classId }: { classId: string }) {
  const { classes, arenas, events, resultHeads, resultVersions, documents, resultsError, refreshData, setSelectedEventId } = useEquestrian();
  const [search, setSearch] = useState('');
  const entry = classes.find(c => c.id === classId);
  const result = publishedResults(classId, resultHeads, resultVersions);
  const pdf = resultPdf(documents, classId);
  const query = search.trim().toLocaleLowerCase();
  const rows = result?.entries.filter(r => `${r.rider} ${r.horse} ${r.club || ''} ${r.rank || ''} ${r.category || ''}`.toLocaleLowerCase().includes(query)) || [];
  const close = () => { if (entry) setSelectedEventId(entry.eventId); window.location.hash = ''; };
  const downloadUrl = pdf ? `${pdf.fileUrl}${pdf.fileUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(`Resultados-${entry?.number || classId}.pdf`)}` : '';
  return <section aria-label="Resultados de la prueba" className="min-h-[calc(100vh-64px)] bg-white px-4 sm:px-8 py-5 sm:py-8"><div className="max-w-5xl mx-auto">
    <button onClick={close} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18} />Volver al concurso</button>
    {resultsError ? <div role="alert" className="py-8">{resultsError}<button onClick={() => void refreshData()} className="ml-2 underline min-h-11">Reintentar</button></div> : !entry || !result ? <p className="py-8">Estos resultados no están publicados.</p> : <>
      <p className="text-sm text-neutral-500 mt-6 break-words">{events.find(e => e.id === entry.eventId)?.name} · {entry.date.split('-').reverse().join('/')} · {arenas.find(a => a.id === entry.arenaId)?.name}</p>
      <div className="flex items-start justify-between gap-3 mt-2"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[#A61E4D]">Prueba {entry.number}</p><h1 className="font-display text-2xl sm:text-3xl font-bold text-[#123E59] break-words">{entry.name}</h1></div>
        {pdf && <a href={downloadUrl} download aria-label="Descargar resultados en PDF" title="Descargar resultados en PDF" className="min-w-11 min-h-11 shrink-0 flex items-center justify-center rounded-lg border text-[#123E59]"><Download size={20} /></a>}
      </div>
      <ResultDetailsPanel details={result.details} />
      <h2 className="font-semibold mt-5">Resultados <span className="font-normal text-neutral-500">· {result.entries.length} participantes</span></h2>
      <label className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 mt-5 mb-3"><Search size={18} className="text-neutral-400" /><input aria-label="Buscar en resultados" placeholder="Buscar jinete, caballo o club" className="min-h-11 w-full min-w-0 bg-transparent text-sm" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <ResultRows entries={rows} columns={result.columns} />
      {!result.entries.length && <p className="py-8 text-neutral-500">Resultados publicados sin participantes.</p>}
      {!!result.entries.length && !rows.length && <p className="py-8 text-neutral-500">No hay coincidencias.</p>}
    </>}
  </div></section>;
}

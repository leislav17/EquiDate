import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedResults, resultPdf, resultColumnGroups, type ResultEntry, type ResultColumn, type ResultDetails } from '../../utils/results';
import { resultDisplayColumns, resultDisplayValue } from '../../utils/resultDisplay';

export function ResultDetailsPanel({ details = {} }: { details?: ResultDetails }) {
  if (!details.definition && !details.height && !details.allowedTime && !details.optimalTime && !details.rounds?.length) return null;
  const field = (label: string, value?: string) => value ? <div className="min-w-0"><dt className="block text-xs text-neutral-500">{label}</dt><dd className="block font-semibold break-words">{value}</dd></div> : null;
  return <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-start gap-x-6 gap-y-3 text-sm text-neutral-700" aria-label="Condiciones de la prueba">
    {(details.definition || details.height) && <dl className="grid grid-cols-2 gap-x-6 gap-y-3 w-full sm:w-auto sm:flex sm:flex-wrap">{field('Definición', details.definition)}{field('Altura', details.height)}</dl>}
    {(details.allowedTime || details.optimalTime) && <dl className="grid grid-cols-2 gap-x-6 gap-y-3 w-full sm:w-auto sm:flex sm:flex-wrap">{field('Tiempo acordado', details.allowedTime)}{field('Tiempo óptimo', details.optimalTime)}</dl>}
    {details.rounds?.map((round,i) => <div key={i} className="w-full sm:w-auto"><p className="font-semibold text-[#123E59]">{round.label}</p><dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:flex sm:flex-wrap">{field('Tiempo acordado', round.allowedTime)}{field('Tiempo óptimo', round.optimalTime)}</dl></div>)}
  </div>;
}

export function ResultRows({ entries, columns: sourceColumns }: { entries: ResultEntry[]; columns: ResultColumn[] }) {
  const columns = resultDisplayColumns(sourceColumns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const region = scrollRef.current;
    if (!region) return;
    const measure = () => setScrollable(region.scrollWidth > region.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    if (region.firstElementChild) observer.observe(region.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [sourceColumns]);
  const groups = resultColumnGroups(columns);
  const grouped = groups.some(g => g.label);
  const value = (row: ResultEntry, key: string) => resultDisplayValue(row, columns.find(c => c.key === key)!);
  const metric = (col: ResultColumn) => {
    const label = col.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (label === 'faltas obstaculos') return { label: 'Obs.', width: 'var(--result-score-width)' };
    if (label === 'faltas tiempo') return { label: 'Tpo.', width: 'var(--result-score-width)' };
    if (label === 'total faltas') return { label: 'Tot.', width: 'var(--result-score-width)' };
    if (label === 'faltas') return { label: 'Faltas', width: 'var(--result-score-width)' };
    if (label === 'tiempo') return { label: 'Tpo.', width: 'var(--result-time-width)' };
    if (label === 'diferencia al optimo') return { label: 'Dif.', width: 'var(--result-time-width)' };
    if (label === 'total faltas de la prueba') return { label: 'Total', width: 'var(--result-total-width)' };
    return { label: col.label, width: 'var(--result-extra-width)' };
  };
  const header = (col: ResultColumn, rowSpan = 1) => <th key={col.key} scope="col" rowSpan={rowSpan} className="result-metric-heading" aria-label={col.label}><abbr title={col.label} className={`no-underline ${metric(col).label.length <= 7 ? 'whitespace-nowrap' : ''}`}>{metric(col).label}</abbr></th>;
  const style = { '--result-metrics-width': columns.length ? `calc(${columns.map(c => metric(c).width).join(' + ')})` : '0px' } as CSSProperties;
  return <div className="results-table-shell" style={style}>
    {scrollable && <p className="sm:hidden text-[11px] text-neutral-500 mb-2 text-right">Deslizá la tabla para ver todas las marcas →</p>}
    <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-neutral-200" role="region" aria-label="Resultados de la prueba: tabla desplazable" tabIndex={scrollable ? 0 : undefined}>
      <table className="results-table text-left">
        <caption className="sr-only">Puesto, caballo, jinete, club, categoría y resultados. Faltas: número informado o, cuando existe desglose, obstáculos más penalizaciones por tiempo entre paréntesis. Tpo.: tiempo del recorrido. Total: faltas finales. Dif.: diferencia al tiempo óptimo.</caption>
        <colgroup><col style={{ width: 'var(--result-place-width)' }} /><col />{columns.map(col => <col key={col.key} style={{ width: metric(col).width }} />)}</colgroup>
        <thead className="bg-[#123E59] text-white"><tr>
          <th scope="col" rowSpan={grouped ? 2 : 1} className="result-place result-frozen-heading" aria-label="Puesto" />
          <th scope="col" rowSpan={grouped ? 2 : 1} className="result-person result-frozen-heading"><span className="sm:grid sm:grid-cols-2 sm:gap-x-3"><span>Caballo<span className="sm:hidden"> / Jinete</span></span><span className="hidden sm:inline">Jinete</span></span><span className="block text-[9px] sm:text-[10px] font-normal text-white/75 mt-0.5">Club · Categoría</span></th>
          {groups.map((group,i) => group.label ? <th key={i} scope="colgroup" colSpan={group.columns.length} className="result-group-heading">{group.label}</th> : <Fragment key={i}>{group.columns.map(col => header(col, grouped ? 2 : 1))}</Fragment>)}
        </tr>{grouped && <tr>{groups.filter(g => g.label).flatMap(g => g.columns).map(col => header(col))}</tr>}</thead>
        <tbody>{entries.map((row, index) => <tr key={row.position} className={`group ${index > 0 && (row.category || '').trim().toLocaleLowerCase() !== (entries[index - 1].category || '').trim().toLocaleLowerCase() ? 'result-category-start' : ''}`}>
          <td className={`result-place result-frozen-cell tabular-nums ${row.qualified === true ? 'text-[#A61E4D] font-bold' : 'text-neutral-500'}`} aria-label={row.qualified === true ? `Puesto ${row.rank || ''}, clasificado` : undefined}>{row.rank || ''}</td>
          <td className="result-person result-frozen-cell"><div className="grid gap-y-0.5 sm:grid-cols-2 sm:gap-x-3"><p className="font-bold text-[#123E59] [overflow-wrap:anywhere]">{row.horse}</p><p className="text-neutral-700 [overflow-wrap:anywhere]">{row.rider}</p>{(row.club || row.category) && <p className="sm:col-span-2 mt-0.5 text-[10px] sm:text-[11px] text-neutral-500 [overflow-wrap:anywhere]">{row.club}{row.club && row.category ? ' · ' : ''}{row.category}</p>}</div></td>
          {columns.map(col => <td key={col.key} className="result-metric-cell tabular-nums" title={col.label}>{value(row, col.key)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
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

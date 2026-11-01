import { useEffect, useMemo, useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { supabase } from '../../lib/supabase';
import { riderDirectory, riderParticipations, searchRiders, suggestRiderAssociations, type RiderAssociation } from '../../utils/riders';
import type { ResultEntry, ResultVersion } from '../../utils/results';
import { ResultDetailsPanel, ResultRows } from './ResultsView';
import { eventPath } from '../../utils/navigation';
import { ChevronDown } from 'lucide-react';

export function RiderSearch({ admin = false }: { admin?: boolean }) {
  const data = useEquestrian();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [associations, setAssociations] = useState<RiderAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const [reviewSources, setReviewSources] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    void (async () => {
      const rows: RiderAssociation[] = [];
      for (let offset = 0; ; offset += 500) {
        const response = await supabase.from('rider_associations').select('source,identity').order('source').range(offset, offset + 499);
        if (!current) return;
        if (response.error) { setError('No pudimos verificar las asociaciones de jinetes. Reintentá para consultar datos seguros.'); setLoading(false); return; }
        rows.push(...response.data);
        if (response.data.length < 500) break;
      }
      if (current) { setAssociations(rows); setLoading(false); setChecked([]); setReviewSources([]); }
    })().catch(() => { if (current) { setError('No pudimos cargar el buscador. Reintentá.'); setLoading(false); } });
    return () => { current = false; };
  }, [reload, data.session]);
  const directory = useMemo(() => riderDirectory(data.events, data.classes, data.startHeads, data.startVersions, data.resultHeads, data.resultVersions, associations), [data.events, data.classes, data.startHeads, data.startVersions, data.resultHeads, data.resultVersions, associations]);
  const matches = searchRiders(directory, query);
  const suggestions = useMemo(() => admin ? suggestRiderAssociations(directory) : [], [admin, directory]);
  const visibleSuggestions = suggestions.filter(s => !query.trim() || s.candidates.some(c => matches.some(m => m.id === c.id)));
  const reviewRecords = directory.flatMap(c => c.records).filter(r => reviewSources.includes(r.source) || checked.includes(r.source) || matches.some(c => c.records.some(row => row.source === r.source)));
  useEffect(() => { if (reviewSources.length) document.getElementById('rider-association-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [reviewSources]);
  const candidate = directory.find(c => c.id === selected);
  const participations = candidate ? riderParticipations(candidate) : [];
  const events = data.events.filter(e => participations.some(p => data.classes.some(c => c.id === p.classId && c.eventId === e.id))).sort((a,b) => b.startDate.localeCompare(a.startDate));
  const failure = error || data.dataError || data.startListsError || data.resultsError || data.scheduleError;
  const correct = async (reset = false) => {
    if (!data.isAdmin || !checked.length || reason.trim().length < 3) return;
    setBusy(true);
    try {
      const identity = crypto.randomUUID();
      const response = reset ? await supabase.from('rider_associations').delete().in('source', checked) : await supabase.from('rider_associations').upsert(checked.map(source => ({ source, identity, reason: reason.trim() })));
      if (response.error) throw response.error;
      setSelected(null); setReason(''); setReload(n => n + 1);
    } catch { setError('No pudimos guardar la corrección. Reintentá.'); }
    finally { setBusy(false); }
  };
  return <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8" aria-label="Buscador de jinetes">
    <h1 className="text-2xl sm:text-3xl font-bold text-[#123E59]">{admin ? 'Asociaciones de jinetes' : 'Buscar jinetes'}</h1>
    <label className="block mt-6 font-semibold" htmlFor="rider-query">Nombre o apellido</label>
    <input id="rider-query" type="search" autoComplete="off" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} placeholder="Escribí un nombre o apellido…" className="mt-2 w-full min-h-12 border border-neutral-300 rounded-xl px-4 bg-white" />
    {failure ? <div role="alert" className="mt-6">{failure}<button className="ml-3 min-h-11 underline" onClick={() => { setReload(n => n + 1); void data.refreshData(); }}>Reintentar</button></div> : loading || data.isLoading ? <p role="status" className="mt-6">Cargando buscador…</p> : <>
      {admin ? <section className="mt-6" aria-label="Sugerencias de asociaciones">
        <h2 className="text-xl font-bold text-[#123E59]">Posibles coincidencias</h2>
        <p className="mt-2 text-sm text-neutral-600">Revisá si estos registros corresponden a la misma persona. Al confirmarlos, sus distintos caballos aparecerán juntos en el buscador.</p>
        <p role="status" className="mt-3 text-sm">{visibleSuggestions.length ? `${visibleSuggestions.length} sugerencias para revisar` : 'No hay sugerencias pendientes con estos datos.'}</p>
        <div className="mt-4 space-y-4">{visibleSuggestions.map(s => <article key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="font-semibold text-[#A61E4D]">{s.reasons.join(' · ')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{s.candidates.map(c => <div key={c.id} className="rounded-lg bg-neutral-50 p-3"><h3 className="font-bold text-[#123E59]">{c.name}</h3><p className="text-sm mt-1">{c.horses.join(' · ') || 'Caballo no informado'}</p><p className="text-sm text-neutral-500">{c.clubs.join(' · ') || 'Club no informado'}</p><p className="text-xs mt-1 text-neutral-500">{new Set(c.records.map(r => data.classes.find(cls => cls.id === r.classId)?.eventId)).size} concursos · {c.records.length} registros{c.id.startsWith('manual:') ? ' · Asociación confirmada' : ''}</p></div>)}</div>
          <button disabled={busy} onClick={() => { const sources = s.candidates.flatMap(c => c.records.map(r => r.source)); setReviewSources(sources); setChecked(sources); setReason(s.reasons.join(' · ')); }} className="min-h-11 mt-3 px-4 rounded-lg border border-[#123E59] text-[#123E59] font-semibold">Revisar asociación</button>
        </article>)}</div>
      </section> : !query.trim() ? <p className="mt-8 text-neutral-500">Escribí para encontrar jinetes.</p> : !candidate ? <div className="mt-6">
        <p role="status">{matches.length ? `${matches.length} coincidencias. Seleccioná el jinete correcto.` : 'No hay coincidencias en los datos publicados.'}</p>
        <ul className="mt-4 space-y-3">{matches.map(c => <li key={c.id}><button onClick={() => setSelected(c.id)} className="text-left w-full rounded-xl border border-neutral-200 bg-white p-4 hover:border-[#123E59] min-h-16"><span className="block font-bold text-[#123E59]">{c.name}</span><span className="block text-sm mt-1">{c.horses.join(' · ') || 'Caballo no informado'}</span><span className="block text-sm text-neutral-500">{c.clubs.join(' · ') || 'Club no informado'}</span></button></li>)}</ul>
      </div> : <div className="mt-6">
        <button onClick={() => setSelected(null)} className="underline min-h-11 text-[#123E59]">Volver al buscador</button>
        <h2 className="text-xl font-bold text-[#123E59]">{candidate.name}</h2>
        {events.map(event => <details key={`${candidate.id}:${event.id}`} className="group/contest mt-6 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
          <summary className="flex items-center justify-between gap-3 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span><span className="block font-bold text-lg text-[#123E59]">{event.name}</span><span className="block text-sm text-neutral-500">{event.venue} · {event.startDate.split('-').reverse().join('/')}</span></span>
            <ChevronDown aria-hidden="true" className="w-5 h-5 shrink-0 text-[#123E59] transition-transform group-open/contest:rotate-180" />
          </summary>
          {participations.filter(p => data.classes.some(c => c.id === p.classId && c.eventId === event.id)).sort((a,b) => { const ca = data.classes.find(c => c.id === a.classId)!; const cb = data.classes.find(c => c.id === b.classId)!; return ca.date.localeCompare(cb.date) || ca.order - cb.order; }).map(p => {
            const entry = data.classes.find(c => c.id === p.classId)!;
            const row = (p.start || p.result)!.row;
            const result = p.result?.version as ResultVersion | undefined;
            return <article key={p.id} className="border-t border-neutral-200 pt-4 mt-4">
              <h4 className="font-semibold">Prueba {entry.number} · {entry.name}</h4>
              <p className="text-sm text-neutral-500">{entry.date.split('-').reverse().join('/')} · {data.arenas.find(a => a.id === entry.arenaId)?.name}</p>
              <p className="mt-2">{row.horse || 'Caballo no informado'}{row.category ? ` · ${row.category}` : ''}</p>
              <p className="font-semibold text-[#123E59]">{p.start ? `Orden de ingreso: ${p.start.row.position}` : 'Sin orden de ingreso asociado'}</p>
              {p.start && <a className="inline-block text-sm underline min-h-11 content-center" href={`${eventPath(event)}/start-list/${entry.id}`}>Ver listado</a>}
              {p.result && result && <details className="mt-2"><summary className="cursor-pointer min-h-11 content-center font-semibold text-[#A61E4D]">Ver actuación</summary><ResultDetailsPanel details={result.details} /><div className="mt-4"><ResultRows entries={[p.result.row as ResultEntry]} columns={result.columns} /></div><a className="inline-block min-h-11 content-center text-sm underline" href={`${eventPath(event)}/results/${entry.id}`}>Ver resultados de la prueba</a></details>}
            </article>;
          })}
        </details>)}
      </div>}
      {admin && data.isAdmin && (!!matches.length || !!reviewSources.length || !!checked.length) && <section id="rider-association-review" className="mt-8 border rounded-xl p-4 bg-white scroll-mt-20">
        <h2 className="font-bold">Corregir asociaciones</h2><p className="text-sm mt-2">Marcá todos los registros que sabés que son de la misma persona. Para separarlos del grupo provisional, marcá solo los de esa persona y guardá una nueva asociación. Esto no modifica los PDFs ni vincula actuaciones diferentes.</p>
        <p role="status" className="mt-3 font-semibold">{checked.length} registros seleccionados</p>
        <div className="max-h-96 overflow-y-auto mt-3">{reviewRecords.map(r => { const cls = data.classes.find(c => c.id === r.classId)!; return <label key={r.source} className="flex gap-3 py-3 border-t text-sm"><input type="checkbox" checked={checked.includes(r.source)} onChange={e => setChecked(v => e.target.checked ? [...v, r.source] : v.filter(s => s !== r.source))} /><span>{r.row.rider} · {r.row.horse || 'Sin caballo'} · {r.row.club} · {data.events.find(e => e.id === cls.eventId)?.name} · {cls.date} · Prueba {cls.number} · {r.kind === 'start' ? 'Orden' : 'Resultado'} {r.row.position}</span></label>; })}</div>
        <label className="block mt-3">Motivo de la corrección<input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className="block border rounded-lg px-3 min-h-11 w-full" /></label>
        <button disabled={busy || !checked.length || reason.trim().length < 3} onClick={() => void correct()} className="min-h-11 px-3 mt-3 bg-[#123E59] text-white rounded-lg disabled:opacity-40">Asociar selección a una persona</button>
        <button disabled={busy || !checked.length || reason.trim().length < 3} onClick={() => void correct(true)} className="min-h-11 px-3 mt-3 underline disabled:opacity-40">Restaurar agrupación provisional</button>
      </section>}
    </>}
  </section>;
}

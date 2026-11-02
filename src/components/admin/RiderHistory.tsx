import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
interface Change { id: number; operation: string; source: string; before_row: { canonical_name?: string; reason?: string } | null; after_row: { canonical_name?: string; reason?: string } | null; actor: string | null; created_at: string; reverses_operation: string | null }
export function RiderHistory({ revision, onChange }: { revision: number; onChange: () => void }) {
  const [rows, setRows] = useState<Change[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void (async () => {
      const all: Change[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await supabase.from('rider_association_history').select('*').order('id', { ascending: false }).range(offset, offset + 499);
        if (!active) return;
        if (r.error) { setError('No pudimos cargar el historial.'); setLoading(false); return; }
        all.push(...r.data);
        if (r.data.length < 500) break;
      }
      setRows(all); setLoading(false);
    })();
    return () => { active = false; };
  }, [revision]);
  const operations = [...new Set(rows.map(r => r.operation))];
  const revert = async (operation: string) => {
    if (!window.confirm('¿Revertir esta asociación y recuperar la agrupación anterior? Los órdenes y resultados originales se conservan.')) return;
    setBusy(true); setError('');
    try { const r = await supabase.rpc('revert_rider_association', { target_operation: operation }); if (r.error) throw r.error; onChange(); }
    catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'No pudimos revertir la asociación.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-10 border-t pt-6" aria-label="Historial de asociaciones">
    <h2 className="text-xl font-bold text-[#123E59]">Historial de asociaciones</h2>
    <p className="text-sm mt-2 text-neutral-600">Se registran los cambios realizados desde esta actualización.</p>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {loading ? <p role="status">Cargando historial…</p> : !rows.length ? <p className="mt-4">Todavía no hay cambios registrados.</p> : operations.slice(0,limit).map(operation => {
      const changes = rows.filter(r => r.operation === operation), first = changes[0];
      const reverted = rows.some(r => r.reverses_operation === operation);
      return <details key={operation} className="mt-4 p-4 border rounded-xl bg-white">
        <summary className="cursor-pointer min-h-11 font-semibold">{first.after_row?.canonical_name || first.before_row?.canonical_name || 'Agrupación original'} · {new Date(first.created_at).toLocaleString('es-AR')} · {changes.length} registros{first.reverses_operation ? ' · Reversión' : reverted ? ' · Revertida' : ''}</summary>
        <p className="text-sm break-all">Responsable: {first.actor || 'Administrador'}</p>
        <p className="text-sm my-2">{first.after_row?.reason || first.before_row?.reason}</p>
        <ul className="max-h-64 overflow-auto text-sm space-y-2">{changes.map(c => <li key={c.id} className="break-all">{c.source}: {c.before_row?.canonical_name || 'Nombre original'} → {c.after_row?.canonical_name || 'Nombre original'}</li>)}</ul>
        {!first.reverses_operation && !reverted && <button disabled={busy} onClick={() => void revert(operation)} className="mt-3 min-h-11 px-4 border border-[#123E59] text-[#123E59] rounded-lg disabled:opacity-40">Revertir asociación</button>}
      </details>;
    })}
    {operations.length > limit && <button onClick={() => setLimit(n => n + 20)} className="min-h-11 underline">Ver más cambios</button>}
  </section>;
}

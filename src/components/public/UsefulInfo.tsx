import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';

interface Resource { id: string; title: string; url: string | null; sort_order: number; published: boolean }
export function safeResourceUrl(value: string | null): boolean {
  try { const u = new URL(value || ''); return ['https:', 'http:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password; } catch { return false; }
}
export function UsefulInfo({ admin = false }: { admin?: boolean }) {
  const { isAdmin, session } = useEquestrian();
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRows([]); setEditing(null);
    void (async () => {
      let query = supabase.from('useful_resources').select('*').order('sort_order').order('id');
      if (!admin) query = query.eq('published', true);
      const response = await query;
      if (!active) return;
      if (response.error) setError('No pudimos cargar la información útil. Reintentá.');
      else setRows(response.data);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [revision, admin, session]);
  const mutate = async (operation: () => PromiseLike<{ error: unknown }>) => {
    if (!admin || !isAdmin) return;
    setBusy(true); setError('');
    try { const response = await operation(); if (response.error) throw response.error; setEditing(null); setRevision(n => n + 1); }
    catch { setError('No pudimos guardar el cambio. Verificá tus permisos y reintentá.'); }
    finally { setBusy(false); }
  };
  if (admin && !isAdmin) return null;
  return <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
    <h1 className="text-2xl sm:text-3xl font-bold text-[#123E59]">Información útil</h1>
    {error && <p role="alert" className="mt-4 text-red-700">{error}<button onClick={() => setRevision(n => n + 1)} className="ml-3 min-h-11 underline">Reintentar</button></p>}
    {loading ? <p role="status" className="mt-6">Cargando…</p> : <>
      {admin && <button disabled={busy} onClick={() => setEditing({ title: '', url: '', sort_order: (rows.at(-1)?.sort_order || 0) + 10, published: false })} className="mt-6 min-h-11 px-4 bg-[#123E59] text-white rounded-lg">Nueva tarjeta</button>}
      {editing && <form className="mt-6 p-4 bg-white border rounded-xl space-y-4" onSubmit={e => {
        e.preventDefault();
        const url = editing.url?.trim() || null;
        if ((url && !safeResourceUrl(url)) || (editing.published && !url)) { setError('Ingresá una URL http o https válida antes de publicar.'); return; }
        const payload = { title: editing.title?.trim(), url, sort_order: Number(editing.sort_order), published: !!editing.published };
        void mutate(() => editing.id ? supabase.from('useful_resources').update(payload).eq('id', editing.id).select().single() : supabase.from('useful_resources').insert(payload));
      }}>
        <label className="block">Título<input required maxLength={150} value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} className="block border rounded-lg min-h-11 px-3 w-full" /></label>
        <label className="block">URL<input type="url" value={editing.url || ''} onChange={e => setEditing({ ...editing, url: e.target.value })} className="block border rounded-lg min-h-11 px-3 w-full" /></label>
        <label className="block">Orden<input type="number" required step="1" value={editing.sort_order ?? 0} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="block border rounded-lg min-h-11 px-3" /></label>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={!!editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />Publicada</label>
        <button disabled={busy} className="min-h-11 px-4 bg-[#123E59] text-white rounded-lg">Guardar</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="ml-3 min-h-11 px-4 underline">Cancelar</button>
      </form>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{rows.map(row => <article key={row.id}>
        {safeResourceUrl(row.url) ? <a href={row.url!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 p-6 min-h-24 rounded-xl border border-neutral-200 bg-white text-[#123E59] font-semibold hover:border-[#123E59] focus-visible:ring-2"><span>{row.title}</span><ExternalLink size={16} aria-hidden="true" /></a> : admin ? <div className="p-6 bg-white border rounded-xl font-semibold">{row.title}</div> : null}
        {admin && <div className="flex flex-wrap items-center gap-3 text-sm"><span>{row.sort_order} · {row.published ? 'Publicada' : row.url ? 'Oculta' : 'Pendiente de URL'}</span><button disabled={busy} className="min-h-11 underline" onClick={() => setEditing(row)}>Editar</button><button disabled={busy || (!row.url && !row.published)} className="min-h-11 underline" onClick={() => void mutate(() => supabase.from('useful_resources').update({ published: !row.published }).eq('id', row.id).select().single())}>{row.published ? 'Ocultar' : 'Publicar'}</button><button disabled={busy} className="min-h-11 underline text-red-700" onClick={() => { if (window.confirm(`¿Eliminar «${row.title}»?`)) void mutate(() => supabase.from('useful_resources').delete().eq('id', row.id).select().single()); }}>Eliminar</button></div>}
      </article>)}</div>
      {!rows.length && !error && <p className="mt-6 text-neutral-500">No hay recursos publicados.</p>}
    </>}
  </section>;
}

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { behaviors, type Behavior, type CatalogItem, type CatalogKind } from '../../utils/competitionCatalog';

const labels: Record<CatalogKind, string> = { rider: 'Categorías de jinetes', horse: 'Categorías de caballos', definition: 'Definiciones de prueba' };
const empty = { id: '', code: '', name: '', aliases: '', active: true, behavior: 'TD' as Behavior };
const field = 'mt-1 block w-full rounded border border-neutral-300 p-2';

export function CompetitionCatalogManager({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<CatalogKind>('rider');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const result = await supabase.from('competition_catalog').select('*').order('name');
    if (result.error) setError('No se pudo cargar el catálogo.');
    else setItems(result.data);
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const payload = {
      kind, name: draft.name.trim(), code: draft.code.trim().toUpperCase(), active: draft.active,
      behavior: kind === 'definition' ? draft.behavior : null,
      aliases: kind === 'definition' ? [] : draft.aliases.split(',').map(alias => alias.trim()).filter(Boolean),
    };
    try {
      const result = draft.id
        ? await supabase.from('competition_catalog').update(payload).eq('id', draft.id).select('id').single()
        : await supabase.from('competition_catalog').insert(payload).select('id').single();
      if (result.error) {
        setError(result.error.code === '23505' ? 'Ese código ya existe en este catálogo.' : 'No se pudo guardar la opción.');
        return;
      }
      setDraft(empty);
      await load();
    } finally {
      setBusy(false);
    }
  };
  return <main className="equidate-container space-y-4 py-6">
    <button className="text-sm font-semibold underline" onClick={onBack}>Volver a Administración</button>
    <h1 className="font-display text-2xl font-bold text-[#123E59]">Catálogos de pruebas</h1>
    <label className="block max-w-md text-sm">Catálogo
      <select className={field} disabled={busy} value={kind} onChange={event => { setKind(event.target.value as CatalogKind); setDraft(empty); setError(''); }}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <form onSubmit={save} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">{draft.id ? 'Editar opción' : 'Agregar opción'}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Nombre<input className={field} required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="text-sm">Código<input className={field} required maxLength={40} pattern="[A-Z0-9][A-Z0-9_\\-]{0,39}" value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></label>
        </div>
        {kind === 'definition' ? <label className="block text-sm">Comportamiento en el vivo
          <select className={field} value={draft.behavior} onChange={event => setDraft({ ...draft, behavior: event.target.value as Behavior })}>
            {Object.entries(behaviors).map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}
          </select>
        </label> : <label className="block text-sm">Equivalencias del orden de ingreso (separadas por comas)
          <input className={field} value={draft.aliases} onChange={event => setDraft({ ...draft, aliases: event.target.value })} />
        </label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} />Disponible para nuevas pruebas</label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-[#A61E4D] px-4 py-2 font-semibold text-white">Guardar</button>
          {draft.id && <button type="button" className="underline" onClick={() => setDraft(empty)}>Cancelar</button>}
        </div>
      </fieldset>
    </form>
    <ul className="divide-y rounded-xl border border-neutral-200 bg-white">
      {items.filter(item => item.kind === kind).map(item => <li key={item.id} className="flex items-center justify-between gap-3 p-3">
        <span>{item.code} · {item.name}{!item.active && ' (inactiva)'}</span>
        <button disabled={busy} className="text-sm font-semibold underline" onClick={() => {
          setDraft({ ...item, aliases: item.aliases.join(', '), behavior: item.behavior ?? 'TD' });
          setError('');
        }}>Editar</button>
      </li>)}
    </ul>
  </main>;
}

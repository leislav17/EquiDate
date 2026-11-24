import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { classTitle, hasSecondPart, type CatalogItem, type CatalogSelection, type ClassCatalog } from '../../utils/competitionCatalog';

export function CompetitionCatalogFields({ saved, value, onChange }: {
  saved?: ClassCatalog | null;
  value: CatalogSelection;
  onChange: (value: CatalogSelection) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void supabase.from('competition_catalog').select('*').order('name').then(result => {
      if (!active) return;
      if (result.error) setError('No se pudo cargar el catálogo de pruebas.');
      else setItems(result.data);
    });
    return () => { active = false; };
  }, []);

  const options = items.filter(item => item.active || item.id === saved?.definitionId || saved?.categoryIds.includes(item.id));
  const definition = options.find(item => item.id === value.definitionId) ?? (saved?.definitionId === value.definitionId ? saved?.definition : undefined);
  const set = (changes: Partial<CatalogSelection>) => onChange({ ...value, ...changes });
  const field = 'block w-full rounded border border-neutral-300 bg-white p-2';
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <label className="block text-sm">Definición de prueba
      <select className={field} required value={value.definitionId} onChange={event => {
        const item = options.find(option => option.id === event.target.value);
        set({ definitionId: event.target.value, secondHeightCm: hasSecondPart(item?.behavior) ? value.secondHeightCm : null });
      }}>
        <option value="">Seleccioná una definición</option>
        {options.filter(item => item.kind === 'definition').map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
      </select>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Altura {hasSecondPart(definition?.behavior) ? 'de la primera parte ' : ''}(cm)
        <input className={field} type="number" min="1" max="300" required value={value.heightCm || ''} onChange={event => set({ heightCm: Number(event.target.value) })} />
      </label>
      {hasSecondPart(definition?.behavior) && <label className="block text-sm">Altura de la segunda parte (cm, opcional)
        <input className={field} type="number" min="1" max="300" value={value.secondHeightCm ?? ''} onChange={event => set({ secondHeightCm: event.target.value ? Number(event.target.value) : null })} />
      </label>}
      <label className="block text-sm">Nombre especial (opcional)
        <input className={field} maxLength={120} value={value.specialName ?? ''} onChange={event => set({ specialName: event.target.value })} placeholder="Gran Premio República" />
      </label>
      <label className="block text-sm">Costo de inscripción (ARS, opcional)
        <input className={field} type="number" min="0" max="999999999" step="0.01" value={value.entryFee ?? ''} onChange={event => set({ entryFee: event.target.value ? Number(event.target.value) : null })} />
      </label>
    </div>
    {(['rider', 'horse'] as const).map(kind => <fieldset key={kind} className="rounded border border-neutral-200 p-2">
      <legend className="px-1 text-sm">Categorías del {kind === 'rider' ? 'jinete' : 'caballo'}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.filter(item => item.kind === kind).map(item => <label key={item.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.categoryIds.includes(item.id)} onChange={event =>
            set({ categoryIds: event.target.checked ? [...value.categoryIds, item.id] : value.categoryIds.filter(id => id !== item.id) })}
          />{item.name}{!item.active && ' (inactiva)'}
        </label>)}
      </div>
    </fieldset>)}
    {definition && value.heightCm > 0 && <p className="text-sm font-semibold">{classTitle(value, definition.code)}</p>}
  </div>;
}

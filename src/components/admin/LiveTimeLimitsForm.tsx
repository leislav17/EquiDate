import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  resolvePartTimes, timeGroup, type LiveTimeLimits, type Part, type TimeField,
} from '../../utils/liveTimeLimits';

type Props = {
  eventId: string;
  classId: string;
  height?: number;
  categories: (string | undefined)[];
  firstLabel: string;
  secondLabel?: string;
};

export function LiveTimeLimitsForm({ eventId, classId, height, categories, firstLabel, secondLabel }: Props) {
  const [saved, setSaved] = useState<LiveTimeLimits | null>(null);
  const [draft, setDraft] = useState<LiveTimeLimits>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void supabase.rpc('equidate_live_time_limits', { target_event: eventId, target_class: classId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError('No se pudieron obtener los tiempos.');
          return;
        }
        setSaved(data);
        setDraft(data);
        setError('');
      });
    return () => { active = false; };
  }, [eventId, classId, reload]);

  const groups = new Set(categories.map(category => timeGroup(category, height)));
  const hasSchool = groups.has('school');
  const hasThird = groups.has('third');
  const hasShared = (!hasSchool && !hasThird) || (height === 90 && groups.has('shared') && hasSchool && hasThird);
  const parts: [Part, string][] = [['1', firstLabel]];
  if (secondLabel) parts.push(['2', secondLabel]);

  const change = (part: Part, field: TimeField, raw: string) => {
    const value = Number(raw);
    if (raw && (!Number.isInteger(value) || value <= 0 || value > 999999)) return;
    setDraft(current => {
      const next = { ...current[part] };
      if (raw) next[field] = value;
      else delete next[field];
      return { ...current, [part]: next };
    });
    setMessage('');
  };

  const save = async () => {
    if (!saved || saving) return;
    const isCorrection = parts.some(([part]) => {
      const before = resolvePartTimes(saved[part], height);
      const after = resolvePartTimes(draft[part], height);
      return (['sharedAllowed', 'schoolAllowed', 'thirdAllowed'] as const)
        .some(field => before[field] != null && before[field] !== after[field]);
    });
    if (isCorrection && !window.confirm('El cambio recalculará las faltas por tiempo de los resultados ya cargados. ¿Guardar?')) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('equidate_live_time_limits', {
        target_event: eventId, target_class: classId, expected: saved, proposed: draft,
      });
      if (error) {
        if (error.code === '40001') {
          setError('Otra sesión cambió los tiempos. Volvé a cargarlos para revisar los valores actuales.');
          return;
        }
        throw error;
      }
      setSaved(data);
      setDraft(data);
      setMessage('Tiempos guardados. Se actualizaron las faltas por tiempo.');
    } catch {
      setError('No se pudieron guardar los tiempos. Volvé a intentar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mb-4 rounded-lg border border-neutral-200 p-3">
      <summary className="cursor-pointer font-semibold text-[#123E59]">Tiempo acordado</summary>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {error && <button type="button" className="mt-2 text-sm underline" onClick={() => setReload(value => value + 1)}>Volver a cargar tiempos</button>}
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      {saved && (
        <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
          {parts.map(([part, label]) => {
            const inputs = draft[part] ?? {};
            const resolved = resolvePartTimes(inputs, height);
            const input = (field: TimeField, title: string) => (
              <label className="block text-sm" key={field}>
                <span className="block font-medium">{title}</span>
                <input type="number" min="1" max="999999" step="1" disabled={saving}
                  className="mt-1 w-full rounded border border-neutral-300 p-2"
                  value={inputs[field] ?? ''} onChange={event => change(part, field, event.target.value)}
                  placeholder={resolved[field]?.toString()}
                  aria-describedby={resolved[field] != null && inputs[field] == null ? `${part}-${field}-suggestion` : undefined} />
                {resolved[field] != null && inputs[field] == null &&
                  <span id={`${part}-${field}-suggestion`} className="text-xs text-neutral-600">Sugerido · {resolved[field]} s</span>}
              </label>
            );
            return (
              <fieldset key={part} className="rounded border border-neutral-200 p-3">
                <legend className="px-1 text-sm font-semibold">{label}</legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(hasSchool || hasThird) && input('distance', 'Distancia (m, opcional)')}
                  {hasShared && input('sharedAllowed', 'Tiempo acordado (s)')}
                  {hasShared && input('sharedOptimal', 'Tiempo óptimo (s, opcional)')}
                  {hasSchool && input('schoolAllowed', 'Escuela · Acordado (s)')}
                  {hasSchool && input('schoolOptimal', 'Escuela · Óptimo (s)')}
                  {hasThird && input('thirdAllowed', 'Tercera · Acordado (s)')}
                  {hasThird && input('thirdOptimal', 'Tercera · Óptimo (s)')}
                </div>
              </fieldset>
            );
          })}
          <button type="submit" disabled={saving || JSON.stringify(saved) === JSON.stringify(draft)}
            className="rounded bg-[#A61E4D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar tiempos'}
          </button>
        </form>
      )}
    </details>
  );
}

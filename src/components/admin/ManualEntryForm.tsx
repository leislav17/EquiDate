import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { parseLiveEntryLabel } from '../../utils/liveEntryPosition';

export type LiveEntryEdit = { rider: string; horse: string; category?: string } &
  ({ id: string } | { position: number });

export function ManualEntryForm({ eventId, classId, versionId, row, done, cancel }: {
  eventId: string;
  classId: string;
  versionId: string;
  row?: LiveEntryEdit;
  done: () => void;
  cancel: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);

  return <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={async event => {
    event.preventDefault();
    if (submitLock.current) return;

    const fields = new FormData(event.currentTarget);
    const values = {
      rider: String(fields.get('rider') ?? '').trim(),
      horse: String(fields.get('horse') ?? '').trim(),
      category: String(fields.get('category') ?? '').trim(),
    };
    if (Object.values(values).some(value => !value || value.length > 160)) {
      setError('Completá jinete, caballo y categoría con hasta 160 caracteres cada uno.');
      return;
    }

    let entryLabel: string | null = null;
    if (!row) {
      try {
        entryLabel = parseLiveEntryLabel(String(fields.get('entryLabel') ?? ''));
      } catch {
        setError('Ingresá una letra, un número o un número seguido de bis.');
        return;
      }
    }

    const body = row
      ? {
        action: 'live_edit_entry', eventId, classId, startVersionId: versionId || null,
        manualId: 'id' in row ? row.id : null,
        position: 'id' in row ? null : row.position, row: values,
      }
      : { action: 'manual_save', eventId, classId, row: { ...values, id: crypto.randomUUID(), entry_label: entryLabel } };

    submitLock.current = true;
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await supabase.functions.invoke('external-assignments', { body });
      if (saveError || !data?.success) throw new Error();
      done();
    } catch {
      setError('No se pudo guardar el binomio. Revisá los datos e intentá nuevamente.');
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }}>
    {[
      { name: 'rider', label: 'Nombre y apellido del jinete', value: row?.rider, required: true },
      { name: 'horse', label: 'Caballo', value: row?.horse, required: true },
      { name: 'category', label: 'Categoría', value: row?.category, required: true },
      ...(!row ? [{ name: 'entryLabel', label: 'Orden de ingreso (opcional)', value: '', required: false }] : []),
    ].map(field => <label key={field.name} className="text-sm w-full sm:w-auto">{field.label}
      <input name={field.name} defaultValue={field.value ?? ''} required={field.required} maxLength={160}
        disabled={busy} className="block border rounded p-2 w-full sm:w-40 mt-1" />
    </label>)}
    <button type="submit" disabled={busy} className="rounded bg-[#123E59] text-white px-4 py-2 min-h-10 font-bold">
      {busy ? 'Guardando…' : 'Guardar binomio'}
    </button>
    <button type="button" disabled={busy} onClick={cancel} className="rounded px-4 py-2 min-h-10 font-bold text-[#123E59]">
      Cancelar
    </button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </form>;
}

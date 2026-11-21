import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { parseLiveEntryLabel } from '../../utils/liveEntryPosition';
import type { ManualEntry } from '../../utils/liveMatches';

export function ManualEntryForm({ eventId, classId, row, done }: {
  eventId: string;
  classId: string;
  row?: ManualEntry;
  twoPhases: boolean;
  done: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    let entryLabel: string | null;
    try {
      entryLabel = parseLiveEntryLabel(String(fields.get('entryLabel') ?? ''));
    } catch {
      setError('Ingresá una letra, un número o un número seguido de un espacio y bis.');
      return;
    }
    const values = {
      ...row,
      id: row?.id ?? crypto.randomUUID(),
      rider: String(fields.get('rider') ?? '').trim(),
      horse: String(fields.get('horse') ?? '').trim(),
      category: String(fields.get('category') ?? '').trim(),
      entry_label: entryLabel,
    };
    if (!values.rider || !values.horse || !values.category) {
      setError('Completá jinete, caballo y categoría.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: saveError } = await supabase.functions.invoke('external-assignments', {
      body: { action: 'manual_save', eventId, classId, edit: !!row, row: values },
    });
    setBusy(false);
    if (saveError || !data?.success) {
      setError('No se pudo guardar el binomio. Revisá los datos e intentá nuevamente.');
      return;
    }
    done();
  }}>
    {[
      { name: 'rider', label: 'Jinete', value: row?.rider, required: true },
      { name: 'horse', label: 'Caballo', value: row?.horse, required: true },
      { name: 'category', label: 'Categoría', value: row?.category, required: true },
      { name: 'entryLabel', label: 'Orden de ingreso (opcional)', value: row?.entry_label, required: false },
    ].map(field => <label key={field.name} className="text-sm w-full sm:w-auto">{field.label}
      <input name={field.name} defaultValue={field.value ?? ''} required={field.required}
        className="block border rounded p-2 w-full sm:w-40 mt-1" />
    </label>)}
    <button disabled={busy} className="w-full sm:w-auto rounded bg-[#123E59] text-white px-4 py-2 min-h-10 font-bold">
      {busy ? 'Guardando…' : 'Guardar binomio'}
    </button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </form>;
}

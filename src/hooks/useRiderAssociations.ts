import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RiderAssociation } from '../utils/riders';

export function useRiderAssociations(associationScope: string, reload = 0) {
  const [associations, setAssociations] = useState<RiderAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    void (async () => {
      const rows: RiderAssociation[] = [];
      for (let offset = 0; ; offset += 500) {
        const response = await supabase.from('rider_associations').select('source,identity,reason,canonical_name,name_variants').order('source').range(offset, offset + 499);
        if (!current) return;
        if (response.error) { setError('No pudimos verificar las asociaciones de jinetes. Reintentá para consultar datos seguros.'); setLoading(false); return; }
        rows.push(...response.data);
        if (response.data.length < 500) break;
      }
      if (current) { setAssociations(rows); setLoading(false); }
    })().catch(() => { if (current) { setError('No pudimos cargar el buscador. Reintentá.'); setLoading(false); } });
    return () => { current = false; };
  }, [reload, associationScope]);
  return { associations, loading, error, setError };
}

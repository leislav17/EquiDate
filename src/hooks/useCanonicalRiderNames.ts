import { useMemo } from 'react';
import { useEquestrian } from '../context/EquestrianContext';
import { sessionDataScope } from '../utils/navigationSession';
import { riderDirectory } from '../utils/riders';
import { useRiderAssociations } from './useRiderAssociations';

export function useCanonicalRiderNames() {
  const { session, events, classes, startHeads, startVersions, resultHeads, resultVersions } = useEquestrian();
  const { associations } = useRiderAssociations(sessionDataScope(session));
  return useMemo(() => {
    const names = new Map<string, string>();
    if (!associations.length) return names;
    const directory = riderDirectory(events, classes, startHeads, startVersions, resultHeads, resultVersions, associations);
    for (const { canonicalName, records } of directory) {
      if (!canonicalName) continue;
      for (const record of records) names.set(record.source, canonicalName);
    }
    return names;
  }, [events, classes, startHeads, startVersions, resultHeads, resultVersions, associations]);
}

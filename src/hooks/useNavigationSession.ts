import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readNavigationEntry, writeNavigationEntry } from '../utils/navigationSession';
import { persistNavigationScroll } from '../utils/navigationScroll';

/** The owner mounts with a stable competition ID. Data refreshes never reset this state. */
export function useCompetitionDisclosure(eventId: string | null, validDayIds: string[]) {
  const key = `event:${eventId}`;
  const [saved, setSaved] = useState(() => readNavigationEntry(key));
  const openDays = (saved?.open || []).filter(id => validDayIds.includes(id));
  const update = (patch: { open?: string[]; info?: boolean }) => {
    writeNavigationEntry(key, patch);
    setSaved(previous => ({ ...previous, ...patch, at: Date.now() }));
  };
  useEffect(() => {
    if (saved?.open?.some(id => !validDayIds.includes(id))) {
      writeNavigationEntry(key,{open:openDays}); setSaved(previous => ({ ...previous, open:openDays, at:Date.now() }));
    }
  }, [key, validDayIds.join('|')]);
  return { openDays, isInfoOpen: saved?.info || false,
    toggleDay: (id: string) => update({ open: openDays.includes(id) ? openDays.filter(day => day !== id) : [...openDays,id] }),
    toggleInfo: () => update({ info: !saved?.info }) };
}

/** Restore once per view, only after data and the open sections have rendered. */
export function useNavigationScroll(key: string | null, ready: boolean, route: string) {
  const restored = useRef<string | null>(null);
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    if (!key) { restored.current = null; return; }
    if (!ready) return;
    let storage;
    try { storage = window.sessionStorage; } catch { /* Safari private mode */ }
    return persistNavigationScroll(key, route, restored.current !== key, () => { restored.current = key; }, {
      window, document, storage, requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame, now: () => performance.now()
    });
  }, [key, ready, route]);
}

export function useSessionListSelection(key: string, valid: (selection: {kind:'structured'|'document';id:string}) => boolean) {
  const [saved, setSaved] = useState(() => readNavigationEntry(key)?.selection || null);
  const selection = saved && valid(saved) ? saved : null;
  useEffect(() => {
    if (saved && !valid(saved)) { writeNavigationEntry(key,{selection:null}); setSaved(null); }
  }, [key, saved, valid]);
  return [selection, (next: typeof selection) => { writeNavigationEntry(key,{selection:next}); setSaved(next); }] as const;
}

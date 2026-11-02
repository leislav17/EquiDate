import { readNavigationEntry, writeNavigationEntry, type NavigationStorage } from './navigationSession.ts';
import { BEFORE_NAVIGATION_EVENT } from './navigation.ts';

export interface ScrollEnvironment {
  window: Pick<Window, 'scrollY' | 'innerHeight' | 'location' | 'scrollTo' | 'addEventListener' | 'removeEventListener'>;
  document: Pick<Document, 'documentElement' | 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  requestFrame: typeof requestAnimationFrame;
  cancelFrame: typeof cancelAnimationFrame;
  now: () => number;
  storage?: NavigationStorage;
}
export function persistNavigationScroll(key: string, route: string, restore: boolean, onRestored: () => void, env: ScrollEnvironment): () => void {
  const { window: win, document: doc } = env;
  let restoring = restore;
  const target = restore ? readNavigationEntry(key,env.storage)?.scroll || 0 : win.scrollY;
  let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const started = env.now();
  const save = () => {
    if (!restoring && win.location.pathname + win.location.hash === route) writeNavigationEntry(key, { scroll: Math.round(win.scrollY) }, env.storage);
  };
  const tick = () => {
    if (cancelled) return;
    const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
    if (max >= target || env.now() - started >= 2000) {
      win.scrollTo({ top: Math.min(target, max), behavior: 'instant' });
      restoring = false; onRestored();
    } else frame = env.requestFrame(tick);
  };
  // A user's gesture always takes priority over a delayed restoration.
  const cancel = () => { cancelled = true; env.cancelFrame(frame); restoring = false; onRestored(); };
  const scroll = () => { clearTimeout(timer); timer = setTimeout(save,120); };
  const hidden = () => { if (doc.visibilityState === 'hidden') save(); };
  if (restoring) frame = env.requestFrame(tick);
  win.addEventListener('scroll',scroll,{passive:true});
  win.addEventListener('pagehide',save);
  win.addEventListener(BEFORE_NAVIGATION_EVENT,save);
  doc.addEventListener('visibilitychange',hidden);
  for (const name of ['touchstart','wheel','pointerdown','keydown']) win.addEventListener(name,cancel,{passive:true});
  return () => {
    cancelled = true; env.cancelFrame(frame); clearTimeout(timer);
    win.removeEventListener('scroll',scroll); win.removeEventListener('pagehide',save);
    win.removeEventListener(BEFORE_NAVIGATION_EVENT,save); doc.removeEventListener('visibilitychange',hidden);
    for (const name of ['touchstart','wheel','pointerdown','keydown']) win.removeEventListener(name,cancel);
  };
}

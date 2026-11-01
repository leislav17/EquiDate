export const GA_ID = 'G-1XF2L5PCZH';

export interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

/** GA's Enhanced Measurement owns pageviews. Never send manual page_view events. */
export function createAnalytics(send: (...args: unknown[]) => void) {
  let initialized = false;
  return (location: string, environment: string) => {
    if (initialized) return;
    initialized = true;
    send('js', new Date());
    send('config', GA_ID, { page_location: location, environment });
  };
}

let track: ReturnType<typeof createAnalytics> | undefined;
export function trackPage(location: string) {
  const target = window as Window & AnalyticsWindow;
  if (!track) {
    target.dataLayer = target.dataLayer || [];
    target.gtag = target.gtag || function () { target.dataLayer!.push(arguments); };
    track = createAnalytics(target.gtag);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(script);
  }
  track(location, import.meta.env.VITE_SUPABASE_URL?.includes('slophgtrynlfesjonbzf') ? 'test' : 'production');
}

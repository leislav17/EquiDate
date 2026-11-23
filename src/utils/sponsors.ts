import type { SponsorCategory, SponsorItem, SponsorPlacement, SponsorVariant } from '../types/equestrian';
import { getArgentinaTodayStr } from './dateUtils.ts';

export type SponsorSlot = 'home_footer' | 'event_detail' | 'listings_footer';

export interface SponsorGroup {
  category: SponsorCategory | null;
  items: SponsorItem[];
}

export const SPONSOR_PLACEMENT_LABELS: Record<SponsorPlacement, string> = {
  all: 'Todo el sitio público',
  home: 'Solo portada principal',
  listings_footer: 'Pie de listados, resultados y buscador',
  event_detail: 'Página del concurso',
};

export const SPONSOR_VARIANT_LABELS: Record<SponsorVariant, string> = {
  logo_card: 'Tarjeta con logo',
  banner: 'Banner horizontal',
};

export function normalizeSponsorCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function safeSponsorUrl(value?: string | null): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export function isSponsorActiveOnDate(
  sponsor: Pick<SponsorItem, 'active' | 'startsAt' | 'endsAt'>,
  todayStr: string = getArgentinaTodayStr()
): boolean {
  if (!sponsor.active) return false;
  if (sponsor.startsAt && todayStr < sponsor.startsAt) return false;
  if (sponsor.endsAt && todayStr > sponsor.endsAt) return false;
  return true;
}

function sortSponsors(items: SponsorItem[]): SponsorItem[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);
  });
}

export function sortSponsorCategories(categories: SponsorCategory[]): SponsorCategory[] {
  return [...categories].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);
  });
}

export function groupSponsorsByCategory(
  items: SponsorItem[],
  categories: SponsorCategory[]
): SponsorGroup[] {
  if (items.length === 0) return [];

  const orderedCategories = sortSponsorCategories(categories);
  const categoryIds = new Set(orderedCategories.map((c) => c.id));
  const buckets = new Map<string, SponsorItem[]>();
  const uncategorized: SponsorItem[] = [];

  for (const item of items) {
    if (item.categoryId && categoryIds.has(item.categoryId)) {
      const existing = buckets.get(item.categoryId);
      if (existing) existing.push(item);
      else buckets.set(item.categoryId, [item]);
    } else {
      uncategorized.push(item);
    }
  }

  const groups: SponsorGroup[] = [];
  for (const category of orderedCategories) {
    const groupItems = buckets.get(category.id);
    if (groupItems && groupItems.length > 0) {
      groups.push({ category, items: groupItems });
    }
  }

  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }

  return groups;
}

export interface ResolveSponsorsOptions {
  slot: SponsorSlot;
  eventId?: string | null;
  hideGlobalSponsors?: boolean;
  todayStr?: string;
}

/**
 * Resuelve qué sponsors activos y vigentes deben mostrarse en cada espacio público.
 * - home_footer: sponsors globales con ubicación 'home' o 'all'.
 * - event_detail: sponsors propios del concurso; si no tiene y no oculta globales, muestra globales 'all'.
 * - listings_footer: sponsors propios del concurso (si aplica) + globales 'listings_footer'/'all' salvo que el concurso oculte globales.
 */
export function resolveSponsorsForSlot(
  sponsors: SponsorItem[],
  options: ResolveSponsorsOptions
): SponsorItem[] {
  const todayStr = options.todayStr || getArgentinaTodayStr();
  const activeSponsors = sponsors.filter((sponsor) => isSponsorActiveOnDate(sponsor, todayStr));

  if (options.slot === 'home_footer') {
    return sortSponsors(
      activeSponsors.filter(
        (s) => s.scope === 'global' && (s.placement === 'home' || s.placement === 'all')
      )
    );
  }

  const eventSponsors = options.eventId
    ? sortSponsors(activeSponsors.filter((s) => s.scope === 'event' && s.eventId === options.eventId))
    : [];

  const globalListingSponsors = sortSponsors(
    activeSponsors.filter(
      (s) => s.scope === 'global' && (s.placement === 'listings_footer' || s.placement === 'all')
    )
  );

  const globalAllSponsors = sortSponsors(
    activeSponsors.filter((s) => s.scope === 'global' && s.placement === 'all')
  );

  if (options.slot === 'event_detail') {
    if (eventSponsors.length > 0) return eventSponsors;
    if (options.hideGlobalSponsors) return [];
    return globalAllSponsors;
  }

  // listings_footer (StartListView, ResultsView, LiveResultsView, RiderSearch)
  if (options.eventId && options.hideGlobalSponsors) {
    return eventSponsors;
  }

  if (eventSponsors.length > 0) {
    return [...eventSponsors, ...globalListingSponsors];
  }

  return globalListingSponsors;
}

/**
 * Resuelve todos los sponsors globales activos y vigentes para la página directorio "Sponsors EquiDate".
 */
export function resolveDirectorySponsors(
  sponsors: SponsorItem[],
  todayStr: string = getArgentinaTodayStr()
): SponsorItem[] {
  return sortSponsors(
    sponsors.filter(
      (sponsor) => sponsor.scope === 'global' && isSponsorActiveOnDate(sponsor, todayStr)
    )
  );
}

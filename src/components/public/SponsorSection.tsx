import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { SponsorItem } from '../../types/equestrian';
import {
  groupSponsorsByCategory,
  resolveSponsorsForSlot,
  safeSponsorUrl,
  SponsorSlot,
} from '../../utils/sponsors';

interface SponsorSectionProps {
  slot: SponsorSlot;
  eventId?: string | null;
  hideGlobalSponsors?: boolean;
  className?: string;
}

export const SponsorCardTile: React.FC<{ sponsor: SponsorItem; compact?: boolean }> = ({
  sponsor,
  compact = false,
}) => {
  const hasLink = safeSponsorUrl(sponsor.targetUrl);
  const desktopImg = sponsor.imageUrl;
  const mobileImg = sponsor.mobileImageUrl || sponsor.imageUrl;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [desktopImg, mobileImg]);

  if (sponsor.variant === 'banner') {
    const content = (
      <div
        className={`w-fit max-w-full mx-auto sm:mx-0 bg-white border border-neutral-200/80 rounded-2xl overflow-hidden transition-colors duration-150 ${
          hasLink ? 'hover:border-[#123E59]/50 cursor-pointer' : ''
        }`}
      >
        {imgFailed ? (
          <div className="px-4 py-3 flex items-center gap-2 text-xs font-semibold text-neutral-600 bg-neutral-50">
            <ImageIcon className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
            <span>{sponsor.name}</span>
          </div>
        ) : mobileImg !== desktopImg ? (
          <>
            <img
              src={mobileImg}
              alt={sponsor.name}
              title={sponsor.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="sm:hidden block w-auto max-w-full max-h-24 h-auto object-contain"
            />
            <img
              src={desktopImg}
              alt={sponsor.name}
              title={sponsor.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="hidden sm:block w-auto max-w-full max-h-32 h-auto object-contain"
            />
          </>
        ) : (
          <img
            src={desktopImg}
            alt={sponsor.name}
            title={sponsor.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="block w-auto max-w-full max-h-24 sm:max-h-32 h-auto object-contain"
          />
        )}
      </div>
    );

    if (hasLink) {
      return (
        <a
          href={sponsor.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`${sponsor.name} — Visitar sitio del sponsor`}
          className="block w-fit max-w-full mx-auto sm:mx-0 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123E59] rounded-2xl"
        >
          {content}
        </a>
      );
    }

    return content;
  }

  const cardInner = (
    <div
      className={`w-fit max-w-full rounded-2xl overflow-hidden border border-neutral-200/80 inline-flex items-center justify-center transition-colors duration-150 ${
        hasLink ? 'hover:border-[#123E59]/50 cursor-pointer' : ''
      }`}
    >
      {imgFailed ? (
        <div className="px-3 py-2 flex items-center gap-2 text-xs font-semibold text-neutral-600 bg-neutral-50">
          <ImageIcon className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
          <span>{sponsor.name}</span>
        </div>
      ) : (
        <img
          src={desktopImg}
          alt={sponsor.name}
          title={sponsor.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`block w-auto h-auto max-w-[180px] sm:max-w-[220px] ${
            compact ? 'max-h-14 sm:max-h-16' : 'max-h-16 sm:max-h-20'
          }`}
        />
      )}
    </div>
  );

  if (hasLink) {
    return (
      <a
        href={sponsor.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`${sponsor.name} — Visitar sitio del sponsor`}
        className="inline-flex min-h-[44px] min-w-[44px] max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123E59] rounded-2xl"
      >
        {cardInner}
      </a>
    );
  }

  return cardInner;
};

export const SponsorSection: React.FC<SponsorSectionProps> = ({
  slot,
  eventId,
  hideGlobalSponsors,
  className = '',
}) => {
  const { sponsors, sponsorsAvailable, sponsorCategories } = useEquestrian();

  const items = useMemo(() => {
    if (!sponsorsAvailable || sponsors.length === 0) return [];
    return resolveSponsorsForSlot(sponsors, {
      slot,
      eventId,
      hideGlobalSponsors,
    });
  }, [sponsors, sponsorsAvailable, slot, eventId, hideGlobalSponsors]);

  const groups = useMemo(
    () => groupSponsorsByCategory(items, sponsorCategories),
    [items, sponsorCategories]
  );

  if (groups.length === 0) return null;

  const isCompact = slot === 'listings_footer';
  const hasCategorizedGroups = groups.some((group) => group.category !== null);

  return (
    <aside
      aria-label="Espacio patrocinado"
      className={`w-full min-w-0 pt-4 mt-6 border-t border-neutral-200/80 ${className}`}
    >
      <div className="flex items-center justify-end mb-3">
        <span className="text-[11px] text-neutral-400 font-medium">Espacio patrocinado</span>
      </div>

      <div className="space-y-5 min-w-0">
        {groups.map((group) => {
          const banners = group.items.filter((item) => item.variant === 'banner');
          const logoCards = group.items.filter((item) => item.variant !== 'banner');
          const groupTitle = group.category
            ? group.category.name
            : hasCategorizedGroups
            ? 'Otros'
            : null;

          return (
            <section
              key={group.category?.id ?? '__uncategorized__'}
              aria-label={groupTitle || 'Sponsors'}
              className="min-w-0"
            >
              {groupTitle && (
                <h3 className="text-xs sm:text-sm font-bold text-[#123E59]/80 mb-2.5 text-center sm:text-left">
                  {groupTitle}
                </h3>
              )}

              <div className="space-y-3 min-w-0">
                {banners.map((sponsor) => (
                  <SponsorCardTile key={sponsor.id} sponsor={sponsor} compact={isCompact} />
                ))}

                {logoCards.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 min-w-0">
                    {logoCards.map((sponsor) => (
                      <SponsorCardTile key={sponsor.id} sponsor={sponsor} compact={isCompact} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};

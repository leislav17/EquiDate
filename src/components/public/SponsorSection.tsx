import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { SponsorItem } from '../../types/equestrian';
import {
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

export const SponsorCardTile: React.FC<{ sponsor: SponsorItem }> = ({ sponsor }) => {
  const hasLink = safeSponsorUrl(sponsor.targetUrl);
  const desktopImg = sponsor.imageUrl;
  const mobileImg = sponsor.mobileImageUrl || sponsor.imageUrl;
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [desktopImg, mobileImg]);

  const cardInner = (
    <div
      className={`w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl overflow-hidden border border-neutral-200/80 flex items-center justify-center shrink-0 transition-colors duration-150 ${
        hasLink ? 'hover:border-[#123E59]/50 cursor-pointer' : ''
      }`}
    >
      {imgFailed ? (
        <div className="w-full h-full p-1.5 flex flex-col items-center justify-center gap-0.5 text-center text-[10px] font-semibold text-neutral-600 bg-neutral-50">
          <ImageIcon className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2 leading-tight">{sponsor.name}</span>
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
            className="sm:hidden block w-full h-full object-contain"
          />
          <img
            src={desktopImg}
            alt={sponsor.name}
            title={sponsor.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="hidden sm:block w-full h-full object-contain"
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
          className="block w-full h-full object-contain"
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
        className="inline-flex shrink-0 min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123E59] rounded-2xl"
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
  const { sponsors, sponsorsAvailable } = useEquestrian();

  const items = useMemo(() => {
    if (!sponsorsAvailable || sponsors.length === 0) return [];
    return resolveSponsorsForSlot(sponsors, {
      slot,
      eventId,
      hideGlobalSponsors,
    });
  }, [sponsors, sponsorsAvailable, slot, eventId, hideGlobalSponsors]);

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Sponsors de EquiDate"
      className={`w-full min-w-0 pt-4 mt-6 border-t border-neutral-200/80 ${className}`}
    >
      <div className="flex items-center justify-end mb-3">
        <span className="text-[11px] text-neutral-400 font-medium">Sponsors de EquiDate</span>
      </div>

      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 min-w-0">
        {items.map((sponsor) => (
          <SponsorCardTile key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>
    </aside>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { SponsorItem } from '../../types/equestrian';
import {
  groupSponsorsByCategory,
  resolveDirectorySponsors,
  safeSponsorUrl,
} from '../../utils/sponsors';

const SponsorDirectoryCard: React.FC<{ sponsor: SponsorItem }> = ({ sponsor }) => {
  const hasLink = safeSponsorUrl(sponsor.targetUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [sponsor.imageUrl]);

  const cardContent = (
    <article
      className={`inline-block w-fit max-w-full align-top bg-white border border-neutral-200/90 rounded-2xl overflow-hidden transition-colors duration-150 ${
        hasLink ? 'hover:border-[#123E59]/55 group' : ''
      }`}
    >
      <div className="bg-white overflow-hidden">
        {imgFailed ? (
          <div className="w-40 h-28 bg-neutral-50 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-neutral-500">
            <ImageIcon className="w-6 h-6 text-neutral-400" aria-hidden="true" />
            <span className="text-xs font-semibold line-clamp-2">{sponsor.name}</span>
          </div>
        ) : (
          <img
            src={sponsor.imageUrl}
            alt={sponsor.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="block w-auto h-auto max-w-full max-h-32 sm:max-h-44"
          />
        )}
      </div>

      <div className="w-0 min-w-full border-t border-neutral-100">
        <div className="p-2.5 sm:p-3 min-w-0">
          <div className="flex items-start justify-between gap-1.5 min-w-0">
            <h3 className="min-w-0 flex-1 text-xs sm:text-sm font-bold text-[#123E59] leading-snug break-words">
              {sponsor.name}
            </h3>
            {hasLink && (
              <ArrowUpRight
                className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#123E59] shrink-0 mt-0.5 transition-colors"
                aria-hidden="true"
              />
            )}
          </div>
          {sponsor.subtitle && (
            <p className="mt-1 text-[11px] sm:text-xs text-neutral-600 leading-snug break-words">
              {sponsor.subtitle}
            </p>
          )}
        </div>
      </div>
    </article>
  );

  if (hasLink) {
    return (
      <a
        href={sponsor.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`${sponsor.name} — Visitar sitio del sponsor`}
        className="inline-block w-fit max-w-full align-top min-h-[44px] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123E59]"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
};

export const SponsorsPage: React.FC = () => {
  const {
    sponsors,
    sponsorsAvailable,
    sponsorsError,
    sponsorCategories,
    isLoading,
  } = useEquestrian();

  const items = useMemo(() => {
    if (!sponsorsAvailable || sponsors.length === 0) return [];
    return resolveDirectorySponsors(sponsors);
  }, [sponsors, sponsorsAvailable]);

  const groups = useMemo(
    () => groupSponsorsByCategory(items, sponsorCategories),
    [items, sponsorCategories]
  );

  const hasCategorizedGroups = groups.some((group) => group.category !== null);

  return (
    <section className="equidate-container py-6 sm:py-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#123E59]">Sponsors EquiDate</h1>
        <p className="mt-1.5 text-sm sm:text-base text-neutral-600">
          Marcas y servicios del sector ecuestre que acompañan la plataforma.
        </p>
      </header>

      {sponsorsError && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {sponsorsError}
        </p>
      )}

      {isLoading ? (
        <p role="status" className="mt-6 text-sm text-neutral-500">
          Cargando sponsors…
        </p>
      ) : groups.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Todavía no hay sponsors publicados.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((group) => {
            const groupTitle = group.category
              ? group.category.name
              : hasCategorizedGroups
              ? 'Otros'
              : null;

            return (
              <section
                key={group.category?.id ?? '__uncategorized__'}
                aria-label={groupTitle || 'Sponsors EquiDate'}
                className="space-y-3"
              >
                {groupTitle && (
                  <h2 className="text-sm sm:text-base font-bold text-[#123E59] pb-1.5 border-b border-neutral-200/80">
                    {groupTitle}
                  </h2>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 items-start justify-items-center sm:justify-items-start">
                  {group.items.map((sponsor) => (
                    <SponsorDirectoryCard key={sponsor.id} sponsor={sponsor} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
};

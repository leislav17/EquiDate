import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import type { EquestrianEvent } from '../../types/equestrian';
import { formatDateRange } from '../../utils/dateUtils';

/** Shared administrative card for recent contests and the full management list. */
export function AdminCompetitionCard({ event, onSelect }: { event: EquestrianEvent; onSelect: (id: string) => void }) {
  const dateRangeText = formatDateRange(event.startDate, event.endDate);
  const isPublished = event.status === 'published';
  return (
    <div
      onClick={() => onSelect(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event.id);
        }
      }}
      className="bg-white border border-neutral-200/90 hover:border-[#123E59] rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
    >
      {/* Left: Fecha, Nombre, Club, Estado */}
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-[#123E59] tracking-wide">
            {dateRangeText}
          </span>
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
              isPublished
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {isPublished ? 'PUBLICADO' : 'BORRADOR'}
          </span>
        </div>

        <h3 className="font-display text-sm sm:text-base font-bold text-neutral-900 group-hover:text-[#123E59] transition-colors truncate">
          {event.name}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
          <MapPin className="w-3.5 h-3.5 text-[#123E59] shrink-0" />
          <span className="truncate">{event.venue}</span>
          {event.city && (
            <span className="text-neutral-400 font-normal truncate hidden xs:inline">
              · {event.city}
            </span>
          )}
        </div>
      </div>

      {/* Right: Acción limpia "Administrar →" */}
      <div className="flex items-center justify-end shrink-0">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#123E59] bg-neutral-100 group-hover:bg-[#123E59] group-hover:text-white rounded-xl transition-all shadow-2xs">
          <span>Administrar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
}

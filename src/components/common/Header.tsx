import React from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { ArrowLeft } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeView, setActiveView, setSelectedEventId } = useEquestrian();

  return (
    <header className="sticky top-0 z-40 bg-[#123E59] text-white shadow-sm border-b border-[#0e3247]">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand: Logo EquiDate + Vertical Divider + Tagline */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '';
              setSelectedEventId(null);
              setActiveView('public');
            }}
            className="flex items-center cursor-pointer select-none py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-lg transition-opacity hover:opacity-90 shrink-0"
            title="EquiDate — Inicio"
          >
            <img
              src="/equidate-logo.png"
              alt="EquiDate"
              className="h-10 sm:h-12 max-h-[44px] sm:max-h-[50px] w-auto object-contain block"
            />
          </button>

          {/* Vertical divider & Descriptor (hidden on mobile to preserve layout, shown on sm+) */}
          <div className="hidden sm:flex items-center gap-3 sm:gap-4 min-w-0">
            <div
              className="w-[2px] h-7 sm:h-8 bg-[#A61E4D] rounded-full shrink-0"
              aria-hidden="true"
            />
            <span className="text-white/90 text-[13px] sm:text-[14px] font-medium tracking-normal whitespace-nowrap select-none">
              Calendario de eventos hípicos
            </span>
          </div>
        </div>

        {/* Right side controls: only visible when in admin view to return to public */}
        <div className="flex items-center gap-2">
          {activeView === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveView('public')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Sitio Público</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

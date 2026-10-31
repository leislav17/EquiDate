import React from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { ArrowLeft } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeView, setActiveView, setSelectedEventId } = useEquestrian();
  const home = () => {
    window.location.hash = '';
    setSelectedEventId(null);
    setActiveView('public');
  };
  return <header className="sticky top-0 z-40 bg-[#123E59] text-white shadow-sm border-b border-[#0e3247]">
    <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <button type="button" onClick={home} title="EquiDate — Inicio" aria-label="EquiDate — Inicio" className="absolute left-1/2 -translate-x-1/2 min-h-11 flex items-center gap-2 sm:gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-white/30 hover:opacity-90">
        <svg viewBox="630 761 4075 3618" className="w-14 h-12" aria-hidden="true">
          <image href="/equidate-symbol.png" width="5225" height="5225" />
        </svg>
        <svg viewBox="153 1806 4787 1596" className="w-36 sm:w-44 h-12" aria-hidden="true">
          <image href="/equidate-wordmark.png" width="5225" height="5225" />
        </svg>
      </button>
      {activeView === 'admin' && <button type="button" onClick={() => setActiveView('public')} aria-label="Ver Sitio Público" className="ml-auto min-h-11 min-w-11 flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20">
        <ArrowLeft className="w-4 h-4" /><span className="hidden md:inline">Ver Sitio Público</span>
      </button>}
    </div>
  </header>;
};

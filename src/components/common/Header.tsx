import React, { useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { RotateCcw, Settings, ArrowLeft, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeView, setActiveView, setSelectedEventId, resetToDemoData } = useEquestrian();
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#123E59] text-white shadow-sm border-b border-[#0e3247]">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand: SALTO / ECUESTRE stacked modern athletic typography */}
        <button
          type="button"
          onClick={() => {
            setSelectedEventId(null);
            setActiveView('public');
          }}
          className="text-left group cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-8 bg-[#A61E4D] rounded-xs" />
            <div className="leading-tight font-display tracking-tight">
              <span className="block text-xs font-black tracking-widest text-[#93c5fd]">
                SALTO
              </span>
              <span className="block text-sm font-extrabold tracking-wider text-white">
                ECUESTRE
              </span>
            </div>
          </div>
        </button>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {activeView === 'admin' ? (
            /* When in Admin mode: obvious button to return to public site */
            <button
              type="button"
              onClick={() => setActiveView('public')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Sitio Público</span>
            </button>
          ) : (
            /* Public mode: clean & discreet secondary administration trigger */
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAdminMenu(!showAdminMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Menú de configuración y acceso administrativo"
              >
                <Settings className="w-4 h-4 text-white/70" />
                <span className="hidden sm:inline text-[11px] font-medium text-white/70">Gestión</span>
              </button>

              {/* Discrete dropdown popover */}
              {showAdminMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowAdminMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white text-neutral-900 rounded-xl shadow-xl border border-neutral-200 py-1.5 z-40 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminMenu(false);
                        setActiveView('admin');
                        setSelectedEventId(null);
                      }}
                      className="w-full px-3.5 py-2.5 text-left font-bold text-neutral-800 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-[#123E59]" />
                      <span>Panel de Administración</span>
                    </button>
                    <div className="h-px bg-neutral-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminMenu(false);
                        resetToDemoData();
                      }}
                      className="w-full px-3.5 py-2 text-left font-medium text-neutral-600 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Reiniciar Datos Demo</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

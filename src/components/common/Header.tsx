import React, { useEffect, useRef, useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { ArrowLeft, Menu, X } from 'lucide-react';
import type { EventDiscipline } from '../../types/equestrian';
import { disciplineLabels } from '../../utils/disciplines';
import { navigate } from '../../utils/navigation';

export const Header: React.FC<{ discipline?: EventDiscipline }> = ({ discipline }) => {
  const { activeView, setActiveView, isAdmin, logoutAdmin, routeLocation } = useEquestrian();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setOpen(false); }, [routeLocation]);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const go = (url: string) => {
    setOpen(false);
    navigate(url);
    window.scrollTo(0, 0);
  };
  return <header className="sticky top-0 z-40 bg-[#123E59] text-white shadow-sm border-b border-[#0e3247]">
    <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <button type="button" aria-label="Abrir menú" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(true)} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/10"><Menu size={24} /></button>
      <button type="button" onClick={() => go('/')} title="EquiDate — Inicio" aria-label="EquiDate — Inicio" className="absolute left-1/2 -translate-x-1/2 min-h-11 flex items-center gap-2 sm:gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-white/30 hover:opacity-90">
        <svg viewBox="630 761 4075 3618" className="w-14 h-12" aria-hidden="true">
          <image href="/equidate-symbol.png" width="5225" height="5225" />
        </svg>
        <span className="w-[2px] h-8 shrink-0 rounded-full bg-[#A61E4D]" aria-hidden="true" />
        <svg viewBox="153 1806 4787 1596" className="w-36 sm:w-44 h-12" aria-hidden="true">
          <image href="/equidate-wordmark.png" width="5225" height="5225" />
        </svg>
      </button>
      {activeView === 'admin' && <button type="button" onClick={() => setActiveView('public')} aria-label="Ver Sitio Público" className="ml-auto min-h-11 min-w-11 flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20">
        <ArrowLeft className="w-4 h-4" /><span className="hidden md:inline">Ver Sitio Público</span>
      </button>}
    </div>
    {discipline && discipline !== 'training' && (
      <nav aria-label="Disciplinas" className="bg-white text-[#123E59] border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2">
          {(['jumping', 'dressage'] as const).map(section => (
            <a key={section} href={`/${section}`} aria-current={discipline === section ? 'page' : undefined}
              onClick={e => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                go(`/${section}`);
              }}
              className={`flex min-h-11 items-center justify-center border-b-2 px-2 text-sm font-bold ${discipline === section ? 'border-[#123E59]' : 'border-transparent text-neutral-600 hover:bg-neutral-50'}`}>
              {disciplineLabels[section]}
            </a>
          ))}
        </div>
      </nav>
    )}
    <dialog id="main-menu" ref={dialog} aria-labelledby="menu-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={e => { if (e.target === dialog.current) setOpen(false); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-black/40 p-0 backdrop:bg-transparent text-neutral-900">
      <div className="h-full w-[min(85vw,340px)] bg-[#123E59] text-white p-5 shadow-xl overflow-y-auto">
        <div className="relative flex justify-center items-center pb-5 border-b-2 border-[#A61E4D]">
          <h2 id="menu-title" className="sr-only">Menú de EquiDate</h2>
          <svg viewBox="630 761 4075 3618" className="w-20 h-20" role="img" aria-label="EquiDate">
            <image href="/equidate-symbol.png" width="5225" height="5225" />
          </svg>
          <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute right-0 top-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/10"><X /></button>
        </div>
        <nav aria-label="Menú principal" className="mt-6 flex flex-col gap-2">
          <p className="px-3 text-xs uppercase tracking-wider text-white/60">Público</p>
          <button onClick={() => go('/')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Inicio</button>
          <button onClick={() => go('/training')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Pasadas</button>
          <button onClick={() => go('/buscar/jinetes')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Buscar jinetes</button>
          <button onClick={() => go('/informacion-util')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Información útil</button>
          {isAdmin && <><p className="px-3 mt-4 pt-4 border-t border-white/20 text-xs uppercase tracking-wider text-white/60">Administración</p><button onClick={() => go('/admin')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Panel de administración</button><button onClick={() => go('/admin/concursos')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Gestionar concursos</button><button onClick={() => go('/admin/jinetes')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Asociaciones de jinetes</button><button onClick={() => go('/admin/informacion-util')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Gestionar información útil</button><button onClick={() => { void logoutAdmin().then(() => setOpen(false)).catch(() => window.alert('No pudimos cerrar la sesión. Reintentá.')); }} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Cerrar sesión</button></>}
        </nav>
      </div>
    </dialog>
  </header>;
};

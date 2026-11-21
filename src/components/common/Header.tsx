import React, { useEffect, useRef, useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { ArrowLeft, ChevronDown, Menu, UserRound, X } from 'lucide-react';
import type { EventDiscipline } from '../../types/equestrian';
import { disciplineLabels } from '../../utils/disciplines';
import { navigate } from '../../utils/navigation';

export const Header: React.FC<{ discipline?: EventDiscipline }> = ({ discipline }) => {
  const { activeView, setActiveView, isAdmin, session, logoutAdmin, routeLocation } = useEquestrian();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const userMenu = useRef<HTMLDivElement>(null);
  const isExternal = !isAdmin && session?.user?.app_metadata?.equidate_external === true;
  useEffect(() => { setOpen(false); setUserMenuOpen(false); }, [routeLocation]);
  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!userMenu.current?.contains(event.target as Node)) setUserMenuOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setUserMenuOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [userMenuOpen]);
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
  return <header className={`sticky top-0 z-40 bg-[#123E59] text-white shadow-sm border-b ${discipline && discipline !== 'training' ? 'border-neutral-200/90' : 'border-[#0e3247]'}`}>
    <div className="relative equidate-container h-16 flex items-center justify-between">
      <button type="button" aria-label="Abrir menú" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(true)} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"><Menu size={24} /></button>
      <button type="button" onClick={() => go('/')} title="EquiDate — Inicio" aria-label="EquiDate — Inicio" className={`${isExternal ? 'flex-1 min-w-0 justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2' : 'absolute left-1/2 -translate-x-1/2'} min-h-11 flex items-center gap-1.5 sm:gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-white/30 hover:opacity-90`}>
        <svg viewBox="630 761 4075 3618" className={isExternal ? 'w-8 sm:w-14 h-12 shrink-0' : 'w-11 sm:w-14 h-12 shrink-0'} aria-hidden="true">
          <image href="/equidate-symbol.png" width="5225" height="5225" />
        </svg>
        <span className="w-[2px] h-8 shrink-0 rounded-full bg-[#A61E4D]" aria-hidden="true" />
        <svg viewBox="153 1806 4787 1596" className={isExternal ? 'w-20 sm:w-44 h-12 shrink-0' : 'w-28 sm:w-44 h-12 shrink-0'} aria-hidden="true">
          <image href="/equidate-wordmark.png" width="5225" height="5225" />
        </svg>
      </button>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {isExternal && <div ref={userMenu} className="relative">
          <button type="button" aria-label={`Cuenta de ${session?.user?.email || 'usuario externo'}`} aria-expanded={userMenuOpen} aria-controls="external-user-menu" onClick={() => setUserMenuOpen(value => !value)} className="min-h-11 flex items-center gap-1 px-1 sm:px-2 rounded-lg text-xs font-bold hover:bg-white/10">
            <UserRound className="w-4 h-4 shrink-0" /><span className="max-w-[65px] sm:max-w-[160px] truncate">{session?.user?.email || 'Usuario'}</span><ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
          {userMenuOpen && <div id="external-user-menu" className="absolute right-0 top-full mt-1 min-w-44 bg-white text-neutral-800 border border-neutral-200 rounded-xl shadow-lg p-1 z-50">
            <button type="button" onClick={() => { setUserMenuOpen(false); void logoutAdmin().catch(() => window.alert('No pudimos cerrar la sesión. Reintentá.')); }} className="w-full text-left px-4 py-3 rounded-lg text-sm hover:bg-neutral-100">Cerrar sesión</button>
          </div>}
        </div>}
        {activeView === 'admin' && <button type="button" onClick={() => setActiveView('public')} aria-label="Ver Sitio Público" className="min-h-11 min-w-11 flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20">
          <ArrowLeft className="w-4 h-4" /><span className="hidden md:inline">Ver Sitio Público</span>
        </button>}
      </div>
    </div>
    {discipline && discipline !== 'training' && (
      <nav aria-label="Disciplinas" className="bg-white text-[#123E59] border-t border-neutral-200">
        <div className="equidate-container grid grid-cols-2">
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
          {!isAdmin && session?.user?.app_metadata?.equidate_external === true && <><p className="px-3 mt-4 pt-4 border-t border-white/20 text-xs uppercase tracking-wider text-white/60">Mi cuenta</p><button onClick={() => go('/admin/mis-concursos')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Mis concursos</button><button onClick={() => { void logoutAdmin().then(() => setOpen(false)).catch(() => window.alert('No pudimos cerrar la sesión. Reintentá.')); }} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Cerrar sesión</button></>}
          {isAdmin && <><p className="px-3 mt-4 pt-4 border-t border-white/20 text-xs uppercase tracking-wider text-white/60">Administración</p><button onClick={() => go('/admin')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Panel de administración</button><button onClick={() => go('/admin/concursos')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Gestionar concursos</button><button onClick={() => go('/admin/jinetes')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Asociaciones de jinetes</button><button onClick={() => go('/admin/informacion-util')} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Gestionar información útil</button><button onClick={() => { void logoutAdmin().then(() => setOpen(false)).catch(() => window.alert('No pudimos cerrar la sesión. Reintentá.')); }} className="text-left min-h-12 rounded-lg px-3 hover:bg-white/10">Cerrar sesión</button></>}
        </nav>
      </div>
    </dialog>
  </header>;
};

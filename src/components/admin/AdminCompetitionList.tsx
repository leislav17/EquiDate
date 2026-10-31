import React, { useState, useMemo, useEffect } from 'react';
import { EquestrianEvent } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { formatDateRange, getArgentinaTodayStr, MONTHS_FULL, getArgentinaDate } from '../../utils/dateUtils';
import {
  Plus,
  Search,
  RotateCcw,
  Calendar,
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface AdminCompetitionListProps {
  onSelectEvent: (eventId: string) => void;
  onNewEvent: () => void;
}

const STORAGE_KEY = 'equidate_admin_filters_v2';
const ITEMS_PER_PAGE = 10;

export const AdminCompetitionList: React.FC<AdminCompetitionListProps> = ({
  onSelectEvent,
  onNewEvent,
}) => {
  const {
    events,
    isBackendConnected,
    session,
    logoutAdmin,
  } = useEquestrian();

  const argentinaTodayStr = useMemo(() => getArgentinaTodayStr(), []);
  const argentinaDate = useMemo(() => getArgentinaDate(), []);

  // Load saved state from sessionStorage
  const savedState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [search, setSearch] = useState<string>(savedState?.search || '');
  const [period, setPeriod] = useState<'upcoming' | 'past' | 'all'>(savedState?.period || 'upcoming');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>(savedState?.status || 'all');
  const [yearFilter, setYearFilter] = useState<string>(savedState?.yearFilter || '');
  const [monthFilter, setMonthFilter] = useState<number>(
    typeof savedState?.monthFilter === 'number' ? savedState.monthFilter : -1
  );
  const [currentPage, setCurrentPage] = useState<number>(savedState?.currentPage || 1);

  // Restore scroll position after mount
  useEffect(() => {
    if (savedState?.scrollY && typeof window !== 'undefined') {
      setTimeout(() => {
        window.scrollTo({ top: savedState.scrollY, behavior: 'instant' });
      }, 50);
    }
  }, [savedState]);

  // Save state to sessionStorage whenever filters or page change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          search,
          period,
          status,
          yearFilter,
          monthFilter,
          currentPage,
          scrollY: window.scrollY,
        })
      );
    } catch {}
  }, [search, period, status, yearFilter, monthFilter, currentPage]);

  // Derived available years from all events
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(argentinaDate.year);
    events.forEach((evt) => {
      const sy = parseInt(evt.startDate.slice(0, 4), 10);
      const ey = parseInt(evt.endDate.slice(0, 4), 10);
      if (!isNaN(sy)) set.add(sy);
      if (!isNaN(ey)) set.add(ey);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [events, argentinaDate.year]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((evt) => {
      // 1. Text search
      if (q) {
        const matchesName = evt.name.toLowerCase().includes(q);
        const matchesVenue = evt.venue.toLowerCase().includes(q);
        const matchesCity = (evt.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesVenue && !matchesCity) return false;
      }

      // 2. Status filter
      if (status !== 'all' && evt.status !== status) {
        return false;
      }

      // 3. Period filter (upcoming / past / all)
      if (period === 'upcoming') {
        // En curso o futuro: fecha fin >= hoy en Argentina
        if (evt.endDate < argentinaTodayStr) return false;
      } else if (period === 'past') {
        // Anterior: fecha fin < hoy en Argentina
        if (evt.endDate >= argentinaTodayStr) return false;
      }

      // 4. Year filter
      if (yearFilter) {
        const yr = parseInt(yearFilter, 10);
        const sYear = parseInt(evt.startDate.slice(0, 4), 10);
        const eYear = parseInt(evt.endDate.slice(0, 4), 10);
        if (sYear > yr || eYear < yr) return false;
      }

      // 5. Month filter (0..11)
      if (monthFilter >= 0) {
        const start = new Date(evt.startDate + 'T00:00:00');
        const end = new Date(evt.endDate + 'T00:00:00');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

        const effectiveYear = yearFilter ? parseInt(yearFilter, 10) : start.getFullYear();
        const targetStart = new Date(effectiveYear, monthFilter, 1);
        const targetEnd = new Date(effectiveYear, monthFilter + 1, 0);

        if (start > targetEnd || end < targetStart) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort upcoming ascending by start date, past descending by start date
      if (period === 'past') {
        return b.startDate.localeCompare(a.startDate);
      }
      return a.startDate.localeCompare(b.startDate);
    });
  }, [events, search, status, period, yearFilter, monthFilter, argentinaTodayStr]);

  // Pagination calculation
  const totalItems = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedEvents = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, safeCurrentPage]);

  const handleResetFilters = () => {
    setSearch('');
    setPeriod('upcoming');
    setStatus('all');
    setYearFilter('');
    setMonthFilter(-1);
    setCurrentPage(1);
  };

  const handleSelectEvent = (id: string) => {
    // Save current scroll position before leaving
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            search,
            period,
            status,
            yearFilter,
            monthFilter,
            currentPage: safeCurrentPage,
            scrollY: window.scrollY,
          })
        );
      } catch {}
    }
    onSelectEvent(id);
  };

  const isFilterActive =
    search.trim().length > 0 ||
    period !== 'upcoming' ||
    status !== 'all' ||
    yearFilter !== '' ||
    monthFilter !== -1;

  return (
    <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-64px)] pb-16">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ======================================================== */}
        {/* CABECERA PRINCIPAL                                       */}
        {/* ======================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                Gestión de Concursos
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                  isBackendConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {isBackendConnected ? 'Supabase configurado' : 'Sin conexión'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Administrá concursos, jornadas, pruebas, transmisiones y documentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {session && (
              <button
                type="button"
                onClick={() => void logoutAdmin()}
                className="px-3.5 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Sesión
              </button>
            )}

            <button
              type="button"
              onClick={onNewEvent}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ NUEVO CONCURSO</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL DE FILTROS INDEPENDIENTES                          */}
        {/* ======================================================== */}
        <section className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre del concurso, club o ciudad…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
            />
          </div>

          {/* Selectores de filtros en cuadrícula */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
            {/* 1. Período */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Período
              </label>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#123E59]"
              >
                <option value="upcoming">Próximos y en curso</option>
                <option value="past">Concursos anteriores</option>
                <option value="all">Todos los períodos</option>
              </select>
            </div>

            {/* 2. Estado */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#123E59]"
              >
                <option value="all">Todos (publicados y borradores)</option>
                <option value="published">Solo publicados</option>
                <option value="draft">Solo borradores</option>
              </select>
            </div>

            {/* 3. Año */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Año
              </label>
              <select
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#123E59]"
              >
                <option value="">Todos los años</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Mes */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                Mes
              </label>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-800 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#123E59]"
              >
                <option value={-1}>Todos los meses</option>
                {MONTHS_FULL.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botón para restablecer filtros */}
          {isFilterActive && (
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <span className="text-xs text-neutral-500 font-medium">
                Filtros activos · {totalItems} resultado{totalItems === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#123E59] hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer filtros</span>
              </button>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* LISTADO SIMPLE Y ELEGANTE DE CONCURSOS                   */}
        {/* ======================================================== */}
        <div className="space-y-3">
          {paginatedEvents.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-neutral-200/90 rounded-2xl shadow-xs">
              <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2.5" />
              <h3 className="font-display font-bold text-base text-neutral-800">
                No se encontraron concursos
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                No hay resultados para los filtros seleccionados. Probá modificando el período, buscando otro término o restableciendo la búsqueda.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#123E59] bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer filtros</span>
              </button>
            </div>
          ) : (
            paginatedEvents.map((evt) => {
              const dateRangeText = formatDateRange(evt.startDate, evt.endDate);
              const isPublished = evt.status === 'published';

              return (
                <div
                  key={evt.id}
                  onClick={() => handleSelectEvent(evt.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectEvent(evt.id);
                    }
                  }}
                  className="bg-white border border-neutral-200/90 hover:border-[#123E59] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
                >
                  {/* Left: Fecha, Nombre, Club, Estado */}
                  <div className="space-y-1.5 flex-1 min-w-0">
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

                    <h3 className="font-display text-base sm:text-lg font-bold text-neutral-900 group-hover:text-[#123E59] transition-colors truncate">
                      {evt.name}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#123E59] shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                      {evt.city && (
                        <span className="text-neutral-400 font-normal truncate hidden xs:inline">
                          · {evt.city}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Acción limpia "Administrar →" */}
                  <div className="flex items-center justify-end sm:pl-4 border-t sm:border-t-0 border-neutral-100 pt-3 sm:pt-0 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#123E59] bg-neutral-100 group-hover:bg-[#123E59] group-hover:text-white rounded-xl transition-all shadow-2xs">
                      <span>Administrar</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ======================================================== */}
        {/* CONTROLES DE PAGINACIÓN                                  */}
        {/* ======================================================== */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs text-neutral-500 font-medium order-2 sm:order-1">
              Página {safeCurrentPage} de {totalPages} · {totalItems} concursos en total
            </span>

            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  // Show max 5 page buttons around current
                  if (
                    totalPages > 7 &&
                    Math.abs(pNum - safeCurrentPage) > 2 &&
                    pNum !== 1 &&
                    pNum !== totalPages
                  ) {
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pNum === safeCurrentPage
                          ? 'bg-[#123E59] text-white'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

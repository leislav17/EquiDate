import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import {
  MONTHS_FULL,
  formatCardDate,
  getEventTemporalStatus,
  getDaysBetween,
  getArgentinaTodayStr,
  getArgentinaDate,
} from '../../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  List as ListIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  MapPin,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { EquestrianEvent } from '../../types/equestrian';

export const CompetitionList: React.FC = () => {
  const {
    events,
    activeYear,
    setActiveYear,
    selectedMonth,
    setSelectedMonth,
    setSelectedEventId
  } = useEquestrian();

  // Current Argentina date
  const argentinaTodayStr = useMemo(() => getArgentinaTodayStr(), []);
  const argentinaDate = useMemo(() => getArgentinaDate(), []);

  // View mode: 'list' (default for mobile) | 'calendar'
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Filters expandable state (collapsed by default)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

  // Available years dynamically derived from published events
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(argentinaDate.year);
    events.forEach((evt) => {
      if (evt.status === 'published') {
        const sYear = new Date(evt.startDate + 'T00:00:00').getFullYear();
        const eYear = new Date(evt.endDate + 'T00:00:00').getFullYear();
        if (!isNaN(sYear)) years.add(sYear);
        if (!isNaN(eYear)) years.add(eYear);
      }
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [events, argentinaDate.year]);

  // Filter published events matching selected year and month, or upcoming default
  const filteredEvents = useMemo(() => {
    return events
      .filter((evt) => {
        if (evt.status !== 'published') return false;
        const start = new Date(evt.startDate + 'T00:00:00');
        const end = new Date(evt.endDate + 'T00:00:00');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

        // 1. MODO POR DEFECTO: PRÓXIMOS CONCURSOS
        if (selectedMonth === -2) {
          // Concursos cuya fecha de finalización sea igual o posterior a la fecha actual en Argentina.
          // Incluye los que ya comenzaron pero todavía no finalizaron (endDate >= argentinaTodayStr).
          // No limitado al mes actual: también aparecen los concursos de los próximos meses y años.
          // Los concursos finalizados no aparecen.
          return evt.endDate >= argentinaTodayStr;
        }

        // 2. FILTRO POR AÑO Y MES ESPECÍFICO
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();

        // Check year match
        if (startYear > activeYear || endYear < activeYear) {
          return false;
        }

        // If selectedMonth is -1, show all months in that year
        if (selectedMonth === -1) {
          return true;
        }

        // Check if event intersects selectedMonth in activeYear
        const targetDate = new Date(activeYear, selectedMonth, 1);
        const lastDayOfTarget = new Date(activeYear, selectedMonth + 1, 0);

        return start <= lastDayOfTarget && end >= targetDate;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, activeYear, selectedMonth, argentinaTodayStr]);

  // Find all current events (ACTUAL) across all published events regardless of filter
  const currentEvents = useMemo(() => {
    return events.filter(
      (evt) =>
        evt.status === 'published' &&
        getEventTemporalStatus(evt.startDate, evt.endDate) === 'ACTUAL'
    );
  }, [events]);

  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  // Compute active index safely based on activeEventId
  const activeIndex = useMemo(() => {
    if (currentEvents.length === 0) return 0;
    if (!activeEventId) return 0;
    const idx = currentEvents.findIndex((e) => e.id === activeEventId);
    return idx >= 0 ? idx : 0;
  }, [currentEvents, activeEventId]);

  // Keep selection stable when data updates and event is still available
  useEffect(() => {
    if (currentEvents.length === 0) {
      if (activeEventId !== null) setActiveEventId(null);
    } else if (!activeEventId || !currentEvents.some((e) => e.id === activeEventId)) {
      setActiveEventId(currentEvents[0].id);
    }
  }, [currentEvents, activeEventId]);

  const goToIndex = (newIndex: number) => {
    if (currentEvents.length === 0) return;
    const normalizedIndex =
      (newIndex + currentEvents.length) % currentEvents.length;
    setActiveEventId(currentEvents[normalizedIndex].id);
  };

  const handlePrev = () => goToIndex(activeIndex - 1);
  const handleNext = () => goToIndex(activeIndex + 1);

  // Touch gesture handling for smooth mobile swipe without vertical scroll interference
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingHorizontal = useRef<boolean>(false);
  const isSwipingVertical = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (currentEvents.length <= 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingHorizontal.current = false;
    isSwipingVertical.current = false;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      currentEvents.length <= 1
    ) {
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    if (!isSwipingHorizontal.current && !isSwipingVertical.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;

      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        // Vertical page scroll: don't intercept
        isSwipingVertical.current = true;
        return;
      } else {
        // Horizontal swipe gesture
        isSwipingHorizontal.current = true;
        isDragging.current = true;
      }
    }

    if (isSwipingHorizontal.current) {
      isDragging.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || currentEvents.length <= 1) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - touchStartX.current;

    if (isSwipingHorizontal.current && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isSwipingHorizontal.current = false;
    isSwipingVertical.current = false;
    setTimeout(() => {
      isDragging.current = false;
    }, 80);
  };

  const handleCardClick = (eventId: string) => {
    if (isDragging.current) return;
    setSelectedEventId(eventId);
  };

  // Reset filters action
  const handleResetFilters = () => {
    setActiveYear(argentinaDate.year);
    setSelectedMonth(-2); // Próximos concursos
  };

  // Month navigation for calendar:
  // If selectedMonth is -2 (upcoming) or -1 (all), calendarMonth defaults to current Argentina month
  const calendarMonth = selectedMonth >= 0 ? selectedMonth : argentinaDate.month;

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setActiveYear(activeYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setActiveYear(activeYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(calendarMonth + 1);
    }
  };

  // Events occurring in the active calendar month
  const calendarEvents = useMemo(() => {
    const firstDayOfMonth = new Date(activeYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(activeYear, calendarMonth + 1, 0);

    return events.filter((evt) => {
      if (evt.status !== 'published') return false;
      const start = new Date(evt.startDate + 'T00:00:00');
      const end = new Date(evt.endDate + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return start <= lastDayOfMonth && end >= firstDayOfMonth;
    });
  }, [events, activeYear, calendarMonth]);

  const calendarData = useMemo(() => {
    const firstDayOfMonth = new Date(activeYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(activeYear, calendarMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    // Monday as first day of week (0: Sun -> 6, 1: Mon -> 0)
    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      events: EquestrianEvent[];
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(calendarMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${activeYear}-${monthStr}-${dayStr}`;

      const eventsOnDay = calendarEvents.filter((evt) => {
        const daysSpan = getDaysBetween(evt.startDate, evt.endDate);
        return daysSpan.includes(dateStr);
      });

      days.push({
        dayNumber: day,
        dateStr,
        events: eventsOnDay
      });
    }

    return { days, startingDayOfWeek, daysInMonth };
  }, [activeYear, calendarMonth, calendarEvents]);

  // Formatted header string e.g. "PRÓXIMOS CONCURSOS", "OCTUBRE 2026" or "TODOS LOS MESES 2026"
  const filterTitle =
    selectedMonth === -2
      ? 'PRÓXIMOS CONCURSOS'
      : selectedMonth >= 0
      ? `${MONTHS_FULL[selectedMonth].toUpperCase()} ${activeYear}`
      : `TODOS LOS MESES ${activeYear}`;

  return (
    <div className="w-full bg-[#f4f6f8] min-h-[calc(100vh-64px)] pb-12">
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
        {/* ======================================================== */}
        {/* 1. HERO: EVENTOS ACTUALES DESTACADOS (Carrusel con bucle) */}
        {/* ======================================================== */}
        {currentEvents.length > 0 && (
          <section className="mb-6" aria-label="Concursos actuales destacados">
            <div className="relative group/carousel">
              {/* Carousel Viewport */}
              <div
                tabIndex={0}
                role="region"
                aria-label="Carrusel de concursos en curso"
                aria-roledescription="carousel"
                onKeyDown={(e) => {
                  if (currentEvents.length > 1) {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      handlePrev();
                      return;
                    }
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      handleNext();
                      return;
                    }
                  }
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleCardClick(currentEvents[activeIndex].id);
                  }
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }}
                className="relative overflow-hidden rounded-2xl bg-[#123E59] text-white shadow-md hover:shadow-xl transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93c5fd]"
              >
                {/* Horizontal slider track */}
                <div
                  className="flex transition-transform duration-300 ease-out motion-reduce:transition-none w-full"
                  style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                  {currentEvents.map((evt, idx) => (
                    <div
                      key={evt.id}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${idx + 1} de ${currentEvents.length}: ${evt.name}`}
                      aria-hidden={idx !== activeIndex}
                      inert={idx !== activeIndex}
                      onClick={() => handleCardClick(evt.id)}
                      className="w-full shrink-0 relative cursor-pointer group"
                    >
                      {/* Background Image with Dark Petrol Gradient Overlay */}
                      {evt.imageUrl ? (
                        <div className="absolute inset-0 z-0">
                          <img
                            src={evt.imageUrl}
                            alt=""
                            className="w-full h-full object-cover object-center opacity-35 group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0e3247] via-[#123E59]/85 to-[#123E59]/70" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#123E59] via-[#0f344b] to-[#0a2333]" />
                      )}

                      {/* Hero Content */}
                      <div
                        className={`relative z-10 py-5 sm:py-7 flex flex-col justify-between min-h-[190px] sm:min-h-[210px] ${
                          currentEvents.length > 1 ? 'px-8 sm:px-14' : 'px-5 sm:px-7'
                        }`}
                      >
                        {/* Top Badge: ACTUAL */}
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#A61E4D] text-white text-[11px] font-black tracking-wider uppercase shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>ACTUAL</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {currentEvents.length > 1 && (
                              <span className="text-[11px] font-bold text-white/90 bg-black/25 px-2 py-0.5 rounded-full font-mono">
                                {idx + 1} / {currentEvents.length}
                              </span>
                            )}
                            <span className="text-[11px] text-white/70 font-semibold tracking-wide hidden xs:inline">
                              En desarrollo hoy
                            </span>
                          </div>
                        </div>

                        {/* Center: Event Name */}
                        <div className="my-2">
                          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight group-hover:text-blue-100 transition-colors">
                            {evt.name}
                          </h2>
                        </div>

                        {/* Bottom: Location, Date & CTA button */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-3 border-t border-white/15">
                          <div className="space-y-1 text-xs sm:text-sm text-white/90">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-[#93c5fd] shrink-0" />
                              <span className="font-semibold">{evt.venue}</span>
                              {evt.city && (
                                <span className="text-white/70">· {evt.city}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-white/80">
                              <Clock className="w-4 h-4 text-[#93c5fd] shrink-0" />
                              <span>{formatCardDate(evt.startDate, evt.endDate)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick(evt.id);
                              }}
                              className="px-4 py-2 rounded-lg bg-white text-[#123E59] font-extrabold text-xs sm:text-sm shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>VER CONCURSO</span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Left and Right Navigation Arrows (only if multiple current events) */}
                {currentEvents.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                      }}
                      aria-label="Concurso anterior"
                      className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0e3247]/75 hover:bg-[#0e3247] text-white flex items-center justify-center border border-white/20 shadow-md backdrop-blur-xs transition-all cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                      }}
                      aria-label="Concurso siguiente"
                      className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0e3247]/75 hover:bg-[#0e3247] text-white flex items-center justify-center border border-white/20 shadow-md backdrop-blur-xs transition-all cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Indicators (only if multiple current events) */}
              {currentEvents.length > 1 && (
                <div
                  className="flex items-center justify-center gap-2 mt-3"
                  role="tablist"
                  aria-label="Selector de concurso en curso"
                >
                  {currentEvents.map((evt, idx) => (
                    <button
                      key={evt.id}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeIndex}
                      aria-label={`Ver concurso ${idx + 1} de ${currentEvents.length}: ${evt.name}`}
                      onClick={() => goToIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123E59] ${
                        idx === activeIndex
                          ? 'w-7 bg-[#123E59]'
                          : 'w-2 bg-neutral-300 hover:bg-neutral-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 2. NUEVA SECCIÓN DE FILTROS COMPACTA (Inspirada en Longines) */}
        {/* ======================================================== */}
        <section className="mb-4 bg-white border border-neutral-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs">
          {/* Collapsible Header */}
          <button
            type="button"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between text-left cursor-pointer select-none transition-colors group"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#123E59]" />
              <span className="font-display text-xs sm:text-sm font-black tracking-wider text-[#123E59] uppercase">
                FILTROS
              </span>
              {!isFiltersExpanded && (
                <span className="text-xs text-neutral-500 font-semibold truncate ml-1">
                  {selectedMonth === -2
                    ? '· Próximos concursos'
                    : `· ${activeYear} ${selectedMonth >= 0 ? `· ${MONTHS_FULL[selectedMonth]}` : '· Todos los meses'}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-[#123E59]">
              <span className="text-[11px] font-semibold text-neutral-500 hidden xs:inline">
                {isFiltersExpanded ? 'Ocultar' : 'Mostrar'}
              </span>
              {isFiltersExpanded ? (
                <ChevronUp className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              )}
            </div>
          </button>

          {/* Filters Body (Expandable) */}
          {isFiltersExpanded && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              {/* FILTRO 1: AÑO */}
              <div className="relative flex-1 sm:max-w-[170px]">
                <div className="relative flex items-center">
                  <select
                    value={activeYear}
                    onChange={(e) => setActiveYear(Number(e.target.value))}
                    className="w-full h-11 sm:h-12 pl-4 pr-10 rounded-xl bg-[#123E59] text-white text-xs sm:text-sm font-extrabold tracking-wider appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#93c5fd] transition-all shadow-xs"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr} className="bg-neutral-900 text-white py-1">
                        {yr}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white absolute right-3.5 pointer-events-none stroke-[2.5]" />
                </div>
              </div>

              {/* FILTRO 2: MES */}
              <div className="relative flex-1 sm:max-w-[240px]">
                <div className="relative flex items-center">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full h-11 sm:h-12 pl-4 pr-10 rounded-xl bg-[#123E59] text-white text-xs sm:text-sm font-extrabold tracking-wider appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#93c5fd] transition-all shadow-xs uppercase"
                  >
                    <option value={-2} className="bg-neutral-900 text-white py-1 font-bold">
                      PRÓXIMOS CONCURSOS
                    </option>
                    <option value={-1} className="bg-neutral-900 text-white py-1">
                      TODOS LOS MESES
                    </option>
                    {MONTHS_FULL.map((name, idx) => (
                      <option key={name} value={idx} className="bg-neutral-900 text-white py-1">
                        {name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white absolute right-3.5 pointer-events-none stroke-[2.5]" />
                </div>
              </div>

              {/* ACCIÓN: RESETEAR FILTROS */}
              <div className="flex items-center justify-end sm:justify-start pt-1 sm:pt-0 sm:ml-auto">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedMonth === -2 && activeYear === argentinaDate.year
                      ? 'text-neutral-400 bg-neutral-100/50 hover:bg-neutral-100'
                      : 'text-[#123E59] bg-neutral-100 hover:bg-neutral-200 shadow-2xs'
                  }`}
                  title="Resetear filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Resetear filtros</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 3. SELECTOR: LISTA | CALENDARIO (Debajo de los filtros)  */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Current filter heading */}
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="font-display text-sm sm:text-base font-black text-[#123E59] tracking-tight truncate">
              {filterTitle}
            </h3>
          </div>

          {/* Compact View Switcher */}
          <div className="flex items-center p-0.5 bg-neutral-200/90 rounded-lg text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap text-xs ${
                viewMode === 'list'
                  ? 'bg-[#123E59] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>LISTA</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap text-xs ${
                viewMode === 'calendar'
                  ? 'bg-[#123E59] text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>CALENDARIO</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. CARDS DE CONCURSOS O CALENDARIO                      */}
        {/* ======================================================== */}
        {viewMode === 'list' ? (
          <div className="space-y-3.5">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white border border-neutral-200/80 rounded-2xl shadow-xs">
                <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-neutral-700 text-sm font-semibold">
                  No se encontraron concursos para los filtros seleccionados.
                </p>
                <p className="text-neutral-400 text-xs mt-1">
                  Probá seleccionando &quot;Todos los meses&quot; o restablecé la búsqueda.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#123E59] bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer fecha actual</span>
                </button>
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const temporalStatus = getEventTemporalStatus(evt.startDate, evt.endDate);
                const isCurrent = temporalStatus === 'ACTUAL';
                const formattedDateStr = formatCardDate(evt.startDate, evt.endDate);

                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEventId(evt.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedEventId(evt.id);
                      }
                    }}
                    className="bg-white border border-neutral-200/80 hover:border-[#123E59] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                  >
                    {/* Left: Thumbnail (optional image) + Information */}
                    <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                      {/* Optional Event Image */}
                      {evt.imageUrl && (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-neutral-100 border border-neutral-200/70">
                          <img
                            src={evt.imageUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Content block: 1. Estado, 2. Nombre, 3. Ubicación, 4. Fecha */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* 1. ESTADO */}
                        <div className="flex items-center gap-2">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#A61E4D] text-white text-[10px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              ACTUAL
                            </span>
                          ) : temporalStatus === 'PROXIMO' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-[#123E59] text-[10px] font-extrabold uppercase tracking-wider">
                              PRÓXIMO
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                              FINALIZADO
                            </span>
                          )}
                        </div>

                        {/* 2. NOMBRE */}
                        <h4 className="font-display text-base sm:text-lg font-bold text-neutral-900 group-hover:text-[#123E59] transition-colors leading-snug truncate">
                          {evt.name}
                        </h4>

                        {/* 3. UBICACIÓN */}
                        <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[#123E59] shrink-0" />
                          <span className="truncate">{evt.venue}</span>
                          {evt.city && (
                            <span className="text-neutral-400 font-normal truncate hidden xs:inline">
                              · {evt.city}
                            </span>
                          )}
                        </div>

                        {/* 4. FECHA */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 font-mono">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{formattedDateStr}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Navigation indicator */}
                    <div className="flex items-center justify-end sm:pl-3 border-t sm:border-t-0 border-neutral-100 pt-2 sm:pt-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-[#123E59] text-neutral-500 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* CALENDAR VIEW                                           */
          /* ======================================================== */
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Calendar Month Navigation Header with Arrows */}
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-[#123E59] text-white border-b border-[#0e3247]">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label={`Mes anterior, ${calendarMonth === 0 ? MONTHS_FULL[11] : MONTHS_FULL[calendarMonth - 1]}`}
                className="p-2 sm:px-3 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white select-none shrink-0"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                <span className="hidden sm:inline text-xs font-bold uppercase">Anterior</span>
              </button>

              <div className="flex items-center gap-2 text-center select-none min-w-0">
                <CalendarIcon className="w-4 h-4 text-[#93c5fd] shrink-0 hidden xs:inline" />
                <span className="font-display text-sm sm:text-base md:text-lg font-black tracking-wide uppercase truncate">
                  {MONTHS_FULL[calendarMonth]} {activeYear}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label={`Mes siguiente, ${calendarMonth === 11 ? MONTHS_FULL[0] : MONTHS_FULL[calendarMonth + 1]}`}
                className="p-2 sm:px-3 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white select-none shrink-0"
              >
                <span className="hidden sm:inline text-xs font-bold uppercase">Siguiente</span>
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Calendar Day Header */}
            <div className="grid grid-cols-7 border-b border-neutral-200 bg-[#0e3247] text-[11px] font-extrabold text-white/90 text-center py-2 sm:py-2.5">
              <span>LUN</span>
              <span>MAR</span>
              <span>MIÉ</span>
              <span>JUE</span>
              <span>VIE</span>
              <span>SÁB</span>
              <span>DOM</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {Array.from({ length: calendarData.startingDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[75px] sm:min-h-[110px] bg-neutral-50/50 border-b border-r border-neutral-100 p-1"
                />
              ))}

              {calendarData.days.map((dayItem) => {
                const hasEvents = dayItem.events.length > 0;
                const isWeekend =
                  new Date(dayItem.dateStr + 'T00:00:00').getDay() === 0 ||
                  new Date(dayItem.dateStr + 'T00:00:00').getDay() === 6;

                return (
                  <div
                    key={dayItem.dateStr}
                    className={`min-h-[75px] sm:min-h-[110px] border-b border-r border-neutral-100 p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${
                      isWeekend ? 'bg-neutral-50/40' : 'bg-white'
                    } ${hasEvents ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold leading-none ${
                          hasEvents ? 'text-[#123E59]' : 'text-neutral-400'
                        }`}
                      >
                        {dayItem.dayNumber}
                      </span>
                      {hasEvents && (
                        <span className="hidden sm:inline text-[9px] font-mono font-bold text-neutral-400">
                          {dayItem.events.length}
                        </span>
                      )}
                    </div>

                    {/* Events on this day */}
                    <div className="mt-1 flex-1 flex flex-wrap items-center justify-center content-center gap-1 sm:gap-1.5 py-0.5">
                      {dayItem.events.map((evt) => {
                        const temporalStatus =
                          getEventTemporalStatus(evt.startDate, evt.endDate);
                        const isCurrent = temporalStatus === 'ACTUAL';
                        const isUpcoming = temporalStatus === 'PROXIMO';
                        const hasCustomImage = Boolean(evt.imageUrl && evt.imageUrl.trim());

                        return (
                          <button
                            key={`${dayItem.dateStr}-${evt.id}`}
                            type="button"
                            onClick={() => setSelectedEventId(evt.id)}
                            title={`${evt.name} (${evt.venue}) - ${
                              isCurrent ? 'Actual' : isUpcoming ? 'Próximo' : 'Finalizado'
                            }`}
                            aria-label={`${evt.name} (${evt.venue})`}
                            className={`relative group shrink-0 rounded-lg p-0.5 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xs ${
                              isCurrent
                                ? 'border-2 border-[#A61E4D] ring-1 ring-[#A61E4D]/30'
                                : isUpcoming
                                ? 'border border-[#123E59]/50 hover:border-[#123E59]'
                                : 'border border-neutral-300 opacity-75 hover:opacity-100'
                            } ${hasCustomImage ? 'bg-white' : 'bg-[#123E59]'}`}
                          >
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center overflow-hidden rounded ${
                                hasCustomImage ? 'bg-white' : 'bg-[#123E59] p-1'
                              }`}
                            >
                              <img
                                src={hasCustomImage ? evt.imageUrl : '/equidate-logo.png'}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.src = '/equidate-logo.png';
                                  e.currentTarget.parentElement?.classList.remove('bg-white');
                                  e.currentTarget.parentElement?.classList.add('bg-[#123E59]', 'p-1');
                                }}
                                loading="lazy"
                              />
                            </div>

                            {/* Status indicator without covering image */}
                            {isCurrent && (
                              <span
                                className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#A61E4D] rounded-full border border-white ring-1 ring-[#A61E4D]/50 animate-pulse"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

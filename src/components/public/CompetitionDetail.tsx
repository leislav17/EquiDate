import React, { useState, useMemo } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import {
  formatFullDateRange,
  formatDayHeader,
  getDaysBetween,
  getEventTemporalStatus,
  getArgentinaTodayStr
} from '../../utils/dateUtils';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { DayProgram } from './DayProgram';
import { TransmissionButton } from './Transmission';
import { DocumentItem } from '../../types/equestrian';
import { renderRichText } from '../../utils/richText';

export const CompetitionDetail: React.FC = () => {
  const {
    days: competitionDays,
    classes,
    streams,
    scheduleError,
    selectedEventId,
    setSelectedEventId,
    getEventById,
    getDocumentsForEvent,
    setViewingDocumentId
  } = useEquestrian();

  const event = selectedEventId ? getEventById(selectedEventId) : null;
  const allDocs = selectedEventId ? getDocumentsForEvent(selectedEventId) : [];
  const argentinaTodayStr = useMemo(() => getArgentinaTodayStr(), []);

  // Anteprogramas (type === 'PROGRAM')
  const anteprogramas = useMemo(() => {
    return allDocs.filter((d) => d.type === 'PROGRAM');
  }, [allDocs]);

  // Reglamentos (type === 'REGULATION')
  const reglamentos = useMemo(() => {
    return allDocs.filter((d) => d.type === 'REGULATION');
  }, [allDocs]);

  // Otros Documentos Generales (type === 'OTHER')
  const otrosDocumentos = useMemo(() => {
    return allDocs.filter((d) => d.type === 'OTHER');
  }, [allDocs]);

  // Accordion states for days: all days start collapsed by default
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Generate days between startDate and endDate
  const days = useMemo(() => {
    if (!event) return [];
    const dateList = getDaysBetween(event.startDate, event.endDate);
    return dateList.map((dateStr) => {
      const header = formatDayHeader(dateStr);
      const startLists = allDocs.filter(
        (d) => d.type === 'START_LIST' && d.eventDate === dateStr
      );
      const results = allDocs.filter(
        (d) => d.type === 'RESULT' && d.eventDate === dateStr
      );

      return {
        dateStr,
        ...header,
        startLists,
        results,
        hasContent: startLists.length > 0 || results.length > 0 || classes.some(entry => entry.eventId === event.id && entry.date === dateStr) || competitionDays.some(day => day.eventId === event.id && day.date === dateStr && (day.youtubeUrl || streams.some(stream => stream.dayId === day.id && stream.youtubeUrl)))
      };
    });
  }, [event, allDocs, classes, competitionDays, streams]);

  // When changing or entering a competition, ensure all days remain collapsed by default
  React.useEffect(() => {
    setOpenDays({});
  }, [selectedEventId]);

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-neutral-500 mb-4">Concurso no encontrado.</p>
        <button
          type="button"
          onClick={() => setSelectedEventId(null)}
          className="px-4 py-2 bg-[#123E59] text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          ← Volver a Concursos
        </button>
      </div>
    );
  }

  const dateRangeStr = formatFullDateRange(event.startDate, event.endDate);
  const temporalStatus = getEventTemporalStatus(event.startDate, event.endDate);

  const toggleDayAccordion = (dateStr: string) => {
    setOpenDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const handleOpenDoc = (doc: DocumentItem) => {
    setViewingDocumentId(doc.id);
  };

  return (
    <div className="w-full bg-[#f4f6f8] min-h-[calc(100vh-64px)] pb-12">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => setSelectedEventId(null)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#123E59] hover:underline mb-4 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Volver a Concursos</span>
        </button>

        {/* Clean Header: STATUS, SHOW NAME, VENUE, DATES */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 sm:p-6 mb-6 shadow-xs">
          <div className="mb-2">
            {temporalStatus === 'ACTUAL' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#A61E4D] text-white text-[11px] font-black uppercase tracking-wider">
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

          <h1 className="font-display text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
            {event.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-neutral-600 font-medium">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#123E59] shrink-0" />
              <span className="font-semibold text-neutral-800">{event.venue}</span>
              {event.city && <span className="text-neutral-500">· {event.city}</span>}
            </div>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{dateRangeStr}</span>
            </div>
          </div>
        </div>

        {scheduleError && <p role="status" className="mb-4 text-sm text-neutral-600">{scheduleError}</p>}
        {/* Content Hierarchy: INFORMACIÓN IMPORTANTE -> ANTEPROGRAMA -> REGLAMENTO -> OTROS DOCUMENTOS -> DÍAS */}
        <div className="space-y-3">
          {/* ======================================================== */}
          {/* INFORMACIÓN IMPORTANTE (Solo si existe contenido cargado) */}
          {/* ======================================================== */}
          {event.importantInfo && event.importantInfo.trim() && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsInfoOpen(prev => !prev)}
                aria-expanded={isInfoOpen}
                className="w-full px-5 py-4 flex items-center justify-between bg-[#123E59] hover:bg-[#0e3247] text-white rounded-2xl cursor-pointer select-none transition-all active:scale-[0.99] shadow-xs min-h-[56px] group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Info className="w-5 h-5 text-[#93c5fd] shrink-0" />
                  <span className="font-display text-base sm:text-lg font-black tracking-wide truncate">
                    INFORMACIÓN IMPORTANTE
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-white/80 font-medium hidden sm:inline">
                    {isInfoOpen ? 'Ocultar' : 'Ver información'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                    {isInfoOpen ? (
                      <ChevronUp className="w-5 h-5 text-white" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
              </button>

              {isInfoOpen && (
                <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-6 shadow-xs animate-in fade-in-50 duration-200">
                  <div className="space-y-2 text-neutral-800">
                    {renderRichText(event.importantInfo)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. DOCUMENTOS GENERALES (Solo si existen)                */}
          {/* ======================================================== */}
          {/* Anteprogramas */}
          {anteprogramas.map((doc, idx) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleOpenDoc(doc)}
              className="w-full px-5 py-4 flex items-center justify-between bg-[#123E59] hover:bg-[#0e3247] text-white rounded-2xl cursor-pointer select-none transition-all active:scale-[0.99] shadow-xs min-h-[56px] group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[#93c5fd] shrink-0" />
                <span className="font-display text-base sm:text-lg font-black tracking-wide truncate">
                  {anteprogramas.length > 1 ? `ANTEPROGRAMA (${doc.name})` : 'ANTEPROGRAMA'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/80 font-medium hidden sm:inline">
                  Ver documento
                </span>
                <div className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ))}

          {/* Reglamentos */}
          {reglamentos.map((doc, idx) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleOpenDoc(doc)}
              className="w-full px-5 py-4 flex items-center justify-between bg-[#123E59] hover:bg-[#0e3247] text-white rounded-2xl cursor-pointer select-none transition-all active:scale-[0.99] shadow-xs min-h-[56px] group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[#93c5fd] shrink-0" />
                <span className="font-display text-base sm:text-lg font-black tracking-wide truncate">
                  {reglamentos.length > 1 ? `REGLAMENTO (${doc.name})` : 'REGLAMENTO'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/80 font-medium hidden sm:inline">
                  Ver documento
                </span>
                <div className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ))}

          {/* Otros Documentos Generales (con nombre personalizado) */}
          {otrosDocumentos.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleOpenDoc(doc)}
              className="w-full px-5 py-4 flex items-center justify-between bg-[#123E59] hover:bg-[#0e3247] text-white rounded-2xl cursor-pointer select-none transition-all active:scale-[0.99] shadow-xs min-h-[56px] group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[#93c5fd] shrink-0" />
                <span className="font-display text-base sm:text-lg font-black tracking-wide truncate">
                  {doc.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/80 font-medium hidden sm:inline">
                  Ver documento
                </span>
                <div className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ))}

          {/* ======================================================== */}
          {/* 2. AUTOMATIC ACCORDION FOR EACH DAY                     */}
          {/* ======================================================== */}
          {days.map((day) => {
            const isOpen = !!openDays[day.dateStr];
            const isToday = day.dateStr === argentinaTodayStr;

            return (
              <div
                key={day.dateStr}
                className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-xs transition-shadow"
              >
                {/* Day Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleDayAccordion(day.dateStr)}
                  aria-expanded={isOpen}
                  className={`w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer select-none transition-colors min-h-[56px] ${
                    isOpen ? 'bg-neutral-100 text-neutral-900' : 'bg-white hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="flex flex-col items-start min-w-0 pr-3">
                    {isToday && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#A61E4D] text-white text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        HOY
                      </span>
                    )}
                    <span className="font-display text-base sm:text-lg font-black tracking-tight text-[#123E59] leading-tight">
                      {day.fullFormatted}
                    </span>
                  </div>

                  <div className="flex items-center shrink-0">
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-neutral-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>
                </button>

                {/* Day Accordion Content */}
                {isOpen && (
                  <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/50 space-y-5">
                    {competitionDays.filter(entry => entry.eventId === event.id && entry.date === day.dateStr).map(entry => <TransmissionButton key={entry.id} day={entry} />)}
                    <DayProgram eventId={event.id} date={day.dateStr} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


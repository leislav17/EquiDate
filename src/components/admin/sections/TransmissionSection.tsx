import React, { useState } from 'react';
import { EquestrianEvent } from '../../../types/equestrian';
import { useEquestrian } from '../../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../../utils/dateUtils';
import { sortArenas } from '../../../utils/schedule';
import { StreamEditor } from '../ScheduleManager';
import { Video, Calendar, MapPin } from 'lucide-react';

interface TransmissionSectionProps {
  event: EquestrianEvent;
}

export const TransmissionSection: React.FC<TransmissionSectionProps> = ({ event }) => {
  const { arenas, arenaError, scheduleError } = useEquestrian();
  const eventArenas = sortArenas(arenas.filter((a) => a.eventId === event.id));
  const dates = getDaysBetween(event.startDate, event.endDate);

  const [date, setDate] = useState<string>(dates[0] || event.startDate);
  const [selectedArena, setSelectedArena] = useState<string>('');

  const arenaId = selectedArena || eventArenas.find((a) => a.isPrimary)?.id || (eventArenas[0]?.id ?? '');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-[#123E59]" />
            <h3 className="font-display text-base font-black text-[#123E59] uppercase tracking-wide">
              Transmisión en Vivo (Streaming)
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Configurá los enlaces de YouTube para cada jornada y pista. En la vista pública se mostrará el botón de transmisión activa y las pruebas del día.
          </p>
        </div>

        {arenaError || scheduleError ? (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
            {arenaError || scheduleError}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Jornada *
                </label>
                <div className="relative">
                  <select
                    aria-label="Jornada"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] bg-white"
                  >
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {formatDayHeader(d).fullFormatted}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {eventArenas.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Pista de la transmisión *
                  </label>
                  <select
                    value={arenaId}
                    onChange={(e) => setSelectedArena(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] bg-white"
                  >
                    {eventArenas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {arenaId ? (
              <div className="pt-2">
                <StreamEditor key={date + arenaId} eventId={event.id} date={date} arenaId={arenaId} />
              </div>
            ) : (
              <p className="text-xs text-neutral-500 py-4">
                Primero agregá una pista para este concurso en la sección "Jornadas y pruebas".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

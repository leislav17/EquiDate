import React, { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { CompetitionDay } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { formatDayHeader } from '../../utils/dateUtils';
import { getYouTubeId, transmissionLabel } from '../../utils/schedule';
import { DayProgram } from './DayProgram';

export function useTransmissionLabel(day: CompetitionDay) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return transmissionLabel(day.date, day.timeZone, now);
}

export function TransmissionButton({ day }: { day: CompetitionDay }) {
  const label = useTransmissionLabel(day);
  if (!getYouTubeId(day.youtubeUrl)) return null;
  return <a href={'#transmission/' + day.id} className="flex items-center justify-center gap-2 min-h-12 px-4 py-3 rounded-xl bg-[#123E59] text-white text-xs font-bold mb-4 hover:bg-[#0e3247]">
    <Play className="w-4 h-4" />{label}
  </a>;
}

function Player({ day }: { day: CompetitionDay }) {
  const { getEventById, setSelectedEventId, setActiveView } = useEquestrian();
  const event = getEventById(day.eventId);
  const label = useTransmissionLabel(day);
  const videoId = getYouTubeId(day.youtubeUrl);
  return <div className="max-w-4xl mx-auto px-4 py-6">
    <button onClick={() => { setSelectedEventId(day.eventId); setActiveView('public'); window.location.hash = ''; }}
      className="flex items-center gap-2 min-h-11 text-sm font-bold text-[#123E59] mb-4">
      <ArrowLeft className="w-4 h-4" />Volver al concurso
    </button>
    <p className="text-xs font-bold text-[#A61E4D]">{formatDayHeader(day.date).fullFormatted}</p>
    <h1 className="font-display text-2xl font-black text-[#123E59] mt-1 mb-4">{event?.name}</h1>
    <p className="text-xs font-bold mb-3">{label === 'VER EN VIVO' ? 'EN VIVO · Transmisión de la jornada' : 'Transmisión de la jornada'}</p>
    {videoId ? <>
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe key={videoId} src={'https://www.youtube-nocookie.com/embed/' + videoId + '?playsinline=1'}
          title={'Transmisión de ' + event?.name + ' · ' + day.date}
          className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>
      <p className="text-xs text-neutral-500 mt-3">Si el organizador restringe la reproducción, <a className="underline" href={'https://www.youtube.com/watch?v=' + videoId} target="_blank" rel="noopener noreferrer">abrir en YouTube</a>.</p>
    </> : <p>Transmisión aún no disponible.</p>}
    <h2 className="font-display text-xl font-bold text-[#123E59] mt-8 mb-4">Pruebas de la jornada</h2>
    <DayProgram eventId={day.eventId} date={day.date} />
  </div>;
}

export function TransmissionPage({ dayId }: { dayId: string }) {
  const { days, isLoading } = useEquestrian();
  const day = days.find(entry => entry.id === dayId);
  if (isLoading) return <p role="status" className="p-6 text-center">Cargando transmisión…</p>;
  if (!day) return <div className="p-6 text-center"><p>Jornada no disponible.</p><a href="#" className="underline">Volver a concursos</a></div>;
  return <Player day={day} />;
}

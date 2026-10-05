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
  const { streams, arenas, arenaError } = useEquestrian();
  const label = useTransmissionLabel(day);
  const eventArenas = arenas.filter(arena => arena.eventId === day.eventId);
  const dayStreams = streams.filter(stream => stream.dayId === day.id && getYouTubeId(stream.youtubeUrl));
  if (arenaError && getYouTubeId(day.youtubeUrl)) return <a href={'#transmission/' + day.id} className="block min-h-12 p-3 rounded-xl bg-[#123E59] text-white text-center text-xs font-bold mb-4">{label}</a>;
  return <div className="flex flex-col sm:flex-row gap-2 mb-4">
    {dayStreams.map(stream => <a key={stream.id} href={'#transmission/' + day.id + '/' + stream.arenaId} className="flex flex-1 items-center justify-center gap-2 min-h-12 px-4 py-3 rounded-xl bg-[#123E59] text-white text-xs font-bold hover:bg-[#0e3247]">
      <Play className="w-4 h-4 shrink-0" /><span>{label}{eventArenas.length > 1 && ' · ' + eventArenas.find(arena => arena.id === stream.arenaId)?.name}</span>
    </a>)}
  </div>;
}

function Player({ day, arenaId, youtubeUrl }: { day: CompetitionDay; arenaId?: string; youtubeUrl: string }) {
  const { arenas, getEventById, setSelectedEventId, setActiveView } = useEquestrian();
  const event = getEventById(day.eventId);
  const label = useTransmissionLabel(day);
  const videoId = getYouTubeId(youtubeUrl);
  const arena = arenas.find(item => item.id === arenaId);
  const multiple = arenas.filter(item => item.eventId === day.eventId).length > 1;
  return <div className="max-w-4xl mx-auto px-4 py-6">
    <button onClick={() => { setSelectedEventId(day.eventId); setActiveView('public'); window.location.hash = ''; }}
      className="flex items-center gap-2 min-h-11 text-sm font-bold text-[#123E59] mb-4">
      <ArrowLeft className="w-4 h-4" />Volver al concurso
    </button>
    <p className="text-xs font-bold text-[#A61E4D]">{formatDayHeader(day.date).fullFormatted}</p>
    <h1 className="font-display text-2xl font-black text-[#123E59] mt-1 mb-4">{event?.name}</h1>
    <p className="text-xs font-bold mb-3">{label === 'VER EN VIVO' ? 'EN VIVO · Transmisión de la jornada' : 'Transmisión de la jornada'}</p>
    {multiple && <h2 className="font-bold text-[#123E59] mb-4">{arena?.name}</h2>}
    {videoId ? <>
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe key={videoId} src={'https://www.youtube-nocookie.com/embed/' + videoId + '?playsinline=1'}
          title={'Transmisión de ' + event?.name + ' · ' + day.date + (arena ? ' · ' + arena.name : '')}
          className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>
      <p className="text-xs text-neutral-500 mt-3">Si el organizador restringe la reproducción, <a className="underline" href={'https://www.youtube.com/watch?v=' + videoId} target="_blank" rel="noopener noreferrer">abrir en YouTube</a>.</p>
    </> : <p>Transmisión aún no disponible.</p>}
    <h2 className="font-display text-xl font-bold text-[#123E59] mt-8 mb-4">Pruebas de la jornada</h2>
    <DayProgram eventId={day.eventId} date={day.date} arenaId={arenaId} />
  </div>;
}

export function TransmissionPage({ dayId: route }: { dayId: string }) {
  const { days, arenas, streams, arenaError, isLoading } = useEquestrian();
  const [dayId, requestedArena] = route.split('/');
  const day = days.find(entry => entry.id === dayId);
  const arena = arenas.find(item => item.eventId === day?.eventId && (requestedArena ? item.id === requestedArena : item.isPrimary));
  const stream = streams.find(item => item.dayId === dayId && item.arenaId === arena?.id);
  if (isLoading) return <p role="status" className="p-6 text-center">Cargando transmisión…</p>;
  if (!day || (requestedArena && !arena)) return <div className="p-6 text-center"><p>Jornada o pista no disponible.</p><a href="#" className="underline">Volver a concursos</a></div>;
  const youtubeUrl = arenaError && !requestedArena ? day.youtubeUrl : stream?.youtubeUrl || '';
  return <Player day={day} arenaId={arena?.id} youtubeUrl={youtubeUrl} />;
}

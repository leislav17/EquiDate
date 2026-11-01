import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { CompetitionDay } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { formatDayHeader } from '../../utils/dateUtils';
import { getYouTubeId, transmissionLabel } from '../../utils/schedule';
import { DayProgram } from './DayProgram';
import { StartListView } from './StartListView';
import { DocumentViewer } from '../viewer/DocumentViewer';

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
  const { arenas, classes, documents, getEventById, setSelectedEventId, setActiveView } = useEquestrian();
  const [selectedList, setSelectedList] = useState<{ kind: 'structured' | 'document'; id: string } | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const listsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the selected list below the pinned player without restarting playback.
    if (selectedList && listsRef.current) {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        listsRef.current.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const pinnedHeight = (videoRef.current?.getBoundingClientRect().height || 0) + 65;
      window.scrollTo({ top: window.scrollY + listsRef.current.getBoundingClientRect().top - pinnedHeight - 16, behavior: 'smooth' });
    }
  }, [selectedList]);
  const selectedDocument = selectedList?.kind === 'document' ? documents.find(doc => doc.id === selectedList.id && doc.eventId === day.eventId && doc.eventDate === day.date) : undefined;
  const event = getEventById(day.eventId);
  const label = useTransmissionLabel(day);
  const videoId = getYouTubeId(youtubeUrl);
  const arena = arenas.find(item => item.id === arenaId);
  const multiple = arenas.filter(item => item.eventId === day.eventId).length > 1;
  const selectedClass = classes.find(c => c.id === (selectedList?.kind === 'structured' ? selectedList.id : selectedDocument?.classId));
  return <div className="max-w-4xl mx-auto lg:max-w-[1600px] lg:px-6 lg:pt-6 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-6">
    {videoId ? <div ref={videoRef} className="sticky top-[65px] lg:top-[89px] z-30 bg-black lg:col-start-1 lg:row-start-1">
      <div className="aspect-video max-h-[50svh] w-full overflow-hidden">
        <iframe key={videoId} src={'https://www.youtube-nocookie.com/embed/' + videoId + '?playsinline=1'}
          title={'Transmisión de ' + event?.name + ' · ' + day.date + (arena ? ' · ' + arena.name : '')}
          className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>
    </div> : <p className="px-4 pt-6">Transmisión aún no disponible.</p>}
    <div className="px-4 py-6 lg:col-start-1 lg:row-start-2 min-w-0">
    <button onClick={() => { setSelectedEventId(day.eventId); setActiveView('public'); }}
      className="flex items-center gap-2 min-h-11 text-sm font-bold text-[#123E59] mb-4">
      <ArrowLeft className="w-4 h-4" />Volver al concurso
    </button>
    <p className="text-xs font-bold text-[#A61E4D]">{formatDayHeader(day.date).fullFormatted}</p>
    <h1 className="font-display text-2xl font-black text-[#123E59] mt-1 mb-4">{event?.name}</h1>
    {selectedClass && <div className="hidden lg:block mb-4"><p className="text-xs font-bold text-[#A61E4D]">Prueba {selectedClass.number}</p><h2 className="font-display text-xl font-bold text-[#123E59]">{selectedClass.name}</h2><p className="text-sm text-neutral-700 mt-1">{selectedClass.description}</p><p className="text-sm text-neutral-500">{arenas.find(a => a.id === selectedClass.arenaId)?.name}</p></div>}
    <p className="text-xs font-bold mb-3">{label === 'VER EN VIVO' ? 'EN VIVO · Transmisión de la jornada' : 'Transmisión de la jornada'}</p>
    {multiple && <h2 className="font-bold text-[#123E59] mb-4">{arena?.name}</h2>}
    </div>
    <div ref={listsRef} className="px-4 pb-6 min-w-0 scroll-mt-20 lg:px-0 lg:sticky lg:top-[89px] lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:max-h-[calc(100svh-113px)] lg:overflow-y-auto">
      {selectedList?.kind === 'structured' ? <StartListView key={selectedList.id} classId={selectedList.id} embedded desktopMetadataBelowVideo onBack={() => setSelectedList(null)} />
        : selectedList?.kind === 'document' ? <section aria-label="Listado de la prueba" className="space-y-3">
          <button onClick={() => setSelectedList(null)} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18} />Volver a las pruebas de la jornada</button>
          {selectedDocument ? <DocumentViewer document={selectedDocument} mode="inline" /> : <p>Este listado ya no está disponible.</p>}
        </section> : <>
          <h2 className="font-display text-xl font-bold text-[#123E59] mb-4">Pruebas de la jornada</h2>
          <DayProgram eventId={day.eventId} date={day.date} arenaId={arenaId} showResults={false}
            onOpenStartList={id => setSelectedList({ kind: 'structured', id })}
            onOpenListDocument={doc => setSelectedList({ kind: 'document', id: doc.id })} />
        </>}
    </div>
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
  return <Player key={`${day.id}/${arena?.id || ''}`} day={day} arenaId={arena?.id} youtubeUrl={youtubeUrl} />;
}

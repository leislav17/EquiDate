import { Bell, Award } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { sortClasses, sortArenas, formatClassSchedule } from '../../utils/schedule';
import { documentTypeLabel, isGeneralDocumentType } from '../../utils/documents';
import { DocumentItem } from '../../types/equestrian';
import { publishedStartList, startParticipantCount } from '../../utils/startLists';

export function DayProgram({ eventId, date, arenaId }: { eventId: string; date: string; arenaId?: string }) {
  const { classes, arenas, documents, setViewingDocumentId, startHeads, startVersions } = useEquestrian();

  const allDayClasses = classes.filter(entry => entry.eventId === eventId && entry.date === date);
  const dayDocuments = documents.filter(doc => doc.eventId === eventId && doc.eventDate === date && !isGeneralDocumentType(doc.type));
  const unassigned = arenaId ? [] : dayDocuments.filter(doc => !doc.classId);

  // If specific arenaId requested (e.g. in transmission editor), filter by it, else sort all event arenas
  const targetArenas = arenaId
    ? arenas.filter(arena => arena.id === arenaId && arena.eventId === eventId)
    : sortArenas(arenas.filter(arena => arena.eventId === eventId));

  // Determine which arenas have classes for this day
  const activeArenas = targetArenas.filter(arena =>
    allDayClasses.some(entry => entry.arenaId === arena.id)
  );

  // Handle any classes assigned to an unknown or missing arena
  const knownArenaIds = new Set(targetArenas.map(a => a.id));
  const unmappedClasses = arenaId ? [] : allDayClasses.filter(c => !knownArenaIds.has(c.arenaId));

  const totalClassesCount = allDayClasses.length;

  const action = (doc: DocumentItem) => (
    <button
      key={doc.id}
      title={doc.name}
      onClick={() => setViewingDocumentId(doc.id)}
      className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-bold text-[#123E59] text-left cursor-pointer"
    >
      {doc.type === 'RESULT' ? <Award className="w-4 h-4 shrink-0" /> : <Bell className="w-4 h-4 shrink-0" />}
      <span>{documentTypeLabel(doc.type)}</span>
    </button>
  );

  const renderClassCard = (entry: typeof classes[0]) => {
    const attached = dayDocuments.filter(doc => doc.classId === entry.id);
    const scheduleLabel = formatClassSchedule(entry);
    const ident = (entry.number || '').trim();
    const identLabel = !ident ? 'Prueba' : ident.toLowerCase().startsWith('prueba') ? ident : `Prueba ${ident}`;
    const list = publishedStartList(entry.id, startHeads, startVersions);
    const participantCount = startParticipantCount(list, entry.participantCount);
    const hasParticipants = typeof participantCount === 'number';

    return (
      <article key={entry.id} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex gap-3 sm:gap-5 justify-between items-start">
          <div className="flex gap-3 sm:gap-5 min-w-0 flex-1">
            {scheduleLabel ? (
              <div className="text-[#123E59] text-sm font-bold shrink-0 pt-0.5">{scheduleLabel}</div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase font-bold tracking-wider text-[#A61E4D]">{identLabel}</p>
              <h3 className="font-display font-bold text-lg text-[#123E59] break-words">{entry.name}</h3>
              {entry.description && <p className="text-sm text-neutral-500 mt-1">{entry.description}</p>}
            </div>
          </div>

        </div>
        <div className="mt-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {list && <a href={`#start-list/${entry.id}`} className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-bold text-[#123E59]"><Bell className="w-4 h-4" />Listado</a>}
            {attached.filter(doc => !list || doc.type !== 'START_LIST').map(action)}
          </div>
          {hasParticipants && (
            <div
              className="shrink-0 rounded-lg bg-neutral-100 px-2.5 py-1 text-center text-xs font-semibold text-neutral-700 select-none"
              title={`Cantidad de participantes: ${participantCount}${list ? ' (listado publicado)' : ''}`}
            >
              <span className="block">Participantes:</span>
              <span className="block">{participantCount}</span>
            </div>
          )}
        </div>
      </article>
    );
  };

  if (totalClassesCount === 0) {
    return <p className="text-sm text-neutral-500 py-3">Pruebas aún no publicadas.</p>;
  }

  const showArenaHeaders = !arenaId && (activeArenas.length > 1 || arenas.filter(a => a.eventId === eventId).length > 1 || activeArenas.length === 1);

  return (
    <div className="space-y-6">
      {activeArenas.map(arena => {
        const arenaClasses = sortClasses(allDayClasses.filter(entry => entry.arenaId === arena.id));
        if (arenaClasses.length === 0) return null;

        return (
          <section key={arena.id} className="space-y-3">
            {showArenaHeaders && (
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#123E59]" />
                  <h4 className="font-display font-black text-sm sm:text-base text-[#123E59] tracking-tight uppercase">
                    {arena.name}
                  </h4>
                </div>
                <span className="text-xs text-neutral-500 font-medium">
                  {arenaClasses.length} {arenaClasses.length === 1 ? 'prueba' : 'pruebas'}
                </span>
              </div>
            )}
            <div className="space-y-3">
              {arenaClasses.map(renderClassCard)}
            </div>
          </section>
        );
      })}

      {unmappedClasses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
            <h4 className="font-display font-bold text-sm text-neutral-700 uppercase">Otras pruebas</h4>
          </div>
          <div className="space-y-3">
            {sortClasses(unmappedClasses).map(renderClassCard)}
          </div>
        </section>
      )}

      {unassigned.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Documentos de la jornada</h3>
          <div className="flex flex-col gap-2">{unassigned.map(action)}</div>
        </section>
      )}
    </div>
  );
}

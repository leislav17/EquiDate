import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { EquestrianEvent } from '../../../types/equestrian';
import { useEquestrian } from '../../../context/EquestrianContext';
import { SponsorManager } from '../SponsorManager';

interface EventSponsorsSectionProps {
  event: EquestrianEvent;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const EventSponsorsSection: React.FC<EventSponsorsSectionProps> = ({
  event,
  onDirtyChange,
}) => {
  const { updateEvent, sponsorsAvailable } = useEquestrian();
  const [savingSetting, setSavingSetting] = useState(false);
  const [settingError, setSettingError] = useState('');
  const [settingSaved, setSettingSaved] = useState(false);

  const handleToggleGlobalVisibility = async (hideGlobals: boolean) => {
    setSavingSetting(true);
    setSettingError('');
    setSettingSaved(false);
    try {
      await updateEvent(event.id, { hideGlobalSponsors: hideGlobals });
      setSettingSaved(true);
    } catch (err) {
      setSettingError((err as Error).message || 'No se pudo actualizar la preferencia.');
    } finally {
      setSavingSetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-start gap-3 min-h-11 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={savingSetting || !sponsorsAvailable}
              checked={Boolean(event.hideGlobalSponsors)}
              onChange={(e) => void handleToggleGlobalVisibility(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#123E59] shrink-0"
            />
            <span>
              <span className="block text-sm font-bold text-[#123E59]">
                Ocultar sponsors globales en este concurso
              </span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                Activalo si este concurso tiene exclusividad comercial: en su ficha y al pie de sus listados y resultados solo se mostrarán los sponsors propios de este evento.
              </span>
            </span>
          </label>

          {savingSetting && (
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Guardando…
            </span>
          )}
          {!savingSetting && settingSaved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Check className="w-3.5 h-3.5" />
              Guardado
            </span>
          )}
        </div>

        {settingError && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {settingError}
          </p>
        )}
      </div>

      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
        <SponsorManager
          scope="event"
          eventId={event.id}
          onDirtyChange={onDirtyChange}
        />
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Info, Check, Trash2, AlertTriangle } from 'lucide-react';
import { EquestrianEvent } from '../../types/equestrian';
import { ImportantInfoEditor } from './ImportantInfoEditor';

interface ImportantInfoModalProps {
  event: EquestrianEvent;
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventId: string, importantInfo: string) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export const ImportantInfoModal: React.FC<ImportantInfoModalProps> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [content, setContent] = useState(event.importantInfo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setContent(event.importantInfo || '');
    setError('');
    setShowDeleteConfirm(false);
  }, [event.id, event.importantInfo, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(event.id, content.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar la información importante.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setSaving(true);
    setError('');
    try {
      if (onDelete) {
        await onDelete(event.id);
      } else {
        await onSave(event.id, '');
      }
      setContent('');
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'No se pudo eliminar la información guardada.');
    } finally {
      setSaving(false);
    }
  };

  const hasInfo = Boolean(
    (event.importantInfo && event.importantInfo.trim().length > 0) ||
    content.trim().length > 0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#123E59]/10 text-[#123E59] flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 id="info-modal-title" className="font-display text-lg font-black text-neutral-900 leading-tight">
                Información Importante
              </h2>
              <p className="text-xs text-neutral-500 font-medium truncate max-w-xs sm:max-w-md">
                {event.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <p>{error}</p>
              <p className="text-[11px] text-red-500 font-normal mt-0.5">El contenido se conservó para que puedas reintentar.</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-700">Contenido libre</span>
            <span className="text-[11px] text-neutral-500">Admite títulos, negritas, listas y enlaces</span>
          </div>

          <ImportantInfoEditor
            value={content}
            onChange={setContent}
            placeholder={`Ejemplo:\n## Cierre de inscripciones\nEl cierre es el **15/10/2026** a las 20:00 hs.\n\n[Formulario de inscripción](https://forms.gle/ejemplo)\n\n- Estabulación disponible\n- Ingreso con libreta sanitaria`}
            disabled={saving}
          />
        </div>

        {/* Modal-internal Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-3 animate-in fade-in-50 duration-150">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-red-900 leading-snug">
                  ¿Confirmás que deseás eliminar la información importante?
                </h3>
                <p className="text-[11px] sm:text-xs text-red-700 mt-0.5 leading-relaxed">
                  Se eliminará el contenido guardado en Supabase y se ocultará completamente de la vista pública.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200/60">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowDeleteConfirm(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{saving ? 'Eliminando...' : error ? 'Reintentar eliminación' : 'Confirmar eliminación'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer actions */}
        {!showDeleteConfirm && (
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
            <div>
              {hasInfo && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setError('');
                    setShowDeleteConfirm(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar información</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : error ? 'Reintentar guardado' : 'Guardar información'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

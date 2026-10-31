import React, { useState, useEffect } from 'react';
import { EquestrianEvent } from '../../../types/equestrian';
import { useEquestrian } from '../../../context/EquestrianContext';
import { ImportantInfoEditor } from '../ImportantInfoEditor';
import { Info, Check, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface ImportantInfoSectionProps {
  event: EquestrianEvent;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const ImportantInfoSection: React.FC<ImportantInfoSectionProps> = ({
  event,
  onDirtyChange,
}) => {
  const { updateEvent } = useEquestrian();

  const [content, setContent] = useState(event.importantInfo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setContent(event.importantInfo || '');
    setError('');
    setSuccess('');
    setShowDeleteConfirm(false);
  }, [event.id, event.importantInfo]);

  useEffect(() => {
    const isDirty = (content || '').trim() !== (event.importantInfo || '').trim();
    onDirtyChange?.(isDirty);
  }, [content, event.importantInfo, onDirtyChange]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateEvent(event.id, { importantInfo: content.trim() });
      setSuccess('Información importante guardada correctamente.');
      onDirtyChange?.(false);
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar la información.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateEvent(event.id, { importantInfo: '' });
      setContent('');
      setShowDeleteConfirm(false);
      setSuccess('La información importante ha sido eliminada.');
      onDirtyChange?.(false);
    } catch (err) {
      setError((err as Error).message || 'No se pudo eliminar la información.');
    } finally {
      setSaving(false);
    }
  };

  const hasSavedInfo = Boolean(event.importantInfo && event.importantInfo.trim().length > 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-neutral-200 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#123E59]/10 text-[#123E59] flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-black text-[#123E59] uppercase tracking-wide">
                Información Importante del Concurso
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Avisos para jinetes, instrucciones de llegada, boxes y enlaces externos. Aparece como un bloque desplegable en la ficha del concurso.
              </p>
            </div>
          </div>

          {hasSavedInfo && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
              Publicada en la ficha
            </span>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Editor de texto enriquecido */}
        <div className="space-y-1">
          <ImportantInfoEditor
            value={content}
            onChange={(val) => {
              setContent(val);
              setSuccess('');
            }}
            placeholder="Escribí aquí los avisos, números de contacto, recomendaciones de boxes o enlaces de inscripción..."
            disabled={saving}
          />
          <p className="text-[11px] text-neutral-400">
            Podés usar títulos (##), listas con guion (-) y enlaces ([Texto](https://...)). El ícono de tacho en la barra vacía el editor.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-neutral-100">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando…</span>
              </>
            ) : (
              <span>Guardar información</span>
            )}
          </button>

          {hasSavedInfo && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-700 hover:text-red-900 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar información</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal de confirmación para eliminar información */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <h3 className="font-display font-black text-base text-neutral-900">
                ¿Eliminar información importante?
              </h3>
            </div>
            <p className="text-xs text-neutral-600">
              Se eliminará el contenido guardado y se ocultará el bloque de Información Importante en la página pública del concurso.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

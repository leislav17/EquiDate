import React, { useState, useEffect, useRef } from 'react';
import { EquestrianEvent, EventStatus } from '../../../types/equestrian';
import { useEquestrian } from '../../../context/EquestrianContext';
import { Upload, Trash2, Image as ImageIcon, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface GeneralInfoSectionProps {
  event: EquestrianEvent | null;
  onSaved: (savedEventId: string) => void;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const GeneralInfoSection: React.FC<GeneralInfoSectionProps> = ({
  event,
  onSaved,
  onDeleteEvent,
  onDirtyChange,
}) => {
  const { addEvent, updateEvent, uploadEventImage } = useEquestrian();

  const [name, setName] = useState(event?.name || '');
  const [venue, setVenue] = useState(event?.venue || '');
  const [city, setCity] = useState(event?.city || 'Buenos Aires');
  const [imageUrl, setImageUrl] = useState(event?.imageUrl || '');
  const [startDate, setStartDate] = useState(event?.startDate || '2026-10-24');
  const [endDate, setEndDate] = useState(event?.endDate || '2026-10-25');
  const [status, setStatus] = useState<EventStatus>(event?.status || 'published');

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if event changes
  useEffect(() => {
    if (event) {
      setName(event.name);
      setVenue(event.venue);
      setCity(event.city || '');
      setImageUrl(event.imageUrl || '');
      setStartDate(event.startDate);
      setEndDate(event.endDate);
      setStatus(event.status);
    }
    setErrorMessage('');
    setSuccessMessage('');
  }, [event]);

  // Track dirty changes
  useEffect(() => {
    if (!event) {
      const hasContent = Boolean(name.trim() || venue.trim() || imageUrl.trim());
      onDirtyChange?.(hasContent);
      return;
    }
    const isDirty =
      name !== event.name ||
      venue !== event.venue ||
      (city || '') !== (event.city || '') ||
      (imageUrl || '') !== (event.imageUrl || '') ||
      startDate !== event.startDate ||
      endDate !== event.endDate ||
      status !== event.status;
    onDirtyChange?.(isDirty);
  }, [name, venue, city, imageUrl, startDate, endDate, status, event, onDirtyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Por favor ingresá el nombre del concurso.');
      return;
    }
    if (!venue.trim()) {
      setErrorMessage('Por favor ingresá el club o lugar.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Por favor completá las fechas de inicio y fin.');
      return;
    }
    if (startDate > endDate) {
      setErrorMessage('La fecha de inicio no puede ser posterior a la de finalización.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setSaving(true);

    try {
      if (event) {
        await updateEvent(event.id, {
          name: name.trim(),
          venue: venue.trim(),
          city: city.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          startDate,
          endDate,
          status,
        });
        setSuccessMessage('Los datos del concurso se guardaron correctamente.');
        onDirtyChange?.(false);
        onSaved(event.id);
      } else {
        const newId = await addEvent({
          name: name.trim(),
          venue: venue.trim(),
          city: city.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          startDate,
          endDate,
          status,
        });
        setSuccessMessage('Concurso creado exitosamente.');
        onDirtyChange?.(false);
        onSaved(newId);
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'No se pudo guardar el concurso.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';

    if (!allowedTypes.includes(file.type.toLowerCase()) || !allowedExts.includes(ext)) {
      setUploadError('Formato no permitido. Solo se aceptan imágenes JPG, JPEG, PNG y WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('La imagen supera el tamaño máximo permitido de 5 MB.');
      return;
    }

    setUploadError('');
    setUploadingImage(true);
    try {
      const publicUrl = await uploadEventImage(file);
      setImageUrl(publicUrl);
    } catch (err) {
      setUploadError((err as Error).message || 'Error al subir la imagen. Por favor reintentá.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!event || !onDeleteEvent) return;
    setDeleting(true);
    setErrorMessage('');
    try {
      await onDeleteEvent(event.id);
      setShowDeleteModal(false);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Error al eliminar el concurso.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div role="alert" className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-sm font-semibold rounded-xl">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. Datos básicos */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <h3 className="font-display text-sm font-bold text-[#123E59] uppercase tracking-wider">
            Datos Principales
          </h3>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Nombre del Concurso *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gran Premio San Jorge - Clasificatorio"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Club o Sede *
              </label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Ej: Club Hípico Argentino"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Ciudad / Provincia
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej: Buenos Aires"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Fecha de Inicio *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Fecha de Finalización *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Estado de Publicación *
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setStatus('published')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  status === 'published'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                PUBLICADO
              </button>
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  status === 'draft'
                    ? 'bg-neutral-800 text-white border-neutral-800 shadow-xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                BORRADOR
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              Los concursos en borrador solo son visibles para administradores y no se muestran en la página pública.
            </p>
          </div>
        </div>

        {/* 2. Imagen de portada */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#123E59] uppercase tracking-wider">
              Imagen de Portada (Opcional)
            </h3>
            {imageUrl && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Imagen cargada
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-500">
            Se muestra como fondo destacado en el carrusel de inicio y en la ficha del concurso.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
          />

          {uploadError && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
              {uploadError}
            </div>
          )}

          {imageUrl ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="w-28 h-20 rounded-lg overflow-hidden bg-neutral-900 shrink-0 border border-neutral-200 relative">
                <img
                  src={imageUrl}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-bold text-neutral-800 truncate">
                  {imageUrl.split('/').pop()?.split('?')[0] || 'Imagen seleccionada'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Visible en la tarjeta y en la cabecera del concurso.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#123E59] bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Reemplazar</span>
                  </button>

                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => setImageUrl('')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-neutral-300 hover:border-[#123E59] rounded-2xl p-6 text-center transition-colors bg-neutral-50/50">
              <ImageIcon className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-xs text-neutral-700 font-bold mb-1">
                Seleccioná una foto desde tu dispositivo
              </p>
              <p className="text-[11px] text-neutral-500 mb-3">
                JPG, PNG o WebP hasta 5 MB.
              </p>

              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Subiendo imagen…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Subir imagen</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Opcional: enlace URL directo */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-xs font-semibold text-[#123E59] hover:underline"
            >
              {showUrlInput ? '− Ocultar opción de URL externa' : '+ O ingresar URL externa directamente'}
            </button>

            {showUrlInput && (
              <div className="mt-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#123E59]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-xl text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50 min-h-12"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando cambios…</span>
              </>
            ) : (
              <span>{event ? 'Guardar información general' : 'Crear concurso'}</span>
            )}
          </button>

          {event && onDeleteEvent && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-red-700 hover:text-red-900 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar concurso</span>
            </button>
          )}
        </div>
      </form>

      {/* Modal de confirmación para eliminar concurso */}
      {showDeleteModal && event && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-neutral-900">
                  ¿Eliminar concurso?
                </h3>
                <p className="text-xs text-neutral-500 font-medium truncate">
                  {event.name}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-600">
              Esta acción eliminará el concurso y sus jornadas, pistas, pruebas y documentos asociados de forma permanente.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando…</span>
                  </>
                ) : (
                  <span>Sí, eliminar definitivamente</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

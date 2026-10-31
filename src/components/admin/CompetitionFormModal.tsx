import React, { useState, useEffect, useRef } from 'react';
import { EquestrianEvent, EventStatus } from '../../types/equestrian';
import { X, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { ImportantInfoEditor } from './ImportantInfoEditor';
import { useEquestrian } from '../../context/EquestrianContext';

interface CompetitionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    venue: string;
    city?: string;
    imageUrl?: string;
    startDate: string;
    endDate: string;
    status: EventStatus;
    importantInfo?: string;
  }) => Promise<void>;
  initialData?: EquestrianEvent | null;
}

export const CompetitionFormModal: React.FC<CompetitionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const { uploadEventImage } = useEquestrian();
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startDate, setStartDate] = useState('2026-10-10');
  const [endDate, setEndDate] = useState('2026-10-11');
  const [status, setStatus] = useState<EventStatus>('published');
  const [importantInfo, setImportantInfo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setVenue(initialData.venue);
      setCity(initialData.city || '');
      setImageUrl(initialData.imageUrl || '');
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate);
      setStatus(initialData.status);
      setImportantInfo(initialData.importantInfo || '');
    } else {
      setName('');
      setVenue('');
      setCity('Buenos Aires');
      setImageUrl('');
      setStartDate('2026-10-24');
      setEndDate('2026-10-25');
      setStatus('published');
      setImportantInfo('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresá el nombre del concurso.');
      return;
    }
    if (!venue.trim()) {
      setError('Por favor ingresá el club o lugar.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Por favor completá las fechas de inicio y fin.');
      return;
    }
    if (startDate > endDate) {
      setError('La fecha de inicio no puede ser posterior a la de finalización.');
      return;
    }

    setError('');
    setSaving(true);
    try {
    await onSave({
      name: name.trim(),
      venue: venue.trim(),
      city: city.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      startDate,
      endDate,
      status,
      importantInfo: importantInfo.trim()
    });
    onClose();
    } catch (error) { setError((error as Error).message || 'No se pudo guardar el concurso.'); }
    finally { setSaving(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so user can re-select same file if needed
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <h2 className="font-display text-lg font-black text-neutral-900">
            {initialData ? 'Editar Concurso' : 'Nuevo Concurso'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Nombre del concurso *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Gran Premio Primavera de Salto"
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Club / lugar *
            </label>
            <input
              type="text"
              required
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="ej. Club Hípico Argentino"
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Ciudad / Localidad
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="ej. Buenos Aires"
              className="w-full px-3.5 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
            />
          </div>

          {/* Imagen del concurso: Subida desde el dispositivo + Vista previa + URL opcional */}
          <div className="space-y-2 pt-1 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Imagen del concurso (opcional)
              </label>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] text-neutral-500 hover:text-[#123E59] underline cursor-pointer"
              >
                {showUrlInput ? 'Ocultar URL manual' : 'O ingresar URL'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {imageUrl ? (
              <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden bg-neutral-200 shrink-0 border border-neutral-300">
                  <img
                    src={imageUrl}
                    alt="Vista previa del concurso"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-neutral-700 truncate">
                    Imagen cargada
                  </p>
                  <p className="text-[11px] text-neutral-500 truncate font-mono">
                    {imageUrl.startsWith('data:') ? 'Imagen local' : imageUrl}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={uploadingImage || saving}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#123E59] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Subiendo…' : 'Reemplazar imagen'}</span>
                    </button>
                    <span className="text-neutral-300">·</span>
                    <button
                      type="button"
                      disabled={uploadingImage || saving}
                      onClick={() => setImageUrl('')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50 transition-colors text-center space-y-2">
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#123E59] flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={uploadingImage || saving}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#123E59] text-white text-xs sm:text-sm font-bold hover:bg-[#0e3247] transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                <p className="text-[11px] text-neutral-500">
                  Seleccioná una imagen desde tu dispositivo (JPG, JPEG, PNG o WebP, máx. 5 MB)
                </p>
              </div>
            )}

            {uploadError && (
              <p role="alert" className="text-xs text-red-600 font-medium">
                {uploadError}
              </p>
            )}

            {showUrlInput && (
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  O pegar URL externa de la imagen
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... o /src/assets/images/..."
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:outline-none focus:border-neutral-900"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Fecha de inicio *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                Fecha de finalización *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Información importante (opcional)
              </label>
              <span className="text-[11px] text-neutral-500">Títulos, negritas, listas y enlaces</span>
            </div>
            <ImportantInfoEditor
              value={importantInfo}
              onChange={setImportantInfo}
              placeholder={`Ejemplo:\n## Cierre de inscripciones\nEl cierre es el **15/10/2026**.\n\n[Formulario de inscripción](https://forms.gle/...)`}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Estado
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('published')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  status === 'published'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                Publicado
              </button>
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  status === 'draft'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                Borrador
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Guardar Concurso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

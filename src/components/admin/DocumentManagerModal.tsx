import React, { useState, useMemo, useRef } from 'react';
import {
  EquestrianEvent,
  DocumentItem,
  DocumentType
} from '../../types/equestrian';
import { documentLabel, documentTypeLabel, isGeneralDocumentType } from '../../utils/documents';
import { formatClassSchedule } from '../../utils/schedule';
import { useEquestrian } from '../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../utils/dateUtils';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  FileText,
  Image as ImageIcon,
  Edit2,
  Check,
  Eye
} from 'lucide-react';

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EquestrianEvent;
}

interface PageItem {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  mimeType: string;
}

export const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const {
    getDocumentsForEvent,
    classes,
    arenas,
    addDocument,
    updateDocument,
    deleteDocument,
    reorderDocument,
    setViewingDocumentId
  } = useEquestrian();

  const documents = getDocumentsForEvent(event.id);

  // Available days dynamically generated from event startDate to endDate
  const availableDays = useMemo(() => {
    const dates = getDaysBetween(event.startDate, event.endDate);
    return dates.map((d) => {
      const info = formatDayHeader(d);
      return {
        dateStr: d,
        label: info.fullFormatted,
      };
    });
  }, [event.startDate, event.endDate]);

  // Form states for "+ AGREGAR DOCUMENTO"
  const [isAdding, setIsAdding] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // New doc fields
  const [docType, setDocType] = useState<DocumentType>('PROGRAM');
  const [docClass, setDocClass] = useState('');
  const [customDocName, setCustomDocName] = useState('');
  const [saving, setSaving] = useState(false);

  // Multi-page image items
  const [pageItems, setPageItems] = useState<PageItem[]>([]);
  // Single PDF file
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [saveProgress, setSaveProgress] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion modal state
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');
  const [storageWarning, setStorageWarning] = useState<string>('');

  if (!isOpen) return null;

  const handleTypeChange = (newType: DocumentType) => {
    setDocType(newType);
    if (isGeneralDocumentType(newType)) {
      setDocClass('');
    }
    if (newType !== 'OTHER') {
      setCustomDocName('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    setStorageWarning('');
    try {
      const result = await deleteDocument(documentToDelete.id);
      if (result && result.storageError) {
        setStorageWarning(`El documento se eliminó de la base de datos, pero falló la limpieza de algunos archivos en Storage: ${result.storageError}`);
      } else {
        setDocumentToDelete(null);
      }
    } catch (err) {
      setDeleteError((err as Error).message || 'No se pudo eliminar el documento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setFormError('');

    // Check if a PDF is selected
    const pdf = files.find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdf) {
      if (pdf.size === 0) {
        setFormError('El archivo PDF seleccionado está vacío.');
        return;
      }
      if (pdf.size > 25 * 1024 * 1024) {
        setFormError('El archivo PDF supera el tamaño máximo permitido (25 MB).');
        return;
      }
      setPdfFile(pdf);
      setPdfName(pdf.name);
      setPageItems([]);
      return;
    }

    // Filter allowed image types (JPG, JPEG, PNG, WebP)
    const imageFiles = files.filter(
      (f) =>
        f.type.startsWith('image/') ||
        f.name.toLowerCase().match(/\.(jpe?g|png|webp|svg)$/)
    );

    if (imageFiles.length === 0) {
      setFormError('Formatos permitidos para páginas: JPG, JPEG, PNG y WebP (o archivo PDF).');
      return;
    }

    setPdfFile(null);
    setPdfName('');

    const loaded: PageItem[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i];
      if (f.size > 25 * 1024 * 1024) {
        setFormError(`La imagen ${f.name} supera el tamaño máximo permitido (25 MB).`);
        return;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsDataURL(f);
      });
      if (dataUrl) {
        loaded.push({
          id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`,
          file: f,
          dataUrl,
          name: f.name,
          mimeType: f.type || 'image/jpeg',
        });
      }
    }

    setPageItems((prev) => [...prev, ...loaded]);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await processSelectedFiles(files);
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    setPageItems((prev) => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleRemovePage = (index: number) => {
    setPageItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const isGeneralDoc = isGeneralDocumentType(docType);
    if (docType === 'OTHER' && !customDocName.trim()) {
      setFormError('Ingresá el nombre del documento.');
      return;
    }
    const selectedClass = classes.find(entry => entry.id === docClass && entry.eventId === event.id);
    if (!isGeneralDoc && !selectedClass) {
      setFormError('Seleccioná la prueba a la que pertenece el documento.');
      return;
    }

    if (!pdfFile && pageItems.length === 0) {
      setFormError('Cargá al menos una página o seleccioná un archivo PDF.');
      return;
    }

    const finalDocName = docType === 'OTHER'
      ? customDocName.trim()
      : documentLabel({ type: docType, classId: isGeneralDoc ? null : docClass }, classes);

    setSaving(true);
    setSaveProgress(pdfFile ? 'Subiendo documento PDF...' : 'Subiendo páginas...');
    setFormError('');
    try {
      if (pdfFile) {
        await addDocument(
          {
            eventId: event.id,
            classId: isGeneralDoc ? null : (docClass || null),
            name: finalDocName,
            type: docType,
            eventDate: isGeneralDoc ? null : selectedClass!.date,
            fileUrl: '',
            mimeType: 'application/pdf',
          },
          pdfFile
        );
      } else {
        setSaveProgress(`Subiendo ${pageItems.length} página(s)...`);
        await addDocument(
          {
            eventId: event.id,
            classId: isGeneralDoc ? null : (docClass || null),
            name: finalDocName,
            type: docType,
            eventDate: isGeneralDoc ? null : selectedClass!.date,
            fileUrl: pageItems[0]?.dataUrl || '',
            mimeType: pageItems[0]?.mimeType || 'image/jpeg',
          },
          undefined,
          pageItems.map((p) => ({
            file: p.file,
            dataUrl: p.dataUrl,
            name: p.name,
            mimeType: p.mimeType,
          }))
        );
      }

      // Reset form
      setIsAdding(false);
      setPageItems([]);
      setPdfFile(null);
      setPdfName('');
      setDocClass('');
      setCustomDocName('');
      setFormError('');
      setSaveProgress('');
    } catch (error) {
      setFormError((error as Error).message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  };

  const runAction = (action: Promise<unknown>) => { void action.catch(error => setFormError(error.message || 'No se pudo guardar.')); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 shrink-0">
          <div>
            <h2 className="font-display text-lg font-black text-neutral-900">
              Documentos del Concurso
            </h2>
            <p className="text-xs text-neutral-500 font-medium truncate max-w-md">
              {event.name} · {event.venue}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && <p role="alert" className="text-sm text-red-700 py-2">{formError}</p>}
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Top Actions: Add Document Button */}
          {!isAdding && (
            <div className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-xs font-bold text-neutral-700">
                {documents.length} {documents.length === 1 ? 'documento cargado' : 'documentos cargados'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  handleTypeChange('PROGRAM');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ AGREGAR DOCUMENTO</span>
              </button>
            </div>
          )}

          {/* ADD DOCUMENT FORM */}
          {isAdding && (
            <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                  Nuevo Documento
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded bg-red-100 text-red-800 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveDocument} className="space-y-4">
                {/* 1. TIPO */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Tipo de documento *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('PROGRAM')}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        docType === 'PROGRAM'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Anteprograma
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('REGULATION')}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        docType === 'REGULATION'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Reglamento
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('OTHER')}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        docType === 'OTHER'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Otro documento
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('START_LIST')}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        docType === 'START_LIST'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Listado
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('RESULT')}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        docType === 'RESULT'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Resultado
                    </button>
                  </div>
                </div>

                {docType === 'OTHER' ? (
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Nombre del documento *
                    </label>
                    <input
                      type="text"
                      required
                      value={customDocName}
                      onChange={e => { setCustomDocName(e.target.value); setFormError(''); }}
                      placeholder="Ej: Información para participantes, Estabulación..."
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-900 focus:outline-hidden focus:border-[#123E59]"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Asociado al concurso general con nombre personalizado.
                    </p>
                  </div>
                ) : docType === 'PROGRAM' || docType === 'REGULATION' ? (
                  <p className="text-sm text-neutral-600">
                    {docType === 'PROGRAM'
                      ? 'El anteprograma se asocia al concurso completo.'
                      : 'El reglamento se asocia al concurso completo.'}
                  </p>
                ) : (
                  <label className="block text-sm font-bold">
                    Prueba del documento
                    <select required aria-label="Prueba del documento" value={docClass} onChange={form => setDocClass(form.target.value)} className="block w-full p-3 border rounded-lg mt-1 text-sm">
                      <option value="" disabled>Seleccioná una prueba</option>
                      {classes.filter(entry => entry.eventId === event.id).map(entry => {
                        const sched = formatClassSchedule(entry);
                        return <option key={entry.id} value={entry.id}>{entry.date} · {sched ? `${sched} · ` : ''}Prueba {entry.number} · {entry.name}{arenas.filter(arena => arena.eventId === event.id).length > 1 ? ' · ' + arenas.find(arena => arena.id === entry.arenaId)?.name : ''}</option>;
                      })}
                    </select>
                    {!classes.some(entry => entry.eventId === event.id) && <span className="block text-xs text-neutral-500 mt-2">Primero cargá las pruebas desde el botón Pruebas del concurso.</span>}
                  </label>
                )}

                {/* 4. ARCHIVO O PÁGINAS MULTIPÁGINA */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
                    Archivo o Páginas (PDF o múltiples JPG, JPEG, PNG, WebP) *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />

                  {/* If PDF file is chosen */}
                  {pdfFile && (
                    <div className="p-3 bg-white border border-neutral-300 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                          PDF
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {pdfName || pdfFile.name}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            Documento PDF oficial listo para visualización y descarga ({Math.round(pdfFile.size / 1024)} KB)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPdfFile(null);
                          setPdfName('');
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                        title="Quitar PDF"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* If multiple image pages are chosen */}
                  {pageItems.length > 0 && (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-neutral-300 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <span className="text-xs font-bold text-neutral-800">
                          Páginas cargadas ({pageItems.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-bold text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar más páginas</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {pageItems.map((page, idx) => (
                          <div
                            key={page.id}
                            className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={page.dataUrl}
                                alt={`Pág ${idx + 1}`}
                                className="w-8 h-10 object-cover rounded border border-neutral-300 shrink-0 bg-white"
                              />
                              <div className="min-w-0">
                                <span className="font-extrabold text-neutral-900 block text-[11px]">
                                  Página {idx + 1}
                                </span>
                                <span className="text-[10px] text-neutral-500 truncate block max-w-[180px] sm:max-w-xs">
                                  {page.name}
                                </span>
                              </div>
                            </div>

                            {/* Reorder and Delete controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMovePage(idx, 'up')}
                                className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 disabled:hover:text-neutral-500 rounded hover:bg-neutral-200 cursor-pointer"
                                title="Subir página"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === pageItems.length - 1}
                                onClick={() => handleMovePage(idx, 'down')}
                                className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 disabled:hover:text-neutral-500 rounded hover:bg-neutral-200 cursor-pointer"
                                title="Bajar página"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePage(idx)}
                                className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 cursor-pointer"
                                title="Eliminar página"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] text-neutral-500 italic pt-1">
                        El orden seleccionado aquí se conservará exactamente en el visor vertical continuo.
                      </p>
                    </div>
                  )}

                  {/* Empty state file selector */}
                  {!pdfFile && pageItems.length === 0 && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const files = Array.from(e.dataTransfer.files);
                        void processSelectedFiles(files);
                      }}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                        isDraggingOver
                          ? 'border-[#123E59] bg-[#123E59]/5'
                          : 'border-neutral-300 hover:border-neutral-900 bg-white'
                      }`}
                    >
                      <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-neutral-800">
                        Hacé clic o arrastrá para seleccionar páginas o archivo
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Podés seleccionar múltiples imágenes a la vez (JPG, PNG, WebP) o un archivo PDF
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Todas las imágenes formarán un único documento multipágina continuo
                      </p>
                    </div>
                  )}

                </div>

                {/* Save Progress Indicator */}
                {saving && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#123E59]/10 text-[#123E59] text-xs font-bold">
                    <div className="w-4 h-4 border-2 border-[#123E59] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>{saveProgress || 'Guardando documento...'}</span>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setIsAdding(false)}
                    className="px-3.5 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-200 cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    <span>{saving ? 'Guardando...' : 'Guardar Documento'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LIST OF CURRENT DOCUMENTS */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Documentos Existentes ({documents.length})
            </h3>

            {documents.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-4 text-center">
                Aún no hay documentos cargados para este concurso.
              </p>
            ) : (
              documents.map((doc, idx) => {
                const isEditing = editingDocId === doc.id;
                const typeLabel = documentTypeLabel(doc.type);
                const isDocPdf =
                  doc.mimeType?.toLowerCase() === 'application/pdf' ||
                  doc.fileUrl?.toLowerCase().endsWith('.pdf') ||
                  doc.fileUrl?.toLowerCase().includes('.pdf?') ||
                  doc.storagePath?.toLowerCase().endsWith('.pdf');

                const dayLabel = doc.eventDate
                  ? formatDayHeader(doc.eventDate).fullFormatted
                  : 'General';

                return (
                  <div
                    key={doc.id}
                    className="p-3 bg-white border border-neutral-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Document thumbnail */}
                      <button
                        type="button"
                        onClick={() => setViewingDocumentId(doc.id)}
                        className="w-10 h-12 rounded border border-neutral-200 overflow-hidden bg-neutral-100 flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                        title="Ver en visor dedicado"
                      >
                        {isDocPdf ? (
                          <div className="w-full h-full bg-red-50 text-red-600 flex flex-col items-center justify-center p-1">
                            <FileText className="w-5 h-5 text-red-500" />
                            <span className="text-[9px] font-black tracking-tighter uppercase">PDF</span>
                          </div>
                        ) : doc.fileUrl ? (
                          <img
                            src={doc.fileUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-neutral-400" />
                        )}
                      </button>

                      {/* Details / Edit inputs */}
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <DocumentAssignment doc={doc} onSaved={() => setEditingDocId(null)} />
                        ) : (
                          <>
                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                              {doc.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
                              <span className="font-semibold text-neutral-700">
                                {typeLabel}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{dayLabel}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions: Reorder, Edit, View, Delete */}
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => runAction(reorderDocument(doc.id, 'up'))}
                        title="Subir orden"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(reorderDocument(doc.id, 'down'))}
                        title="Bajar orden"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingDocumentId(doc.id)}
                        title="Ver documento en visor dedicado"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDocId(isEditing ? null : doc.id)
                        }
                        title="Editar datos"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => {
                          setDocumentToDelete(doc);
                          setDeleteError('');
                          setStorageWarning('');
                        }}
                        title="Eliminar documento"
                        className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-neutral-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {documentToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">¿Eliminar este documento?</h3>
                <p className="text-xs text-neutral-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs space-y-1">
              <p className="font-extrabold text-neutral-900 text-sm truncate">{documentToDelete.name}</p>
              <p className="text-neutral-600">
                Tipo: <span className="font-semibold text-neutral-800">{documentTypeLabel(documentToDelete.type)}</span>
                {isGeneralDocumentType(documentToDelete.type) ? ' · General del concurso' : ''}
              </p>
              <p className="text-[11px] text-neutral-500">
                Se eliminará exclusivamente este documento y sus páginas asociadas. No afectará las pruebas ni el concurso.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-red-100 text-red-800 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            {storageWarning && (
              <div className="p-3 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">
                {storageWarning}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => { setDocumentToDelete(null); setDeleteError(''); setStorageWarning(''); }}
                className="px-4 py-2 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {storageWarning ? 'Entendido / Cerrar' : 'Cancelar'}
              </button>
              {!storageWarning && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : deleteError ? (
                    <span>Reintentar eliminación</span>
                  ) : (
                    <span>Confirmar eliminación</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function DocumentAssignment({ doc, onSaved }: { doc: DocumentItem; onSaved: () => void }) {
  const { classes, arenas, updateDocument } = useEquestrian();
  const [type, setType] = useState<DocumentType>(doc.type);
  const [classId, setClassId] = useState(isGeneralDocumentType(doc.type) ? '' : (doc.classId || ''));
  const [customName, setCustomName] = useState<string>(doc.type === 'OTHER' ? doc.name : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isGeneral = isGeneralDocumentType(type);

  const handleTypeSelect = (newType: DocumentType) => {
    setType(newType);
    if (isGeneralDocumentType(newType)) {
      setClassId('');
    }
    if (newType === 'OTHER' && !customName) {
      setCustomName(doc.type === 'OTHER' ? doc.name : '');
    }
    setError('');
  };

  return (
    <form
      className="space-y-2"
      onSubmit={async form => {
        form.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (type === 'OTHER' && !customName.trim()) {
            setError('Ingresá el nombre del documento.');
            setBusy(false);
            return;
          }
          const finalClassId = isGeneral ? null : classId;
          const targetClass = !isGeneral ? classes.find(c => c.id === finalClassId && c.eventId === doc.eventId) : undefined;
          if (!isGeneral && !targetClass) {
            setError('Seleccioná la prueba a la que pertenece el documento.');
            setBusy(false);
            return;
          }
          const finalDocName = type === 'OTHER'
            ? customName.trim()
            : documentLabel({ type, classId: finalClassId }, classes);

          await updateDocument(doc.id, {
            type,
            classId: finalClassId,
            eventDate: isGeneral ? null : (targetClass?.date || null),
            name: finalDocName,
          });
          onSaved();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-xs font-bold text-neutral-700">
        Tipo de documento
        <select
          className="w-full p-2 border border-neutral-300 rounded-lg mt-1 text-xs bg-white text-neutral-900"
          value={type}
          onChange={form => handleTypeSelect(form.target.value as DocumentType)}
        >
          <option value="PROGRAM">Anteprograma</option>
          <option value="REGULATION">Reglamento</option>
          <option value="OTHER">Otro documento</option>
          <option value="START_LIST">Listado</option>
          <option value="RESULT">Resultados</option>
        </select>
      </label>
      {type === 'OTHER' && (
        <label className="block text-xs font-bold text-neutral-700">
          Nombre del documento *
          <input
            type="text"
            required
            value={customName}
            onChange={e => { setCustomName(e.target.value); setError(''); }}
            placeholder="Ej: Información para participantes"
            className="w-full p-2 border border-neutral-300 rounded-lg mt-1 text-xs bg-white text-neutral-900"
          />
        </label>
      )}
      {!isGeneral ? (
        <label className="block text-xs font-bold text-neutral-700">
          Prueba asociada *
          <select
            required
            className="w-full p-2 border border-neutral-300 rounded-lg mt-1 text-xs bg-white text-neutral-900"
            value={classId}
            onChange={form => { setClassId(form.target.value); setError(''); }}
          >
            <option value="" disabled>Seleccioná una prueba</option>
            {classes.filter(entry => entry.eventId === doc.eventId).map(entry => (
              <option key={entry.id} value={entry.id}>
                {entry.date} · Prueba {entry.number} · {entry.name}
                {arenas.filter(arena => arena.eventId === doc.eventId).length > 1
                  ? ' · ' + arenas.find(arena => arena.id === entry.arenaId)?.name
                  : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-neutral-500 font-medium">
          {type === 'PROGRAM'
            ? 'Asociado al concurso general (Anteprograma).'
            : type === 'REGULATION'
            ? 'Asociado al concurso general (Reglamento).'
            : 'Asociado al concurso general con nombre personalizado.'}
        </p>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="px-3 min-h-9 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Guardando...' : 'Guardar asignación'}
        </button>
        <button
          type="button"
          onClick={onSaved}
          disabled={busy}
          className="px-3 min-h-9 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

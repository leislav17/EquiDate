import React, { useState, useMemo, useRef } from 'react';
import {
  EquestrianEvent,
  DocumentItem,
  DocumentType,
  CompetitionClass
} from '../../../types/equestrian';
import {
  isGeneralDocumentType,
  documentTypeLabel,
  documentLabel
} from '../../../utils/documents';
import { useEquestrian } from '../../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../../utils/dateUtils';
import { sortClasses, sortArenas } from '../../../utils/schedule';
import {
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Eye,
  AlertTriangle,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Calendar,
  Check,
  Loader2
} from 'lucide-react';

interface DocumentsSectionProps {
  event: EquestrianEvent;
}

interface PageItem {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  mimeType: string;
}

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({ event }) => {
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
  const dates = getDaysBetween(event.startDate, event.endDate);
  const eventArenas = sortArenas(arenas.filter((a) => a.eventId === event.id));
  const eventClasses = classes.filter((c) => c.eventId === event.id);

  // Active day selection for day-by-day documents
  const [selectedDate, setSelectedDate] = useState<string>(() => dates[0] || event.startDate);

  // Modal / Form state: 'none' | 'general' | 'day' | 'fix_unassigned'
  const [activeFormMode, setActiveFormMode] = useState<'none' | 'general' | 'day' | 'fix_unassigned'>('none');
  const [editingUnassignedDoc, setEditingUnassignedDoc] = useState<DocumentItem | null>(null);

  // General doc form state
  const [generalDocType, setGeneralDocType] = useState<'PROGRAM' | 'REGULATION' | 'OTHER'>('PROGRAM');
  const [customDocName, setCustomDocName] = useState('');

  // Day doc form state
  const [dayDocType, setDayDocType] = useState<'START_LIST' | 'RESULT'>('START_LIST');
  const [dayDocClassId, setDayDocClassId] = useState('');

  // File uploads (shared across forms)
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageItems, setPageItems] = useState<PageItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion modal
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Segregation of documents
  const generalDocs = useMemo(() => {
    return documents
      .filter((d) => isGeneralDocumentType(d.type))
      .sort((a, b) => a.order - b.order);
  }, [documents]);

  const { daySpecificDocs, unassignedDocs } = useMemo(() => {
    const daySpecific: DocumentItem[] = [];
    const unassigned: DocumentItem[] = [];

    const validClassIds = new Set(eventClasses.map((c) => c.id));
    const validDates = new Set(dates);

    documents.forEach((doc) => {
      if (isGeneralDocumentType(doc.type)) return;

      const isDateValid = doc.eventDate && validDates.has(doc.eventDate);
      const isClassValid = doc.classId && validClassIds.has(doc.classId);

      if (isDateValid && isClassValid) {
        if (doc.eventDate === selectedDate) {
          daySpecific.push(doc);
        }
      } else {
        unassigned.push(doc);
      }
    });

    daySpecific.sort((a, b) => a.order - b.order);
    return { daySpecificDocs: daySpecific, unassignedDocs: unassigned };
  }, [documents, eventClasses, dates, selectedDate]);

  // Classes for currently selected day
  const classesForSelectedDay = useMemo(() => {
    return sortClasses(eventClasses.filter((c) => c.date === selectedDate));
  }, [eventClasses, selectedDate]);

  const resetForm = () => {
    setActiveFormMode('none');
    setGeneralDocType('PROGRAM');
    setCustomDocName('');
    setDayDocType('START_LIST');
    setDayDocClassId('');
    setEditingUnassignedDoc(null);
    setPdfFile(null);
    setPageItems([]);
    setFormError('');
    setSaveProgress('');
  };

  const handleOpenGeneralForm = () => {
    resetForm();
    setActiveFormMode('general');
  };

  const handleOpenDayForm = () => {
    resetForm();
    if (classesForSelectedDay.length > 0) {
      setDayDocClassId(classesForSelectedDay[0].id);
    }
    setActiveFormMode('day');
  };

  const handleOpenFixUnassigned = (doc: DocumentItem) => {
    resetForm();
    setEditingUnassignedDoc(doc);
    setDayDocType(doc.type === 'RESULT' ? 'RESULT' : 'START_LIST');
    if (classesForSelectedDay.length > 0) {
      setDayDocClassId(classesForSelectedDay[0].id);
    }
    setActiveFormMode('fix_unassigned');
  };

  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setFormError('');

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
      setPageItems([]);
      return;
    }

    // Process image files
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validImageExts = ['jpg', 'jpeg', 'png', 'webp'];

    const newPageItems: PageItem[] = [];

    for (const f of files) {
      const ext = (f.name || '').split('.').pop()?.toLowerCase() || '';
      if (!validImageTypes.includes(f.type.toLowerCase()) && !validImageExts.includes(ext)) {
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        setFormError(`La imagen ${f.name} supera el tamaño máximo de 15 MB.`);
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsDataURL(f);
      });

      newPageItems.push({
        id: crypto.randomUUID(),
        file: f,
        dataUrl,
        name: f.name,
        mimeType: f.type || 'image/jpeg',
      });
    }

    if (newPageItems.length === 0) {
      setFormError('Seleccioná un archivo PDF o una o más imágenes JPG, PNG o WebP.');
      return;
    }

    setPdfFile(null);
    setPageItems((prev) => [...prev, ...newPageItems]);
  };

  const handleSaveGeneralDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (generalDocType === 'OTHER' && !customDocName.trim()) {
      setFormError('Por favor ingresá un nombre para este documento general.');
      return;
    }

    if (!pdfFile && pageItems.length === 0) {
      setFormError('Por favor seleccioná un archivo PDF o al menos una imagen.');
      return;
    }

    setSaving(true);
    setSaveProgress('Guardando documento general…');

    try {
      const docName =
        generalDocType === 'PROGRAM'
          ? 'Anteprograma'
          : generalDocType === 'REGULATION'
          ? 'Reglamento'
          : customDocName.trim();

      if (pdfFile) {
        await addDocument(
          {
            eventId: event.id,
            classId: null,
            name: docName,
            type: generalDocType,
            eventDate: null,
            fileUrl: '',
            mimeType: 'application/pdf',
          },
          pdfFile
        );
      } else {
        setSaveProgress(`Subiendo ${pageItems.length} página(s)…`);
        await addDocument(
          {
            eventId: event.id,
            classId: null,
            name: docName,
            type: generalDocType,
            eventDate: null,
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

      resetForm();
    } catch (err) {
      setFormError((err as Error).message || 'Error al guardar el documento.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  };

  const handleSaveDayDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!dayDocClassId) {
      setFormError('Seleccioná la prueba a la que pertenece el documento.');
      return;
    }

    const targetClass = classesForSelectedDay.find((c) => c.id === dayDocClassId);
    if (!targetClass) {
      setFormError('La prueba seleccionada no pertenece a la jornada actual.');
      return;
    }

    if (!pdfFile && pageItems.length === 0) {
      setFormError('Por favor seleccioná un archivo PDF o al menos una imagen.');
      return;
    }

    setSaving(true);
    setSaveProgress('Guardando documento de la jornada…');

    try {
      const docName = documentLabel(
        { type: dayDocType, classId: targetClass.id },
        eventClasses
      );

      if (pdfFile) {
        await addDocument(
          {
            eventId: event.id,
            classId: targetClass.id,
            name: docName,
            type: dayDocType,
            eventDate: targetClass.date,
            fileUrl: '',
            mimeType: 'application/pdf',
          },
          pdfFile
        );
      } else {
        setSaveProgress(`Subiendo ${pageItems.length} página(s)…`);
        await addDocument(
          {
            eventId: event.id,
            classId: targetClass.id,
            name: docName,
            type: dayDocType,
            eventDate: targetClass.date,
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

      resetForm();
    } catch (err) {
      setFormError((err as Error).message || 'Error al guardar el documento.');
    } finally {
      setSaving(false);
      setSaveProgress('');
    }
  };

  const handleSaveFixUnassigned = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnassignedDoc || !dayDocClassId) return;

    const targetClass = eventClasses.find((c) => c.id === dayDocClassId);
    if (!targetClass) {
      setFormError('Seleccioná una prueba válida.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await updateDocument(editingUnassignedDoc.id, {
        type: dayDocType,
        classId: targetClass.id,
        eventDate: targetClass.date,
      });
      resetForm();
    } catch (err) {
      setFormError((err as Error).message || 'Error al reasignar documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDocument(documentToDelete.id);
      setDocumentToDelete(null);
    } catch (err) {
      setDeleteError((err as Error).message || 'Error al eliminar el documento.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ========================================================= */}
      {/* 1. DOCUMENTOS GENERALES (Anteprograma, Reglamento, Otros) */}
      {/* ========================================================= */}
      <section className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
          <div>
            <h3 className="font-display text-base font-black text-[#123E59] uppercase tracking-wide">
              Documentos Generales del Concurso
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Anteprogramas, reglamentos y normativas asociadas a todo el evento.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenGeneralForm}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar documento general</span>
          </button>
        </div>

        {/* Formulario nuevo documento general */}
        {activeFormMode === 'general' && (
          <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-black uppercase text-[#123E59] tracking-wider">
                Nuevo Documento General
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Cancelar
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveGeneralDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Tipo de Documento General *
                </label>
                <div className="grid grid-cols-3 gap-2 max-w-md">
                  <button
                    type="button"
                    onClick={() => setGeneralDocType('PROGRAM')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      generalDocType === 'PROGRAM'
                        ? 'bg-[#123E59] text-white border-[#123E59]'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    Anteprograma
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneralDocType('REGULATION')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      generalDocType === 'REGULATION'
                        ? 'bg-[#123E59] text-white border-[#123E59]'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    Reglamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneralDocType('OTHER')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      generalDocType === 'OTHER'
                        ? 'bg-[#123E59] text-white border-[#123E59]'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    Otro documento
                  </button>
                </div>
              </div>

              {generalDocType === 'OTHER' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Título o Nombre del Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    placeholder="Ej: Instrucciones de estabulación y boxes"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#123E59] bg-white"
                  />
                </div>
              )}

              {/* Selector de archivos: PDF o múltiples imágenes */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Archivo o Imágenes *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    void processSelectedFiles(files);
                  }}
                  className="hidden"
                />

                {pdfFile ? (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-300">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-xs font-bold text-neutral-800">{pdfFile.name}</p>
                        <p className="text-[10px] text-neutral-500">
                          {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB · Documento PDF
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="p-1 text-neutral-400 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : pageItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>{pageItems.length} página(s) cargada(s)</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#123E59] font-bold underline"
                      >
                        + Agregar más páginas
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {pageItems.map((page, idx) => (
                        <div key={page.id} className="relative group border rounded-lg p-1 bg-white">
                          <img
                            src={page.dataUrl}
                            alt=""
                            className="w-full h-16 object-cover rounded"
                          />
                          <span className="text-[9px] font-bold block text-center mt-1">
                            Pág. {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPageItems((prev) => prev.filter((p) => p.id !== page.id))
                            }
                            className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl opacity-80 hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-neutral-300 hover:border-[#123E59] rounded-xl p-6 text-center transition-colors bg-white cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-neutral-700">
                      Seleccionar archivo PDF o imágenes
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Podés subir un archivo PDF o varias imágenes para unirlas en un documento
                    </p>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#123E59] text-white text-xs font-bold rounded-xl hover:bg-[#0e3247] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{saveProgress || 'Guardando…'}</span>
                    </>
                  ) : (
                    <span>Guardar documento general</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de documentos generales */}
        {generalDocs.length === 0 ? (
          <p className="text-xs sm:text-sm text-neutral-500 py-3 text-center bg-neutral-50 rounded-xl">
            No hay documentos generales cargados (Anteprograma, Reglamento, etc.).
          </p>
        ) : (
          <div className="space-y-2">
            {generalDocs.map((doc, idx) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#123E59]/10 text-[#123E59] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        {documentTypeLabel(doc.type)}
                      </span>
                    </div>
                    <p className="font-display font-bold text-sm text-neutral-900 truncate mt-0.5">
                      {doc.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <div className="flex items-center">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void reorderDocument(doc.id, 'up')}
                      title="Subir orden"
                      className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === generalDocs.length - 1}
                      onClick={() => void reorderDocument(doc.id, 'down')}
                      title="Bajar orden"
                      className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingDocumentId(doc.id)}
                    title="Ver documento"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#123E59] bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocumentToDelete(doc)}
                    title="Eliminar documento"
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 2. LISTADOS Y RESULTADOS POR JORNADA                     */}
      {/* ========================================================= */}
      <section className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
        <div>
          <h3 className="font-display text-base font-black text-[#123E59] uppercase tracking-wide">
            Listados y Resultados por Jornada
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Seleccioná una jornada para ver o cargar sus listados y resultados. Cada documento queda asociado a su prueba correspondiente.
          </p>
        </div>

        {/* Selector horizontal de jornadas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {dates.map((dayDate) => {
            const isSelected = dayDate === selectedDate;
            const header = formatDayHeader(dayDate);
            const countForDay = documents.filter(
              (d) => !isGeneralDocumentType(d.type) && d.eventDate === dayDate
            ).length;

            return (
              <button
                key={dayDate}
                type="button"
                onClick={() => {
                  setSelectedDate(dayDate);
                  if (activeFormMode === 'day') {
                    // Update class selection for newly chosen day
                    const dayCls = eventClasses.filter((c) => c.date === dayDate);
                    setDayDocClassId(dayCls[0]?.id || '');
                  }
                }}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left ${
                  isSelected
                    ? 'bg-[#123E59] text-white border-[#123E59] shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <span>{header.fullFormatted}</span>
                <span
                  className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {countForDay}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cabecera del día seleccionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#123E59]" />
            <span className="font-display font-black text-sm text-[#123E59]">
              {formatDayHeader(selectedDate).fullFormatted}
            </span>
            <span className="text-xs text-neutral-500">
              · {classesForSelectedDay.length}{' '}
              {classesForSelectedDay.length === 1 ? 'prueba' : 'pruebas'}
            </span>
          </div>

          <button
            type="button"
            disabled={classesForSelectedDay.length === 0}
            onClick={handleOpenDayForm}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto disabled:opacity-40"
            title={
              classesForSelectedDay.length === 0
                ? 'Primero debés agregar pruebas en esta jornada'
                : 'Agregar listado o resultado para esta jornada'
            }
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar listado o resultado</span>
          </button>
        </div>

        {/* Estado si la jornada NO tiene pruebas registradas */}
        {classesForSelectedDay.length === 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <p className="font-bold mb-0.5">Esta jornada no tiene pruebas registradas.</p>
            <p>
              Para asociar listados o resultados, primero agregá las pruebas del día en la pestaña{' '}
              <span className="font-semibold">"Jornadas y pruebas"</span>.
            </p>
          </div>
        )}

        {/* Formulario para agregar listado o resultado del día */}
        {activeFormMode === 'day' && classesForSelectedDay.length > 0 && (
          <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-black uppercase text-[#123E59] tracking-wider">
                Nuevo Documento · {formatDayHeader(selectedDate).fullFormatted}
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Cancelar
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDayDoc} className="space-y-4">
              {/* Tipo: Listado o Resultados */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Tipo *
                </label>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <button
                    type="button"
                    onClick={() => setDayDocType('START_LIST')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      dayDocType === 'START_LIST'
                        ? 'bg-[#123E59] text-white border-[#123E59]'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    Listado de orden
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayDocType('RESULT')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      dayDocType === 'RESULT'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    Resultados
                  </button>
                </div>
              </div>

              {/* Selector de prueba: ÚNICAMENTE pruebas de la jornada actual */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Prueba de esta Jornada *
                </label>
                <select
                  required
                  value={dayDocClassId}
                  onChange={(e) => setDayDocClassId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] bg-white"
                >
                  {classesForSelectedDay.map((c) => {
                    const arena = eventArenas.find((a) => a.id === c.arenaId);
                    return (
                      <option key={c.id} value={c.id}>
                        Prueba {c.number}: {c.name} {arena ? `(${arena.name})` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Solo se muestran las pruebas de {formatDayHeader(selectedDate).fullFormatted}.
                </p>
              </div>

              {/* Subida de archivo: PDF o imágenes */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Archivo o Imágenes *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    void processSelectedFiles(files);
                  }}
                  className="hidden"
                />

                {pdfFile ? (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-300">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-xs font-bold text-neutral-800">{pdfFile.name}</p>
                        <p className="text-[10px] text-neutral-500">
                          {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB · PDF
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="p-1 text-neutral-400 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : pageItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>{pageItems.length} página(s) seleccionada(s)</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#123E59] font-bold underline"
                      >
                        + Agregar más
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {pageItems.map((page, idx) => (
                        <div key={page.id} className="relative group border rounded-lg p-1 bg-white">
                          <img
                            src={page.dataUrl}
                            alt=""
                            className="w-full h-16 object-cover rounded"
                          />
                          <span className="text-[9px] font-bold block text-center mt-1">
                            Pág. {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPageItems((prev) => prev.filter((p) => p.id !== page.id))
                            }
                            className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl opacity-80 hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-neutral-300 hover:border-[#123E59] rounded-xl p-6 text-center transition-colors bg-white cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-neutral-700">
                      Seleccionar archivo PDF o fotos del orden/resultados
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Podés subir un archivo PDF o varias fotos consecutivas
                    </p>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#123E59] text-white text-xs font-bold rounded-xl hover:bg-[#0e3247] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{saveProgress || 'Guardando…'}</span>
                    </>
                  ) : (
                    <span>Guardar documento</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de documentos de la jornada activa */}
        {daySpecificDocs.length === 0 ? (
          <div className="text-center py-8 bg-neutral-50 rounded-xl border border-neutral-200/80">
            <p className="text-xs sm:text-sm font-semibold text-neutral-600">
              No hay listados ni resultados cargados para esta jornada.
            </p>
            {classesForSelectedDay.length > 0 && (
              <p className="text-xs text-neutral-400 mt-1">
                Tocá "+ Agregar listado o resultado" para publicar los órdenes o resultados de las pruebas.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {daySpecificDocs.map((doc, idx) => {
              const assignedClass = eventClasses.find((c) => c.id === doc.classId);
              const arena = assignedClass
                ? eventArenas.find((a) => a.id === assignedClass.arenaId)
                : null;
              const isStartList = doc.type === 'START_LIST';

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isStartList
                          ? 'bg-blue-50 text-[#123E59]'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isStartList
                              ? 'bg-blue-50 text-[#123E59] border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isStartList ? 'LISTADO' : 'RESULTADOS'}
                        </span>

                        {assignedClass && (
                          <span className="text-xs font-bold text-neutral-700">
                            Prueba {assignedClass.number} · {assignedClass.name}
                          </span>
                        )}
                        {arena && (
                          <span className="text-[11px] text-neutral-400 font-medium">
                            ({arena.name})
                          </span>
                        )}
                      </div>

                      <p className="font-display font-medium text-xs text-neutral-500 truncate mt-0.5">
                        {doc.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => setViewingDocumentId(doc.id)}
                      title="Ver documento"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#123E59] bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ver</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDocumentToDelete(doc)}
                      title="Eliminar documento"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 3. DOCUMENTOS SIN JORNADA ASIGNADA (Antiguos o desalineados) */}
      {/* ========================================================= */}
      {unassignedDocs.length > 0 && (
        <section className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-sm font-black text-amber-900 uppercase tracking-wide">
                Documentos sin jornada asignada ({unassignedDocs.length})
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Estos documentos anteriores no tienen una jornada o prueba válida vinculada en el concurso actual. Podés reasignarlos a una prueba o eliminarlos.
              </p>
            </div>
          </div>

          {/* Formulario para reasignar */}
          {activeFormMode === 'fix_unassigned' && editingUnassignedDoc && (
            <div className="bg-white border border-amber-300 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black uppercase text-amber-900">
                Reasignar documento: {editingUnassignedDoc.name}
              </h4>

              {formError && (
                <div role="alert" className="p-2 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-lg">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveFixUnassigned} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                      Tipo de documento
                    </label>
                    <select
                      value={dayDocType}
                      onChange={(e) => setDayDocType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-semibold"
                    >
                      <option value="START_LIST">Listado de orden</option>
                      <option value="RESULT">Resultados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                      Asignar a Prueba del Concurso
                    </label>
                    <select
                      required
                      value={dayDocClassId}
                      onChange={(e) => setDayDocClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-semibold"
                    >
                      <option value="">Seleccionar prueba…</option>
                      {eventClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.date} · Prueba {c.number}: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#123E59] text-white text-xs font-bold rounded-lg"
                  >
                    {saving ? 'Guardando…' : 'Confirmar asignación'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {unassignedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-neutral-900 truncate">{doc.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    Tipo: {documentTypeLabel(doc.type)}
                    {doc.eventDate ? ` · Fecha guardada: ${doc.eventDate}` : ' · Sin fecha'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => setViewingDocumentId(doc.id)}
                    className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg"
                    title="Ver"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenFixUnassigned(doc)}
                    className="px-2.5 py-1 text-xs font-bold text-[#123E59] bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                  >
                    Asignar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentToDelete(doc)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal de confirmación para eliminar documento */}
      {documentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-4">
            <h3 className="font-display font-black text-base text-neutral-900">
              ¿Eliminar documento?
            </h3>
            <p className="text-xs text-neutral-600">
              Se eliminará <span className="font-bold">{documentToDelete.name}</span> de forma permanente de la base de datos y Storage.
            </p>

            {deleteError && (
              <div role="alert" className="p-2 bg-red-50 text-red-800 text-xs font-semibold rounded">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDocumentToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useRef } from 'react';
import {
  EquestrianEvent,
  DocumentItem,
  DocumentType
} from '../../types/equestrian';
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
import { createStartListDoc, createResultDoc, createAnteprogramaDoc } from '../../data/sampleDocuments';

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EquestrianEvent;
}

export const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const {
    getDocumentsForEvent,
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
  const [docDay, setDocDay] = useState<string>('general');
  const [docName, setDocName] = useState<string>('');
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMimeType, setFileMimeType] = useState<DocumentItem['mimeType']>('image/png');
  const [fileName, setFileName] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleTypeChange = (newType: DocumentType) => {
    setDocType(newType);
    if (newType === 'PROGRAM') {
      setDocDay('general');
      if (!docName || docName.startsWith('Orden') || docName.startsWith('Resultado')) {
        setDocName('Anteprograma Oficial');
      }
    } else if (newType === 'START_LIST') {
      if (availableDays.length > 0 && docDay === 'general') {
        setDocDay(availableDays[0].dateStr);
      }
      if (!docName || docName.startsWith('Anteprograma') || docName.startsWith('Resultado')) {
        setDocName('Orden de Ingreso — Prueba 1 (1.10 m)');
      }
    } else if (newType === 'RESULT') {
      if (availableDays.length > 0 && docDay === 'general') {
        setDocDay(availableDays[0].dateStr);
      }
      if (!docName || docName.startsWith('Anteprograma') || docName.startsWith('Orden')) {
        setDocName('Resultados Oficiales — Prueba 1');
      }
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);
    const mime = file.type || 'image/png';
    setFileMimeType(mime as any);

    // Read as Data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper to quickly load a realistic sample template if admin wants to test without local files
  const handleUseSampleFile = (type: DocumentType) => {
    setSelectedFile(null);
    if (type === 'PROGRAM') {
      const sample = createAnteprogramaDoc({
        eventName: event.name,
        venue: event.venue,
        dates: `${event.startDate} — ${event.endDate}`,
        page: 1,
        totalPages: 2
      });
      setFileDataUrl(sample);
      setFileMimeType('image/svg+xml' as any);
      setFileName('anteprograma_oficial.svg');
    } else if (type === 'START_LIST') {
      const sample = createStartListDoc({
        eventName: event.name,
        testTitle: 'Orden de Ingreso — Prueba Libre',
        height: '1.20 m',
        dayFormatted: docDay !== 'general' ? docDay : 'Jornada Oficial',
        tableBaremo: 'Tabla A al cronómetro',
        starters: [
          { order: 1, rider: 'Jinete 1', horse: 'Caballo Estrella', club: event.venue },
          { order: 2, rider: 'Jinete 2', horse: 'Cornet Boy', club: 'Club Alemán' },
          { order: 3, rider: 'Jinete 3', horse: 'Quick Silver', club: 'Club Hípico Argentino' },
        ]
      });
      setFileDataUrl(sample);
      setFileMimeType('image/svg+xml' as any);
      setFileName('orden_ingreso.svg');
    } else {
      const sample = createResultDoc({
        eventName: event.name,
        testTitle: 'Resultados Oficiales',
        height: '1.20 m',
        dayFormatted: docDay !== 'general' ? docDay : 'Jornada Oficial',
        results: [
          { rank: 1, rider: 'Jinete Ganador', horse: 'Caballo Estrella', club: event.venue, r1Faults: 0, r1Time: '67.20', jumpOffFaults: 0, jumpOffTime: '34.10', prize: '$150.000' },
          { rank: 2, rider: 'Segundo Puesto', horse: 'Cornet Boy', club: 'Club Alemán', r1Faults: 0, r1Time: '68.90', jumpOffFaults: 4, jumpOffTime: '33.80', prize: '$100.000' },
        ]
      });
      setFileDataUrl(sample);
      setFileMimeType('image/svg+xml' as any);
      setFileName('resultados.svg');
    }
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      setFormError('Ingresá el nombre del documento.');
      return;
    }

    let finalFileUrl = fileDataUrl;
    if (!finalFileUrl) {
      // Auto generate sample for this doc
      if (docType === 'PROGRAM') {
        finalFileUrl = createAnteprogramaDoc({
          eventName: event.name,
          venue: event.venue,
          dates: `${event.startDate} — ${event.endDate}`,
          page: 1,
          totalPages: 1
        });
      } else if (docType === 'START_LIST') {
        finalFileUrl = createStartListDoc({
          eventName: event.name,
          testTitle: docName,
          height: '1.20 m',
          dayFormatted: docDay !== 'general' ? docDay : 'Día Oficial',
          tableBaremo: 'Dos Fases Especial',
          starters: [
            { order: 1, rider: 'Jinete Demostración', horse: 'Caballo Z', club: event.venue }
          ]
        });
      } else {
        finalFileUrl = createResultDoc({
          eventName: event.name,
          testTitle: docName,
          height: '1.20 m',
          dayFormatted: docDay !== 'general' ? docDay : 'Día Oficial',
          results: [
            { rank: 1, rider: 'Jinete Ganador', horse: 'Caballo Z', club: event.venue, r1Faults: 0, r1Time: '69.00', prize: 'Copa' }
          ]
        });
      }
    }

    addDocument(
      {
        eventId: event.id,
        name: docName.trim(),
        type: docType,
        eventDate: docDay === 'general' ? null : docDay,
        fileUrl: finalFileUrl,
        pages: [finalFileUrl],
        mimeType: fileMimeType,
      },
      selectedFile || undefined
    );

    // Reset form
    setIsAdding(false);
    setSelectedFile(null);
    setDocName('');
    setFileDataUrl('');
    setFileName('');
    setFormError('');
  };

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
                  <div className="grid grid-cols-3 gap-2">
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

                {/* 2. DÍA */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Día asignado *
                  </label>
                  <select
                    value={docDay}
                    onChange={(e) => setDocDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs sm:text-sm bg-white focus:outline-none focus:border-neutral-900 font-medium"
                  >
                    <option value="general">General (Sin día específico / Anteprograma)</option>
                    {availableDays.map((d) => (
                      <option key={d.dateStr} value={d.dateStr}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. NOMBRE */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Nombre del documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="ej. Orden de ingreso 1.20 m"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs sm:text-sm focus:outline-none focus:border-neutral-900 bg-white"
                  />
                </div>

                {/* 4. ARCHIVO (Upload / Drag & drop / Sample) */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Archivo (PDF, JPG, JPEG, PNG, WebP)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleFileSelected}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-300 hover:border-neutral-900 rounded-xl p-4 text-center cursor-pointer bg-white transition-colors"
                  >
                    <Upload className="w-5 h-5 text-neutral-400 mx-auto mb-1" />
                    {fileName ? (
                      <p className="text-xs font-bold text-neutral-900">{fileName}</p>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-neutral-700">
                          Hacé clic o arrastrá para subir archivo
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          PDF, JPG, JPEG, PNG, WebP
                        </p>
                      </>
                    )}
                  </div>

                  {/* Sample auto-generator button for convenience */}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">
                      O usá una plantilla deportiva oficial:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUseSampleFile(docType)}
                      className="text-[10px] font-bold text-neutral-900 hover:underline cursor-pointer"
                    >
                      Autogenerar Documento Oficial
                    </button>
                  </div>
                </div>

                {/* File Preview Thumbnail if uploaded */}
                {fileDataUrl && (
                  <div className="p-2 border border-neutral-200 rounded-lg bg-white flex items-center gap-3">
                    <img
                      src={fileDataUrl}
                      alt="Preview"
                      className="w-12 h-14 object-cover border border-neutral-200 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-neutral-900">
                        {fileName || 'Documento listo para guardar'}
                      </p>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {fileMimeType}
                      </span>
                    </div>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3.5 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg cursor-pointer"
                  >
                    Guardar Documento
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
                const typeLabel =
                  doc.type === 'PROGRAM'
                    ? 'Anteprograma'
                    : doc.type === 'START_LIST'
                    ? 'Listado'
                    : 'Resultado';

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
                        {doc.fileUrl ? (
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
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              defaultValue={doc.name}
                              onBlur={(e) =>
                                updateDocument(doc.id, { name: e.target.value.trim() })
                              }
                              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded"
                            />
                            <div className="flex gap-2">
                              <select
                                defaultValue={doc.type}
                                onChange={(e) =>
                                  updateDocument(doc.id, {
                                    type: e.target.value as DocumentType
                                  })
                                }
                                className="text-[11px] px-2 py-0.5 border border-neutral-300 rounded bg-white"
                              >
                                <option value="PROGRAM">Anteprograma</option>
                                <option value="START_LIST">Listado</option>
                                <option value="RESULT">Resultado</option>
                              </select>
                              <select
                                defaultValue={doc.eventDate || 'general'}
                                onChange={(e) =>
                                  updateDocument(doc.id, {
                                    eventDate:
                                      e.target.value === 'general'
                                        ? null
                                        : e.target.value
                                  })
                                }
                                className="text-[11px] px-2 py-0.5 border border-neutral-300 rounded bg-white"
                              >
                                <option value="general">General</option>
                                {availableDays.map((d) => (
                                  <option key={d.dateStr} value={d.dateStr}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setEditingDocId(null)}
                                className="p-1 text-emerald-600 hover:text-emerald-800"
                                title="Guardar cambios"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
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
                        onClick={() => reorderDocument(doc.id, 'up')}
                        title="Subir orden"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderDocument(doc.id, 'down')}
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
                        onClick={() => deleteDocument(doc.id)}
                        title="Eliminar documento"
                        className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer"
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
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Share2,
  FileText
} from 'lucide-react';

interface DedicatedDocumentViewProps {
  documentId: string;
}

export const DedicatedDocumentView: React.FC<DedicatedDocumentViewProps> = ({ documentId }) => {
  const { getDocumentById, setViewingDocumentId, getEventById } = useEquestrian();

  const doc = getDocumentById(documentId);
  const event = doc ? getEventById(doc.eventId) : null;

  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Determine if document is PDF
  const isPdf = Boolean(
    doc?.mimeType?.toLowerCase() === 'application/pdf' ||
    doc?.fileUrl?.toLowerCase().endsWith('.pdf') ||
    doc?.fileUrl?.toLowerCase().includes('.pdf?') ||
    doc?.storagePath?.toLowerCase().endsWith('.pdf')
  );

  // Pages array for image-based documents
  const allPages: string[] = !isPdf && doc?.pages && doc.pages.length > 0 ? doc.pages : [doc?.fileUrl || ''];
  const totalPages = allPages.length;

  // Reset when documentId changes
  useEffect(() => {
    setScale(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [documentId]);

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  // Download action with correct file extension
  const handleDownload = () => {
    if (!doc) return;
    const link = window.document.createElement('a');
    link.href = doc.fileUrl;
    const ext = isPdf
      ? 'pdf'
      : doc.mimeType?.includes('png')
      ? 'png'
      : doc.mimeType?.includes('webp')
      ? 'webp'
      : doc.mimeType?.includes('jpeg') || doc.mimeType?.includes('jpg')
      ? 'jpg'
      : 'svg';
    link.download = `${doc.name.replace(/\s+/g, '_')}.${ext}`;
    link.target = '_blank';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // Fullscreen toggle using browser Fullscreen API if available
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (window.document.exitFullscreen) {
        window.document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewingDocumentId(null);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        scrollContainerRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        scrollContainerRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!doc) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white p-6">
        <p className="text-sm font-medium mb-4 text-neutral-300">Documento no encontrado.</p>
        <button
          type="button"
          onClick={() => setViewingDocumentId(null)}
          className="px-4 py-2 bg-white text-neutral-900 rounded-lg text-xs font-bold cursor-pointer"
        >
          ← Volver al concurso
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-neutral-100 flex flex-col overflow-hidden select-none"
    >
      {/* ======================================================== */}
      {/* 1. DISCRETE FLOATING TOP BAR                            */}
      {/* ======================================================== */}
      <header
        className={`w-full bg-white/95 backdrop-blur-md border-b border-neutral-200/90 text-neutral-900 px-3 sm:px-4 py-2.5 z-20 flex items-center justify-between gap-2 shadow-xs transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-20 hover:opacity-100'
        }`}
      >
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3 min-w-0 max-w-[60%] sm:max-w-[40%]">
          <button
            type="button"
            onClick={() => setViewingDocumentId(null)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 -ml-1 text-neutral-800 hover:text-neutral-950 font-bold text-xs sm:text-sm rounded-lg hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Volver al concurso"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span className="font-extrabold">Volver</span>
          </button>

          <div className="min-w-0 hidden xs:block">
            <h1 className="text-xs sm:text-sm font-extrabold text-neutral-900 truncate leading-snug">
              {doc.name}
            </h1>
            {event && (
              <p className="text-[10px] text-neutral-500 font-medium truncate hidden sm:block">
                {event.name} · {event.venue}
              </p>
            )}
          </div>
        </div>

        {/* Center: Total pages badge if multipage */}
        {!isPdf && totalPages > 1 && (
          <div className="flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1 shrink-0">
            <span className="font-mono text-neutral-800 text-[11px] sm:text-xs font-bold tabular-nums">
              {totalPages} páginas
            </span>
          </div>
        )}

        {/* Right: Zoom controls, Fullscreen & Download */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-1.5 py-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Reducir zoom"
              className="p-1.5 text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Reducir zoom (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-neutral-700 px-1 font-bold tabular-nums min-w-[36px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Aumentar zoom"
              className="p-1.5 text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Aumentar zoom (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {scale !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Restablecer escala al 100%"
                className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors ml-0.5 cursor-pointer"
                title="100%"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            className="p-2 text-neutral-600 hover:text-neutral-950 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer hidden sm:block"
            title="Pantalla completa"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Download (secondary option) */}
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Descargar copia"
            className="p-2 text-neutral-600 hover:text-neutral-950 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Descargar archivo"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. DEDICATED FULL-VIEWPORT DOCUMENT CANVAS              */}
      {/* ======================================================== */}
      {isPdf ? (
        <div
          className="relative flex-1 w-full h-[calc(100vh-52px)] overflow-auto bg-neutral-900 flex items-start justify-center"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            style={{
              width: scale === 1 ? '100%' : `${Math.round(scale * 100)}%`,
              height: scale === 1 ? '100%' : `${Math.round(scale * 100)}%`,
              minHeight: '100%',
              transition: 'width 0.15s ease-out, height 0.15s ease-out'
            }}
            className="w-full h-full flex-1"
          >
            <object
              data={`${doc.fileUrl}#view=FitH&toolbar=1&navpanes=0&zoom=${Math.round(scale * 100)}`}
              type="application/pdf"
              className="w-full h-full border-0 block bg-white"
              style={{ minHeight: '100%', width: '100%' }}
            >
              <iframe
                src={`${doc.fileUrl}#view=FitH&toolbar=1&navpanes=0&scrollbar=1&zoom=${Math.round(scale * 100)}`}
                title={doc.name}
                className="w-full h-full border-0 block bg-white"
                style={{ minHeight: '100%', width: '100%' }}
              >
                <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-neutral-900 text-white text-center">
                  <FileText className="w-12 h-12 text-[#93c5fd] mb-3" />
                  <p className="font-bold text-sm mb-1">{doc.name}</p>
                  <p className="text-xs text-neutral-400 mb-4 max-w-sm">
                    Este dispositivo requiere abrir el archivo PDF directamente para visualizar todas sus páginas.
                  </p>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Abrir o Descargar PDF</span>
                  </a>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="relative flex-1 w-full h-[calc(100vh-52px)] overflow-y-auto overflow-x-auto bg-[#e5e7eb] flex flex-col items-center py-4 sm:py-6 px-2 sm:px-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            style={{
              width: scale === 1 ? '100%' : `${Math.round(scale * 100)}%`,
              maxWidth: scale === 1 ? '52rem' : `${Math.round(scale * 52)}rem`,
              transition: 'width 0.15s ease-out, max-width 0.15s ease-out'
            }}
            className="flex flex-col items-center gap-4 sm:gap-6 w-full mx-auto"
          >
            {allPages.map((pageUrl, idx) => (
              <div
                key={idx}
                id={`page-${idx + 1}`}
                className="w-full relative flex flex-col items-center"
              >
                {totalPages > 1 && (
                  <div className="w-full flex items-center justify-between px-1 mb-1.5 text-[11px] font-mono font-bold text-neutral-500 tracking-wider">
                    <span>PÁGINA {idx + 1} DE {totalPages}</span>
                  </div>
                )}
                <img
                  src={pageUrl}
                  alt={`${doc.name} - Página ${idx + 1}`}
                  className="w-full h-auto object-contain shadow-lg rounded-xs bg-white border border-neutral-300"
                  loading={idx === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {/* Mobile floating zoom pill at bottom */}
          <div className="sm:hidden fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-full shadow-2xl z-30 border border-neutral-700">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-bold tabular-nums px-1">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {scale !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="text-[10px] text-neutral-400 hover:text-white pl-1 font-semibold cursor-pointer"
              >
                100%
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

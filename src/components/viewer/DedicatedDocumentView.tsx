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
  Share2
} from 'lucide-react';

interface DedicatedDocumentViewProps {
  documentId: string;
}

export const DedicatedDocumentView: React.FC<DedicatedDocumentViewProps> = ({ documentId }) => {
  const { getDocumentById, setViewingDocumentId, getEventById } = useEquestrian();

  const doc = getDocumentById(documentId);
  const event = doc ? getEventById(doc.eventId) : null;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Pages array
  const pages: string[] = doc?.pages && doc.pages.length > 0 ? doc.pages : [doc?.fileUrl || ''];
  const totalPages = pages.length;
  const currentFile = pages[currentPage - 1] || doc?.fileUrl || '';

  // Reset when documentId changes
  useEffect(() => {
    setCurrentPage(1);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [documentId]);

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.35, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.35, 0.6);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Drag & Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const lastTouchDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      };
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPan({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastTouchDistRef.current;
      if (Math.abs(delta) > 4) {
        const factor = delta > 0 ? 0.05 : -0.05;
        setScale((prev) => Math.max(0.7, Math.min(3.5, prev + factor)));
        lastTouchDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistRef.current = null;
  };

  // Download action
  const handleDownload = () => {
    if (!doc) return;
    const link = window.document.createElement('a');
    link.href = currentFile;
    link.download = `${doc.name.replace(/\s+/g, '_')}_pag${currentPage}.svg`;
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
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

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

        {/* Center: Pagination controls (if multipage) */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1 shrink-0">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              className="p-1 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-neutral-800 text-[11px] sm:text-xs font-bold tabular-nums px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Página siguiente"
              className="p-1 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
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
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex-1 w-full h-[calc(100vh-52px)] overflow-auto flex items-center justify-center p-2 sm:p-6 bg-neutral-200/50 ${
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
      >
        {/* Document Page Float Badge (matching reference screenshot "1 of 1") */}
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide pointer-events-none shadow-md">
          {currentPage} of {totalPages}
        </div>

        {/* Transformed Document Container */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="flex items-center justify-center max-w-full max-h-full"
        >
          {/* Document image / page */}
          <img
            src={currentFile}
            alt={`${doc.name} - Página ${currentPage}`}
            className="max-h-[92vh] max-w-[98vw] md:max-w-[90vw] object-contain shadow-xl rounded-sm bg-white pointer-events-none"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        </div>

        {/* Mobile floating zoom & controls pill at bottom */}
        <div className="sm:hidden fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-full shadow-2xl z-30 border border-neutral-700">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 hover:text-white active:scale-95 transition-transform"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-bold tabular-nums px-1">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 hover:text-white active:scale-95 transition-transform"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {scale !== 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="text-[10px] text-neutral-400 hover:text-white pl-1 font-semibold"
            >
              100%
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

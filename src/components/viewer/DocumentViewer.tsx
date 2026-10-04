import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  X,
  FileText
} from 'lucide-react';
import { DocumentItem } from '../../types/equestrian';

interface DocumentViewerProps {
  document: DocumentItem;
  mode?: 'inline' | 'modal' | 'fullscreen';
  onClose?: () => void;
  onExpand?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  mode = 'inline',
  onClose,
  onExpand
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(mode === 'fullscreen');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if document is PDF
  const isPdf = Boolean(
    document.mimeType?.toLowerCase() === 'application/pdf' ||
    document.fileUrl?.toLowerCase().endsWith('.pdf') ||
    document.fileUrl?.toLowerCase().includes('.pdf?') ||
    document.storagePath?.toLowerCase().endsWith('.pdf')
  );

  // Compute pages list (only for image documents)
  const pages: string[] =
    !isPdf && document.pages && document.pages.length > 0
      ? document.pages
      : [document.fileUrl];

  const totalPages = pages.length;
  const currentFile = pages[currentPage - 1] || document.fileUrl;

  // Reset state when document changes
  useEffect(() => {
    setCurrentPage(1);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [document.id]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
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

  // Drag to pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPdf && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPdf && isDragging && scale > 1) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPdf && e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPdf && isDragging && scale > 1 && e.touches.length === 1) {
      setPan({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = document.fileUrl;
    const ext = isPdf
      ? 'pdf'
      : document.mimeType?.includes('png')
      ? 'png'
      : document.mimeType?.includes('jpeg') || document.mimeType?.includes('jpg')
      ? 'jpg'
      : document.mimeType?.includes('webp')
      ? 'webp'
      : 'svg';
    link.download = `${document.name.replace(/\s+/g, '_')}.${ext}`;
    link.target = '_blank';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // Fullscreen keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isFullscreen || mode === 'modal')) {
        if (isFullscreen) setIsFullscreen(false);
        if (onClose) onClose();
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
  }, [isFullscreen, mode, currentPage, totalPages]);

  const isModalOrFullscreen = mode === 'modal' || isFullscreen;

  const content = (
    <div
      className={`flex flex-col bg-neutral-900 text-neutral-100 ${
        isModalOrFullscreen
          ? 'fixed inset-0 z-50 overflow-hidden'
          : 'relative w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 shadow-sm'
      }`}
    >
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-950/90 border-b border-neutral-800 text-xs select-none z-10 gap-2">
        {/* Left: Document info */}
        <div className="flex items-center gap-2 min-w-0 max-w-[45%]">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-neutral-100 truncate text-xs sm:text-sm">
            {document.name}
          </span>
        </div>

        {/* Center: Pagination controls (only if multipage image) */}
        {!isPdf && totalPages > 1 && (
          <div className="flex items-center gap-1.5 shrink-0 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-neutral-300 tabular-nums px-1 text-[11px] sm:text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Página siguiente"
              className="p-1 text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right: Zoom & View controls */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden sm:flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-1.5 py-0.5 mr-1">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Reducir zoom"
              className="p-1 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Reducir (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-neutral-400 px-1 tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Aumentar zoom"
              className="p-1 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Aumentar (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {scale !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Restablecer zoom"
                className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Restablecer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Download secondary action */}
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Descargar documento original"
            className="p-1.5 text-neutral-300 hover:text-white rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Descargar copia"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen / Expand toggle */}
          {mode === 'inline' ? (
            <button
              type="button"
              onClick={onExpand || (() => setIsFullscreen(true))}
              aria-label="Pantalla completa"
              className="p-1.5 text-neutral-300 hover:text-white rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) setIsFullscreen(false);
                if (onClose) onClose();
              }}
              aria-label="Cerrar visor"
              className="p-1.5 text-neutral-300 hover:text-white rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Cerrar"
            >
              {mode === 'modal' ? <X className="w-5 h-5" /> : <Minimize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Document Viewer Canvas */}
      {isPdf ? (
        <div
          className={`relative flex-1 w-full overflow-auto bg-neutral-900 flex items-start justify-center ${
            isModalOrFullscreen ? 'h-[calc(100vh-50px)]' : 'min-h-[460px] sm:min-h-[580px] max-h-[700px]'
          }`}
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
              data={`${document.fileUrl}#view=FitH&toolbar=1&navpanes=0&zoom=${Math.round(scale * 100)}`}
              type="application/pdf"
              className="w-full h-full border-0 block bg-white"
              style={{ minHeight: '100%', width: '100%' }}
            >
              <iframe
                src={`${document.fileUrl}#view=FitH&toolbar=1&navpanes=0&scrollbar=1&zoom=${Math.round(scale * 100)}`}
                title={document.name}
                className="w-full h-full border-0 block bg-white"
                style={{ minHeight: '100%', width: '100%' }}
              >
                <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center p-6 bg-neutral-900 text-white text-center">
                  <FileText className="w-10 h-10 text-[#93c5fd] mb-2" />
                  <p className="font-bold text-sm mb-1">{document.name}</p>
                  <p className="text-xs text-neutral-400 mb-3 max-w-xs">
                    Abrí o descargá el archivo para ver todas las páginas.
                  </p>
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-[#123E59] hover:bg-[#0e3247] text-white rounded-lg text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Abrir PDF</span>
                  </a>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative flex-1 w-full overflow-hidden flex items-center justify-center bg-neutral-950 select-none ${
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          } ${isModalOrFullscreen ? 'h-[calc(100vh-50px)]' : 'min-h-[460px] sm:min-h-[580px] max-h-[700px]'}`}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="flex items-center justify-center p-2 sm:p-4 max-w-full"
          >
            {/* Support for Images (SVG Data URI, PNG, JPG, WebP) */}
            <img
              src={currentFile}
              alt={`${document.name} - Página ${currentPage}`}
              className="max-h-[82vh] max-w-[96vw] sm:max-w-2xl object-contain shadow-2xl rounded-sm bg-white pointer-events-none"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>

          {/* Mobile touch zoom helper pill */}
          <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md border border-neutral-700 text-neutral-200 px-3 py-1.5 rounded-full shadow-lg text-[11px] font-medium z-10">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono tabular-nums px-1">{Math.round(scale * 100)}%</span>
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
                className="pl-1 text-neutral-400 hover:text-white text-[10px] cursor-pointer"
              >
                100%
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return content;
};

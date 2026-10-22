import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Loader2,
  AlertCircle,
  Expand,
  FileText,
} from 'lucide-react';

// Configure PDF.js worker: local public asset first, then unpkg CDN fallback
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

interface PdfCanvasViewerProps {
  data: Blob | ArrayBuffer | Uint8Array | string;
  title?: string;
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function PdfCanvasViewer({
  data,
  title,
  initialPage = 1,
  onPageChange,
  className = '',
  isFullscreen = false,
  onToggleFullscreen,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'width' | 'custom'>('width');
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInputValue, setPageInputValue] = useState<string>(String(initialPage));

  // Touch swipe handling for mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // 1. Load PDF document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        let loadingTask: any;

        if (data instanceof Blob) {
          const arrayBuffer = await data.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
          loadingTask = pdfjsLib.getDocument({ data });
        } else if (typeof data === 'string') {
          loadingTask = pdfjsLib.getDocument({ url: data });
        } else {
          throw new Error('Unsupported PDF data format');
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages));
        setPageInputValue(String(Math.min(initialPage, doc.numPages)));
        onPageChange?.(Math.min(initialPage, doc.numPages), doc.numPages);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Error loading PDF document:', err);
        setError(err.message || 'Failed to parse and render PDF document.');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    if (data) {
      loadPdf();
    }

    return () => {
      isCancelled = true;
    };
  }, [data]);

  // 2. Render active page onto Canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

      // Cancel previous in-flight render task to prevent canvas conflicts
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }

      setRendering(true);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = containerRef.current.clientWidth || window.innerWidth;
        // For mobile, subtract padding; on desktop, leave comfortable reading margin
        const availableWidth = Math.max(containerWidth - 32, 280);

        // Calculate scale
        let targetScale = scale;
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        if (fitMode === 'width') {
          targetScale = availableWidth / unscaledViewport.width;
          // Clamp auto-fit scale between 0.5 and 2.5
          targetScale = Math.min(Math.max(targetScale, 0.5), 2.5);
        }

        const viewport = page.getViewport({ scale: targetScale });

        // High DPI (Retina / AMOLED) devicePixelRatio support
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Fill background with white before rendering
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(dpr, dpr);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        ctx.restore();
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Page render error:', err);
        }
      } finally {
        setRendering(false);
      }
    },
    [pdfDoc, scale, fitMode]
  );

  // Trigger render when page or sizing changes
  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, fitMode, renderPage]);

  // Re-render when container resizes (e.g. orientation change on mobile)
  useEffect(() => {
    const handleResize = () => {
      if (fitMode === 'width' && pdfDoc && currentPage > 0) {
        renderPage(currentPage);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitMode, pdfDoc, currentPage, renderPage]);

  // Page Navigation Handlers
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setPageInputValue(String(page));
    onPageChange?.(page, totalPages);

    // Scroll to top of viewer when page changes
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);

  const handlePageInputCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(pageInputValue, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      goToPage(num);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setFitMode('custom');
    setScale((prev) => Math.min(prev + 0.15, 2.5));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setScale((prev) => Math.max(prev - 0.15, 0.5));
  };

  const handleResetZoom = () => {
    setFitMode('width');
    setScale(1.0);
  };

  // Mobile Touch Swipe Navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    // Only register horizontal swipe if horizontal movement is significantly greater than vertical
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0 && currentPage < totalPages) {
        // Swiped left -> next page
        handleNextPage();
      } else if (diffX < 0 && currentPage > 1) {
        // Swiped right -> prev page
        handlePrevPage();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-900 text-white ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium text-slate-300">Opening document reader...</p>
        <span className="text-xs text-slate-400">Loading pages directly on your device</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center gap-4 ${className}`}>
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold">Unable to load document</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full h-full bg-slate-950 overflow-hidden select-none ${className}`}>
      {/* Top Floating Mini-bar for Mobile & Desktop page navigation */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-slate-200 text-xs shrink-0 backdrop-blur-xs z-10">
        {/* Left: Page Flip Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || rendering}
            className="h-8 px-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4 mr-0.5" />
            <span className="hidden sm:inline text-xs">Prev</span>
          </Button>

          <form onSubmit={handlePageInputCommit} className="flex items-center gap-1.5 mx-1">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={handlePageInputCommit}
              className="h-7 w-12 text-center text-xs bg-slate-800 border-slate-700 text-white rounded-md p-0 font-medium"
            />
            <span className="text-slate-400 text-xs font-mono">/ {totalPages}</span>
          </form>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || rendering}
            className="h-8 px-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30"
            title="Next Page"
          >
            <span className="hidden sm:inline text-xs">Next</span>
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        </div>

        {/* Right: Sizing, Zoom & Fullscreen */}
        <div className="flex items-center gap-1">
          {/* Fit to width button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            className={`h-8 px-2 text-xs rounded-lg ${
              fitMode === 'width' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="Fit to Screen Width"
          >
            <Expand className="h-3.5 w-3.5 mr-1 sm:inline hidden" />
            <span>Fit Width</span>
          </Button>

          {/* Zoom Out */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          {/* Zoom In */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen Button */}
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullscreen}
              className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Canvas Scroll Viewport */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full overflow-auto bg-slate-900 p-2 sm:p-4 flex items-start justify-center relative touch-pan-y"
      >
        {rendering && (
          <div className="absolute top-4 right-4 z-20 bg-slate-800/80 backdrop-blur-xs text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            <span>Rendering...</span>
          </div>
        )}

        {/* The PDF Page Canvas */}
        <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full my-auto transition-transform duration-150">
          <canvas ref={canvasRef} className="block max-w-full" />
        </div>
      </div>

      {/* Bottom Mobile Quick Page Bar */}
      <div className="flex sm:hidden items-center justify-between px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 text-slate-400 text-xs shrink-0">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="disabled:opacity-30 py-1 px-2 font-medium"
        >
          ◀ Previous
        </button>
        <span className="font-mono text-slate-300">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="disabled:opacity-30 py-1 px-2 font-medium"
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}

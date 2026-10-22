import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Book } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  HardDrive,
  Loader2,
  ExternalLink,
  AlertCircle,
  FileText,
  Expand,
} from 'lucide-react';

// Configure PDF.js worker: local public asset first
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

interface MobileHorizontalReaderProps {
  book: Book;
  pdfData: Blob | ArrayBuffer | Uint8Array | null;
  isSavedOffline: boolean;
  onBack: () => void;
  onSaveOffline?: () => Promise<void>;
  isDownloadingOffline?: boolean;
}

export function MobileHorizontalReader({
  book,
  pdfData,
  isSavedOffline,
  onBack,
  onSaveOffline,
  isDownloadingOffline = false,
}: MobileHorizontalReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Horizontal touch swipe handling
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);

  // 1. Load PDF Document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      if (!pdfData) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let loadingTask: any;

        if (pdfData instanceof Blob) {
          const arrayBuffer = await pdfData.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        } else if (pdfData instanceof ArrayBuffer || pdfData instanceof Uint8Array) {
          loadingTask = pdfjsLib.getDocument({ data: pdfData });
        } else {
          throw new Error('Unsupported PDF data format');
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Mobile PDF load error:', err);
        setError(err.message || 'Failed to parse PDF document.');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfData]);

  // 2. Render Page onto Canvas (High-DPI for sharp text on mobile)
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancellation
        }
        renderTaskRef.current = null;
      }

      setRendering(true);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Use mobile viewport width with a small 8px side margin for full-bleed reading
        const viewportWidth = containerRef.current.clientWidth || window.innerWidth;
        const availableWidth = Math.max(viewportWidth - 16, 260);

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const fitScale = (availableWidth / unscaledViewport.width) * zoomFactor;

        const viewport = page.getViewport({ scale: fitScale });

        // High DPI scaling (Retina / AMOLED)
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

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
          console.warn('Mobile page render error:', err);
        }
      } finally {
        setRendering(false);
      }
    },
    [pdfDoc, zoomFactor]
  );

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoomFactor, renderPage]);

  // Handle screen orientation change
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && currentPage > 0) {
        renderPage(currentPage);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, currentPage, renderPage]);

  // Navigation handlers
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSwipeOffset(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);

  // Horizontal Touch Gestures for Page Swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoomFactor === 1.0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || zoomFactor > 1.0) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // If predominantly horizontal gesture
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Limit swipe rubber-banding
      setSwipeOffset(diffX * 0.4);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || zoomFactor > 1.0) {
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;

    // Swipe threshold: 50px
    if (diffX < -50 && currentPage < totalPages) {
      // Swiped left -> next page
      handleNextPage();
    } else if (diffX > 50 && currentPage > 1) {
      // Swiped right -> prev page
      handlePrevPage();
    }

    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleZoomIn = () => setZoomFactor((prev) => Math.min(prev + 0.25, 2.0));
  const handleZoomOut = () => setZoomFactor((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomFactor(1.0);

  const viewUrl = `https://drive.google.com/file/d/${encodeURIComponent(book.driveFileId)}/view`;

  // Fallback state if PDF binary hasn't loaded yet on mobile
  if (!pdfData && !loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900 border-b border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 px-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-xs font-semibold truncate max-w-[180px]">{book.title}</span>
          <div className="w-8" />
        </div>

        {/* Content Notice */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h3 className="text-base font-bold text-white">Full-Screen Mobile Reader</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To read with horizontal swipe gestures and full-screen mobile pages, save this book to your phone's offline storage:
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full max-w-xs pt-2">
            {onSaveOffline && (
              <Button
                onClick={onSaveOffline}
                disabled={isDownloadingOffline}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-11 text-xs"
              >
                {isDownloadingOffline ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading to Phone...
                  </>
                ) : (
                  <>
                    <HardDrive className="h-4 w-4 mr-2" />
                    Download & Open Full Page
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => window.open(viewUrl, '_blank')}
              className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 rounded-xl h-11 text-xs font-semibold"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Google Drive App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden w-screen h-[100dvh]">
      {/* 1. Minimal Mobile Top Navigation Bar (Full screen optimization) */}
      <div className="flex items-center justify-between px-2.5 py-2 bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md shrink-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 px-2 text-slate-300 hover:text-white rounded-lg shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="text-xs font-semibold">Back</span>
        </Button>

        {/* Title & Status */}
        <div className="flex flex-col items-center justify-center min-w-0 px-2 flex-1">
          <span className="text-xs font-bold text-white truncate max-w-[160px] text-center">
            {book.title}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            {isSavedOffline ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <HardDrive className="h-2.5 w-2.5" /> Offline
              </span>
            ) : null}
            <span>•</span>
            <span className="font-mono font-medium text-slate-300">
              {currentPage} / {totalPages || 1}
            </span>
          </div>
        </div>

        {/* Right Controls: Fit & Zoom */}
        <div className="flex items-center gap-0.5 shrink-0">
          {zoomFactor !== 1.0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-8 px-1.5 text-[11px] font-medium text-emerald-400 hover:bg-slate-800 rounded-lg"
              title="Reset Zoom to Fit Width"
            >
              <RotateCcw className="h-3 w-3 mr-0.5" />
              Fit
            </Button>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 px-1 select-none">
              Fit Width
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomFactor >= 2.0}
            className="h-8 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Main Horizontal Scroll / Swipe Viewport */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-slate-900 flex flex-col items-center justify-start p-2 relative touch-pan-y"
      >
        {/* Loading Spinner overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            <p className="text-xs text-slate-300 font-medium">Loading book pages...</p>
          </div>
        )}

        {/* Page Rendering Indicator */}
        {rendering && (
          <div className="absolute top-3 right-3 z-20 bg-slate-800/90 text-white px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1.5 shadow-md">
            <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
            <span>Rendering...</span>
          </div>
        )}

        {/* Page Canvas Container with Horizontal Swipe Transition */}
        <div
          className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full my-auto transition-transform duration-100 ease-out"
          style={{
            transform: `translateX(${swipeOffset}px)`,
          }}
        >
          <canvas ref={canvasRef} className="block max-w-full" />
        </div>
      </div>

      {/* 3. Bottom Horizontal Page Navigation Bar (Thumb Friendly on Mobile) */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-md shrink-0 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || rendering}
          className="h-9 px-3 bg-slate-800/80 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-30 rounded-xl text-xs font-semibold"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>

        {/* Center: Horizontal Page Swipe Hint & Indicator */}
        <div className="flex flex-col items-center justify-center select-none">
          <span className="text-xs font-bold font-mono text-white">
            Page {currentPage} of {totalPages || 1}
          </span>
          <span className="text-[9px] text-slate-400">
            Swipe ◀ / ▶ to flip
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages || rendering}
          className="h-9 px-3 bg-slate-800/80 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-30 rounded-xl text-xs font-semibold"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

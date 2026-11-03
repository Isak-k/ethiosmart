import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Book } from '@/types/book';
import { Button } from '@/components/ui/button';
import { buildDrivePreviewUrl, buildDriveViewUrl, extractDriveFileId } from '@/lib/google-drive';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  HardDrive,
  Loader2,
  AlertCircle,
  Type,
  Sun,
  Moon,
  BookOpen,
  SlidersHorizontal,
  X,
  Crop,
  ChevronUp,
  ChevronDown,
  Cloud,
  Sparkles,
  ExternalLink,
  Maximize2,
  Minimize2,
  Download,
  CheckCircle2,
} from 'lucide-react';

// Configure PDF.js worker to use local public worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

interface MobileVerticalReaderProps {
  book: Book;
  pdfData: Blob | ArrayBuffer | Uint8Array | null;
  isSavedOffline: boolean;
  onBack: () => void;
  onSaveOffline?: () => Promise<void>;
  isDownloadingOffline?: boolean;
}

type ViewMode = 'page' | 'text';
type ThemeMode = 'dark' | 'sepia' | 'light';
type FontStyle = 'sans' | 'serif' | 'mono';
type ViewEngine = 'canvas' | 'cloud';

// --------------------------------------------------------------------------
// Lazy-rendered Single PDF Page Component for continuous vertical touch scroll
// High-DPI crisp rendering matching physical device pixels
// --------------------------------------------------------------------------
interface PageItemProps {
  pageNum: number;
  pdfDoc: any;
  zoomFactor: number;
  containerWidth: number;
  defaultAspectRatio: number;
  onVisible: (pageNum: number) => void;
  onAspectRatioCalculated: (ratio: number) => void;
  theme: ThemeMode;
}

const LazyPdfPage = memo(function LazyPdfPage({
  pageNum,
  pdfDoc,
  zoomFactor,
  containerWidth,
  defaultAspectRatio,
  onVisible,
  onAspectRatioCalculated,
  theme,
}: PageItemProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [isInViewport, setIsInViewport] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(defaultAspectRatio);

  // 1. Observe intersection with generous margin so upcoming pages render before user scrolls into them
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInViewport(true);
            onVisible(pageNum);
          } else {
            // Check bounding distance: if scrolled more than 1500px away, release canvas to save mobile RAM
            const rect = entry.boundingClientRect;
            const screenHeight = window.innerHeight;
            if (rect.bottom < -1500 || rect.top > screenHeight + 1500) {
              setIsInViewport(false);
              setIsRendered(false);
              if (renderTaskRef.current) {
                try {
                  renderTaskRef.current.cancel();
                } catch {
                  // ignore cancellation error
                }
                renderTaskRef.current = null;
              }
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '900px 0px 900px 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  // 2. Render Page onto Canvas when in viewport with Ultra-Crisp High DPI
  useEffect(() => {
    if (!isInViewport || !pdfDoc) return;

    let isCancelled = false;

    async function renderPage() {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const ratio = unscaledViewport.height / unscaledViewport.width;
        setAspectRatio(ratio);
        onAspectRatioCalculated(ratio);

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Exact CSS dimensions
        const targetCssWidth = Math.round(containerWidth * zoomFactor);
        const targetCssHeight = Math.round(targetCssWidth * ratio);

        // ULTRA-CRISP RESOLUTION: match physical device pixel ratio (up to 3.5x for Retina/AMOLED phones)
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2;
        const pixelRatio = Math.min(Math.max(dpr, 2.0), 3.5);

        const renderScale = (targetCssWidth / unscaledViewport.width) * pixelRatio;
        const scaledViewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.round(scaledViewport.width);
        canvas.height = Math.round(scaledViewport.height);
        canvas.style.width = `${targetCssWidth}px`;
        canvas.style.height = `${targetCssHeight}px`;

        const ctx = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: false,
        });

        if (!ctx) return;

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport,
          intent: 'display',
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [isInViewport, pdfDoc, pageNum, zoomFactor, containerWidth, onAspectRatioCalculated]);

  const estimatedHeight = Math.round(containerWidth * zoomFactor * aspectRatio);

  return (
    <div
      ref={pageRef}
      data-page-number={pageNum}
      className={`relative flex justify-center items-center select-none ${
        theme === 'dark' ? 'bg-[#0f1117]' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-[#e5e7eb]'
      }`}
      style={{
        width: `${Math.round(containerWidth * zoomFactor)}px`,
        maxWidth: 'none',
        minHeight: `${estimatedHeight}px`,
        marginBottom: zoomFactor > 1.2 ? '14px' : '8px',
      }}
    >
      {/* High-Resolution Canvas with crisp font contrast */}
      <canvas
        ref={canvasRef}
        className={`block transition-opacity duration-200 ${
          isRendered ? 'opacity-100 shadow-md' : 'opacity-0'
        }`}
        style={{
          width: `${Math.round(containerWidth * zoomFactor)}px`,
          height: `${Math.round(containerWidth * zoomFactor * aspectRatio)}px`,
          maxWidth: 'none',
          imageRendering: '-webkit-optimize-contrast',
        }}
      />

      {/* Loading Skeleton / Page Number Placeholder while waiting for render */}
      {!isRendered && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ height: `${estimatedHeight}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xs text-xs text-white/90 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Page {pageNum}</span>
          </div>
        </div>
      )}

      {/* Subtle Bottom Page Label */}
      <div className="absolute bottom-1 right-2 pointer-events-none text-[9px] font-mono text-black/30 dark:text-white/30 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
        p. {pageNum}
      </div>
    </div>
  );
});

// --------------------------------------------------------------------------
// Mobile Reflowable Text Component
// --------------------------------------------------------------------------
interface TextModeViewerProps {
  pdfDoc: any;
  totalPages: number;
  currentPage: number;
  fontSize: number;
  fontStyle: FontStyle;
  theme: ThemeMode;
  onPageScrolled: (pageNum: number) => void;
}

function MobileTextReader({
  pdfDoc,
  totalPages,
  currentPage,
  fontSize,
  fontStyle,
  theme,
  onPageScrolled,
}: TextModeViewerProps) {
  const [pagesText, setPagesText] = useState<{ [pageNum: number]: string }>({});

  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    async function loadPageText(pageNumber: number) {
      if (pagesText[pageNumber] !== undefined || pageNumber < 1 || pageNumber > totalPages) {
        return;
      }

      try {
        const page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        let lastY: number | null = null;
        let textLines: string[] = [];
        let currentLine = '';

        for (const item of textContent.items) {
          if ('str' in item) {
            const y = item.transform ? item.transform[5] : 0;
            if (lastY !== null && Math.abs(y - lastY) > 8) {
              if (currentLine.trim()) {
                textLines.push(currentLine.trim());
              }
              currentLine = item.str;
            } else {
              currentLine += (currentLine.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
            }
            lastY = y;
          }
        }
        if (currentLine.trim()) {
          textLines.push(currentLine.trim());
        }

        const finalText = textLines.join('\n\n');
        if (!isCancelled) {
          setPagesText((prev) => ({ ...prev, [pageNumber]: finalText }));
        }
      } catch (err) {
        console.warn(`Text extraction for page ${pageNumber} failed:`, err);
        if (!isCancelled) {
          setPagesText((prev) => ({ ...prev, [pageNumber]: 'Could not extract text for this page.' }));
        }
      }
    }

    loadPageText(currentPage);
    if (currentPage + 1 <= totalPages) loadPageText(currentPage + 1);
    if (currentPage - 1 >= 1) loadPageText(currentPage - 1);

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, totalPages, pagesText]);

  const fontClass =
    fontStyle === 'serif'
      ? 'font-serif'
      : fontStyle === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const themeClasses =
    theme === 'dark'
      ? 'bg-[#0d0f14] text-[#e2e8f0]'
      : theme === 'sepia'
      ? 'bg-[#fbf0d9] text-[#433422]'
      : 'bg-[#ffffff] text-[#1e293b]';

  return (
    <div className={`w-full min-h-full px-5 py-6 ${themeClasses} ${fontClass} transition-colors duration-200 select-text`}>
      <div className="max-w-xl mx-auto space-y-6">
        {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
          const isNear = Math.abs(pageNum - currentPage) <= 2;
          if (!isNear && !pagesText[pageNum]) return null;

          const content = pagesText[pageNum];

          return (
            <div
              key={pageNum}
              data-text-page={pageNum}
              className="pb-8 border-b border-current/10 last:border-b-0 space-y-4"
            >
              <div className="flex items-center justify-between text-xs opacity-50 font-mono select-none pt-2">
                <span>Page {pageNum}</span>
                <span>EthioSmart Reader</span>
              </div>

              {content === undefined ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Extracting page {pageNum} text...</span>
                </div>
              ) : content.trim().length === 0 ? (
                <div className="py-6 text-center italic text-xs opacity-60">
                  (No selectable text found on this page. May contain scanned diagram or image.)
                </div>
              ) : (
                <div
                  className="leading-relaxed whitespace-pre-line tracking-wide"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Mobile Vertical Reader
// --------------------------------------------------------------------------
export function MobileVerticalReader({
  book,
  pdfData,
  isSavedOffline,
  onBack,
  onSaveOffline,
  isDownloadingOffline = false,
}: MobileVerticalReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const verticalTrackRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Engine: Canvas (PDF.js continuous vertical canvas) vs Cloud (Google Drive streaming iframe)
  const [viewEngine, setViewEngine] = useState<ViewEngine>('canvas');
  const [cloudIframeLoading, setCloudIframeLoading] = useState<boolean>(true);

  // Settings & Customization
  const [viewMode, setViewMode] = useState<ViewMode>('page');
  
  // Default zoom is 1.40 (Fit Text - automatically trims white margins so text is large & bold)
  const [zoomFactor, setZoomFactor] = useState<number>(1.40);
  const [livePinchScale, setLivePinchScale] = useState<number | null>(null);
  const [livePinchPercent, setLivePinchPercent] = useState<number | null>(null);

  const [fontSize, setFontSize] = useState<number>(20);
  const [fontStyle, setFontStyle] = useState<FontStyle>('serif');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [showSettingsSheet, setShowSettingsSheet] = useState<boolean>(false);
  
  // Reading mode state: auto-hides controls after inactivity or on double touch
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showScrollStick, setShowScrollStick] = useState<boolean>(true);
  const [showPageIndicator, setShowPageIndicator] = useState<boolean>(true);
  
  const autoHideTimerRef = useRef<any>(null);

  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') return window.innerWidth;
    return 390;
  });
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<number>(1.414);

  // Vertical Right-Edge Scroll Stick States
  const [scrollProgress, setScrollProgress] = useState<number>(0); // 0.0 to 1.0
  const [isDraggingThumb, setIsDraggingThumb] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-hide timer: when reading and idle for 2.4s, hide header, footer, stick, and indicators
  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowScrollStick(false);
      setShowPageIndicator(false);
    }, 2400);
  }, []);

  // Initial auto-hide timer on mount
  useEffect(() => {
    resetAutoHideTimer();
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [resetAutoHideTimer]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Compute effective identifiers & URLs
  const effectiveDriveFileId = book?.driveFileId || extractDriveFileId(book?.driveUrl || '');
  
  const blobUrl = useMemo(() => {
    if (pdfData instanceof Blob) {
      return URL.createObjectURL(pdfData);
    }
    return null;
  }, [pdfData]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const activeUrl = blobUrl 
    ? blobUrl 
    : effectiveDriveFileId 
    ? buildDrivePreviewUrl(effectiveDriveFileId) 
    : (book?.driveUrl || '');

  const externalViewUrl = effectiveDriveFileId 
    ? buildDriveViewUrl(effectiveDriveFileId) 
    : (book?.driveUrl || '');

  // Auto-dismiss cloud viewer loading overlay after 1.5s so user is never stuck on a spinner
  useEffect(() => {
    if (viewEngine === 'cloud') {
      const timer = setTimeout(() => {
        setCloudIframeLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [viewEngine]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper to verify valid PDF magic bytes (%PDF)
  const checkIsPdf = async (data: Blob | ArrayBuffer | Uint8Array): Promise<boolean> => {
    try {
      let slice: Uint8Array;
      if (data instanceof Blob) {
        const head = await data.slice(0, 5).arrayBuffer();
        slice = new Uint8Array(head);
      } else if (data instanceof Uint8Array) {
        slice = data.subarray(0, 5);
      } else {
        slice = new Uint8Array(data, 0, Math.min(5, data.byteLength));
      }
      return (
        slice.length >= 4 &&
        slice[0] === 0x25 && // %
        slice[1] === 0x50 && // P
        slice[2] === 0x44 && // D
        slice[3] === 0x46    // F
      );
    } catch {
      return false;
    }
  };

  // 1. Fetch PDF Data if not provided directly, or fall back to Cloud Viewer immediately
  useEffect(() => {
    let isCancelled = false;

    async function initReader() {
      // Step A: If valid pdfData was supplied (from IndexedDB offline cache or pre-fetch)
      if (pdfData) {
        const isPdf = await checkIsPdf(pdfData);
        if (isPdf && !isCancelled) {
          setViewEngine('canvas');
          await loadDocument(pdfData);
          return;
        }
      }

      // Step B: For Drive files or direct PDF URLs, activate Cloud Stream viewer immediately
      // without ANY 6.5s delay or loading hang on mobile devices!
      const fileId = book?.driveFileId || extractDriveFileId(book?.driveUrl || '');
      const directUrl = book?.driveUrl;

      if (fileId || directUrl) {
        if (!isCancelled) {
          setViewEngine('cloud');
          setLoading(false);
          setError(null);
        }

        // In parallel (non-blocking), attempt to fetch binary for HD Canvas mode in background
        if (fileId) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const res = await fetch(
              `/api/drive/download?fileId=${encodeURIComponent(fileId)}`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            const contentType = res.headers.get('content-type') || '';
            if (res.ok && !contentType.includes('text/html')) {
              const blob = await res.blob();
              const isPdf = await checkIsPdf(blob);
              if (isPdf && !isCancelled) {
                await loadDocument(blob);
              }
            }
          } catch {
            // Background fetch fallback notice: Cloud stream viewer is already active and responsive
          }
        }
      } else {
        if (!isCancelled) {
          setLoading(false);
          setError('No document source or URL available for this book.');
        }
      }
    }

    initReader();

    return () => {
      isCancelled = true;
    };
  }, [pdfData, book?.driveFileId, book?.driveUrl]);

  // 2. Load PDF with pdfjsLib and local standard font files
  const loadDocument = async (sourceData: Blob | ArrayBuffer | Uint8Array) => {
    setLoading(true);
    setError(null);

    try {
      let arrayBuffer: ArrayBuffer;
      if (sourceData instanceof Blob) {
        arrayBuffer = await sourceData.arrayBuffer();
      } else if (sourceData instanceof Uint8Array) {
        arrayBuffer = sourceData.buffer as ArrayBuffer;
      } else {
        arrayBuffer = sourceData;
      }

      const isPdf = await checkIsPdf(arrayBuffer);
      if (!isPdf) {
        throw new Error('Data is not a valid PDF document.');
      }

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/standard_fonts/',
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setViewEngine('canvas');

      try {
        const firstPage = await doc.getPage(1);
        const vp = firstPage.getViewport({ scale: 1.0 });
        if (vp.width && vp.height) {
          setDefaultAspectRatio(vp.height / vp.width);
        }
      } catch (err) {
        // use default aspect ratio
      }
    } catch (err: any) {
      console.warn('PDF.js loading failed, falling back to Cloud Viewer:', err);
      if (book?.driveFileId) {
        setViewEngine('cloud');
        setError(null);
      } else {
        setError(err.message || 'Could not parse PDF.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual engine switch action
  const handleSwitchEngine = async () => {
    resetAutoHideTimer();
    if (viewEngine === 'canvas') {
      setViewEngine('cloud');
    } else {
      if (pdfDoc) {
        setViewEngine('canvas');
      } else if (effectiveDriveFileId) {
        setLoading(true);
        try {
          const res = await fetch(`/api/drive/download?fileId=${encodeURIComponent(effectiveDriveFileId)}`);
          if (res.ok) {
            const blob = await res.blob();
            const isPdf = await checkIsPdf(blob);
            if (isPdf) {
              await loadDocument(blob);
              setViewEngine('canvas');
              return;
            }
          }
          throw new Error('Canvas binary not available for this file.');
        } catch {
          setViewEngine('cloud');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // TWO-FINGER PINCH-TO-ZOOM ENGINE WITH SCROLL LOCKING
  // --------------------------------------------------------------------------
  const pinchStateRef = useRef<{
    isPinching: boolean;
    initialDistance: number;
    initialZoom: number;
    midX: number;
    midY: number;
    lockedScrollTop: number;
  }>({
    isPinching: false,
    initialDistance: 0,
    initialZoom: 1.4,
    midX: 0,
    midY: 0,
    lockedScrollTop: 0,
  });

  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        // Intercept 2-finger gesture and immediately cancel browser scrolling
        if (e.cancelable) e.preventDefault();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        pinchStateRef.current = {
          isPinching: true,
          initialDistance: dist,
          initialZoom: zoomFactor,
          midX,
          midY,
          lockedScrollTop: scrollEl.scrollTop,
        };

        // LOCK OVERFLOW: prevents native scroll engine from scrolling while pinching!
        scrollEl.style.overflow = 'hidden';
      } else {
        pinchStateRef.current.isPinching = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && pinchStateRef.current.isPinching) {
        if (e.cancelable) e.preventDefault();

        // Ensure vertical scroll doesn't budge
        scrollEl.scrollTop = pinchStateRef.current.lockedScrollTop;

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (pinchStateRef.current.initialDistance > 10) {
          const scaleChange = currentDist / pinchStateRef.current.initialDistance;
          const targetZoom = Math.min(3.5, Math.max(1.0, +(pinchStateRef.current.initialZoom * scaleChange).toFixed(2)));
          
          setLivePinchScale(scaleChange);
          setLivePinchPercent(Math.round(targetZoom * 100));
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (pinchStateRef.current.isPinching && e.touches.length < 2) {
        pinchStateRef.current.isPinching = false;
        
        // Restore normal scrolling on the container
        scrollEl.style.overflow = 'auto';

        if (livePinchPercent) {
          const finalZoom = Math.min(3.5, Math.max(1.0, +(livePinchPercent / 100).toFixed(2)));
          const zoomRatio = finalZoom / pinchStateRef.current.initialZoom;
          const oldScrollTop = pinchStateRef.current.lockedScrollTop;
          const newScrollTop = Math.max(0, (oldScrollTop + pinchStateRef.current.midY) * zoomRatio - pinchStateRef.current.midY);

          setZoomFactor(finalZoom);
          requestAnimationFrame(() => {
            scrollEl.scrollTop = newScrollTop;
          });
        }

        setLivePinchScale(null);
        setLivePinchPercent(null);
        resetAutoHideTimer();
      }
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: false });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: false });
    scrollEl.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      scrollEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoomFactor, livePinchPercent, resetAutoHideTimer]);

  // Handle single tap (toggle controls) and double touch/tap (HIDE IMMEDIATELY)
  const handleContentTouchEnd = (e: React.TouchEvent) => {
    if (pinchStateRef.current.isPinching || isDraggingThumb) return;

    if (e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        // DOUBLE TOUCH / DOUBLE TAP: Hide everything immediately for pure reading!
        setShowControls(false);
        setShowScrollStick(false);
        setShowPageIndicator(false);
        if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        // SINGLE TAP: Toggle controls on/off
        setShowControls((prev) => {
          const next = !prev;
          if (next) {
            setShowScrollStick(true);
            setShowPageIndicator(true);
            resetAutoHideTimer();
          } else {
            setShowScrollStick(false);
            setShowPageIndicator(false);
          }
          return next;
        });
      }
    }
  };

  // Scroll listener on main container: tracks progress & keeps vertical stick in sync
  const handleContainerScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      const progress = el.scrollTop / maxScroll;
      setScrollProgress(Math.min(1, Math.max(0, progress)));
    }

    // Show stick and page indicator while scrolling, then auto-hide after 2.4s of inactivity
    setShowScrollStick(true);
    setShowPageIndicator(true);
    resetAutoHideTimer();
  };

  // Track active page during scroll
  const handlePageVisible = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
  }, []);

  const handleAspectRatioCalculated = useCallback((ratio: number) => {
    if (ratio > 0.5 && ratio < 2.5) {
      setDefaultAspectRatio(ratio);
    }
  }, []);

  // --------------------------------------------------------------------------
  // VERTICAL STICK INTERACTION: DRAG TO SCROLL UP/DOWN & TAP TO SCROLL UP
  // --------------------------------------------------------------------------
  const updateScrollFromTouchY = (clientY: number) => {
    const trackEl = verticalTrackRef.current;
    const scrollEl = scrollContainerRef.current;
    if (!trackEl || !scrollEl) return;

    const rect = trackEl.getBoundingClientRect();
    const handleHeight = 48;
    const availableHeight = rect.height - handleHeight;
    if (availableHeight <= 0) return;

    const relativeY = clientY - rect.top - handleHeight / 2;
    const ratio = Math.max(0, Math.min(1, relativeY / availableHeight));

    setScrollProgress(ratio);
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollEl.scrollTop = ratio * maxScroll;
  };

  const handleStickTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingThumb(true);
    setShowScrollStick(true);
    if (e.touches.length > 0) {
      updateScrollFromTouchY(e.touches[0].clientY);
    }
  };

  const handleStickTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) {
      updateScrollFromTouchY(e.touches[0].clientY);
    }
  };

  const handleStickTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingThumb(false);
    resetAutoHideTimer();
  };

  // Scroll Up action
  const handleScrollUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const scrollStep = scrollEl.clientHeight * 0.75;
    scrollEl.scrollBy({ top: -scrollStep, behavior: 'smooth' });
    setShowScrollStick(true);
    resetAutoHideTimer();
  };

  // Scroll to Top action
  const handleScrollToTop = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    setShowScrollStick(true);
    resetAutoHideTimer();
  };

  // Scroll Down action
  const handleScrollDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const scrollStep = scrollEl.clientHeight * 0.75;
    scrollEl.scrollBy({ top: scrollStep, behavior: 'smooth' });
    setShowScrollStick(true);
    resetAutoHideTimer();
  };

  // Zoom control presets
  const handleZoomIn = () => {
    setZoomFactor((prev) => Math.min(3.5, +(prev + 0.25).toFixed(2)));
    resetAutoHideTimer();
  };

  const handleZoomOut = () => {
    setZoomFactor((prev) => Math.max(1.0, +(prev - 0.25).toFixed(2)));
    resetAutoHideTimer();
  };

  const handleFitText = () => {
    setZoomFactor(1.45);
    resetAutoHideTimer();
  };

  const handleFitPage = () => {
    setZoomFactor(1.0);
    resetAutoHideTimer();
  };

  const themeBgClass =
    theme === 'dark'
      ? 'bg-[#0a0c10] text-white'
      : theme === 'sepia'
      ? 'bg-[#f4ecd8] text-[#3d2f20]'
      : 'bg-[#f1f3f7] text-[#111827]';

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 h-[100dvh] w-screen flex flex-col overflow-hidden select-none ${themeBgClass}`}
    >
      {/* ---------------- Top Floating Header (Auto-hides on reading / double touch) ---------------- */}
      <header
        className={`shrink-0 z-30 transition-all duration-300 ease-in-out px-3 py-2 flex items-center justify-between border-b backdrop-blur-md ${
          theme === 'dark'
            ? 'bg-[#0f1117]/95 border-white/10 text-white'
            : theme === 'sepia'
            ? 'bg-[#f8f1e3]/95 border-[#e2d4bd] text-[#3d2f20]'
            : 'bg-white/95 border-gray-200 text-gray-900'
        } ${showControls ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none absolute top-0 inset-x-0'}`}
      >
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 w-9 p-0 rounded-full shrink-0"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0">
            <h1 className="text-xs font-bold truncate max-w-[130px] sm:max-w-[200px] leading-tight">
              {book.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] opacity-75">
              <span>
                {viewEngine === 'cloud'
                  ? 'Edge-to-Edge Viewer'
                  : totalPages > 0
                  ? `${currentPage} / ${totalPages}`
                  : 'Document Reader'}
              </span>
              {isSavedOffline && (
                <span className="inline-flex items-center text-emerald-500 font-semibold gap-0.5">
                  • <HardDrive className="h-2.5 w-2.5" /> Offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom Out */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          {/* Zoom Level Indicator / Fit Reset */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomFactor !== 1.0 ? handleFitPage : handleFitText}
            className="h-8 px-1.5 text-[11px] font-mono font-bold rounded-lg text-foreground hover:bg-white/10"
            title="Reset Zoom / Fit"
          >
            {Math.round(zoomFactor * 100)}%
          </Button>

          {/* Zoom In */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* Switch Engine (Cloud vs Canvas if pdfDoc is available) */}
          {pdfDoc && (
            <Button
              variant={viewEngine === 'canvas' ? 'default' : 'outline'}
              size="sm"
              onClick={handleSwitchEngine}
              className="h-8 px-2 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0"
              title={viewEngine === 'canvas' ? 'HD Canvas Active' : 'Switch to HD Canvas'}
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>{viewEngine === 'canvas' ? 'HD' : 'Stream'}</span>
            </Button>
          )}

          {/* Save Offline / Download if allowed */}
          {isSavedOffline ? (
            <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 flex items-center gap-0.5 hidden xs:flex">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          ) : book.allowDownload && onSaveOffline ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSaveOffline}
              disabled={isDownloadingOffline}
              className="h-8 w-8 p-0 rounded-lg text-emerald-500 hover:text-emerald-400"
              title="Save Offline"
            >
              {isDownloadingOffline ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          {/* Direct External View Link */}
          {externalViewUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(externalViewUrl, '_blank')}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Open in Drive / Device PDF App"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* ---------------- Main Content Body: Continuous Vertical Touch Scroll ---------------- */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {loading && viewEngine === 'canvas' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-xs">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Preparing reader...</p>
            <p className="text-xs text-muted-foreground">Rendering pages</p>
          </div>
        )}

        {error && !effectiveDriveFileId && !book.driveUrl && (
          <div className="absolute inset-4 z-20 flex flex-col items-center justify-center text-center p-6 bg-card border rounded-2xl shadow-xl gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-bold text-base">Unable to open document</h3>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} size="sm" className="rounded-xl">
                Retry
              </Button>
              <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl">
                Go Back
              </Button>
            </div>
          </div>
        )}

        {/* Live Pinch Zoom HUD Badge (Canvas mode) */}
        {livePinchPercent !== null && viewEngine === 'canvas' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-scale-in">
            <div className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2">
              <ZoomIn className="h-4 w-4" />
              <span>Zoom: {livePinchPercent}%</span>
            </div>
          </div>
        )}

        {/* ENGINE 1: CLOUD / DIRECT STREAM VIEWER (Continuous vertical scroll, edge-to-edge, zero failure) */}
        {viewEngine === 'cloud' && (effectiveDriveFileId || activeUrl) && (
          <div
            className="w-full h-full relative overflow-auto bg-[#0a0c10] flex flex-col overscroll-contain select-none"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            {cloudIframeLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-xs">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">Opening document reader...</p>
                <p className="text-xs text-muted-foreground">Connecting to document stream</p>
              </div>
            )}

            {/* Scalable Container for Zoom in Cloud / Iframe Mode */}
            <div
              className="w-full h-full transition-transform duration-150 origin-top flex-1"
              style={{
                transform: zoomFactor !== 1.0 ? `scale(${zoomFactor})` : undefined,
                transformOrigin: 'top center',
                width: zoomFactor > 1.0 ? `${Math.round(100 * zoomFactor)}%` : '100%',
                height: zoomFactor > 1.0 ? `${Math.round(100 * zoomFactor)}%` : '100%',
                minHeight: '100%',
              }}
            >
              <iframe
                src={activeUrl}
                title={book.title}
                className="w-full h-full border-0 select-none block bg-white"
                allow="autoplay; fullscreen"
                onLoad={() => setCloudIframeLoading(false)}
                onError={() => setCloudIframeLoading(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '100%',
                  border: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* ENGINE 2 - VIEW MODE 1: Continuous Vertical Canvas Touch Scroll with Pinch-to-Zoom */}
        {viewEngine === 'canvas' && viewMode === 'page' && pdfDoc && (
          <div
            ref={scrollContainerRef}
            onTouchEnd={handleContentTouchEnd}
            onScroll={handleContainerScroll}
            className="w-full h-full overflow-y-auto overflow-x-auto m-0 p-0 overscroll-y-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            {/* Pages vertically stacked edge-to-edge */}
            <div
              ref={pagesContainerRef}
              className="w-full flex flex-col items-center m-0 p-0 transition-transform duration-75 origin-top"
              style={{
                width: zoomFactor > 1.0 ? `${Math.round(viewportWidth * zoomFactor)}px` : '100%',
                minWidth: '100%',
                transform: livePinchScale ? `scale(${livePinchScale})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                <LazyPdfPage
                  key={pageNum}
                  pageNum={pageNum}
                  pdfDoc={pdfDoc}
                  zoomFactor={zoomFactor}
                  containerWidth={viewportWidth}
                  defaultAspectRatio={defaultAspectRatio}
                  onVisible={handlePageVisible}
                  onAspectRatioCalculated={handleAspectRatioCalculated}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        )}

        {/* ENGINE 2 - VIEW MODE 2: Reflowable Large Text Reader (Increase text size & change font style) */}
        {viewEngine === 'canvas' && viewMode === 'text' && pdfDoc && (
          <div
            ref={scrollContainerRef}
            onTouchEnd={handleContentTouchEnd}
            onScroll={handleContainerScroll}
            className="w-full h-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <MobileTextReader
              pdfDoc={pdfDoc}
              totalPages={totalPages}
              currentPage={currentPage}
              fontSize={fontSize}
              fontStyle={fontStyle}
              theme={theme}
              onPageScrolled={handlePageVisible}
            />
          </div>
        )}

        {/* ---------------- VERTICAL SCROLL STICK ON THE RIGHT SCREEN EDGE ---------------- */}
        {/* Completely hides when reading / idle / double touch */}
        {viewEngine === 'canvas' && totalPages > 1 && (
          <aside
            className={`fixed right-1 sm:right-2 top-20 bottom-24 z-40 flex flex-col items-center transition-all duration-300 ${
              (showScrollStick || isDraggingThumb)
                ? 'opacity-100 pointer-events-auto translate-x-0'
                : 'opacity-0 pointer-events-none translate-x-4'
            }`}
            style={{ width: '38px', touchAction: 'none' }}
          >
            {/* Scroll Up Stick Button (Quick tap to scroll up by a page / double-tap to jump to top) */}
            <button
              onClick={handleScrollUp}
              onDoubleClick={handleScrollToTop}
              className="h-8 w-8 rounded-full bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center mb-1.5 active:scale-90 transition-all backdrop-blur-md border border-white/20 shrink-0"
              title="Scroll Up (Double-tap for Top)"
            >
              <ChevronUp className="h-5 w-5" />
            </button>

            {/* Vertical Guide Track & Draggable Stick */}
            <div
              ref={verticalTrackRef}
              onTouchStart={handleStickTouchStart}
              onTouchMove={handleStickTouchMove}
              onTouchEnd={handleStickTouchEnd}
              onTouchCancel={handleStickTouchEnd}
              onClick={(e) => {
                updateScrollFromTouchY(e.clientY);
                resetAutoHideTimer();
              }}
              className="relative flex-1 w-full flex justify-center items-stretch cursor-pointer py-1"
            >
              {/* Subtle Vertical Rail / Track */}
              <div className="w-1 h-full rounded-full bg-black/20 dark:bg-white/20 backdrop-blur-xs transition-colors" />

              {/* The Draggable "Stick" / Handle */}
              <div
                className={`absolute rounded-full transition-all duration-75 flex items-center justify-center shadow-lg ${
                  isDraggingThumb
                    ? 'w-4 bg-primary ring-2 ring-primary/40 scale-110 shadow-primary/30'
                    : 'w-2.5 bg-primary/90 dark:bg-white/80 hover:w-3.5 hover:bg-primary'
                }`}
                style={{
                  height: '48px',
                  top: `calc(${scrollProgress * 100}% - ${scrollProgress * 48}px)`,
                  touchAction: 'none',
                }}
              >
                {/* Visual Stick Ribs */}
                <div className="flex flex-col gap-0.5 items-center pointer-events-none opacity-80">
                  <div className="w-1.5 h-0.5 rounded-full bg-white dark:bg-black" />
                  <div className="w-1.5 h-0.5 rounded-full bg-white dark:bg-black" />
                  <div className="w-1.5 h-0.5 rounded-full bg-white dark:bg-black" />
                </div>

                {/* Floating Page Number Bubble on Left of Stick while dragging */}
                {isDraggingThumb && (
                  <div className="absolute right-7 px-3 py-1.5 rounded-xl bg-black/90 text-white text-xs font-bold whitespace-nowrap shadow-2xl border border-white/20 animate-fade-in pointer-events-none flex items-center gap-1.5 backdrop-blur-md">
                    <span>Page {currentPage}</span>
                    <span className="opacity-60 text-[10px]">of {totalPages}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scroll Down Button at bottom of stick */}
            <button
              onClick={handleScrollDown}
              className="h-7 w-7 rounded-full bg-black/40 dark:bg-white/20 text-foreground shadow-md flex items-center justify-center mt-1.5 active:scale-90 transition-all backdrop-blur-md opacity-75 hover:opacity-100 shrink-0"
              title="Scroll Down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </aside>
        )}

        {/* Floating Page Number Pill (at bottom center while scrolling normally, auto-hides when idle) */}
        {viewEngine === 'canvas' && (
          <div
            className={`absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300 z-30 ${
              showPageIndicator && livePinchPercent === null && !isDraggingThumb ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-white text-xs font-semibold shadow-lg border border-white/10 flex items-center gap-1.5">
              <span>Page {currentPage} of {totalPages}</span>
              <span className="text-[10px] text-primary font-mono">({Math.round(zoomFactor * 100)}%)</span>
            </div>
          </div>
        )}
      </main>

      {/* ---------------- Bottom Floating Toolbar / Zoom Bar (Only in Canvas mode) ---------------- */}
      {viewEngine === 'canvas' && viewMode === 'page' && (
        <footer
          className={`shrink-0 z-30 transition-all duration-300 ease-in-out px-4 py-2 border-t backdrop-blur-md ${
            theme === 'dark'
              ? 'bg-[#0f1117]/95 border-white/10 text-white'
              : theme === 'sepia'
              ? 'bg-[#f8f1e3]/95 border-[#e2d4bd] text-[#3d2f20]'
              : 'bg-white/95 border-gray-200 text-gray-900'
          } ${showControls ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none absolute bottom-0 inset-x-0'}`}
        >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomFactor <= 1.0}
              className="h-8 w-8 p-0 rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono px-1 font-bold">
              {Math.round(zoomFactor * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomFactor >= 3.5}
              className="h-8 w-8 p-0 rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {zoomFactor !== 1.45 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFitText}
                className="h-7 px-2 text-[11px] rounded-md font-semibold text-primary"
                title="Crop margins to make text large"
              >
                Fit Text
              </Button>
            )}

            {zoomFactor !== 1.0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFitPage}
                className="h-7 px-2 text-[11px] rounded-md font-semibold opacity-75"
                title="Fit whole page width"
              >
                100%
              </Button>
            )}
          </div>

          {/* Quick Page Info & Right-Stick hint */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono opacity-80">
              p. {currentPage} / {totalPages}
            </span>
          </div>
        </div>
      </footer>
    )}

      {/* ---------------- Aa Settings Sheet (Font Size, Font Style, Theme, Zoom) ---------------- */}
      {showSettingsSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-fade-in"
          onClick={() => {
            setShowSettingsSheet(false);
            resetAutoHideTimer();
          }}
        >
          <div
            className={`w-full rounded-t-3xl p-5 border-t shadow-2xl max-h-[85vh] overflow-y-auto ${
              theme === 'dark'
                ? 'bg-[#151821] border-white/10 text-white'
                : theme === 'sepia'
                ? 'bg-[#f7efe0] border-[#d8c8af] text-[#3d2f20]'
                : 'bg-white border-gray-200 text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-current/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Reading & Appearance Settings</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSettingsSheet(false);
                  resetAutoHideTimer();
                }}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5 pt-4">
              {/* Reading Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-75">Reading Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setViewMode('page');
                      resetAutoHideTimer();
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      viewMode === 'page'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Original PDF (Edge-to-Edge)
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('text');
                      resetAutoHideTimer();
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      viewMode === 'text'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    Reflowable Text (Aa)
                  </button>
                </div>
              </div>

              {/* Edge-to-Edge Zoom Controls (For Page Mode) */}
              {viewMode === 'page' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold opacity-75">PDF Page Zoom & Margins</span>
                    <span className="font-mono font-bold text-primary">
                      {Math.round(zoomFactor * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        setZoomFactor(1.0);
                        resetAutoHideTimer();
                      }}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        zoomFactor === 1.0
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-current/20 opacity-70'
                      }`}
                    >
                      Fit Page
                    </button>
                    <button
                      onClick={() => {
                        setZoomFactor(1.45);
                        resetAutoHideTimer();
                      }}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        zoomFactor === 1.45
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                          : 'border-current/20 opacity-70'
                      }`}
                    >
                      Fit Text (Crop)
                    </button>
                    <button
                      onClick={() => {
                        setZoomFactor(1.75);
                        resetAutoHideTimer();
                      }}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        zoomFactor === 1.75
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-current/20 opacity-70'
                      }`}
                    >
                      Large (175%)
                    </button>
                    <button
                      onClick={() => {
                        setZoomFactor(2.2);
                        resetAutoHideTimer();
                      }}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        zoomFactor === 2.2
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-current/20 opacity-70'
                      }`}
                    >
                      220%
                    </button>
                  </div>
                  <p className="text-[11px] opacity-60">
                    💡 Pinch with 2 fingers anywhere to zoom freely. Double-tap screen to hide bars while reading!
                  </p>
                </div>
              )}

              {/* Font Style Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-75">Font Style</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setFontStyle('serif');
                      resetAutoHideTimer();
                    }}
                    className={`py-2 rounded-xl border font-serif text-xs font-semibold transition-all ${
                      fontStyle === 'serif'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    Serif (Book)
                  </button>
                  <button
                    onClick={() => {
                      setFontStyle('sans');
                      resetAutoHideTimer();
                    }}
                    className={`py-2 rounded-xl border font-sans text-xs font-semibold transition-all ${
                      fontStyle === 'sans'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    Sans-Serif
                  </button>
                  <button
                    onClick={() => {
                      setFontStyle('mono');
                      resetAutoHideTimer();
                    }}
                    className={`py-2 rounded-xl border font-mono text-xs font-semibold transition-all ${
                      fontStyle === 'mono'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    Monospace
                  </button>
                </div>
              </div>

              {/* Background Theme */}
              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-75">Reading Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setTheme('dark');
                      resetAutoHideTimer();
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#0d1017] text-white transition-all ${
                      theme === 'dark' ? 'ring-2 ring-primary border-primary' : 'border-white/10'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    Dark
                  </button>

                  <button
                    onClick={() => {
                      setTheme('sepia');
                      resetAutoHideTimer();
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#f8f1e3] text-[#433422] transition-all ${
                      theme === 'sepia' ? 'ring-2 ring-amber-500 border-amber-600' : 'border-amber-300/40'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-600" />
                    Sepia
                  </button>

                  <button
                    onClick={() => {
                      setTheme('light');
                      resetAutoHideTimer();
                    }}
                    className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold bg-white text-gray-900 transition-all ${
                      theme === 'light' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    Light
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

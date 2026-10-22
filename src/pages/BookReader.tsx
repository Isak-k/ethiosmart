import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Book } from '@/types/book';
import { getBook, incrementBookView } from '@/lib/books';
import {
  getOfflineBook,
  isBookSavedOffline,
  downloadAndSaveBookOffline,
  deleteOfflineBook,
  exportOfflineBookToDisk,
  OfflineBookRecord,
} from '@/lib/offline-books';
import { buildDrivePreviewUrl, buildDriveViewUrl, buildDriveDownloadUrl } from '@/lib/google-drive';
import { MobileVerticalReader } from '@/components/book/MobileVerticalReader';
import { InteractiveShortNoteReader } from '@/components/book/InteractiveShortNoteReader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Download,
  Lock,
  Loader2,
  AlertCircle,
  BookOpen,
  FileText,
  Sparkles,
  HardDrive,
  CloudOff,
  CheckCircle2,
  Trash2,
  WifiOff,
} from 'lucide-react';

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const containerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(100);
  const [iframeError, setIframeError] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Offline reader state
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [isReadingOffline, setIsReadingOffline] = useState(false);
  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState('');
  const [isOfflineUnavailable, setIsOfflineUnavailable] = useState(false);

  useEffect(() => {
    if (bookId) {
      loadBook(bookId);
    }
  }, [bookId]);

  // Clean up blob URL when unmounting or changing document
  useEffect(() => {
    return () => {
      if (offlineBlobUrl) {
        URL.revokeObjectURL(offlineBlobUrl);
      }
    };
  }, [offlineBlobUrl]);

  // Ensure iframe loading overlay dismisses for offline blobs (since browser PDF plugins might not fire iframe.onload)
  useEffect(() => {
    if (isReadingOffline && offlineBlobUrl) {
      const timer = setTimeout(() => {
        setIframeLoading(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isReadingOffline, offlineBlobUrl]);

  const loadBook = async (id: string) => {
    setLoading(true);
    setIsOfflineUnavailable(false);

    try {
      // 1. Check local offline storage first
      const offlineRecord = await getOfflineBook(id);
      if (offlineRecord) {
        setIsSavedOffline(true);
        setBook(offlineRecord.book);
        setPdfBlob(offlineRecord.blob);
        const blobUrl = URL.createObjectURL(offlineRecord.blob);
        setOfflineBlobUrl(blobUrl);
        setIsReadingOffline(true);
        setLoading(false);
        setIframeLoading(false);
        return;
      }

      // 2. If not stored locally, attempt online fetch
      const data = await getBook(id);
      if (!data) {
        setBook(null);
        setLoading(false);
        return;
      }

      setBook(data);
      const saved = await isBookSavedOffline(id);
      setIsSavedOffline(saved);
      incrementBookView(id);

      // Pre-fetch document binary via proxy for responsive Canvas reading on mobile and desktop
      if (data.driveFileId) {
        fetch(`/api/drive/download?fileId=${encodeURIComponent(data.driveFileId)}`)
          .then(async (res) => {
            if (res.ok) {
              const contentType = res.headers.get('content-type') || '';
              if (!contentType.includes('text/html')) {
                const blob = await res.blob();
                const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
                if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
                  setPdfBlob(blob);
                }
              }
              setIframeLoading(false);
            }
          })
          .catch((err) => {
            console.warn('Background binary fetch fallback notice:', err);
          });
      }
    } catch (err: any) {
      console.warn('Online fetch failed in reader, trying offline record:', err);
      // If network fails (e.g. offline), re-check local storage
      const fallbackRecord = await getOfflineBook(id);
      if (fallbackRecord) {
        setIsSavedOffline(true);
        setBook(fallbackRecord.book);
        setPdfBlob(fallbackRecord.blob);
        const blobUrl = URL.createObjectURL(fallbackRecord.blob);
        setOfflineBlobUrl(blobUrl);
        setIsReadingOffline(true);
        setIframeLoading(false);
      } else {
        setIsOfflineUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Download resource for in-app offline reading
  const handleSaveForOffline = async () => {
    if (!book) return;
    setIsDownloadingOffline(true);
    setDownloadProgressMsg('Downloading document from Google Drive...');

    try {
      await downloadAndSaveBookOffline(book, (msg) => {
        setDownloadProgressMsg(msg);
      });

      setIsSavedOffline(true);
      toast({
        title: 'Downloaded for Offline Reading',
        description: `"${book.title}" is now available offline inside the app!`,
      });

      // Switch reader to offline local copy immediately
      const savedRecord = await getOfflineBook(book.id);
      if (savedRecord) {
        const url = URL.createObjectURL(savedRecord.blob);
        setOfflineBlobUrl(url);
        setPdfBlob(savedRecord.blob);
        setIsReadingOffline(true);
        setIframeLoading(false);
      }
    } catch (err: any) {
      console.error('Offline download error:', err);
      toast({
        title: 'Download failed',
        description: err.message || 'Could not download resource for offline use.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingOffline(false);
      setDownloadProgressMsg('');
    }
  };

  // Remove offline copy
  const handleRemoveOffline = async () => {
    if (!book) return;
    try {
      await deleteOfflineBook(book.id);
      setIsSavedOffline(false);
      if (isReadingOffline) {
        if (offlineBlobUrl) {
          URL.revokeObjectURL(offlineBlobUrl);
          setOfflineBlobUrl(null);
        }
        setPdfBlob(null);
        setIsReadingOffline(false);
        setIframeLoading(true);
      }
      toast({
        title: 'Removed from offline storage',
        description: `"${book.title}" has been removed from local storage.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error removing offline book',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Export local offline copy to device disk
  const handleExportToDisk = async () => {
    if (!book) return;
    try {
      await exportOfflineBookToDisk(book.id);
    } catch (err: any) {
      toast({
        title: 'Export error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

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

  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 15, 70));
  const handleResetZoom = () => setZoomScale(100);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Opening document reader...</p>
        </div>
      </DashboardLayout>
    );
  }

  // When user is offline and book hasn't been saved
  if (isOfflineUnavailable) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 max-w-md mx-auto space-y-5">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <WifiOff className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold font-display">Document Not Available Offline</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are currently offline and this resource hasn't been saved to your local offline library yet. Connect to the internet to download it, or browse your downloaded offline books.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button onClick={() => navigate('/dashboard/books?tab=offline')} className="rounded-xl w-full sm:w-auto">
              <HardDrive className="h-4 w-4 mr-2" />
              Browse Offline Books
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/books')} className="rounded-xl w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!book) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold font-display">Document not available</h2>
          <p className="text-sm text-muted-foreground">
            The requested document could not be loaded or access is restricted.
          </p>
          <Button onClick={() => navigate('/dashboard/books')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isShortNote = book.resourceType === 'short_note';

  // Any shortnote or any resource without a Google Drive PDF file renders in the native interactive reader
  if (isShortNote || (book.sections && book.sections.length > 0) || (book.content && !book.driveFileId) || !book.driveFileId) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto pb-12 animate-fade-in pt-2">
          <InteractiveShortNoteReader
            book={book}
            onBack={() => navigate(`/dashboard/books/${book.id}`)}
          />
        </div>
      </DashboardLayout>
    );
  }

  const previewUrl = buildDrivePreviewUrl(book.driveFileId);
  const viewUrl = buildDriveViewUrl(book.driveFileId);
  const downloadUrl = buildDriveDownloadUrl(book.driveFileId);

  // Active rendering URL: either local offline blob URL or Google Drive preview iframe
  const activeViewerUrl = isReadingOffline && offlineBlobUrl ? offlineBlobUrl : previewUrl;

  // On Mobile Phone: Use Dedicated Full-Screen Vertical-Scroll Reader
  if (isMobile) {
    return (
      <MobileVerticalReader
        book={book}
        pdfData={pdfBlob}
        isSavedOffline={isSavedOffline}
        onBack={() => navigate(`/dashboard/books/${book.id}`)}
        onSaveOffline={book.allowDownload ? handleSaveForOffline : undefined}
        isDownloadingOffline={isDownloadingOffline}
      />
    );
  }

  return (
    <DashboardLayout>
      <div
        ref={containerRef}
        className={`flex flex-col space-y-2 animate-fade-in ${
          isFullscreen
            ? 'fixed inset-0 z-50 bg-background p-0 h-screen w-screen overflow-hidden'
            : 'w-full -mt-3 lg:-mt-5 pb-6'
        }`}
      >
        {/* Compact Desktop Top Bar (No large hero section, starts immediately at the top) */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl border bg-card/95 shadow-xs shrink-0 gap-2">
          {/* Left: Back button, Badges & Document Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/books/${book.id}`)}
              className="rounded-lg shrink-0 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Details
            </Button>

            <Badge
              variant={isShortNote ? 'secondary' : 'default'}
              className="text-[10px] font-semibold py-0 px-2 h-5 hidden sm:inline-flex"
            >
              {isShortNote ? 'Note' : 'Book'}
            </Badge>

            {isReadingOffline ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 py-0 px-2 h-5">
                <HardDrive className="h-2.5 w-2.5 text-emerald-500" />
                Offline
              </Badge>
            ) : isSavedOffline ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 py-0 px-2 h-5 hidden md:inline-flex">
                Saved
              </Badge>
            ) : null}

            <h1 className="text-xs sm:text-sm font-bold truncate max-w-md text-foreground">
              {book.title}
            </h1>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-r pr-2 mr-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomScale <= 70}
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground px-1 select-none">
                {zoomScale}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomScale >= 160}
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              {zoomScale !== 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetZoom}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Offline Save / Export */}
            {isSavedOffline ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportToDisk}
                  className="h-7 px-2 text-[11px] font-medium rounded-lg text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                  title="Export local copy to disk"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                  Saved
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveOffline}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                  title="Remove from offline storage"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : book.allowDownload ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveForOffline}
                disabled={isDownloadingOffline}
                className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                title="Save for offline reading"
              >
                {isDownloadingOffline ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3 mr-1" />
                    Save Offline
                  </>
                )}
              </Button>
            ) : null}

            {/* Fullscreen Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-7 w-7 p-0 rounded-lg"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Open in Google Drive Link (only when online) */}
            {!isReadingOffline && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(viewUrl, '_blank')}
                className="h-7 px-2 text-[11px] font-semibold rounded-lg hidden md:inline-flex"
                title="Open in Google Drive"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Drive
              </Button>
            )}

            {/* Admin AI Generator shortcut */}
            {role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(
                    `/dashboard/admin/ai-generator?source=book&bookId=${book.id}&deptId=${book.departmentId}&subjectId=${book.subjectId}`
                  )
                }
                className="h-7 px-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg hidden lg:flex"
              >
                <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                Generate Exam
              </Button>
            )}
          </div>
        </div>

        {/* Embedded Viewer Container: Placed fully at the top with maximum screen height */}
        <div
          className={`relative rounded-xl border border-border/80 bg-slate-900 overflow-hidden shadow-md w-full ${
            isFullscreen
              ? 'flex-1 min-h-0 h-full'
              : 'h-[calc(100vh-130px)] min-h-[750px]'
          }`}
          style={isFullscreen ? undefined : { height: 'calc(100vh - 130px)', minHeight: '750px' }}
        >
          {/* Loading Indicator */}
          {iframeLoading && (
            <div className="absolute inset-0 bg-background/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {isReadingOffline ? 'Loading local document...' : 'Rendering document viewer...'}
              </p>
            </div>
          )}

          {/* Iframe error fallback notice (for online Drive preview) */}
          {!isReadingOffline && iframeError && (
            <div className="absolute inset-x-6 top-6 z-20">
              <Alert variant="destructive" className="rounded-xl shadow-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Viewer Connection Notice</AlertTitle>
                <AlertDescription className="text-xs">
                  If the Google Drive document does not render automatically inside your browser due to third-party cookie restrictions,{' '}
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold text-white ml-1 inline-flex items-center gap-1"
                  >
                    click here to open directly in Google Drive <ExternalLink className="h-3 w-3" />
                  </a>
                  , or click <strong>Save Offline</strong> above to read it directly inside ExamPro.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Document Viewer Frame (Local Offline Blob or Drive Preview for Desktop) */}
          <div
            className="w-full h-full transition-transform duration-200 overflow-hidden"
            style={{
              transform: zoomScale === 100 ? undefined : `scale(${zoomScale / 100})`,
              transformOrigin: 'top center',
              width: '100%',
              height: '100%',
            }}
          >
            <iframe
              src={activeViewerUrl}
              title={book.title}
              onLoad={() => setIframeLoading(false)}
              onError={() => {
                setIframeLoading(false);
                setIframeError(true);
              }}
              allow="autoplay"
              className="w-full h-full border-0 bg-white block"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '100%',
              }}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

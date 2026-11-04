import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Book } from '@/types/book';
import { getBook, getBooks, toggleBookBookmark, getUserBookBookmarks, incrementBookView } from '@/lib/books';
import { getSubject } from '@/lib/subjects';
import { isBookSavedOffline, downloadAndSaveBookOffline, deleteOfflineBook } from '@/lib/offline-books';
import { getSubjectCover } from '@/lib/subject-covers';
import { buildDriveDownloadUrl, buildDriveViewUrl, extractDriveFileId } from '@/lib/google-drive';
import { BookCard } from '@/components/book/BookCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  FileText,
  ArrowLeft,
  Eye,
  Download,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Sparkles,
  Share2,
  Calendar,
  User,
  Globe,
  Tag,
  Loader2,
  Lock,
  Building,
  Layers,
  HardDrive,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);

  useEffect(() => {
    if (bookId) {
      loadBookDetails(bookId);
    }
  }, [bookId, user]);

  const loadBookDetails = async (id: string) => {
    setLoading(true);
    try {
      const data = await getBook(id);
      if (!data) {
        setBook(null);
        setLoading(false);
        return;
      }

      let subjectCoverUrl = data.coverImageUrl;
      let subjectName = data.subjectName;

      if (data.subjectId) {
        try {
          const sub = await getSubject(data.subjectId);
          if (sub) {
            if (!subjectName) subjectName = sub.name;
            if (!subjectCoverUrl) {
              subjectCoverUrl = sub.coverImageUrl || getSubjectCover(sub.name).url;
            }
          }
        } catch (subErr) {
          console.warn('Error fetching subject in BookDetails:', subErr);
        }
      }

      const fullBook: Book = {
        ...data,
        subjectName,
        coverImageUrl: subjectCoverUrl,
      };

      setBook(fullBook);
      incrementBookView(id);

      // Check offline saved status
      const saved = await isBookSavedOffline(id);
      setIsSavedOffline(saved);

      // Check bookmark status
      if (user) {
        const bookmarks = await getUserBookBookmarks(user.uid);
        setIsBookmarked(bookmarks.includes(id));
      }

      // Fetch related books from same subject
      if (data.subjectId) {
        const related = await getBooks({ subjectId: data.subjectId }, role);
        const enrichedRelated = related.map((b) => ({
          ...b,
          coverImageUrl: b.coverImageUrl || subjectCoverUrl || '',
          subjectName: b.subjectName || subjectName,
        }));
        setRelatedBooks(enrichedRelated.filter((b) => b.id !== id).slice(0, 3));
      }
    } catch (err: any) {
      console.error('Error loading book details:', err);
      toast({
        title: 'Error loading resource',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!user || !book) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to bookmark resources.',
      });
      return;
    }

    try {
      const state = await toggleBookBookmark(user.uid, book.id);
      setIsBookmarked(state);
      toast({
        title: state ? 'Bookmarked' : 'Bookmark Removed',
        description: state ? 'Saved to your personal bookmarks.' : 'Removed from bookmarks.',
      });
    } catch (err: any) {
      toast({
        title: 'Error updating bookmark',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: 'Link copied',
      description: 'Resource link copied to clipboard.',
    });
  };

  const handleSaveOffline = async () => {
    if (!book) return;
    setIsDownloadingOffline(true);
    try {
      await downloadAndSaveBookOffline(book);
      setIsSavedOffline(true);
      toast({
        title: 'Downloaded for Offline Reading',
        description: `"${book.title}" is now available offline inside EthioSmart!`,
      });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message || 'Could not download resource.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingOffline(false);
    }
  };

  const handleRemoveOffline = async () => {
    if (!book) return;
    try {
      await deleteOfflineBook(book.id);
      setIsSavedOffline(false);
      toast({
        title: 'Removed from offline storage',
        description: 'Resource removed from this device.',
      });
    } catch (err: any) {
      toast({
        title: 'Error removing offline book',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!book) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 max-w-md mx-auto space-y-4">
          <h2 className="text-2xl font-bold font-display">Resource not found</h2>
          <p className="text-sm text-muted-foreground">
            The requested textbook or note could not be found or has been archived.
          </p>
          <Button onClick={() => navigate('/dashboard/books')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const effectiveCover = getSubjectCover(book.subjectName || book.title, book.coverImageUrl);
  const isShortNote = book.resourceType === 'short_note';
  const driveFileId = book.driveFileId || extractDriveFileId(book.driveUrl || '');
  const driveViewUrl = driveFileId ? buildDriveViewUrl(driveFileId) : book.driveUrl;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(role === 'admin' ? '/dashboard/admin/books' : '/dashboard/books')}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Library
          </Button>
        </div>

        {/* Hero Resource Card */}
        <div className="relative rounded-3xl border border-border/80 bg-card shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
            {/* Left Cover Preview */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-muted shadow-md border border-border/60">
              <img
                src={effectiveCover.url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <Badge
                  className={`text-xs font-semibold backdrop-blur-md shadow-xs ${
                    isShortNote
                      ? 'bg-amber-500/90 text-white'
                      : 'bg-primary/95 text-primary-foreground'
                  }`}
                >
                  {isShortNote ? (
                    <FileText className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                  )}
                  {isShortNote ? 'Note' : 'Book'}
                </Badge>
              </div>
            </div>

            {/* Right Details & Primary Actions */}
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    <Building className="w-3 h-3 mr-1 text-primary" />
                    {book.departmentName || 'Department Resource'}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-medium">
                    <Layers className="w-3 h-3 mr-1 text-primary" />
                    {book.subjectName || 'Subject'}
                  </Badge>
                  {role === 'admin' && (
                    <Badge variant="secondary" className="text-xs uppercase font-medium">
                      {book.status}
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">
                  {book.title}
                </h1>
              </div>

              {/* Author & Publication Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground pt-1">
                {book.author && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span className="truncate">By {book.author}</span>
                  </div>
                )}
                {(book.edition || book.publicationYear) && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>{book.edition || book.publicationYear}</span>
                  </div>
                )}
                {book.language && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span>{book.language}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-3">
                <Button
                  onClick={() => navigate(`/dashboard/books/${book.id}/read`)}
                  size="lg"
                  className="rounded-xl bg-primary shadow-sm font-semibold text-sm px-6"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {isSavedOffline
                    ? 'Read Directly (Offline)'
                    : isShortNote && book.sections && book.sections.length > 0
                    ? 'Open Interactive Shortnotes'
                    : isShortNote
                    ? 'Read Note Directly'
                    : 'Read Book Directly'}
                </Button>

                {driveViewUrl && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(driveViewUrl, '_blank', 'noopener,noreferrer')}
                    className="rounded-xl font-semibold text-sm border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Open directly in Google Drive in a new browser tab (Instant display)"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Google Drive
                  </Button>
                )}

                {role === 'admin' && isShortNote && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate(`/dashboard/admin/shortnotes/edit/${book.id}`)}
                    className="rounded-xl font-semibold text-sm border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Edit in Studio
                  </Button>
                )}

                {/* Single Managed Offline / Download Action */}
                {isSavedOffline ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Saved Offline
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveOffline}
                      className="rounded-xl text-xs text-muted-foreground hover:text-destructive h-10 px-2.5"
                      title="Remove from offline storage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : book.allowDownload ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleSaveOffline}
                    disabled={isDownloadingOffline}
                    className="rounded-xl font-medium text-sm"
                  >
                    {isDownloadingOffline ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download for Offline
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground/60 cursor-not-allowed">
                    <Lock className="w-4 h-4" />
                    Download Restricted
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleToggleBookmark}
                  className="rounded-xl px-3"
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark resource'}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-5 h-5 text-amber-500 fill-amber-500" />
                  ) : (
                    <Bookmark className="w-5 h-5 text-muted-foreground" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleShare}
                  className="rounded-xl px-3"
                  title="Share link"
                >
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                </Button>

                {role === 'admin' && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() =>
                      navigate(
                        `/dashboard/admin/ai-generator?source=book&bookId=${book.id}&deptId=${book.departmentId}&subjectId=${book.subjectId}`
                      )
                    }
                    className="rounded-xl font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                  >
                    <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                    Generate Exam Questions
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description & Chapter Topics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  About this Resource
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {book.description ||
                    'Official academic resource prepared for study, curriculum review, and examination preparation.'}
                </p>

                <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Source: Google Drive Document</span>
                  <a
                    href={buildDriveViewUrl(book.driveFileId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    Open directly in Google Drive <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Chapters / Topics Breakdown */}
            {Array.isArray(book.chapterLabels) && book.chapterLabels.length > 0 && (
              <Card className="rounded-2xl border shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    Covered Chapters & Curriculum Units
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {book.chapterLabels.map((chapter, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border bg-muted/30 flex items-center gap-2 text-xs font-medium"
                      >
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="truncate">{chapter}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Related Resources Sidebar */}
          <div className="space-y-4">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Related in {book.subjectName || 'Subject'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedBooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other resources in this subject yet.</p>
                ) : (
                  relatedBooks.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => navigate(`/dashboard/books/${rel.id}`)}
                      className="p-3 rounded-xl border border-border/60 hover:border-primary/50 transition-all cursor-pointer bg-card/50 hover:bg-muted/40 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 truncate">
                        <p className="text-xs font-semibold text-foreground truncate">{rel.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {rel.resourceType === 'short_note' ? 'Short Note' : 'Textbook'}
                        </p>
                      </div>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

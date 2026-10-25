import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Book, BookResourceType } from '@/types/book';
import { getBooks, getUserBookBookmarks, toggleBookBookmark } from '@/lib/books';
import {
  getAllOfflineBooks,
  getOfflineBooksStorageStats,
  downloadAndSaveBookOffline,
  clearAllOfflineBooks,
  OfflineBookRecord,
} from '@/lib/offline-books';
import { getDepartments } from '@/lib/departments';
import { getSubjects } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import { Department, Exam } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';
import { BookCard } from '@/components/book/BookCard';
import { getPublishedExams } from '@/lib/firebase-exams';
import { getSubjectVisualTheme } from '@/components/book/InteractiveShortNoteReader';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  FileText,
  Search,
  Bookmark,
  Sparkles,
  Layers,
  Building,
  Loader2,
  FolderOpen,
  Library,
  ArrowRight,
  ArrowLeft,
  HardDrive,
  WifiOff,
  CheckCircle2,
  Trash2,
  GraduationCap,
  Clock,
  BookCheck,
  Check,
  RotateCcw,
} from 'lucide-react';

export default function StudentBooks() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const userDeptId = profile?.departmentId || (profile as any)?.department_id;

  const [books, setBooks] = useState<Book[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Offline state
  const [offlineRecords, setOfflineRecords] = useState<OfflineBookRecord[]>([]);
  const [storageStats, setStorageStats] = useState({ totalBytes: 0, formattedSize: '0 B', count: 0 });
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Primary mode: 'books' | 'notes' | 'bookmarks' | 'offline'
  const initialMode = useMemo(() => {
    const tabParam = searchParams.get('tab');
    const typeParam = searchParams.get('type');
    if (tabParam === 'offline') return 'offline';
    if (tabParam === 'bookmarks') return 'bookmarks';
    if (typeParam === 'notes' || tabParam === 'notes' || tabParam === 'short_note') return 'notes';
    return 'books';
  }, [searchParams]);

  const [primaryMode, setPrimaryMode] = useState<'books' | 'notes' | 'bookmarks' | 'offline'>(initialMode);
  const [selectedNotesSubjectId, setSelectedNotesSubjectId] = useState<string | null>(
    searchParams.get('subjectId') || null
  );

  // Step 1 Choice State: 'books' | 'notes'
  const [selectedChoice, setSelectedChoice] = useState<'books' | 'notes'>(() => {
    const typeParam = searchParams.get('type');
    return typeParam === 'notes' ? 'notes' : 'books';
  });

  // Has the user confirmed their choice by clicking "Next"?
  const [isChoiceConfirmed, setIsChoiceConfirmed] = useState<boolean>(() => {
    const tab = searchParams.get('tab');
    const subjectId = searchParams.get('subjectId');
    const step = searchParams.get('step');
    if (tab === 'offline' || tab === 'bookmarks' || subjectId || step === 'view') {
      return true;
    }
    return false;
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchLibraryData();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchLibraryData();
    loadOfflineData();
  }, [user, userDeptId]);

  const loadOfflineData = async () => {
    try {
      const [records, stats] = await Promise.all([
        getAllOfflineBooks(),
        getOfflineBooksStorageStats(),
      ]);
      setOfflineRecords(records);
      setStorageStats(stats);
    } catch (err) {
      console.warn('Error loading offline books:', err);
    }
  };

  const fetchLibraryData = async () => {
    setLoading(true);
    try {
      const [booksData, deptsData, subsData, bookmarksData, examsData] = await Promise.all([
        getBooks({}, 'student'),
        getDepartments().catch(() => []),
        getSubjects().catch(() => []),
        user ? getUserBookBookmarks(user.uid).catch(() => []) : Promise.resolve([]),
        getPublishedExams().catch(() => []),
      ]);

      // Enrich books with dept & subject names and cover images
      const enriched = booksData.map((b) => {
        const dept = deptsData.find((d) => d.id === b.departmentId);
        const sub = subsData.find((s) => s.id === b.subjectId);
        const effectiveCoverUrl =
          b.coverImageUrl ||
          sub?.coverImageUrl ||
          (sub ? getSubjectCover(sub.name).url : '');

        return {
          ...b,
          departmentName: dept?.name || b.departmentName,
          subjectName: sub?.name || b.subjectName,
          coverImageUrl: effectiveCoverUrl,
        };
      });

      setBooks(enriched);
      setDepartments(deptsData);
      setSubjects(subsData);
      setBookmarkedIds(bookmarksData);
      setAvailableExams(examsData);
    } catch (err: any) {
      console.warn('Error loading library resources from Firestore (possibly offline):', err);
      const offlineList = await getAllOfflineBooks();
      if (offlineList.length > 0) {
        setOfflineRecords(offlineList);
        setPrimaryMode('offline');
        setIsChoiceConfirmed(true);
      } else {
        toast({
          title: 'Offline Notice',
          description: 'Could not connect to the cloud library. Check your internet connection.',
          variant: 'default',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (bookId: string) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save items to your personal bookmarks.',
      });
      return;
    }

    try {
      const isNowBookmarked = await toggleBookBookmark(user.uid, bookId);
      if (isNowBookmarked) {
        setBookmarkedIds((prev) => [...prev, bookId]);
        toast({
          title: 'Saved to Bookmarks',
          description: 'Item added to your personal bookmarks.',
        });
      } else {
        setBookmarkedIds((prev) => prev.filter((id) => id !== bookId));
        toast({
          title: 'Bookmark Removed',
          description: 'Item removed from your saved bookmarks.',
        });
      }
    } catch (e: any) {
      toast({
        title: 'Bookmark update failed',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  // Save book for offline browsing
  const handleSaveBookOffline = async (book: Book) => {
    setDownloadingBookId(book.id);
    try {
      await downloadAndSaveBookOffline(book);
      toast({
        title: 'Saved for Offline Reading',
        description: `"${book.title}" is now available offline inside the app!`,
      });
      await loadOfflineData();
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message || 'Could not download resource for offline use.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingBookId(null);
    }
  };

  // Clear all offline storage
  const handleClearOfflineStorage = async () => {
    if (!window.confirm('Are you sure you want to remove all offline items from this device?')) {
      return;
    }
    try {
      await clearAllOfflineBooks();
      toast({
        title: 'Offline Storage Cleared',
        description: 'All offline items have been removed from this device.',
      });
      await loadOfflineData();
    } catch (err: any) {
      toast({
        title: 'Error clearing offline storage',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Set of offline book IDs for fast lookup
  const offlineBookIds = useMemo(() => {
    return new Set(offlineRecords.map((r) => r.bookId));
  }, [offlineRecords]);

  // Counts
  const textbooksCount = useMemo(
    () => books.filter((b) => b.resourceType === 'textbook').length,
    [books]
  );
  const notesCount = useMemo(
    () => books.filter((b) => b.resourceType === 'short_note').length,
    [books]
  );

  // Filtered source list depending on primaryMode
  const filteredBooksList = useMemo(() => {
    const sourceList =
      primaryMode === 'offline'
        ? offlineRecords.map((r) => {
            const sub = subjects.find((s) => s.id === r.book.subjectId);
            const effectiveCoverUrl =
              r.book.coverImageUrl ||
              sub?.coverImageUrl ||
              (sub ? getSubjectCover(sub.name).url : '');
            return {
              ...r.book,
              coverImageUrl: effectiveCoverUrl,
              subjectName: sub?.name || r.book.subjectName,
            };
          })
        : books;

    return sourceList.filter((b) => {
      if (primaryMode === 'books' && b.resourceType === 'short_note') return false;
      if (primaryMode === 'notes' && b.resourceType !== 'short_note') return false;
      if (primaryMode === 'bookmarks' && !bookmarkedIds.includes(b.id)) return false;

      // Department filter
      if (selectedDept !== 'all') {
        const matchesDept =
          !b.departmentId ||
          b.departmentId === 'all' ||
          b.departmentId === selectedDept ||
          (Array.isArray(b.departmentIds) && (b.departmentIds.includes(selectedDept) || b.departmentIds.includes('all')));
        if (!matchesDept) return false;
      }

      // Subject filter
      if (selectedSubject !== 'all' && b.subjectId !== selectedSubject) return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = b.title?.toLowerCase().includes(q);
        const authorMatch = b.author?.toLowerCase().includes(q);
        const subMatch = b.subjectName?.toLowerCase().includes(q);
        const descMatch = b.description?.toLowerCase().includes(q);
        const chapterMatch = b.chapterTitle?.toLowerCase().includes(q);
        return titleMatch || authorMatch || subMatch || descMatch || chapterMatch;
      }

      return true;
    });
  }, [books, offlineRecords, primaryMode, selectedDept, selectedSubject, searchQuery, bookmarkedIds, subjects]);

  // Subjects that have notes, enriched with note counts and reading time
  const subjectsWithNotes = useMemo(() => {
    return subjects
      .filter((s) => {
        if (selectedDept !== 'all') {
          if (!s.departmentIds?.includes(selectedDept) && s.departmentId !== selectedDept) {
            return false;
          }
        }
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          if (!s.name.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .map((s) => {
        const subjectNotes = books.filter(
          (b) => b.resourceType === 'short_note' && b.subjectId === s.id
        );
        const totalMinutes = subjectNotes.reduce(
          (acc, n) => acc + (n.readingTimeMinutes || 10),
          0
        );
        return {
          ...s,
          notesCount: subjectNotes.length,
          totalMinutes,
          notes: subjectNotes,
        };
      })
      .sort((a, b) => b.notesCount - a.notesCount); // Show subjects with notes first
  }, [subjects, books, selectedDept, searchQuery]);

  // Selected Subject details for Notes Level 2
  const currentNotesSubject = useMemo(
    () => subjects.find((s) => s.id === selectedNotesSubjectId),
    [subjects, selectedNotesSubjectId]
  );

  // Chapter notes for the selected subject
  const currentSubjectChapterNotes = useMemo(() => {
    if (!selectedNotesSubjectId) return [];
    const list = books.filter(
      (b) => b.resourceType === 'short_note' && b.subjectId === selectedNotesSubjectId
    );

    // Apply search query filter if user searches inside chapter view
    const filtered = searchQuery.trim()
      ? list.filter((n) => {
          const q = searchQuery.toLowerCase().trim();
          return (
            n.title?.toLowerCase().includes(q) ||
            n.chapterTitle?.toLowerCase().includes(q) ||
            n.summary?.toLowerCase().includes(q) ||
            n.description?.toLowerCase().includes(q)
          );
        })
      : list;

    // Sort chapters by chapterNumber or number extracted from title
    return [...filtered].sort((a, b) => {
      const getNum = (note: Book) => {
        if (typeof note.chapterNumber === 'number') return note.chapterNumber;
        const fromTitle = (note.chapterTitle || note.title || '').match(/chapter\s*(\d+)/i);
        if (fromTitle) return parseInt(fromTitle[1], 10);
        return 999;
      };
      return getNum(a) - getNum(b);
    });
  }, [books, selectedNotesSubjectId, searchQuery]);

  // Helper to find a matching practice exam for a chapter note
  const findExamForNote = (note: Book): Exam | undefined => {
    if (note.examId) {
      const direct = availableExams.find((e) => e.examId === note.examId);
      if (direct) return direct;
    }
    // Match by chapterId
    if (note.chapterId) {
      const byChapter = availableExams.find((e) => e.chapterId === note.chapterId);
      if (byChapter) return byChapter;
    }
    // Match by chapterTitle similarity under the same subject
    if (note.subjectId && note.chapterTitle) {
      const titleLower = note.chapterTitle.toLowerCase();
      const byTitle = availableExams.find(
        (e) =>
          e.subjectId === note.subjectId &&
          (e.title.toLowerCase().includes(titleLower) ||
            (e.chapterTitle && e.chapterTitle.toLowerCase().includes(titleLower)))
      );
      if (byTitle) return byTitle;
    }
    // Fallback: any exam under the same subject
    if (note.subjectId) {
      return availableExams.find((e) => e.subjectId === note.subjectId);
    }
    return undefined;
  };

  // Handler when user clicks "Next" on the choice screen
  const handleProceedNext = () => {
    setPrimaryMode(selectedChoice);
    setIsChoiceConfirmed(true);
    setSelectedNotesSubjectId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-16">
        {/* Offline Banner notice */}
        {!isOnline && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm font-medium">
            <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <span>You are currently offline. Showing textbooks and chapter study notes downloaded to this device.</span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              Offline Mode
            </Badge>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Loading digital library resources...</p>
          </div>
        ) : !isChoiceConfirmed ? (
          /* ========================================================================= */
          /* STEP 1: CHOICE SCREEN (USER CHOOSES BOOKS OR NOTES, THEN CLICKS NEXT)      */
          /* ========================================================================= */
          <div className="space-y-8 max-w-4xl mx-auto py-4">
            {/* Hero Selection Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Library className="h-3.5 w-3.5" />
                ExamPro Academic Library
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
                What would you like to study?
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Choose between complete curriculum textbooks or high-yield chapter study notes, then click Next to view available materials.
              </p>
            </div>

            {/* The Two Choice Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {/* CHOICE 1: BOOKS */}
              <div
                onClick={() => setSelectedChoice('books')}
                className={`group relative p-6 sm:p-7 rounded-3xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  selectedChoice === 'books'
                    ? 'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/30 scale-[1.01]'
                    : 'border-border/70 bg-card hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        selectedChoice === 'books'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <BookOpen className="h-7 w-7" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={selectedChoice === 'books' ? 'default' : 'outline'}
                        className="rounded-full text-xs px-2.5 py-0.5 font-bold"
                      >
                        {textbooksCount} Available
                      </Badge>

                      {/* Custom Radio Circle */}
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedChoice === 'books'
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {selectedChoice === 'books' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                      Books & Textbooks
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      Complete digital textbooks, official syllabus documents, and academic reference books.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-3.5 border-t border-border/50 flex items-center justify-between text-xs font-bold">
                  <span className={selectedChoice === 'books' ? 'text-primary' : 'text-muted-foreground'}>
                    {selectedChoice === 'books' ? '✓ Selected' : 'Click to select Books'}
                  </span>
                  <span className="text-muted-foreground text-[11px]">Full Documents</span>
                </div>
              </div>

              {/* CHOICE 2: CHAPTER STUDY NOTES */}
              <div
                onClick={() => setSelectedChoice('notes')}
                className={`group relative p-6 sm:p-7 rounded-3xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  selectedChoice === 'notes'
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg ring-2 ring-amber-500/30 scale-[1.01]'
                    : 'border-border/70 bg-card hover:border-amber-500/40 hover:bg-muted/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        selectedChoice === 'notes'
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <FileText className="h-7 w-7" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        className={`rounded-full text-xs px-2.5 py-0.5 font-bold ${
                          selectedChoice === 'notes'
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-none'
                            : 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                        }`}
                      >
                        {notesCount} Available
                      </Badge>

                      {/* Custom Radio Circle */}
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedChoice === 'notes'
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {selectedChoice === 'notes' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                      Chapter Study Notes
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      Separated chapter-by-chapter guides with smart definitions, worked examples & chapter recall exams.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-3.5 border-t border-border/50 flex items-center justify-between text-xs font-bold">
                  <span className={selectedChoice === 'notes' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                    {selectedChoice === 'notes' ? '✓ Selected' : 'Click to select Notes'}
                  </span>
                  <span className="text-muted-foreground text-[11px]">Chapter by Chapter</span>
                </div>
              </div>
            </div>

            {/* NEXT BUTTON */}
            <div className="pt-4 flex flex-col items-center justify-center gap-4">
              <Button
                type="button"
                size="lg"
                onClick={handleProceedNext}
                className="w-full sm:w-auto min-w-[240px] h-12 rounded-2xl font-bold text-base bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center gap-2.5 group transition-transform hover:scale-[1.02]"
              >
                <span>Next</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              {/* Direct Jump Links */}
              <div className="flex items-center justify-center gap-3 pt-1 text-xs text-muted-foreground flex-wrap">
                <span>Or jump directly to:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryMode('offline');
                    setIsChoiceConfirmed(true);
                  }}
                  className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  Offline Saved ({offlineRecords.length})
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryMode('bookmarks');
                    setIsChoiceConfirmed(true);
                  }}
                  className="text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Bookmarks ({bookmarkedIds.length})
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 2: CONFIRMED VIEW (USER SEES EITHER BOOKS OR NOTES)                  */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Top Toolbar: Switch Option, Mode Pills & Department Filter */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-3xl border bg-card/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Back to Choice button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsChoiceConfirmed(false);
                    setSelectedNotesSubjectId(null);
                  }}
                  className="rounded-xl text-xs h-8 gap-1.5 font-bold hover:bg-muted"
                  title="Switch between Books and Notes"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  <span>Change: Books / Notes</span>
                </Button>

                {/* Mode Selector Pills */}
                <Button
                  variant={primaryMode === 'books' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setPrimaryMode('books');
                    setSelectedNotesSubjectId(null);
                  }}
                  className="rounded-xl text-xs h-8"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1" />
                  Books ({textbooksCount})
                </Button>

                <Button
                  variant={primaryMode === 'notes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrimaryMode('notes')}
                  className="rounded-xl text-xs h-8"
                >
                  <FileText className="h-3.5 w-3.5 mr-1 text-amber-500" />
                  Notes ({notesCount})
                </Button>

                <Button
                  variant={primaryMode === 'bookmarks' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrimaryMode('bookmarks')}
                  className="rounded-xl text-xs h-8"
                >
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  Bookmarks ({bookmarkedIds.length})
                </Button>

                <Button
                  variant={primaryMode === 'offline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrimaryMode('offline')}
                  className="rounded-xl text-xs h-8 text-emerald-600 dark:text-emerald-400"
                >
                  <HardDrive className="h-3.5 w-3.5 mr-1" />
                  Offline ({offlineRecords.length})
                </Button>
              </div>

              {/* Department Filter */}
              <div className="w-full sm:w-auto">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-full sm:w-[170px] rounded-xl text-xs h-8 bg-card">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* OFFLINE STORAGE BAR (in offline mode) */}
            {primaryMode === 'offline' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      Offline Storage ({storageStats.count} {storageStats.count === 1 ? 'item' : 'items'} • {storageStats.formattedSize})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Downloaded to this device for full reading without internet connection.
                    </p>
                  </div>
                </div>

                {storageStats.count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearOfflineStorage}
                    className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0 rounded-xl"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear Offline Storage
                  </Button>
                )}
              </div>
            )}

            {/* VIEW CONTENT */}
            {primaryMode === 'books' ? (
              /* --------------------------------------------------------------------- */
              /* BOOKS VIEW: DIRECTLY AVAILABLE BOOKS                                  */
              /* --------------------------------------------------------------------- */
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search books by title, author, or keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl bg-card text-sm h-9"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="w-full sm:w-[170px] rounded-xl text-xs h-9 bg-card">
                        <SelectValue placeholder="All Subjects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {subjects.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredBooksList.length === 0 ? (
                  <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                    <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-bold font-display">No books found</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                      No textbooks match your current search and department filters.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSubject('all');
                        setSelectedDept('all');
                      }}
                      className="rounded-xl text-xs"
                    >
                      Reset Filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredBooksList.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        isBookmarked={bookmarkedIds.includes(book.id)}
                        onToggleBookmark={handleToggleBookmark}
                        isSavedOffline={offlineBookIds.has(book.id)}
                        onSaveOffline={handleSaveBookOffline}
                        isDownloadingOffline={downloadingBookId === book.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : primaryMode === 'notes' ? (
              /* --------------------------------------------------------------------- */
              /* NOTES VIEW: SUBJECTS (LEVEL 1) -> CHAPTERS (LEVEL 2)                  */
              /* --------------------------------------------------------------------- */
              <div className="space-y-6">
                {!selectedNotesSubjectId ? (
                  /* LEVEL 1: AVAILABLE SUBJECTS WITH NOTES */
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-display font-bold text-foreground">
                          Available Subjects with Study Notes
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Select a subject below to browse its separated, chapter-by-chapter notes and chapter practice exams.
                        </p>
                      </div>

                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search subjects..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-xl bg-card text-xs h-9"
                        />
                      </div>
                    </div>

                    {subjectsWithNotes.length === 0 ? (
                      <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                        <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-bold font-display">No subjects found</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                          No subjects match your current search and department filters.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedDept('all');
                          }}
                          className="rounded-xl text-xs"
                        >
                          Reset Filters
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {subjectsWithNotes.map((subject) => {
                          const theme = getSubjectVisualTheme(subject.name);
                          const dept = departments.find(
                            (d) => d.id === subject.departmentId || subject.departmentIds?.includes(d.id)
                          );

                          return (
                            <div
                              key={subject.id}
                              onClick={() => setSelectedNotesSubjectId(subject.id)}
                              className="group relative p-6 rounded-3xl border bg-card hover:border-amber-500/50 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                              <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-3xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                                    {theme.emoji}
                                  </div>
                                  <Badge
                                    variant={subject.notesCount > 0 ? 'default' : 'outline'}
                                    className={`rounded-xl text-xs font-bold px-2.5 py-1 ${
                                      subject.notesCount > 0
                                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {subject.notesCount} {subject.notesCount === 1 ? 'Chapter' : 'Chapters'}
                                  </Badge>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    {dept?.name || 'Academic Curriculum'}
                                  </div>
                                  <h3 className="text-xl font-display font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-0.5">
                                    {subject.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {subject.description || `Comprehensive study notes and practice exams for ${subject.name}.`}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                                  <span>~{subject.totalMinutes || 15} min study time</span>
                                </span>
                                <span className="text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                  <span>Choose Chapters</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* LEVEL 2: AVAILABLE CHAPTERS FOR SELECTED SUBJECT */
                  <div className="space-y-6">
                    {/* Back button and Subject Header Banner */}
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedNotesSubjectId(null);
                          setSearchQuery('');
                        }}
                        className="rounded-xl text-muted-foreground hover:text-foreground -ml-2"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back to All Subjects
                      </Button>

                      <div className="p-6 sm:p-8 rounded-3xl border bg-gradient-to-r from-card via-card to-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-3xl flex items-center justify-center shrink-0">
                            {getSubjectVisualTheme(currentNotesSubject?.name || '').emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                                {currentNotesSubject?.name}
                              </h2>
                              <Badge className="bg-amber-500 text-white font-bold text-xs rounded-lg px-2.5">
                                {currentSubjectChapterNotes.length} {currentSubjectChapterNotes.length === 1 ? 'Chapter' : 'Chapters'}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              Pedagogical chapter-by-chapter study notes, key definitions, worked solutions & recall practice exams.
                            </p>
                          </div>
                        </div>

                        <div className="relative w-full sm:w-64 shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search chapters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 rounded-xl bg-card text-xs h-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chapters Grid / List */}
                    {currentSubjectChapterNotes.length === 0 ? (
                      <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-bold font-display">No chapter notes available yet</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                          Study notes for {currentNotesSubject?.name || 'this subject'} are being prepared by the academic team.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedNotesSubjectId(null)}
                          className="rounded-xl text-xs"
                        >
                          Browse Other Subjects
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {currentSubjectChapterNotes.map((note, idx) => {
                          const chNum = note.chapterNumber ?? idx + 1;
                          const chTitle = note.chapterTitle || note.title;
                          const mins = note.readingTimeMinutes || 12;
                          const matchedExam = findExamForNote(note);

                          return (
                            <Card
                              key={note.id}
                              className="rounded-3xl border hover:border-amber-500/50 transition-all duration-200 hover:shadow-md bg-card flex flex-col justify-between overflow-hidden group"
                            >
                              <div className="p-5 sm:p-6 space-y-3.5">
                                {/* Top row: Chapter Badge & Reading Time */}
                                <div className="flex items-center justify-between gap-2">
                                  <Badge className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg shadow-xs">
                                    Chapter {chNum}
                                  </Badge>

                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                                    <span>{mins} min read</span>
                                  </div>
                                </div>

                                {/* Chapter Title */}
                                <div>
                                  <h3 className="text-lg sm:text-xl font-display font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                                    {chTitle}
                                  </h3>
                                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                                    {note.summary || note.description || 'Comprehensive textbook-quality study guide with step-by-step teaching depth.'}
                                  </p>
                                </div>

                                {/* Section metrics */}
                                <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-muted-foreground">
                                  {note.sections && note.sections.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-muted font-medium">
                                      {note.sections.length} Topics
                                    </span>
                                  )}
                                  {note.keyTerms && note.keyTerms.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-muted font-medium">
                                      {note.keyTerms.length} Definitions
                                    </span>
                                  )}
                                  {note.learningOutcomes && note.learningOutcomes.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-muted font-medium">
                                      {note.learningOutcomes.length} Outcomes
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action Footer */}
                              <div className="p-4 sm:p-5 pt-0 mt-auto border-t bg-muted/20 flex flex-col gap-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
                                  {/* 1. Read Study Note */}
                                  <Button
                                    onClick={() => navigate(`/dashboard/books/${note.id}/read`)}
                                    className="h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 hover:bg-primary/90"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                    <span>Read Study Notes</span>
                                  </Button>

                                  {/* 2. Take Chapter Exam */}
                                  {matchedExam ? (
                                    <Button
                                      onClick={() => navigate(`/exam/${matchedExam.examId}`)}
                                      className="h-10 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-700 hover:via-orange-700 hover:to-amber-700 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.02]"
                                    >
                                      <GraduationCap className="h-4 w-4" />
                                      <span>Take Chapter Exam</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      disabled
                                      className="h-10 rounded-xl text-xs sm:text-sm font-medium text-muted-foreground border-dashed flex items-center justify-center gap-1.5 opacity-60"
                                    >
                                      <GraduationCap className="h-4 w-4" />
                                      <span>Exam Coming Soon</span>
                                    </Button>
                                  )}
                                </div>

                                {/* Bookmark & Offline Download */}
                                <div className="flex items-center justify-between pt-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleBookmark(note.id)}
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground px-2 rounded-lg"
                                  >
                                    <Bookmark
                                      className={`h-3.5 w-3.5 mr-1.5 ${
                                        bookmarkedIds.includes(note.id) ? 'fill-primary text-primary' : ''
                                      }`}
                                    />
                                    <span>{bookmarkedIds.includes(note.id) ? 'Saved' : 'Bookmark'}</span>
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveBookOffline(note)}
                                    disabled={downloadingBookId === note.id}
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground px-2 rounded-lg"
                                  >
                                    {downloadingBookId === note.id ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : offlineBookIds.has(note.id) ? (
                                      <>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Available Offline</span>
                                      </>
                                    ) : (
                                      <>
                                        <HardDrive className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                        <span>Save Offline</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* --------------------------------------------------------------------- */
              /* BOOKMARKS OR OFFLINE SAVED ITEMS                                      */
              /* --------------------------------------------------------------------- */
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold font-display text-foreground">
                    {primaryMode === 'bookmarks' ? 'Your Saved Bookmarks' : 'Offline Downloaded Items'}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {filteredBooksList.length} {filteredBooksList.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                {filteredBooksList.length === 0 ? (
                  <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                    <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-bold font-display">
                      {primaryMode === 'bookmarks' ? 'No bookmarks yet' : 'No offline items downloaded'}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                      {primaryMode === 'bookmarks'
                        ? 'Click the bookmark icon on any textbook or chapter note to keep it here for quick access.'
                        : 'Click "Save Offline" on any textbook or chapter note to read it without internet.'}
                    </p>
                    <Button
                      onClick={() => setPrimaryMode('books')}
                      className="rounded-xl text-xs"
                    >
                      Browse Available Books
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredBooksList.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        isBookmarked={bookmarkedIds.includes(book.id)}
                        onToggleBookmark={handleToggleBookmark}
                        isSavedOffline={offlineBookIds.has(book.id)}
                        onSaveOffline={handleSaveBookOffline}
                        isDownloadingOffline={downloadingBookId === book.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

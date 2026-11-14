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
import { getSubjects, getChapters } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import { Department, Exam } from '@/integrations/firebase/types';
import { Subject, Chapter } from '@/types/subject';
import { BookCard } from '@/components/book/BookCard';
import { getPublishedExams } from '@/lib/firebase-exams';
import { getSubjectVisualTheme } from '@/components/book/InteractiveShortNoteReader';
import { getCachedDefaultDepartmentId } from '@/lib/system-settings';
import { buildDriveViewUrl, extractDriveFileId } from '@/lib/google-drive';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Lock,
  Compass,
  Ruler,
  ChevronRight,
  Eye,
  ExternalLink,
} from 'lucide-react';

export default function StudentBooks() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const isAdmin = role === 'admin' || role === 'superadmin';
  const defaultDeptId = getCachedDefaultDepartmentId();
  const userDeptId = profile?.departmentId || (profile as any)?.department_id || defaultDeptId;

  const [books, setBooks] = useState<Book[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickSummaryNote, setQuickSummaryNote] = useState<Book | null>(null);

  // Offline state
  const [offlineRecords, setOfflineRecords] = useState<OfflineBookRecord[]>([]);
  const [storageStats, setStorageStats] = useState({ totalBytes: 0, formattedSize: '0 B', count: 0 });
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Primary mode: 'notes' | 'books' | 'bookmarks' | 'offline' (Notes comes first)
  const initialMode = useMemo(() => {
    const tabParam = searchParams.get('tab');
    const typeParam = searchParams.get('type');
    if (tabParam === 'offline') return 'offline';
    if (tabParam === 'bookmarks') return 'bookmarks';
    if (typeParam === 'books' || tabParam === 'books' || tabParam === 'textbook') return 'books';
    return 'notes';
  }, [searchParams]);

  const [primaryMode, setPrimaryMode] = useState<'books' | 'notes' | 'bookmarks' | 'offline'>(initialMode);
  const [notesViewMode, setNotesViewMode] = useState<'by_subject' | 'all_notes'>('by_subject');
  // Selected notes subject is driven by the URL (?subjectId=) so the back
  // control can reliably return to the page the student came from.
  const selectedNotesSubjectId = searchParams.get('subjectId');

  const setSelectedNotesSubjectId = (id: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) {
          next.set('subjectId', id);
        } else {
          next.delete('subjectId');
        }
        return next;
      },
      // Opening a subject pushes a history entry (so Back returns here);
      // clearing it replaces the current entry to avoid history clutter.
      { replace: id === null }
    );
  };

  // Curriculum chapters for the selected notes subject
  const [subjectCurriculumChapters, setSubjectCurriculumChapters] = useState<Chapter[]>([]);
  const [loadingCurriculumChapters, setLoadingCurriculumChapters] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedNotesSubjectId) {
      setSubjectCurriculumChapters([]);
      return;
    }
    let active = true;
    setLoadingCurriculumChapters(true);
    getChapters(selectedNotesSubjectId)
      .then((chs) => {
        if (active) setSubjectCurriculumChapters(chs);
      })
      .catch((err) => {
        console.warn('Could not load curriculum chapters:', err);
      })
      .finally(() => {
        if (active) setLoadingCurriculumChapters(false);
      });
    return () => {
      active = false;
    };
  }, [selectedNotesSubjectId]);

  // Has the user confirmed their choice by tapping a resource tile?
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
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (userDeptId && userDeptId !== 'all') {
      return userDeptId;
    }
    return 'all';
  });
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

    // Listen for global manual refresh button clicks
    const handleManualRefresh = () => {
      fetchLibraryData();
      loadOfflineData();
    };
    window.addEventListener('exampro-manual-refresh', handleManualRefresh);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('exampro-manual-refresh', handleManualRefresh);
    };
  }, []);

  useEffect(() => {
    fetchLibraryData();
    loadOfflineData();
  }, [user?.uid, userDeptId]);

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
      const [booksData, deptsData, rawSubsData, bookmarksData, examsData] = await Promise.all([
        getBooks({}, 'student'),
        getDepartments().catch(() => []),
        getSubjects().catch(() => []),
        user ? getUserBookBookmarks(user.uid).catch(() => []) : Promise.resolve([]),
        getPublishedExams().catch(() => []),
      ]);

      const subsData = rawSubsData;

      // Enrich books with dept & subject names and cover images
      const enriched = booksData.map((b) => {
        const dept = deptsData.find((d) => d.id === b.departmentId);
        const sub = rawSubsData.find((s) => s.id === b.subjectId);
        const isShortNote = b.resourceType === 'short_note';
        const effectiveCoverUrl =
          b.coverImageUrl ||
          (isShortNote ? sub?.notesCoverImageUrl : sub?.bookCoverImageUrl) ||
          sub?.coverImageUrl ||
          (sub ? getSubjectCover(sub.name || '').url : '');

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

  // Helper to test if a subject belongs to a department
  const isSubjectInDepartment = (sub: Subject, deptId: string) => {
    if (!deptId || deptId === 'all') return true;
    if (sub.departmentIds && sub.departmentIds.length > 0) {
      return sub.departmentIds.includes(deptId) || sub.departmentIds.includes('all');
    }
    return (sub as any).departmentId === deptId || (sub as any).departmentId === 'all';
  };

  // Active department filter: students can browse by selected department or All Departments
  const effectiveDeptId = selectedDept;

  // Counts
  const textbooksCount = useMemo(() => {
    return books.filter((b) => {
      if (b.resourceType !== 'textbook') return false;
      if (effectiveDeptId !== 'all') {
        const matchesDept =
          !b.departmentId ||
          b.departmentId === 'all' ||
          b.departmentId === effectiveDeptId ||
          (Array.isArray(b.departmentIds) && (b.departmentIds.includes(effectiveDeptId) || b.departmentIds.includes('all')));
        if (!matchesDept) return false;
      }
      return true;
    }).length;
  }, [books, effectiveDeptId]);

  const notesCount = useMemo(() => {
    return books.filter((b) => {
      if (b.resourceType !== 'short_note') return false;
      if (effectiveDeptId !== 'all') {
        const matchesDept =
          !b.departmentId ||
          b.departmentId === 'all' ||
          b.departmentId === effectiveDeptId ||
          (Array.isArray(b.departmentIds) && (b.departmentIds.includes(effectiveDeptId) || b.departmentIds.includes('all')));
        if (!matchesDept) return false;
      }
      return true;
    }).length;
  }, [books, effectiveDeptId]);

  // Filtered source list depending on primaryMode
  const filteredBooksList = useMemo(() => {
    const sourceList =
      primaryMode === 'offline'
        ? offlineRecords.map((r) => {
            const sub = subjects.find((s) => s.id === r.book.subjectId);
            const effectiveCoverUrl =
              r.book.coverImageUrl ||
              sub?.coverImageUrl ||
              (sub ? getSubjectCover(sub.name || '').url : '');
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
      if (effectiveDeptId !== 'all') {
        const matchesDept =
          !b.departmentId ||
          b.departmentId === 'all' ||
          b.departmentId === effectiveDeptId ||
          (Array.isArray(b.departmentIds) && (b.departmentIds.includes(effectiveDeptId) || b.departmentIds.includes('all')));
        if (!matchesDept) return false;
      }

      // Subject filter
      if (selectedSubject !== 'all' && b.subjectId !== selectedSubject) return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (b.title || '').toLowerCase().includes(q);
        const authorMatch = (b.author || '').toLowerCase().includes(q);
        const subMatch = (b.subjectName || '').toLowerCase().includes(q);
        const descMatch = (b.description || '').toLowerCase().includes(q);
        const chapterMatch = (b.chapterTitle || '').toLowerCase().includes(q);
        return titleMatch || authorMatch || subMatch || descMatch || chapterMatch;
      }

      return true;
    });
  }, [books, offlineRecords, primaryMode, effectiveDeptId, selectedSubject, searchQuery, bookmarkedIds, subjects]);

  // Subjects that have notes, enriched with note counts and reading time
  const subjectsWithNotes = useMemo(() => {
    return subjects
      .filter((s) => {
        if (!isAdmin && s.isActive === false) return false;

        // Department filter
        if (effectiveDeptId !== 'all') {
          if (!isSubjectInDepartment(s, effectiveDeptId)) {
            return false;
          }
        }
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = (s.name || '').toLowerCase().includes(q);
          const descMatch = (s.description || '').toLowerCase().includes(q);
          const noteMatch = books.some(
            (b) =>
              b.resourceType === 'short_note' &&
              b.subjectId === s.id &&
              ((b.title || '').toLowerCase().includes(q) ||
                (b.chapterTitle || '').toLowerCase().includes(q) ||
                (b.description || '').toLowerCase().includes(q) ||
                (Array.isArray(b.chapterLabels) && b.chapterLabels.some((cl) => (cl || '').toLowerCase().includes(q))))
          );
          if (!nameMatch && !descMatch && !noteMatch) return false;
        }
        return true;
      })
      .map((s) => {
        const subjectNotes = books.filter(
          (b) =>
            b.resourceType === 'short_note' &&
            b.subjectId === s.id &&
            (role === 'admin' || b.status === 'published' || !b.status)
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
  }, [subjects, books, effectiveDeptId, searchQuery, isAdmin, role]);

  // Selected Subject details for Notes Level 2
  const currentNotesSubject = useMemo(
    () => subjects.find((s) => s.id === selectedNotesSubjectId),
    [subjects, selectedNotesSubjectId]
  );

  // Curriculum books for the selected notes subject (Level 2)
  const currentSubjectCurriculumBooks = useMemo(() => {
    if (!selectedNotesSubjectId) return [];
    return books.filter(
      (b) =>
        b.resourceType === 'textbook' &&
        b.subjectId === selectedNotesSubjectId &&
        (role === 'admin' || b.status === 'published' || !b.status)
    );
  }, [books, selectedNotesSubjectId, role]);

  // Chapter notes for the selected subject
  const currentSubjectChapterNotes = useMemo(() => {
    if (!selectedNotesSubjectId) return [];
    const list = books.filter(
      (b) =>
        b.resourceType === 'short_note' &&
        b.subjectId === selectedNotesSubjectId &&
        (role === 'admin' || b.status === 'published' || !b.status)
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
      const titleLower = (note.chapterTitle || '').toLowerCase();
      const byTitle = availableExams.find(
        (e) =>
          e.subjectId === note.subjectId &&
          (((e.title || '').toLowerCase().includes(titleLower)) ||
            (e.chapterTitle && (e.chapterTitle || '').toLowerCase().includes(titleLower)))
      );
      if (byTitle) return byTitle;
    }
    // Fallback: any exam under the same subject
    if (note.subjectId) {
      return availableExams.find((e) => e.subjectId === note.subjectId);
    }
    return undefined;
  };

  // Computed list of Chapter / Unit items matching the screenshot UI
  const displayUnits = useMemo(() => {
    if (!selectedNotesSubjectId) return [];

    // Map curriculum chapters with notes
    if (subjectCurriculumChapters.length > 0) {
      const sortedChapters = [...subjectCurriculumChapters].sort(
        (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0)
      );

      const mapped = sortedChapters.map((ch, idx) => {
        const unitNum = ch.chapterNumber ?? idx + 1;
        const note = currentSubjectChapterNotes.find(
          (n) =>
            n.chapterId === ch.id ||
            n.chapterNumber === unitNum ||
            (n.chapterTitle && ch.title && n.chapterTitle.toLowerCase().trim() === ch.title.toLowerCase().trim())
        );

        // All units with uploaded notes are open; locked only if note has not been uploaded yet
        const isLocked = !note;

        return {
          id: ch.id,
          unitNumber: unitNum,
          title: ch.title,
          note,
          isLocked,
          matchedExam: note ? findExamForNote(note) : undefined,
        };
      });

      // Include any notes that might not have a matching curriculum chapter in subcollection
      const extraNotes = currentSubjectChapterNotes.filter(
        (n) => !mapped.some((m) => m.note?.id === n.id)
      );
      extraNotes.forEach((n, idx) => {
        const unitNum = n.chapterNumber ?? mapped.length + idx + 1;
        mapped.push({
          id: n.id,
          unitNumber: unitNum,
          title: n.chapterTitle || n.title,
          note: n,
          isLocked: false,
          matchedExam: findExamForNote(n),
        });
      });

      return mapped.sort((a, b) => a.unitNumber - b.unitNumber);
    }

    // Fallback: If no curriculum chapters exist in subcollection, map directly from notes
    return currentSubjectChapterNotes.map((note, idx) => {
      const getNum = (n: Book) => {
        if (typeof n.chapterNumber === 'number') return n.chapterNumber;
        const match = (n.chapterTitle || n.title || '').match(/chapter\s*(\d+)|unit\s*(\d+)/i);
        if (match) return parseInt(match[1] || match[2], 10);
        return idx + 1;
      };
      const unitNum = getNum(note);
      const isLocked = Boolean(note.isPremium && role !== 'admin' && !profile?.isPremium);

      return {
        id: note.id,
        unitNumber: unitNum,
        title: note.chapterTitle || note.title,
        note,
        isLocked,
        matchedExam: findExamForNote(note),
      };
    }).sort((a, b) => a.unitNumber - b.unitNumber);
  }, [
    selectedNotesSubjectId,
    subjectCurriculumChapters,
    currentSubjectChapterNotes,
    role,
    profile,
    availableExams,
  ]);

  // Handler when the user taps a resource tile on the choice screen (enters directly)
  const handleEnter = (choice: 'books' | 'notes') => {
    setPrimaryMode(choice);
    setIsChoiceConfirmed(true);
    setSelectedNotesSubjectId(null);
  };

  // Back from a subject's chapter list — returns to the page the student came from.
  const handleBackFromChapters = () => {
    setSearchQuery('');
    const historyIdx =
      (window.history.state && (window.history.state as { idx?: number }).idx) || 0;
    if (historyIdx > 0) {
      navigate(-1);
    } else {
      setSelectedNotesSubjectId(null);
    }
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
          <div className="space-y-6 max-w-2xl mx-auto py-2">
            {/* Hero Selection Header */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-muted/50 text-muted-foreground border border-border/60">
                <Library className="h-3.5 w-3.5" />
                Academic Library
              </div>
              <h1 className="text-2xl sm:text-[28px] font-display font-bold text-foreground tracking-tight">
                What would you like to study?
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Pick a resource type to continue to your materials.
              </p>
            </div>

            {/* Horizontal Choice Tiles — tapping one enters it directly (no Next step) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* CHOICE 1: CHAPTER STUDY NOTES */}
              <button
                type="button"
                onClick={() => handleEnter('notes')}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 p-4 text-left text-white shadow-lg shadow-purple-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 sm:p-5"
              >
                <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 sm:h-11 sm:w-11">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="mt-3 font-display text-sm font-bold sm:text-base">
                  Chapter Study Notes
                </h2>
                <p className="mt-0.5 hidden text-xs leading-snug text-white/80 sm:block">
                  Chapter-by-chapter guides, definitions and worked examples.
                </p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-white/90">
                  <Layers className="h-3.5 w-3.5" />
                  {notesCount} available
                  <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>

              {/* CHOICE 2: BOOKS & TEXTBOOKS */}
              <button
                type="button"
                onClick={() => handleEnter('books')}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-left text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 sm:p-5"
              >
                <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 sm:h-11 sm:w-11">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="mt-3 font-display text-sm font-bold sm:text-base">
                  Books &amp; Textbooks
                </h2>
                <p className="mt-0.5 hidden text-xs leading-snug text-white/80 sm:block">
                  Complete textbooks, syllabus documents and references.
                </p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-white/90">
                  <Layers className="h-3.5 w-3.5" />
                  {textbooksCount} available
                  <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>

            {/* Direct Jump Links */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
              <span>Or jump to</span>
              <button
                type="button"
                onClick={() => {
                  setPrimaryMode('offline');
                  setIsChoiceConfirmed(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
              >
                <HardDrive className="h-3.5 w-3.5" />
                Offline Saved ({offlineRecords.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrimaryMode('bookmarks');
                  setIsChoiceConfirmed(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary hover:bg-primary/15 transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Bookmarks ({bookmarkedIds.length})
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 2: CONFIRMED VIEW (USER SEES EITHER BOOKS OR NOTES)                  */
          /* ========================================================================= */
          <div className="lg:space-y-6">
            {/* Top Toolbar: Switch Option, Mode Pills & Department Filter (hidden on mobile in the Notes view) */}
            <div className={cn("flex items-center justify-between gap-3 flex-wrap p-4 rounded-3xl border bg-card/60 backdrop-blur-xs mb-6 lg:mb-0", primaryMode === 'notes' && "hidden lg:flex")}>
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
                  title="Switch between Notes and Books"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  <span>Change: Notes / Books</span>
                </Button>

                {/* Mode Selector Pills (Notes comes first!) */}
                <Button
                  variant={primaryMode === 'notes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPrimaryMode('notes')}
                  className="rounded-xl text-xs h-8 font-semibold"
                >
                  <FileText className="h-3.5 w-3.5 mr-1 text-amber-500" />
                  Notes ({notesCount})
                </Button>

                <Button
                  variant={primaryMode === 'books' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setPrimaryMode('books');
                    setSelectedNotesSubjectId(null);
                  }}
                  className="rounded-xl text-xs h-8 font-semibold"
                >
                  <BookOpen className="h-3.5 w-3.5 mr-1 text-primary" />
                  Books ({textbooksCount})
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
                  <SelectTrigger className="w-full sm:w-[185px] rounded-xl text-xs h-8 bg-card">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.id === userDeptId ? '(My Dept)' : ''}
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
                    <h3 className="text-lg font-bold font-display">No textbooks found</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                      {notesCount > 0
                        ? `No textbooks found, but ${notesCount} chapter study note(s) are available in your library!`
                        : 'No textbooks match your current search and department filters.'}
                    </p>
                    {notesCount > 0 ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setPrimaryMode('notes')}
                        className="rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Browse Study Notes ({notesCount})
                      </Button>
                    ) : (
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
                    )}
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
                    {/* Sticky top bar — mobile shows only the search + view toggle; desktop keeps the header */}
                    <div className="sticky top-16 z-20 lg:static -mx-6 lg:mx-0 px-3 lg:px-0 py-2.5 lg:py-0 bg-background/90 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b border-border/60 lg:border-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 lg:gap-3">
                      {/* Heading — desktop only */}
                      <div className="hidden lg:block">
                        <h3 className="text-xl font-display font-bold text-foreground">
                          Chapter Study Notes
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Browse notes organized by subject and curriculum chapters, or view all uploaded notes directly.
                        </p>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 w-full lg:w-auto">
                        {/* Search — primary element on mobile */}
                        <div className="relative order-1 lg:order-2 w-full lg:w-64">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={
                              notesViewMode === 'by_subject'
                                ? 'Search subjects & topics...'
                                : 'Search notes by title or chapter...'
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rounded-xl bg-card text-sm h-10 lg:text-xs lg:h-9"
                          />
                        </div>

                        {/* View Mode Toggle: By Subject vs All Notes */}
                        <div className="order-2 lg:order-1 flex items-center rounded-xl bg-card border p-1 shadow-xs self-start lg:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => setNotesViewMode('by_subject')}
                            className={`px-3.5 lg:px-3 py-2 lg:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              notesViewMode === 'by_subject'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>By Subject</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotesViewMode('all_notes')}
                            className={`px-3.5 lg:px-3 py-2 lg:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              notesViewMode === 'all_notes'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>All Notes ({notesCount})</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {notesViewMode === 'all_notes' ? (
                      /* DIRECT ALL NOTES GRID (INSTANT VISIBILITY FOR RECENTLY SAVED NOTES) */
                      filteredBooksList.length === 0 ? (
                        <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-lg font-bold font-display">No study notes found</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                            {textbooksCount > 0
                              ? `No study notes found, but ${textbooksCount} curriculum book(s) are available in your library.`
                              : 'No study notes match your current search and department filters.'}
                          </p>
                          {textbooksCount > 0 ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setPrimaryMode('books')}
                              className="rounded-xl text-xs font-semibold"
                            >
                              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                              Browse Curriculum Books ({textbooksCount})
                            </Button>
                          ) : (
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
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 -mx-6 lg:mx-0">
                          {filteredBooksList.map((note) => (
                            <BookCard
                              key={note.id}
                              book={note}
                              isBookmarked={bookmarkedIds.includes(note.id)}
                              onToggleBookmark={handleToggleBookmark}
                              isSavedOffline={offlineBookIds.has(note.id)}
                              onSaveOffline={handleSaveBookOffline}
                              isDownloadingOffline={downloadingBookId === note.id}
                            />
                          ))}
                        </div>
                      )
                    ) : subjectsWithNotes.length === 0 ? (
                      <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                        <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-bold font-display">No study notes subjects found</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                          {textbooksCount > 0
                            ? `No study notes subjects found, but ${textbooksCount} curriculum textbook(s) are available.`
                            : 'No subjects match your current search and department filters.'}
                        </p>
                        {textbooksCount > 0 ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setPrimaryMode('books')}
                            className="rounded-xl text-xs font-semibold"
                          >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                            Browse Curriculum Books ({textbooksCount})
                          </Button>
                        ) : (
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
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 -mx-6 lg:mx-0">
                        {subjectsWithNotes.map((subject) => {
                          const theme = getSubjectVisualTheme(subject.name);
                          const dept = departments.find(
                            (d) => d.id === subject.departmentId || subject.departmentIds?.includes(d.id)
                          );
                          const coverUrl =
                            subject.notesCoverImageUrl ||
                            subject.coverImageUrl ||
                            (subject.name ? getSubjectCover(subject.name).url : '/placeholder.svg');

                          return (
                            <div
                              key={subject.id}
                              onClick={() => setSelectedNotesSubjectId(subject.id)}
                              className="group relative p-5 rounded-3xl border bg-card hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                              <div className="space-y-4">
                                {/* Book Cover Header */}
                                <div className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 border shadow-xs group-hover:shadow-md transition-shadow">
                                  <img
                                    src={coverUrl}
                                    alt={subject.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = getSubjectCover(subject?.name || '').url;
                                    }}
                                  />
                                  {/* Book spine simulation */}
                                  <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />
                                  <div className="absolute top-2.5 right-2.5">
                                    <Badge className="bg-purple-600/90 hover:bg-purple-600 text-white font-bold text-[11px] rounded-lg px-2.5 py-0.5 backdrop-blur-xs shadow-xs">
                                      {subject.notesCount} {subject.notesCount === 1 ? 'Chapter Ready' : 'Chapters Ready'}
                                    </Badge>
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                    {dept?.name || 'Academic Curriculum'}
                                  </div>
                                  <h3 className="text-xl font-display font-bold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mt-0.5">
                                    {subject.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {subject.description || `Comprehensive chapter-by-chapter study notes for ${subject.name}.`}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs font-semibold">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-purple-500" />
                                  <span>~{subject.totalMinutes || 15} min study time</span>
                                </span>
                                <span className="text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                  <span>Read Chapters</span>
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
                  <div className="space-y-4 lg:space-y-6 lg:max-w-3xl lg:mx-auto">
                    {/* Sticky header — mobile: compact back icon + subject + search; desktop: full header */}
                    {(() => {
                      const uploadedCount = displayUnits.filter((u) => Boolean(u.note)).length;
                      const totalUnits = Math.max(displayUnits.length, currentNotesSubject?.totalUnits || 0, 1);
                      const gradeText = currentNotesSubject?.description?.match(/Grade\s*\d+/i)?.[0] || 'Grade 9';
                      const subjectName = currentNotesSubject?.name || 'Subject';

                      return (
                        <div className="sticky top-16 z-20 lg:static -mx-6 lg:mx-0 px-3 lg:px-0 py-2.5 lg:py-0 bg-background/90 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b border-border/60 lg:border-0 space-y-2.5 lg:space-y-3">
                          {/* Mobile app bar: compact back icon + subject */}
                          <div className="flex items-center gap-2.5 lg:hidden">
                            <button
                              type="button"
                              aria-label="Back to the previous page"
                              onClick={handleBackFromChapters}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <h1 className="truncate font-display text-base font-bold leading-tight text-foreground">
                                {subjectName}
                              </h1>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {gradeText} · {uploadedCount} of {totalUnits} chapters
                              </p>
                            </div>
                          </div>

                          {/* Desktop header */}
                          <div className="hidden lg:block">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleBackFromChapters}
                              className="-ml-2 h-8 gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              Back to All Subjects
                            </Button>
                            <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                              {subjectName}
                            </h1>
                            <p className="mt-1 text-sm font-medium text-muted-foreground sm:text-base">
                              {gradeText} · {uploadedCount} of {totalUnits} chapters uploaded
                            </p>
                          </div>

                          {/* Search — always visible */}
                          <div className="relative w-full">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search chapters or topics..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="h-10 rounded-xl bg-card pl-10 text-sm lg:h-9 lg:text-xs"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Complete Curriculum Textbook Banner if available for this subject */}
                    {currentSubjectCurriculumBooks.length > 0 && (
                      <div className="-mx-6 lg:mx-0 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-indigo-500/10 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                Complete Textbook
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                                {currentSubjectCurriculumBooks.length} available
                              </Badge>
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-foreground line-clamp-1">
                              {currentSubjectCurriculumBooks[0].title}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {currentSubjectCurriculumBooks[0].author ? `By ${currentSubjectCurriculumBooks[0].author} · ` : ''}
                              Read the full curriculum textbook volume alongside these chapter unit guides.
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => navigate(`/dashboard/books/${currentSubjectCurriculumBooks[0].id}/read`)}
                          className="rounded-xl text-xs font-semibold h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Read Textbook
                        </Button>
                      </div>
                    )}

                    {/* Loading State */}
                    {loadingCurriculumChapters ? (
                      <div className="text-center py-20">
                        <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Loading curriculum chapters...</p>
                      </div>
                    ) : displayUnits.length === 0 ? (
                      <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
                        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-bold font-display">No chapters available yet</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                          Study notes for {currentNotesSubject?.name || 'this subject'} are currently being organized.
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
                      /* Vertical stack of chapter cards */
                      <div className="-mx-6 lg:mx-0 space-y-3">
                        {displayUnits
                          .filter((unit) => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.toLowerCase().trim();
                            return (
                              (unit.title || '').toLowerCase().includes(q) ||
                              `chapter ${unit.unitNumber}`.includes(q) ||
                              `unit ${unit.unitNumber}`.includes(q) ||
                              (unit.note?.summary || '').toLowerCase().includes(q) ||
                              (unit.note?.title || '').toLowerCase().includes(q)
                            );
                          })
                          .map((unit) => {
                            return (
                              <div
                                key={unit.id}
                                onClick={() => {
                                  if (unit.note) {
                                    navigate(`/dashboard/books/${unit.note.id}/read`);
                                  } else {
                                    toast({
                                      title: 'Study guide in preparation',
                                      description: `Study notes for Chapter ${unit.unitNumber}: "${unit.title}" will be uploaded soon.`,
                                    });
                                  }
                                }}
                                className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 cursor-pointer hover:border-purple-400 hover:shadow-md dark:border-border/70 dark:bg-card sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-3xl sm:p-5 ${
                                  !unit.note ? 'opacity-70 bg-muted/20' : ''
                                }`}
                              >
                                {/* Left Curved Purple Accent Ribbon */}
                                <div className="absolute left-0 top-3 bottom-3 w-1.5 sm:w-2 bg-[#7c3aed] rounded-r-full" />

                                {/* Squircle Icon + Title & Metadata */}
                                <div className="flex items-center gap-3.5 sm:gap-4 pl-2 min-w-0 flex-1">
                                  {/* Purple Squircle Icon Badge */}
                                  <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                                      unit.isLocked
                                        ? 'bg-[#8b5cf6] text-amber-300'
                                        : 'bg-[#7c3aed] text-white'
                                    }`}
                                  >
                                    {unit.isLocked ? (
                                      <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 drop-shadow-xs" />
                                    ) : (
                                      <Compass className="w-6 h-6 sm:w-6 sm:h-6 text-white stroke-[2]" />
                                    )}
                                  </div>

                                  {/* Title & Status */}
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-base sm:text-lg font-bold text-[#1e293b] dark:text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                                        Chapter {unit.unitNumber}: {unit.title}
                                      </h4>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                                      {unit.note ? (
                                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                          <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                                          <span>Converted guide</span>
                                          {unit.note.status === 'draft' && (
                                            <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                              Draft (Admin Preview)
                                            </span>
                                          )}
                                          {unit.note.readingTimeMinutes && (
                                            <span className="text-[11px] text-muted-foreground/80 ml-1.5">
                                              · {unit.note.readingTimeMinutes} min read
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 dark:text-amber-400 italic">
                                          Study guide in preparation
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Side: Drive Link, Summary Button, Exam Link & Right Chevron */}
                                <div className="flex flex-wrap items-center gap-1.5 pr-1 sm:shrink-0 sm:gap-2 sm:justify-end">
                                  {/* Direct Google Drive Link (Alternative: Zero-wait native viewing) */}
                                  {(() => {
                                    const driveId = unit.note?.driveFileId || (unit.note?.driveUrl ? extractDriveFileId(unit.note.driveUrl) : null);
                                    const driveLink = driveId ? buildDriveViewUrl(driveId) : unit.note?.driveUrl;
                                    if (!driveLink) return null;
                                    return (
                                      <a
                                        href={driveLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open directly in Google Drive in a new tab (Instant display)"
                                        className="h-8 px-2 sm:px-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 transition-all shadow-xs border border-blue-500/25"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Drive</span>
                                      </a>
                                    );
                                  })()}

                                  {/* Quick Chapter Summary (Alternative: Read notes text instantly) */}
                                  {unit.note && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickSummaryNote(unit.note);
                                      }}
                                      title="Read Chapter Summary & Key Concepts"
                                      className="h-8 px-2 sm:px-2.5 rounded-xl bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-all border border-border/80 shadow-xs"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                      <span className="hidden md:inline">Summary</span>
                                    </button>
                                  )}

                                  {unit.matchedExam && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/exam/${unit.matchedExam.examId}`);
                                      }}
                                      title="Practice Exam for this Chapter"
                                      className="h-8 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 text-xs font-bold flex items-center gap-1 transition-all"
                                    >
                                      <GraduationCap className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Exam</span>
                                    </button>
                                  )}

                                  <ChevronRight className="hidden sm:block w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                                </div>
                              </div>
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
        {/* Quick Chapter Summary Dialog (Instant Text Reading Alternative) */}
        <Dialog open={Boolean(quickSummaryNote)} onOpenChange={(open) => !open && setQuickSummaryNote(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-7">
            {quickSummaryNote && (() => {
              const driveId = quickSummaryNote.driveFileId || (quickSummaryNote.driveUrl ? extractDriveFileId(quickSummaryNote.driveUrl) : null);
              const driveLink = driveId ? buildDriveViewUrl(driveId) : quickSummaryNote.driveUrl;
              const matchedExam = findExamForNote(quickSummaryNote);

              return (
                <div className="space-y-5">
                  <DialogHeader className="space-y-2 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-purple-600 text-white font-bold text-[10px] rounded-lg">
                        Chapter {quickSummaryNote.chapterNumber || 'Guide'}
                      </Badge>
                      {quickSummaryNote.departmentName && (
                        <Badge variant="outline" className="text-[10px]">
                          {quickSummaryNote.departmentName}
                        </Badge>
                      )}
                      {quickSummaryNote.readingTimeMinutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-500" />
                          ~{quickSummaryNote.readingTimeMinutes} min read
                        </span>
                      )}
                    </div>

                    <DialogTitle className="text-xl sm:text-2xl font-bold font-display text-foreground">
                      {quickSummaryNote.chapterTitle || quickSummaryNote.title}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                      Study guide key concepts and direct document access options.
                    </DialogDescription>
                  </DialogHeader>

                  {/* Summary Body */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Chapter Key Summary
                    </h4>
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 text-sm leading-relaxed text-foreground whitespace-pre-line">
                      {quickSummaryNote.summary || quickSummaryNote.description || 'No written summary provided for this chapter yet.'}
                    </div>
                  </div>

                  {/* Interactive Sections Preview if available */}
                  {Array.isArray(quickSummaryNote.sections) && quickSummaryNote.sections.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Interactive Topics ({quickSummaryNote.sections.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {quickSummaryNote.sections.map((sec, idx) => (
                          <div key={sec.id || idx} className="p-2.5 rounded-xl border bg-card text-xs flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-medium truncate">{sec.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alternative Action Buttons */}
                  <div className="pt-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    {/* Alternative 1: Google Drive Direct Link */}
                    {driveLink && (
                      <a
                        href={driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in Google Drive (Instant)
                      </a>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Alternative 2: Open in App Reader */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setQuickSummaryNote(null);
                          navigate(`/dashboard/books/${quickSummaryNote.id}/read`);
                        }}
                        className="rounded-xl text-xs font-semibold h-9"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Open in App Reader
                      </Button>

                      {/* Alternative 3: Take Practice Exam */}
                      {matchedExam && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuickSummaryNote(null);
                            navigate(`/exam/${matchedExam.examId}`);
                          }}
                          className="rounded-xl text-xs font-semibold h-9 border-purple-500/30 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        >
                          <GraduationCap className="w-3.5 h-3.5 mr-1" />
                          Take Chapter Exam
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

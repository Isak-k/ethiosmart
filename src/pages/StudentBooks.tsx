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
import { Department } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';
import { BookCard } from '@/components/book/BookCard';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  HardDrive,
  WifiOff,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export default function StudentBooks() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const userDeptId = profile?.departmentId || (profile as any)?.department_id;

  const [books, setBooks] = useState<Book[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Offline state
  const [offlineRecords, setOfflineRecords] = useState<OfflineBookRecord[]>([]);
  const [storageStats, setStorageStats] = useState({ totalBytes: 0, formattedSize: '0 B', count: 0 });
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Filters & Tabs
  const initialTab = searchParams.get('tab') === 'offline' ? 'offline' : 'all';
  const [activeTab, setActiveTab] = useState<'all' | 'textbook' | 'short_note' | 'bookmarks' | 'offline'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setActiveTab('offline');
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
      const [booksData, deptsData, subsData, bookmarksData] = await Promise.all([
        getBooks({}, 'student'),
        getDepartments().catch(() => []),
        getSubjects().catch(() => []),
        user ? getUserBookBookmarks(user.uid).catch(() => []) : Promise.resolve([]),
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
    } catch (err: any) {
      console.warn('Error loading library resources from Firestore (possibly offline):', err);
      // If network fails, automatically switch to offline books tab if we have offline books
      const offlineList = await getAllOfflineBooks();
      if (offlineList.length > 0) {
        setOfflineRecords(offlineList);
        setActiveTab('offline');
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
        description: 'Please sign in to save books to your personal bookmarks.',
      });
      return;
    }

    try {
      const isNowBookmarked = await toggleBookBookmark(user.uid, bookId);
      if (isNowBookmarked) {
        setBookmarkedIds((prev) => [...prev, bookId]);
        toast({
          title: 'Saved to Bookmarks',
          description: 'Resource added to your personal library bookmarks.',
        });
      } else {
        setBookmarkedIds((prev) => prev.filter((id) => id !== bookId));
        toast({
          title: 'Bookmark Removed',
          description: 'Resource removed from your saved bookmarks.',
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
    if (!window.confirm('Are you sure you want to remove all offline books from this device?')) {
      return;
    }
    try {
      await clearAllOfflineBooks();
      toast({
        title: 'Offline Storage Cleared',
        description: 'All offline books have been removed from this device.',
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

  // Filtered books
  const filteredBooks = useMemo(() => {
    // If viewing offline tab, base list is the downloaded offline books (enriched with subject covers)
    const sourceList =
      activeTab === 'offline'
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
      // Tab Category
      if (activeTab === 'textbook' && b.resourceType !== 'textbook') return false;
      if (activeTab === 'short_note' && b.resourceType !== 'short_note') return false;
      if (activeTab === 'bookmarks' && !bookmarkedIds.includes(b.id)) return false;

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
        return titleMatch || authorMatch || subMatch || descMatch;
      }

      return true;
    });
  }, [books, offlineRecords, activeTab, selectedDept, selectedSubject, searchQuery, bookmarkedIds]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-16">
        {/* Offline Banner notice */}
        {!isOnline && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm font-medium">
            <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <span>You are currently offline. Showing your downloaded books saved for offline browsing.</span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              Offline Mode
            </Badge>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-background border border-primary/20 p-6 sm:p-10 shadow-sm">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Library className="h-3.5 w-3.5" />
              ExamPro Digital Library
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
              Curriculum Textbooks & Short Notes
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Browse official textbooks, study lecture handouts, and read resources online or save them to browse offline inside the app.
            </p>
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 dark:opacity-5 pointer-events-none flex items-center justify-center">
            <BookOpen className="w-80 h-80 text-primary" />
          </div>
        </div>

        {/* Filter and Category Tabs Section */}
        <div className="space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(val: any) => setActiveTab(val)}
            className="w-full space-y-4"
          >
            {/* Row 1: Dedicated Category Tabs (Horizontal Scroll on Mobile, Never Wraps into 2 Lines) */}
            <div className="overflow-x-auto pb-1 no-scrollbar border-b">
              <TabsList className="bg-muted/60 p-1 rounded-2xl inline-flex w-auto min-w-max mb-3">
                <TabsTrigger value="all" className="rounded-xl text-xs sm:text-sm font-medium px-4">
                  All ({books.length})
                </TabsTrigger>
                <TabsTrigger value="textbook" className="rounded-xl text-xs sm:text-sm font-medium px-3.5 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  Books ({books.filter((b) => b.resourceType === 'textbook').length})
                </TabsTrigger>
                <TabsTrigger value="short_note" className="rounded-xl text-xs sm:text-sm font-medium px-3.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                  Notes ({books.filter((b) => b.resourceType === 'short_note').length})
                </TabsTrigger>
                <TabsTrigger value="bookmarks" className="rounded-xl text-xs sm:text-sm font-medium px-3.5 flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" />
                  Bookmarks ({bookmarkedIds.length})
                </TabsTrigger>
                <TabsTrigger value="offline" className="rounded-xl text-xs sm:text-sm font-medium px-3.5 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <HardDrive className="h-3.5 w-3.5" />
                  Offline ({offlineRecords.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Row 2: Search Input & Department/Subject Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, author, keyword, or chapter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl bg-card text-sm"
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-full sm:w-[180px] rounded-xl text-xs h-9 bg-card">
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

            {/* Offline Storage Status Bar (when in offline tab) */}
            {activeTab === 'offline' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 mt-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      Offline Library ({storageStats.count} {storageStats.count === 1 ? 'book' : 'books'} • {storageStats.formattedSize})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Downloaded to this device. You can open and read these full textbooks and notes even when completely offline.
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
                    Clear Offline Books
                  </Button>
                )}
              </div>
            )}
          </Tabs>
        </div>

        {/* Resources Grid / State Displays */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading digital library resources...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-20 px-6 rounded-3xl border border-dashed bg-card/40">
            <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
              {activeTab === 'offline' ? (
                <HardDrive className="h-7 w-7 text-emerald-500" />
              ) : (
                <FolderOpen className="h-7 w-7" />
              )}
            </div>
            <h3 className="text-lg font-bold font-display">
              {activeTab === 'offline' ? 'No offline books downloaded yet' : 'No resources found'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4 leading-relaxed">
              {activeTab === 'offline'
                ? 'To read books offline without internet, click the "Offline" or "Save Offline" button on any textbook or short note.'
                : activeTab === 'bookmarks'
                ? 'You have not bookmarked any resources yet. Click the bookmark icon on any book to save it here for fast revision.'
                : 'No textbooks or short notes match your current search and department filters.'}
            </p>
            {activeTab === 'offline' ? (
              <Button
                onClick={() => setActiveTab('all')}
                className="rounded-xl text-xs"
              >
                Browse All Resources to Download
              </Button>
            ) : (selectedSubject !== 'all' || selectedDept !== 'all' || searchQuery.trim().length > 0) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSubject('all');
                  setSelectedDept('all');
                  setSearchQuery('');
                }}
                className="rounded-xl text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map((book) => (
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
    </DashboardLayout>
  );
}

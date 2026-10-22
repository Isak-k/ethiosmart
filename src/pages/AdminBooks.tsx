import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Book, BookInput, BookResourceType, BookStatus } from '@/types/book';
import { getBooks, createBook, updateBook, deleteBook } from '@/lib/books';
import { getDepartments } from '@/lib/departments';
import { getSubjects } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import { Department } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';
import { BookCard } from '@/components/book/BookCard';
import { BookFormDialog } from '@/components/book/BookFormDialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  BookOpen,
  FileText,
  Plus,
  Search,
  Filter,
  Sparkles,
  Layers,
  Building,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  Loader2,
  FolderOpen,
} from 'lucide-react';

export default function AdminBooks() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<BookResourceType | 'all'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<BookStatus | 'all'>('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksData, deptsData, subsData] = await Promise.all([
        getBooks({}, role),
        getDepartments(),
        getSubjects(),
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
    } catch (err: any) {
      console.error('Error fetching admin books data:', err);
      toast({
        title: 'Error loading resources',
        description: err.message || 'Could not load digital library resources.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      // Type
      if (selectedType !== 'all' && b.resourceType !== selectedType) return false;
      // Department
      if (selectedDept !== 'all' && b.departmentId !== selectedDept) return false;
      // Subject
      if (selectedSubject !== 'all' && b.subjectId !== selectedSubject) return false;
      // Status
      if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
      // Search
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = b.title?.toLowerCase().includes(q);
        const authorMatch = b.author?.toLowerCase().includes(q);
        const subMatch = b.subjectName?.toLowerCase().includes(q);
        const deptMatch = b.departmentName?.toLowerCase().includes(q);
        return titleMatch || authorMatch || subMatch || deptMatch;
      }
      return true;
    });
  }, [books, selectedType, selectedDept, selectedSubject, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: books.length,
      textbooks: books.filter((b) => b.resourceType === 'textbook').length,
      shortNotes: books.filter((b) => b.resourceType === 'short_note').length,
      published: books.filter((b) => b.status === 'published').length,
      drafts: books.filter((b) => b.status === 'draft').length,
    };
  }, [books]);

  // Save book (create or update)
  const handleSaveBook = async (data: BookInput) => {
    if (!user) return;

    if (editingBook) {
      await updateBook(editingBook.id, data);
      toast({
        title: 'Resource updated',
        description: `"${data.title}" has been updated successfully.`,
      });
    } else {
      await createBook(data, user.uid);
      toast({
        title: 'Resource created',
        description: `"${data.title}" has been added to the Digital Library.`,
      });
    }

    setEditingBook(null);
    fetchData();
  };

  // Delete book
  const handleConfirmDelete = async () => {
    if (!bookToDelete) return;
    setDeleting(true);
    try {
      await deleteBook(bookToDelete.id);
      toast({
        title: 'Resource deleted',
        description: `"${bookToDelete.title}" has been removed from the library.`,
      });
      setDeleteDialogOpen(false);
      setBookToDelete(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Failed to delete resource',
        description: err.message || 'Permission denied or network error.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Quick toggle status
  const handleToggleStatus = async (book: Book) => {
    const nextStatus: BookStatus = book.status === 'published' ? 'draft' : 'published';
    try {
      await updateBook(book.id, { status: nextStatus });
      toast({
        title: nextStatus === 'published' ? 'Resource Published' : 'Resource Unpublished',
        description: `"${book.title}" is now ${nextStatus === 'published' ? 'visible to students' : 'saved as draft'}.`,
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: 'Failed to update status',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Launch AI generator from book
  const handleGenerateAI = (book: Book) => {
    navigate(
      `/dashboard/admin/ai-generator?source=book&bookId=${book.id}&deptId=${book.departmentId}&subjectId=${book.subjectId}`
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                Digital Book Library
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage curriculum textbooks, lecture short notes, and generate exams directly from Google Drive resources.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/admin/shortnotes/create')}
              className="rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-semibold"
            >
              <FileText className="w-4 h-4 mr-2" />
              Chapter Shortnotes Studio
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/admin/ai-generator')}
              className="rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Exam Generator
            </Button>

            <Button
              onClick={() => {
                setEditingBook(null);
                setDialogOpen(true);
              }}
              className="rounded-xl bg-primary shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </div>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border bg-card/50 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Books</p>
                <p className="text-xl sm:text-2xl font-bold font-display">{stats.textbooks}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card/50 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Notes</p>
                <p className="text-xl sm:text-2xl font-bold font-display">{stats.shortNotes}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card/50 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Published</p>
                <p className="text-xl sm:text-2xl font-bold font-display">{stats.published}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card/50 shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Drafts</p>
                <p className="text-xl sm:text-2xl font-bold font-display">{stats.drafts}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="rounded-2xl border bg-card shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, author, or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl text-sm"
                />
              </div>

              {/* Type Filter */}
              <div>
                <Select
                  value={selectedType}
                  onValueChange={(val: any) => setSelectedType(val)}
                >
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    <SelectItem value="textbook">📖 Books</SelectItem>
                    <SelectItem value="short_note">📝 Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <div>
                <Select
                  value={selectedDept}
                  onValueChange={(val) => {
                    setSelectedDept(val);
                    setSelectedSubject('all');
                  }}
                >
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Department" />
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

              {/* Status Filter */}
              <div>
                <Select
                  value={selectedStatus}
                  onValueChange={(val: any) => setSelectedStatus(val)}
                >
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Drafts</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters count */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
              <span>
                Showing <strong className="text-foreground">{filteredBooks.length}</strong> of{' '}
                {books.length} resources
              </span>

              {(selectedType !== 'all' ||
                selectedDept !== 'all' ||
                selectedSubject !== 'all' ||
                selectedStatus !== 'all' ||
                searchQuery.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('all');
                    setSelectedDept('all');
                    setSelectedSubject('all');
                    setSelectedStatus('all');
                    setSearchQuery('');
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resources Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed bg-card/50">
            <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold font-display">No resources found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              {books.length === 0
                ? 'Your digital library is currently empty. Add your first textbook or short note.'
                : 'No resources match your active search and filter criteria.'}
            </p>
            <Button
              onClick={() => {
                setEditingBook(null);
                setDialogOpen(true);
              }}
              className="rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Resource
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isAdmin={true}
                onEdit={(b) => {
                  if (b.resourceType === 'short_note' && ((b.sections && b.sections.length > 0) || b.chapterId || b.content)) {
                    navigate(`/dashboard/admin/shortnotes/edit/${b.id}`);
                  } else {
                    setEditingBook(b);
                    setDialogOpen(true);
                  }
                }}
                onDelete={(b) => {
                  setBookToDelete(b);
                  setDeleteDialogOpen(true);
                }}
                onGenerateAI={handleGenerateAI}
              />
            ))}
          </div>
        )}

        {/* Create / Edit Dialog */}
        <BookFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingBook(null);
          }}
          book={editingBook}
          onSave={handleSaveBook}
          defaultDepartmentId={selectedDept !== 'all' ? selectedDept : undefined}
          defaultSubjectId={selectedSubject !== 'all' ? selectedSubject : undefined}
        />

        {/* Delete Confirmation Alert */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Library Resource?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently remove &quot;{bookToDelete?.title}&quot; from the ExamPro Digital Library?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-xl bg-destructive hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Resource
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

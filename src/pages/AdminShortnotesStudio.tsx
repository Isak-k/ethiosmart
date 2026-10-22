import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Book,
  BookInput,
  ShortNoteSection,
  KeyTerm,
} from '@/types/book';
import {
  createBook,
  getBook,
  updateBook,
} from '@/lib/books';
import { getDepartments } from '@/lib/departments';
import { getSubjects, getChapters } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import {
  organizeChapterNotesLocal,
  organizeChapterNotesWithAI,
  generateMarkdownFromSections,
} from '@/lib/shortnotes-organizer';
import { InteractiveShortNoteReader } from '@/components/book/InteractiveShortNoteReader';
import { Department, Exam } from '@/integrations/firebase/types';
import { Subject, Chapter } from '@/types/subject';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileText,
  Sparkles,
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
  Layers,
  GraduationCap,
  Clock,
  CheckCircle2,
  RefreshCw,
  Zap,
  ListPlus,
  Hash,
} from 'lucide-react';

export default function AdminShortnotesStudio() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editNoteId } = useParams<{ id?: string }>();
  const { toast } = useToast();

  // Query parameter defaults
  const paramDeptId = searchParams.get('departmentId') || '';
  const paramSubjectId = searchParams.get('subjectId') || '';
  const paramChapterId = searchParams.get('chapterId') || '';
  const paramChapterTitle = searchParams.get('chapterTitle') || '';

  // Core metadata state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form selections
  const [selectedDeptId, setSelectedDeptId] = useState<string>(paramDeptId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(paramSubjectId);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(paramChapterId);
  const [customChapterTitle, setCustomChapterTitle] = useState<string>(paramChapterTitle);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('ExamPro Academic Team');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [allowDownload, setAllowDownload] = useState<boolean>(true);

  // Raw notes input
  const [rawNotes, setRawNotes] = useState<string>('');
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeMode, setOrganizeMode] = useState<'idle' | 'local' | 'ai'>('idle');

  // Structured organized shortnote content
  const [summary, setSummary] = useState<string>('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [sections, setSections] = useState<ShortNoteSection[]>([]);
  const [keyTerms, setKeyTerms] = useState<KeyTerm[]>([]);

  // Studio tabs: 'input' | 'editor' | 'preview'
  const [activeTab, setActiveTab] = useState<'input' | 'editor' | 'preview'>('input');
  const [isSaving, setIsSaving] = useState(false);

  // Section collapse in editor
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Initial load
  useEffect(() => {
    async function initData() {
      setLoadingInitial(true);
      try {
        const [deptsData, subsData] = await Promise.all([
          getDepartments(),
          getSubjects(),
        ]);
        setDepartments(deptsData);
        setSubjects(subsData);

        // If editing an existing book/shortnote
        if (editNoteId) {
          const existing = await getBook(editNoteId);
          if (existing) {
            setNoteTitle(existing.title || '');
            setAuthorName(existing.author || 'ExamPro Academic Team');
            setSelectedDeptId(existing.departmentId || '');
            setSelectedSubjectId(existing.subjectId || '');
            setSelectedChapterId(existing.chapterId || '');
            setCustomChapterTitle(existing.chapterTitle || '');
            setStatus(existing.status || 'published');
            setSummary(existing.summary || existing.description || '');
            setKeyTakeaways(existing.keyTakeaways || []);
            setSections(existing.sections || []);
            setKeyTerms(existing.keyTerms || []);
            if (existing.content) {
              setRawNotes(existing.content);
            }
            if (existing.sections && existing.sections.length > 0) {
              setActiveTab('editor');
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load initial studio data:', err);
        toast({
          title: 'Error loading options',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoadingInitial(false);
      }
    }
    initData();
  }, [editNoteId]);

  // Load chapters when selected subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setChapters([]);
      return;
    }
    getChapters(selectedSubjectId)
      .then((data) => {
        setChapters(data);
        // If query param matched a chapter, keep it
        if (paramChapterId && data.some((c) => c.id === paramChapterId)) {
          setSelectedChapterId(paramChapterId);
        }
      })
      .catch((err) => console.error('Failed to load subject chapters:', err));
  }, [selectedSubjectId, paramChapterId]);

  // Filter subjects by selected department
  const filteredSubjects = useMemo(() => {
    if (!selectedDeptId || selectedDeptId === 'all') return subjects;
    return subjects.filter((s) => s.departmentIds?.includes(selectedDeptId));
  }, [subjects, selectedDeptId]);

  // Active Subject object
  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  // Active Chapter title
  const currentChapterTitle = useMemo(() => {
    if (selectedChapterId) {
      const ch = chapters.find((c) => c.id === selectedChapterId);
      if (ch) return ch.title;
    }
    return customChapterTitle;
  }, [chapters, selectedChapterId, customChapterTitle]);

  // Auto-generate title if empty
  useEffect(() => {
    if (!editNoteId && currentSubject && (currentChapterTitle || selectedChapterId)) {
      const ch = chapters.find((c) => c.id === selectedChapterId);
      const prefix = ch?.chapterNumber ? `Chapter ${ch.chapterNumber}: ` : '';
      const generated = `${currentSubject.name} - ${prefix}${currentChapterTitle || 'Shortnotes'}`;
      if (!noteTitle || noteTitle.includes('Shortnotes')) {
        setNoteTitle(generated);
      }
    }
  }, [currentSubject, selectedChapterId, currentChapterTitle, editNoteId]);

  // Organize raw notes (Instant heuristic parser)
  const handleOrganizeInstant = () => {
    if (!rawNotes.trim()) {
      toast({
        title: 'Notes cannot be empty',
        description: 'Please paste raw chapter notes before organizing.',
        variant: 'destructive',
      });
      return;
    }

    setIsOrganizing(true);
    setOrganizeMode('local');

    try {
      const result = organizeChapterNotesLocal(rawNotes, {
        chapterTitle: currentChapterTitle || noteTitle || 'Chapter Overview',
        subjectName: currentSubject?.name,
      });

      setSummary(result.summary);
      setKeyTakeaways(result.keyTakeaways);
      setSections(result.sections);
      setKeyTerms(result.keyTerms);

      toast({
        title: 'Notes Organized Successfully!',
        description: `Generated ${result.sections.length} interactive sections and ${result.keyTerms.length} glossary terms.`,
      });
      setActiveTab('editor');
    } catch (err: any) {
      toast({
        title: 'Failed to organize notes',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsOrganizing(false);
      setOrganizeMode('idle');
    }
  };

  // Organize raw notes (AI Gemini Smart parser)
  const handleOrganizeAI = async () => {
    if (!rawNotes.trim()) {
      toast({
        title: 'Notes cannot be empty',
        description: 'Please paste raw chapter notes before organizing.',
        variant: 'destructive',
      });
      return;
    }

    setIsOrganizing(true);
    setOrganizeMode('ai');

    try {
      const result = await organizeChapterNotesWithAI(rawNotes, {
        chapterTitle: currentChapterTitle || noteTitle || 'Chapter Overview',
        subjectName: currentSubject?.name,
      });

      setSummary(result.summary);
      setKeyTakeaways(result.keyTakeaways);
      setSections(result.sections);
      setKeyTerms(result.keyTerms);

      toast({
        title: 'AI Smart Organization Complete!',
        description: `Extracted ${result.sections.length} core sections, ${result.keyTakeaways.length} takeaways, and ${result.keyTerms.length} definitions.`,
      });
      setActiveTab('editor');
    } catch (err: any) {
      toast({
        title: 'AI Organization failed',
        description: err.message || 'Falling back to local organizer.',
        variant: 'destructive',
      });
      // Fallback
      handleOrganizeInstant();
    } finally {
      setIsOrganizing(false);
      setOrganizeMode('idle');
    }
  };

  // Load sample notes template for quick preview and testing
  const handleLoadSampleNotes = () => {
    const sample = `# Chapter 1: Fundamentals of Database Systems

1. Introduction to Databases and Database Management Systems (DBMS)
A database is an organized collection of structured information or data stored electronically in a computer system. A Database Management System (DBMS) is software designed to store, retrieve, define, and manage data efficiently.

Key Highlights:
- Data Independence: Separation of data structure from application programs.
- Concurrency Control: Multiple users can access data simultaneously without conflict.
- Fault Tolerance and Recovery: Automatic transaction rollback upon system failures.

2. Relational Database Concepts
Relational databases represent data in tables (relations) with rows (tuples) and columns (attributes).

Key Highlights:
- Primary Key: A candidate key chosen by the database designer to uniquely identify tuples in a relation.
- Foreign Key: An attribute in one table that references the primary key in another table, enforcing referential integrity.
- Candidate Key: A minimal superkey with no redundant attributes.

3. Normalization and Redundancy Reduction
Normalization is the formal process of decomposing tables to minimize data redundancy and eliminate anomalies.

Key Highlights:
- First Normal Form (1NF): Requires each column to contain atomic, indivisible values.
- Second Normal Form (2NF): Must be in 1NF and eliminate partial dependencies on candidate keys.
- Third Normal Form (3NF): Must be in 2NF and eliminate transitive dependencies.
- Boyce-Codd Normal Form (BCNF): Every determinant must be a candidate key.

Key Terms:
- Atomicity: The guarantee that a transaction is all-or-nothing.
- Referential Integrity: Rule stating that foreign keys must match a valid primary key.
- Normalization: Systematic approach of decomposing tables to eliminate redundancy.
- Schema: The formal structural design of the database.`;

    setRawNotes(sample);
    if (!noteTitle) {
      setNoteTitle('Computer Science - Chapter 1: Fundamentals of Database Systems');
    }
    toast({
      title: 'Sample Chapter Notes Loaded',
      description: 'Click "Organize (Instant)" or "AI Deep Organize" to convert into an interactive book!',
    });
  };

  // Editor Section Operations
  const toggleSectionCollapse = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateSection = (index: number, patch: Partial<ShortNoteSection>) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleDeleteSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    setSections((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleAddSection = () => {
    const newSec: ShortNoteSection = {
      id: `sec-${Date.now()}`,
      title: 'New Topic Section',
      content: 'Enter detailed explanation, formulas, or concepts here...',
      keyPoints: ['Key takeaway point 1'],
      isHighYield: false,
    };
    setSections((prev) => [...prev, newSec]);
  };

  // Takeaway operations
  const handleAddTakeaway = () => {
    setKeyTakeaways((prev) => [...prev, 'New essential exam takeaway point']);
  };

  const handleUpdateTakeaway = (index: number, value: string) => {
    setKeyTakeaways((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleDeleteTakeaway = (index: number) => {
    setKeyTakeaways((prev) => prev.filter((_, i) => i !== index));
  };

  // Term operations
  const handleAddTerm = () => {
    setKeyTerms((prev) => [
      ...prev,
      { term: 'Key Term', definition: 'Clear and concise academic definition.' },
    ]);
  };

  const handleUpdateTerm = (index: number, patch: Partial<KeyTerm>) => {
    setKeyTerms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleDeleteTerm = (index: number) => {
    setKeyTerms((prev) => prev.filter((_, i) => i !== index));
  };

  // Word count & estimated reading time
  const readingStats = useMemo(() => {
    const rawWordCount = (rawNotes || '').trim().split(/\s+/).filter(Boolean).length;
    const sectionWords = (sections || []).reduce((acc, s) => {
      const cWords = (s?.content || '').trim().split(/\s+/).filter(Boolean).length;
      const kWords = Array.isArray(s?.keyPoints)
        ? s.keyPoints.join(' ').trim().split(/\s+/).filter(Boolean).length
        : 0;
      return acc + cWords + kWords;
    }, 0);
    const totalWords = Math.max(rawWordCount, sectionWords);
    const readingMins = Math.max(1, Math.ceil(totalWords / 200));
    return { words: totalWords, minutes: readingMins };
  }, [rawNotes, sections]);

  // Save / Publish to Firestore
  const handleSaveAndPublish = async () => {
    if (!noteTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please provide a title for the chapter shortnote.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSubjectId) {
      toast({
        title: 'Subject required',
        description: 'Please select which subject this chapter belongs to.',
        variant: 'destructive',
      });
      return;
    }

    if (sections.length === 0 && !rawNotes.trim()) {
      toast({
        title: 'Content required',
        description: 'Please add sections or paste raw notes before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Find chapter number
      const ch = chapters.find((c) => c.id === selectedChapterId);
      const chNumber = ch?.chapterNumber;

      // Effective cover
      const effectiveCover = currentSubject
        ? currentSubject.coverImageUrl || getSubjectCover(currentSubject.name).url
        : '';

      // Generated markdown content
      const generatedMarkdown =
        sections.length > 0 ? generateMarkdownFromSections(sections) : rawNotes;

      const input: BookInput = {
        title: noteTitle.trim(),
        author: authorName.trim() || 'ExamPro Academic Team',
        description: summary || `High-yield interactive short notes for ${currentChapterTitle || noteTitle}.`,
        resourceType: 'short_note',
        driveFileId: '', // Direct interactive shortnote doesn't require Google Drive!
        departmentId: selectedDeptId && selectedDeptId !== 'all' ? selectedDeptId : (currentSubject?.departmentIds?.[0] || ''),
        subjectId: selectedSubjectId,
        coverImageUrl: effectiveCover,
        status: status,
        allowDownload: allowDownload,
        chapterId: selectedChapterId || undefined,
        chapterTitle: currentChapterTitle || undefined,
        chapterNumber: chNumber,
        content: generatedMarkdown,
        summary: summary.trim(),
        keyTakeaways: keyTakeaways.filter((t) => t.trim().length > 0),
        keyTerms: keyTerms.filter((t) => t.term.trim().length > 0),
        sections: sections,
        readingTimeMinutes: readingStats.minutes,
      };

      let savedId = editNoteId;
      if (editNoteId) {
        await updateBook(editNoteId, input);
        toast({
          title: 'Shortnotes Updated!',
          description: `"${noteTitle}" has been saved.`,
        });
      } else {
        if (!user) throw new Error('You must be logged in as an administrator.');
        savedId = await createBook(input, user.uid);
        toast({
          title: 'Shortnotes Published!',
          description: `"${noteTitle}" is now live for students.`,
        });
      }

      // Navigate to reader
      navigate(`/dashboard/books/${savedId}/read`);
    } catch (err: any) {
      console.error('Error saving shortnotes:', err);
      toast({
        title: 'Failed to save shortnotes',
        description: err.message || 'Please check your permissions or network connection.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Preview synthetic Book object
  const previewBook: Book = useMemo(() => {
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return {
      id: editNoteId || 'preview-temp-id',
      title: noteTitle || 'Chapter Shortnotes Preview',
      author: authorName || 'ExamPro Academic Team',
      description: summary || 'High-yield interactive short notes.',
      resourceType: 'short_note',
      driveUrl: '',
      driveFileId: '',
      departmentId: selectedDeptId,
      departmentName: departments.find((d) => d.id === selectedDeptId)?.name,
      subjectId: selectedSubjectId,
      subjectName: currentSubject?.name || 'Subject',
      coverImageUrl: currentSubject?.coverImageUrl || (currentSubject ? getSubjectCover(currentSubject.name).url : ''),
      status: status,
      allowDownload: allowDownload,
      language: 'English',
      viewCount: 0,
      downloadCount: 0,
      bookmarkCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      chapterId: selectedChapterId,
      chapterTitle: currentChapterTitle,
      chapterNumber: ch?.chapterNumber,
      content: rawNotes,
      summary: summary,
      keyTakeaways: keyTakeaways,
      keyTerms: keyTerms,
      sections: sections,
      readingTimeMinutes: readingStats.minutes,
    };
  }, [
    editNoteId,
    noteTitle,
    authorName,
    summary,
    selectedDeptId,
    departments,
    selectedSubjectId,
    currentSubject,
    status,
    allowDownload,
    selectedChapterId,
    chapters,
    currentChapterTitle,
    rawNotes,
    keyTakeaways,
    keyTerms,
    sections,
    readingStats.minutes,
  ]);

  if (loadingInitial) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-28 space-y-4">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Loading Chapter Shortnotes Studio...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/admin/books')}
              className="rounded-xl text-muted-foreground hover:text-foreground mb-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Digital Library
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  Chapter Shortnotes Studio
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Paste chapter notes, auto-format into interactive accordion sections, glossary, and publish.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Select
              value={status}
              onValueChange={(v: 'published' | 'draft') => setStatus(v)}
            >
              <SelectTrigger className="w-[125px] h-9 rounded-xl text-xs font-semibold">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="published">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Published
                  </span>
                </SelectItem>
                <SelectItem value="draft">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Draft
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleSaveAndPublish}
              disabled={isSaving}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs sm:text-sm h-9 px-4"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  {editNoteId ? 'Update Notes' : 'Publish Notes'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Chapter & Subject Target Selector Card */}
        <Card className="rounded-2xl border bg-card/60 shadow-xs backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
                <Select
                  value={selectedDeptId}
                  onValueChange={(val) => {
                    setSelectedDeptId(val);
                    setSelectedSubjectId('');
                    setSelectedChapterId('');
                  }}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={(val) => {
                    setSelectedSubjectId(val);
                    setSelectedChapterId('');
                  }}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue placeholder="Select Subject..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {filteredSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Chapter / Unit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Chapter / Unit
                </Label>
                {chapters.length > 0 ? (
                  <Select
                    value={selectedChapterId}
                    onValueChange={(val) => {
                      setSelectedChapterId(val);
                      const ch = chapters.find((c) => c.id === val);
                      if (ch) setCustomChapterTitle(ch.title);
                    }}
                  >
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue placeholder="Select Chapter..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {chapters.map((ch, idx) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          Ch {ch.chapterNumber ?? idx + 1}: {ch.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="e.g. Chapter 1: Introduction"
                    value={customChapterTitle}
                    onChange={(e) => setCustomChapterTitle(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                )}
              </div>
            </div>

            {/* Note Title & Author */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1 border-t">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Shortnote Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Psychology 101 - Chapter 1: Foundations of Psychology"
                  className="rounded-xl text-xs sm:text-sm font-medium h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Instructor / Author</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Prof. Anderson / ExamPro"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Studio Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-3 rounded-2xl p-1 bg-muted/60 h-11 max-w-md">
            <TabsTrigger value="input" className="rounded-xl text-xs font-semibold">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              1. Paste Notes
            </TabsTrigger>
            <TabsTrigger value="editor" className="rounded-xl text-xs font-semibold">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              2. Edit Sections ({sections.length})
            </TabsTrigger>
            <TabsTrigger value="preview" className="rounded-xl text-xs font-semibold">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              3. Student View
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PASTE & AUTO-ORGANIZE */}
          <TabsContent value="input" className="space-y-4 animate-fade-in">
            <Card className="rounded-3xl border border-amber-500/25 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60 bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      Paste Full Chapter Notes
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Paste raw lecture slides, textbook excerpts, or revision summaries. Our engine will structure them into accordion topics, takeaways, and flashcard terms.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLoadSampleNotes}
                      className="rounded-xl text-xs h-7 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                      <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                      Load Sample Notes
                    </Button>
                    <Badge variant="outline" className="font-mono text-[11px] border-amber-500/30">
                      {readingStats.words} words
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[11px] border-amber-500/30">
                      ~{readingStats.minutes} min read
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                <Textarea
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  placeholder={`Paste your chapter notes here...\n\nExample:\nChapter 1: Principles of Operating Systems\n\n1. What is an Operating System?\nAn operating system (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs.\n\nKey functions:\n- Resource allocation\n- Memory management\n- Process scheduling\n\n2. Process Scheduling\nThe process scheduler decides which process gets CPU time.\n- First-Come First-Served (FCFS)\n- Shortest Job Next (SJN)\n- Round Robin (RR)\n\nKey Terms:\n- Throughput: Number of processes completed per unit time.\n- Latency: Time taken to respond to an event.`}
                  className="min-h-[380px] rounded-2xl font-mono text-xs sm:text-sm p-4 leading-relaxed resize-y bg-background/80 border-amber-500/20 focus-visible:ring-amber-500"
                />

                {/* Organizer Action Triggers */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <p className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Auto-Structure into Interactive Academic Book
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Converts headings to expandable accordion sections, extracts bullet points, and builds the glossary.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOrganizeInstant}
                      disabled={isOrganizing || !rawNotes.trim()}
                      className="rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold h-9 flex-1 sm:flex-initial"
                    >
                      {isOrganizing && organizeMode === 'local' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                      )}
                      Organize (Instant)
                    </Button>

                    <Button
                      type="button"
                      onClick={handleOrganizeAI}
                      disabled={isOrganizing || !rawNotes.trim()}
                      className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-9 shadow-xs flex-1 sm:flex-initial"
                    >
                      {isOrganizing && organizeMode === 'ai' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      AI Smart Deep Organize
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: INTERACTIVE SECTIONS & GLOSSARY EDITOR */}
          <TabsContent value="editor" className="space-y-5 animate-fade-in">
            {/* Chapter Summary */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Executive Chapter Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="2-3 sentence high-level overview of the entire chapter..."
                  className="rounded-xl text-xs sm:text-sm min-h-[75px]"
                />
              </CardContent>
            </Card>

            {/* Key Takeaways */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Key Exam Takeaways
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Quick-review bullets displayed in the student reader banner.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTakeaway}
                  className="h-7 text-xs rounded-lg"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Takeaway
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {keyTakeaways.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No takeaways added yet. Click &quot;Add Takeaway&quot; or auto-organize from raw notes.
                  </p>
                ) : (
                  keyTakeaways.map((takeaway, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <Input
                        value={takeaway}
                        onChange={(e) => handleUpdateTakeaway(idx, e.target.value)}
                        className="rounded-xl text-xs h-8"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTakeaway(idx)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Interactive Sections List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-display flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Topic Accordion Sections ({sections.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Each section renders as an interactive toggleable button with key points and full explanation.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleAddSection}
                  className="rounded-xl text-xs h-8 bg-primary hover:bg-primary/90 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Topic Section
                </Button>
              </div>

              {sections.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed bg-card/40 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    No sections created yet. Paste raw notes in Tab 1 and click &quot;Organize Notes&quot; or add sections manually.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddSection}
                    className="rounded-xl text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add First Section
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((sec, idx) => {
                    const isCollapsed = collapsedSections.has(sec.id);
                    return (
                      <Card
                        key={sec.id}
                        className="rounded-2xl border shadow-xs overflow-hidden transition-all hover:border-primary/30"
                      >
                        {/* Section Header */}
                        <div className="p-3.5 bg-muted/30 flex items-center justify-between gap-2 border-b">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                              {sec.title || `Section ${idx + 1}`}
                            </span>
                            {sec.isHighYield && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold h-4">
                                High Yield
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveSection(idx, 'up')}
                              disabled={idx === 0}
                              className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
                              title="Move Up"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveSection(idx, 'down')}
                              disabled={idx === sections.length - 1}
                              className="h-7 w-7 p-0 rounded-lg text-muted-foreground"
                              title="Move Down"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSectionCollapse(sec.id)}
                              className="h-7 px-2 text-xs rounded-lg text-muted-foreground"
                            >
                              {isCollapsed ? 'Edit' : 'Collapse'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSection(idx)}
                              className="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                              title="Delete Section"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Collapsible Content Editor */}
                        {!isCollapsed && (
                          <CardContent className="p-4 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <div className="sm:col-span-3 space-y-1">
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Section Title
                                </Label>
                                <Input
                                  value={sec.title}
                                  onChange={(e) =>
                                    handleUpdateSection(idx, { title: e.target.value })
                                  }
                                  className="rounded-xl text-xs h-8 font-medium"
                                />
                              </div>

                              <div className="space-y-1 flex flex-col justify-end">
                                <Button
                                  type="button"
                                  variant={sec.isHighYield ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateSection(idx, { isHighYield: !sec.isHighYield })
                                  }
                                  className={`rounded-xl text-xs h-8 ${
                                    sec.isHighYield
                                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                      : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                                  {sec.isHighYield ? 'High Yield Focus' : 'Mark High Yield'}
                                </Button>
                              </div>
                            </div>

                            {/* Section Key Points (Bullets) */}
                            <div className="space-y-1.5 p-3 rounded-xl bg-muted/20 border">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                  <ListPlus className="h-3.5 w-3.5 text-primary" />
                                  Quick Highlights (Bullets)
                                </Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const nextPoints = [...(sec.keyPoints || []), 'New summary bullet point'];
                                    handleUpdateSection(idx, { keyPoints: nextPoints });
                                  }}
                                  className="h-6 px-2 text-[10px] rounded-md text-primary hover:bg-primary/10"
                                >
                                  <Plus className="h-3 w-3 mr-0.5" />
                                  Add Point
                                </Button>
                              </div>

                              <div className="space-y-1.5">
                                {(sec.keyPoints || []).map((point, pIdx) => (
                                  <div key={pIdx} className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground text-xs">•</span>
                                    <Input
                                      value={point}
                                      onChange={(e) => {
                                        const nextPoints = [...(sec.keyPoints || [])];
                                        nextPoints[pIdx] = e.target.value;
                                        handleUpdateSection(idx, { keyPoints: nextPoints });
                                      }}
                                      className="rounded-lg text-xs h-7"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const nextPoints = (sec.keyPoints || []).filter((_, i) => i !== pIdx);
                                        handleUpdateSection(idx, { keyPoints: nextPoints });
                                      }}
                                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Markdown Content */}
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold text-muted-foreground">
                                Detailed Academic Content (Supports Markdown & Lists)
                              </Label>
                              <Textarea
                                value={sec.content}
                                onChange={(e) =>
                                  handleUpdateSection(idx, { content: e.target.value })
                                }
                                rows={6}
                                className="rounded-xl text-xs sm:text-sm font-mono leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Glossary / Key Terms */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Chapter Glossary & Key Terminology ({keyTerms.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Terms searchable by students inside the interactive reader.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTerm}
                  className="h-7 text-xs rounded-lg border-purple-500/30 text-purple-600 dark:text-purple-400"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Term
                </Button>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-2.5">
                {keyTerms.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No terms in the glossary yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {keyTerms.map((term, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-3 rounded-xl border bg-muted/20 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Term #{tIdx + 1}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTerm(tIdx)}
                            className="h-5 w-5 p-0 rounded text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="e.g. Heuristic Evaluation"
                          value={term.term}
                          onChange={(e) => handleUpdateTerm(tIdx, { term: e.target.value })}
                          className="rounded-lg text-xs h-7 font-semibold"
                        />
                        <Textarea
                          placeholder="Definition..."
                          value={term.definition}
                          onChange={(e) => handleUpdateTerm(tIdx, { definition: e.target.value })}
                          rows={2}
                          className="rounded-lg text-xs leading-normal resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: LIVE STUDENT PREVIEW */}
          <TabsContent value="preview" className="space-y-4 animate-fade-in">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span>
                <b>Interactive Preview Mode:</b> This is exactly how students experience this chapter note on desktop and mobile screens.
              </span>
              <Button
                size="sm"
                onClick={handleSaveAndPublish}
                disabled={isSaving}
                className="rounded-xl h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                Publish Live
              </Button>
            </div>

            <div className="rounded-3xl border bg-card p-4 sm:p-6 shadow-sm">
              <InteractiveShortNoteReader
                book={previewBook}
                onBack={() => setActiveTab('editor')}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

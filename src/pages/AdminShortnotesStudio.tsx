import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Book,
  BookInput,
  BookStatus,
  ShortNoteSection,
  KeyTerm,
  ShortNoteSourceType,
  ShortNoteGenerationSettings,
} from '@/types/book';
import {
  createBook,
  getBook,
  updateBook,
  deleteBook,
  getBooks,
} from '@/lib/books';
import { getOfflineBook } from '@/lib/offline-books';
import { extractDocumentFromFile } from '@/lib/ai-generator-service';
import {
  splitResourceIntoChapters,
  generateImportantChapterNotes,
  validateStudyNoteCompleteness,
  enrichStudyNoteToTextbookQuality,
  getSubjectPedagogicalProfile,
  analyzeDocumentChapters,
  synthesizeSectionBlocks,
  ensureSectionExercises,
  SeparatedChapterItem,
  DocumentChapterAnalysis,
  CompletenessValidationResult,
} from '@/lib/chapter-resource-generator';
import { getDepartments } from '@/lib/departments';
import { getSubjects, getChapters } from '@/lib/subjects';
import { getSubjectCover } from '@/lib/subject-covers';
import {
  organizeChapterNotesLocal,
  organizeChapterNotesWithAI,
  generateMarkdownFromSections,
  MULTI_SUBJECT_SAMPLE_NOTES,
} from '@/lib/shortnotes-organizer';
import { InteractiveShortNoteReader } from '@/components/book/InteractiveShortNoteReader';
import { ImportShortnoteDialog } from '@/components/book/ImportShortnoteDialog';
import { Department, Exam } from '@/integrations/firebase/types';
import { getAllExams } from '@/lib/firebase-exams';
import { Subject, Chapter } from '@/types/subject';
import { uploadSubjectCoverImage } from '@/lib/image-upload';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Upload,
  FolderTree,
  BookCheck,
  Flame,
  ArrowRight,
  Check,
  AlertCircle,
  Play,
  Library,
  FileUp,
  Settings2,
  SlidersHorizontal,
  Languages,
  RotateCcw,
  BookMarked,
  HelpCircle,
  Image as ImageIcon,
  ShieldCheck,
  FolderOpen,
  Search,
  Edit,
  Globe,
  GlobeLock,
} from 'lucide-react';

export default function AdminShortnotesStudio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: routeNoteId } = useParams<{ id?: string }>();
  const editNoteId = routeNoteId || searchParams.get('editNoteId') || searchParams.get('editBookId') || undefined;
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
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form selections & Target metadata
  const [selectedDeptId, setSelectedDeptId] = useState<string>(paramDeptId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(paramSubjectId);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(paramChapterId);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [customChapterTitle, setCustomChapterTitle] = useState<string>(paramChapterTitle);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('');
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('EthioSmart Academic Team');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [allowDownload, setAllowDownload] = useState<boolean>(true);
  const [gradeLevel, setGradeLevel] = useState<string>('Grade 12');

  // Three Dedicated Workflows: 'workflow_a' | 'workflow_b' | 'workflow_c'
  const [selectedWorkflow, setSelectedWorkflow] = useState<'workflow_a' | 'workflow_b' | 'workflow_c'>('workflow_a');

  // Generation Settings State
  const [generationDepth, setGenerationDepth] = useState<'detailed' | 'balanced' | 'concise'>('detailed');
  const [generationAudience, setGenerationAudience] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [generationLanguage, setGenerationLanguage] = useState<string>('English');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Workflow A State (Existing Library Resource)
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [selectedBookResourceId, setSelectedBookResourceId] = useState<string>('');
  const [isExtractingWorkflowA, setIsExtractingWorkflowA] = useState(false);
  const [workflowAChapters, setWorkflowAChapters] = useState<SeparatedChapterItem[]>([]);
  const [selectedWorkflowAChapter, setSelectedWorkflowAChapter] = useState<SeparatedChapterItem | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentTitle: string } | null>(null);

  // Workflow B State (Upload Document)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedExtractedText, setUploadedExtractedText] = useState<string>('');
  const [isUploadingOrAnalyzing, setIsUploadingOrAnalyzing] = useState(false);
  const [uploadAnalysisStage, setUploadAnalysisStage] = useState<'idle' | 'reading' | 'analyzing' | 'done'>('idle');
  const [uploadAnalysis, setUploadAnalysis] = useState<DocumentChapterAnalysis | null>(null);
  const [selectedUploadChapter, setSelectedUploadChapter] = useState<SeparatedChapterItem | null>(null);
  const [selectedOutlineItemIndex, setSelectedOutlineItemIndex] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow C State (Paste Text)
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [pastedTitleInput, setPastedTitleInput] = useState<string>('');

  // Generated Note Content State
  const [rawNotes, setRawNotes] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [sections, setSections] = useState<ShortNoteSection[]>([]);
  const [keyTerms, setKeyTerms] = useState<KeyTerm[]>([]);

  // Source Tracking State
  const [shortNoteSourceType, setShortNoteSourceType] = useState<ShortNoteSourceType>('resource');
  const [shortNoteSourceId, setShortNoteSourceId] = useState<string>('');

  // Generation Progress Overlay State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<number>(1);
  const [generationStageText, setGenerationStageText] = useState<string>('');

  // Studio tabs: 'input' | 'editor' | 'preview'
  const [activeTab, setActiveTab] = useState<'input' | 'editor' | 'preview'>('input');
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Cover Image File Upload State
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadCoverProgress, setUploadCoverProgress] = useState(0);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Browse & Edit Existing Notes Modal State
  const [browseNotesOpen, setBrowseNotesOpen] = useState(false);
  const [existingNotesList, setExistingNotesList] = useState<Book[]>([]);
  const [loadingExistingNotes, setLoadingExistingNotes] = useState(false);
  const [existingNotesSearch, setExistingNotesSearch] = useState('');
  const [listActionNoteId, setListActionNoteId] = useState<string | null>(null);
  const [noteToDeleteFromList, setNoteToDeleteFromList] = useState<Book | null>(null);

  const handleOpenBrowseNotes = async () => {
    setBrowseNotesOpen(true);
    setLoadingExistingNotes(true);
    try {
      const data = await getBooks({ resourceType: 'short_note' }, 'admin');
      setExistingNotesList(data);
    } catch (err) {
      console.error('Failed to load existing notes:', err);
    } finally {
      setLoadingExistingNotes(false);
    }
  };

  const filteredExistingNotes = useMemo(() => {
    if (!existingNotesSearch.trim()) return existingNotesList;
    const q = existingNotesSearch.toLowerCase().trim();
    return existingNotesList.filter((n) => {
      return (
        n.title?.toLowerCase().includes(q) ||
        n.subjectName?.toLowerCase().includes(q) ||
        n.chapterTitle?.toLowerCase().includes(q) ||
        n.departmentName?.toLowerCase().includes(q)
      );
    });
  }, [existingNotesList, existingNotesSearch]);

  const handleToggleNoteStatusFromList = async (note: Book) => {
    const nextStatus: BookStatus = note.status === 'published' ? 'draft' : 'published';
    setListActionNoteId(note.id);
    try {
      await updateBook(note.id, { status: nextStatus });
      setExistingNotesList((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, status: nextStatus } : n))
      );
      toast({
        title: nextStatus === 'published' ? 'Note Published' : 'Saved as Draft',
        description:
          nextStatus === 'published'
            ? `"${note.title}" is now visible to students.`
            : `"${note.title}" is now hidden from students as a draft.`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to update note',
        description: err.message || 'Permission denied or network error.',
        variant: 'destructive',
      });
    } finally {
      setListActionNoteId(null);
    }
  };

  const handleDeleteNoteFromList = async () => {
    if (!noteToDeleteFromList) return;
    const target = noteToDeleteFromList;
    setListActionNoteId(target.id);
    try {
      await deleteBook(target.id);
      setExistingNotesList((prev) => prev.filter((n) => n.id !== target.id));
      toast({
        title: 'Study Note Deleted',
        description: `"${target.title}" has been permanently removed from the library.`,
      });
      setNoteToDeleteFromList(null);
    } catch (err: any) {
      toast({
        title: 'Failed to delete note',
        description: err.message || 'Permission denied or network error.',
        variant: 'destructive',
      });
    } finally {
      setListActionNoteId(null);
    }
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setUploadCoverProgress(20);
    try {
      const result = await uploadSubjectCoverImage(file, {
        subjectId: selectedSubjectId || undefined,
        onProgress: (p) => setUploadCoverProgress(p),
      });
      setCustomCoverUrl(result.url);
      toast({
        title: 'Cover Image Uploaded!',
        description: 'Custom cover page image applied to this study note.',
      });
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err.message || 'Could not upload cover image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  // Initial load
  useEffect(() => {
    async function initData() {
      setLoadingInitial(true);
      try {
        const [deptsData, subsData, allBooksData, examsData] = await Promise.all([
          getDepartments(),
          getSubjects(),
          getBooks().catch(() => []),
          getAllExams().catch(() => []),
        ]);
        setDepartments(deptsData);
        setSubjects(subsData);
        setAllExams(examsData);
        setLibraryBooks(allBooksData.filter((b) => b.resourceType === 'textbook' || Boolean(b.driveFileId)));

        // If editing an existing book/shortnote
        if (editNoteId) {
          const existing = await getBook(editNoteId);
          if (existing) {
            setNoteTitle(existing.title || '');
            setAuthorName(existing.author || 'EthioSmart Academic Team');
            setSelectedDeptId(existing.departmentId || '');
            setSelectedSubjectId(existing.subjectId || '');
            setSelectedChapterId(existing.chapterId || '');
            if (existing.examId) {
              setSelectedExamId(existing.examId);
            }
            if (existing.coverImageUrl) {
              setCustomCoverUrl(existing.coverImageUrl);
            }
            setCustomChapterTitle(existing.chapterTitle || '');
            setStatus(existing.status || 'published');
            setSummary(existing.summary || existing.description || '');
            setLearningOutcomes(existing.learningOutcomes || []);
            setGradeLevel(existing.gradeLevel || 'Grade 12');
            setKeyTakeaways(existing.keyTakeaways || []);
            setSections(existing.sections || []);
            setKeyTerms(existing.keyTerms || []);
            setShortNoteSourceType(existing.sourceType || 'resource');
            setShortNoteSourceId(existing.sourceResourceId || '');
            if (existing.generationSettings) {
              setGenerationDepth(existing.generationSettings.depth || 'detailed');
              setGenerationAudience(existing.generationSettings.targetAudience || 'beginner');
              setGenerationLanguage(existing.generationSettings.language || 'English');
              setCustomInstructions(existing.generationSettings.customInstructions || '');
            }
            if (existing.content) {
              setRawNotes(existing.content);
            }
            if (existing.sections && existing.sections.length > 0) {
              setActiveTab('preview');
            }
          }
        } else {
          // Check if user imported a draft from library dialog
          const draftStr = sessionStorage.getItem('ethiosmart_imported_note_draft');
          if (draftStr) {
            try {
              const draft = JSON.parse(draftStr);
              if (draft.title) setNoteTitle(draft.title);
              if (draft.author) setAuthorName(draft.author);
              if (draft.departmentId) setSelectedDeptId(draft.departmentId);
              if (draft.subjectId) setSelectedSubjectId(draft.subjectId);
              if (draft.chapterTitle) setCustomChapterTitle(draft.chapterTitle);
              if (draft.summary) setSummary(draft.summary);
              if (draft.learningOutcomes) setLearningOutcomes(draft.learningOutcomes);
              if (draft.keyTakeaways) setKeyTakeaways(draft.keyTakeaways);
              if (draft.keyTerms) setKeyTerms(draft.keyTerms);
              if (draft.sections) setSections(draft.sections);
              if (draft.examId) setSelectedExamId(draft.examId);
              setActiveTab('editor');
              sessionStorage.removeItem('ethiosmart_imported_note_draft');
              toast({
                title: 'Imported Note Loaded! 📝',
                description: `Loaded "${draft.title}" with ${draft.sections?.length || 0} sections into Studio editor.`,
              });
            } catch (e) {
              console.warn('Failed to parse draft from sessionStorage:', e);
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

  // Load imported data into studio editor
  const handleLoadImportedData = (draft: {
    title?: string;
    author?: string;
    departmentId?: string;
    subjectId?: string;
    chapterTitle?: string;
    summary?: string;
    learningOutcomes?: string[];
    keyTakeaways?: string[];
    keyTerms?: any[];
    sections?: any[];
    examId?: string;
  }) => {
    if (draft.title) setNoteTitle(draft.title);
    if (draft.author) setAuthorName(draft.author);
    if (draft.departmentId) setSelectedDeptId(draft.departmentId);
    if (draft.subjectId) setSelectedSubjectId(draft.subjectId);
    if (draft.chapterTitle) setCustomChapterTitle(draft.chapterTitle);
    if (draft.summary) setSummary(draft.summary);
    if (draft.learningOutcomes) setLearningOutcomes(draft.learningOutcomes);
    if (draft.keyTakeaways) setKeyTakeaways(draft.keyTakeaways);
    if (draft.keyTerms) setKeyTerms(draft.keyTerms);
    if (draft.sections) setSections(draft.sections);
    if (draft.examId) setSelectedExamId(draft.examId);
    setActiveTab('editor');
    toast({
      title: 'Imported Note Loaded! 📝',
      description: `Loaded "${draft.title || 'study note'}" with ${draft.sections?.length || 0} sections into Studio editor.`,
    });
  };

  // Load chapters when selected subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setChapters([]);
      return;
    }
    getChapters(selectedSubjectId)
      .then((data) => {
        setChapters(data);
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

  // Subject-specific Pedagogical Profile
  const currentPedagogicalProfile = useMemo(() => {
    return getSubjectPedagogicalProfile(currentSubject?.name);
  }, [currentSubject]);

  // Available Exams under this subject
  const subjectExams = useMemo(() => {
    if (!selectedSubjectId) return [];
    return allExams.filter((e) => e.subjectId === selectedSubjectId);
  }, [allExams, selectedSubjectId]);

  // Auto-connect practice exam if chapter matches
  useEffect(() => {
    if (!selectedExamId && subjectExams.length > 0) {
      if (selectedChapterId) {
        const matchByChapter = subjectExams.find((e) => e.chapterId && e.chapterId === selectedChapterId);
        if (matchByChapter) {
          setSelectedExamId(matchByChapter.examId);
          return;
        }
      }
      if (currentChapterTitle) {
        const matchByTitle = subjectExams.find((e) =>
          e.title.toLowerCase().includes(currentChapterTitle.toLowerCase()) ||
          (e.chapterTitle && e.chapterTitle.toLowerCase().includes(currentChapterTitle.toLowerCase()))
        );
        if (matchByTitle) {
          setSelectedExamId(matchByTitle.examId);
        }
      }
    }
  }, [selectedChapterId, currentChapterTitle, subjectExams, selectedExamId]);

  // Word count & reading time stats
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

  // Available textbooks for current subject
  const availableTextbooks = useMemo(() => {
    if (!selectedSubjectId || selectedSubjectId === 'all') return libraryBooks;
    const directMatches = libraryBooks.filter((b) => b.subjectId === selectedSubjectId);
    return directMatches.length > 0 ? directMatches : libraryBooks;
  }, [libraryBooks, selectedSubjectId]);

  // Completeness Validation
  const completenessValidation: CompletenessValidationResult = useMemo(() => {
    const currentNoteObj = {
      title: noteTitle,
      summary,
      learningOutcomes,
      keyTakeaways,
      sections,
      keyTerms,
      exercises: [],
      rawContent: rawNotes,
      readingTimeMinutes: readingStats.minutes,
    };
    return validateStudyNoteCompleteness(currentNoteObj, rawNotes, currentSubject?.name);
  }, [noteTitle, summary, learningOutcomes, keyTakeaways, sections, keyTerms, rawNotes, readingStats.minutes, currentSubject]);

  // ==========================================
  // WORKFLOW A: EXTRACT & SEPARATE CHAPTERS
  // ==========================================
  const handleExtractWorkflowAResource = async () => {
    if (!selectedBookResourceId) {
      toast({
        title: 'Please Select a Resource',
        description: 'Choose an existing digital textbook from your library to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setIsExtractingWorkflowA(true);
    try {
      const targetBook = libraryBooks.find((b) => b.id === selectedBookResourceId);
      if (!targetBook) throw new Error('Resource not found in library.');

      let extracted = '';

      // Layer 1: Offline Cache
      try {
        const offlineRec = await getOfflineBook(targetBook.id);
        if (offlineRec && offlineRec.blob) {
          const f = new File([offlineRec.blob], `${targetBook.title}.pdf`, { type: 'application/pdf' });
          const doc = await extractDocumentFromFile(f);
          if (doc && doc.fullText.length > 50) extracted = doc.fullText;
        }
      } catch {}

      // Layer 2: Drive Proxy Download
      if (!extracted && targetBook.driveFileId) {
        try {
          const dl = await fetch(`/api/drive/download?fileId=${encodeURIComponent(targetBook.driveFileId)}`);
          if (dl.ok) {
            const blob = await dl.blob();
            const f = new File([blob], `${targetBook.title}.pdf`, { type: 'application/pdf' });
            const doc = await extractDocumentFromFile(f);
            if (doc && doc.fullText.length > 50) extracted = doc.fullText;
          }
        } catch {}
      }

      // Layer 3: Serverless Extraction
      if (!extracted && targetBook.driveFileId) {
        try {
          const res = await fetch('/api/drive/extract-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: targetBook.driveFileId }),
          });
          if (res.ok) {
            const d = await res.json();
            if (d.success && d.text) extracted = d.text;
          }
        } catch {}
      }

      // Fallback
      if (!extracted) {
        extracted = targetBook.content || targetBook.description || targetBook.summary || '';
      }

      const separated = splitResourceIntoChapters(extracted, chapters, targetBook.chapterLabels);
      setWorkflowAChapters(separated);
      if (separated.length > 0) {
        setSelectedWorkflowAChapter(separated[0]);
      }

      toast({
        title: 'Chapters Separated Successfully!',
        description: `Identified ${separated.length} distinct chapters from "${targetBook.title}". Select any chapter to generate.`,
      });
    } catch (err: any) {
      toast({
        title: 'Extraction Error',
        description: err.message || 'Could not extract chapters from resource.',
        variant: 'destructive',
      });
    } finally {
      setIsExtractingWorkflowA(false);
    }
  };

  // ==========================================
  // WORKFLOW B: FILE UPLOAD & STRUCTURE ANALYSIS
  // ==========================================
  const handleProcessUploadedFile = async (file: File) => {
    setUploadedFile(file);
    setIsUploadingOrAnalyzing(true);
    setUploadAnalysisStage('reading');

    try {
      // Step 1: Extract Document Text
      const doc = await extractDocumentFromFile(file);
      const fullText = doc.fullText || '';
      setUploadedExtractedText(fullText);

      setUploadAnalysisStage('analyzing');
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Document Structure Analysis
      const analysis = analyzeDocumentChapters(fullText, {
        fileName: file.name,
        subjectChapters: chapters,
        fallbackTitle: currentSubject ? `${currentSubject.name} Notes` : 'Uploaded Notes',
      });

      setUploadAnalysis(analysis);
      setUploadAnalysisStage('done');

      if (analysis.status === 'multiple_chapters' && analysis.detectedChapters.length > 0) {
        setSelectedUploadChapter(analysis.detectedChapters[0]);
        toast({
          title: 'Multiple Chapters Detected!',
          description: `Found ${analysis.detectedChapters.length} distinct chapters. Pick a chapter below to generate textbook-quality notes.`,
        });
      } else if (analysis.status === 'single_chapter' && analysis.detectedChapters.length > 0) {
        setSelectedUploadChapter(analysis.detectedChapters[0]);
        toast({
          title: 'Single Chapter Detected',
          description: `Ready to generate notes for "${analysis.suggestedTitle}".`,
        });
      } else {
        toast({
          title: 'Document Outline Analyzed',
          description: 'No explicit chapter numbers found. You can use the entire document or select an outline topic.',
        });
      }
    } catch (err: any) {
      console.error('File extraction failed:', err);
      toast({
        title: 'Extraction Failed',
        description: err.message || 'Could not read text from this file. Ensure it is a valid PDF, DOCX, or text file.',
        variant: 'destructive',
      });
      setUploadAnalysisStage('idle');
    } finally {
      setIsUploadingOrAnalyzing(false);
    }
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Quick Sample loader for testing & immediate exploration
  const handleLoadSampleNotes = (sampleKey: string = 'mathematics') => {
    const sample = MULTI_SUBJECT_SAMPLE_NOTES[sampleKey] || MULTI_SUBJECT_SAMPLE_NOTES.mathematics;
    setPastedRawText(sample.text);
    setPastedTitleInput(`${sample.subject} - ${sample.chapterTitle}`);
    setCustomChapterTitle(sample.chapterTitle);
    setGradeLevel(sample.gradeLevel);
    setSelectedWorkflow('workflow_c');
    toast({
      title: `${sample.subject} Sample Notes Loaded`,
      description: 'Pasted into Workflow C. Click "Generate Teaching-First Study Notes" to build the interactive textbook!',
    });
  };

  // ==========================================
  // CORE 5-STAGE TEACHING NOTE GENERATOR
  // ==========================================
  const executeGeneration = async (
    rawInputText: string,
    targetChapterTitle: string,
    targetChapterNum?: number,
    targetChapterId?: string,
    sourceTypeParam: ShortNoteSourceType = 'resource',
    sourceResourceIdParam?: string
  ) => {
    if (!rawInputText.trim()) {
      toast({
        title: 'Input Content Required',
        description: 'No text material provided for generation.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Stage 1: Reading content
      setGenerationStage(1);
      setGenerationStageText('Reading & indexing source chapter material...');
      await new Promise((r) => setTimeout(r, 450));

      // Stage 2: Preparing chapter & discipline focus
      setGenerationStage(2);
      setGenerationStageText(`Configuring ${currentPedagogicalProfile.name} pedagogical framework...`);
      await new Promise((r) => setTimeout(r, 450));

      // Stage 3: Generating teaching-first explanations
      setGenerationStage(3);
      setGenerationStageText('Generating teaching-first explanations & detailed concepts...');

      const stageTimer1 = setTimeout(() => {
        setGenerationStageText('Explaining concepts, types & practical examples in simple English...');
      }, 3500);
      const stageTimer2 = setTimeout(() => {
        setGenerationStageText('Synthesizing pedagogical callouts, worked calculations & review exercises...');
      }, 7500);

      let organizedResult;
      try {
        organizedResult = await Promise.race([
          organizeChapterNotesWithAI(rawInputText, {
            chapterTitle: targetChapterTitle,
            subjectName: currentSubject?.name,
            depth: generationDepth,
            targetAudience: generationAudience,
            language: generationLanguage,
            customInstructions: customInstructions,
            sourceType: sourceTypeParam,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI generation timed out (exceeded 90s)')), 90000)
          ),
        ]);
      } catch (aiErr) {
        console.warn('AI generation timed out or failed, falling back to local grounded organizer:', aiErr);
        organizedResult = generateImportantChapterNotes(rawInputText, {
          subjectName: currentSubject?.name || 'Subject',
          chapterTitle: targetChapterTitle,
          chapterNumber: targetChapterNum || 1,
          chapterId: targetChapterId,
          gradeLevel: gradeLevel,
          depth: generationDepth,
          targetAudience: generationAudience,
          language: generationLanguage,
          customInstructions: customInstructions,
        });
      } finally {
        clearTimeout(stageTimer1);
        clearTimeout(stageTimer2);
      }

      // Stage 4: Interactive Card Structuring & Verification
      setGenerationStage(4);
      setGenerationStageText('Auditing completeness & formatting interactive structure...');

      // Preserve AI's authentic sections, contentBlocks, and exercises across all workflows without overwriting with boilerplate
      organizedResult = {
        ...organizedResult,
        sections: organizedResult.sections.map((sec, idx) => ({
          ...sec,
          contentBlocks: sec.contentBlocks && sec.contentBlocks.length >= 2
            ? sec.contentBlocks
            : synthesizeSectionBlocks(sec, currentPedagogicalProfile.discipline, targetChapterTitle),
          exercises: (sec.exercises && sec.exercises.length > 0)
            ? sec.exercises
            : ensureSectionExercises(sec.exercises || [], idx, sec.title, currentPedagogicalProfile.discipline, targetChapterTitle),
        })),
      };
      await new Promise((r) => setTimeout(r, 400));

      // Stage 5: Finalizing interactive note reader
      setGenerationStage(5);
      setGenerationStageText('Finalizing interactive textbook notes...');
      await new Promise((r) => setTimeout(r, 300));

      // Commit to State
      setNoteTitle(organizedResult.title);
      setSummary(organizedResult.summary);
      setLearningOutcomes(organizedResult.learningOutcomes || []);
      setKeyTakeaways(organizedResult.keyTakeaways || []);
      setSections(organizedResult.sections || []);
      setKeyTerms(organizedResult.keyTerms || []);
      setRawNotes(rawInputText);
      setCustomChapterTitle(targetChapterTitle);
      setSelectedChapterId(targetChapterId || '');
      setShortNoteSourceType(sourceTypeParam);
      setShortNoteSourceId(sourceResourceIdParam || '');

      // Switch to Reader View immediately
      setActiveTab('preview');

      toast({
        title: 'Teaching-First Notes Generated!',
        description: `Ready for students: ${organizedResult.sections.length} core sections with worked examples and Show/Hide solutions.`,
      });
    } catch (err: any) {
      console.error('Note generation failed:', err);
      toast({
        title: 'Generation Failed',
        description: err.message || 'An error occurred during generation.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler for Workflow A generation
  const handleGenerateWorkflowA = () => {
    if (!selectedWorkflowAChapter) {
      toast({
        title: 'Please Select a Chapter',
        description: 'Choose a chapter from the separated list above.',
        variant: 'destructive',
      });
      return;
    }
    executeGeneration(
      selectedWorkflowAChapter.rawText,
      selectedWorkflowAChapter.chapterTitle,
      selectedWorkflowAChapter.chapterNumber,
      selectedWorkflowAChapter.chapterId,
      'resource',
      selectedBookResourceId
    );
  };

  // Handler for Workflow B generation
  const handleGenerateWorkflowB = () => {
    if (!uploadedExtractedText) {
      toast({
        title: 'No Document Uploaded',
        description: 'Please upload a PDF, DOCX, or text file first.',
        variant: 'destructive',
      });
      return;
    }

    if (uploadAnalysis?.status === 'multiple_chapters') {
      if (!selectedUploadChapter) {
        toast({
          title: 'Please Select a Chapter',
          description: 'Pick which chapter from the document you want to generate notes for.',
          variant: 'destructive',
        });
        return;
      }
      executeGeneration(
        selectedUploadChapter.rawText,
        selectedUploadChapter.chapterTitle,
        selectedUploadChapter.chapterNumber,
        undefined,
        'upload',
        uploadedFile?.name
      );
    } else if (uploadAnalysis?.status === 'single_chapter') {
      const ch = uploadAnalysis.detectedChapters[0];
      executeGeneration(
        ch?.rawText || uploadedExtractedText,
        ch?.chapterTitle || uploadAnalysis.suggestedTitle || 'Document Study Notes',
        ch?.chapterNumber || 1,
        undefined,
        'upload',
        uploadedFile?.name
      );
    } else {
      // Uncertain structure
      if (selectedOutlineItemIndex !== null && uploadAnalysis?.outlineItems[selectedOutlineItemIndex]) {
        const item = uploadAnalysis.outlineItems[selectedOutlineItemIndex];
        executeGeneration(
          uploadedExtractedText,
          item.title,
          selectedOutlineItemIndex + 1,
          undefined,
          'upload',
          uploadedFile?.name
        );
      } else {
        // Use entire document as one chapter
        executeGeneration(
          uploadedExtractedText,
          uploadAnalysis?.suggestedTitle || uploadedFile?.name.replace(/\.[a-zA-Z0-9]+$/, '') || 'Document Study Notes',
          1,
          undefined,
          'upload',
          uploadedFile?.name
        );
      }
    }
  };

  // Handler for Workflow C generation (Paste Text - STRICTLY treated as ONE chapter!)
  const handleGenerateWorkflowC = () => {
    if (!pastedRawText.trim()) {
      toast({
        title: 'Paste Text Required',
        description: 'Please paste your lecture notes or textbook material.',
        variant: 'destructive',
      });
      return;
    }

    const title =
      pastedTitleInput.trim() ||
      currentChapterTitle ||
      (currentSubject ? `${currentSubject.name} - Study Notes` : 'Comprehensive Study Notes');

    executeGeneration(
      pastedRawText,
      title,
      1,
      selectedChapterId || undefined,
      'pasted_text',
      undefined
    );
  };

  // Batch generate all chapters under Workflow A
  const handleBatchGenerateAllChapters = async () => {
    if (!workflowAChapters || workflowAChapters.length === 0) {
      toast({
        title: 'No Chapters Available',
        description: 'Please extract chapters from a resource first.',
        variant: 'destructive',
      });
      return;
    }
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to publish study notes.',
        variant: 'destructive',
      });
      return;
    }

    setIsBatchGenerating(true);
    let successCount = 0;

    try {
      for (let i = 0; i < workflowAChapters.length; i++) {
        const item = workflowAChapters[i];
        setBatchProgress({
          current: i + 1,
          total: workflowAChapters.length,
          currentTitle: item.chapterTitle,
        });

        let result: OrganizedShortNote;
        try {
          result = await Promise.race([
            organizeChapterNotesWithAI(item.rawText || '', {
              chapterTitle: item.chapterTitle,
              subjectName: currentSubject?.name,
              depth: generationDepth,
              targetAudience: generationAudience,
              language: generationLanguage,
              customInstructions: customInstructions,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('AI generation timeout')), 90000)
            ),
          ]);
        } catch {
          result = generateImportantChapterNotes(item.rawText || '', {
            subjectName: currentSubject?.name || 'Subject',
            chapterTitle: item.chapterTitle,
            chapterNumber: item.chapterNumber,
            chapterId: item.chapterId,
            gradeLevel: gradeLevel,
            depth: generationDepth,
            targetAudience: generationAudience,
            language: generationLanguage,
            customInstructions: customInstructions,
          });
        }

        // Preserve AI generated content blocks and exercises; only synthesize if missing
        result = {
          ...result,
          sections: (result.sections || []).map((sec, idx) => ({
            ...sec,
            contentBlocks: sec.contentBlocks && sec.contentBlocks.length >= 2
              ? sec.contentBlocks
              : synthesizeSectionBlocks(sec, currentPedagogicalProfile.discipline, item.chapterTitle),
            exercises: (sec.exercises && sec.exercises.length > 0)
              ? sec.exercises
              : ensureSectionExercises(sec.exercises || [], idx, sec.title, currentPedagogicalProfile.discipline, item.chapterTitle),
          })),
        };

        const effectiveCover = currentSubject
          ? currentSubject.coverImageUrl || getSubjectCover(currentSubject.name).url
          : '';

        const generatedMarkdown = generateMarkdownFromSections(result.sections);

        const matchedExam = allExams.find(
          (e) =>
            (item.chapterId && e.chapterId === item.chapterId) ||
            (e.subjectId === selectedSubjectId &&
              (e.title.toLowerCase().includes(item.chapterTitle.toLowerCase()) ||
               (e.chapterTitle && e.chapterTitle.toLowerCase().includes(item.chapterTitle.toLowerCase()))))
        );

        const input: BookInput = {
          title: result.title,
          author: authorName.trim() || 'EthioSmart Curriculum Team',
          description: result.summary,
          resourceType: 'short_note',
          sourceType: 'resource',
          sourceResourceId: selectedBookResourceId,
          ...(matchedExam?.examId ? { examId: matchedExam.examId } : {}),
          generationSettings: {
            depth: generationDepth,
            targetAudience: generationAudience,
            language: generationLanguage,
            ...(customInstructions.trim() ? { customInstructions: customInstructions.trim() } : {}),
          },
          driveFileId: '',
          departmentId: selectedDeptId && selectedDeptId !== 'all' ? selectedDeptId : (currentSubject?.departmentIds?.[0] || ''),
          subjectId: selectedSubjectId,
          coverImageUrl: effectiveCover,
          status: 'published',
          allowDownload: true,
          ...(item.chapterId ? { chapterId: item.chapterId } : {}),
          chapterTitle: item.chapterTitle,
          ...(item.chapterNumber !== undefined ? { chapterNumber: item.chapterNumber } : {}),
          gradeLevel: gradeLevel,
          learningOutcomes: result.learningOutcomes,
          content: generatedMarkdown,
          summary: result.summary,
          keyTakeaways: result.keyTakeaways,
          keyTerms: result.keyTerms,
          sections: result.sections,
          readingTimeMinutes: result.readingTimeMinutes,
        };

        await createBook(input, user.uid);
        successCount++;
      }

      toast({
        title: 'All Chapters Successfully Published!',
        description: `Created and published ${successCount} chapter-by-chapter study notes under "${currentSubject?.name || 'Subject'}".`,
      });

      navigate('/dashboard/books');
    } catch (err: any) {
      toast({
        title: 'Batch Generation Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // Auto-enrich current notes to exemplary textbook quality
  const handleAutoEnrichToTextbookQuality = () => {
    const currentNoteObj = {
      title: noteTitle || `${currentSubject?.name || 'Subject'} - ${currentChapterTitle || 'Chapter'}`,
      summary,
      learningOutcomes,
      keyTakeaways,
      sections,
      keyTerms,
      exercises: [],
      rawContent: rawNotes,
      readingTimeMinutes: readingStats.minutes,
    };

    const ch = chapters.find((c) => c.id === selectedChapterId);
    const enriched = enrichStudyNoteToTextbookQuality(currentNoteObj, {
      subjectName: currentSubject?.name || 'Subject',
      chapterTitle: currentChapterTitle || noteTitle || 'Chapter Overview',
      chapterNumber: ch?.chapterNumber || 1,
      gradeLevel,
      depth: generationDepth,
      targetAudience: generationAudience,
      language: generationLanguage,
      customInstructions: customInstructions,
    });

    setSummary(enriched.summary);
    setLearningOutcomes(enriched.learningOutcomes);
    setKeyTakeaways(enriched.keyTakeaways);
    setSections(enriched.sections);
    setKeyTerms(enriched.keyTerms);

    toast({
      title: 'Upgraded to Textbook-Quality Teaching Depth!',
      description: `Applied ${currentPedagogicalProfile.name} teaching models, step-by-step calculations, and Show/Hide solutions.`,
    });
  };

  // Save / Publish Note to Firestore
  const handleSaveAndPublish = async (explicitStatus?: unknown) => {
    const targetStatus: 'published' | 'draft' =
      explicitStatus === 'published' || explicitStatus === 'draft'
        ? explicitStatus
        : status === 'published'
        ? 'published'
        : 'draft';
    setStatus(targetStatus);

    if (!noteTitle.trim()) {
      toast({
        title: 'Title required',
        description: 'Please provide a title for the study note.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSubjectId) {
      toast({
        title: 'Subject required',
        description: 'Please select which subject this note belongs to.',
        variant: 'destructive',
      });
      return;
    }

    if (sections.length === 0 && !rawNotes.trim()) {
      toast({
        title: 'Content required',
        description: 'Please generate or add note sections before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const ch = chapters.find((c) => c.id === selectedChapterId);
      const chNumber = ch?.chapterNumber;

      const effectiveCover = customCoverUrl.trim() || (currentSubject
        ? currentSubject.coverImageUrl || getSubjectCover(currentSubject.name).url
        : '');

      const generatedMarkdown =
        sections.length > 0 ? generateMarkdownFromSections(sections) : rawNotes;

      const input: BookInput = {
        title: noteTitle.trim(),
        author: authorName.trim() || 'EthioSmart Academic Team',
        description: summary || `High-yield interactive study notes for ${currentChapterTitle || noteTitle}.`,
        resourceType: 'short_note',
        sourceType: shortNoteSourceType,
        sourceResourceId: shortNoteSourceId,
        generationSettings: {
          depth: generationDepth,
          targetAudience: generationAudience,
          language: generationLanguage,
          ...(customInstructions.trim() ? { customInstructions: customInstructions.trim() } : {}),
        },
        driveFileId: '',
        departmentId: selectedDeptId && selectedDeptId !== 'all' ? selectedDeptId : (currentSubject?.departmentIds?.[0] || ''),
        subjectId: selectedSubjectId,
        coverImageUrl: effectiveCover,
        ...(selectedExamId ? { examId: selectedExamId } : {}),
        status: targetStatus,
        allowDownload: allowDownload,
        ...(selectedChapterId ? { chapterId: selectedChapterId } : {}),
        ...(currentChapterTitle ? { chapterTitle: currentChapterTitle } : {}),
        ...(chNumber !== undefined ? { chapterNumber: chNumber } : {}),
        gradeLevel: gradeLevel,
        learningOutcomes: learningOutcomes.filter((o) => o.trim().length > 0),
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
          title: targetStatus === 'published' ? 'Study Notes Updated & Published Live!' : 'Study Notes Saved as Draft!',
          description:
            targetStatus === 'published'
              ? `"${noteTitle}" is now live for students in the library.`
              : `"${noteTitle}" has been saved as a draft and is hidden from students.`,
        });
      } else {
        if (!user) throw new Error('You must be logged in to save study notes.');
        savedId = await createBook(input, user.uid);
        toast({
          title: targetStatus === 'published' ? 'Study Notes Published Live!' : 'Study Notes Saved as Draft!',
          description:
            targetStatus === 'published'
              ? `"${noteTitle}" is now live for students in the library.`
              : `"${noteTitle}" has been saved as a draft and is hidden from students.`,
        });
      }

      navigate(`/dashboard/books/${savedId}/read`);
    } catch (err: any) {
      console.error('Error saving study notes:', err);
      toast({
        title: 'Failed to save notes',
        description: err.message || 'Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  const handleDeleteCurrentNote = async () => {
    if (!editNoteId) return;
    setIsDeletingNote(true);
    try {
      await deleteBook(editNoteId);
      toast({
        title: 'Study Note Deleted',
        description: `"${noteTitle}" has been permanently removed from the library.`,
      });
      navigate('/dashboard/admin/books');
    } catch (err: any) {
      toast({
        title: 'Failed to delete note',
        description: err.message || 'Permission denied or network error.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingNote(false);
      setDeleteNoteDialogOpen(false);
    }
  };

  // Synthetic Preview Book
  const previewBook: Book = useMemo(() => {
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return {
      id: editNoteId || 'preview-temp-id',
      title: noteTitle || 'Chapter Shortnotes Preview',
      author: authorName || 'EthioSmart Academic Team',
      description: summary || 'High-yield interactive short notes.',
      resourceType: 'short_note',
      sourceType: shortNoteSourceType,
      sourceResourceId: shortNoteSourceId,
      generationSettings: {
        depth: generationDepth,
        targetAudience: generationAudience,
        language: generationLanguage,
      },
      driveUrl: '',
      driveFileId: '',
      departmentId: selectedDeptId,
      departmentName: departments.find((d) => d.id === selectedDeptId)?.name,
      subjectId: selectedSubjectId,
      subjectName: currentSubject?.name || 'Subject',
      coverImageUrl: customCoverUrl.trim() || currentSubject?.coverImageUrl || (currentSubject ? getSubjectCover(currentSubject.name).url : ''),
      status: status,
      allowDownload: allowDownload,
      language: generationLanguage,
      examId: selectedExamId || undefined,
      viewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      chapterId: selectedChapterId,
      chapterTitle: currentChapterTitle,
      chapterNumber: ch?.chapterNumber,
      gradeLevel: gradeLevel,
      learningOutcomes: learningOutcomes,
      content: rawNotes,
      summary: summary,
      keyTakeaways: keyTakeaways,
      keyTerms: keyTerms,
      sections: sections,
      readingTimeMinutes: readingStats.minutes,
      createdBy: user?.uid || 'temp-user',
    };
  }, [
    editNoteId,
    noteTitle,
    authorName,
    summary,
    shortNoteSourceType,
    shortNoteSourceId,
    generationDepth,
    generationAudience,
    generationLanguage,
    selectedDeptId,
    departments,
    selectedSubjectId,
    currentSubject,
    status,
    allowDownload,
    selectedChapterId,
    chapters,
    currentChapterTitle,
    gradeLevel,
    learningOutcomes,
    rawNotes,
    keyTakeaways,
    keyTerms,
    sections,
    readingStats.minutes,
    user?.uid,
  ]);

  // Section editor helpers
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
      content: 'Enter detailed pedagogical explanation, formulas, or concepts here...',
      keyPoints: ['Key takeaway point 1'],
      isImportant: false,
    };
    setSections((prev) => [...prev, newSec]);
  };

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
      <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in">
        {/* TOP BAR / BREADCRUMB */}
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
                  Transform textbooks and lectures into textbook-quality study notes with subject-aware teaching depth.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Import Shortnote Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="rounded-xl border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold h-9 px-3 gap-1.5 shadow-xs"
              title="Import structured JSON/Markdown notes directly"
            >
              <FileUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Import Note</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenBrowseNotes}
              className="rounded-xl border-border text-foreground hover:bg-muted text-xs font-semibold h-9 px-3"
            >
              <FolderOpen className="h-4 w-4 mr-1.5" />
              <span>Edit Existing Notes</span>
            </Button>

            {/* Status Selector */}
            <Select
              value={status}
              onValueChange={(v: 'published' | 'draft') => setStatus(v)}
            >
              <SelectTrigger className="w-[125px] h-9 rounded-xl text-xs font-semibold">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="published">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Published
                  </span>
                </SelectItem>
                <SelectItem value="draft">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    Draft
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Save as Draft Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveAndPublish('draft')}
              disabled={isSaving || sections.length === 0}
              className="rounded-xl text-xs font-semibold h-9 px-3 gap-1.5 border-border"
              title="Save as Draft (hidden from students)"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Save as Draft</span>
            </Button>

            {/* Publish Live Button */}
            <Button
              type="button"
              onClick={() => handleSaveAndPublish('published')}
              disabled={isSaving || sections.length === 0}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs text-xs sm:text-sm h-9 px-4 gap-1.5"
              title="Publish live to students"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  <span>{editNoteId ? 'Update & Publish' : 'Publish Live'}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* EDITING EXISTING NOTE BANNER */}
        {editNoteId && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-500/15 via-primary/10 to-indigo-500/15 border border-purple-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Edit className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-600 text-white text-[10px] uppercase font-bold tracking-wider">
                    Editing Mode
                  </Badge>
                  {status === 'published' ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                      <Check className="h-3 w-3 mr-1 stroke-[3]" />
                      Published Live
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
                      <Clock className="h-3 w-3 mr-1" />
                      Draft (Hidden)
                    </Badge>
                  )}
                  <span className="text-xs sm:text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md">
                    {noteTitle || 'Existing Study Note'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  You are editing this note in the Digital Library. Choose &quot;Save as Draft&quot; to hide from students or &quot;Publish Live&quot; to make it accessible.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveAndPublish(status === 'published' ? 'draft' : 'published')}
                className="h-8 text-xs rounded-xl font-semibold gap-1"
              >
                {status === 'published' ? (
                  <>
                    <GlobeLock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Unpublish to Draft</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Publish Live</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteNoteDialogOpen(true)}
                className="h-8 text-xs rounded-xl text-destructive hover:bg-destructive/10 border-destructive/30 font-semibold gap-1"
                title="Delete this study note permanently"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard/admin/shortnotes/create')}
                className="h-8 text-xs rounded-xl font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Note
              </Button>
            </div>
          </div>
        )}

        {/* TARGET SUBJECT & CURRICULUM PROFILE CARD */}
        <Card className="rounded-3xl border bg-card/60 shadow-xs backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                    setSelectedExamId('');
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
                  Curriculum Chapter
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

              {/* Connected Chapter Practice Exam */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
                    Chapter Practice Exam
                  </span>
                  {selectedExamId && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      Linked
                    </Badge>
                  )}
                </Label>
                <Select
                  value={selectedExamId || 'none'}
                  onValueChange={(val) => setSelectedExamId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue placeholder="Select Practice Exam..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    <SelectItem value="none">-- No Exam Attached --</SelectItem>
                    {subjectExams.map((e) => (
                      <SelectItem key={e.examId} value={e.examId}>
                        {e.title} {e.questionCount ? `(${e.questionCount} Qs)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Note Book Cover Page Art Card & Uploader */}
            <div className="p-4 rounded-2xl border border-primary/25 bg-card/70 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  <Label className="text-xs font-bold text-foreground">
                    Study Note Cover Page Image (Like a Book)
                  </Label>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    customCoverUrl.trim()
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {customCoverUrl.trim() ? 'Custom Uploaded Cover' : 'Auto Subject Theme (Default)'}
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* 4:3 Book Cover Preview */}
                <div className="relative aspect-[4/3] w-28 sm:w-36 rounded-xl overflow-hidden bg-muted border border-border/80 shadow-md shrink-0">
                  <img
                    src={customCoverUrl.trim() || (currentSubject ? currentSubject.coverImageUrl || getSubjectCover(currentSubject.name).url : '/placeholder.svg')}
                    alt={noteTitle || 'Study Note Cover'}
                    className="h-full w-full object-cover"
                  />
                  {uploadingCover && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin mb-1" />
                      <span className="text-[10px] font-bold text-foreground">Uploading...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-0 w-full">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload an authentic cover page image like a textbook (JPG, PNG, WebP) or use the curriculum subject theme.
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={coverFileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleCoverFileUpload}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverFileInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="rounded-xl h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploadingCover ? 'Uploading Cover...' : 'Upload Cover Image'}
                    </Button>

                    {customCoverUrl.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomCoverUrl('')}
                        className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Reset to Subject Cover
                      </Button>
                    )}
                  </div>

                  {uploadingCover && (
                    <div className="space-y-1 pt-1">
                      <Progress value={uploadCoverProgress} className="h-1.5 w-full" />
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Uploading cover image ({uploadCoverProgress}%)...
                      </span>
                    </div>
                  )}

                  <div className="pt-1">
                    <Input
                      placeholder="Or enter image URL directly (e.g. https://...)..."
                      value={customCoverUrl}
                      onChange={(e) => setCustomCoverUrl(e.target.value)}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Pedagogical Profile Pill */}
            {currentSubject && (
              <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {currentPedagogicalProfile.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                        Subject-Aware Pedagogical Engine
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {currentPedagogicalProfile.focusDescription}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {currentPedagogicalProfile.keyElements.map((elem, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px] h-5 px-2 bg-muted/80">
                      {elem}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STUDIO TABS: 1. Generate & Source | 2. Edit Sections | 3. Student Reader View */}
        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-3 rounded-2xl p-1 bg-muted/60 h-11 max-w-md">
            <TabsTrigger value="input" className="rounded-xl text-xs font-semibold">
              <FolderTree className="h-3.5 w-3.5 mr-1.5" />
              1. Source & Generate
            </TabsTrigger>
            <TabsTrigger value="editor" className="rounded-xl text-xs font-semibold">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              2. Edit Sections ({sections.length})
            </TabsTrigger>
            <TabsTrigger value="preview" className="rounded-xl text-xs font-semibold">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              3. Interactive Reader
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: THREE DEDICATED WORKFLOWS & SETTINGS */}
          <TabsContent value="input" className="space-y-6 animate-fade-in">
            {/* WORKFLOW SELECTOR TABS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option A */}
              <button
                type="button"
                onClick={() => setSelectedWorkflow('workflow_a')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  selectedWorkflow === 'workflow_a'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                    : 'border-border/80 bg-card hover:border-primary/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Library className="h-4 w-4" />
                    </div>
                    {workflowAChapters.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        {workflowAChapters.length} Chapters
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Workflow A: Digital Library Resource
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select a textbook from your library. The system separates it chapter by chapter so you can generate notes for ONE selected chapter.
                  </p>
                </div>
              </button>

              {/* Option B */}
              <button
                type="button"
                onClick={() => setSelectedWorkflow('workflow_b')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  selectedWorkflow === 'workflow_b'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                    : 'border-border/80 bg-card hover:border-primary/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Upload className="h-4 w-4" />
                    </div>
                    {uploadAnalysis && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {uploadAnalysis.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Workflow B: Upload Document (.pdf, .docx, .txt)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload an academic document. Analyzes chapter boundaries automatically. Regenerate for another chapter without re-uploading.
                  </p>
                </div>
              </button>

              {/* Option C */}
              <button
                type="button"
                onClick={() => setSelectedWorkflow('workflow_c')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  selectedWorkflow === 'workflow_c'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                    : 'border-border/80 bg-card hover:border-primary/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <FileText className="h-4 w-4" />
                    </div>
                    {pastedRawText && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {pastedRawText.split(/\s+/).filter(Boolean).length} words
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    Workflow C: Paste Lecture Text
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Paste raw text directly. Strictly treats the entire text as ONE complete chapter or learning unit without unwanted splitting.
                  </p>
                </div>
              </button>

              {/* Option D: Direct JSON / Markdown Import */}
              <button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className="p-4 rounded-2xl border text-left transition-all flex flex-col justify-between border-purple-500/40 bg-gradient-to-br from-purple-500/5 via-card to-background hover:border-purple-500/80 hover:bg-purple-500/10 group shadow-xs cursor-pointer"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileUp className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold">
                      Direct Import
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    Workflow D: Direct JSON / Markdown Import
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Import structured notes or raw Markdown/JSON from course materials. Auto-extracts sections and 100+ MCQs with instant interactive practice exams.
                  </p>
                </div>
              </button>
            </div>

            {/* ======================================================== */}
            {/* WORKFLOW A VIEW: GENERATE FROM LIBRARY RESOURCE          */}
            {/* ======================================================== */}
            {selectedWorkflow === 'workflow_a' && (
              <Card className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-card to-background shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Library className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Workflow A: Library Resource Chapter Extraction
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Select a digital textbook from your EthioSmart library under {currentSubject?.name || 'the selected subject'}.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Select Digital Textbook
                      </Label>
                      <Select
                        value={selectedBookResourceId}
                        onValueChange={(val) => {
                          setSelectedBookResourceId(val);
                          setWorkflowAChapters([]);
                          setSelectedWorkflowAChapter(null);
                        }}
                      >
                        <SelectTrigger className="rounded-xl text-xs h-9">
                          <SelectValue placeholder="Choose a textbook from library..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {availableTextbooks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title} {b.edition ? `(${b.edition})` : ''} - {b.author || 'Author'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      onClick={handleExtractWorkflowAResource}
                      disabled={isExtractingWorkflowA || !selectedBookResourceId}
                      className="rounded-xl h-9 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isExtractingWorkflowA ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Extracting & Separating...
                        </>
                      ) : (
                        <>
                          <FolderTree className="h-4 w-4 mr-1.5" />
                          Analyze & Separate Chapters
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Separated Chapters Grid */}
                  {workflowAChapters.length > 0 && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span>Select ONE Chapter to Generate Study Notes:</span>
                          <Badge variant="outline" className="text-[10px] h-4">
                            {workflowAChapters.length} Chapters Found
                          </Badge>
                        </Label>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleBatchGenerateAllChapters}
                          disabled={isBatchGenerating}
                          className="rounded-xl text-xs h-7 border-purple-500/30 text-purple-600 dark:text-purple-400"
                        >
                          {isBatchGenerating ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Batch Generating ({batchProgress?.current}/{batchProgress?.total})...
                            </>
                          ) : (
                            <>
                              <Zap className="h-3 w-3 mr-1" />
                              Batch Generate All {workflowAChapters.length} Chapters
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                        {workflowAChapters.map((ch, idx) => {
                          const isSelected = selectedWorkflowAChapter?.chapterNumber === ch.chapterNumber;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedWorkflowAChapter(ch)}
                              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-500/10 shadow-xs ring-1 ring-purple-600/30'
                                  : 'border-border/80 bg-card hover:border-purple-500/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                                  Chapter {ch.chapterNumber}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {ch.wordCount.toLocaleString()} words
                                </span>
                              </div>
                              <p className="text-xs font-bold text-foreground line-clamp-2">
                                {ch.chapterTitle}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>~{Math.max(1, Math.ceil(ch.wordCount / 200))} min read</span>
                                {isSelected ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Selected
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Click to select</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ======================================================== */}
            {/* WORKFLOW B VIEW: UPLOAD DOCUMENT (.pdf, .docx, .txt)    */}
            {/* ======================================================== */}
            {selectedWorkflow === 'workflow_b' && (
              <Card className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-card to-background shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Workflow B: Document Upload & Chapter Analysis
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Drag and drop a PDF, Word DOCX, or text file. You can switch between detected chapters without re-uploading.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* File Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={handleDropFile}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                      isDraggingFile
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                        : 'border-border/80 hover:border-blue-500/50 bg-muted/20'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProcessUploadedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        {isUploadingOrAnalyzing ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <FileUp className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-foreground">
                          {uploadedFile ? uploadedFile.name : 'Click to browse or drop your document here'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Supports PDF, Word (.docx), and plain text (.txt). File size up to 40MB.
                        </p>
                      </div>

                      {uploadedFile && (
                        <div className="flex items-center gap-2 pt-1">
                          <Badge variant="outline" className="text-[10px] h-5 border-blue-500/30 text-blue-600 dark:text-blue-400">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </Badge>
                          {uploadAnalysis && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {uploadAnalysis.totalWordCount.toLocaleString()} extracted words
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ANALYSIS RESULTS FOR WORKFLOW B */}
                  {uploadAnalysis && (
                    <div className="space-y-4 pt-3 border-t">
                      {/* Case 1: Multiple chapters detected */}
                      {uploadAnalysis.status === 'multiple_chapters' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Multiple Chapters Detected ({uploadAnalysis.detectedChapters.length}):</span>
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                              Select a chapter to generate (regenerate another chapter anytime)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                            {uploadAnalysis.detectedChapters.map((ch, idx) => {
                              const isSelected = selectedUploadChapter?.chapterNumber === ch.chapterNumber;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedUploadChapter(ch)}
                                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-500/10 shadow-xs ring-1 ring-blue-600/30'
                                      : 'border-border/80 bg-card hover:border-blue-500/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                                      Chapter {ch.chapterNumber}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      {ch.wordCount.toLocaleString()} words
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-foreground line-clamp-2">
                                    {ch.chapterTitle}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>~{Math.max(1, Math.ceil(ch.wordCount / 200))} min read</span>
                                    {isSelected ? (
                                      <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Selected
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">Click to select</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Case 2: Single chapter detected */}
                      {uploadAnalysis.status === 'single_chapter' && (
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Single Chapter Auto-Recognized</span>
                            </div>
                            <p className="text-sm font-bold text-foreground">
                              {uploadAnalysis.suggestedTitle}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {uploadAnalysis.totalWordCount.toLocaleString()} words · Ready for immediate textbook-quality generation.
                            </p>
                          </div>
                          <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs py-1 px-2.5 h-auto self-start sm:self-center">
                            1 Complete Chapter
                          </Badge>
                        </div>
                      )}

                      {/* Case 3: Uncertain structure / Outline */}
                      {uploadAnalysis.status === 'uncertain' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              No explicit chapter numbering was detected in this document. You can generate notes from the entire document as a single learning unit, or pick an outline section below.
                            </span>
                          </div>

                          {uploadAnalysis.outlineItems.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">
                                Document Outline Sections:
                              </Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                                {uploadAnalysis.outlineItems.map((item, idx) => {
                                  const isSelected = selectedOutlineItemIndex === idx;
                                  return (
                                    <div
                                      key={idx}
                                      onClick={() => setSelectedOutlineItemIndex(isSelected ? null : idx)}
                                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                        isSelected
                                          ? 'border-blue-500 bg-blue-500/10 shadow-xs'
                                          : 'border-border/80 bg-card hover:border-blue-500/30'
                                      }`}
                                    >
                                      <p className="text-xs font-bold text-foreground truncate">
                                        {item.title}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                        {item.preview}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ======================================================== */}
            {/* WORKFLOW C VIEW: PASTE TEXT (STRICTLY SINGLE CHAPTER)   */}
            {/* ======================================================== */}
            {selectedWorkflow === 'workflow_c' && (
              <Card className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-background shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Workflow C: Direct Text Paste (Single Chapter / Lesson)
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Paste lecture transcripts or study materials. Strictly treated as ONE cohesive chapter without unwanted chapter splitting.
                      </CardDescription>
                    </div>

                    {/* Quick Sample Selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">Load Sample:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSampleNotes('mathematics')}
                        className="rounded-lg text-[10px] h-6 px-2"
                      >
                        Math
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSampleNotes('psychology')}
                        className="rounded-lg text-[10px] h-6 px-2"
                      >
                        Psychology
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSampleNotes('physics')}
                        className="rounded-lg text-[10px] h-6 px-2"
                      >
                        Physics
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadSampleNotes('computer')}
                        className="rounded-lg text-[10px] h-6 px-2"
                      >
                        CS
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Chapter / Topic Title
                    </Label>
                    <Input
                      placeholder="e.g. Chapter 4: Cellular Respiration & ATP Production"
                      value={pastedTitleInput}
                      onChange={(e) => setPastedTitleInput(e.target.value)}
                      className="rounded-xl text-xs sm:text-sm font-medium h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Raw Learning Material / Lecture Notes
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        {pastedRawText.split(/\s+/).filter(Boolean).length} words · ~
                        {Math.max(1, Math.ceil(pastedRawText.split(/\s+/).filter(Boolean).length / 200))} min read
                      </span>
                    </div>
                    <Textarea
                      placeholder="Paste your raw textbook chapter text, lecture transcript, or study summary here..."
                      value={pastedRawText}
                      onChange={(e) => setPastedRawText(e.target.value)}
                      rows={10}
                      className="rounded-2xl text-xs sm:text-sm font-mono leading-relaxed"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ======================================================== */}
            {/* UNIFIED GENERATION SETTINGS PANEL (ALL WORKFLOWS)        */}
            {/* ======================================================== */}
            <Card className="rounded-3xl border bg-card shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Teaching-First Generation Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize the pedagogical depth, target audience, and output language for examination success.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Depth */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Explanation Depth
                    </Label>
                    <Select
                      value={generationDepth}
                      onValueChange={(val: any) => setGenerationDepth(val)}
                    >
                      <SelectTrigger className="rounded-xl text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="detailed">
                          <span className="font-semibold">Detailed Teaching Notes (Default)</span>
                        </SelectItem>
                        <SelectItem value="balanced">
                          <span>Balanced Study Notes</span>
                        </SelectItem>
                        <SelectItem value="concise">
                          <span>Concise Revision Summary</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Target Audience
                    </Label>
                    <Select
                      value={generationAudience}
                      onValueChange={(val: any) => setGenerationAudience(val)}
                    >
                      <SelectTrigger className="rounded-xl text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="beginner">
                          <span className="font-semibold">Beginner / New to Subject (Default)</span>
                        </SelectItem>
                        <SelectItem value="intermediate">
                          <span>Intermediate (Rigorous Depth)</span>
                        </SelectItem>
                        <SelectItem value="advanced">
                          <span>Advanced / Exam Mastery</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Languages className="h-3 w-3" />
                      <span>Output Language</span>
                    </Label>
                    <Select
                      value={generationLanguage}
                      onValueChange={(val) => setGenerationLanguage(val)}
                    >
                      <SelectTrigger className="rounded-xl text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Amharic">Amharic (አማርኛ)</SelectItem>
                        <SelectItem value="Oromo">Afaan Oromoo</SelectItem>
                        <SelectItem value="Tigrinya">Tigrinya (ትግርኛ)</SelectItem>
                        <SelectItem value="French">French (Français)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AI Prompt & Custom Guidance Panel */}
                <div className="rounded-2xl border border-primary/20 bg-muted/30 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label className="text-xs font-bold text-foreground">
                        AI Generation Prompt & Custom Instructions
                      </Label>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-fit">
                      <ShieldCheck className="h-3 w-3" />
                      Strict Source Grounding & +40% Depth Active
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instruct the AI on focus, tone, or specific concepts. The AI model reads and deeply understands your provided resource first, ensuring all definitions, explanations, and review problems are strictly derived from the text without outside filler.
                  </p>

                  <Textarea
                    placeholder="Enter your instructions for the AI (e.g. 'Explain each learning theory in simple English with real-life examples, focus on Pavlov and Skinner experiments, highlight exam misconceptions, exclude unrelated formulas, keep Grade 12 level')..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="rounded-xl text-xs resize-y bg-background focus:ring-1 focus:ring-primary"
                  />

                  {/* Preset Quick Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Quick Instruction Presets (Click to insert):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        {
                          label: '🎯 Strictly Ground in Source Text',
                          text: 'Strictly confine all definitions, examples, and questions to the source material. Do not include outside theories or unmentioned formulas.',
                        },
                        {
                          label: '📈 +40% In-Depth Content',
                          text: 'Increase explanatory note depth and size by 40%. Provide rich, comprehensive multi-paragraph explanations breaking down mechanisms, context, nuances, and real-world examples.',
                        },
                        {
                          label: '🎨 Color Key Terms & Highlights',
                          text: 'Aggressively highlight and bold (**important concept**, **governing law**, **key term**) all critical definitions and exam takeaways so they are rendered as colorful, high-contrast visual pills.',
                        },
                        {
                          label: '❓ Interactive MCQs per Topic',
                          text: 'For every topic/section, generate 2-3 interactive Multiple Choice Questions (MCQs) with 4 plausible options (A, B, C, D), correct answer letter, hints, and detailed explanations of why the answer is correct.',
                        },
                        {
                          label: '📘 Simple English for Grade 12',
                          text: 'Use clear, accessible English suitable for Grade 12 students. Break down complex academic terms into plain explanations.',
                        },
                        {
                          label: '💡 Real-World Practical Examples',
                          text: 'Provide concrete, intuitive everyday examples for every theoretical mechanism and concept.',
                        },
                        {
                          label: '⚠️ Common Exam Pitfalls',
                          text: 'Highlight frequent exam traps, common misconceptions, and mark-losing errors with clear distinctions.',
                        },
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            setCustomInstructions((prev) => {
                              const trimmed = prev.trim();
                              if (!trimmed) return preset.text;
                              if (trimmed.includes(preset.text)) return trimmed;
                              return `${trimmed}. ${preset.text}`;
                            });
                          }}
                          className="text-[10px] px-2.5 py-1 rounded-lg border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all cursor-pointer font-medium"
                        >
                          {preset.label}
                        </button>
                      ))}
                      {customInstructions && (
                        <button
                          type="button"
                          onClick={() => setCustomInstructions('')}
                          className="text-[10px] px-2 py-1 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all cursor-pointer font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Source Material Status Indicator */}
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground">Target Material:</span>
                      {selectedWorkflow === 'workflow_a' ? (
                        <span>
                          {selectedWorkflowAChapter
                            ? `Chapter ${selectedWorkflowAChapter.chapterNumber}: ${selectedWorkflowAChapter.chapterTitle} (${selectedWorkflowAChapter.wordCount.toLocaleString()} words)`
                            : 'No chapter selected yet'}
                        </span>
                      ) : selectedWorkflow === 'workflow_b' ? (
                        <span>
                          {selectedUploadChapter
                            ? `Chapter ${selectedUploadChapter.chapterNumber}: ${selectedUploadChapter.chapterTitle}`
                            : uploadedFile
                            ? `${uploadedFile.name} (${uploadAnalysis?.totalWordCount.toLocaleString() || 0} words)`
                            : 'No document uploaded yet'}
                        </span>
                      ) : (
                        <span>
                          {pastedRawText.trim()
                            ? `Pasted text (${pastedRawText.trim().split(/\s+/).filter(Boolean).length} words)`
                            : 'No text pasted yet'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ AI Ingestion & Pedagogical Grounding Ready
                    </span>
                  </div>
                </div>

                {/* PRIMARY ACTION BUTTON */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-muted-foreground">
                    {isGenerating ? (
                      <span className="text-primary font-medium flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Stage {generationStage}/5: {generationStageText}
                      </span>
                    ) : (
                      <span>
                        Builds comprehensive interactive study notes strictly grounded in the resource with interactive check cards and exercises.
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    onClick={() => {
                      if (selectedWorkflow === 'workflow_a') handleGenerateWorkflowA();
                      else if (selectedWorkflow === 'workflow_b') handleGenerateWorkflowB();
                      else handleGenerateWorkflowC();
                    }}
                    disabled={isGenerating}
                    className="rounded-2xl bg-gradient-to-r from-primary via-purple-600 to-indigo-600 hover:from-primary/90 hover:to-indigo-700 text-white font-bold shadow-md h-12 px-7 w-full sm:w-auto text-sm shrink-0"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating ({generationStage}/5)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI Generate In-Depth Study Notes from Resource
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: EDIT SECTIONS & FINE-TUNE */}
          <TabsContent value="editor" className="space-y-5 animate-fade-in">
            {/* Textbook Quality & Completeness Validation Audit Card */}
            <Card className="rounded-3xl border shadow-xs bg-gradient-to-br from-card via-card to-primary/5 border-primary/25">
              <CardContent className="p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm shadow-xs ${
                        completenessValidation.status === 'exemplary'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : completenessValidation.status === 'good'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {completenessValidation.score}%
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          Textbook-Quality Completeness Audit
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] h-4 px-1.5 font-bold ${
                            completenessValidation.status === 'exemplary'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {completenessValidation.status.toUpperCase()} QUALITY
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completenessValidation.feedbackSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAutoEnrichToTextbookQuality}
                      className="rounded-xl text-xs h-8 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                      Auto-Enrich to Textbook Quality
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('preview')}
                      className="rounded-xl text-xs h-8 bg-primary text-primary-foreground"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Student Reader
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chapter Summary & Learning Outcomes */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Chapter Overview & Learning Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Executive Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    placeholder="Comprehensive overview of the chapter..."
                    className="rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Mastery Learning Outcomes</Label>
                  <div className="space-y-1.5">
                    {learningOutcomes.map((outcome, idx) => (
                      <Input
                        key={idx}
                        value={outcome}
                        onChange={(e) => {
                          const updated = [...learningOutcomes];
                          updated[idx] = e.target.value;
                          setLearningOutcomes(updated);
                        }}
                        className="rounded-lg text-xs h-8"
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SECTIONS LIST */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Chapter Sections ({sections.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Reorder, edit explanations, formulas, or review exercises with Show/Hide solutions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddSection}
                  className="rounded-xl text-xs h-8 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Section
                </Button>
              </div>

              {sections.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed text-muted-foreground text-xs space-y-2">
                  <p>No interactive sections generated yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('input')}
                    className="rounded-xl text-xs"
                  >
                    Go to Workflow to Generate
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((sec, idx) => {
                    const isCollapsed = collapsedSections.has(sec.id);
                    return (
                      <Card key={sec.id} className="rounded-2xl border shadow-xs overflow-hidden">
                        <div className="p-3 bg-muted/40 border-b flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-bold text-muted-foreground shrink-0">
                              #{idx + 1}
                            </span>
                            <Input
                              value={sec.title}
                              onChange={(e) => handleUpdateSection(idx, { title: e.target.value })}
                              className="h-7 text-xs font-bold rounded-lg bg-background"
                            />
                            {sec.isImportant && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 shrink-0">
                                High-Yield
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveSection(idx, 'up')}
                              disabled={idx === 0}
                              className="h-6 w-6 p-0 rounded"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveSection(idx, 'down')}
                              disabled={idx === sections.length - 1}
                              className="h-6 w-6 p-0 rounded"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSectionCollapse(sec.id)}
                              className="h-6 w-6 p-0 rounded"
                            >
                              {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSection(idx)}
                              className="h-6 w-6 p-0 rounded text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <CardContent className="p-4 space-y-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold text-muted-foreground">
                                Detailed Academic Content (Markdown & Formulas)
                              </Label>
                              <Textarea
                                value={sec.content}
                                onChange={(e) => handleUpdateSection(idx, { content: e.target.value })}
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
                    Searchable terms and flashcard definitions.
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
                      <div key={tIdx} className="p-3 rounded-xl border bg-muted/20 space-y-2 relative">
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
                          placeholder="Term..."
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

          {/* TAB 3: STRUCTURED NOTE READER (STUDENT VIEW) */}
          <TabsContent value="preview" className="space-y-4 animate-fade-in">
            {/* Top Reader Action Bar */}
            <div className="p-3.5 rounded-2xl bg-card border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary text-xs py-0.5 px-2">
                  Textbook Reader Mode
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Exact student experience with Themes, Edge-to-Edge layout, 3D Flashcards, and Show/Hide solutions.
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('editor')}
                  className="rounded-xl h-8 text-xs font-semibold"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  Edit in Studio
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutoEnrichToTextbookQuality}
                  className="rounded-xl h-8 text-xs font-semibold border-purple-500/30 text-purple-600 dark:text-purple-400"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Auto-Enrich Quality
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleSaveAndPublish('published')}
                  disabled={isSaving}
                  className="rounded-xl h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Publish to Library
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Embedded Reader (Full width edge-to-edge) */}
            <div className="rounded-2xl sm:rounded-3xl border bg-card p-1 sm:p-4 shadow-sm min-h-[600px] w-full">
              <InteractiveShortNoteReader
                book={previewBook}
                onBack={() => setActiveTab('input')}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* AUTHENTIC 5-STAGE GENERATION PROGRESS OVERLAY */}
        {isGenerating && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <Card className="w-full max-w-lg rounded-3xl border border-primary/30 bg-card shadow-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Generating Textbook-Quality Study Notes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Teaching-First Engine · {currentPedagogicalProfile.name}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-purple-600 transition-all duration-500 rounded-full"
                    style={{ width: `${(generationStage / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Stage {generationStage} of 5</span>
                  <span>{generationStage * 20}%</span>
                </div>
              </div>

              {/* Active Stage Indicator */}
              <div className="p-3 rounded-2xl bg-muted/40 border space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{generationStageText}</span>
                </div>
              </div>

              {/* 5-Step Visual Checklist */}
              <div className="space-y-2 text-xs">
                {[
                  'Reading & indexing source chapter material',
                  `Preparing ${currentPedagogicalProfile.name} curriculum focus`,
                  'Generating teaching-first explanations & worked examples',
                  'Auditing completeness against 10-element textbook standards',
                  'Finalizing interactive note reader with Show/Hide solutions',
                ].map((step, idx) => {
                  const stepNum = idx + 1;
                  const isDone = generationStage > stepNum;
                  const isCurrent = generationStage === stepNum;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 transition-all ${
                        isDone
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : isCurrent
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground/60'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/40 shrink-0 flex items-center justify-center text-[9px]">
                          {stepNum}
                        </div>
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
        {/* BROWSE & EDIT EXISTING STUDY NOTES DIALOG */}
        <Dialog open={browseNotesOpen} onOpenChange={setBrowseNotesOpen}>
          <DialogContent className="max-w-3xl rounded-3xl p-5 sm:p-6 max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <FolderOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span>Existing Study Notes ({existingNotesList.length})</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select any existing study note to load into the Studio for editing, updating content, or uploading a cover image.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search existing notes by title, subject, or chapter..."
                  value={existingNotesSearch}
                  onChange={(e) => setExistingNotesSearch(e.target.value)}
                  className="pl-9 rounded-xl text-xs sm:text-sm h-10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[250px]">
              {loadingExistingNotes ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">Loading existing study notes...</span>
                </div>
              ) : filteredExistingNotes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="font-semibold">No study notes found.</p>
                  <p className="text-[11px]">No notes match your search or none have been published yet.</p>
                </div>
              ) : (
                filteredExistingNotes.map((note) => {
                  const effectiveCoverUrl =
                    note.coverImageUrl ||
                    (note.subjectName ? getSubjectCover(note.subjectName).url : '/placeholder.svg');
                  const isCurrent = editNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-border/80 bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="aspect-[4/3] w-14 sm:w-16 rounded-xl overflow-hidden bg-muted border shrink-0">
                          <img
                            src={effectiveCoverUrl}
                            alt={note.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate max-w-sm">
                              {note.title}
                            </span>
                            {note.status && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  note.status === 'published'
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                }`}
                              >
                                {note.status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <span className="font-medium text-primary">
                              {note.subjectName || 'Curriculum Subject'}
                            </span>
                            {note.sections && (
                              <span>• {note.sections.length} topics</span>
                            )}
                            {note.departmentName && (
                              <span>• {note.departmentName}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant={isCurrent ? 'secondary' : 'default'}
                          onClick={() => {
                            setBrowseNotesOpen(false);
                            navigate(`/dashboard/admin/shortnotes/edit/${note.id}`);
                          }}
                          className={`rounded-xl text-xs font-semibold h-8 px-3 ${
                            isCurrent
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          }`}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          <span>{isCurrent ? 'Currently Editing' : 'Edit Note'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleNoteStatusFromList(note)}
                          disabled={listActionNoteId === note.id}
                          title={note.status === 'published' ? 'Unpublish (move to draft)' : 'Publish note'}
                          className={`rounded-xl text-xs font-semibold h-8 px-3 ${
                            note.status === 'published'
                              ? 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
                              : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                          }`}
                        >
                          {listActionNoteId === note.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : note.status === 'published' ? (
                            <GlobeLock className="h-3 w-3 mr-1" />
                          ) : (
                            <Globe className="h-3 w-3 mr-1" />
                          )}
                          <span>{note.status === 'published' ? 'Draft' : 'Publish'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setNoteToDeleteFromList(note)}
                          disabled={listActionNoteId === note.id}
                          title="Delete note"
                          className="rounded-xl text-xs font-semibold h-8 px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Note (from picker list) Confirmation Dialog */}
        <AlertDialog open={Boolean(noteToDeleteFromList)} onOpenChange={(o) => !o && setNoteToDeleteFromList(null)}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete This Study Note?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete &quot;{noteToDeleteFromList?.title}&quot;?
                All sections, learning outcomes, definitions, and exercises in this note will be erased.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" disabled={Boolean(listActionNoteId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteNoteFromList();
                }}
                disabled={Boolean(listActionNoteId)}
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-white font-semibold"
              >
                {listActionNoteId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Note
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Current Note Confirmation Dialog */}
        <AlertDialog open={deleteNoteDialogOpen} onOpenChange={setDeleteNoteDialogOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete This Study Note?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete &quot;{noteTitle}&quot;?
                All sections, learning outcomes, definitions, and exercises in this note will be erased.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCurrentNote}
                disabled={isDeletingNote}
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-white font-semibold"
              >
                {isDeletingNote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete Note
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Shortnote Import Dialog */}
        <ImportShortnoteDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          defaultDepartmentId={selectedDeptId !== 'all' ? selectedDeptId : undefined}
          defaultSubjectId={selectedSubjectId || undefined}
          onLoadToStudio={(draft) => {
            handleLoadImportedData(draft as any);
          }}
          onImportSuccess={(newBookId, createdExamId) => {
            toast({
              title: 'Import Complete! 🎉',
              description: `Shortnote saved to library with ${createdExamId ? 'linked interactive exam.' : 'all interactive sections.'}`,
            });
            navigate(`/dashboard/books/${newBookId}`);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

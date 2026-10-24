import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Upload,
  FileText,
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  Plus,
  Minus,
  Check,
  Save,
  Download,
  ArrowRight,
  ExternalLink,
  Layers,
  History,
  Info,
  Clock,
  ArrowUpDown,
  BookOpen,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  Search,
  Target,
  Lightbulb,
  Settings,
  KeyRound,
} from 'lucide-react';
import { AIProviderSettingsDialog } from '@/components/admin/AIProviderSettingsDialog';
import { cn } from '@/lib/utils';
import { getOfflineBook } from '@/lib/offline-books';
import {
  AIProviderId,
  Difficulty,
  Language,
  NormalizedQuestion,
  ProviderStatusInfo,
  QuestionType,
  AIGenerationJob
} from '@/types/ai-generator';
import {
  getAIProviderStatuses,
  generateBatchCall,
  extractTextFromFile,
  extractDocumentFromFile,
  saveJobToFirestore,
  getRecentJobs,
  saveQuestionsToExam,
  detectDuplicateQuestions
} from '@/lib/ai-generator-service';
import {
  detectScopeFromPrompt,
  parsePageRange,
  filterPagesByRange,
  filterDelimitedTextByRange,
  filterContentByChapter,
  ExtractedPageItem
} from '@/lib/prompt-scope-extractor';
import { getDepartments } from '@/lib/departments';
import { getSubjects, getChapters } from '@/lib/subjects';
import { getExamsByCreator, createExam } from '@/lib/firebase-exams';
import { Department, Exam } from '@/integrations/firebase/types';
import { Subject, Chapter } from '@/types/subject';
import { Book } from '@/types/book';
import { getBooks } from '@/lib/books';

const PROMPT_INSTRUCTION_CHIPS = [
  { label: '🏛️ Concept-Based (No "According to...")', text: 'Questions must be self-contained and assess concepts directly without phrases like "According to the text..." or "As mentioned in the document...".' },
  { label: '📘 Foundational Concepts', text: 'Cover essential definitions, fundamental concepts, and core principles.' },
  { label: '🌍 Real-World Scenarios', text: 'Include realistic scenario-based questions with practical problem solving.' },
  { label: '🎓 University Rigor', text: 'Questions should match undergraduate university academic rigor.' },
  { label: '✨ Educational Emojis', text: 'Use educational emojis (📘, ✅, ❌, 💡, 🧠, 🌍, ⚠️, 🎯) in explanations.' },
  { label: '⚖️ Balanced Difficulties', text: 'Include balanced questions across Easy (recall), Medium (application), and Challenging (analysis).' },
  { label: '🔍 Distractor Analysis', text: 'Explain why incorrect options are wrong and clarify common misconceptions.' },
  { label: '📝 Model Answers & Criteria', text: 'For short answers, provide model answers with essential keywords and grading criteria.' }
];

const PROMPT_PRESETS = [
  {
    id: 'comprehensive',
    name: 'Comprehensive Academic Standard',
    description: 'Undergraduate rigor, resource-independent concept questions, educational emojis, false-correction, and model grading criteria',
    text: 'Generate high-quality, academically rigorous examination questions at undergraduate university level. Use learning materials strictly as sources of knowledge, never referencing texts, chapters, or files in question wording. Cover essential definitions, fundamental principles, and real-world problem scenarios. Ensure all answers are scientifically accurate and provide thorough explanations enriched with educational emojis (📘, ✅, ❌, 💡, 🧠, 🌍, ⚠️, 🎯). For False statements, provide the corrected statement. For short answers, include model answers with key grading criteria.'
  },
  {
    id: 'foundational',
    name: 'Conceptual & Theory Focus',
    description: 'Focus on core definitions, foundational concepts, and theoretical principles',
    text: 'Focus on core definitions, foundational concepts, and theoretical principles. Explain why the correct answer is right and clarify common student misconceptions with pedagogical emojis (📘, ✅, 💡).'
  },
  {
    id: 'real_world',
    name: 'Real-World Case Scenarios',
    description: 'Practical scenario-based problem solving and decision making',
    text: 'Include real-world application questions with scenario-based problem solving and critical analytical reasoning at university rigor (🌍, 🧠, 🎯).'
  }
];

export default function AdminAIGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Active view tab: 'configure' | 'progress' | 'review' | 'history'
  const [activeTab, setActiveTab] = useState<'configure' | 'progress' | 'review' | 'history'>('configure');

  // AI Provider Settings Modal
  const [showAISettingsDialog, setShowAISettingsDialog] = useState(false);

  // Provider health statuses
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatusInfo[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const configuredProvidersCount = useMemo(() => providerStatuses.filter(s => s.configured).length, [providerStatuses]);

  // Departments, Subjects, Existing Exams
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [existingExams, setExistingExams] = useState<Exam[]>([]);

  // Step 1: Source Material Selector Mode: 'book' | 'upload' | 'topic'
  const [sourceType, setSourceType] = useState<'book' | 'upload' | 'topic'>('book');
  const [topic, setTopic] = useState('');
  const [notesText, setNotesText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractedFileText, setExtractedFileText] = useState('');
  const [isExtractingFile, setIsExtractingFile] = useState(false);

  // Digital Book Library Source
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('none');
  const [bookScopeMode, setBookScopeMode] = useState<'entire' | 'chapter' | 'page_range'>('entire');
  const [selectedBookChapter, setSelectedBookChapter] = useState<string>('all');
  const [bookPageRange, setBookPageRange] = useState<string>('');
  const [extractedBookText, setExtractedBookText] = useState<string>('');
  const [extractedBookPages, setExtractedBookPages] = useState<ExtractedPageItem[]>([]);
  const [isExtractingBook, setIsExtractingBook] = useState<boolean>(false);

  // Uploaded Document Scope & Pages
  const [extractedFilePages, setExtractedFilePages] = useState<ExtractedPageItem[]>([]);
  const [fileScopeMode, setFileScopeMode] = useState<'entire' | 'page_range'>('entire');
  const [filePageRange, setFilePageRange] = useState<string>('');

  // Step 2: AI Command / Prompt
  const [prompt, setPrompt] = useState(
    'Generate high-quality, academically rigorous examination questions at undergraduate university level. Cover essential definitions, fundamental principles, and real-world problem scenarios. Ensure all answers are scientifically accurate and provide thorough explanations enriched with educational emojis (📘, ✅, ❌, 💡, 🧠, 🌍, ⚠️, 🎯).'
  );

  // Automatic Prompt Intelligence: Identify page ranges or chapters requested inside the prompt
  const detectedScope = useMemo(() => detectScopeFromPrompt(prompt), [prompt]);

  // Unified Effective Target Page Range: explicit UI input has highest precedence; prompt detection is used automatically if no manual UI override
  const effectivePageRange = useMemo(() => {
    if (sourceType === 'book') {
      if (bookScopeMode === 'page_range' && bookPageRange.trim()) {
        return bookPageRange.trim();
      }
      if (detectedScope.detectedPageRange) {
        return detectedScope.detectedPageRange;
      }
      return '';
    }
    if (sourceType === 'upload') {
      if (fileScopeMode === 'page_range' && filePageRange.trim()) {
        return filePageRange.trim();
      }
      if (detectedScope.detectedPageRange) {
        return detectedScope.detectedPageRange;
      }
      return '';
    }
    return detectedScope.detectedPageRange || '';
  }, [sourceType, bookScopeMode, bookPageRange, fileScopeMode, filePageRange, detectedScope.detectedPageRange]);

  // Unified Effective Target Chapter
  const effectiveChapter = useMemo(() => {
    if (sourceType === 'book') {
      if (bookScopeMode === 'chapter' && selectedBookChapter !== 'all') {
        return selectedBookChapter;
      }
      if (detectedScope.detectedChapter) {
        return detectedScope.detectedChapter;
      }
      return '';
    }
    return detectedScope.detectedChapter || '';
  }, [sourceType, bookScopeMode, selectedBookChapter, detectedScope.detectedChapter]);

  const togglePromptChip = (chipText: string) => {
    if (prompt.includes(chipText)) {
      setPrompt(prompt.replace(chipText, '').replace(/\s+/g, ' ').trim());
    } else {
      setPrompt(prev => prev ? `${prev.trim()} ${chipText}` : chipText);
    }
  };

  // UI state for advanced settings & review filters
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'mcq' | 'truefalse' | 'shortanswer'>('all');
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');

  // Step 3: Question Settings & Distribution
  const [mcqCount, setMcqCount] = useState<number>(7);
  const [tfCount, setTfCount] = useState<number>(8);
  const [shortCount, setShortCount] = useState<number>(0);

  // Total count automatically calculated from individual type counts
  const totalCount = useMemo(() => {
    return Math.max(1, (mcqCount || 0) + (tfCount || 0) + (shortCount || 0));
  }, [mcqCount, tfCount, shortCount]);

  // Selected types derived from active counts
  const selectedTypes = useMemo<QuestionType[]>(() => {
    const types: QuestionType[] = [];
    if (mcqCount > 0) types.push('mcq');
    if (tfCount > 0) types.push('truefalse');
    if (shortCount > 0) types.push('shortanswer');
    return types.length > 0 ? types : ['mcq'];
  }, [mcqCount, tfCount, shortCount]);

  const [difficulty, setDifficulty] = useState<Difficulty>('Mixed');
  const [language, setLanguage] = useState<Language>('English');
  const [providerPriority, setProviderPriority] = useState<AIProviderId[]>([
    'gemini',
    'groq',
    'openrouter',
    'huggingface'
  ]);

  // Step 4: Exam Destination
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new');
  const [examTitle, setExamTitle] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('none');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('none');
  const [examType, setExamType] = useState<'normal' | 'practice'>('normal');
  const [selectedExistingExamId, setSelectedExistingExamId] = useState<string>('');

  // Generation Job State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [currentJobId, setCurrentJobId] = useState<string>('');
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [activeProvider, setActiveProvider] = useState<AIProviderId | null>(null);
  const [fallbackBanner, setFallbackBanner] = useState<string | null>(null);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<NormalizedQuestion[]>([]);
  const [recentJobsList, setRecentJobsList] = useState<AIGenerationJob[]>([]);

  // Load initial metadata & provider health
  const refreshStatuses = async () => {
    setLoadingStatuses(true);
    try {
      const statuses = await getAIProviderStatuses();
      setProviderStatuses(statuses);
    } catch (err: any) {
      console.warn('Could not refresh statuses:', err);
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    refreshStatuses();
    const handleSettingsUpdated = () => refreshStatuses();
    window.addEventListener('exampro_ai_settings_updated', handleSettingsUpdated);

    getDepartments().then(setDepartments).catch(console.error);
    getSubjects().then(setSubjects).catch(console.error);
    getBooks({}, 'admin').then(setLibraryBooks).catch(console.error);
    if (user?.uid) {
      getExamsByCreator(user.uid).then(setExistingExams).catch(console.error);
      getRecentJobs(user.uid).then(setRecentJobsList).catch(console.error);
    }

    // Read URL query parameters (e.g. ?source=book&bookId=...&deptId=...&subjectId=...&examId=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const qSource = params.get('source');
      const qBookId = params.get('bookId');
      const qDeptId = params.get('deptId');
      const qSubjectId = params.get('subjectId');
      const qExamId = params.get('examId');

      if (qDeptId) setSelectedDepartmentId(qDeptId);
      if (qSubjectId) setSelectedSubjectId(qSubjectId);
      if (qExamId) {
        setDestinationMode('existing');
        setSelectedExistingExamId(qExamId);
      }
      if (qSource === 'book' || qBookId) {
        setSourceType('book');
        if (qBookId) {
          setSelectedBookId(qBookId);
        }
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    return () => {
      window.removeEventListener('exampro_ai_settings_updated', handleSettingsUpdated);
    };
  }, [user]);

  // Selected library book
  const selectedBook = useMemo(() => {
    return libraryBooks.find(b => b.id === selectedBookId) || null;
  }, [libraryBooks, selectedBookId]);

  // Filtered books based on selected department and subject
  const filteredLibraryBooks = useMemo(() => {
    return libraryBooks.filter(b => {
      if (selectedDepartmentId !== 'all' && b.departmentId !== selectedDepartmentId) return false;
      if (selectedSubjectId !== 'none' && b.subjectId !== selectedSubjectId) return false;
      return true;
    });
  }, [libraryBooks, selectedDepartmentId, selectedSubjectId]);

  // Extract content from selected book with multi-layer fallback (offline cache -> drive API -> curriculum outline)
  const handleExtractBookContent = async (bookToExtract?: Book | null) => {
    const target = bookToExtract || selectedBook;
    if (!target) {
      toast({
        title: 'No Resource Selected',
        description: 'Please select a book or note from your library.',
        variant: 'destructive',
      });
      return;
    }

    setIsExtractingBook(true);

    // Ensure exam metadata is populated
    setTopic(target.title);
    if (!examTitle.trim() || examTitle.endsWith(' Examination') || examTitle.endsWith(' Exam')) {
      setExamTitle(`${target.title} Examination`);
    }

    // Layer 1: Check offline IndexedDB cache for instant local extraction
    try {
      const offlineRecord = await getOfflineBook(target.id);
      if (offlineRecord && offlineRecord.blob) {
        const file = new File([offlineRecord.blob], `${target.title}.pdf`, { type: 'application/pdf' });
        const doc = await extractDocumentFromFile(file);
        if (doc && doc.fullText.trim().length > 50) {
          setExtractedBookText(doc.fullText);
          setExtractedBookPages(doc.pages);
          toast({
            title: 'Offline Book Content Loaded',
            description: `Loaded ${doc.totalPages} page(s) (${doc.fullText.length.toLocaleString()} characters) with real page numbers.`,
          });
          setIsExtractingBook(false);
          return;
        }
      }
    } catch (offlineErr) {
      console.log('[AI Generator] Offline extraction note:', offlineErr);
    }

    // Layer 1.5: Direct Drive PDF Download for exact page extraction
    if (target.driveFileId) {
      try {
        const dlRes = await fetch(`/api/drive/download?fileId=${target.driveFileId}`);
        if (dlRes.ok) {
          const blob = await dlRes.blob();
          const file = new File([blob], `${target.title}.pdf`, { type: 'application/pdf' });
          const doc = await extractDocumentFromFile(file);
          if (doc && doc.fullText.trim().length > 50) {
            setExtractedBookText(doc.fullText);
            setExtractedBookPages(doc.pages);
            toast({
              title: 'Book Content Loaded',
              description: `Loaded ${doc.totalPages} page(s) (${doc.fullText.length.toLocaleString()} characters) with real page numbers.`,
            });
            setIsExtractingBook(false);
            return;
          }
        }
      } catch (dlErr) {
        console.warn('[AI Generator] Drive binary download fallback note:', dlErr);
      }
    }

    // Layer 2: Drive bridge extraction endpoint
    if (target.driveFileId) {
      try {
        const res = await fetch('/api/drive/extract-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: target.driveFileId,
            pageRange: bookScopeMode === 'page_range' ? bookPageRange : undefined,
            chapter: bookScopeMode === 'chapter' && selectedBookChapter !== 'all' ? selectedBookChapter : undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.text && data.text.trim().length > 50) {
            setExtractedBookText(data.text);
            if (Array.isArray(data.chunks) && data.chunks.length > 0) {
              setExtractedBookPages(data.chunks.map((c: any, idx: number) => ({
                pageNumber: c.pageNumber || idx + 1,
                text: c.text
              })));
            }
            toast({
              title: 'Book Content Extracted',
              description: `Loaded ${data.text.length.toLocaleString()} characters of material from "${target.title}".`,
            });
            setIsExtractingBook(false);
            return;
          }
        }
      } catch (err: any) {
        console.warn('[AI Generator] Drive bridge extraction error:', err);
      }
    }

    // Layer 3: Guaranteed Syllabus / Curriculum Outline Fallback (AI generates based on topics)
    const chapterList = Array.isArray(target.chapterLabels) && target.chapterLabels.length > 0
      ? `\nKey Units / Chapters:\n${target.chapterLabels.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`
      : '';
    const summary = [
      `[Curriculum Resource: "${target.title}"]`,
      target.subjectName ? `Subject: ${target.subjectName}` : '',
      target.departmentName ? `Department: ${target.departmentName}` : '',
      target.description ? `Overview: ${target.description}` : '',
      chapterList
    ].filter(Boolean).join('\n\n');

    setExtractedBookText(summary);
    setExtractedBookPages([]);
    toast({
      title: 'Resource Outline Ready',
      description: `Loaded syllabus & outline for "${target.title}". AI will generate questions based on this curriculum.`,
    });
    setIsExtractingBook(false);
  };

  // Auto-extract content and auto-fill info when book selection changes
  useEffect(() => {
    if (selectedBookId && selectedBookId !== 'none') {
      const found = libraryBooks.find(b => b.id === selectedBookId);
      if (found) {
        // Auto-fill exam info from selected resource
        setTopic(found.title);
        setExamTitle(`${found.title} Examination`);
        if (found.subjectId) {
          setSelectedSubjectId(found.subjectId);
        }
        if (found.departmentIds && found.departmentIds.length > 0) {
          setSelectedDepartmentId(found.departmentIds[0]);
        } else if (found.departmentId) {
          setSelectedDepartmentId(found.departmentId);
        }
        handleExtractBookContent(found);
      }
    } else {
      setExtractedBookText('');
      setExtractedBookPages([]);
    }
  }, [selectedBookId]);

  // Filtered subjects based on selected department
  const filteredSubjects = useMemo(() => {
    if (selectedDepartmentId === 'all') return subjects;
    return subjects.filter(s =>
      !s.departmentIds || s.departmentIds.length === 0 || s.departmentIds.includes(selectedDepartmentId)
    );
  }, [subjects, selectedDepartmentId]);

  // Selected subject's chapters
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (selectedSubjectId && selectedSubjectId !== 'none') {
      getChapters(selectedSubjectId)
        .then(setAvailableChapters)
        .catch(() => setAvailableChapters([]));
    } else {
      setAvailableChapters([]);
    }
  }, [selectedSubjectId]);

  // Duplicate questions detector
  const duplicateIndices = useMemo(() => {
    return detectDuplicateQuestions(generatedQuestions);
  }, [generatedQuestions]);

  // Filtered questions for the Review tab by questionType and search query
  const filteredReviewQuestions = useMemo(() => {
    return generatedQuestions.filter((q) => {
      if (reviewTypeFilter !== 'all' && q.questionType !== reviewTypeFilter) {
        return false;
      }
      if (reviewSearchQuery.trim()) {
        const query = reviewSearchQuery.toLowerCase();
        const inText = (q.questionText || '').toLowerCase().includes(query);
        const inExplanation = (q.explanation || '').toLowerCase().includes(query);
        const inOptions = (q.options || []).some(o => o.toLowerCase().includes(query));
        const inAnswer = (q.correctAnswer || '').toLowerCase().includes(query);
        if (!inText && !inExplanation && !inOptions && !inAnswer) return false;
      }
      return true;
    });
  }, [generatedQuestions, reviewTypeFilter, reviewSearchQuery]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingFile(true);
    setUploadedFileName(file.name);

    try {
      const doc = await extractDocumentFromFile(file);
      setExtractedFileText(doc.fullText);
      setExtractedFilePages(doc.pages);
      toast({
        title: 'Document Extracted',
        description: `Successfully loaded ${doc.totalPages} page(s) (${doc.fullText.length.toLocaleString()} characters) from ${file.name}`
      });
    } catch (err: any) {
      toast({
        title: 'Extraction Failed',
        description: err.message,
        variant: 'destructive'
      });
      setUploadedFileName(null);
      setExtractedFileText('');
      setExtractedFilePages([]);
    } finally {
      setIsExtractingFile(false);
    }
  };

  // Precision content filtering: slices strictly to requested pages or chapters
  const combinedSourceMaterial = useMemo(() => {
    const parts: string[] = [];

    if (sourceType === 'book' && selectedBook) {
      if (effectivePageRange) {
        const filtered = extractedBookPages.length > 0
          ? filterPagesByRange(extractedBookPages, effectivePageRange)
          : filterDelimitedTextByRange(extractedBookText, effectivePageRange);

        const pageContent = filtered.text || (filtered as any).filteredText || '';
        parts.push(`[Digital Library Resource: "${selectedBook.title}" | EXCLUSIVELY PAGES: ${filtered.rangeLabel}]\n\n${pageContent}`);
      } else if (effectiveChapter) {
        const chapterRes = filterContentByChapter(
          extractedBookPages.length > 0 ? extractedBookPages : extractedBookText,
          effectiveChapter,
          selectedBook.chapterLabels
        );
        parts.push(`[Digital Library Resource: "${selectedBook.title}" | EXCLUSIVELY CHAPTER: "${chapterRes.chapterLabel}"]\n\n${chapterRes.filteredText}`);
      } else if (extractedBookText) {
        parts.push(`[Digital Library Resource: "${selectedBook.title}"]\n\n${extractedBookText}`);
      }
    } else if (sourceType === 'upload' && extractedFileText) {
      if (effectivePageRange) {
        const filtered = extractedFilePages.length > 0
          ? filterPagesByRange(extractedFilePages, effectivePageRange)
          : filterDelimitedTextByRange(extractedFileText, effectivePageRange);

        const pageContent = filtered.text || (filtered as any).filteredText || '';
        parts.push(`[Uploaded Document: "${uploadedFileName || 'Document'}" | EXCLUSIVELY PAGES: ${filtered.rangeLabel}]\n\n${pageContent}`);
      } else if (effectiveChapter) {
        const chapterRes = filterContentByChapter(
          extractedFilePages.length > 0 ? extractedFilePages : extractedFileText,
          effectiveChapter
        );
        parts.push(`[Uploaded Document: "${uploadedFileName || 'Document'}" | EXCLUSIVELY CHAPTER: "${chapterRes.chapterLabel}"]\n\n${chapterRes.filteredText}`);
      } else {
        parts.push(`[Uploaded Document: "${uploadedFileName || 'Document'}"]\n\n${extractedFileText}`);
      }
    } else if (sourceType === 'topic') {
      if (notesText) {
        parts.push(`[Study Notes & Syllabus Excerpts]\n\n${notesText}`);
      }
    }

    // Safety fallback: if current mode yields no text but another extracted source exists, include it
    if (parts.length === 0) {
      if (extractedBookText && selectedBook) {
        parts.push(`[Digital Library Resource: "${selectedBook.title}"]\n\n${extractedBookText}`);
      } else if (extractedFileText) {
        parts.push(`[Uploaded Document Content: ${uploadedFileName || 'Document'}]\n\n${extractedFileText}`);
      } else if (notesText) {
        parts.push(`[Textbook/Study Notes]\n\n${notesText}`);
      }
    }
    return parts.join('\n\n');
  }, [
    sourceType,
    selectedBook,
    extractedBookText,
    extractedBookPages,
    uploadedFileName,
    extractedFileText,
    extractedFilePages,
    notesText,
    effectivePageRange,
    effectiveChapter
  ]);

  // Visual summary of active scope and confinement level
  const activeScopeSummary = useMemo(() => {
    if (sourceType === 'book' && selectedBook) {
      if (effectivePageRange) {
        return {
          title: 'Precision Page Filter Active',
          detail: `Strictly confined to pages ${effectivePageRange}. The AI will only examine these pages. Outside material is excluded.`,
          characterCount: combinedSourceMaterial.length
        };
      }
      if (effectiveChapter) {
        return {
          title: 'Chapter Scope Confinement',
          detail: `Strictly confined to "${effectiveChapter}". Outside curriculum is excluded.`,
          characterCount: combinedSourceMaterial.length
        };
      }
      if (extractedBookText) {
        return {
          title: 'Full Resource Scope',
          detail: `Supplying all ${extractedBookPages.length > 0 ? `${extractedBookPages.length} pages` : 'curriculum material'}.`,
          characterCount: combinedSourceMaterial.length
        };
      }
    }
    if (sourceType === 'upload' && extractedFileText) {
      if (effectivePageRange) {
        return {
          title: 'Precision Page Filter Active',
          detail: `Strictly confined to pages ${effectivePageRange}. The AI will only examine these pages. Outside material is excluded.`,
          characterCount: combinedSourceMaterial.length
        };
      }
      if (effectiveChapter) {
        return {
          title: 'Chapter Scope Confinement',
          detail: `Strictly confined to "${effectiveChapter}". Outside content is excluded.`,
          characterCount: combinedSourceMaterial.length
        };
      }
      return {
        title: 'Full Document Scope',
        detail: `Supplying all ${extractedFilePages.length > 0 ? `${extractedFilePages.length} pages` : 'document material'}.`,
        characterCount: combinedSourceMaterial.length
      };
    }
    return null;
  }, [
    sourceType,
    selectedBook,
    effectivePageRange,
    effectiveChapter,
    extractedBookText,
    extractedBookPages.length,
    extractedFileText,
    extractedFilePages.length,
    combinedSourceMaterial.length
  ]);

  // Move provider priority up/down
  const movePriority = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= providerPriority.length) return;
    const updated = [...providerPriority];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setProviderPriority(updated);
  };

  // Start or Resume Generation Job
  const handleStartGeneration = async (options?: { resume?: boolean }) => {
    if (!totalCount || totalCount < 1 || totalCount > 200) {
      toast({
        title: 'Invalid Question Count',
        description: 'Please choose between 1 and 200 questions.',
        variant: 'destructive'
      });
      return;
    }

    if (selectedTypes.length === 0) {
      toast({
        title: 'Question Type Required',
        description: 'Please select at least one question type (MCQ, True/False, or Short Answer).',
        variant: 'destructive'
      });
      return;
    }

    if (!topic.trim() && !combinedSourceMaterial.trim() && !prompt.trim()) {
      toast({
        title: 'Source or Command Required',
        description: 'Please provide a topic, upload/paste source material, or write custom AI instructions.',
        variant: 'destructive'
      });
      return;
    }

    let activeExamTitle = examTitle.trim();
    if (destinationMode === 'new' && !activeExamTitle) {
      if (selectedBook?.title) {
        activeExamTitle = `${selectedBook.title} Examination`;
        setExamTitle(activeExamTitle);
      } else if (topic.trim()) {
        activeExamTitle = `${topic.trim()} Examination`;
        setExamTitle(activeExamTitle);
      } else {
        toast({
          title: 'Exam Title Required',
          description: 'Please provide a title for the new draft exam.',
          variant: 'destructive'
        });
        return;
      }
    }

    if (destinationMode === 'existing' && !selectedExistingExamId) {
      toast({
        title: 'Select Existing Exam',
        description: 'Please select which existing exam to append the questions to.',
        variant: 'destructive'
      });
      return;
    }

    // Determine batch plan: e.g. 10 questions per batch
    const BATCH_SIZE = 10;
    const numBatches = Math.ceil(totalCount / BATCH_SIZE);
    const isResuming = Boolean(options?.resume) && generatedQuestions.length > 0;
    const jobId = isResuming && currentJobId ? currentJobId : `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setCurrentJobId(jobId);
    setTotalBatches(numBatches);
    setFallbackBanner(null);
    setIsGenerating(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setActiveTab('progress');

    let allAcceptedQuestions: NormalizedQuestion[] = isResuming ? [...generatedQuestions] : [];

    if (!isResuming) {
      setCurrentBatchIndex(0);
      setGeneratedQuestions([]);
      setGenerationLogs([]);
    } else {
      setGenerationLogs(prev => [
        ...prev,
        `[Resume] Resuming generation: ${allAcceptedQuestions.length}/${totalCount} questions already generated, continuing remaining batches...`
      ]);
    }

    // Create initial Job in Firestore
    const initialJob: AIGenerationJob = {
      jobId,
      createdBy: user?.uid || 'admin',
      adminEmail: user?.email || undefined,
      title: destinationMode === 'new' ? activeExamTitle : 'Append to existing exam',
      departmentId: selectedDepartmentId === 'all' ? undefined : selectedDepartmentId,
      subjectId: selectedSubjectId === 'none' ? undefined : selectedSubjectId,
      chapterId: selectedChapterId && selectedChapterId !== 'none' ? selectedChapterId : undefined,
      chapterTitle: availableChapters.find(c => c.id === selectedChapterId)?.title || undefined,
      examType,
      totalRequested: totalCount,
      totalGenerated: allAcceptedQuestions.length,
      totalBatches: numBatches,
      completedBatches: Math.floor(allAcceptedQuestions.length / BATCH_SIZE),
      status: 'generating',
      questionTypes: selectedTypes,
      difficulty,
      language,
      prompt,
      topic: topic || undefined,
      hasSourceMaterial: Boolean(combinedSourceMaterial),
      questions: allAcceptedQuestions,
      providerUsedCounts: { gemini: 0, groq: 0, openrouter: 0, huggingface: 0 },
      createdAt: null,
      updatedAt: null
    };

    try {
      await saveJobToFirestore(initialJob);
    } catch (e) {
      console.warn('Failed to initialize job document:', e);
    }

    // Run Batches Sequentially with precise question type distribution
    const providerCounts: Record<AIProviderId, number> = {
      gemini: 0,
      groq: 0,
      openrouter: 0,
      huggingface: 0
    };

    const alreadyMcqs = allAcceptedQuestions.filter(q => q.questionType === 'mcq').length;
    const alreadyTfs = allAcceptedQuestions.filter(q => q.questionType === 'truefalse').length;
    const alreadyShorts = allAcceptedQuestions.filter(q => q.questionType === 'shortanswer').length;

    let remainingMcqs = Math.max(0, mcqCount - alreadyMcqs);
    let remainingTfs = Math.max(0, tfCount - alreadyTfs);
    let remainingShorts = Math.max(0, shortCount - alreadyShorts);

    const startBatchIdx = Math.floor(allAcceptedQuestions.length / BATCH_SIZE);

    for (let batchIdx = startBatchIdx; batchIdx < numBatches; batchIdx++) {
      if (isPausedRef.current) {
        setGenerationLogs(prev => [...prev, `[Paused] Generation paused by user after batch ${batchIdx}.`]);
        break;
      }

      setCurrentBatchIndex(batchIdx + 1);
      const remainingCount = totalCount - allAcceptedQuestions.length;
      const countForThisBatch = Math.min(BATCH_SIZE, remainingCount);

      if (countForThisBatch <= 0) break;

      // Allocate question type distribution for this batch
      let batchTf = 0;
      let batchMcq = 0;
      let batchShort = 0;
      let needed = countForThisBatch;

      if (remainingTfs > 0 && needed > 0) {
        const take = Math.min(remainingTfs, needed);
        batchTf = take;
        remainingTfs -= take;
        needed -= take;
      }
      if (remainingMcqs > 0 && needed > 0) {
        const take = Math.min(remainingMcqs, needed);
        batchMcq = take;
        remainingMcqs -= take;
        needed -= take;
      }
      if (remainingShorts > 0 && needed > 0) {
        const take = Math.min(remainingShorts, needed);
        batchShort = take;
        remainingShorts -= take;
        needed -= take;
      }

      const batchTypes: QuestionType[] = [];
      if (batchTf > 0) batchTypes.push('truefalse');
      if (batchMcq > 0) batchTypes.push('mcq');
      if (batchShort > 0) batchTypes.push('shortanswer');

      const typeSummary = [
        batchTf > 0 ? `${batchTf} T/F` : '',
        batchMcq > 0 ? `${batchMcq} MCQs` : '',
        batchShort > 0 ? `${batchShort} Short` : '',
      ].filter(Boolean).join(', ');

      setGenerationLogs(prev => [
        ...prev,
        `[Batch ${batchIdx + 1}/${numBatches}] Requesting ${countForThisBatch} questions (${typeSummary || selectedTypes.join(', ')})...`
      ]);

      try {
        const batchRes = await generateBatchCall({
          prompt,
          topic: effectiveChapter || topic,
          pageRange: effectivePageRange || undefined,
          chapter: effectiveChapter || undefined,
          sourceMaterial: combinedSourceMaterial,
          count: countForThisBatch,
          questionTypes: batchTypes.length > 0 ? batchTypes : selectedTypes,
          questionTypeCounts: {
            truefalse: batchTf,
            mcq: batchMcq,
            shortanswer: batchShort,
          },
          difficulty,
          language,
          providerPriority,
          batchIndex: batchIdx + 1,
          totalBatches: numBatches
        });

        if (batchRes.success && batchRes.questions.length > 0) {
          const providerUsed = batchRes.providerUsed || 'gemini';
          setActiveProvider(providerUsed);
          providerCounts[providerUsed] = (providerCounts[providerUsed] || 0) + batchRes.questions.length;

          if (batchRes.fallbackOccurred) {
            const banner = `Fallback triggered: Successfully generated using ${providerUsed.toUpperCase()} after earlier provider(s) experienced issues.`;
            setFallbackBanner(banner);
            setGenerationLogs(prev => [...prev, `⚠️ ${banner}`]);
          }

          const questionsWithSource = batchRes.questions.map(q => ({
            ...q,
            sourceReference: selectedBook ? {
              bookId: selectedBook.id,
              bookTitle: selectedBook.title,
              pageRange: effectivePageRange || undefined,
              chapter: effectiveChapter || undefined,
              driveFileId: selectedBook.driveFileId,
            } : uploadedFileName ? {
              bookTitle: uploadedFileName,
              pageRange: effectivePageRange || undefined,
              chapter: effectiveChapter || undefined,
            } : undefined,
          }));

          allAcceptedQuestions = [...allAcceptedQuestions, ...questionsWithSource];
          setGeneratedQuestions([...allAcceptedQuestions]);

          setGenerationLogs(prev => [
            ...prev,
            `✓ [Batch ${batchIdx + 1}/${numBatches}] Success via ${providerUsed.toUpperCase()} (+${batchRes.questions.length} questions, total: ${allAcceptedQuestions.length}/${totalCount})`
          ]);

          // Save incremental progress to Firestore without letting persistence errors interrupt execution
          try {
            await saveJobToFirestore({
              ...initialJob,
              totalGenerated: allAcceptedQuestions.length,
              completedBatches: batchIdx + 1,
              status: allAcceptedQuestions.length >= totalCount ? 'completed' : 'generating',
              questions: allAcceptedQuestions,
              providerUsedCounts: providerCounts
            });
          } catch (jobErr) {
            console.warn('Failed to update job audit record in Firestore:', jobErr);
          }
        } else {
          setGenerationLogs(prev => [
            ...prev,
            `❌ [Batch ${batchIdx + 1}/${numBatches}] Batch failed: ${batchRes.error || 'Unknown error'}`
          ]);
          try {
            await saveJobToFirestore({
              ...initialJob,
              totalGenerated: allAcceptedQuestions.length,
              completedBatches: batchIdx,
              status: allAcceptedQuestions.length > 0 ? 'partially_completed' : 'failed',
              questions: allAcceptedQuestions,
              providerUsedCounts: providerCounts
            });
          } catch (jobErr) {
            console.warn('Failed to mark partial job state in Firestore:', jobErr);
          }
          break;
        }
      } catch (batchErr: any) {
        setGenerationLogs(prev => [
          ...prev,
          `❌ [Batch ${batchIdx + 1}/${numBatches}] Exception: ${batchErr.message}`
        ]);
        break;
      }
    }

    setIsGenerating(false);
    setActiveProvider(null);

    if (allAcceptedQuestions.length > 0) {
      toast({
        title: allAcceptedQuestions.length >= totalCount ? 'Generation Complete' : 'Generation Partial / Paused',
        description: `Generated ${allAcceptedQuestions.length} of ${totalCount} questions. You can review them or resume remaining anytime.`
      });
      if (allAcceptedQuestions.length >= totalCount) {
        setActiveTab('review');
      }
    } else {
      toast({
        title: 'Generation Failed',
        description: 'Unable to generate questions. Please review provider settings and try again.',
        variant: 'destructive'
      });
    }

    if (user?.uid) {
      getRecentJobs(user.uid).then(setRecentJobsList).catch(console.error);
    }
  };

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      isPausedRef.current = false;
      handleStartGeneration({ resume: true });
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
    }
  };

  // Question editing handlers
  const handleUpdateQuestion = (index: number, updates: Partial<NormalizedQuestion>) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== index));
    toast({ description: 'Question removed from review list.' });
  };

  const handleAddManualQuestion = () => {
    const newQ: NormalizedQuestion = {
      id: `manual_${Date.now()}`,
      questionText: 'New question stem...',
      questionType: 'mcq',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: 0,
      correctAnswer: 'Option A',
      explanation: 'Explanation for why Option A is correct.',
      difficulty: 'Medium',
      marks: 1,
      providerUsed: 'gemini',
      batchIndex: 0
    };
    setGeneratedQuestions(prev => [newQ, ...prev]);
    toast({ description: 'Added blank question to the top of review list.' });
  };

  // Save all reviewed questions to Firestore Exam
  const handleSaveToExam = async () => {
    if (generatedQuestions.length === 0) {
      toast({
        title: 'No Questions',
        description: 'There are no questions to save.',
        variant: 'destructive'
      });
      return;
    }

    try {
      let targetExamId = selectedExistingExamId;

      if (destinationMode === 'new') {
        if (!user) throw new Error('Must be authenticated');

        const newExamId = await createExam({
          title: examTitle.trim() || 'AI Generated Exam',
          description: `AI Generated Exam (${generatedQuestions.length} questions) on ${new Date().toLocaleDateString()}`,
          departmentId: selectedDepartmentId === 'all' ? undefined : selectedDepartmentId,
          subjectId: selectedSubjectId === 'none' ? undefined : selectedSubjectId,
          chapterId: selectedChapterId && selectedChapterId !== 'none' ? selectedChapterId : undefined,
          chapterTitle: availableChapters.find(c => c.id === selectedChapterId)?.title || undefined,
          createdBy: user.uid,
          durationMinutes: 60,
          maxAttempts: 1,
          isPublished: false, // DRAFT Initially as required!
          resultsPublished: false,
          shuffleQuestions: true,
          shuffleOptions: true,
          questionCount: 0,
          totalMarks: 0,
          examType: examType as any
        });
        targetExamId = newExamId;
      }

      const result = await saveQuestionsToExam(targetExamId, generatedQuestions);

      toast({
        title: 'Exam Draft Saved Successfully!',
        description: `Saved ${result.addedCount} questions to exam (skipped ${result.skippedCount} duplicates).`
      });

      // Navigate to EditExam for final review
      navigate(`/dashboard/exams/${targetExamId}/edit`);
    } catch (err: any) {
      console.error('Error saving to exam:', err);
      toast({
        title: 'Save Failed',
        description: err.message || 'Could not save questions to exam',
        variant: 'destructive'
      });
    }
  };

  // Export questions to JSON file
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(generatedQuestions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ai_exam_questions_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast({ description: 'Exported questions to JSON.' });
  };

  return (
    <DashboardLayout contentClassName="p-0 sm:px-6 lg:px-8 py-2 sm:py-6">
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 space-y-3.5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl text-white shadow-md shadow-purple-500/10 shrink-0">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight truncate">
                AI Exam Generator
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 line-clamp-1 sm:line-clamp-none">
                Generate curriculum-aligned exam questions instantly from books, PDFs, or topics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "py-1 px-2.5 text-[11px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition",
                configuredProvidersCount > 0
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              )}
              onClick={() => setShowAISettingsDialog(true)}
              title="Click to view & configure AI engines and API keys"
            >
              <span className={cn("h-2 w-2 rounded-full", configuredProvidersCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              <span>{configuredProvidersCount > 0 ? `${configuredProvidersCount} AI Engines Ready` : 'Configure AI Engines'}</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISettingsDialog(true)}
              className="rounded-xl text-xs font-medium h-7 sm:h-8 px-2.5 sm:px-3 flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>AI Provider Settings</span>
            </Button>

            <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs font-medium h-7 sm:h-8 px-2.5 sm:px-3">
              <Link to="/dashboard/admin/exams">Manage Exams</Link>
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-3.5 sm:space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl p-1 bg-muted/60 rounded-xl sm:rounded-2xl gap-0.5 sm:gap-1">
            <TabsTrigger value="configure" className="px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all">
              <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Configure</span>
              <span className="sm:hidden">Setup</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all" disabled={!isGenerating && generationLogs.length === 0}>
              <RefreshCw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0", isGenerating && "animate-spin text-purple-600")} />
              <span className="hidden sm:inline">Progress</span>
              <span className="sm:hidden">Status</span>
              {isGenerating && <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="review" className="px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Review ({generatedQuestions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="hidden sm:inline">Recent Jobs</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CONFIGURE & GENERATE */}
          <TabsContent value="configure" className="space-y-3.5 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6 items-start">
              {/* Left Column: Source Material & AI Instructions (7 cols) */}
              <div className="lg:col-span-7 space-y-3.5 sm:space-y-6">
                {/* 1. Source Material */}
                <Card className="border-border shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
                  <CardHeader className="p-3.5 sm:p-5 pb-2.5 sm:pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        1. Select Material Source
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] sm:text-[11px] font-normal text-muted-foreground">
                        Step 1 of 2
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Choose where the AI should extract syllabus topics, factual concepts, and textbook questions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-5 space-y-3.5 sm:space-y-4">
                    {/* Source Mode Segmented Switch */}
                    <div className="flex p-1 bg-muted/60 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setSourceType('book')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-2 text-[11px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all",
                          sourceType === 'book'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                        <span className="truncate">Digital Library</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSourceType('upload')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-2 text-[11px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all",
                          sourceType === 'upload'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                        <span className="truncate">Upload File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSourceType('topic')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-2 text-[11px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all",
                          sourceType === 'topic'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                        <span className="truncate">Topic & Notes</span>
                      </button>
                    </div>

                    {/* MODE 1: DIGITAL LIBRARY */}
                    {sourceType === 'book' && (
                      <div className="space-y-3.5 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Select Textbook or Note</Label>
                            <Select
                              value={selectedBookId}
                              onValueChange={(val) => setSelectedBookId(val)}
                            >
                              <SelectTrigger className="rounded-xl text-xs sm:text-sm bg-card">
                                <SelectValue placeholder="Choose from library..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- Select a Book or Short Note --</SelectItem>
                                {filteredLibraryBooks.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.resourceType === 'short_note' ? '📝' : '📖'} {b.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Content Scope</Label>
                            <Select
                              value={bookScopeMode}
                              onValueChange={(val: any) => setBookScopeMode(val)}
                              disabled={!selectedBook}
                            >
                              <SelectTrigger className="rounded-xl text-xs sm:text-sm bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="entire">Entire Resource</SelectItem>
                                {Array.isArray(selectedBook?.chapterLabels) && selectedBook.chapterLabels.length > 0 && (
                                  <SelectItem value="chapter">Specific Chapter</SelectItem>
                                )}
                                <SelectItem value="page_range">Specific Page Range</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Scope Detail: Chapter or Page Range */}
                        {selectedBook && bookScopeMode === 'chapter' && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Chapter / Unit</Label>
                            <Select
                              value={selectedBookChapter}
                              onValueChange={setSelectedBookChapter}
                            >
                              <SelectTrigger className="rounded-xl text-xs sm:text-sm bg-card">
                                <SelectValue placeholder="All Chapters" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Chapters</SelectItem>
                                {selectedBook.chapterLabels?.map((ch, idx) => (
                                  <SelectItem key={idx} value={ch}>
                                    {ch}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {selectedBook && bookScopeMode === 'page_range' && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground">Page Range (e.g. 1-25)</Label>
                              {detectedScope.detectedPageRange && !bookPageRange && (
                                <span className="text-[11px] text-primary cursor-pointer hover:underline" onClick={() => setBookPageRange(detectedScope.detectedPageRange || '')}>
                                  Use from prompt ({detectedScope.detectedPageRange})
                                </span>
                              )}
                            </div>
                            <Input
                              placeholder="e.g. 1-20 or 50-75"
                              value={bookPageRange}
                              onChange={(e) => setBookPageRange(e.target.value)}
                              className="rounded-xl text-xs sm:text-sm bg-card"
                            />
                          </div>
                        )}

                        {/* Active Scope Summary Banner */}
                        {activeScopeSummary && (
                          <div className="flex items-start justify-between gap-3 text-xs p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                            <div className="flex items-start gap-2">
                              <Target className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <div>
                                <div className="font-semibold flex items-center gap-1.5">
                                  {activeScopeSummary.title}
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300">
                                    Precision Scope
                                  </Badge>
                                </div>
                                <p className="text-amber-800/90 dark:text-amber-200/90 mt-0.5 leading-relaxed">
                                  {activeScopeSummary.detail}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-mono bg-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                              {activeScopeSummary.characterCount.toLocaleString()} chars
                            </span>
                          </div>
                        )}

                        {/* Extraction Status Bar */}
                        {selectedBook && (
                          <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border bg-muted/30">
                            <div className="flex items-center gap-2 truncate">
                              {isExtractingBook ? (
                                <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Extracting document content...
                                </span>
                              ) : extractedBookText ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
                                  <Check className="h-3.5 w-3.5" />
                                  Ready • {extractedBookPages.length > 0 ? `${extractedBookPages.length} pages` : `${extractedBookText.length.toLocaleString()} chars`} loaded
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Ready to extract</span>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExtractBookContent()}
                              disabled={isExtractingBook}
                              className="h-7 text-xs font-medium text-primary hover:text-primary"
                            >
                              <RefreshCw className={cn("h-3 w-3 mr-1", isExtractingBook && "animate-spin")} />
                              Reload
                            </Button>
                          </div>
                        )}

                        {/* Topic Input */}
                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="topic-book" className="text-xs font-medium text-muted-foreground">
                            Focus Topic / Chapter Name
                          </Label>
                          <Input
                            id="topic-book"
                            placeholder="e.g. History of Ethiopia: Medieval Kingdom, 1270-1529"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="rounded-xl text-xs sm:text-sm bg-card"
                          />
                        </div>
                      </div>
                    )}

                    {/* MODE 2: UPLOAD DOCUMENT */}
                    {sourceType === 'upload' && (
                      <div className="space-y-3.5 pt-1">
                        <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center hover:bg-muted/20 transition cursor-pointer relative">
                          <input
                            type="file"
                            accept=".pdf,.txt,.md"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isExtractingFile}
                          />
                          <div className="flex flex-col items-center gap-2">
                            {isExtractingFile ? (
                              <RefreshCw className="h-9 w-9 animate-spin text-primary" />
                            ) : (
                              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <Upload className="h-6 w-6" />
                              </div>
                            )}
                            <p className="text-sm font-semibold">
                              {uploadedFileName || 'Drop PDF or TXT file here, or click to browse'}
                            </p>
                            <p className="text-xs text-muted-foreground">Supported formats: PDF, TXT, Markdown (up to 20MB)</p>
                          </div>
                        </div>

                        {extractedFileText && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border">
                              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5" />
                                Document extracted: {extractedFilePages.length > 0 ? `${extractedFilePages.length} pages` : `${extractedFileText.length.toLocaleString()} characters`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setExtractedFileText('');
                                  setExtractedFilePages([]);
                                  setUploadedFileName(null);
                                }}
                              >
                                Remove File
                              </Button>
                            </div>

                            {/* Document Scope Controls for Uploaded PDF */}
                            <div className="grid sm:grid-cols-2 gap-3 p-3 bg-muted/20 rounded-xl border">
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-muted-foreground">Document Scope</Label>
                                <Select
                                  value={fileScopeMode}
                                  onValueChange={(val: any) => setFileScopeMode(val)}
                                >
                                  <SelectTrigger className="rounded-xl text-xs sm:text-sm bg-card">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="entire">Entire Document ({extractedFilePages.length > 0 ? `${extractedFilePages.length} Pages` : 'All'})</SelectItem>
                                    <SelectItem value="page_range">Specific Page Range</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {fileScopeMode === 'page_range' && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium text-muted-foreground">Page Range (e.g. 5-10)</Label>
                                    {detectedScope.detectedPageRange && !filePageRange && (
                                      <span className="text-[11px] text-primary cursor-pointer hover:underline" onClick={() => setFilePageRange(detectedScope.detectedPageRange || '')}>
                                        Use from prompt ({detectedScope.detectedPageRange})
                                      </span>
                                    )}
                                  </div>
                                  <Input
                                    placeholder="e.g. 1-15 or 25-30"
                                    value={filePageRange}
                                    onChange={(e) => setFilePageRange(e.target.value)}
                                    className="rounded-xl text-xs sm:text-sm bg-card"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Active Scope Summary Banner for Uploads */}
                            {activeScopeSummary && (
                              <div className="flex items-start justify-between gap-3 text-xs p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                                <div className="flex items-start gap-2">
                                  <Target className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                  <div>
                                    <div className="font-semibold flex items-center gap-1.5">
                                      {activeScopeSummary.title}
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300">
                                        Precision Scope
                                      </Badge>
                                    </div>
                                    <p className="text-amber-800/90 dark:text-amber-200/90 mt-0.5 leading-relaxed">
                                      {activeScopeSummary.detail}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-mono bg-amber-500/20 px-2 py-0.5 rounded-md shrink-0">
                                  {activeScopeSummary.characterCount.toLocaleString()} chars
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label htmlFor="topic-upload" className="text-xs font-medium text-muted-foreground">
                            Focus Topic (Optional)
                          </Label>
                          <Input
                            id="topic-upload"
                            placeholder="e.g. Cellular Respiration and Photosynthesis"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="rounded-xl text-xs sm:text-sm bg-card"
                          />
                        </div>
                      </div>
                    )}

                    {/* MODE 3: TOPIC & NOTES */}
                    {sourceType === 'topic' && (
                      <div className="space-y-3.5 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="topic-manual" className="text-xs font-medium text-muted-foreground">
                            Topic or Syllabus Area *
                          </Label>
                          <Input
                            id="topic-manual"
                            placeholder="e.g. Cognitive Psychology, Microeconomics, Organic Chemistry Reactions"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="rounded-xl text-xs sm:text-sm bg-card"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="notes-manual" className="text-xs font-medium text-muted-foreground">
                            Paste Study Notes, Syllabus, or Lecture Highlights
                          </Label>
                          <Textarea
                            id="notes-manual"
                            rows={5}
                            placeholder="Paste syllabus guidelines, definitions, or textbook highlights here..."
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            className="rounded-xl text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. AI Command / Prompt */}
                <Card className="border-border shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
                  <CardHeader className="p-3.5 sm:p-5 pb-2.5 sm:pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        2. Prompt & Exam Instructions
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] sm:text-[11px] font-normal text-muted-foreground">
                        Step 2 of 2
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Instruct the AI on question style, academic level, and areas of emphasis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-5 space-y-3 sm:space-y-3.5">
                    {/* Prompt Presets */}
                    <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        Pedagogical Standards & Presets:
                      </Label>
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        {PROMPT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPrompt(preset.text)}
                            title={preset.description}
                            className={cn(
                              "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition border",
                              prompt === preset.text
                                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                            )}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="rounded-xl text-xs sm:text-sm leading-relaxed"
                      placeholder="e.g. Generate high-quality exam questions from page 15 to 25. Focus on definitions and practical applications."
                    />

                    {/* Prompt Intelligence Scope Badge */}
                    {detectedScope.hasDetectedScope && (
                      <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-200 text-xs">
                        <Sparkles className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                        <div className="flex-1">
                          <span className="font-semibold text-purple-950 dark:text-purple-100">Prompt Scope Identified: </span>
                          <span>{detectedScope.explanation}</span>
                          <span className="text-purple-800/80 dark:text-purple-300/80 ml-1.5 block sm:inline">
                            • AI generation will be strictly confined to this specific content (no generalization).
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500/30 shrink-0">
                          Scope Active
                        </Badge>
                      </div>
                    )}

                    {/* Quick instruction chips */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        Quick prompt enhancers (click to toggle):
                      </span>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {PROMPT_INSTRUCTION_CHIPS.map((chip, idx) => {
                          const isSelected = prompt.includes(chip.text);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => togglePromptChip(chip.text)}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all border",
                                isSelected
                                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                  : "bg-muted/50 hover:bg-muted text-foreground border-border"
                              )}
                            >
                              {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Destination, Question Distribution & Primary CTA (5 cols) */}
              <div className="lg:col-span-5 space-y-3.5 sm:space-y-6">
                <Card className="border-border shadow-sm rounded-xl sm:rounded-2xl overflow-hidden lg:sticky lg:top-6">
                  <CardHeader className="p-3.5 sm:p-5 pb-2.5 sm:pb-3 border-b bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Exam Setup & Breakdown
                      </CardTitle>
                      <Badge variant="secondary" className="font-bold text-xs px-2.5 py-0.5">
                        {totalCount} Total
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Configure question counts, target exam, and launch.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-5 space-y-3.5 sm:space-y-4">
                    {/* Destination: Mode Toggle */}
                    <div className="flex p-1 bg-muted/60 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setDestinationMode('new')}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                          destinationMode === 'new'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Create New Exam
                      </button>
                      <button
                        type="button"
                        onClick={() => setDestinationMode('existing')}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                          destinationMode === 'existing'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Append to Existing
                      </button>
                    </div>

                    {/* Destination Fields */}
                    {destinationMode === 'new' ? (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="examTitle" className="text-xs font-medium text-muted-foreground">
                            Exam Title *
                          </Label>
                          <Input
                            id="examTitle"
                            placeholder="e.g. Midterm: History of Ethiopia"
                            value={examTitle}
                            onChange={(e) => setExamTitle(e.target.value)}
                            className="rounded-xl text-xs sm:text-sm bg-card"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                            <Select
                              value={selectedDepartmentId}
                              onValueChange={(v) => {
                                setSelectedDepartmentId(v);
                                setSelectedSubjectId('none');
                                setSelectedChapterId('none');
                              }}
                            >
                              <SelectTrigger className="rounded-xl text-xs bg-card">
                                <SelectValue placeholder="All Departments" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
                            <Select
                              value={selectedSubjectId}
                              onValueChange={(v) => {
                                setSelectedSubjectId(v);
                                setSelectedChapterId('none');
                              }}
                            >
                              <SelectTrigger className="rounded-xl text-xs bg-card">
                                <SelectValue placeholder="Subject" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Specific Subject</SelectItem>
                                {filteredSubjects.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Exam Type Toggle */}
                        <div className="space-y-1 pt-1">
                          <Label className="text-xs font-medium text-muted-foreground">Exam Mode</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setExamType('normal')}
                              className={cn(
                                "py-1.5 px-2 rounded-xl text-xs font-medium border transition-all text-center",
                                examType === 'normal'
                                  ? "bg-primary/10 border-primary text-primary font-semibold"
                                  : "bg-muted/30 border-border text-muted-foreground"
                              )}
                            >
                              Graded Exam
                            </button>
                            <button
                              type="button"
                              onClick={() => setExamType('practice')}
                              className={cn(
                                "py-1.5 px-2 rounded-xl text-xs font-medium border transition-all text-center",
                                examType === 'practice'
                                  ? "bg-primary/10 border-primary text-primary font-semibold"
                                  : "bg-muted/30 border-border text-muted-foreground"
                              )}
                            >
                              Practice Mode
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Select Existing Exam</Label>
                        <Select value={selectedExistingExamId} onValueChange={setSelectedExistingExamId}>
                          <SelectTrigger className="rounded-xl text-xs bg-card">
                            <SelectValue placeholder="Select an exam..." />
                          </SelectTrigger>
                          <SelectContent>
                            {existingExams.map(ex => (
                              <SelectItem key={ex.examId} value={ex.examId}>
                                {ex.title} ({ex.questionCount || 0} questions)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Question Type Breakdown */}
                    <div className="space-y-2.5 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">Question Distribution</Label>
                        <span className="text-[11px] text-muted-foreground">Click presets or adjust counts</span>
                      </div>

                      {/* Presets Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className={cn(
                            "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            tfCount === 8 && mcqCount === 7 && shortCount === 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                          )}
                          onClick={() => { setTfCount(8); setMcqCount(7); setShortCount(0); }}
                        >
                          T/F=8, MCQs=7 (15)
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            tfCount === 10 && mcqCount === 10 && shortCount === 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                          )}
                          onClick={() => { setTfCount(10); setMcqCount(10); setShortCount(0); }}
                        >
                          T/F=10, MCQs=10 (20)
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            tfCount === 0 && mcqCount === 20 && shortCount === 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                          )}
                          onClick={() => { setTfCount(0); setMcqCount(20); setShortCount(0); }}
                        >
                          20 MCQs
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            tfCount === 15 && mcqCount === 0 && shortCount === 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                          )}
                          onClick={() => { setTfCount(15); setMcqCount(0); setShortCount(0); }}
                        >
                          15 T/F
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                            tfCount === 10 && mcqCount === 15 && shortCount === 5
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                          )}
                          onClick={() => { setTfCount(10); setMcqCount(15); setShortCount(5); }}
                        >
                          10 T/F, 15 MCQs, 5 Short (30)
                        </button>
                      </div>

                      {/* Steppers */}
                      <div className="space-y-2 pt-1">
                        {/* True / False */}
                        <div className="flex items-center justify-between p-2 rounded-xl border bg-card/60">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="type-tf"
                              checked={tfCount > 0}
                              onCheckedChange={(checked) => setTfCount(checked ? (tfCount > 0 ? tfCount : 8) : 0)}
                            />
                            <Label htmlFor="type-tf" className="text-xs font-medium cursor-pointer">
                              True / False
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              disabled={tfCount <= 0}
                              onClick={() => setTfCount(Math.max(0, tfCount - 1))}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={tfCount}
                              onChange={(e) => setTfCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="h-6 w-12 text-center font-bold text-xs px-1 rounded-md"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              onClick={() => setTfCount(tfCount + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* MCQs */}
                        <div className="flex items-center justify-between p-2 rounded-xl border bg-card/60">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="type-mcq"
                              checked={mcqCount > 0}
                              onCheckedChange={(checked) => setMcqCount(checked ? (mcqCount > 0 ? mcqCount : 7) : 0)}
                            />
                            <Label htmlFor="type-mcq" className="text-xs font-medium cursor-pointer">
                              Multiple Choice (MCQ)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              disabled={mcqCount <= 0}
                              onClick={() => setMcqCount(Math.max(0, mcqCount - 1))}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={mcqCount}
                              onChange={(e) => setMcqCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="h-6 w-12 text-center font-bold text-xs px-1 rounded-md"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              onClick={() => setMcqCount(mcqCount + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Short Answer */}
                        <div className="flex items-center justify-between p-2 rounded-xl border bg-card/60">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="type-sa"
                              checked={shortCount > 0}
                              onCheckedChange={(checked) => setShortCount(checked ? (shortCount > 0 ? shortCount : 5) : 0)}
                            />
                            <Label htmlFor="type-sa" className="text-xs font-medium cursor-pointer">
                              Short Answer
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              disabled={shortCount <= 0}
                              onClick={() => setShortCount(Math.max(0, shortCount - 1))}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={shortCount}
                              onChange={(e) => setShortCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="h-6 w-12 text-center font-bold text-xs px-1 rounded-md"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              onClick={() => setShortCount(shortCount + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Primary Action Button */}
                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={() => handleStartGeneration()}
                        disabled={isGenerating}
                        className="w-full h-11 sm:h-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-bold text-sm sm:text-base shadow-md shadow-purple-500/20 rounded-xl transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate {totalCount} Exam Questions
                      </Button>
                      <p className="text-[11px] text-center text-muted-foreground mt-1.5">
                        {totalCount} questions • Estimated time: ~{Math.max(4, Math.ceil(totalCount / 10) * 3)}–{Math.max(8, Math.ceil(totalCount / 10) * 6)}s
                      </p>
                    </div>

                    {/* Advanced Settings Collapsible */}
                    <div className="pt-1 border-t">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="w-full flex items-center justify-between py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                          Advanced AI Settings (Difficulty, Language, Engines)
                        </span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedSettings && "rotate-180")} />
                      </button>

                      {showAdvancedSettings && (
                        <div className="space-y-3 pt-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Difficulty</Label>
                              <Select value={difficulty} onValueChange={(v: Difficulty) => setDifficulty(v)}>
                                <SelectTrigger className="h-8 rounded-lg text-xs bg-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Mixed">Mixed (Balanced)</SelectItem>
                                  <SelectItem value="Easy">Easy</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="Hard">Hard</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Language</Label>
                              <Select value={language} onValueChange={(v: Language) => setLanguage(v)}>
                                <SelectTrigger className="h-8 rounded-lg text-xs bg-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="English">English</SelectItem>
                                  <SelectItem value="Afaan Oromoo">Afaan Oromoo</SelectItem>
                                  <SelectItem value="Amharic">Amharic (አማርኛ)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl border bg-muted/30 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-muted-foreground text-[11px]">Automatic Engine Fallback Order:</span>
                              <button
                                type="button"
                                onClick={() => setShowAISettingsDialog(true)}
                                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Settings className="h-3 w-3" />
                                Configure Engines & Keys
                              </button>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              1. Gemini 2.5 Flash → 2. Groq (Qwen/GPT) → 3. OpenRouter → 4. HuggingFace
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: LIVE GENERATION PROGRESS */}
          <TabsContent value="progress" className="space-y-4 sm:space-y-6">
            <Card className="border-border shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-3.5 sm:p-6 pb-2.5 sm:pb-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                      <RefreshCw className={cn("h-4 w-4 sm:h-5 sm:w-5 text-purple-600 shrink-0", isGenerating && "animate-spin")} />
                      <span className="truncate">Live Generation Job: {currentJobId || 'Pending'}</span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Progress, fallback monitoring, and batch execution state.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {isGenerating ? (
                      <Badge variant="default" className="bg-emerald-600 animate-pulse text-xs">
                        Generating...
                      </Badge>
                    ) : generatedQuestions.length >= totalCount ? (
                      <Badge variant="default" className="bg-emerald-600 text-xs">
                        Job Completed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Idle</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                {/* Fallback Banner */}
                {fallbackBanner && (
                  <Alert className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle>Automatic Fallback Activated</AlertTitle>
                    <AlertDescription className="text-xs">
                      {fallbackBanner}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>
                      Generated: {generatedQuestions.length} / {totalCount} Questions
                    </span>
                    <span>
                      {totalCount > 0 ? Math.round((generatedQuestions.length / totalCount) * 100) : 0}%
                    </span>
                  </div>
                  <Progress
                    value={totalCount > 0 ? (generatedQuestions.length / totalCount) * 100 : 0}
                    className="h-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Current Batch: {currentBatchIndex} of {totalBatches}</span>
                    <span>Active Provider: {activeProvider ? activeProvider.toUpperCase() : 'Waiting'}</span>
                  </div>
                </div>

                {/* Live Console Output */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Execution & Audit Logs</Label>
                  <div className="bg-slate-950 text-slate-100 p-3 sm:p-4 rounded-xl font-mono text-[11px] sm:text-xs max-h-56 sm:max-h-72 overflow-y-auto space-y-1 shadow-inner">
                    {generationLogs.length === 0 ? (
                      <div className="text-slate-500 italic">No logs yet. Start generation to monitor execution.</div>
                    ) : (
                      generationLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                  <div className="flex items-center gap-2">
                    {isGenerating && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTogglePause}
                        className="rounded-xl text-xs font-semibold h-8"
                      >
                        {isPaused ? <Play className="h-3.5 w-3.5 mr-1.5" /> : <Pause className="h-3.5 w-3.5 mr-1.5" />}
                        {isPaused ? 'Resume Job' : 'Pause Job'}
                      </Button>
                    )}
                    {!isGenerating && generatedQuestions.length < totalCount && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartGeneration({ resume: true })}
                        className="text-primary border-primary/30 rounded-xl text-xs font-semibold h-8"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Resume Remaining ({totalCount - generatedQuestions.length})
                      </Button>
                    )}
                  </div>

                  {generatedQuestions.length > 0 && (
                    <Button
                      onClick={() => setActiveTab('review')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold h-8"
                      size="sm"
                    >
                      Proceed to Review Questions ({generatedQuestions.length})
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: REVIEW & EDIT QUESTIONS */}
          <TabsContent value="review" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  Question Review & Quality Editor
                  <Badge variant="secondary" className="text-xs">{generatedQuestions.length} Questions</Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Carefully edit question text, answer options, explanations, and marks before publishing to students.
                </p>
              </div>

              <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleAddManualQuestion} className="h-8 text-xs font-semibold rounded-xl">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportJson} className="h-8 text-xs font-semibold rounded-xl">
                  <Download className="h-3.5 w-3.5 mr-1" /> JSON
                </Button>
                <Button
                  onClick={handleSaveToExam}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8 text-xs rounded-xl"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save
                </Button>
              </div>
            </div>

            {/* Duplicate questions warning */}
            {duplicateIndices.size > 0 && (
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>Potential Duplicate Questions Detected</AlertTitle>
                <AlertDescription className="text-xs">
                  We identified {duplicateIndices.size} questions with highly similar question stems. Highlighted with a warning badge below.
                </AlertDescription>
              </Alert>
            )}

            {/* Questions List */}
            {generatedQuestions.length === 0 ? (
              <Card className="text-center py-12 rounded-2xl border-dashed">
                <CardContent className="space-y-3">
                  <div className="p-3 bg-muted/40 rounded-2xl w-fit mx-auto text-muted-foreground">
                    <Brain className="h-10 w-10" />
                  </div>
                  <h3 className="text-base font-semibold">No Questions Generated Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Select your digital resource, set how many questions you need, and click Generate.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('configure')} className="rounded-xl text-xs">
                    Go to Configure Tab
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {/* Filter & Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border bg-card/60 shadow-sm">
                  {/* Type Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReviewTypeFilter('all')}
                      className={cn(
                        "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all",
                        reviewTypeFilter === 'all'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      )}
                    >
                      All ({generatedQuestions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewTypeFilter('truefalse')}
                      className={cn(
                        "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all",
                        reviewTypeFilter === 'truefalse'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      )}
                    >
                      T/F ({generatedQuestions.filter(q => q.questionType === 'truefalse').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewTypeFilter('mcq')}
                      className={cn(
                        "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all",
                        reviewTypeFilter === 'mcq'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      )}
                    >
                      MCQs ({generatedQuestions.filter(q => q.questionType === 'mcq').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewTypeFilter('shortanswer')}
                      className={cn(
                        "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all",
                        reviewTypeFilter === 'shortanswer'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      )}
                    >
                      Short ({generatedQuestions.filter(q => q.questionType === 'shortanswer').length})
                    </button>
                  </div>

                  {/* Search Filter */}
                  <div className="relative w-full sm:w-64">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search questions & answers..."
                      value={reviewSearchQuery}
                      onChange={(e) => setReviewSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl bg-card w-full"
                    />
                  </div>
                </div>

                {filteredReviewQuestions.length === 0 ? (
                  <Card className="text-center py-8 rounded-xl sm:rounded-2xl border-dashed">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-xs text-muted-foreground">No questions match the current filter or search query.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setReviewTypeFilter('all'); setReviewSearchQuery(''); }}
                        className="text-xs text-primary"
                      >
                        Reset Search & Filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredReviewQuestions.map((q) => {
                    const qIndex = generatedQuestions.indexOf(q);
                    const isDuplicate = duplicateIndices.has(qIndex);

                  return (
                    <Card
                      key={q.id || qIndex}
                      className={cn(
                        "relative transition rounded-xl sm:rounded-2xl border-border shadow-sm overflow-hidden",
                        isDuplicate && "border-amber-400 bg-amber-50/20"
                      )}
                    >
                      <CardHeader className="p-3 sm:p-4 pb-2.5 border-b bg-muted/10">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                Q{qIndex + 1}
                              </span>
                              <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">
                                {q.questionType === 'mcq' ? 'MCQ' : q.questionType === 'truefalse' ? 'True / False' : 'Short Answer'}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                {q.difficulty}
                              </Badge>
                              {isDuplicate && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Duplicate
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex items-center gap-1 text-xs">
                                <Label className="text-[10px] sm:text-[11px] text-muted-foreground">Pts:</Label>
                                <Input
                                  type="number"
                                  className="w-11 sm:w-12 h-7 text-xs px-1 text-center rounded-lg"
                                  min={1}
                                  value={q.marks || 1}
                                  onChange={(e) => handleUpdateQuestion(qIndex, { marks: parseInt(e.target.value, 10) || 1 })}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteQuestion(qIndex)}
                                title="Delete Question"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Secondary meta info row */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] text-muted-foreground px-1.5 py-0">
                              via {q.providerUsed}
                            </Badge>
                            {q.sourceReference?.bookTitle && (
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 flex items-center gap-1 max-w-[260px] truncate px-1.5 py-0">
                                <BookOpen className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{q.sourceReference.bookTitle}</span>
                                {q.sourceReference.pageRange ? ` (p. ${q.sourceReference.pageRange})` : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-3 sm:p-4 space-y-3">
                        {/* Question Text */}
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-muted-foreground">Question Stem</Label>
                          <Textarea
                            rows={2}
                            value={q.questionText}
                            onChange={(e) => handleUpdateQuestion(qIndex, { questionText: e.target.value })}
                            className="font-medium text-xs sm:text-sm leading-relaxed rounded-xl"
                          />
                        </div>

                        {/* MCQ Options */}
                        {q.questionType === 'mcq' && (
                          <div className="space-y-2 pt-1">
                            <Label className="text-xs font-semibold text-muted-foreground">
                              Options (Click circle to set correct answer)
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {(q.options || []).map((opt, optIndex) => {
                                const isCorrect = q.correctOptionIndex === optIndex;
                                const optionLetter = String.fromCharCode(65 + optIndex);

                                return (
                                  <div
                                    key={optIndex}
                                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border transition ${
                                      isCorrect
                                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20'
                                        : 'bg-background hover:border-slate-300'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuestion(qIndex, {
                                        correctOptionIndex: optIndex,
                                        correctAnswer: opt
                                      })}
                                      className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'border border-slate-300 hover:border-emerald-500 text-muted-foreground'
                                      }`}
                                    >
                                      {optionLetter}
                                    </button>
                                    <Input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...q.options];
                                        newOpts[optIndex] = e.target.value;
                                        handleUpdateQuestion(qIndex, {
                                          options: newOpts,
                                          correctAnswer: isCorrect ? e.target.value : q.correctAnswer
                                        });
                                      }}
                                      className="h-7 sm:h-8 text-xs sm:text-sm border-0 bg-transparent focus-visible:ring-1 flex-1 min-w-0"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* True / False Options */}
                        {q.questionType === 'truefalse' && (
                          <div className="space-y-1.5 pt-1">
                            <Label className="text-xs font-semibold text-muted-foreground">Correct Answer</Label>
                            <div className="flex gap-2 sm:gap-3">
                              <Button
                                type="button"
                                size="sm"
                                variant={q.correctOptionIndex === 0 ? 'default' : 'outline'}
                                className={`flex-1 rounded-xl h-8 text-xs font-semibold ${q.correctOptionIndex === 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                                onClick={() => handleUpdateQuestion(qIndex, { correctOptionIndex: 0, correctAnswer: 'True' })}
                              >
                                True
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={q.correctOptionIndex === 1 ? 'default' : 'outline'}
                                className={`flex-1 rounded-xl h-8 text-xs font-semibold ${q.correctOptionIndex === 1 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                                onClick={() => handleUpdateQuestion(qIndex, { correctOptionIndex: 1, correctAnswer: 'False' })}
                              >
                                False
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Short Answer */}
                        {q.questionType === 'shortanswer' && (
                          <div className="space-y-1 pt-1">
                            <Label className="text-xs font-semibold text-muted-foreground">Accepted Answer / Key Phrases</Label>
                            <Input
                              value={q.correctAnswer || ''}
                              onChange={(e) => handleUpdateQuestion(qIndex, { correctAnswer: e.target.value })}
                              placeholder="Key phrase or expected solution..."
                              className="text-xs sm:text-sm rounded-xl h-8"
                            />
                          </div>
                        )}

                        {/* Explanation */}
                        <div className="space-y-1.5 pt-1">
                          <Label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            Pedagogical Explanation
                          </Label>
                          <Textarea
                            rows={3}
                            value={q.explanation || ''}
                            onChange={(e) => handleUpdateQuestion(qIndex, { explanation: e.target.value })}
                            className="text-xs sm:text-sm leading-relaxed bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-foreground focus-visible:ring-amber-500/30 rounded-xl"
                            placeholder="Detailed explanation with concepts, steps, and educational emojis..."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                }))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: RECENT AI JOBS */}
          <TabsContent value="history" className="space-y-4 sm:space-y-6">
            <Card className="border-border shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-3.5 sm:p-6 pb-2.5 sm:pb-4 border-b">
                <CardTitle className="text-base sm:text-lg">Recent AI Generation Jobs</CardTitle>
                <CardDescription className="text-xs">
                  Audit and resume past generation batches saved in your organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {recentJobsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No recent AI generation jobs found.
                  </div>
                ) : (
                  <div className="divide-y text-xs">
                    {recentJobsList.map((job) => (
                      <div key={job.jobId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span className="truncate">{job.title || 'Untitled Exam'}</span>
                            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                              {job.status}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-2 text-[11px]">
                            <span>Requested: {job.totalRequested} questions</span>
                            <span>•</span>
                            <span>Generated: {job.totalGenerated}</span>
                            <span>•</span>
                            <span>Difficulty: {job.difficulty}</span>
                            <span>•</span>
                            <span>Language: {job.language}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          {job.questions && job.questions.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl text-xs h-7 sm:h-8"
                              onClick={() => {
                                setGeneratedQuestions(job.questions);
                                setActiveTab('review');
                                toast({ description: `Loaded ${job.questions.length} questions from job ${job.jobId}` });
                              }}
                            >
                              Review Questions ({job.questions.length})
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Provider Engine Settings Dialog */}
      <AIProviderSettingsDialog
        open={showAISettingsDialog}
        onOpenChange={setShowAISettingsDialog}
        onSaved={refreshStatuses}
      />
    </DashboardLayout>
  );
}

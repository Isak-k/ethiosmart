import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BookInput, KeyTerm, ShortNoteSection, NoteExercise } from '@/types/book';
import { createBook } from '@/lib/books';
import { createExam, saveQuestionsBatch } from '@/lib/firebase-exams';
import { getDepartments } from '@/lib/departments';
import { getSubjects } from '@/lib/subjects';
import { Department, Question } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileUp,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  BookOpen,
  GraduationCap,
  Layers,
  ArrowRight,
  HelpCircle,
  Eye,
  Check,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportShortnoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (bookId: string, examId?: string) => void;
  onLoadToStudio?: (data: Partial<BookInput>) => void;
  defaultDepartmentId?: string;
  defaultSubjectId?: string;
}

export function ImportShortnoteDialog({
  open,
  onOpenChange,
  onImportSuccess,
  onLoadToStudio,
  defaultDepartmentId,
  defaultSubjectId,
}: ImportShortnoteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(defaultDepartmentId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId || '');

  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'template'>('paste');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed representation
  const [parsedNote, setParsedNote] = useState<Partial<BookInput> | null>(null);
  const [allExtractedQuestions, setAllExtractedQuestions] = useState<NoteExercise[]>([]);

  // Exam linkage option
  const [createLinkedExam, setCreateLinkedExam] = useState(true);
  const [examDuration, setExamDuration] = useState<number>(60);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Load departments and subjects on mount
  useEffect(() => {
    if (open) {
      Promise.all([
        getDepartments().catch(() => []),
        getSubjects().catch(() => []),
      ]).then(([depts, subs]) => {
        setDepartments(depts);
        setSubjects(subs);
        if (!selectedDeptId && defaultDepartmentId) setSelectedDeptId(defaultDepartmentId);
        if (!selectedSubjectId && defaultSubjectId) setSelectedSubjectId(defaultSubjectId);
      });
    }
  }, [open, defaultDepartmentId, defaultSubjectId]);

  const filteredSubjects = subjects.filter(
    (s) => !selectedDeptId || selectedDeptId === 'all' || s.departmentId === selectedDeptId
  );

  // Parse raw text whenever it changes
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedNote(null);
      setAllExtractedQuestions([]);
      setParseError(null);
      return;
    }

    try {
      setIsParsing(true);
      setParseError(null);

      const trimmed = rawText.trim();
      let result: Partial<BookInput>;

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Parse JSON format
        const json = JSON.parse(trimmed);
        result = normalizeJsonNote(json);
      } else {
        // Parse Markdown format
        result = parseMarkdownNote(trimmed);
      }

      setParsedNote(result);

      // Collect all exercises (from sections and root)
      const questions: NoteExercise[] = [];
      if (Array.isArray(result.exercises)) {
        questions.push(...result.exercises);
      }
      if (Array.isArray(result.sections)) {
        result.sections.forEach((sec) => {
          if (Array.isArray(sec.exercises)) {
            questions.push(...sec.exercises);
          }
        });
      }
      setAllExtractedQuestions(questions);
    } catch (err: any) {
      console.warn('Parsing error:', err);
      setParseError(err.message || 'Invalid format. Please verify JSON syntax or Markdown formatting.');
      setParsedNote(null);
      setAllExtractedQuestions([]);
    } finally {
      setIsParsing(false);
    }
  }, [rawText]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setActiveTab('paste');
      }
    };
    reader.readAsText(file);
  };

  // Normalizer for JSON structure
  const normalizeJsonNote = (data: any): Partial<BookInput> => {
    const sections: ShortNoteSection[] = (data.sections || []).map((sec: any, idx: number) => ({
      id: sec.id || `sec-${idx + 1}`,
      sectionNumber: sec.sectionNumber || `${idx + 1}`,
      title: sec.title || `Section ${idx + 1}`,
      content: sec.content || '',
      keyPoints: Array.isArray(sec.keyPoints) ? sec.keyPoints : [],
      isImportant: Boolean(sec.isImportant),
      learningOutcomes: Array.isArray(sec.learningOutcomes) ? sec.learningOutcomes : [],
      contentBlocks: Array.isArray(sec.contentBlocks) ? sec.contentBlocks : [],
      exercises: Array.isArray(sec.exercises) ? sec.exercises : [],
    }));

    const keyTerms: KeyTerm[] = (data.keyTerms || []).map((kt: any) => ({
      term: kt.term || '',
      definition: kt.definition || '',
    }));

    return {
      title: data.title || 'Untitled Study Note',
      resourceType: 'short_note',
      departmentId: data.departmentId || selectedDeptId || '',
      subjectId: data.subjectId || selectedSubjectId || '',
      chapterTitle: data.chapterTitle || '',
      chapterNumber: Number(data.chapterNumber) || undefined,
      author: data.author || '',
      summary: data.summary || '',
      learningOutcomes: Array.isArray(data.learningOutcomes) ? data.learningOutcomes : [],
      keyTakeaways: Array.isArray(data.keyTakeaways) ? data.keyTakeaways : [],
      keyTerms,
      sections,
      exercises: Array.isArray(data.exercises) ? data.exercises : [],
      readingTimeMinutes: Number(data.readingTimeMinutes) || Math.max(5, Math.ceil(sections.length * 3)),
      status: 'published',
      allowDownload: true,
    };
  };

  // Parser for Markdown format
  const parseMarkdownNote = (text: string): Partial<BookInput> => {
    const lines = text.split('\n');
    let title = '';
    let author = '';
    let chapterTitle = '';
    let summary = '';
    const learningOutcomes: string[] = [];
    const keyTerms: KeyTerm[] = [];
    const sections: ShortNoteSection[] = [];
    const exercises: NoteExercise[] = [];

    let currentSection: ShortNoteSection | null = null;
    let sectionBuffer: string[] = [];

    const flushSection = () => {
      if (currentSection) {
        currentSection.content = sectionBuffer.join('\n').trim();
        sections.push(currentSection);
        currentSection = null;
        sectionBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Title detection (# Heading 1)
      if (line.startsWith('# ') && !title) {
        title = line.replace(/^#\s+/, '').trim();
        continue;
      }

      // Author detection
      if (/^Author:\s*/i.test(line) && !author) {
        author = line.replace(/^Author:\s*/i, '').trim();
        continue;
      }

      // Chapter title
      if (/^Chapter\s*\d*:\s*/i.test(line) && !chapterTitle) {
        chapterTitle = line.trim();
        continue;
      }

      // Section detection (## Heading 2)
      if (line.startsWith('## ')) {
        flushSection();
        const secTitle = line.replace(/^##\s+/, '').trim();
        const secNumMatch = secTitle.match(/^(\d+(?:\.\d+)*)\s*(.*)/);
        currentSection = {
          id: `sec-${sections.length + 1}`,
          sectionNumber: secNumMatch ? secNumMatch[1] : `${sections.length + 1}`,
          title: secNumMatch ? secNumMatch[2] : secTitle,
          content: '',
          keyPoints: [],
          exercises: [],
        };
        continue;
      }

      // MCQ detection within line: Q1. ... or 1. ...
      if (/^(?:Q\d+[\.:]|\d+\.)\s*\[/i.test(line) || /^(?:Q\d+[\.:])\s+/i.test(line)) {
        // Collect MCQ block
        const qText = line.replace(/^(?:Q\d+[\.:]|\d+\.)\s*/, '').trim();
        const options: string[] = [];
        let answer = '';
        let explanation = '';

        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('#') && !/^(?:Q\d+[\.:]|\d+\.)\s*/i.test(lines[j])) {
          const optMatch = lines[j].match(/^[A-Da-d][\.:\)]\s*(.*)/);
          const ansMatch = lines[j].match(/^Answer:\s*([A-Da-d])/i);
          const expMatch = lines[j].match(/^(?:Explanation|Why):\s*(.*)/i);

          if (optMatch) options.push(optMatch[1].trim());
          if (ansMatch) answer = ansMatch[1].toUpperCase().trim();
          if (expMatch) explanation = expMatch[1].trim();
          j++;
        }

        if (options.length >= 2) {
          const exItem: NoteExercise = {
            id: `ex-${exercises.length + 1}`,
            question: qText,
            questionType: 'mcq',
            options,
            correctAnswer: answer,
            solution: {
              answer,
              explanation,
            },
          };
          exercises.push(exItem);
          if (currentSection) {
            currentSection.exercises = currentSection.exercises || [];
            currentSection.exercises.push(exItem);
          }
        }
      }

      if (currentSection) {
        sectionBuffer.push(line);
      }
    }
    flushSection();

    return {
      title: title || 'Imported Study Note',
      resourceType: 'short_note',
      departmentId: selectedDeptId || '',
      subjectId: selectedSubjectId || '',
      chapterTitle: chapterTitle || title,
      author,
      summary,
      learningOutcomes,
      keyTerms,
      sections,
      exercises,
      readingTimeMinutes: Math.max(5, Math.ceil(sections.length * 3)),
      status: 'published',
      allowDownload: true,
    };
  };

  // Save to Firebase
  const handleSaveToLibrary = async () => {
    if (!parsedNote || !parsedNote.title) {
      toast({
        title: 'Missing Note Data',
        description: 'Please paste or upload note content before saving.',
        variant: 'destructive',
      });
      return;
    }

    const deptId = selectedDeptId || parsedNote.departmentId;
    const subId = selectedSubjectId || parsedNote.subjectId;

    if (!deptId || !subId) {
      toast({
        title: 'Department and Subject Required',
        description: 'Please choose which Department and Subject this study note belongs to.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const creatorId = user?.uid || 'admin_user';

      let createdExamId = '';

      // Step 1: Create linked interactive practice exam if enabled and questions exist
      if (createLinkedExam && allExtractedQuestions.length > 0) {
        try {
          const newExamId = await createExam({
            title: `${parsedNote.title} - Practice Assessment`,
            description: `Interactive practice assessment with ${allExtractedQuestions.length} questions based on ${parsedNote.title}.`,
            departmentId: deptId,
            departmentIds: [deptId],
            subjectId: subId,
            chapterTitle: parsedNote.chapterTitle || parsedNote.title,
            durationMinutes: examDuration,
            passingScore: 70,
            isPublished: true,
            examType: 'practice',
            practiceMode: 'practice',
            allowOfflineDownload: true,
            maxAttempts: 10,
            questionCount: allExtractedQuestions.length,
            createdBy: creatorId,
            questions: [],
          });

          // Convert exercises to Question format
          const formattedQuestions: Omit<Question, 'questionId' | 'createdAt'>[] = allExtractedQuestions.map(
            (ex, idx) => {
              const optIndex = ex.correctAnswer
                ? ['A', 'B', 'C', 'D'].indexOf(ex.correctAnswer.toUpperCase())
                : 0;

              return {
                examId: newExamId,
                questionText: ex.question,
                questionType: 'mcq',
                options: ex.options || [],
                correctOptionIndex: optIndex >= 0 ? optIndex : 0,
                correctAnswer: ex.correctAnswer || 'A',
                marks: 1,
                orderIndex: idx + 1,
                feedbackType: 'instant',
                explanation: ex.solution?.explanation || '',
                difficulty: ex.question.includes('[Easy]')
                  ? 'Easy'
                  : ex.question.includes('[Application]')
                  ? 'Hard'
                  : 'Medium',
              };
            }
          );

          await saveQuestionsBatch(newExamId, formattedQuestions);
          createdExamId = newExamId;
        } catch (examErr) {
          console.warn('Could not auto-create linked exam, continuing with book save:', examErr);
        }
      }

      // Step 2: Save the study note book record
      const bookInput: BookInput = {
        title: parsedNote.title,
        resourceType: 'short_note',
        departmentId: deptId,
        subjectId: subId,
        chapterTitle: parsedNote.chapterTitle || parsedNote.title,
        chapterNumber: parsedNote.chapterNumber,
        author: parsedNote.author,
        summary: parsedNote.summary,
        learningOutcomes: parsedNote.learningOutcomes,
        keyTakeaways: parsedNote.keyTakeaways,
        keyTerms: parsedNote.keyTerms,
        sections: parsedNote.sections,
        exercises: parsedNote.exercises,
        readingTimeMinutes: parsedNote.readingTimeMinutes,
        examId: createdExamId || parsedNote.examId || '',
        status: 'published',
        allowDownload: true,
      };

      const newBookId = await createBook(bookInput, creatorId);

      toast({
        title: 'Study Note Imported Successfully! 🎉',
        description: `Imported "${parsedNote.title}" with ${parsedNote.sections?.length || 0} sections${
          createdExamId ? ` and linked interactive exam with ${allExtractedQuestions.length} questions` : ''
        }.`,
      });

      if (onImportSuccess) {
        onImportSuccess(newBookId, createdExamId);
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error('Save error:', err);
      toast({
        title: 'Failed to Save Study Note',
        description: err.message || 'Check database permissions and connection.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Open in Chapter Studio
  const handleOpenInStudio = () => {
    if (!parsedNote) return;

    if (onLoadToStudio) {
      onLoadToStudio({
        ...parsedNote,
        departmentId: selectedDeptId || parsedNote.departmentId,
        subjectId: selectedSubjectId || parsedNote.subjectId,
      });
      onOpenChange(false);
    } else {
      // Store in session storage and redirect
      sessionStorage.setItem(
        'ethiosmart_imported_note_draft',
        JSON.stringify({
          ...parsedNote,
          departmentId: selectedDeptId || parsedNote.departmentId,
          subjectId: selectedSubjectId || parsedNote.subjectId,
        })
      );
      onOpenChange(false);
      navigate('/dashboard/admin/shortnotes/create?fromImport=true');
    }
  };

  // Pre-load Logic & Critical Thinking Ch 2 sample
  const handleLoadSampleLogicCh2 = () => {
    const sample = {
      title: 'Logic and Critical Thinking (PHIL 1011) - Chapter 2: Basic Concepts of Logic',
      author: 'Teklay G., Adane T., Zelalem M. (August 2019)',
      chapterTitle: 'Chapter 2: Basic Concepts of Logic',
      chapterNumber: 2,
      summary:
        'Logic is the science that evaluates arguments. An argument consists of premises offered as evidence to support a conclusion. This chapter explores argument identification, indicator words, distinguishing deduction from induction, and evaluating validity, soundness, strength, and cogency.',
      learningOutcomes: [
        'Explain the meaning of logic and its benefits.',
        'Define statement, argument, premise and conclusion.',
        'Identify premises and conclusions using indicator words and other techniques.',
        'Distinguish arguments from non-arguments (warnings, advice, reports, explanations, conditionals).',
        'Distinguish deductive from inductive arguments and name their common forms.',
        'Evaluate arguments using validity, soundness, strength and cogency.',
      ],
      keyTerms: [
        { term: 'Logic', definition: 'The science that evaluates arguments; the study of methods and principles of correct reasoning.' },
        { term: 'Statement', definition: 'A declarative sentence that has a truth-value: it is either true or false.' },
        { term: 'Argument', definition: 'A group of statements in which one or more statements (premises) are claimed to provide support for another statement (the conclusion).' },
        { term: 'Premise', definition: 'The claimed evidence or reasons offered in an argument.' },
        { term: 'Conclusion', definition: 'The statement that the evidence is claimed to support or establish.' },
        { term: 'Deductive Argument', definition: 'An argument claiming that it is impossible for the premises to be true and the conclusion false.' },
        { term: 'Inductive Argument', definition: 'An argument claiming that it is improbable for the premises to be true and the conclusion false.' },
        { term: 'Valid', definition: 'A deductive argument where true premises guarantee a true conclusion.' },
        { term: 'Sound', definition: 'A deductive argument that is valid and has all true premises.' },
        { term: 'Strong', definition: 'An inductive argument where true premises make the conclusion probable.' },
        { term: 'Cogent', definition: 'An inductive argument that is strong, has all true premises, and does not ignore key evidence.' },
      ],
      sections: [
        {
          id: 'sec-2-1',
          sectionNumber: '2.1',
          title: 'Meaning of Logic',
          content:
            'Logic comes from the Greek word logos, which means sentence, discourse, reason, truth and rule. Logic is the science that evaluates arguments: the study of the methods and principles of correct reasoning.',
          keyPoints: [
            'Logic is the science that evaluates arguments.',
            'Logos means reason, discourse, rule.',
            'Its aim: criteria for judging arguments and guides for making good ones.',
          ],
          exercises: [
            {
              id: 'q-2-1-1',
              question: '[Easy] The word "logic" comes from the Greek word ...',
              options: ['sophia', 'logos', 'physika', 'axios'],
              correctAnswer: 'B',
              solution: { answer: 'B', explanation: 'Logos means sentence, discourse, reason, truth and rule.' },
            },
            {
              id: 'q-2-1-2',
              question: '[Easy] Which definition fits logic best?',
              options: ['The study of beautiful things', 'The study of the origin of the universe', 'The art of winning every debate', 'The science that evaluates arguments'],
              correctAnswer: 'D',
              solution: { answer: 'D', explanation: 'Logic studies methods and principles for evaluating arguments.' },
            },
          ],
        },
        {
          id: 'sec-2-2',
          sectionNumber: '2.2',
          title: 'Benefits of Studying Logic',
          content:
            'The study of logic sharpens and refines our natural gifts to think, reason and argue. It gives us the skill to build sound, fallacy-free arguments and to evaluate the arguments of others.',
          keyPoints: [
            'Logic refines natural ability to think and argue.',
            'It helps both in building and evaluating arguments.',
            'It protects against prejudice and disguised, ill-conceived policies.',
          ],
          exercises: [
            {
              id: 'q-2-2-1',
              question: '[Easy] Studying logic mainly helps us to ...',
              options: ['avoid all disagreement', 'memorize facts faster', 'win by shouting', 'sharpen our ability to think, reason and argue'],
              correctAnswer: 'D',
              solution: { answer: 'D', explanation: 'Logic refines our natural gifts to think, reason and argue.' },
            },
          ],
        },
      ],
    };

    setRawText(JSON.stringify(sample, null, 2));
    setActiveTab('paste');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-display font-bold text-foreground">
                Import Study Notes & Assessment
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm mt-0.5">
                Paste or upload your structured lecture notes. Automatically builds interactive lesson cards, glossary, and practice exams.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Target Department and Subject */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Select Subject" />
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
          </div>

          {/* Input Method Tabs */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="rounded-2xl p-1 bg-muted/60 h-9">
                <TabsTrigger value="paste" className="rounded-xl text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Paste JSON / Markdown
                </TabsTrigger>
                <TabsTrigger value="upload" className="rounded-xl text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="template" className="rounded-xl text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Sample Format
                </TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadSampleLogicCh2}
                className="h-8 text-xs rounded-xl font-semibold border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                <span>Load Logic Ch 2 Sample</span>
              </Button>
            </div>

            {/* Tab 1: Paste Text */}
            <TabsContent value="paste" className="space-y-2 mt-0">
              <Textarea
                placeholder={`Paste your JSON or Markdown notes here...\n\nExample JSON:\n{\n  "title": "Logic and Critical Thinking - Chapter 2",\n  "author": "Teklay G.",\n  "sections": [...],\n  "keyTerms": [...]\n}`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[220px] font-mono text-xs rounded-2xl p-3.5 leading-relaxed bg-background/80"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Supports full JSON schema or structured Markdown with `# Title`, `## Lessons`, and `Q1. MCQs`.</span>
                {rawText && <span>{rawText.length.toLocaleString()} characters</span>}
              </div>
            </TabsContent>

            {/* Tab 2: Upload File */}
            <TabsContent value="upload" className="space-y-3 mt-0">
              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-2xl p-8 text-center bg-card/40 transition-colors">
                <input
                  type="file"
                  id="note-file-input"
                  accept=".json,.md,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="note-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Click to choose a file or drag & drop here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Supports .json, .md, .txt
                    </p>
                  </div>
                </label>
                {fileName && (
                  <Badge variant="secondary" className="mt-3 text-xs py-1 px-3">
                    Selected: {fileName}
                  </Badge>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Template Guide */}
            <TabsContent value="template" className="space-y-3 mt-0">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground">Standard JSON Format Reference</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            title: 'Logic and Critical Thinking - Chapter 2',
                            author: 'Teklay G., Adane T., Zelalem M.',
                            chapterTitle: 'Chapter 2: Basic Concepts of Logic',
                            summary: 'Chapter summary text...',
                            learningOutcomes: ['Objective 1', 'Objective 2'],
                            keyTerms: [{ term: 'Logic', definition: 'Science of arguments...' }],
                            sections: [
                              {
                                sectionNumber: '2.1',
                                title: 'Meaning of Logic',
                                content: 'Full lesson text...',
                                keyPoints: ['Point 1', 'Point 2'],
                                exercises: [
                                  {
                                    question: 'Which definition fits logic best?',
                                    options: ['Study of beauty', 'Science that evaluates arguments'],
                                    correctAnswer: 'B',
                                    solution: { answer: 'B', explanation: 'Logic studies arguments.' },
                                  },
                                ],
                              },
                            ],
                          },
                          null,
                          2
                        )
                      );
                      setCopiedTemplate(true);
                      setTimeout(() => setCopiedTemplate(false), 2000);
                    }}
                    className="h-7 text-xs gap-1 rounded-xl"
                  >
                    {copiedTemplate ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedTemplate ? 'Copied!' : 'Copy Template'}</span>
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  You can include full chapter lessons with definitions, step-by-step points, comparison tables, real-world scenarios, and practice MCQs.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Parsing Errors */}
          {parseError && (
            <Alert variant="destructive" className="rounded-2xl text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Format Warning</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Real-time Parser Analysis Card */}
          {parsedNote && (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-foreground">
                    Study Note Successfully Analyzed
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Ready to Import
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {parsedNote.title}
                </h3>
                {parsedNote.author && (
                  <p className="text-xs text-muted-foreground">Author: {parsedNote.author}</p>
                )}
              </div>

              {/* Statistics Pill Badges */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Badge variant="secondary" className="bg-background/80 py-1 px-2.5">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  {parsedNote.sections?.length || 0} Lessons / Sections
                </Badge>
                <Badge variant="secondary" className="bg-background/80 py-1 px-2.5">
                  <BookOpen className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                  {parsedNote.keyTerms?.length || 0} Key Terms
                </Badge>
                <Badge variant="secondary" className="bg-background/80 py-1 px-2.5">
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                  {allExtractedQuestions.length} Practice MCQs
                </Badge>
              </div>

              {/* Linked Interactive Exam Checkbox */}
              {allExtractedQuestions.length > 0 && (
                <div className="p-3 rounded-xl bg-background/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create-linked-exam-check"
                      checked={createLinkedExam}
                      onCheckedChange={(c) => setCreateLinkedExam(Boolean(c))}
                    />
                    <Label
                      htmlFor="create-linked-exam-check"
                      className="text-xs font-semibold text-foreground cursor-pointer"
                    >
                      Auto-generate & link Interactive Assessment Exam ({allExtractedQuestions.length} questions)
                    </Label>
                  </div>

                  {createLinkedExam && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-[11px] text-muted-foreground">Timer (mins):</Label>
                      <Input
                        type="number"
                        value={examDuration}
                        onChange={(e) => setExamDuration(Number(e.target.value) || 60)}
                        className="w-16 h-7 text-xs rounded-lg"
                        min={5}
                        max={300}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleOpenInStudio}
            disabled={!parsedNote || isSaving}
            className="rounded-xl text-xs font-semibold border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Open & Edit in Studio</span>
          </Button>

          <Button
            type="button"
            onClick={handleSaveToLibrary}
            disabled={!parsedNote || isSaving}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-purple-500/20 gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importing & Saving...</span>
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" />
                <span>Save to Library & Exams</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

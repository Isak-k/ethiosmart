import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, ShortNoteSection, KeyTerm } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Bookmark,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Layers,
  Search,
  Printer,
  Share2,
  ExternalLink,
  GraduationCap,
  AlertCircle,
  Lightbulb,
  Volume2,
  VolumeX,
  Type,
  BookMarked,
  Check,
  RotateCw,
  Eye,
  EyeOff,
  Flame,
  ListOrdered,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface InteractiveShortNoteReaderProps {
  book: Book;
  onBack?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onStartExam?: (examId?: string) => void;
}

export function InteractiveShortNoteReader({
  book,
  onBack,
  isBookmarked = false,
  onToggleBookmark,
  onStartExam,
}: InteractiveShortNoteReaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const sections: ShortNoteSection[] = Array.isArray(book?.sections) ? book.sections : [];
  const keyTerms: KeyTerm[] = Array.isArray(book?.keyTerms) ? book.keyTerms : [];
  const keyTakeaways: string[] = Array.isArray(book?.keyTakeaways) ? book.keyTakeaways : [];

  // Expanded sections state: start with all sections expanded for natural book reading flow
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => {
    return new Set(sections.map((s, idx) => s?.id || `sec-${idx}`));
  });

  // Track student section mastery checkboxes (persisted in local storage by book id)
  const storageKey = `exampro_mastery_${book?.id || 'temp'}`;
  const [masteredSectionIds, setMasteredSectionIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  const toggleMastery = (secId: string) => {
    setMasteredSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(secId)) next.delete(secId);
      else next.add(secId);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Font size multiplier: 'sm' | 'base' | 'lg'
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Book font family: 'sans' (Modern) vs 'serif' (Classic Book)
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('serif');

  // Glossary display mode: 'grid' or 'flashcards'
  const [glossaryMode, setGlossaryMode] = useState<'grid' | 'flashcards'>('grid');
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Term glossary search filter
  const [termSearch, setTermSearch] = useState('');

  // Audio Read Aloud (Web Speech API)
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reading progress tracking (scroll percent)
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(Math.min(100, Math.max(0, Math.round(currentProgress))));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'Speech not supported',
        description: 'Text-to-speech is not supported in this browser.',
        variant: 'destructive',
      });
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Build speech text from summary and sections
    const speechChunks: string[] = [];
    if (book?.title) speechChunks.push(book.title);
    if (book?.summary) speechChunks.push(`Chapter Summary: ${book.summary}`);
    sections.forEach((sec, idx) => {
      speechChunks.push(`Section ${idx + 1}: ${sec.title}. ${sec.content}`);
      if (sec.keyPoints && sec.keyPoints.length > 0) {
        speechChunks.push(`Key points: ${sec.keyPoints.join('. ')}`);
      }
    });

    const fullText = speechChunks.join('\n\n');
    const utterance = new SpeechSynthesisUtterance(fullText.slice(0, 3000));
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const toggleSection = (id: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedSectionIds(new Set(sections.map((s, idx) => s?.id || `sec-${idx}`)));
  };

  const handleCollapseAll = () => {
    setExpandedSectionIds(new Set());
  };

  const scrollToSection = (id: string) => {
    setExpandedSectionIds((prev) => new Set(prev).add(id));
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: book?.title || 'Interactive Shortnotes',
          text: book?.summary || book?.description || `Study notes for ${book?.title}`,
          url: window.location.href,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Shortnote link copied to clipboard.',
      });
    }
  };

  const filteredTerms = keyTerms.filter(
    (t) =>
      Boolean(t) &&
      (((t.term || '').toLowerCase().includes(termSearch.toLowerCase())) ||
       ((t.definition || '').toLowerCase().includes(termSearch.toLowerCase())))
  );

  const textSizeClass =
    fontSize === 'sm'
      ? 'text-sm sm:text-base leading-relaxed sm:leading-7'
      : fontSize === 'lg'
      ? 'text-lg sm:text-xl leading-relaxed sm:leading-9'
      : 'text-base sm:text-lg leading-relaxed sm:leading-8';

  const fontStyleClass = fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  // Mastery percentage
  const masteryPercentage = sections.length > 0
    ? Math.round((masteredSectionIds.size / sections.length) * 100)
    : 100;

  return (
    <div className={`relative min-h-screen pb-24 ${fontStyleClass}`}>
      {/* Reading Progress Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-amber-500/20 z-50 print:hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Main Book-like Container with Warm Explanation Background */}
      <div className="max-w-4xl mx-auto space-y-6 pt-2">
        {/* Top Floating Academic Header Toolbar */}
        <div className="sticky top-2 z-40 flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-amber-500/25 dark:border-amber-500/30 shadow-md print:hidden">
          {/* Back & Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack || (() => navigate('/dashboard/books'))}
              className="rounded-xl text-xs sm:text-sm font-semibold gap-1.5 h-8 px-2.5 text-foreground hover:bg-amber-500/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Library
            </Button>
            <div className="h-4 w-px bg-border" />
            <Badge
              variant="outline"
              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            >
              {book.subjectName || 'Curriculum Subject'}
            </Badge>
            {book.chapterNumber && (
              <Badge variant="secondary" className="text-[11px] hidden sm:inline-flex rounded-lg font-bold">
                Unit {book.chapterNumber}
              </Badge>
            )}
          </div>

          {/* Book Reading Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Font Style Toggle: Serif (Classic Book) vs Sans (Modern) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFontFamily((prev) => (prev === 'serif' ? 'sans' : 'serif'))}
              className="h-8 px-2 text-xs rounded-xl text-muted-foreground hover:text-foreground font-semibold"
              title={fontFamily === 'serif' ? 'Switch to Modern Sans font' : 'Switch to Book Serif font'}
            >
              <Type className="h-3.5 w-3.5 mr-1" />
              <span className="text-[11px]">{fontFamily === 'serif' ? 'Serif' : 'Sans'}</span>
            </Button>

            {/* Font Sizing Buttons */}
            <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setFontSize('sm')}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-colors ${
                  fontSize === 'sm' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
                title="Small text"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-colors ${
                  fontSize === 'base' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
                title="Standard text"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('lg')}
                className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-colors ${
                  fontSize === 'lg' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
                title="Large text"
              >
                A+
              </button>
            </div>

            {/* Audio Read-Aloud Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSpeech}
              className={`h-8 px-2 text-xs rounded-xl font-semibold transition-all ${
                isSpeaking
                  ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
                  : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
              }`}
              title={isSpeaking ? 'Stop Audio Read-Aloud' : 'Read Chapter Aloud'}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 mr-1" />
                  Listen
                </>
              )}
            </Button>

            {onToggleBookmark && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleBookmark}
                className={`h-8 w-8 rounded-xl ${
                  isBookmarked ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground'
                }`}
                title="Bookmark chapter"
              >
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              title="Share notes"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              title="Print or Save PDF"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* BOOK FRONT MATTER & COVER HEADER (Using the explanation amber gradient background) */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background p-6 sm:p-9 shadow-md animate-fade-in">
          {/* Subtle Decorative Book Stamp */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-15 pointer-events-none">
            <BookOpen className="h-28 w-28 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-4 max-w-2xl relative z-10">
            {/* Academic Chapter Tag & Reading Estimate */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Interactive Chapter Shortnotes
              </span>
              <span>•</span>
              <div className="flex items-center gap-1 font-mono text-muted-foreground normal-case">
                <Clock className="h-3 w-3" />
                <span>~{book.readingTimeMinutes || 5} min read</span>
              </div>
              {sections.length > 0 && (
                <>
                  <span>•</span>
                  <span className="font-mono text-muted-foreground normal-case">
                    {sections.length} topics
                  </span>
                </>
              )}
            </div>

            {/* Chapter Book Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground tracking-tight leading-tight">
              {book.title}
            </h1>

            {/* Chapter Subtitle / Author Info */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground pt-1">
              <span>{book.author ? `Prepared by ${book.author}` : 'Official ExamPro Curriculum Team'}</span>
              {book.chapterTitle && (
                <>
                  <span className="text-border">•</span>
                  <span className="text-foreground font-semibold">{book.chapterTitle}</span>
                </>
              )}
            </div>

            {/* Chapter Executive Summary */}
            {book.summary && (
              <div className="pt-3 border-t border-amber-500/20">
                <p className="text-sm sm:text-base leading-relaxed text-foreground/90 italic font-medium">
                  &ldquo;{book.summary}&rdquo;
                </p>
              </div>
            )}

            {/* Mastery Progress Pill */}
            {sections.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 max-w-xs h-2 rounded-full bg-amber-500/20 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${masteryPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {masteredSectionIds.size} of {sections.length} topics mastered ({masteryPercentage}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* INTERACTIVE TABLE OF CONTENTS (TOC) PILL STRIP */}
        {sections.length > 1 && (
          <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 bg-card shadow-xs print:hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered className="h-3.5 w-3.5 text-primary" />
                Table of Contents & Quick Navigation
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandAll}
                  className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                >
                  Expand all
                </Button>
                <span className="text-border text-xs">•</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                >
                  Collapse all
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {sections.map((sec, idx) => {
                const secId = sec?.id || `sec-${idx}`;
                const isMastered = masteredSectionIds.has(secId);
                return (
                  <button
                    key={secId}
                    type="button"
                    onClick={() => scrollToSection(secId)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none border ${
                      isMastered
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border/60 bg-muted/30 text-foreground hover:border-amber-500/40 hover:bg-amber-500/10'
                    }`}
                  >
                    <span className="font-mono text-[11px] opacity-70">§ {idx + 1}</span>
                    <span className="truncate max-w-[160px]">{sec.title || `Topic ${idx + 1}`}</span>
                    {isMastered && <Check className="h-3 w-3 text-emerald-500" />}
                    {sec.isImportant && <Flame className="h-3 w-3 text-amber-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* KEY CHAPTER TAKEAWAYS (Illuminated Learning Objectives Card) */}
        {keyTakeaways.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-amber-500/25 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background shadow-sm animate-fade-in">
            <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-border/60 bg-muted/40 dark:bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Key Chapter Takeaways & Learning Objectives
                </h3>
              </div>
              <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
                High-Yield Focus
              </Badge>
            </div>

            <div className="p-4 sm:p-6">
              <ul className="grid sm:grid-cols-2 gap-3">
                {keyTakeaways.map((takeaway, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground leading-relaxed bg-background/80 p-3 rounded-xl border border-amber-500/20 shadow-2xs"
                  >
                    <span className="h-5 w-5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* CORE CHAPTER TOPIC SECTIONS (Book Pages with Explanation Background) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
                Chapter Topics & Study Notes ({sections.length})
              </h2>
            </div>
          </div>

          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((section, index) => {
                const secId = section?.id || `sec-${index}`;
                const isExpanded = expandedSectionIds.has(secId);
                const isMastered = masteredSectionIds.has(secId);
                const keyPoints = Array.isArray(section?.keyPoints) ? section.keyPoints : [];

                return (
                  <div
                    key={secId}
                    id={secId}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                      isExpanded
                        ? 'border-amber-500/30 dark:border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background'
                        : 'border-border/80 bg-card hover:border-amber-500/30'
                    }`}
                  >
                    {/* Interactive Book Section Header Button */}
                    <div className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/40 dark:bg-muted/20 border-b border-border/60 gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSection(secId)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left select-none group"
                        aria-expanded={isExpanded}
                      >
                        <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                          § {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {section?.title || `Section ${index + 1}`}
                            </h3>
                            {section?.isImportant && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 py-0 h-4"
                              >
                                High Yield
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Mark as Mastered Checkbox Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMastery(secId)}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 transition-all ${
                            isMastered
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                          title={isMastered ? 'Section marked as understood' : 'Mark section as understood'}
                        >
                          <Check className={`h-3.5 w-3.5 ${isMastered ? 'text-emerald-500 stroke-[3]' : 'opacity-40'}`} />
                          <span className="hidden sm:inline">{isMastered ? 'Mastered' : 'Mark Read'}</span>
                        </Button>

                        {/* Expand / Collapse Icon */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSection(secId)}
                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Section Body (Book Page with Explanation Styling) */}
                    {isExpanded && (
                      <div className="p-5 sm:p-7 space-y-5 animate-fade-in">
                        {/* Detailed Academic Content Paragraphs */}
                        <div
                          className={`${textSizeClass} text-foreground whitespace-pre-wrap font-normal selection:bg-amber-500/20`}
                        >
                          {section?.content || 'No text content available for this section.'}
                        </div>

                        {/* Quick Review Highlights (Framed in the Explanation Box) */}
                        {keyPoints.length > 0 && (
                          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 dark:bg-amber-500/15 p-4 sm:p-5 space-y-2.5 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <span>Key Highlights & Exam Focus</span>
                            </div>
                            <ul className="space-y-2 pt-1">
                              {keyPoints.map((pt, pIdx) => (
                                <li
                                  key={pIdx}
                                  className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground leading-relaxed"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400 mt-2 shrink-0" />
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background text-foreground space-y-2">
              <p className="text-sm font-semibold">
                {book?.content || book?.description || 'No section content available.'}
              </p>
            </div>
          )}
        </div>

        {/* CHAPTER GLOSSARY & INTERACTIVE FLASHCARDS */}
        {keyTerms.length > 0 && (
          <div className="rounded-3xl border border-amber-500/25 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/5 via-muted/30 to-background p-5 sm:p-7 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Chapter Glossary & Terminology ({keyTerms.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Academic definitions to remember for examinations.
                  </p>
                </div>
              </div>

              {/* Mode Switch: Dictionary Grid vs Flashcards */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-border/80 bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setGlossaryMode('grid')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      glossaryMode === 'grid'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Dictionary
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGlossaryMode('flashcards');
                      setIsFlipped(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      glossaryMode === 'flashcards'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Flashcards
                  </button>
                </div>
              </div>
            </div>

            {/* FLASHCARD MODE */}
            {glossaryMode === 'flashcards' ? (
              <div className="max-w-md mx-auto py-3 space-y-4">
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="cursor-pointer min-h-[190px] rounded-2xl border-2 border-amber-500/30 bg-card p-6 flex flex-col items-center justify-center text-center shadow-md hover:border-amber-500 transition-all select-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                    Card {activeFlashcardIndex + 1} of {keyTerms.length} • Click to {isFlipped ? 'Show Term' : 'Reveal Definition'}
                  </span>
                  {!isFlipped ? (
                    <div className="space-y-2">
                      <h4 className="text-xl sm:text-2xl font-bold text-foreground">
                        {keyTerms[activeFlashcardIndex]?.term}
                      </h4>
                      <p className="text-xs text-muted-foreground">Tap anywhere to flip</p>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-fade-in">
                      <p className="text-sm sm:text-base leading-relaxed text-foreground font-medium">
                        {keyTerms[activeFlashcardIndex]?.definition}
                      </p>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        ({keyTerms[activeFlashcardIndex]?.term})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={activeFlashcardIndex === 0}
                    onClick={() => {
                      setActiveFlashcardIndex((prev) => Math.max(0, prev - 1));
                      setIsFlipped(false);
                    }}
                    className="rounded-xl text-xs h-8"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    className="rounded-xl text-xs h-8 gap-1"
                  >
                    <RotateCw className="h-3 w-3" />
                    Flip
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={activeFlashcardIndex === keyTerms.length - 1}
                    onClick={() => {
                      setActiveFlashcardIndex((prev) => Math.min(keyTerms.length - 1, prev + 1));
                      setIsFlipped(false);
                    }}
                    className="rounded-xl text-xs h-8"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : (
              /* DICTIONARY GRID MODE */
              <div className="space-y-3">
                {keyTerms.length > 4 && (
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter glossary terms..."
                      value={termSearch}
                      onChange={(e) => setTermSearch(e.target.value)}
                      className="pl-8 h-8 rounded-xl text-xs bg-background"
                    />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {filteredTerms.map((termItem, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-amber-500/20 bg-background/80 hover:border-amber-500/40 transition-colors shadow-2xs space-y-1"
                    >
                      <div className="font-bold text-sm text-amber-700 dark:text-amber-300">
                        {termItem.term}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {termItem.definition}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* END OF CHAPTER EXAM READINESS CALLOUT */}
        <div className="overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-5 print:hidden">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 font-bold text-lg sm:text-xl">
              <GraduationCap className="h-6 w-6 text-amber-100" />
              <span>Chapter Completed! Test Your Recall</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-50 leading-relaxed">
              Solidify what you just read. Practice exam questions for {book.subjectName || 'this chapter'} are waiting with instant explanations.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => {
              if (onStartExam) {
                onStartExam();
              } else {
                navigate(
                  book.subjectId
                    ? `/dashboard/exams?subjectId=${book.subjectId}`
                    : '/dashboard/exams'
                );
              }
            }}
            className="rounded-2xl font-bold gap-2 shrink-0 bg-white hover:bg-amber-50 text-amber-900 shadow-md h-11 px-6 text-sm"
          >
            <FileQuestion className="h-4 w-4 text-amber-600" />
            Take Practice Exam
          </Button>
        </div>
      </div>
    </div>
  );
}

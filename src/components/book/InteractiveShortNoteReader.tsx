import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, ShortNoteSection, KeyTerm, NoteExercise, NoteContentBlock } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  BookOpen,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Bookmark,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Layers,
  Search,
  X,
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
  Flame,
  ListOrdered,
  BookCheck,
  Palette,
  Maximize2,
  Minimize2,
  Columns,
  List,
  Sliders,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getExamsBySubject } from '@/lib/firebase-exams';
import { FormattedProseWithMath, MathContent } from '@/components/notes/MathContent';
import { ContentBlockRenderer } from '@/components/notes/ContentBlockRenderer';
import { InteractiveExerciseCard } from '@/components/notes/InteractiveExerciseCard';
import { ExpertFlashcards } from '@/components/notes/ExpertFlashcards';
import { ExpertDictionary } from '@/components/notes/ExpertDictionary';

// -------------------------------------------------------------
// Subject Visual Identity (Emojis, Gradients, Subject Colors)
// -------------------------------------------------------------
export interface SubjectVisualTheme {
  emoji: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  titleColor: string;
  bannerBg: string;
  bannerBorder: string;
  iconBg: string;
}

export function getSubjectVisualTheme(subjectName: string = '', category: string = ''): SubjectVisualTheme {
  const s = `${subjectName} ${category}`.toLowerCase();

  // Psychology / Behavioral / Cognitive
  if (s.includes('psycholog') || s.includes('mental') || s.includes('mind') || s.includes('cognit') || s.includes('behavior') || s.includes('brain')) {
    return {
      emoji: '🧠',
      badgeBg: 'bg-purple-500/15',
      badgeText: 'text-purple-600 dark:text-purple-400',
      badgeBorder: 'border-purple-500/30',
      titleColor: 'text-purple-600 dark:text-purple-400',
      bannerBg: 'bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent',
      bannerBorder: 'border-purple-500/35',
      iconBg: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    };
  }

  // Mathematics / Calculus / Algebra
  if (s.includes('math') || s.includes('calculus') || s.includes('algebra') || s.includes('geometr') || s.includes('statist')) {
    return {
      emoji: '📐',
      badgeBg: 'bg-blue-500/15',
      badgeText: 'text-blue-600 dark:text-blue-400',
      badgeBorder: 'border-blue-500/30',
      titleColor: 'text-blue-600 dark:text-blue-400',
      bannerBg: 'bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent',
      bannerBorder: 'border-blue-500/35',
      iconBg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    };
  }

  // Physics / Mechanics / Astronomy
  if (s.includes('physic') || s.includes('astronom') || s.includes('mechanic') || s.includes('electr') || s.includes('energy')) {
    return {
      emoji: '⚡',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-600 dark:text-amber-400',
      badgeBorder: 'border-amber-500/30',
      titleColor: 'text-amber-600 dark:text-amber-400',
      bannerBg: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
      bannerBorder: 'border-amber-500/35',
      iconBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    };
  }

  // Chemistry
  if (s.includes('chemist') || s.includes('molecule') || s.includes('element') || s.includes('compound') || s.includes('reaction')) {
    return {
      emoji: '🧪',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/30',
      titleColor: 'text-emerald-600 dark:text-emerald-400',
      bannerBg: 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent',
      bannerBorder: 'border-emerald-500/35',
      iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    };
  }

  // Biology / Life Science / Genetics
  if (s.includes('biolog') || s.includes('genet') || s.includes('ecolog') || s.includes('anatom') || s.includes('life')) {
    return {
      emoji: '🧬',
      badgeBg: 'bg-green-500/15',
      badgeText: 'text-green-600 dark:text-green-400',
      badgeBorder: 'border-green-500/30',
      titleColor: 'text-green-600 dark:text-green-400',
      bannerBg: 'bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent',
      bannerBorder: 'border-green-500/35',
      iconBg: 'bg-green-500/20 text-green-600 dark:text-green-400',
    };
  }

  // Computer Science / IT / Programming
  if (s.includes('comput') || s.includes('program') || s.includes('code') || s.includes('software') || s.includes('it')) {
    return {
      emoji: '💻',
      badgeBg: 'bg-cyan-500/15',
      badgeText: 'text-cyan-600 dark:text-cyan-400',
      badgeBorder: 'border-cyan-500/30',
      titleColor: 'text-cyan-600 dark:text-cyan-400',
      bannerBg: 'bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-transparent',
      bannerBorder: 'border-cyan-500/35',
      iconBg: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
    };
  }

  // History / Social Studies / Civics
  if (s.includes('history') || s.includes('civic') || s.includes('geograph') || s.includes('social')) {
    return {
      emoji: '🏛️',
      badgeBg: 'bg-amber-600/15',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-600/30',
      titleColor: 'text-amber-700 dark:text-amber-300',
      bannerBg: 'bg-gradient-to-br from-amber-600/15 via-amber-600/5 to-transparent',
      bannerBorder: 'border-amber-600/35',
      iconBg: 'bg-amber-600/20 text-amber-700 dark:text-amber-300',
    };
  }

  // Economics / Business / Finance
  if (s.includes('econom') || s.includes('busin') || s.includes('financ') || s.includes('market') || s.includes('account')) {
    return {
      emoji: '📈',
      badgeBg: 'bg-teal-500/15',
      badgeText: 'text-teal-600 dark:text-teal-400',
      badgeBorder: 'border-teal-500/30',
      titleColor: 'text-teal-600 dark:text-teal-400',
      bannerBg: 'bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent',
      bannerBorder: 'border-teal-500/35',
      iconBg: 'bg-teal-500/20 text-teal-600 dark:text-teal-400',
    };
  }

  // Literature / English / Humanities
  if (s.includes('literat') || s.includes('english') || s.includes('languag') || s.includes('art') || s.includes('poet')) {
    return {
      emoji: '📚',
      badgeBg: 'bg-rose-500/15',
      badgeText: 'text-rose-600 dark:text-rose-400',
      badgeBorder: 'border-rose-500/30',
      titleColor: 'text-rose-600 dark:text-rose-400',
      bannerBg: 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent',
      bannerBorder: 'border-rose-500/35',
      iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
    };
  }

  // Default theme
  return {
    emoji: '📘',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
    titleColor: 'text-indigo-600 dark:text-indigo-400',
    bannerBg: 'bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent',
    bannerBorder: 'border-indigo-500/35',
    iconBg: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  };
}

// -------------------------------------------------------------
// Rotating Section Palettes (Colors & Emojis for Topics & Main Points)
// -------------------------------------------------------------
export const SECTION_PALETTES = [
  {
    name: 'blue',
    emoji: '📘',
    badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    titleColor: 'text-blue-600 dark:text-blue-400',
    headerAccent: 'hover:border-blue-500/40',
    kpBox: 'border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-blue-500/5',
    kpTitle: 'text-blue-900 dark:text-blue-200',
    kpIcon: '💡',
    kpDot: 'bg-blue-500',
  },
  {
    name: 'rose',
    emoji: '🎯',
    badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    titleColor: 'text-rose-600 dark:text-rose-400',
    headerAccent: 'hover:border-rose-500/40',
    kpBox: 'border-2 border-rose-500/40 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-rose-500/5',
    kpTitle: 'text-rose-900 dark:text-rose-200',
    kpIcon: '⚡',
    kpDot: 'bg-rose-500',
  },
  {
    name: 'purple',
    emoji: '🧠',
    badgeBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    titleColor: 'text-purple-600 dark:text-purple-400',
    headerAccent: 'hover:border-purple-500/40',
    kpBox: 'border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/15 via-purple-500/10 to-purple-500/5',
    kpTitle: 'text-purple-900 dark:text-purple-200',
    kpIcon: '💎',
    kpDot: 'bg-purple-500',
  },
  {
    name: 'emerald',
    emoji: '🌿',
    badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    titleColor: 'text-emerald-600 dark:text-emerald-400',
    headerAccent: 'hover:border-emerald-500/40',
    kpBox: 'border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-500/5',
    kpTitle: 'text-emerald-900 dark:text-emerald-200',
    kpIcon: '🔑',
    kpDot: 'bg-emerald-500',
  },
  {
    name: 'amber',
    emoji: '🔥',
    badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    titleColor: 'text-amber-600 dark:text-amber-400',
    headerAccent: 'hover:border-amber-500/40',
    kpBox: 'border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-500/5',
    kpTitle: 'text-amber-900 dark:text-amber-200',
    kpIcon: '📌',
    kpDot: 'bg-amber-500',
  },
  {
    name: 'cyan',
    emoji: '🔬',
    badgeBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    titleColor: 'text-cyan-600 dark:text-cyan-400',
    headerAccent: 'hover:border-cyan-500/40',
    kpBox: 'border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 via-cyan-500/10 to-cyan-500/5',
    kpTitle: 'text-cyan-900 dark:text-cyan-200',
    kpIcon: '⭐',
    kpDot: 'bg-cyan-500',
  },
];

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
  const topExercises: NoteExercise[] = Array.isArray(book?.exercises) ? book.exercises : [];

  const subjectNameLower = (book?.subjectName || book?.title || '').toLowerCase();
  const isMathOrPhysics =
    subjectNameLower.includes('math') ||
    subjectNameLower.includes('physic') ||
    subjectNameLower.includes('calculus') ||
    subjectNameLower.includes('algebra') ||
    subjectNameLower.includes('geometry') ||
    subjectNameLower.includes('mechanic');

  // Expanded sections state: start with all sections expanded for natural reading flow
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

  // Font size multiplier: 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl' | '2xl'>(() => {
    try {
      const saved = localStorage.getItem('exampro_notes_fontsize');
      if (saved === 'sm' || saved === 'base' || saved === 'lg' || saved === 'xl' || saved === '2xl') return saved;
    } catch {}
    return 'base';
  });

  const updateFontSize = (size: 'sm' | 'base' | 'lg' | 'xl' | '2xl') => {
    setFontSize(size);
    try {
      localStorage.setItem('exampro_notes_fontsize', size);
    } catch {}
  };

  const stepFontSize = (direction: 'up' | 'down') => {
    const sizes: ('sm' | 'base' | 'lg' | 'xl' | '2xl')[] = ['sm', 'base', 'lg', 'xl', '2xl'];
    const idx = sizes.indexOf(fontSize);
    if (direction === 'up' && idx < sizes.length - 1) {
      updateFontSize(sizes[idx + 1]);
    } else if (direction === 'down' && idx > 0) {
      updateFontSize(sizes[idx - 1]);
    }
  };

  // Book font family: 'serif' (Classic Academic Book) | 'sans' (Modern Clean) | 'mono' (Technical / Dyslexic)
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>(() => {
    try {
      const saved = localStorage.getItem('exampro_notes_fontfamily');
      if (saved === 'sans' || saved === 'serif' || saved === 'mono') return saved;
    } catch {}
    return 'serif';
  });

  const updateFontFamily = (family: 'sans' | 'serif' | 'mono') => {
    setFontFamily(family);
    try {
      localStorage.setItem('exampro_notes_fontfamily', family);
    } catch {}
  };

  // Reader Theme / Background Color: 'day' | 'sepia' | 'slate' | 'night'
  const [theme, setTheme] = useState<'day' | 'sepia' | 'slate' | 'night'>(() => {
    try {
      const saved = localStorage.getItem('exampro_notes_theme');
      if (saved === 'day' || saved === 'sepia' || saved === 'slate' || saved === 'night') return saved;
    } catch {}
    return 'day';
  });

  const updateTheme = (newTheme: 'day' | 'sepia' | 'slate' | 'night') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('exampro_notes_theme', newTheme);
    } catch {}
  };

  // Edge-to-Edge Fluid Screen Layout (reach screen edges without constrained card borders)
  const [isEdgeToEdge, setIsEdgeToEdge] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('exampro_notes_edgetoedge');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true; // Default true so reading reaches screen edges naturally
  });

  const toggleEdgeToEdge = () => {
    setIsEdgeToEdge((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('exampro_notes_edgetoedge', String(next));
      } catch {}
      return next;
    });
  };

  // Modals & Panels
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);

  // In-note search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Glossary display mode: 'flashcards' | 'grid'
  const [glossaryMode, setGlossaryMode] = useState<'flashcards' | 'grid'>('flashcards');

  // Audio Read Aloud (Web Speech API)
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reading progress tracking (scroll percent)
  const [readingProgress, setReadingProgress] = useState(0);

  // Current active section index based on scroll position
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(Math.min(100, Math.max(0, Math.round(currentProgress))));
      }

      // Detect current visible section
      if (sections.length > 0) {
        let currentIdx = 0;
        for (let i = 0; i < sections.length; i++) {
          const el = document.getElementById(sections[i]?.id || `sec-${i}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 200) {
              currentIdx = i;
            }
          }
        }
        setActiveSectionIndex(currentIdx);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

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

    // Build speech text from summary, takeaways, and sections
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
    const utterance = new SpeechSynthesisUtterance(fullText.slice(0, 4500));
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
    setIsTocOpen(false);
    setTimeout(() => {
      const elem = document.getElementById(id);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const navigateToSectionIndex = (index: number) => {
    if (index >= 0 && index < sections.length) {
      const sec = sections[index];
      const secId = sec?.id || `sec-${index}`;
      scrollToSection(secId);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: book?.title || 'Interactive Study Notes',
          text: book?.summary || book?.description || `Study notes for ${book?.title}`,
          url: window.location.href,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Study note link copied to clipboard.',
      });
    }
  };

  // Filter sections by search query if search is active
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((sec) => {
      const inTitle = (sec.title || '').toLowerCase().includes(q);
      const inContent = (sec.content || '').toLowerCase().includes(q);
      const inKeyPoints = (sec.keyPoints || []).some((kp) => kp.toLowerCase().includes(q));
      const inBlocks = (sec.contentBlocks || []).some(
        (b) =>
          (b.title || '').toLowerCase().includes(q) ||
          (b.content || '').toLowerCase().includes(q)
      );
      const inExercises = (sec.exercises || []).some(
        (e) =>
          (e.question || '').toLowerCase().includes(q) ||
          (e.solution?.answer || '').toLowerCase().includes(q)
      );
      return inTitle || inContent || inKeyPoints || inBlocks || inExercises;
    });
  }, [sections, searchQuery]);

  // Typography & Reading Sizing
  const textSizeClass =
    fontSize === 'sm'
      ? 'text-sm sm:text-base leading-relaxed sm:leading-7'
      : fontSize === 'lg'
      ? 'text-lg sm:text-xl leading-relaxed sm:leading-8'
      : fontSize === 'xl'
      ? 'text-xl sm:text-2xl leading-relaxed sm:leading-9'
      : fontSize === '2xl'
      ? 'text-2xl sm:text-3xl leading-relaxed sm:leading-10'
      : 'text-base sm:text-lg leading-relaxed sm:leading-8';

  const fontStyleClass =
    fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  // Theme Styling - 100% Theme Isolation (Pure Day White, Warm Sepia, Deep Slate, OLED Night)
  // Guarantees reading background and cards are NEVER inverted by the device's OS light/dark mode
  const isThemeDark = theme === 'slate' || theme === 'night';

  const themeContainerClass =
    theme === 'sepia'
      ? 'bg-[#FAF6EE] text-[#2C2416]'
      : theme === 'slate'
      ? 'bg-[#0F172A] text-[#F1F5F9]'
      : theme === 'night'
      ? 'bg-black text-[#F4F4F5]'
      : 'bg-[#F8FAFC] text-[#0F172A]';

  const themeCardClass =
    theme === 'sepia'
      ? 'border-[#E8DFC8] bg-[#FFFDF7] text-[#2C2416] shadow-xs'
      : theme === 'slate'
      ? 'border-[#334155] bg-[#1E293B] text-[#F1F5F9] shadow-xs'
      : theme === 'night'
      ? 'border-zinc-800 bg-zinc-950 text-[#F4F4F5] shadow-xs'
      : 'border-slate-200 bg-white text-slate-900 shadow-xs';

  // Scoped CSS Variables overriding Tailwind and shadcn variables locally inside the reader.
  // This guarantees that Day (pure white) and Sepia (warm paper) ALWAYS display dark, readable ink text
  // even when the device or OS is in Dark Mode, and Charcoal/Night ALWAYS display crisp white text
  // even when the device or OS is in Light Mode!
  const themeScopeStyle: React.CSSProperties = isThemeDark
    ? {
        colorScheme: 'dark',
        backgroundColor: theme === 'night' ? '#000000' : '#0F172A',
        color: '#F4F4F5',
        ['--background' as any]: theme === 'night' ? '0 0% 0%' : '222.2 84% 4.9%',
        ['--foreground' as any]: '210 40% 98%',
        ['--card' as any]: theme === 'night' ? '240 10% 3.9%' : '217 33% 17%',
        ['--card-foreground' as any]: '210 40% 98%',
        ['--popover' as any]: theme === 'night' ? '240 10% 3.9%' : '217 33% 17%',
        ['--popover-foreground' as any]: '210 40% 98%',
        ['--muted' as any]: theme === 'night' ? '240 3.7% 15.9%' : '217 33% 20%',
        ['--muted-foreground' as any]: '215 20.2% 65.1%',
        ['--border' as any]: theme === 'night' ? '240 3.7% 15.9%' : '217 33% 25%',
        ['--input' as any]: theme === 'night' ? '240 3.7% 15.9%' : '217 33% 25%',
      }
    : {
        colorScheme: 'light',
        backgroundColor: theme === 'sepia' ? '#FAF6EE' : '#F8FAFC',
        color: theme === 'sepia' ? '#2C2416' : '#0F172A',
        ['--background' as any]: theme === 'sepia' ? '38 43% 95%' : '0 0% 100%',
        ['--foreground' as any]: theme === 'sepia' ? '33 33% 13%' : '222.2 84% 4.9%',
        ['--card' as any]: theme === 'sepia' ? '40 60% 99%' : '0 0% 100%',
        ['--card-foreground' as any]: theme === 'sepia' ? '33 33% 13%' : '222.2 84% 4.9%',
        ['--popover' as any]: theme === 'sepia' ? '40 60% 99%' : '0 0% 100%',
        ['--popover-foreground' as any]: theme === 'sepia' ? '33 33% 13%' : '222.2 84% 4.9%',
        ['--muted' as any]: theme === 'sepia' ? '38 25% 91%' : '210 40% 96.1%',
        ['--muted-foreground' as any]: theme === 'sepia' ? '32 17% 41%' : '215.4 16.3% 46.9%',
        ['--border' as any]: theme === 'sepia' ? '38 35% 85%' : '214.3 31.8% 91.4%',
        ['--input' as any]: theme === 'sepia' ? '38 35% 85%' : '214.3 31.8% 91.4%',
      };

  const scopeClass = isThemeDark ? 'dark reader-scope-dark' : 'reader-scope-light';

  // Handler for taking the specific chapter practice exam
  const handleTakeChapterExam = async () => {
    // 1. If book has a direct examId
    if (book.examId) {
      navigate(`/exam/${book.examId}`);
      return;
    }

    // 2. Query Firebase for an exam associated with this chapter or subject
    try {
      if (book.subjectId) {
        const exams = await getExamsBySubject(book.subjectId);
        // Look for an exam matching this chapter
        const chapterMatch = exams.find((e) => {
          if (book.chapterId && e.chapterId === book.chapterId) return true;
          if (book.chapterNumber && (e as any).chapterNumber === book.chapterNumber) return true;
          if (book.chapterTitle && e.title?.toLowerCase().includes(book.chapterTitle.toLowerCase())) return true;
          return false;
        });

        if (chapterMatch) {
          navigate(`/exam/${chapterMatch.examId}`);
          return;
        }

        // Fallback to any published exam under this subject
        const published = exams.filter((e) => e.status === 'published');
        if (published.length > 0) {
          navigate(`/exam/${published[0].examId}`);
          return;
        }
      }
    } catch (err) {
      console.warn('Error querying chapter exams:', err);
    }

    // 3. Fallback callback if provided by parent
    if (onStartExam) {
      onStartExam(book.examId);
      return;
    }

    // 4. Navigate to student exams filtered by this subject
    if (book.subjectId) {
      navigate(`/dashboard/exams?subject=${book.subjectId}`);
    } else {
      navigate('/dashboard/exams');
    }
  };

  // Width Class: Reaching screen edges vs centered column (Full width on mobile)
  const contentWidthClass = isEdgeToEdge
    ? 'w-full max-w-none px-1 sm:px-2 md:px-4'
    : 'w-full max-w-5xl mx-auto px-1.5 sm:px-3 md:px-5';

  // Mastery percentage
  const masteryPercentage =
    sections.length > 0
      ? Math.round((masteredSectionIds.size / sections.length) * 100)
      : 100;

  // Chapter Name & Visual Identity
  // Clean extraction for exact format: "Chapter 1 : Definition of psychology"
  const chNum =
    book.chapterNumber ||
    book.title?.match(/Chapter\s*(\d+)/i)?.[1] ||
    book.chapterTitle?.match(/Chapter\s*(\d+)/i)?.[1] ||
    '1';

  let rawChapterTopic = book.chapterTitle || book.title || 'Study Notes';
  rawChapterTopic = rawChapterTopic.replace(/^Chapter\s*\d+\s*[:\-–—.]\s*/i, '').trim();
  if (!rawChapterTopic) {
    rawChapterTopic = book.title?.replace(/^Chapter\s*\d+\s*[:\-–—.]\s*/i, '').trim() || 'Study Notes';
  }

  // Exact requested format: e.g. "Chapter 1 : Definition of psychology"
  const formattedChapterHeading = `Chapter ${chNum} : ${rawChapterTopic}`;

  const gradeLabel = book.gradeLevel || 'Standard Curriculum';
  const subjectLabel = book.subjectName || book.title || 'Subject';
  const subjectVisual = getSubjectVisualTheme(book.subjectName || book.title || '', book.subjectCategory || '');

  return (
    <div
      style={themeScopeStyle}
      className={`relative min-h-screen pb-28 transition-colors duration-200 ${scopeClass} ${themeContainerClass} ${fontStyleClass}`}
    >
      {/* Reading Progress Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-amber-500/20 z-50 print:hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-primary to-emerald-500 transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Main Reading Container */}
      <div className={`${contentWidthClass} space-y-5 pt-2 transition-all duration-200`}>
        {/* Top Reading Toolbar */}
        <div className={`sticky top-2 z-40 flex flex-col gap-2 p-3 sm:p-3.5 rounded-2xl backdrop-blur-md border shadow-md print:hidden ${themeCardClass}`}>
          <div className="flex items-center justify-between gap-2">
            {/* Back Button & Breadcrumbs */}
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack ? onBack : () => navigate('/dashboard/books')}
                className="h-8 px-2 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="text-xs font-semibold hidden sm:inline">Back</span>
              </Button>

              {/* Dynamic Colored Chapter Title & Breadcrumbs */}
              <div className="flex items-center gap-2 min-w-0 truncate font-sans">
                <span className="text-base sm:text-lg shrink-0" role="img" aria-label="subject">
                  {subjectVisual.emoji}
                </span>
                <div className="flex items-center gap-1.5 min-w-0 truncate text-xs sm:text-sm font-bold">
                  <span className={`truncate font-extrabold ${subjectVisual.titleColor}`}>
                    {formattedChapterHeading}
                  </span>
                </div>
              </div>
            </div>

            {/* Reading Toolbar Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Quick Font Size Controls: A- and A+ */}
              <div className="flex items-center rounded-xl border border-border/80 bg-muted/30 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => stepFontSize('down')}
                  disabled={fontSize === 'sm'}
                  className="h-7 w-7 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground"
                  title="Decrease font size"
                >
                  A-
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => stepFontSize('up')}
                  disabled={fontSize === '2xl'}
                  className="h-7 w-7 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground"
                  title="Increase font size"
                >
                  A+
                </Button>
              </div>

              {/* Reading Comfort & Appearance Settings (Aa) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAppearanceOpen(true)}
                className="h-8 px-2 rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground font-sans"
                title="Reading comfort: Font size, style, color theme, and width"
              >
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Theme</span>
              </Button>

              {/* Table of Contents Button */}
              {sections.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTocOpen(true)}
                  className="h-8 px-2 rounded-xl text-xs font-bold gap-1 text-muted-foreground hover:text-foreground font-sans"
                  title="Table of contents"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Contents</span>
                </Button>
              )}

              {/* Search Toggle */}
              <Button
                variant={isSearchOpen ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                title="Search notes"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Text to Speech */}
              <Button
                variant={isSpeaking ? 'default' : 'ghost'}
                size="icon"
                onClick={toggleSpeech}
                className={`h-8 w-8 rounded-xl ${
                  isSpeaking ? 'bg-amber-500 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground'
                }`}
                title={isSpeaking ? 'Stop read aloud' : 'Read aloud'}
              >
                {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              {/* Bookmark Toggle */}
              {onToggleBookmark && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleBookmark}
                  className={`h-8 w-8 rounded-xl ${
                    isBookmarked ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground'
                  }`}
                  title="Bookmark note"
                >
                  <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                </Button>
              )}

              {/* Share */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                title="Share notes"
              >
                <Share2 className="h-4 w-4" />
              </Button>

              {/* Print / Save PDF */}
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

          {/* Collapsible Search Input */}
          {isSearchOpen && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50 animate-fade-in font-sans">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search in this note (formulas, topics, terms, solutions)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs rounded-xl"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                {filteredSections.length} match{filteredSections.length === 1 ? '' : 'es'}
              </span>
            </div>
          )}
        </div>

        {/* TOP CHAPTER BANNER (Prominently showing Chapter Name with subject-relevant colors & emojis) */}
        <div className={`rounded-3xl border-2 p-4 sm:p-6 shadow-sm transition-all ${subjectVisual.bannerBg} ${subjectVisual.bannerBorder}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-xs border ${subjectVisual.badgeBorder} ${subjectVisual.iconBg}`}>
                {subjectVisual.emoji}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-sans">
                  <span className={subjectVisual.badgeText}>{subjectLabel}</span>
                  <span className="opacity-40">•</span>
                  <span className="text-muted-foreground">{gradeLabel}</span>
                </div>
                <h1 className={`text-xl sm:text-2xl md:text-3xl font-display font-extrabold tracking-tight truncate ${subjectVisual.titleColor}`}>
                  {formattedChapterHeading}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-sans">
              <span className={`text-xs font-semibold px-3 py-1 rounded-xl border ${subjectVisual.badgeBg} ${subjectVisual.badgeBorder} ${subjectVisual.badgeText}`}>
                {sections.length} Topics
              </span>
              <span className={`text-xs font-mono px-3 py-1 rounded-xl border ${subjectVisual.badgeBg} ${subjectVisual.badgeBorder} ${subjectVisual.badgeText}`}>
                ~{book.readingTimeMinutes || 8} min read
              </span>
            </div>
          </div>
        </div>

        {/* BOOK FRONT MATTER & COVER HEADER */}
        <div className={`relative overflow-hidden rounded-3xl border p-5 sm:p-8 shadow-sm transition-all ${themeCardClass}`}>
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-10 pointer-events-none">
            <BookOpen className="h-28 w-28 text-primary" />
          </div>

          <div className="space-y-4 w-full relative z-10">
            {/* Subject / Course Tags & Estimated Reading Time */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider font-sans">
              <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px]">
                {book.subjectCategory || 'Study Notes'}
              </Badge>
              <span>•</span>
              <div className="flex items-center gap-1 font-mono text-muted-foreground normal-case">
                <Clock className="h-3 w-3" />
                <span>~{book.readingTimeMinutes || 8} min read</span>
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

            {/* Note Title */}
            <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground tracking-tight leading-tight">
              {book.title}
            </h1>

            {/* Note Subtitle / Author Info */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <span>{book.author ? `Author: ${book.author}` : 'Official EthioSmart Curriculum Team'}</span>
              {book.chapterTitle && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground">{book.chapterTitle}</span>
                </>
              )}
            </div>

            {/* Chapter Executive Summary */}
            {book.summary && (
              <p className={`${textSizeClass} text-foreground/90 leading-relaxed pt-1`}>
                {book.summary}
              </p>
            )}
          </div>
        </div>

        {/* SECTIONS LIST HEADER & CONTROLS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                Chapter Topics & Study Notes
              </h2>
              <p className="text-xs text-muted-foreground">
                {isMathOrPhysics
                  ? 'Expand sections to study detailed theories, step-by-step calculations, worked examples, and review problems.'
                  : 'Expand sections to study detailed theories, explanatory concepts, and review questions.'}
              </p>
            </div>

            <div className="flex items-center gap-2 font-sans">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
                className="h-8 text-xs rounded-xl"
              >
                Expand All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCollapseAll}
                className="h-8 text-xs rounded-xl"
              >
                Collapse All
              </Button>
            </div>
          </div>

          {/* MAIN INTERACTIVE SECTIONS */}
          {filteredSections.length > 0 ? (
            <div className="space-y-4">
              {filteredSections.map((section, index) => {
                const secId = section?.id || `sec-${index}`;
                const isExpanded = expandedSectionIds.has(secId);
                const isMastered = masteredSectionIds.has(secId);
                const sectionNumber = section.sectionNumber || `${index + 1}`;
                const palette = SECTION_PALETTES[index % SECTION_PALETTES.length];
                const keyPoints = Array.isArray(section?.keyPoints) ? section.keyPoints : [];
                const contentBlocks: NoteContentBlock[] = Array.isArray(section?.contentBlocks)
                  ? section.contentBlocks
                  : [];
                const exercises: NoteExercise[] = Array.isArray(section?.exercises)
                  ? section.exercises
                  : [];

                return (
                  <div
                    key={secId}
                    id={secId}
                    className={`rounded-3xl border transition-all duration-200 overflow-hidden ${themeCardClass} ${
                      isExpanded ? 'shadow-sm' : palette.headerAccent
                    }`}
                  >
                    {/* Section Header Accordion Trigger with Subject-Aware Colors & Emojis */}
                    <div
                      onClick={() => toggleSection(secId)}
                      className={`p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? 'bg-muted/15' : 'hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Section Number Badge */}
                        <div
                          className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 transition-colors border mt-0.5 ${
                            isMastered
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : palette.badgeBg
                          }`}
                        >
                          § {sectionNumber}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <span className="text-xl sm:text-2xl shrink-0 mt-0.5" role="img" aria-label="topic">
                              {palette.emoji}
                            </span>
                            <h3 className={`text-base sm:text-lg md:text-xl font-extrabold tracking-tight break-words leading-snug ${palette.titleColor}`}>
                              {section?.title || `Section ${index + 1}`}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-sans mt-1">
                            {section?.isImportant && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                High-Yield Exam Topic
                              </span>
                            )}
                            {exercises.length > 0 && (
                              <span>• {exercises.length} review exercise{exercises.length === 1 ? '' : 's'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Student Mastery Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMastery(secId);
                          }}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors font-sans ${
                            isMastered
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                          }`}
                          title={isMastered ? 'Mark as unread' : 'Mark section as mastered'}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 ${isMastered ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">
                            {isMastered ? 'Mastered' : 'Mark Read'}
                          </span>
                        </button>

                        <div className="h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Section Expanded Body */}
                    {isExpanded && (
                      <div className="px-4 sm:px-6 pb-6 pt-2 space-y-5 border-t border-border/50 animate-fade-in">
                        {/* Main Explanatory Classroom Study Notes (rendered when not already decomposed into paragraph blocks) */}
                        {(!contentBlocks.some((b) => b.type === 'paragraph' || b.type === 'heading' || b.type === 'subheading') && section?.content) && (
                          <div className={`${textSizeClass} text-foreground whitespace-pre-wrap leading-relaxed space-y-4 font-sans`}>
                            <FormattedProseWithMath text={section.content} />
                          </div>
                        )}

                        {/* Rich Structured Content Blocks (Worked examples only for Math/Physics, formulas, callout cards, or structured blocks) */}
                        {contentBlocks.length > 0 && (
                          <div className="space-y-4">
                            {contentBlocks
                              .filter((block) => {
                                // Exclude worked example cards for non-math/physics subjects
                                if (block.type === 'example' && !isMathOrPhysics) {
                                  return false;
                                }
                                return true;
                              })
                              .map((block) => (
                                <ContentBlockRenderer key={block.id} block={block} theme={theme} />
                              ))}
                          </div>
                        )}

                        {/* Key Highlights / Main Points (Vibrantly colored with distinct palette & emoji, enlarged text) */}
                        {keyPoints.length > 0 && (
                          <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3.5 shadow-xs w-full font-sans ${palette.kpBox}`}>
                            <div className="flex items-center gap-2 text-sm sm:text-base font-bold uppercase tracking-wider">
                              <span className="text-xl shrink-0">{palette.kpIcon}</span>
                              <span className={palette.kpTitle}>Key Highlights & Main Points (§ {sectionNumber})</span>
                            </div>
                            <ul className="space-y-3 pt-1">
                              {keyPoints.map((pt, pIdx) => (
                                <li
                                  key={pIdx}
                                  className="flex items-start gap-3 text-base sm:text-lg font-normal leading-relaxed"
                                >
                                  <span className={`h-2.5 w-2.5 rounded-full ${palette.kpDot} mt-2.5 shrink-0`} />
                                  <div className="flex-1">
                                    <FormattedProseWithMath text={pt} />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* INTERACTIVE EXERCISES WITH INDEPENDENT SHOW/HIDE SOLUTION */}
                        {exercises.length > 0 && (
                          <div className="pt-4 border-t border-border/70 space-y-4">
                            <div className="flex items-center gap-2">
                              <BookCheck className="h-4 w-4 text-primary" />
                              <h4 className="text-sm sm:text-base font-bold text-foreground">
                                Section Exercises & Review Problems ({exercises.length})
                              </h4>
                            </div>
                            <div className="space-y-4">
                              {exercises.map((ex, exIdx) => (
                                <InteractiveExerciseCard
                                  key={ex.id || `ex-${exIdx}`}
                                  exercise={ex}
                                  index={exIdx}
                                  theme={theme}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section Bottom Navigator (Previous / Next Section Buttons) */}
                        <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2 font-sans">
                          {index > 0 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => navigateToSectionIndex(index - 1)}
                              className="h-8 text-xs rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                                Prev: § {index}
                              </span>
                            </Button>
                          ) : (
                            <div />
                          )}

                          {index < filteredSections.length - 1 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => navigateToSectionIndex(index + 1)}
                              className="h-8 text-xs rounded-xl gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                                Next: § {index + 2}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <div />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-8 text-center rounded-3xl border border-dashed text-foreground space-y-3 ${themeCardClass}`}>
              <Search className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-semibold">
                {searchQuery ? `No topics match "${searchQuery}"` : 'No section content available.'}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="rounded-xl text-xs">
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>

        {/* TOP LEVEL COMPREHENSIVE EXERCISES */}
        {topExercises.length > 0 && (
          <div className={`rounded-3xl border p-5 sm:p-7 space-y-4 shadow-sm ${themeCardClass}`}>
            <div className="flex items-center gap-2">
              <BookCheck className="h-5 w-5 text-primary" />
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Comprehensive Review Exercises ({topExercises.length})
              </h3>
            </div>
            <div className="space-y-4">
              {topExercises.map((ex, exIdx) => (
                <InteractiveExerciseCard
                  key={ex.id || `top-ex-${exIdx}`}
                  exercise={ex}
                  index={exIdx}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        )}

        {/* CHAPTER GLOSSARY & EXPERT FLASHCARDS */}
        {keyTerms.length > 0 && (
          <div className={`rounded-3xl border p-5 sm:p-7 space-y-5 shadow-sm font-sans ${themeCardClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Chapter Glossary & Interactive Flashcards ({keyTerms.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Master essential definitions with 3D flip cards or complete academic dictionary.
                  </p>
                </div>
              </div>

              {/* Mode Switch: Flashcards vs Complete Dictionary */}
              <div className="flex items-center rounded-xl border border-border/80 bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setGlossaryMode('flashcards')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    glossaryMode === 'flashcards'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  3D Flashcards
                </button>
                <button
                  type="button"
                  onClick={() => setGlossaryMode('grid')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    glossaryMode === 'grid'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Academic Dictionary
                </button>
              </div>
            </div>

            {/* RENDER CHOSEN EXPERT COMPONENT */}
            {glossaryMode === 'flashcards' ? (
              <ExpertFlashcards
                terms={keyTerms}
                subjectName={subjectLabel}
                theme={theme}
              />
            ) : (
              <ExpertDictionary
                terms={keyTerms}
                subjectName={subjectLabel}
                theme={theme}
              />
            )}
          </div>
        )}

        {/* CHAPTER COMPLETED TEST YOUR RECALL (Exact match to image media_1792949865916_19ceec0c.png) */}
        <div className="rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 w-full font-sans print:hidden">
          <div className="space-y-2 text-center md:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
                Chapter Completed! Test Your Recall
              </h2>
            </div>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-2xl">
              Solidify what you just read. Practice exam questions for this chapter are waiting with instant explanations.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleTakeChapterExam}
            className="h-12 px-6 rounded-2xl bg-white hover:bg-white/95 text-amber-800 font-bold text-sm sm:text-base shadow-lg shrink-0 flex items-center gap-2 transition-transform hover:scale-105"
          >
            <FileText className="h-4 w-4 text-amber-700" />
            <span>Take Practice Exam</span>
          </Button>
        </div>
      </div>

      {/* FLOATING SMART BOOK NAVIGATION BAR (Hidden on desktop screens to keep reading view clean) */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 max-w-4xl mx-auto print:hidden font-sans">
        <div className={`p-2 sm:p-2.5 rounded-2xl backdrop-blur-md border shadow-lg flex items-center justify-between gap-2 ${themeCardClass}`}>
          {/* TOC Trigger & Active Section Title */}
          <button
            type="button"
            onClick={() => setIsTocOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-muted/40 transition-colors text-left min-w-0"
          >
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                § {activeSectionIndex + 1} of {sections.length || 1}
              </span>
              <span className="text-xs font-semibold text-foreground truncate block max-w-[140px] sm:max-w-[260px]">
                {sections[activeSectionIndex]?.title || 'Chapter Overview'}
              </span>
            </div>
          </button>

          {/* Center Prev/Next Section Stepper */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={activeSectionIndex === 0}
              onClick={() => navigateToSectionIndex(activeSectionIndex - 1)}
              className="h-8 w-8 rounded-xl"
              title="Previous section"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground px-1 hidden sm:inline">
              {readingProgress}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={activeSectionIndex >= sections.length - 1}
              onClick={() => navigateToSectionIndex(activeSectionIndex + 1)}
              className="h-8 w-8 rounded-xl"
              title="Next section"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Reading Comfort Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAppearanceOpen(true)}
            className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-foreground"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Aa</span>
          </Button>
        </div>
      </div>

      {/* TABLE OF CONTENTS MODAL */}
      <Dialog open={isTocOpen} onOpenChange={setIsTocOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 font-sans overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 pb-3 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ListOrdered className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Table of Contents
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {formattedChapterHeading} • {sections.length} topics ({masteryPercentage}% mastered)
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsTocOpen(false)}
              className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          </div>

          {/* Scrollable Section Entries */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 pr-3 max-h-[calc(88vh-140px)]">
            {sections.map((sec, idx) => {
              const secId = sec?.id || `sec-${idx}`;
              const isMastered = masteredSectionIds.has(secId);
              const isActive = activeSectionIndex === idx;
              const palette = SECTION_PALETTES[idx % SECTION_PALETTES.length];

              return (
                <div
                  key={secId}
                  onClick={() => scrollToSection(secId)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="text-base shrink-0 mt-0.5" role="img" aria-label="topic">
                      {palette.emoji}
                    </span>
                    <span className={`h-6 w-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border mt-0.5 ${palette.badgeBg}`}>
                      {idx + 1}
                    </span>
                    <span className={`text-xs sm:text-sm font-bold break-words leading-tight flex-1 ${palette.titleColor}`}>
                      {sec.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMastered && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prominent Bottom "Back to Note" Button */}
          <div className="p-4 sm:p-5 pt-3 border-t bg-muted/20 shrink-0">
            <Button
              type="button"
              onClick={() => setIsTocOpen(false)}
              className="w-full h-11 rounded-2xl font-bold text-sm bg-primary text-primary-foreground shadow-md hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Note</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* READING COMFORT & APPEARANCE MODAL */}
      <Dialog open={isAppearanceOpen} onOpenChange={setIsAppearanceOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-0 font-sans overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 pb-3 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Reading Comfort & Settings
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Customize font size, font style, themes, and width
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAppearanceOpen(false)}
              className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          </div>

          {/* Scrollable Settings Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 pr-3 max-h-[calc(88vh-140px)]">
            {/* 1. Font Size Control */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Font Size
              </span>
              <div className="grid grid-cols-5 gap-1.5 p-1 bg-muted/40 rounded-2xl border">
                {(['sm', 'base', 'lg', 'xl', '2xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateFontSize(sz)}
                    className={`h-9 rounded-xl text-xs font-bold transition-all ${
                      fontSize === sz
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sz === 'sm' ? '14px' : sz === 'base' ? '16px' : sz === 'lg' ? '18px' : sz === 'xl' ? '21px' : '24px'}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Typography Style */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Font Style
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateFontFamily('serif')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    fontFamily === 'serif'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="font-serif text-sm font-bold block">Serif</span>
                  <span className="text-[10px] text-muted-foreground">Classic Book</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateFontFamily('sans')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    fontFamily === 'sans'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="font-sans text-sm font-bold block">Sans</span>
                  <span className="text-[10px] text-muted-foreground">Modern Clean</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateFontFamily('mono')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    fontFamily === 'mono'
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="font-mono text-sm font-bold block">Mono</span>
                  <span className="text-[10px] text-muted-foreground">Focus / Code</span>
                </button>
              </div>
            </div>

            {/* 3. Background Color / Theme (100% immune to device light/dark mode) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Background Color & Theme
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateTheme('day')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all ${
                    theme === 'day'
                      ? 'ring-2 ring-primary border-transparent'
                      : 'border-slate-200 hover:border-primary/40'
                  } bg-white text-zinc-900`}
                >
                  <div className="h-5 w-5 rounded-full border border-zinc-300 bg-white" />
                  <div>
                    <span className="text-xs font-bold block">Day</span>
                    <span className="text-[10px] text-zinc-500">Pure White Paper</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateTheme('sepia')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all ${
                    theme === 'sepia'
                      ? 'ring-2 ring-primary border-transparent'
                      : 'border-[#E8DFC8]'
                  } bg-[#FAF6EE] text-[#2C2416]`}
                >
                  <div className="h-5 w-5 rounded-full border border-[#D9CDB2] bg-[#FAF6EE]" />
                  <div>
                    <span className="text-xs font-bold block">Warm Paper</span>
                    <span className="text-[10px] text-[#7A6952]">Sepia / Relax</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateTheme('slate')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all ${
                    theme === 'slate'
                      ? 'ring-2 ring-primary border-transparent'
                      : 'border-[#334155]'
                  } bg-[#0F172A] text-[#E2E8F0]`}
                >
                  <div className="h-5 w-5 rounded-full border border-[#475569] bg-[#0F172A]" />
                  <div>
                    <span className="text-xs font-bold block">Charcoal</span>
                    <span className="text-[10px] text-slate-400">Deep Graphite</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateTheme('night')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all ${
                    theme === 'night'
                      ? 'ring-2 ring-primary border-transparent'
                      : 'border-zinc-800'
                  } bg-black text-[#F4F4F5]`}
                >
                  <div className="h-5 w-5 rounded-full border border-zinc-700 bg-black" />
                  <div>
                    <span className="text-xs font-bold block">OLED Night</span>
                    <span className="text-[10px] text-zinc-400">Pitch Black</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Page Width (Reach Screen Edges) */}
            <div className="space-y-2 pt-1 border-t">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Screen Margins & Page Width
              </span>
              <div className="flex items-center justify-between p-3 rounded-2xl border bg-muted/30">
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Reach Screen Edges (Fluid Width)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Extends reading canvas to display edges without narrow box constraints.
                  </span>
                </div>
                <Button
                  type="button"
                  variant={isEdgeToEdge ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleEdgeToEdge}
                  className="h-8 text-xs rounded-xl font-bold shrink-0 ml-3"
                >
                  {isEdgeToEdge ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5 mr-1" />
                      Full Bleed
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5 mr-1" />
                      Centered
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Prominent Bottom "Back to Note" Button */}
          <div className="p-4 sm:p-5 pt-3 border-t bg-muted/20 shrink-0">
            <Button
              type="button"
              onClick={() => setIsAppearanceOpen(false)}
              className="w-full h-11 rounded-2xl font-bold text-sm bg-primary text-primary-foreground shadow-md hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Note</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

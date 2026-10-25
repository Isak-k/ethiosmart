import React, { useState, useEffect, useCallback } from 'react';
import { KeyTerm } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RotateCw,
  Volume2,
  VolumeX,
  Shuffle,
  CheckCircle2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ExpertFlashcardsProps {
  terms: KeyTerm[];
  subjectName?: string;
  theme?: 'day' | 'sepia' | 'slate' | 'night';
}

export function ExpertFlashcards({
  terms,
  subjectName = 'Study Notes',
  theme = 'day',
}: ExpertFlashcardsProps) {
  const { toast } = useToast();
  const [deck, setDeck] = useState<KeyTerm[]>(terms);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredTerms, setMasteredTerms] = useState<Set<string>>(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unmastered'>('all');

  // Sync when terms prop updates
  useEffect(() => {
    setDeck(terms);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [terms]);

  // Filtered deck according to mastery filter
  const activeDeck = React.useMemo(() => {
    if (filterMode === 'unmastered') {
      const filtered = deck.filter((t) => !masteredTerms.has(t.term));
      return filtered.length > 0 ? filtered : deck;
    }
    return deck;
  }, [deck, filterMode, masteredTerms]);

  const currentTerm: KeyTerm | undefined = activeDeck[currentIndex] || activeDeck[0];
  const isCurrentMastered = currentTerm ? masteredTerms.has(currentTerm.term) : false;

  // Next card handler
  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % activeDeck.length);
  }, [activeDeck.length]);

  // Prev card handler
  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + activeDeck.length) % activeDeck.length);
  }, [activeDeck.length]);

  // Toggle flip handler
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Keyboard navigation: Space/Enter = flip, ArrowLeft = prev, ArrowRight = next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev]);

  // Mark as Mastered
  const handleMarkMastered = () => {
    if (!currentTerm) return;
    setMasteredTerms((prev) => {
      const next = new Set(prev);
      next.add(currentTerm.term);
      return next;
    });
    toast({
      title: 'Term Mastered! 🎯',
      description: `"${currentTerm.term}" marked as mastered.`,
    });
    // Move to next card smoothly
    setTimeout(() => {
      handleNext();
    }, 250);
  };

  // Mark as Still Practicing
  const handleMarkUnmastered = () => {
    if (!currentTerm) return;
    setMasteredTerms((prev) => {
      const next = new Set(prev);
      next.delete(currentTerm.term);
      return next;
    });
    handleNext();
  };

  // Shuffle Deck
  const handleShuffle = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    toast({
      title: 'Deck Shuffled 🔀',
      description: 'Cards randomized for effective active recall.',
    });
  };

  // Reset Deck Progress
  const handleReset = () => {
    setMasteredTerms(new Set());
    setCurrentIndex(0);
    setIsFlipped(false);
    toast({
      title: 'Deck Reset',
      description: 'All cards marked as unmastered for fresh review.',
    });
  };

  // Audio Pronunciation via Web Speech API
  const handleSpeak = (textToSpeak: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'Speech not supported',
        description: 'Audio speech synthesis is not supported on this device.',
        variant: 'destructive',
      });
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  if (!currentTerm || activeDeck.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed text-muted-foreground">
        <p className="text-sm font-semibold">No flashcards available for this chapter.</p>
      </div>
    );
  }

  const masteryPercent = Math.round((masteredTerms.size / deck.length) * 100);

  // Theme-aware styles for the card (immune to device dark/light mode)
  const cardBorderClass =
    theme === 'sepia'
      ? 'border-[#D9CDB2] bg-[#FFFDF8] text-[#2C2416]'
      : theme === 'slate'
      ? 'border-[#334155] bg-[#1E293B] text-[#F1F5F9]'
      : theme === 'night'
      ? 'border-zinc-800 bg-zinc-950 text-zinc-100'
      : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className="space-y-4 max-w-xl mx-auto font-sans">
      {/* Deck Header & Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-lg border-primary/30 text-primary">
            {subjectName}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            Card {currentIndex + 1} of {activeDeck.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShuffle}
            className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
            title="Shuffle deck"
          >
            <Shuffle className="h-3.5 w-3.5 mr-1" />
            Shuffle
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
            title="Reset mastery"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
          <span>Mastery Progress</span>
          <span>
            {masteredTerms.size} of {deck.length} terms ({masteryPercent}%)
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${masteryPercent}%` }}
          />
        </div>
      </div>

      {/* 3D Interactive Flip Card */}
      <div
        className="relative w-full min-h-[260px] sm:min-h-[290px] cursor-pointer select-none group"
        style={{ perspective: '1200px' }}
        onClick={handleFlip}
      >
        <div
          className="relative w-full h-full min-h-[260px] sm:min-h-[290px] transition-transform duration-500 rounded-3xl"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT OF CARD (ONE TERM ONLY) */}
          <div
            className={`absolute inset-0 w-full h-full rounded-3xl border-2 p-6 sm:p-8 flex flex-col justify-between shadow-md transition-shadow group-hover:shadow-lg ${cardBorderClass}`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                Term
              </span>
              <div className="flex items-center gap-1.5">
                {isCurrentMastered && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mastered
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleSpeak(currentTerm.term, e)}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  title="Pronounce term"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Central Term Display */}
            <div className="my-auto text-center py-4 space-y-2">
              <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight leading-tight">
                {currentTerm.term}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Tap card or press Space to reveal expert definition
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
              <span className="flex items-center gap-1">
                <RotateCw className="h-3 w-3 animate-spin text-primary" />
                Click to flip
              </span>
              <span className="text-[10px] font-mono">
                ← / → arrow keys to navigate
              </span>
            </div>
          </div>

          {/* BACK OF CARD (EXPERT DEFINITION) */}
          <div
            className={`absolute inset-0 w-full h-full rounded-3xl border-2 p-6 sm:p-8 flex flex-col justify-between shadow-md transition-shadow group-hover:shadow-lg ${cardBorderClass}`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Expert Academic Definition
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => handleSpeak(`${currentTerm.term}. ${currentTerm.definition}`, e)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Read definition aloud"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Definition Text */}
            <div className="my-auto py-3 space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide block">
                {currentTerm.term}
              </span>
              <p className="text-base sm:text-lg text-foreground leading-relaxed font-medium">
                {currentTerm.definition}
              </p>
            </div>

            {/* Mastery Action Buttons on Back */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkUnmastered}
                className="h-8 text-xs rounded-xl flex-1 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Still Practicing
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleMarkMastered}
                className="h-8 text-xs rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Mastered
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrev}
          className="rounded-xl text-xs h-9 px-4 font-semibold"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <span className="text-xs font-mono text-muted-foreground">
          {currentIndex + 1} / {activeDeck.length}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNext}
          className="rounded-xl text-xs h-9 px-4 font-semibold"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

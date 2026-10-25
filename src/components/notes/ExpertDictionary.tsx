import React, { useState, useMemo } from 'react';
import { KeyTerm } from '@/types/book';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Volume2,
  Copy,
  Check,
  Bookmark,
  X,
  BookOpen,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ExpertDictionaryProps {
  terms: KeyTerm[];
  subjectName?: string;
  theme?: 'day' | 'sepia' | 'slate' | 'night';
}

export function ExpertDictionary({
  terms,
  subjectName = 'Subject',
  theme = 'day',
}: ExpertDictionaryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);
  const [bookmarkedTerms, setBookmarkedTerms] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('exampro_dictionary_bookmarks');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  // Toggle bookmark for term
  const toggleBookmark = (termName: string) => {
    setBookmarkedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(termName)) next.delete(termName);
      else next.add(termName);
      try {
        localStorage.setItem('exampro_dictionary_bookmarks', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Copy definition to clipboard
  const handleCopy = (term: KeyTerm) => {
    navigator.clipboard.writeText(`${term.term}: ${term.definition}`);
    setCopiedTerm(term.term);
    toast({
      title: 'Definition Copied',
      description: `"${term.term}" copied to clipboard.`,
    });
    setTimeout(() => {
      setCopiedTerm(null);
    }, 2000);
  };

  // Audio pronunciation via SpeechSynthesis
  const handleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'Speech not supported',
        description: 'Text-to-speech is not supported on this device.',
        variant: 'destructive',
      });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Clean, deduplicated, sorted A-Z terms
  const sortedTerms = useMemo(() => {
    return [...terms].sort((a, b) => a.term.localeCompare(b.term));
  }, [terms]);

  // Compute available letters for ribbon
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    sortedTerms.forEach((t) => {
      const first = (t.term[0] || '').toUpperCase();
      if (/^[A-Z]$/.test(first)) letters.add(first);
    });
    return Array.from(letters).sort();
  }, [sortedTerms]);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedTerms.filter((item) => {
      // 1. Bookmark filter
      if (showBookmarkedOnly && !bookmarkedTerms.has(item.term)) return false;

      // 2. Letter filter
      if (selectedLetter !== 'ALL') {
        const first = (item.term[0] || '').toUpperCase();
        if (first !== selectedLetter) return false;
      }

      // 3. Search query filter
      if (q) {
        const matchesTerm = item.term.toLowerCase().includes(q);
        const matchesDef = (item.definition || '').toLowerCase().includes(q);
        return matchesTerm || matchesDef;
      }

      return true;
    });
  }, [sortedTerms, searchQuery, selectedLetter, showBookmarkedOnly, bookmarkedTerms]);

  // Theme card styles (immune to device dark/light mode)
  const cardBorderClass =
    theme === 'sepia'
      ? 'border-[#D9CDB2] bg-[#FFFDF8] text-[#2C2416]'
      : theme === 'slate'
      ? 'border-[#334155] bg-[#1E293B] text-[#F1F5F9]'
      : theme === 'night'
      ? 'border-zinc-800 bg-zinc-950 text-zinc-100'
      : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className="space-y-4 font-sans">
      {/* Search & Bookmark Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${sortedTerms.length} academic terms or definitions...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-8 text-xs rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showBookmarkedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowBookmarkedOnly((prev) => !prev)}
            className="h-9 text-xs rounded-xl gap-1.5 font-semibold shrink-0"
          >
            <Bookmark className={`h-3.5 w-3.5 ${showBookmarkedOnly ? 'fill-current' : ''}`} />
            <span>Bookmarked ({bookmarkedTerms.size})</span>
          </Button>

          <Badge variant="outline" className="text-xs font-mono h-9 px-3 rounded-xl border-border flex items-center">
            {filteredTerms.length} of {sortedTerms.length}
          </Badge>
        </div>
      </div>

      {/* A-Z Alphabetical Quick Jump Ribbon */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => setSelectedLetter('ALL')}
          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            selectedLetter === 'ALL'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>

        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
          const hasTerms = availableLetters.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={!hasTerms}
              onClick={() => setSelectedLetter(letter)}
              className={`h-7 w-7 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
                selectedLetter === letter
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : hasTerms
                  ? 'bg-muted/50 hover:bg-muted text-foreground'
                  : 'text-muted-foreground/35 cursor-not-allowed'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Dictionary Entries List (Single column, full width, enlarged readable text) */}
      {filteredTerms.length > 0 ? (
        <div className="flex flex-col gap-4 pt-1 w-full">
          {filteredTerms.map((item, idx) => {
            const isBookmarked = bookmarkedTerms.has(item.term);
            const isCopied = copiedTerm === item.term;

            return (
              <div
                key={idx}
                className={`rounded-2xl sm:rounded-3xl border-2 border-sky-500/30 dark:border-sky-500/40 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-card p-5 sm:p-6 flex flex-col justify-between space-y-3.5 shadow-xs hover:border-sky-500/60 transition-all w-full ${cardBorderClass}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                        {item.term}
                      </span>
                      <Badge variant="outline" className="text-xs py-0.5 px-2.5 rounded-lg border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold">
                        {subjectName}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSpeak(`${item.term}. ${item.definition}`)}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                        title="Pronounce term"
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(item)}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                        title="Copy definition"
                      >
                        {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleBookmark(item.term)}
                        className={`h-8 w-8 rounded-xl ${
                          isBookmarked ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark term'}
                      >
                        <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* Enlarged, full-size readable definition */}
                  <p className="text-base sm:text-lg text-foreground/95 leading-relaxed font-normal pt-1">
                    {item.definition}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-xs font-semibold">Index: #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleSpeak(item.term)}
                    className="hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Audio Read
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl border border-dashed text-muted-foreground space-y-3">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-semibold">
            {searchQuery || selectedLetter !== 'ALL' || showBookmarkedOnly
              ? 'No dictionary terms match the active filters.'
              : 'No dictionary terms available.'}
          </p>
          {(searchQuery || selectedLetter !== 'ALL' || showBookmarkedOnly) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedLetter('ALL');
                setShowBookmarkedOnly(false);
              }}
              className="rounded-xl text-xs"
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

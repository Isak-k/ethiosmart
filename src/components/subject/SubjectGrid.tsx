import React, { useState, useMemo } from 'react';
import { Subject, StudentSubjectProgress } from '@/types/subject';
import { SubjectCard } from './SubjectCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Sparkles, Filter, X } from 'lucide-react';

export interface SubjectGridProps {
  subjects: Subject[];
  progressMap?: Record<string, StudentSubjectProgress>;
  loading?: boolean;
  isAdmin?: boolean;
  onEditSubject?: (subject: Subject) => void;
  onDeleteSubject?: (subject: Subject) => void;
  onManageChapters?: (subject: Subject) => void;
  onSelectSubject?: (subject: Subject) => void;
  emptyAction?: React.ReactNode;
  showSearch?: boolean;
}

export function SubjectGrid({
  subjects,
  progressMap = {},
  loading = false,
  isAdmin = false,
  onEditSubject,
  onDeleteSubject,
  onManageChapters,
  onSelectSubject,
  emptyAction,
  showSearch = true,
}: SubjectGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'in-progress' | 'completed'>('all');

  // Filter subjects based on query and progress
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      // 1. Search text match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = subject.name.toLowerCase().includes(query);
        const matchesDesc = subject.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      // 2. Filter tabs match
      if (filterState === 'all') return true;
      const progress = progressMap[subject.id];
      const isComplete = progress && progress.totalUnits > 0 && progress.completedUnits >= progress.totalUnits;
      const isInProgress = progress && progress.completedUnits > 0 && !isComplete;

      if (filterState === 'completed') return isComplete;
      if (filterState === 'in-progress') return isInProgress;

      return true;
    });
  }, [subjects, searchQuery, filterState, progressMap]);

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      {showSearch && subjects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search subjects by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 rounded-xl bg-card border-border/70 focus-visible:ring-primary shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={filterState === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterState('all')}
              className="rounded-full text-xs font-medium h-8"
            >
              All ({subjects.length})
            </Button>
            <Button
              variant={filterState === 'in-progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterState('in-progress')}
              className="rounded-full text-xs font-medium h-8"
            >
              In Progress
            </Button>
            <Button
              variant={filterState === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterState('completed')}
              className="rounded-full text-xs font-medium h-8"
            >
              Completed
            </Button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-3xl border border-border/50 bg-card overflow-hidden shadow-sm animate-pulse"
            >
              <div className="w-full aspect-[4/3] bg-muted/80" />
              <div className="p-5 space-y-4">
                <div className="h-6 w-3/4 rounded-md bg-muted" />
                <div className="h-4 w-full rounded-md bg-muted/60" />
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-muted/60" />
                    <div className="h-4 w-10 rounded bg-muted/60" />
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredSubjects.length > 0 ? (
        /* Responsive Grid: 3 columns desktop, 2 tablets, 1 mobile */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              progress={progressMap[subject.id]}
              isAdmin={isAdmin}
              onEdit={onEditSubject}
              onDelete={onDeleteSubject}
              onManageChapters={onManageChapters}
              onClick={onSelectSubject}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-card/60 backdrop-blur-sm rounded-3xl border border-dashed border-border/70 flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-lg font-bold text-foreground">
              {searchQuery ? 'No matching subjects found' : 'No subjects available'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? `No subjects match "${searchQuery}". Try a different keyword or reset filters.`
                : 'Get started by creating your curriculum subjects and uploading illustrated cover images.'}
            </p>
          </div>
          {searchQuery ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterState('all');
              }}
              className="rounded-xl mt-2"
            >
              Clear Search & Filters
            </Button>
          ) : (
            emptyAction && <div className="mt-2">{emptyAction}</div>
          )}
        </div>
      )}
    </div>
  );
}

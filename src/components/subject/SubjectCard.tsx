import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Subject, StudentSubjectProgress } from '@/types/subject';
import { getSubjectCover } from '@/lib/subject-covers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  CheckCircle2, 
  ArrowRight, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SubjectCardProps {
  subject: Subject;
  progress?: StudentSubjectProgress;
  isAdmin?: boolean;
  onEdit?: (subject: Subject) => void;
  onDelete?: (subject: Subject) => void;
  onManageChapters?: (subject: Subject) => void;
  onClick?: (subject: Subject) => void;
  href?: string;
}

export function SubjectCard({
  subject,
  progress,
  isAdmin = false,
  onEdit,
  onDelete,
  onManageChapters,
  onClick,
  href,
}: SubjectCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Compute cover information and reliable fallback
  const coverInfo = getSubjectCover(subject.name, subject.coverImageUrl);
  const displayImageSrc = imageError ? coverInfo.preset.svgDataUri : coverInfo.url;

  // Immediate loaded state for data URIs (preset SVGs or local optimized covers)
  React.useEffect(() => {
    if (displayImageSrc.startsWith('data:')) {
      setImageLoaded(true);
    }
  }, [displayImageSrc]);

  // Compute unit and assessment coverage information
  const totalUnits = progress?.totalUnits ?? subject.totalUnits ?? 0;
  const unitsWithExams = progress?.unitsWithExams ?? (progress?.totalExams ? Math.min(progress.totalExams, totalUnits || progress.totalExams) : 0);
  const totalExams = progress?.totalExams ?? 0;
  const completedUnits = progress?.completedUnits ?? 0;
  const hasStudentAttempts = progress?.hasStudentAttempts ?? (completedUnits > 0 || (progress?.completedExamIds?.length ?? 0) > 0);

  // Student completion progress (for learners who submitted exams)
  const studentPercentage = progress?.percentage ?? (totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0);
  // Curriculum coverage progress (how many units have exams ready)
  const coveragePercentage = totalUnits > 0 ? Math.round((unitsWithExams / totalUnits) * 100) : (totalExams > 0 ? 100 : 0);

  const isStudentComplete = hasStudentAttempts && totalUnits > 0 && completedUnits >= totalUnits;
  const isCurriculumComplete = unitsWithExams > 0 && totalUnits > 0 && unitsWithExams >= totalUnits;
  const isComplete = hasStudentAttempts ? isStudentComplete : isCurriculumComplete;

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on an admin action button or dropdown, don't trigger card navigation
    if ((e.target as HTMLElement).closest('.stop-propagation')) {
      return;
    }

    if (onClick) {
      onClick(subject);
    } else if (isAdmin && onEdit) {
      onEdit(subject);
    } else if (href) {
      navigate(href);
    } else {
      // Default: navigate to student exams filtered by this subject
      navigate(`/dashboard/exams?subjectId=${subject.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(e as any);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/60 bg-card shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer select-none"
    >
      {/* Upper portion: Large, Colorful Cover Image */}
      <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
        {/* Placeholder skeleton while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted/70 animate-pulse flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 animate-bounce" />
          </div>
        )}

        <img
          src={displayImageSrc}
          alt={`${subject.name} cover`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Admin quick actions dropdown (top-right icon only, zero text overlay on cover) */}
        {isAdmin && (
          <div className="absolute top-3 right-3 stop-propagation pointer-events-auto z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white/90 dark:bg-gray-900/90 text-foreground shadow-md backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800"
                  aria-label={`Options for ${subject.name}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(subject)}>
                    <Edit2 className="h-4 w-4 mr-2 text-primary" />
                    Edit Subject
                  </DropdownMenuItem>
                )}
                {onManageChapters && (
                  <DropdownMenuItem onClick={() => onManageChapters(subject)}>
                    <BookOpen className="h-4 w-4 mr-2 text-primary" />
                    Manage Chapters
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(subject)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Subject
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Lower portion: Subject information and progress filled cleanly under the cover */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-5 bg-card justify-between gap-3 sm:gap-4">
        {/* Track category tag & Completion status */}
        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider truncate">
                {coverInfo.preset.name}
              </span>
              {isAdmin && subject.displayOrder !== undefined && (
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 border-primary/30 text-primary bg-primary/5 shrink-0">
                  #{subject.displayOrder}
                </Badge>
              )}
            </div>
            {isComplete && (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] px-2 py-0.5 border border-emerald-500/20 shadow-none flex items-center gap-1 shrink-0">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Completed
              </Badge>
            )}
          </div>

          {/* Title and arrow */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-xl font-display font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {subject.name}
            </h3>
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          </div>

          {subject.description ? (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2">
              {subject.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              Interactive coursework & examination modules
            </p>
          )}
        </div>

        {/* Unit information & Progress Indicator */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Layers className="h-4 w-4 text-primary shrink-0" />
              <span>
                {hasStudentAttempts ? (
                  `${completedUnits} of ${totalUnits} units completed`
                ) : unitsWithExams > 0 ? (
                  totalUnits > 0
                    ? `${unitsWithExams} of ${totalUnits} units`
                    : `${unitsWithExams} ${unitsWithExams === 1 ? 'unit' : 'units'}`
                ) : totalUnits > 0 ? (
                  `${totalUnits} units`
                ) : (
                  '0 units'
                )}
              </span>
            </div>

            <span className="font-semibold text-xs text-muted-foreground">
              {hasStudentAttempts ? (
                `${studentPercentage}%`
              ) : totalExams > 0 ? (
                `${totalExams} ${totalExams === 1 ? 'assessment' : 'assessments'}`
              ) : totalUnits > 0 ? (
                'Ready'
              ) : (
                'No units'
              )}
            </span>
          </div>

          {/* Small rounded progress bar beneath unit information */}
          <div className="relative h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                hasStudentAttempts
                  ? isStudentComplete
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-500'
                  : isCurriculumComplete
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : unitsWithExams > 0
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500'
                  : 'bg-muted-foreground/20'
              }`}
              style={{
                width: hasStudentAttempts
                  ? `${Math.max(studentPercentage, 3)}%`
                  : unitsWithExams > 0
                  ? `${Math.max(coveragePercentage, 4)}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        {/* Admin Quick Action Bar */}
        {isAdmin && (
          <div className="stop-propagation flex items-center justify-between gap-1.5 pt-3 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit && onEdit(subject)}
              className="flex-1 h-8 rounded-xl text-xs font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/40"
            >
              <Edit2 className="h-3.5 w-3.5 mr-1 text-primary" />
              Edit
            </Button>
            {onManageChapters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageChapters(subject)}
                className="flex-1 h-8 rounded-xl text-xs font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              >
                <BookOpen className="h-3.5 w-3.5 mr-1 text-primary" />
                Chapters
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete && onDelete(subject)}
              className="h-8 px-2.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10"
              title="Delete Subject"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book } from '@/types/book';
import { getSubjectCover } from '@/lib/subject-covers';
import { buildDriveDownloadUrl } from '@/lib/google-drive';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen,
  FileText,
  Bookmark,
  BookmarkCheck,
  Download,
  Eye,
  Sparkles,
  ExternalLink,
  Edit,
  Trash2,
  Lock,
  HardDrive,
  CheckCircle2,
  Loader2,
  Info,
  Calendar,
  User,
  Globe,
  Tag,
  ArrowRight,
} from 'lucide-react';

interface BookCardProps {
  book: Book;
  isBookmarked?: boolean;
  onToggleBookmark?: (bookId: string) => void;
  isAdmin?: boolean;
  onEdit?: (book: Book) => void;
  onDelete?: (book: Book) => void;
  onToggleStatus?: (book: Book) => void;
  onGenerateAI?: (book: Book) => void;
  isSavedOffline?: boolean;
  onSaveOffline?: (book: Book) => void;
  isDownloadingOffline?: boolean;
}

export function BookCard({
  book,
  isBookmarked = false,
  onToggleBookmark,
  isAdmin = false,
  onEdit,
  onDelete,
  onToggleStatus,
  onGenerateAI,
  isSavedOffline = false,
  onSaveOffline,
  isDownloadingOffline = false,
}: BookCardProps) {
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isShortNote = book.resourceType === 'short_note';
  const effectiveCover = getSubjectCover(book.subjectName || book.title, book.coverImageUrl);

  // Directly open reader on click
  const handleRead = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/dashboard/books/${book.id}/read`);
  };

  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailsOpen(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (book.allowDownload) {
      window.open(buildDriveDownloadUrl(book.driveFileId), '_blank');
    }
  };

  return (
    <>
      <Card
        onClick={() => handleRead()}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg cursor-pointer select-none"
      >
        {/* Upper portion: Book Cover Image (Taller 4:3, clean art, zero text overlay) */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={effectiveCover.url}
            alt={book.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Top-Right: Admin Actions OR Student Bookmark (compact icon buttons, zero text overlay) */}
          {isAdmin ? (
            <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex items-center gap-1 z-20">
              {onGenerateAI && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateAI(book);
                  }}
                  title="Generate Exam Questions with AI"
                  className="h-7 w-7 rounded-full bg-black/60 hover:bg-amber-500 text-amber-300 hover:text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md border border-white/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(book);
                  }}
                  title="Edit Resource"
                  className="h-7 w-7 rounded-full bg-black/60 hover:bg-primary text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md border border-white/10"
                >
                  <Edit className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(book);
                  }}
                  title="Delete Resource"
                  className="h-7 w-7 rounded-full bg-black/60 hover:bg-destructive text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md border border-white/10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : onToggleBookmark ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(book.id);
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this resource'}
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/80 flex items-center justify-center backdrop-blur-md transition-transform hover:scale-110 active:scale-95 z-10 border border-white/10"
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-amber-400 fill-amber-400" />
              ) : (
                <Bookmark className="h-4 w-4 text-white" />
              )}
            </button>
          ) : null}
        </div>

        {/* Lower portion: Book information filled cleanly UNDER the cover */}
        <CardContent className="flex flex-1 flex-col justify-between p-3.5 sm:p-4 bg-card gap-2.5">
          {/* Subject category line & Type/Offline badges */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider truncate">
                {book.subjectName || 'Curriculum Subject'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Badge
                  variant={isShortNote ? 'secondary' : 'default'}
                  className={`text-[10px] font-semibold px-2 py-0 border-0 shadow-xs ${
                    isShortNote
                      ? 'bg-amber-500 text-white dark:bg-amber-600'
                      : 'bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {isShortNote ? (
                    <FileText className="w-2.5 h-2.5 mr-1 inline" />
                  ) : (
                    <BookOpen className="w-2.5 h-2.5 mr-1 inline" />
                  )}
                  {isShortNote ? 'Note' : 'Book'}
                </Badge>

                {isSavedOffline && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" />
                    Offline
                  </Badge>
                )}

                {isAdmin && (
                  <Badge
                    variant="outline"
                    onClick={(e) => {
                      if (onToggleStatus) {
                        e.stopPropagation();
                        onToggleStatus(book);
                      }
                    }}
                    title={onToggleStatus ? 'Click to toggle status (Published / Draft)' : undefined}
                    className={`text-[9px] font-semibold px-2 py-0.5 transition-all ${
                      onToggleStatus ? 'cursor-pointer hover:scale-105 shadow-xs' : ''
                    } ${
                      book.status === 'published'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                        : book.status === 'archived'
                        ? 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {book.status === 'published' ? '✓ PUBLISHED' : book.status === 'draft' ? '⏱ DRAFT' : book.status.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>

            {/* Book Title */}
            <h3 className="text-sm sm:text-base font-display font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {book.title}
            </h3>

            {/* Description / Summary snippet */}
            {book.description ? (
              <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                {book.description}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-muted-foreground/75 line-clamp-1">
                {book.author ? `By ${book.author}` : 'Official Ethiopian Curriculum'}
              </p>
            )}
          </div>

          {/* Metadata Row: Author & Units / Edition */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/40">
            <span className="truncate max-w-[65%] font-medium text-foreground/80 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{book.author ? `By ${book.author}` : 'Official Curriculum'}</span>
            </span>
            <span className="text-[11px] font-medium shrink-0 text-muted-foreground">
              {Array.isArray(book.chapterLabels) && book.chapterLabels.length > 0
                ? `${book.chapterLabels.length} units`
                : [book.edition, book.publicationYear, book.language].filter(Boolean)[0] || 'Ready'}
            </span>
          </div>

          {/* Actions Footer */}
          <div className="pt-2 border-t flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Primary Direct Read Button */}
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleRead}
                className="h-8 rounded-xl text-xs font-semibold px-2.5 sm:px-3 shadow-xs bg-primary hover:bg-primary/90 flex-1 min-w-0 justify-center"
              >
                <Eye className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">Read {isShortNote ? 'Note' : 'Book'}</span>
              </Button>

              {/* Admin Direct Edit Action */}
              {isAdmin && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) {
                      onEdit(book);
                    } else if (isShortNote) {
                      navigate(`/dashboard/admin/shortnotes/edit/${book.id}`);
                    }
                  }}
                  title={isShortNote ? 'Edit study note content & exercises' : 'Edit book metadata & cover'}
                  className={`h-8 px-2 sm:px-2.5 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                    isShortNote
                      ? 'border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/15'
                      : 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/15'
                  }`}
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  <span>{isShortNote ? 'Edit Note' : 'Edit'}</span>
                </Button>
              )}

              {/* Detail Button (Hides and opens the detailed info) */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleOpenDetail}
                title="View full description, topics and details"
                className="h-8 px-2 sm:px-2.5 text-xs font-medium rounded-xl border-border/80 hover:bg-accent hover:text-foreground shrink-0"
              >
                <Info className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
                <span>Detail</span>
              </Button>
            </div>

            {/* Right Action: Download or Saved Offline */}
            <div className="flex items-center shrink-0">
              {isSavedOffline ? (
                <span
                  title="Available offline inside EthioSmart"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
              ) : book.allowDownload ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSaveOffline) {
                      onSaveOffline(book);
                    } else {
                      handleDownload(e);
                    }
                  }}
                  disabled={isDownloadingOffline}
                  title="Save for offline reading"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg shrink-0"
                >
                  {isDownloadingOffline ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Info Revealed in Detail Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="max-w-lg rounded-3xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={isShortNote ? 'secondary' : 'default'}
                className={`text-xs font-semibold ${
                  isShortNote
                    ? 'bg-amber-500 text-white dark:bg-amber-600'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {isShortNote ? (
                  <FileText className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                )}
                {isShortNote ? 'Note (Short Note)' : 'Book (Textbook)'}
              </Badge>

              {book.subjectName && (
                <Badge variant="outline" className="text-xs">
                  {book.subjectName}
                </Badge>
              )}

              {book.departmentName && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {book.departmentName}
                </Badge>
              )}
            </div>

            <DialogTitle className="text-xl font-display font-bold text-foreground leading-snug">
              {book.title}
            </DialogTitle>
          </DialogHeader>

          {/* Cover & Metadata */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-muted/40 border border-border/60">
            <div className="h-20 w-28 shrink-0 rounded-xl overflow-hidden bg-muted border shadow-xs">
              <img
                src={effectiveCover.url}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
              {book.author && (
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">By {book.author}</span>
                </div>
              )}
              {(book.edition || book.publicationYear) && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{[book.edition, book.publicationYear].filter(Boolean).join(' • ')}</span>
                </div>
              )}
              {book.language && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{book.language}</span>
                </div>
              )}
              {book.pageCount ? (
                <div className="text-[11px] text-muted-foreground">
                  {book.pageCount} pages
                </div>
              ) : null}
            </div>
          </div>

          {/* Full Description / Summary */}
          {book.description ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Summary & Overview
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-3.5 rounded-xl border border-border/40 max-h-48 overflow-y-auto">
                {book.description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No additional description provided for this resource.
            </p>
          )}

          {/* Chapter / Topic Labels */}
          {Array.isArray(book.chapterLabels) && book.chapterLabels.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Curriculum Topics & Chapters ({book.chapterLabels.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border/40">
                {book.chapterLabels.map((c, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-card border border-border/60 text-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="pt-3 border-t border-border/60 flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsOpen(false);
                  handleRead(e);
                }}
                className="w-full sm:flex-1 rounded-xl bg-primary font-semibold text-xs h-10 shadow-xs"
              >
                <Eye className="w-4 h-4 mr-2" />
                Open & Read {isShortNote ? 'Note' : 'Book'} Directly
              </Button>

              {book.allowDownload && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSaveOffline) {
                      onSaveOffline(book);
                    } else {
                      handleDownload(e);
                    }
                  }}
                  disabled={isDownloadingOffline}
                  className="w-full sm:w-auto rounded-xl text-xs h-10 px-3.5"
                >
                  {isDownloadingOffline ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : isSavedOffline ? (
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-500" />
                  ) : (
                    <Download className="w-4 h-4 mr-1.5" />
                  )}
                  {isSavedOffline ? 'Saved Offline' : 'Save Offline'}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDetailsOpen(false);
                  navigate(`/dashboard/books/${book.id}`);
                }}
                className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground h-10 px-2"
              >
                Full Details <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {/* Admin Management Actions in Detail Dialog */}
            {isAdmin && (
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-dashed">
                {onGenerateAI && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsOpen(false);
                      onGenerateAI(book);
                    }}
                    className="rounded-xl text-xs h-8 text-amber-600 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Generate AI Questions
                  </Button>
                )}
                {isAdmin && onToggleStatus && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStatus(book);
                    }}
                    className={`rounded-xl text-xs h-8 ${
                      book.status === 'published'
                        ? 'border-amber-500/30 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        : 'border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30'
                    }`}
                  >
                    {book.status === 'published' ? 'Unpublish to Draft' : 'Publish Live'}
                  </Button>
                )}
                {onEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsOpen(false);
                      onEdit(book);
                    }}
                    className="rounded-xl text-xs h-8"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsOpen(false);
                      onDelete(book);
                    }}
                    className="rounded-xl text-xs h-8 px-2.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

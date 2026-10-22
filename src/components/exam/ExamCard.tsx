import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamCountdown } from "./ExamCountdown";
import { OfflineDownloadButton } from "./OfflineDownloadButton";
import { Clock, Calendar, FileQuestion, Users, Play, Edit2, BarChart3, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/lib/utils";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { useToast } from "@/hooks/use-toast";
import { useOfflineDownload } from "@/hooks/useOfflineDownload";

interface ExamCardProps {
  exam: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    start_time: string | null;
    end_time: string | null;
    is_published: boolean;
    question_count?: number;
    attempt_count?: number;
    max_attempts?: number;
    subjectId?: string;
    chapterTitle?: string;
  };
  isAdmin?: boolean;
  hasAttempted?: boolean;
  onDelete?: (examId: string) => void;
  hideActions?: boolean;
  showOfflineDownload?: boolean;
  departmentId?: string;
}

export function ExamCard({ exam, isAdmin = false, hasAttempted = false, onDelete, hideActions = false, showOfflineDownload = false, departmentId }: ExamCardProps) {
  const { t, i18n } = useTranslation();
  const { canEdit, canDelete, canView } = useSectionPermissions();
  const { toast } = useToast();
  const { checkDownloadStatus } = useOfflineDownload();
  const [isDownloaded, setIsDownloaded] = useState(false);
  
  useEffect(() => {
    if (showOfflineDownload) {
      checkDownloadStatus(exam.id).then(setIsDownloaded);
    }
  }, [exam.id, showOfflineDownload, checkDownloadStatus]);
  
  const isActive =
    exam.is_published &&
    (!exam.start_time || new Date(exam.start_time) <= new Date()) &&
    (!exam.end_time || new Date(exam.end_time) >= new Date());

  const isPast = exam.end_time && new Date(exam.end_time) < new Date();
  const isUpcoming = exam.start_time && new Date(exam.start_time) > new Date();

  const handleDelete = () => {
    if (!canDelete('manageExams')) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to delete exams",
        variant: 'destructive',
      });
      return;
    }
    if (onDelete) {
      onDelete(exam.id);
    }
  };

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-cyan-500 to-teal-500 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-lg font-display font-bold text-white line-clamp-1 mb-0.5 sm:mb-1">
              {exam.title}
            </h3>
            {exam.description && (
              <p className="text-xs sm:text-sm text-cyan-50 line-clamp-1 sm:line-clamp-2 opacity-90">
                {exam.description}
              </p>
            )}
            {exam.chapterTitle && (
              <p className="text-[11px] sm:text-xs text-white/90 font-medium flex items-center gap-1 mt-0.5 sm:mt-1 truncate">
                <span className="opacity-75">📖</span>
                <span className="truncate">{exam.chapterTitle}</span>
              </p>
            )}
          </div>
          {isAdmin ? (
            <Badge
              className={`text-[10px] sm:text-xs shrink-0 ${exam.is_published 
                ? "bg-green-100 text-green-700 border-0" 
                : "bg-yellow-100 text-yellow-700 border-0"
              }`}
            >
              {exam.is_published ? t("exam.status.published") : t("exam.status.draft")}
            </Badge>
          ) : (
            <Badge
              className={`text-[10px] sm:text-xs shrink-0 ${
                isPast
                  ? "bg-red-100 text-red-700 border-0"
                  : isUpcoming
                  ? "bg-yellow-100 text-yellow-700 border-0"
                  : "bg-green-100 text-green-700 border-0"
              }`}
            >
              {isPast ? t("exam.status.ended") : isUpcoming ? t("exam.status.upcoming") : t("exam.status.active")}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-3 sm:p-6 space-y-2.5 sm:space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-cyan-50 dark:bg-cyan-950/20 p-2 sm:p-3 rounded-lg sm:rounded-xl">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-600 shrink-0" />
            <span className="font-medium truncate">{exam.duration_minutes} {t("exam.info.min")}</span>
          </div>
          {exam.question_count !== undefined && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <FileQuestion className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 shrink-0" />
              <span className="font-medium truncate">{exam.question_count} {t("exam.info.questions")}</span>
            </div>
          )}
          {!isAdmin && exam.max_attempts !== undefined && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-orange-50 dark:bg-orange-950/20 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 shrink-0" />
              <span className="font-medium truncate">
                {exam.attempt_count || 0}/{exam.max_attempts} {t("exam.info.attempts")}
              </span>
            </div>
          )}
          {exam.start_time && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-purple-50 dark:bg-purple-950/20 p-2 sm:p-3 rounded-lg sm:rounded-xl sm:col-span-2">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 shrink-0" />
              <span className="font-medium truncate">
                {format(new Date(exam.start_time), "MMM d, yyyy h:mm a", { locale: getDateLocale(i18n.language) })}
              </span>
            </div>
          )}
          {isAdmin && exam.attempt_count !== undefined && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 sm:p-3 rounded-lg sm:rounded-xl sm:col-span-2">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 shrink-0" />
              <span className="font-medium truncate">{exam.attempt_count} {t("exam.info.attempts")}</span>
            </div>
          )}
        </div>

        {!isAdmin && (exam.start_time || exam.end_time) && (
          <ExamCountdown startTime={exam.start_time} endTime={exam.end_time} />
        )}

        {/* Actions */}
        {!hideActions && isAdmin ? (
          <div className="flex gap-2 flex-wrap">
            {canEdit('manageExams') && (
              <Button asChild variant="outline" className="flex-1 min-w-fit rounded-xl border-cyan-300 hover:bg-cyan-50 dark:border-cyan-700 dark:hover:bg-cyan-950/30">
                <Link to={`/dashboard/exams/${exam.id}/edit`}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {t("exam.action.edit")}
                </Link>
              </Button>
            )}
            {canView('allResults') && (
              <Button asChild className="flex-1 min-w-fit rounded-xl bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700">
                <Link to={`/dashboard/exams/${exam.id}/results`}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t("exam.action.results")}
                </Link>
              </Button>
            )}
            {onDelete && canDelete('manageExams') && (
              <Button 
                variant="outline" 
                size="icon"
                className="rounded-xl border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : !hideActions && !isAdmin ? (
          <div className="space-y-3">
            {showOfflineDownload && (exam as any).allow_offline_download && (
              <OfflineDownloadButton
                exam={{
                  examId: exam.id,
                  title: exam.title,
                  description: exam.description,
                  durationMinutes: exam.duration_minutes,
                  questionCount: exam.question_count || 0,
                  isPublished: exam.is_published,
                  maxAttempts: 0,
                  resultsPublished: false,
                  shuffleQuestions: false,
                  shuffleOptions: false,
                  startTime: exam.start_time ? new Date(exam.start_time) as any : null,
                  endTime: exam.end_time ? new Date(exam.end_time) as any : null,
                  totalMarks: 0,
                  createdBy: '',
                  createdAt: new Date() as any,
                  updatedAt: new Date() as any,
                }}
                isDownloaded={isDownloaded}
                departmentId={departmentId}
                onDownloadComplete={() => setIsDownloaded(true)}
              />
            )}
            {isActive && !hasAttempted ? (
              <Button asChild className="w-full text-xs sm:text-sm h-9 sm:h-10 px-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 group">
                <Link to={`/exam/${exam.id}`} className="flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 mr-1.5 group-hover:translate-x-1 transition-transform duration-300 shrink-0" />
                  <span className="font-semibold truncate">Start Exam</span>
                </Link>
              </Button>
            ) : isActive && exam.max_attempts && exam.attempt_count && exam.attempt_count < exam.max_attempts ? (
              <Button asChild className="w-full text-xs sm:text-sm h-9 sm:h-10 px-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 group">
                <Link to={`/exam/${exam.id}`} className="flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 mr-1.5 group-hover:translate-x-1 transition-transform duration-300 shrink-0" />
                  <span className="font-semibold truncate">Start Exam</span>
                  <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full shrink-0">
                    {exam.max_attempts - exam.attempt_count} left
                  </span>
                </Link>
              </Button>
            ) : (
              <Button disabled className="w-full text-xs sm:text-sm h-9 sm:h-10 px-2 rounded-xl truncate" variant="outline">
                {exam.max_attempts && exam.attempt_count && exam.attempt_count >= exam.max_attempts ? (
                  `${t("exam.status.maxAttemptsReached")} (${exam.attempt_count}/${exam.max_attempts})`
                ) : hasAttempted ? (
                  t("exam.status.alreadyAttempted")
                ) : isUpcoming ? (
                  t("exam.status.notAvailable")
                ) : isPast ? (
                  t("exam.status.ended")
                ) : (
                  t("exam.action.start")
                )}
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Department Downloads Section
 * Allows students to download exams and resources for offline use
 */

import { useEffect, useState } from 'react';
import { Exam } from '@/integrations/firebase/types';
import { useOfflineDownloadManager } from '@/hooks/useOfflineDownloadManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Trash2,
  RefreshCw,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DepartmentDownloadsProps {
  departmentId: string;
  exams: Exam[];
}

export function DepartmentDownloads({ departmentId, exams }: DepartmentDownloadsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    downloadProgress,
    storageUsage,
    formatStorageSize,
    downloadExam,
    getStatus,
    deleteDownload,
    getDownloadedExams,
    clearAllDownloadsForDepartment,
    updateStorageUsage,
  } = useOfflineDownloadManager();

  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, any>>(new Map());
  const [downloadedExams, setDownloadedExams] = useState<any[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  // Load download statuses and storage usage on mount
  useEffect(() => {
    const loadDownloadInfo = async () => {
      try {
        // Get all downloaded exams
        const downloaded = await getDownloadedExams(departmentId);
        setDownloadedExams(downloaded);

        // Get status for each exam
        const statuses = new Map();
        for (const exam of exams) {
          const status = await getStatus(exam);
          statuses.set(exam.examId, status);
        }
        setDownloadStatuses(statuses);

        // Update storage usage
        await updateStorageUsage();
      } catch (error) {
        console.error('Error loading download info:', error);
      }
    };

    loadDownloadInfo();
  }, [departmentId, exams, getDownloadedExams, getStatus, updateStorageUsage]);

  const handleDownload = async (exam: Exam) => {
    // Only allow downloading practice exams or exams with offline download enabled
    if (exam.examType !== 'practice' && !exam.allowOfflineDownload) {
      toast({
        title: 'Download Not Available',
        description: 'This exam cannot be downloaded for offline use',
        variant: 'destructive',
      });
      return;
    }

    await downloadExam(exam, departmentId);

    // Refresh statuses
    const status = await getStatus(exam);
    setDownloadStatuses((prev) => new Map(prev).set(exam.examId, status));
  };

  const handleDelete = async (examId: string) => {
    await deleteDownload(examId);
    setShowDeleteDialog(null);

    // Refresh statuses
    const exam = exams.find((e) => e.examId === examId);
    if (exam) {
      const status = await getStatus(exam);
      setDownloadStatuses((prev) => new Map(prev).set(examId, status));
    }
  };

  const handleClearAll = async () => {
    await clearAllDownloadsForDepartment();
    setShowClearDialog(false);

    // Refresh all statuses
    const statuses = new Map();
    for (const exam of exams) {
      const status = await getStatus(exam);
      statuses.set(exam.examId, status);
    }
    setDownloadStatuses(statuses);
  };

  // Filter exams that can be downloaded
  const downloadableExams = exams.filter(
    (exam) => exam.examType === 'practice' || exam.allowOfflineDownload
  );

  if (downloadableExams.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Storage Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Offline Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Storage Used</span>
              <span className="text-sm text-muted-foreground">{formatStorageSize(storageUsage)}</span>
            </div>
            <Progress value={Math.min((storageUsage / (100 * 1024 * 1024)) * 100, 100)} />
            <p className="text-xs text-muted-foreground mt-2">
              Maximum recommended: 100 MB
            </p>
          </div>

          {downloadedExams.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Downloads
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Downloads Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Available Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {downloadableExams.map((exam) => {
              const status = downloadStatuses.get(exam.examId);
              const progress = downloadProgress.get(exam.examId);
              const isDownloading = progress?.status === 'downloading';

              return (
                <div
                  key={exam.examId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{exam.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {exam.questionCount || 0} questions • {exam.durationMinutes} min
                    </p>

                    {/* Download Progress */}
                    {isDownloading && (
                      <div className="mt-2 space-y-1">
                        <Progress value={progress?.progress || 0} />
                        <p className="text-xs text-muted-foreground">
                          {progress?.progress || 0}% downloaded
                        </p>
                      </div>
                    )}

                    {/* Status Indicator */}
                    {status && !isDownloading && (
                      <div className="flex items-center gap-1 mt-2">
                        {status.status === 'downloaded' && (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-600">
                              Downloaded • {formatStorageSize(status.size || 0)}
                            </span>
                          </>
                        )}
                        {status.status === 'update-available' && (
                          <>
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-xs text-amber-600">Update available</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Error Message */}
                    {progress?.status === 'failed' && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs text-red-600">{progress.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    {status?.status === 'not-downloaded' && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(exam)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Downloading
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    )}

                    {status?.status === 'downloaded' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(exam)}
                          disabled={isDownloading}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDeleteDialog(exam.examId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}

                    {status?.status === 'update-available' && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(exam)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Updating
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Update
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog !== null} onOpenChange={(open) => {
        if (!open) setShowDeleteDialog(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Download</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this exam from offline storage? You can download it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Downloads</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all offline exams from your device. You can download them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

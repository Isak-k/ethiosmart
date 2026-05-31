import { useState } from 'react';
import { Exam } from '@/integrations/firebase/types';
import { Button } from '@/components/ui/button';
import { Download, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
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

interface OfflineDownloadButtonProps {
  exam: Exam;
  isDownloaded?: boolean;
  departmentId?: string;
  onDownloadComplete?: () => void;
}

export function OfflineDownloadButton({
  exam,
  isDownloaded = false,
  departmentId,
  onDownloadComplete,
}: OfflineDownloadButtonProps) {
  const { downloadExam, deleteDownloadedExam, downloadProgress } = useOfflineDownload();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const progress = downloadProgress.get(exam.examId);
  const isDownloading = progress?.status === 'downloading';
  const isFailed = progress?.status === 'failed';

  const handleDownload = async () => {
    await downloadExam(exam, departmentId);
    onDownloadComplete?.();
  };

  const handleDelete = async () => {
    await deleteDownloadedExam(exam.examId, departmentId);
    setShowDeleteDialog(false);
    onDownloadComplete?.();
  };

  if (isDownloaded) {
    return (
      <>
        <div className="flex gap-2 items-center w-full">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg flex-1 font-medium">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Downloaded</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30 flex-shrink-0"
            onClick={() => setShowDeleteDialog(true)}
            title="Delete offline data"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Offline Data</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the offline data for "{exam.title}"? You can download it again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (isDownloading) {
    return (
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Downloading...</span>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{progress?.progress || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full transition-all duration-300"
              style={{ width: `${progress?.progress || 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex gap-2 items-center w-full">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg flex-1 font-medium">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Download Failed</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          className="whitespace-nowrap flex-shrink-0"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleDownload}
      className="w-full gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white shadow-md"
    >
      <Download className="h-4 w-4" />
      Download for Offline
    </Button>
  );
}

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
    <div>
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

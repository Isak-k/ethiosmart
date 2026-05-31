import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface OfflineExamsSectionProps {
  departmentId?: string;
  isOnline: boolean;
}

export function OfflineExamsSection({ departmentId, isOnline }: OfflineExamsSectionProps) {
  const { t } = useTranslation();
  const { downloadedExams, loadDownloadedExams, getStorageInfo } = useOfflineDownload();
  const [storageInfo, setStorageInfo] = useState<{ mb: number; formatted: string }>({
    mb: 0,
    formatted: '0 MB',
  });

  useEffect(() => {
    loadDownloadedExams(departmentId);
    updateStorageInfo();
  }, [departmentId, loadDownloadedExams]);

  const updateStorageInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  if (downloadedExams.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5" />
            <CardTitle>{t('student.offline.title') || 'Offline Exams'}</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-1 rounded-full">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Storage Info */}
        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{storageInfo.formatted}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Downloaded Exams</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{downloadedExams.length}</p>
            </div>
          </div>
        </div>

        {/* Downloaded Exams List */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Available Offline</p>
          {downloadedExams.map((exam) => {
            const downloadedAt = (exam as any).downloadedAt;
            return (
              <div
                key={exam.examId}
                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-sm line-clamp-1">{exam.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {exam.questionCount} questions • {exam.durationMinutes} min
                  </p>
                  {downloadedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Downloaded {format(new Date(downloadedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                    <Download className="h-3 w-3" />
                    <span>Ready</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Message */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <span className="font-medium">💡 Tip:</span> Downloaded exams are stored on your device and can be accessed
            offline. Your answers will sync automatically when you're back online.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

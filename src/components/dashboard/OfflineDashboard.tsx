/**
 * Offline Dashboard
 * Shows downloaded exams and offline capabilities when user is offline
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Trash2, Play, Wifi, WifiOff } from 'lucide-react';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert';
import { getAllDownloadedExams, getDownloadStats } from '@/lib/offline-download-manager-v2';
import { Exam } from '@/integrations/firebase/types';

export interface OfflineDashboardProps {
  onStartExam?: (examId: string, examTitle: string) => void;
  onDeleteExam?: (examId: string) => void;
  compact?: boolean; // Show compact version for inline display
}

export function OfflineDashboard({ 
  onStartExam, 
  onDeleteExam,
  compact = false 
}: OfflineDashboardProps) {
  const { isOfflineMode, offlineModeInfo } = useAuth();
  const [downloadedExams, setDownloadedExams] = useState<Array<{
    exam: Exam;
    status: 'valid' | 'invalid';
    issues: string[];
    estimatedSize: string;
  }>>([]);
  const [stats, setStats] = useState<{
    totalSize: number;
    totalExams: number;
    estimatedStorageUsage: string;
    storagePercentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [exams, downloadStats] = await Promise.all([
          getAllDownloadedExams(),
          getDownloadStats(),
        ]);

        setDownloadedExams(exams);
        setStats(downloadStats);
      } catch (error) {
        console.error('Failed to load offline data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDeleteExam = async (examId: string) => {
    try {
      setDeleting(examId);
      onDeleteExam?.(examId);
      // Reload data
      const exams = await getAllDownloadedExams();
      setDownloadedExams(exams);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading offline exams...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (compact && downloadedExams.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Offline Status Banner */}
      {isOfflineMode && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <AlertTitle>You're Offline</AlertTitle>
          <AlertDescription>
            Only downloaded exams are available. Downloaded: {offlineModeInfo.downloadedCount} exam{offlineModeInfo.downloadedCount !== 1 ? 's' : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Storage Stats */}
      {stats && !compact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Used Storage</span>
              <span className="font-semibold">{stats.estimatedStorageUsage}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${stats.storagePercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {Math.round(stats.storagePercentage)}% of available storage
            </p>
          </CardContent>
        </Card>
      )}

      {/* Downloaded Exams */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Downloaded Exams ({downloadedExams.length})
          </h3>
        </div>

        {downloadedExams.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Download className="h-12 w-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No exams downloaded yet</p>
              <p className="text-sm text-gray-400">
                Download exams when online to access them offline
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {downloadedExams.map((item) => (
              <Card
                key={item.exam.examId}
                className={item.status === 'invalid' ? 'border-red-200 bg-red-50' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {item.exam.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {item.exam.questionCount} questions • {item.estimatedSize}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {item.exam.examType === 'practice' && (
                        <Badge variant="outline" className="text-xs">
                          Practice
                        </Badge>
                      )}
                      {item.status === 'invalid' && (
                        <Badge variant="destructive" className="text-xs">
                          Invalid
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {item.exam.description && (
                  <CardContent className="pb-3">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.exam.description}
                    </p>
                  </CardContent>
                )}

                {/* Issues Alert */}
                {item.issues.length > 0 && (
                  <CardContent className="pb-3">
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-700">
                        {item.issues.map((issue, idx) => (
                          <div key={idx}>{issue}</div>
                        ))}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                )}

                {/* Actions */}
                <CardContent className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteExam(item.exam.examId)}
                    disabled={deleting === item.exam.examId}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    disabled={item.status === 'invalid' || deleting === item.exam.examId}
                    onClick={() =>
                      onStartExam?.(item.exam.examId, item.exam.title)
                    }
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline version - shows downloaded exams count
 */
export function OfflineDashboardCompact() {
  const { isOfflineMode, offlineModeInfo } = useAuth();

  if (!isOfflineMode) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
      <WifiOff className="h-3.5 w-3.5 text-amber-600" />
      <span className="text-xs font-medium text-amber-700">
        Offline • {offlineModeInfo.downloadedCount} exam{offlineModeInfo.downloadedCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/**
 * Status indicator for dashboard header
 */
export function OfflineStatusIndicator() {
  const { isOfflineMode, offlineModeInfo } = useAuth();

  return (
    <div className="flex items-center gap-1.5">
      {isOfflineMode ? (
        <>
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-amber-600 font-medium">Offline</span>
        </>
      ) : offlineModeInfo.isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-600" />
          <span className="text-xs text-green-600 font-medium">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400 font-medium">Connecting...</span>
        </>
      )}
    </div>
  );
}

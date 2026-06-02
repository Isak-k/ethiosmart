/**
 * Practice Exam Analytics Component
 * Displays analytics and statistics for practice exams
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getAllPracticeExamAnalytics, getModeDistribution, getOfflineUsageStats } from '@/lib/admin-practice-analytics';
import { PracticeAnalytics } from '@/lib/admin-practice-analytics';

export function PracticeExamAnalytics() {
  const [analytics, setAnalytics] = useState<PracticeAnalytics[]>([]);
  const [modeDistribution, setModeDistribution] = useState<any>(null);
  const [offlineStats, setOfflineStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const [analyticsData, modeData, offlineData] = await Promise.all([
          getAllPracticeExamAnalytics(),
          getModeDistribution(),
          getOfflineUsageStats(),
        ]);

        setAnalytics(analyticsData);
        setModeDistribution(modeData);
        setOfflineStats(offlineData);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalAttempts = analytics.reduce((sum, a) => sum + a.totalAttempts, 0);
  const avgScoreOverall =
    analytics.length > 0
      ? (analytics.reduce((sum, a) => sum + a.averageScore, 0) / analytics.length).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAttempts}</div>
            <p className="text-xs text-gray-500 mt-1">Across all practice exams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgScoreOverall}%</div>
            <p className="text-xs text-gray-500 mt-1">Overall average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Practice Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.length}</div>
            <p className="text-xs text-gray-500 mt-1">With data</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode Distribution */}
      {modeDistribution && (
        <Card>
          <CardHeader>
            <CardTitle>Mode Distribution</CardTitle>
            <CardDescription>Practice vs Exam mode usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Learning Mode (Practice)</span>
                <Badge>{modeDistribution.practiceMode} exams</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${modeDistribution.practicePercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{modeDistribution.practicePercent}% of exams</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Assessment Mode (Exam)</span>
                <Badge variant="outline">{modeDistribution.examMode} exams</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full"
                  style={{ width: `${modeDistribution.examPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{modeDistribution.examPercent}% of exams</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offline Usage */}
      {offlineStats && (
        <Card>
          <CardHeader>
            <CardTitle>Offline Usage</CardTitle>
            <CardDescription>Downloadable exams and offline activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Downloadable Exams</p>
                <p className="text-2xl font-bold">{offlineStats.totalDownloadable}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Downloaded by Users</p>
                <p className="text-2xl font-bold">{offlineStats.downloadedByUsers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Offline Sessions</p>
                <p className="text-2xl font-bold">{offlineStats.activeOfflineSessions}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Storage Used</p>
                <p className="text-2xl font-bold">{offlineStats.totalStorageUsed} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performing Exams */}
      {analytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Exams</CardTitle>
            <CardDescription>By average score and attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics
                .sort((a, b) => b.averageScore - a.averageScore)
                .slice(0, 5)
                .map((exam) => (
                  <div key={exam.examId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{exam.examTitle}</p>
                      <p className="text-sm text-gray-600">{exam.totalAttempts} attempts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{exam.averageScore.toFixed(1)}%</p>
                      <Badge className="text-xs">Pass: {exam.passRate.toFixed(0)}%</Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Exams Analytics */}
      {analytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Practice Exams Analytics</CardTitle>
            <CardDescription>Detailed statistics for each exam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left font-medium py-2">Exam</th>
                    <th className="text-center font-medium py-2">Attempts</th>
                    <th className="text-center font-medium py-2">Avg Score</th>
                    <th className="text-center font-medium py-2">Pass Rate</th>
                    <th className="text-center font-medium py-2">Offline</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((exam) => (
                    <tr key={exam.examId} className="border-b hover:bg-gray-50">
                      <td className="py-3">{exam.examTitle}</td>
                      <td className="text-center">{exam.totalAttempts}</td>
                      <td className="text-center font-medium">{exam.averageScore.toFixed(1)}%</td>
                      <td className="text-center">
                        <Badge variant="outline">{exam.passRate.toFixed(0)}%</Badge>
                      </td>
                      <td className="text-center">{exam.offlineAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PracticeExamAnalytics;

/**
 * Offline Usage Monitor Component
 * Tracks and displays offline exam downloads and usage
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, HardDrive, Users, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface OfflineDownloadEntry {
  examId: string;
  examTitle: string;
  downloadedByCount: number;
  totalDownloadSize: number;
  lastDownloadedAt: string;
  totalDownloads: number;
}

export interface OfflineSessionEntry {
  studentId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  lastActiveAt: string;
  sessionDuration: number;
  questionsAnswered: number;
}

interface OfflineUsageMonitorProps {
  onlineOnly?: boolean;
}

export function OfflineUsageMonitor({ onlineOnly = false }: OfflineUsageMonitorProps) {
  const [downloads, setDownloads] = useState<OfflineDownloadEntry[]>([]);
  const [sessions, setSessions] = useState<OfflineSessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        setLoading(true);

        // TODO: Load from Firebase
        // For now, set defaults
        setDownloads([]);
        setSessions([]);
        setStorageUsed(0);
        setActiveUsers(0);
      } catch (error) {
        console.error('Error loading offline usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOfflineData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalDownloads = downloads.reduce((sum, d) => sum + d.totalDownloads, 0);
  const uniqueUsers = new Set(sessions.map((s) => s.studentId)).size;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Downloadable Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{downloads.length}</div>
            <p className="text-xs text-gray-500 mt-1">Available for download</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDownloads}</div>
            <p className="text-xs text-gray-500 mt-1">All exams combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{storageUsed} MB</div>
            <p className="text-xs text-gray-500 mt-1">Across all devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-gray-500 mt-1">Using offline mode</p>
          </CardContent>
        </Card>
      </div>

      {/* Warning for Online-Only */}
      {onlineOnly && (
        <Alert>
          <AlertDescription>
            This system is running in online-only mode. Offline features are disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Downloaded Exams */}
      <Card>
        <CardHeader>
          <CardTitle>Downloaded Exams</CardTitle>
          <CardDescription>Track exam downloads and storage usage</CardDescription>
        </CardHeader>
        <CardContent>
          {downloads.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Download className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No downloads yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {downloads
                .sort((a, b) => b.totalDownloads - a.totalDownloads)
                .map((download) => (
                  <div key={download.examId} className="p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{download.examTitle}</p>
                        <p className="text-sm text-gray-600">
                          Downloaded by {download.downloadedByCount} users
                        </p>
                      </div>
                      <Badge variant="outline">{download.totalDownloads} times</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <p className="font-medium">Size</p>
                        <p>{(download.totalDownloadSize / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="font-medium">Last Downloaded</p>
                        <p>{new Date(download.lastDownloadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{
                          width: `${(download.totalDownloads / (downloads.reduce((sum, d) => sum + d.totalDownloads, 0) || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Offline Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Offline Sessions</CardTitle>
          <CardDescription>Active offline exam sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No active offline sessions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Student</th>
                    <th className="text-left py-2">Exam</th>
                    <th className="text-center py-2">Duration</th>
                    <th className="text-center py-2">Questions</th>
                    <th className="text-left py-2">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, idx) => (
                    <tr key={`${session.studentId}-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="py-3">{session.studentName}</td>
                      <td className="py-3">{session.examTitle}</td>
                      <td className="py-3 text-center">
                        {Math.floor(session.sessionDuration / 60)} min
                      </td>
                      <td className="py-3 text-center">{session.questionsAnswered}</td>
                      <td className="py-3">
                        {new Date(session.lastActiveAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Usage Info */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Storage Used</span>
              <span className="text-lg font-bold">{storageUsed} MB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${Math.min((storageUsed / 500) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-600">Out of 500 MB default quota</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Unique Users</p>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
            </div>
            <div>
              <p className="text-gray-600">Avg Download Size</p>
              <p className="text-2xl font-bold">
                {downloads.length > 0
                  ? (
                      downloads.reduce((sum, d) => sum + d.totalDownloadSize, 0) /
                      downloads.length /
                      1024 /
                      1024
                    ).toFixed(1)
                  : 0}{' '}
                MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OfflineUsageMonitor;

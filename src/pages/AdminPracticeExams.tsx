/**
 * Admin Practice Exams Page
 * Dashboard for managing practice exams and viewing analytics
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, Download, Users, TrendingUp, Loader2, AlertCircle, Check } from 'lucide-react';
import { Exam, PracticeExamConfig as PracticeExamConfigType } from '@/integrations/firebase/types';
import { getAllExams } from '@/lib/firebase-exams';
import { PracticeExamConfig } from '@/components/admin/PracticeExamConfig';
import { savePracticeExamConfig } from '@/lib/practice-exam-config';
import { getModeDistribution } from '@/lib/admin-practice-analytics';

export function AdminPracticeExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [practiceExams, setPracticeExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [modeDistribution, setModeDistribution] = useState<any>(null);

  useEffect(() => {
    const loadExams = async () => {
      try {
        setLoading(true);
        setError(null);
        const allExams = await getAllExams();
        setExams(allExams);
        const practice = allExams.filter((e) => e.examType === 'practice');
        setPracticeExams(practice);

        // Load mode distribution
        const distribution = await getModeDistribution();
        setModeDistribution(distribution);
      } catch (err) {
        console.error('Error loading exams:', err);
        setError('Failed to load exams');
      } finally {
        setLoading(false);
      }
    };

    loadExams();
  }, []);

  const handleSaveConfig = async (config: PracticeExamConfigType) => {
    if (!selectedExam) return;

    try {
      setIsSaving(true);
      setError(null);

      await savePracticeExamConfig(selectedExam.examId, {
        examType: 'practice',
        practiceMode: config.mode,
        practiceConfig: config,
        allowOfflineDownload: true, // For practice exams, always allow offline
      });

      setSuccess(`Successfully updated practice settings for "${selectedExam.title}"`);
      setShowConfig(false);
      setSelectedExam(null);

      // Reload exams
      const allExams = await getAllExams();
      setExams(allExams);
      const practice = allExams.filter((e) => e.examType === 'practice');
      setPracticeExams(practice);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save practice settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Practice Exams</h1>
        <p className="text-gray-600">Manage and monitor practice exams</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Practice Exams */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Practice Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{practiceExams.length}</div>
            <p className="text-xs text-gray-500 mt-1">Configured for offline</p>
          </CardContent>
        </Card>

        {/* Learning Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Learning Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{practiceExams.filter((e) => e.practiceMode === 'practice').length}</div>
            <p className="text-xs text-gray-500 mt-1">Instant feedback exams</p>
          </CardContent>
        </Card>

        {/* Assessment Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Assessment Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{practiceExams.filter((e) => e.practiceMode === 'exam').length}</div>
            <p className="text-xs text-gray-500 mt-1">Timed exams</p>
          </CardContent>
        </Card>

        {/* Downloadable */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Downloadable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{practiceExams.filter((e) => e.allowOfflineDownload).length}</div>
            <p className="text-xs text-gray-500 mt-1">Available for offline</p>
          </CardContent>
        </Card>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">All Exams</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Practice Exam Configuration</CardTitle>
              <CardDescription>Overview of all practice exams by mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {practiceExams.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No practice exams configured yet</p>
                  <p className="text-sm text-gray-500">Create an exam and enable practice mode</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {practiceExams.map((exam) => (
                    <div
                      key={exam.examId}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{exam.title}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {exam.practiceMode === 'practice' ? '📚 Learning' : '⏱ Assessment'}
                          </Badge>
                          {exam.allowOfflineDownload && (
                            <Badge variant="outline" className="text-xs">
                              <Download className="h-3 w-3 mr-1" />
                              Downloadable
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedExam(exam);
                          setShowConfig(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams">
          <Card>
            <CardHeader>
              <CardTitle>All Exams</CardTitle>
              <CardDescription>Filter exams by practice mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">Exams list coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Practice exam usage and performance statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">Analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      {showConfig && selectedExam && (
        <PracticeExamConfig
          exam={selectedExam}
          onSave={handleSaveConfig}
          onCancel={() => {
            setShowConfig(false);
            setSelectedExam(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminPracticeExams;

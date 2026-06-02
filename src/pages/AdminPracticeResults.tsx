/**
 * Admin Practice Results Page
 * View and manage practice exam results
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Filter, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PracticeResult {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examTitle: string;
  mode: 'practice' | 'exam';
  score: number;
  maxScore: number;
  timeSpentSeconds: number;
  isOffline: boolean;
  submittedAt: string;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
}

export function AdminPracticeResults() {
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<PracticeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Filter states
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedMode, setSelectedMode] = useState<'all' | 'practice' | 'exam'>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        // TODO: Fetch from Firebase
        // For now, show empty state
        setResults([]);
        setFilteredResults([]);
      } catch (error) {
        console.error('Error loading results:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = results;

    if (searchStudent) {
      filtered = filtered.filter(
        (r) =>
          r.studentName.toLowerCase().includes(searchStudent.toLowerCase()) ||
          r.studentEmail.toLowerCase().includes(searchStudent.toLowerCase())
      );
    }

    if (selectedMode !== 'all') {
      filtered = filtered.filter((r) => r.mode === selectedMode);
    }

    if (selectedExam !== 'all') {
      filtered = filtered.filter((r) => r.examId === selectedExam);
    }

    if (onlineFilter !== 'all') {
      const isOffline = onlineFilter === 'offline';
      filtered = filtered.filter((r) => r.isOffline === isOffline);
    }

    setFilteredResults(filtered);
  }, [results, searchStudent, selectedMode, selectedExam, onlineFilter]);

  const exams = Array.from(new Set(results.map((r) => r.examTitle))).sort();

  const practiceResults = filteredResults.filter((r) => r.mode === 'practice');
  const examResults = filteredResults.filter((r) => r.mode === 'exam');

  const stats = {
    total: filteredResults.length,
    practice: practiceResults.length,
    exam: examResults.length,
    avgScore:
      filteredResults.length > 0
        ? (
            (filteredResults.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) /
              filteredResults.length) as any
          ).toFixed(1)
        : 0,
    avgTimeMinutes:
      filteredResults.length > 0
        ? (filteredResults.reduce((sum, r) => sum + r.timeSpentSeconds, 0) / filteredResults.length / 60).toFixed(1)
        : 0,
  };

  const handleExport = () => {
    const csv = [
      ['Student', 'Email', 'Exam', 'Mode', 'Score', 'Correct', 'Wrong', 'Skipped', 'Time (min)', 'Online/Offline', 'Date'],
      ...filteredResults.map((r) => [
        r.studentName,
        r.studentEmail,
        r.examTitle,
        r.mode,
        `${((r.score / r.maxScore) * 100).toFixed(1)}%`,
        r.correctAnswers,
        r.wrongAnswers,
        r.skippedAnswers,
        (r.timeSpentSeconds / 60).toFixed(1),
        r.isOffline ? 'Offline' : 'Online',
        new Date(r.submittedAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `practice-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Practice Exam Results</h1>
          <p className="text-gray-600">View and manage student practice exam results</p>
        </div>
        <Button onClick={handleExport} disabled={filteredResults.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Practice Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.practice}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Exam Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.exam}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgTimeMinutes} min</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="Search student name or email..."
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
            />

            <Select value={selectedMode} onValueChange={(v) => setSelectedMode(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="practice">Learning Mode</SelectItem>
                <SelectItem value="exam">Assessment Mode</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedExam} onValueChange={setSelectedExam}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam} value={exam}>
                    {exam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={onlineFilter} onValueChange={(v) => setOnlineFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Online & Offline</SelectItem>
                <SelectItem value="online">Online Only</SelectItem>
                <SelectItem value="offline">Offline Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(searchStudent || selectedMode !== 'all' || selectedExam !== 'all' || onlineFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchStudent('');
                setSelectedMode('all');
                setSelectedExam('all');
                setOnlineFilter('all');
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results Tabs */}
      {filteredResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-600">
            <p>No results found</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({filteredResults.length})</TabsTrigger>
            <TabsTrigger value="practice">Learning ({practiceResults.length})</TabsTrigger>
            <TabsTrigger value="exam">Assessment ({examResults.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2">Student</th>
                        <th className="text-left py-2">Exam</th>
                        <th className="text-center py-2">Mode</th>
                        <th className="text-center py-2">Score</th>
                        <th className="text-center py-2">Results</th>
                        <th className="text-center py-2">Time</th>
                        <th className="text-center py-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result) => (
                        <tr key={result.id} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{result.studentName}</p>
                              <p className="text-xs text-gray-500">{result.studentEmail}</p>
                            </div>
                          </td>
                          <td className="py-3">{result.examTitle}</td>
                          <td className="py-3 text-center">
                            <Badge variant={result.mode === 'practice' ? 'default' : 'secondary'}>
                              {result.mode === 'practice' ? '📚 Learning' : '⏱ Assessment'}
                            </Badge>
                          </td>
                          <td className="py-3 text-center font-medium">
                            {((result.score / result.maxScore) * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 text-center text-xs">
                            <div className="space-y-1">
                              <p className="text-green-600">✓ {result.correctAnswers}</p>
                              <p className="text-red-600">✗ {result.wrongAnswers}</p>
                              <p className="text-gray-600">- {result.skippedAnswers}</p>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            {(result.timeSpentSeconds / 60).toFixed(1)} min
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant="outline">
                              {result.isOffline ? '📱 Offline' : '🌐 Online'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="practice">
            <Card>
              <CardContent className="pt-6">
                {practiceResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">
                    <p>No learning mode results</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2">Student</th>
                          <th className="text-left py-2">Exam</th>
                          <th className="text-center py-2">Score</th>
                          <th className="text-center py-2">Results</th>
                          <th className="text-center py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practiceResults.map((result) => (
                          <tr key={result.id} className="border-b hover:bg-gray-50">
                            <td className="py-3">
                              <p className="font-medium">{result.studentName}</p>
                            </td>
                            <td className="py-3">{result.examTitle}</td>
                            <td className="py-3 text-center font-medium">
                              {((result.score / result.maxScore) * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 text-center text-xs">
                              <span className="text-green-600 mr-2">✓ {result.correctAnswers}</span>
                              <span className="text-red-600">✗ {result.wrongAnswers}</span>
                            </td>
                            <td className="py-3 text-center">
                              {(result.timeSpentSeconds / 60).toFixed(1)} min
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exam">
            <Card>
              <CardContent className="pt-6">
                {examResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-600">
                    <p>No assessment mode results</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2">Student</th>
                          <th className="text-left py-2">Exam</th>
                          <th className="text-center py-2">Score</th>
                          <th className="text-center py-2">Results</th>
                          <th className="text-center py-2">Time</th>
                          <th className="text-center py-2">Passed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {examResults.map((result) => {
                          const percentage = (result.score / result.maxScore) * 100;
                          const passed = percentage >= 50;
                          return (
                            <tr key={result.id} className="border-b hover:bg-gray-50">
                              <td className="py-3">
                                <p className="font-medium">{result.studentName}</p>
                              </td>
                              <td className="py-3">{result.examTitle}</td>
                              <td className="py-3 text-center font-medium">{percentage.toFixed(1)}%</td>
                              <td className="py-3 text-center text-xs">
                                <div className="space-y-1">
                                  <p className="text-green-600">✓ {result.correctAnswers}</p>
                                  <p className="text-red-600">✗ {result.wrongAnswers}</p>
                                  <p className="text-gray-600">- {result.skippedAnswers}</p>
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                {(result.timeSpentSeconds / 60).toFixed(1)} min
                              </td>
                              <td className="py-3 text-center">
                                <Badge variant={passed ? 'default' : 'destructive'}>
                                  {passed ? 'Passed' : 'Failed'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default AdminPracticeResults;

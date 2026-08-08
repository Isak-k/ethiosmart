import { Timestamp } from 'firebase/firestore';
import { UserPermissions } from '@/types/permissions';

export type AppRole = 'superadmin' | 'admin' | 'student';

export interface UserProfile {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: AppRole;
  departmentId?: string; // Optional for admin, required for student ideally
  disabled?: boolean; // If true, user cannot login
  permissions?: UserPermissions; // Permissions for admin/superadmin roles
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Department {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export type ExamType = 'normal' | 'practice';
export type PracticeModeType = 'practice' | 'exam';

export interface PracticeExamConfig {
  mode: PracticeModeType;
  showFeedback: boolean;           // Practice mode: show if answer is correct
  showExplanations: boolean;       // Practice mode: show explanations
  timerEnabled: boolean;           // Exam mode: enable countdown timer
  timeLimit?: number;              // Exam mode: time in seconds
  passingScore: number;            // Percentage to pass (default 50)
}

export interface Exam {
  examId: string;
  title: string;
  description: string | null;
  departmentId?: string; // Legacy single department support
  departmentIds?: string[]; // New multiple departments support
  createdBy: string;
  durationMinutes: number;
  maxAttempts: number;
  isPublished: boolean;
  resultsPublished: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  startTime: Timestamp | null;
  endTime: Timestamp | null;
  questionCount: number;
  totalMarks: number;
  accessPassword?: string | null; // Optional password/PIN to access exam
  allowOfflineDownload?: boolean; // Allow students to download exam for offline use
  examType?: ExamType; // normal = fetch from Firebase, practice = 100% offline
  practiceMode?: PracticeModeType; // Which practice mode (if examType is 'practice')
  practiceConfig?: PracticeExamConfig; // Detailed practice exam configuration
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


export type QuestionType = 'mcq' | 'true-false' | 'short-answer' | 'essay';

// Base question interface with common fields
export interface BaseQuestion {
  questionId: string;
  examId: string;
  questionText: string;
  marks: number;
  orderIndex: number;
  feedbackType: 'instant' | 'hidden';
  explanation?: string;
  imageUrl?: string; // Optional image URL (Firebase Storage)
  imageDisplayMode?: 'inline' | 'background' | 'main'; // How to display image (default: inline)
  createdAt: Timestamp;
  questionType: QuestionType;
}

// MCQ specific
export interface MCQQuestion extends BaseQuestion {
  questionType: 'mcq';
  options: string[];
  correctOptionIndex: number;
}

// True/False specific
export interface TrueFalseQuestion extends BaseQuestion {
  questionType: 'true-false';
  correctAnswer: boolean;
}

// Short Answer specific
export interface ShortAnswerQuestion extends BaseQuestion {
  questionType: 'short-answer';
  correctAnswers: string[]; // Multiple acceptable answers
  caseSensitive?: boolean; // Default: false
  requireExactMatch?: boolean; // Default: false (allows partial matches)
}

// Essay specific
export interface EssayQuestion extends BaseQuestion {
  questionType: 'essay';
  rubricPoints?: { criteria: string; points: number }[]; // Optional grading rubric
  minWords?: number;
  maxWords?: number;
}

// Union type for all question types
export type Question = MCQQuestion | TrueFalseQuestion | ShortAnswerQuestion | EssayQuestion;

// Type guard functions
export function isMCQQuestion(q: Question): q is MCQQuestion {
  return q.questionType === 'mcq';
}

export function isTrueFalseQuestion(q: Question): q is TrueFalseQuestion {
  return q.questionType === 'true-false';
}

export function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q.questionType === 'short-answer';
}

export function isEssayQuestion(q: Question): q is EssayQuestion {
  return q.questionType === 'essay';
}

export interface ExamAttempt {
  id?: string; // Firestore document ID
  attemptId: string;
  examId: string;
  studentId: string;
  startedAt: Timestamp;
  submittedAt: Timestamp | null;
  isSubmitted: boolean;
  timeSpentSeconds: number | null;
  totalScore: number | null;
  maxScore: number | null;
  examTitle: string;
  studentName: string;
  studentEmail: string;
  createdAt: Timestamp;
}

export interface Answer {
  questionId: string;
  attemptId: string;
  selectedOptionIndex?: number | null; // MCQ only
  selectedBoolean?: boolean | null; // True/False only
  textAnswer?: string | null; // Short Answer / Essay only
  isCorrect: boolean | null;
  timeSpentSeconds: number | null;
  answeredAt: Timestamp | null;
  rubricScore?: number; // Essay only - for manual grading
}

export interface TextAnswerEvaluation {
  studentAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  requireExactMatch: boolean;
}

export function evaluateTextAnswer(evaluation: TextAnswerEvaluation): boolean {
  const normalize = (text: string): string => {
    let normalized = text.trim();
    if (!evaluation.caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  };

  const normalized = normalize(evaluation.studentAnswer);
  const normalizedCorrect = evaluation.correctAnswers.map(normalize);

  if (evaluation.requireExactMatch) {
    return normalizedCorrect.includes(normalized);
  }

  // Partial match: check if any correct answer contains student answer or vice versa
  return normalizedCorrect.some(correct => 
    correct.includes(normalized) || normalized.includes(correct)
  );
}

// Leaderboard Types

export interface LeaderboardEntry {
  studentId: string;
  studentName: string;
  departmentId: string;
  totalPoints: number;
  averageScore: number;
  examCount: number;
  rankPosition: number;
}

export interface DepartmentRanking {
  departmentId: string;
  departmentName: string;
  totalDepartmentScore: number;
  averageScore: number;
  activeStudentCount: number;
  rankPosition: number;
}

export interface StudentStats {
  studentId: string;
  totalPoints: number;
  averageScore: number;
  examCount: number;
  departmentId: string;
  lastExamDate: Timestamp | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalStudents: number;
  lastUpdated: Timestamp;
  departmentId: string;
  hasMore?: boolean; // Indicates if there are more entries to load
  nextCursor?: number; // Next page cursor (rank position)
}

export interface DepartmentLeaderboardResponse {
  rankings: DepartmentRanking[];
  totalDepartments: number;
  lastUpdated: Timestamp;
}

export interface RankingCalculation {
  studentId: string;
  totalPoints: number;
  averageScore: number;
  examCount: number;
}

// Leaderboard Error Types

export type LeaderboardErrorCode = 
  | 'INVALID_DEPARTMENT'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_EXAM_DATA'
  | 'UNAUTHORIZED_ACCESS'
  | 'CALCULATION_ERROR'
  | 'CACHE_ERROR';

export interface LeaderboardError {
  code: LeaderboardErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// Validation Schemas (Type Guards)

export function isValidLeaderboardEntry(entry: unknown): entry is LeaderboardEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.studentId === 'string' &&
    typeof e.studentName === 'string' &&
    typeof e.departmentId === 'string' &&
    typeof e.totalPoints === 'number' &&
    typeof e.averageScore === 'number' &&
    typeof e.examCount === 'number' &&
    typeof e.rankPosition === 'number'
  );
}

export function isValidDepartmentRanking(ranking: unknown): ranking is DepartmentRanking {
  if (typeof ranking !== 'object' || ranking === null) return false;
  const r = ranking as Record<string, unknown>;
  return (
    typeof r.departmentId === 'string' &&
    typeof r.departmentName === 'string' &&
    typeof r.totalDepartmentScore === 'number' &&
    typeof r.averageScore === 'number' &&
    typeof r.activeStudentCount === 'number' &&
    typeof r.rankPosition === 'number'
  );
}

export function isValidStudentStats(stats: unknown): stats is StudentStats {
  if (typeof stats !== 'object' || stats === null) return false;
  const s = stats as Record<string, unknown>;
  return (
    typeof s.studentId === 'string' &&
    typeof s.totalPoints === 'number' &&
    typeof s.averageScore === 'number' &&
    typeof s.examCount === 'number' &&
    typeof s.departmentId === 'string' &&
    (s.lastExamDate === null || s.lastExamDate instanceof Timestamp)
  );
}

export function isValidRankingCalculation(calc: unknown): calc is RankingCalculation {
  if (typeof calc !== 'object' || calc === null) return false;
  const c = calc as Record<string, unknown>;
  return (
    typeof c.studentId === 'string' &&
    typeof c.totalPoints === 'number' &&
    typeof c.averageScore === 'number' &&
    typeof c.examCount === 'number'
  );
}

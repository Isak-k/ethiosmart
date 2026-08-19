/**
 * Essay Grading Module
 * Manual essay grading, rubric score recording, and status transitions.
 * Supports both Firebase (online examAttempts answers subcollection) and
 * IndexedDB (offline practice answers) storage backends.
 */

import { doc, updateDoc, serverTimestamp, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { Answer, Question, isEssayQuestion } from '@/integrations/firebase/types';
import { initOfflineDB } from './offline-storage';

export interface RubricGrading {
  criteria: string;
  awardedPoints: number;
  maxPoints: number;
  comment?: string;
}

export interface GradedEssayPayload {
  rubricScore: number;
  rubricBreakdown?: RubricGrading[];
  graderComment?: string;
  gradedBy: string;
  graderName?: string;
}

/**
 * Grade an essay answer stored in Firebase.
 *
 * Transitions status from `pending_review` → `graded`. Writes rubric score,
 * optional rubric breakdown, grader identity, grader comment, and server
 * timestamp into the answer document.
 * 
 * Also supports grading short answer questions with no provided answer.
 */
export async function gradeEssayAnswerOnline(
  attemptId: string,
  questionId: string,
  payload: GradedEssayPayload
): Promise<void> {
  const answerRef = doc(db, 'examAttempts', attemptId, 'answers', questionId);
  const snap = await getDoc(answerRef);
  if (!snap.exists()) {
    throw new Error(`Answer not found (attempt=${attemptId}, question=${questionId})`);
  }

  await updateDoc(answerRef, {
    rubricScore: payload.rubricScore,
    rubricBreakdown: payload.rubricBreakdown ?? null,
    graderComment: payload.graderComment ?? null,
    gradedBy: payload.gradedBy,
    graderName: payload.graderName ?? null,
    gradedAt: serverTimestamp(),
    answerStatus: 'graded' as const,
    isCorrect: payload.rubricScore > 0,  // Mark as correct if score > 0
  });
}

/**
 * Recompute totalScore / maxScore for an ExamAttempt using the latest answers,
 * honoring manual essay grades, then write the new aggregate back to Firestore.
 *
 * Returns the breakdown so callers can render a "pending" banner.
 */
export async function recomputeAndUpdateAttemptScore(
  attemptId: string,
  questions: Question[]
): Promise<{
  totalScore: number;
  maxScore: number;
  pendingEssayCount: number;
  gradedEssayCount: number;
  autoGradedCorrect: number;
  autoGradedIncorrect: number;
}> {
  const answersSnap = await getDocs(collection(db, 'examAttempts', attemptId, 'answers'));
  const answers: Answer[] = answersSnap.docs.map((d) => d.data() as Answer);

  let totalScore = 0;
  let maxScore = 0;
  let pendingEssayCount = 0;
  let gradedEssayCount = 0;
  let autoGradedCorrect = 0;
  let autoGradedIncorrect = 0;

  for (const question of questions) {
    maxScore += question.marks;
    const answer = answers.find((a) => a.questionId === question.questionId);
    if (!answer) continue;

    if (isEssayQuestion(question)) {
      if (answer.answerStatus === 'graded' && typeof answer.rubricScore === 'number') {
        totalScore += Math.max(0, Math.min(question.marks, answer.rubricScore));
        gradedEssayCount++;
      } else {
        pendingEssayCount++;
      }
    } else if (answer.isCorrect) {
      totalScore += question.marks;
      autoGradedCorrect++;
    } else {
      autoGradedIncorrect++;
    }
  }

  const attemptRef = doc(db, 'examAttempts', attemptId);
  await updateDoc(attemptRef, {
    totalScore,
    maxScore,
    pendingEssayCount,
    gradedEssayCount,
    totalScoreRecomputedAt: serverTimestamp(),
  });

  return { totalScore, maxScore, pendingEssayCount, gradedEssayCount, autoGradedCorrect, autoGradedIncorrect };
}

/**
 * Grade an offline IndexedDB practice essay answer and transition to graded.
 * Also supports short answer questions with no provided answer.
 */
export async function gradeOfflinePracticeEssay(
  attemptId: string,
  questionId: string,
  payload: GradedEssayPayload
): Promise<void> {
  const dbh = await initOfflineDB();
  const ANSWERS_STORE = 'answers';
  const tx = dbh.transaction(ANSWERS_STORE, 'readwrite');
  const all = await tx.store.getAll();
  const existing = (all as any[]).find(
    (rec) => rec.attemptId === attemptId && rec.questionId === questionId
  );

  if (!existing) {
    throw new Error(`Offline answer not found (attempt=${attemptId}, question=${questionId})`);
  }

  await tx.store.put({
    ...existing,
    rubricScore: payload.rubricScore,
    rubricBreakdown: payload.rubricBreakdown ?? null,
    graderComment: payload.graderComment ?? null,
    gradedBy: payload.gradedBy,
    graderName: payload.graderName ?? null,
    gradedAt: Date.now(),
    answerStatus: 'graded' as const,
    isCorrect: payload.rubricScore > 0,  // Mark as correct if score > 0
  });
  await tx.done;
}

/**
 * Inspect a list of answers and return the essay grading breakdown.
 * Results pages use this to decide whether to render the "pending review" UI.
 */
export function computeEssayGradingStatus(
  answers: Answer[]
): {
  totalEssays: number;
  pendingEssays: number;
  gradedEssays: number;
  anyPending: boolean;
  allGraded: boolean;
} {
  const essays = answers.filter(
    (a) =>
      a.answerStatus === 'pending_review' ||
      a.answerStatus === 'graded' ||
      typeof a.rubricScore === 'number' ||
      (typeof (a as any).textAnswer === 'string' && (a as any).answerStatus == null && !a.isCorrect && typeof (a as any).selectedOptionIndex === 'undefined')
  );

  const totalEssays = essays.length;
  const gradedEssays = essays.filter((a) => a.answerStatus === 'graded').length;
  const pendingEssays = totalEssays - gradedEssays;

  return {
    totalEssays,
    pendingEssays,
    gradedEssays,
    anyPending: pendingEssays > 0,
    allGraded: totalEssays > 0 && gradedEssays === totalEssays,
  };
}

/**
 * Chapter 1 free-trial provisioning logic.
 *
 * When the admin switches the default free trial ON, every Chapter 1 note and
 * every Chapter 1 exam must become free for all students. These helpers are pure
 * so the assignment + validation behaviour can be unit tested deterministically.
 *
 * How the provisioned config maps onto the existing backend:
 *  - Notes  → `freeChaptersPerSubject >= 1` (first chapter of every subject) plus
 *             explicit `freeNoteIds` for the Chapter 1 notes that exist today.
 *  - Exams  → the content-access callable only honours explicit `freeExamIds`, so
 *             every Chapter 1 exam id is written into `freeExamIds`. `freeExamAttempts`
 *             is raised to at least 1 so those exams are actually attemptable.
 */

import type { FreeAccessConfig } from "@/components/admin/payments/types";
import { isChapterOneTrialEnabled } from "@/lib/payment-access";

export interface ChapterRef {
  id: string;
  subjectId?: string;
  chapterNumber?: number;
}

export interface TrialNote {
  id: string;
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  title?: string;
}

export interface TrialExam {
  examId: string;
  chapterId?: string;
  chapterTitle?: string;
  title?: string;
  subjectId?: string;
}

export interface TrialCatalog {
  notes: TrialNote[];
  exams: TrialExam[];
  chapters: ChapterRef[];
}

export interface ChapterOneContent {
  noteIds: string[];
  examIds: string[];
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => typeof item === "string" && item.length > 0)));
}

/** Extract a chapter/unit number from a free-form title such as "Unit 1: Vectors". */
export function chapterNumberFromTitle(text?: string): number | null {
  if (!text) return null;
  const match = text.match(/chapter\s*(\d+)|unit\s*(\d+)/i);
  if (!match) return null;
  const parsed = parseInt(match[1] || match[2], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decide whether an item belongs to Chapter 1, using (in order):
 *  1. an explicit `chapterNumber`,
 *  2. a lookup of its `chapterId` against the known chapters,
 *  3. a chapter/unit number parsed from its title.
 */
export function isChapterOneItem(
  value: { chapterNumber?: number; chapterId?: string; chapterTitle?: string; title?: string },
  chapterNumberById: Map<string, number>,
): boolean {
  if (typeof value.chapterNumber === "number") return value.chapterNumber === 1;
  if (value.chapterId && chapterNumberById.has(value.chapterId)) {
    return chapterNumberById.get(value.chapterId) === 1;
  }
  return chapterNumberFromTitle(value.chapterTitle || value.title) === 1;
}

/** Collect every Chapter 1 note id and exam id present in the catalog. */
export function collectChapterOneContent(catalog: TrialCatalog): ChapterOneContent {
  const chapterNumberById = new Map<string, number>();
  for (const chapter of catalog.chapters) {
    if (typeof chapter.chapterNumber === "number") {
      chapterNumberById.set(chapter.id, chapter.chapterNumber);
    }
  }

  const noteIds = catalog.notes
    .filter((note) => isChapterOneItem(note, chapterNumberById))
    .map((note) => note.id);
  const examIds = catalog.exams
    .filter((exam) => isChapterOneItem(exam, chapterNumberById))
    .map((exam) => exam.examId);

  return { noteIds: unique(noteIds), examIds: unique(examIds) };
}

/** Provision free access for every Chapter 1 note and exam. */
export function provisionChapterOneTrial(
  free: FreeAccessConfig,
  content: ChapterOneContent,
): FreeAccessConfig {
  return {
    ...free,
    enabled: true,
    freeChaptersPerSubject: Math.max(free.freeChaptersPerSubject, 1),
    freeExamAttempts: Math.max(free.freeExamAttempts, 1),
    freeNoteIds: unique([...free.freeNoteIds, ...content.noteIds]),
    freeExamIds: unique([...free.freeExamIds, ...content.examIds]),
  };
}

/** Remove the Chapter 1 free trial provisioned by this feature. */
export function disableChapterOneTrial(
  free: FreeAccessConfig,
  content: ChapterOneContent,
): FreeAccessConfig {
  const noteSet = new Set(content.noteIds);
  const examSet = new Set(content.examIds);
  return {
    ...free,
    freeChaptersPerSubject: 0,
    freeExamAttempts: 0,
    freeNoteIds: free.freeNoteIds.filter((id) => !noteSet.has(id)),
    freeExamIds: free.freeExamIds.filter((id) => !examSet.has(id)),
  };
}

export interface TrialValidation {
  /** Whether the toggle is currently considered ON. */
  active: boolean;
  /** Whether every applicable Chapter 1 item is provisioned. */
  ok: boolean;
  totalNotes: number;
  totalExams: number;
  provisionedNotes: number;
  provisionedExams: number;
  missingNoteIds: string[];
  missingExamIds: string[];
}

/**
 * Validate that Chapter 1 notes and exams are correctly provisioned while the
 * toggle is active. A Chapter 1 note counts as covered when either the per-subject
 * chapter allowance covers it or it is explicitly listed; an exam must be explicit.
 */
export function validateChapterOneTrial(
  free: FreeAccessConfig,
  content: ChapterOneContent,
): TrialValidation {
  const active = isChapterOneTrialEnabled(free);
  const chapterAllowance = free.enabled && free.freeChaptersPerSubject >= 1;
  const noteSet = new Set(free.freeNoteIds);
  const examSet = new Set(free.freeExamIds);

  const missingNoteIds = content.noteIds.filter((id) => !(chapterAllowance || noteSet.has(id)));
  const missingExamIds = content.examIds.filter((id) => !examSet.has(id));

  return {
    active,
    ok: missingNoteIds.length === 0 && missingExamIds.length === 0,
    totalNotes: content.noteIds.length,
    totalExams: content.examIds.length,
    provisionedNotes: content.noteIds.length - missingNoteIds.length,
    provisionedExams: content.examIds.length - missingExamIds.length,
    missingNoteIds,
    missingExamIds,
  };
}

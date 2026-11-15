import { describe, it, expect } from "vitest";
import {
  chapterNumberFromTitle,
  collectChapterOneContent,
  disableChapterOneTrial,
  isChapterOneItem,
  provisionChapterOneTrial,
  validateChapterOneTrial,
  type TrialCatalog,
} from "./free-trial";
import { defaultFreeAccessConfig } from "./payment-access";
import type { FreeAccessConfig } from "@/components/admin/payments/types";

function free(overrides: Partial<FreeAccessConfig> = {}): FreeAccessConfig {
  return { ...defaultFreeAccessConfig(), ...overrides };
}

describe("chapterNumberFromTitle", () => {
  it("parses chapter and unit prefixes", () => {
    expect(chapterNumberFromTitle("Chapter 1: Vectors")).toBe(1);
    expect(chapterNumberFromTitle("Unit 2 - Mechanics")).toBe(2);
    expect(chapterNumberFromTitle("Introduction")).toBeNull();
    expect(chapterNumberFromTitle(undefined)).toBeNull();
  });
});

describe("isChapterOneItem", () => {
  const chapterNumberById = new Map<string, number>([
    ["ch-1", 1],
    ["ch-2", 2],
  ]);

  it("prefers an explicit chapterNumber", () => {
    expect(isChapterOneItem({ chapterNumber: 1, chapterId: "ch-2" }, chapterNumberById)).toBe(true);
    expect(isChapterOneItem({ chapterNumber: 3 }, chapterNumberById)).toBe(false);
  });

  it("falls back to the chapter id lookup", () => {
    expect(isChapterOneItem({ chapterId: "ch-1" }, chapterNumberById)).toBe(true);
    expect(isChapterOneItem({ chapterId: "ch-2" }, chapterNumberById)).toBe(false);
  });

  it("falls back to the title", () => {
    expect(isChapterOneItem({ chapterTitle: "Unit 1: Vectors" }, chapterNumberById)).toBe(true);
    expect(isChapterOneItem({ title: "Unit 4: Optics" }, chapterNumberById)).toBe(false);
  });
});

describe("collectChapterOneContent", () => {
  const catalog: TrialCatalog = {
    chapters: [
      { id: "ch-1", subjectId: "phys", chapterNumber: 1 },
      { id: "ch-2", subjectId: "phys", chapterNumber: 2 },
      { id: "ch-11", subjectId: "math", chapterNumber: 1 },
    ],
    notes: [
      { id: "note-a", chapterId: "ch-1" },
      { id: "note-b", chapterNumber: 2, chapterId: "ch-2" },
      { id: "note-c", chapterTitle: "Unit 1: Algebra", chapterId: "ch-11" },
      { id: "note-d", title: "Unit 5: History" },
    ],
    exams: [
      { examId: "exam-a", chapterId: "ch-1" },
      { examId: "exam-b", chapterTitle: "Unit 2: Optics" },
      { examId: "exam-c", chapterTitle: "Chapter 1: Basics" },
    ],
  };

  it("collects only Chapter 1 notes and exams", () => {
    const content = collectChapterOneContent(catalog);
    expect(content.noteIds).toEqual(["note-a", "note-c"]);
    expect(content.examIds).toEqual(["exam-a", "exam-c"]);
  });

  it("does not duplicate ids when multiple signals match", () => {
    const content = collectChapterOneContent({
      chapters: [{ id: "ch-1", chapterNumber: 1 }],
      notes: [{ id: "note-a", chapterId: "ch-1", chapterNumber: 1 }],
      exams: [{ examId: "exam-a", chapterId: "ch-1", title: "Unit 1" }],
    });
    expect(content.noteIds).toEqual(["note-a"]);
    expect(content.examIds).toEqual(["exam-a"]);
  });

  it("returns empty sets for an empty catalog", () => {
    const content = collectChapterOneContent({ notes: [], exams: [], chapters: [] });
    expect(content).toEqual({ noteIds: [], examIds: [] });
  });
});

describe("provisionChapterOneTrial", () => {
  it("switches the trial on and merges Chapter 1 items", () => {
    const before = free({ enabled: false, freeNoteIds: ["existing-note"] });
    const after = provisionChapterOneTrial(before, { noteIds: ["n1", "existing-note"], examIds: ["e1"] });

    expect(after.enabled).toBe(true);
    expect(after.freeChaptersPerSubject).toBe(1);
    expect(after.freeExamAttempts).toBe(1);
    expect(after.freeNoteIds).toEqual(["existing-note", "n1"]);
    expect(after.freeExamIds).toEqual(["e1"]);
  });

  it("preserves previously higher allowances", () => {
    const before = free({ freeChaptersPerSubject: 3, freeExamAttempts: 5 });
    const after = provisionChapterOneTrial(before, { noteIds: [], examIds: [] });
    expect(after.freeChaptersPerSubject).toBe(3);
    expect(after.freeExamAttempts).toBe(5);
  });
});

describe("disableChapterOneTrial", () => {
  it("removes Chapter 1 items and resets allowances", () => {
    const provisioned = provisionChapterOneTrial(free({ freeNoteIds: ["keep-me"] }), {
      noteIds: ["n1"],
      examIds: ["e1"],
    });
    const after = disableChapterOneTrial(provisioned, { noteIds: ["n1"], examIds: ["e1"] });

    expect(after.freeChaptersPerSubject).toBe(0);
    expect(after.freeExamAttempts).toBe(0);
    expect(after.freeNoteIds).toEqual(["keep-me"]);
    expect(after.freeExamIds).toEqual([]);
  });
});

describe("validateChapterOneTrial", () => {
  const content = { noteIds: ["n1", "n2"], examIds: ["e1"] };

  it("reports ok once everything is provisioned", () => {
    const provisioned = provisionChapterOneTrial(free(), content);
    const result = validateChapterOneTrial(provisioned, content);
    expect(result.active).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.provisionedNotes).toBe(2);
    expect(result.provisionedExams).toBe(1);
    expect(result.missingNoteIds).toEqual([]);
    expect(result.missingExamIds).toEqual([]);
  });

  it("is not ok when the trial is off", () => {
    const result = validateChapterOneTrial(free({ freeChaptersPerSubject: 0 }), content);
    expect(result.active).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.missingExamIds).toEqual(["e1"]);
  });

  it("flags exams that were left out of freeExamIds", () => {
    const partial = free({ freeChaptersPerSubject: 1, freeNoteIds: ["n1", "n2"], freeExamIds: [] });
    const result = validateChapterOneTrial(partial, content);
    // Notes are covered by the chapter allowance, but the exam is not explicit.
    expect(result.ok).toBe(false);
    expect(result.missingExamIds).toEqual(["e1"]);
    expect(result.missingNoteIds).toEqual([]);
  });
});

describe("free trial lifecycle (user scenarios)", () => {
  const catalog: TrialCatalog = {
    chapters: [
      { id: "ch-1", subjectId: "phys", chapterNumber: 1 },
      { id: "ch-2", subjectId: "phys", chapterNumber: 2 },
    ],
    notes: [
      { id: "note-1", chapterId: "ch-1" },
      { id: "note-2", chapterId: "ch-2" },
    ],
    exams: [
      { examId: "exam-1", chapterId: "ch-1" },
      { examId: "exam-2", chapterId: "ch-2" },
    ],
  };

  it("enabling the toggle provisions all Chapter 1 items and validates clean", () => {
    const content = collectChapterOneContent(catalog);
    const provisioned = provisionChapterOneTrial(free(), content);

    expect(content).toEqual({ noteIds: ["note-1"], examIds: ["exam-1"] });
    expect(provisioned.freeNoteIds).toEqual(["note-1"]);
    expect(provisioned.freeExamIds).toEqual(["exam-1"]);
    expect(validateChapterOneTrial(provisioned, content).ok).toBe(true);
  });

  it("is idempotent when applied repeatedly", () => {
    const content = collectChapterOneContent(catalog);
    const once = provisionChapterOneTrial(free(), content);
    const twice = provisionChapterOneTrial(once, content);
    expect(twice).toEqual(once);
  });

  it("reverts cleanly when disabled", () => {
    const content = collectChapterOneContent(catalog);
    const on = provisionChapterOneTrial(free(), content);
    const off = disableChapterOneTrial(on, content);
    expect(off.freeNoteIds).toEqual([]);
    expect(off.freeExamIds).toEqual([]);
    expect(validateChapterOneTrial(off, content).active).toBe(false);
  });

  it("leaves manually selected free items untouched when toggling off", () => {
    const content = collectChapterOneContent(catalog);
    const on = provisionChapterOneTrial(free(), content);
    const withManual = { ...on, freeNoteIds: [...on.freeNoteIds, "manual-note"], freeExamIds: [...on.freeExamIds, "manual-exam"] };
    const off = disableChapterOneTrial(withManual, content);
    expect(off.freeNoteIds).toEqual(["manual-note"]);
    expect(off.freeExamIds).toEqual(["manual-exam"]);
  });
});

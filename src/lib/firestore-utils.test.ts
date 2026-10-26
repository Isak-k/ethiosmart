import { describe, it, expect } from 'vitest';
import { removeUndefinedFields, restoreFirestoreData } from './firestore-utils';
import { serverTimestamp } from 'firebase/firestore';

describe('removeUndefinedFields', () => {
  it('strips top-level and nested undefined fields without altering valid values', () => {
    const raw = {
      title: 'Chapter 3: Learning and Theories',
      author: 'ExamPro Academic Team',
      examId: undefined,
      generationSettings: {
        depth: 'detailed',
        targetAudience: 'beginner',
        language: 'English',
        customInstructions: undefined,
      },
      sections: [
        {
          id: 'sec-1',
          title: 'Introduction',
          subtitle: undefined,
          isImportant: true,
          contentBlocks: [
            {
              id: 'b1',
              type: 'definition',
              content: 'Learning is relatively permanent change in behavior.',
              extraNotes: undefined,
            },
          ],
        },
      ],
      zeroVal: 0,
      falseVal: false,
      emptyStr: '',
      nullVal: null,
    };

    const cleaned = removeUndefinedFields(raw);

    expect(cleaned).toEqual({
      title: 'Chapter 3: Learning and Theories',
      author: 'ExamPro Academic Team',
      generationSettings: {
        depth: 'detailed',
        targetAudience: 'beginner',
        language: 'English',
      },
      sections: [
        {
          id: 'sec-1',
          title: 'Introduction',
          isImportant: true,
          contentBlocks: [
            {
              id: 'b1',
              type: 'definition',
              content: 'Learning is relatively permanent change in behavior.',
            },
          ],
        },
      ],
      zeroVal: 0,
      falseVal: false,
      emptyStr: '',
      nullVal: null,
    });

    expect('examId' in cleaned).toBe(false);
    expect('customInstructions' in (cleaned as any).generationSettings).toBe(false);
    expect('subtitle' in (cleaned as any).sections[0]).toBe(false);
  });

  it('preserves Date objects and Firestore FieldValue sentinels', () => {
    const now = new Date();
    const serverTime = serverTimestamp();

    const data = {
      title: 'Test',
      createdAt: serverTime,
      date: now,
      emptyField: undefined,
    };

    const cleaned = removeUndefinedFields(data);
    expect(cleaned.createdAt).toBe(serverTime);
    expect(cleaned.date).toBe(now);
    expect('emptyField' in cleaned).toBe(false);
  });

  it('safely wraps multidimensional/nested arrays to prevent Firestore rejection', () => {
    const rawWithNestedArrays = {
      title: 'Chapter 3: Learning Theories',
      sections: [
        {
          id: 'sec-3',
          title: 'Characteristics of Learning',
          contentBlocks: [
            {
              id: 'tbl-1',
              type: 'table',
              tableData: {
                headers: ['Characteristic', 'Simple explanation', 'Example'],
                rows: [
                  ['Continuous', 'Learning continues throughout life.', 'An adult learns a new language.'],
                  ['Pervasive', 'Learning affects many areas of life.', 'A person learns skills.'],
                ],
              },
            },
          ],
        },
      ],
    };

    const sanitized = removeUndefinedFields(rawWithNestedArrays);

    // Verify rows are no longer arrays-within-arrays
    const rows = (sanitized as any).sections[0].contentBlocks[0].tableData.rows;
    expect(rows.length).toBe(2);
    expect(Array.isArray(rows[0])).toBe(false);
    expect(rows[0].cells).toEqual(['Continuous', 'Learning continues throughout life.', 'An adult learns a new language.']);
    expect(rows[1].cells).toEqual(['Pervasive', 'Learning affects many areas of life.', 'A person learns skills.']);

    // Verify restoreFirestoreData converts back to 2D array
    const restored = restoreFirestoreData(sanitized);
    const restoredRows = (restored as any).sections[0].contentBlocks[0].tableData.rows;
    expect(Array.isArray(restoredRows[0])).toBe(true);
    expect(restoredRows[0]).toEqual(['Continuous', 'Learning continues throughout life.', 'An adult learns a new language.']);
    expect(restoredRows[1]).toEqual(['Pervasive', 'Learning affects many areas of life.', 'A person learns skills.']);
  });
});

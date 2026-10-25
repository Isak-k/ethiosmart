import { describe, it, expect } from 'vitest';
import {
  organizeChapterNotesLocal,
  generateMarkdownFromSections,
  MULTI_SUBJECT_SAMPLE_NOTES,
} from './shortnotes-organizer';
import { formatMathToHtml } from '@/components/notes/MathContent';

describe('Interactive Notes Architecture & Multi-Subject Parser', () => {
  it('parses Mathematics notes into structured sections, formulas, and exercises with solutions', () => {
    const mathSample = MULTI_SUBJECT_SAMPLE_NOTES.mathematics.text;
    const result = organizeChapterNotesLocal(mathSample, {
      chapterTitle: 'Sequences and Series',
      subjectName: 'Mathematics',
    });

    expect(result.title).toContain('Sequences and Series');
    expect(result.learningOutcomes.length).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThanOrEqual(2);

    // Verify first section (Arithmetic Progressions)
    const apSection = result.sections[0];
    expect(apSection.title).toContain('Arithmetic Progression');

    // Verify exercises with separate solutions
    expect(apSection.exercises).toBeDefined();
    expect(apSection.exercises!.length).toBeGreaterThan(0);

    const exercise1 = apSection.exercises![0];
    expect(exercise1.question).toContain('20th term');
    expect(exercise1.hints).toBeDefined();
    expect(exercise1.solution).toBeDefined();
    expect(exercise1.solution.answer).toContain('-52');
    expect(exercise1.solution.steps?.length).toBeGreaterThan(0);
    expect(exercise1.initialExpanded).toBe(false); // Independent collapsed state by default
  });

  it('parses Physics notes with formulas and Newton second law exercises', () => {
    const physicsSample = MULTI_SUBJECT_SAMPLE_NOTES.physics.text;
    const result = organizeChapterNotesLocal(physicsSample, {
      chapterTitle: "Newton's Laws",
      subjectName: 'Physics',
    });

    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    const sec1 = result.sections[0];
    expect(sec1.exercises?.length).toBeGreaterThan(0);

    const exercise = sec1.exercises![0];
    expect(exercise.question).toContain('elevator');
    expect(exercise.solution.answer).toContain('9040');
    expect(exercise.solution.steps?.length).toBeGreaterThan(0);
  });

  it('parses Biology notes with tables, terms, and multiple choice questions', () => {
    const bioSample = MULTI_SUBJECT_SAMPLE_NOTES.biology.text;
    const result = organizeChapterNotesLocal(bioSample, {
      chapterTitle: 'Cellular Division',
      subjectName: 'Biology',
    });

    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    const sec1 = result.sections[0];

    // Check table block
    const tableBlock = sec1.contentBlocks?.find((b) => b.type === 'table');
    expect(tableBlock).toBeDefined();
    expect(tableBlock?.tableData?.headers).toContain('Phase');

    // Check multiple choice exercise
    expect(sec1.exercises?.length).toBeGreaterThan(0);
    const mcq = sec1.exercises![0];
    expect(mcq.questionType).toBe('mcq');
    expect(mcq.options?.length).toBe(4);
    expect(mcq.solution.answer).toContain('46 chromosomes');
  });

  it('parses Programming notes with Python code blocks', () => {
    const progSample = MULTI_SUBJECT_SAMPLE_NOTES.programming.text;
    const result = organizeChapterNotesLocal(progSample, {
      chapterTitle: 'Python Data Structures',
      subjectName: 'Computer Programming',
    });

    expect(result.sections.length).toBeGreaterThanOrEqual(1);
    const sec1 = result.sections[0];

    // Verify code block
    const codeBlock = sec1.contentBlocks?.find((b) => b.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.codeLanguage).toBe('python');
    expect(codeBlock?.content).toContain('def binary_search');

    // Verify exercise
    expect(sec1.exercises?.length).toBeGreaterThan(0);
    const ex = sec1.exercises![0];
    expect(ex.solution.answer).toContain('10 comparisons');
  });

  it('formats mathematical LaTeX notation into clean HTML with fractions, roots, powers, and Greek symbols', () => {
    // Fractions
    const frac = formatMathToHtml('\\frac{a + b}{c}');
    expect(frac).toContain('inline-flex flex-col items-center');
    expect(frac).toContain('a + b');
    expect(frac).toContain('c');

    // Square roots
    const sqrt = formatMathToHtml('\\sqrt{x^2 + y^2}');
    expect(sqrt).toContain('&radic;');

    // Powers and subscripts
    const power = formatMathToHtml('x^2 + a_1');
    expect(power).toContain('<sup>2</sup>');
    expect(power).toContain('<sub>1</sub>');

    // Greek letters & operators
    const greek = formatMathToHtml('\\alpha + \\beta \\le \\pi');
    expect(greek).toContain('&alpha;');
    expect(greek).toContain('&beta;');
    expect(greek).toContain('&le;');
    expect(greek).toContain('&pi;');
  });

  it('generates structured markdown from sections preserving exercises and solutions', () => {
    const mathSample = MULTI_SUBJECT_SAMPLE_NOTES.mathematics.text;
    const organized = organizeChapterNotesLocal(mathSample);
    const md = generateMarkdownFromSections(organized.sections);

    expect(md).toContain('## Section 1:');
    expect(md).toContain('Exercise');
    expect(md).toContain('**Answer**:');
  });
});

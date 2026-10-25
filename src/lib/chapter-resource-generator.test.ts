import { describe, it, expect } from 'vitest';
import {
  splitResourceIntoChapters,
  generateImportantChapterNotes,
  isTableOfContentsEntry,
  validateStudyNoteCompleteness,
  enrichStudyNoteToTextbookQuality,
  analyzeDocumentChapters,
} from './chapter-resource-generator';
import { Chapter } from '@/types/subject';

describe('chapter-resource-generator', () => {
  describe('splitResourceIntoChapters', () => {
    it('returns empty array if text is empty', () => {
      const res = splitResourceIntoChapters('');
      expect(res).toEqual([]);
    });

    it('splits resource according to existing subject chapters', () => {
      const subjectChapters: Chapter[] = [
        {
          id: 'ch-1',
          subjectId: 'sub-math',
          chapterNumber: 1,
          title: 'Sequences and Series',
          description: '',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch-2',
          subjectId: 'sub-math',
          chapterNumber: 2,
          title: 'Limits and Continuity',
          description: '',
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const fullText = `
Chapter 1: Sequences and Series
An arithmetic sequence has common difference d.
Example: 2, 5, 8, 11...

Chapter 2: Limits and Continuity
The limit of f(x) as x approaches c is L.
lim_{x -> c} f(x) = L.
      `.trim();

      const separated = splitResourceIntoChapters(fullText, subjectChapters);
      expect(separated.length).toBe(2);
      expect(separated[0].chapterNumber).toBe(1);
      expect(separated[0].chapterTitle).toBe('Sequences and Series');
      expect(separated[0].rawText).toContain('arithmetic sequence');
      expect(separated[1].chapterNumber).toBe(2);
      expect(separated[1].chapterTitle).toBe('Limits and Continuity');
      expect(separated[1].rawText).toContain('limit of f(x)');
    });

    it('accurately identifies and bypasses Table of Contents without contaminating chapters', () => {
      const subjectChapters: Chapter[] = [
        {
          id: 'ch-1',
          subjectId: 'sub-math',
          chapterNumber: 1,
          title: 'Sequences and Series',
          description: '',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch-2',
          subjectId: 'sub-math',
          chapterNumber: 2,
          title: 'Limits and Continuity',
          description: '',
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Realistic textbook format: starts with Table of Contents dot leaders, then the actual textbook body
      const textbookText = `
Table of Contents
Chapter 1: Sequences and Series .............................. 1
Chapter 2: Limits and Continuity ............................. 48
Chapter 3: Derivatives and Rates of Change .................. 92

Chapter 1: Sequences and Series
Introduction to Sequences:
An arithmetic sequence is an ordered progression of numbers where consecutive terms differ by constant d.
Key formula for the general nth term:
a_n = a_1 + (n - 1)d
Worked Example: Given 3, 7, 11... the common difference is 4.

Chapter 2: Limits and Continuity
Foundations of Calculus:
A function f(x) approaches limit L as x approaches c if values of f(x) become arbitrarily close to L.
Important: Evaluating limits at points of discontinuity requires algebraic simplification or factoring.
      `.trim();

      // Verify TOC line detection directly
      const tocLineIdx = textbookText.indexOf('Chapter 1: Sequences and Series .............................. 1');
      expect(isTableOfContentsEntry(textbookText, tocLineIdx, 30)).toBe(true);

      const separated = splitResourceIntoChapters(textbookText, subjectChapters);
      expect(separated.length).toBe(2);

      // Chapter 1 MUST get the real textbook body, NOT the single line from Table of Contents!
      expect(separated[0].chapterNumber).toBe(1);
      expect(separated[0].chapterTitle).toBe('Sequences and Series');
      expect(separated[0].rawText).toContain('Introduction to Sequences');
      expect(separated[0].rawText).toContain('a_n = a_1 + (n - 1)d');
      expect(separated[0].rawText).not.toContain('Table of Contents');
      expect(separated[0].rawText).not.toContain('.............................. 1');
      // Chapter 1 must NOT contain Chapter 2 content or TOC lines
      expect(separated[0].rawText).not.toContain('Foundations of Calculus');
      expect(separated[0].rawText).not.toContain('Chapter 2: Limits and Continuity');

      // Chapter 2 MUST get its real body
      expect(separated[1].chapterNumber).toBe(2);
      expect(separated[1].chapterTitle).toBe('Limits and Continuity');
      expect(separated[1].rawText).toContain('Foundations of Calculus');
      expect(separated[1].rawText).toContain('discontinuity requires algebraic simplification');
      expect(separated[1].rawText).not.toContain('Introduction to Sequences');
    });

    it('auto-detects chapters when subject chapters are not configured', () => {
      const fullText = `
Unit 1: Introduction to Mechanics
Displacement, velocity, and acceleration are kinematic quantities.

Unit 2: Newton's Laws of Motion
An object remains at rest unless acted upon by a net force.
      `.trim();

      const separated = splitResourceIntoChapters(fullText, []);
      expect(separated.length).toBe(2);
      expect(separated[0].chapterNumber).toBe(1);
      expect(separated[0].chapterTitle).toContain('Introduction to Mechanics');
      expect(separated[1].chapterNumber).toBe(2);
      expect(separated[1].chapterTitle).toContain("Newton's Laws of Motion");
    });

    it('enforces strict chapter boundaries and does not integrate chapter 2 into chapter 1', () => {
      const subjectChapters: Chapter[] = [
        {
          id: 'ch-1',
          subjectId: 'sub-psych',
          chapterNumber: 1,
          title: 'Foundations of Psychology',
          description: '',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ch-2',
          subjectId: 'sub-psych',
          chapterNumber: 2,
          title: 'Biological Bases of Behavior',
          description: '',
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const fullText = `
Chapter 1: Foundations of Psychology
Psychology is the scientific study of mind and behavior.
Key paradigms include structuralism, functionalism, and behaviorism.

Chapter 2: Biological Bases of Behavior
The nervous system consists of the central and peripheral divisions.
Neurons communicate across synapses via chemical neurotransmitters.
      `.trim();

      const separated = splitResourceIntoChapters(fullText, subjectChapters);
      expect(separated.length).toBe(2);

      // Strict boundary check: Chapter 1 must NOT contain Chapter 2 text
      expect(separated[0].rawText).toContain('scientific study of mind');
      expect(separated[0].rawText).not.toContain('Biological Bases of Behavior');
      expect(separated[0].rawText).not.toContain('neurotransmitters');

      // Chapter 2 must contain its own text
      expect(separated[1].rawText).toContain('nervous system');
      expect(separated[1].rawText).toContain('neurotransmitters');
    });
  });

  describe('generateImportantChapterNotes & Completeness Validation', () => {
    it('synthesizes essential learning outcomes, definitions, formulas, and Show/Hide solutions', () => {
      const chapterText = `
Chapter 1: Arithmetic Sequences

Learning Outcomes:
- Understand arithmetic sequences.
- Compute the nth term formula: a_n = a_1 + (n - 1)d.

Key Definitions:
- Common Difference: The constant amount added to each consecutive term.
- Sequence: An ordered list of numbers.

Formulas & Principles:
- a_n = a_1 + (n - 1) * d
- S_n = (n / 2) * (2*a_1 + (n - 1)*d)

Worked Example:
Find the 10th term of 3, 7, 11, 15...
Solution:
Here a_1 = 3, d = 4.
a_10 = 3 + (10 - 1) * 4 = 3 + 36 = 39.

Exercise:
Find the 20th term of 5, 9, 13...
Solution:
a_1 = 5, d = 4.
a_20 = 5 + 19 * 4 = 81.
      `.trim();

      const result = generateImportantChapterNotes(chapterText, {
        subjectName: 'Mathematics',
        chapterTitle: 'Arithmetic Sequences',
        chapterNumber: 1,
        gradeLevel: 'Grade 12',
      });

      expect(result.title).toContain('Arithmetic Sequences');
      expect(result.learningOutcomes.length).toBeGreaterThan(0);
      expect(result.keyTerms.length).toBeGreaterThan(0);
      expect(result.keyTakeaways.length).toBeGreaterThan(0);
      expect(result.sections.length).toBeGreaterThan(0);

      // Verify exercises have show/hide solutions
      const sectionsWithExercises = result.sections.filter(
        (s) => s.exercises && s.exercises.length > 0
      );
      expect(sectionsWithExercises.length).toBeGreaterThan(0);

      const firstEx = sectionsWithExercises[0].exercises![0];
      expect(firstEx.question).toBeDefined();
      expect(firstEx.solution).toBeDefined();
      expect(firstEx.initialExpanded).toBe(false); // Collapsed by default as requested

      // Validate completeness
      const validation = validateStudyNoteCompleteness(result, chapterText, 'Mathematics');
      expect(validation.score).toBeGreaterThanOrEqual(80);
      expect(validation.hasTOCContamination).toBe(false);
      expect(validation.discipline).toBe('mathematics');
    });

    it('generates subject-specific content tailored for Psychology with conceptual depth', () => {
      const psychResult = generateImportantChapterNotes('', {
        subjectName: 'Psychology 101',
        chapterTitle: 'Cognitive Development & Schemas',
        chapterNumber: 1,
      });

      expect(psychResult.title).toContain('Psychology');
      expect(psychResult.title).toContain('Cognitive Development');
      // Should focus on conceptual frameworks and behavioral models
      const outcomesText = psychResult.learningOutcomes.join(' ');
      expect(outcomesText).toMatch(/cognitive|theoretical|behavior|model|empirical/i);

      // Key terms should focus on psychological definitions
      const termNames = psychResult.keyTerms.map((t) => t.term).join(' ');
      expect(termNames).toMatch(/Schema|Validity|Behavioral/i);

      const validation = validateStudyNoteCompleteness(psychResult, '', 'Psychology');
      expect(validation.score).toBeGreaterThanOrEqual(85);
      expect(validation.status).toBe('exemplary');
    });

    it('generates subject-specific content tailored for Mathematics with calculation depth', () => {
      const mathResult = generateImportantChapterNotes('', {
        subjectName: 'Advanced Mathematics',
        chapterTitle: 'Arithmetic & Geometric Sequences',
        chapterNumber: 1,
      });

      expect(mathResult.title).toContain('Mathematics');
      const outcomesText = mathResult.learningOutcomes.join(' ');
      expect(outcomesText).toMatch(/formula|equation|calculation|comput/i);

      // Sections should focus on mathematical formulations
      const sectionTitles = mathResult.sections.map((s) => s.title).join(' ');
      expect(sectionTitles).toMatch(/Formula|Calculation|Problem/i);

      const validation = validateStudyNoteCompleteness(mathResult, '', 'Mathematics');
      expect(validation.score).toBeGreaterThanOrEqual(85);
      expect(validation.status).toBe('exemplary');
    });

    it('enriches a brief note into complete textbook-quality teaching material', () => {
      const briefNote = {
        title: 'Physics - Vectors',
        summary: 'Brief overview of vectors.',
        learningOutcomes: ['Understand vectors'],
        keyTakeaways: ['Vectors have direction'],
        sections: [
          {
            id: 'sec-1',
            title: 'Vector Addition',
            content: 'Vectors add tip-to-tail.',
            keyPoints: ['Tip to tail rule'],
          },
        ],
        keyTerms: [{ term: 'Vector', definition: 'Quantity with magnitude and direction.' }],
        exercises: [],
        rawContent: 'Vectors add tip to tail.',
        readingTimeMinutes: 1,
      };

      const initialValidation = validateStudyNoteCompleteness(briefNote, 'Vectors add tip to tail.', 'Physics');
      expect(initialValidation.score).toBeLessThan(75);

      const enriched = enrichStudyNoteToTextbookQuality(briefNote, {
        subjectName: 'Physics',
        chapterTitle: 'Vectors and Kinematics',
        chapterNumber: 1,
      });

      const enrichedValidation = validateStudyNoteCompleteness(enriched, enriched.rawContent, 'Physics');
      expect(enrichedValidation.score).toBeGreaterThanOrEqual(85);
      expect(enrichedValidation.status).toBe('exemplary');
      expect(enriched.sections[0].content).toContain('Prerequisite Knowledge');
      expect(enriched.sections[0].exercises?.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeDocumentChapters', () => {
    it('detects multiple chapters in a multi-chapter textbook document', () => {
      const multiDoc = `
Chapter 1: Principles of Genetics
Gregor Mendel discovered the fundamental laws of inheritance through breeding garden peas.
He observed that genes come in pairs and are inherited as distinct units.

Chapter 2: DNA Structure and Replication
In 1953, James Watson and Francis Crick described the double-helix structure of DNA.
Each nucleotide consists of a phosphate group, sugar, and nitrogenous base.

Chapter 3: Protein Synthesis and Gene Expression
Translation and transcription convert nucleotide sequences into functional proteins.
      `.trim();

      const analysis = analyzeDocumentChapters(multiDoc, { fileName: 'Biology_Curriculum.pdf' });
      expect(analysis.status).toBe('multiple_chapters');
      expect(analysis.detectedChapters.length).toBe(3);
      expect(analysis.confidence).toBeGreaterThan(0.9);
      expect(analysis.detectedChapters[0].chapterTitle).toContain('Principles of Genetics');
      expect(analysis.detectedChapters[1].chapterTitle).toContain('DNA Structure');
      expect(analysis.outlineItems.length).toBeGreaterThanOrEqual(3);
    });

    it('detects single chapter when document has one explicit chapter header', () => {
      const singleDoc = `
# Chapter 4: Cellular Respiration
Cellular respiration is a metabolic pathway that breaks down glucose and produces ATP.
The stages of cellular respiration include glycolysis, pyruvate oxidation, citric acid cycle, and oxidative phosphorylation.
Glycolysis occurs in the cytoplasm and breaks glucose into two molecules of pyruvate.
      `.trim();

      const analysis = analyzeDocumentChapters(singleDoc, { fileName: 'Ch4_Cellular_Respiration.docx' });
      expect(analysis.status).toBe('single_chapter');
      expect(analysis.detectedChapters.length).toBe(1);
      expect(analysis.detectedChapters[0].chapterNumber).toBe(4);
      expect(analysis.detectedChapters[0].chapterTitle).toContain('Cellular Respiration');
    });

    it('classifies small document without chapter numbers as single chapter', () => {
      const shortDoc = `
# Cognitive Biases in Decision Making
Confirmation bias is the tendency to search for, interpret, favor, and recall information in a way that confirms prior beliefs.
Anchoring bias occurs when individuals rely excessively on an initial piece of information.
      `.trim();

      const analysis = analyzeDocumentChapters(shortDoc, { fileName: 'psychology_notes.txt' });
      expect(analysis.status).toBe('single_chapter');
      expect(analysis.detectedChapters.length).toBe(1);
      expect(analysis.suggestedTitle).toBe('psychology notes');
    });

    it('classifies large document with multiple unnumbered sections as uncertain', () => {
      // Create a 3200+ word unnumbered document with 4 sections
      const paragraph = 'Understanding complex educational systems requires rigorous analysis, thorough experimentation, critical thinking, systematic evaluation, and ongoing feedback loops across diverse academic disciplines. '.repeat(25);
      const largeDoc = `
# Overview of Educational Assessment
${paragraph}
${paragraph}

# Formative Assessment Methodologies
${paragraph}
${paragraph}

# Summative Evaluation Strategies
${paragraph}
${paragraph}

# Diagnostic Testing Procedures
${paragraph}
${paragraph}
      `.trim();

      const analysis = analyzeDocumentChapters(largeDoc, { fileName: 'assessment_manual.pdf' });
      expect(analysis.totalWordCount).toBeGreaterThan(3000);
      expect(analysis.status).toBe('uncertain');
      expect(analysis.outlineItems.length).toBeGreaterThanOrEqual(4);
      expect(analysis.outlineItems[0].title).toContain('Overview of Educational Assessment');
    });
  });
});

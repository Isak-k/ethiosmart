import { describe, it, expect } from 'vitest';
import {
  detectScopeFromPrompt,
  parsePageRange,
  isPageInRange,
  filterPagesByRange,
  filterDelimitedTextByRange,
  filterContentByChapter,
  sanitizeResourceDependentWording,
  ExtractedPageItem
} from './prompt-scope-extractor';

describe('Prompt Scope & Page Range Extractor', () => {
  describe('detectScopeFromPrompt', () => {
    it('detects page ranges formatted as "page 15 to 25"', () => {
      const prompt = 'Please generate 10 questions from page 15 to 25 with real-world scenarios';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedPageRange).toBe('15-25');
      expect(result.startPage).toBe(15);
      expect(result.endPage).toBe(25);
      expect(result.pageNumbers).toHaveLength(11);
    });

    it('detects page ranges formatted as "pages 40-50"', () => {
      const prompt = 'Generate exam questions focusing on pages 40-50';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedPageRange).toBe('40-50');
      expect(result.startPage).toBe(40);
      expect(result.endPage).toBe(50);
    });

    it('detects single page formatted as "page 12"', () => {
      const prompt = 'Generate true/false questions only from page 12';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedPageRange).toBe('12');
      expect(result.startPage).toBe(12);
      expect(result.endPage).toBe(12);
    });

    it('detects short form "p. 5-10" and "pp 20-30"', () => {
      const res1 = detectScopeFromPrompt('Questions covering p. 5-10');
      expect(res1.hasDetectedScope).toBe(true);
      expect(res1.detectedPageRange).toBe('5-10');

      const res2 = detectScopeFromPrompt('Questions covering pp 20-30');
      expect(res2.hasDetectedScope).toBe(true);
      expect(res2.detectedPageRange).toBe('20-30');
    });

    it('detects Arabic page ranges like "من صفحة 10 الى 20"', () => {
      const prompt = 'أسئلة من صفحة 10 الى 20 بدقة';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedPageRange).toBe('10-20');
      expect(result.startPage).toBe(10);
      expect(result.endPage).toBe(20);
    });

    it('detects chapter references like "chapter 2"', () => {
      const prompt = 'Generate 15 questions from chapter 2 with explanations';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedChapter?.toLowerCase()).toContain('chapter 2');
    });

    it('detects chapter with title like "Chapter 3: Cell Division"', () => {
      const prompt = 'Focus on Chapter 3: Cell Division';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(true);
      expect(result.detectedChapter).toContain('Chapter 3: Cell Division');
    });

    it('returns hasDetectedScope=false when no scope or page is mentioned', () => {
      const prompt = 'Generate balanced questions about physics mechanics';
      const result = detectScopeFromPrompt(prompt);
      expect(result.hasDetectedScope).toBe(false);
      expect(result.detectedPageRange).toBeUndefined();
    });
  });

  describe('parsePageRange & isPageInRange', () => {
    it('parses ranges and individual pages', () => {
      const set = parsePageRange('1-5, 8, 10-12');
      expect(Array.from(set).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 8, 10, 11, 12]);
    });

    it('checks if page is in range correctly', () => {
      expect(isPageInRange(3, '1-5')).toBe(true);
      expect(isPageInRange(7, '1-5')).toBe(false);
      expect(isPageInRange(12, '1-5, 12')).toBe(true);
    });
  });

  describe('filterPagesByRange', () => {
    const mockPages: ExtractedPageItem[] = [
      { pageNumber: 1, text: 'Title page and preface content' },
      { pageNumber: 2, text: 'Table of contents' },
      { pageNumber: 3, text: 'Introduction to Mechanics' },
      { pageNumber: 4, text: 'Newton first law of motion' },
      { pageNumber: 5, text: 'Newton second law equations' },
      { pageNumber: 6, text: 'Newton third law action reaction' },
      { pageNumber: 7, text: 'Thermodynamics overview' },
    ];

    it('filters strictly to specified page range', () => {
      const filtered = filterPagesByRange(mockPages, '4-6');
      expect(filtered.matchedNumbers).toEqual([4, 5, 6]);
      expect(filtered.matchedPages).toHaveLength(3);
      expect(filtered.rangeLabel).toBe('Pages 4–6');
      expect(filtered.text).toContain('PAGE 4');
      expect(filtered.text).toContain('Newton first law');
      expect(filtered.text).toContain('Newton third law');
      expect(filtered.text).not.toContain('Thermodynamics overview');
      expect(filtered.text).not.toContain('Title page and preface');
    });

    it('filters to a single page', () => {
      const filtered = filterPagesByRange(mockPages, '5');
      expect(filtered.matchedNumbers).toEqual([5]);
      expect(filtered.rangeLabel).toBe('Page 5');
      expect(filtered.text).toContain('Newton second law equations');
      expect(filtered.text).not.toContain('Newton first law');
    });
  });

  describe('filterDelimitedTextByRange', () => {
    const delimited = `
--- [Page 1] ---
Introduction text on page 1
--- [Page 2] ---
Page 2 content about cellular respiration
--- [Page 3] ---
Page 3 content about glycolysis
--- [Page 4] ---
Page 4 content about Krebs cycle
`;

    it('extracts and filters delimited pages', () => {
      const result = filterDelimitedTextByRange(delimited, '2-3');
      expect(result.matchedCount).toBe(2);
      expect(result.rangeLabel).toBe('Pages 2–3');
      expect(result.filteredText).toContain('cellular respiration');
      expect(result.filteredText).toContain('glycolysis');
      expect(result.filteredText).not.toContain('Krebs cycle');
      expect(result.filteredText).not.toContain('Introduction text on page 1');
    });
  });

  describe('filterContentByChapter', () => {
    const bookContent = `
Chapter 1: Foundations
This is chapter 1 basics.

Chapter 2: Kinematics and Motion
Velocity is defined as the rate of change of position. Acceleration is the rate of change of velocity.

Chapter 3: Dynamics and Force
Force equals mass times acceleration.
`;

    it('extracts the specific chapter section and stops before the next chapter', () => {
      const result = filterContentByChapter(bookContent, 'Chapter 2');
      expect(result.chapterFound).toBe(true);
      expect(result.filteredText).toContain('Kinematics and Motion');
      expect(result.filteredText).toContain('Velocity is defined');
      expect(result.filteredText).not.toContain('Chapter 3: Dynamics and Force');
      expect(result.filteredText).not.toContain('This is chapter 1 basics');
    });
  });

  describe('sanitizeResourceDependentWording (Resource-Independent, Concept-Based)', () => {
    it('strips "According to the text, ..."', () => {
      const input = 'According to the text, what are the three key aspects of the scientific definition of psychology?';
      expect(sanitizeResourceDependentWording(input)).toBe('What are the three key aspects of the scientific definition of psychology?');
    });

    it('strips "According to the provided material, ..."', () => {
      const input = 'According to the provided material, what is database normalization?';
      expect(sanitizeResourceDependentWording(input)).toBe('What is database normalization?');
    });

    it('strips "As explained in the document, ..."', () => {
      const input = 'As explained in the document, what is the main function of a process scheduler?';
      expect(sanitizeResourceDependentWording(input)).toBe('What is the main function of a process scheduler?');
    });

    it('strips "According to Chapter 3, ..."', () => {
      const input = 'According to Chapter 3, a primary key uniquely identifies each record in a table.';
      expect(sanitizeResourceDependentWording(input)).toBe('A primary key uniquely identifies each record in a table.');
    });

    it('strips "According to the uploaded note, ..."', () => {
      const input = 'According to the uploaded note, which normal form eliminates partial dependencies?';
      expect(sanitizeResourceDependentWording(input)).toBe('Which normal form eliminates partial dependencies?');
    });

    it('strips "Based on the example in the provided resource, ..."', () => {
      const input = 'Based on the example in the provided resource, which scheduling algorithm should the operating system use?';
      expect(sanitizeResourceDependentWording(input)).toBe('Which scheduling algorithm should the operating system use?');
    });

    it('rewrites "What does the provided note say about X?" to "What is X?"', () => {
      const input = 'What does the provided note say about database indexing?';
      expect(sanitizeResourceDependentWording(input)).toBe('What is database indexing?');
    });

    it('rewrites "Which of the following is stated in the textbook about X?"', () => {
      const input = 'Which of the following is stated in the textbook about cellular respiration?';
      expect(sanitizeResourceDependentWording(input)).toBe('Which of the following is correct regarding cellular respiration?');
    });

    it('strips inline resource dependencies', () => {
      const input = 'A relational database table requires a unique identifier, according to the provided material.';
      expect(sanitizeResourceDependentWording(input)).toBe('A relational database table requires a unique identifier.');
    });
  });
});

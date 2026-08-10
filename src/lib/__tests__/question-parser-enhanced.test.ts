import { describe, it, expect } from 'vitest';
import { 
  parseCSVQuestions, 
  parseJSONQuestions, 
  parseImportData,
  parseQuestions
} from '../question-parser';
import { NewQuestionInput } from '../validations';

describe('Enhanced Question Parser', () => {
  describe('parseCSVQuestions', () => {
    it('should parse MCQ questions from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex,explanation
mcq,What is 2+2?,1,instant,"Four;Two;Three;Five",0,Simple addition
mcq,What is the capital of France?,1,instant,"Paris;Berlin;London;Madrid",0,Geography`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.questions).toHaveLength(2);
      
      const q1 = result.questions[0];
      expect(q1.questionType).toBe('mcq');
      expect(q1.questionText).toBe('What is 2+2?');
      expect(q1.marks).toBe(1);
      if ('options' in q1) {
        expect(q1.options).toEqual(['Four', 'Two', 'Three', 'Five']);
        expect(q1.correctOptionIndex).toBe(0);
      }
    });

    it('should parse True/False questions from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswer,explanation
true-false,Paris is the capital of France,1,instant,true,Correct
true-false,Dogs can fly,1,instant,false,Incorrect`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(2);
      const q1 = result.questions[0];
      expect(q1.questionType).toBe('true-false');
      if ('correctAnswer' in q1) {
        expect(q1.correctAnswer).toBe(true);
      }
    });

    it('should parse Short Answer questions from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswers,caseSensitive,requireExactMatch
short-answer,What is the capital of France?,1,instant,"Paris;Pari",false,false
short-answer,What is 2+2?,1,instant,Four,false,true`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(2);
      const q1 = result.questions[0];
      expect(q1.questionType).toBe('short-answer');
      if ('correctAnswers' in q1) {
        expect(q1.correctAnswers).toContain('Paris');
      }
    });

    it('should parse Essay questions from CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,minWords,maxWords
essay,Describe your favorite book,5,instant,100,500
essay,What is your opinion?,3,instant,,`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(2);
      const q1 = result.questions[0];
      expect(q1.questionType).toBe('essay');
      if ('minWords' in q1) {
        expect(q1.minWords).toBe(100);
        expect(q1.maxWords).toBe(500);
      }
    });

    it('should handle image URLs in CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswer,imageUrl,imageDisplayMode
true-false,Is this a dog?,1,instant,true,https://example.com/image.jpg,main`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(1);
      const q = result.questions[0];
      expect(q.imageUrl).toBe('https://example.com/image.jpg');
      expect(q.imageDisplayMode).toBe('main');
    });

    it('should handle pipe-separated arrays in CSV', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex
mcq,Test?,1,instant,"A|B|C|D",0`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(1);
      if ('options' in result.questions[0]) {
        expect(result.questions[0].options).toEqual(['A', 'B', 'C', 'D']);
      }
    });

    it('should report CSV errors for invalid data', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex
mcq,,1,instant,"A;B",0
mcq,Valid?,1,instant,"A",0
mcq,Valid2?,0,instant,"A;B",0`;

      const result = parseCSVQuestions(csv);

      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('question text'))).toBe(true);
    });

    it('should handle simple quoted CSV fields', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex
mcq,What is testing?,1,instant,"Option A;Option B;Option C",0`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(1);
      expect(result.questions[0].questionText).toBe('What is testing?');
    });
  });

  describe('parseJSONQuestions', () => {
    it('should parse MCQ questions from JSON', () => {
      const json = JSON.stringify([
        {
          questionType: 'mcq',
          questionText: 'What is 2+2?',
          marks: 1,
          feedbackType: 'instant',
          options: ['Four', 'Two', 'Three', 'Five'],
          correctOptionIndex: 0,
          explanation: 'Simple addition'
        },
        {
          questionType: 'mcq',
          questionText: 'What is capital of France?',
          marks: 1,
          options: ['Paris', 'Berlin', 'London'],
          correctOptionIndex: 0
        }
      ]);

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.questions).toHaveLength(2);
    });

    it('should parse True/False questions from JSON', () => {
      const json = JSON.stringify([
        {
          questionType: 'true-false',
          questionText: 'Paris is capital of France',
          marks: 1,
          correctAnswer: true
        }
      ]);

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(1);
      if ('correctAnswer' in result.questions[0]) {
        expect(result.questions[0].correctAnswer).toBe(true);
      }
    });

    it('should parse Short Answer from JSON', () => {
      const json = JSON.stringify([
        {
          questionType: 'short-answer',
          questionText: 'What is capital of France?',
          marks: 1,
          correctAnswers: ['Paris', 'paris', 'PARIS'],
          caseSensitive: false,
          requireExactMatch: true
        }
      ]);

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(1);
      if ('correctAnswers' in result.questions[0]) {
        expect(result.questions[0].correctAnswers.length).toBe(3);
        expect(result.questions[0].caseSensitive).toBe(false);
      }
    });

    it('should parse Essay from JSON', () => {
      const json = JSON.stringify([
        {
          questionType: 'essay',
          questionText: 'Describe your favorite book',
          marks: 5,
          minWords: 100,
          maxWords: 500,
          rubricPoints: [
            { criteria: 'Clarity', points: 2 },
            { criteria: 'Detail', points: 3 }
          ]
        }
      ]);

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(1);
      const q = result.questions[0];
      expect(q.questionType).toBe('essay');
      if ('minWords' in q) {
        expect(q.minWords).toBe(100);
        expect(q.maxWords).toBe(500);
        expect(q.rubricPoints).toHaveLength(2);
      }
    });

    it('should handle invalid JSON', () => {
      const json = '{invalid json}';

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject non-array JSON', () => {
      const json = JSON.stringify({
        questionType: 'mcq',
        questionText: 'Test'
      });

      const result = parseJSONQuestions(json);

      expect(result.successCount).toBe(0);
      expect(result.errors.some(e => e.includes('array'))).toBe(true);
    });
  });

  describe('parseImportData', () => {
    it('should auto-detect and parse JSON format', () => {
      const json = JSON.stringify([
        {
          questionType: 'mcq',
          questionText: 'Test?',
          marks: 1,
          options: ['A', 'B'],
          correctOptionIndex: 0
        }
      ]);

      const result = parseImportData(json);

      expect(result.successCount).toBe(1);
      expect(result.questions[0].questionType).toBe('mcq');
    });

    it('should auto-detect and parse CSV format', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex
mcq,Test?,1,instant,"A;B",0`;

      const result = parseImportData(csv);

      expect(result.successCount).toBe(1);
      expect(result.questions[0].questionType).toBe('mcq');
    });

    it('should fall back to text format for MCQ', () => {
      const text = `1. What is 2+2?
A. Four*
B. Two
C. Three
D. Five`;

      const result = parseImportData(text);

      expect(result.successCount).toBeGreaterThan(0);
      expect(result.questions[0].questionType).toBe('mcq');
    });
  });

  describe('parseQuestions (original text parser)', () => {
    it('should still parse MCQ text format', () => {
      const text = `1. What is 2+2?
A. Four*
B. Two
C. Three
D. Five
Explanation: Simple addition

2. What is capital of France?
A. Berlin
B. Paris*
C. London`;

      const result = parseQuestions(text);

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].correctOptionIndex).toBe(0);
      expect(result.questions[1].correctOptionIndex).toBe(1);
      expect(result.questions[0].explanation).toBe('Simple addition');
    });

    it('should handle various question formats', () => {
      const text = `Q1. Test question?
A. Option A*
B. Option B

Question 2:
a. First option
b. Second option*`;

      const result = parseQuestions(text);

      expect(result.questions.length).toBeGreaterThan(0);
    });
  });

  describe('Mixed Type Imports', () => {
    it('should parse CSV with all question types', () => {
      const csv = `questionType,questionText,marks,feedbackType,options,correctOptionIndex,correctAnswer,correctAnswers,caseSensitive,requireExactMatch,minWords,maxWords
mcq,MCQ test?,1,instant,"A;B;C",0,,,,,,
true-false,TF test?,1,instant,,,true,,,,
short-answer,SA test?,1,instant,,,,"answer;ans",false,true,
essay,Essay test?,5,instant,,,,,,,100,500`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBe(4);
      expect(result.questions[0].questionType).toBe('mcq');
      expect(result.questions[1].questionType).toBe('true-false');
      expect(result.questions[2].questionType).toBe('short-answer');
      expect(result.questions[3].questionType).toBe('essay');
    });

    it('should normalize question type variations', () => {
      const csv = `questionType,questionText,marks,feedbackType,correctAnswer
TRUE-FALSE,Test1?,1,instant,true
true-false,Test2?,1,instant,true
short-answer,Test3?,1,instant,"answer"`;

      const result = parseCSVQuestions(csv);

      expect(result.successCount).toBeGreaterThanOrEqual(2);
      if (result.questions.length >= 2) {
        expect(result.questions[0].questionType).toBe('true-false');
        expect(result.questions[1].questionType).toBe('true-false');
      }
    });
  });
});

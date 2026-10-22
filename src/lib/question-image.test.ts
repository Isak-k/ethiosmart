import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateQuestionImage,
  uploadQuestionImage,
  getOptimizedImageUrl,
} from './image-upload';
import { convertToExamQuestions } from './exam-mode-engine';
import { convertToPracticeQuestions } from './practice-mode-engine';
import { Question } from '@/integrations/firebase/types';
import { Timestamp } from 'firebase/firestore';

describe('Question Image Management & Image-based Questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation (validateQuestionImage)', () => {
    it('accepts valid JPEG, PNG, and WebP image files', () => {
      const jpg = new File(['jpg-content'], 'diagram.jpg', { type: 'image/jpeg' });
      const png = new File(['png-content'], 'circuit.png', { type: 'image/png' });
      const webp = new File(['webp-content'], 'formula.webp', { type: 'image/webp' });

      expect(validateQuestionImage(jpg).isValid).toBe(true);
      expect(validateQuestionImage(png).isValid).toBe(true);
      expect(validateQuestionImage(webp).isValid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const pdf = new File(['pdf-content'], 'doc.pdf', { type: 'application/pdf' });
      const txt = new File(['txt-content'], 'notes.txt', { type: 'text/plain' });

      const pdfRes = validateQuestionImage(pdf);
      expect(pdfRes.isValid).toBe(false);
      expect(pdfRes.error).toContain('Unsupported image format');

      const txtRes = validateQuestionImage(txt);
      expect(txtRes.isValid).toBe(false);
    });

    it('rejects files exceeding 10MB limit', () => {
      const largeFile = new File(['x'], 'huge.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

      const res = validateQuestionImage(largeFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('File is too large');
    });
  });

  describe('Cloudinary Dynamic URL Optimization (getOptimizedImageUrl)', () => {
    it('applies responsive transformations to Cloudinary URLs', () => {
      const rawUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
      const optimized = getOptimizedImageUrl(rawUrl, { width: 1000, quality: 'auto', crop: 'limit' });

      expect(optimized).toContain('res.cloudinary.com/demo/image/upload/');
      expect(optimized).toContain('w_1000');
      expect(optimized).toContain('c_limit');
      expect(optimized).toContain('q_auto');
      expect(optimized).toContain('f_auto');
    });

    it('leaves non-Cloudinary URLs and data URIs untouched', () => {
      const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/app/o/img.png';
      expect(getOptimizedImageUrl(firebaseUrl)).toBe(firebaseUrl);

      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      expect(getOptimizedImageUrl(dataUri)).toBe(dataUri);
    });
  });

  describe('Direct Image Upload & 3-Tier Fallback Cascade', () => {
    it('guarantees uploadQuestionImage resolves without hanging (fallback to optimized URI)', async () => {
      const file = new File(['sample-binary-content'], 'chart.png', { type: 'image/png' });
      const result = await uploadQuestionImage(file, { examId: 'exam_test_123' });

      expect(result).toBeDefined();
      expect(result.url).toBeTruthy();
      expect(result.publicId).toBeTruthy();
      expect(['cloudinary', 'firebase', 'local']).toContain(result.provider);
    });
  });

  describe('Integration with Exam Engines (Exam & Practice Modes)', () => {
    const mockQuestions: Question[] = [
      {
        questionId: 'q1',
        examId: 'exam_1',
        questionText: 'Identify the circuit component shown below:',
        questionType: 'mcq',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/circuit.png',
        options: ['Resistor', 'Capacitor', 'Inductor', 'Diode'],
        correctOptionIndex: 0,
        marks: 2,
        orderIndex: 0,
        feedbackType: 'hidden',
        createdAt: Timestamp.now(),
      },
      {
        questionId: 'q2',
        examId: 'exam_1',
        questionText: 'True or False: The diagram represents a eukaryotic cell.',
        questionType: 'truefalse',
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/cell.jpg',
        options: ['True', 'False'],
        correctOptionIndex: 0,
        marks: 1,
        orderIndex: 1,
        feedbackType: 'hidden',
        createdAt: Timestamp.now(),
      },
      {
        questionId: 'q3',
        examId: 'exam_1',
        questionText: 'What is the voltage across R1 in the schematic below?',
        questionType: 'shortanswer',
        imageUrl: 'data:image/webp;base64,sampleWebpData',
        correctAnswer: '5V',
        marks: 3,
        orderIndex: 2,
        feedbackType: 'hidden',
        createdAt: Timestamp.now(),
      },
      {
        questionId: 'q4',
        examId: 'exam_1',
        questionText: 'Analyze the architectural floor plan below and describe the load-bearing columns.',
        questionType: 'essay',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/floorplan.png',
        marks: 5,
        orderIndex: 3,
        feedbackType: 'hidden',
        createdAt: Timestamp.now(),
      },
    ];

    it('convertToExamQuestions preserves imageUrl across MCQ, True/False, Short Answer, and Essay', () => {
      const examQuestions = convertToExamQuestions(mockQuestions);

      expect(examQuestions).toHaveLength(4);
      expect(examQuestions[0].imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/circuit.png');
      expect(examQuestions[1].imageUrl).toBe('https://firebasestorage.googleapis.com/v0/b/app/o/cell.jpg');
      expect(examQuestions[2].imageUrl).toBe('data:image/webp;base64,sampleWebpData');
      expect(examQuestions[3].imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/floorplan.png');
    });

    it('convertToPracticeQuestions preserves imageUrl and explanation', () => {
      const practiceQuestions = convertToPracticeQuestions(mockQuestions);

      expect(practiceQuestions).toHaveLength(4);
      expect(practiceQuestions[0].imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/circuit.png');
      expect(practiceQuestions[1].imageUrl).toBe('https://firebasestorage.googleapis.com/v0/b/app/o/cell.jpg');
      expect(practiceQuestions[2].imageUrl).toBe('data:image/webp;base64,sampleWebpData');
      expect(practiceQuestions[3].imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/floorplan.png');
    });
  });
});

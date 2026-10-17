import { TFunction } from "i18next";

export type QuestionType = 'mcq' | 'truefalse' | 'shortanswer' | 'essay' | 'auto';

export interface ParsedQuestion {
  questionText: string;
  questionType: 'mcq' | 'truefalse' | 'shortanswer' | 'essay';
  options: string[];
  correctOptionIndex: number;
  correctAnswer?: string;
  explanation?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

/**
 * Parses raw text containing questions of various types.
 * Supports MCQ, True/False, Short Answer, and Essay.
 * 
 * @param text The raw text input
 * @param t Optional i18next TFunction for localized error messages
 * @param forcedType Optional type to force all questions to (defaults to 'auto')
 * @returns Object containing parsed questions and any error messages
 */
export function parseQuestions(text: string, t?: TFunction, forcedType: QuestionType = 'auto'): ParseResult {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  
  let currentQuestionText = "";
  let currentOptions: string[] = [];
  let currentCorrectIndex = -1;
  let currentCorrectAnswer = "";
  let currentExplanation = "";
  let questionCounter = 0;
  let answerLineFound = false;
  let explanationLineFound = false;

  // Regex patterns
  const questionStartRegex = /^(?:Q|Question|Q\.)?\s*(\d+)[\.:\)\-\s]\s*(.+)/i;
  const optionRegex = /^\s*\(?([a-zA-Z])\)?[.:\)\-\s]\s*(.+)/;
  const answerLineRegex = /^(?:Answer|Ans|Correct)\s*[:\-\s]\s*(.+)/i;
  const explanationLineRegex = /^(?:Explanation|Exp|Reason)\s*[:\-\s]\s*(.+)/i;

  const detectType = (options: string[], answer: string): 'mcq' | 'truefalse' | 'shortanswer' | 'essay' => {
    if (forcedType !== 'auto') return forcedType as any;

    if (options.length > 0) {
      if (options.length === 2) {
        const opt1 = options[0].toLowerCase();
        const opt2 = options[1].toLowerCase();
        if ((opt1 === 'true' && opt2 === 'false') || (opt1 === 'false' && opt2 === 'true') ||
            (opt1 === 'yes' && opt2 === 'no') || (opt1 === 'no' && opt2 === 'yes')) {
          return 'truefalse';
        }
      }
      return 'mcq';
    }
    
    if (answer && answer.trim().length > 0) {
      return 'shortanswer';
    }
    
    return 'essay';
  };

  const saveCurrentQuestion = () => {
    if (questionCounter > 0) {
      if (!currentQuestionText) {
        if (t) errors.push(t("admin.exams.bulkImport.errors.missingText", { n: questionCounter }));
        else errors.push(`Question ${questionCounter}: Missing question text.`);
      } else {
        const type = detectType(currentOptions, currentCorrectAnswer);
        
        // Validation based on type
        let isValid = true;
        if ((type === 'mcq' || type === 'truefalse') && currentOptions.length < 2) {
          if (t) errors.push(t("admin.exams.bulkImport.errors.minOptions", { n: questionCounter }));
          else errors.push(`Question ${questionCounter}: MCQ/TrueFalse must have at least 2 options.`);
          isValid = false;
        } else if ((type === 'mcq' || type === 'truefalse') && currentCorrectIndex === -1) {
          // Try to find index from currentCorrectAnswer if it was a letter (A, B, C...)
          if (currentCorrectAnswer && currentCorrectAnswer.length === 1) {
            const char = currentCorrectAnswer.toUpperCase();
            const idx = char.charCodeAt(0) - 65;
            if (idx >= 0 && idx < currentOptions.length) {
              currentCorrectIndex = idx;
            }
          }
          
          if (currentCorrectIndex === -1) {
            if (t) errors.push(t("admin.exams.bulkImport.errors.noCorrect", { n: questionCounter }));
            else errors.push(`Question ${questionCounter}: No correct answer detected for MCQ/TrueFalse.`);
            isValid = false;
          }
        } else if (type === 'shortanswer' && !currentCorrectAnswer.trim()) {
          errors.push(`Question ${questionCounter}: Short Answer must have a reference answer.`);
          isValid = false;
        }

        if (isValid) {
          let cleanExplanation = currentExplanation.trim();
          if (cleanExplanation.startsWith('"') && cleanExplanation.endsWith('"')) {
            cleanExplanation = cleanExplanation.slice(1, -1);
          }

          questions.push({
            questionText: currentQuestionText,
            questionType: type,
            options: type === 'mcq' || type === 'truefalse' ? [...currentOptions] : [],
            correctOptionIndex: type === 'mcq' || type === 'truefalse' ? currentCorrectIndex : 0,
            correctAnswer: type === 'shortanswer' ? currentCorrectAnswer.trim() : undefined,
            explanation: cleanExplanation || undefined
          });
        }
      }
    }
    // Reset
    currentQuestionText = "";
    currentOptions = [];
    currentCorrectIndex = -1;
    currentCorrectAnswer = "";
    currentExplanation = "";
    answerLineFound = false;
    explanationLineFound = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Question Start
    const questionMatch = line.match(questionStartRegex);
    if (questionMatch) {
      saveCurrentQuestion();
      questionCounter++;
      currentQuestionText = questionMatch[2].trim();
      continue;
    }

    // Check for Explanation Line
    const explanationMatch = line.match(explanationLineRegex);
    if (explanationMatch) {
      currentExplanation = explanationMatch[1].trim();
      explanationLineFound = true;
      continue;
    }

    // Check for Answer Line
    const answerMatch = line.match(answerLineRegex);
    if (answerMatch) {
      currentCorrectAnswer = answerMatch[1].trim();
      answerLineFound = true;
      continue;
    }

    // Check for Option Line
    const optionMatch = line.match(optionRegex);
    if (optionMatch) {
      let optionText = optionMatch[2].trim();
      if (optionText.endsWith('*')) {
        optionText = optionText.slice(0, -1).trim();
        currentCorrectIndex = currentOptions.length;
      }
      currentOptions.push(optionText);
      continue;
    }

    // Fallback: Multiline handling
    if (questionCounter > 0) {
      if (explanationLineFound) {
        currentExplanation += " " + line;
      } else if (answerLineFound) {
        // Continue answer text for short answers
        currentCorrectAnswer += " " + line;
      } else if (currentOptions.length === 0) {
        currentQuestionText += " " + line;
      } else {
        const lastIndex = currentOptions.length - 1;
        if (lastIndex >= 0) {
           currentOptions[lastIndex] += " " + line;
        }
      }
    }
  }

  saveCurrentQuestion();

  if (questions.length === 0 && errors.length === 0) {
    if (lines.length > 0) {
      errors.push("No questions detected. Please ensure your questions are numbered (e.g., '1. Question Text').");
    } else {
      errors.push("Input is empty.");
    }
  }

  return { questions, errors };
}

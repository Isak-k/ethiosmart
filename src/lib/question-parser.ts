import { TFunction } from "i18next";
import { NewQuestionInput } from "./validations";

export interface ParsedQuestion {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

export interface ImportParseResult {
  questions: NewQuestionInput[];
  errors: string[];
  successCount: number;
  errorCount: number;
}

/**
 * Parses raw text containing multiple choice questions.
 * Supports flexible formats for question numbers and options.
 * 
 * @param text The raw text input
 * @param t Optional i18next TFunction for localized error messages
 * @returns Object containing parsed questions and any error messages
 */
export function parseQuestions(text: string, t?: TFunction): ParseResult {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  
  let currentQuestionText = "";
  let currentOptions: string[] = [];
  let currentCorrectIndex = -1;
  let currentTrueFalseAnswer: boolean | null = null;
  let currentExplanation = "";
  let questionCounter = 0;
  let answerLineFound = false;
  let explanationLineFound = false;
  let isTrueFalseQuestion = false;

  // Regex patterns
  // Flexible Question Start: Matches "1.", "1)", "1-", "1 ", "Q1.", "Question 1:"
  // Also handles "1. " and "1." (if text immediately follows)
  const questionStartRegex = /^(?:Q|Question|Q\.)?\s*(\d+)[\.:\)\-\s]\s*(.+)/i;
  
  // Flexible Option Start: Matches "A.", "a)", "A-", "(A)", "A "
  // Captures the letter in group 1, and the text in group 2
  const optionRegex = /^\s*\(?([a-zA-Z])\)?[.:\)\-\s]\s*(.+)/;
  
  // Flexible Answer Line: Matches "Answer: A", "Ans - A", "Correct: A", "Answer A"
  // Also matches "Answer: True/False"
  const answerLineRegex = /^(?:Answer|Ans|Correct)\s*[:\-\s]\s*(.+)/i;

  // Flexible Explanation Line: Matches "Explanation: ...", "Exp: ...", "Reason: ..."
  // Captures the explanation text in group 1
  const explanationLineRegex = /^(?:Explanation|Exp|Reason)\s*[:\-\s]\s*(.+)/i;

  const saveCurrentQuestion = () => {
    if (questionCounter > 0) {
      if (!currentQuestionText) {
        if (t) errors.push(t("admin.exams.bulkImport.errors.missingText", { n: questionCounter }));
        else errors.push(`Question ${questionCounter}: Missing question text.`);
      } else if (isTrueFalseQuestion) {
        // True/False question validation
        if (currentTrueFalseAnswer === null) {
          if (t) errors.push(t("admin.exams.bulkImport.errors.noCorrect", { n: questionCounter }));
          else errors.push(`Question ${questionCounter}: No True/False answer detected.`);
        } else {
          // Remove quotes from explanation if present
          let cleanExplanation = currentExplanation.trim();
          if (cleanExplanation.startsWith('"') && cleanExplanation.endsWith('"')) {
            cleanExplanation = cleanExplanation.slice(1, -1);
          }

          questions.push({
            questionText: currentQuestionText,
            questionType: 'true-false',
            correctAnswer: currentTrueFalseAnswer,
            explanation: cleanExplanation || undefined
          } as any); // Cast because ParsedQuestion doesn't include true-false type
        }
      } else if (currentOptions.length < 2) {
        if (t) errors.push(t("admin.exams.bulkImport.errors.minOptions", { n: questionCounter }));
        else errors.push(`Question ${questionCounter}: Must have at least 2 options.`);
      } else if (currentCorrectIndex === -1) {
        if (t) errors.push(t("admin.exams.bulkImport.errors.noCorrect", { n: questionCounter }));
        else errors.push(`Question ${questionCounter}: No correct answer detected. Use '*' or 'Answer: X'.`);
      } else if (currentCorrectIndex >= currentOptions.length) {
        if (t) errors.push(t("admin.exams.bulkImport.errors.indexBounds", { n: questionCounter }));
        else errors.push(`Question ${questionCounter}: Correct answer index out of bounds.`);
      } else {
        // Remove quotes from explanation if present
        let cleanExplanation = currentExplanation.trim();
        if (cleanExplanation.startsWith('"') && cleanExplanation.endsWith('"')) {
          cleanExplanation = cleanExplanation.slice(1, -1);
        }

        questions.push({
          questionText: currentQuestionText,
          options: [...currentOptions],
          correctOptionIndex: currentCorrectIndex,
          explanation: cleanExplanation || undefined
        });
      }
    }
    // Reset
    currentQuestionText = "";
    currentOptions = [];
    currentCorrectIndex = -1;
    currentTrueFalseAnswer = null;
    currentExplanation = "";
    isTrueFalseQuestion = false;
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

    // Check for Answer Line (e.g., "Answer: B" or "Answer: True")
    const answerMatch = line.match(answerLineRegex);
    if (answerMatch) {
      const answerText = answerMatch[1].trim();
      
      // Check if it's a True/False answer
      if (answerText.toLowerCase() === 'true' || answerText.toLowerCase() === 'false') {
        currentTrueFalseAnswer = answerText.toLowerCase() === 'true';
        isTrueFalseQuestion = true;
      } else {
        // It's an MCQ answer (letter)
        const answerChar = answerText.toUpperCase().charAt(0);
        if (/^[A-Z]$/.test(answerChar)) {
          const answerIndex = answerChar.charCodeAt(0) - 65; // 'A' -> 0
          currentCorrectIndex = answerIndex;
        }
      }
      answerLineFound = true;
      continue;
    }

    // Check for Option Line
    const optionMatch = line.match(optionRegex);
    if (optionMatch) {
      let optionText = optionMatch[2].trim();
      
      // Check for inline '*' indicating correct answer
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
        // Continuation of Explanation
        currentExplanation += " " + line;
      } else if (answerLineFound) {
        // Ignore lines after answer unless it's an explanation (handled above)
        // or a new question (handled above)
      } else if (currentOptions.length === 0) {
        // Continuation of Question Text
        currentQuestionText += " " + line;
      } else {
        // Continuation of Last Option (only if "Answer:" line not yet found)
        const lastIndex = currentOptions.length - 1;
        if (lastIndex >= 0) {
           currentOptions[lastIndex] += " " + line;
        }
      }
    }
  }

  // Save the last question
  saveCurrentQuestion();

  // Add a helpful error if nothing was found
  if (questions.length === 0 && errors.length === 0) {
    if (lines.length > 0) {
      errors.push("No questions detected. Please ensure your questions are numbered (e.g., '1. Question Text').");
    } else {
      errors.push("Input is empty.");
    }
  }

  return { questions, errors };
}


/**
 * Parse CSV-formatted import data with support for all question types
 * CSV headers should include: questionType, questionText, marks, feedbackType, ...
 * Type-specific headers: options, correctOptionIndex (MCQ), correctAnswer (True/False),
 * correctAnswers, caseSensitive, requireExactMatch (Short Answer), minWords, maxWords (Essay)
 */
export function parseCSVQuestions(
  csvText: string,
  t?: TFunction
): ImportParseResult {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 2) {
    return {
      questions: [],
      errors: ['CSV must contain at least a header row and one data row'],
      successCount: 0,
      errorCount: 0
    };
  }

  const headers = parseCSVLine(lines[0]);
  const questions: NewQuestionInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowData = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = rowData[index] || '';
    });

    try {
      const question = parseCSVRow(row, i + 1, t);
      if (question) {
        questions.push(question);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Row ${i + 1}: ${errorMsg}`);
    }
  }

  return {
    questions,
    errors,
    successCount: questions.length,
    errorCount: errors.length
  };
}

/**
 * Parse a single CSV row into a NewQuestionInput
 */
function parseCSVRow(
  row: Record<string, string>,
  rowNumber: number,
  t?: TFunction
): NewQuestionInput | null {
  let questionType = (row.questionType || 'mcq').toLowerCase().trim();
  // Normalize type names
  questionType = questionType.replace(/\s+/g, '-').replace(/case$/i, '');
  
  const questionText = (row.questionText || '').trim();
  const marks = parseInt(row.marks || '1');
  const feedbackType = (row.feedbackType || 'hidden') as 'instant' | 'hidden';
  const explanation = (row.explanation || '').trim() || undefined;

  if (!questionText) {
    throw new Error('Missing question text');
  }

  if (isNaN(marks) || marks < 1 || marks > 100) {
    throw new Error('Marks must be a number between 1 and 100');
  }

  // Parse based on question type
  switch (questionType) {
    case 'mcq':
      return parseCSVMCQ(row, questionText, marks, feedbackType, explanation);
    
    case 'true-false':
    case 'truefalse':
      return parseCSVTrueFalse(row, questionText, marks, feedbackType, explanation);
    
    case 'short-answer':
    case 'shortanswer':
      return parseCSVShortAnswer(row, questionText, marks, feedbackType, explanation);
    
    case 'essay':
      return parseCSVEssay(row, questionText, marks, feedbackType, explanation);
    
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

function parseCSVMCQ(
  row: Record<string, string>,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation?: string
): NewQuestionInput {
  const optionsStr = row.options || '';
  const options = parseCSVArray(optionsStr);
  
  if (options.length < 2) {
    throw new Error('MCQ must have at least 2 options');
  }

  const correctOptionIndex = parseInt(row.correctOptionIndex || '-1');
  if (isNaN(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    throw new Error(`Correct option index must be between 0 and ${options.length - 1}`);
  }

  const imageUrl = (row.imageUrl || '').trim() || undefined;
  const imageDisplayMode = (row.imageDisplayMode as 'inline' | 'background' | 'main' | undefined) || 'inline';

  return {
    questionType: 'mcq',
    questionText,
    marks,
    feedbackType,
    explanation,
    options,
    correctOptionIndex,
    imageUrl,
    imageDisplayMode
  };
}

function parseCSVTrueFalse(
  row: Record<string, string>,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation?: string
): NewQuestionInput {
  const correctAnswerStr = (row.correctAnswer || '').toLowerCase().trim();
  const correctAnswer = correctAnswerStr === 'true' || correctAnswerStr === '1' || correctAnswerStr === 'yes';

  const imageUrl = (row.imageUrl || '').trim() || undefined;
  const imageDisplayMode = (row.imageDisplayMode as 'inline' | 'background' | 'main' | undefined) || 'inline';

  return {
    questionType: 'true-false',
    questionText,
    marks,
    feedbackType,
    explanation,
    correctAnswer,
    imageUrl,
    imageDisplayMode
  };
}

function parseCSVShortAnswer(
  row: Record<string, string>,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation?: string
): NewQuestionInput {
  const correctAnswersStr = row.correctAnswers || '';
  const correctAnswers = parseCSVArray(correctAnswersStr);
  
  if (correctAnswers.length < 1) {
    throw new Error('Short answer must have at least one acceptable answer');
  }

  const caseSensitive = (row.caseSensitive || 'false').toLowerCase() === 'true';
  const requireExactMatch = (row.requireExactMatch || 'false').toLowerCase() === 'true';

  const imageUrl = (row.imageUrl || '').trim() || undefined;
  const imageDisplayMode = (row.imageDisplayMode as 'inline' | 'background' | 'main' | undefined) || 'inline';

  return {
    questionType: 'short-answer',
    questionText,
    marks,
    feedbackType,
    explanation,
    correctAnswers,
    caseSensitive,
    requireExactMatch,
    imageUrl,
    imageDisplayMode
  };
}

function parseCSVEssay(
  row: Record<string, string>,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation?: string
): NewQuestionInput {
  const minWords = row.minWords ? parseInt(row.minWords) : undefined;
  const maxWords = row.maxWords ? parseInt(row.maxWords) : undefined;

  if (minWords && isNaN(minWords)) {
    throw new Error('Min words must be a valid number');
  }
  if (maxWords && isNaN(maxWords)) {
    throw new Error('Max words must be a valid number');
  }
  if (minWords && maxWords && minWords > maxWords) {
    throw new Error('Min words cannot exceed max words');
  }

  const rubricPointsStr = row.rubricPoints || '';
  const rubricPoints = parseRubricPoints(rubricPointsStr);

  const imageUrl = (row.imageUrl || '').trim() || undefined;
  const imageDisplayMode = (row.imageDisplayMode as 'inline' | 'background' | 'main' | undefined) || 'inline';

  return {
    questionType: 'essay',
    questionText,
    marks,
    feedbackType,
    explanation,
    minWords,
    maxWords,
    rubricPoints: rubricPoints.length > 0 ? rubricPoints : undefined,
    imageUrl,
    imageDisplayMode
  };
}

/**
 * Parse CSV-formatted array field (semicolon or pipe separated)
 * Example: "Option A;Option B;Option C" or "Option A|Option B|Option C"
 */
function parseCSVArray(arrayStr: string): string[] {
  if (!arrayStr) return [];
  
  const separator = arrayStr.includes(';') ? ';' : '|';
  return arrayStr.split(separator).map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Parse rubric points from CSV format
 * Example: "criteria1:5;criteria2:3" -> [{criteria: "criteria1", points: 5}, {criteria: "criteria2", points: 3}]
 */
function parseRubricPoints(rubricStr: string): Array<{criteria: string; points: number}> {
  if (!rubricStr) return [];
  
  const items = rubricStr.split(';').map(item => item.trim());
  const result: Array<{criteria: string; points: number}> = [];
  
  for (const item of items) {
    const [criteria, pointsStr] = item.split(':').map(s => s.trim());
    if (criteria && pointsStr) {
      const points = parseInt(pointsStr);
      if (!isNaN(points) && points > 0) {
        result.push({ criteria, points });
      }
    }
  }
  
  return result;
}

/**
 * Parse a single line from CSV, handling quoted fields properly
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Trim and remove outer quotes if present
      let trimmed = current.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.slice(1, -1);
      }
      result.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Handle last field
  let trimmed = current.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1);
  }
  result.push(trimmed);
  return result;
}

/**
 * Parse JSON-formatted import data with support for all question types
 * Expects an array of question objects with questionType discriminator
 */
export function parseJSONQuestions(
  jsonText: string,
  t?: TFunction
): ImportParseResult {
  let jsonData: any;
  
  try {
    jsonData = JSON.parse(jsonText);
  } catch (error) {
    return {
      questions: [],
      errors: ['Invalid JSON format. Please check your input.'],
      successCount: 0,
      errorCount: 0
    };
  }

  if (!Array.isArray(jsonData)) {
    return {
      questions: [],
      errors: ['JSON must be an array of question objects.'],
      successCount: 0,
      errorCount: 0
    };
  }

  const questions: NewQuestionInput[] = [];
  const errors: string[] = [];

  for (let i = 0; i < jsonData.length; i++) {
    try {
      const question = parseJSONObject(jsonData[i], i + 1, t);
      if (question) {
        questions.push(question);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Question ${i + 1}: ${errorMsg}`);
    }
  }

  return {
    questions,
    errors,
    successCount: questions.length,
    errorCount: errors.length
  };
}

/**
 * Parse a single JSON object into a NewQuestionInput
 */
function parseJSONObject(
  obj: any,
  index: number,
  t?: TFunction
): NewQuestionInput | null {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Must be an object');
  }

  const questionType = (obj.questionType || 'mcq').toLowerCase().trim();
  const questionText = (obj.questionText || '').trim();
  const marks = typeof obj.marks === 'number' ? obj.marks : 1;
  const feedbackType = (obj.feedbackType || 'hidden') as 'instant' | 'hidden';
  const explanation = obj.explanation ? String(obj.explanation).trim() : undefined;

  if (!questionText) {
    throw new Error('Missing question text');
  }

  if (isNaN(marks) || marks < 1 || marks > 100) {
    throw new Error('Marks must be a number between 1 and 100');
  }

  const imageUrl = obj.imageUrl ? String(obj.imageUrl).trim() : undefined;
  const imageDisplayMode = (obj.imageDisplayMode || 'inline') as 'inline' | 'background' | 'main';

  // Parse based on question type
  switch (questionType) {
    case 'mcq':
      return parseJSONMCQ(obj, questionText, marks, feedbackType, explanation, imageUrl, imageDisplayMode);
    
    case 'true-false':
    case 'truefalse':
      return parseJSONTrueFalse(obj, questionText, marks, feedbackType, explanation, imageUrl, imageDisplayMode);
    
    case 'short-answer':
    case 'shortanswer':
      return parseJSONShortAnswer(obj, questionText, marks, feedbackType, explanation, imageUrl, imageDisplayMode);
    
    case 'essay':
      return parseJSONEssay(obj, questionText, marks, feedbackType, explanation, imageUrl, imageDisplayMode);
    
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

function parseJSONMCQ(
  obj: any,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation: string | undefined,
  imageUrl: string | undefined,
  imageDisplayMode: 'inline' | 'background' | 'main'
): NewQuestionInput {
  const options = Array.isArray(obj.options) 
    ? obj.options.map(o => String(o).trim()).filter(o => o.length > 0)
    : [];
  
  if (options.length < 2) {
    throw new Error('MCQ must have at least 2 options');
  }

  const correctOptionIndex = typeof obj.correctOptionIndex === 'number' ? obj.correctOptionIndex : -1;
  if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    throw new Error(`Correct option index must be between 0 and ${options.length - 1}`);
  }

  return {
    questionType: 'mcq',
    questionText,
    marks,
    feedbackType,
    explanation,
    options,
    correctOptionIndex,
    imageUrl,
    imageDisplayMode
  };
}

function parseJSONTrueFalse(
  obj: any,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation: string | undefined,
  imageUrl: string | undefined,
  imageDisplayMode: 'inline' | 'background' | 'main'
): NewQuestionInput {
  if (typeof obj.correctAnswer !== 'boolean') {
    throw new Error('Correct answer must be a boolean (true or false)');
  }

  return {
    questionType: 'true-false',
    questionText,
    marks,
    feedbackType,
    explanation,
    correctAnswer: obj.correctAnswer,
    imageUrl,
    imageDisplayMode
  };
}

function parseJSONShortAnswer(
  obj: any,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation: string | undefined,
  imageUrl: string | undefined,
  imageDisplayMode: 'inline' | 'background' | 'main'
): NewQuestionInput {
  const correctAnswers = Array.isArray(obj.correctAnswers)
    ? obj.correctAnswers.map(a => String(a).trim()).filter(a => a.length > 0)
    : [];
  
  if (correctAnswers.length < 1) {
    throw new Error('Short answer must have at least one acceptable answer');
  }

  const caseSensitive = obj.caseSensitive === true;
  const requireExactMatch = obj.requireExactMatch === true;

  return {
    questionType: 'short-answer',
    questionText,
    marks,
    feedbackType,
    explanation,
    correctAnswers,
    caseSensitive,
    requireExactMatch,
    imageUrl,
    imageDisplayMode
  };
}

function parseJSONEssay(
  obj: any,
  questionText: string,
  marks: number,
  feedbackType: 'instant' | 'hidden',
  explanation: string | undefined,
  imageUrl: string | undefined,
  imageDisplayMode: 'inline' | 'background' | 'main'
): NewQuestionInput {
  const minWords = typeof obj.minWords === 'number' && obj.minWords > 0 ? obj.minWords : undefined;
  const maxWords = typeof obj.maxWords === 'number' && obj.maxWords > 0 ? obj.maxWords : undefined;

  if (minWords && maxWords && minWords > maxWords) {
    throw new Error('Min words cannot exceed max words');
  }

  let rubricPoints: Array<{criteria: string; points: number}> | undefined;
  if (Array.isArray(obj.rubricPoints)) {
    rubricPoints = obj.rubricPoints
      .filter(r => r && typeof r === 'object' && r.criteria && r.points)
      .map(r => ({
        criteria: String(r.criteria).trim(),
        points: Number(r.points)
      }))
      .filter(r => r.points > 0 && r.criteria.length > 0);
    
    if (rubricPoints.length === 0) {
      rubricPoints = undefined;
    }
  }

  return {
    questionType: 'essay',
    questionText,
    marks,
    feedbackType,
    explanation,
    minWords,
    maxWords,
    rubricPoints,
    imageUrl,
    imageDisplayMode
  };
}

/**
 * Auto-detect import format and parse accordingly
 * Supports text (MCQ), CSV, and JSON formats
 */
export function parseImportData(
  text: string,
  t?: TFunction
): ImportParseResult {
  const trimmed = text.trim();
  
  // Try JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const result = parseJSONQuestions(trimmed, t);
      if (result.questions.length > 0 || result.errors.length > 0) {
        return result;
      }
    } catch (error) {
      // Fall through to try CSV or text
    }
  }

  // Check if looks like CSV (has commas and headers)
  const firstLine = trimmed.split('\n')[0];
  const hasCSVHeaders = firstLine.includes('questionType') || 
                       firstLine.includes('questionText') ||
                       firstLine.toLowerCase().includes('type');
  
  if (hasCSVHeaders && firstLine.includes(',')) {
    const result = parseCSVQuestions(trimmed, t);
    if (result.questions.length > 0 || result.errors.length > 0) {
      return result;
    }
  }

  // Fall back to original text parser for MCQ and True/False format
  const textResult = parseQuestions(trimmed, t);
  return {
    questions: textResult.questions.map(q => {
      // If it's already a true-false question with questionType set
      if ('questionType' in q && q.questionType === 'true-false') {
        return {
          questionType: 'true-false' as const,
          questionText: q.questionText,
          correctAnswer: (q as any).correctAnswer,
          marks: 1,
          feedbackType: 'hidden' as const,
          explanation: q.explanation
        };
      }
      
      // Otherwise it's MCQ
      return {
        questionType: 'mcq' as const,
        questionText: q.questionText,
        options: (q as any).options,
        correctOptionIndex: (q as any).correctOptionIndex,
        marks: 1,
        feedbackType: 'hidden' as const,
        explanation: q.explanation
      };
    }),
    errors: textResult.errors,
    successCount: textResult.questions.length,
    errorCount: textResult.errors.length
  };
}

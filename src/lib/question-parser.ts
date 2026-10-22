export type QuestionType = 'mcq' | 'truefalse' | 'shortanswer';

export interface ParsedOption {
  label: string;
  text: string;
  delimiter: string;
}

export interface ParsedQuestion {
  sourceNumber: number;
  questionText: string;
  questionType: QuestionType;
  detectedType: QuestionType;
  options: ParsedOption[];
  answer: string;
  explanation: string;
  correctOptionIndex: number;
  sourceErrors: string[];
  errors: string[];
  imageUrl?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
  imageUrl?: string;
}

const questionHeadingRegex = /^\s*(\d+)\.\s*(.*)$/;
const answerFieldRegex = /^\s*Answer\s*:\s*(.*)$/i;
const explanationFieldRegex = /^\s*Explanation\s*:\s*(.*)$/i;
const optionLineRegex = /^\s*([A-Za-z])([.):\-])(?:[ \t]+(.*))?\s*$/;
const anyFieldRegex = /^\s*([A-Za-z][A-Za-z _-]*)\s*:/;

function hasQuestionStructure(lines: string[], start: number, end: number): boolean {
  return lines.slice(start + 1, end).some((line) =>
    answerFieldRegex.test(line) ||
    explanationFieldRegex.test(line) ||
    optionLineRegex.test(line)
  );
}

function hasCompleteQuestionFields(lines: string[], start: number, end: number): boolean {
  const blockLines = lines.slice(start + 1, end);
  return blockLines.some((line) => answerFieldRegex.test(line)) &&
    blockLines.some((line) => explanationFieldRegex.test(line));
}

function joinContent(lines: string[]): string {
  return lines.join('\n').trim();
}

export function validateParsedQuestion(question: ParsedQuestion): ParsedQuestion {
  const errors = [...question.sourceErrors];
  const answer = question.answer.trim();
  const isBooleanAnswer = /^(true|false)$/i.test(answer);
  let correctOptionIndex = -1;

  if (!question.questionText.trim()) errors.push('Question text is required.');
  if (!answer) errors.push('Answer is required.');
  if (!question.explanation.trim()) errors.push('Explanation is required.');

  if (question.questionType === 'mcq') {
    if (question.options.length !== 4) {
      errors.push('MCQ must contain exactly four options: A, B, C, and D.');
    }

    for (const label of ['A', 'B', 'C', 'D']) {
      const count = question.options.filter((option) => option.label === label).length;
      if (count === 0) errors.push(`MCQ option ${label} is missing.`);
      if (count > 1) errors.push(`MCQ option ${label} is duplicated.`);
    }

    question.options.forEach((option) => {
      if (!['A', 'B', 'C', 'D'].includes(option.label)) {
        errors.push(`Option label "${option.label}" is invalid; use A, B, C, or D.`);
      }
      if (option.delimiter !== '.') errors.push(`Option ${option.label} must use the format "${option.label}. text".`);
      if (!option.text.trim()) errors.push(`Option ${option.label} must not be empty.`);
    });

    if (!/^[A-D]$/i.test(answer)) {
      errors.push('MCQ answer must be exactly one option label: A, B, C, or D.');
    } else {
      correctOptionIndex = question.options.findIndex((option) => option.label === answer.toUpperCase());
    }
  } else if (question.questionType === 'truefalse') {
    if (question.options.length > 0) errors.push('True/False questions must not contain option lines.');
    if (!isBooleanAnswer) errors.push('True/False answer must be exactly True or False.');
    else correctOptionIndex = answer.toLowerCase() === 'true' ? 0 : 1;
  } else {
    if (question.options.length > 0) errors.push('Short-answer questions must not contain MCQ option lines.');
    if (isBooleanAnswer) errors.push('A True or False answer must use the True/False question type.');
  }

  return { ...question, correctOptionIndex, errors: [...new Set(errors)] };
}

function parseBlock(sourceNumber: number, headingText: string, lines: string[]): ParsedQuestion {
  const questionParts = headingText.trim() ? [headingText.trim()] : [];
  const answerParts: string[] = [];
  const explanationParts: string[] = [];
  const options: ParsedOption[] = [];
  const sourceErrors: string[] = [];
  let section: 'question' | 'option' | 'answer' | 'explanation' = 'question';
  let answerFieldCount = 0;
  let explanationFieldCount = 0;

  for (const line of lines) {
    const answerMatch = line.match(answerFieldRegex);
    const explanationMatch = line.match(explanationFieldRegex);
    const optionMatch = line.match(optionLineRegex);

    if (answerMatch) {
      answerFieldCount++;
      if (answerFieldCount > 1) sourceErrors.push('Answer field is duplicated. Edit the source text to keep one Answer field.');
      answerParts.push(answerMatch[1]);
      section = 'answer';
      continue;
    }

    if (explanationMatch) {
      explanationFieldCount++;
      if (explanationFieldCount > 1) sourceErrors.push('Explanation field is duplicated. Edit the source text to keep one Explanation field.');
      explanationParts.push(explanationMatch[1]);
      section = 'explanation';
      continue;
    }

    if (optionMatch) {
      if (answerFieldCount > 0 || explanationFieldCount > 0) {
        sourceErrors.push('Option lines must appear before Answer and Explanation.');
      }
      options.push({
        label: optionMatch[1],
        delimiter: optionMatch[2],
        text: optionMatch[3] || '',
      });
      section = 'option';
      continue;
    }

    if (!line.trim()) {
      if (section === 'answer') answerParts.push('');
      else if (section === 'explanation') explanationParts.push('');
      else if (section === 'option' && options.length > 0) options[options.length - 1].text += '\n';
      else if (section === 'question') questionParts.push('');
      continue;
    }

    const unknownField = line.match(anyFieldRegex);
    if (unknownField) {
      sourceErrors.push(`Unrecognized field "${unknownField[1].trim()}". Only Answer: and Explanation: are supported.`);
    }

    if (section === 'question') questionParts.push(line.trim());
    else if (section === 'option' && options.length > 0) options[options.length - 1].text += `\n${line.trim()}`;
    else if (section === 'answer') answerParts.push(line.trim());
    else explanationParts.push(line.trim());
  }

  const answer = joinContent(answerParts);
  const detectedType: QuestionType = options.length > 0
    ? 'mcq'
    : /^(true|false)$/i.test(answer)
      ? 'truefalse'
      : 'shortanswer';

  return validateParsedQuestion({
    sourceNumber,
    questionText: joinContent(questionParts),
    questionType: detectedType,
    detectedType,
    options,
    answer,
    explanation: joinContent(explanationParts),
    correctOptionIndex: -1,
    sourceErrors,
    errors: [],
  });
}

/** Parse numbered blocks first, then detect and validate each question independently. */
export function parseQuestions(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headings = lines.flatMap((line, index) => {
    const match = line.match(questionHeadingRegex);
    return match ? [{ index, sourceNumber: Number(match[1]), text: match[2] }] : [];
  });
  const errors: string[] = [];

  if (headings.length === 0) {
    return {
      questions: [],
      errors: [text.trim() ? 'No numbered question headings found. Each question must start with a number followed by a period.' : 'Input is empty.'],
    };
  }

  const starts = [headings[0]];
  for (let index = 1; index < headings.length; index++) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const blockEnd = nextHeading?.index ?? lines.length;
    const previousStart = starts[starts.length - 1].index;
    const hasBlankSeparator = !lines[heading.index - 1]?.trim();
    const previousBlockHasStructure = hasQuestionStructure(lines, previousStart, heading.index);
    const previousBlockIsComplete = hasCompleteQuestionFields(lines, previousStart, heading.index);
    const hasOwnStructure = hasQuestionStructure(lines, heading.index, blockEnd);
    if (previousBlockHasStructure && hasOwnStructure && (hasBlankSeparator || previousBlockIsComplete)) starts.push(heading);
  }

  const firstStart = starts[0].index;
  if (lines.slice(0, firstStart).some((line) => line.trim())) {
    errors.push('Content before the first numbered question was not imported.');
  }

  const questions = starts.map((heading, index) => {
    const nextStart = starts[index + 1]?.index ?? lines.length;
    return parseBlock(heading.sourceNumber, heading.text, lines.slice(heading.index + 1, nextStart));
  });

  const hasUnparsedTail = questions.length === 0 && lines.some((line) => line.trim());
  if (hasUnparsedTail) errors.push('Input did not contain a complete numbered question block.');

  return { questions, errors };
}

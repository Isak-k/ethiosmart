import { describe, expect, it } from 'vitest';
import { parseQuestions, validateParsedQuestion } from './question-parser';

describe('parseQuestions', () => {
  it('detects mixed types and preserves order when source numbering restarts', () => {
    const result = parseQuestions(`1. The Earth revolves around the Sun.
Answer: TRUE
Explanation: Earth completes an orbit each year.

2. Which language styles web pages?
A. HTML
B. CSS
C. Python
D. SQL
Answer: b
Explanation: CSS styles the page.

5. What does CPU stand for?
Answer: Central Processing Unit
Explanation: The CPU executes instructions.

1. Is water dry?
Answer: False
Explanation: Water is a liquid at room temperature.

8. What is 2 + 2?
Answer: 4
Explanation: Adding two and two gives four.`);

    expect(result.errors).toEqual([]);
    expect(result.questions.map((question) => question.sourceNumber)).toEqual([1, 2, 5, 1, 8]);
    expect(result.questions.map((question) => question.questionType)).toEqual([
      'truefalse', 'mcq', 'shortanswer', 'truefalse', 'shortanswer',
    ]);
    expect(result.questions[1].correctOptionIndex).toBe(1);
    expect(result.questions[2].answer).toBe('Central Processing Unit');
  });

  it('keeps malformed MCQs visible and does not classify them as short answers', () => {
    const result = parseQuestions(`3. Pick the best option.
A. One
B. Two
C. Three
Answer: B
Explanation: This block has an option missing.

9. What is a byte?
Answer: A group of bits
Explanation: A byte commonly contains eight bits.`);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionType).toBe('mcq');
    expect(result.questions[0].errors).toContain('MCQ must contain exactly four options: A, B, C, and D.');
    expect(result.questions[0].errors).toContain('MCQ option D is missing.');
    expect(result.questions[1].questionType).toBe('shortanswer');
    expect(result.questions[1].errors).toEqual([]);
  });

  it('flags duplicate labels, malformed separators, and invalid answer labels', () => {
    const result = parseQuestions(`1. Select a valid option.
A: One
B. Two
B. Duplicate
D. Four
Answer: E
Explanation: The labels and key need correction.`);

    expect(result.questions[0].questionType).toBe('mcq');
    expect(result.questions[0].errors).toContain('MCQ option C is missing.');
    expect(result.questions[0].errors).toContain('MCQ option B is duplicated.');
    expect(result.questions[0].errors).toContain('Option A must use the format "A. text".');
    expect(result.questions[0].errors).toContain('MCQ answer must be exactly one option label: A, B, C, or D.');
  });

  it('rejects non-Boolean True/False answers and missing explanations', () => {
    const result = parseQuestions(`1. Is the answer valid?
Answer: T
Explanation: A strict Boolean answer is required.

2. What is an algorithm?
Answer: A sequence of steps`);

    expect(result.questions[0].questionType).toBe('shortanswer');
    const reviewedAsBoolean = validateParsedQuestion({ ...result.questions[0], questionType: 'truefalse' });
    expect(reviewedAsBoolean.errors).toContain('True/False answer must be exactly True or False.');
    expect(result.questions[1].errors).toContain('Explanation is required.');
  });

  it('keeps numbered explanation text within the preceding question', () => {
    const result = parseQuestions(`1. What is a sequence?
Answer: An ordered list
Explanation: Example steps:
1. Start here.
2. Continue here.

2. Is the sequence empty?
Answer: False
Explanation: It contains at least one item.`);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].explanation).toContain('1. Start here.');
    expect(result.questions[0].explanation).toContain('2. Continue here.');
    expect(result.questions[1].questionType).toBe('truefalse');
  });

  it('keeps numbered list lines in question text before the answer fields', () => {
    const result = parseQuestions(`1. Describe these steps:
1. Collect the input.
2. Process the input.
Answer: Both steps
Explanation: The steps are performed in this order.

2. Is the process complete?
Answer: True
Explanation: The process includes both steps.`);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionText).toContain('1. Collect the input.');
    expect(result.questions[0].questionText).toContain('2. Process the input.');
  });

  it('does not treat abbreviations in question text as option labels', () => {
    const result = parseQuestions(`1. Explain e.g. how HTML works.
Answer: It describes document structure.
Explanation: HTML uses elements to structure a page.`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionType).toBe('shortanswer');
    expect(result.questions[0].questionText).toContain('e.g.');
    expect(result.questions[0].options).toEqual([]);
  });

  it('splits adjacent complete questions when blank lines are omitted', () => {
    const result = parseQuestions(`1. Is the first statement true?
Answer: True
Explanation: This is the first question.
2. Is the second statement true?
Answer: False
Explanation: This is the second question.`);

    expect(result.questions).toHaveLength(2);
    expect(result.questions.map((question) => question.questionType)).toEqual(['truefalse', 'truefalse']);
  });

  it('revalidates question type changes without discarding content', () => {
    const parsed = parseQuestions(`1. Is the statement correct?
Answer: True
Explanation: The answer is boolean.`).questions[0];

    const changed = validateParsedQuestion({ ...parsed, questionType: 'shortanswer' });

    expect(changed.detectedType).toBe('truefalse');
    expect(changed.answer).toBe('True');
    expect(changed.errors).toContain('A True or False answer must use the True/False question type.');
  });
});
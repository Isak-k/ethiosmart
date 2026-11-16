import type { GenerateBatchRequest, NormalizedQuestion, AIProviderId, QuestionType } from './types.js';

export function buildSystemPrompt(): string {
  return [
    'You are a distinguished academic assessment specialist and university examination author.',
    'Your goal is to generate high-quality, academically rigorous, and pedagogically sound exam questions.',
    'Default academic rigor is undergraduate university standard unless specified otherwise.',
    'CRITICAL MANDATORY RULE - RESOURCE-INDEPENDENT, CONCEPT-BASED QUESTION WORDING:',
    'Use learning materials strictly as sources of knowledge, NEVER as references in student-facing question wording.',
    'Questions must be completely self-contained and assess the underlying concepts, definitions, principles, or problems directly.',
    'STRICTLY FORBIDDEN PHRASES (NEVER USE): "According to the text...", "According to the provided material...", "Based on the given resource...", "As mentioned in the document...", "According to the author...", "From the above passage...", "As explained in Chapter X...", "What does the provided note say about...", "Which of the following is stated in the textbook...".',
    'Always formulate direct questions (e.g., instead of "According to the text, what is database normalization?", write "What is database normalization, and why is it important in relational database design?").',
    'Every question must be scientifically, technically, and conceptually accurate without ambiguity, double negatives, or trick questions.',
    'Explanations must be thorough, learner-friendly, and incorporate 2 to 4 meaningful educational emojis (📘 definitions/concepts, ✅ correct principles, ❌ distractors/misconceptions, 💡 conceptual insights, 🧠 reasoning/analysis, 🌍 real-world application, ⚠️ common pitfalls, 🎯 exam tips).',
    'When false, True/False explanations must provide the accurate corrected statement. For MCQs, explanations should clarify why distractors are wrong.',
    'For Short Answer, provide an explicit model answer containing essential keywords and grading criteria.',
    'When specific page numbers or chapters are provided, you MUST strictly confine all questions to that exact material and NEVER generalize to other topics or outside pages.',
    'You MUST return ONLY valid JSON matching the exact schema requested, with no markdown codeblocks, no explanations outside JSON, and no introductory remarks.'
  ].join(' ');
}

export function buildUserPrompt(req: GenerateBatchRequest): string {
  const parts: string[] = [];

  parts.push(`Generate exactly ${req.count} exam question(s).`);

  if (req.language && req.language !== 'English') {
    parts.push(`IMPORTANT: All questions, options, answers, and explanations MUST be written in ${req.language}.`);
  } else {
    parts.push(`Language: English.`);
  }

  if (req.difficulty && req.difficulty !== 'Mixed') {
    parts.push(`Difficulty level: ${req.difficulty}.`);
  } else {
    parts.push(`Difficulty level: Mixed (include a balanced variety of Easy, Medium, and Hard).`);
  }

  const requestedTypes = req.questionTypes && req.questionTypes.length > 0
    ? req.questionTypes
    : ['mcq'];
  parts.push(`Allowed Question Types: ${requestedTypes.join(', ')}.`);

  if (req.questionTypeCounts) {
    const countsList: string[] = [];
    if (typeof req.questionTypeCounts.truefalse === 'number' && req.questionTypeCounts.truefalse > 0) {
      countsList.push(`- ${req.questionTypeCounts.truefalse} True/False question(s) (questionType: "truefalse", options: ["True", "False"])`);
    }
    if (typeof req.questionTypeCounts.mcq === 'number' && req.questionTypeCounts.mcq > 0) {
      countsList.push(`- ${req.questionTypeCounts.mcq} Multiple Choice question(s) (questionType: "mcq", exactly 4 options)`);
    }
    if (typeof req.questionTypeCounts.shortanswer === 'number' && req.questionTypeCounts.shortanswer > 0) {
      countsList.push(`- ${req.questionTypeCounts.shortanswer} Short Answer question(s) (questionType: "shortanswer", empty options [], provide correctAnswer)`);
    }
    if (countsList.length > 0) {
      parts.push(`\nEXACT QUESTION TYPE BREAKDOWN (MANDATORY REQUIREMENT):\n${countsList.join('\n')}\nYou MUST generate EXACTLY the number of questions specified above for each type.`);
    }
  }

  if (req.topic) {
    parts.push(`Focus Topic/Chapter: "${req.topic}".`);
  }

  if (req.pageRange) {
    parts.push(`TARGET SCOPE - SPECIFIC PAGES: "${req.pageRange}".`);
  }

  if (req.chapter) {
    parts.push(`TARGET SCOPE - SPECIFIC CHAPTER: "${req.chapter}".`);
  }

  if (req.pageRange || req.chapter) {
    const scopeDesc = [
      req.pageRange ? `pages (${req.pageRange})` : '',
      req.chapter ? `chapter ("${req.chapter}")` : ''
    ].filter(Boolean).join(' of ');

    parts.push(`
CRITICAL SCOPE CONFINEMENT RULES (ZERO GENERALIZATION TOLERANCE):
1. You MUST generate all questions EXCLUSIVELY and DIRECTLY from the specified ${scopeDesc} provided below.
2. Under NO circumstances should you generate questions from outside these specified pages/chapter or introduce general topic questions that do not appear in the provided excerpt.
3. Every question, correct answer, and explanation must be directly grounded in and verifiable from the provided text for these specific pages.`);
  }

  if (req.prompt) {
    parts.push(`Specific Instructions: "${req.prompt}".`);
  }

  if (req.sourceMaterial && req.sourceMaterial.trim().length > 0) {
    const maxChars = (req.pageRange || req.chapter) ? 30000 : 20000;
    const safeMaterial = req.sourceMaterial.slice(0, maxChars);
    parts.push(
      `\nBase the questions strictly on the following source material:\n---\n${safeMaterial}\n---`
    );
  }

  parts.push(`
PEDAGOGICAL & ASSESSMENT CRITERIA:
1. Resource-Independent, Concept-Based Wording (MANDATORY RULE):
   - Use learning resources as sources of knowledge, NEVER as references in student-facing question wording.
   - Questions must be completely self-contained. Students must be able to understand and answer using their subject knowledge alone, without referring to a specific book, document, file, passage, or author.
   - STRICTLY FORBIDDEN PHRASES:
     ❌ "According to the text..."
     ❌ "According to the provided material..."
     ❌ "Based on the given resource..."
     ❌ "As mentioned in the document..."
     ❌ "According to the author..."
     ❌ "From the above passage..."
     ❌ "As explained in Chapter 2..."
     ❌ "What does the provided note say about..."
     ❌ "Which of the following is stated in the textbook..."
   - INSTEAD, ask about the concept directly:
     ✅ "What is database normalization, and why is it important in relational database design?"
     ✅ "What is the main function of a process scheduler in an operating system?"
     ✅ "A primary key uniquely identifies each record in a relational database table."
2. Academic Rigor: Maintain undergraduate university level. Cover fundamental definitions, core principles, processes, and practical applications without trivial or redundant questions.
3. Question Type Rules:
   - For Multiple-Choice (MCQ): One unambiguously correct option and 3 plausible, realistic distractors. Explain why the correct choice is right and clarify why distractors are wrong.
   - For True/False: Statements must be definitively True or False (no trick wording or double negatives). For False statements, explicitly state the corrected true version in the explanation.
   - For Short Answer: Ask clear, focused questions. Provide a model answer in "correctAnswer" with essential keywords and grading criteria.
4. Educational Emojis in Explanations:
   - Use 2 to 4 relevant educational emojis per explanation to make learning engaging and clear:
     📘 Definitions & concepts | ✅ Correct answer | ❌ Distractor/Misconception | 💡 Insight | 🧠 Reasoning | 🌍 Real-world application | ⚠️ Common pitfalls | 🎯 Exam tip.
5. Difficulty Progression:
   - Easy: Definitions and basic recall.
   - Medium: Comprehension, interpretation, and application.
   - Hard: Analysis, evaluation, multi-step problem solving.

CRITICAL FORMAT RULES:
1. Return ONLY a single valid JSON object with the key "questions" containing an array of question objects.
2. For "mcq":
   - "options" MUST be an array of exactly 4 strings.
   - "correctOptionIndex" MUST be an integer between 0 and 3 indicating the correct choice.
3. For "truefalse":
   - "options" MUST be exactly ["True", "False"].
   - "correctOptionIndex" MUST be 0 (if True) or 1 (if False).
4. For "shortanswer":
   - "options" should be an empty array [].
   - "correctAnswer" MUST be a concise model answer (1-3 sentences or key phrase with keywords).
5. "explanation" MUST provide a pedagogical explanation incorporating 2-4 educational emojis.
6. "difficulty" MUST be one of: "Easy", "Medium", "Hard".

Schema Example:
{
  "questions": [
    {
      "questionText": "Which organelle is responsible for generating the majority of cellular ATP via oxidative phosphorylation?",
      "questionType": "mcq",
      "options": ["Ribosome", "Mitochondria", "Golgi apparatus", "Endoplasmic reticulum"],
      "correctOptionIndex": 1,
      "explanation": "✅ Mitochondria are known as the powerhouses of the cell because they synthesize most ATP through the electron transport chain. 📘 Ribosomes synthesize proteins, while the Golgi apparatus packages them. 💡 Key insight: Aerobic respiration depends directly on the mitochondrial inner membrane.",
      "difficulty": "Medium"
    },
    {
      "questionText": "Under Newtonian mechanics, an object moving at constant velocity experiences a non-zero net external force.",
      "questionType": "truefalse",
      "options": ["True", "False"],
      "correctOptionIndex": 1,
      "explanation": "✅ Correct Answer: False. 📘 According to Newton's First Law, an object with constant velocity has zero acceleration, meaning the net external force must be zero (ΣF = 0). ❌ Misconception: Force is not required to sustain motion, only to change it. 🎯 Corrected Statement: An object moving at constant velocity experiences zero net external force.",
      "difficulty": "Easy"
    },
    {
      "questionText": "Define competitive enzyme inhibition and explain its effect on Km and Vmax.",
      "questionType": "shortanswer",
      "options": [],
      "correctAnswer": "A competitive inhibitor binds reversibly to the enzyme's active site, competing with the substrate. It increases Km (reduces apparent affinity) without altering Vmax.",
      "explanation": "📘 Model Answer: In competitive inhibition, the inhibitor resembles the substrate and binds to the active site. 🧠 Impact: Vmax remains unchanged because high substrate concentrations overcome inhibition; Km increases because higher substrate is required to reach 1/2 Vmax. 🎯 Grading criteria: Award full marks for mentioning active site binding, increased Km, and unchanged Vmax.",
      "difficulty": "Hard"
    }
  ]
}
`);

  return parts.join('\n');
}

export function extractJsonFromText(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from AI provider');
  }

  let text = rawText.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }

  const start = text.search(/[\[{]/);
  if (start < 0) {
    throw new Error('AI response did not contain a JSON object or array');
  }

  const openingStack: string[] = [];
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '{' || character === '[') {
      openingStack.push(character);
    } else if (character === '}' || character === ']') {
      const opening = openingStack.pop();
      if ((character === '}' && opening !== '{') || (character === ']' && opening !== '[')) {
        break;
      }
      if (openingStack.length === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error('AI response did not contain a complete JSON object or array');
  }
  text = text.slice(start, end);

  try {
    return JSON.parse(text);
  } catch (err: any) {
    const cleaned = text.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse AI output as JSON: ${err.message}. Raw output snippet: ${rawText.slice(0, 180)}`);
    }
  }
}

export function sanitizeResourceDependentWording(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. "What does the provided note/text say about X?" -> "What is X?"
  cleaned = cleaned.replace(
    /^(?:What does|What do) (?:the )?(?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|chapter|notes?|file|author|textbook) say (?:about|regarding)\s+/i,
    'What is '
  );

  // 2. "Which of the following is stated/mentioned in the textbook/text/document about X?" -> "Which of the following is correct regarding X..."
  cleaned = cleaned.replace(
    /^(?:Which of the following is|Which of the following are) (?:stated|mentioned|described|explained|found|outlined) in the (?:provided |given |selected |uploaded |above )?(?:textbook|text|document|material|notes?|passage|resource|chapter)\s*(?:about|regarding)\s+/i,
    'Which of the following is correct regarding '
  );
  cleaned = cleaned.replace(
    /^(?:Which of the following is|Which of the following are) (?:stated|mentioned|described|explained|found|outlined) in the (?:provided |given |selected |uploaded |above )?(?:textbook|text|document|material|notes?|passage|resource|chapter)\s*/i,
    'Which of the following is correct: '
  );

  // 3. Leading "According to the [text/material/document/author/chapter]..."
  cleaned = cleaned.replace(
    /^(?:According to|according to) (?:the )?(?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|author|chapter(?:\s+\d+)?|book|notes?|file|upload|excerpt|syllabus|curriculum)(?:,\s*|\s+)/i,
    ''
  );

  // 4. Leading "According to Chapter X..." or "According to Unit X..."
  cleaned = cleaned.replace(
    /^(?:According to|according to) (?:chapter|unit|section|ch\.?)\s*(?:\d+|[IVXLCDM]+)?(?:,\s*|\s+)/i,
    ''
  );

  // 5. Leading "As [mentioned/stated/explained/described] in the [document/text/etc]..."
  cleaned = cleaned.replace(
    /^(?:As |as )(?:mentioned|stated|explained|described|discussed|outlined|presented|noted) in (?:the )?(?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|chapter(?:\s+\d+)?|book|notes?|file|excerpt)(?:,\s*|\s+)/i,
    ''
  );

  // 6. Leading "Based on the [provided/given] [resource/material/text/document/example]..."
  cleaned = cleaned.replace(
    /^(?:Based on|based on) (?:the )?(?:example in the )?(?:provided |given |selected |uploaded |above )?(?:resource|material|text|document|passage|notes?|chapter(?:\s+\d+)?|file|excerpt|reading)(?:,\s*|\s+)/i,
    ''
  );

  // 7. Leading "From the [above/provided] [passage/text/document/excerpt]..."
  cleaned = cleaned.replace(
    /^(?:From the|from the) (?:above |provided |given |selected )?(?:passage|text|document|material|excerpt|reading)(?:,\s*|\s+)/i,
    ''
  );

  // 8. Leading "In the [provided/given] [text/document/material/notes]..."
  cleaned = cleaned.replace(
    /^(?:In the|in the) (?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|chapter(?:\s+\d+)?|notes?|file|excerpt)(?:,\s*|\s+)/i,
    ''
  );

  // 9. Trailing or inline ", according to the [text/document/material/notes/resource]"
  cleaned = cleaned.replace(
    /,?\s*(?:according to|based on) (?:the )?(?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|author|file|notes?|chapter(?:\s+\d+)?|textbook)\b/gi,
    ''
  );

  // 10. Trailing or inline ", as (mentioned|stated|explained) in the [text/document]..."
  cleaned = cleaned.replace(
    /,?\s*as (?:mentioned|stated|explained|described|outlined) in (?:the )?(?:provided |given |selected |uploaded |above )?(?:text|material|document|resource|passage|notes?|chapter(?:\s+\d+)?)\b/gi,
    ''
  );

  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

export function normalizeQuestions(
  parsed: any,
  provider: AIProviderId,
  batchIndex: number = 0
): NormalizedQuestion[] {
  let list: any[] = [];

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && Array.isArray(parsed.questions)) {
    list = parsed.questions;
  } else if (parsed && Array.isArray(parsed.data)) {
    list = parsed.data;
  } else if (parsed && typeof parsed === 'object') {
    const arrKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrKey) list = parsed[arrKey];
  }

  if (list.length === 0) {
    throw new Error('AI response did not contain an array of questions');
  }

  const normalized: NormalizedQuestion[] = [];

  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const number = i + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Invalid AI response: Question ${number} is not an object.`);
    }

    const rawQuestionText = String(raw.questionText || raw.question || raw.prompt || '').trim();
    if (!rawQuestionText) {
      throw new Error(`Invalid AI response: Question ${number} has no question text.`);
    }
    const questionText = sanitizeResourceDependentWording(rawQuestionText);

    const rawType = String(raw.questionType || raw.type || '').toLowerCase();
    let qType: QuestionType;
    if (rawType.includes('true') || rawType.includes('false') || rawType === 'tf') {
      qType = 'truefalse';
    } else if (rawType.includes('short') || rawType.includes('text') || rawType === 'sa') {
      qType = 'shortanswer';
    } else if (rawType.includes('mcq') || rawType.includes('multiple') || rawType.includes('choice')) {
      qType = 'mcq';
    } else {
      throw new Error(`Invalid AI response: Question ${number} has an unsupported question type.`);
    }

    let options: string[] = [];
    let correctOptionIndex = -1;
    let correctAnswer: string | undefined = undefined;

    if (qType === 'truefalse') {
      options = ['True', 'False'];
      if (Number.isInteger(raw.correctOptionIndex)) {
        correctOptionIndex = raw.correctOptionIndex;
      } else {
        const answer = String(raw.correctAnswer || raw.answer || raw.correctOption || '').trim().toLowerCase();
        if (['true', '0', 'a', 't'].includes(answer)) correctOptionIndex = 0;
        if (['false', '1', 'b', 'f'].includes(answer)) correctOptionIndex = 1;
      }
      if (correctOptionIndex !== 0 && correctOptionIndex !== 1) {
        throw new Error(`Invalid AI response: Question ${number} has no valid True/False answer.`);
      }
      correctAnswer = options[correctOptionIndex];
    } else if (qType === 'shortanswer') {
      options = [];
      const suppliedOptions = Array.isArray(raw.options) ? raw.options.filter(Boolean) : [];
      if (suppliedOptions.length > 0) {
        throw new Error(`Invalid AI response: Short-answer question ${number} must not include options.`);
      }
      const rawAns = String(raw.correctAnswer || raw.answer || '').trim();
      correctAnswer = sanitizeResourceDependentWording(rawAns);
      if (!correctAnswer) {
        throw new Error(`Invalid AI response: Short-answer question ${number} has no reference answer.`);
      }
    } else {
      if (Array.isArray(raw.options)) {
        options = raw.options.map((opt: any) => sanitizeResourceDependentWording(String(opt).trim())).filter(Boolean);
      } else if (typeof raw.options === 'object' && raw.options !== null) {
        options = Object.values(raw.options).map((opt: any) => sanitizeResourceDependentWording(String(opt).trim())).filter(Boolean);
      }

      if (options.length !== 4 || new Set(options.map(option => option.toLocaleLowerCase())).size !== 4) {
        throw new Error(`Invalid AI response: Multiple-choice question ${number} must have four distinct, nonempty options.`);
      }

      if (Number.isInteger(raw.correctOptionIndex)) {
        correctOptionIndex = raw.correctOptionIndex;
      } else {
        const rawAns = String(raw.correctAnswer || raw.answer || raw.correctOption || '').trim();
        const letter = rawAns.match(/^(?:option\s*)?([a-d])(?:[\s.):]|$)/i)?.[1]?.toUpperCase();
        if (letter) correctOptionIndex = letter.charCodeAt(0) - 65;
        else if (/^[0-3]$/.test(rawAns)) correctOptionIndex = Number(rawAns);
        else correctOptionIndex = options.findIndex(opt => opt.toLocaleLowerCase() === rawAns.toLocaleLowerCase());
      }
      if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
        throw new Error(`Invalid AI response: Multiple-choice question ${number} has no valid correct answer.`);
      }
      correctAnswer = options[correctOptionIndex];
    }

    const rawExplanation = String(raw.explanation || raw.feedback || raw.rationale || '').trim();
    const explanation = sanitizeResourceDependentWording(rawExplanation);
    if (!explanation) {
      throw new Error(`Invalid AI response: Question ${number} has no explanation.`);
    }

    let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
    const rawDiff = String(raw.difficulty || '').toLowerCase();
    if (rawDiff.includes('easy')) difficulty = 'Easy';
    else if (rawDiff.includes('hard')) difficulty = 'Hard';

    normalized.push({
      id: `ai_${provider}_${Date.now()}_${batchIndex}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      questionText,
      questionType: qType,
      options,
      correctOptionIndex,
      correctAnswer,
      explanation,
      difficulty,
      marks: typeof raw.marks === 'number' && raw.marks > 0 ? raw.marks : 1,
      providerUsed: provider,
      batchIndex
    });
  }

  return normalized;
}

export function validateNormalizedQuestion(question: NormalizedQuestion, index: number): void {
  const number = index + 1;
  if (!question.questionText?.trim() || !question.explanation?.trim()) {
    throw new Error(`Question ${number} must have question text and an explanation.`);
  }
  if (!Number.isFinite(question.marks) || question.marks <= 0) {
    throw new Error(`Question ${number} must have a positive mark value.`);
  }
  if (!Array.isArray(question.options)) {
    throw new Error(`Question ${number} has an invalid options list.`);
  }

  if (question.questionType === 'mcq') {
    if (
      question.options.length !== 4 ||
      question.options.some(option => !option.trim()) ||
      new Set(question.options.map(option => option.toLocaleLowerCase())).size !== 4 ||
      !Number.isInteger(question.correctOptionIndex) ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex > 3
    ) {
      throw new Error(`Question ${number} must be a valid four-option multiple-choice question.`);
    }
    return;
  }
  if (question.questionType === 'truefalse') {
    if (
      question.options.length !== 2 ||
      question.options[0] !== 'True' ||
      question.options[1] !== 'False' ||
      ![0, 1].includes(question.correctOptionIndex)
    ) {
      throw new Error(`Question ${number} must be a valid True/False question.`);
    }
    return;
  }
  if (
    question.questionType !== 'shortanswer' ||
    question.options.length !== 0 ||
    question.correctOptionIndex !== -1 ||
    !question.correctAnswer?.trim()
  ) {
    throw new Error(`Question ${number} must be a valid short-answer question with a reference answer.`);
  }
}

export function validateGeneratedQuestionBatch(
  questions: NormalizedQuestion[],
  req: GenerateBatchRequest
): NormalizedQuestion[] {
  if (questions.length !== req.count) {
    throw new Error(`Invalid AI response: Expected ${req.count} questions but received ${questions.length}.`);
  }

  const requestedTypes = Array.isArray(req.questionTypes) && req.questionTypes.length > 0
    ? req.questionTypes
    : ['mcq'];
  const counts: Record<QuestionType, number> = { mcq: 0, truefalse: 0, shortanswer: 0 };
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    validateNormalizedQuestion(question, index);
    if (!requestedTypes.includes(question.questionType)) {
      throw new Error(`Invalid AI response: Question ${index + 1} has an unrequested type.`);
    }
    counts[question.questionType]++;
    const normalizedText = question.questionText.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (seen.has(normalizedText)) {
      throw new Error('Invalid AI response: The batch contains duplicate questions.');
    }
    seen.add(normalizedText);
  });

  if (req.questionTypeCounts) {
    for (const type of ['mcq', 'truefalse', 'shortanswer'] as const) {
      const expected = req.questionTypeCounts[type];
      if (expected !== undefined && counts[type] !== expected) {
        throw new Error(`Invalid AI response: Expected ${expected} ${type} questions but received ${counts[type]}.`);
      }
    }
  }

  return questions;
}

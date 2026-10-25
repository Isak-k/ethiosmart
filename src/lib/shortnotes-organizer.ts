import {
  ShortNoteSection,
  KeyTerm,
  NoteContentBlock,
  NoteExercise,
  NoteBlockType,
} from '@/types/book';

export interface OrganizedShortNote {
  title: string;
  summary: string;
  learningOutcomes: string[];
  keyTakeaways: string[];
  sections: ShortNoteSection[];
  keyTerms: KeyTerm[];
  exercises: NoteExercise[];
  rawContent: string;
  readingTimeMinutes: number;
}

/**
 * Clean and normalize text line breaks and formatting
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Intelligent client-side parser that transforms raw chapter lecture notes,
 * slides, or book passages into structured interactive study notes.
 */
export function organizeChapterNotesLocal(
  rawText: string,
  options?: string | { chapterTitle?: string; subjectName?: string }
): OrganizedShortNote {
  const defaultTitle =
    typeof options === 'string'
      ? options
      : options?.chapterTitle || 'Study Notes';

  const clean = normalizeText(rawText);
  if (!clean) {
    return {
      title: defaultTitle,
      summary: '',
      learningOutcomes: [],
      keyTakeaways: [],
      sections: [],
      keyTerms: [],
      exercises: [],
      rawContent: '',
      readingTimeMinutes: 1,
    };
  }

  const lines = clean.split('\n').map((l) => l.trim());
  const wordsCount = clean.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 200));

  let detectedTitle = defaultTitle;
  const keyTerms: KeyTerm[] = [];
  const takeaways: string[] = [];
  const learningOutcomes: string[] = [];

  // 1. Detect title
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line) {
      if (line.startsWith('# ')) {
        detectedTitle = line.replace(/^#\s+/, '').trim();
        startIndex = i + 1;
      } else if (i === 0 && line.length < 80 && !line.includes(':') && !line.endsWith('.')) {
        detectedTitle = line;
        startIndex = 1;
      }
      break;
    }
  }

  // 2. Split content into sections by headings
  const isHeading = (line: string): boolean => {
    if (line.startsWith('## ') || line.startsWith('### ') || line.startsWith('#### ')) return true;
    if (/^(Chapter|Unit|Section|Part|Topic)\s+\d+[:.]?/i.test(line)) return true;
    if (/^\d+\.\d+\s+[A-Z]/.test(line) && line.length < 80) return true; // e.g. "1.1 Arithmetic Progression"
    if (/^[A-Z\s]{4,60}$/.test(line) && !line.includes('AND') && !line.includes(',') && !line.includes('.')) return true;
    return false;
  };

  const cleanHeading = (line: string): string => {
    return line
      .replace(/^#+\s*/, '')
      .replace(/^[0-9]+[\.\)]\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim();
  };

  let currentSectionTitle = '';
  let currentSectionLines: string[] = [];
  const rawSections: { title: string; lines: string[] }[] = [];
  const preambleLines: string[] = [];
  let foundFirstHeading = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (isHeading(line)) {
      if (foundFirstHeading) {
        if (currentSectionLines.length > 0) {
          rawSections.push({ title: currentSectionTitle, lines: currentSectionLines });
          currentSectionLines = [];
        }
      } else {
        foundFirstHeading = true;
      }
      currentSectionTitle = cleanHeading(line) || `Section ${rawSections.length + 1}`;
    } else if (!foundFirstHeading) {
      preambleLines.push(line);
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionLines.length > 0) {
    rawSections.push({ title: currentSectionTitle, lines: currentSectionLines });
  }

  // Extract top-level learning outcomes from preamble if present
  let inPreambleOutcomes = false;
  preambleLines.forEach((pline) => {
    if (/^(Learning Outcomes|Objectives|By the end of this|Goals)[:.]?/i.test(pline)) {
      inPreambleOutcomes = true;
    } else if (inPreambleOutcomes) {
      if (/^[-*•\d\.]+\s+/.test(pline)) {
        learningOutcomes.push(pline.replace(/^[-*•\d\.]+\s+/, '').trim());
      } else if (pline === '') {
        inPreambleOutcomes = false;
      }
    }
  });

  // If no headings found at all in document, use preamble as single section
  if (rawSections.length === 0 && preambleLines.length > 0) {
    rawSections.push({ title: 'Overview & Core Principles', lines: preambleLines });
  }

  // Fallback splitting only if no explicit headings were found in the document
  if (!foundFirstHeading && rawSections.length === 1 && rawSections[0].lines.length > 40) {
    const allLines = rawSections[0].lines;
    rawSections.length = 0;
    let chunk: string[] = [];
    let chunkIndex = 1;

    for (const l of allLines) {
      chunk.push(l);
      if (chunk.length >= 20 && l === '') {
        rawSections.push({ title: `Part ${chunkIndex}: Fundamental Concepts`, lines: [...chunk] });
        chunk = [];
        chunkIndex++;
      }
    }
    if (chunk.length > 0) {
      rawSections.push({ title: `Part ${chunkIndex}: Applications & Practice`, lines: chunk });
    }
  }

  // 3. Process each section into structured blocks, key points, and exercises
  const processedSections: ShortNoteSection[] = [];

  rawSections.forEach((rawSec, secIdx) => {
    const secId = `sec-${secIdx + 1}-${Date.now().toString(36)}`;
    const sectionOutcomes: string[] = [];
    const keyPoints: string[] = [];
    const contentBlocks: NoteContentBlock[] = [];
    const exercises: NoteExercise[] = [];

    let insideLearningOutcomes = false;
    let insideCodeBlock = false;
    let codeLanguage = 'text';
    let codeLines: string[] = [];

    // Table parsing buffer
    let tableHeaders: string[] | null = null;
    let tableRows: string[][] = [];

    // Exercise parsing buffer
    let currentWorkedExample: NoteContentBlock | null = null;
    let currentExercise: Partial<NoteExercise> | null = null;

    const flushWorkedExample = () => {
      if (currentWorkedExample) {
        contentBlocks.push(currentWorkedExample);
        currentWorkedExample = null;
      }
    };

    const flushTable = () => {
      if (tableHeaders && tableRows.length > 0) {
        contentBlocks.push({
          id: `tbl-${Date.now()}-${Math.random()}`,
          type: 'table',
          content: '',
          tableData: { headers: tableHeaders, rows: tableRows },
        });
      }
      tableHeaders = null;
      tableRows = [];
    };

    const flushExercise = () => {
      flushWorkedExample();
      if (currentExercise && currentExercise.question) {
        exercises.push({
          id: currentExercise.id || `ex-${secIdx}-${exercises.length + 1}`,
          exerciseNumber: currentExercise.exerciseNumber || exercises.length + 1,
          question: currentExercise.question,
          questionType: currentExercise.questionType || 'problem',
          options: currentExercise.options || [],
          hints: currentExercise.hints || [],
          solution: currentExercise.solution || {
            answer: currentExercise.correctAnswer || 'See detailed steps above.',
            explanation: '',
            steps: [],
          },
          initialExpanded: false,
        });
      }
      currentExercise = null;
    };

    for (let lineIdx = 0; lineIdx < rawSec.lines.length; lineIdx++) {
      const line = rawSec.lines[lineIdx];

      // Code block start / end
      if (line.startsWith('```')) {
        flushTable();
        flushExercise();
        if (insideCodeBlock) {
          contentBlocks.push({
            id: `code-${Date.now()}-${Math.random()}`,
            type: 'code',
            content: codeLines.join('\n'),
            codeLanguage: codeLanguage,
          });
          insideCodeBlock = false;
          codeLines = [];
        } else {
          insideCodeBlock = true;
          codeLanguage = line.replace(/^```/, '').trim() || 'python';
        }
        continue;
      }

      if (insideCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Markdown Table detection: | Col 1 | Col 2 |
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Skip divider row |--|--|
        if (cells.every((c) => /^:?-+:?$/.test(c))) {
          continue;
        }

        if (!tableHeaders) {
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (tableHeaders) {
        flushTable();
      }

      // Learning outcomes header detection
      if (/^(Learning Outcomes|Objectives|By the end of this|Goals)[:.]?/i.test(line)) {
        insideLearningOutcomes = true;
        continue;
      }

      // Check bullet items inside learning outcomes
      if (insideLearningOutcomes) {
        if (/^[-*•\d\.]+\s+/.test(line)) {
          const item = line.replace(/^[-*•\d\.]+\s+/, '').trim();
          sectionOutcomes.push(item);
          if (learningOutcomes.length < 8) learningOutcomes.push(item);
          continue;
        } else if (line === '') {
          insideLearningOutcomes = false;
        }
      }

      // Worked Example detection
      if (/^(Example|Worked Example)\s*(\d+)?[:.]/i.test(line) && !currentExercise) {
        flushTable();
        flushWorkedExample();
        flushExercise();
        const exTitle = line.split(/[:.]/)[0].trim();
        const exBody = line.replace(/^(Example|Worked Example)\s*(\d+)?[:.]\s*/i, '').trim();
        currentWorkedExample = {
          id: `exblock-${Date.now()}-${Math.random()}`,
          type: 'example',
          title: exTitle,
          content: exBody,
          steps: [],
        };
        continue;
      }

      // Handle lines inside active Worked Example
      if (currentWorkedExample) {
        if (/^Problem[:.]\s*(.*)$/i.test(line)) {
          currentWorkedExample.content = line.replace(/^Problem[:.]\s*/i, '').trim();
          continue;
        }
        if (/^Solution[:.]?\s*(.*)$/i.test(line)) {
          const sText = line.replace(/^Solution[:.]?\s*/i, '').trim();
          if (sText) {
            currentWorkedExample.steps = currentWorkedExample.steps || [];
            currentWorkedExample.steps.push({
              stepNumber: 1,
              text: sText,
            });
          }
          continue;
        }
        if (/^(Step\s*\d+|[0-9]+[\.\)])\s*(.*)$/i.test(line)) {
          const stepText = line.replace(/^(Step\s*\d+[:.]?|[0-9]+[\.\)])\s*/i, '').trim();
          currentWorkedExample.steps = currentWorkedExample.steps || [];
          currentWorkedExample.steps.push({
            stepNumber: currentWorkedExample.steps.length + 1,
            text: stepText,
          });
          continue;
        }
        if (!/^(Exercise|Review Question|Practice Problem|Definition|Formula|Important|Key Fact|Tip)/i.test(line)) {
          if (line.trim()) {
            if (!currentWorkedExample.content) {
              currentWorkedExample.content = line.trim();
            } else {
              currentWorkedExample.steps = currentWorkedExample.steps || [];
              currentWorkedExample.steps.push({
                stepNumber: currentWorkedExample.steps.length + 1,
                text: line.trim(),
              });
            }
          }
          continue;
        } else {
          flushWorkedExample();
        }
      }

      // Exercise / Review Question detection
      const exerciseMatch = line.match(/^(Exercise|Review Question|Practice Problem|Question|Q)\s*(\d+)?[:.]\s*(.*)$/i);
      if (exerciseMatch) {
        flushTable();
        flushWorkedExample();
        flushExercise();
        const num = exerciseMatch[2] || String(exercises.length + 1);
        const questionText = exerciseMatch[3] || 'Review problem';
        currentExercise = {
          id: `ex-${secIdx}-${num}-${Math.random().toString(36).substr(2, 4)}`,
          exerciseNumber: num,
          question: questionText,
          questionType: 'problem',
          hints: [],
          options: [],
          solution: { answer: '', steps: [], explanation: '' },
        };
        continue;
      }

      // Exercise choices detection: A) or A.
      const mcqChoiceMatch = line.match(/^([A-D])[\.\)]\s+(.*)$/);
      if (currentExercise && mcqChoiceMatch) {
        currentExercise.options = currentExercise.options || [];
        currentExercise.options.push(line);
        currentExercise.questionType = 'mcq';
        continue;
      }

      // Exercise hint detection
      if (currentExercise && /^Hint[:.]\s*(.*)$/i.test(line)) {
        const hintText = line.replace(/^Hint[:.]\s*/i, '').trim();
        currentExercise.hints = currentExercise.hints || [];
        currentExercise.hints.push(hintText);
        continue;
      }

      // Exercise solution detection
      if (currentExercise && /^(Solution|Answer|Explanation)[:.]\s*(.*)$/i.test(line)) {
        const match = line.match(/^(Solution|Answer|Explanation)[:.]\s*(.*)$/i);
        const kind = match ? match[1].toLowerCase() : 'solution';
        const rest = match ? match[2].trim() : '';
        currentExercise.solution = currentExercise.solution || { answer: '', steps: [], explanation: '' };

        if (kind === 'answer') {
          currentExercise.solution.answer = rest;
        } else if (kind === 'explanation') {
          currentExercise.solution.explanation = rest;
        } else {
          if (rest) currentExercise.solution.answer = rest;
        }
        continue;
      }

      // Exercise solution step detection
      if (currentExercise && /^Steps[:.]?/i.test(line)) {
        continue;
      }
      if (currentExercise && currentExercise.solution && /^(Step\s*\d+|[0-9]+[\.\)])\s*(.*)$/i.test(line)) {
        const stepText = line.replace(/^(Step\s*\d+[:.]?|[0-9]+[\.\)])\s*/i, '').trim();
        currentExercise.solution.steps = currentExercise.solution.steps || [];
        currentExercise.solution.steps.push(stepText);
        continue;
      }

      // Definition detection: Definition: [Term] or **Term**: [Definition]
      const defMatch = line.match(/^(Definition[:.]|\*\*([^*]+)\*\*:?)\s*(.*)$/i);
      if (defMatch && !currentExercise) {
        const rawTerm = defMatch[2] || cleanHeading(defMatch[3].split(/[:–—\-]/)[0] || 'Key Term');
        const rawDef = defMatch[3] || line;
        if (rawDef.length > 5) {
          keyTerms.push({ term: rawTerm.trim(), definition: rawDef.trim() });
          contentBlocks.push({
            id: `def-${Date.now()}-${Math.random()}`,
            type: 'definition',
            title: rawTerm.trim(),
            content: rawDef.trim(),
          });
          continue;
        }
      }

      // Important Fact detection
      if (/^(Important|Key Fact|Key Concept|Remember|Note)[:.]\s*(.*)$/i.test(line) && !currentExercise) {
        const text = line.replace(/^(Important|Key Fact|Key Concept|Remember|Note)[:.]\s*/i, '').trim();
        contentBlocks.push({
          id: `fact-${Date.now()}-${Math.random()}`,
          type: 'important_fact',
          title: 'High-Yield Concept',
          content: text,
        });
        continue;
      }

      // Tip detection
      if (/^(Tip|Exam Tip|Strategy)[:.]\s*(.*)$/i.test(line) && !currentExercise) {
        const text = line.replace(/^(Tip|Exam Tip|Strategy)[:.]\s*/i, '').trim();
        contentBlocks.push({
          id: `tip-${Date.now()}-${Math.random()}`,
          type: 'tip',
          title: 'Exam Strategy',
          content: text,
        });
        continue;
      }

      // Formula block detection
      if (/^(Formula|Equation)[:.]\s*(.*)$/i.test(line) || line.startsWith('$$')) {
        const eq = line.replace(/^(Formula|Equation)[:.]\s*/i, '').trim();
        contentBlocks.push({
          id: `form-${Date.now()}-${Math.random()}`,
          type: 'formula',
          title: 'Key Equation',
          content: eq,
          mathFormula: eq,
        });
        continue;
      }


      // Bullet points
      if (/^[-*•]\s+/.test(line)) {
        const pt = line.replace(/^[-*•]\s+/, '').trim();
        if (pt.length > 5) {
          keyPoints.push(pt);
          if (takeaways.length < 6 && pt.length < 160) {
            takeaways.push(pt);
          }
        }
        continue;
      }

      // Regular prose lines
      if (line.length > 0 && !currentExercise) {
        contentBlocks.push({
          id: `p-${Date.now()}-${Math.random()}`,
          type: 'paragraph',
          content: line,
        });
      }
    }

    // Flush any pending table or exercise
    flushTable();
    flushExercise();

    processedSections.push({
      id: secId,
      title: rawSec.title,
      sectionNumber: String(secIdx + 1),
      content: rawSec.lines.join('\n').trim(),
      learningOutcomes: sectionOutcomes,
      keyPoints: keyPoints,
      contentBlocks: contentBlocks,
      exercises: exercises,
      isImportant: secIdx === 0 || exercises.length > 0,
    });
  });

  // Extract executive summary from first section or first 3 lines
  let summary = '';
  if (processedSections.length > 0) {
    const firstSec = processedSections[0];
    const paras = firstSec.content.split('\n\n').filter((p) => p.trim().length > 30);
    summary = paras[0] ? paras[0].slice(0, 280).trim() : firstSec.title;
    if (summary.length >= 280) summary += '...';
  }

  return {
    title: detectedTitle,
    summary,
    learningOutcomes,
    keyTakeaways: takeaways.length > 0 ? takeaways.slice(0, 6) : ['Master core terminology and definitions', 'Practice worked examples with step-by-step solutions'],
    sections: processedSections,
    keyTerms: keyTerms.slice(0, 25),
    exercises: [],
    rawContent: rawText,
    readingTimeMinutes,
  };
}

/**
 * Optional AI organizer powered by Gemini if configured
 */
import {
  getSubjectPedagogicalProfile,
  validateStudyNoteCompleteness,
  enrichStudyNoteToTextbookQuality,
} from './chapter-resource-generator';
import { getClientProviderKeys } from './ai-generator-service';

/**
 * Organizes raw notes using Google Gemini AI with Subject-Aware Pedagogical Precision.
 * - Enforces STRICT chapter boundary isolation (never integrates one chapter with others).
 * - Enforces TEACHING-FIRST generation (never merely summarizing or turning into short bullets).
 * - Implements the full 10-element instructional structure with substantive explanatory paragraphs.
 * - Tailors content directly to the subject discipline (e.g. step-by-step calculations & formulas for Mathematics; conceptual frameworks & empirical studies for Psychology).
 * - Guarantees textbook-grade academic depth with independent Show/Hide solution exercises.
 */
export interface OrganizeAIOptions {
  chapterTitle?: string;
  subjectName?: string;
  depth?: 'detailed' | 'balanced' | 'concise';
  targetAudience?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  customInstructions?: string;
}

export async function organizeChapterNotesWithAI(
  rawText: string,
  optionsOrTitle?: string | OrganizeAIOptions,
  subjectNameParam?: string,
  geminiApiKey?: string
): Promise<OrganizedShortNote> {
  const options: OrganizeAIOptions =
    typeof optionsOrTitle === 'object' && optionsOrTitle !== null
      ? optionsOrTitle
      : { chapterTitle: typeof optionsOrTitle === 'string' ? optionsOrTitle : undefined };

  const chapterTitle = options.chapterTitle;
  const subjectName = options.subjectName || subjectNameParam;
  const depth = options.depth || 'detailed';
  const targetAudience = options.targetAudience || 'beginner';
  const language = options.language || 'English';
  const customInstructions = options.customInstructions?.trim() || '';

  const localFallback = organizeChapterNotesLocal(rawText, {
    chapterTitle: chapterTitle || 'Chapter Shortnotes',
    subjectName,
  });

  const effectiveKeys = getClientProviderKeys();
  const apiKey =
    geminiApiKey ||
    effectiveKeys.gemini ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key');

  if (!apiKey || !rawText.trim()) {
    return localFallback;
  }

  const profile = getSubjectPedagogicalProfile(subjectName);

  try {
    const prompt = `You are a premier university professor and master textbook author specializing in ${profile.name}.
Your task is to transform raw lecture or textbook materials into deep, authoritative, textbook-quality teaching material for:
Subject: "${subjectName || profile.name}"
Designated Chapter: "${chapterTitle || localFallback.title}"

PRIMARY MISSION: REPLACE SUMMARY-FIRST WITH TEACHING-FIRST GENERATION
The objective is NOT to summarize the uploaded resource. The objective is to ACTUALLY TEACH THE SUBJECT MATTER thoroughly, clearly, and engagingly.
Do NOT generate a few bullet points, definitions, or superficial outlines.
Include the actual main body of the lesson for every important topic.

MANDATORY 10-ELEMENT TEACHING SEQUENCE FOR EVERY MAJOR TOPIC:
1. Introduction & Context: Explain the topic and what it means in simple, accessible language. Explain why it matters and what fundamental questions it addresses.
2. Prerequisite Knowledge: State what foundational concepts students need before tackling this topic.
3. Core Explanation: Write rich, thorough explanatory paragraphs (3-5 substantive paragraphs per section, NOT bullet points). Explain how it works and develop the explanation logically from foundational to advanced ideas.
4. Key Terminology: Define technical terms clearly before relying on them.
5. Detailed Development: Develop the actual mechanisms, stages, governing equations, scientific laws, or theoretical models.
6. Worked Examples & Applications:
   - For Mathematics/Physics: Show line-by-line calculations with EVERY intermediate arithmetic step ($3 + 14 \\cdot 4 = 3 + 56 = 59$), defining every variable explicitly. State SI units for every physical quantity.
   - For Psychology/Social Sciences: Detail theoretical paradigms (Cognitive, Behavioral, Psychoanalytic, Biological, Humanistic), seminal empirical experiments (independent/dependent variables, experimental conditions, findings), and real-world behavioral case scenarios.
   - For Computer Science: Include syntax-highlighted code blocks, algorithmic execution traces, and time/space complexity analysis ($O(n), O(\\log n)$).
7. Reasoning & Intuition: Explain the logic behind conclusions, methods, rules, and procedures.
8. Common Mistakes & Misconceptions: Explicitly highlight pitfalls, exam traps, and cognitive misunderstandings, explaining how to avoid them.
9. Concept Connections: Relate this concept to the broader discipline and subsequent chapters.
10. Review Exercises with Show/Hide Solutions: Multi-step problems with verified solutions that students can expand independently.

CORE PRINCIPLE: OPTIMIZE FOR LEARNING QUALITY, NOT RAW PAGE FILLER
- Preserve essential knowledge: formulas, derivations, theories, principles, and mechanisms.
- Explain rather than merely mention: Mentioning a concept is NOT the same as explaining it.
- Remove redundant filler without sacrificing educational depth.
- Prioritize independent student understanding: After studying, the student should understand the topic without having to consult the original book.

CRITICAL INSTRUCTIONS:
1. STRICT CHAPTER BOUNDARY ISOLATION:
- Focus SOLELY and EXCLUSIVELY on this single chapter: "${chapterTitle || 'Chapter'}".
- Do NOT include Table of Contents page index entries (e.g. "... 15").
- Do NOT bleed into subsequent or previous chapters.

2. SUBJECT-SPECIFIC PEDAGOGICAL EMPHASIS (${profile.name.toUpperCase()}):
- ${profile.focusDescription}
${profile.formattingRules.map((rule) => `- ${rule}`).join('\n')}

3. AUDIENCE & EXPLANATION DEPTH:
- Target Audience: ${targetAudience === 'beginner' ? 'Beginner / New to Subject (explain foundational concepts gently, define all terms before using them, assume zero prior knowledge)' : targetAudience === 'intermediate' ? 'Intermediate (rigorous conceptual and problem-solving level)' : 'Advanced / Honors (in-depth proofs, edge cases, advanced exam preparation)'}.
- Depth Level: ${depth === 'detailed' ? 'Detailed Teaching Notes (exhaustive explanations, comprehensive body of the lesson)' : depth === 'balanced' ? 'Balanced Study Notes (key explanations, definitions, and worked examples)' : 'Concise Revision (high-yield focused summary with essential definitions and formulas)'}.
- Language: Output all explanations and titles strictly in "${language}".
${customInstructions ? `- Custom Pedagogical Guidance: ${customInstructions}` : ''}

Input Chapter Material:
"""
${rawText.slice(0, 18000)}
"""

Respond STRICTLY with valid JSON matching this schema:
{
  "title": "${subjectName ? `${subjectName} - ` : ''}${chapterTitle || 'Chapter Study Notes'}",
  "summary": "3-4 sentence comprehensive executive overview of the chapter's core principles, mechanisms, and exam significance.",
  "learningOutcomes": [
    "Outcome 1: Specific mastery objective",
    "Outcome 2: Analytical or computational skill",
    "Outcome 3: Problem-solving capability"
  ],
  "keyTakeaways": [
    "High-yield takeaway 1",
    "High-yield takeaway 2",
    "High-yield takeaway 3",
    "High-yield takeaway 4"
  ],
  "sections": [
    {
      "id": "sec-1",
      "title": "Comprehensive Topic Title",
      "content": "Deep, thorough academic explanation containing formal principles, theoretical intuition, and governing mechanisms (3-5 substantive paragraphs).",
      "keyPoints": [
        "Essential exam concept 1",
        "Common misconception or pitfall to avoid 2",
        "Governing rule or calculation reminder 3"
      ],
      "isImportant": true,
      "exercises": [
        {
          "id": "ex-1-1",
          "exerciseNumber": 1,
          "question": "Rigorous academic practice question testing calculation (for math) or conceptual analysis (for psychology).",
          "questionType": "problem",
          "hints": ["Targeted hint to guide reasoning."],
          "solution": {
            "answer": "Definitive correct answer or final numerical value with units.",
            "steps": [
              "Step 1: Identify given parameters and state governing principle/formula.",
              "Step 2: Carry out algebraic substitution or conceptual analysis.",
              "Step 3: Evaluate final calculation or deduce conclusion."
            ],
            "explanation": "Deep pedagogical breakdown of why this solution is correct and key exam points."
          },
          "initialExpanded": false
        }
      ]
    }
  ],
  "keyTerms": [
    {
      "term": "Key Academic Term 1",
      "definition": "Complete, authoritative definition with context or formula."
    },
    {
      "term": "Key Academic Term 2",
      "definition": "Complete, authoritative definition with context or formula."
    }
  ]
}`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let textOutput = '';

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.25,
                topP: 0.95,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (textOutput) break;
        }
      } catch {}
    }

    if (!textOutput) return localFallback;

    const cleanedJson = textOutput.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const wordsCount = rawText.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(3, Math.ceil(wordsCount / 180));

    const aiResult: OrganizedShortNote = {
      title: parsed.title || localFallback.title,
      summary: parsed.summary || localFallback.summary,
      learningOutcomes:
        Array.isArray(parsed.learningOutcomes) && parsed.learningOutcomes.length > 0
          ? parsed.learningOutcomes
          : localFallback.learningOutcomes,
      keyTakeaways:
        Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0
          ? parsed.keyTakeaways
          : localFallback.keyTakeaways,
      sections:
        Array.isArray(parsed.sections) && parsed.sections.length > 0
          ? parsed.sections.map((sec: any, idx: number) => ({
              id: sec.id || `sec-${idx + 1}`,
              sectionNumber: sec.sectionNumber || `${idx + 1}`,
              title: sec.title || `Section ${idx + 1}`,
              content: sec.content || '',
              keyPoints: Array.isArray(sec.keyPoints) ? sec.keyPoints : [],
              isImportant: sec.isImportant ?? true,
              exercises: Array.isArray(sec.exercises)
                ? sec.exercises.map((ex: any, exIdx: number) => ({
                    id: ex.id || `ex-${idx + 1}-${exIdx + 1}`,
                    exerciseNumber: ex.exerciseNumber || exIdx + 1,
                    question: ex.question || '',
                    questionType: ex.questionType || 'problem',
                    hints: Array.isArray(ex.hints) ? ex.hints : [],
                    solution: ex.solution || {
                      answer: 'See detailed explanation above.',
                      steps: [],
                      explanation: '',
                    },
                    initialExpanded: false,
                  }))
                : [],
            }))
          : localFallback.sections,
      keyTerms:
        Array.isArray(parsed.keyTerms) && parsed.keyTerms.length > 0
          ? parsed.keyTerms
          : localFallback.keyTerms,
      exercises: localFallback.exercises || [],
      rawContent: rawText,
      readingTimeMinutes,
    };

    // Quality check: if completeness is below 80, enrich to ensure textbook quality
    const validation = validateStudyNoteCompleteness(aiResult, rawText, subjectName);
    if (validation.score < 80) {
      return enrichStudyNoteToTextbookQuality(aiResult, {
        subjectName: subjectName || 'Subject',
        chapterTitle: chapterTitle || 'Chapter Overview',
      });
    }

    return aiResult;
  } catch (err) {
    console.warn('AI smart organize encountered parsing error, falling back to local organizer:', err);
    return localFallback;
  }
}

/**
 * Generates structured markdown from sections
 */
export function generateMarkdownFromSections(sections: ShortNoteSection[]): string {
  const parts: string[] = [];

  sections.forEach((sec, idx) => {
    parts.push(`## Section ${idx + 1}: ${sec.title}\n`);
    if (sec.contentBlocks && sec.contentBlocks.length > 0) {
      sec.contentBlocks.forEach((block) => {
        if (block.type === 'definition') {
          parts.push(`**${block.title || 'Definition'}**: ${block.content}\n`);
        } else if (block.type === 'important_fact') {
          parts.push(`**Important**: ${block.content}\n`);
        } else if (block.type === 'tip') {
          parts.push(`**Tip**: ${block.content}\n`);
        } else if (block.type === 'formula') {
          parts.push(`$$\n${block.mathFormula || block.content}\n$$\n`);
        } else if (block.type === 'code') {
          parts.push(`\`\`\`${block.codeLanguage || 'text'}\n${block.content}\n\`\`\`\n`);
        } else {
          parts.push(`${block.content}\n`);
        }
      });
    } else {
      parts.push(`${sec.content}\n`);
    }

    if (sec.exercises && sec.exercises.length > 0) {
      sec.exercises.forEach((ex, exIdx) => {
        parts.push(`\n### Exercise ${ex.exerciseNumber || exIdx + 1}: ${ex.question}\n`);
        if (ex.solution) {
          parts.push(`**Answer**: ${ex.solution.answer}\n`);
          if (ex.solution.explanation) {
            parts.push(`**Explanation**: ${ex.solution.explanation}\n`);
          }
        }
      });
    }
    parts.push('\n---\n');
  });

  return parts.join('\n');
}

/**
 * Built-in representative multi-subject sample study notes
 * Enables admins to paste or load high-quality notes for Mathematics,
 * Physics, Biology, English, and Computer Science with one click.
 */
export const MULTI_SUBJECT_SAMPLE_NOTES: Record<
  string,
  {
    subject: string;
    chapterTitle: string;
    gradeLevel: string;
    text: string;
  }
> = {
  mathematics: {
    subject: 'Mathematics',
    chapterTitle: 'Sequences and Series: Arithmetic & Geometric Progressions',
    gradeLevel: 'Grade 12',
    text: `# Sequences and Series: Arithmetic & Geometric Progressions

Learning Outcomes:
- Define an arithmetic progression (AP) and identify common difference d.
- Derive and apply the formula for the nth term of an AP: a_n = a_1 + (n - 1)d.
- Define a geometric progression (GP) and calculate common ratio r.
- Evaluate the sum of the first n terms for both AP and GP series.

## 1. Arithmetic Progressions (AP)

Definition: Arithmetic Progression
An arithmetic sequence is a sequence of numbers such that the difference between the consecutive terms is constant. This constant difference is called the common difference $d$.

Formula: General Term of an AP
$$a_n = a_1 + (n - 1)d$$
Where:
a_n = nth term of the sequence
a_1 = first term
n = position of the term
d = common difference (a_{k+1} - a_k)

Important: When $d > 0$, the sequence is strictly increasing. When $d < 0$, the sequence is strictly decreasing. When $d = 0$, the sequence is constant.

Worked Example 1: Finding a Specified Term
Problem: Find the 15th term of the arithmetic sequence $3, 7, 11, 15, \dots$
Solution:
Here $a_1 = 3$ and common difference $d = 7 - 3 = 4$.
Applying the general term formula:
$$a_{15} = 3 + (15 - 1) \cdot 4 = 3 + 14 \cdot 4 = 3 + 56 = 59$$

Exercise 1: Find the 20th term of the sequence $5, 2, -1, -4, \dots$
Hint: Notice that each term is decreasing, so d is negative.
Solution:
Answer: $a_{20} = -52$
Steps:
1. Identify first term $a_1 = 5$
2. Find common difference $d = 2 - 5 = -3$
3. Use formula $a_n = a_1 + (n - 1)d$
4. Compute $a_{20} = 5 + (20 - 1)(-3) = 5 + 19(-3) = 5 - 57 = -52$
Explanation: Since d is negative, the terms become progressively more negative.

## 2. Geometric Progressions (GP)

Definition: Geometric Progression
A geometric progression is a sequence where each term after the first is found by multiplying the previous one by a fixed, non-zero number called the common ratio $r$.

Formula: General Term of a GP
$$a_n = a_1 \cdot r^{n - 1}$$

Tip: Always verify the ratio using two consecutive pairs: $r = \frac{a_2}{a_1} = \frac{a_3}{a_2}$.

Worked Example 2: Finding the nth Term of a GP
Problem: Find the 7th term of the geometric progression $2, 6, 18, 54, \dots$
Solution:
First term $a_1 = 2$, common ratio $r = \frac{6}{2} = 3$.
$$a_7 = 2 \cdot 3^{7 - 1} = 2 \cdot 3^6 = 2 \cdot 729 = 1458$$

Exercise 2: Find the 5th term of a geometric sequence where $a_1 = 80$ and $r = \frac{1}{2}$.
Solution:
Answer: $a_5 = 5$
Steps:
1. First term $a_1 = 80$
2. Common ratio $r = 0.5$
3. Apply formula $a_5 = 80 \cdot (0.5)^4 = 80 \cdot \frac{1}{16} = 5$
Explanation: In a decreasing geometric progression where $|r| < 1$, the terms approach zero.
`,
  },

  physics: {
    subject: 'Physics',
    chapterTitle: "Newton's Laws of Motion & Gravitational Dynamics",
    gradeLevel: 'Grade 11 / 12',
    text: `# Newton's Laws of Motion & Gravitational Dynamics

Learning Outcomes:
- State Newton's three laws of motion and describe everyday inertial phenomena.
- Calculate resultant force, acceleration, and mass using vector methods.
- Apply Newton's Universal Law of Gravitation: F = G(m_1 m_2)/r^2.
- Solve multi-step dynamic equilibrium problems with friction.

## 1. Newton's Second Law & Net Force

Definition: Newton's Second Law
The acceleration of an object as produced by a net force is directly proportional to the magnitude of the net force, in the same direction as the net force, and inversely proportional to the mass of the object.

Formula: Net Force Equation
$$\vec{F}_{\text{net}} = m \cdot \vec{a}$$
Where:
F_net = Net external force (Newtons, N)
m = Mass of object (kg)
a = Acceleration (m/s^2)

Important: Mass is an intrinsic scalar property measured in kilograms (kg), whereas weight is a gravitational vector force measured in Newtons ($W = mg$).

Worked Example 1: Horizontal Acceleration with Friction
Problem: A 12 kg box is pulled horizontally across a floor with a force of 60 N. The frictional force opposing motion is 24 N. Determine the acceleration of the box.
Solution:
1. Calculate the net horizontal force: $F_{\text{net}} = 60\text{ N} - 24\text{ N} = 36\text{ N}$.
2. Apply Newton's Second Law: $a = \frac{F_{\text{net}}}{m} = \frac{36\text{ N}}{12\text{ kg}} = 3.0\text{ m/s}^2$.

Exercise 1: An elevator with a total mass of 800 kg accelerates upwards at $1.5\text{ m/s}^2$. Taking $g = 9.8\text{ m/s}^2$, find the tension $T$ in the supporting cable.
Hint: Draw a free-body diagram: Tension pulls upward, while gravity pulls downward.
Solution:
Answer: $T = 9040\text{ N}$
Steps:
1. Set up equation of motion: $F_{\text{net}} = T - mg = ma$
2. Rearrange for tension: $T = m(g + a)$
3. Substitute values: $T = 800\text{ kg} \cdot (9.8 + 1.5)\text{ m/s}^2 = 800 \cdot 11.3 = 9040\text{ N}$
Explanation: Because the elevator is accelerating upward, the cable must support both the gravitational weight and provide the upward acceleration.

## 2. Universal Gravitation

Formula: Newton's Law of Gravitation
$$F_g = G \frac{m_1 m_2}{r^2}$$
Where:
G = Universal gravitational constant ($6.674 \times 10^{-11}\text{ N}\cdot\text{m}^2/\text{kg}^2$)
m_1, m_2 = Interacting point masses (kg)
r = Center-to-center distance between masses (m)
`,
  },

  biology: {
    subject: 'Biology',
    chapterTitle: 'Cellular Division: Mitosis, Meiosis, and the Cell Cycle',
    gradeLevel: 'Grade 10 / 11',
    text: `# Cellular Division: Mitosis, Meiosis, and the Cell Cycle

Learning Outcomes:
- Differentiate between somatic cell division (mitosis) and gamete formation (meiosis).
- Identify the stages of mitosis: Prophase, Metaphase, Anaphase, Telophase.
- Explain the significance of crossing over in Prophase I for genetic diversity.
- Compare diploid (2n) and haploid (n) chromosome numbers.

## 1. Mitosis & Somatic Growth

Definition: Mitosis
Mitosis is a process of nuclear division in eukaryotic cells that produces two genetically identical daughter cells, each having the same number and kind of chromosomes as the parent nucleus.

Important: Mitosis functions in organismal growth, tissue repair, and asexual reproduction. It maintains the diploid chromosome number ($2n \rightarrow 2n$).

| Phase | Key Microscopic Events | Chromosome State |
| Prophase | Chromatin condenses, spindle apparatus forms, nuclear envelope breaks down | Replicated sister chromatids |
| Metaphase | Chromosomes align individually at the equatorial metaphase plate | Maximum condensation |
| Anaphase | Sister chromatids separate at centromeres and migrate to opposite poles | Individual daughter chromosomes |
| Telophase | Nuclear membranes reform around daughter nuclei; cytokinesis begins | Decondensing into chromatin |

Exercise 1: If a human skin cell has 46 chromosomes, how many chromosomes will each daughter cell possess after undergoing mitosis?
A) 23 chromosomes
B) 46 chromosomes
C) 92 chromosomes
D) 48 chromosomes
Solution:
Answer: B) 46 chromosomes
Explanation: Mitosis is an equational division. It preserves the exact diploid complement of chromosomes ($2n = 46$), ensuring genetic continuity between cell generations.

## 2. Meiosis & Genetic Variation

Definition: Crossing Over
Crossing over is the reciprocal exchange of genetic material between non-sister chromatids of homologous chromosomes during Prophase I of meiosis, creating novel combinations of alleles.

Tip: The mnemonic PMAT (Prophase, Metaphase, Anaphase, Telophase) helps remember the chronological order of cellular division stages.
`,
  },

  english: {
    subject: 'English & Literature',
    chapterTitle: 'Mastery of Conditional Structures & Literary Rhetoric',
    gradeLevel: 'High School / Freshman',
    text: `# Mastery of Conditional Structures & Literary Rhetoric

Learning Outcomes:
- Master the zero, first, second, and third conditional sentence structures.
- Identify rhetorical devices: Metaphor, Simile, Hyperbole, and Personification.
- Analyze formal vs informal register in argumentative academic writing.

## 1. The Four Conditional Structures

Definition: Conditional Sentence
A conditional sentence is a complex sentence containing a condition clause (often beginning with 'if' or 'unless') and a main result clause indicating the consequence.

| Conditional Type | If-Clause Tense | Main Clause Structure | Typical Use |
| Zero Conditional | If + Present Simple | Present Simple | Scientific facts & universal truths |
| First Conditional | If + Present Simple | will + Base Verb | Real, likely future possibilities |
| Second Conditional | If + Past Simple | would + Base Verb | Hypothetical or improbable situations |
| Third Conditional | If + Past Perfect | would have + Past Participle | Imaginary past events & regrets |

Worked Example 1: Transforming Real to Hypothetical
Sentence: "If she studies hard, she will pass the exam." (First conditional)
Hypothetical form: "If she studied hard, she would pass the exam." (Second conditional)
Past counterfactual form: "If she had studied hard, she would have passed the exam." (Third conditional)

Exercise 1: Choose the correct verb form: "If they _______ the warning signs earlier, the disaster would not have occurred."
A) saw
B) have seen
C) had seen
D) would see
Solution:
Answer: C) had seen
Explanation: The sentence contains a third conditional expressing an unreal past event ("would not have occurred"). The condition clause requires the Past Perfect tense ("had seen").
`,
  },

  programming: {
    subject: 'Computer Programming & IT',
    chapterTitle: 'Python Data Structures, Algorithms, and Time Complexity',
    gradeLevel: 'Grade 11 / 12 / College',
    text: `# Python Data Structures, Algorithms, and Time Complexity

Learning Outcomes:
- Understand Big-O algorithmic time and space complexity.
- Implement search algorithms: Linear Search O(n) vs Binary Search O(log n).
- Master list, dictionary, and set operations in modern Python.

## 1. Binary Search & Time Complexity

Definition: Binary Search
An efficient algorithm for finding an item from a sorted list of items. It works by repeatedly dividing in half the portion of the list that could contain the item, achieving logarithmic $O(\log n)$ time complexity.

\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    """Returns the index of target in sorted arr, or -1 if not found."""
    low = 0
    high = len(arr) - 1

    while low <= high:
        mid = (low + high) // 2
        guess = arr[mid]

        if guess == target:
            return mid
        elif guess > target:
            high = mid - 1
        else:
            low = mid + 1

    return -1

# Example usage:
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
print(binary_search(numbers, 23))  # Output: 5
\`\`\`

Important: Binary search strictly requires that the input array is sorted beforehand. If unsorted, sorting first takes $O(n \log n)$ time.

Exercise 1: Given a sorted array of 1,024 elements, what is the maximum number of comparisons binary search will require in the worst-case scenario?
Solution:
Answer: 10 comparisons
Steps:
1. Binary search halves the search space each step: $n, \frac{n}{2}, \frac{n}{4}, \dots$
2. Worst-case comparisons is equal to $\lceil \log_2(n) \rceil$
3. Compute $\log_2(1024) = 10$, because $2^{10} = 1024$
Explanation: Even with 1,000,000 items, binary search takes only 20 comparisons!
`,
  },
};

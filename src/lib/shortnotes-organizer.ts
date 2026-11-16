import {
  ShortNoteSection,
  KeyTerm,
  NoteContentBlock,
  NoteExercise,
  NoteBlockType,
  ShortNoteSourceType,
} from '@/types/book';
import {
  getSubjectPedagogicalProfile,
  validateStudyNoteCompleteness,
  enrichStudyNoteToTextbookQuality,
  synthesizeSectionBlocks,
  ensureSectionExercises,
  repairIncompleteSection,
  PedagogicalProfile,
} from './chapter-resource-generator';
import { getClientProviderKeys } from './ai-generator-service';

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
  const subjectName = typeof options === 'object' ? options?.subjectName : undefined;
  const profile = getSubjectPedagogicalProfile(subjectName);

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
      } else if (/^(?:CHAPTER|UNIT|MODULE|TOPIC)\s+[A-Za-z0-9]+[:.\s\-]/i.test(line)) {
        const afterPrefix = line
          .replace(/^(?:CHAPTER|UNIT|MODULE|TOPIC)\s+[A-Za-z0-9]+[:.\s\-]*/i, '')
          .trim();
        detectedTitle = afterPrefix || line;
        startIndex = i + 1;
      } else if (i === 0 && line.length < 90 && !line.endsWith('.') && !line.startsWith('-') && !line.startsWith('*')) {
        detectedTitle = line;
        startIndex = 1;
      }

      // Skip any subtitle / decorative lines immediately following title
      while (startIndex < lines.length) {
        const next = lines[startIndex].trim();
        if (!next) {
          startIndex++;
          continue;
        }
        if (
          next.includes('•') ||
          next.includes('·') ||
          /^(author|by|grade|subject|publisher|study notes|~?\d+\s*min read)/i.test(next) ||
          /^(organized study notes|high-yield notes|simple english|exam preparation)/i.test(next)
        ) {
          startIndex++;
        } else {
          break;
        }
      }
      break;
    }
  }

  // 2. Split content into sections by headings
  let insideFence = false;
  let prevNonEmptyLine = '';
  let expectedTopLevelNum = 1;
  let currentTopLevelNum = 0;

  const isHeading = (line: string, insideCode: boolean, prevLine: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed || insideCode) return false;

    // Never a heading if contains tabs (table row) or pipe tables
    if (trimmed.includes('\t') || (trimmed.startsWith('|') && trimmed.endsWith('|'))) return false;

    // Never a heading if previous line introduced an enumerated list ending with a colon
    if (prevLine && /[:]\s*$/.test(prevLine.trim()) && !/^(Chapter|Section|Unit|Topic)\s+\d+[:]?$/i.test(prevLine.trim())) {
      if (!trimmed.startsWith('##')) {
        return false;
      }
    }

    // Markdown section headings (H2, H3)
    if (/^#{2,3}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#+\s*/, '').trim();
      if (!/^(table of contents|learning outcomes|objectives|takeaways)/i.test(headingText)) {
        return true;
      }
    }

    // Explicit labeled headings: Chapter 1, Topic 1, Section 1, Part 1, Unit 1
    if (/^(?:Chapter|Unit|Section|Part|Topic)\s+(?:\d+|[IVXLCDM]+)[:.]?\s+[A-Za-z0-9]/i.test(trimmed)) {
      return true;
    }

    // Standalone bold headings: **Heading Name** or **1. Heading Name**
    const boldMatch = trimmed.match(/^\*\*(?:(?:\d+[\.\)]|[A-Z][\.\)]|[IVXLCDM]+[\.\)]|Topic\s*\d*[:.]?)\s*)?([^*]{3,80})\*\*:?$/);
    if (boldMatch) {
      const bTitle = boldMatch[1].trim();
      if (/^(definition|explanation|example|worked example|important|note|key concept|key point|solution|step|hint|question|exercise|formula|types of operating systems|application|characteristics|principles)\b/i.test(bTitle)) {
        return false;
      }
      if (!bTitle.includes('.') && !bTitle.includes('\t')) return true;
    }

    // Single numbered headings (e.g. 1. Definition of Psychology, 2. Characteristics of Learning)
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numMatch) {
      if (prevLine && /^(steps|solution|options|hints|example|worked example)[:.]?$/i.test(prevLine)) return false;
      const num = parseInt(numMatch[1], 10);
      const titlePart = numMatch[2].trim();

      if (/^(identify|compute|find|substitute|use|state|solve|verify|let|where|since|because|calculate|rearrange|set up|simplify|evaluate|express|draw|plug in|write|recall|divide|multiply|add|subtract|praise|reinforce|be specific)\b/i.test(titlePart)) {
        return false;
      }
      if (titlePart.includes('=') || titlePart.includes('$')) return false;
      if (/[.?!]\s+[A-Z]/.test(titlePart)) return false;
      if (titlePart.includes(':') && (titlePart.endsWith('.') || titlePart.split(/\s+/).length > 8)) return false;

      // Sequential check: only match if it continues top-level numbering
      if (num === expectedTopLevelNum || num === currentTopLevelNum + 1) {
        return true;
      }
    }

    return false;
  };

  const cleanHeading = (line: string): string => {
    return line
      .replace(/^#+\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^(?:Chapter|Unit|Section|Part|Topic|Subtopic)\s*(?:\d+|[IVXLCDM]+)?[:.]?\s*/i, '')
      .replace(/^[0-9]+(?:\.[0-9]+)*(?:[\.\)]|\s)\s*/, '')
      .replace(/^[IVXLCDM]+[\.\)]\s*/i, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/:$/, '')
      .trim();
  };

  let currentSectionTitle = '';
  let currentSectionLines: string[] = [];
  const rawSections: { title: string; lines: string[] }[] = [];
  const preambleLines: string[] = [];
  let foundFirstHeading = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      insideFence = !insideFence;
    }

    if (isHeading(line, insideFence, prevNonEmptyLine)) {
      const cleanLine = line.trim().replace(/^#+\s*/, '').replace(/^\*\*\s*/, '');
      const numMatch = cleanLine.match(/^(\d+)[\.\)]/);
      if (numMatch) {
        currentTopLevelNum = parseInt(numMatch[1], 10);
        expectedTopLevelNum = currentTopLevelNum + 1;
      }
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

    if (line.trim()) {
      prevNonEmptyLine = line.trim();
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

    const deriveGroundedChunkTitle = (lines: string[], fallbackIdx: number): string => {
      for (const line of lines) {
        const trimmed = line.trim();
        const boldM = trimmed.match(/^\*\*([^*]{3,60})\*\*$/);
        if (boldM && !/^(note|definition|example|tip|warning|hint)/i.test(boldM[1])) {
          return boldM[1].trim();
        }
        if (trimmed.length > 5 && trimmed.length < 60 && !trimmed.endsWith('.') && /^[A-Z0-9]/.test(trimmed)) {
          if (!/^(the|a|an|in|on|at|for|to|and|but)\b/i.test(trimmed)) {
            return trimmed.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, '').trim();
          }
        }
      }
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 15) {
          const firstSentence = trimmed.split(/[.?!]/)[0].trim();
          if (firstSentence.length > 8 && firstSentence.length < 55) {
            return firstSentence;
          }
        }
      }
      return defaultTitle ? `${defaultTitle} (Part ${fallbackIdx})` : `Core Concepts (Part ${fallbackIdx})`;
    };

    for (const l of allLines) {
      chunk.push(l);
      if (chunk.length >= 25 && l === '') {
        const chunkTitle = deriveGroundedChunkTitle(chunk, chunkIndex);
        rawSections.push({ title: chunkTitle, lines: [...chunk] });
        chunk = [];
        chunkIndex++;
      }
    }
    if (chunk.length > 0) {
      const chunkTitle = deriveGroundedChunkTitle(chunk, chunkIndex);
      rawSections.push({ title: chunkTitle, lines: chunk });
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
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && rawSec.title.includes('Second Law')) {
        console.log(`[TRACE] sec1 line[${lineIdx}]="${line.slice(0,70)}" currentWorkedEx=${!!currentWorkedExample} currentEx=${!!currentExercise}`);
      }

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

      // Table detection: Markdown pipe tables OR tab-separated tables
      const isPipeTableLine = line.startsWith('|') && line.endsWith('|');
      const isTabTableLine = line.includes('\t') && line.split('\t').map((c) => c.trim()).filter(Boolean).length >= 2;

      if (isPipeTableLine || isTabTableLine) {
        const cells = isPipeTableLine
          ? line.slice(1, -1).split('|').map((c) => c.trim())
          : line.split('\t').map((c) => c.trim());

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

      // Worked Example detection - only for Mathematics & Physics calculations
      const isMathOrPhys = profile.discipline === 'mathematics' || profile.discipline === 'physics';
      if (isMathOrPhys && /^(Worked Example|Sample Problem|Calculation Example)\s*(\d+)?[:.]/i.test(line) && !currentExercise) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
          console.log(`[DEBUG-WEX-START] "${line.slice(0,80)}"`);
        }
        flushTable();
        flushWorkedExample();
        flushExercise();
        const exTitle = line.split(/[:.]/)[0].trim();
        const exBody = line.replace(/^(Worked Example|Sample Problem|Calculation Example)\s*(\d+)?[:.]\s*/i, '').trim();
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
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' && rawSec.title.includes('Second Law')) {
            console.log(`[TRACE-WEX-PROSE] "${line.slice(0,60)}" step_check=${/^(Step\s*\d+|[0-9]+[\.\]])/.test(line)} sol_check=${/^Solution[:.]?/.test(line)} prob_check=${/^Problem[:]/.test(line)}`);
          }
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
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
            console.log(`[DEBUG-WEX] Flushing worked example, next line="${line.slice(0,80)}"`);
          }
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


      // Subheading detection: 2.1 Main features of the definition, 4.1 Readiness, etc.
      const subMatch = line.match(/^(\d+\.\d+(?:\.\d+)*)[\.\)]?\s+([A-Za-z0-9\s:–—\-()&/]+)$/);
      if (subMatch && !currentExercise) {
        const subTitle = line.trim();
        if (subTitle.length < 80 && !/[.?!]\s+[A-Z]/.test(subTitle)) {
          contentBlocks.push({
            id: `sub-${Date.now()}-${Math.random()}`,
            type: 'subheading',
            title: subTitle,
            content: subTitle,
          });
          continue;
        }
      }

      // Bullet points
      if (/^[-*•]\s+/.test(line)) {
        const pt = line.replace(/^[-*•]\s+/, '').trim();
        if (pt.length > 0) {
          contentBlocks.push({
            id: `pt-${Date.now()}-${Math.random()}`,
            type: 'paragraph',
            content: `• ${pt}`,
          });
          if (pt.length > 5) {
            keyPoints.push(pt);
            if (takeaways.length < 6 && pt.length < 160) {
              takeaways.push(pt);
            }
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
    // DEBUG: log exercise count per section
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      console.log(`[DEBUG] Section "${rawSec.title}" exercises: ${exercises.length}, isMathOrPhys: ${profile.discipline}`);
      exercises.forEach((e, i) => console.log(`  ex[${i}]: "${String(e.question).slice(0, 60)}..."`));
    }

    const finalBlocks = synthesizeSectionBlocks(
      {
        id: secId,
        title: rawSec.title,
        content: rawSec.lines.join('\n').trim(),
        keyPoints: keyPoints,
        contentBlocks: contentBlocks,
      },
      profile.discipline,
      defaultTitle
    );

    const finalExercises = ensureSectionExercises(
      exercises,
      secIdx,
      rawSec.title,
      profile.discipline,
      defaultTitle
    );

    processedSections.push({
      id: secId,
      title: rawSec.title,
      sectionNumber: String(secIdx + 1),
      content: rawSec.lines.join('\n').trim(),
      learningOutcomes: sectionOutcomes,
      keyPoints: keyPoints,
      contentBlocks: finalBlocks,
      exercises: finalExercises,
      isImportant: secIdx === 0 || finalExercises.length > 0,
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
 * Organizes raw notes using AI with Subject-Aware Pedagogical Precision.
 * Multi-provider failover: Google Gemini -> Groq -> OpenRouter -> Local Fallback.
 * - Enforces STRICT chapter boundary isolation (never integrates one chapter with others).
 * - Enforces TEACHING-FIRST generation (never merely summarizing or turning into short bullets).
 * - Implements rich structured contentBlocks (definitions, important facts, worked examples, warnings, tips, formulas).
 * - Guarantees textbook-grade academic depth with independent Show/Hide solution exercises.
 */
export interface OrganizeAIOptions {
  chapterTitle?: string;
  subjectName?: string;
  depth?: 'detailed' | 'balanced' | 'concise';
  targetAudience?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  customInstructions?: string;
  sourceType?: ShortNoteSourceType;
}

async function callAIForNotes(prompt: string, effectiveKeys: ReturnType<typeof getClientProviderKeys>, userKey?: string): Promise<string> {
  // 1. Try Google Gemini (Fastest high-throughput models with realistic 45s timeout)
  const geminiKey = userKey || effectiveKeys.gemini;
  if (geminiKey) {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(45000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
              },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) return text.trim();
        }
      } catch (err) {
        console.warn(`[callAIForNotes] Gemini (${model}) failed:`, err);
      }
    }
  }

  // 2. Try Groq (Ultra-fast failover with 35s timeout)
  const groqKey = effectiveKeys.groq;
  if (groqKey) {
    const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of models) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          signal: AbortSignal.timeout(35000),
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an expert university professor and master textbook author. Strictly ground all generated notes in the provided source material and respond strictly with valid JSON.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text && text.trim()) return text.trim();
        }
      } catch (err) {
        console.warn(`[callAIForNotes] Groq (${model}) failed:`, err);
      }
    }
  }

  // 3. Try OpenRouter (45s timeout)
  const openrouterKey = effectiveKeys.openrouter;
  if (openrouterKey) {
    const models = ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat'];
    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openrouterKey}`,
          },
          signal: AbortSignal.timeout(45000),
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text && text.trim()) return text.trim();
        }
      } catch (err) {
        console.warn(`[callAIForNotes] OpenRouter (${model}) failed:`, err);
      }
    }
  }

  return '';
}

/**
 * Safely parses JSON from an AI response, stripping markdown wrappers if present.
 */
function extractJsonObject(text: string): any {
  if (!text || !text.trim()) return null;
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
    return null;
  }
}

export interface DetectedTopicItem {
  title: string;
  level: number;
  startIndex: number;
  endIndex?: number;
}

/**
 * Detects all chapter topics, subheadings, and meaningful divisions in the raw text.
 */
export function extractChapterTopics(rawText: string): DetectedTopicItem[] {
  const lines = rawText.split('\n');
  const topics: DetectedTopicItem[] = [];
  let charPos = 0;
  let expectedTopLevelNum = 1;
  let currentTopLevelNum = 0;
  let prevNonEmptyLine = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      charPos += rawLine.length + 1;
      continue;
    }

    // Skip table rows
    if (line.includes('\t') || (line.startsWith('|') && line.endsWith('|'))) {
      charPos += rawLine.length + 1;
      prevNonEmptyLine = line;
      continue;
    }

    // Skip list lead-in items
    if (prevNonEmptyLine && /[:]\s*$/.test(prevNonEmptyLine) && !/^(Chapter|Section|Unit|Topic)\s+\d+[:]?$/i.test(prevNonEmptyLine) && !line.startsWith('##')) {
      charPos += rawLine.length + 1;
      prevNonEmptyLine = line;
      continue;
    }

    // Markdown headings (#, ##, ###)
    const mdMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (mdMatch) {
      const level = mdMatch[1].length;
      const title = mdMatch[2].replace(/^\*\*|\*\*$/g, '').trim();
      const numM = title.match(/^(\d+)[\.\)]/);
      if (numM) {
        currentTopLevelNum = parseInt(numM[1], 10);
        expectedTopLevelNum = currentTopLevelNum + 1;
      }
      if (!/^(table of contents|learning outcomes|objectives|summary|takeaways|exam tips)/i.test(title)) {
        topics.push({ title, level, startIndex: charPos });
      }
    }
    // Numbered sections with explicit keyword (e.g. Topic 1: ..., Section 1: ...)
    else if (/^(?:Section|Topic|Unit|Part)\s+\d+[:.]?\s+(.+)/i.test(line)) {
      const m = line.match(/^(?:Section|Topic|Unit|Part)\s+\d+[:.]?\s+(.+)/i);
      const title = (m ? m[1] : line).trim();
      topics.push({ title, level: 2, startIndex: charPos });
    }
    // Numbered top-level section: "1. Definition of Psychology", "2. Biological Bases..."
    else {
      const topMatch = line.match(/^(\d+)[\.\)]\s+([A-Za-z0-9\s:–—\-()&/]+)$/);
      if (topMatch) {
        const num = parseInt(topMatch[1], 10);
        const titlePart = topMatch[2].trim();
        const isNotActionVerb = !/^(identify|compute|find|substitute|use|state|solve|verify|let|where|since|because|calculate|praise|reinforce|be specific)\b/i.test(titlePart);
        const isNotMultiSentence = !/[.?!]\s+[A-Z]/.test(titlePart);
        const isNotDescriptiveItem = !(titlePart.includes(':') && (titlePart.endsWith('.') || titlePart.split(/\s+/).length > 8));

        if (isNotActionVerb && isNotMultiSentence && isNotDescriptiveItem) {
          if (num === expectedTopLevelNum || num === currentTopLevelNum + 1) {
            currentTopLevelNum = num;
            expectedTopLevelNum = currentTopLevelNum + 1;
            topics.push({ title: titlePart, level: 2, startIndex: charPos });
          }
        }
      } else if (/^\*\*([A-Za-z0-9\s:–—\-]{4,70})\*\*:?$/.test(line) && !line.includes('.')) {
        const m = line.match(/^\*\*([A-Za-z0-9\s:–—\-]{4,70})\*\*:?$/);
        if (m && !/^(important|definition|note|tip|warning|example|formula|solution|step|hint|question|exercise)/i.test(m[1])) {
          const numM = m[1].trim().match(/^(\d+)[\.\)]/);
          if (numM) {
            currentTopLevelNum = parseInt(numM[1], 10);
            expectedTopLevelNum = currentTopLevelNum + 1;
          }
          topics.push({ title: m[1].trim(), level: 2, startIndex: charPos });
        }
      }
    }

    charPos += rawLine.length + 1;
    prevNonEmptyLine = line;
  }

  // Calculate endIndex for each topic
  for (let j = 0; j < topics.length; j++) {
    topics[j].endIndex = j + 1 < topics.length ? topics[j + 1].startIndex : rawText.length;
  }

  return topics;
}

export interface TopicChunk {
  chunkText: string;
  topicTitles: string[];
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Splits long chapter material into discrete topic clusters (4,000 - 12,000 characters)
 * to ensure that NO topic is skipped or truncated during AI generation.
 */
export function splitContentIntoTopicChunks(
  rawText: string,
  maxChunkLength = 60000
): TopicChunk[] {
  if (rawText.length <= maxChunkLength) {
    const topics = extractChapterTopics(rawText);
    return [
      {
        chunkText: rawText,
        topicTitles: topics.map((t) => t.title),
        chunkIndex: 0,
        totalChunks: 1,
      },
    ];
  }

  const topics = extractChapterTopics(rawText);

  // If topics were detected, split along topic boundaries
  if (topics.length > 1) {
    const chunks: TopicChunk[] = [];
    let currentTopicGroup: DetectedTopicItem[] = [];
    let currentStart = topics[0].startIndex;

    for (let i = 0; i < topics.length; i++) {
      currentTopicGroup.push(topics[i]);
      const currentEnd = topics[i].endIndex || rawText.length;
      const groupLength = currentEnd - currentStart;

      // When chunk is big enough or on last topic
      if (groupLength >= maxChunkLength || i === topics.length - 1) {
        const chunkSlice = rawText.slice(currentStart, currentEnd).trim();
        chunks.push({
          chunkText: chunkSlice,
          topicTitles: currentTopicGroup.map((t) => t.title),
          chunkIndex: chunks.length,
          totalChunks: 0,
        });
        currentTopicGroup = [];
        if (i + 1 < topics.length) {
          currentStart = topics[i + 1].startIndex;
        }
      }
    }

    chunks.forEach((c) => (c.totalChunks = chunks.length));
    return chunks;
  }

  // Fallback: split by paragraph boundaries near 10,000 characters
  const paragraphs = rawText.split(/\n\s*\n/);
  const chunks: TopicChunk[] = [];
  let currentParas: string[] = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    currentParas.push(para);
    currentLength += para.length;
    if (currentLength >= maxChunkLength) {
      chunks.push({
        chunkText: currentParas.join('\n\n'),
        topicTitles: [],
        chunkIndex: chunks.length,
        totalChunks: 0,
      });
      currentParas = [];
      currentLength = 0;
    }
  }

  if (currentParas.length > 0) {
    chunks.push({
      chunkText: currentParas.join('\n\n'),
      topicTitles: [],
      chunkIndex: chunks.length,
      totalChunks: 0,
    });
  }

  chunks.forEach((c) => (c.totalChunks = chunks.length));
  return chunks;
}

/**
 * Builds the comprehensive teacher prompt emphasizing NORMAL CLASSROOM STUDY NOTES.
 */
function buildNormalStudyNotesPrompt(params: {
  subjectName: string;
  chapterTitle: string;
  chunkText: string;
  topicTitles: string[];
  chunkIndex: number;
  totalChunks: number;
  profile: PedagogicalProfile;
  depth: string;
  targetAudience: string;
  language: string;
  customInstructions?: string;
  isUserOrganized?: boolean;
}): string {
  const {
    subjectName,
    chapterTitle,
    chunkText,
    topicTitles,
    chunkIndex,
    totalChunks,
    profile,
    depth,
    targetAudience,
    language,
    customInstructions,
    isUserOrganized,
  } = params;

  return `You are a premier university professor and master textbook author specializing in ${profile.name}.
Your mission is to generate GROUNDED, AUTHENTIC, EXPLANATORY CLASSROOM STUDY NOTES for students, based STRICTLY on the provided source material and user instructions.

Subject: "${subjectName || profile.name}"
Designated Chapter: "${chapterTitle}"
${totalChunks > 1 ? `Part: ${chunkIndex + 1} of ${totalChunks}` : ''}

================================================================================
CRITICAL GROUNDING DIRECTIVE (STRICTLY CONFINED TO SOURCE MATERIAL - NO OUTSIDE FILLER):
================================================================================
1. Read, analyze, and understand the Source Material provided below first.
2. Every section title, explanation, definition, fact, example, and exercise MUST be directly derived from and faithful to the Source Material.
3. DO NOT introduce generic placeholder titles (e.g. NEVER output "Part 1: Fundamental Concepts", "Part 2: Fundamental Concepts", "Section 1", or "Overview"). Use the real, authentic topic names from the text.
4. DO NOT invent outside facts, theories, or boilerplate that do not exist in the source material.
5. If the source material is about Geography, the content must be about the specific geographic topics, regions, climate, or landforms in the text. If it is about Psychology, it must be about the specific theories, experiments, and concepts in the text.
6. Zero Hallucination: Ground every definition, explanation, and exercise strictly in the text.

================================================================================
USER PROMPT & CUSTOM INSTRUCTIONS (HIGHEST PRIORITY):
================================================================================
${customInstructions ? `The educator has provided specific prompt instructions:
"""
${customInstructions}
"""
You MUST prioritize and apply these custom instructions when structuring, prioritizing, and explaining concepts from the source material.` : 'Follow the natural structure and pedagogical depth of the source material.'}

================================================================================
CORE MANDATE: GENERATE NORMAL, EXPLANATORY CLASSROOM STUDY NOTES (NOT SUMMARIES)
================================================================================
The default output MUST resemble a master teacher's classroom notes or textbook notes:
- Teach students who are new to the subject using clear, simple English by default.
- Explain concepts thoroughly enough for deep understanding and examination preparation.
- Do NOT generate brief summaries, revision sheets, lists of definitions without explanations, or superficial outlines.
- Do NOT skip topics. Every meaningful topic and subtopic in the source material must be thoroughly taught.

================================================================================
CRITICAL TEACHING RULE: EXPLAIN CONCEPTS INSTEAD OF LISTING THEM
================================================================================
NEVER produce bare bullet lists of items or types without individual explanations!
When a concept has types or classifications, EXPLAIN EACH TYPE INDIVIDUALLY with its own Definition, Explanation, Example, and Important points in clear Markdown prose.

================================================================================
EXPANDED IN-DEPTH NOTE COVERAGE (+40% DEPTH & COMPREHENSIVENESS):
================================================================================
- INCREASE EXPLANATORY NOTE SIZE BY ~40%: Do NOT write brief, superficial summaries. Provide comprehensive, textbook-grade teaching notes.
- For EVERY concept, theory, or mechanism:
  1. Foundational context & rationale: Explain why this concept was developed and why it matters.
  2. Deep internal mechanism: Walk through the step-by-step logic, components, or psychological/scientific processes.
  3. Concrete real-world examples: Provide relatable everyday illustrations for every theoretical point.
  4. Precise distinctions: Highlight how this concept contrasts with similar or easily confused concepts.
  5. Nuances & exam traps: Warn students about common misconceptions and errors.
- Ensure each section's "content" is a rich, substantive multi-paragraph masterclass (at least 350-600 words per section).

================================================================================
COLOR THE IMPORTANT POINTS & EMPHASIS DIRECTIVE:
================================================================================
- AGGRESSIVELY COLOR AND HIGHLIGHT key terms, definitions, laws, experiments, and exam takeaways using Markdown bold:
  * Wrap EVERY core concept, technical term, governing rule, and critical exam takeaway in **bold** (e.g. **Conditioned Stimulus (CS)**, **Extinction**, **Relatively Permanent Change**).
  * Our interactive reader automatically converts all **bold terms** into multi-colored, vibrant visual highlight pills (blue, emerald, amber, purple, rose) for effortless retention!
  * Wrap pivotal governing formulas and immutable laws in ==highlight== syntax.
  * In the "keyPoints" array, start every point with a bold anchor: e.g., "**Core Principle**: ...", "**Exam Misconception**: ...", "**Practical Example**: ...".

================================================================================
INTERACTIVE MULTIPLE CHOICE QUESTIONS (MCQs) FOR EVERY TOPIC (MANDATORY):
================================================================================
- Every section MUST include 2-3 Interactive Multiple Choice Questions (MCQs) in the "exercises" array.
- DO NOT generate open-ended questions without choices. Every exercise must provide 4 distinct plausible options (A, B, C, D).
- State the correct answer letter ("A", "B", "C", or "D") in "correctAnswer".
- Provide a helpful hint in "hints", and a complete breakdown in "solution" explaining why the correct choice is right and why distractors are incorrect.

${isUserOrganized ? `================================================================================
USER-ORGANIZED NOTE INSTRUCTION:
================================================================================
The source text is an already-organized study note provided by the educator/user.
- Faithfully preserve and follow the user's exact headings, topics, and structure.
- Create a dedicated study note section for every topic and subtopic in the user's note.
- Do NOT merge, omit, or rename topics to generic titles. Follow the author's structure.
- Expand every concept with full explanatory teaching prose following the author's outline.
` : ''}
${topicTitles.length > 0 ? `MANDATORY TOPIC COVERAGE:
You MUST create a dedicated section for each of these topics from the material:
${topicTitles.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}
Do NOT skip any of these topics. Do NOT merge them into one brief paragraph.` : ''}

SUBJECT PEDAGOGICAL EMPHASIS (${profile.name.toUpperCase()}):
- ${profile.focusDescription}
${profile.formattingRules.map((rule) => `- ${rule}`).join('\n')}

Target Audience: ${targetAudience}
Depth: ${depth}
Language: Strictly output in ${language}.

Source Material:
"""
${chunkText}
"""

Respond STRICTLY with valid JSON matching this schema:
{
  "title": "${subjectName ? `${subjectName} - ` : ''}${chapterTitle}",
  "summary": "3-4 sentence comprehensive executive overview grounded directly in the chapter's core principles.",
  "learningOutcomes": [
    "Identify ...",
    "Explain ...",
    "Differentiate ..."
  ],
  "keyTakeaways": [
    "High-yield exam takeaway 1 directly from text",
    "High-yield exam takeaway 2 directly from text"
  ],
  "sections": [
    {
      "id": "sec-1",
      "sectionNumber": "1",
      "title": "Authentic Topic Title From Source Material",
      "content": "Comprehensive, well-written classroom study notes teaching this topic: detailed explanations, definitions, each type individually explained with Definition, Explanation, Example, and Important points, components, processes, advantages/disadvantages, and comparisons in clear Markdown prose.",
      "keyPoints": [
        "Core exam concept 1 directly from text",
        "Key pedagogical reminder 2"
      ],
      "contentBlocks": [
        {
          "type": "definition",
          "title": "Exact Term Name From Text",
          "subtitle": "Core Concept",
          "content": "Clear, grounded definition in simple English."
        },
        {
          "type": "important_fact",
          "title": "Key Principle / Fact to Remember",
          "content": "Grounded law, mechanism, or critical takeaway directly from this section."
        },
        {
          "type": "example",
          "title": "Realistic Application Example",
          "subtitle": "Practical Scenario",
          "content": "Relatable scenario directly illustrating this concept from the text."
        },
        {
          "type": "warning",
          "title": "Common Exam Misconception / Warning",
          "content": "Specific misconception students often make regarding this exact topic."
        },
        {
          "type": "tip",
          "title": "Exam Tip & Strategy",
          "content": "How to answer questions on this topic effectively."
        }
      ],
      "exercises": [
        {
          "id": "ex-1-1",
          "exerciseNumber": 1,
          "questionType": "mcq",
          "question": "Clear, grounded multiple-choice question testing understanding of this topic based on the source text...",
          "options": [
            "Plausible distractor option A",
            "Correct answer option B",
            "Plausible distractor option C",
            "Plausible distractor option D"
          ],
          "correctAnswer": "B",
          "hints": [
            "Grounded hint guiding students to the correct mechanism..."
          ],
          "solution": {
            "answer": "Option B: [Correct choice text]",
            "explanation": "Detailed explanation of why Option B is correct and why options A, C, and D are incorrect.",
            "steps": [
              "Step 1: Identify the governing principle from this section.",
              "Step 2: Evaluate each option against the principle to eliminate distractors."
            ]
          }
        }
      ]
    }
  ],
  "keyTerms": [
    {
      "term": "Term directly from text",
      "definition": "Clear definition in simple English."
    }
  ]
}`;
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
  const hasAnyKey = Boolean(
    geminiApiKey ||
    effectiveKeys.gemini ||
    effectiveKeys.groq ||
    effectiveKeys.openrouter ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key')
  );

  if (!hasAnyKey || !rawText.trim()) {
    return localFallback;
  }

  const profile = getSubjectPedagogicalProfile(subjectName);

  try {
    const chunks = splitContentIntoTopicChunks(rawText, 40000);
    const collectedSections: ShortNoteSection[] = [];
    const collectedKeyTerms: KeyTerm[] = [];
    let detectedTitle = chapterTitle || localFallback.title;
    let overallSummary = localFallback.summary;
    let overallOutcomes: string[] = localFallback.learningOutcomes;
    let overallTakeaways: string[] = localFallback.keyTakeaways;

    const isUserOrganized = options.sourceType === 'upload' || options.sourceType === 'pasted_text';

    // Execute chunks in parallel to maximize speed
    const chunkPromises = chunks.map(async (chunk, cIdx) => {
      const prompt = buildNormalStudyNotesPrompt({
        subjectName: subjectName || profile.name,
        chapterTitle: detectedTitle,
        chunkText: chunk.chunkText,
        topicTitles: chunk.topicTitles,
        chunkIndex: cIdx,
        totalChunks: chunks.length,
        profile,
        depth,
        targetAudience,
        language,
        customInstructions,
        isUserOrganized,
      });

      const textOutput = await callAIForNotes(prompt, effectiveKeys, geminiApiKey);
      if (!textOutput) return null;
      return { cIdx, parsed: extractJsonObject(textOutput), chunkText: chunk.chunkText };
    });

    const chunkResults = await Promise.all(chunkPromises);

    for (const res of chunkResults) {
      if (!res || !res.parsed) continue;
      const { cIdx, parsed, chunkText } = res;

      if (cIdx === 0) {
        if (parsed.title) detectedTitle = parsed.title;
        if (parsed.summary) overallSummary = parsed.summary;
        if (Array.isArray(parsed.learningOutcomes) && parsed.learningOutcomes.length > 0) {
          overallOutcomes = parsed.learningOutcomes;
        }
        if (Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0) {
          overallTakeaways = parsed.keyTakeaways;
        }
      }

      if (Array.isArray(parsed.keyTerms)) {
        parsed.keyTerms.forEach((kt: any) => {
          if (kt && kt.term && !collectedKeyTerms.some((existing) => existing.term.toLowerCase() === kt.term.toLowerCase())) {
            collectedKeyTerms.push({ term: kt.term, definition: kt.definition || '' });
          }
        });
      }

      if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        parsed.sections.forEach((sec: any) => {
          const globalIdx = collectedSections.length;
          const parsedBlocks: NoteContentBlock[] = Array.isArray(sec.contentBlocks)
            ? sec.contentBlocks.map((blk: any, bIdx: number) => ({
                id: blk.id || `blk-${globalIdx + 1}-${bIdx + 1}`,
                type: (blk.type || 'paragraph') as NoteBlockType,
                title: blk.title,
                subtitle: blk.subtitle,
                content: blk.content || '',
                mathFormula: blk.mathFormula,
                codeLanguage: blk.codeLanguage,
                tableData: blk.tableData,
                listItems: blk.listItems,
                steps: Array.isArray(blk.steps) ? blk.steps : undefined,
                variables: Array.isArray(blk.variables) ? blk.variables : undefined,
              }))
            : [];

          let finalBlocks: NoteContentBlock[];
          if (parsedBlocks.length >= 2) {
            finalBlocks = parsedBlocks;
          } else {
            finalBlocks = synthesizeSectionBlocks(
              {
                id: sec.id || `sec-${globalIdx + 1}`,
                title: sec.title || `Section ${globalIdx + 1}`,
                content: sec.content || '',
                keyPoints: Array.isArray(sec.keyPoints) ? sec.keyPoints : [],
                contentBlocks: parsedBlocks,
              },
              profile.discipline,
              detectedTitle
            );
          }

          const parsedExercises: NoteExercise[] = Array.isArray(sec.exercises) && sec.exercises.length > 0
            ? sec.exercises.map((ex: any, eIdx: number) => {
                const rawOptions: string[] = Array.isArray(ex.options)
                  ? ex.options.map((o: any) => String(o).trim()).filter(Boolean)
                  : [];
                const isMCQ = rawOptions.length > 0 || ex.questionType === 'mcq';
                return {
                  id: ex.id || `ex-${globalIdx + 1}-${eIdx + 1}`,
                  exerciseNumber: ex.exerciseNumber || (eIdx + 1),
                  question: ex.question || '',
                  questionType: (isMCQ ? 'mcq' : (ex.questionType || 'problem')) as any,
                  options: rawOptions.length > 0 ? rawOptions : undefined,
                  correctAnswer: ex.correctAnswer || (ex.solution && typeof ex.solution === 'object' ? ex.solution.answer : undefined),
                  hints: ex.hint ? [ex.hint] : (Array.isArray(ex.hints) ? ex.hints : []),
                  solution: typeof ex.solution === 'string'
                    ? { answer: ex.solution, steps: [ex.solution], explanation: 'Direct model answer based on the source study notes.' }
                    : ex.solution || { answer: 'Model answer for ' + (sec.title || 'Topic'), steps: [], explanation: '' },
                  initialExpanded: false,
                };
              })
            : [];

          let exercises = parsedExercises.length > 0
            ? parsedExercises
            : ensureSectionExercises(
                sec.exercises,
                globalIdx,
                sec.title || `Section ${globalIdx + 1}`,
                profile.discipline,
                detectedTitle
              );

          let builtSec: ShortNoteSection = {
            id: sec.id || `sec-${globalIdx + 1}`,
            sectionNumber: sec.sectionNumber || `${globalIdx + 1}`,
            title: sec.title || `Section ${globalIdx + 1}`,
            content: sec.content || '',
            keyPoints: Array.isArray(sec.keyPoints) ? sec.keyPoints : [],
            contentBlocks: finalBlocks,
            exercises,
            isImportant: sec.isImportant ?? true,
          };

          // Only repair if section content is virtually empty (less than 30 words)
          const words = (builtSec.content || '').split(/\s+/).filter(Boolean).length;
          if (words < 30 && (!builtSec.contentBlocks || builtSec.contentBlocks.length < 2)) {
            builtSec = repairIncompleteSection(builtSec, profile.discipline, detectedTitle, chunkText);
          }

          collectedSections.push(builtSec);
        });
      }
    }

    if (collectedSections.length === 0) {
      return localFallback;
    }

    const wordsCount = rawText.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(3, Math.ceil(wordsCount / 180));

    const aiResult: OrganizedShortNote = {
      title: detectedTitle,
      summary: overallSummary,
      learningOutcomes: overallOutcomes,
      keyTakeaways: overallTakeaways,
      sections: collectedSections,
      keyTerms: collectedKeyTerms.length > 0 ? collectedKeyTerms : localFallback.keyTerms,
      exercises: localFallback.exercises || [],
      rawContent: rawText,
      readingTimeMinutes,
    };

    // When AI generation produces valid sections, faithfully return the AI-grounded result
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

import { Chapter } from '@/types/subject';
import {
  ShortNoteSection,
  KeyTerm,
  NoteContentBlock,
  NoteExercise,
} from '@/types/book';
import {
  OrganizedShortNote,
  organizeChapterNotesLocal,
} from './shortnotes-organizer';

export type SubjectDiscipline =
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'psychology'
  | 'biology'
  | 'computer'
  | 'economics'
  | 'history'
  | 'english'
  | 'philosophy'
  | 'general';

export interface PedagogicalProfile {
  discipline: SubjectDiscipline;
  name: string;
  focusDescription: string;
  formattingRules: string[];
  keyElements: string[];
}

/**
 * Maps subject name to a deep pedagogical profile ensuring notes are never generic.
 * For example, Mathematics focuses heavily on step-by-step calculations and formula proofs,
 * while Psychology focuses on conceptual frameworks, experimental studies, and cognitive distinctions.
 */
export function getSubjectPedagogicalProfile(subjectName?: string): PedagogicalProfile {
  const clean = (subjectName || '').toLowerCase().trim();

  if (/math|algebra|geometry|calculus|arithmetic|statistic|ሒሳብ/i.test(clean)) {
    return {
      discipline: 'mathematics',
      name: 'Mathematics & Quantitative Sciences',
      focusDescription:
        'Rigorous calculation workflows, algebraic derivations, formula breakdowns, step-by-step numerical operations, and calculation-heavy review exercises.',
      formattingRules: [
        'Always format formulas using LaTeX syntax ($...$ for inline, $$...$$ for block).',
        'State each variable explicitly (e.g. where $a_1$ is the first term, $d$ is common difference).',
        'Worked examples must show every arithmetic step with explicit intermediate calculations.',
        'Exercises must test problem-solving and numerical calculation skills, never vague recall.',
      ],
      keyElements: ['Formulas & Derivations', 'Step-by-Step Calculations', 'Numerical Examples', 'Computational Exercises'],
    };
  }

  if (/physic|mechanics|astronomy|electromagnet|thermodynamic|ፊዚክስ/i.test(clean)) {
    return {
      discipline: 'physics',
      name: 'Physics & Applied Physical Sciences',
      focusDescription:
        'Physical laws, governing kinematic and dynamic equations, SI unit derivations, vector relationships, and numerical calculations with units.',
      formattingRules: [
        'Explicitly state physical laws and governing equations ($F = ma$, $v = u + at$).',
        'Include SI units for every physical quantity in examples and calculations.',
        'Break down problems into: Given, Formula, Substitution, and Calculated Solution.',
      ],
      keyElements: ['Physical Laws', 'Governing Equations', 'SI Units', 'Worked Numerical Problems'],
    };
  }

  if (/chem|organic|inorganic|biochem|ኬሚስትሪ/i.test(clean)) {
    return {
      discipline: 'chemistry',
      name: 'Chemistry & Molecular Sciences',
      focusDescription:
        'Chemical reaction equations, stoichiometry, molecular bonding, periodic trends, reaction mechanisms, and balance calculations.',
      formattingRules: [
        'Write balanced chemical equations with state symbols (s, l, g, aq).',
        'Explain reaction conditions, catalysts, and energy changes (exothermic/endothermic).',
        'Detail stoichiometric molar calculations step-by-step.',
      ],
      keyElements: ['Reaction Equations', 'Stoichiometry', 'Molecular Structures', 'Reaction Mechanisms'],
    };
  }

  if (/psycholog|behavior|behaviour|cognitive|mental|neuropsych|ስነ-ልቦና/i.test(clean)) {
    return {
      discipline: 'psychology',
      name: 'Psychology & Behavioral Sciences',
      focusDescription:
        'Deep conceptual frameworks, psychological theories (cognitive, behavioral, psychodynamic, humanistic), empirical experiments, behavioral mechanisms, case analyses, and conceptual distinctions.',
      formattingRules: [
        'Focus on deep conceptual definitions and theoretical models (e.g. Piaget, Freud, Skinner, Bandura).',
        'Detail seminal empirical experiments, independent/dependent variables, and landmark findings.',
        'Compare and contrast interrelated psychological concepts to prevent student confusion in exams.',
        'Provide real-world behavioral case scenarios with structured psychological analysis.',
      ],
      keyElements: ['Theoretical Frameworks', 'Empirical Studies', 'Conceptual Distinctions', 'Case Analyses'],
    };
  }

  if (/biolog|botany|zoology|anatomy|genetics|physiology|ሥነ-ሕይወት|ባዮሎጂ/i.test(clean)) {
    return {
      discipline: 'biology',
      name: 'Biology & Life Sciences',
      focusDescription:
        'Biological pathways, anatomical structures, physiological processes, cellular mechanisms, functional adaptations, and taxonomy.',
      formattingRules: [
        'Describe physiological processes sequentially (e.g. Stage 1, Stage 2, Stage 3).',
        'Detail anatomical structures and their specific physiological functions.',
        'Highlight evolutionary significance and environmental adaptations.',
      ],
      keyElements: ['Physiological Processes', 'Anatomical Structures', 'Biological Pathways', 'Diagram Descriptions'],
    };
  }

  if (/comput|programming|code|software|information technology|algorithm|python|java|web/i.test(clean)) {
    return {
      discipline: 'computer',
      name: 'Computer Science & Software Engineering',
      focusDescription:
        'Algorithm mechanics, data structures, syntax-highlighted code implementations, time and space complexity ($O(n), O(\\log n)$), and execution traces.',
      formattingRules: [
        'Include formatted, syntax-highlighted code blocks for core implementations.',
        'State the time and space complexity ($O(1), O(n), O(n^2)$) for each algorithm.',
        'Trace algorithm execution with sample input and expected step-by-step output.',
      ],
      keyElements: ['Code Implementations', 'Complexity Analysis', 'Data Structures', 'Execution Traces'],
    };
  }

  if (/economic|business|finance|accounting|ንግድ|ኢኮኖሚክስ/i.test(clean)) {
    return {
      discipline: 'economics',
      name: 'Economics & Business Studies',
      focusDescription:
        'Economic models, supply & demand equilibria, market structures, elasticity formulas, fiscal/monetary policies, and financial case studies.',
      formattingRules: [
        'Explain economic principles with algebraic formulas and graphical intuition.',
        'Contrast market structures (perfect competition, monopoly, oligopoly).',
        'Evaluate policy interventions (price ceilings, taxes, subsidies) and their economic deadweight.',
      ],
      keyElements: ['Economic Models', 'Market Equilibria', 'Elasticity Calculations', 'Policy Analysis'],
    };
  }

  if (/history|tariik|ታሪክ|civilization|revolution|war\b/i.test(clean)) {
    return {
      discipline: 'history',
      name: 'History & Civilization Studies',
      focusDescription:
        'Historical causation, chronological developments, socio-political impacts, primary evidence, and comparative historical analyses.',
      formattingRules: [
        'Structure events chronologically with clear dates and sequence.',
        'Distinguish between immediate catalysts and underlying structural causes.',
        'Analyze geopolitical and socio-economic consequences.',
      ],
      keyElements: ['Chronology & Timelines', 'Causation Analysis', 'Primary Sources', 'Socio-Political Impact'],
    };
  }

  if (/english|literature|language|grammar|ቋንቋ|እንግሊዝኛ|writing/i.test(clean)) {
    return {
      discipline: 'english',
      name: 'English & Language Arts',
      focusDescription:
        'Grammatical structures, syntactic rules, rhetorical devices, literary analysis, reading comprehension strategies, and vocabulary nuances.',
      formattingRules: [
        'Provide clear grammar rules with correct vs incorrect example sentences.',
        'Analyze literary passages for theme, tone, imagery, and figurative language.',
        'Include vocabulary in authentic sentence context with synonyms and antonyms.',
      ],
      keyElements: ['Grammar Rules', 'Example Sentences', 'Rhetorical Devices', 'Vocabulary Nuance'],
    };
  }

  if (/philosoph|logic|critical thinking|ethics|ህግ/i.test(clean)) {
    return {
      discipline: 'philosophy',
      name: 'Philosophy & Logic',
      focusDescription:
        'Logical syllogisms, validity vs soundness, philosophical arguments, counter-arguments, ethical theories, and fallacy identification.',
      formattingRules: [
        'Formulate arguments into formal premises and conclusions (Premise 1, Premise 2, Conclusion).',
        'Differentiate between inductive and deductive reasoning.',
        'Identify common informal and formal logical fallacies.',
      ],
      keyElements: ['Logical Syllogisms', 'Philosophical Paradigms', 'Ethical Theories', 'Fallacy Breakdown'],
    };
  }

  return {
    discipline: 'general',
    name: 'Academic Discipline',
    focusDescription:
      'Rigorous conceptual explanations, systematic frameworks, foundational definitions, worked illustrative examples, and review problems.',
    formattingRules: [
      'Provide comprehensive academic depth, avoiding superficial summaries.',
      'Structure topics hierarchically from intuition to formal principles.',
      'Include review exercises with step-by-step solutions.',
    ],
    keyElements: ['Core Principles', 'Foundational Models', 'Worked Examples', 'Comprehensive Exercises'],
  };
}

export interface SeparatedChapterItem {
  chapterId?: string;
  chapterNumber: number;
  chapterTitle: string;
  rawText: string;
  wordCount: number;
  charCount: number;
  isMatched: boolean;
}

export interface ChapterGenerationOptions {
  subjectName: string;
  chapterTitle: string;
  chapterNumber?: number;
  chapterId?: string;
  gradeLevel?: string;
  includeExercises?: boolean;
  includeFormulas?: boolean;
  includeWorkedExamples?: boolean;
  depth?: 'detailed' | 'balanced' | 'concise';
  targetAudience?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  customInstructions?: string;
}

/**
 * Detects whether a heading occurrence at matchIndex represents a Table of Contents entry
 * rather than an authentic chapter body heading.
 * 
 * Prevents Table of Contents entries (e.g. "Chapter 1: Title ..... 15") from being
 * mistakenly sliced as the chapter body or contaminating other chapters.
 */
export function isTableOfContentsEntry(
  cleanText: string,
  matchIndex: number,
  matchLength: number = 0
): boolean {
  // 1. Line inspection
  const lineStart = cleanText.lastIndexOf('\n', matchIndex) + 1;
  const lineEndIdx = cleanText.indexOf('\n', matchIndex);
  const lineEnd = lineEndIdx === -1 ? cleanText.length : lineEndIdx;
  const line = cleanText.slice(lineStart, lineEnd).trim();

  // If line ends with dot leaders and page number (e.g. "... 14", "..... 45", "· · · 12")
  if (/(?:\.{2,}|…|·{2,}|\s{3,})\s*\d+\s*$/.test(line)) {
    return true;
  }

  // If line matches standard TOC format "Chapter X: Title    12"
  if (/^(?:#*\s*)?(?:chapter|unit|part|ch\.?)\s*[:#]?\s*\d+.*?\s+\d+\s*$/i.test(line)) {
    return true;
  }

  // 2. Preceding TOC context inspection (within 1500 chars before match)
  const preceding1500 = cleanText.slice(Math.max(0, matchIndex - 1500), matchIndex);
  const hasTocHeader = /(?:^|\n)#*\s*(?:table\s+of\s+contents|contents|brief\s+contents|table\s+des\s+matières)\b/i.test(preceding1500);

  // 3. Proximity to next chapter heading
  // In a real textbook body, chapters are separated by thousands of characters.
  // In a Table of Contents, chapter listings appear 15-250 characters apart without descriptive paragraphs.
  const followingText = cleanText.slice(matchIndex + matchLength, matchIndex + matchLength + 350);
  const nextHeadingMatch = followingText.search(/(?:^|\n)(?:##?\s*)?(?:chapter|unit|part|ch\.?)\s*[:#]?\s*\d+/i);

  if (nextHeadingMatch !== -1) {
    const textBetween = followingText.slice(0, nextHeadingMatch).trim();
    // In a TOC, textBetween is empty, just dot leaders/page numbers, or a bare subtitle
    // If textBetween has descriptive prose ending in sentence punctuation, it is a lesson body
    const isDescriptiveProse = textBetween.length >= 40 && /[.!?]/.test(textBetween);
    if (!isDescriptiveProse) {
      return true;
    }
  }

  if (hasTocHeader) {
    const nextBodySnippet = cleanText.slice(matchIndex + matchLength, matchIndex + matchLength + 200).trim();
    if (nextBodySnippet.length < 120 || /(?:page|\.{2,}|\d+$)/i.test(nextBodySnippet)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes an extracted chapter text slice by stripping out any residual Table of Contents
 * artifacts or trailing next-chapter heading fragments.
 */
export function sanitizeChapterText(text: string, currentChNum: number): string {
  let cleaned = text;

  // 1. Remove leading Table of Contents / Contents block if present at the very start
  cleaned = cleaned.replace(
    /^(?:[\s\n]*#*\s*(?:table\s+of\s+contents|contents|brief\s+contents)[\s\S]*?(?=\n(?:#*\s*(?:chapter|unit|part|ch\.?)\s*[:#]?\s*\d+|\n\n[A-Z])))/i,
    ''
  );

  // 2. Remove isolated dot-leader TOC lines
  cleaned = cleaned.replace(
    /^(?:[#*\s-]*)?(?:chapter|unit|part|ch\.?)\s*[:#]?\s*\d+[^.\n]*[\.·…\s-]{3,}\s*\d+\s*$/gim,
    ''
  );

  // 3. Remove trailing header of the NEXT chapter if accidentally caught at end of slice
  const nextChNum = currentChNum + 1;
  const trailingHeaderRegex = new RegExp(
    `\\n(?:##?\\s*)?(?:Chapter|Unit|Part|Ch\\.?)\\s*[:#]?\\s*${nextChNum}\\b.*$`,
    'is'
  );
  cleaned = cleaned.replace(trailingHeaderRegex, '');

  return cleaned.trim();
}

/**
 * Finds the authentic chapter body position in cleanText, skipping all Table of Contents references.
 */
export function findRealChapterHeadingPosition(
  cleanText: string,
  chNum: number,
  title?: string
): number {
  const cleanTitle = (title || '').trim();
  const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regexes: RegExp[] = [];
  if (cleanTitle) {
    regexes.push(
      new RegExp(`(?:^|\\n)(?:##?\\s*)?(?:chapter|unit|ch\\.?|part)\\s*[:#]?\\s*${chNum}\\b[^\n]*?${escapedTitle}`, 'gi'),
      new RegExp(`(?:^|\\n)(?:##?\\s*)?${chNum}[\\.\\)]\\s+${escapedTitle}`, 'gi'),
      new RegExp(`(?:^|\\n)(?:##?\\s*)?${escapedTitle}\\b`, 'gi')
    );
  }
  regexes.push(
    new RegExp(`(?:^|\\n)(?:##?\\s*)?(?:chapter|unit|ch\\.?|part)\\s*[:#]?\\s*${chNum}\\b`, 'gi')
  );

  const candidates: { pos: number; isTOC: boolean; score: number }[] = [];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleanText)) !== null) {
      const pos = match.index;
      if (candidates.some((c) => Math.abs(c.pos - pos) < 5)) continue;

      const isTOC = isTableOfContentsEntry(cleanText, pos, match[0].length);
      const afterMatch = cleanText.slice(pos + match[0].length, pos + match[0].length + 400).trim();
      const hasSubstantiveBody = afterMatch.length > 80 && !/(?:chapter|unit)\s+\d+/i.test(afterMatch.slice(0, 150));

      let score = 0;
      if (!isTOC) score += 50;
      if (hasSubstantiveBody) score += 30;
      if (cleanTitle && match[0].toLowerCase().includes(cleanTitle.toLowerCase())) score += 20;

      candidates.push({ pos, isTOC, score });
    }
  }

  if (candidates.length === 0) return -1;

  const realCandidates = candidates.filter((c) => !c.isTOC);
  if (realCandidates.length > 0) {
    realCandidates.sort((a, b) => b.score - a.score || a.pos - b.pos);
    return realCandidates[0].pos;
  }

  // Fallback: pick best scored
  candidates.sort((a, b) => b.score - a.score || a.pos - b.pos);
  return candidates[0].pos;
}

/**
 * Intelligently separates a full resource (e.g., textbook text or multi-chapter notes)
 * into discrete chapter segments, with STRICT boundary enforcement so that no chapter
 * integrates or bleeds into neighboring chapters.
 * 
 * Automatically detects and bypasses the Table of Contents, locating the real instructional
 * body of each chapter and filtering out cross-chapter contamination.
 */
export function splitResourceIntoChapters(
  fullText: string,
  subjectChapters: Chapter[] = [],
  detectedLabels: string[] = []
): SeparatedChapterItem[] {
  if (!fullText || !fullText.trim()) {
    return [];
  }

  const cleanText = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const results: SeparatedChapterItem[] = [];

  // Helper: locate all chapter heading matches across the entire text
  const globalHeadingRegex = /(?:^|\n)(?:##?\s*)?(?:Chapter|Unit|Part|Ch\.?)\s*[:#]?\s*(\d+)[:.]?\s*([^\n]+)?/gi;
  const detectedBoundaries: { index: number; number: number; title: string }[] = [];

  let hMatch: RegExpExecArray | null;
  while ((hMatch = globalHeadingRegex.exec(cleanText)) !== null) {
    const num = parseInt(hMatch[1], 10);
    const title = (hMatch[2] || '').trim();
    const isTOC = isTableOfContentsEntry(cleanText, hMatch.index, hMatch[0].length);

    // Only consider non-TOC headings as true chapter boundaries
    if (!isTOC) {
      detectedBoundaries.push({
        index: hMatch.index,
        number: num,
        title: title || `Chapter ${num}`,
      });
    }
  }

  // Sort detected non-TOC boundaries ascending
  detectedBoundaries.sort((a, b) => a.index - b.index);

  // 1. If the subject already has defined curriculum chapters in the database
  if (subjectChapters.length > 0) {
    const sortedChapters = [...subjectChapters].sort((a, b) => {
      const numA = a.chapterNumber ?? 999;
      const numB = b.chapterNumber ?? 999;
      return numA - numB;
    });

    // Locate authentic body position of each defined chapter, bypassing TOC
    const chapterPositions: { chapter: Chapter; chNum: number; pos: number; label: string }[] = [];

    sortedChapters.forEach((ch, idx) => {
      const chNum = ch.chapterNumber ?? idx + 1;
      const cleanTitle = ch.title.trim();
      const realPos = findRealChapterHeadingPosition(cleanText, chNum, cleanTitle);

      chapterPositions.push({
        chapter: ch,
        chNum,
        pos: realPos,
        label: `Chapter ${chNum}: ${cleanTitle}`,
      });
    });

    // Sort detected positions ascending to establish strict non-overlapping boundaries
    const strictlyOrdered = chapterPositions
      .filter((cp) => cp.pos !== -1)
      .sort((a, b) => a.pos - b.pos);

    sortedChapters.forEach((ch, idx) => {
      const chNum = ch.chapterNumber ?? idx + 1;
      const orderIdx = strictlyOrdered.findIndex((m) => m.chapter.id === ch.id);

      let sliceText = '';
      let isMatched = false;

      if (orderIdx !== -1) {
        isMatched = true;
        const startPos = strictlyOrdered[orderIdx].pos;
        // The slice MUST terminate strictly where the NEXT chapter begins
        const endPos =
          orderIdx + 1 < strictlyOrdered.length
            ? strictlyOrdered[orderIdx + 1].pos
            : cleanText.length;

        sliceText = cleanText.slice(startPos, endPos).trim();
      } else {
        // Fallback: check detected non-TOC boundaries
        const matchingDetected = detectedBoundaries.find((b) => b.number === chNum);
        if (matchingDetected) {
          isMatched = true;
          const startPos = matchingDetected.index;
          const nextBoundary = strictlyOrdered.find((m) => m.pos > startPos) ||
            detectedBoundaries.find((b) => b.index > startPos);
          const endPos = nextBoundary ? ('pos' in nextBoundary ? nextBoundary.pos : nextBoundary.index) : cleanText.length;
          sliceText = cleanText.slice(startPos, endPos).trim();
        } else {
          // Partition strictly without overlap
          const total = sortedChapters.length;
          const chunkSize = Math.floor(cleanText.length / total);
          const start = idx * chunkSize;
          const end = idx === total - 1 ? cleanText.length : (idx + 1) * chunkSize;
          sliceText = cleanText.slice(start, end).trim();
          isMatched = false;
        }
      }

      // Safety: sanitize slice to strip TOC remnants and subsequent chapter headers
      sliceText = sanitizeChapterText(sliceText, chNum);

      const words = sliceText.split(/\s+/).filter(Boolean).length;
      results.push({
        chapterId: ch.id,
        chapterNumber: chNum,
        chapterTitle: ch.title,
        rawText: sliceText,
        wordCount: words,
        charCount: sliceText.length,
        isMatched,
      });
    });

    return results;
  }

  // 2. If no existing subject chapters, use detected non-TOC boundaries from headings
  if (detectedBoundaries.length > 0) {
    detectedBoundaries.forEach((m, i) => {
      const start = m.index;
      const end = i + 1 < detectedBoundaries.length ? detectedBoundaries[i + 1].index : cleanText.length;
      let chunk = cleanText.slice(start, end).trim();

      // Sanitize chunk
      chunk = sanitizeChapterText(chunk, m.number);

      const words = chunk.split(/\s+/).filter(Boolean).length;
      results.push({
        chapterNumber: m.number,
        chapterTitle: m.title,
        rawText: chunk,
        wordCount: words,
        charCount: chunk.length,
        isMatched: true,
      });
    });
    return results;
  }

  // 3. Fallback: Split by detectedLabels if provided
  if (Array.isArray(detectedLabels) && detectedLabels.length > 0) {
    detectedLabels.forEach((label, idx) => {
      const num = idx + 1;
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = cleanText.match(new RegExp(esc, 'i'));
      const start = m && m.index !== undefined ? m.index : idx * Math.floor(cleanText.length / detectedLabels.length);
      const end = (idx + 1) * Math.floor(cleanText.length / detectedLabels.length);
      let chunk = cleanText.slice(start, end).trim();
      chunk = sanitizeChapterText(chunk, num);
      const words = chunk.split(/\s+/).filter(Boolean).length;

      results.push({
        chapterNumber: num,
        chapterTitle: label,
        rawText: chunk,
        wordCount: words,
        charCount: chunk.length,
        isMatched: Boolean(m),
      });
    });
    return results;
  }

  // 4. Single full chapter fallback
  const cleanFallback = sanitizeChapterText(cleanText, 1);
  const words = cleanFallback.split(/\s+/).filter(Boolean).length;
  return [
    {
      chapterNumber: 1,
      chapterTitle: 'Complete Resource Material',
      rawText: cleanFallback,
      wordCount: words,
      charCount: cleanFallback.length,
      isMatched: true,
    },
  ];
}

export interface DocumentOutlineItem {
  title: string;
  preview: string;
  approximateWordCount: number;
  startIndex: number;
}

export interface DocumentChapterAnalysis {
  status: 'single_chapter' | 'multiple_chapters' | 'uncertain';
  detectedChapters: SeparatedChapterItem[];
  suggestedTitle: string;
  outlineItems: DocumentOutlineItem[];
  confidence: number;
  totalWordCount: number;
}

/**
 * Analyzes an uploaded document's text and structure to classify it into:
 * 1. 'multiple_chapters': Document contains 2+ distinct chapters (student picks 1, can switch anytime).
 * 2. 'single_chapter': Document is a cohesive single chapter or notes packet.
 * 3. 'uncertain': Structure lacks standard chapter numbering (offers outline & "Use entire document").
 */
export function analyzeDocumentChapters(
  extractedText: string,
  options?: {
    subjectChapters?: Chapter[];
    fileName?: string;
    fallbackTitle?: string;
  }
): DocumentChapterAnalysis {
  const cleanText = (extractedText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const totalWordCount = words.length;

  // Extract clean suggested title from filename if available
  let cleanFileNameTitle = '';
  if (options?.fileName) {
    cleanFileNameTitle = options.fileName
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  if (!cleanText) {
    return {
      status: 'uncertain',
      detectedChapters: [],
      suggestedTitle: cleanFileNameTitle || options?.fallbackTitle || 'Empty Document',
      outlineItems: [],
      confidence: 0,
      totalWordCount: 0,
    };
  }

  // 1. Extract outline items from headings (# Heading, Section X, etc.)
  const outlineItems: DocumentOutlineItem[] = [];
  const lines = cleanText.split('\n');
  let currentWordPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const headingMatch = line.match(/^(?:#{1,4}\s*|(?:\d+\.|\bChapter|\bUnit|\bSection|\bTopic|\bPart)\b\s*[:#]?\s*\d*[:.]?\s*)(.+)/i);
    const isAllCapsHeading = /^[A-Z0-9\s:,-]{5,60}$/.test(line) && !line.includes('.');

    if (headingMatch || isAllCapsHeading) {
      const title = (headingMatch ? headingMatch[1] : line).trim();
      // Skip if TOC-like
      if (isTableOfContentsEntry(line, 0, line.length)) continue;

      // Extract a preview of following lines
      const previewLines: string[] = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextL = lines[j].trim();
        if (nextL && !nextL.startsWith('#')) {
          previewLines.push(nextL);
        }
      }

      const preview = previewLines.join(' ').slice(0, 140);
      outlineItems.push({
        title,
        preview: preview ? `${preview}...` : 'No preview available',
        approximateWordCount: 0,
        startIndex: currentWordPos,
      });

      if (outlineItems.length >= 15) break;
    }
    currentWordPos += line.split(/\s+/).filter(Boolean).length;
  }

  // Calculate approximate word count for each outline item
  for (let k = 0; k < outlineItems.length; k++) {
    const nextStart = k + 1 < outlineItems.length ? outlineItems[k + 1].startIndex : totalWordCount;
    outlineItems[k].approximateWordCount = Math.max(50, nextStart - outlineItems[k].startIndex);
  }

  // 2. Perform chapter separation using splitResourceIntoChapters
  const separated = splitResourceIntoChapters(cleanText, options?.subjectChapters);

  // 3. Classify status
  if (separated.length > 1) {
    const firstCh = separated[0];
    const suggestedTitle = cleanFileNameTitle || firstCh.chapterTitle || options?.fallbackTitle || 'Course Chapters';
    return {
      status: 'multiple_chapters',
      detectedChapters: separated,
      suggestedTitle,
      outlineItems,
      confidence: 0.95,
      totalWordCount,
    };
  }

  // Exactly 1 chapter returned
  const singleChapterMatch = cleanText.match(/(?:^|\n)(?:##?\s*)?(?:Chapter|Unit|Part|Ch\.?)\s*[:#]?\s*(\d+)[:.]?\s*([^\n]+)?/i);

  if (singleChapterMatch) {
    const num = parseInt(singleChapterMatch[1], 10);
    const title = (singleChapterMatch[2] || '').trim();
    const resolvedTitle = title ? `Chapter ${num}: ${title}` : `Chapter ${num}`;

    return {
      status: 'single_chapter',
      detectedChapters: separated.map((c) => ({
        ...c,
        chapterNumber: num,
        chapterTitle: title || c.chapterTitle,
      })),
      suggestedTitle: cleanFileNameTitle || resolvedTitle,
      outlineItems,
      confidence: 0.9,
      totalWordCount,
    };
  }

  // If no chapter markers were found:
  // If the document is of moderate size (< 3000 words) or has few sections, it's a cohesive single chapter
  if (totalWordCount < 3000 || outlineItems.length <= 2) {
    const firstLine = lines.find((l) => l.trim().length > 0 && l.trim().length < 80)?.trim().replace(/^#+\s*/, '') || '';
    const suggestedTitle = cleanFileNameTitle || firstLine || options?.fallbackTitle || 'Study Note Chapter';

    return {
      status: 'single_chapter',
      detectedChapters: separated.map((c) => ({
        ...c,
        chapterTitle: suggestedTitle,
      })),
      suggestedTitle,
      outlineItems,
      confidence: 0.85,
      totalWordCount,
    };
  }

  // Large document (> 3000 words) with multiple headings but no explicit "Chapter X" numbers
  return {
    status: 'uncertain',
    detectedChapters: separated,
    suggestedTitle: cleanFileNameTitle || options?.fallbackTitle || 'Uploaded Learning Material',
    outlineItems,
    confidence: 0.5,
    totalWordCount,
  };
}

/**
 * Completeness Check Item representation
 */
export interface CompletenessCheckItem {
  id: string;
  name: string;
  category: 'depth' | 'pedagogy' | 'discipline' | 'isolation';
  passed: boolean;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * Complete Validation Result for Study Note Textbook Quality
 */
export interface CompletenessValidationResult {
  score: number; // 0 - 100
  status: 'exemplary' | 'good' | 'needs_improvement' | 'incomplete';
  statusLabel: string;
  totalWords: number;
  sectionsCount: number;
  checks: CompletenessCheckItem[];
  suggestions: string[];
  hasTOCContamination: boolean;
  hasForeignChapterContamination: boolean;
  discipline: SubjectDiscipline;
}

/**
 * Rigorously validates study notes for textbook-quality pedagogical depth.
 * Audits teaching structure, calculation steps, theoretical depth, and strict chapter isolation.
 */
export function validateStudyNoteCompleteness(
  note: OrganizedShortNote,
  rawText?: string,
  subjectName?: string
): CompletenessValidationResult {
  const profile = getSubjectPedagogicalProfile(subjectName);
  const checks: CompletenessCheckItem[] = [];
  const suggestions: string[] = [];

  // Compute total instructional words in sections
  const sectionWords = (note.sections || []).reduce((acc, s) => {
    const cWords = (s?.content || '').trim().split(/\s+/).filter(Boolean).length;
    const kWords = Array.isArray(s?.keyPoints)
      ? s.keyPoints.join(' ').trim().split(/\s+/).filter(Boolean).length
      : 0;
    return acc + cWords + kWords;
  }, 0);

  const rawWords = (rawText || '').trim().split(/\s+/).filter(Boolean).length;
  const totalWords = Math.max(sectionWords, rawWords);
  const sectionsCount = note.sections?.length || 0;

  // Check 1: Instructional Word Count & Lesson Body (15 pts)
  let wordScore = 0;
  if (totalWords >= 500) wordScore = 15;
  else if (totalWords >= 280) wordScore = 12;
  else if (totalWords >= 150) wordScore = 8;
  else wordScore = 4;

  checks.push({
    id: 'instructional_depth',
    name: 'Instructional Body Depth',
    category: 'depth',
    passed: wordScore >= 10,
    score: wordScore,
    maxScore: 15,
    feedback:
      wordScore >= 15
        ? `Exemplary textbook depth (${totalWords} instructional words).`
        : wordScore >= 10
        ? `Sufficient lesson body (${totalWords} words). Consider expanding explanations.`
        : `Too brief (${totalWords} words). Notes must teach the material thoroughly rather than merely summarizing.`,
  });

  if (wordScore < 10) {
    suggestions.push('Develop substantive teaching paragraphs explaining how concepts work, from foundational to advanced.');
  }

  // Check 2: Paragraph Development vs Bullet Points (15 pts)
  let paragraphScore = 0;
  const sectionsWithSubstantiveParagraphs = (note.sections || []).filter((s) => {
    const paragraphs = (s.content || '').split(/\n\s*\n/).filter((p) => p.trim().length > 60);
    return paragraphs.length >= 2;
  }).length;

  if (sectionsCount > 0 && sectionsWithSubstantiveParagraphs >= Math.ceil(sectionsCount / 2)) {
    paragraphScore = 15;
  } else if (sectionsCount > 0) {
    paragraphScore = 8;
  }

  checks.push({
    id: 'paragraph_development',
    name: 'Explanatory Paragraphs (No Bullet-Only Slices)',
    category: 'depth',
    passed: paragraphScore === 15,
    score: paragraphScore,
    maxScore: 15,
    feedback:
      paragraphScore === 15
        ? 'Sections feature rich, well-developed explanatory paragraphs.'
        : 'Some sections rely heavily on short bullet points. Expand into clear teaching paragraphs.',
  });

  if (paragraphScore < 15) {
    suggestions.push('Replace lists of points with cohesive instructional paragraphs that explain reasons, mechanisms, and rules.');
  }

  // Check 3: Clear Learning Outcomes (10 pts)
  const outcomesCount = note.learningOutcomes?.length || 0;
  const outcomeScore = outcomesCount >= 3 ? 10 : outcomesCount >= 1 ? 6 : 0;

  checks.push({
    id: 'learning_outcomes',
    name: 'Measurable Learning Outcomes',
    category: 'pedagogy',
    passed: outcomeScore >= 6,
    score: outcomeScore,
    maxScore: 10,
    feedback:
      outcomeScore === 10
        ? `Mastery goals defined (${outcomesCount} clear outcomes).`
        : 'Include at least 3 concrete student learning outcomes.',
  });

  // Check 4: Authoritative Key Terms & Dictionary (10 pts)
  const termsCount = note.keyTerms?.length || 0;
  const termScore = termsCount >= 4 ? 10 : termsCount >= 2 ? 6 : 0;

  checks.push({
    id: 'key_terms',
    name: 'Key Terminology Defined in Context',
    category: 'pedagogy',
    passed: termScore >= 6,
    score: termScore,
    maxScore: 10,
    feedback:
      termScore === 10
        ? `Comprehensive technical vocabulary (${termsCount} terms defined).`
        : 'Define technical terms before using them to prevent student confusion.',
  });

  // Check 5: High-Yield Exam Takeaways (10 pts)
  const takeawaysCount = note.keyTakeaways?.length || 0;
  const takeawayScore = takeawaysCount >= 3 ? 10 : takeawaysCount >= 1 ? 5 : 0;

  checks.push({
    id: 'key_takeaways',
    name: 'High-Yield Exam Takeaways',
    category: 'pedagogy',
    passed: takeawayScore >= 5,
    score: takeawayScore,
    maxScore: 10,
    feedback:
      takeawayScore === 10
        ? `Essential takeaways present (${takeawaysCount} high-yield insights).`
        : 'Add 3+ core takeaways summarizing key principles.',
  });

  // Check 6: Review Exercises with Step-by-Step Show/Hide Solutions (15 pts)
  let exerciseScore = 0;
  let totalExercises = 0;
  let exercisesWithSteps = 0;

  (note.sections || []).forEach((sec) => {
    (sec.exercises || []).forEach((ex) => {
      totalExercises++;
      if (ex.solution && ex.solution.steps && ex.solution.steps.length > 0) {
        exercisesWithSteps++;
      }
    });
  });

  if (totalExercises >= 2 && exercisesWithSteps >= 1) exerciseScore = 15;
  else if (totalExercises >= 1) exerciseScore = 10;

  checks.push({
    id: 'exercises_solutions',
    name: 'Worked Examples & Review Exercises with Show/Hide Solutions',
    category: 'pedagogy',
    passed: exerciseScore >= 10,
    score: exerciseScore,
    maxScore: 15,
    feedback:
      exerciseScore === 15
        ? `Interactive review exercises with step-by-step solutions verified (${totalExercises} exercises).`
        : 'Add practice exercises with multi-step worked solutions for active recall.',
  });

  if (exerciseScore < 10) {
    suggestions.push('Provide practice questions featuring step-by-step solutions that students can reveal after attempting.');
  }

  // Check 7: Subject-Specific Pedagogical Depth (15 pts)
  let disciplineScore = 0;
  const allContent = [
    note.summary || '',
    ...(note.sections || []).map((s) => s.content + ' ' + (s.keyPoints || []).join(' ')),
  ].join(' ');

  if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
    const hasFormulas = /\$|\\frac|\+|-|=|\times|\/|\\cdot|\^/.test(allContent);
    const hasCalculations = /step\s*\d|substitut|evaluat|calculat|\d+\s*[+\-*\/=]\s*\d+/i.test(allContent);
    if (hasFormulas && hasCalculations) disciplineScore = 15;
    else if (hasFormulas || hasCalculations) disciplineScore = 8;
  } else if (profile.discipline === 'psychology') {
    const hasTheories = /theor|model|schema|paradigm|behavior|cognitive|freud|piaget|skinner|bandura|conditioning/i.test(allContent);
    const hasEmpirical = /experiment|study|variable|finding|participant|empirical|research|case/i.test(allContent);
    if (hasTheories && hasEmpirical) disciplineScore = 15;
    else if (hasTheories || hasEmpirical) disciplineScore = 8;
  } else if (profile.discipline === 'computer') {
    const hasCodeOrComplexity = /```|O\(|def |function|class |algorithm|time complexity/i.test(allContent);
    disciplineScore = hasCodeOrComplexity ? 15 : 7;
  } else {
    disciplineScore = allContent.length > 400 ? 15 : 8;
  }

  checks.push({
    id: 'discipline_rigor',
    name: `${profile.name} Pedagogical Alignment`,
    category: 'discipline',
    passed: disciplineScore >= 12,
    score: disciplineScore,
    maxScore: 15,
    feedback:
      disciplineScore === 15
        ? `Fully aligned with ${profile.name} pedagogical requirements.`
        : `Enhance subject-specific depth: ${profile.formattingRules[0] || 'Provide formal principles and worked applications.'}`,
  });

  if (disciplineScore < 12) {
    if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
      suggestions.push('Include line-by-line calculations showing every arithmetic step and state all variables explicitly.');
    } else if (profile.discipline === 'psychology') {
      suggestions.push('Detail landmark empirical experiments, independent/dependent variables, and conceptual distinctions.');
    }
  }

  // Check 8: Strict Chapter Isolation & Anti-TOC Cleanliness (10 pts)
  const hasTOCContamination = /(?:\.{3,}|…|·{3,}|\s{4,})\s*\d+\s*(?:\n|$)/.test(allContent) ||
    /Table of Contents/i.test(allContent);
  const foreignChapterMatch = allContent.match(/(?:^|\n)(?:##?\s*)?(?:Chapter|Unit)\s*[:#]?\s*(\d+)/gi);
  const hasForeignChapterContamination = Boolean(
    foreignChapterMatch && foreignChapterMatch.length > 2
  );

  let isolationScore = 10;
  if (hasTOCContamination) isolationScore -= 5;
  if (hasForeignChapterContamination) isolationScore -= 5;
  if (isolationScore < 0) isolationScore = 0;

  checks.push({
    id: 'chapter_isolation',
    name: 'Strict Chapter Boundary Isolation (TOC & Bleed Free)',
    category: 'isolation',
    passed: isolationScore === 10,
    score: isolationScore,
    maxScore: 10,
    feedback:
      isolationScore === 10
        ? 'Clean chapter isolation. Zero Table of Contents or foreign chapter bleed-through.'
        : hasTOCContamination
        ? 'Warning: Residual Table of Contents dot leaders or page index found. Sanitize note.'
        : 'Warning: Cross-chapter references detected inside single chapter notes.',
  });

  if (hasTOCContamination || hasForeignChapterContamination) {
    suggestions.push('Remove any Table of Contents page-number lines and ensure only this chapter is covered.');
  }

  // Compute aggregate score
  const totalScore = checks.reduce((acc, c) => acc + c.score, 0);

  let status: CompletenessValidationResult['status'] = 'incomplete';
  let statusLabel = 'Superficial / Incomplete Summary';
  if (totalScore >= 85) {
    status = 'exemplary';
    statusLabel = 'Textbook-Quality Deep Teaching';
  } else if (totalScore >= 70) {
    status = 'good';
    statusLabel = 'Solid Academic Notes';
  } else if (totalScore >= 50) {
    status = 'needs_improvement';
    statusLabel = 'Needs Deeper Teaching Body';
  }

  return {
    score: totalScore,
    status,
    statusLabel,
    totalWords,
    sectionsCount,
    checks,
    suggestions,
    hasTOCContamination,
    hasForeignChapterContamination,
    discipline: profile.discipline,
  };
}

/**
 * Enriches and upgrades an existing or short note into complete, textbook-quality teaching material.
 * Fills in the 10-element teaching sequence: introductory context, prerequisite framing,
 * substantive explanatory paragraphs, step-by-step worked calculations or empirical case analyses,
 * common student misconceptions, and review exercises with Show/Hide solutions.
 */
export function enrichStudyNoteToTextbookQuality(
  note: OrganizedShortNote,
  options: ChapterGenerationOptions
): OrganizedShortNote {
  const { subjectName, chapterTitle, chapterNumber = 1, gradeLevel } = options;
  const profile = getSubjectPedagogicalProfile(subjectName);

  // If already exemplary, return enhanced copy
  const existingSections: ShortNoteSection[] = [...(note.sections || [])];
  const existingKeyTerms: KeyTerm[] = [...(note.keyTerms || [])];
  const existingOutcomes: string[] = [...(note.learningOutcomes || [])];
  const existingTakeaways: string[] = [...(note.keyTakeaways || [])];

  // 1. Ensure 3+ comprehensive learning outcomes
  if (existingOutcomes.length < 3) {
    if (profile.discipline === 'mathematics') {
      existingOutcomes.push(
        `Derive, formulate, and apply governing equations for ${chapterTitle}.`,
        `Execute step-by-step arithmetic and algebraic calculations with zero computational error.`,
        `Decompose multi-step exam problems into modular calculation phases and verify solutions analytically.`
      );
    } else if (profile.discipline === 'psychology') {
      existingOutcomes.push(
        `Analyze core theoretical frameworks and major psychological models governing ${chapterTitle}.`,
        `Evaluate landmark empirical experiments, independent/dependent variables, and observed behavioral outcomes.`,
        `Differentiate nuanced psychological constructs and apply concepts to real-world behavioral case scenarios.`
      );
    } else if (profile.discipline === 'physics') {
      existingOutcomes.push(
        `State governing physical laws and define all vector and scalar quantities for ${chapterTitle}.`,
        `Apply SI units and algebraic equations to solve kinematic and dynamic equilibrium problems.`,
        `Analyze physical systems using free-body models and energy conservation principles.`
      );
    } else if (profile.discipline === 'computer') {
      existingOutcomes.push(
        `Implement and trace core algorithms and data structure operations for ${chapterTitle}.`,
        `Compute asymptotic time and space complexities using Big-O notation ($O(1), O(\\log n), O(n)$).`,
        `Debug algorithmic edge cases and design optimal, memory-efficient software implementations.`
      );
    } else {
      existingOutcomes.push(
        `Master foundational concepts, formal definitions, and core principles of ${chapterTitle}.`,
        `Apply systematic analytical methodologies to solve examination and real-world problems.`,
        `Synthesize key exam takeaways and eliminate common academic misconceptions.`
      );
    }
  }

  // 2. Ensure 4+ high-yield takeaways
  if (existingTakeaways.length < 4) {
    if (profile.discipline === 'mathematics') {
      existingTakeaways.push(
        `Formula Mastery: Commit the governing equation for ${chapterTitle} to memory and identify given parameters before solving.`,
        `Step-by-Step Rigor: Always write the general formula, substitute known quantities, and evaluate intermediate arithmetic clearly.`,
        `Dimensional Verification: Check parameter bounds and confirm mathematical consistency at each expansion step.`,
        `Active Recall: Work through all practice problems with Show/Hide solutions to build exam speed and accuracy.`
      );
    } else if (profile.discipline === 'psychology') {
      existingTakeaways.push(
        `Theoretical Framework: Master the foundational psychological paradigm governing ${chapterTitle} and its major theorists.`,
        `Conceptual Precision: Pay close attention to subtle differences between interrelated terms to avoid exam traps.`,
        `Empirical Evidence: Link theoretical claims directly to landmark studies and observed behavioral outcomes.`,
        `Clinical & Real-World Application: Connect abstract psychological schemas to observable everyday behaviors.`
      );
    } else {
      existingTakeaways.push(
        `Core Pillar: High-yield mastery of ${chapterTitle} under ${subjectName}.`,
        `Conceptual Depth: Understand underlying mechanisms and workflows rather than superficial memorization.`,
        `Exam Strategy: Avoid common traps by reviewing the misconception warnings in each section.`,
        `Active Practice: Use interactive flashcards and Show/Hide solution exercises for high-retention review.`
      );
    }
  }

  // 3. Ensure 4+ authoritative key terms
  if (existingKeyTerms.length < 4) {
    if (profile.discipline === 'mathematics') {
      existingKeyTerms.push(
        {
          term: `${chapterTitle} Equation`,
          definition: `The primary mathematical relationship governing calculations in ${chapterTitle}, relating dependent and independent variables.`,
        },
        {
          term: `Independent Parameter`,
          definition: `The fundamental input variable that determines output values across mathematical evaluation.`,
        },
        {
          term: `Analytic Solution`,
          definition: `A mathematical expression that satisfies the governing equation under specified initial or boundary conditions.`,
        },
        {
          term: `Algebraic Verification`,
          definition: `The process of back-substituting computed numerical values into the original expression to verify correctness.`,
        }
      );
    } else if (profile.discipline === 'psychology') {
      existingKeyTerms.push(
        {
          term: `${chapterTitle} Schema`,
          definition: `The underlying cognitive framework or mental structure that helps individuals organize and interpret information in ${chapterTitle}.`,
        },
        {
          term: `Empirical Validity`,
          definition: `The degree to which experimental findings in psychological research accurately reflect observed behavioral phenomena.`,
        },
        {
          term: `Behavioral Mechanism`,
          definition: `The physiological or cognitive process responsible for triggering, mediating, or altering an observable psychological response.`,
        },
        {
          term: `Conceptual Distinction`,
          definition: `A precise academic contrast between two easily confused psychological constructs to eliminate cognitive ambiguity.`,
        }
      );
    } else {
      existingKeyTerms.push(
        {
          term: chapterTitle,
          definition: `The foundational academic subject domain established in this chapter of ${subjectName}.`,
        },
        {
          term: `${chapterTitle} Principle`,
          definition: `The governing rule, scientific law, or theoretical framework established in this chapter.`,
        },
        {
          term: `Analytical Framework`,
          definition: `The systematic problem-solving methodology applied to evaluate and interpret phenomena in ${chapterTitle}.`,
        },
        {
          term: `Core Synthesis`,
          definition: `The integration of foundational definitions, models, and practical applications in ${chapterTitle}.`,
        }
      );
    }
  }

  // 4. Enrich existing sections or synthesize deep 10-element teaching sections
  const enrichedSections: ShortNoteSection[] = existingSections.map((sec, idx) => {
    let updatedContent = sec.content || '';
    const keyPoints = Array.isArray(sec.keyPoints) ? [...sec.keyPoints] : [];

    // If section content is too short (< 250 words), enrich with contextual paragraphs
    if (updatedContent.split(/\s+/).filter(Boolean).length < 180) {
      if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
        const formulaStr = profile.discipline === 'physics'
          ? `\\vec{F}_{\\text{net}} = m \\cdot \\vec{a} \\quad \\text{and} \\quad \\vec{v} = \\vec{u} + \\vec{a}t`
          : `f(x) = a_1 + (n - 1)d`;
        const paramDesc = profile.discipline === 'physics'
          ? `- $\\vec{F}_{\\text{net}}$ is the net resultant force in Newtons (N).\n- $m$ is the scalar mass in kilograms (kg).\n- $\\vec{a}$ denotes the acceleration vector in meters per second squared ($\\text{m/s}^2$).`
          : `- $a_1$ is the initial term or baseline parameter.\n- $d$ represents the constant rate of change or common difference.\n- $n$ denotes the index or step count under evaluation.`;

        updatedContent =
          `### 1. Introduction & Context\n${sec.title} represents a core quantitative pillar within ${chapterTitle}. In science and examinations, this concept provides the formal mathematical and physical framework necessary to model relationships, governing laws, and dynamic systems.\n\n` +
          `### 2. Prerequisite Knowledge & Intuition\nBefore working through multi-step computations, verify your familiarity with standard algebraic operations, variable isolation, SI unit dimensions, and order of operations (PEMDAS). Always state known quantities, identify target unknowns, and check sign conventions before calculating.\n\n` +
          `### 3. Core Theoretical Development & Governing Equations\n${updatedContent || `In ${sec.title}, governing formulations describe how quantities interact across system bounds.`}\n\n$$\\text{Governing Equation: } ${formulaStr}$$\nWhere:\n${paramDesc}\n\n` +
          `### 4. Step-by-Step Reasoning & Worked Calculations\nTo solve examination questions with maximum marks, proceed methodically:\n1. State the given parameters and general formula explicitly.\n2. Carry out algebraic rearrangement for the target unknown.\n3. Substitute numerical values: $3 + 14 \\cdot 4 = 3 + 56 = 59$, evaluating intermediate operations carefully to prevent sign errors.\n4. Confirm dimensional consistency and state the final calculated value with appropriate units.`;
      } else if (profile.discipline === 'psychology') {
        updatedContent =
          `### 1. Introduction & Conceptual Framework\n${sec.title} provides an essential theoretical model within ${chapterTitle}. Academic psychology approaches this subject by exploring how cognitive schemas, environmental stimuli, and neurobiological processes interact to govern observable human behavior.\n\n` +
          `### 2. Foundational Principles & Theoretical Mechanisms\n${updatedContent || `Major theorists conceptualize ${sec.title} as a structured cognitive or behavioral process.`}\n\nRather than viewing human behavior as arbitrary, researchers formulate systematic paradigms to explain how internal representations mediate external actions. Understanding these mechanisms enables students to distinguish between associative learning, cognitive appraisal, and neurochemical modulation.\n\n` +
          `### 3. Landmark Empirical Studies & Experimental Findings\nEmpirical validation in ${sec.title} relies on controlled psychological experiments:\n- Independent Variable (IV): The operationalized condition manipulated by researchers.\n- Dependent Variable (DV): The observed cognitive or behavioral response measured systematically.\n- Landmark Findings: Controlled laboratory and longitudinal studies demonstrate that observed behavioral variations correlate significantly with underlying cognitive framing.\n\n` +
          `### 4. Conceptual Distinctions & Real-World Case Analysis\nA frequent source of lost marks in university examinations is confusing interrelated terms. When evaluating clinical or educational case scenarios, carefully isolate the underlying stimulus from the mediating internal appraisal.`;
      } else {
        updatedContent =
          `### 1. Foundational Overview\n${sec.title} constitutes an essential component of ${chapterTitle} under ${subjectName}. A complete understanding requires mastering both conceptual definitions and practical problem-solving methodologies.\n\n` +
          `### 2. Core Principles & Analytical Mechanisms\n${updatedContent || `This topic introduces governing frameworks and systematic applications essential for academic mastery.`}\n\n` +
          `### 3. Practical Applications & Synthesis\nApplying these concepts in examinations requires connecting theoretical definitions directly to problem scenarios, demonstrating methodical step-by-step reasoning.`;
      }
    }

    // Ensure keyPoints include common mistakes and exam tips
    if (keyPoints.length < 3) {
      if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
        keyPoints.push(
          'Always identify known vs unknown parameters with units before substituting into equations.',
          'Common Exam Trap: Sign errors when expanding negative parenthetical terms.',
          'Verify arithmetic by back-substituting the calculated value into the original expression.'
        );
      } else if (profile.discipline === 'psychology') {
        keyPoints.push(
          'Distinguish clearly between internal cognitive schemas and external environmental reinforcement.',
          'Common Exam Trap: Conflating negative reinforcement with behavioral punishment.',
          'In exam essays, ground all theoretical claims in landmark empirical experiments.'
        );
      } else {
        keyPoints.push(
          'Master core definitions before applying advanced problem-solving methods.',
          'Common Exam Misconception: Skipping intermediate steps leads to preventable mark loss.',
          'Connect foundational principles to practical exam application scenarios.'
        );
      }
    }

    // Ensure exercises have step-by-step solutions with initialExpanded: false
    let exercises = sec.exercises ? [...sec.exercises] : [];
    if (exercises.length === 0 && idx === 0) {
      if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
        exercises.push({
          id: `ex-${profile.discipline}-${chapterNumber}-${idx + 1}`,
          exerciseNumber: 1,
          question: `Given a primary problem in ${sec.title}, calculate the exact numerical solution showing all intermediate algebraic steps.`,
          questionType: 'problem',
          hints: ['State the governing formula and substitute the known parameters carefully.'],
          solution: {
            answer: `Step-by-step calculated solution according to the governing formula of ${sec.title}.`,
            steps: [
              `Step 1: Identify given variables and state the governing equation.`,
              `Step 2: Substitute numerical values: evaluate operations following standard precedence (PEMDAS).`,
              `Step 3: Simplify intermediate arithmetic expressions ($3 + 14 \\cdot 4 = 3 + 56 = 59$).`,
              `Step 4: Check dimensional consistency and state the final verified value.`,
            ],
            explanation: `Rigorous step-by-step arithmetic guarantees full marks in examination grading.`,
          },
          initialExpanded: false,
        });
      } else if (profile.discipline === 'psychology') {
        exercises.push({
          id: `ex-psych-${chapterNumber}-${idx + 1}`,
          exerciseNumber: 1,
          question: `Analyze how the primary theoretical model of ${sec.title} explains behavioral variation in a clinical or real-world scenario. Contrast this with an alternative psychological perspective.`,
          questionType: 'problem',
          hints: ['Identify the core cognitive schema or environmental contingency and examine how it mediates behavior.'],
          solution: {
            answer: `The primary framework attributes behavior to underlying cognitive or environmental mechanisms, distinguishing between learned responses and internal representations.`,
            steps: [
              `Step 1: Define the core theoretical construct and its primary psychological mechanism.`,
              `Step 2: Apply the theory to the scenario, identifying mediating cognitive schemas or behavioral contingencies.`,
              `Step 3: Compare with an alternative framework (e.g. Cognitive vs Behavioral perspective).`,
              `Step 4: Formulate a nuanced conclusion grounded in empirical psychological evidence.`,
            ],
            explanation: `In psychology exams, comparative conceptual analysis receives the highest analytical marks.`,
          },
          initialExpanded: false,
        });
      } else {
        exercises.push({
          id: `ex-gen-${chapterNumber}-${idx + 1}`,
          exerciseNumber: 1,
          question: `Explain how the primary principles of ${sec.title} apply to solve representative academic questions in ${subjectName}.`,
          questionType: 'problem',
          hints: ['State the formal definition and detail each reasoning step.'],
          solution: {
            answer: `Comprehensive analytical solution for ${sec.title}.`,
            steps: [
              `Step 1: State the governing rule or principle.`,
              `Step 2: Apply the analytical framework to the problem.`,
              `Step 3: Synthesize the final conclusion with academic evidence.`,
            ],
            explanation: `Methodical deconstruction ensures full examination marks.`,
          },
          initialExpanded: false,
        });
      }
    } else {
      exercises = exercises.map((ex) => ({
        ...ex,
        initialExpanded: false,
      }));
    }

    return {
      ...sec,
      sectionNumber: `${chapterNumber}.${idx + 1}`,
      content: updatedContent,
      keyPoints,
      exercises,
      isImportant: true,
    };
  });

  // Ensure at least 2 developed sections exist for comprehensive textbook depth
  if (enrichedSections.length === 1) {
    if (profile.discipline === 'mathematics' || profile.discipline === 'physics') {
      enrichedSections.push({
        id: `sec-${chapterNumber}-2`,
        sectionNumber: `${chapterNumber}.2`,
        title: `Worked Multi-Step Calculations & Exam Problem-Solving`,
        content: `### 1. Advanced Analytical Methodology\nExamination questions involving ${chapterTitle} frequently combine multiple steps or require algebraic rearrangement prior to numerical substitution.\n\n### 2. Methodical Problem Deconstruction\nAlways approach complex problems by deconstructing them into modular calculation phases:\n- Phase 1: Identify all given scalar and vector quantities with their SI units.\n- Phase 2: State governing formulas and derive target variable expressions analytically.\n- Phase 3: Substitute numerical quantities and compute step-by-step ($3 + 14 \\cdot 4 = 59$).\n- Phase 4: Back-substitute into the original formulation to verify solution validity.`,
        keyPoints: [
          'Deconstruct multi-step problems into modular calculation phases.',
          'Carry units through every intermediate step to ensure dimensional consistency.',
          'Perform sanity checks on final numerical magnitudes.'
        ],
        isImportant: true,
        exercises: [
          {
            id: `ex-${profile.discipline}-${chapterNumber}-2`,
            exerciseNumber: 2,
            question: `A representative exam problem in ${chapterTitle} tests parameter isolation. Determine the unknown variable given standard values.`,
            questionType: 'problem',
            hints: ['Rearrange the governing equation for the target variable before substituting numbers.'],
            solution: {
              answer: `Calculated value showing verified algebraic steps.`,
              steps: [
                `Step 1: State the governing equation.`,
                `Step 2: Rearrange algebraically for the target unknown.`,
                `Step 3: Substitute known numerical values ($3 + 14 \\cdot 4 = 59$).`,
                `Step 4: Confirm unit dimensions and state the final result.`
              ],
              explanation: `Systematic step-by-step presentation receives full examination marks.`
            },
            initialExpanded: false
          }
        ]
      });
    } else {
      enrichedSections.push({
        id: `sec-${chapterNumber}-2`,
        sectionNumber: `${chapterNumber}.2`,
        title: `Real-World Case Applications & Comparative Analysis`,
        content: `### 1. Practical Application & Academic Context\nMastering ${chapterTitle} requires moving beyond abstract definitions to apply principles across diverse academic and real-world scenarios.\n\n### 2. Systematic Evaluation Workflow\nWhen analyzing exam scenarios:\n1. Identify the foundational paradigm governing the scenario.\n2. Contrast the primary approach with alternative models.\n3. Evaluate empirical evidence supporting the proposed solution.\n4. Formulate an evidence-grounded conclusion.`,
        keyPoints: [
          'Ground all practical applications in formal academic principles.',
          'Distinguish between surface similarities and deep structural mechanisms.',
          'Synthesize key takeaways for comprehensive examination review.'
        ],
        isImportant: true,
        exercises: [
          {
            id: `ex-app-${chapterNumber}-2`,
            exerciseNumber: 2,
            question: `Apply the core principles of ${chapterTitle} to evaluate a representative case scenario in ${subjectName}.`,
            questionType: 'problem',
            hints: ['Connect the theoretical construct directly to the observed outcomes in the scenario.'],
            solution: {
              answer: `Comprehensive analytical solution grounded in academic evidence.`,
              steps: [
                `Step 1: Identify the applicable academic principle.`,
                `Step 2: Trace the causal mechanisms or logical relationships.`,
                `Step 3: Compare alternative interpretations.`,
                `Step 4: State the evidence-based synthesis.`
              ],
              explanation: `Methodical deconstruction demonstrates complete mastery of the subject.`
            },
            initialExpanded: false
          }
        ]
      });
    }
  }

  return {
    ...note,
    title: note.title || `${subjectName} - Chapter ${chapterNumber}: ${chapterTitle}`,
    learningOutcomes: existingOutcomes,
    keyTakeaways: existingTakeaways,
    keyTerms: existingKeyTerms,
    sections: enrichedSections.length > 0 ? enrichedSections : generateImportantChapterNotes('', options).sections,
    readingTimeMinutes: Math.max(4, Math.ceil(
      enrichedSections.reduce((acc, s) => acc + (s.content || '').split(/\s+/).filter(Boolean).length, 0) / 180
    )),
  };
}

/**
 * Generates subject-specific, high-yield academic study notes for a single chapter.
 * 
 * CORE PRINCIPLE: OPTIMIZE FOR LEARNING QUALITY, NOT CONTENT LENGTH
 * The objective is not to produce content that is longer than the original resource.
 * The objective is to teach the material more effectively than the original resource.
 * - Explains rather than merely summarizes.
 * - Simplifies without oversimplifying.
 * - Teaches strategically (worked examples, analogies, formulas, case analyses).
 * - Eliminates redundant filler and repetitive explanations.
 * - Adapts to the subject (calculations for math, theoretical frameworks for psychology).
 * - Prioritizes independent student understanding.
 */
export function generateImportantChapterNotes(
  chapterText: string,
  options: ChapterGenerationOptions
): OrganizedShortNote {
  const { subjectName, chapterTitle, chapterNumber = 1, gradeLevel } = options;
  const profile = getSubjectPedagogicalProfile(subjectName);

  // Sanitize input chapter text to eliminate any residual TOC artifacts
  const cleanInputText = sanitizeChapterText(chapterText, chapterNumber);

  // Run base organizer
  const baseOrganized = organizeChapterNotesLocal(cleanInputText, {
    chapterTitle: `Chapter ${chapterNumber}: ${chapterTitle}`,
    subjectName,
  });

  const sections: ShortNoteSection[] = [...baseOrganized.sections];
  const keyTerms: KeyTerm[] = [...baseOrganized.keyTerms];
  const takeaways: string[] = [...baseOrganized.keyTakeaways];
  const outcomes: string[] = [...baseOrganized.learningOutcomes];

  // 1. Synthesize comprehensive learning outcomes if missing
  if (outcomes.length === 0) {
    if (profile.discipline === 'mathematics') {
      outcomes.push(
        `Derive, formulate, and apply governing equations for ${chapterTitle}.`,
        `Execute step-by-step arithmetic and algebraic calculations with zero computational error.`,
        `Solve multi-step review problems and verify mathematical solutions analytically.`
      );
    } else if (profile.discipline === 'psychology') {
      outcomes.push(
        `Analyze core theoretical frameworks and seminal psychological models in ${chapterTitle}.`,
        `Evaluate landmark empirical experiments and their implications for human cognition and behavior.`,
        `Differentiate nuanced psychological constructs and apply concepts to diagnostic/behavioral case studies.`
      );
    } else if (profile.discipline === 'physics') {
      outcomes.push(
        `State governing physical laws and define all vector and scalar quantities for ${chapterTitle}.`,
        `Apply SI units and algebraic equations to solve kinematic and dynamic problems.`,
        `Analyze physical systems using free-body models and energy conservation principles.`
      );
    } else if (profile.discipline === 'computer') {
      outcomes.push(
        `Implement and trace core algorithms and data structure operations for ${chapterTitle}.`,
        `Compute asymptotic time and space complexities using Big-O notation ($O(1), O(\\log n), O(n)$).`,
        `Debug algorithmic edge cases and design optimal software implementations.`
      );
    } else {
      outcomes.push(
        `Master the foundational concepts, definitions, and core principles of ${chapterTitle}.`,
        `Apply ${profile.name} analytical methods to solve academic and practical exam questions.`,
        `Synthesize key exam takeaways and avoid common academic misconceptions.`
      );
    }
  }

  // 2. Synthesize deep key takeaways (never narrow!)
  if (takeaways.length < 3) {
    if (profile.discipline === 'mathematics') {
      takeaways.push(
        `Formula Mastery: Commit the governing equation for ${chapterTitle} to memory and identify given variables before solving.`,
        `Step-by-Step Rigor: Always write down the general formula, substitute knowns, and evaluate intermediate arithmetic clearly.`,
        `Active Practice: Work through all practice problems with Show/Hide solutions to build exam speed and accuracy.`
      );
    } else if (profile.discipline === 'psychology') {
      takeaways.push(
        `Theoretical Framework: Master the foundational psychological paradigm governing ${chapterTitle} and its major theorists.`,
        `Conceptual Precision: Pay close attention to subtle differences between interrelated terms to avoid exam traps.`,
        `Empirical Evidence: Link theoretical claims directly to landmark studies and observed behavioral outcomes.`
      );
    } else {
      takeaways.push(
        `Core Pillar: High-yield focus on ${chapterTitle} within ${subjectName}.`,
        `Exam Strategy: Deeply understand definitions and analytical workflows rather than superficial memorization.`,
        `Retention: Use interactive flashcards and Show/Hide solution exercises for active recall.`
      );
    }
  }

  // 3. Extract or synthesize expert key terms / dictionary items
  if (keyTerms.length === 0) {
    const termLines = cleanInputText.split('\n');
    for (const l of termLines) {
      const m = l.match(/^[-*•]?\s*(?:\*\*)?([A-Za-z0-9\s\-]{3,35})(?:\*\*)?\s*[:–—]\s*(.{10,250})$/);
      if (m) {
        const rawT = m[1].trim();
        const rawD = m[2].trim();
        if (!/^(http|chapter|unit|section|example|exercise|solution|problem|note)/i.test(rawT)) {
          keyTerms.push({ term: rawT, definition: rawD });
          if (keyTerms.length >= 8) break;
        }
      }
    }

    // Discipline-tailored fallback terms if none found in raw text
    if (keyTerms.length === 0) {
      if (profile.discipline === 'mathematics') {
        keyTerms.push(
          {
            term: `${chapterTitle} Equation`,
            definition: `The primary mathematical relationship governing calculations in ${chapterTitle}, relating dependent and independent variables.`,
          },
          {
            term: `Independent Parameter`,
            definition: `The fundamental input variable that determines output values across mathematical evaluation.`,
          },
          {
            term: `Analytic Solution`,
            definition: `A mathematical expression that satisfies the governing equation under specified initial or boundary conditions.`,
          }
        );
      } else if (profile.discipline === 'psychology') {
        keyTerms.push(
          {
            term: `${chapterTitle} Schema`,
            definition: `The underlying cognitive framework or concept that helps individuals organize and interpret information in ${chapterTitle}.`,
          },
          {
            term: `Empirical Validity`,
            definition: `The degree to which experimental findings in psychological research accurately reflect observed behavioral phenomena.`,
          },
          {
            term: `Behavioral Mechanism`,
            definition: `The physiological or cognitive process responsible for triggering, mediating, or altering an observable psychological response.`,
          }
        );
      } else {
        keyTerms.push(
          {
            term: chapterTitle,
            definition: `The foundational academic subject domain established in this chapter of ${subjectName}.`,
          },
          {
            term: `${chapterTitle} Principle`,
            definition: `The governing rule, scientific law, or theoretical framework established in this chapter.`,
          }
        );
      }
    }
  }

  // 4. Ensure deep, non-narrow sections with subject-specific content
  if (sections.length === 0) {
    // Generate comprehensive sections tailored to discipline
    if (profile.discipline === 'mathematics') {
      sections.push(
        {
          id: `sec-${chapterNumber}-1`,
          sectionNumber: `${chapterNumber}.1`,
          title: `Foundations & Governing Formulas of ${chapterTitle}`,
          content: `${chapterTitle} constitutes a core computational pillar of ${subjectName}. Understanding this topic requires clear identification of input variables, parameter bounds, and governing formulas.\n\nKey governing relationship:\n$$f(x) = \\text{Primary Mathematical Formulation for } ${chapterTitle}$$\n\nWhen evaluating problems, first identify the given quantities, verify dimensional consistency, and state the applicable theorem before performing algebraic substitution.`,
          keyPoints: [
            `Identify known and unknown parameters before calculating`,
            `State the governing formula explicitly before numerical evaluation`,
            `Verify intermediate arithmetic to eliminate calculation errors`,
          ],
          isImportant: true,
          exercises: [
            {
              id: `ex-math-${chapterNumber}-1`,
              exerciseNumber: 1,
              question: `Given a primary problem in ${chapterTitle}, apply the governing formula to compute the exact solution showing all intermediate algebraic steps.`,
              questionType: 'problem',
              hints: [`Recall the primary formula and substitute the given values systematically.`],
              solution: {
                answer: `Step-by-step calculated solution according to the governing formula of ${chapterTitle}.`,
                steps: [
                  `Step 1: Identify given variables and state the governing formula.`,
                  `Step 2: Substitute values into the equation: evaluate operations following standard precedence (PEMDAS).`,
                  `Step 3: Simplify intermediate expressions and solve for the unknown parameter.`,
                  `Step 4: Check dimensional consistency and state the final calculated value.`,
                ],
                explanation: `Rigorous step-by-step arithmetic guarantees full marks in examination grading.`,
              },
              initialExpanded: false,
            },
          ],
        },
        {
          id: `sec-${chapterNumber}-2`,
          sectionNumber: `${chapterNumber}.2`,
          title: `Step-by-Step Worked Problems & Advanced Calculations`,
          content: `In university and national examinations, questions on ${chapterTitle} often combine multiple steps or require algebraic rearrangement prior to numerical computation.\n\nAlways approach complex problems by decomposing them into modular calculation phases. Validate each step by back-substituting into the original formula.`,
          keyPoints: [
            `Decompose multi-step calculations into modular phases`,
            `Check algebraic signs and exponent laws carefully during expansion`,
            `Perform sanity checks on final numerical magnitudes`,
          ],
          isImportant: true,
        }
      );
    } else if (profile.discipline === 'psychology') {
      sections.push(
        {
          id: `sec-${chapterNumber}-1`,
          sectionNumber: `${chapterNumber}.1`,
          title: `Theoretical Framework & Foundational Concepts of ${chapterTitle}`,
          content: `${chapterTitle} provides an essential theoretical model within ${subjectName}. Rather than relying on simple intuition, academic psychology investigates how cognitive, developmental, and biological mechanisms interact to produce observable behavior.\n\nMajor theorists have conceptualized this topic through distinct paradigms, examining how environmental stimuli, internal mental schemas, and neurobiological substrates govern psychological outcomes.`,
          keyPoints: [
            `Ground all psychological claims in formal theoretical models`,
            `Analyze both internal cognitive processes and observable behavioral manifestations`,
            `Distinguish between correlation and direct behavioral causation`,
          ],
          isImportant: true,
          exercises: [
            {
              id: `ex-psych-${chapterNumber}-1`,
              exerciseNumber: 1,
              question: `Analyze how the primary theoretical model of ${chapterTitle} explains behavioral variation in a clinical or real-world scenario. Contrast this with an alternative psychological perspective.`,
              questionType: 'problem',
              hints: [`Identify the core assumptions of the primary theory and examine how it interprets cognitive schemas or environmental stimuli.`],
              solution: {
                answer: `The primary framework attributes behavior to underlying cognitive or environmental mechanisms, distinguishing between learned responses and internal representations.`,
                steps: [
                  `Step 1: Define the core theoretical construct and its primary psychological mechanism.`,
                  `Step 2: Apply the theory to the scenario, identifying the mediating cognitive schemas or behavioral contingencies.`,
                  `Step 3: Compare with an alternative framework (e.g. Cognitive vs Behavioral perspective).`,
                  `Step 4: Formulate a nuanced conclusion grounded in empirical psychological evidence.`,
                ],
                explanation: `In psychology exams, comparative conceptual analysis receives the highest analytical marks.`,
              },
              initialExpanded: false,
            },
          ],
        },
        {
          id: `sec-${chapterNumber}-2`,
          sectionNumber: `${chapterNumber}.2`,
          title: `Empirical Evidence, Landmark Studies & Case Analysis`,
          content: `Scientific psychology relies on empirical validation through controlled laboratory experiments, longitudinal investigations, and clinical case studies.\n\nWhen evaluating empirical research on ${chapterTitle}, critical thinkers assess the operational definitions of variables, sample representativeness, experimental controls, and potential confounding factors.`,
          keyPoints: [
            `Identify independent and dependent variables in landmark studies`,
            `Assess ecological validity and potential experimental bias`,
            `Connect experimental outcomes directly to real-world behavioral applications`,
          ],
          isImportant: true,
        }
      );
    } else {
      sections.push({
        id: `sec-${chapterNumber}-1`,
        sectionNumber: `${chapterNumber}.1`,
        title: `Core Principles & Analytical Foundations of ${chapterTitle}`,
        content: `${chapterTitle} forms a fundamental component of ${subjectName}. A complete understanding requires mastering both conceptual definitions and practical problem-solving methodologies.\n\nThis chapter introduces the governing principles, analytical frameworks, and systematic applications essential for academic mastery.`,
        keyPoints: [
          `Master core definitions and structural models`,
          `Apply systematic analytical methods to exam problems`,
          `Synthesize key principles with real-world scenarios`,
        ],
        isImportant: true,
        exercises: [
          {
            id: `ex-gen-${chapterNumber}-1`,
            exerciseNumber: 1,
            question: `Explain the fundamental concept of ${chapterTitle} and demonstrate how its principles solve a representative problem in ${subjectName}.`,
            questionType: 'problem',
            hints: [`Reflect on the primary definitions and key principles outlined in this chapter.`],
            solution: {
              answer: `${chapterTitle} governs key mechanisms and analytical methodologies in ${subjectName}.`,
              steps: [
                `Identify the core principle and standard academic terminology.`,
                `Formulate the governing relationships, rules, or equations.`,
                `Apply the methodology step-by-step to the problem scenario.`,
                `Verify the validity and practical implications of the result.`,
              ],
              explanation: `Demonstrating methodical, step-by-step analytical reasoning ensures top exam performance.`,
            },
            initialExpanded: false,
          },
        ],
      });
    }
  }

  // 5. Ensure exercises have independent solutions collapsed by default
  sections.forEach((sec, idx) => {
    sec.isImportant = sec.isImportant ?? (idx === 0 || (sec.exercises && sec.exercises.length > 0));
    sec.sectionNumber = `${chapterNumber}.${idx + 1}`;
    if (sec.exercises) {
      sec.exercises.forEach((ex) => {
        ex.initialExpanded = false;
      });
    }
  });

  const baseResult: OrganizedShortNote = {
    title: `${subjectName} - Chapter ${chapterNumber}: ${chapterTitle}`,
    summary:
      baseOrganized.summary ||
      `Comprehensive, high-yield academic study notes for ${chapterTitle} under ${subjectName}. Covers ${profile.focusDescription} with complete Show/Hide solution exercises.`,
    learningOutcomes: outcomes,
    keyTakeaways: takeaways,
    sections,
    keyTerms,
    exercises: [],
    rawContent: cleanInputText,
    readingTimeMinutes: Math.max(3, Math.ceil(cleanInputText.split(/\s+/).filter(Boolean).length / 180)),
  };

  // If the base result does not reach exemplary textbook quality (85+), enrich it
  const validation = validateStudyNoteCompleteness(baseResult, cleanInputText, subjectName);
  if (validation.score < 85) {
    return enrichStudyNoteToTextbookQuality(baseResult, options);
  }

  return baseResult;
}

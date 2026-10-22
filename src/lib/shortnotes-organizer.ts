import { ShortNoteSection, KeyTerm } from '@/types/book';

export interface OrganizedShortNote {
  title: string;
  summary: string;
  keyTakeaways: string[];
  sections: ShortNoteSection[];
  keyTerms: KeyTerm[];
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
 * slides, or book passages into structured interactive shortnotes.
 */
export function organizeChapterNotesLocal(
  rawText: string,
  options?: string | { chapterTitle?: string; subjectName?: string }
): OrganizedShortNote {
  const defaultTitle =
    typeof options === 'string'
      ? options
      : options?.chapterTitle || 'Chapter Notes';

  const clean = normalizeText(rawText);
  if (!clean) {
    return {
      title: defaultTitle,
      summary: '',
      keyTakeaways: [],
      sections: [],
      keyTerms: [],
      rawContent: '',
      readingTimeMinutes: 1,
    };
  }

  const lines = clean.split('\n').map((l) => l.trim());
  const wordsCount = clean.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 200));

  let detectedTitle = defaultTitle;
  const sections: ShortNoteSection[] = [];
  const keyTerms: KeyTerm[] = [];
  const takeaways: string[] = [];

  // Check if first non-empty line looks like a title
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

  // Split content into blocks by headings or empty line clusters
  let currentSectionTitle = 'Overview & Core Concepts';
  let currentSectionLines: string[] = [];
  const sectionBlocks: { title: string; lines: string[] }[] = [];

  const isHeading = (line: string): boolean => {
    if (line.startsWith('## ') || line.startsWith('### ') || line.startsWith('#### ')) return true;
    if (/^(Chapter|Unit|Section|Part|Topic)\s+\d+[:.]?/i.test(line)) return true;
    if (/^\d+[\.\)]\s+[A-Z]/.test(line) && line.length < 80 && !line.endsWith('.')) return true;
    if (/^[A-Z\s]{4,60}$/.test(line)) return true; // ALL CAPS heading
    return false;
  };

  const cleanHeading = (line: string): string => {
    return line
      .replace(/^#+\s*/, '')
      .replace(/^[0-9]+[\.\)]\s*/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim();
  };

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (isHeading(line)) {
      if (currentSectionLines.length > 0) {
        sectionBlocks.push({ title: currentSectionTitle, lines: currentSectionLines });
        currentSectionLines = [];
      }
      currentSectionTitle = cleanHeading(line) || `Section ${sectionBlocks.length + 1}`;
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionLines.length > 0) {
    sectionBlocks.push({ title: currentSectionTitle, lines: currentSectionLines });
  }

  // If no headings found, split by double newlines or chunks of 2-3 paragraphs
  if (sectionBlocks.length === 1 && sectionBlocks[0].lines.length > 25) {
    const allLines = sectionBlocks[0].lines;
    sectionBlocks.length = 0; // reset
    let chunk: string[] = [];
    let chunkIndex = 1;

    for (const l of allLines) {
      chunk.push(l);
      if (chunk.length >= 18 && l === '') {
        sectionBlocks.push({ title: `Part ${chunkIndex}: Key Principles`, lines: [...chunk] });
        chunk = [];
        chunkIndex++;
      }
    }
    if (chunk.length > 0) {
      sectionBlocks.push({
        title: `Part ${chunkIndex}: Applications & Details`,
        lines: chunk,
      });
    }
  }

  // Extract Terms, Definitions, Bullet Points and Sections
  sectionBlocks.forEach((block, idx) => {
    const blockContent = block.lines.join('\n').trim();
    const keyPoints: string[] = [];
    const regularLines: string[] = [];

    block.lines.forEach((line) => {
      // 1. Detect bullet points
      if (/^[-*•]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line)) {
        const pt = line.replace(/^[-*•\d\.\)]\s+/, '').trim();
        if (pt.length > 5) {
          keyPoints.push(pt);
          if (takeaways.length < 6 && pt.length < 150) {
            takeaways.push(pt);
          }
        }
      } else {
        regularLines.push(line);
      }

      // 2. Detect definitions (e.g., "**Term**: Definition" or "Term - Definition")
      const defMatch = line.match(/^\*{0,2}([A-Za-z0-9\s\-]{2,40})\*{0,2}\s*[:\-–—]\s*(.{15,300})/);
      if (defMatch) {
        const term = defMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
        const definition = defMatch[2].trim();
        if (
          term.length > 1 &&
          !term.toLowerCase().startsWith('note') &&
          !term.toLowerCase().startsWith('example') &&
          !term.toLowerCase().startsWith('step') &&
          !keyTerms.some((t) => t.term.toLowerCase() === term.toLowerCase())
        ) {
          keyTerms.push({ term, definition });
        }
      }
    });

    const isImportant =
      /important|critical|essential|remember|exam|key point|definition/i.test(block.title) ||
      /critical to understand|core principle|fundamental rule/i.test(blockContent);

    sections.push({
      id: `sec-${idx + 1}-${Date.now()}`,
      title: block.title,
      content: blockContent || regularLines.join('\n').trim(),
      keyPoints: keyPoints.length > 0 ? keyPoints.slice(0, 8) : undefined,
      isImportant,
    });
  });

  // Extract / synthesize executive summary
  let summary = '';
  const firstBlock = sectionBlocks[0]?.lines || [];
  const firstParagraph = firstBlock
    .filter((l) => l.length > 30 && !l.startsWith('-') && !l.startsWith('*'))
    .slice(0, 3)
    .join(' ');

  if (firstParagraph) {
    summary = firstParagraph.length > 320 ? firstParagraph.slice(0, 317) + '...' : firstParagraph;
  } else {
    summary = `Comprehensive study notes for ${detectedTitle}, covering core definitions, systematic processes, and high-yield review concepts.`;
  }

  // Ensure at least 3 takeaways
  if (takeaways.length < 3) {
    sections.forEach((sec) => {
      if (sec.keyPoints && sec.keyPoints.length > 0) {
        sec.keyPoints.forEach((kp) => {
          if (takeaways.length < 6 && !takeaways.includes(kp)) {
            takeaways.push(kp);
          }
        });
      }
    });
  }

  return {
    title: detectedTitle,
    summary,
    keyTakeaways: takeaways.slice(0, 6),
    sections: sections.length > 0 ? sections : [
      {
        id: `sec-1-${Date.now()}`,
        title: 'Core Chapter Content',
        content: clean,
      },
    ],
    keyTerms: keyTerms.slice(0, 15),
    rawContent: clean,
    readingTimeMinutes,
  };
}

/**
 * Optional AI Enhancement via Gemini: sends raw text to Gemini and gets back
 * perfectly structured JSON with academic summary, takeaways, clean sections, and glossary.
 */
export async function organizeChapterNotesWithAI(
  rawText: string,
  optionsOrTitle?: string | { chapterTitle?: string; subjectName?: string },
  subjectNameParam?: string,
  geminiApiKey?: string
): Promise<OrganizedShortNote> {
  const chapterTitle =
    typeof optionsOrTitle === 'string'
      ? optionsOrTitle
      : optionsOrTitle?.chapterTitle;
  const subjectName =
    typeof optionsOrTitle === 'string'
      ? subjectNameParam
      : optionsOrTitle?.subjectName || subjectNameParam;

  const localFallback = organizeChapterNotesLocal(rawText, chapterTitle || 'Chapter Shortnotes');

  const apiKey =
    geminiApiKey ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key');
  if (!apiKey || !rawText.trim()) {
    return localFallback;
  }

  try {
    const prompt = `You are a university academic content specialist and curriculum designer.
Analyze the following chapter study notes for "${subjectName || 'Academic Course'}" - "${chapterTitle || localFallback.title}".
Transform the raw content into structured, high-yield interactive study shortnotes.

Input Raw Notes:
"""
${rawText.slice(0, 16000)}
"""

Respond STRICTLY with valid JSON matching this schema (do NOT include markdown backticks or commentary outside JSON):
{
  "title": "Clear, concise chapter title",
  "summary": "2-3 sentence executive overview of what this chapter covers and why it matters.",
  "keyTakeaways": [
    "Key takeaway 1 (high-yield exam concept)",
    "Key takeaway 2",
    "Key takeaway 3",
    "Key takeaway 4",
    "Key takeaway 5"
  ],
  "sections": [
    {
      "id": "sec-1",
      "title": "Topic or Concept Title",
      "content": "Clear, digestible explanation of the concept, processes, or examples (use standard markdown for emphasis).",
      "keyPoints": [
        "Concise bullet point 1",
        "Concise bullet point 2"
      ],
      "isImportant": true
    }
  ],
  "keyTerms": [
    {
      "term": "Key Term 1",
      "definition": "Precise, scientifically accurate definition"
    }
  ]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.95,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn('Gemini AI organization call failed, using local parser:', response.statusText);
      return localFallback;
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return localFallback;

    // Clean potential markdown code blocks
    const cleanedJson = textOutput.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const wordsCount = rawText.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 200));

    return {
      title: parsed.title || chapterTitle || localFallback.title,
      summary: parsed.summary || localFallback.summary,
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0
        ? parsed.keyTakeaways
        : localFallback.keyTakeaways,
      sections: Array.isArray(parsed.sections) && parsed.sections.length > 0
        ? parsed.sections.map((s: any, i: number) => ({
            id: s.id || `sec-${i + 1}-${Date.now()}`,
            title: s.title || `Section ${i + 1}`,
            content: s.content || '',
            keyPoints: s.keyPoints || [],
            isImportant: Boolean(s.isImportant),
          }))
        : localFallback.sections,
      keyTerms: Array.isArray(parsed.keyTerms) && parsed.keyTerms.length > 0
        ? parsed.keyTerms
        : localFallback.keyTerms,
      rawContent: rawText,
      readingTimeMinutes,
    };
  } catch (err) {
    console.warn('Error in AI notes organizer, falling back to local parse:', err);
    return localFallback;
  }
}

/**
 * Reconstitutes markdown text from structured sections for storage and backward compatibility.
 */
export function generateMarkdownFromSections(sections: ShortNoteSection[]): string {
  if (!sections || sections.length === 0) return '';
  return sections
    .map((s, idx) => {
      let block = `## ${idx + 1}. ${s.title}\n\n`;
      if (s.keyPoints && s.keyPoints.length > 0) {
        block += `### Key Highlights\n` + s.keyPoints.map((p) => `- ${p}`).join('\n') + `\n\n`;
      }
      if (s.content) {
        block += `${s.content}\n\n`;
      }
      return block.trim();
    })
    .join('\n\n---\n\n');
}

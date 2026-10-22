/**
 * Prompt Scope & Content Filtering Utility
 * 
 * Automatically detects page ranges, specific page numbers, and chapter names
 * from user prompt instructions and provides precision filtering for source documents.
 */

export interface DetectedPromptScope {
  detectedPageRange?: string; // e.g. "15-25" or "12" or "5, 8, 10-15"
  startPage?: number;
  endPage?: number;
  pageNumbers?: number[];
  detectedChapter?: string; // e.g. "Chapter 2" or "2" or "Photosynthesis"
  hasDetectedScope: boolean;
  explanation?: string;
}

export interface ExtractedPageItem {
  pageNumber: number;
  text: string;
}

/**
 * Intelligent parser to detect page numbers, page ranges, and chapter filters
 * from free-form user prompt text (supports English and multilingual like Arabic).
 */
export function detectScopeFromPrompt(prompt: string): DetectedPromptScope {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { hasDetectedScope: false };
  }

  const cleanPrompt = prompt.trim();

  // 1. Detect Page Ranges (e.g., "pages 15 to 25", "page 15-25", "from page 10 through 20", "من صفحة 10 الى 20")
  const rangeRegexes = [
    // "from page 15 to 25", "between page 10 and 20", "من صفحة 15 إلى 25", "بين صفحة 10 و 20"
    /(?:from|between|من|بين)\s*(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?|ص)?\s*(\d+)\s*(?:to|and|through|until|وحتى|حتى|إلى|الى|و|-|–|—)\s*(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?|ص)?\s*(\d+)/i,
    // "pages 15-25", "page 15 to 25", "pages: 15-25", "pp 15-25", "p. 15-25", "صفحة 10 الى 20"
    /(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?|ص)\s*[:=]?\s*(\d+)\s*(?:-|–|—|to|through|until|وحتى|حتى|إلى|الى)\s*(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?|ص)?\s*(\d+)/i,
    // "pages 10, 11, 12" or "page 5, 8, 10-15"
    /(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?)\s*[:=]?\s*(\d+(?:\s*,\s*\d+)+(?:\s*-\s*\d+)?)/i,
    // "page 15", "p. 15", "صفحة 15"
    /(?:on|at|from|only|in|من|في)?\s*(?:pages?|pp?\.?|صفح(?:ة|ات|ه)?|ص)\s*[:#]?\s*(\d+)(?!\s*[-–to\d])/i,
  ];

  for (const regex of rangeRegexes) {
    const match = cleanPrompt.match(regex);
    if (match) {
      if (match[1] && match[2]) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          return {
            detectedPageRange: `${start}-${end}`,
            startPage: start,
            endPage: end,
            pageNumbers: Array.from({ length: end - start + 1 }, (_, i) => start + i),
            hasDetectedScope: true,
            explanation: `Targeting Pages ${start}–${end} (identified from prompt)`
          };
        }
      } else if (match[1]) {
        // Single page or comma-separated list
        const val = match[1].trim();
        const parsedPages = parsePageRange(val);
        if (parsedPages.size > 0) {
          const sorted = Array.from(parsedPages).sort((a, b) => a - b);
          const rangeLabel = sorted.length === 1 ? `${sorted[0]}` : val;
          return {
            detectedPageRange: rangeLabel,
            startPage: sorted[0],
            endPage: sorted[sorted.length - 1],
            pageNumbers: sorted,
            hasDetectedScope: true,
            explanation: sorted.length === 1
              ? `Targeting Page ${sorted[0]} (identified from prompt)`
              : `Targeting Pages ${rangeLabel} (identified from prompt)`
          };
        }
      }
    }
  }

  // 2. Detect Chapter References (e.g. "chapter 2", "ch 3", "unit 4", "الفصل 2", "الوحدة 3")
  const chapterRegexes = [
    // "chapter 2", "chapter 3: photosynthesis", "ch. 4", "unit 1"
    /(?:chapter|unit|ch\.?|unit\s*number)\s*[:#]?\s*(\d+|[IVXLCDM]+)(?:\s*[:\-–]\s*([^\n,.;]+))?/i,
    // Arabic: "الفصل 2", "الوحدة 3", "شابتر 2"
    /(?:الفصل|الوحدة|شابتر|باب)\s*[:#]?\s*(\d+|[IVXLCDM]+)(?:\s*[:\-–]\s*([^\n,.;]+))?/i,
    // "focus on chapter [name]" or "chapter named [name]"
    /(?:in|for|from|about)\s+chapter\s+["']?([^"'\n,.;]{2,40})["']?/i
  ];

  for (const regex of chapterRegexes) {
    const match = cleanPrompt.match(regex);
    if (match) {
      let chapterName = '';
      if (match[2] && match[2].trim()) {
        chapterName = `Chapter ${match[1]}: ${match[2].trim()}`;
      } else if (match[1]) {
        chapterName = match[0].trim();
      }
      if (chapterName) {
        return {
          detectedChapter: chapterName,
          hasDetectedScope: true,
          explanation: `Targeting ${chapterName} (identified from prompt)`
        };
      }
    }
  }

  return { hasDetectedScope: false };
}

/**
 * Parses a page range string like "1-10", "15", "5, 8, 10-15" into a set of page numbers.
 */
export function parsePageRange(rangeStr: string): Set<number> {
  const result = new Set<number>();
  if (!rangeStr || typeof rangeStr !== 'string') return result;

  const parts = rangeStr.split(/[,;]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check for range like "10-20" or "10 to 20"
    const rangeMatch = trimmed.match(/^(\d+)\s*(?:-|–|—|to|وحتى|إلى|الى)\s*(\d+)$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && start > 0) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        // Cap single range to prevent memory exhaustion (up to 200 pages)
        const cappedMax = Math.min(max, min + 200);
        for (let i = min; i <= cappedMax; i++) {
          result.add(i);
        }
      }
      continue;
    }

    // Check for single number like "15" or "p. 15"
    const singleMatch = trimmed.match(/^p?\.?\s*(\d+)$/i);
    if (singleMatch) {
      const num = parseInt(singleMatch[1], 10);
      if (!isNaN(num) && num > 0) {
        result.add(num);
      }
    }
  }

  return result;
}

/**
 * Checks if a page number is within a given page range string.
 */
export function isPageInRange(pageNumber: number, rangeStr: string): boolean {
  if (!rangeStr || !rangeStr.trim()) return true;
  const set = parsePageRange(rangeStr);
  if (set.size === 0) return true;
  return set.has(pageNumber);
}

/**
 * Filters an array of extracted document pages by an explicit page range.
 */
export function filterPagesByRange(
  pages: ExtractedPageItem[],
  rangeStr: string
): {
  matchedPages: ExtractedPageItem[];
  matchedNumbers: number[];
  text: string;
  rangeLabel: string;
} {
  if (!pages || pages.length === 0) {
    return { matchedPages: [], matchedNumbers: [], text: '', rangeLabel: '' };
  }

  const rangeSet = parsePageRange(rangeStr);
  if (rangeSet.size === 0) {
    // If invalid or empty range, return all pages
    const text = pages.map(p => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join('\n\n');
    return {
      matchedPages: pages,
      matchedNumbers: pages.map(p => p.pageNumber),
      text,
      rangeLabel: `All Pages (1–${pages.length})`
    };
  }

  const matched = pages.filter(p => rangeSet.has(p.pageNumber));
  if (matched.length === 0) {
    // Fallback: If requested pages exceed document, take the closest available range or all
    const maxRequested = Math.max(...Array.from(rangeSet));
    const minRequested = Math.min(...Array.from(rangeSet));
    const fallbackSlice = pages.filter(p => p.pageNumber >= minRequested && p.pageNumber <= maxRequested);
    if (fallbackSlice.length > 0) {
      const text = fallbackSlice.map(p => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join('\n\n');
      return {
        matchedPages: fallbackSlice,
        matchedNumbers: fallbackSlice.map(p => p.pageNumber),
        text,
        rangeLabel: `Pages ${fallbackSlice[0].pageNumber}–${fallbackSlice[fallbackSlice.length - 1].pageNumber}`
      };
    }
    // Return all if no overlap
    return {
      matchedPages: pages,
      matchedNumbers: pages.map(p => p.pageNumber),
      text: pages.map(p => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join('\n\n'),
      rangeLabel: `All Pages (1–${pages.length})`
    };
  }

  const sortedNumbers = matched.map(p => p.pageNumber).sort((a, b) => a - b);
  const minNum = sortedNumbers[0];
  const maxNum = sortedNumbers[sortedNumbers.length - 1];
  const rangeLabel = minNum === maxNum ? `Page ${minNum}` : `Pages ${minNum}–${maxNum}`;

  const text = matched
    .map(p => `=== [PAGE ${p.pageNumber}] ===\n${p.text.trim()}`)
    .join('\n\n');

  return {
    matchedPages: matched,
    matchedNumbers: sortedNumbers,
    text,
    rangeLabel
  };
}

/**
 * Filters a raw text document that contains `--- [PAGE X] ---` or `=== [PAGE X] ===` delimiters.
 */
export function filterDelimitedTextByRange(
  rawText: string,
  rangeStr: string
): {
  filteredText: string;
  matchedCount: number;
  rangeLabel: string;
} {
  if (!rawText || !rangeStr || !rangeStr.trim()) {
    return { filteredText: rawText || '', matchedCount: 0, rangeLabel: 'All' };
  }

  const pageSet = parsePageRange(rangeStr);
  if (pageSet.size === 0) {
    return { filteredText: rawText, matchedCount: 0, rangeLabel: 'All' };
  }

  // Split on page markers like `--- [Page 1] ---` or `=== [PAGE 1] ===`
  const pageDelimiterRegex = /(?:---|===)\s*\[(?:Page|PAGE)\s*(\d+)\]\s*(?:---|===)/g;
  const matches = Array.from(rawText.matchAll(pageDelimiterRegex));

  if (matches.length === 0) {
    // If no page delimiters exist, return rawText as-is
    return { filteredText: rawText, matchedCount: 0, rangeLabel: rangeStr };
  }

  const extractedPages: ExtractedPageItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const pageNum = parseInt(currentMatch[1], 10);
    const startIndex = (currentMatch.index ?? 0) + currentMatch[0].length;
    const endIndex = i + 1 < matches.length ? (matches[i + 1].index ?? rawText.length) : rawText.length;
    const pageContent = rawText.slice(startIndex, endIndex).trim();
    if (!isNaN(pageNum)) {
      extractedPages.push({ pageNumber: pageNum, text: pageContent });
    }
  }

  const result = filterPagesByRange(extractedPages, rangeStr);
  return {
    filteredText: result.text,
    matchedCount: result.matchedPages.length,
    rangeLabel: result.rangeLabel
  };
}

/**
 * Filters document text or pages by a specific chapter query.
 */
export function filterContentByChapter(
  content: string | ExtractedPageItem[],
  chapterQuery: string,
  chapterList?: string[]
): {
  filteredText: string;
  chapterFound: boolean;
  chapterLabel: string;
} {
  if (!chapterQuery || chapterQuery === 'all' || !chapterQuery.trim()) {
    const text = typeof content === 'string'
      ? content
      : content.map(p => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join('\n\n');
    return { filteredText: text, chapterFound: false, chapterLabel: 'All Chapters' };
  }

  const fullText = typeof content === 'string'
    ? content
    : content.map(p => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join('\n\n');

  // Clean chapter query (e.g. "Chapter 2: Forces" -> search for "Chapter 2" or "Forces")
  const cleanQuery = chapterQuery.trim();
  const numMatch = cleanQuery.match(/(?:chapter|unit|ch\.?|فصل|الوحدة)\s*[:#]?\s*(\d+|[IVXLCDM]+)/i);
  const chapterNumber = numMatch ? numMatch[1] : null;

  // Search patterns
  const patterns: RegExp[] = [];
  if (chapterNumber) {
    patterns.push(new RegExp(`(?:chapter|unit|ch\\.?|فصل|الوحدة)\\s*[:#]?\\s*${chapterNumber}\\b`, 'i'));
  }
  // Escape query for literal matching
  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  patterns.push(new RegExp(escaped, 'i'));

  let startPos = -1;
  let matchedPattern: RegExp | null = null;

  for (const pat of patterns) {
    const match = fullText.match(pat);
    if (match && match.index !== undefined) {
      startPos = match.index;
      matchedPattern = pat;
      break;
    }
  }

  if (startPos === -1) {
    // If not found by exact heading, check if chapter labels list has next chapters to narrow down
    return {
      filteredText: `[Chapter Target: "${cleanQuery}"]\n\n${fullText.slice(0, 20000)}`,
      chapterFound: false,
      chapterLabel: cleanQuery
    };
  }

  // Find where the next chapter begins
  let nextChapterPos = -1;
  if (chapterNumber && !isNaN(parseInt(chapterNumber, 10))) {
    const nextNum = parseInt(chapterNumber, 10) + 1;
    const nextRegex = new RegExp(`(?:chapter|unit|ch\\.?|فصل|الوحدة)\\s*[:#]?\\s*${nextNum}\\b`, 'i');
    const nextMatch = fullText.slice(startPos + 50).match(nextRegex);
    if (nextMatch && nextMatch.index !== undefined) {
      nextChapterPos = startPos + 50 + nextMatch.index;
    }
  }

  // Also check provided chapterList for the subsequent chapter title
  if (nextChapterPos === -1 && Array.isArray(chapterList) && chapterList.length > 0) {
    const idx = chapterList.findIndex(c => c.toLowerCase() === cleanQuery.toLowerCase());
    if (idx !== -1 && idx + 1 < chapterList.length) {
      const nextTitle = chapterList[idx + 1].trim();
      const escNext = nextTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nextMatch = fullText.slice(startPos + 50).match(new RegExp(escNext, 'i'));
      if (nextMatch && nextMatch.index !== undefined) {
        nextChapterPos = startPos + 50 + nextMatch.index;
      }
    }
  }

  const chapterContent = nextChapterPos !== -1
    ? fullText.slice(startPos, nextChapterPos).trim()
    : fullText.slice(startPos, startPos + 25000).trim();

  return {
    filteredText: `=== [CHAPTER EXCERPT: ${cleanQuery}] ===\n\n${chapterContent}`,
    chapterFound: true,
    chapterLabel: cleanQuery
  };
}

/**
 * Strips and rewrites resource-dependent wording so that questions assess
 * concepts directly without referring to textbooks, notes, documents, or authors.
 */
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

  // Capitalize the first character if it was lowercased by stripping
  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

import React from 'react';
import { getOptimizedImageUrl } from '@/lib/image-upload';

export type SubjectCategory =
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'economics'
  | 'civics'
  | 'english'
  | 'computer'
  | 'general';

export interface SubjectCoverPreset {
  id: SubjectCategory;
  name: string;
  gradient: string;
  accentColor: string;
  badgeBg: string;
  textColor: string;
  description: string;
  svgDataUri: string;
}

/**
 * Identify matching subject category from a given subject name
 */
export function detectSubjectCategory(name?: string): SubjectCategory {
  if (!name) return 'general';
  const clean = name.toLowerCase().trim();

  if (/math|algebra|geometry|calculus|arithmetic|ስታቲስቲክስ|ሒሳብ/i.test(clean)) {
    return 'mathematics';
  }
  if (/physic|mechanics|astronomy|ፊዚክስ/i.test(clean)) {
    return 'physics';
  }
  if (/chem|organic|inorganic|ኬሚስትሪ/i.test(clean)) {
    return 'chemistry';
  }
  if (/biolog|botany|zoology|anatomy|ሥነ-ሕይወት|ባዮሎጂ/i.test(clean)) {
    return 'biology';
  }
  if (/history|tariik|ታሪክ/i.test(clean)) {
    return 'history';
  }
  if (/geograph|landscape|earth|jiogiraafii|ጂኦግራፊ/i.test(clean)) {
    return 'geography';
  }
  if (/economic|business|finance|ንግድ|ኢኮኖሚክስ/i.test(clean)) {
    return 'economics';
  }
  if (/civic|governance|politic|ዜግነት|ህግ/i.test(clean)) {
    return 'civics';
  }
  if (/english|literature|language|grammar|ቋንቋ|እንግሊዝኛ/i.test(clean)) {
    return 'english';
  }
  if (/comput|programming|code|software|information technology|it\b/i.test(clean)) {
    return 'computer';
  }

  return 'general';
}

/**
 * Rich, stylized SVG illustrations encoded as clean data URIs
 * Aspect ratio 4:3 (800x600 viewBox)
 */
const SVG_TEMPLATES: Record<SubjectCategory, string> = {
  history: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-hist" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="50%" stop-color="#d97706"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
        <radialGradient id="sun-hist" cx="70%" cy="30%" r="50%">
          <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#d97706" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow-hist" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#451a03" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-hist)"/>
      <circle cx="560" cy="180" r="280" fill="url(#sun-hist)"/>

      <!-- Pyramid silhouettes in background -->
      <polygon points="120,440 280,240 440,440" fill="#92400e" opacity="0.4"/>
      <polygon points="320,440 460,280 600,440" fill="#78350f" opacity="0.3"/>

      <!-- Classical Columns (Ancient Architecture) -->
      <g filter="url(#shadow-hist)" fill="#fffbeb" opacity="0.95">
        <!-- Left Column -->
        <rect x="180" y="220" width="36" height="200" rx="4"/>
        <rect x="168" y="206" width="60" height="18" rx="3"/>
        <rect x="168" y="416" width="60" height="20" rx="4"/>
        
        <!-- Right Column -->
        <rect x="584" y="220" width="36" height="200" rx="4"/>
        <rect x="572" y="206" width="60" height="18" rx="3"/>
        <rect x="572" y="416" width="60" height="20" rx="4"/>
      </g>

      <!-- Centerpiece: Ancient Scroll & Quill -->
      <g filter="url(#shadow-hist)">
        <!-- Scroll Body -->
        <path d="M280,210 C320,195 480,195 520,210 C535,260 535,350 520,400 C480,385 320,385 280,400 Z" fill="#fef3c7"/>
        <path d="M280,210 C260,210 250,225 250,240 C250,370 260,400 280,400 C270,390 265,360 265,300 C265,240 270,220 280,210 Z" fill="#fde68a"/>
        <path d="M520,210 C540,210 550,225 550,240 C550,370 540,400 520,400 C530,390 535,360 535,300 C535,240 530,220 520,210 Z" fill="#fde68a"/>
        
        <!-- Script lines on scroll -->
        <line x1="310" y1="250" x2="490" y2="250" stroke="#b45309" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
        <line x1="310" y1="280" x2="490" y2="280" stroke="#b45309" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
        <line x1="310" y1="310" x2="450" y2="310" stroke="#b45309" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
        <line x1="310" y1="340" x2="470" y2="340" stroke="#b45309" stroke-width="6" stroke-linecap="round" opacity="0.7"/>

        <!-- Antique Wax Seal -->
        <circle cx="400" cy="360" r="28" fill="#dc2626"/>
        <circle cx="400" cy="360" r="22" fill="#b91c1c" stroke="#fca5a5" stroke-width="2"/>
        <path d="M394,352 L406,368 M406,352 L394,368" stroke="#fef2f2" stroke-width="3" stroke-linecap="round"/>

        <!-- Feather Quill -->
        <path d="M460,370 Q520,270 570,160 Q530,220 480,280 Q465,330 460,370 Z" fill="#fffbeb"/>
        <path d="M460,370 L570,160" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
      </g>
      
      <!-- Label Banner -->
      <rect x="300" y="490" width="200" height="48" rx="24" fill="#451a03" opacity="0.75"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#fef3c7" text-anchor="middle" letter-spacing="3">HISTORY</text>
    </svg>`,

  geography: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-geo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f766e"/>
          <stop offset="50%" stop-color="#0d9488"/>
          <stop offset="100%" stop-color="#042f2e"/>
        </linearGradient>
        <radialGradient id="globe-shading" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="45%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </radialGradient>
        <filter id="shadow-geo" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#022c22" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-geo)"/>

      <!-- Map grid coordinates background -->
      <g stroke="#2dd4bf" stroke-width="1" opacity="0.18">
        <line x1="0" y1="120" x2="800" y2="120"/>
        <line x1="0" y1="240" x2="800" y2="240"/>
        <line x1="0" y1="360" x2="800" y2="360"/>
        <line x1="0" y1="480" x2="800" y2="480"/>
        <line x1="160" y1="0" x2="160" y2="600"/>
        <line x1="320" y1="0" x2="320" y2="600"/>
        <line x1="480" y1="0" x2="480" y2="600"/>
        <line x1="640" y1="0" x2="640" y2="600"/>
      </g>

      <!-- Mountain Silhouette in distance -->
      <polygon points="0,480 180,330 360,480" fill="#134e4a" opacity="0.5"/>
      <polygon points="260,480 440,290 620,480" fill="#115e59" opacity="0.6"/>
      <polygon points="500,480 660,340 800,480" fill="#134e4a" opacity="0.5"/>

      <!-- Globe 3D Illustrated -->
      <g filter="url(#shadow-geo)" transform="translate(400, 270)">
        <!-- Globe Stand Base -->
        <ellipse cx="0" cy="180" rx="90" ry="24" fill="#f8fafc"/>
        <rect x="-14" y="110" width="28" height="70" rx="6" fill="#cbd5e1"/>
        <path d="M-150,-10 C-150,110 -60,140 0,140 C60,140 150,110 150,-10" fill="none" stroke="#f1f5f9" stroke-width="20" stroke-linecap="round"/>

        <!-- Globe Sphere -->
        <circle cx="0" cy="0" r="130" fill="url(#globe-shading)"/>
        
        <!-- Continents stylized -->
        <path d="M-70,-60 Q-40,-80 0,-70 Q40,-60 50,-20 Q60,30 20,60 Q-20,70 -60,40 Q-90,0 -70,-60 Z" fill="#22c55e" opacity="0.9"/>
        <path d="M-20,-110 Q20,-100 50,-80 Q30,-40 -10,-50 Q-30,-80 -20,-110 Z" fill="#4ade80" opacity="0.85"/>
        <path d="M-90,-10 Q-60,-20 -50,10 Q-70,50 -90,20 Z" fill="#16a34a" opacity="0.85"/>
        <ellipse cx="60" cy="30" rx="35" ry="45" fill="#22c55e" opacity="0.9"/>

        <!-- Longitude/Latitude lines on sphere -->
        <ellipse cx="0" cy="0" rx="130" ry="50" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4"/>
        <ellipse cx="0" cy="0" rx="60" ry="130" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4"/>
        <line x1="0" y1="-130" x2="0" y2="130" stroke="#ffffff" stroke-width="2" opacity="0.4"/>
      </g>

      <!-- Compass Rose Symbol -->
      <g filter="url(#shadow-geo)" transform="translate(140, 160)">
        <circle cx="0" cy="0" r="50" fill="#f8fafc" opacity="0.95"/>
        <polygon points="0,-40 10,-8 0,0" fill="#ef4444"/>
        <polygon points="0,-40 -10,-8 0,0" fill="#b91c1c"/>
        <polygon points="0,40 8,10 0,0" fill="#64748b"/>
        <polygon points="0,40 -8,10 0,0" fill="#334155"/>
        <polygon points="40,0 8,8 0,0" fill="#64748b"/>
        <polygon points="-40,0 -8,-8 0,0" fill="#64748b"/>
        <circle cx="0" cy="0" r="6" fill="#0f172a"/>
        <text x="0" y="-44" font-family="sans-serif" font-size="12" font-weight="900" fill="#ef4444" text-anchor="middle">N</text>
      </g>

      <!-- Label Banner -->
      <rect x="290" y="490" width="220" height="48" rx="24" fill="#042f2e" opacity="0.8"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#ccfbf1" text-anchor="middle" letter-spacing="3">GEOGRAPHY</text>
    </svg>`,

  economics: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-econ" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3730a3"/>
          <stop offset="50%" stop-color="#4f46e5"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
        <linearGradient id="bar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
        <filter id="shadow-econ" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-econ)"/>

      <!-- Ambient grid -->
      <g stroke="#818cf8" stroke-width="1.5" opacity="0.2">
        <line x1="80" y1="120" x2="720" y2="120"/>
        <line x1="80" y1="200" x2="720" y2="200"/>
        <line x1="80" y1="280" x2="720" y2="280"/>
        <line x1="80" y1="360" x2="720" y2="360"/>
        <line x1="80" y1="440" x2="720" y2="440"/>
      </g>

      <!-- 3D Bar Chart -->
      <g filter="url(#shadow-econ)">
        <!-- Bar 1 -->
        <rect x="150" y="340" width="56" height="100" rx="10" fill="#818cf8"/>
        <!-- Bar 2 -->
        <rect x="250" y="270" width="56" height="170" rx="10" fill="#6366f1"/>
        <!-- Bar 3 -->
        <rect x="350" y="210" width="56" height="230" rx="10" fill="#38bdf8"/>
        <!-- Bar 4 -->
        <rect x="450" y="150" width="56" height="290" rx="10" fill="#34d399"/>
        <!-- Bar 5 -->
        <rect x="550" y="100" width="56" height="340" rx="10" fill="#10b981"/>
      </g>

      <!-- Upward Trend Line with Glowing Nodes -->
      <g filter="url(#shadow-econ)">
        <path d="M178,320 L278,250 L378,190 L478,130 L578,80" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Arrowhead -->
        <polygon points="578,80 550,75 565,105" fill="#facc15"/>

        <!-- Glowing Nodes -->
        <circle cx="178" cy="320" r="10" fill="#ffffff" stroke="#facc15" stroke-width="4"/>
        <circle cx="278" cy="250" r="10" fill="#ffffff" stroke="#facc15" stroke-width="4"/>
        <circle cx="378" cy="190" r="10" fill="#ffffff" stroke="#facc15" stroke-width="4"/>
        <circle cx="478" cy="130" r="10" fill="#ffffff" stroke="#facc15" stroke-width="4"/>
        <circle cx="578" cy="80" r="12" fill="#ffffff" stroke="#f59e0b" stroke-width="5"/>
      </g>

      <!-- Financial Coins Overlay -->
      <g filter="url(#shadow-econ)" transform="translate(640, 360)">
        <ellipse cx="0" cy="40" rx="45" ry="18" fill="#ca8a04"/>
        <ellipse cx="0" cy="35" rx="45" ry="18" fill="#eab308"/>
        <ellipse cx="0" cy="15" rx="45" ry="18" fill="#ca8a04"/>
        <ellipse cx="0" cy="10" rx="45" ry="18" fill="#facc15"/>
        <ellipse cx="0" cy="-10" rx="45" ry="18" fill="#ca8a04"/>
        <ellipse cx="0" cy="-15" rx="45" ry="18" fill="#fde047"/>
        <text x="0" y="-8" font-family="sans-serif" font-size="22" font-weight="900" fill="#854d0e" text-anchor="middle">$</text>
      </g>

      <!-- Label Banner -->
      <rect x="290" y="490" width="220" height="48" rx="24" fill="#1e1b4b" opacity="0.8"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#e0e7ff" text-anchor="middle" letter-spacing="3">ECONOMICS</text>
    </svg>`,

  civics: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-civic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="50%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <filter id="shadow-civic" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#020617" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-civic)"/>

      <!-- Government Building / Parliament Neoclassical Facade -->
      <g filter="url(#shadow-civic)" fill="#f8fafc">
        <!-- Capitol Dome in background -->
        <path d="M350,190 Q400,120 450,190 Z" fill="#e2e8f0"/>
        <rect x="390" y="90" width="20" height="35" fill="#cbd5e1"/>
        <circle cx="400" cy="85" r="8" fill="#facc15"/>

        <!-- Pediment Triangle -->
        <polygon points="200,220 400,140 600,220"/>
        <rect x="190" y="220" width="420" height="20" rx="3" fill="#e2e8f0"/>

        <!-- Grand Columns -->
        <g fill="#f8fafc">
          <rect x="220" y="240" width="30" height="180" rx="4"/>
          <rect x="280" y="240" width="30" height="180" rx="4"/>
          <rect x="340" y="240" width="30" height="180" rx="4"/>
          <rect x="430" y="240" width="30" height="180" rx="4"/>
          <rect x="490" y="240" width="30" height="180" rx="4"/>
          <rect x="550" y="240" width="30" height="180" rx="4"/>
        </g>

        <!-- Base Foundation Steps -->
        <rect x="180" y="420" width="440" height="16" fill="#e2e8f0"/>
        <rect x="160" y="436" width="480" height="18" fill="#cbd5e1"/>
        <rect x="140" y="454" width="520" height="20" fill="#94a3b8"/>
      </g>

      <!-- Scales of Justice Symbol In Center -->
      <g filter="url(#shadow-civic)" transform="translate(400, 310)">
        <rect x="-4" y="-70" width="8" height="130" fill="#facc15" rx="2"/>
        <ellipse cx="0" cy="60" rx="30" ry="10" fill="#ca8a04"/>
        <!-- Balance Beam -->
        <rect x="-80" y="-70" width="160" height="6" fill="#facc15" rx="2"/>
        <!-- Left Pan -->
        <line x1="-70" y1="-64" x2="-85" y2="-20" stroke="#fde047" stroke-width="2"/>
        <line x1="-70" y1="-64" x2="-55" y2="-20" stroke="#fde047" stroke-width="2"/>
        <path d="M-95,-20 Q-70,0 -45,-20 Z" fill="#eab308"/>
        <!-- Right Pan -->
        <line x1="70" y1="-64" x2="55" y2="-20" stroke="#fde047" stroke-width="2"/>
        <line x1="70" y1="-64" x2="85" y2="-20" stroke="#fde047" stroke-width="2"/>
        <path d="M45,-20 Q70,0 95,-20 Z" fill="#eab308"/>
      </g>

      <!-- Label Banner -->
      <rect x="310" y="490" width="180" height="48" rx="24" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#dbeafe" text-anchor="middle" letter-spacing="3">CIVICS</text>
    </svg>`,

  mathematics: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-math" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="50%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#0c4a6e"/>
        </linearGradient>
        <filter id="shadow-math" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#082f49" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-math)"/>

      <!-- Geometric Grid -->
      <g stroke="#e0f2fe" stroke-width="1.2" opacity="0.2">
        <line x1="100" y1="0" x2="100" y2="600"/>
        <line x1="200" y1="0" x2="200" y2="600"/>
        <line x1="300" y1="0" x2="300" y2="600"/>
        <line x1="400" y1="0" x2="400" y2="600"/>
        <line x1="500" y1="0" x2="500" y2="600"/>
        <line x1="600" y1="0" x2="600" y2="600"/>
        <line x1="700" y1="0" x2="700" y2="600"/>
        <line x1="0" y1="100" x2="800" y2="100"/>
        <line x1="0" y1="200" x2="800" y2="200"/>
        <line x1="0" y1="300" x2="800" y2="300"/>
        <line x1="0" y1="400" x2="800" y2="400"/>
        <line x1="0" y1="500" x2="800" y2="500"/>
      </g>

      <!-- 3D Geometric Polyhedron & Abacus / Compass Geometry -->
      <g filter="url(#shadow-math)" transform="translate(400, 260)">
        <!-- Golden Ratio Spiral / Circles -->
        <circle cx="0" cy="0" r="140" fill="none" stroke="#bae6fd" stroke-width="3" opacity="0.4"/>
        <circle cx="0" cy="0" r="90" fill="none" stroke="#bae6fd" stroke-width="2" opacity="0.5"/>

        <!-- 3D Icosahedron Geometry Wireframe -->
        <polygon points="0,-120 100,-40 60,80 -60,80 -100,-40" fill="#38bdf8" opacity="0.35"/>
        <polygon points="0,-120 100,-40 0,0" fill="#7dd3fc" opacity="0.45"/>
        <polygon points="100,-40 60,80 0,0" fill="#0284c7" opacity="0.45"/>
        <polygon points="60,80 -60,80 0,0" fill="#0369a1" opacity="0.5"/>
        <polygon points="-60,80 -100,-40 0,0" fill="#0284c7" opacity="0.45"/>
        <polygon points="-100,-40 0,-120 0,0" fill="#7dd3fc" opacity="0.45"/>

        <!-- Wireframe Lines -->
        <path d="M0,-120 L100,-40 L60,80 L-60,80 L-100,-40 Z" fill="none" stroke="#ffffff" stroke-width="4"/>
        <line x1="0" y1="-120" x2="0" y2="0" stroke="#ffffff" stroke-width="3"/>
        <line x1="100" y1="-40" x2="0" y2="0" stroke="#ffffff" stroke-width="3"/>
        <line x1="60" y1="80" x2="0" y2="0" stroke="#ffffff" stroke-width="3"/>
        <line x1="-60" y1="80" x2="0" y2="0" stroke="#ffffff" stroke-width="3"/>
        <line x1="-100" y1="-40" x2="0" y2="0" stroke="#ffffff" stroke-width="3"/>
      </g>

      <!-- Floating Math Symbols (Pi, Sigma, Square Root, Infinity) -->
      <g filter="url(#shadow-math)">
        <!-- Pi π -->
        <text x="170" y="200" font-family="serif" font-size="70" font-weight="900" fill="#ffffff" opacity="0.9">π</text>
        <!-- Sigma Σ -->
        <text x="610" y="210" font-family="sans-serif" font-size="64" font-weight="900" fill="#facc15" opacity="0.95">∑</text>
        <!-- Square Root √x -->
        <text x="160" y="380" font-family="sans-serif" font-size="56" font-weight="900" fill="#facc15" opacity="0.95">√x</text>
        <!-- Infinity ∞ -->
        <text x="600" y="380" font-family="sans-serif" font-size="64" font-weight="900" fill="#ffffff" opacity="0.9">∞</text>
      </g>

      <!-- Label Banner -->
      <rect x="280" y="490" width="240" height="48" rx="24" fill="#082f49" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#e0f2fe" text-anchor="middle" letter-spacing="3">MATHEMATICS</text>
    </svg>`,

  english: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-eng" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#be123c"/>
          <stop offset="50%" stop-color="#e11d48"/>
          <stop offset="100%" stop-color="#881337"/>
        </linearGradient>
        <filter id="shadow-eng" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#4c0519" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-eng)"/>

      <!-- Open Book Illuminated -->
      <g filter="url(#shadow-eng)" transform="translate(400, 310)">
        <!-- Hardcover Binding -->
        <path d="M-220,120 C-110,95 0,115 0,125 C0,115 110,95 220,120 L210,140 C110,115 0,135 0,145 C0,135 -110,115 -210,140 Z" fill="#4c0519"/>
        
        <!-- Book Pages Spine & Curvature -->
        <path d="M-200,90 C-100,70 0,90 0,95 L0,-70 C0,-75 -100,-95 -200,-75 Z" fill="#fff1f2"/>
        <path d="M200,90 C100,70 0,90 0,95 L0,-70 C0,-75 100,-95 200,-75 Z" fill="#ffffff"/>

        <!-- Text lines on left page -->
        <line x1="-170" y1="-40" x2="-30" y2="-52" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="-170" y1="-10" x2="-30" y2="-22" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="-170" y1="20" x2="-40" y2="8" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="-170" y1="50" x2="-60" y2="38" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>

        <!-- Text lines on right page -->
        <line x1="30" y1="-52" x2="170" y2="-40" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="30" y1="-22" x2="170" y2="-10" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="30" y1="8" x2="160" y2="20" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>
        <line x1="30" y1="38" x2="130" y2="50" stroke="#fda4af" stroke-width="5" stroke-linecap="round"/>

        <!-- Ribbon Bookmark -->
        <path d="M0,-70 C-20,0 -10,80 15,130 L30,105 L45,130 C20,80 10,0 0,-70 Z" fill="#facc15"/>
      </g>

      <!-- Floating Alphabet Letters & Quotes -->
      <g filter="url(#shadow-eng)">
        <text x="200" y="150" font-family="serif" font-size="70" font-weight="900" fill="#ffffff">A</text>
        <text x="380" y="130" font-family="serif" font-size="64" font-weight="900" fill="#fde047">B</text>
        <text x="560" y="160" font-family="serif" font-size="70" font-weight="900" fill="#ffffff">C</text>
        <!-- Speech Bubble / Conversation -->
        <g transform="translate(620, 220)">
          <path d="M0,0 Q30,-20 60,0 Q80,20 60,40 Q30,50 15,40 L0,55 L5,35 Q-10,20 0,0 Z" fill="#ffffff" opacity="0.95"/>
          <text x="30" y="26" font-family="sans-serif" font-size="20" font-weight="900" fill="#be123c" text-anchor="middle">" "</text>
        </g>
      </g>

      <!-- Label Banner -->
      <rect x="310" y="490" width="180" height="48" rx="24" fill="#4c0519" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#ffe4e6" text-anchor="middle" letter-spacing="3">ENGLISH</text>
    </svg>`,

  physics: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-phys" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6d28d9"/>
          <stop offset="50%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#3b0764"/>
        </linearGradient>
        <radialGradient id="nucleus-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#7c3aed"/>
        </radialGradient>
        <filter id="glow-phys" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="shadow-phys" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#2e1065" flood-opacity="0.45"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-phys)"/>

      <!-- Cosmos & Star Dust -->
      <g fill="#ffffff" opacity="0.6">
        <circle cx="120" cy="100" r="2"/>
        <circle cx="220" cy="80" r="3"/>
        <circle cx="680" cy="110" r="2.5"/>
        <circle cx="710" cy="240" r="2"/>
        <circle cx="150" cy="440" r="2.5"/>
        <circle cx="640" cy="420" r="3"/>
      </g>

      <!-- Centerpiece: Rutherford-Bohr Atomic Orbitals -->
      <g filter="url(#shadow-phys)" transform="translate(400, 270)">
        <!-- Orbit 1 (Horizontal tilt) -->
        <ellipse cx="0" cy="0" rx="190" ry="60" fill="none" stroke="#a78bfa" stroke-width="4" transform="rotate(-30)" opacity="0.85"/>
        <circle cx="150" cy="-60" r="10" fill="#38bdf8" filter="url(#glow-phys)"/>

        <!-- Orbit 2 (Vertical tilt) -->
        <ellipse cx="0" cy="0" rx="190" ry="60" fill="none" stroke="#c084fc" stroke-width="4" transform="rotate(30)" opacity="0.85"/>
        <circle cx="-140" cy="-65" r="10" fill="#f43f5e" filter="url(#glow-phys)"/>

        <!-- Orbit 3 (Perpendicular) -->
        <ellipse cx="0" cy="0" rx="190" ry="60" fill="none" stroke="#818cf8" stroke-width="4" transform="rotate(90)" opacity="0.85"/>
        <circle cx="0" cy="180" r="10" fill="#facc15" filter="url(#glow-phys)"/>

        <!-- Atomic Nucleus (Clustered Protons & Neutrons) -->
        <g filter="url(#glow-phys)">
          <circle cx="-12" cy="-10" r="18" fill="#ef4444"/>
          <circle cx="12" cy="-10" r="18" fill="#38bdf8"/>
          <circle cx="0" cy="12" r="18" fill="#facc15"/>
          <circle cx="0" cy="-4" r="14" fill="#ffffff" opacity="0.8"/>
        </g>
      </g>

      <!-- Formula e = mc² and Vector Arrows -->
      <g filter="url(#shadow-phys)">
        <text x="210" y="440" font-family="serif" font-size="36" font-style="italic" font-weight="700" fill="#e9d5ff">E = mc²</text>
        <text x="520" y="440" font-family="serif" font-size="34" font-style="italic" font-weight="700" fill="#bae6fd">F = ma</text>
      </g>

      <!-- Label Banner -->
      <rect x="310" y="490" width="180" height="48" rx="24" fill="#3b0764" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#f3e8ff" text-anchor="middle" letter-spacing="3">PHYSICS</text>
    </svg>`,

  chemistry: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-chem" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#047857"/>
          <stop offset="50%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#064e3b"/>
        </linearGradient>
        <linearGradient id="liquid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
        <filter id="shadow-chem" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#022c22" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-chem)"/>

      <!-- Molecular Hexagonal Benzene Rings in background -->
      <g stroke="#a7f3d0" stroke-width="2.5" fill="none" opacity="0.25">
        <polygon points="120,120 160,95 200,120 200,170 160,195 120,170"/>
        <polygon points="600,120 640,95 680,120 680,170 640,195 600,170"/>
        <polygon points="640,195 680,170 720,195 720,245 680,270 640,245"/>
      </g>

      <!-- Centerpiece: Erlenmeyer Flask & Test Tubes -->
      <g filter="url(#shadow-chem)">
        <!-- Test Tube 1 (Tilted Left) -->
        <g transform="translate(240, 240) rotate(-20)">
          <rect x="-18" y="-90" width="36" height="180" rx="18" fill="#ffffff" opacity="0.85" stroke="#ecfdf5" stroke-width="3"/>
          <!-- Liquid inside -->
          <path d="M-15,10 L15,10 L15,75 A15,15 0 0,1 -15,75 Z" fill="#f43f5e"/>
          <!-- Bubbles -->
          <circle cx="-4" cy="35" r="4" fill="#ffffff" opacity="0.7"/>
          <circle cx="6" cy="55" r="3" fill="#ffffff" opacity="0.7"/>
        </g>

        <!-- Erlenmeyer Flask In Center -->
        <g transform="translate(400, 270)">
          <!-- Glass Outline -->
          <path d="M-30,-120 L30,-120 L30,-70 L110,90 A25,25 0 0,1 90,120 L-90,120 A25,25 0 0,1 -110,90 L-30,-70 Z" fill="#ffffff" opacity="0.88" stroke="#ecfdf5" stroke-width="5"/>
          
          <!-- Liquid Inside Flask -->
          <path d="M-72,15 C-40,5 40,25 72,15 L90,110 A15,15 0 0,1 75,115 L-75,115 A15,15 0 0,1 -90,110 Z" fill="url(#liquid-gradient)"/>
          
          <!-- Glowing Bubbles rising -->
          <circle cx="-30" cy="50" r="8" fill="#a7f3d0" opacity="0.8"/>
          <circle cx="25" cy="70" r="11" fill="#a7f3d0" opacity="0.7"/>
          <circle cx="10" cy="30" r="6" fill="#ffffff" opacity="0.8"/>
          <circle cx="-10" cy="-20" r="7" fill="#6ee7b7" opacity="0.8"/>
          <circle cx="15" cy="-60" r="5" fill="#a7f3d0" opacity="0.7"/>
        </g>

        <!-- Test Tube 2 (Tilted Right) -->
        <g transform="translate(560, 240) rotate(20)">
          <rect x="-18" y="-90" width="36" height="180" rx="18" fill="#ffffff" opacity="0.85" stroke="#ecfdf5" stroke-width="3"/>
          <!-- Liquid inside -->
          <path d="M-15,0 L15,0 L15,75 A15,15 0 0,1 -15,75 Z" fill="#38bdf8"/>
          <!-- Bubbles -->
          <circle cx="5" cy="30" r="4" fill="#ffffff" opacity="0.7"/>
          <circle cx="-4" cy="50" r="3" fill="#ffffff" opacity="0.7"/>
        </g>
      </g>

      <!-- Label Banner -->
      <rect x="290" y="490" width="220" height="48" rx="24" fill="#064e3b" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#d1fae5" text-anchor="middle" letter-spacing="3">CHEMISTRY</text>
    </svg>`,

  biology: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-bio" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#15803d"/>
          <stop offset="50%" stop-color="#16a34a"/>
          <stop offset="100%" stop-color="#14532d"/>
        </linearGradient>
        <filter id="shadow-bio" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#052e16" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-bio)"/>

      <!-- DNA Double Helix Background Motif -->
      <g stroke="#86efac" stroke-width="3" fill="none" opacity="0.3">
        <path d="M120,50 Q160,150 120,250 T120,450 T120,600"/>
        <path d="M160,50 Q120,150 160,250 T160,450 T160,600"/>
        <line x1="126" y1="100" x2="154" y2="100"/>
        <line x1="120" y1="200" x2="160" y2="200"/>
        <line x1="126" y1="300" x2="154" y2="300"/>
        <line x1="120" y1="400" x2="160" y2="400"/>
      </g>

      <!-- Centerpiece: Precision Microscope & Botanical Leaf -->
      <g filter="url(#shadow-bio)" transform="translate(420, 270)">
        <!-- Microscope Base -->
        <rect x="-90" y="140" width="160" height="24" rx="8" fill="#f8fafc"/>
        <rect x="-80" y="125" width="140" height="15" rx="4" fill="#cbd5e1"/>
        
        <!-- Curved Arm -->
        <path d="M-60,130 C-110,60 -110,-40 -50,-90 C-30,-110 0,-110 20,-90" fill="none" stroke="#f8fafc" stroke-width="26" stroke-linecap="round"/>
        
        <!-- Focus Adjustment Knobs -->
        <circle cx="-85" cy="40" r="16" fill="#64748b"/>
        <circle cx="-85" cy="40" r="10" fill="#94a3b8"/>

        <!-- Microscope Stage -->
        <rect x="-30" y="55" width="85" height="12" rx="3" fill="#334155"/>
        <rect x="-10" y="50" width="45" height="5" fill="#facc15"/>

        <!-- Objective Turret and Lenses -->
        <g fill="#cbd5e1">
          <rect x="0" y="-30" width="30" height="45" rx="4"/>
          <polygon points="5,15 15,35 25,15" fill="#e2e8f0"/>
          <!-- Eyepiece Tube -->
          <rect x="-5" y="-120" width="34" height="85" rx="5" transform="rotate(20)"/>
          <rect x="22" y="-140" width="40" height="20" rx="4" fill="#0f172a" transform="rotate(20)"/>
        </g>
      </g>

      <!-- Lush Botanical Green Leaf Overlay -->
      <g filter="url(#shadow-bio)" transform="translate(240, 320) rotate(-35)">
        <path d="M0,0 C60,-90 140,-90 180,-10 C140,50 60,50 0,0 Z" fill="#4ade80" stroke="#86efac" stroke-width="3"/>
        <line x1="0" y1="0" x2="180" y2="-10" stroke="#16a34a" stroke-width="3"/>
        <line x1="50" y1="-5" x2="80" y2="-40" stroke="#16a34a" stroke-width="2"/>
        <line x1="90" y1="-7" x2="120" y2="-40" stroke="#16a34a" stroke-width="2"/>
        <line x1="50" y1="-5" x2="70" y2="25" stroke="#16a34a" stroke-width="2"/>
        <line x1="90" y1="-7" x2="110" y2="25" stroke="#16a34a" stroke-width="2"/>
      </g>

      <!-- Label Banner -->
      <rect x="300" y="490" width="200" height="48" rx="24" fill="#14532d" opacity="0.85"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#dcfce7" text-anchor="middle" letter-spacing="3">BIOLOGY</text>
    </svg>`,

  computer: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-comp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <filter id="shadow-comp" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-comp)"/>

      <!-- Matrix binary code in background -->
      <g fill="#38bdf8" opacity="0.18" font-family="monospace" font-size="18">
        <text x="80" y="100">01001100 01101111 01100001</text>
        <text x="80" y="140">01110010 01101110 01101001</text>
        <text x="80" y="180">01101110 01100111 00100000</text>
        <text x="500" y="100">const exam = new Exam();</text>
        <text x="500" y="140">exam.start(); // Pro</text>
        <text x="500" y="180">return score.grade;</text>
      </g>

      <!-- Modern Laptop / Monitor -->
      <g filter="url(#shadow-comp)" transform="translate(400, 270)">
        <!-- Screen Outer Bezel -->
        <rect x="-180" y="-120" width="360" height="230" rx="14" fill="#0f172a" stroke="#334155" stroke-width="4"/>
        
        <!-- Screen Display Content -->
        <rect x="-165" y="-105" width="330" height="200" rx="6" fill="#0284c7"/>
        <!-- Window titlebar -->
        <rect x="-165" y="-105" width="330" height="26" fill="#0369a1"/>
        <circle cx="-150" cy="-92" r="4" fill="#ef4444"/>
        <circle cx="-138" cy="-92" r="4" fill="#facc15"/>
        <circle cx="-126" cy="-92" r="4" fill="#22c55e"/>

        <!-- Code syntax lines on screen -->
        <rect x="-140" y="-60" width="120" height="10" rx="3" fill="#fde047"/>
        <rect x="-140" y="-40" width="180" height="10" rx="3" fill="#ffffff" opacity="0.9"/>
        <rect x="-110" y="-20" width="140" height="10" rx="3" fill="#a7f3d0"/>
        <rect x="-110" y="0" width="200" height="10" rx="3" fill="#ffffff" opacity="0.8"/>
        <rect x="-140" y="20" width="80" height="10" rx="3" fill="#f472b6"/>
        <rect x="-140" y="40" width="160" height="10" rx="3" fill="#38bdf8"/>

        <!-- Laptop Base / Keyboard -->
        <polygon points="-210,130 210,130 190,110 -190,110" fill="#cbd5e1"/>
        <rect x="-40" y="115" width="80" height="6" rx="2" fill="#94a3b8"/>
      </g>

      <!-- Label Banner -->
      <rect x="270" y="490" width="260" height="48" rx="24" fill="#020617" opacity="0.9"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="3">COMPUTER SCIENCE</text>
    </svg>`,

  general: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
      <defs>
        <linearGradient id="bg-gen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0891b2"/>
          <stop offset="50%" stop-color="#0d9488"/>
          <stop offset="100%" stop-color="#0e7490"/>
        </linearGradient>
        <filter id="shadow-gen" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#164e63" flood-opacity="0.4"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#bg-gen)"/>

      <!-- Modern Geometric Patterns -->
      <circle cx="160" cy="140" r="100" fill="#ffffff" opacity="0.08"/>
      <circle cx="660" cy="180" r="140" fill="#ffffff" opacity="0.06"/>
      <polygon points="680,480 780,320 860,480" fill="#ffffff" opacity="0.07"/>

      <!-- Graduation Cap and Book (EthioSmart Core Symbol) -->
      <g filter="url(#shadow-gen)" transform="translate(400, 270)">
        <!-- Open Book Base -->
        <path d="M-150,90 C-80,70 0,85 0,90 C0,85 80,70 150,90 L140,110 C70,90 0,105 0,110 C0,105 -70,90 -140,110 Z" fill="#0f2a5e"/>
        <path d="M-140,70 C-70,50 0,65 0,70 L0,-20 C0,-25 -70,-40 -140,-20 Z" fill="#f0f7ff"/>
        <path d="M140,70 C70,50 0,65 0,70 L0,-20 C0,-25 70,-40 140,-20 Z" fill="#ffffff"/>

        <!-- Graduation Mortarboard Cap -->
        <polygon points="0,-120 130,-70 0,-20 -130,-70" fill="#0f172a"/>
        <polygon points="0,-115 120,-70 0,-25 -120,-70" fill="#1e293b"/>
        <!-- Cap Skullcap -->
        <path d="M-60,-55 C-60,-20 60,-20 60,-55 Z" fill="#0f172a"/>
        <!-- Gold Tassel -->
        <circle cx="0" cy="-70" r="6" fill="#facc15"/>
        <path d="M0,-70 C40,-65 80,-40 90,0" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
        <rect x="85" y="0" width="10" height="20" rx="3" fill="#eab308"/>
      </g>

      <!-- Label Banner -->
      <rect x="280" y="490" width="240" height="48" rx="24" fill="#0f2a5e" opacity="0.9"/>
      <text x="400" y="522" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#bae6fd" text-anchor="middle" letter-spacing="3">ETHIOSMART</text>
    </svg>`,
};

/**
 * Convert SVG string to a data URI for clean src="..." usage
 */
export function getSvgDataUri(category: SubjectCategory): string {
  const rawSvg = SVG_TEMPLATES[category] || SVG_TEMPLATES.general;
  const cleanSvg = rawSvg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
}

/**
 * Built-in cover presets
 */
export const SUBJECT_COVER_PRESETS: SubjectCoverPreset[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    gradient: 'from-cyan-600 to-sky-700',
    accentColor: '#0284c7',
    badgeBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    description: 'Geometric shapes, calculus curves, mathematical formulas',
    svgDataUri: getSvgDataUri('mathematics'),
  },
  {
    id: 'physics',
    name: 'Physics',
    gradient: 'from-violet-600 to-purple-800',
    accentColor: '#7c3aed',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    textColor: 'text-purple-600 dark:text-purple-400',
    description: 'Atomic model, orbital rings, Einstein mass-energy equivalence',
    svgDataUri: getSvgDataUri('physics'),
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    gradient: 'from-emerald-600 to-teal-800',
    accentColor: '#059669',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    description: 'Laboratory glassware, chemical flasks, molecular rings',
    svgDataUri: getSvgDataUri('chemistry'),
  },
  {
    id: 'biology',
    name: 'Biology',
    gradient: 'from-green-600 to-emerald-800',
    accentColor: '#16a34a',
    badgeBg: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    textColor: 'text-green-600 dark:text-green-400',
    description: 'Optical microscope, DNA helix, botanical plant structures',
    svgDataUri: getSvgDataUri('biology'),
  },
  {
    id: 'history',
    name: 'History',
    gradient: 'from-amber-600 to-yellow-800',
    accentColor: '#d97706',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    textColor: 'text-amber-600 dark:text-amber-400',
    description: 'Ancient scrolls, wax seals, classical architecture columns',
    svgDataUri: getSvgDataUri('history'),
  },
  {
    id: 'geography',
    name: 'Geography',
    gradient: 'from-teal-600 to-cyan-800',
    accentColor: '#0d9488',
    badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
    textColor: 'text-teal-600 dark:text-teal-400',
    description: 'Navigational globe, compass rose, mountain topography',
    svgDataUri: getSvgDataUri('geography'),
  },
  {
    id: 'economics',
    name: 'Economics',
    gradient: 'from-indigo-600 to-blue-800',
    accentColor: '#4f46e5',
    badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    description: 'Financial growth charts, upward trend curves, markets',
    svgDataUri: getSvgDataUri('economics'),
  },
  {
    id: 'civics',
    name: 'Civics',
    gradient: 'from-blue-600 to-indigo-900',
    accentColor: '#2563eb',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    textColor: 'text-blue-600 dark:text-blue-400',
    description: 'Government capitol, scales of justice, civic constitution',
    svgDataUri: getSvgDataUri('civics'),
  },
  {
    id: 'english',
    name: 'English & Literature',
    gradient: 'from-rose-600 to-pink-800',
    accentColor: '#e11d48',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    textColor: 'text-rose-600 dark:text-rose-400',
    description: 'Illuminated open literature book, typography, letters',
    svgDataUri: getSvgDataUri('english'),
  },
  {
    id: 'computer',
    name: 'Computer Science',
    gradient: 'from-slate-700 to-slate-900',
    accentColor: '#0284c7',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    textColor: 'text-slate-600 dark:text-slate-400',
    description: 'Programming syntax, modern laptop, binary algorithm',
    svgDataUri: getSvgDataUri('computer'),
  },
  {
    id: 'general',
    name: 'General Academic',
    gradient: 'from-cyan-600 to-teal-700',
    accentColor: '#0891b2',
    badgeBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    description: 'Signature EthioSmart graduation mortarboard and academic star',
    svgDataUri: getSvgDataUri('general'),
  },
];

/**
 * Get effective cover image URL and styling for any subject.
 * Guaranteed to never return a broken image.
 */
export function getSubjectCover(
  subjectName?: string,
  coverImageUrl?: string | null
): {
  url: string;
  isCustom: boolean;
  category: SubjectCategory;
  preset: SubjectCoverPreset;
} {
  const category = detectSubjectCategory(subjectName);
  const preset =
    SUBJECT_COVER_PRESETS.find((p) => p.id === category) ||
    SUBJECT_COVER_PRESETS[SUBJECT_COVER_PRESETS.length - 1];

  if (coverImageUrl && coverImageUrl.trim()) {
    return {
      url: getOptimizedImageUrl(coverImageUrl.trim()),
      isCustom: true,
      category,
      preset,
    };
  }

  return {
    url: preset.svgDataUri,
    isCustom: false,
    category,
    preset,
  };
}

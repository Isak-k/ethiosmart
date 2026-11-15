# EthioSmart — Complete System Overview (for AI/ChatGPT onboarding)

> **Purpose of this document:** Give ChatGPT (or any LLM/engineer) a complete, accurate picture of this codebase in one file: what it is, how it is structured, how the frontend and backend fit together, its data model, its **security issues**, and what needs to be **added** and **improved**.
>
> **Project:** EthioSmart (internally also called **ExamPro** / Firebase project `online-exam-f443c`)
> **Type:** Ethiopian university exam-prep / e-learning platform (Amharic + English)
> **Stack:** Vite + React 18 + TypeScript frontend · Firebase (Auth, Firestore, Storage, App Check, AI Logic) backend · Vercel serverless API · Firebase Cloud Functions · Capacitor Android shell · PWA/offline support
> **Size:** ~94k LOC frontend · 301 files in `src/` · 52 pages · 133 components · 71 `src/lib` modules · 31 test files · 112 loose markdown docs in repo root (doc sprawl)

---

## 1. What the system does (product summary)

EthioSmart is a web/mobile app for Ethiopian students to practice for university entrance/department exams. Core capabilities:

- **Exams**: admins create exams with questions (MCQ, text, image-attached), students take timed exams, admins grade submissions (auto + manual), results & review pages.
- **Practice Exams / Practice Mode**: untimed or self-study variants with configurable passing score, analytics for admins.
- **AI Question Generation**: multi-provider AI pipeline (Gemini → Groq → OpenRouter → Hugging Face) with an orchestrator + fallback, batch generation of questions from a prompt/topic/source material, plus an "AI Study Assistant" chat for students.
- **Digital Library**: books (PDF) upload/read, "shortnotes" (interactive notes with math/code/flashcards/exercises), Google Drive import of documents.
- **Leaderboards**: department-based rankings, auto-computed by Cloud Functions, cached in Firestore.
- **Community Chat**: student/admin channels and messages.
- **RBAC permissions**: granular permission system (`manageExams`, `studentResults`, `manageBooks`, …), roles `student` / `admin` / `superadmin`, plus a hidden super-admin email.
- **Offline / PWA**: Firestore multi-tab IndexedDB persistence, offline exam downloads, offline books, install prompt, service worker (`dev-dist/`).
- **Guest mode**: students can use the app without signup via a shared guest account (open-access mode controllable by admins).
- **i18n**: Amharic + English via i18next.
- **Platforms**: web (Vercel), Android (Capacitor, `com.ethiosmart.app`).

---

## 2. Tech stack & external services

| Layer | Technology |
|---|---|
| Frontend build | Vite 5, TypeScript, React 18, `react-router-dom` v6 |
| UI | shadcn/ui (Radix), Tailwind CSS, lucide-react, recharts, jspdf |
| State/data | TanStack Query, React Context (`AuthContext`, `PermissionsContext`, theme) |
| Backend-as-a-Service | Firebase: Auth (email/password, Google), Firestore, Storage, App Check (optional, reCAPTCHA v3), Firebase AI Logic (Gemini via GoogleAIBackend) |
| Serverless API (Vercel) | `api/` — Node handlers for AI generation & Google Drive proxying |
| Cloud Functions | `functions/` — Node 18, firebase-functions v5, firebase-admin v12 |
| Mobile | Capacitor 8 (Android) |
| Hosting | Vercel (`vercel.json` SPA rewrites + `/api/*`), Firebase Hosting config also present (`firebase.json`) |
| Tests | Vitest + Testing Library (frontend), Jest (functions) |

---

## 3. Repository layout (frontend + backend)

```
ethiosmart-main/
├── api/                      # Vercel serverless API (NO auth on any endpoint)
│   ├── ai/generate-batch.ts  #   POST: AI question batch generation (has built-in fallback keys)
│   ├── ai/provider-status.ts #   GET:  which AI providers have keys/are up (same fallback keys)
│   └── drive/                #   validate.ts / download.ts / extract-content.ts (Google Drive proxy)
├── functions/                # Firebase Cloud Functions (Node 18)
│   └── src/
│       ├── index.ts          #   exports leaderboard, ai-generator, books functions
│       ├── leaderboard.ts    #   callable: calculateDepartmentLeaderboard, Global, admin* fns + triggers
│       ├── ai-generator/     #   callable: generateAIExamBatch, getAIProviderStatus (+ adapters/)
│       ├── books/            #   onRequest: validateGoogleDriveResource (CORS *, no auth)
│       └── ranking-parser.ts, leaderboard-formatter.ts (+ tests)
├── src/
│   ├── main.tsx, App.tsx     # entry; route table (all routes listed there, lazy-loaded)
│   ├── integrations/firebase/# client.ts (init + config fallback!), types.ts
│   ├── contexts/             # AuthContext, FirebaseAuthContext, PermissionsContext
│   ├── hooks/                # use-leaderboard, use-offline, use-pwa-install, useGranularPermissions, …
│   ├── components/           # admin/, auth/, book/, dashboard/, exam/, layout/, leaderboard/, notes/,
│   │                         #   community/, department/, notifications/, subject/, ui/ (shadcn)
│   ├── pages/                # 52 pages: Index, Auth, Dashboard, TakeExam*, Admin*, Student*, …
│   ├── lib/                  # ALL business logic (71 modules):
│   │   ├── firebase-attempts.ts   # scoring happens CLIENT-SIDE here
│   │   ├── firebase-exams.ts, firebase-leaderboard.ts, firebase-admin(-protected).ts, auth.ts
│   │   ├── ai-engine/             # client-side AI orchestrator + adapters (Gemini/Groq/OpenRouter/HF)
│   │   ├── ai-settings.ts         # stores provider keys in Firestore `settings/ai_providers` + HARDCODED keys
│   │   ├── ai-generator-service.ts, gemini-questions.ts, system-settings.ts
│   │   ├── exam-mode-engine.ts, practice-mode-engine.ts, practice-exam-config.ts
│   │   ├── offline-*.ts, device-storage.ts, session-persistence*.ts (PWA/offline stack)
│   │   ├── permissions.ts, permission-middleware.ts, validations.ts, question-parser.ts
│   │   └── google-drive.ts, books.ts, interactive-notes, shortnotes-organizer, subject-covers …
│   ├── server/               # shared server-side bridges imported by api/ (ai-bridge, drive-bridge)
│   ├── types/                # permissions, book, subject, community, ai-generator
│   └── pages/TakeExam*.tsx   # ⚠ FOUR competing copies: TakeExam.tsx (used), TakeExamNew.tsx,
│                             #   TakeExam-refactored.tsx, TakeExam-v4-new.tsx, TakeExam.backup.tsx
├── firestore.rules           # ⚠ see §6 — several collections world-readable/writable
├── storage.rules             # avatars / exam-images / subject-covers
├── firestore.indexes.json    # query indexes
├── firebase.json, .firebaserc(?), vercel.json, capacitor.config.ts
├── docs/                     # openapi.yaml, GEMINI_QUESTION_GENERATION_SETUP.md
└── *.md (112 files!)         # implementation notes dumped at repo root (doc sprawl)
```

---

## 4. Frontend architecture

- **Routing** (`src/App.tsx`): `/` landing, `/auth`, then `/dashboard/*`. Admin routes wrapped in `ProtectedRoute allowedRoles={["admin"]}`; student routes in `allowedRoles={["student"]}`; super-admin route adds `requireSuperAdmin`. Many alias redirects (`/books` → `/dashboard/books`, …). All pages lazy-loaded.
- **Auth** (`AuthContext` / `FirebaseAuthContext` + `src/lib/auth.ts`): email/password + Google sign-in, guest sessions (`guest-session.ts`, shared credentials — see §6), profile stored in Firestore `users/{uid}` with `role`, `permissions`, `sectionPermissions`, `disabled`.
- **RBAC** (`PermissionsContext`, `lib/permissions.ts`, `permission-middleware.ts`, `types/permissions.ts`): fine-grained keys, enforced **client-side** (`enforcePermission`) and partially mirrored in Firestore rules (`users` update rule pins `role`/`permissions`). Super-admin shortcut is a hardcoded email (`isak@gmail.com`) checked in ≥6 places.
- **Exam taking** (`pages/TakeExam.tsx`, `lib/exam-mode-engine.ts`, `lib/firebase-attempts.ts`): timer, keyboard shortcuts, offline support; **scoring (`calculateScoreFromAnswers`) runs in the browser** and is written straight to Firestore.
- **AI pipeline** (`lib/ai-engine/orchestrator.ts` + `adapters.ts`, `ai-settings.ts`, `ai-generator-service.ts`): reads provider config/keys from Firestore `settings/ai_providers` (world-readable!) with hardcoded fallback keys baked into the bundle; can also call `/api/ai/generate-batch` (Vercel) or the `generateAIExamBatch` callable Cloud Function.
- **Offline/PWA**: Firestore IndexedDB persistence, offline exam packages (`offline-download-manager.ts`), offline books/notes, `vite-plugin-pwa`-style `dev-dist/`, install prompt.
- **i18n**: `lib/i18n.ts` (~1,900 lines) — English + Amharic.
- **Diagnostics pages** shipping in production bundle: `/firebase-test`, `/firebase-diagnostic`, `/exam-diagnostic`, `/migrate-exams`, `/dashboard/permission-test`.

## 5. Backend architecture & data model

**Firestore collections** (from `firestore.rules` + code):

| Collection | Purpose | Rules (current, simplified) |
|---|---|---|
| `users` | profiles, role, permissions | self read; create student-only; self-update pinned role/permissions; admin full |
| `exams` (+`questions`, `blockedStudents` subcollections) | exam definitions & questions | authenticated read; creator/admin write |
| **`examAttempts`** (+`answers`) | student attempts & scores | **`read/create/update: if true` — completely open** ⚠ |
| `subjects` (+`chapters`) | subjects & chapters | read: anyone; **write: any authenticated user** ⚠ |
| `departments` | departments | read: anyone; write: admin |
| `books`, `bookBookmarks` | library | read auth/published; creator/admin write; bookmark owner-only |
| `studentFeedback` (+`replies`) | student↔admin messaging | create own; read own/admin |
| **`communityChannels`** (+`messages`), **`communityMessages`** | community chat | **`read/write: if true` — world-readable/writable, incl. unauthenticated** ⚠ |
| `leaderboardCache`, `leaderboardRankings` | computed rankings | read auth; write admin |
| `archivedResults` | archived attempts | read own/admin; write admin |
| **`settings`** | **system settings AND `ai_providers` (AI API keys)** | **`read: if true` — world-readable, writes admin** ⚠ |

**Storage**: `avatars/{uid}/…` (owner write, 5MB image), `exam-images/…` (any auth write), `subject-covers/…` (public read, any auth write).

**Cloud Functions** (`functions/src/index.ts`):
- Leaderboard: `calculateDepartmentLeaderboard`, `calculateGlobalDepartmentLeaderboard` (callable, auth-checked), `onExamAttemptUpdate`, `onUserProfileUpdate` (triggers), `refreshStaleCaches`, plus admin-only callables (`adminRefreshLeaderboardCache`, `adminRecalculateRankings`, `adminResetLeaderboard`, `adminGetLeaderboardStatus`).
- AI: `generateAIExamBatch`, `getAIProviderStatus` (callable, verifies auth + admin).
- Books: `validateGoogleDriveResource` (**onRequest, CORS `*`, no auth** — server-side Drive proxy).

**Vercel API** (`api/`): `ai/generate-batch`, `ai/provider-status`, `drive/validate|download|extract-content` — **none require authentication; all send `Access-Control-Allow-Origin: *`; all fall back to hardcoded built-in API keys**.

**Firebase AI Logic**: client also initializes `getAI(app, { backend: new GoogleAIBackend() })` — Gemini callable directly from the browser.

---

## 6. SECURITY ISSUES (prioritized)

### 🔴 Critical

1. **Hardcoded production API keys committed to the repo.**
   - `src/lib/ai-settings.ts` (`BUILTIN_DEFAULT_KEYS`) and `api/ai/generate-batch.ts`, `api/ai/provider-status.ts` (`BUILTIN_KEYS`) contain live-looking keys: Google Gemini `AIzaSyBDNhU8…`, Groq `gsk_HfEQ26…`, OpenRouter `sk-or-v1-40d17…`, Hugging Face `hf_QIkHQw…`.
   - These ship in the client bundle (anyone can extract them) and in git history. **Rotate all four keys immediately.**
2. **`settings` collection is world-readable** (`firestore.rules`: `match /settings/{settingId} { allow read: if true }`). The app stores AI provider keys in `settings/ai_providers` → **any anonymous internet user can read the AI keys with a plain Firestore REST call.**
3. **`examAttempts` and its `answers` subcollection are fully open** (`allow read/create/update: if true`). Anyone (even unauthenticated) can read every student's answers/scores and, worse, **forge/overwrite any attempt’s score**.
4. **Scoring is client-side** (`calculateScoreFromAnswers` in `src/lib/firebase-attempts.ts`, then `submitAttempt()` writes `totalScore` from the browser). Combined with #3, a student can submit a perfect score with one crafted request. **Exam integrity is effectively zero.**
5. **Community chat collections are fully open** (`communityChannels`, its `messages`, `communityMessages`: `allow read/write: if true` including nested wildcard). Anonymous users can read/edit/delete all chat content and inject messages.

### 🟠 High

6. **Vercel API endpoints have no authentication and CORS `*`** (`api/ai/generate-batch.ts`, `api/ai/provider-status.ts`, `api/drive/*`). Anyone can burn the owner’s AI quota/credits or use the Drive proxies; combined with the built-in fallback keys, this is a free, unauthenticated AI gateway.
7. **Shared guest account with hardcoded password** in the client bundle (`guest-session.ts`: `guest.exampro@gmail.com` / `GuestStudent2026!`). All guests share one identity; one leaked/guessed password (it's public) means anonymous impersonation, and rules can’t distinguish real students from guests once signed in. Guest device-id is client-generated.
8. **Super-admin gate is a hardcoded email** (`isak@gmail.com`) checked in client code (`types/permissions.ts`, `permission-middleware.ts`, `firebase-admin.ts`, `AdminGradeExam.tsx`, …) **and in `firestore.rules`** (`isAdminOrSuper()` shortcut). Email in a client bundle is not a secret; role should come from custom claims or the `users` doc only, and the hardcoded bypass should be removed.
9. **Subjects & chapters writable by ANY authenticated user** (`allow write: if isAuthenticated()`), which includes guests (see #7) — anyone can vandalize the curriculum.
10. **Storage rules**: `exam-images/` and `subject-covers/` writable by any authenticated user (any content up to 5MB, only `image/*` enforced); no per-user paths → one user can overwrite/replace another’s uploads (path collision) and there is no malware/content scanning.

### 🟡 Medium

11. **Firebase client config hardcoded as fallback** in `src/integrations/firebase/client.ts` (API key, project id). Firebase web keys are designed to be public, but the silent fallback hides misconfiguration; remove the fallback and fail fast.
12. **App Check is optional** (only initialized if `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` is set) and **not enforced** anywhere — so the open rules above can’t even be rate-limited/attested.
13. **Leaderboard integrity**: rankings are computed by Cloud Functions from `examAttempts` — but since attempts are writable by anyone (#3), leaderboards can be gamed (inflate via forged high score).
14. **`/api/drive/download` proxies file downloads** server-side without auth → bandwidth/egress abuse; fileId is URL-encoded (not full SSRF) but still an open relay to `drive.google.com` / `googleapis.com`.
15. **AI keys also travel to the client**: client-side `ai-engine` calls providers directly from the browser with the stored keys; any XSS or malicious extension reads them. Keys should live only in a server-side proxy.
16. **No rate limiting / abuse controls** on AI generation (client, Vercel, or Functions) beyond `count ≤ 50`.
17. **Diagnostic & migration pages ship in production** (`/firebase-test`, `/firebase-diagnostic`, `/exam-diagnostic`, `/migrate-exams`, `/admin-setup`, `/dashboard/permission-test`) — information disclosure and confusion risk.
18. **Secrets in docs**: several root `.md` files reference key setup flows; `.env.example` is fine, but confirm no real keys were committed in docs/git history. `API_KEY.md`, `API_KEY_SETUP.md` should be checked.

### 🟢 Low / hygiene

19. Extensive `console.log` of config/state (incl. "Firebase Config: Loaded…" on every boot).
20. No security headers/CSP in `vercel.json`; no `rel="noopener"` audit; no dependency vulnerability scanning in CI (there is **no CI at all** — no `.github/workflows`).
21. Firestore rules have **no unit tests**; rules are the only server-side authorization layer for most collections.
22. Client-side permission checks (`enforcePermission`) are UX-only; without rules fixes they are bypassable.

---

## 7. What NEEDS TO BE ADDED (missing pieces)

**Security / backend**
1. **Server-side exam submission & grading**: a callable Cloud Function `submitExam(attemptId)` that recomputes the score from `questions` + `answers`, writes `examAttempts`, and marks submitted — then lock `examAttempts` rules to `create/update: if false` from clients.
2. **Lock down Firestore rules**:
   - `examAttempts`: `create` only with `request.resource.data` shape validation; `update` only via server (or admin); `read` own-attempts + admin only. `answers`: same.
   - `communityChannels`/`communityMessages`: require auth; validate message shape; delete only owner/admin; remove the wildcard `{allChildren=**}` allow.
   - `settings`: `read: if isAdmin()` (or split public vs private settings docs); **never** store API keys there.
   - `subjects`/`chapters`: write only admin/examiners with `manageSubjects` permission.
   - Add `firestore.rules` unit tests (`@firebase/rules-unit-testing`) run in CI.
3. **Move all AI provider keys server-side** (Vercel env vars or Firebase Secret Manager + Functions config); delete `BUILTIN_DEFAULT_KEYS`; rotate the leaked keys; make `/api/ai/*` require a Firebase ID token (`Authorization: Bearer …`) verified with firebase-admin; restrict CORS to your domain(s).
4. **Firebase App Check** enforced on Firestore/Functions/Storage; reCAPTCHA v3 site key mandatory for web, Play Integrity for Android.
5. **Custom claims for roles** (`admin`, `superadmin`, `examiner`) set via Admin SDK; rules read `request.auth.token.role`; remove the hardcoded `isak@gmail.com` bypass everywhere; remove client-side-only role checks as a security boundary.
6. **Guest mode redesign**: anonymous Firebase Auth with a server-issued guest profile (or keep shared account but treat guests as read-mostly: no answers write beyond their own attempts, rate-limited).
7. **Rate limiting** on AI endpoints (per-uid, e.g. Firestore counters or Upstash/Rate-limiter) and on exam submission.
8. **CI pipeline** (GitHub Actions): lint, typecheck, unit tests, build, `npm audit`, rules tests, secret scanning (gitleaks/trufflehog), deploy previews.
9. **Security headers** in `vercel.json` (CSP, X-Content-Type-Options, X-Frame-Options/ frame-ancestors, Referrer-Policy); remove production diagnostic routes behind admin guard or strip them from the build.
10. **Audit logging**: record admin actions (grade overrides, permission changes, exam deletes) to an `auditLog` collection.
11. **Backups & monitoring**: Firestore scheduled exports, Functions error alerting, budget alerts for AI provider usage.

**Product / engineering**
12. **Email notifications** (results ready, exam reminders) — only in-app notifications exist.
13. **Server-side search/pagination** for leaderboards at scale (current impl loads big result sets client-side).
14. **Admin audit/activity dashboard**, bulk student import (CSV), attendance — common exam-platform needs.
15. **Accessibility pass** (keyboard nav exists in exam runner; needs audit for the rest) and **i18n completeness** check (English strings still hardcoded in many pages).

## 8. What NEEDS TO BE IMPROVED (existing but weak)

1. **Code duplication / dead code**: four `TakeExam*` variants + `TakeExam.backup.tsx`; duplicate download/offline managers (`offline-download-manager.ts` vs `-v2`); duplicate session persistence; duplicate AI engines (client `src/lib/ai-engine` vs `src/server` vs `functions/src/ai-generator` — three parallel implementations of the same orchestrator/adapters). Pick one per layer and delete the rest.
2. **Repo hygiene**: 112 markdown notes at root (e.g. `PHASE_1…6_*.md`, `PERMISSION_SYSTEM_*.md`) — move to `docs/` or delete; a stray file named `-files --others --exclude-standard'` exists; `bun.lockb` + `package-lock.json` both present (pick one package manager); `dev-dist/` and `test-translations.html`, `verify-amharic.*` checked in.
3. **Bundle & performance**: huge pages (`AdminShortnotesStudio.tsx` 3.3k LOC, `AdminAIGenerator.tsx` 2.9k, `CommunityChat.tsx` 2.4k); heavy deps (pdfjs, jspdf, recharts) loaded eagerly in some paths; needs route-level bundle analysis and code-splitting audit.
4. **Error handling & resilience**: errors are largely `console.error` + toast; no global error tracking (Sentry); offline sync conflicts not systematically handled.
5. **Types**: widespread `any` (`(import.meta as any).env`, API req/res `any`, Firestore `data() as …` casts); `strict` TS likely undermined; enable stricter checks gradually.
6. **Tests**: only 31 test files for ~94k LOC; rules untested; exam-critical paths (scoring, submission, permissions) need coverage; tests currently run against implementation details.
7. **AuthContext duplication**: `AuthContext.tsx` and `FirebaseAuthContext.tsx` overlap; confusing.
8. **Firestore query patterns**: leaderboard reads whole `examAttempts` collections; missing composite indexes will surface at scale (indexes file exists — keep in sync).
9. **Docs**: README is the default Lovable scaffold; no architecture diagram, no setup guide that matches reality (env vars, functions deploy, Vercel); deployment docs contradict each other across the 112 md files.
10. **Config**: `package.json` name is `vite_react_shadcn_ts` (Lovable scaffold), version `0.0.0`; `lovable-tagger` still a dependency; hardcoded Firebase project id in fallback config.
11. **Firebase AI Logic** initializes Gemini in the client even if unused — extra surface.
12. **`AdminSetup` page** is fine (informational only) but `/migrate-exams` and diagnostics should be admin-gated or dev-only.

## 9. Suggested target architecture (incremental)

```
Client (React PWA) ──ID token──▶ Vercel /api (verified token, rate-limited)
        │                              ├─ AI generation proxy → Gemini/Groq/OpenRouter/HF
        │                              └─ Drive proxy (auth + host allowlist)
        ├──────────────▶ Callable Cloud Functions (auth + role via custom claims)
        │                 submitExam · calculateLeaderboard · admin* tools
        ├──────────────▶ Firestore (rules: auth + role + shape validation; own-data only)
        └──────────────▶ Storage (rules: per-user paths, image-only, size limits)
```
Keys live ONLY in Functions/Vercel env (Secret Manager). Firestore never stores secrets. All scoring server-side. App Check everywhere.

---

## 10. Quick facts for ChatGPT to remember

- App name: **EthioSmart** (a.k.a. ExamPro; Firebase project `online-exam-f443c`; Android `com.ethiosmart.app`).
- It is a **Lovable-generated** Vite/React app that grew organically — expect duplication and doc sprawl.
- Backend = **Firebase + Vercel serverless + Cloud Functions** (three server layers, some duplicated).
- **The single biggest problem: security** — open Firestore rules + client-side grading + hardcoded keys. Treat every "score" in the DB as user-forgeable until fixed.
- The two AI key sources: client bundle (`BUILTIN_DEFAULT_KEYS`) and Firestore `settings/ai_providers` (world-readable). Both must be removed/rotated.
- Super-admin = hardcoded email `isak@gmail.com` (in client, functions?, and rules).
- Guest mode = shared account `guest.exampro@gmail.com` / `GuestStudent2026!`.
- Working feature set: exams, AI question generation, leaderboards, library/shortnotes, community chat, offline PWA, Amharic/English i18n.

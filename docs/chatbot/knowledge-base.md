# Chatbot knowledge base

The assistant is bound to a curated fact list in `functions/src/chatbot/core.ts`
(`SYSTEM_PROMPT`). It answers only from those facts. If a fact is removed from the
prompt, the model is instructed to say it does not know and point to `/about`.

## What the assistant is allowed to say

**About EthioSmart**
- Ethiopia's smart educational platform for first-year (freshman) university students,
  for department and entrance-style exam preparation.
- Brand: "EthioSmart — Learn • Practice • Grow" (Smart Educational Platform).
- Homepage badges: "Works 100% Offline", "Curriculum Aligned". About page badges:
  "Free Setup", "Secure", "Fast".

**Features (all implemented in the app)**
- Digital library: PDF textbooks readable inside the app, organized by subject and chapter.
- Shortnotes: high-yield, chapter-by-chapter notes.
- Online exams: timed, auto-graded, with manual review of written answers; optional exam passwords.
- Practice exams: untimed practice with instant feedback and analytics.
- Instant results, deep analytics (scores and progress over time), department leaderboards.
- Community: department channels and announcements; in-app Messages to contact administrators.
- Security: role-based access control and anti-cheating measures.

**Registration**
- Email + password, or Google sign-in (there is no payment system in the app).
- Optional "Sign in as Guest" / homepage "Sign in as Guest" — available only when the
  administrators enable guest access; guests land on the exams area.
- "Forgot password?" on the sign-in page sends a reset link by email.

**Offline**
- The app is an installable PWA. Downloaded books and exams are stored on the device and
  work without an internet connection; cached data remains available offline.
- English and Amharic UI; light/dark theme.

**Navigation (allowlist)**
- `/auth` — sign up / sign in · `/about` — about the platform
- `/dashboard` — overview (after sign-in)
- `/dashboard/books` — library and shortnotes
- `/dashboard/exams` — exams and practice mode
- `/dashboard/results` — results and review

## What the assistant never claims

- That an AI tutor/AI Study Assistant or video-tutorials feature exists or is
  "coming soon". (No such student-facing feature exists in the app.)
- Prices, payments, subscriptions, "free forever" promises — the app has no payment system,
  and the assistant is instructed to say only that.
- Statistics, user counts, endorsements, partnerships, dates.
- Homework answers, exam solutions, subject tutoring — always refused with a pointer to
  the practice-exam tooling.
- Anything unrelated to EthioSmart — refused with: "I'm here to help you discover
  EthioSmart …".

## Updating the knowledge base

Edit `SYSTEM_PROMPT` in `functions/src/chatbot/core.ts`, then run
`cd functions && npx jest chatbot` (38 assertions) to validate the rules. Keep answers
short (2–4 sentences) and aligned with what is actually implemented.

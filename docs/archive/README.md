# Archive (historical documentation)

Everything in this folder is **historical** — implementation plans, phase notes, fix logs,
and deep-dives from earlier development waves. It is preserved for reference and is not
maintained or guaranteed to match the current codebase.

Layout:

- `ai-generation/` — AI question-generation setup and experiments (includes the old
  `GEMINI_QUESTION_GENERATION_SETUP.md`).
- `deployment/` — older deployment walkthroughs (superseded by
  `../deployment/handoff.md`).
- `exam-type-system/` — exam-type refactoring plans and verification notes.
- `functions/` — old Cloud Functions notes (callable chatbot, leaderboard tooling).
- `implementation/` — phase summaries and implementation diaries.
- `leaderboard/` — leaderboard implementation and diagnostics.
- `misc/` — one-off fix logs, translation notes, logs and stray outputs.
- `offline/` — offline feature implementation notes.
- `permission-system/` — RBAC / permission refactor notes.

If a file documents a command, path or API, **verify against the live code** before relying
on it — the codebase is the source of truth. The authoritative documentation is in the
top-level `README.md` and `docs/`.

Links between these files and the rest of the repository have not been audited; some links
may be stale because they were written for earlier directory layouts or prior deployments.

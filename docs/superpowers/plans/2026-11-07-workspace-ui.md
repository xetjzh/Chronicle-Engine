# Unified Workspace Implementation Plan

> **For agentic workers:** Use the bounded tasks below; preserve existing uncommitted changes and do not commit or publish.

**Goal:** Unify the seven creative modules and tools around a readable warm archive UI while fixing confirmed editing/storage defects.

**Architecture:** Retain existing React components and callbacks. Use shared CSS tokens and the Tailwind palette for visual consistency; split optional modules with React.lazy. Fix persistence and editor behaviors at their existing boundaries.

**Tech Stack:** React, TypeScript, Vite, browser IndexedDB, Node test runner.

**Spec:** docs/superpowers/specs/2026-11-07-workspace-design.md

## Global Constraints

- Preserve existing user changes and all seven modules, modals and alternate writing/reading themes.
- Work locally without commits, publication, new UI dependencies, or paid AI requests.
- Validate behavior fixes with focused regression tests; visual changes by browser inspection and production build.

## Review Focus

- Empty/imported projects must not crash or mix another project's chapters.
- Refresh must not resurrect removed chapters or replace edits made while restoring data.
- Mobile navigation must retain every tool, and panels must not overflow horizontally.
- Light writing/reading themes must retain readable foregrounds and controls.
- Lazy-loaded screens must show progress and remain navigable.

### Task 1: Persistence correctness

Files: frontend/services/indexedDbService.ts, frontend/services/storageService.ts, focused tests.

- [x] Reproduce stale/deleted chapters and project-ID hydration defects in regression tests.
- [x] Use a saved project's chapter membership and active project ID as authoritative; propagate write errors and release export URLs.
- [x] Run regression tests, report exact command and result.

### Task 2: Writing workspace

Files: frontend/components/AuthorDeskEditor.tsx and a focused helper/test if needed.

- [x] Add compact chapter navigation, comfortable editor header and empty-state creation.
- [x] Eliminate duplicate persistence, clean pending save timers, persist writing preferences, preserve in-flight edits during AI requests.
- [x] Keep alternate themes and mobile layout readable; validate relevant behavior and build.

### Task 3: Shared design and application shell

Files: frontend/app.css, frontend/index.html, frontend/App.tsx, small shared UI or validation helpers, frontend/components/DocumentLibraryModal.tsx.

- [x] Unify palette, typography, inputs/buttons/panels/dialogs and reduced motion.
- [x] Provide mobile navigation/tools, overview, trustworthy loading/error feedback, robust import and restore.
- [x] Lazy-load optional modules and fix document search selection.
- [x] Run tests/build/type checks and independent final review.
- [ ] Complete visual browser QA when browser host and screenshot capture are available.

## Progress

- Baseline: production build passes; entry JavaScript 1,237.15 kB (325.08 kB gzip), with a large chunk warning. Existing changes in App/index/app.css are retained.
- Execution choice: user delegates design judgment; apply changes directly in the current dirty checkout so the existing work remains available.
- Independent review: fixed malformed optional imports and active-project discovery when localStorage cannot write. IndexedDB v2 atomically stores the manuscript and activity pointer; complete-local fallback revisions remain supported.
- Reliability follow-up: AI failures are surfaced, generated results cannot overwrite edited drafts, batches can stop, and missing tension scores remain unknown.
- Preview: VS Code's existing preview exposed the new writing workspace and accessible controls at a configured 390 × 844 viewport. Browser access host is unavailable; native screenshot capture timed out and click geometry was unavailable. Full visual/interaction QA could not be completed in this environment.
- Final verification: `npm test` 60/60, `npm run typecheck`, `npm run build`, `git diff --check`, and existing JavaScript syntax checks pass. Entry JavaScript is approximately 312 kB versus the 1,237 kB baseline; no large-chunk warning. Real model calls were not made.

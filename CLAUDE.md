# CLAUDE.md — bicyclesim

Project-root instructions for any Claude Code agent working in this repo. Read this first,
every session, before doing anything else.

## What this is

A Kairosoft-style cycling **team-manager** game (dynasty across many seasons; set tactics
before a stage, then watch it simulate). Runs as a **Phaser 3 web app**, installable to an
iPhone home screen as a PWA. Personal project — **fun beats realism, simplicity beats
completeness.**

## Source of truth

Two documents in `/docs` govern the build. Do not invent scope outside them:

- **`docs/cycling-sim-BUILD-PLAN.md`** — the ordered, phased worklist. This is your task list.
- **`docs/cycling-sim-SPEC.md`** — the detailed reference (data model, simulation maths, stat
  and stage-weight tables, tuning constants). When in doubt, this document decides.

If the plan and the spec ever disagree, **the spec wins**. If either is ambiguous, ask rather
than guess.

## How to work — non-negotiable

1. **One phase at a time, in order.** Phase 0 → 1 → 2 → … Do not start a phase before the
   previous one meets its acceptance criteria. Do **not** build features listed under a later
   phase's tasks or under the current phase's "out of scope."
2. **Open a PR per phase** with a short summary of what was built and how it meets the
   acceptance criteria. Then stop and wait for review — don't roll straight into the next phase.
3. **Headless sim before any UI.** Phase 1 (`/src/sim`) must have **no Phaser dependency** and
   must be runnable/tunable from a test harness. Do not build race UI (Phase 2) until the
   headless sim produces sensible, slightly-varying results from the CLI.
4. **Respect the Phase 2 fun gate.** End of Phase 2 is a hard checkpoint: if watching a stage
   resolve isn't satisfying, stop and flag it rather than proceeding.
5. **Don't gold-plate.** The default answer to "should I add X?" is no unless the current phase
   asks for it. Simplicity is a primary design constraint, not a nice-to-have. If you think
   something genuinely needs more structure, say why and ask before adding it.
6. **Flag uncertainty.** Every number in `src/data/tuning.ts` is a starting guess (see SPEC §10).
   Don't present tuning values as settled; call out anything you're unsure about.

## Tech stack (see SPEC §2)

- **Phaser 3** (latest stable) · **TypeScript** · **Vite** · **vite-plugin-pwa**
- Persistence: **localStorage** for now (IndexedDB later only if saves outgrow it)
- **No backend, no accounts, no network calls.** Everything is client-side.

## Conventions

- **All magic numbers live in `src/data/tuning.ts`** (weights, sigmas, probabilities, rates),
  named `UPPER_SNAKE`. Balancing should be a one-file edit.
- **Riders/teams/races/stages are data** under `src/data`, not hardcoded in logic.
- **Proxy names only** — recognisable-but-renamed riders, teams, and races. Never real
  trademarked names (see SPEC §9).
- **Render abstraction:** all rider drawing goes through the `RiderRenderer` interface
  (`src/render`) so the code-drawn vs sprite experiment (Phase 7) stays a config flag, not a
  rewrite. Use the crude `CodeDrawnRenderer` for placeholders until then.
- Keep the sim **deterministic under a seed** (`src/sim/rng.ts`) so results are reproducible
  when tuning.

## Commands

Until the scaffold (Phase 0) exists these won't run yet; add/verify them there:

```bash
npm install
npm run dev     # Vite dev server
npm run build   # production build
npm test        # sim harness / unit tests (headless sim first)
```

## Definition of done (per phase)

A phase is done when its **acceptance criteria** in the build plan are met, the app builds
clean, and the PR summary states which criteria are satisfied. If you couldn't meet one, say so
explicitly rather than quietly skipping it.

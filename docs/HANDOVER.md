# Handover notes (bicyclesim)

> Snapshot for an agent picking this up. Read `CLAUDE.md` first (non-negotiable
> rules), then this. Source of truth for scope is `docs/cycling-sim-SPEC.md` +
> `docs/cycling-sim-BUILD-PLAN.md` — **the spec wins**; keep it updated when you
> change scope (we have been).

## TL;DR — current state

- **Phase 0 (scaffold)** and **Phase 1 (headless sim)** are **merged to `main`** (PRs #1, #2).
- **Phase 2 (race presentation)** lives on branch **`claude/phase-2-race-presentation`**, open as
  **PR #3 — deliberately UNMERGED**. It is the **MVP fun gate**: per CLAUDE.md we do not proceed
  to Phase 3 until a human confirms that setting tactics + watching a stage is fun.
- Phase 2 has been iterated **~5 rounds** on playtest feedback (see "Design decisions locked in").
- The app is deployed and playable on a phone: **https://jonvoge.github.io/bicyclesim/**
  (auto-redeploys on every push to the branch).

## Outstanding decisions (need the user)

1. **Phase 2 fun-gate verdict.** The user is testing on their phone. If they say it's fun →
   **merge PR #3** and start **Phase 3**. If not → keep iterating Phases 1–2. Do NOT merge or
   start Phase 3 without their explicit go-ahead.
2. **Per-rider roles (proposed, not yet built).** The user floated replacing "one protected rider
   + one team strategy" with **a role per rider**. Agent recommended it and the user said they'd
   decide after testing. Proposed model (documented, awaiting "build the roles"):
   | Role | Effect |
   |---|---|
   | Leader | backed for the win — contests the finish / attacks late |
   | Sprinter | backed for a bunch kick (bonus on flat finishes) |
   | Breakaway | goes in the morning break (the gamble) |
   | Domestique | works for the leader; spends energy (matters once fatigue lands, Phase 3) |
   | Free | rides their own race |
   This would be a Phase 2.x iteration and sets up the Phase 5 management layer. **Wait for the
   user before building it.**

## Next planned work (once the gate passes)

- **Phase 3 — stage races, GC & fatigue** (SPEC §5.8, §6). Notes:
  - `CONSERVE` ("Conserve for GC") strategy is already defined for stage-race types in
    `src/sim/tactics.ts` (currently only offered for shortTour/grandTour, which don't exist yet).
  - Crashes/incidents are **already implemented** (pulled forward into Phase 2). Phase 3 just needs
    to fold their time loss into GC and add cross-stage fatigue.
  - Time trials (`itt`) and TTT are **removed** for now (see below) — no TTT special-case needed.

## How to run / verify

```bash
npm install
npm run dev            # local dev (add: -- --host  → open the Network URL on a phone on same wifi)
npm run build          # tsc && vite build  (must pass; CI runs it)
npm test               # vitest, 18 tests   (CI runs it)
npm run sim            # headless sim harness (tsx): prints orders, win-freq, tactics effect
```

- **Deploy** is automatic: `.github/workflows/deploy.yml` builds+tests then publishes to GitHub
  Pages on push to `main` or the feature branch (and manual dispatch). Base path is set via
  `BASE_PATH=/bicyclesim/` (see `vite.config.ts`). The repo is **public**; Pages source is
  "GitHub Actions"; the `github-pages` environment deployment-branch restriction was set to **No
  restriction** so the feature branch can deploy (the user did these one-time settings).
- **iOS PWA cache:** after a deploy, an installed home-screen app may need a full close/reopen to
  pick up the new service worker.

### Screenshot / GIF verification tooling (how the agent "sees" the app)

There is no persistent browser dep. When you need to view/record the running app:
- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- Install drivers **together** (they prune each other on any later `npm install`):
  `npm install --no-save playwright-core gifenc pngjs` (these are NOT in package.json on purpose).
- Drive with playwright-core (viewport 390×844), click at game coordinates (canvas is FIT-scaled;
  at 390×844 viewport, page coords ≈ game coords). Import is CommonJS: `import pw from '...'; const {chromium}=pw;`
  and reference the module by absolute path from a project-dir script, e.g.
  `sed 's#playwright-core#/home/user/bicyclesim/node_modules/playwright-core/index.js#'`.
- ffmpeg is Playwright's **stripped** build: `/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`. It only
  decodes webm and writes PNG — **no mp4/gif muxer and no `-vf` filters**. To make a GIF: record a
  webm via playwright `recordVideo`, extract frames with **no filter** (`ffmpeg -i in.webm f%04d.png`),
  then encode a GIF in Node with `gifenc` + `pngjs` (see prior commits' scratch scripts for the pattern).
- Preview server: `npm run preview -- --port 4173` must be started with `run_in_background: true`
  (a plain `&` gets reaped when the tool call ends).

## Architecture

- **`src/sim`** — pure, headless, **no Phaser** (keep it that way):
  - `rng.ts` (seedable mulberry32 + Box–Muller), `form.ts`, `tactics.ts` (STRATEGIES registry,
    race-type-aware), `stageSim.ts` (`scoreRiders` → `perfToResult`; split so events slot between),
    `raceNarrative.ts` (**the heart** — breaks, late attacks, incidents, finish groups, gap
    trajectories, radio events), `raceSetup.ts` (rival default tactics — placeholder until Phase 4).
- **`src/data`** — `types.ts`, **`tuning.ts` (EVERY magic number lives here, `UPPER_SNAKE`)**,
  `riders/teams/stages/races.ts`, `stageWeights.ts`, `teamColors.ts`.
- **`src/scenes`** — Boot → MainMenu (race picker) → PreRace (tactics) → Race (the animated view) →
  StageResults.
- **`src/render`** — `riderRenderer.ts` (interface) + `codeDrawnRenderer.ts`. Phase 7 adds a
  SpriteRenderer behind the same interface.
- **`src/ui`** — `button.ts`, `theme.ts`, `stageProfile.ts` (silhouette + live group markers).

## Design decisions locked in during Phase 2 (don't re-litigate without the user)

The race view is deliberately **broadcast/TV-coverage style, group-centric**:
- **Two move types.** The **morning break = opportunists ONLY** (never the top `FAVOURITE_COUNT`
  by perf); **favourites attack LATE** in the finale. Break survival is **emergent** (terrain
  break-friendliness + a tactic bonus if the player committed a domestique). Late-attack launch +
  success scale with terrain **selectiveness** (attacks win on climbs, chased on the flat).
- **Non-formulaic:** break-peak / catch / finale times are **jittered per race**; the late-race
  radio headline reflects what actually happened (break holds / group shatters / bunch sprint).
- **Finish groups:** riders arriving together **share a time** (`s.t.`); terrain sets the grouping
  threshold (flat → big bunches, mountains → ones and twos).
- **Flow is LEFT→RIGHT:** field starts at the left, the front advances toward the finish on the
  right; the whole bunch keeps moving forward (spread capped by race progress).
- **Peloton renders as a single "pack" BLOB** (group ≥ 6) — an ellipse with the rider count and a
  teal `◆N` of how many are the player's. Only breakaways / small groups / solo attackers / dropped
  riders show as **distinct cyclists**. This killed the "riders shuffle/flicker" problem at the
  source and reads better on a phone (chosen over trying to smoothly animate 21 individuals).
- **Race radio** ticker with named events (break composition, crashes/punctures, catch, attacks).
- **Groups overview strip** reads the same way as the road: **backmost group LEFT, break RIGHT**.
- **Incidents:** punctures (~60%) **never** DNF; only crashes can DNF and only rarely. Abandons rare.
- **Time trials (`itt`) and TTT are REMOVED** for now — a solo effort is a different shape and will
  get its own model. `StageType` has no `itt`/`ttt`. Four races exist: Milan–Sanreno (flat),
  Flèche Ardennaise (hilly), Paris–Roubey (cobbled), Il Lombardo (summit).
- **Strategy palette is race-type-aware:** one-day = **Protect Leader / Attack / Sit in for the
  Sprint**; stage races add **Conserve for GC** (Phase 3). ("Attack": a domestique → morning break;
  a leader → late attack.)
- **Pacing:** ~16 s base at 1× (also 2×/4× + Skip); finale runs slower for tension.

## Conventions & gotchas

- **All magic numbers → `src/data/tuning.ts`.** Every value there is a **starting guess** (SPEC
  §10); the real balance pass is Phase 8. Don't present them as settled.
- **Proxy names only** (recognisable-but-renamed); never real trademarked names.
- **Deterministic under a seed** — keep it reproducible.
- Git: develop on `claude/phase-2-race-presentation`; PR-per-phase; don't merge without the user.
  Commit trailers used: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + a
  `Claude-Session:` line. Do NOT put the model identifier in commits/PRs otherwise.
- `vite.config.ts` reads `process.env.BASE_PATH` via a minimal ambient `declare` (no `@types/node`).

## Known minor issues (not blocking)

- Very early in a race, break riders can visually overlap the peloton blob's right edge (the gap
  hasn't opened yet). Cosmetic.
- A bunch-sprint winner's finish "pop" tween targets a glyph that's hidden inside the blob → no
  visible pop. Harmless.

# Handover notes (bicyclesim)

> Snapshot for an agent picking this up. Read `CLAUDE.md` first (non-negotiable
> rules), then this. Source of truth for scope is `docs/cycling-sim-SPEC.md` +
> `docs/cycling-sim-BUILD-PLAN.md` — **the spec wins**; keep it updated when you
> change scope (we have been).

## TL;DR — current state

- **Phase 0 (scaffold)** and **Phase 1 (headless sim)** are **merged to `main`** (PRs #1, #2).
- **Phase 2 (race presentation)** lives on branch `claude/phase-2-race-presentation` (PR #3),
  extended by branch **`claude/rider-roles-simulation-viz-j0i7e2`** (based on it), which adds:
  - **Per-rider ROLES** (SPEC §5.5): the role sheet (Leader / Sprinter / Breakaway / Domestique
    / Free) replaces "one protected rider + one team strategy". User asked for this build.
  - **Race-view rework**: the pack-blob model is GONE (it swapped identity between frames,
    riders popped in/out of it, and the road froze at t=1). Now every rider is one
    always-visible glyph; groups render as eased paceline formations (see below).
- Phase 2 remains the **MVP fun gate**: per CLAUDE.md we do not proceed to Phase 3 until a
  human confirms that setting tactics + watching a stage is fun.
- The app is deployed and playable on a phone: **https://jonvoge.github.io/bicyclesim/**
  (auto-redeploys on push to `main` or either feature branch — last push wins).

## Outstanding decisions (need the user)

1. **Phase 2 fun-gate verdict.** The user is testing on their phone. If they say it's fun →
   merge the branches (roles branch supersedes PR #3's view) and start **Phase 3**. If not →
   keep iterating Phases 1–2. Do NOT merge or start Phase 3 without their explicit go-ahead.

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
  - `rng.ts` (seedable mulberry32 + Box–Muller), `form.ts`, `tactics.ts` (ROLES registry —
    one `TacticRole` per rider, `TeamTactics = { teamId, roles }`, effects in `tacticsEffect`),
    `stageSim.ts` (`scoreRiders` → `perfToResult`; split so events slot between),
    `raceNarrative.ts` (**the heart** — breaks, late attacks, incidents, finish groups, gap
    trajectories, radio events), `raceSetup.ts` (`defaultTeamTactics` — the pre-filled sheet for
    the player AND the rival placeholder until Phase 4).
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
- **Every rider is ONE always-visible glyph** (the pack blob is gone — it caused identity swaps,
  pop-in/out at the 6-rider threshold, and a hidden winner). Groups render as compact **paceline
  formations** (2–3 files deep) with **stable slots** (per-rider seed order) and exponential
  easing, so nothing jumps or shuffles. Consecutive groups are **clamped to never overlap** on
  the road; big groups get a **rider-count label** above and chasing groups a **live "+m:ss" gap
  label** below (labels skip rather than overprint). After the head of the race finishes, every
  remaining rider **rides in and crosses the line exactly when their result row reveals**, then
  fades — and the winner gets a gold pop on the line.
- **Peloton timing curves are nearly un-jittered** (`raceNarrative.ts` pT jitter ±0.005): larger
  per-rider jitter spread the pack's mid-race gap curves so far apart that the peloton
  visually shattered into phantom groups. Don't crank it back up.
- **Player roles are visible**: role-coloured triangle over player riders on the road
  (leader/sprinter/breakaway), and a coloured role letter (L/S/B/D/F) in the finish order and
  results screens.
- **Race radio** ticker with named events (break composition, crashes/punctures, catch, attacks).
- **Groups overview strip** reads the same way as the road: **backmost group LEFT, break RIGHT**.
- **Incidents:** punctures (~60%) **never** DNF; only crashes can DNF and only rarely. Abandons rare.
- **Time trials (`itt`) and TTT are REMOVED** for now — a solo effort is a different shape and will
  get its own model. `StageType` has no `itt`/`ttt`. Four races exist: Milan–Sanreno (flat),
  Flèche Ardennaise (hilly), Paris–Roubey (cobbled), Il Lombardo (summit).
- **Tactics = the ROLE SHEET** (SPEC §5.5): one role per rider — Leader (+base, +per-domestique
  support, capped), Sprinter (terrain-dependent kick), Breakaway (non-favourite → guaranteed in
  the morning break + survival bonus per committed rider, capped; favourite → committed late
  attack), Domestique (small self-penalty, big Phase-3 fatigue mult), Free (neutral). The
  PreRace screen pre-fills `defaultTeamTactics` so START-mashing still works. The old
  CONSERVE strategy returns in Phase 3 as a team-level effort lever.
- **Pacing:** ~16 s base at 1× (also 2×/4× + Skip); finale runs slower for tension.

## Conventions & gotchas

- **All magic numbers → `src/data/tuning.ts`.** Every value there is a **starting guess** (SPEC
  §10); the real balance pass is Phase 8. Don't present them as settled.
- **Proxy names only** (recognisable-but-renamed); never real trademarked names.
- **Deterministic under a seed** — keep it reproducible.
- Git: current work is on `claude/rider-roles-simulation-viz-j0i7e2` (based on
  `claude/phase-2-race-presentation`); PR-per-phase; don't merge without the user. Commit
  trailers: a `Co-Authored-By: Claude … <noreply@anthropic.com>` + a `Claude-Session:` line.
  Do NOT put the model identifier in commits/PRs otherwise.
- `vite.config.ts` reads `process.env.BASE_PATH` via a minimal ambient `declare` (no `@types/node`).

## Known minor issues (not blocking)

- Very early in a race (first ~2 s) the break and peloton formations sit adjacent and read as
  one clump until the gap opens — the no-overlap clamp keeps them from stacking, so this is
  just "the bunch hasn't split yet". Cosmetic.
- On a flat day, stage "favourites" are the top-6 by that day's perf (sprinters), so a strong
  climber can legitimately turn up in the morning break — reads odd occasionally, revisit if it
  grates.
- `Conserve` no longer exists as a strategy; the Phase 3 note in the build plan covers its
  return as an effort lever.

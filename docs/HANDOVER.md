# Handover notes (bicyclesim)

> Snapshot for an agent picking this up. Read `CLAUDE.md` first (non-negotiable
> rules), then this. Source of truth for scope is `docs/cycling-sim-SPEC.md` +
> `docs/cycling-sim-BUILD-PLAN.md` — **the spec wins**; keep it updated when you
> change scope (we have been).

## TL;DR — current state

- **Phase 0 → 2 are merged to `main`.** Phase 0 (scaffold, PR #1), Phase 1 (headless sim, PR #2),
  Phase 2 (race presentation, PR #3) + the **rider-roles / race-view rework** (PR #4). The Phase 2
  fun gate **passed** — the user played it on their phone and said merge.
- **Phase 3 (stage races, GC & fatigue) is BUILT** on branch
  **`claude/rider-roles-simulation-viz-j0i7e2`** (restarted from `main` after the merges), open as
  its Phase 3 PR — awaiting review. What it adds:
  - **`src/sim/standings.ts`** (pure/headless): `TourState` (fatigue map + abandon set + banked
    results), `computeGc`, across-stage fatigue with overnight recovery, the conserve lever. The
    global roster is never mutated — each stage rides fatigued rider **copies**.
  - **Two tours** in data: Tour de Provence (5 stages), Giro d'Aurelia (9).
  - **Tour UI**: the scene loop is unified (a one-day race is a one-stage tour). PreRace shows the
    stage number, carried fatigue per rider ("legs" bars), a GC context line, and a Race/Conserve
    **team-effort** toggle (tours only). StageResults banks the stage (fatigue + GC + abandons)
    then shows stage result + live GC, routing to the next stage or a final GC screen.
- The app is deployed and playable on a phone: **https://jonvoge.github.io/bicyclesim/**
  (auto-redeploys on push to `main` or the feature branch — last push wins).

## Outstanding decisions (need the user)

1. **Phase 3 review.** The Phase 3 PR is open. Per CLAUDE.md, don't roll into Phase 4 (season
   calendar) until it's reviewed/merged. **All fatigue + conserve numbers in `tuning.ts` are
   starting guesses** (SPEC §10) — the real balance pass is Phase 8; flag if the tour feels off
   rather than treating them as settled.

## Next planned work (once Phase 3 is merged)

- **Phase 4 — season calendar & world layer** (SPEC §6): a ~15-race season, rival team AI (rivals
  currently ride a fixed default sheet and always `race` — no conserve), prestige/points.
- Deferred and waiting: time trials + TTT (their own model), points/climbing classifications
  (only if fun).

## How to run / verify

```bash
npm install
npm run dev            # local dev (add: -- --host  → open the Network URL on a phone on same wifi)
npm run build          # tsc && vite build  (must pass; CI runs it)
npm test               # vitest, 30 tests   (CI runs it)
npm run sim            # headless harness (tsx): stage orders, win-freq, role effect, tour GC + conserve lever
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
    one `TacticRole` per rider, `TeamTactics = { teamId, roles, effort? }`, effects in
    `tacticsEffect`), `stageSim.ts` (`scoreRiders` → `perfToResult`; split so events slot between),
    `raceNarrative.ts` (**the heart** — breaks, late attacks, incidents, finish groups, gap
    trajectories, radio events), `raceSetup.ts` (`defaultTeamTactics` — the pre-filled sheet for
    the player AND the rival placeholder until Phase 4), **`standings.ts`** (Phase 3 — `TourState`,
    `computeGc`, fatigue accrual/recovery, `ridersForStage` = fatigued copies; never mutates the
    global roster).
- **`src/data`** — `types.ts`, **`tuning.ts` (EVERY magic number lives here, `UPPER_SNAKE`)**,
  `riders/teams/stages/races.ts` (stages/races now include the two tours), `stageWeights.ts`,
  `teamColors.ts`.
- **`src/scenes`** — Boot → MainMenu (race picker) → PreRace (role sheet + tour effort/fatigue) →
  Race (the animated view) → StageResults (stage + GC; banks the stage into the tour) → loops back
  to PreRace for the next stage, or a final GC screen. **A one-day race is a one-stage tour** — the
  flow is uniform; `TourState` is threaded through scene data (MainMenu `createTour` → … → back).
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
- Git: current work is on `claude/rider-roles-simulation-viz-j0i7e2` (Phase 3, restarted from
  `main` after the Phase 2 merges); PR-per-phase; don't merge without the user. Commit
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
- The **conserve lever is a real but small edge** (fresher legs ≈ a couple of seconds on the queen
  stage). It reads as marginal-gains, not a no-brainer — which is intended, but if playtesting
  wants it to bite harder, `CONSERVE_FATIGUE_MULT` / `FATIGUE_BASE` / `STAGE_RECOVERY_RATE` are the
  knobs (all Phase-8 balance territory).
- Rival teams don't use the conserve lever (they always `race`) and re-pick a default sheet each
  stage — that's Phase 4 rival AI, not built yet.

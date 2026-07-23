# Handover notes (bicyclesim)

> Snapshot for an agent picking this up. Read `CLAUDE.md` first (non-negotiable rules), then this.
> Source of truth for scope is `docs/cycling-sim-SPEC.md` + `docs/cycling-sim-BUILD-PLAN.md` —
> **the spec wins**; keep both updated when you change scope (we have been).

## TL;DR — current state

- **Everything through Phase 4 is merged to `main`** (PRs #1–#10). The app is a complete,
  playable **single-season** cycling manager: pick tactics per race, watch stages resolve, and
  play the calendar with GC, fatigue, season standings, and a browsable world.
- **The Phase 2 fun gate passed** (user playtested on a phone and said proceed). We have since
  iterated well past the MVP on user feedback (see "What's built").
- **Next phase is Phase 5 — the management layer** (transfers, contracts, budget; the between-races
  Kairosoft loop and the multi-season dynasty the game is really about). Nothing for it is started.
- Deployed & playable on a phone: **https://jonvoge.github.io/bicyclesim/** (auto-redeploys on push
  to `main` or the active feature branch — last push wins).
- **The app has NOT had a fresh full playtest since the season + 45-rider peloton + rest levers +
  rival AI all landed.** Worth a play before opening the management layer — flag anything that
  isn't fun rather than pressing on.

## What's built (feature by feature)

- **Phase 0** — Phaser 3 + TS + Vite PWA scaffold, scene skeleton, CI + GitHub Pages deploy.
- **Phase 1** — headless sim (`src/sim`, no Phaser): seeded RNG, daily form swing, stage scoring
  (`baseScore` weighted by terrain + form − fatigue + tactics), result → times.
- **Phase 2** — the race you *watch*: pick tactics → animated stage → results. A **race-narrative
  layer** (`raceNarrative.ts`) drives it: a morning break, chase, late attacks, incidents
  (crash/puncture), finish groups. Broadcast/TV-style, group-centric view (see "Design decisions").
- **Rider roles** (replaced "one protected rider + one strategy"): a **role sheet**, one role per
  rider — Leader / Sprinter / Breakaway / Domestique / Free (`tactics.ts` `ROLES`).
- **Race-view rework** — every rider is one always-visible glyph in eased paceline formations
  (the old "pack blob" is gone). Bunch sprints, role-respecting breaks, multi-feature stage profiles.
- **Terrain-specialist balance** — sharpened `STAGE_WEIGHTS` + roster so sprinters own the flats,
  climbers the summits, puncheurs the hills; no rider is elite everywhere.
- **`flat` stat** (renamed from `timeTrial`) — flat-road power/engine; a real secondary stat on
  flatter terrain + a break-survival factor (a rouleur can win from the move). Becomes the TT stat
  when TT stages return.
- **Phase 3 — stage races**: `standings.ts` (`TourState`, `computeGc`), across-stage fatigue with
  overnight recovery, the **conserve** team-effort lever. Two tours (Provence 5 / Aurelia 9). Tour
  UI: per-stage role sheet, carried-fatigue bars, GC between stages, final GC.
- **Phase 4 — season & world layer**: a 14-event `SEASON_CALENDAR`, `season.ts` (points + fatigue
  carried across races with recovery), localStorage save/resume (`seasonStore.ts`). UI: SeasonHub
  (calendar/standings/ride-next), Standings, Riders (peloton profiles), Archive.
- **Deeper peloton** — **8 teams / 45 riders**; long lists scroll (`ui/scrollView.ts`).
- **Rest-a-rider lever** — bench player riders from a season race (they recover); **rival AI**
  (`rivalAI.ts`) does the same automatically (rests tired, ill-suited riders). Season energy is now
  a real, symmetric decision.

## Next planned work

- **Phase 5 — management layer** (SPEC §7+, build plan): the between-races loop — contracts,
  transfers/signings, budget; and the multi-season dynasty (age/retire → this bleeds into Phase 6
  development). Keep it lean (no facilities/equipment). Follow **headless-first**: model the season
  rollover + roster economy in `src/sim`/`src/state` before UI.
- **Small deferred loose ends** (do if they help, none blocking):
  - Rival **effort** AI (rivals conserving on a tour's non-GC stages — currently they only rest).
  - Emergent-rivalries view (world layer).
  - Time trials + TTT — deferred by design; `flat` is already their stat when they return.
  - Sprite renderer (Phase 7) behind the existing `RiderRenderer` interface.

## How to run / verify

```bash
npm install
npm run dev     # local dev (add: -- --host  → open the Network URL on a phone on the same wifi)
npm run build   # tsc && vite build  (must pass; CI runs it)
npm test        # vitest, 47 tests   (CI runs it)
npm run sim     # headless harness (tsx): stage orders, win-freq, role effect, tour GC + conserve,
                #   and a full-season section (winners, rider + team standings)
```

- **Deploy** is automatic: `.github/workflows/deploy.yml` builds+tests then publishes to GitHub
  Pages on push to `main` or the active feature branch (branch list is in the workflow; add yours).
  Base path via `BASE_PATH=/bicyclesim/` (`vite.config.ts`). Repo is **public**; Pages source is
  "GitHub Actions"; the `github-pages` environment deploy-branch restriction is **No restriction**
  (one-time settings the user did) so a feature branch can deploy.
- **iOS PWA cache:** after a deploy, an installed home-screen app may need a full close/reopen to
  pick up the new service worker. Season progress lives in **localStorage** (`bicyclesim.season.v1`).

### Screenshot / GIF verification tooling (how the agent "sees" the app)

No persistent browser dep. To view/record the running app:
- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Install drivers **together** (they prune each other on any later `npm install`):
  `npm install --no-save playwright-core gifenc pngjs` (deliberately NOT in package.json).
- Drive with playwright-core (viewport **390×844**, so page coords ≈ game coords — the canvas is
  FIT-scaled). CommonJS import: `import pw from '<abs path>/node_modules/playwright-core/index.js'; const {chromium}=pw;`.
- ffmpeg is Playwright's **stripped** build: `/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux` — decodes
  webm → PNG only (no mp4/gif muxer, no `-vf`). GIF: record webm via `recordVideo`, extract frames
  `ffmpeg -i in.webm f%04d.png` (no filter), encode with `gifenc`+`pngjs` (see scratch scripts).
- Preview server: `npm run preview -- --port 4173` must be started with **`run_in_background: true`**
  (a plain `&` gets reaped when the tool call ends). Fresh browser context = empty localStorage.

## Architecture

- **`src/sim`** — pure, headless, **NO Phaser** (keep it that way; it's the testable core):
  - `rng.ts` (seedable mulberry32 + Box–Muller), `form.ts`, `stageWeights` consumer `stageSim.ts`
    (`scoreRiders` → `perfToResult`; split so narrative events slot between).
  - `tactics.ts` — `ROLES` registry; `TeamTactics = { teamId, roles, effort? }`; `tacticsEffect`
    (role × effort → perfMod / sigma / fatigueMult).
  - `raceNarrative.ts` — **the heart**: break, chase, late attacks, incidents, finish groups, gap
    trajectories, radio events → a `RaceStory`.
  - `standings.ts` — `TourState` (fatigue map + abandon set + banked results + `starters`),
    `computeGc`, `ridersForStage` (fatigued **copies**; excludes abandoned + non-starters — never
    mutates the global roster), across-stage fatigue + overnight recovery.
  - `season.ts` — `SeasonState` over `SEASON_CALENDAR`: `startEvent` (seed a `TourState` from
    carried season fatigue + apply rival resting), `finishEvent` (prestige-scaled points, carry +
    recover fatigue, archive), rider/team standings.
  - `rivalAI.ts` — `rivalRestSet(fatigue, stage)`: rivals bench tired, ill-suited riders.
  - `raceSetup.ts` — `defaultTeamTactics` (the pre-filled sheet for the player AND rivals),
    `buildTacticsMap`.
- **`src/data`** — `types.ts`, **`tuning.ts` (EVERY magic number, `UPPER_SNAKE`)**, `riders.ts`
  (8 teams / 45 riders), `teams.ts`, `stages.ts`, `races.ts` (classics + 2 tours + `SEASON_CALENDAR`),
  `stageWeights.ts`, `teamColors.ts`.
- **`src/state`** — `seasonStore.ts` (localStorage save/load; Maps (de)serialised).
- **`src/scenes`** — **MainMenu** (title: Continue / New Season / Quick Race) → **SeasonHub**
  (calendar, season lead, ride-next; world-layer nav) → **PreRace** (role sheet; season events also
  show carried fatigue + a **Rest** option; tours add the effort toggle) → **Race** (animated view) →
  **StageResults** (stage + GC; banks the stage; on event completion `finishEvent` + save → back to
  SeasonHub). World layer: **Standings**, **Riders**, **Archive**. **QuickRace** = one-off picker.
  Threading: a **one-day race is a one-stage tour**; `TourState` flows through scene data, plus an
  optional `season` (present → season loop, absent → quick one-off). Only create the tour once, at
  event start; PreRace between-stages receives the existing tour.
- **`src/render`** — `riderRenderer.ts` interface + `codeDrawnRenderer.ts` (placeholder art). Phase
  7 adds a `SpriteRenderer` behind the same interface (config flag, not a rewrite).
- **`src/ui`** — `button.ts`, `theme.ts`, `stageProfile.ts` (multi-feature silhouette + live group
  markers), `scrollView.ts` (masked drag/wheel scroll for the ~45-rider lists).

## Design decisions locked in (don't re-litigate without the user)

**Race view** — broadcast/TV-coverage, group-centric, left→right flow:
- **Two move types.** Morning break = opportunists only (never the top `FAVOURITE_COUNT`); favourites
  attack **late**. Break survival is emergent (terrain break-friendliness + committed-rider bonus +
  the break's mean `flat` power). Late attacks scale with terrain **selectiveness**.
- **Every rider is one always-visible glyph** in eased paceline formations with stable per-rider
  slots — no pack blob, nothing jumps/pops. Groups clamp to never overlap; count labels above, live
  gap labels below. After the leaders finish, riders ride in and cross **in sync with the results
  reveal**; winner gets a gold pop. Peloton timing jitter is tiny on purpose (`pT ±0.005`) —
  bigger values shatter the bunch into phantom groups. **Don't crank it up.**
- Finish groups share a time (`s.t.`); terrain sets the threshold. Incidents: punctures (~60%)
  never DNF, only crashes rarely do. Race-radio ticker + groups strip (backmost LEFT, break RIGHT).
- Player roles are visible (road triangle + L/S/B/D/F letters in results).

**Tactics = the role sheet + team effort** (SPEC §5.5, §5.8):
- One role per rider; `defaultTeamTactics` pre-fills a sensible sheet so START-mashing works.
- **Conserve** effort (tours) trades a small leader penalty today for less team fatigue → fresher
  legs later. It's a deliberately **small in-tour edge**; energy's real teeth are at **season**
  scale (fatigue carries across races). Don't crank the in-tour fatigue knobs to force it — that
  just makes single tours grindy.

**Balance / stats:**
- Terrain **gap compression** (`GAP_COMPRESSION_BY_TYPE`) is what makes bunch sprints: flat ≈ 0.12
  (whole peloton on one time), summit = 1.0 (shattered). Real time losses (crashes, break margins)
  are added **after** and stay uncompressed. Side effect: flat stages barely move GC.
- Signature stat dominates each terrain; `endurance` is a light shared engine (~0.2, not a universal
  ~0.3 that floated all-rounders to the top everywhere). Star all-rounders are elite at only 1–2
  disciplines. Locked by the "winner pool rotates by terrain" test.
- **All `tuning.ts` values + rider stats are STARTING GUESSES** (SPEC §10). The real balance pass is
  **Phase 8**. Don't present them as settled.

## Conventions & gotchas

- **All magic numbers → `src/data/tuning.ts`** (`UPPER_SNAKE`). Riders/teams/races/stages are data.
- **Proxy names only** (recognisable-but-renamed); never real trademarks.
- **Deterministic under a seed** — keep the sim reproducible (rival AI is a pure function of
  fatigue + terrain; season is deterministic under its rng).
- **Keep `src/sim` Phaser-free.** Headless-first: model + test in `src/sim`/`src/state`, then UI.
- **Git workflow** (see CLAUDE.md): develop on the assigned feature branch, **PR per phase**, don't
  merge without the user. When your branch's PR is already merged, restart the branch from the
  latest `main` (`git checkout -B <branch> origin/main`) rather than stacking on merged history.
  Commit trailers: a `Co-Authored-By: Claude … <noreply@anthropic.com>` line + a `Claude-Session:`
  line. Do NOT put the model identifier anywhere in commits/PRs/code.
- `vite.config.ts` reads `process.env.BASE_PATH` via a minimal ambient `declare` (no `@types/node`).
- The two tours' UI flow is the trickiest bit — PreRace is entered three ways (event start,
  between-stages, quick race); it only creates the tour at event start.

## Known minor issues (not blocking)

- Very early in a race (first ~2 s) the break and peloton formations sit adjacent and read as one
  clump until the gap opens — cosmetic ("the bunch hasn't split yet").
- On a flat day, "favourites" are the top-6 by that day's perf (sprinters), so a strong climber can
  legitimately turn up in the morning break — reads slightly odd occasionally.
- Standings/Archive show a top-N slice (they fit a screen); the **Riders** (peloton) view scrolls to
  show all 45. If you want full standings on screen, wrap them in `ScrollView` too (mind: those
  scenes re-render on toggle — create the ScrollView once or its input listeners stack).

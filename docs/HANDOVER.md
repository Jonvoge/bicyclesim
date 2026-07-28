# Handover notes (bicyclesim)

> Snapshot for an agent picking this up. Read `CLAUDE.md` first (non-negotiable rules), then this.
> Source of truth for scope is `docs/cycling-sim-SPEC.md` + `docs/cycling-sim-BUILD-PLAN.md` —
> **the spec wins**; keep both updated when you change scope (we have been).
> The approved Dynasty expansion is `docs/cycling-sim-DYNASTY-EXPANSION-PLAN.md`; its sections
> 1-3 are committed. Its section 12 is the single loose-ideas backlog.

## Next expansion (Section 1 implemented; playtest gate pending)

The next committed work is specified in `docs/cycling-sim-DYNASTY-EXPANSION-PLAN.md`. It supersedes
the old "nothing left but tuning" status below for **future Dynasty scope**, while this file remains
the handover for the currently implemented core.

The committed expansion has three ordered sections. Section 1 is implemented in the current
worktree and must pass its phone playtest gate before Section 2 begins:

1. **Implemented:** correct known race-balance issues (especially Conserve and the all-Free
  narrative exploit), length-sensitive endurance, calendar-normalized Focus, and consequence
  feedback/settlement summaries.
2. Replace fixed Dynasty starts with founded player teams in seeded generated worlds.
3. Add separate Pro/World divisions, calendars, promotion/relegation, wildcards, and world history.

A deeper management/economy phase is deliberately deferred. Do not add facilities, staff trees,
rider promises, or detailed transfer negotiations until sections 1-3 are built and the documented
decision gate has been reviewed with the user.

## TL;DR — current state

- **The core build (Phases 0–8) is COMPLETE and merged to `main`.** The game is a multi-season
  cycling **dynasty** — set tactics, watch stages, run the budget, sign/train/scout riders, carry a
  team across the years, with multiple save slots.
- **Now in a post-playtest iteration loop** (the user is playing on a phone and sending notes; each
  fix is its own small PR on branch `claude/continue-build-0zwcbc`). Landed so far: race-feel balance
  (mountains select, breaks stick, fatigue bites), race-view visuals (compact peloton, everyone moves,
  believable glyph), **pick-5 squads** (deeper rosters, choose exactly 5/race), and **pick your team**
  (`dynasty.playerTeamId` threaded everywhere; a TeamSelect screen on new-dynasty — you can run any of
  the 8), **collapsed Free+Breakaway into one "Free / Attack" role**, **lowered the economy** a lot
  (a star free agent is out of reach in season 1), and **stats-before-signing** (rider archetype +
  a live 5-stat readout on every Transfers *and* Team HQ row), and **auto-training** (manual coaching
  is gone — ~4 automatic "training camps" a season develop each rider by age · potential · type; the
  Team HQ "Development" screen is a read-only window on it). **The whole playtest list is now landed.**
- **What's left is the human's game to grow:** the big **feel/balance tuning on a phone** (the sim
  says `tuning.ts` is in a sane range, but "does it *feel* fair and dramatic?" needs real play), plus
  optional content and the deferred extras below. There is no Phase 9 — the SPEC is fully built.
- **Two honest caveats carried forward:** (1) the sprite path is an authored **SVG placeholder**, not
  the AI raster the SPEC imagined (this env can't gen images) — infra/flag/comparison are real, final
  art is open; default `RENDER_MODE = 'code'`. (2) Balance is a **sim pass**, not a play-tested one.
- Deployed & playable on a phone: **https://jonvoge.github.io/bicyclesim/** (auto-redeploys on push
  to `main` or the active feature branch — last push wins).
- **Nothing has had a full phone playtest since Phase 2.** Watch, as you play: does the economy bite
  without punishing? Do careers rise/fade at a satisfying rate? Is scouting a fun gamble? Are the
  races still dramatic? All knobs are in `tuning.ts`.

## What's built (feature by feature)

- **Phase 0** — Phaser 3 + TS + Vite PWA scaffold, scene skeleton, CI + GitHub Pages deploy.
- **Phase 1** — headless sim (`src/sim`, no Phaser): seeded RNG, daily form swing, stage scoring
  (`baseScore` weighted by terrain + form − fatigue + tactics), result → times.
- **Phase 2** — the race you *watch*: pick tactics → animated stage → results. A **race-narrative
  layer** (`raceNarrative.ts`) drives it: a morning break, chase, late attacks, incidents
  (crash/puncture), finish groups. Broadcast/TV-style, group-centric view (see "Design decisions").
- **Rider roles** (replaced "one protected rider + one strategy"): a **role sheet**, one role per
  rider — Leader / Sprinter / Domestique / **Free / Attack** (`tactics.ts` `ROLES`). *Free* is the
  merged old Free+Breakaway (post-playtest): one "rides his own race — up the road in the break, or
  attacks late" gamble instead of two overlapping roles.
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
- **Pick-5 squads** (post-playtest) — teams carry a **deeper roster** (padded to `TARGET_SQUAD_SIZE`
  with generated domestiques at dynasty start) and field **exactly `RACE_SQUAD_SIZE` (5)** per race.
  The player picks their 5 in PreRace (enforced); rivals auto-pick their best 5 by suitability minus a
  fatigue penalty (`dynasty.pickRaceSquad`) — so squad rotation + resting tired stars falls out of the
  selection, which **replaced the old standalone rival-rest AI** (`rivalAI.ts` deleted).
- **Phase 5 — management layer**: the between-races Kairosoft loop. One budget number (sponsor +
  prize money in, wages out at the rollover); **free-agent transfers** (sign/release, fee + salary,
  squad cap 6–9); **auto-training** (post-playtest: manual coaching removed — ~4 automatic **training
  camps** a season, fired at spaced calendar milestones by `finishSeasonEvent`, develop every
  contracted rider toward their ceiling via `development.trainingTick`, weighted by age · potential ·
  type and always ceiling-bounded/fatigue-free; the player's gains are stashed on
  `dynasty.lastTraining` and shown on the read-only **Development** screen); and a **season rollover**
  into a multi-season dynasty. See the build plan's Phase 5 "Decisions/Built" note for the shape and
  the flagged design choices. New mutable layer: **`src/state/dynasty.ts`** (`DynastyState`) — read the
  roster through it, not the static data.
- **Phase 6 — rider development & dynasty** (SPEC §7): every rider has a hidden `peakAge`/per-stat
  `ceiling`/`developmentRate`; `rolloverSeason` ages the whole peloton along **individual curves**
  (grow → plateau → decline in the veteran years), retires veterans, and brings in **scouted youth**
  (fresh 19–22-yo free agents whose potential is shown **fuzzily** — a real bet). `src/sim/development.ts`
  is the pure core; `scoutReport` drives the star ratings in Transfers/Team HQ. **Still deferred:**
  rival poaching / contracts genuinely lapsing (they auto-renew).
- **Phase 7 — art experiment** (SPEC §8): the render abstraction is now a working **config flag**.
  `src/render/index.ts` — `RENDER_MODE` (`'code' | 'sprite'`) + `makeRiderRenderer()`; `SpriteRenderer`
  draws from a loaded texture (authored **SVG** placeholder, tinted per team — a real AI raster atlas
  can replace it behind the same keys). `RenderCompareScene` (MainMenu → "Renderers") shows both
  side-by-side. **Default `'code'`** (tiny footprint, one-value recolour, crisp scaling).
- **Phase 8 — persistence, balance & polish**: **multiple save slots** (`dynastyStore.ts` → 3 slots +
  a persisted active slot; MainMenu is a slot picker; legacy save auto-migrates), a measured **balance
  pass** (`scripts/balanceReport.ts`: prize/sponsor cut so the economy no longer balloons, prospect
  ceilings nudged up so the elite tier replenishes), and a **PWA offline** check. Balance is a sim
  pass — final feel needs a phone.

## What's left (no more phases — the SPEC is fully built)

- **Feel/balance tuning on a phone** — the one thing a headless agent can't do. `tuning.ts` is a
  sane-range guess; play a few dynasties and adjust to taste (economy tightness, development/retirement
  pace, race drama). `scripts/balanceReport.ts` is there to re-measure after any change.
- **Finish the art** if wanted: drop an AI-generated raster atlas behind the `SpriteRenderer` texture
  keys (`src/render/spriteAssets.ts`) and re-judge `RENDER_MODE` in the compare scene.
- **Deferred-by-design extras** (add only if they earn their place):
  - Rival **effort** AI (rivals conserving on a tour's non-GC stages — currently they only rest).
  - Rival **poaching** / contracts genuinely lapsing (they auto-renew now — see Phase 6 note).
  - Emergent-rivalries view (world layer).
  - Time trials + TTT — deferred by design; `flat` is already their stat when they return.

## How to run / verify

```bash
npm install
npm run dev     # local dev (add: -- --host  → open the Network URL on a phone on the same wifi)
npm run build   # tsc && vite build  (must pass; CI runs it)
npm test        # vitest, 88 tests   (CI runs it)
npm run sim     # headless harness (tsx): stage orders, win-freq, role effect, tour GC + conserve,
                #   and a full-season section (winners, rider + team standings)
```

- **Deploy** is automatic: `.github/workflows/deploy.yml` builds+tests then publishes to GitHub
  Pages on push to `main` or the active feature branch (branch list is in the workflow; add yours).
  Base path via `BASE_PATH=/bicyclesim/` (`vite.config.ts`). Repo is **public**; Pages source is
  "GitHub Actions"; the `github-pages` environment deploy-branch restriction is **No restriction**
  (one-time settings the user did) so a feature branch can deploy.
- **iOS PWA cache:** after a deploy, an installed home-screen app may need a full close/reopen to
  pick up the new service worker. Dynasty progress lives in **localStorage** (`bicyclesim.dynasty.v1`).

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
    carried season fatigue; harness/tests only — the dynasty uses `dynasty.startSeasonEvent`, pick-5),
    `finishEvent` (prestige-scaled points, carry + recover fatigue, archive), rider/team standings.
  - `raceSetup.ts` — `defaultTeamTactics` / `defaultTeamTacticsFor` (roster-driven; the pre-filled
    sheet for the player AND rivals), `buildTacticsMap`.
  - `rating.ts` (Phase 5) — `riderRating` (0–100 overall) → `salaryFor` → `signingFeeFor`; plus
    `riderType` (dominant-stat archetype label) + `statLine` (compact 5-stat readout) for the UI.
  - `management.ts` (Phase 5, pure formulas) — `sponsorIncome`, `wageBill`, `eventPrizeByTeam`,
    `canSign` / `canRelease`. The stateful transitions that use them live in `src/state/dynasty.ts`.
  - `development.ts` (Phase 6, pure) — hidden `peakAge`/`ceiling`/`developmentRate` (`seedDevelopment`),
    the age curve (`ageOneSeason`: grow → plateau → decline), `trainingTick` (one in-season **auto-training**
    camp: a small ceiling-bounded step toward potential, weighted by age · potential · type — the growth
    engine the dynasty fires ~4×/season), `shouldRetire`, `generateProspect` (new blood), and
    `scoutReport` (fuzzy potential = the scouting gamble). Consumed by `rolloverSeason` + `finishSeasonEvent`.
- **`src/data`** — `types.ts`, **`tuning.ts` (EVERY magic number, `UPPER_SNAKE`)**, `riders.ts`
  (8 teams / 45 riders), `freeAgents.ts` (the unsigned market + `ALL_RIDERS_BY_ID` for immutable-fact
  lookups), `names.ts` (proxy name pools for generated prospects), `teams.ts`, `stages.ts`, `races.ts`
  (classics + 2 tours + `SEASON_CALENDAR`), `stageWeights.ts`, `teamColors.ts`.
- **`src/state`** — **`dynasty.ts` (Phase 5, the mutable game layer)**: `DynastyState` = live roster
  (team membership + trained stats + contracts) + team budgets + season number + **`playerTeamId`**
  (which of the 8 the player runs — pick-your-team), with `SeasonState` nested. Accessors (`rosterById`,
  `teamRiders`, `playerRiders`, `freeAgents`, `racingRoster`, `teamOf`, `startSeasonEvent`/`pickRaceSquad`)
  — **read the roster and the player team through these, never the static `RIDERS`/team lists/`PLAYER_TEAM`**
  (that's only the *default*/quick-race team now). Transitions:
  `signRider` / `releaseRider` / `finishSeasonEvent` (banks event + pays prize + fires the spaced
  **auto-training camps** via `campEventIndices`, stashing player gains on `dynasty.lastTraining`) /
  `rolloverSeason` (Phase 6: also ages the peloton, retires, injects scouted youth); plus `buildTacticsMapDyn`. `dynastyStore.ts` (Phase 8) persists it to
  localStorage across **3 save slots** (`slotInfos` / `saveDynastyToSlot` / `loadDynastyFromSlot` +
  a persisted active slot behind the slot-less `saveDynasty`/`loadDynasty` the scenes call; legacy
  single-save auto-migrates). Supersedes the season-only `seasonStore.ts` (now unused).
- **`src/scenes`** — **MainMenu** (save-slot picker: continue / new / delete per slot; + Quick Race,
  Renderers) → **TeamSelect** (new dynasty → choose which of the 8 teams to run) → **SeasonHub** (calendar,
  finances strip, season lead, **Team HQ** door, ride-next; world-layer nav; drives the rollover when
  the season is done) → **PreRace** (season events: **pick exactly 5** to start + a role each — enforced;
  between tour stages the 5 are locked; carried fatigue shown;
  tours add the effort toggle) → **Race** (animated view) → **StageResults** (stage + GC; banks the
  stage; on event completion `finishSeasonEvent` + save → back to SeasonHub). Management (Phase 5):
  **Team** (finances + squad + Release), **Transfers** (sign free agents), **Development** (read-only —
  the `Training` scene, repurposed: shows each rider's type, potential and their last training-camp gain),
  **Rollover** (end-of-season settlement → next season). World layer: **Standings**, **Riders**,
  **Archive**. **QuickRace** = one-off picker (stays on the **static** roster path).
  Threading: a **one-day race is a one-stage tour**; `TourState` flows through scene data, plus an
  optional **`dynasty`** (present → dynasty/season loop off the live roster, absent → quick one-off off
  the static roster). Only create the tour once, at event start; PreRace between-stages receives the
  existing tour.
- **`src/render`** — `riderRenderer.ts` interface, `codeDrawnRenderer.ts` (Graphics) + `spriteRenderer.ts`
  (texture) + `spriteAssets.ts` (inline SVG → data-URI textures). `index.ts` = `RENDER_MODE` +
  `makeRiderRenderer()` (the one config flag). RaceScene preloads the sprite textures and draws via the
  factory; `RenderCompareScene` shows both side-by-side. Default `'code'`.
- **`src/ui`** — `button.ts`, `theme.ts`, `stageProfile.ts` (multi-feature silhouette + live group
  markers), `scrollView.ts` (masked drag/wheel scroll for the ~45-rider lists).

## Design decisions locked in (don't re-litigate without the user)

**Race view** — broadcast/TV-coverage, group-centric, left→right flow:
- **Two move types.** Morning break = opportunists only (never the top `FAVOURITE_COUNT`); favourites
  attack **late**. Break survival is emergent (terrain break-friendliness + committed-rider bonus +
  the break's mean `flat` power). Late attacks scale with terrain **selectiveness**.
- **Riders are eased glyphs in paceline formations** with stable per-rider slots — nothing
  jumps/pops. A **big bunch is drawn compactly** though (post-playtest): only up to
  `MAX_GLYPHS_PER_GROUP` (~10) glyphs on the road per group with the true size on a **count label**,
  so the peloton is a tidy clump, not a 40-icon slab that overlaps the groups fore and aft (this
  reverses the old "one glyph per rider" rule on the player's request). Groups clamp to never overlap.
  **Movement:** the whole field advances *with the clock* (`xForGap`: progress ≈ tPos − a bounded,
  gently-opening offset from the time gap, `MAX_SPREAD` ~0.18) — so a breakaway is just the front of a
  moving road, not the only thing that moves. After the leaders finish, riders ride in and cross **in
  sync with the results reveal**; winner gets a gold pop.
- Finish groups share a time (`s.t.`); terrain sets the threshold. Incidents: punctures (~60%)
  never DNF, only crashes rarely do. Race-radio ticker + groups strip (backmost LEFT, break RIGHT).
- Player roles are visible (road triangle + L/S/D/F letters in results).

**Tactics = the role sheet + team effort** (SPEC §5.5, §5.8):
- One role per rider; `defaultTeamTactics` pre-fills a sensible sheet so START-mashing works.
- **Conserve** effort (tours) applies `-2.5` performance to every team rider, multiplies every
  rider's fatigue gain by `0.70`, and disables committed-move bonuses. Matched-seed reports now
  put Conserve-all below selective use in all three tours and two rider archetypes. Aurelia's
  selective gain remains the high outlier (up to ~22 percentage points), so the Section 1 phone
  gate should specifically judge long-tour freshness before generated-world tuning begins.

**Balance / stats:**
- Terrain **gap multiplier** (`GAP_COMPRESSION_BY_TYPE`) is the biggest lever on how a stage reads:
  tiny on flat (~0.18, whole peloton on one time) → large on a summit (~4.6, minutes) after the
  **post-playtest pass** (mountains were far too gentle; a pure sprinter now loses ~5 min on a summit
  and can't cling to GC — locked by `balance.test.ts`). Because fatigue is a perfScore penalty, this
  same lever makes **tired legs lose real time in the mountains**, so Conserve now shows on the clock.
  Real time losses (crashes, break margins) are added **after** and are NOT scaled.
- Signature stat dominates each terrain; `endurance` is a light shared engine (~0.2, not a universal
  ~0.3 that floated all-rounders to the top everywhere). Star all-rounders are elite at only 1–2
  disciplines. Locked by the "winner pool rotates by terrain" test.
- **All `tuning.ts` values + rider stats are STARTING GUESSES** (SPEC §10). The real balance pass is
  **Phase 8**. Don't present them as settled.

## Conventions & gotchas

- **All magic numbers → `src/data/tuning.ts`** (`UPPER_SNAKE`). Riders/teams/races/stages are data.
- **Proxy names only** (recognisable-but-renamed); never real trademarks.
- **Deterministic under a seed** — keep the sim reproducible (rival squad picks are a pure function of
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

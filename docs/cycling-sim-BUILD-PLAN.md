# Cycling Team Sim — Build Plan

> Ordered execution plan for a build agent. Work phases **in order**; do not skip ahead.
> Detail lives in `cycling-sim-SPEC.md` (referenced as **SPEC §x**). Each phase lists a **goal**,
> **tasks**, **acceptance criteria** (how you know it's done), and **out of scope** (do NOT build).
>
> Guiding rule: **build the thinnest thing that proves the fun, then stop and check.** Resist
> adding anything not listed for the current phase. Simplicity beats completeness.

## Post-core expansion

Phases 0-8 below document the completed core build. The next ordered roadmap is
`docs/cycling-sim-DYNASTY-EXPANSION-PLAN.md`:

1. Race balance foundation.
2. Generated world and found-a-team Dynasty foundation.
3. Two-division competition structure with promotion/relegation.

Those three sections are committed. Its section 4 (deeper management pressure) is an explicit
decision gate and is not approved scope.

---

## Phase 0 — Scaffold

**Goal:** an empty, running Phaser app installable to the iPhone home screen.

**Tasks**
- Init repo. `npm create vite@latest` → **TypeScript**. Add **Phaser 3**.
- Add **vite-plugin-pwa**; configure manifest (name, icons, `display: standalone`) + service worker.
- `main.ts`: Phaser game config; register an empty `BootScene` → `MainMenuScene` with one button.
- Create the folder structure from **SPEC §3**. Add empty `tuning.ts` with placeholder constants.
- Commit. Confirm "Add to Home Screen" on iOS launches full-screen.

**Acceptance:** app builds, runs in browser, installs to iPhone home screen, shows a menu.
**Out of scope:** any game logic, any art beyond a placeholder icon.

---

## Phase 1 — Headless simulation core (the MVP heart)

**Goal:** prove the *maths* is fun to reason about — **before any race UI**. This is the MVP core
(SPEC §5).

**Tasks**
- Author minimal data (**SPEC §4**): one player team of ~6 riders + 2–3 rival teams, hardcoded
  proxy names/stats; 3–4 `Stage`s of different `type`s; wrap them as 3–4 one-day `Race`s.
- `rng.ts`: seedable RNG + `gaussian(mean, sigma)` via Box–Muller.
- `stageWeights.ts`: the table from **SPEC §5.2**.
- `form.ts`: `sigma(consistency)` + form draw (**SPEC §5.3**).
- `tactics.ts`: tactics effects (**SPEC §5.5**; built as protected-rider + strategy, later
  reworked into per-rider roles in the Phase 2 fun-gate iteration).
- `stageSim.ts`: the single-stage algorithm (**SPEC §5.1**) → returns a `StageResult`.
- **Test harness** (a script / test file, no Phaser): run each stage, print finishing order +
  perfScores. Run it many times to eyeball that: the right stat wins the right stage type,
  favourites usually but not always win, results feel plausible.

**Acceptance:** from the CLI you can simulate a stage and get a sensible, slightly-varying order.
Tactics visibly change outcomes. **No UI required.**
**Out of scope:** fatigue across stages, GC, crashes-tuning polish, animation, art, economy.

---

## Phase 2 — Race presentation ("watch it unfold")

**Goal:** turn a stage result into something you *watch*, because that's where the fun is.

**Tasks**
- `PreRaceScene`: show the stage (name, type, profile blurb), let the player pick **protected
  rider + strategy**, then start.
- `RaceScene`: animate the stage playing out — a simple horizontal progress/peloton view is
  enough; reveal the finish order with tension (don't just dump the table). Use Phaser tweens.
- `StageResultsScene`: final order + gaps (**SPEC §5.7**), "continue" back to menu.
- Use the **`CodeDrawnRenderer`** with crude placeholder shapes for riders (SPEC §8) — art is
  Phase 7, this is just enough to see them.

**Acceptance:** you can pick tactics, watch a stage resolve with some drama, and see results.
**This is the MVP fun-test gate** — if watching a stage isn't satisfying here, iterate on
Phases 1–2 before going further.
**Out of scope:** multi-stage, season, management, real art.

**Fun-gate iteration (post-playtest).** Added to make the race read like a real race rather than
a line-up at the finish: a **race narrative layer** (SPEC §5.9) — breakaway, chase, finale
splinter, and **incidents (crash/puncture) pulled forward from Phase 3** as visible drama — plus
team tactics. The finish now shows the field arriving in groups with real gaps.

**Fun-gate iteration 2 (rider roles + race-view rework).** Tactics became a **role per rider**
(SPEC §5.5: LEADER / SPRINTER / BREAKAWAY / DOMESTIQUE / FREE — the role sheet replaces
"protected rider + one strategy"), and the race view was rebuilt around always-visible rider
glyphs in eased paceline formations (no more pack blob), with on-road group counts, live gaps,
and a finish run-in synced to the results reveal.

---

## Phase 3 — Stage races, GC & fatigue

**Goal:** multi-stage races that create tactical tension across days.

**Tasks**
- Extend races to `shortTour` (4–5 stages) and `grandTour` (8–10) (SPEC §6).
- `standings.ts`: GC by cumulative time; running leaderboard between stages.
- Fatigue accumulation + recovery (**SPEC §5.8**); wire `roleMultiplier` from tactics into it.
- Crashes/illness (**SPEC §5.6**) already surfaced as drama in Phase 2; here, fold their time
  loss into GC and add a team-level "conserve for GC" lever on top of the role sheet (the old
  `CONSERVE` strategy, reborn as an effort setting).
- (Time trials & TTT are deferred for now — see SPEC §4 — so no TTT special-case yet.)

**Acceptance:** a grand tour plays across stages; protecting a leader early visibly costs stamina
later; GC updates each stage; crashes are noticeable but rare.
**Out of scope:** season calendar, recruitment, development.

**Built (this phase).** `standings.ts` (pure, headless): a `TourState` holds a per-rider fatigue
map + abandon set + banked results; `computeGc` is cumulative time, lowest-first, gaps off the
leader (finish every stage to hold a place). Fatigue accrues per SPEC §5.8 —
`gain = stageDifficulty · (1 − stamina/100·STAMINA_FACTOR) · fatigueMult`, with a mild overnight
recovery (`STAGE_RECOVERY_RATE`) so a long tour reaches a plateau instead of ballooning. The
global roster is never mutated: each stage rides fatigued rider **copies**. The **conserve**
lever is a team `effort` flag on `TeamTactics` — it applies a team-wide performance cost,
moderates every rider's fatigue gain, and suppresses committed moves. Matched-seed counterfactuals
cover all three current tours and require selective use to beat Race-all while Conserve-all is
worse. Two tours added: **Tour de Provence** (5 stages) and **Giro d'Aurelia** (9). UI: the
scene loop is unified so a one-day race is a one-stage tour; PreRace shows the stage number,
each rider's carried fatigue, a GC context line and (tours only) the Race/Conserve toggle;
StageResults banks the stage then shows stage result + live GC, routing to the next stage or a
final overall-classification screen. **All fatigue/conserve numbers are starting guesses (SPEC
§10) — real balance is Phase 8.**

---

## Phase 4 — Season calendar & world layer

**Goal:** a full season that feels like a living sport.

**Tasks**
- Season = calendar of **~15 races**, mixed types, no filler (SPEC §6). Sequence them; rival teams
  auto-race (simulate their results too).
- Season standings (team + individual) + prestige/points per race.
- **Read-only world layer:** browsable standings/rankings, race-result archives, rider profiles
  for the *whole* peloton, and emergent rivalries. Cheap once the data exists — just give the
  player windows onto it.
- `SeasonHubScene` to navigate the calendar and these views.

**Acceptance:** you can play a full season, see where you rank, and browse the wider world.
**Out of scope:** signing riders, training, ageing (still fixed rosters).

**Energy as a season-long resource (playtest ask, decided for this phase).** In Phase 3 the
conserve lever is only a marginal in-tour edge — you don't *need* it to win a single tour. That's
by design: energy's real home is the **season**. Here, carry fatigue **across races** with
recovery on the gaps between them (`RECOVERY_RATE` already exists, unused until now), so a team
can't ride every rider flat-out in all ~15 races. The strategic layer becomes: pick which races to
target, when to rest riders, and when to spend the team — burning out a leader mid-season should
cost you the races that matter. Keep the Phase 3 within-tour tuning as-is (marginal gains); make
the scarcity bite at the season scale. Rival AI should use rest/effort too (not always `race`).

**Built (this phase).** A 14-event `SEASON_CALENDAR` (12 one-day classics + the two tours),
ordered like a real year. `src/sim/season.ts` (headless): a `SeasonState` carries a points tally
and **fatigue that persists across events** with `RECOVERY_RATE` recovery on the gaps — reusing the
Phase 3 `TourState` (an event is seeded from each rider's carried season fatigue). Points come from
each event's final classification (one-day order / tour GC) × prestige; rider + team standings sum
them. `src/state/seasonStore.ts` persists the season to **localStorage** so it survives a
refresh/close (SPEC §2). UI: `SeasonHubScene` (calendar, season lead, ride-next, navigation),
`StandingsScene` (rider/team), `RidersScene` (whole-peloton profiles with stats), `ArchiveScene`
(past results); the season threads through PreRace → Race → StageResults, which banks each event.
`MainMenuScene` is now a title (Continue / New Season / Quick Race); the old picker moved to
`QuickRaceScene`.

**Rest-a-rider lever (built as a follow-up).** The player can now **bench** riders from a season
race (a "Rest" option in the pre-race role palette): rested riders don't start or score and recover
on the sidelines, so you can save a sprinter through the mountains for the bunch days ahead. The
peloton was deepened to **8 teams / 45 riders** first, so there's squad depth to rotate. Mechanics:
`TourState.starters` (rested riders excluded from the field), fatigue shown on every season race,
and a benched rider's role no longer counts toward the leader's support.

**Rival resting AI (built).** Rivals now manage their squads like the player: `src/sim/rivalAI.ts`
benches a rider who is both poorly suited to today's race (can't contest it) AND carrying fatigue,
to save them for races they suit — applied centrally in `startEvent` so the UI and headless season
agree. Over a full season this fires sensibly (e.g. sprinters sit out summit finishes once tired;
~45 rests across the 14-event calendar), keeping rival stars fresher for their targets so the
standings are a real contest, not a reward for the player being the only one who rotates a squad.

**Still deferred.** Rival **effort** (conserving on a tour's non-GC stages) and the
**emergent-rivalries** view — minor, likely alongside Phase 5.

---

## Phase 5 — Management layer

**Goal:** the between-races Kairosoft loop — lean, no facilities/equipment (SPEC §2, §5-mgmt).

**Tasks**
- **Economy:** income from sponsors + race winnings; spend on salaries/contracts. One budget number.
- **Recruitment (free agency only, no buy/sell market):** a pool of **unsigned** riders +
  **out-of-contract** riders from other teams. Signing = one-off **signing fee** + recurring
  **salary**. Wage bill is the natural pressure that stops hoarding stars.
- **Training:** nudge specific stats between races with trade-offs (can't max everyone).
- **Squad selection:** choose who to bring to each race; manage fatigue across the season.

**Acceptance:** across a season you sign riders, pay wages, train, and pick squads; the budget
forces real choices.
**Out of scope:** ageing curves / potential (Phase 6).

**Decisions made (flagged, since the SPEC left the economy shape open).**
- **One budget number, settled by season.** A season-start **sponsor** cheque (scaled by last
  season's team rank) plus **prize money** as you race fund a **wage bill** paid at the rollover.
  Signing a free agent is a one-off **fee** + their **salary** on the bill; the wage bill is the
  natural brake on hoarding stars. (`sponsorIncome`, `wageBill`, `eventPrizeByTeam` in
  `src/sim/management.ts`; opening numbers are deliberately tight so the first choices bite.)
- **Season rollover, fixed identities.** The dynasty spans seasons now: at season end the books
  settle, contracts tick down, the peloton rests over the winter, and a fresh calendar starts.
  Contracts that hit zero **auto-renew** for now — nobody is lost involuntarily; **rival poaching,
  free-agent churn, ageing, new blood and retirement are Phase 6**. The player's levers are
  releasing riders (wage relief) and signing from the pool.
- **Training tires riders.** Between races a rider can be coached to nudge one stat (diminishing
  returns, soft-capped) at the cost of **added fatigue**, once per race gap — so growth trades
  against race-freshness, and you can't sharpen the whole squad and keep them all fresh.

**Built (this phase).** Headless-first, as required. **`src/sim/rating.ts`** prices a rider (a
0–100 overall → salary curve → signing fee). **`src/sim/management.ts`** (pure): sponsor income,
wage bill, event prize money, training gain, squad-rule checks. **`src/data/freeAgents.ts`** seeds
a 9-rider unsigned market. **`src/state/dynasty.ts`** is the new mutable layer — a **`DynastyState`**
that owns the live roster (team membership, trained stats, contracts), each team's budget and the
season number, with the `SeasonState` nested inside; it exposes `signRider` / `releaseRider` /
`trainRider` / `finishSeasonEvent` (banks the event + pays prize) / `rolloverSeason`, all built on
the pure formulas. **`src/state/dynastyStore.ts`** persists the whole dynasty to localStorage
(supersedes the season-only save). The sim/scenes read the roster through the dynasty (the static
`RIDERS`/team lists are now just the *starting* line-up); `raceSetup` gained roster-driven
`defaultTeamTacticsFor` so rival sheets follow the live squads. **UI:** SeasonHub shows finances +
a **Team HQ** door and drives the rollover; **TeamScene** (finances, squad, Release), **TransfersScene**
(sign free agents), **TrainingScene** (coach a stat), **RolloverScene** (end-of-season settlement).
Quick Race stays on the static path. **20 new tests**; a headless harness section prints the economy
over a season. **All economy/training numbers in `tuning.ts` are STARTING GUESSES (SPEC §10) — the
real balance pass is Phase 8.**

---

## Phase 6 — Rider development & dynasty

**Goal:** careers that rise, plateau and fade — the soul of the dynasty (SPEC §7).

**Tasks**
- Add `peakAge` (varies per rider), `ceiling`, `developmentRate`.
- Growth toward ceiling; **peak → plateau → late decline** (early bloomers stagnate, don't crash).
- **Hidden potential:** show ceiling/peakAge *fuzzily* in scouting UI → signing youth is a gamble.
- New riders enter each season; veterans retire. Multi-season save persists the dynasty.

**Acceptance:** play several seasons; riders visibly develop and age on individual curves; scouting
young talent is a real bet, not a lookup.
**Out of scope:** none new — this closes the core design.

**Built (this phase).** Headless-first. **`src/sim/development.ts`** (pure): every rider carries a
hidden `peakAge` (~22–32, gaussian around 27), a per-stat `ceiling` and a `developmentRate`, all
**seeded deterministically per rider id** (`seedDevelopment`). `ageOneSeason` moves each developing
stat along an **individual curve** — grow toward the ceiling before the peak, hold on a plateau
through the good years, then shed points (accelerating) only in the **veteran years** (`DECLINE_ABS_AGE`),
so early bloomers stagnate near their ceiling rather than crashing (SPEC §7). Ceiling headroom is
weighted toward a rider's already-strong stats, so specialists **sharpen** rather than flatten into
all-rounders. `shouldRetire` retires veterans (odds rising with age, certain by `RETIRE_AGE_MAX`);
`generateProspect` mints fresh 19–22-yo free agents from a proxy name pool (`src/data/names.ts`) with
archetype stats + hidden potential. **`scoutReport`** is the gamble: a rider's shown potential (1–5
★ + a scouted ceiling) carries a **seeded error that shrinks to nothing by `SCOUT_CERTAIN_AGE`**, so
two identical-looking teenagers can turn out very differently — potential is a scout's guess, not a
lookup. Wired into **`dynasty.rolloverSeason`**: after settling the books it ages the whole peloton,
retires, ticks contracts on survivors, injects a crop of prospects, **auto-fills** any squad left
short (rivals grab the best, the player gets a flagged stopgap call-up so a hole never breaks a race),
and culls the weakest spares to keep the market/save bounded. Deterministic under a per-season rng;
the dynasty save already persists the roster (dev fields included), so the dynasty carries across
seasons. **UI:** Transfers shows fuzzy ★ potential + a raw/developing/known label (gold for the
unproven) and ranks by the better of now-vs-ceiling so wonderkids surface; Team HQ shows potential on
your own youngsters; the Rollover screen surfaces retirements, academy call-ups and the new intake.
Harness section 7 prints a career arc (growth/plateau/decline), churn and a scouted prospect list.
**13 new tests (80 total).** **Contracts still auto-renew — rival poaching / genuine free-agent lapses
stay deferred; all development numbers in `tuning.ts` are STARTING GUESSES (SPEC §10), balance is Phase 8.**

---

## Phase 7 — Art pipeline experiment

**Goal:** decide code-drawn vs sprite by *looking*, not arguing (SPEC §8).

**Tasks**
- Finalise the `RiderRenderer` interface; implement `CodeDrawnRenderer` and `SpriteRenderer`.
- Generate one consistent AI sprite set (base style → reuse/tweak) for the sprite path.
- A **side-by-side scene** rendering the same riders both ways.
- Record: look/feel, bundle size delta, effort to make variations. Pick a default `RENDER_MODE`.

**Acceptance:** both renderers work; a documented side-by-side comparison exists; a default chosen.

**Built (this phase).** The render abstraction is now a real **config flag, not a rewrite**.
`RiderRenderer` finalised; **both** implementations work: `CodeDrawnRenderer` (Phaser `Graphics`) and
a new **`SpriteRenderer`** that draws rider art from a loaded **texture**. `src/render/index.ts` holds
the one switch — **`RENDER_MODE`** (`'code' | 'sprite'`) + `makeRiderRenderer()`; all rider drawing
goes through it, so the race view is identical either way (verified: flipping the flag renders the
whole peloton as sprites, same animation). **`RenderCompareScene`** (MainMenu → "Renderers") draws the
same six teams **side-by-side** in both styles with the trade-offs on screen.

*Honest note on the sprite art:* the SPEC asks for an **AI-generated raster** set, which this
environment can't produce. The sprite path is instead implemented with an **authored SVG** cyclist
(base + a white jersey layer **tinted per team**), loaded as a texture from an inline base64 data-URI
(`src/render/spriteAssets.ts`) — a genuine loaded-texture sprite, so the comparison, the flag and the
infrastructure are all real; a richer AI raster atlas can drop straight in behind the same texture
keys later. **Default chosen: `RENDER_MODE = 'code'`** — ~0 KB of assets, recolours with one value,
scales crisp, and matches the clean/minimalist look; the sprite path is proven and ready when nicer
art exists but costs an extra tinted layer to recolour + a texture load. (Placeholder art either way —
the *decision infrastructure* is what Phase 7 delivers.)

---

## Phase 8 — Persistence, balance & polish

**Goal:** make it a keeper.

**Tasks**
- Robust save/load (localStorage → IndexedDB if needed); multiple dynasty saves.
- Balance pass on `tuning.ts` now that full seasons run (SPEC §10) — this is where the guessed
  numbers get earned.
- UI/UX polish, sound (optional), PWA offline check.

**Acceptance:** you can put it down and pick it up across weeks; races feel fair and dramatic.

**Built (this phase).** **Persistence — multiple save slots.** `dynastyStore.ts` now addresses **3
slots** (`saveDynastyToSlot` / `loadDynastyFromSlot` / `clearSlot` / `slotInfos`), with a persisted
**active slot** so the slot-less `saveDynasty` / `loadDynasty` the whole scene flow already calls just
work; a pre-slots save auto-migrates into slot 1. MainMenu is now a **save-slot picker** (tap to
continue/start, × to wipe with a confirm). **6 new store tests.** localStorage is fine at this size
(no IndexedDB needed). **Balance pass** (measured, not guessed — `scripts/balanceReport.ts` simulates
5 dynasties × 10 seasons and reports the health metrics): winner spread is healthy (~7.7 distinct
winners of 14 races/season); the **economy was ballooning** (a passive team reached ~20k by S10), so
prize money (`PRIZE_PER_POINT` 2.2→1.3) and the sponsor base (1300→1150) were cut to sit near
break-even for a mid-table team — a surplus is now earned by racing well and a weak team runs a
deficit, so money keeps mattering; and prospect signature ceilings were nudged up
(`PROSPECT_SIGNATURE_MAX` 78→82) to replenish the elite tier as the authored stars retire. **PWA**
offline verified (service worker registers; precache intact). *Still a sim pass —* the numbers are in
a sane range but the final feel (does the economy bite? do careers fade at a satisfying pace?) is the
**phone playtest**, as always. That's the one thing a headless agent can't judge.

> **Core build complete (Phases 0–8).** The design in the SPEC is fully built. From here it's the
> human's game to tune and grow: play it on the phone, adjust `tuning.ts` to taste, and add content
> (more races/riders) or the explicitly-deferred extras (time trials, rival poaching, sprites) if they
> earn their place.

---

## Dependency order (quick view)

```
0 Scaffold
   └─ 1 Headless sim  ← tune the maths here
        └─ 2 Watch a stage   ← MVP FUN GATE (stop & check)
             └─ 3 Tours + GC + fatigue
                  └─ 4 Season + world layer
                       └─ 5 Management (economy/recruit/train/squad)
                            └─ 6 Development / dynasty
                                 └─ 7 Art experiment   (can start any time after 2)
                                      └─ 8 Persistence + balance + polish
```

**The one gate that matters most:** end of Phase 2. If setting tactics and watching a stage isn't
fun there, everything downstream is wasted — iterate before proceeding.

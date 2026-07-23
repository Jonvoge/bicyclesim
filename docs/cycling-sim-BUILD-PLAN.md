# Cycling Team Sim — Build Plan

> Ordered execution plan for a build agent. Work phases **in order**; do not skip ahead.
> Detail lives in `cycling-sim-SPEC.md` (referenced as **SPEC §x**). Each phase lists a **goal**,
> **tasks**, **acceptance criteria** (how you know it's done), and **out of scope** (do NOT build).
>
> Guiding rule: **build the thinnest thing that proves the fun, then stop and check.** Resist
> adding anything not listed for the current phase. Simplicity beats completeness.

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
lever is a team `effort` flag on `TeamTactics` — it cuts the team's fatigue burn (`CONSERVE_FATIGUE_MULT`)
for a small leader penalty today (`CONSERVE_LEADER_PENALTY`), so saving the flat/hilly days
freshens the legs for the queen stage (harness shows fatigue-into-queen 7.0→4.4, queen gap
+10s→+8s). Two tours added: **Tour de Provence** (5 stages) and **Giro d'Aurelia** (9). UI: the
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

**Still deferred.** **Rival rest/effort AI** (rivals always `race` the full roster) and the
**emergent-rivalries** view — natural next steps, likely alongside Phase 5.

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

---

## Phase 7 — Art pipeline experiment

**Goal:** decide code-drawn vs sprite by *looking*, not arguing (SPEC §8).

**Tasks**
- Finalise the `RiderRenderer` interface; implement `CodeDrawnRenderer` and `SpriteRenderer`.
- Generate one consistent AI sprite set (base style → reuse/tweak) for the sprite path.
- A **side-by-side scene** rendering the same riders both ways.
- Record: look/feel, bundle size delta, effort to make variations. Pick a default `RENDER_MODE`.

**Acceptance:** both renderers work; a documented side-by-side comparison exists; a default chosen.

---

## Phase 8 — Persistence, balance & polish

**Goal:** make it a keeper.

**Tasks**
- Robust save/load (localStorage → IndexedDB if needed); multiple dynasty saves.
- Balance pass on `tuning.ts` now that full seasons run (SPEC §10) — this is where the guessed
  numbers get earned.
- UI/UX polish, sound (optional), PWA offline check.

**Acceptance:** you can put it down and pick it up across weeks; races feel fair and dramatic.

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

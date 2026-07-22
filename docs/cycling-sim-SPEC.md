# Cycling Team Sim — Design & Technical Spec

> Source-of-truth reference. The **build plan** (`cycling-sim-BUILD-PLAN.md`) is the ordered
> worklist; this document is what it references for detail. When the two disagree, this wins.
>
> Design constraint that overrides everything: **keep it simple.** This is a personal
> Kairosoft-style pet project. Every mechanic below earns its place by being *fun*, not
> realistic. If a feature adds simulation fidelity but not fun, cut it.

---

## 1. Vision

A Kairosoft-flavoured cycling **team-manager** (think *Game Dev Story* / *Pocket League
Story*): simple on the surface, real depth underneath. The player runs a pro cycling team
across a multi-season **dynasty**. The loop alternates:

- **Management layer** (between races): sign riders, train, pick the squad, manage fatigue.
- **Race layer**: set tactics *before* a stage, then **watch it simulate** (no live in-race input).

Recognisable **proxy/parody names** for riders, teams and races — close enough to guess the
real-world reference, legally safe.

**Platform:** web app, installable to the iPhone home screen as a PWA. No native iOS, no App
Store (chosen because the dev machine is Windows — native iOS would force a Mac + Xcode).

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Engine | **Phaser 3** (latest stable) | Mainstream, heavily documented 2D web game framework; batteries-included (scenes, input, tweens). |
| Language | **TypeScript** | The sim is data-heavy; types act as an executable spec and catch shape bugs early. *If you'd rather avoid the tooling, plain JS works — but TS is recommended given the structured data.* |
| Bundler / dev server | **Vite** | Fast dev server, trivial Phaser setup, first-class PWA plugin. |
| PWA / home-screen install | **vite-plugin-pwa** | Generates manifest + service worker so "Add to Home Screen" launches full-screen. |
| Persistence | **localStorage** for MVP → **IndexedDB** later if saves grow | Single-player; no backend needed. |
| Data | TS/JSON data files under `/src/data` | Riders, stages, races are data, not code — easy to tune and expand. |

**No backend, no accounts, no network calls.** Everything runs client-side.

---

## 3. Project structure

```
/src
  /data          riders.ts, teams.ts, races.ts, stages.ts, stageWeights.ts, tuning.ts
  /sim           stageSim.ts, form.ts, fatigue.ts, tactics.ts, standings.ts, rng.ts
  /state         gameState.ts, save.ts        (central state + serialize/deserialize)
  /scenes        Boot, MainMenu, PreRace, Race, StageResults, SeasonHub, RiderList, ...
  /render        riderRenderer.ts (interface) + codeDrawnRenderer.ts + spriteRenderer.ts
  /ui            reusable widgets (buttons, panels, tables)
  main.ts        Phaser game config + scene registration
/public
  manifest, icons, (later) generated sprite atlases
```

**`tuning.ts`** holds every magic number (weights, sigmas, probabilities) in one file so
balancing is a single place to edit. All constants named `UPPER_SNAKE`.

**Render abstraction is deliberate** (see §8): it makes the code-drawn-vs-sprite experiment a
config flag rather than a rewrite. This is the one bit of "extra" structure — it directly
serves a stated requirement, so it's not gold-plating.

---

## 4. Data model (TypeScript interfaces)

MVP only needs the **bold** fields; the rest arrive in later phases (noted per field).

```ts
type StatKey =
  | 'climbing' | 'timeTrial' | 'sprint' | 'puncheur'
  | 'endurance' | 'stamina' | 'consistency';

interface Rider {
  id: string;
  name: string;              // proxy name
  nationality: string;       // proxy / real country is fine (not trademarked)
  age: number;
  stats: Record<StatKey, number>;   // each 1–100
  teamId: string | null;

  // --- development (Phase 6) ---
  peakAge?: number;          // varies per rider (~22–32)
  ceiling?: Partial<Record<StatKey, number>>; // potential cap per stat
  developmentRate?: number;  // how fast they climb toward ceiling
  // ceiling/peakAge are the "hidden" scouting gamble — stored but shown fuzzily in UI

  // --- runtime ---
  currentFatigue: number;    // 0 = fresh; accumulates over a tour
  isInjured?: boolean;       // rare, Phase 3+

  // --- economy (Phase 5) ---
  salary?: number;
  contractSeasonsLeft?: number;
}

interface Team {
  id: string;
  name: string;              // proxy name
  riderIds: string[];
  isPlayer: boolean;
  budget?: number;           // Phase 5
}

type StageType =
  | 'flat' | 'hilly' | 'mountain' | 'summitFinish'
  | 'descentFinish' | 'cobbled' | 'itt' | 'ttt';

interface Stage {
  id: string;
  name: string;
  type: StageType;
  lengthKm: number;          // drives base time + difficulty
}

type RaceType = 'oneDay' | 'shortTour' | 'grandTour';

interface Race {
  id: string;
  name: string;              // proxy name
  type: RaceType;
  stageIds: string[];        // oneDay = 1 stage; shortTour = 4–5; grandTour = 8–10
  prestige: number;          // points/reward weighting (Phase 4)
}

interface StageResult {
  stageId: string;
  order: { riderId: string; perfScore: number; timeSec: number; dnf: boolean }[];
}

interface GcEntry { riderId: string; totalTimeSec: number; }
```

---

## 5. The simulation (engine room)

This is the core. Build it as a **pure, headless module** (`/sim`) with **no Phaser
dependency**, so it can be run and tuned from a test harness before any UI exists.

### 5.1 Single-stage algorithm

For each rider entered in the stage:

```
baseScore     = Σ  stat[k] * stageWeight[type][k]        // weighted suitability, ~1–100
formSwing     = gaussian(0, sigma(rider.consistency))    // daily form, see 5.3
fatiguePen    = rider.currentFatigue * FATIGUE_WEIGHT     // 0 in a one-day race
tacticsMod    = tacticsEffect(rider, tactics)            // see 5.5
perfScore     = baseScore + formSwing - fatiguePen + tacticsMod

if rng() < crashProb(stage): apply crash (time loss, small chance DNF)  // see 5.6
```

Then: **sort riders by `perfScore` descending** → finishing order. Convert to times (5.7).

### 5.2 Stage weightings (`stageWeights.ts`)

Each type is a weight vector over the *base* stats. Weights sum to 1. `stamina` and
`consistency` are **modifiers** (they act on fatigue and variance), not base weights.

| Type | climbing | timeTrial | sprint | puncheur | endurance |
|---|---|---|---|---|---|
| flat | 0.05 | – | 0.55 | 0.10 | 0.30 |
| hilly | 0.15 | – | 0.15 | 0.40 | 0.30 |
| mountain | 0.55 | – | – | 0.10 | 0.35 |
| summitFinish | 0.65 | – | – | 0.05 | 0.30 |
| descentFinish | 0.40 | – | 0.10 | 0.25 | 0.25 |
| cobbled | – | 0.10 | 0.20 | 0.35 | 0.35 |
| itt | – | 0.80 | – | – | 0.20 |
| ttt | – | 0.60 | – | – | 0.40 | *(team-averaged, see 5.8)* |

*(These are starting values. Expect to tune them once you can watch races — flagged as
uncertain.)*

### 5.3 Daily form swing (`form.ts`)

```
sigma(consistency) = SIGMA_MAX * (1 - consistency/100 * CONSISTENCY_FACTOR)
```
Draw `formSwing` from a normal distribution (Box–Muller — `Math.random()` is uniform, so
implement gaussian explicitly in `rng.ts`). A bell curve makes extreme days rare but possible,
which is the "favourite can still lose" feel.

Defaults: `SIGMA_MAX = 8`, `CONSISTENCY_FACTOR = 0.7`
→ a 100-consistency rider σ≈2.4; a 0-consistency rider σ≈8.0. Tunable.

### 5.4 Stats — definitions

| Stat | Meaning |
|---|---|
| climbing | sustained power on long ascents |
| timeTrial | solo effort against the clock |
| sprint | flat-out finishing speed |
| puncheur | short, steep punches / repeated accelerations on rolling terrain |
| endurance | **within-stage** staying power (a long stage doesn't fade them) |
| stamina | **across-stage** recovery — how well they hold form over a multi-day tour |
| consistency | inverse of day-to-day variance (narrows the form swing) |

The endurance/stamina split is intentional: endurance is *this stage*, stamina is *the whole
tour*. Overlaps between the offensive stats (a strong time-triallist is often a strong climber)
are fine and expected — they emerge from how riders are authored, not from the model.

### 5.5 Tactics (`tactics.ts`)

Before each stage the player picks **two things**:

1. **Protected rider** — the id the team rides for that day (also the rider "sent up the road"
   when the strategy is a breakaway).
2. **Strategy** — chosen from a **race-type-aware** set (a strategy only appears when it makes
   sense for that kind of race). Strategies are a **data-driven registry** (`STRATEGIES`), each
   declaring which `RaceType`s it applies to, its player-facing blurb, and its effects — so the
   palette is easy to widen without touching logic.

**One-day races** (`oneDay`) offer:

| Strategy | Idea | Protected rider | Other selected riders |
|---|---|---|---|
| PROTECT_LEADER | Ride for your leader | `+LEADER_BONUS` (≈ +6) to perfScore | roleMultiplier 1.3 (more fatigue), small self-penalty (−2) |
| BREAKAWAY | Send them up the road, gamble | joins the day's break; `+BREAK_PERF_BONUS` on break-friendly terrain (hilly/mountain/cobbled/descent), small penalty on bunch-sprint terrain (flat/itt); wider σ; markedly higher chance the break survives to the line | roleMultiplier 1.0 |
| SPRINT_FINISH | Sit in, save it for the kick | `+SPRINT_FINISH_BONUS` on likely bunch finishes (flat/hilly/cobbled), penalty if the climbs drop them (mountain/summitFinish) | roleMultiplier 0.8 (a little saved) |

**Stage races** (`shortTour` / `grandTour`, Phase 3) reuse `PROTECT_LEADER` + `BREAKAWAY` and
add:

| Strategy | Idea | Protected rider | Other selected riders |
|---|---|---|---|
| CONSERVE | Save today for the GC | no bonus, small penalty (−2) | roleMultiplier 0.7 (less fatigue) — saving for later |

The trade-off *is* the game: spending the team today for a leader costs stamina tomorrow; a
gambled breakaway can steal a race a stronger team should have won. A weaker team can
occasionally out-tactic a stronger one — that's the giant-killing drama.

### 5.6 Crashes / illness & incidents (`tuning.ts`)

Per rider per stage: `P(crash) ≈ 0.015`, doubled on `cobbled` / `descentFinish`. Effect: a time
loss (finish + random gap); a *small* fraction of crashes become DNF. **Kept rare on purpose** —
drama, never a frustration tax. These incidents feed the race narrative (§5.9): a punctured or
crashed rider is **seen** sliding out of the group. Surfaced from **Phase 2** (as visible drama)
rather than waiting for Phase 3.

### 5.7 Result → times

- Winner base time = `lengthKm / REFERENCE_SPEED_KMH * 3600`.
- Gaps derived from `perfScore` differences × `GAP_SPREAD` (seconds per point).
- MVP can display simple **ordering + gaps**; precise times only matter once GC exists.

### 5.8 Stage races & GC (`standings.ts`, Phase 3)

- **GC (general classification):** sum each rider's stage times; lowest total = race leader.
- **Fatigue across stages:** after each stage,
  `fatigueGain = stageDifficulty * (1 - stamina/100 * STAMINA_FACTOR) * roleMultiplier`;
  added to `currentFatigue`, which penalises the next stage.
- **Recovery:** between races / on rest, `currentFatigue *= RECOVERY_RATE`.
- **TTT:** score on the team's *averaged* timeTrial+endurance; the whole team takes the team's time.
- Optional later: points (sprint) and climbing classifications — **not** in the core; add only if fun.

### 5.9 Race narrative layer (`raceNarrative.ts`, from Phase 2)

The scoring engine (§5.1) decides *how strong* each rider is today. The **narrative layer** turns
that into a race you can *watch* — a breakaway, a chase, a splintering finale, incidents — instead
of lining everyone up on the finish line. It is deliberately a **thin layer over the proven
engine**, not a replacement (fun over realism):

1. **Base scores** come from §5.1 (`scoreRiders`).
2. **A few bounded events adjust the result** (this is what makes watching *matter*):
   - **Breakaway.** A small group (2–4) goes up the road early: the player's rider if the
     strategy is `BREAKAWAY`, plus a few random opportunists (weighted to non-stars). With a
     small, terrain-/tactic-dependent probability (`BREAK_SURVIVE_PROB`) the break **stays away**
     and its strongest member wins — even over stronger riders left behind.
   - **Incidents (§5.6).** Crash/puncture victims take a time penalty (rare DNF); enough to drop
     them down the order or out.
   These are applied on top of base scores, then converted to final times (§5.7). Everything is
   seeded, so a race is reproducible.
3. **A `RaceStory` is generated for the animation**: per rider, a `role`
   (`break` / `peloton` / `contender` / `dropped`) and a small set of **gap-to-leader keyframes**
   over normalised stage time `t ∈ [0,1]`, converging to the final gap at `t = 1`. The race view
   interpolates these so the field visibly forms a break, chases it back, splinters in the finale,
   and sheds anyone who crashes — arriving at the line in groups with real gaps.

The result is authored to still satisfy Phase 1's guarantees (favourites usually win, seeded and
tunable); the narrative only ever nudges outcomes within bounded, tunable limits.

---

## 6. Season & dynasty structure

- Multi-season, following **calendar years**; you build a team over many years.
- **~15 races per season**, WorldTour-style, **no filler** (the explicit anti-goal: the old PCM
  grind of national champs before the big races).
- Compressed calendar so a Grand Tour still feels like an event without dragging:
  - **one-day** races: 1 stage
  - **short tours:** 4–5 stages
  - **grand tours:** 8–10 stages
- Win conditions (Phase 4): season ranking + prestige accumulated across the dynasty.

---

## 7. Rider development (Phase 6)

- **Individualised age curves.** `peakAge` varies around an average — most cluster late-20s, but
  some peak ~22 and some ~32.
- Each rider has a **ceiling** (potential) and a **developmentRate** (how fast they approach it).
- **Peak → plateau → late decline.** Peaking early ≠ declining early: after peak a rider
  *plateaus* near their ceiling for a good stretch; real decline only kicks in in the veteran
  years. Early bloomers **stagnate**, they don't fall off a cliff.
- **Hidden potential.** `ceiling`/`peakAge` are stored but shown **fuzzily** in scouting UI, so
  signing a 19-year-old is a genuine gamble (early bloomer who fades vs late developer worth the
  patience).

---

## 8. Art pipeline (Phase 7 — an experiment, not a decision)

Two renderers behind one interface; pick via a config flag; a side-by-side scene shows both:

```ts
interface RiderRenderer {
  draw(scene: Phaser.Scene, x: number, y: number, visual: RiderVisual): Phaser.GameObjects.GameObject;
}
```

- **`CodeDrawnRenderer`** — Phaser `Graphics`: shapes/paths drawn in code. Tiny footprint,
  infinitely scalable, recolour a jersey by changing one value. Suits clean, chunky, minimalist
  looks. This is the "assets as code" technique.
- **`SpriteRenderer`** — loads a generated PNG atlas. Richer detail; larger footprint; harder to
  vary programmatically. AI-generated sprites are fine here (one-off gen during dev → just files
  at runtime, no ongoing token cost). The hard part is **consistency** across the set — generate
  one base style, then reuse/tweak.

**Deliverable of the experiment:** a real side-by-side to judge look, file size, and how fiddly
each is to vary — decide *after* seeing it, not in the abstract.

---

## 9. Naming / legal note

Proxy/parody names keep the recognition fun while staying clear of trademarks and likeness
issues. Factual data (a race exists, its route/distance/history) isn't copyrightable; the
*names* can be. Keep riders/teams/races as recognisable-but-renamed. *(Not legal advice — just
the pragmatic line these games use.)*

---

## 10. Open / to tune (flagged uncertainties)

- All numbers in `tuning.ts` (stage weights, `SIGMA_MAX`, fatigue/recovery rates, crash prob,
  gap spread) are **starting guesses**. They can only be tuned by watching races — hence the
  headless sim harness comes first.
- Exact fatigue curve shape and how aggressively HUNT_STAGE raises variance are the two most
  likely to need iteration.

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
  | 'descentFinish' | 'cobbled';
// NOTE: time trials ('itt') and team time trials ('ttt') are DEFERRED — a solo
// race against the clock is a fundamentally different shape (no bunch, no break,
// no groups) and will get its own model when reintroduced. Removed for now.

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

*(These are starting values. Expect to tune them once you can watch races — flagged as
uncertain. `itt`/`ttt` rows removed — time trials are deferred, see §4.)*

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

### 5.5 Tactics: a role per rider (`tactics.ts`)

Before each stage the player fills in a **role sheet** — one role for each rider on the team
(pre-filled with a sensible default so a quick player can just hit START). Roles are a
**data-driven registry** (`ROLES`) with player-facing labels, blurbs and chip colours, so the
palette is easy to widen without touching logic.

| Role | Idea | Effect |
|---|---|---|
| LEADER | Backed for the win | `+LEADER_BASE_BONUS` (≈ +4) **plus** `+DOMESTIQUE_SUPPORT_BONUS` (≈ +1.2) per DOMESTIQUE on the sheet (counting at most `DOMESTIQUE_SUPPORT_CAP`, split if several leaders are named) |
| SPRINTER | Sit in, save it for the kick | `+SPRINTER_BONUS` on likely bunch finishes (flat/hilly/cobbled), penalty if the climbs drop them (mountain/summitFinish); fatigueMult 0.8 |
| BREAKAWAY | Sent up the road — the gamble | a *non-favourite* is guaranteed into the **morning break** and raises its survival odds (per committed rider, capped — §5.9); a *favourite* launches a committed **late attack** instead. `+BREAK_PERF_BONUS` on break-friendly terrain, small penalty on flat; wider σ; fatigueMult 1.2 |
| DOMESTIQUE | Works for the leader | small self-penalty (−`DOMESTIQUE_WORK_PENALTY`) — the work flows to the leader's bonus above; fatigueMult 1.3 (the bill arrives in Phase 3) |
| FREE | Rides his own race | neutral; fatigueMult 0.9 |

Fatigue multipliers are exposed now and consumed in **Phase 3** — that's when spending five
domestiques on one day starts costing the rest of the week, and a team-level "conserve for GC"
lever returns as part of the stage-race layer.

The trade-off *is* the game: stacking domestiques behind a leader wins today and costs
tomorrow; a gambled breakaway can steal a race a stronger team should have won. A weaker team
can occasionally out-tactic a stronger one — that's the giant-killing drama.

Rival teams ride a simple default sheet until Phase 4 (best-suited rider leads, a genuine fast
finisher gets SPRINTER on bunch terrain, everyone else works).

### 5.6 Incidents: crashes & punctures (`tuning.ts`)

Per rider per stage: `P(incident) ≈ 0.02`, doubled on `cobbled` / `descentFinish`. An incident is
either a **puncture** (~60%) or a **crash**. Both cost a time loss (finish + random gap), but only
a *crash* can end in a DNF, and only a **small** fraction do — **a puncture never causes an
abandon**. So abandons are genuinely rare; a punctured rider is dropped and chasing, not out.
These feed the race narrative (§5.9): the rider is **seen** sliding out the back and named on the
race radio. Surfaced from **Phase 2** as visible drama rather than waiting for Phase 3.

### 5.7 Result → times

- Winner base time = `lengthKm / REFERENCE_SPEED_KMH * 3600`.
- Gaps derived from `perfScore` differences × `GAP_SPREAD` (seconds per point).
- **Finish groups (pro convention):** finishers are clustered — a rider within
  `GROUP_GAP_THRESHOLD_SEC` of the rider ahead joins their group, and **everyone in a group
  gets the same time** (shown as `s.t.` after the first rider). The threshold is terrain-aware:
  bunch terrain ~5 s (big groups), mountain/summit ~2 s (ones and twos). Order within a
  group = crossing order.
- MVP can display simple **ordering + gaps**; precise times only matter once GC exists.

### 5.8 Stage races & GC (`standings.ts`, Phase 3)

- **GC (general classification):** sum each rider's stage times; lowest total = race leader.
  A rider must finish **every** stage ridden so far to hold a GC place; abandoning (a stage DNF)
  drops them from GC and from the rest of the tour.
- **Fatigue across stages:** after each stage,
  `fatigueGain = stageDifficulty * (1 - stamina/100 * STAMINA_FACTOR) * fatigueMult`
  (where `stageDifficulty = FATIGUE_BASE * TYPE_WEIGHT * lengthKm/FATIGUE_REF_KM`, and
  `fatigueMult` is the rider's role × team effort, §5.5). It's added to `currentFatigue`, which
  penalises the next stage (`× FATIGUE_WEIGHT` on perfScore, §5.1).
- **Overnight recovery within a tour:** between stages, `currentFatigue *= STAGE_RECOVERY_RATE`
  (a mild recover so fatigue plateaus over a long tour rather than ballooning). Bigger recovery
  between *races* / on rest is `RECOVERY_RATE` (Phase 4).
- **Conserve lever (team effort):** a team may ride a stage `conserve` instead of `race` — it cuts
  the whole team's fatigue burn (`× CONSERVE_FATIGUE_MULT`) for a small perf penalty to the leader
  that day (`CONSERVE_LEADER_PENALTY`). Saving the stages a GC leader can't win (flat/hilly)
  freshens the legs for the mountains — the "spend today / pay tomorrow" trade-off, as an effort
  setting on top of the role sheet.
- **Purity:** the tour holds the fatigue map + abandon set; the global roster is never mutated —
  each stage rides fatigued rider **copies**, so a tour stays deterministic and re-runnable.
- **TTT:** *(deferred with time trials — see §4; revisit with their own model.)*
- Optional later: points (sprint) and climbing classifications — **not** in the core; add only if fun.

### 5.9 Race narrative layer (`raceNarrative.ts`, from Phase 2)

The scoring engine (§5.1) decides *how strong* each rider is today. The **narrative layer** turns
that into a race you can *watch* — a breakaway, a chase, a splintering finale, incidents — instead
of lining everyone up on the finish line. It is deliberately a **thin layer over the proven
engine**, not a replacement (fun over realism):

1. **Base scores** come from §5.1 (`scoreRiders`).
2. **A few bounded events adjust the result** (this is what makes watching *matter*):
   There are **two kinds of move**, not one — this is what keeps a race from feeling formulaic:
   - **The morning break.** A small group (2–5) of **opportunists only** — never a favourite; the
     strongest `FAVOURITE_COUNT` riders save it for later. The player can commit a *domestique*
     to it via `BREAKAWAY`. Whether it **stays away** is emergent: `survive = clamp(BASE +
     TERRAIN·friendliness + tacticBonus, 0, MAX)`. Break-friendly days (hilly/cobbled) let it
     stick; sprinters' courses reel it in. If it survives, its strongest rider wins.
   - **Late attacks.** In the finale a **favourite** can jump clear — the player's leader if they
     chose `BREAKAWAY` (a leader "attacks late" rather than riding the morning break), else
     sometimes an emergent move. Whether it's launched and whether it **sticks** both scale with
     terrain **selectiveness** (`P(sticks) = clamp(BASE + selectiveness·W + attackerStrength·W +
     tacticBonus, 0, MAX)`): attacks win on climbs, get chased down on flat roads. A successful
     attack is a solo win by a small margin.
   - **Incidents (§5.6).** Crash/puncture victims take a time penalty (rare DNF); enough to drop
     them down the order or out.
   These are applied on top of base scores, then converted to final times (§5.7). Everything is
   seeded, so a race is reproducible.
3. **A `RaceStory` is generated for the animation**: per rider, a `role`
   (`break` / `peloton` / `contender` / `dropped`) and a small set of **gap-to-leader keyframes**
   over normalised stage time `t ∈ [0,1]`, converging to the final gap at `t = 1`. Trajectories
   are **quantized by group** (riders in the same group share a trajectory) so the field reads as
   *bunches* — a break clear, one peloton blob chasing, the finale splintering — not individuals
   strung along a line.
4. **Race radio.** The story also carries a seeded `RaceEvent` list — break composition (named),
   the break's max lead, crashes/punctures (named, with abandons), the catch, the finale, the
   winner — which the race view surfaces as a live commentary ticker.
5. **The race view is broadcast-style:** the stage profile with a live position marker (the map),
   a groups-overview strip listing every group on the road and the gaps between them, the
   clustered field, the radio ticker, and the finish order revealing group by group.

**Non-formulaic on purpose.** The break peak, the catch time and the finale are all **jittered
per race** (and per rider, slightly), so no two races unfold on the same script: some days the
break is caught early, some it holds to the line, some come down to a bunch sprint with no real
"finale" at all. The late-race radio headline reflects what actually happened (break holds / the
group shatters / bunch sprint), derived from the real lead-group size — not a fixed beat.

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

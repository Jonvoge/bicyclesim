# Cycling Team Sim — Season Focus, Form Reveal & Kairosoft Polish

> **Post-core enhancement spec.** The core build (Phases 0–8) is complete; this is a new,
> optional extension, not a plan phase. It extends `cycling-sim-SPEC.md` — where this and the
> SPEC disagree on an existing mechanic, the SPEC wins; this doc only *adds*.
>
> Same rules as everything else here: **headless-first** (no Phaser until the maths is proven from
> the harness), **all numbers are starting guesses** (SPEC §10), **fun/simplicity over realism**,
> and **minimal friction** — every new lever must have a good default so a hands-off player is
> never punished for ignoring it.

---

## 0. The idea in one paragraph

Add a season-long **Condition** curve you *plan* (peak your climber for the grand tour, your
classics man for spring), revealed on the calendar and impossible to hold all year. Layer the
existing **daily Form swing** on top as a hidden "read the legs" moment at the start line — you
learn who woke up flying only once the tactics are locked. Make the already-existing **development
camps** actually *show* what they did. Populate an **autumn window** in the calendar so late-season
plans have something to aim at. Then dress the whole loop in Kairosoft juice.

---

## 1. The three layers (keep them distinct)

The single most important design decision: these are **three separate systems on three
timescales.** Do not merge them.

| Layer | What it is | Timescale | Status |
|---|---|---|---|
| **Development** | permanent stat growth/decline toward a hidden ceiling | a career (years) | ✅ exists (`development.ts`, auto camps) |
| **Condition** *(new)* | temporary form that rises to a planned peak and fades | within one season | ➕ this doc, Part A |
| **Form swing** | daily noise around today's level | one stage | ✅ exists (`form.ts`, consistency-driven) |

Mental model: *Development* is who the rider is becoming; *Condition* is a curve you plan;
*Form swing* is the off-day dice. The "Season Focus plan" lives **entirely** in Condition and never
touches the development camps (decided). The camps stay automatic; we only make them *visible*
(Part C).

---

## Part A — Season Focus (the Condition layer)

### A.1 Data model

```ts
// src/data/types.ts — Rider gains one runtime field + one assignment
interface Rider {
  // ...
  condition: number;          // runtime, 0..1 — today's form level (set per event, see A.5)
  focusPlanId: string;        // which season plan this rider is on (defaults, see A.4)
}

// src/data/focusPlans.ts — a data-driven registry, exactly like ROLES (SPEC §5.5)
interface FocusPlan {
  id: string;
  label: string;              // player-facing, e.g. "Grand Tour"
  blurb: string;              // one line for the palette
  color: number;              // chip / calendar-band colour
  bumps: FocusBump[];         // one or more condition humps over the season
}
interface FocusBump {
  center: number;             // peak position as a fraction of the season, t ∈ [0,1]
  width: number;              // σ of the hump in season-fraction (how long the form lasts)
  height: number;             // peak lift above the floor (0..~0.65)
}
```

`condition` is treated exactly like `currentFatigue`: **runtime state set on the rider copies each
event** (SPEC §5.8 purity — the global roster is never mutated), so the sim stays deterministic and
re-runnable. `focusPlanId` is durable (persisted with the dynasty).

### A.2 The curve

Condition for a rider at event index `e` (1-based) in an `N`-event calendar is a **deterministic**
function — no RNG, so the player can plan around it:

```
t          = (e − 1) / (N − 1)                    // season position, 0..1
lift(t)    = Σ_bumps  height_b · exp(−½ ((t − center_b) / width_b)²)   // Gaussian humps
condition  = clamp(CONDITION_FLOOR + lift(t), 0, 1)
```

For a multi-stage race, condition is fixed for the whole race (it's a season-position property, not
per-stage) — computed once when the event's field is seeded.

### A.3 The conservation law (why you can't peak all year)

**Invariant:** every plan's total hump area is roughly equal.

```
area(plan) = Σ_bumps  height_b · width_b   ≈  FOCUS_BUDGET   (± FOCUS_BUDGET_TOL)
```

This is the whole strategy in one line: a **sharp single peak** goes high but is narrow; **two
peaks** are each lower; **steady** never peaks but never slumps. You choose *where* to spend a fixed
form budget. This is authored/hand-balanced in the plan data, **not** computed at runtime — a
harness test asserts the invariant so a mis-authored plan can't sneak in free form.

### A.4 The plan catalogue (starting guesses — see §Constants)

Windows for the ~17-event calendar of Part D: **Spring** ≈ events 1–9 (t≈0.29), **Summer** ≈ 10–13
(t≈0.68), **Autumn** ≈ 14–17 (t≈0.91).

| Plan | Bumps `(center, width, height)` | Peak `c` | Feel |
|---|---|---|---|
| **Spring Classics** | (0.29, 0.10, 0.62) | ~0.97 | Flying for the cobbles & Ardennes, flat after |
| **Grand Tour** | (0.68, 0.10, 0.62) | ~0.97 | Slow build, peak for the summer stage races |
| **Autumn** | (0.91, 0.10, 0.62) | ~0.97 | Saves it for Lombardo & the late one-days |
| **Two Peaks** | (0.29, 0.09, 0.34) + (0.91, 0.09, 0.34) | ~0.69 | A spring *and* a fall bump — each lower |
| **Steady** *(default fallback)* | (0.55, 0.40, 0.22) | ~0.57 | Never great, never bad — all year round |

All hump areas ≈ 0.062 (single: 0.10·0.62; two-peak: 2·0.09·0.34≈0.061; steady: 0.40·0.22=0.088 —
steady is deliberately a hair over so "safe" isn't strictly dominated; tune with `FOCUS_BUDGET_TOL`).

**Default assignment (minimal friction).** Every rider is auto-assigned by archetype so a player who
never opens the screen still gets sensible peaks. Deterministic map from `riderType()`
(`rating.ts`):

| Rider type (signature) | Default plan | Why |
|---|---|---|
| sprint | Spring Classics | the big bunch one-days cluster in spring |
| cobbled / puncheur | Spring Classics | Flandts, Roubey, Ardennes |
| climbing / GC | Grand Tour | Aurelia, Vuelta, the summit finishes |
| all-rounder / hilly | Autumn | Lombardo, the Rainbow one-day |
| *(anything unclear)* | Steady | never a bad bet |

The player can override any rider to any plan; the palette is the `FocusPlan` registry, so widening
it later (a "Double Grand Tour", a "Debutant — always Steady") is a data edit.

### A.5 Where it plugs into the sim (exact hook)

Condition is a **season-position** property, and `stageSim` doesn't know the season — so compute it
at the event-seeding layer (dynasty/season, where the fatigued rider copies are already made) and
set `copy.condition`, mirroring `currentFatigue`. Then one line in `scoreRiders`
(`src/sim/stageSim.ts`, currently line 68):

```ts
const conditionMod = (2 * rider.condition - 1) * CONDITION_PERF_MAX;   // c=1 → +MAX, c=.5 → 0, c=0 → −MAX
const perfScore = base + formSwing - fatiguePen + effect.perfMod + conditionMod;
```

Sizing: `CONDITION_PERF_MAX ≈ 4` puts a full peak on par with `LEADER_BASE_BONUS` (4) and about half
a `SIGMA_MAX` (8) form swing — meaningful, especially amplified in the mountains by
`GAP_COMPRESSION_BY_TYPE`, without letting form outweigh raw ability (favourites still usually win,
SPEC §5.9 guarantee). A peaked-vs-off-window specialist is ~5 perf points apart — a real gap on a
summit finish, a shrug on a flat bunch day. **Flagged: this is the number most likely to need the
playtest.**

### A.6 Interaction with fatigue (no double-counting)

Condition (upside you plan) and season fatigue (downside you manage) stay **independent** — two
meters. The emergent tension is free: a peak **wasted on tired legs** is heartbreak, because
`conditionMod` lifts perf while `fatiguePen` drags it down in the same sum. You have to arrive at
your target **both peaked and fresh**. Optional later: a plan could *hint* the squad-pick/rest AI to
taper a rider just before their peak — not required for v1.

---

## Part B — The daily Form reveal ("read the legs")

The pay-off moment: you planned the peak (Condition); at the gun the dice tell you if the legs
actually showed up (Form). This surfaces the **existing** `formSwing` (SPEC §5.3) — no new
simulation, just a reveal.

### B.1 Anti-exploit by construction

The leg-read is derived from the seeded `formSwing`, which is only drawn inside `scoreRiders` — i.e.
**after** tactics are locked and START is pressed. It is structurally impossible for it to leak into
the pre-race tactics screen. (Stated as a guarantee, not a UI rule to remember.)

### B.2 Bucket by z-score, not absolute swing

The swing must be read **relative to the rider's own spread**, or it just re-reports consistency. A
flaky rider swings ±8 routinely; a metronome at +6 is a special day. So:

```
z = formSwing / sigma(consistency)         // sigma() already in form.ts
```

| z-score | Leg-read | Face |
|---|---|---|
| ≥ +1.5 | **FLYING!** | 😤 |
| +0.6 … +1.5 | Good legs | 🙂 |
| −0.6 … +0.6 | Normal | 😐 |
| −1.5 … −0.6 | Heavy legs | 😟 |
| ≤ −1.5 | Off day | 😫 |

On a normal curve that's ≈ 7% FLYING / 20% good / 46% normal / 20% heavy / 7% off — FLYING and Off
are rare enough to feel like events. Thresholds are `LEGREAD_Z_*` constants. A neat side effect:
your *consistent* riders rarely surprise you, your *wildcards* swing between 😤 and 😫 — consistency
becomes legible on the road.

### B.3 Information asymmetry: your legs vs theirs

- **Your squad:** full leg-read revealed **at the gun** (t=0) — a face bubble over each of your
  rider glyphs. You're their DS; you'd feel it in the warm-up.
- **Rivals:** hidden. Their form is only *read* as the race unfolds, and only the extremes surface —
  a rival with `|z| ≥ LEGREAD_RADIO_Z` (≈1.8) throws a radio line. The rival superstar on a secret
  off-day is a *discovery*, not a spoiler.

`stageSim` already carries `playerTeamId`, so the split is available where the reveal data is built.

### B.4 Headless-first data shape

The reveal is **data the sim emits**, rendered later. `ScoredRider` (currently `{ riderId,
perfScore }`) gains the raw ingredients so the UI/narrative compute buckets deterministically:

```ts
interface ScoredRider {
  riderId: string;
  perfScore: number;
  formSwing: number;    // the day's draw
  sigmaUsed: number;    // sigma(consistency) · effect.sigmaMult, so z = formSwing / sigmaUsed
}
```

The narrative layer (`raceNarrative.ts`) then emits leg-read events into its existing seeded
`RaceEvent` list (SPEC §5.9 §4): all of the player's riders at t=0, plus any rival past the radio
threshold. The harness prints the leg-read table so the buckets can be eyeballed before any UI.

### B.5 Tie it back to Condition (UI)

Show the leg-read **against** the planned condition bar: the bar sits at the planned level, then a
green "+ great legs!" glows it brighter or a red "– flat" dips it — plan-vs-reality in one glance.

---

## Part C — Make development camps visible

The problem today: `TrainingScene` is read-only, the only delta shown is a `+X.X` that appears *only*
for riders who improved in the single most-recent camp, and "Now 85" is just the current rating.
The story of what the camp did is silently discarded.

### C.1 Data (headless)

- `trainingTick` (`development.ts`) currently returns a single total. Have it also report the
  **per-stat deltas** it applied (`{ total, byStat: Partial<Record<StatKey, number>> }`), so we can
  name the stat that sharpened.
- The dynasty accumulates a **season-to-date development delta** per rider (sum of camp gains this
  season), reset at rollover. Cheap; the camps already run through `finishSeasonEvent`.

### C.2 UI (Kairosoft)

- **Push it, don't bury it.** When a camp fires (after events 3/6/8/11 for a 14-event season; recompute
  for 17), interrupt with a **"🏕️ Training Camp!"** moment: each rider's gain floats up with the
  **named stat** — *"Vandersnel · Climbing 78 → 81 🏔️ +3"*.
- **Development screen** shows season-to-date growth, not just current: **`85 (+4 this year) ▲`**,
  and names the stat that moved. The screen becomes a record of a story you watched, not a lookup.

---

## Part D — Populate the autumn window

Today **9 of 14 events are spring** (through Liège); the back half is carried by the two tours + a
couple of late one-days + Lombardo. "Autumn" and "Two Peaks" plans need real targets, or they aim at
nothing. New races earn their place *because* the Focus system gives them purpose — this respects the
SPEC §6 "no filler" rule (nothing here is a national-champs grind; each is a plausible target).

### D.1 New races (proxy names, SPEC §9)

| Id | Proxy name | Type | Window | Prestige | Character |
|---|---|---|---|---|---|
| `r-iberia` | Vuelta a Iberia | shortTour (5) | late summer | 86 | climber's stage race (mountain-heavy) |
| `r-montreol` | Montréol Classic | oneDay | autumn | 68 | puncheur one-day |
| `r-rainbow` | Rainbow Championship | oneDay | autumn | 93 | the one-day season peak (hilly/puncheur) |

New stages authored to match (5 for Iberia, 1 each for the one-days) — a mountain-leaning stage set
for Iberia so it's a genuine GC/Grand-Tour-plan target distinct from Aurelia.

### D.2 Calendar (~17 events, three balanced windows)

```
Spring  (1–9):   omlopp, strada, sanreno, harburg, flandts, roubey, amstal, fleche, liege
Summer  (10–13): provence, donostia, montagne, aurelia
Autumn  (14–17): iberia, montreol, rainbow, lombardo
```

`campEventIndices` already derives from `calendar.length`, so the training camps re-space
automatically. Season points/prestige, prize money and standings all key off the calendar, so they
absorb the new races for free.

---

## Part E — Kairosoft flavour add-ons (do 1–2 with the above; 3–4 stretch)

1. **Floating numeric feedback** *(cheap, do it)* — `+2!` pops on camp gains, `IN FORM!` on a peak
   start, rank-ups. The camps already compute the numbers; make them pop instead of sitting in a
   list.
2. **Season objective from the sponsor** *(cheap, do it)* — one board goal a year ("Win a Monument",
   "Top-5 the season"), plugged into the existing prestige/sponsor system. Turns the silent
   rank→sponsor-cheque link into a *moment*.
3. **Combo bonuses** *(medium, stretch)* — Kairosoft's "this + this = ★". Peaked **+** signature
   terrain **+** LEADER = a small named combo perf bonus with a popup. Every ingredient exists once
   Condition lands; it's a thin bounded layer (keep it inside the same "favourites usually win"
   limits).
4. **Palmarès / hall-of-fame view** *(medium, later)* — a legacy screen off the existing archive
   data; the dynasty's soul. No new sim.

**Explicitly skipped** (would gold-plate or stray from vision): rider "personality traits", real
rider data, any in-race/live input (the leg-read is a *reveal*, never a control — SPEC §1).

---

## Constants (all STARTING GUESSES — SPEC §10)

New `tuning.ts` block:

```ts
// --- Season Focus / Condition (Part A) ---
export const CONDITION_FLOOR = 0.35;      // form when a rider is outside their planned window
export const CONDITION_PERF_MAX = 4;      // perfScore lift at full peak (c=1); on par with LEADER_BASE_BONUS
export const FOCUS_BUDGET = 0.062;        // target hump-area per plan (the conservation law, A.3)
export const FOCUS_BUDGET_TOL = 0.03;     // allowed area spread across plans (steady sits a hair high)

// --- Daily form reveal / leg-read (Part B) ---
export const LEGREAD_Z_FLYING = 1.5;      // z ≥ this → "FLYING!"
export const LEGREAD_Z_GOOD = 0.6;        // z ≥ this → "Good legs"
export const LEGREAD_Z_HEAVY = -0.6;      // z ≤ this → "Heavy legs"
export const LEGREAD_Z_OFF = -1.5;        // z ≤ this → "Off day"
export const LEGREAD_RADIO_Z = 1.8;       // |z| ≥ this on a RIVAL surfaces a radio line
```

Plan curves (`focusPlans.ts`) and the three new race prestiges are data, but every height/width/
prestige above is equally a guess. The two most likely to need the playtest: **`CONDITION_PERF_MAX`**
(how much a peak is worth) and the **hump `width`s** (how many races a peak covers).

---

## Build order (headless-first — CLAUDE.md rule 3)

Prove the maths from the harness before any Phaser. Suggested PR boundaries (one coherent PR each,
stop for review):

**PR 1 — Condition core (headless).** `focusPlans.ts` registry + curve; `Rider.condition` /
`focusPlanId`; seed condition onto event rider-copies; the `scoreRiders` hook; default-plan
assignment; new `tuning.ts` block. Harness: print a rider's condition across a season for each plan;
**assert the conservation invariant** (A.3); show a peaked rider gaining real time on their target
terrain. *Acceptance: from the CLI, plans produce distinct, budget-equal curves and visibly move
results in the target window — no UI.*

**PR 2 — Form reveal data + calendar + camp data (headless).** Extend `ScoredRider` with
`formSwing`/`sigmaUsed`; z-score buckets; leg-read `RaceEvent`s (own + rival extremes) in
`raceNarrative`; the three autumn races/stages + calendar; `trainingTick` per-stat deltas + season
delta. Harness prints the leg-read table and the new calendar's camp spacing. *Acceptance: leg-read
buckets and radio lines print sensibly; the autumn window carries real races; camp gains are
per-stat.*

**PR 3 — UI.** Focus-plan picker (Team HQ / a "Season Plan" door) with the calendar peak-bands;
leg-read faces at the gun + condition bar; the "🏕️ Training Camp!" moment + floating numbers; the
Development-screen season delta. *Acceptance (the real gate — a phone playtest): planning a peak,
then watching the legs reveal at the gun, feels good; the camp moment lands.*

**PR 4 — Flavour (stretch).** Season objective; combos; palmarès — as they earn their place.

---

## Flagged uncertainties

- **`CONDITION_PERF_MAX`** — the master dial. Too high and form beats ability (breaks the SPEC §5.9
  guarantee); too low and planning doesn't matter. Watch it first.
- **Hump widths** — decide how forgiving a "peak" is: a wide peak covers a whole window (low
  friction, low stakes), a narrow one punishes a mistimed target (high stakes, more fiddly).
- **Does Condition need its own scarcity beyond the conservation law?** If Steady turns out to be a
  no-brainer for every rider, the peaks aren't tempting enough — likely a `CONDITION_FLOOR` / peak
  spread problem. A playtest question, not a design one.
- **Rival plans** — v1 can just give rivals sensible defaults (like their role sheets pre-Phase-4).
  Whether rivals should *strategically* target races is a later question; don't build it yet.

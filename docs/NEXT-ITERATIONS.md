# Bicycle Sim — Next Iterations

> **Living product backlog after the core build.** This is the place to track proposed work,
> deferred systems, UI overhaul direction, and the push toward a more rewarding Kairosoft-style
> game loop.
>
> The implemented rules still live in `cycling-sim-SPEC.md`; completed build history lives in
> `cycling-sim-BUILD-PLAN.md` and `HANDOVER.md`. If this roadmap conflicts with the SPEC, the SPEC
> wins until both are deliberately updated. Items here are proposals, not approved mechanics,
> unless marked **Built**.
>
> **Approved expansion:** `cycling-sim-DYNASTY-EXPANSION-PLAN.md` separately defines the committed
> race-balance, generated-world, and two-division Dynasty program. Its sections 1-3 are approved and
> take precedence where they overlap proposals here; its management section 4 remains deferred.

## 1. Product North Star

Bicycle Sim should feel like a compact cycling world that is easy to understand, satisfying to
advance, and difficult to put down. Fun and clarity beat realism.

The desired emotional loop is:

1. **Anticipate** — see the next target, a rider nearing peak form, and the rival likely to matter.
2. **Prepare** — choose a squad, assign roles, and decide where to spend freshness.
3. **Reveal** — discover the day's legs, breakaway, incidents, and rival intentions.
4. **Pay off** — clearly count points, money, development, objective progress, and rank movement.
5. **Remember** — preserve wins, rivalries, rider careers, records, and season history.

The simulation already supports most of this. The main gap is presentation and continuity: good
things happen, but they are often reported quietly or forgotten immediately.

## 2. Current State

The Phase 0–8 core and Season Focus extension are complete:

- Multi-season dynasty with three save slots and selectable teams.
- Seeded stage simulation, race narrative, tactics, tours, fatigue, and season standings.
- Pick-five squads, roles, season-long Condition plans, and gun-time leg-read reveals.
- Economy, transfers, automatic training camps, development, prospects, ageing, and retirement.
- Sponsor objectives, autumn calendar, archives, PWA support, and code/sprite render paths.
- Headless tests and balance harness for deterministic tuning.

The core loop is functional and broad enough. The next iterations should make its consequences
more visible and its world more personal before adding large simulation systems.

## 3. Current Rival AI — Honest Assessment

Rival AI exists, but it is currently competent setup logic rather than a memorable opponent.

### Built

- Each rival fields five riders ranked by terrain/tour suitability minus a fatigue penalty.
- Tired stars naturally rotate out for fresher riders.
- Default tactics choose the best-suited leader, an eligible sprinter on bunch-finish terrain,
  and domestiques for the remaining riders.
- Rival Season Focus plans use sensible deterministic defaults.
- Rival results, fatigue, development, retirement, and team standings persist with the world.

### Missing

- No explicit season targets or race-priority plan.
- No tapering before a target beyond the incidental fatigue penalty.
- No rival `conserve` decisions within tours.
- No tactical adaptation to standings, route shape, recent results, or the player's team.
- No persistent rivalry memory, nemesis, team-to-watch, or visible intent.
- No rival participation in the transfer market; expiring contracts auto-renew.

This means rivals can produce credible results without feeling like characters in the player's
season.

## 4. Priority Roadmap

### P0 — UI Overhaul and Reward Clarity

**Goal:** make the existing game immediately more legible, tactile, and rewarding on an iPhone.

**In progress in the current overhaul:**

- Flat shared visual system built around dark charcoal surfaces and yellow emphasis.
- Season home rebuilt around one featured upcoming race rather than the full 17-row calendar.
- Compact season tracker, sponsor progress, upcoming-race preview, and season pulse.
- Stable bottom navigation and more comfortable mobile spacing.
- Previous/next archive navigation so compacting the calendar does not hide old results.

**Next screens, in order:**

1. **Stage Results** — this is the main payoff screen and should receive the strongest pass.
2. **Pre-Race** — improve squad comparison, role clarity, fitness hierarchy, and tap targets.
3. **Team HQ** — make rider growth, focus, contracts, and key actions scan quickly.
4. **Development and Transfers** — improve comparison and make potential/growth feel exciting.
5. **Race view** — polish radio hierarchy, group readability, and celebration moments.
6. **Standings, Peloton, Rollover, and remaining utility screens** — bring them into the shared
   visual language without adding unnecessary navigation.

**Mobile requirements:**

- Use the 390×844 design canvas as the primary acceptance viewport.
- Keep essential controls clear of the top and bottom safe-area edges.
- Do not place a fixed CTA over a scrolling region.
- Preserve at least 44 design pixels for primary touch targets where practical.
- Long names, values, and translated-length text must not overlap adjacent content.
- Validate on an iPhone-sized browser and the installed PWA after toolbar/cache changes.

### P1 — Post-Race Payoff Sequence

**Goal:** turn every race from a result table into a compact reward ceremony.

Add a short, skippable count-up after an event:

- Finishing result and notable rider performance.
- Season points gained.
- Rider and team rank movement, including arrows and positions gained/lost.
- Prize money added to the budget.
- Sponsor-objective progress.
- Condition target success, personal best, first win, or other rare callout.
- Training camp trigger and permanent stat gains when applicable.

Use a few meaningful animations rather than constant motion. Important rewards should arrive in a
clear sequence with restrained sound and haptic cues where the platform allows them. The player
must be able to tap once to complete the sequence immediately.

### P2 — Rival Directors

**Goal:** give rivals season intent and make that intent visible without building a heavyweight AI.

Each team receives a deterministic **director plan** for the season:

- Two or three target races/windows based on roster strengths.
- One protected leader per target.
- A simple taper rule that values freshness in the one or two preceding events.
- Tour effort decisions: conserve on low-priority stages when protecting a GC objective.
- A bounded tactical preference such as sprint control, break hunting, classics aggression, or GC
  protection. These are team strategies, not rider personality traits.

The UI should expose the plan through:

- A pre-race **Team to Watch** panel.
- A named rival leader and reason they matter today.
- Radio lines when a rival commits to or abandons its plan.
- A season-hub warning when an opposing rider is peaking for the next target.

Keep all decisions deterministic under the season seed. Default behavior must remain competitive
if the player never studies these signals.

**Acceptance:** over a simulated season, rivals still rotate sensibly and stay balanced; in a phone
playtest, the player can name at least one rival team or rider and explain what they are targeting.

### P3 — Rivalries and World Memory

**Goal:** turn repeated simulation outcomes into stories without adding scripted campaigns.

Track small, derived facts:

- Repeated close finishes between the same riders.
- Wins traded on similar terrain.
- A rival repeatedly beating the player's leader.
- Season lead changes and comeback wins.
- Team streaks, droughts, and breakthrough victories.

Surface one current **nemesis** or rivalry at a time on the season hub and race preview. Rivalries
must emerge from results and expire when no longer relevant; they should not provide large hidden
performance bonuses.

### P4 — Combo Discoveries

**Goal:** provide Kairosoft-style “this plus this equals something special” moments using existing
systems.

Candidate combinations:

- Peaked Condition + signature terrain + Leader role = **Perfect Target**.
- Good/Flying legs + Free role + break-friendly route = **Breakaway Spark**.
- Fresh squad + multiple domestiques + GC leader = **Mountain Train**.
- Young rider + strong camp gain = **Breakthrough Prospect**.
- Win while completing the sponsor objective = **Boardroom Hero**.

Rules:

- Most combos should be celebratory labels, reward multipliers, or tiny bounded bonuses.
- They must not overturn the “favourites usually win” simulation guarantee.
- Discoveries should be recorded so collecting them adds a lightweight long-term goal.
- The first appearance gets a stronger reveal; repeats stay compact.

### P5 — Palmarès and Hall of Fame

**Goal:** give the dynasty a soul and make long careers worth remembering.

Build a read-only legacy book from persisted results:

- Rider career wins, stage wins, tours, Monuments, and championships.
- Team records and best season finishes.
- Season champions and sponsor objectives completed.
- Retired rider pages with career totals and years on the player's team.
- Firsts and records: first victory, youngest winner, longest streak, largest GC margin.

Before implementing, extend persistence deliberately so future saves retain enough history. Do not
infer long-term records from the current top-N archive if data has already been discarded.

### P6 — Rival Transfer Market

**Goal:** make the peloton evolve competitively after the lighter rival systems prove valuable.

Potential scope:

- Contracts genuinely expire instead of silently auto-renewing.
- Rival teams evaluate roster gaps, age, salary, potential, and team budget.
- Rivals compete for free agents and released riders.
- The player receives clear advance warning before losing an unsigned rider.
- AI teams maintain legal squad sizes and get a safe academy fallback.

This is deliberately below Rival Directors. Transfer competition introduces punishment and save
complexity; visible rival intent creates drama in every race for much less risk.

### P7 — Time Trials and Team Time Trials

**Goal:** add a genuinely different race shape only after the primary loop feels excellent.

The `flat` stat is prepared as the backbone, but TTs need their own simulation, presentation, squad
rules, pacing, and result flow. They should not be disguised as ordinary bunch stages. TTTs also
need team-strength and pacing logic. Treat this as a dedicated design/build slice with headless tests
before UI work.

### P8 — Final Art, Sound, and Haptics

**Goal:** replace placeholder feel after interaction and reward timing are proven.

- Evaluate a final rider sprite atlas behind the existing renderer abstraction.
- Add race-specific effects and compact celebration frames rather than decorative illustration.
- Add a small sound vocabulary: confirm, race start, attack, incident, win, objective, camp gain.
- Add optional mobile haptics for rare events where browser support permits.
- Provide mute and reduced-motion controls.

Art and audio should amplify readable game state, not conceal it.

## 5. Dopamine Backlog

These ideas can be pulled into the priority slices above. Prefer improvements that celebrate real
simulation outcomes over disconnected daily rewards.

### Anticipation

- Upcoming-target countdown and rider peak warning.
- Rival “team to watch” and likely leader.
- Route-specialist preview and squad readiness grade.
- Sponsor stretch target for the current window.

### Mid-Race Reveal

- Stronger leg-read reveal for rare Flying/Off days.
- Rival weakness discovered through radio rather than pre-race spoilers.
- Clear attack commitment and catch-danger states.
- Named tactical patterns when the simulation produces them.

### Immediate Payoff

- Animated rank, points, budget, and objective deltas.
- Personal best, first win, streak, upset, or breakthrough callouts.
- Peak successfully converted into a result.
- Training gains with old value, new value, and named stat.

### Long-Term Attachment

- Career records and retired favorites.
- Emergent nemesis and rivalry history.
- Combo discovery collection.
- Team milestones and season recap.
- Youth prospect debut and first major result.

### Optional Later Experiments

- Short board reactions after exceptional success or failure.
- Newspaper-style season headlines generated from structured outcomes.
- One optional risk/reward decision between race windows, with a sensible default.
- More authored races or riders only when they create a new strategic target.

## 6. Phone Playtest and Tuning Questions

The headless harness establishes sane ranges, not fun. For each full-season phone playtest, record:

- Did the next race feel worth preparing for?
- Was the post-race reward sequence satisfying without becoming slow?
- Could the player explain why they gained or lost time?
- Did a planned peak produce a noticeable but fair advantage?
- Did fatigue create meaningful rotation rather than chores?
- Did the economy create choices without trapping the player?
- Did at least one prospect, veteran, or rival create a memorable story?
- Were any touch targets cramped, clipped, or too close to iPhone safe areas?
- Which screen caused the most unnecessary taps?

Primary tuning candidates remain in `src/data/tuning.ts`, especially Condition performance, peak
widths, fatigue/recovery, development pace, retirement, sponsor income, and prizes. Re-run tests and
`npm run sim` after tuning changes.

## 7. Success Signals

The next-iteration program is working when:

- A player can identify the next target and primary action within two seconds of opening the hub.
- Every completed event visibly changes at least one meaningful value or story.
- A player can name a current rival and a favorite rider after one season.
- A star fading and a prospect emerging feels like a transition, not silent stat churn.
- Sponsor progress, budget consequences, and rank movement are understood without opening lookup
  screens.
- A full season remains quick to navigate on an iPhone with no overlapping controls.
- Reward animations are skippable and never block repeated play.
- Rival enhancements remain deterministic and pass the balance harness.

## 8. Explicit Non-Goals

- No backend, accounts, multiplayer, live services, or mandatory daily rewards.
- No real rider, team, or race trademarks.
- No live in-race tactical control; the race remains a committed simulation and reveal.
- No facilities maze, equipment inventory, or broad city-builder layer.
- No complex rider personality system. Team-level strategic identity and emergent history are enough.
- No feature should require constant micromanagement; ignored systems need sensible defaults.
- No realism feature earns priority unless it creates a clearer choice, stronger story, or better
  payoff.

## 9. Recommended Delivery Order

Keep each slice independently playable and validated:

1. Finish the shared UI overhaul, starting with Stage Results and Pre-Race.
2. Build the post-race payoff sequence using existing data.
3. Add Rival Directors headless-first, then expose their intent in the UI.
4. Add emergent rivalry memory and the season-hub nemesis card.
5. Add combo discoveries and collection history.
6. Extend persistence and build the Hall of Fame.
7. Re-evaluate rival transfers, time trials, final art, audio, and haptics from playtest evidence.

Do not start all tracks at once. The next recommended implementation slice is **Stage Results UI +
post-race payoff**, because it improves the emotional return on every existing system without
changing simulation balance.
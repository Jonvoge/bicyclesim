# Dynasty Expansion - Handover and Build Plan

> This document is the source of truth for the next expansion after the completed core build.
> Read `CLAUDE.md`, `docs/HANDOVER.md`, `docs/NEXT-ITERATIONS.md`, and this document before changing
> the expansion scope. `NEXT-ITERATIONS.md` remains the broader UI/reward/product backlog; this plan
> takes precedence for the committed Dynasty work in sections 1-3.
> The existing `cycling-sim-SPEC.md` still governs implemented behavior until a phase below updates
> it. Where this plan deliberately changes old behavior, update the spec in the same PR.

## 1. Decision Summary

The expansion gives Dynasty mode a new identity:

> The player founds a lower-division cycling team, receives a balanced but variable generated
> squad, develops a project across several seasons, earns promotion, and then tries to survive and
> win in the top division.

The following work is **committed** and must be built, in order:

1. **Race balance foundation** - correct the known tactics, Conserve, narrative, stage-length, and
   Season Focus balance issues before adding a larger sporting world.
2. **Generated world foundation** - found a custom team; generate teams, riders, initial squad
   choices, free agents, and development uncertainty from a reproducible world seed.
3. **Competition structure** - separate lower and top divisions, distinct calendars, promotion and
   relegation, wildcards, world history, and AI teams that progress with the player.

The following work is **not committed**:

4. **Deeper management pressure** - staff, facilities, rider promises, richer negotiations, and a
   more elaborate economy. Do not implement this phase without a new user decision after sections
   1-3 have been played and measured.

Some minimum recruitment and financial behavior is still required by sections 2-3. In particular,
generated contracts, free agents, scouting uncertainty, division-scaled sponsors, and viable AI
rosters are foundations of the generated world. They are not authorization for a facilities tree or
management-heavy redesign.

## 2. Product Goals

### 2.1 Primary goals

- Every new Dynasty should begin with a meaningfully different team and competitive landscape.
- New starts must be fair without being identical. No seed should produce an unusable squad or an
  obvious first-season super-team.
- The player creates and names their own team rather than taking control of an existing team.
- The player starts in the lower division and normally needs multiple seasons to earn promotion.
- Promotion should open a new competitive tier, calendar, economy scale, and set of rival stories.
- Generated riders must support long careers, uncertain scouting, specialist squads, and turnover.
- The world must remain deterministic under its seed and healthy over at least 10 simulated seasons.
- Racing remains the center of the game. Management systems should support sporting decisions, not
  bury them.

### 2.2 Experience targets

A typical Dynasty should produce this arc:

```text
Found team
  -> choose an identity and one of several balanced squad proposals
  -> contest lower-division races and occasional wildcards
  -> improve roster quality without immediately finding an elite superstar
  -> challenge for a top-two promotion place over roughly 2-4 seasons
  -> enter the top division as an underdog
  -> stabilize, build reputation, and target major races
  -> eventually challenge for the top team ranking and biggest tours
```

Promotion is the end of the opening act, not the end of the Dynasty.

### 2.3 Explicit non-goals for sections 1-3

- No live tactical input during a race.
- No backend, accounts, online leagues, or server-generated worlds.
- No equipment inventory or granular bike-part system.
- No large staff or facility tree.
- No day-by-day training calendar.
- No detailed rider morale simulation.
- No transfer-auction minigame unless separately approved under section 4.
- No WorldTour branding or real trademarks; continue using proxy names.
- No requirement to convert Quick Race to generated data. Quick Race may retain the authored roster.

## 3. Current-State Anchors

The next agent should preserve these boundaries:

- `src/sim` is pure, deterministic, headless, and Phaser-free.
- `src/state/dynasty.ts` owns mutable roster, budget, season, development, and transitions.
- Static data in `src/data/riders.ts` and `src/data/teams.ts` currently seeds a Dynasty, but must no
  longer be the source of truth for a new generated Dynasty.
- Quick Race intentionally uses the static roster path and should not be broken by the migration.
- `src/state/dynastyStore.ts` serializes Maps manually and already has save migrations. The new world
  schema must use an explicit save version and migration.
- `src/sim/rng.ts` is the reproducibility primitive. Never use `Math.random()` in generation or
  headless world progression.
- Every balance constant belongs in `src/data/tuning.ts`.

The present model has these known issues, measured in July 2026:

- `Conserve` applies only `-2` performance to the leader but reduces the entire team's fatigue gain
  to `25%`.
- On flat stages, that penalty is usually erased by same-time grouping; `97.4%` of matched runs left
  the GC rider on the same time.
- Selectively conserving easy stages approximately doubled Pogar's tour win rate in all three
  current tours. Conserving every stage was nearly as strong as selective conservation.
- The narrative layer chooses favourites after tactical penalties. An overcommitted all-Free team
  can demote a star into the opportunist pool and create a strong morning-break exploit.
- Stage length affects clock time and future fatigue, but not current stage suitability.
- Season Focus plans have slightly unequal value on the actual discrete calendar, especially the
  boundary-truncated Autumn plan and the relatively generous Steady plan.
- Existing tests prove that Conserve lowers fatigue, but not that it creates a healthy strategic
  tradeoff.

These must be addressed before a larger generated world is balanced around them.

---

## 4. Committed Section 1 - Race Balance Foundation

### 4.1 Goal

Make pre-race choices legible, strategically valid, and resistant to obvious exploits. The expanded
Dynasty will simulate many more races; small model flaws will otherwise compound over seasons.

### 4.2 Conserve redesign

Replace the current leader-only cost and `0.25x` fatigue gain with a team-wide tradeoff.

Recommended starting model:

```text
Race:
  performance modifier: 0
  fatigue-gain multiplier: 1.00

Conserve:
  performance modifier: -1.5 to every rider on the team
  fatigue-gain multiplier: 0.60
  no committed-break survival bonus
  no supported late-attack guarantee or tactic bonus
```

All values remain tuning guesses. Begin with `0.60`, measure, and adjust inside a target band of
approximately `0.55-0.70`; do not jump directly to a new fixed truth.

Important behavior:

- A GC rider should usually retain bunch time on a flat stage while conserving. That is realistic.
- The team's sprinter and attackers must also lose some ability to contest the stage.
- Assigning a sacrificial rider as Leader must not allow the true contender to conserve for free.
- Conserve should communicate "do not contest this stage aggressively," not merely "penalize one
  rider."
- Rival teams need a simple deterministic effort policy before division results are trusted.

Suggested API change in `src/sim/tactics.ts`:

- Separate `roleEffect(...)` from `effortEffect(...)`.
- Apply effort performance to every team rider.
- Keep role-specific fatigue multipliers, then multiply them by team effort.
- Expose an effort capability used by `raceNarrative.ts` to suppress committed moves.

### 4.3 Favourite and break eligibility

The "favourite" classification must not be based on the final post-tactics performance score.

Recommended approach:

- Compute a pre-race reputation score from terrain suitability, condition, and incoming fatigue.
- Exclude the day's random form draw and tactical penalties from morning-break eligibility.
- Select favourites from that score before applying role effects.
- A committed favourite on Free/Attack remains a late attacker.
- Overcrowding penalties may hurt performance, but must never turn an established favourite into a
  breakaway opportunist.
- Keep `BREAK_MAX_PER_TEAM`; also ensure committed selection order is seed-driven or score-driven,
  not dependent on object insertion order.

Avoid adding a durable global "star" label solely for this fix. Eligibility should remain contextual
to terrain and current form plan.

### 4.4 Free/Attack balance

Preserve the good risk/reward shape of a focused attack:

- A focused attack may have a higher win ceiling than a backed leader.
- It should have a worse average finish when the attack fails.
- Sending an entire squad Free must be materially worse than a focused one- or two-rider move.
- A crowded team must not get multiple guaranteed commitments or bypass the crowd penalty through
  morning-break selection.

Add tests around full `buildRaceStory`, not only `tacticsEffect`, because the exploit occurs between
the score and narrative layers.

### 4.5 Stage length

Give stage length a modest current-stage effect without creating a new stat.

Recommended implementation:

- Derive a normalized length difficulty around `FATIGUE_REF_KM`.
- Increase the contribution of `endurance` on long stages and reduce it on short stages.
- Renormalize the other terrain weights so the total remains 1.
- Keep the adjustment bounded. Terrain identity must remain stronger than length.
- Continue using length for winner clock and fatigue gain.

Example design target:

- A 270 km hilly classic should favor durable puncheurs over explosive but low-endurance riders.
- A 170 km hilly stage should preserve more chances for explosive riders.
- The same rider should not gain or lose more than a few performance points from length alone.

Do not hardcode length variants into every stage. Use one pure helper and tuning constants.

### 4.6 Season Focus normalization

Normalize plans against the actual season calendar rather than only nominal Gaussian hump area.

- Compare average condition/performance over all event indices.
- Correct edge truncation for Autumn, either by wrapping/reflecting the curve or calibrating height.
- Bring all plans within a narrow calendar-wide performance budget.
- Preserve their distinct variance: single peak high/narrow, two peaks lower, Steady shallow.
- Re-run normalization when division calendars differ. A plan must be evaluated against the calendar
  on which the rider actually competes.

Recommended balance invariant: average score modifier across a complete eligible calendar differs by
no more than `0.15` between plans unless a deliberate tradeoff is documented.

### 4.7 Stamina and consistency

Do not tune these before Conserve and length are corrected.

Afterward:

- Measure whether stamina meaningfully changes late-tour outcomes among otherwise similar riders.
- Measure whether consistency creates a visible difference in podium probability, not just sigma.
- Adjust only if the effect remains dominated by unrelated factors.
- Avoid strengthening stamina so far that it becomes another universal GC stat.

### 4.8 Player feedback

The mechanic needs visible causality as well as mathematical effect.

Pre-race should show, for each effort:

- Expected team fatigue gain, ideally as a range or relative label.
- A concise consequence: `Race: contest today / higher fatigue` and `Conserve: reduced stage
  ambition / lower fatigue`.
- Whether committed attacks are available.

Stage results should show:

- Fatigue gained by the player's starters.
- Fatigue saved by conserving, relative to Race under the same stage conditions.
- Current fatigue going into the next stage.

Do not expose exact hidden random form or future results.

### 4.9 Required tests and metrics

Add behavior tests for:

- Conserve penalizes every team rider's current-stage performance.
- Conserve lowers every team rider's fatigue gain.
- A sacrificial Leader cannot shield the real contender from effort cost.
- Conserve suppresses committed break/late-attack bonuses.
- Established favourites do not enter the morning break because tactical penalties lowered them.
- All-Free is materially worse than a focused attack across matched seeds.
- Long stages shift results toward endurance without changing terrain identity.
- Focus plans have equivalent calendar-wide performance budgets.

Add matched-seed balance guards for each real tour:

- Selective conservation should beat Race-all by a modest amount.
- Conserve-all must be worse than selective conservation.
- Conserve-all must not approximately double a strong rider's GC win probability.
- The result should hold across more than one rider archetype and more than one tour layout.

Suggested initial target, to be earned by simulation:

- Selective conservation improves a suitable GC rider's tour win chance by roughly 5-15 percentage
  points, not 30-45.
- Conserve-all is at least 3 percentage points worse than selective conservation.
- A focused attack has clearly higher upside than all-Free and a clearly worse average result than a
  backed leader.

### 4.10 Section 1 acceptance

- All existing tests pass, with new strategic outcome tests added.
- `npm run sim` prints the new Conserve and attack counterfactuals.
- No known sacrificial-Leader or all-Free exploit remains.
- Length differentiates stages of the same terrain in a measured way.
- Focus plan budgets are normalized for the current calendar.
- The UI explains and reports effort consequences.
- The spec and handover describe the new model.

---

## 5. Committed Section 2 - Generated World Foundation

### 5.1 Goal

Replace the fixed Dynasty opening with a reproducible generated cycling world while preserving the
authored roster for Quick Race and migration support.

### 5.2 Found-a-team flow

Replace Dynasty `TeamSelectScene` with a founding flow. The first version should collect:

1. Team name.
2. Three-letter abbreviation, validated and defaulted from the name.
3. Home country or region.
4. Primary and accent jersey colors, with contrast validation.
5. Team philosophy.
6. Optional visible/shareable world seed.
7. Choice of one of three generated squad proposals.

Recommended philosophies:

- **Mountain Project** - stronger climbing coverage, weaker sprint depth.
- **Classics Collective** - puncheurs, rouleurs, and aggressive options.
- **Sprint Train** - a sprinter plus lead-out depth, limited GC quality.
- **Development Team** - younger and less proven, with broader uncertain upside.
- **Balanced** - fewer holes but no exceptional specialty.

A philosophy changes composition, age, and uncertainty distributions. It must not grant a higher
total strength budget.

### 5.3 Why three squad proposals

Pure assignment risks an unappealing start and encourages repeatedly deleting saves until a favorable
seed appears. Three constrained proposals preserve discovery while giving the player meaningful
ownership.

All three proposals must:

- Be generated from the same world and philosophy budget.
- Have similar total current strength and wage cost.
- Differ in archetype mix, age, consistency, and development uncertainty.
- Consume their riders from the generated candidate pool so the unchosen riders remain available to
  AI teams or free agency according to deterministic rules.

If later playtesting shows the proposal choice is too gamey, the UI can offer a `Surprise me` path.
Do not add unrestricted rerolling in the first implementation.

### 5.4 Target world size

Starting target, subject to performance measurement:

- 10 top-division teams.
- 12 lower-division teams including the player.
- 8 contracted riders per team at world creation.
- 30-40 unsigned riders.
- 10-15 new prospects per offseason across the whole world.

This creates approximately 205-230 active riders at launch. Race fields should contain selected
squads from eligible teams, not the entire contracted roster.

World-size constants belong in `tuning.ts`. Verify browser/save performance before increasing them.

### 5.5 Target data model

Add durable IDs and world ownership rather than expanding static arrays.

Suggested model:

```ts
type DivisionId = 'world' | 'pro';

interface TeamIdentity {
  id: string;
  name: string;
  shortName: string;
  country: string;
  primaryColor: number;
  accentColor: number;
  philosophy: TeamPhilosophy;
  foundedSeason: number;
  isPlayer: boolean;
}

interface TeamSeasonState {
  division: DivisionId;
  rankingPoints: number;
  reputation: number;
  budget: number;
  lastRank?: number;
}

interface WorldHistory {
  seasons: SeasonHistory[];
  raceWinners: RaceWinnerRecord[];
  promotions: PromotionRecord[];
  teamChampions: TeamChampionRecord[];
}

interface WorldState {
  schemaVersion: number;
  seed: number;
  rngState?: number;
  teams: TeamIdentity[];
  teamSeasons: Record<string, TeamSeasonState>;
  history: WorldHistory;
}
```

`DynastyState` should contain `world`, `playerTeamId`, the live roster, the current season, and any
in-progress event. Avoid duplicating team budget/rank in both top-level fields and `WorldState`; pick
one durable source and migrate accessors.

Do not store `riderIds` inside generated `TeamIdentity`. Team membership remains `Rider.teamId` in
the live roster, with accessors such as `teamRiders(...)`.

### 5.6 Proposed module ownership

Keep generation pure and testable:

```text
src/data/
  countries.ts             finite country/region registry
  teamNames.ts             proxy naming fragments and palettes
  worldTemplates.ts        philosophies, archetype distributions, division defaults

src/sim/
  riderGeneration.ts       generated rider archetypes, stats, age, hidden development
  teamGeneration.ts        identities and balanced squad construction
  worldGeneration.ts       complete deterministic world assembly
  worldBalance.ts          pure constraints/diagnostics used by tests and reports

src/state/
  dynasty.ts               state transitions and accessors over generated world
  dynastyStore.ts          schema versioning, packing, migration

src/scenes/
  TeamFoundingScene.ts     identity, philosophy, seed
  SquadProposalScene.ts    compare and accept one of three starting squads
```

Names are suggestions, not mandatory. Preserve the pure-sim/state/UI split.

### 5.7 Rider generation

Generate coherent riders from archetypes rather than independently rolling each stat.

Each rider should derive from:

```text
archetype profile
  + current talent tier
  + age and career phase
  + bounded individual strengths/weaknesses
  + stamina/consistency profile
  + hidden peak age, per-stat ceilings, and development rate
```

Initial archetypes should map to the existing stage model:

- GC climber
- Pure climber
- Puncheur
- Cobbles/rouleur specialist
- Sprinter
- Lead-out rider
- Breakaway all-rounder
- Domestique
- Developing prospect variants of the above

Generation constraints:

- Stats remain bounded and specialist-shaped.
- Offensive strength correlates with salary and division, but overlap remains possible.
- Top-division distributions are stronger, not uniformly boosted copies.
- Lower-division stars may be competitive in a specialty without being complete riders.
- Age affects current ability relative to hidden ceiling.
- `consistency` and `stamina` are generated intentionally, not as filler random numbers.
- IDs are stable and derived from world seed plus generation sequence, never display names.

### 5.8 Initial player squad construction

Use a constrained squad solver or rejection sampler. Do not simply take eight random riders.

Every starting proposal should contain:

- One credible leader in at least one terrain family.
- One secondary leader or uncertain development rider.
- One stage-winning specialist.
- Two or more support/rouleur riders.
- Enough terrain coverage to enter the lower calendar without a dead season.
- At least one rider under 24 and one experienced rider.
- No more than two riders above the configured starter-quality threshold.
- Total rating, age distribution, wage bill, and potential uncertainty inside configured bands.

Recommended initial balance targets, to calibrate rather than blindly encode:

- No proven elite rider with top-division superstar overall rating.
- One or two riders capable of winning suitable lower-division races.
- A squad capable of contending for promotion under good play, but not favored to dominate year one.
- Development philosophy squads trade current strength for uncertainty; they do not receive higher
  known potential for free.

The generator should return diagnostics explaining which constraints failed. Tests over thousands of
seeds should never silently accept an invalid squad.

### 5.9 Team generation

AI teams need more than names and colors. Give each a stable sporting identity used by selection and
tactics:

- GC-focused
- Sprint-focused
- Classics-focused
- Development-focused
- Opportunist/breakaway-focused
- Balanced

Identity should affect:

- Initial roster composition.
- Race squad selection.
- Default roles and effort policy.
- Which races the team is strongest in.
- Offseason roster needs.

Do not create bespoke AI logic per named team. Drive it from the same philosophy registry used by
generation.

### 5.10 Scouting and progression safeguards

Sections 2-3 require a minimum scouting model, but not the full optional management phase.

Required behavior:

- Existing elite riders begin contracted to top-division teams.
- First-season free agents contain useful lower-division riders, veterans, specialists, and uncertain
  prospects, but almost no proven top-division stars.
- Young potential remains a range/estimate. A first-season scout cannot reliably distinguish a
  future superstar from every merely good prospect.
- Scouting accuracy improves with age and repeated observation, not because later seasons generate
  inherently better players for the user.
- Generated prospects need several seasons to approach elite ability.
- Rival teams progress and recruit enough to prevent the player from monopolizing every useful rider.

Recommended minimum report levels:

1. Archetype and broad current-ability range.
2. Better current-stat estimates.
3. Consistency/stamina confidence.
4. Development range and likely career phase.

For sections 2-3, these levels may advance automatically with age and repeated race exposure. Paid
regional scouting assignments, scout staff, and detailed report timers belong to optional section 4.

### 5.11 Generated content and legal constraints

- Continue using proxy names.
- Add enough country-aware first/surname fragments to avoid frequent duplicate full names.
- Duplicate display names are permissible if IDs differ, but the UI should disambiguate by age/team.
- Generate team names from curated proxy fragments and validate uniqueness.
- Check jersey color distance so teams in the same division remain distinguishable.
- The player's chosen identity is exempt from generated naming but still needs color/abbreviation
  validation.

### 5.12 Save schema and migration

Introduce an explicit save schema version before generated worlds ship.

Recommended migration policy:

- **New saves:** use the generated-world schema and always start the player in the lower division.
- **Existing saves:** preserve roster, budget, season, and player team. Deterministically generate the
  missing teams/world around them using a migration seed and place the legacy player team in the top
  division as an incumbent.
- Mark migrated saves so the operation is idempotent.
- Never regenerate a world on load from current tuning constants alone. Persist generated identities,
  riders, divisions, and history so future tuning changes do not rewrite an existing save.
- Save the seed for sharing/debugging, but treat the persisted world as authoritative after creation.
- Preserve all three current save slots and legacy key migration.

If migration becomes too risky, retain a read-only legacy mode and require a new save for the new
competition structure. Do not silently delete or reinterpret a save.

### 5.13 Section 2 tests

Required deterministic/property tests:

- Same seed and philosophy produce byte-equivalent world identities and squad proposals.
- Different seeds change riders, teams, and proposals while respecting all constraints.
- Team IDs, rider IDs, names within required scopes, and abbreviations are valid.
- Every rider belongs to zero or one team.
- Every AI and player squad is within roster-size, rating, age, wage, and composition bounds.
- Each lower-division squad has at least one viable competitive route.
- No player proposal contains a proven elite superstar.
- First-season scouting never reports exact hidden ceilings for young riders.
- Generated jersey palettes satisfy minimum contrast and inter-team distance.
- Generated world plus current season round-trips through storage without data loss.
- Existing save fixtures migrate once and retain their roster/results.

Add a generator report command that samples at least 1,000 world seeds and prints rejection rate,
rating distributions, age distributions, salary distributions, and invalid-world count.

### 5.14 Section 2 acceptance

- New Dynasty opens the founding flow, not the existing-team selector.
- Team identity and world seed persist and render everywhere the team is named/colored.
- Three fair, distinct squad proposals are generated and selectable.
- The accepted squad and all AI teams come from one deterministic generated world.
- The world includes enough riders and teams for both divisions and free agency.
- Initial scouting is uncertain and cannot reliably reveal a future superstar.
- Existing saves have a tested migration or an explicit supported legacy path.
- Quick Race still works with the authored roster.
- Build, unit tests, save tests, and generator health report pass.

---

## 6. Committed Section 3 - Competition Structure

### 6.1 Goal

Create a living two-tier sport in which the player's first long-term objective is promotion and the
world continues changing after that objective is achieved.

### 6.2 Divisions

Use two game-facing divisions with proxy names:

- **World Tour** - the top division.
- **Pro Tour** - the lower division where a founded player team begins.

Internal IDs should remain stable (`world`, `pro`) even if display names later change.

At each season rollover:

- Top two Pro Tour teams are promoted.
- Bottom two World Tour teams are relegated.
- Ties use deterministic sporting tiebreakers: wins, then best prestigious result, then seeded final
  tiebreak only if still tied.
- Promotion/relegation is recorded in world history before standings reset.
- The next season calendar and sponsor scale use the new division.

The same rules apply to AI and player teams. Do not protect the player from relegation after reaching
the top division.

### 6.3 Ranking model

Keep promotion understandable:

- Use division team points earned from eligible calendar races.
- Show current rank, points to second place, and the promotion/relegation line prominently.
- Wildcard results may award prestige and money, but should award either reduced promotion points or
  no division points. Decide explicitly during implementation and document it.
- Avoid a hidden reputation calculation deciding promotion.

Recommended first implementation: only the division calendar awards division points; wildcard races
award normal rider prestige/prize but no Pro Tour promotion points.

### 6.4 Separate calendars

Build distinct calendars rather than weaker copies with renamed entrants.

Pro Tour calendar target:

- 12-15 events.
- Regional one-day races.
- Several 3-5 stage tours.
- At least one meaningful target for each team philosophy.
- One or two prestigious lower-division anchor events.
- A small number of possible World Tour wildcards.

World Tour calendar target:

- Approximately the current 17-event shape, expanded only when content supports it.
- Major classics, short tours, and grand tours.
- Terrain distribution compatible with Season Focus plans.
- Relegation battle remains meaningful for weaker teams.

Each race needs eligibility metadata rather than relying on array membership:

```ts
interface RaceEligibility {
  division: DivisionId;
  wildcardSlots?: number;
  divisionPointsScale: number;
}
```

Authored stages/races may remain data-driven. The world, teams, entries, and annual results are
generated/stateful; route generation is not required for this expansion.

### 6.5 Race entry and fields

Do not race every team in every event.

- Each event has a configured team-field size.
- Division teams receive standard eligibility.
- Wildcards fill limited slots using a deterministic policy.
- Each entered team selects exactly `RACE_SQUAD_SIZE` riders using current suitability, fatigue,
  goals, and philosophy.
- Free agents and teams from unrelated divisions do not appear unless invited.
- A stage-race squad remains locked after the event starts, as today.

Field size is a performance and balance lever. Add it to tuning/data and test that all scenes handle
larger fields without assuming the present eight-team peloton.

### 6.6 Wildcards and reputation

Reputation is committed only as a lightweight sporting value supporting invitations and milestones.
It is not a second promotion ranking.

Wildcard eligibility may consider:

- Current Pro Tour rank.
- Recent event wins.
- Host-country connection.
- Team philosophy fit with the race.
- Existing reputation.

Requirements:

- At least occasional top-division exposure before promotion.
- No first-season guarantee of a major wildcard.
- Invitations are explained in the UI.
- Strong results increase later invitation chances modestly.
- Wildcards do not become the optimal route to promotion points.

### 6.7 AI sporting behavior

AI teams must participate in the same sporting world sufficiently to preserve competition.

Committed minimum:

- Philosophy-aware squad selection.
- Terrain-aware role sheets.
- Deterministic Race/Conserve effort policy in tours.
- Fatigue-aware race participation and rider selection.
- Basic offseason roster maintenance using generated needs.
- Aging, development, retirement, and prospect intake for all teams.
- Promotion and relegation without player special cases.

Complex bidding, promises, and negotiation personalities remain optional section 4.

### 6.8 Progression pace

Progression needs explicit simulation targets.

Initial targets for competent but automated player policies:

- Median first promotion: seasons 2-4.
- First-season promotion: possible but uncommon, approximately 10-20% under a strong seed/policy.
- Failure to promote for five seasons: possible but not the median experience.
- Newly promoted team avoids immediate relegation often enough to feel viable, roughly 35-55% before
  player optimization.
- A promoted roster should not immediately be a World Tour title favorite.
- Building a reliable top-division contender should take additional seasons.

These are calibration targets, not promises. Report actual distributions from thousands of headless
Dynasties before changing the values.

### 6.9 Division economy baseline

Sections 2-3 need only enough economy to keep divisions coherent:

- Pro Tour sponsors and prizes are smaller.
- World Tour promotion increases sponsor income and expected wage pressure.
- A newly promoted team receives a modest one-season support payment or sponsor uplift.
- A relegated team receives at most one season of limited parachute support.
- Minimum income must allow a legal lower-division roster.
- Division changes must not create instant bankruptcy or infinite cash.

Do not add staff, facilities, or detailed operating expenses here. Instrument cash flow and defer the
larger money redesign to the section 4 decision.

### 6.10 World history and milestones

Persist enough history for generated worlds to become memorable:

- Division champions by season.
- Promoted and relegated teams.
- Race and tour winners.
- Rider and team season champions.
- Player milestones: first win, first wildcard, first promotion, first World Tour win, first major
  win, first homegrown winner, first top-division championship.

This can initially be read-only text/list UI. Do not build a trophy-room metagame before the history
data is proven useful.

### 6.11 Season Focus across calendars

Plans must target the team's eligible calendar:

- Use division-specific event indices and calendar length.
- Display target windows against the actual current-season calendar.
- Recalculate plan condition only at event start, as today.
- Promotion changes next season's calendar and therefore next season's focus curve.
- Normalize plan budgets independently for both calendars.

### 6.12 UI changes

Season Hub must become division-aware:

- Division name and current team rank.
- Promotion/relegation line.
- Points gap to the relevant line.
- Current calendar with wildcard markers.
- Next race eligibility and field.
- End-of-season promotion/relegation summary.

Additional views:

- Division standings toggle or tabs.
- Team directory for both divisions.
- World history including movement between divisions.
- Rollover scene that clearly presents promoted/relegated teams before the new season starts.

Keep operational screens compact and scan-friendly. Do not turn the Season Hub into a marketing-style
dashboard or card wall.

### 6.13 Competition tests and reports

Required tests:

- Correct top-two/bottom-two movement, including deterministic ties.
- Player starts in Pro Tour on every new generated Dynasty.
- Existing migrated top-division saves remain valid.
- Division calendars contain valid races and balanced terrain coverage.
- Only eligible/invited teams enter each event.
- Squad sizes and locked stage-race starters remain valid with larger team pools.
- Wildcard selection is deterministic and explained by stored reason data.
- Season Focus budget remains normalized in each calendar.
- World history records champions and movement once, including save/load during rollover.

Extend `scripts/balanceReport.ts` or add a dedicated world report:

- Run at least 1,000 generated Dynasties for 10 seasons.
- Report promotion timing distribution.
- Report newly promoted survival rate.
- Report repeat champions and competitive turnover.
- Report division rating distributions by season.
- Report rider quality, retirement, and prospect replacement.
- Report team budget distribution and insolvency count.
- Report save size and world generation time.

No tuning pass is complete while invalid rosters, bankrupt AI teams, collapsing rider quality, or
near-certain first-season promotion remain hidden in averages.

### 6.14 Section 3 acceptance

- New player teams always begin in the Pro Tour.
- Both divisions contain generated teams and valid rosters.
- Each division has a distinct, complete calendar.
- Events contain eligible fields and deterministic wildcards.
- Top two promote and bottom two relegate at rollover for player and AI alike.
- Promotion changes the following season's opponents, calendar, sponsor scale, and UI context.
- AI teams use basic effort, squad, development, and roster-maintenance policies.
- World history and key milestones persist.
- Ten-season health simulations meet agreed progression and viability bands.
- Build, tests, save round-trip, migration fixtures, and browser flow pass.

---

## 7. Optional Section 4 - Management Pressure Decision Gate

### 7.1 Status

**Deferred. Do not implement as part of sections 1-3.**

The user is not yet convinced that a deeper management layer will improve the game. The generated
world and divisions should first reveal whether money remains meaningless once promotion, stronger
competition, division income, generated contracts, and larger roster turnover exist.

### 7.2 What to measure first

After sections 1-3, gather from simulation and playtests:

- Cash at each season start and end by division/rank.
- Percentage of available cash spent on signings and renewals.
- Number of seasons in which the player can afford every desired target.
- Number of meaningful roster choices blocked by money.
- AI insolvency or forced-stopgap frequency.
- Whether promotion creates a real wage-quality squeeze.
- Whether players understand what they are saving money for.

The decision should be based on those results, not on the current small fixed-world economy.

### 7.3 Option 4A - Lean economy, recommended first experiment

If money still lacks value, first deepen existing systems rather than adding facilities:

- Contracts genuinely expire.
- Renewal wages respond to performance, division, age, and role.
- Signing bonuses and promotion wage clauses.
- Limited competing interest from AI teams.
- Small scouting/report costs.
- Squad minimum and wage commitments remain enforceable.
- Sponsor objectives offer risk/reward rather than passive income.

This creates recurring uses for money while keeping the game focused on riders and races.

### 7.4 Option 4B - Compact staff layer

Only if 4A is insufficient, consider a few mutually exclusive or slot-limited hires:

- Coach - development profile.
- Scout - report reach/certainty.
- Performance specialist - recovery profile.
- Commercial manager - sponsor profile.

Each should have salary/upkeep and a qualitative tradeoff. Avoid stacking universal percentage
bonuses or creating an obvious best staff ladder.

### 7.5 Option 4C - Facilities, least preferred

Facilities are the highest-risk option because they add compounding bonuses and menu overhead.

If ever approved:

- Use at most 3-4 facility tracks.
- Cap levels tightly.
- Favor new capabilities or specialization over raw performance bonuses.
- Include upkeep so construction is not a one-time solved purchase.
- Ensure a player can compete without maximizing every track.

### 7.6 Other deferred systems

The following ideas remain optional and should be evaluated independently:

- Rider role promises and lightweight happiness.
- Detailed transfer bidding or auctions.
- Regional scouting assignments and report timers.
- Difficulty settings beyond seed/start parameters.
- Injuries longer than a stage incident.
- Sponsor negotiation.
- Overlapping race schedules that require split squads.

Do not bundle all of these into one "management phase."

---

## 8. Cross-Cutting Engineering Requirements

### 8.1 Determinism

- World creation consumes a dedicated seeded RNG stream.
- Race RNG, offseason generation, transfers, and tiebreaks should use separate derived streams so a
  UI-only change or added generated name does not alter race outcomes.
- Persist enough RNG/world state to continue deterministically after save/load.
- Never derive durable identity from array index alone after creation.

Recommended seed derivation:

```text
worldSeed
  -> identitySeed
  -> rosterSeed
  -> scheduleSeed
  -> season N developmentSeed
  -> event N raceSeed
```

Use a stable hash/seed-derivation helper rather than consuming one global sequence for everything.

### 8.2 Performance

- Keep race simulation scoped to entered fields.
- Cache derived maps such as rider/team lookup only within operations; do not persist redundant maps.
- Measure generation time and serialized save size on representative mobile hardware/browser.
- Continue using localStorage unless the generated save approaches practical limits. If it does,
  evaluate compression or IndexedDB as a separate migration.

### 8.3 Data validation

Add a pure `validateWorld(...)` returning structured errors. Run it:

- In generation property tests.
- In development builds after world creation and season rollover.
- In save migration tests.
- In headless health reports.

Validation should include IDs, team membership, legal divisions, roster bounds, race references,
calendar eligibility, budget finiteness, development bounds, and history consistency.

### 8.4 Backward compatibility

- Quick Race remains authored/static unless separately migrated.
- Scene code must use dynasty accessors rather than `TEAMS`, `RIDERS`, or `PLAYER_TEAM` whenever a
  `DynastyState` is present.
- Replace static `teamColor(...)` and team-name lookups with world-aware accessors on the Dynasty
  path.
- Search for static imports before each generated-world UI PR; this is a known migration hazard.

### 8.5 Accessibility and mobile UI

- Founding controls must fit the existing phone-first viewport.
- Color choice cannot rely on color alone; show swatches and labels/hex only where useful.
- Validate jersey contrast against road/background and between primary/accent.
- Long generated names must truncate or wrap without moving fixed controls.
- Large team/rider lists must use the existing scroll infrastructure without stacking listeners.

---

## 9. Delivery Plan and PR Boundaries

Build headless behavior before UI in every phase. Each PR should be reviewable and leave the game in a
working state.

Before starting PR 1A, finish or deliberately checkpoint any in-progress UI-overhaul work tracked in
`NEXT-ITERATIONS.md`; do not discard concurrent user changes. UI/reward backlog items that are not
already in progress do not block the committed expansion unless the user explicitly reprioritizes
them.

### PR 1A - Race effort and narrative correctness

- Team-wide Conserve cost and moderated fatigue benefit.
- Narrative capability suppression while conserving.
- Pre-tactics favourite classification.
- All-Free/focused-attack exploit tests.
- Matched-seed tour report.

### PR 1B - Stage length, Focus normalization, and feedback

- Length-sensitive endurance helper.
- Calendar-aware Focus normalization.
- Reassess stamina/consistency only after reports.
- Pre-race and results fatigue feedback.
- Spec/handover updates.

**Section 1 playtest gate:** do not begin generated-world tuning until the race choices feel and
measure correctly.

### PR 2A - Save schema and pure world generators

- Explicit save schema version.
- Team/rider/world model.
- Seed derivation.
- Rider, team, proposal, and world generators.
- `validateWorld` and 1,000-seed report.
- No UI dependency.

### PR 2B - Founding flow and Dynasty integration

- Team identity/philosophy/seed UI.
- Three squad proposals.
- Create generated Dynasty from accepted proposal.
- World-aware name/color/roster accessors.
- Preserve Quick Race static path.

### PR 2C - Persistence and legacy migration

- Generated world pack/unpack.
- Existing save fixture migration or explicit legacy mode.
- Slot metadata updated with team name/division.
- Save/load browser verification.

**Section 2 playtest gate:** start several seeds and confirm proposals feel different, fair, and
interesting before building promotion around their power distributions.

### PR 3A - Division model and calendars

- Division eligibility and team standings.
- Pro Tour race/stage content.
- Field construction and team entry.
- Calendar-aware Season Focus.
- Headless season simulation.

### PR 3B - Promotion, relegation, wildcards, and history

- Rollover movement and tiebreaks.
- Lightweight reputation and wildcard policy.
- Division economy baseline.
- History/milestone persistence.
- AI effort policy.

### PR 3C - Division UI and long-run balance

- Season Hub, standings, directory, history, and rollover presentation.
- Promotion/relegation lines and wildcard explanations.
- 1,000 Dynasty x 10 season health report.
- Tune progression, roster quality, and baseline finances.
- Full mobile browser flow.

**Section 3 product gate:** play through at least one promotion and one top-division season before
deciding whether optional section 4 is needed.

### Optional PR 4+

No tasks should be opened until the section 4 decision gate records:

- The observed money problem after sections 1-3.
- The smallest approved intervention.
- New acceptance criteria.
- Which deferred systems remain explicitly out of scope.

---

## 10. Definition of Done for the Expansion

Sections 1-3 are complete only when:

- Race tactics no longer contain the known Conserve or all-Free exploits.
- A player can found and persist a named, colored team in a seeded generated world.
- Initial squad proposals are variable, fair, specialist-shaped, and free of proven superstars.
- The generated rider/team/free-agent pool remains healthy across long simulations.
- Scouting potential is uncertain enough that first-season superstar identification is unreliable.
- The player begins in the lower division against a distinct set of teams and races.
- Promotion and relegation apply equally to player and AI teams.
- Promotion normally takes multiple seasons and materially changes the next season.
- Newly promoted teams can survive but do not immediately dominate.
- World history preserves the generated sport's important stories.
- Existing saves are migrated or explicitly supported in legacy mode.
- Quick Race remains functional.
- `npm test`, `npm run build`, generation reports, long-run balance reports, and phone-sized browser
  verification all pass.
- The spec, build plan, README status, and handover are updated to describe the shipped expansion.

Section 4 is not part of this definition of done.

## 11. Open Decisions to Resolve During Implementation

These are bounded decisions, not permission to reopen the overall direction:

1. Final display names for the two divisions.
2. Whether World Tour wildcard results award reduced or zero Pro Tour promotion points. Current
   recommendation: zero promotion points, normal prize/prestige.
3. Exact number of teams, roster size, and free agents after mobile performance measurement.
4. Whether old saves migrate into a generated top-division world or remain in explicit legacy mode.
5. Whether the player may select `Surprise me` instead of comparing squad proposals.
6. Exact progression target bands after the first 1,000-Dynasty report.
7. Whether race calendars are fully fixed data or allow a small seeded annual rotation after the
   first stable implementation.
8. Whether minimal scouting reports advance through race exposure alone or also through one simple
   player-selected observation target.

Do not resolve these by adding unrelated systems. Record each decision in this document and the spec
when its owning PR begins.
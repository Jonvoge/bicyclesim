# bicyclesim

A Kairosoft-style cycling **team-manager** game — run a pro cycling team across a
multi-season dynasty: set tactics before a stage, then watch it simulate. Built as a
Phaser 3 web app, installable to an iPhone home screen as a PWA.

See [`docs/cycling-sim-BUILD-PLAN.md`](docs/cycling-sim-BUILD-PLAN.md) for the phased
worklist and [`docs/cycling-sim-SPEC.md`](docs/cycling-sim-SPEC.md) for the design/technical
reference. The generated-world and two-division expansion is documented in
[`docs/cycling-sim-DYNASTY-EXPANSION-PLAN.md`](docs/cycling-sim-DYNASTY-EXPANSION-PLAN.md).

## Tech stack

Phaser 3 · TypeScript · Vite · vite-plugin-pwa. No backend, no accounts, no network calls —
everything is client-side (localStorage).

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production build
npm run preview  # serve the production build locally
npm test         # headless simulation and state tests
npm run world-report       # validate 1,000 generated worlds
npm run competition-report # simulate 1,000 ten-season Dynasties
```

## Status

**Core phases 0-8 and Dynasty expansion sections 1-3 are implemented.** A new Dynasty lets the
player found a team, choose one of three generated squads, start in the Pro Tour, pursue
strength-aware sponsor goals, earn World Tour wildcards, and fight promotion/relegation across
distinct calendars. Rival Directors target races, every unplayed event is simulated, and world
history persists champions, winners, and division movement. Quick Race and authored legacy saves
remain supported.

Generated Pro riders are deliberately below World level, names use archetype-weighted national
cycling caricatures with reuse limits, and annual prospects use the same identity system. The
latest 1,000-world report found zero invalid worlds; the 1,000-by-10-season competition report put
first-season promotion at 13.4%, median promotion in season 3, and promoted-team survival at 38.2%.

The remaining gate is hands-on play through at least one promotion and one World Tour season before
deciding whether any optional management expansion is justified.

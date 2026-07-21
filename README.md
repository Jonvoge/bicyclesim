# bicyclesim

A Kairosoft-style cycling **team-manager** game — run a pro cycling team across a
multi-season dynasty: set tactics before a stage, then watch it simulate. Built as a
Phaser 3 web app, installable to an iPhone home screen as a PWA.

See [`docs/cycling-sim-BUILD-PLAN.md`](docs/cycling-sim-BUILD-PLAN.md) for the phased
worklist and [`docs/cycling-sim-SPEC.md`](docs/cycling-sim-SPEC.md) for the design/technical
reference. Agent working notes live in [`CLAUDE.md`](CLAUDE.md).

## Tech stack

Phaser 3 · TypeScript · Vite · vite-plugin-pwa. No backend, no accounts, no network calls —
everything is client-side (localStorage).

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production build
npm run preview  # serve the production build locally
npm test         # sim harness / unit tests (added in Phase 1)
```

## Status

**Phase 0 — Scaffold.** An empty, running Phaser app: `BootScene` → `MainMenuScene` with a
single button, PWA manifest + service worker configured for full-screen home-screen install.
No game logic yet — that begins with the headless simulation core in Phase 1.

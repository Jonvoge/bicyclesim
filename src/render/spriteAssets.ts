import type Phaser from 'phaser';

/**
 * Sprite-path assets (Phase 7, SPEC §8). The "sprite" renderer loads rider art as
 * a **texture** rather than drawing it with `Graphics`. To keep the experiment
 * self-contained (and CSP-safe — no external files) the art is authored as inline
 * **SVG** and loaded from data URIs. Three aligned textures form one rider: a fixed
 * body/bike layer, a primary-colour jersey/helmet layer, and an accent-colour layer
 * for the frame and kit trim. The silhouette is deliberately bold enough to survive
 * the 30px race-view size while retaining detail in the renderer comparison.
 *
 * Faces right (direction of travel); authored on a 48×36 canvas, rasterised at 2×.
 */

export const TEX_BASE = 'cyclist-base';
export const TEX_JERSEY = 'cyclist-jersey';
export const TEX_ACCENT = 'cyclist-accent';

const BASE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <ellipse cx="24" cy="33" rx="21" ry="2" fill="#080b10" opacity=".28"/>
  <g fill="none" stroke="#0b0f14" stroke-width="2.6">
    <circle cx="11" cy="26" r="7.2"/><circle cx="37" cy="26" r="7.2"/>
  </g>
  <g fill="none" stroke="#667382" stroke-width="1" opacity=".9">
    <circle cx="11" cy="26" r="6"/><circle cx="37" cy="26" r="6"/>
  </g>
  <g fill="none" stroke="#8995a2" stroke-width=".8" opacity=".9">
    <path d="M11 19v14M4 26h14M6 21l10 10M6 31l10-10"/>
    <path d="M37 19v14M30 26h14M32 21l10 10M32 31l10-10"/>
  </g>
  <g fill="#c8d0d6"><circle cx="11" cy="26" r="1.25"/><circle cx="37" cy="26" r="1.25"/></g>
  <path d="M29.5 16.5L36 17.5l3.2-4.2" fill="none" stroke="#111820" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 15.8l4.2 7.1" fill="none" stroke="#151b22" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M22.2 22.9l1.7 3.2" fill="none" stroke="#d49a72" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M18.5 16.2l-2.8 7.2" fill="none" stroke="#d49a72" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M15.7 23.4L11 26" fill="none" stroke="#151b22" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M29 12.3l7 3.1" fill="none" stroke="#d49a72" stroke-width="2.3" stroke-linecap="round"/>
  <path d="M35.6 15.3l2.7-1.6" fill="none" stroke="#d49a72" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M31.3 8.4c2-1.4 4.7-.5 5.2 1.5.4 1.7-.8 3.6-2.8 4l-2.6-1.5z" fill="#d49a72"/>
  <path d="M33.7 11.4l4.2.5" stroke="#111820" stroke-width="1" stroke-linecap="round"/>
</svg>`;

// White layers tint cleanly to the team's primary jersey colour.
const JERSEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <path d="M17.2 15.2l11.6-4.4 4.1 4.8-12.7 4.7-3.3-2.2z" fill="#fff"/>
  <path d="M30.5 8.3c.9-2 3.5-3.1 5.7-1.9 1.2.6 1.9 1.8 1.9 3.1l-5.5.6z" fill="#fff"/>
</svg>`;

// Accent trim carries the second team colour through the kit and bicycle frame.
const ACCENT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <g fill="none" stroke="#fff" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 26l12.8.1-5.7-10.3L11 26z"/>
    <path d="M23.8 26.1l7.3-9.4 5.9 9.3M18.1 15.8l13 1"/>
  </g>
  <path d="M19.2 16.1l11.3-4.2 1.5 1.8-11.6 4.4z" fill="#fff"/>
  <path d="M27.5 11.3l3.3-1.2 2.1 2.5-3.4 1.2z" fill="#fff"/>
  <path d="M31.3 8.1c1.3-1.6 3.6-2.3 5.4-1.1l.9.8-6.3 1.4z" fill="#fff"/>
</svg>`;

function dataUri(svg: string): string {
  // Phaser's SVG loader base64-decodes (atob) a data URI's payload, so it must be
  // base64 — a URL-encoded payload throws. The SVG is ASCII, so btoa is safe.
  return 'data:image/svg+xml;base64,' + btoa(svg.trim());
}

/** Queue the sprite textures in a scene's `preload()` (rasterised at 2× for crispness). */
export function preloadSpriteTextures(scene: Phaser.Scene): void {
  const opts = { width: 96, height: 72 };
  if (!scene.textures.exists(TEX_BASE)) scene.load.svg(TEX_BASE, dataUri(BASE_SVG), opts);
  if (!scene.textures.exists(TEX_JERSEY)) scene.load.svg(TEX_JERSEY, dataUri(JERSEY_SVG), opts);
  if (!scene.textures.exists(TEX_ACCENT)) scene.load.svg(TEX_ACCENT, dataUri(ACCENT_SVG), opts);
}

/** True once all aligned textures are available (so a renderer can fall back if not). */
export function spriteTexturesReady(scene: Phaser.Scene): boolean {
  return scene.textures.exists(TEX_BASE) && scene.textures.exists(TEX_JERSEY) && scene.textures.exists(TEX_ACCENT);
}

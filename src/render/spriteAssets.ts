import type Phaser from 'phaser';

/**
 * Sprite-path assets (Phase 7, SPEC §8). The "sprite" renderer loads rider art as
 * a **texture** rather than drawing it with `Graphics`. To keep the experiment
 * self-contained (and CSP-safe — no external files) the art is authored as inline
 * **SVG** and loaded from a data-URI: a fixed **base** (bike, limbs, helmet) plus a
 * white **jersey** layer that's tinted per team, mirroring how the code-drawn path
 * recolours. A richer AI-generated raster atlas could drop straight in behind the
 * same keys later — that's the whole point of the render abstraction.
 *
 * Faces right (direction of travel); authored on a 48×36 canvas, rasterised at 2×.
 */

export const TEX_BASE = 'cyclist-base';
export const TEX_JERSEY = 'cyclist-jersey';

const BASE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <g fill="none" stroke="#20202f" stroke-width="2.2"><circle cx="12" cy="26" r="7"/><circle cx="36" cy="26" r="7"/></g>
  <g fill="none" stroke="#30304a" stroke-width="1"><circle cx="12" cy="26" r="4.8"/><circle cx="36" cy="26" r="4.8"/></g>
  <g fill="#9a9ab0"><circle cx="12" cy="26" r="1.4"/><circle cx="36" cy="26" r="1.4"/></g>
  <g fill="none" stroke="#6b6b86" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 26 L24 26 L19 15 Z"/>
    <path d="M24 26 L33 17 L36 26"/>
    <path d="M19 15 L33 17"/>
  </g>
  <path d="M33 17 L37.5 13.5" stroke="#20202f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M20.5 16 L25 21" stroke="#20202f" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M25 21 L24 26" stroke="#f0c9a8" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M30 12.5 L37 15" stroke="#f0c9a8" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="34.4" cy="9.4" r="3" fill="#20202f"/>
  <circle cx="35.4" cy="10.6" r="2.1" fill="#f0c9a8"/>
</svg>`;

// White so it tints cleanly to any team colour. The leaning torso, saddle→shoulders.
const JERSEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <path d="M19 16 L30 12 L32 15 L21 19 Z" fill="#ffffff"/>
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
}

/** True once both textures are available (so a renderer can fall back if not). */
export function spriteTexturesReady(scene: Phaser.Scene): boolean {
  return scene.textures.exists(TEX_BASE) && scene.textures.exists(TEX_JERSEY);
}

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
  <g fill="none" stroke="#20202f" stroke-width="2.4">
    <circle cx="11" cy="27" r="7"/>
    <circle cx="37" cy="27" r="7"/>
  </g>
  <g fill="none" stroke="#7a7a96" stroke-width="1" opacity="0.6">
    <path d="M11 27 L14 22 M11 27 L8 22 M37 27 L40 22 M37 27 L34 22"/>
  </g>
  <g fill="none" stroke="#6b6b86" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 27 L22 27 L20 16.5 Z"/>
    <path d="M22 27 L34 16"/>
    <path d="M20 16.5 L34 16"/>
    <path d="M34 16 L37 27"/>
    <path d="M34 16 L36.5 12.5"/>
  </g>
  <path d="M22 27 L24.5 20.5" stroke="#2b2b40" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M24.5 20.5 L28 27" stroke="#e8b48a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M30.5 15 L36.5 20" stroke="#e8b48a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="37.5" cy="11" r="2.7" fill="#e8b48a"/>
  <path d="M34.6 11 a3 3 0 0 1 5.8 0 Z" fill="#20202f"/>
</svg>`;

// White so it tints cleanly to any team colour.
const JERSEY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" width="48" height="36">
  <path d="M19.5 18.5 L31 14.5 L33 17.5 L22.5 22 Z" fill="#ffffff"/>
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

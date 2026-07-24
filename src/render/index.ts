import { CodeDrawnRenderer } from './codeDrawnRenderer.ts';
import type { RiderRenderer } from './riderRenderer.ts';
import { SpriteRenderer } from './spriteRenderer.ts';

/**
 * Render mode (SPEC §8, Phase 7). The one config flag the render abstraction was
 * built for: swap how riders are drawn without touching the race view. All rider
 * drawing goes through `makeRiderRenderer()`, so `RENDER_MODE` (or a per-call
 * override, used by the side-by-side compare scene) is the only switch.
 *
 * **Default: 'code'** — after the side-by-side experiment (see the BUILD-PLAN
 * Phase 7 note): the code-drawn path is a tiny footprint, recolours with one
 * value, scales cleanly and matches the game's clean/minimalist look; the sprite
 * path works and can host richer (AI-generated) art later, but costs an extra
 * tinted layer to recolour and a texture load. Change this one line to try it.
 */
export type RenderMode = 'code' | 'sprite';

export const RENDER_MODE: RenderMode = 'code';

export function makeRiderRenderer(mode: RenderMode = RENDER_MODE): RiderRenderer {
  return mode === 'sprite' ? new SpriteRenderer() : new CodeDrawnRenderer();
}

export { preloadSpriteTextures } from './spriteAssets.ts';
export type { RiderRenderer, RiderVisual } from './riderRenderer.ts';

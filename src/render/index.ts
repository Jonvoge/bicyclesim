import { CodeDrawnRenderer } from './codeDrawnRenderer.ts';
import type { RiderRenderer } from './riderRenderer.ts';
import { SpriteRenderer } from './spriteRenderer.ts';

/**
 * Render mode (SPEC §8, Phase 7). The one config flag the render abstraction was
 * built for: swap how riders are drawn without touching the race view. All rider
 * drawing goes through `makeRiderRenderer()`, so `RENDER_MODE` (or a per-call
 * override, used by the side-by-side compare scene) is the only switch.
 *
 * **Default: 'sprite'** — the final three-layer cyclist keeps a readable silhouette
 * at race scale while carrying both team colours through the kit and bicycle. The
 * code-drawn implementation remains a lightweight fallback and comparison path.
 */
export type RenderMode = 'code' | 'sprite';

export const RENDER_MODE: RenderMode = 'sprite';

export function makeRiderRenderer(mode: RenderMode = RENDER_MODE): RiderRenderer {
  return mode === 'sprite' ? new SpriteRenderer() : new CodeDrawnRenderer();
}

export { preloadSpriteTextures } from './spriteAssets.ts';
export type { RiderRenderer, RiderVisual } from './riderRenderer.ts';

import Phaser from 'phaser';
import type { RiderRenderer, RiderVisual } from './riderRenderer.ts';
import { spriteTexturesReady, TEX_ACCENT, TEX_BASE, TEX_JERSEY } from './spriteAssets.ts';

/**
 * SpriteRenderer (SPEC §8, Phase 7) — the sprite path: rider art loaded as a
 * **texture** (see `spriteAssets.ts`) instead of drawn with `Graphics`. The jersey
 * jersey and accent layers are independently tinted per team, preserving both
 * identity colours while the bike, rider, spokes, and shadow remain consistent.
 *
 * Requires `preloadSpriteTextures(scene)` to have run in the scene's `preload()`.
 * If the textures aren't ready it degrades to a small dot rather than crashing.
 */
const DISPLAY_W = 30;
const DISPLAY_H = 22.5;

export class SpriteRenderer implements RiderRenderer {
  draw(scene: Phaser.Scene, x: number, y: number, visual: RiderVisual): Phaser.GameObjects.Container {
    if (!spriteTexturesReady(scene)) {
      const dot = scene.add.circle(0, 0, 5, visual.jerseyColor, 1);
      return scene.add.container(x, y, [dot]).setSize(DISPLAY_W, DISPLAY_H);
    }

    const base = scene.add.image(0, 0, TEX_BASE).setDisplaySize(DISPLAY_W, DISPLAY_H);
    const jersey = scene.add.image(0, 0, TEX_JERSEY).setDisplaySize(DISPLAY_W, DISPLAY_H).setTint(visual.jerseyColor);
    const accent = scene.add.image(0, 0, TEX_ACCENT).setDisplaySize(DISPLAY_W, DISPLAY_H).setTint(visual.accentColor);
    const layers: Phaser.GameObjects.GameObject[] = [base, jersey, accent];

    const container = scene.add.container(x, y, layers);
    container.setSize(DISPLAY_W, DISPLAY_H);

    if (visual.emphasised) {
      const halo = scene.add.circle(0, -1, 12, visual.jerseyColor, 0.28);
      const ring = scene.add.circle(0, -1, 12).setStrokeStyle(1.5, 0xffffff, 0.9);
      container.addAt(halo, 0);
      container.addAt(ring, 1);
    }

    return container;
  }
}

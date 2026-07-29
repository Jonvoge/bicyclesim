import type Phaser from 'phaser';

/**
 * Render abstraction (SPEC §8).
 *
 * All rider drawing goes through this interface so the code-drawn-vs-sprite
 * experiment (Phase 7) stays a config flag, not a rewrite. The final sprite path
 * is the default; the code-drawn implementation remains a supported fallback.
 */

export interface RiderVisual {
  jerseyColor: number; // primary team colour
  accentColor: number; // secondary / trim colour
  /** Slightly emphasise (e.g. the player's riders). */
  emphasised?: boolean;
}

export interface RiderRenderer {
  /**
   * Draw a rider at (x, y) and return the GameObject (a Container) so callers
   * can move/tween it. The glyph is centred on (x, y).
   */
  draw(
    scene: Phaser.Scene,
    x: number,
    y: number,
    visual: RiderVisual,
  ): Phaser.GameObjects.Container;
}

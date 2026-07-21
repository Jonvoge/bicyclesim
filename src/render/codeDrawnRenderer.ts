import Phaser from 'phaser';
import type { RiderRenderer, RiderVisual } from './riderRenderer.ts';

/**
 * CodeDrawnRenderer (SPEC §8) — crude rider-on-a-bike drawn with Phaser Graphics.
 * Tiny footprint, recolour by changing one value. A placeholder look until the
 * Phase 7 art experiment; deliberately minimal.
 *
 * Faces right (direction of travel). Roughly 24×18px, centred on (x, y).
 */
export class CodeDrawnRenderer implements RiderRenderer {
  draw(
    scene: Phaser.Scene,
    x: number,
    y: number,
    visual: RiderVisual,
  ): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const wheelR = 4;
    const wheelY = 5;
    const backX = -7;
    const frontX = 7;

    // wheels
    g.lineStyle(1.5, 0x2a2a3e, 1);
    g.strokeCircle(backX, wheelY, wheelR);
    g.strokeCircle(frontX, wheelY, wheelR);

    // frame
    g.lineStyle(1.5, visual.accentColor, 1);
    g.beginPath();
    g.moveTo(backX, wheelY);
    g.lineTo(0, -2);
    g.lineTo(frontX, wheelY);
    g.moveTo(0, -2);
    g.lineTo(3, wheelY);
    g.strokePath();

    // torso (jersey) — a little leaning body
    g.lineStyle(3, visual.jerseyColor, 1);
    g.beginPath();
    g.moveTo(-1, -2);
    g.lineTo(4, -9);
    g.strokePath();

    // head
    g.fillStyle(0xf2d2b6, 1);
    g.fillCircle(5, -11, 2.2);

    const container = scene.add.container(x, y, [g]);
    container.setSize(24, 18);

    if (visual.emphasised) {
      // faint halo so the player's riders are followable in the bunch
      const halo = scene.add.circle(0, -2, 11, visual.jerseyColor, 0.16);
      container.addAt(halo, 0);
    }

    return container;
  }
}

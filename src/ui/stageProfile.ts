import Phaser from 'phaser';
import type { StageType } from '../data/types.ts';
import { COLORS } from './theme.ts';

/**
 * Stage elevation silhouette (shared by PreRace and Race). Crude placeholder art
 * (SPEC §8). Optionally shows a position marker that tracks race progress — the
 * "where on the stage are we" map.
 */

// relative peak heights (fraction of panel height) sampled along the route
const SHAPES: Record<StageType, number[]> = {
  flat: [0.08, 0.14, 0.09, 0.16, 0.1, 0.08, 0.08],
  hilly: [0.1, 0.38, 0.16, 0.48, 0.22, 0.42, 0.18, 0.36, 0.12],
  mountain: [0.1, 0.52, 0.26, 0.72, 0.36, 0.62, 0.22, 0.68, 0.3],
  summitFinish: [0.08, 0.12, 0.2, 0.32, 0.45, 0.6, 0.78, 0.95],
  descentFinish: [0.1, 0.32, 0.56, 0.82, 0.92, 0.55, 0.24, 0.08],
  cobbled: [0.1, 0.24, 0.13, 0.28, 0.15, 0.26, 0.17, 0.24, 0.1],
};

export class StageProfileView {
  private xs: number[] = [];
  private ys: number[] = [];
  private markers: Phaser.GameObjects.Arc[] = [];
  private scene!: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    type: StageType,
    opts: { showMarker?: boolean } = {},
  ) {
    this.scene = scene;
    scene.add.rectangle(x + w / 2, y + h / 2, w, h, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);

    const heights = SHAPES[type];
    const base = y + h - 6;
    const usable = h - 14;
    const step = w / (heights.length - 1);
    this.xs = heights.map((_, i) => x + i * step);
    this.ys = heights.map((f) => base - f * usable);

    const g = scene.add.graphics();
    g.fillStyle(COLORS.buttonSelected, 0.35);
    g.lineStyle(2, COLORS.buttonSelected, 1);
    g.beginPath();
    g.moveTo(x, base);
    this.xs.forEach((px, i) => g.lineTo(px, this.ys[i]));
    g.lineTo(x + w, base);
    g.closePath();
    g.fillPath();
    g.beginPath();
    this.xs.forEach((px, i) => (i === 0 ? g.moveTo(px, this.ys[i]) : g.lineTo(px, this.ys[i])));
    g.strokePath();

    scene.add.text(x + w - 6, y + 4, '🏁', { fontSize: '13px' }).setOrigin(1, 0);

    void opts;
  }

  private xAt(frac: number): number {
    const c = Math.max(0, Math.min(1, frac));
    return this.xs[0] + (this.xs[this.xs.length - 1] - this.xs[0]) * c;
  }

  private yAt(x: number): number {
    let yy = this.ys[this.ys.length - 1];
    for (let i = 1; i < this.xs.length; i++) {
      if (x <= this.xs[i]) {
        const t = (x - this.xs[i - 1]) / (this.xs[i] - this.xs[i - 1] || 1);
        yy = this.ys[i - 1] + (this.ys[i] - this.ys[i - 1]) * t;
        break;
      }
    }
    return yy - 3;
  }

  /**
   * Place a marker per group at its route fraction (index 0 = leader). The lead
   * group is gold and larger; trailing groups smaller and dimmer.
   */
  setMarkers(fracs: number[]): void {
    while (this.markers.length < fracs.length) {
      const m = this.scene.add.circle(this.xs[0], this.ys[0], 4, COLORS.gold, 1).setStrokeStyle(1.5, 0x1a1a2e);
      this.markers.push(m);
    }
    this.markers.forEach((m, i) => {
      if (i >= fracs.length) {
        m.setVisible(false);
        return;
      }
      const x = this.xAt(fracs[i]);
      m.setVisible(true);
      m.setPosition(x, this.yAt(x));
      m.setRadius(i === 0 ? 5 : 3.5);
      m.setFillStyle(i === 0 ? COLORS.gold : 0xffffff, i === 0 ? 1 : 0.7);
    });
  }
}

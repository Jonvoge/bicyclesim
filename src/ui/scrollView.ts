import Phaser from 'phaser';

/**
 * A masked, drag/wheel-scrollable layer for long lists (the peloton, a full
 * finishing order) now that the field is ~45 riders. Add row objects at their
 * absolute y; the layer scrolls under a fixed viewport mask. Headers/buttons stay
 * outside the layer so they don't scroll.
 */
export class ScrollView {
  private layer: Phaser.GameObjects.Container;
  private minY = 0;
  private maxY = 0;
  private dragging = false;
  private lastY = 0;

  constructor(scene: Phaser.Scene, viewTop: number, viewBottom: number, contentBottom: number, width = 390) {
    this.layer = scene.add.container(0, 0);
    const mask = scene.make.graphics({});
    mask.fillStyle(0xffffff);
    mask.fillRect(0, viewTop, width, viewBottom - viewTop);
    this.layer.setMask(mask.createGeometryMask());
    this.minY = Math.min(0, viewBottom - contentBottom - 8);

    const zone = scene.add.zone(0, viewTop, width, viewBottom - viewTop).setOrigin(0, 0).setInteractive().setDepth(-1);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.lastY = p.y;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.scrollBy(p.y - this.lastY);
      this.lastY = p.y;
    });
    scene.input.on('pointerup', () => (this.dragging = false));
    zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.scrollBy(-dy));

    if (this.minY < 0) {
      // faint scrollbar affordance
      const trackH = viewBottom - viewTop;
      const thumbH = Math.max(24, (trackH / (contentBottom - viewTop)) * trackH);
      const thumb = scene.add.rectangle(width - 5, viewTop + thumbH / 2, 3, thumbH, 0x8a8ab0, 0.5).setOrigin(0.5);
      this.thumb = thumb;
      this.trackTop = viewTop;
      this.trackH = trackH;
      this.thumbH = thumbH;
    }
  }

  private thumb?: Phaser.GameObjects.Rectangle;
  private trackTop = 0;
  private trackH = 0;
  private thumbH = 0;

  add(obj: Phaser.GameObjects.GameObject): void {
    this.layer.add(obj);
  }

  private scrollBy(d: number): void {
    this.layer.y = Phaser.Math.Clamp(this.layer.y + d, this.minY, this.maxY);
    if (this.thumb && this.minY < 0) {
      const frac = this.layer.y / this.minY; // 0 (top) → 1 (bottom)
      this.thumb.y = this.trackTop + this.thumbH / 2 + frac * (this.trackH - this.thumbH);
    }
  }
}

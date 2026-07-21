import Phaser from 'phaser';
import { COLORS, FONT } from './theme.ts';

/**
 * Reusable button widget (SPEC §3). Supports a selected state so it can act as a
 * toggle in a group (used by the tactics picker).
 */

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  fill?: number;
}

export class Button {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private selected = false;
  private enabled = true;
  private baseFill: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ) {
    const fontSize = opts.fontSize ?? 20;
    this.baseFill = opts.fill ?? COLORS.buttonFill;

    this.label = scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: `${fontSize}px`, color: COLORS.text })
      .setOrigin(0.5);

    const w = opts.width ?? this.label.width + 32;
    const h = opts.height ?? this.label.height + 20;

    this.bg = scene.add
      .rectangle(0, 0, w, h, this.baseFill, 1)
      .setStrokeStyle(2, COLORS.stroke);

    this.container = scene.add.container(x, y, [this.bg, this.label]);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.enabled && !this.selected && this.bg.setFillStyle(COLORS.buttonHover));
    this.bg.on('pointerout', () => this.refresh());
    this.bg.on('pointerup', () => {
      if (this.enabled) onClick();
    });
  }

  setSelected(v: boolean): this {
    this.selected = v;
    this.refresh();
    return this;
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.container.setAlpha(v ? 1 : 0.4);
    this.refresh();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  private refresh(): void {
    if (this.selected) {
      this.bg.setFillStyle(COLORS.buttonSelected);
      this.label.setColor(COLORS.textDark);
    } else {
      this.bg.setFillStyle(this.baseFill);
      this.label.setColor(COLORS.text);
    }
  }
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void,
  opts?: ButtonOptions,
): Button {
  return new Button(scene, x, y, text, onClick, opts);
}

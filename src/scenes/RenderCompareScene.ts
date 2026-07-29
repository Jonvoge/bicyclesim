import Phaser from 'phaser';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS } from '../data/teams.ts';
import { CodeDrawnRenderer } from '../render/codeDrawnRenderer.ts';
import { preloadSpriteTextures, RENDER_MODE } from '../render/index.ts';
import type { RiderRenderer } from '../render/riderRenderer.ts';
import { SpriteRenderer } from '../render/spriteRenderer.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Art experiment (SPEC §8, Phase 7): the same riders drawn **both ways**,
 * side-by-side, so the code-drawn-vs-sprite choice is made by *looking*. The left
 * column is `CodeDrawnRenderer` (Phaser `Graphics`), the right is `SpriteRenderer`
 * (three aligned SVG textures, tinted per team). Notes below record the trade-offs;
 * the chosen default lives in `RENDER_MODE` (`src/render/index.ts`).
 */
export class RenderCompareScene extends Phaser.Scene {
  constructor() {
    super('RenderCompare');
  }

  preload(): void {
    preloadSpriteTextures(this);
  }

  create(): void {
    const { width } = this.scale;
    const code = new CodeDrawnRenderer();
    const sprite = new SpriteRenderer();

    makeButton(this, 40, 34, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 28, 'Renderers', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 52, 'the same riders, drawn both ways', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const leftX = width * 0.3;
    const rightX = width * 0.7;
    this.colHeader(leftX, 'Code-drawn', RENDER_MODE === 'code');
    this.colHeader(rightX, 'Final sprite', RENDER_MODE === 'sprite');

    // a few teams, the first emphasised like the player's riders in a race
    const sample = TEAMS.slice(0, 6);
    const top = 140;
    const rowH = 74;
    sample.forEach((team, i) => {
      const y = top + i * rowH;
      const col = teamColor(team.id);
      const visual = { jerseyColor: col.jersey, accentColor: col.accent, emphasised: i === 0 };
      this.big(code, leftX, y, visual);
      this.big(sprite, rightX, y, visual);
      this.add.text(width / 2, y + 26, team.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5);
    });

    this.add.text(24, 580, 'NATIVE RACE SIZE', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted });
    sample.slice(0, 4).forEach((team, index) => {
      const col = teamColor(team.id);
      sprite.draw(this, 156 + index * 34, 585, { jerseyColor: col.jersey, accentColor: col.accent });
    });

    // findings
    const notesY = top + sample.length * rowH + 58;
    this.add.rectangle(width / 2, notesY + 74, width - 24, 150, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(20, notesY + 8, 'FINDINGS', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const notes = [
      '• Code-drawn: ~0 KB, recolour with one value, scales crisp.',
      '• Sprite: primary + accent kit, detailed frame, readable posture.',
      '• Three aligned SVG layers stay crisp and deterministic.',
      '• Both animate identically (same RiderRenderer) — view unchanged.',
      `• Default: RENDER_MODE = '${RENDER_MODE}'  ·  src/render/index.ts`,
    ];
    notes.forEach((n, i) => this.add.text(22, notesY + 26 + i * 19, n, { fontFamily: FONT, fontSize: '11px', color: COLORS.text }).setOrigin(0, 0));

    this.add.text(width / 2, notesY + 130, 'Code-drawn is the race default; sprite remains available internally.', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5);
  }

  private colHeader(x: number, label: string, isDefault: boolean): void {
    this.add.text(x, 92, label, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    if (isDefault) this.add.text(x, 110, 'DEFAULT', { fontFamily: FONT, fontSize: '9px', color: COLORS.accentText }).setOrigin(0.5);
  }

  private big(renderer: RiderRenderer, x: number, y: number, visual: { jerseyColor: number; accentColor: number; emphasised?: boolean }): void {
    const glyph = renderer.draw(this, x, y, visual);
    glyph.setScale(2.6);
  }
}

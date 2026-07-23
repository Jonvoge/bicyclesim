import Phaser from 'phaser';
import { RACES } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Quick Race: pick any single race (one-day or tour) and ride it as a one-off,
 * outside the season. This is the old race-picker; the season is the main mode.
 */
export class QuickRaceScene extends Phaser.Scene {
  constructor() {
    super('QuickRace');
  }

  create(): void {
    const { width } = this.scale;
    makeButton(this, 40, 40, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 36, fontSize: 20 });
    this.add.text(width / 2, 40, 'Quick Race', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);

    let y = 110;
    const rowH = 50;
    for (const race of RACES) {
      const stages = race.stageIds.length;
      const first = STAGES_BY_ID.get(race.stageIds[0])!;
      const kind = stages === 1 ? first.type : stages <= 5 ? `short tour · ${stages}` : `grand tour · ${stages}`;
      const y0 = y;
      const bg = this.add
        .rectangle(width / 2, y0, width - 30, rowH - 6, COLORS.panel, 1)
        .setStrokeStyle(1, COLORS.stroke)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(COLORS.panelAlt));
      bg.on('pointerout', () => bg.setFillStyle(COLORS.panel));
      bg.on('pointerup', () => this.scene.start('PreRace', { raceId: race.id }));
      this.add.text(28, y0, race.name, { fontFamily: FONT, fontSize: '16px', color: COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 28, y0, kind, { fontFamily: FONT, fontSize: '11px', color: stages === 1 ? COLORS.textMuted : '#f5c518' }).setOrigin(1, 0.5);
      y += rowH;
    }
  }
}

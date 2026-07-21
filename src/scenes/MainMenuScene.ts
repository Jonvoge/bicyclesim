import Phaser from 'phaser';
import { RACES } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Phase 2: pick a race to ride. One-day races only for now (multi-stage is
 * Phase 3). This is the entry to the pick-tactics → watch → results loop.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 90, 'BICYCLE SIM', {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 128, 'pick a race', { fontFamily: FONT, fontSize: '16px', color: COLORS.textMuted })
      .setOrigin(0.5);

    let y = 220;
    for (const race of RACES) {
      const stage = STAGES_BY_ID.get(race.stageIds[0])!;
      makeButton(
        this,
        width / 2,
        y,
        `${race.name}`,
        () => this.scene.start('PreRace', { raceId: race.id }),
        { width: 300, height: 58, fontSize: 22 },
      );
      this.add
        .text(width / 2, y + 42, `${stage.type} · ${stage.lengthKm} km`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: COLORS.textMuted,
        })
        .setOrigin(0.5)
        .setDepth(1);
      y += 100;
    }
  }
}

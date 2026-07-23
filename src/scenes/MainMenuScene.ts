import Phaser from 'phaser';
import { RACES } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { createTour } from '../sim/standings.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Pick a race to ride: one-day classics and multi-stage tours (Phase 3). Starting
 * a race creates a fresh tour (a one-day race is a one-stage tour) and hands it to
 * PreRace. This is the entry to the pick-tactics → watch → results loop.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 76, 'BICYCLE SIM', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.add.text(width / 2, 112, 'pick a race', { fontFamily: FONT, fontSize: '16px', color: COLORS.textMuted }).setOrigin(0.5);

    let y = 176;
    for (const race of RACES) {
      const stages = race.stageIds.length;
      const first = STAGES_BY_ID.get(race.stageIds[0])!;
      const kind = stages === 1 ? first.type : stages <= 5 ? 'short tour' : 'grand tour';
      const sub = stages === 1 ? `${first.type} · ${first.lengthKm} km` : `${kind} · ${stages} stages`;

      makeButton(this, width / 2, y, race.name, () => this.scene.start('PreRace', { tour: createTour(race) }), {
        width: 320,
        height: 52,
        fontSize: 21,
      });
      this.add
        .text(width / 2, y + 38, sub, { fontFamily: FONT, fontSize: '13px', color: stages === 1 ? COLORS.textMuted : '#f5c518' })
        .setOrigin(0.5)
        .setDepth(1);
      y += 90;
    }
  }
}

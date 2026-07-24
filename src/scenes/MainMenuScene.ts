import Phaser from 'phaser';
import { createDynasty } from '../state/dynasty.ts';
import { clearDynasty, hasSavedDynasty, loadDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Title screen: play the dynasty (continue a save or start fresh) or a one-off
 * Quick Race. The dynasty is the main mode (Phase 5): a persistent team you run
 * across seasons — squad, budget, transfers and training on top of the racing.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width } = this.scale;

    this.add.text(width / 2, 150, 'BICYCLE SIM', { fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 192, 'run the team, ride the years', { fontFamily: FONT, fontSize: '15px', color: COLORS.textMuted }).setOrigin(0.5);

    const saved = hasSavedDynasty();
    let y = 320;

    if (saved) {
      makeButton(this, width / 2, y, 'Continue', () => this.openDynasty(false), { width: 300, height: 58, fontSize: 22, fill: COLORS.buttonSelected });
      y += 84;
      makeButton(this, width / 2, y, 'New Dynasty', () => this.confirmNew(), { width: 300, height: 50, fontSize: 18 });
      y += 76;
    } else {
      makeButton(this, width / 2, y, 'New Dynasty', () => this.openDynasty(true), { width: 300, height: 58, fontSize: 22, fill: COLORS.buttonSelected });
      y += 84;
    }

    makeButton(this, width / 2, y, 'Quick Race', () => this.scene.start('QuickRace'), { width: 300, height: 50, fontSize: 18 });
    y += 68;
    makeButton(this, width / 2, y, 'Renderers (art test)', () => this.scene.start('RenderCompare'), { width: 300, height: 40, fontSize: 15 });
  }

  private openDynasty(fresh: boolean): void {
    const dynasty = !fresh ? loadDynasty() ?? createDynasty() : createDynasty();
    this.scene.start('SeasonHub', { dynasty });
  }

  private confirmNew(): void {
    clearDynasty();
    this.scene.start('SeasonHub', { dynasty: createDynasty() });
  }
}

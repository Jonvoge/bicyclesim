import Phaser from 'phaser';
import { SEASON_CALENDAR } from '../data/races.ts';
import { createSeason } from '../sim/season.ts';
import { clearSeason, hasSavedSeason, loadSeason } from '../state/seasonStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Title screen: play the season (continue a save or start fresh) or a one-off
 * Quick Race. The season is the main mode (Phase 4); Quick Race keeps the old
 * pick-any-race loop for a fast single race.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width } = this.scale;

    this.add.text(width / 2, 150, 'BICYCLE SIM', { fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 192, 'a season on the road', { fontFamily: FONT, fontSize: '15px', color: COLORS.textMuted }).setOrigin(0.5);

    const saved = hasSavedSeason();
    let y = 320;

    if (saved) {
      makeButton(this, width / 2, y, 'Continue Season', () => this.openSeason(false), { width: 300, height: 58, fontSize: 22, fill: COLORS.buttonSelected });
      y += 84;
      makeButton(this, width / 2, y, 'New Season', () => this.confirmNewSeason(), { width: 300, height: 50, fontSize: 18 });
      y += 76;
    } else {
      makeButton(this, width / 2, y, 'Play Season', () => this.openSeason(true), { width: 300, height: 58, fontSize: 22, fill: COLORS.buttonSelected });
      y += 84;
    }

    makeButton(this, width / 2, y, 'Quick Race', () => this.scene.start('QuickRace'), { width: 300, height: 50, fontSize: 18 });
  }

  private openSeason(fresh: boolean): void {
    const season = !fresh ? loadSeason() ?? createSeason(SEASON_CALENDAR) : createSeason(SEASON_CALENDAR);
    this.scene.start('SeasonHub', { season });
  }

  private confirmNewSeason(): void {
    clearSeason();
    this.scene.start('SeasonHub', { season: createSeason(SEASON_CALENDAR) });
  }
}

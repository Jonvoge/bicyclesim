import Phaser from 'phaser';
import { RIDERS } from '../data/riders.ts';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS } from '../data/teams.ts';
import { riderRating } from '../sim/rating.ts';
import { createDynasty } from '../state/dynasty.ts';
import { setActiveSlot } from '../state/dynastyStore.ts';
import { COLORS, FONT } from '../ui/theme.ts';
import { makeButton } from '../ui/button.ts';

/**
 * Choose which of the eight teams to run (Phase 8-era). Shown when starting a new
 * dynasty in a save slot; picks the team, creates the dynasty, and drops into the
 * Season hub. Each team previews its marquee rider so the flavour is legible.
 */
export class TeamSelectScene extends Phaser.Scene {
  constructor() {
    super('TeamSelect');
  }

  create(data: { slot: number }): void {
    const { width } = this.scale;
    makeButton(this, 40, 34, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, 'Choose your team', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 54, 'the squad you inherit for this dynasty', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const top = 86;
    const rowH = 88;
    TEAMS.forEach((team, i) => {
      const y = top + i * rowH;
      const col = teamColor(team.id);
      const panel = this.add
        .rectangle(width / 2, y + 34, width - 24, rowH - 12, COLORS.panel, 1)
        .setStrokeStyle(1, COLORS.stroke)
        .setInteractive({ useHandCursor: true });
      panel.on('pointerover', () => panel.setFillStyle(COLORS.panelAlt));
      panel.on('pointerout', () => panel.setFillStyle(COLORS.panel));
      panel.on('pointerup', () => this.choose(data.slot, team.id));

      this.add.rectangle(30, y + 26, 16, 16, col.jersey, 1).setStrokeStyle(1, col.accent);
      this.add.text(48, y + 24, team.name, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0, 0.5);

      // marquee rider (best-rated on the authored squad) as flavour
      const star = [...RIDERS].filter((r) => r.teamId === team.id).sort((a, b) => riderRating(b) - riderRating(a))[0];
      if (star) {
        this.add.text(48, y + 46, `★ ${star.name} · rating ${riderRating(star)}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0, 0.5);
      }
      this.add.text(width - 30, y + 34, 'Pick →', { fontFamily: FONT, fontSize: '13px', color: '#18b39a' }).setOrigin(1, 0.5);
    });
  }

  private choose(slot: number, teamId: string): void {
    setActiveSlot(slot);
    this.scene.start('SeasonHub', { dynasty: createDynasty(teamId) });
  }
}

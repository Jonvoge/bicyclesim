import Phaser from 'phaser';
import { teamColor } from '../data/teamColors.ts';
import { scoutReport } from '../sim/development.ts';
import { riderRating, riderType } from '../sim/rating.ts';
import { playerRiders, type DynastyState } from '../state/dynasty.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Development (formerly manual Training): a **read-only** window on how the squad
 * is growing. Training is automatic now — a handful of "camps" a season quietly
 * develop each rider toward their ceiling, weighted by age, potential and type
 * (`trainingTick`), so there's no chore to click. This screen just shows the last
 * camp's gains and where each rider sits versus their scouted potential.
 */
export class TrainingScene extends Phaser.Scene {
  private dynasty!: DynastyState;

  constructor() {
    super('Training');
  }

  create(data: { dynasty: DynastyState }): void {
    this.dynasty = data.dynasty;
    const { width } = this.scale;
    const squad = playerRiders(this.dynasty)
      .slice()
      .sort((a, b) => riderRating(b) - riderRating(a));

    makeButton(this, 40, 30, '‹', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, 'Development', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 47, 'training is automatic — camps develop by age · potential · type', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);

    // last-camp banner
    const last = this.dynasty.lastTraining;
    this.add.rectangle(width / 2, 78, width - 24, 26, COLORS.panel, 1).setStrokeStyle(1, last && last.improvedCount > 0 ? COLORS.gold : COLORS.stroke);
    if (last && last.improvedCount > 0) {
      this.add.text(20, 78, `🏕️ Last camp (after race ${last.afterEvent})`, { fontFamily: FONT, fontSize: '11px', color: '#f5c518' }).setOrigin(0, 0.5);
      this.add.text(width - 20, 78, `${last.improvedCount} sharpened · +${last.totalGain.toFixed(1)} pts`, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(1, 0.5);
    } else {
      this.add.text(width / 2, 78, 'No camp yet this season — the next one comes mid-calendar', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);
    }

    // per-rider gains from the last camp
    const gainById = new Map((last?.perRider ?? []).map((p) => [p.id, p.gain]));

    const top = 108;
    const rowH = 58;
    squad.forEach((r, i) => {
      const y = top + i * rowH;
      const col = teamColor(r.teamId);
      const sc = scoutReport(r);
      const now = riderRating(r);
      const gain = gainById.get(r.id) ?? 0;
      const stars = '★'.repeat(sc.stars) + '·'.repeat(5 - sc.stars);

      this.add.rectangle(width / 2, y + 22, width - 24, rowH - 8, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
      this.add.rectangle(28, y + 12, 9, 9, col.jersey, 1);
      this.add.text(42, y + 12, r.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);
      // type · age · now · scouted potential (fuzzy for the young — same stars as elsewhere)
      this.add.text(42, y + 31, `${riderType(r)} · age ${r.age} · now ${now}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);
      this.add.text(width - 20, y + 31, `${stars}${sc.certain ? '' : ' ' + sc.label}`, { fontFamily: FONT, fontSize: '10px', color: sc.certain ? COLORS.textMuted : '#f5c518' }).setOrigin(1, 0.5);

      // right: this camp's gain on top of the potential stars
      if (gain > 0) {
        this.add.text(width - 20, y + 12, `+${gain.toFixed(1)}`, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(1, 0.5);
      }
    });

    if (squad.length === 0) {
      this.add.text(width / 2, 200, 'No riders on the squad.', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
    }
  }
}

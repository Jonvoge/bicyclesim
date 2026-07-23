import Phaser from 'phaser';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS_BY_ID } from '../data/teams.ts';
import type { StageResult } from '../data/types.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Phase 2: final finishing order + gaps (SPEC §5.7), then back to the menu.
 */
export class StageResultsScene extends Phaser.Scene {
  constructor() {
    super('StageResults');
  }

  create(data: { stageId: string; result: StageResult }): void {
    const { width } = this.scale;
    const stage = STAGES_BY_ID.get(data.stageId)!;
    const order = data.result.order;
    const winner = RIDERS_BY_ID.get(order[0].riderId)!;
    const winnerCol = teamColor(winner.teamId);
    const winnerTime = order[0].timeSec;

    this.add.text(width / 2, 34, stage.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 60, `${stage.type} · ${stage.lengthKm} km`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    // winner banner
    this.add.rectangle(width / 2, 108, width - 30, 52, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2 - 150, 96, '🏆 WINNER', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0, 0.5);
    this.add.rectangle(width / 2 - 150 + 6, 120, 12, 12, winnerCol.jersey, 1).setOrigin(0.5);
    this.add.text(width / 2 - 130, 120, winner.name, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0, 0.5);
    this.add.text(width / 2 + 145, 120, this.fmtTime(winnerTime), { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted }).setOrigin(1, 0.5);

    // full order
    this.add.text(20, 152, 'FINISHING ORDER', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted });
    const top = 176;
    const rowH = 27;
    order.forEach((e, i) => {
      const rider = RIDERS_BY_ID.get(e.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === 't-grenoble';
      const y = top + i * rowH;

      // new finish group (time changed vs the row above) → separator line
      const prev = i > 0 ? order[i - 1] : null;
      const sameGroup = prev && !e.dnf && !prev.dnf && Math.abs(e.timeSec - prev.timeSec) < 0.01;
      if (prev && !sameGroup) {
        this.add.rectangle(width / 2, y - rowH / 2, width - 40, 1, COLORS.stroke, 0.6);
      }

      if (isPlayer) this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12);
      this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(46, y, 9, 9, col.jersey, 1);
      this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '14px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 78, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      // pro convention: same group = same time → "s.t." after the first rider
      const gapLabel = e.dnf ? 'DNF' : i === 0 ? '—' : sameGroup ? 's.t.' : `+${this.fmtGap(e.timeSec - winnerTime)}`;
      this.add.text(width - 20, y, gapLabel, { fontFamily: FONT, fontSize: '13px', color: e.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5);
    });

    makeButton(this, width / 2, top + order.length * rowH + 30, 'Continue →', () => this.scene.start('MainMenu'), {
      width: 240,
      height: 46,
      fontSize: 18,
      fill: COLORS.buttonSelected,
    });
  }

  private fmtTime(sec: number): string {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  private fmtGap(sec: number): string {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
  }
}

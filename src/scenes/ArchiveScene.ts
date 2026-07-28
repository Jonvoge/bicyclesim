import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS_BY_ID } from '../data/teams.ts';
import { rosterById, type DynastyState } from '../state/dynasty.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Race archive (world layer, SPEC §6): the final classification of a contested
 * event — a one-day's finishing order or a tour's GC — read back from the season.
 */
export class ArchiveScene extends Phaser.Scene {
  constructor() {
    super('Archive');
  }

  create(data: { dynasty: DynastyState; index: number }): void {
    const { width } = this.scale;
    const byId = rosterById(data.dynasty);
    const result = data.dynasty.season.results[data.index];
    const race = RACES_BY_ID.get(result.raceId)!;
    const isTour = race.stageIds.length > 1;

    makeButton(this, 40, 34, '‹', () => this.scene.start('SeasonHub', { dynasty: data.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 28, race.name, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 52, `${isTour ? `${race.stageIds.length}-stage tour` : 'one-day'} · final ${isTour ? 'GC' : 'result'}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const previous = makeButton(this, width / 2 - 58, 82, '‹ Previous', () => this.scene.restart({ dynasty: data.dynasty, index: data.index - 1 }), { width: 104, height: 28, fontSize: 11 });
    previous.setEnabled(data.index > 0);
    const next = makeButton(this, width / 2 + 58, 82, 'Next ›', () => this.scene.restart({ dynasty: data.dynasty, index: data.index + 1 }), { width: 104, height: 28, fontSize: 11 });
    next.setEnabled(data.index < data.dynasty.season.results.length - 1);

    const leadTime = result.classification[0]?.totalTimeSec ?? 0;
    const top = 108;
    const rowH = 28;
    result.classification.slice(0, 24).forEach((row, i) => {
      const rider = byId.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === data.dynasty.playerTeamId;
      const y = top + i * rowH + 12;
      if (isPlayer) this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.buttonSelected, 0.12);
      if (i === 0) this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.gold, 0.1);
      this.add.text(32, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(44, y, 9, 9, col.jersey, 1);
      this.add.text(58, y, rider.name, { fontFamily: FONT, fontSize: '14px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 || isPlayer ? '#f2c94c' : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 82, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      const gap = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      this.add.text(width - 22, y, gap, { fontFamily: FONT, fontSize: '12px', color: i === 0 ? '#f2c94c' : COLORS.textMuted }).setOrigin(1, 0.5);
    });
  }

  private fmtTime(sec: number): string {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  private fmtGap(sec: number): string {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
  }
}

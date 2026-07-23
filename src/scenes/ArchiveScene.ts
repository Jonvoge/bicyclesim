import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM, TEAMS_BY_ID } from '../data/teams.ts';
import type { SeasonState } from '../sim/season.ts';
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

  create(data: { season: SeasonState; index: number }): void {
    const { width } = this.scale;
    const result = data.season.results[data.index];
    const race = RACES_BY_ID.get(result.raceId)!;
    const isTour = race.stageIds.length > 1;

    makeButton(this, 40, 34, '‹', () => this.scene.start('SeasonHub', { season: data.season }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 28, race.name, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 52, `${isTour ? `${race.stageIds.length}-stage tour` : 'one-day'} · final ${isTour ? 'GC' : 'result'}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const leadTime = result.classification[0]?.totalTimeSec ?? 0;
    const top = 84;
    const rowH = 30;
    result.classification.slice(0, 24).forEach((row, i) => {
      const rider = RIDERS_BY_ID.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === PLAYER_TEAM.id;
      const y = top + i * rowH + 12;
      if (isPlayer) this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.buttonSelected, 0.12);
      if (i === 0) this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.gold, 0.1);
      this.add.text(32, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(44, y, 9, 9, col.jersey, 1);
      this.add.text(58, y, rider.name, { fontFamily: FONT, fontSize: '14px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 ? '#f5c518' : isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 82, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      const gap = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      this.add.text(width - 22, y, gap, { fontFamily: FONT, fontSize: '12px', color: i === 0 ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5);
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

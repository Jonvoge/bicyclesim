import Phaser from 'phaser';
import { RIDERS } from '../data/riders.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import type { BaseStatKey } from '../data/types.ts';
import { riderStandings, type SeasonState } from '../sim/season.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * The peloton (world layer, SPEC §6): a read-only profile of every rider — team,
 * age, season points, and the five base stats (CLM / FLAT / SPR / PUN / END), the
 * rider's best highlighted so you can read their type at a glance.
 */
const STAT_COLS: { key: BaseStatKey; label: string }[] = [
  { key: 'climbing', label: 'CLM' },
  { key: 'flat', label: 'FLAT' },
  { key: 'sprint', label: 'SPR' },
  { key: 'puncheur', label: 'PUN' },
  { key: 'endurance', label: 'END' },
];

export class RidersScene extends Phaser.Scene {
  constructor() {
    super('Riders');
  }

  create(data: { season: SeasonState }): void {
    const { width } = this.scale;
    const points = data.season ? new Map(riderStandings(data.season).map((r) => [r.id, r.points])) : new Map<string, number>();

    makeButton(this, 40, 34, '‹', () => this.scene.start('SeasonHub', { season: data.season }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, 'The Peloton', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);

    // column headers for the stat block (right-aligned grid)
    const statX = (i: number) => width - 172 + i * 34;
    STAT_COLS.forEach((c, i) => this.add.text(statX(i), 66, c.label, { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5));

    const top = 84;
    const rowH = 33;
    // sort: player team first, then by best base stat (their signature strength)
    const best = (id: string): number => Math.max(...STAT_COLS.map((c) => RIDERS.find((r) => r.id === id)!.stats[c.key]));
    const order = [...RIDERS].sort((a, b) => {
      const pa = a.teamId === PLAYER_TEAM.id ? 1 : 0;
      const pb = b.teamId === PLAYER_TEAM.id ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return best(b.id) - best(a.id);
    });

    order.forEach((rider, idx) => {
      const y = top + idx * rowH + 12;
      const isPlayer = rider.teamId === PLAYER_TEAM.id;
      if (isPlayer) this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.buttonSelected, 0.1);
      const col = teamColor(rider.teamId);
      this.add.rectangle(26, y, 10, 10, col.jersey, 1);
      this.add.text(40, y - 6, rider.name, { fontFamily: FONT, fontSize: '13px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      const pts = points.get(rider.id) ?? 0;
      this.add.text(40, y + 9, `age ${rider.age}${pts > 0 ? ` · ${pts} pts` : ''}`, { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0, 0.5);

      const bestVal = Math.max(...STAT_COLS.map((c) => rider.stats[c.key]));
      STAT_COLS.forEach((c, i) => {
        const v = rider.stats[c.key];
        const isBest = v === bestVal;
        this.add.text(statX(i), y, `${v}`, { fontFamily: FONT, fontSize: '12px', fontStyle: isBest ? 'bold' : 'normal', color: isBest ? '#f5c518' : v >= 80 ? COLORS.text : COLORS.textMuted }).setOrigin(0.5);
      });
    });
  }
}

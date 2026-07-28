import Phaser from 'phaser';
import { teamColor } from '../data/teamColors.ts';
import type { BaseStatKey } from '../data/types.ts';
import { riderRating } from '../sim/rating.ts';
import { riderStandings } from '../sim/season.ts';
import { racingRoster, type DynastyState } from '../state/dynasty.ts';
import { makeButton } from '../ui/button.ts';
import { ScrollView } from '../ui/scrollView.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * The peloton (world layer, SPEC §6): a read-only profile of every rider — team,
 * age, season points, and the five base stats (CLM / FLAT / SPR / PUN / END), the
 * rider's best highlighted so you can read their type at a glance.
 */
type SortKey = BaseStatKey | 'total';

const STAT_COLS: { key: SortKey; label: string }[] = [
  { key: 'total', label: 'TOT' },
  { key: 'climbing', label: 'CLM' },
  { key: 'flat', label: 'FLAT' },
  { key: 'sprint', label: 'SPR' },
  { key: 'puncheur', label: 'PUN' },
  { key: 'endurance', label: 'END' },
];

export class RidersScene extends Phaser.Scene {
  private sortKey: SortKey = 'total';
  private sortAscending = false;

  constructor() {
    super('Riders');
  }

  create(data: { dynasty: DynastyState }): void {
    const { width } = this.scale;
    const points = new Map(riderStandings(data.dynasty.season).map((r) => [r.id, r.points]));

    makeButton(this, 40, 34, '‹', () => this.scene.start('SeasonHub', { dynasty: data.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, 'The Peloton', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);

    // Tap a stat once for best-first, again for worst-first.
    const statX = (i: number) => width - 195 + i * 34;
    STAT_COLS.forEach((c, i) => {
      const active = c.key === this.sortKey;
      this.add
        .text(statX(i), 66, `${c.label}${active ? (this.sortAscending ? '↑' : '↓') : ''}`, {
          fontFamily: FONT,
          fontSize: '9px',
          fontStyle: active ? 'bold' : 'normal',
          color: active ? '#f5c518' : COLORS.textMuted,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (this.sortKey === c.key) this.sortAscending = !this.sortAscending;
          else {
            this.sortKey = c.key;
            this.sortAscending = false;
          }
          this.scene.restart({ dynasty: data.dynasty });
        });
    });

    const top = 84;
    const rowH = 33;
    // Every contracted rider, ordered by the selected stat.
    const field = racingRoster(data.dynasty);
    const value = (r: (typeof field)[number], key: SortKey): number => key === 'total' ? riderRating(r) : r.stats[key];
    const direction = this.sortAscending ? 1 : -1;
    const order = [...field].sort((a, b) => direction * (value(a, this.sortKey) - value(b, this.sortKey)) || a.name.localeCompare(b.name));

    // the field is ~45 riders → scroll the list
    const scroll = new ScrollView(this, 78, 844, top + order.length * rowH + 12);
    order.forEach((rider, idx) => {
      const y = top + idx * rowH + 12;
      const isPlayer = rider.teamId === data.dynasty.playerTeamId;
      if (isPlayer) scroll.add(this.add.rectangle(width / 2, y, width - 20, rowH - 4, COLORS.buttonSelected, 0.1));
      const col = teamColor(rider.teamId);
      scroll.add(this.add.rectangle(26, y, 10, 10, col.jersey, 1));
      scroll.add(this.add.text(40, y - 6, rider.name, { fontFamily: FONT, fontSize: '13px', color: isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5));
      const pts = points.get(rider.id) ?? 0;
      scroll.add(this.add.text(40, y + 9, `age ${rider.age}${pts > 0 ? ` · ${pts} pts` : ''}`, { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0, 0.5));

      const bestVal = Math.max(rider.stats.climbing, rider.stats.flat, rider.stats.sprint, rider.stats.puncheur, rider.stats.endurance);
      STAT_COLS.forEach((c, i) => {
        const v = value(rider, c.key);
        const isBest = c.key !== 'total' && v === bestVal;
        scroll.add(this.add.text(statX(i), y, `${Math.round(v)}`, { fontFamily: FONT, fontSize: '12px', fontStyle: isBest ? 'bold' : 'normal', color: isBest ? '#f5c518' : v >= 80 ? COLORS.text : COLORS.textMuted }).setOrigin(0.5));
      });
    });
  }
}

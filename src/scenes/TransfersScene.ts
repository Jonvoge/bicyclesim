import Phaser from 'phaser';
import { teamColor } from '../data/teamColors.ts';
import { MAX_SQUAD_SIZE } from '../data/tuning.ts';
import { scoutReport } from '../sim/development.ts';
import { salaryOf } from '../sim/management.ts';
import { riderRating, riderType, signingFeeFor, statLine } from '../sim/rating.ts';
import {
  freeAgents,
  playerBudget,
  playerRiders,
  signRider,
  type DynastyState,
} from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const MAX_VISIBLE = 9; // rows that fit without scrolling (avoids interactive-in-scroll issues)

/**
 * Transfers (Phase 5, free agency): the market of unsigned riders. Each shows a
 * one-off signing fee plus the salary they add to the wage bill — so a star is a
 * real commitment, not a free upgrade. Budget and the squad cap gate the deal.
 */
export class TransfersScene extends Phaser.Scene {
  private dynasty!: DynastyState;
  private note = '';

  constructor() {
    super('Transfers');
  }

  create(data: { dynasty: DynastyState; note?: string }): void {
    this.dynasty = data.dynasty;
    this.note = data.note ?? '';
    const { width } = this.scale;

    makeButton(this, 40, 30, '‹', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, 'Transfers', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 47, 'free agents · potential is a scout’s guess', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    // budget strip
    this.add.rectangle(width / 2, 76, width - 24, 24, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(20, 76, `💰 ${playerBudget(this.dynasty).toLocaleString()}`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(0, 0.5);
    this.add.text(width - 20, 76, `squad ${playerRiders(this.dynasty).length}/${MAX_SQUAD_SIZE}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);

    if (this.note) this.add.text(width / 2, 100, this.note, { fontFamily: FONT, fontSize: '11px', color: '#e28f3b' }).setOrigin(0.5);

    // rank by the better of what they are now and what they might become, so both
    // ready-made stars and promising raw prospects surface near the top
    const all = freeAgents(this.dynasty)
      .slice()
      .sort((a, b) => Math.max(riderRating(b), scoutReport(b).ceiling) - Math.max(riderRating(a), scoutReport(a).ceiling));
    if (all.length === 0) {
      this.add.text(width / 2, 200, 'No free agents available.', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
      return;
    }
    const market = all.slice(0, MAX_VISIBLE);

    const top = 118;
    const rowH = 72;
    market.forEach((r, i) => {
      const y = top + i * rowH;
      const col = teamColor(r.teamId);
      const sc = scoutReport(r);
      const stars = '★'.repeat(sc.stars) + '·'.repeat(5 - sc.stars);
      const young = !sc.certain;
      this.add.rectangle(width / 2, y + 30, width - 24, rowH - 8, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
      this.add.rectangle(28, y + 12, 9, 9, col.jersey, 1);
      this.add.text(42, y + 12, r.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);
      // archetype + who/where/what-now, so the rider's type reads at a glance
      this.add.text(42, y + 31, `${riderType(r)} · ${r.nationality} · age ${r.age} · now ${riderRating(r)}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);
      // current stats — viewable before you commit the fee
      this.add.text(42, y + 50, statLine(r), { fontFamily: FONT, fontSize: '10px', color: '#8fb4c8' }).setOrigin(0, 0.5);
      // potential (fuzzy for the young → gold to flag the gamble)
      this.add.text(width - 92, y + 31, `${stars} ${young ? sc.label : ''}`.trim(), { fontFamily: FONT, fontSize: '10px', color: young ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.text(width - 92, y + 12, `fee ${signingFeeFor(riderRating(r))} · ${salaryOf(r)}/yr`, { fontFamily: FONT, fontSize: '11px', color: '#f5c518' }).setOrigin(1, 0.5);
      makeButton(this, width - 48, y + 30, 'Sign', () => this.sign(r.id), { width: 74, height: 26, fontSize: 12, fill: COLORS.buttonSelected });
    });
    if (all.length > MAX_VISIBLE) {
      this.add.text(width / 2, top + market.length * rowH + 4, `… +${all.length - MAX_VISIBLE} more (top ${MAX_VISIBLE} shown)`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);
    }
  }

  private sign(riderId: string): void {
    const res = signRider(this.dynasty, riderId);
    saveDynasty(this.dynasty);
    this.scene.restart({ dynasty: this.dynasty, note: res.ok ? '' : res.reason });
  }
}

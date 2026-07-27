import Phaser from 'phaser';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS, TEAMS_BY_ID } from '../data/teams.ts';
import { MAX_SQUAD_SIZE } from '../data/tuning.ts';
import { scoutReport } from '../sim/development.ts';
import { salaryOf, sponsorIncome } from '../sim/management.ts';
import { riderRating, riderType, statLine } from '../sim/rating.ts';
import {
  playerBudget,
  playerRiders,
  playerWageBill,
  releaseRider,
  type DynastyState,
} from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Team HQ (Phase 5): the between-races management hub. Finances at the top
 * (budget, wage bill, next sponsor cheque), the squad with each rider's value and
 * contract, a Release lever, and the doors to Transfers and Development.
 */
export class TeamScene extends Phaser.Scene {
  private dynasty!: DynastyState;
  private note = '';

  constructor() {
    super('Team');
  }

  create(data: { dynasty: DynastyState; note?: string }): void {
    this.dynasty = data.dynasty;
    this.note = data.note ?? '';
    const { width } = this.scale;

    makeButton(this, 40, 30, '‹', () => this.scene.start('SeasonHub', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, 'Team HQ', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 47, TEAMS_BY_ID.get(this.dynasty.playerTeamId)?.name ?? "", { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    // finances panel
    const squad = playerRiders(this.dynasty);
    const sponsor = sponsorIncome(this.dynasty.lastTeamRank[this.dynasty.playerTeamId], TEAMS.length);
    this.add.rectangle(width / 2, 96, width - 24, 64, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.stat(24, 82, 'BUDGET', `${playerBudget(this.dynasty).toLocaleString()}`, '#18b39a');
    this.stat(24, 112, 'WAGE BILL', `${playerWageBill(this.dynasty).toLocaleString()}/yr`, COLORS.text);
    this.stat(width - 24, 82, 'NEXT SPONSOR', `~${sponsor.toLocaleString()}`, COLORS.text, true);
    this.stat(width - 24, 112, 'SQUAD', `${squad.length}/${MAX_SQUAD_SIZE}`, COLORS.text, true);

    // actions
    makeButton(this, width / 2 - 122, 152, 'Transfers', () => this.scene.start('Transfers', { dynasty: this.dynasty }), { width: 114, height: 34, fontSize: 13, fill: COLORS.buttonSelected });
    makeButton(this, width / 2, 152, 'Season Focus', () => this.scene.start('FocusPlan', { dynasty: this.dynasty }), { width: 114, height: 34, fontSize: 13, fill: COLORS.buttonSelected });
    makeButton(this, width / 2 + 122, 152, 'Development', () => this.scene.start('Training', { dynasty: this.dynasty }), { width: 114, height: 34, fontSize: 13, fill: COLORS.buttonSelected });

    if (this.note) this.add.text(width / 2, 176, this.note, { fontFamily: FONT, fontSize: '11px', color: '#e28f3b' }).setOrigin(0.5);

    // squad list
    this.add.text(20, 194, 'SQUAD', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted });
    this.add.text(width - 20, 194, 'rating · salary · yrs', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5);
    const top = 214;
    const rowH = 68;
    squad
      .slice()
      .sort((a, b) => riderRating(b) - riderRating(a))
      .forEach((r, i) => {
        const y = top + i * rowH;
        const col = teamColor(r.teamId);
        this.add.rectangle(width / 2, y + 26, width - 24, rowH - 8, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
        this.add.rectangle(28, y + 12, 9, 9, col.jersey, 1);
        this.add.text(42, y + 12, r.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);
        const sc = scoutReport(r);
        const potential = sc.certain ? '' : `  ·  ${'★'.repeat(sc.stars)}${'·'.repeat(5 - sc.stars)} potential`;
        // archetype up front so you can read the squad's shape at a glance
        this.add.text(42, y + 30, `${riderType(r)} · age ${r.age}${potential}`, { fontFamily: FONT, fontSize: '10px', color: sc.certain ? COLORS.textMuted : '#f5c518' }).setOrigin(0, 0.5);
        this.add.text(42, y + 48, statLine(r), { fontFamily: FONT, fontSize: '10px', color: '#8fb4c8' }).setOrigin(0, 0.5);
        this.add
          .text(width - 88, y + 12, `${riderRating(r)} · ${salaryOf(r)} · ${r.contractSeasonsLeft ?? '—'}yr`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted })
          .setOrigin(1, 0.5);
        makeButton(this, width - 48, y + 34, 'Release', () => this.release(r.id), { width: 74, height: 22, fontSize: 11 });
      });
  }

  private stat(x: number, y: number, label: string, value: string, color: string, right = false): void {
    const originX = right ? 1 : 0;
    this.add.text(x, y - 7, label, { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(originX, 0.5);
    this.add.text(x, y + 8, value, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color }).setOrigin(originX, 0.5);
  }

  private release(riderId: string): void {
    const res = releaseRider(this.dynasty, riderId);
    saveDynasty(this.dynasty);
    this.scene.restart({ dynasty: this.dynasty, note: res.ok ? '' : res.reason });
  }
}

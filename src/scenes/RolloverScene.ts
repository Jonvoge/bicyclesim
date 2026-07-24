import Phaser from 'phaser';
import { rosterById, playerBudget, rolloverSeason, type DynastyState } from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * End-of-season rollover (Phase 5): settle the books (sponsor cheque minus the
 * wage bill), tick contracts, rest the peloton over the winter, and open the next
 * season. Performed once, here, then the player rolls into Season N+1.
 */
export class RolloverScene extends Phaser.Scene {
  constructor() {
    super('Rollover');
  }

  create(data: { dynasty: DynastyState }): void {
    const dynasty = data.dynasty;
    const summary = rolloverSeason(dynasty); // performs the transition
    saveDynasty(dynasty);
    const { width } = this.scale;

    this.add.text(width / 2, 80, `Season ${summary.seasonNumber} complete`, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 112, `You finished ${ordinal(summary.teamRank)} of the season`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    // finances settlement panel
    this.add.rectangle(width / 2, 200, width - 40, 132, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(width / 2, 152, 'END-OF-SEASON ACCOUNTS', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
    this.line(width, 182, 'Sponsor cheque', `+${summary.sponsor.toLocaleString()}`, '#18b39a');
    this.line(width, 208, 'Wage bill', `−${summary.wages.toLocaleString()}`, '#e28f3b');
    this.add.rectangle(width / 2, 228, width - 60, 1, COLORS.stroke, 1);
    this.line(width, 246, 'Net', `${summary.net >= 0 ? '+' : '−'}${Math.abs(summary.net).toLocaleString()}`, summary.net >= 0 ? '#18b39a' : '#e23b3b');

    this.add.text(width / 2, 300, `New budget: ${playerBudget(dynasty).toLocaleString()}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(0.5);

    // contract renewals
    let y = 350;
    if (summary.expiring.length > 0) {
      const byId = rosterById(dynasty);
      this.add.text(width / 2, y, 'CONTRACTS RENEWED', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
      y += 22;
      for (const id of summary.expiring) {
        this.add.text(width / 2, y, byId.get(id)?.name ?? id, { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setOrigin(0.5);
        y += 20;
      }
      y += 8;
    }

    this.add
      .text(width / 2, y + 8, 'The squad rests over the winter, then the new season begins.\nTip: visit Team HQ to sign, release and train before Race 1.', {
        fontFamily: FONT,
        fontSize: '12px',
        color: COLORS.textMuted,
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5, 0);

    makeButton(this, width / 2, 806, `Start Season ${dynasty.seasonNumber} →`, () => this.scene.start('SeasonHub', { dynasty }), {
      width: 300,
      height: 50,
      fontSize: 18,
      fill: COLORS.buttonSelected,
    });
  }

  private line(width: number, y: number, label: string, value: string, color: string): void {
    this.add.text(40, y, label, { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setOrigin(0, 0.5);
    this.add.text(width - 40, y, value, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color }).setOrigin(1, 0.5);
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

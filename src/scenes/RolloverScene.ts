import Phaser from 'phaser';
import { dynastyTeamName, rosterById, playerBudget, rolloverSeason, type DynastyState } from '../state/dynasty.ts';
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

    this.add.text(width / 2, 58, `Season ${summary.seasonNumber} complete`, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 88, `You finished ${ordinal(summary.teamRank)} in your division`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
    if (summary.movement) {
      const promoted = summary.movement.promotedTeamIds.includes(dynasty.playerTeamId);
      const relegated = summary.movement.relegatedTeamIds.includes(dynasty.playerTeamId);
      const movementText = promoted
        ? 'PROMOTED TO WORLD TOUR'
        : relegated
          ? 'RELEGATED TO PRO TOUR'
          : `REMAINING IN ${summary.currentDivision === 'world' ? 'WORLD TOUR' : 'PRO TOUR'}`;
      this.add.text(width / 2, 112, movementText, {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: promoted ? COLORS.accentText : relegated ? '#e28f3b' : COLORS.textMuted,
      }).setOrigin(0.5);
    }

    // finances settlement panel
    this.add.rectangle(width / 2, 200, width - 40, 132, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(width / 2, 152, 'END-OF-SEASON ACCOUNTS', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
    this.line(width, 182, 'Sponsor cheque', `+${summary.sponsor.toLocaleString()}`, COLORS.accentText);
    this.line(width, 208, 'Wage bill', `−${summary.wages.toLocaleString()}`, '#e28f3b');
    this.add.rectangle(width / 2, 228, width - 60, 1, COLORS.stroke, 1);
    this.line(width, 246, 'Net', `${summary.net >= 0 ? '+' : '−'}${Math.abs(summary.net).toLocaleString()}`, summary.net >= 0 ? COLORS.accentText : '#e23b3b');

    this.add.text(width / 2, 298, `New budget: ${playerBudget(dynasty).toLocaleString()}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: COLORS.accentText }).setOrigin(0.5);

    // season objective result (Season Focus ext, Part E)
    this.add
      .text(width / 2, 322, `🎯 ${summary.objectiveText}: ${summary.objectiveMet ? `MET  +${summary.objectiveReward}` : 'missed'}`, {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: summary.objectiveMet ? COLORS.accentText : COLORS.textMuted,
      })
      .setOrigin(0.5);

    if (summary.movement && dynasty.world) {
      const promoted = summary.movement.promotedTeamIds.map((teamId) => dynastyTeamName(dynasty, teamId)).join(', ');
      const relegated = summary.movement.relegatedTeamIds.map((teamId) => dynastyTeamName(dynasty, teamId)).join(', ');
      this.add.text(width / 2, 348, `UP  ${promoted}   ·   DOWN  ${relegated}`, {
        fontFamily: FONT,
        fontSize: '9px',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: width - 44 },
      }).setOrigin(0.5);
      const champions = dynasty.world.history.teamChampions.filter((entry) => entry.season === summary.seasonNumber);
      this.add.text(width / 2, 370, champions.map((entry) => `${entry.division === 'world' ? 'World' : 'Pro'} champion: ${dynastyTeamName(dynasty, entry.teamId)}`).join('   ·   '), {
        fontFamily: FONT,
        fontSize: '9px',
        color: COLORS.textMuted,
        align: 'center',
        wordWrap: { width: width - 44 },
      }).setOrigin(0.5);
    }

    // squad & peloton changes over the winter (Phase 6)
    const byId = rosterById(dynasty);
    let y = summary.movement ? 398 : 350;
    if (summary.retired.length > 0) {
      this.add.text(width / 2, y, '🚴 RETIRED FROM YOUR SQUAD', { fontFamily: FONT, fontSize: '12px', color: '#e28f3b' }).setOrigin(0.5);
      y += 22;
      for (const rider of summary.retired) {
        this.add.text(width / 2, y, rider.name, { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setOrigin(0.5);
        y += 20;
      }
      y += 10;
    }
    if (summary.autoSigned.length > 0) {
      this.add.text(width / 2, y, 'ACADEMY CALL-UPS (filled a gap)', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
      y += 22;
      for (const id of summary.autoSigned) {
        this.add.text(width / 2, y, byId.get(id)?.name ?? id, { fontFamily: FONT, fontSize: '13px', color: COLORS.accentText }).setOrigin(0.5);
        y += 20;
      }
      y += 10;
    }

    this.add.text(width / 2, y, `${summary.emerged} young riders turned pro · ${summary.retiredAll} retired across the peloton`, { fontFamily: FONT, fontSize: '12px', color: COLORS.text }).setOrigin(0.5);
    y += 26;

    this.add
      .text(width / 2, y, 'New prospects are on the market with fuzzy potential —\nscout and sign the future in Team HQ → Transfers.', {
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

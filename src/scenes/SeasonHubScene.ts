import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import { isSeasonComplete, riderStandings } from '../sim/season.ts';
import {
  playerBudget,
  playerWageBill,
  rosterById,
  type DynastyState,
} from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Season hub (Phase 4 + 5): the calendar with results so far, the team's finances
 * at a glance, world-layer navigation, the door to Team HQ (squad, transfers,
 * training), and the button to ride the next race. A finished season crowns its
 * champion and rolls the dynasty into the next year.
 */
export class SeasonHubScene extends Phaser.Scene {
  private dynasty!: DynastyState;

  constructor() {
    super('SeasonHub');
  }

  create(data: { dynasty: DynastyState }): void {
    this.dynasty = data.dynasty;
    saveDynasty(this.dynasty); // persist progress on every return to the hub
    const { width } = this.scale;
    const season = this.dynasty.season;
    const done = isSeasonComplete(season);

    makeButton(this, 40, 30, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, `Season ${this.dynasty.seasonNumber}`, { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    const contested = season.results.length;
    this.add
      .text(width / 2, 47, done ? 'Season complete' : `Race ${contested + 1} of ${season.calendar.length}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted })
      .setOrigin(0.5);

    // navigation: world layer + team HQ
    makeButton(this, width / 2 - 108, 76, 'Standings', () => this.scene.start('Standings', { dynasty: this.dynasty }), { width: 108, height: 30, fontSize: 12 });
    makeButton(this, width / 2, 76, 'Peloton', () => this.scene.start('Riders', { dynasty: this.dynasty }), { width: 108, height: 30, fontSize: 12 });
    makeButton(this, width / 2 + 108, 76, 'Team HQ', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 108, height: 30, fontSize: 12, fill: COLORS.buttonSelected });

    // finances strip
    this.add.rectangle(width / 2, 104, width - 24, 24, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(20, 104, `💰 ${playerBudget(this.dynasty).toLocaleString()}`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(0, 0.5);
    this.add.text(width - 20, 104, `wages ${playerWageBill(this.dynasty).toLocaleString()}/yr`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);

    // season-lead glance
    const lead = riderStandings(season)[0];
    if (lead) {
      const r = rosterById(this.dynasty).get(lead.id)!;
      this.add.rectangle(width / 2, 132, width - 24, 24, COLORS.panel, 1).setStrokeStyle(1, COLORS.gold);
      this.add.text(20, 132, '🟡 SEASON LEAD', { fontFamily: FONT, fontSize: '11px', color: '#f5c518' }).setOrigin(0, 0.5);
      this.add.text(width - 20, 132, `${r.name} · ${lead.points} pts`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text }).setOrigin(1, 0.5);
    }

    this.buildCalendar(width, done);

    if (!done) {
      const race = RACES_BY_ID.get(season.calendar[season.eventIndex])!;
      makeButton(this, width / 2, 806, `Ride: ${race.name} →`, () => this.scene.start('PreRace', { dynasty: this.dynasty }), {
        width: 320,
        height: 50,
        fontSize: 18,
        fill: COLORS.buttonSelected,
      });
    } else {
      this.buildChampion(width);
      makeButton(this, width / 2, 806, 'End season →', () => this.scene.start('Rollover', { dynasty: this.dynasty }), { width: 300, height: 48, fontSize: 18, fill: COLORS.buttonSelected });
    }
  }

  private buildCalendar(width: number, done: boolean): void {
    const season = this.dynasty.season;
    const top = 158;
    const rowH = 43;
    season.calendar.forEach((raceId, i) => {
      const race = RACES_BY_ID.get(raceId)!;
      const y = top + i * rowH + 14;
      const isNext = !done && i === season.eventIndex;
      const isDone = i < season.results.length;

      const bg = this.add.rectangle(width / 2, y, width - 24, rowH - 6, isNext ? COLORS.panelAlt : COLORS.panel, 1).setStrokeStyle(isNext ? 2 : 1, isNext ? COLORS.buttonSelected : COLORS.stroke);
      if (isDone) {
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Archive', { dynasty: this.dynasty, index: i }));
      }

      const stages = race.stageIds.length;
      const kind = stages === 1 ? 'one-day' : `${stages} stages`;
      this.add.text(24, y - 6, race.name, { fontFamily: FONT, fontSize: '14px', color: isDone ? COLORS.textMuted : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(24, y + 9, `${kind} · prestige ${race.prestige}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);

      if (isDone) {
        const winner = rosterById(this.dynasty).get(season.results[i].winnerId);
        if (winner) {
          const col = teamColor(winner.teamId);
          this.add.rectangle(width - 150, y, 8, 8, col.jersey, 1);
          const isPlayer = winner.teamId === PLAYER_TEAM.id;
          this.add.text(width - 140, y, winner.name, { fontFamily: FONT, fontSize: '12px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
        }
      } else if (isNext) {
        this.add.text(width - 24, y, '▶ NEXT', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(1, 0.5);
      } else {
        this.add.text(width - 24, y, 'upcoming', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      }
    });
  }

  private buildChampion(width: number): void {
    const champ = riderStandings(this.dynasty.season)[0];
    if (!champ) return;
    const r = rosterById(this.dynasty).get(champ.id)!;
    const isPlayer = r.teamId === PLAYER_TEAM.id;
    this.add.rectangle(width / 2, 748, width - 30, 40, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2, 736, '🏆 SEASON CHAMPION', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(width / 2, 756, `${r.name} · ${champ.points} pts`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0.5);
  }
}

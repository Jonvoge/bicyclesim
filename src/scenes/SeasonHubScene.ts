import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import { isSeasonComplete, riderStandings, type SeasonState } from '../sim/season.ts';
import { saveSeason } from '../state/seasonStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Season hub (Phase 4): the calendar with results so far, a glance at the season
 * lead, world-layer navigation (full standings, the peloton), and the button to
 * ride the next race. On a finished season it crowns the champion.
 */
export class SeasonHubScene extends Phaser.Scene {
  private season!: SeasonState;

  constructor() {
    super('SeasonHub');
  }

  create(data: { season: SeasonState }): void {
    this.season = data.season;
    saveSeason(this.season); // persist progress on every return to the hub
    const { width } = this.scale;
    const done = isSeasonComplete(this.season);

    makeButton(this, 40, 34, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 28, 'Season', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    const contested = this.season.results.length;
    this.add
      .text(width / 2, 52, done ? 'Season complete' : `Race ${contested + 1} of ${this.season.calendar.length}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted })
      .setOrigin(0.5);

    // world-layer navigation
    makeButton(this, width / 2 - 82, 84, 'Standings', () => this.scene.start('Standings', { season: this.season }), { width: 150, height: 32, fontSize: 14 });
    makeButton(this, width / 2 + 82, 84, 'Peloton', () => this.scene.start('Riders', { season: this.season }), { width: 150, height: 32, fontSize: 14 });

    // season-lead glance
    const lead = riderStandings(this.season)[0];
    if (lead) {
      const r = RIDERS_BY_ID.get(lead.id)!;
      this.add.rectangle(width / 2, 118, width - 30, 26, COLORS.panel, 1).setStrokeStyle(1, COLORS.gold);
      this.add.text(24, 118, '🟡 SEASON LEAD', { fontFamily: FONT, fontSize: '11px', color: '#f5c518' }).setOrigin(0, 0.5);
      this.add.text(width - 24, 118, `${r.name} · ${lead.points} pts`, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text }).setOrigin(1, 0.5);
    }

    this.buildCalendar(width, done);

    // ride-next / finish
    if (!done) {
      const race = RACES_BY_ID.get(this.season.calendar[this.season.eventIndex])!;
      makeButton(this, width / 2, 806, `Ride: ${race.name} →`, () => this.scene.start('PreRace', { season: this.season }), {
        width: 320,
        height: 50,
        fontSize: 18,
        fill: COLORS.buttonSelected,
      });
    } else {
      this.buildChampion(width);
      makeButton(this, width / 2, 806, 'Back to menu', () => this.scene.start('MainMenu'), { width: 260, height: 46, fontSize: 18 });
    }
  }

  private buildCalendar(width: number, done: boolean): void {
    const top = 146;
    const rowH = 44;
    this.season.calendar.forEach((raceId, i) => {
      const race = RACES_BY_ID.get(raceId)!;
      const y = top + i * rowH + 16;
      const isNext = !done && i === this.season.eventIndex;
      const isDone = i < this.season.results.length;

      const bg = this.add.rectangle(width / 2, y, width - 24, rowH - 6, isNext ? COLORS.panelAlt : COLORS.panel, 1).setStrokeStyle(isNext ? 2 : 1, isNext ? COLORS.buttonSelected : COLORS.stroke);
      if (isDone) {
        bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Archive', { season: this.season, index: i }));
      }

      const stages = race.stageIds.length;
      const kind = stages === 1 ? STAGES_BY_ID.get(race.stageIds[0])!.type : `${stages} stages`;
      this.add.text(26, y - 6, race.name, { fontFamily: FONT, fontSize: '14px', color: isDone ? COLORS.textMuted : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(26, y + 10, `${kind} · prestige ${race.prestige}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);

      if (isDone) {
        const winner = RIDERS_BY_ID.get(this.season.results[i].winnerId);
        if (winner) {
          const col = teamColor(winner.teamId);
          this.add.rectangle(width - 150, y, 8, 8, col.jersey, 1);
          const isPlayer = winner.teamId === PLAYER_TEAM.id;
          this.add.text(width - 140, y, winner.name, { fontFamily: FONT, fontSize: '12px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
        }
      } else if (isNext) {
        this.add.text(width - 26, y, '▶ NEXT', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#18b39a' }).setOrigin(1, 0.5);
      } else {
        this.add.text(width - 26, y, 'upcoming', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      }
    });
  }

  private buildChampion(width: number): void {
    const champ = riderStandings(this.season)[0];
    if (!champ) return;
    const r = RIDERS_BY_ID.get(champ.id)!;
    const isPlayer = r.teamId === PLAYER_TEAM.id;
    this.add.rectangle(width / 2, 748, width - 30, 40, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2, 736, '🏆 SEASON CHAMPION', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0.5);
    this.add.text(width / 2, 756, `${r.name} · ${champ.points} pts`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0.5);
  }
}

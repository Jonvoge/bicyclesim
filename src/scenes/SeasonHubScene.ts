import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { objectiveStatus } from '../sim/objectives.ts';
import { divisionStatus } from '../sim/competition.ts';
import { isSeasonComplete, riderStandings, teamStandings } from '../sim/season.ts';
import {
  playerBudget,
  dynastyObjective,
  dynastyTeamName,
  playerWageBill,
  rosterById,
  teamOf,
  type DynastyState,
} from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { StageProfileView } from '../ui/stageProfile.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const ACCENT_TEXT = '#f2c94c';

/** Mobile-first season dashboard: anticipation now, context at a glance, history on demand. */
export class SeasonHubScene extends Phaser.Scene {
  private dynasty!: DynastyState;

  constructor() {
    super('SeasonHub');
  }

  create(data: { dynasty: DynastyState }): void {
    this.dynasty = data.dynasty;
    saveDynasty(this.dynasty);

    const { width } = this.scale;
    const done = isSeasonComplete(this.dynasty.season);
    this.buildHeader(width, done);
    this.buildSeasonTracker(width, done);

    if (done) {
      this.buildSeasonComplete(width);
    } else {
      this.buildNextRace(width);
      this.buildObjective(width);
      this.buildSeasonPulse(width);
    }

    this.buildNavigation(width);
  }

  private buildHeader(width: number, done: boolean): void {
    const teamName = dynastyTeamName(this.dynasty, this.dynasty.playerTeamId);

    this.add.rectangle(width / 2, 58, width, 116, COLORS.panel, 1);
    this.add.rectangle(width / 2, 115, width, 2, COLORS.buttonSelected, 1);

    makeButton(this, 34, 32, '‹', () => this.scene.start('MainMenu'), {
      width: 40,
      height: 36,
      fontSize: 22,
      fill: COLORS.buttonSelected,
    });
    this.add.text(64, 22, `SEASON ${this.dynasty.seasonNumber}`, {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });
    this.add.text(64, 42, teamName, {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: COLORS.text,
    });
    if (this.dynasty.world) {
      const status = divisionStatus(this.dynasty.world, this.dynasty.playerTeamId, this.dynasty.seasonNumber);
      const divisionName = status.division === 'world' ? 'WORLD TOUR' : 'PRO TOUR';
      const lineLabel = status.division === 'pro' ? 'TO PROMOTION' : 'TO SAFETY';
      this.add.text(64, 67, `${divisionName}  #${status.rank}/${status.teamCount}  ·  ${status.points} PTS  ·  ${status.pointsToLine} ${lineLabel}`, {
        fontFamily: FONT,
        fontSize: '9px',
        fontStyle: 'bold',
        color: status.pointsToLine === 0 ? COLORS.accentText : COLORS.textMuted,
      });
    }

    this.add.text(18, 87, `FUNDS  ${playerBudget(this.dynasty).toLocaleString()}`, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: COLORS.text,
    });
    this.add.text(width - 18, 87, done ? 'SEASON COMPLETE' : `WAGES  ${playerWageBill(this.dynasty).toLocaleString()}/YR`, {
      fontFamily: FONT,
      fontSize: '10px',
      color: COLORS.textMuted,
    }).setOrigin(1, 0);
  }

  private buildSeasonTracker(width: number, done: boolean): void {
    const season = this.dynasty.season;
    const current = Math.min(season.eventIndex, season.calendar.length - 1);
    const windowName = current < 9 ? 'SPRING CLASSICS' : current < 13 ? 'SUMMER TOURS' : 'AUTUMN FINALE';
    const label = done ? 'CAMPAIGN COMPLETE' : `${windowName}  ·  ${current + 1}/${season.calendar.length}`;

    this.add.text(18, 130, label, {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });

    const left = 20;
    const right = width - 20;
    const y = 159;
    const gap = (right - left) / (season.calendar.length - 1);
    this.add.rectangle(width / 2, y, right - left, 3, COLORS.stroke, 0.45);
    season.calendar.forEach((raceId, index) => {
      const x = left + index * gap;
      const completed = index < season.results.length;
      const active = !done && index === season.eventIndex;
      const fill = completed || active ? COLORS.buttonSelected : COLORS.panel;
      const wildcard = this.dynasty.world?.eventFields
        .find((field) => field.season === this.dynasty.seasonNumber && field.raceId === raceId)
        ?.wildcards.some((invite) => invite.teamId === this.dynasty.playerTeamId);
      this.add.circle(x, y, active ? 7 : 5, fill, 1)
        .setStrokeStyle(active ? 3 : 1.5, active ? COLORS.buttonSelected : wildcard ? COLORS.gold : COLORS.stroke);
    });
  }

  private buildNextRace(width: number): void {
    const season = this.dynasty.season;
    const race = RACES_BY_ID.get(season.calendar[season.eventIndex])!;
    const stage = STAGES_BY_ID.get(race.stageIds[0])!;
    const isTour = race.stageIds.length > 1;
    const eventField = this.dynasty.world?.eventFields.find(
      (field) => field.season === this.dynasty.seasonNumber && field.raceId === race.id,
    );
    const wildcard = eventField?.wildcards.find((invite) => invite.teamId === this.dynasty.playerTeamId);

    this.add.rectangle(width / 2, 304, width - 32, 248, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.rectangle(70, 198, 92, 26, COLORS.buttonSelected, 1);
    this.add.text(70, 198, 'NEXT UP', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: COLORS.textDark,
    }).setOrigin(0.5);

    this.add.text(28, 228, race.name, {
      fontFamily: FONT,
      fontSize: race.name.length > 20 ? '22px' : '26px',
      fontStyle: 'bold',
      color: COLORS.text,
    });
    const raceKind = isTour ? `${race.stageIds.length} STAGES` : 'ONE-DAY CLASSIC';
    const fieldLabel = eventField ? `  ·  ${eventField.teamIds.length} TEAMS${wildcard ? '  ·  WILDCARD' : ''}` : '';
    this.add.text(29, 260, `${raceKind}  ·  ${stage.lengthKm} KM  ·  PRESTIGE ${race.prestige}${fieldLabel}`, {
      fontFamily: FONT,
      fontSize: fieldLabel ? '9px' : '10px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });

    new StageProfileView(this, 29, 284, width - 58, 76, stage);
    this.add.text(36, 294, stage.type.replace(/([A-Z])/g, ' $1').toUpperCase(), {
      fontFamily: FONT,
      fontSize: '10px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });

    makeButton(this, width / 2, 398, `RIDE ${race.name.toUpperCase()}  ›`, () => this.scene.start('PreRace', { dynasty: this.dynasty }), {
      width: width - 58,
      height: 48,
      fontSize: race.name.length > 20 ? 13 : 15,
      fill: COLORS.buttonSelected,
    });
  }

  private buildObjective(width: number): void {
    const season = this.dynasty.season;
    const objective = dynastyObjective(this.dynasty);
    const status = objectiveStatus(objective, season, (id) => teamOf(this.dynasty, id) === this.dynasty.playerTeamId);
    const progress = Math.min(1, status.target === 0 ? 1 : status.current / status.target);

    this.add.rectangle(width / 2, 491, width - 32, 86, status.met ? COLORS.panelAlt : COLORS.panel, 1)
      .setStrokeStyle(1, status.met ? COLORS.gold : COLORS.stroke);
    this.add.text(28, 459, status.met ? 'SPONSOR GOAL COMPLETE!' : 'SPONSOR CHALLENGE', {
      fontFamily: FONT,
      fontSize: '10px',
      fontStyle: 'bold',
      color: ACCENT_TEXT,
    });
    this.add.text(28, 478, objective.text, {
      fontFamily: FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color: COLORS.text,
    });
    this.add.text(width - 28, 478, status.met ? `+${objective.reward}` : `${status.current}/${status.target}`, {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: ACCENT_TEXT,
    }).setOrigin(1, 0);

    const barX = 28;
    const barY = 518;
    const barWidth = width - 56;
    this.add.rectangle(barX, barY, barWidth, 9, COLORS.panelAlt, 1).setOrigin(0, 0.5);
    if (progress > 0) {
      this.add.rectangle(barX, barY, barWidth * progress, 9, status.met ? COLORS.gold : COLORS.positive, 1).setOrigin(0, 0.5);
    }
  }

  private buildSeasonPulse(width: number): void {
    const season = this.dynasty.season;
    this.add.text(18, 551, season.results.length === 0 ? 'ON DECK' : 'SEASON PULSE', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });

    if (season.results.length === 0) {
      season.calendar.slice(season.eventIndex + 1, season.eventIndex + 3).forEach((raceId, index) => {
        const race = RACES_BY_ID.get(raceId)!;
        this.buildPulseCard(18 + index * 181, 575, index === 0 ? 171 : 173, `${index + 2}`, race.name, 'UPCOMING');
      });
      return;
    }

    const riderRows = riderStandings(season);
    const teamRows = teamStandings(season, (id) => teamOf(this.dynasty, id));
    const leader = rosterById(this.dynasty).get(riderRows[0]?.id);
    const teamRank = this.dynasty.world
      ? divisionStatus(this.dynasty.world, this.dynasty.playerTeamId, this.dynasty.seasonNumber).rank
      : teamRows.findIndex((row) => row.id === this.dynasty.playerTeamId) + 1;
    this.buildPulseCard(18, 575, 171, teamRank > 0 ? `#${teamRank}` : '—', 'Your team', 'TEAM RANK');
    this.buildPulseCard(199, 575, 173, leader ? '#1' : '—', leader?.name ?? 'No leader yet', 'SEASON LEADER');

    const latestIndex = season.results.length - 1;
    const latestRace = RACES_BY_ID.get(season.results[latestIndex].raceId)!;
    const latestWinner = rosterById(this.dynasty).get(season.results[latestIndex].winnerId);
    const recent = this.add.text(width / 2, 653, `Latest: ${latestRace.name}  ·  ${latestWinner?.name ?? 'No finisher'}  ›`, {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.textMuted,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    recent.on('pointerup', () => this.scene.start('Archive', { dynasty: this.dynasty, index: latestIndex }));
  }

  private buildPulseCard(x: number, y: number, cardWidth: number, value: string, label: string, eyebrow: string): void {
    this.add.rectangle(x, y, cardWidth, 66, COLORS.panel, 1).setOrigin(0, 0).setStrokeStyle(1.5, COLORS.stroke);
    this.add.text(x + 12, y + 9, eyebrow, {
      fontFamily: FONT,
      fontSize: '9px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });
    this.add.text(x + 12, y + 27, value, {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: ACCENT_TEXT,
    });
    this.add.text(x + 49, y + 31, label, {
      fontFamily: FONT,
      fontSize: label.length > 18 ? '10px' : '11px',
      fontStyle: 'bold',
      color: COLORS.text,
    });
  }

  private buildSeasonComplete(width: number): void {
    const standings = riderStandings(this.dynasty.season);
    const champion = rosterById(this.dynasty).get(standings[0]?.id);
    const teamRows = teamStandings(this.dynasty.season, (id) => teamOf(this.dynasty, id));
    const teamRank = this.dynasty.world
      ? divisionStatus(this.dynasty.world, this.dynasty.playerTeamId, this.dynasty.seasonNumber).rank
      : teamRows.findIndex((row) => row.id === this.dynasty.playerTeamId) + 1;

    this.add.rectangle(width / 2, 330, width - 32, 270, COLORS.panel, 1).setStrokeStyle(3, COLORS.gold);
    this.add.circle(width / 2, 238, 42, COLORS.buttonSelected, 1).setStrokeStyle(4, COLORS.gold);
    this.add.text(width / 2, 238, '★', { fontFamily: FONT, fontSize: '36px', color: COLORS.textDark }).setOrigin(0.5);
    this.add.text(width / 2, 294, 'SEASON CHAMPION', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: ACCENT_TEXT }).setOrigin(0.5);
    this.add.text(width / 2, 323, champion?.name ?? 'No champion', { fontFamily: FONT, fontSize: '25px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 352, `${standings[0]?.points ?? 0} points`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    this.buildPulseCard(32, 386, 154, `#${Math.max(1, teamRank)}`, 'Your team', 'FINAL RANK');
    this.buildPulseCard(204, 386, 154, `${this.dynasty.season.results.length}`, 'races', 'CAMPAIGN');
    makeButton(this, width / 2, 512, 'END SEASON  ›', () => this.scene.start('Rollover', { dynasty: this.dynasty }), {
      width: width - 64,
      height: 50,
      fontSize: 17,
      fill: COLORS.buttonSelected,
    });
  }

  private buildNavigation(width: number): void {
    this.add.rectangle(width / 2, 757, width, 174, COLORS.panel, 1);
    this.add.text(18, 686, 'EXPLORE', {
      fontFamily: FONT,
      fontSize: '10px',
      fontStyle: 'bold',
      color: COLORS.textMuted,
    });
    if (this.dynasty.world) {
      makeButton(this, 51, 735, 'Tables', () => this.scene.start('Standings', { dynasty: this.dynasty }), { width: 78, height: 52, fontSize: 10 });
      makeButton(this, 147, 735, 'History', () => this.scene.start('WorldHistory', { dynasty: this.dynasty }), { width: 78, height: 52, fontSize: 10 });
      makeButton(this, 243, 735, 'Peloton', () => this.scene.start('Riders', { dynasty: this.dynasty }), { width: 78, height: 52, fontSize: 10 });
      makeButton(this, 339, 735, 'Team HQ', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 78, height: 52, fontSize: 10, fill: COLORS.buttonSelected });
    } else {
      makeButton(this, 70, 735, 'Standings', () => this.scene.start('Standings', { dynasty: this.dynasty }), { width: 104, height: 52, fontSize: 12 });
      makeButton(this, width / 2, 735, 'Peloton', () => this.scene.start('Riders', { dynasty: this.dynasty }), { width: 104, height: 52, fontSize: 12 });
      makeButton(this, width - 70, 735, 'Team HQ', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 104, height: 52, fontSize: 12, fill: COLORS.buttonSelected });
    }
    this.add.text(width / 2, 799, 'Plan peaks · develop riders · chase the season', {
      fontFamily: FONT,
      fontSize: '10px',
      color: COLORS.textMuted,
    }).setOrigin(0.5);
  }
}

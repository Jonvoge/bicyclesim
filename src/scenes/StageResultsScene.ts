import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { teamColor } from '../data/teamColors.ts';
import { TEAMS_BY_ID } from '../data/teams.ts';
import type { Rider, Stage, StageResult } from '../data/types.ts';
import { computeGc, isTourComplete, recordStageResult, type GcRow, type TourState } from '../sim/standings.ts';
import { ROLES_BY_ID, roleOf, type TeamTactics } from '../sim/tactics.ts';
import { finishSeasonEvent, rosterById, type DynastyState } from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { ScrollView } from '../ui/scrollView.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const PLAYER_TEAM_ID = 't-grenoble';

interface ResultsData {
  tour: TourState;
  dynasty?: DynastyState;
  stage: Stage;
  result: StageResult;
  stageRiders: Rider[];
  tacticsByTeam: Map<string, TeamTactics>;
  playerTactics: TeamTactics;
}

/**
 * After a stage: the finishing order and, for a tour, the updated GC (SPEC §5.7,
 * §5.8). This scene is where the stage is BANKED into the tour (fatigue + GC),
 * then it routes on: the next stage, or — on the final stage — the overall
 * classification and the race winner.
 */
export class StageResultsScene extends Phaser.Scene {
  private byId!: Map<string, Rider>;

  constructor() {
    super('StageResults');
  }

  create(data: ResultsData): void {
    const { width } = this.scale;
    const { tour, stage, result, dynasty } = data;
    const isTour = tour.stageIds.length > 1;
    this.byId = dynasty ? rosterById(dynasty) : RIDERS_BY_ID;

    // BANK the stage: fatigue + GC + abandons, and advance the tour.
    recordStageResult(tour, stage, result, data.tacticsByTeam, data.stageRiders);
    const complete = isTourComplete(tour);

    // Event over? Bank it into the dynasty (points, carried fatigue, prize) + save.
    if (dynasty && complete) {
      finishSeasonEvent(dynasty, tour);
      saveDynasty(dynasty);
    }

    // terminal action: next stage, back to the season hub, or back to the menu
    const advance = () => {
      if (!complete) this.scene.start('PreRace', { tour, dynasty });
      else if (dynasty) this.scene.start('SeasonHub', { dynasty });
      else this.scene.start('MainMenu');
    };
    const label = !complete ? 'Next stage →' : dynasty ? 'Back to Season →' : 'Continue →';

    if (!isTour) {
      this.buildOneDay(width, stage, result);
    } else {
      this.buildHeader(width, stage, tour, complete);
      const gc = computeGc(tour);
      if (complete) {
        this.buildFinalGc(width, gc);
      } else {
        this.buildStageColumn(width, result, data.playerTactics, 150);
        this.buildGcColumn(width, gc, data.playerTactics, 150);
      }
    }

    makeButton(this, width / 2, 812, label, advance, { width: 260, height: 46, fontSize: 18, fill: COLORS.buttonSelected });
  }

  // --- one-day race: the full finishing order (unchanged behaviour) -----------
  private buildOneDay(width: number, stage: Stage, result: StageResult): void {
    const order = result.order;
    const winner = this.byId.get(order[0].riderId)!;
    const winnerCol = teamColor(winner.teamId);
    const winnerTime = order[0].timeSec;

    this.add.text(width / 2, 34, stage.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 60, `${stage.type} · ${stage.lengthKm} km`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    this.add.rectangle(width / 2, 108, width - 30, 52, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2 - 150, 96, '🏆 WINNER', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0, 0.5);
    this.add.rectangle(width / 2 - 150 + 6, 120, 12, 12, winnerCol.jersey, 1).setOrigin(0.5);
    this.add.text(width / 2 - 130, 120, winner.name, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0, 0.5);
    this.add.text(width / 2 + 145, 120, this.fmtTime(winnerTime), { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted }).setOrigin(1, 0.5);

    this.add.text(20, 152, 'FINISHING ORDER', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted });
    const top = 176;
    const rowH = 27;
    // ~45 finishers → scroll the order (banner + header + button stay fixed)
    const scroll = new ScrollView(this, 168, 792, top + order.length * rowH);
    order.forEach((e, i) => {
      const rider = this.byId.get(e.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === PLAYER_TEAM_ID;
      const y = top + i * rowH;
      const prev = i > 0 ? order[i - 1] : null;
      const sameGroup = prev && !e.dnf && !prev.dnf && Math.abs(e.timeSec - prev.timeSec) < 0.01;
      if (prev && !sameGroup) scroll.add(this.add.rectangle(width / 2, y - rowH / 2, width - 40, 1, COLORS.stroke, 0.6));
      if (isPlayer) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12));
      scroll.add(this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      scroll.add(this.add.rectangle(46, y, 9, 9, col.jersey, 1));
      scroll.add(this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '14px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5));
      scroll.add(this.add.text(width - 78, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      const gapLabel = e.dnf ? 'DNF' : i === 0 ? '—' : sameGroup ? 's.t.' : `+${this.fmtGap(e.timeSec - winnerTime)}`;
      scroll.add(this.add.text(width - 20, y, gapLabel, { fontFamily: FONT, fontSize: '13px', color: e.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5));
    });
    // the terminal button is added by create() (routes to season hub or menu)
  }

  private buildHeader(width: number, stage: Stage, tour: TourState, complete: boolean): void {
    const raceName = RACES_BY_ID.get(tour.raceId)?.name ?? tour.raceId;
    const stageNo = tour.results.length; // already advanced past the stage just banked
    this.add.text(width / 2, 30, raceName, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    const sub = complete ? `Final classification · ${tour.stageIds.length} stages` : `Stage ${stageNo}/${tour.stageIds.length} · ${stage.type} · ${stage.lengthKm} km`;
    this.add.text(width / 2, 54, sub, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
  }

  // --- mid-tour: compact stage result (top of screen) -------------------------
  private buildStageColumn(width: number, result: StageResult, playerTactics: TeamTactics, top: number): void {
    const winnerTime = result.order[0].timeSec;
    const stageWinner = this.byId.get(result.order[0].riderId)!;
    this.add.rectangle(width / 2, top - 18, width - 30, 30, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(24, top - 18, 'STAGE', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0, 0.5);
    this.add.text(64, top - 18, `${stageWinner.name}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#f5c518' }).setOrigin(0, 0.5);
    this.add.text(width - 24, top - 18, this.fmtTime(winnerTime), { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);

    const rowH = 21;
    const rows = Math.min(6, result.order.length);
    for (let i = 0; i < rows; i++) {
      const e = result.order[i];
      const rider = this.byId.get(e.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === PLAYER_TEAM_ID;
      const y = top + 6 + i * rowH;
      const prev = i > 0 ? result.order[i - 1] : null;
      const same = prev && !e.dnf && !prev.dnf && Math.abs(e.timeSec - prev.timeSec) < 0.01;
      this.add.text(30, y, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(42, y, 8, 8, col.jersey, 1);
      const name = this.add.text(54, y, rider.name, { fontFamily: FONT, fontSize: '13px', color: isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      if (isPlayer) this.roleLetter(54 + name.width + 5, y, roleOf(playerTactics, e.riderId));
      const label = e.dnf ? 'DNF' : i === 0 ? '—' : same ? 's.t.' : `+${this.fmtGap(e.timeSec - winnerTime)}`;
      this.add.text(width - 24, y, label, { fontFamily: FONT, fontSize: '12px', color: e.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5);
    }
  }

  // --- mid-tour: GC standings (lower half) ------------------------------------
  private buildGcColumn(width: number, gc: GcRow[], playerTactics: TeamTactics, stageTop: number): void {
    const top = stageTop + 6 + 6 * 21 + 26;
    this.add.rectangle(width / 2, top - 18, width - 30, 30, COLORS.panel, 1).setStrokeStyle(1, COLORS.gold);
    this.add.text(24, top - 18, '🟡 GENERAL CLASSIFICATION', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#f5c518' }).setOrigin(0, 0.5);

    const rowH = 24;
    const rows = Math.min(13, gc.length);
    const leadTime = gc[0]?.totalTimeSec ?? 0;
    for (let i = 0; i < rows; i++) {
      const row = gc[i];
      const rider = this.byId.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === PLAYER_TEAM_ID;
      const y = top + 8 + i * rowH;
      if (isPlayer) this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12);
      if (i === 0) this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.gold, 0.1);
      this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(46, y, 9, 9, col.jersey, 1);
      const name = this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '13px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 ? '#f5c518' : isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      if (isPlayer) this.roleLetter(60 + name.width + 5, y, roleOf(playerTactics, row.riderId));
      const label = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      this.add.text(width - 24, y, label, { fontFamily: FONT, fontSize: '12px', color: i === 0 ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5);
    }
    if (gc.length > rows) this.add.text(60, top + 8 + rows * rowH, `… +${gc.length - rows} more`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0, 0.5);
  }

  // --- tour finish: the overall winner + full final GC ------------------------
  private buildFinalGc(width: number, gc: GcRow[]): void {
    const champ = this.byId.get(gc[0].riderId)!;
    const champCol = teamColor(champ.teamId);
    const isPlayerChamp = champ.teamId === PLAYER_TEAM_ID;

    this.add.rectangle(width / 2, 100, width - 30, 56, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2, 84, '🟡 OVERALL WINNER', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0.5);
    this.add.rectangle(width / 2 - 96, 108, 13, 13, champCol.jersey, 1).setOrigin(0.5);
    this.add.text(width / 2 - 82, 108, champ.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: isPlayerChamp ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);

    const top = 168;
    const rowH = 26;
    const rows = Math.min(20, gc.length);
    const leadTime = gc[0].totalTimeSec;
    for (let i = 0; i < rows; i++) {
      const row = gc[i];
      const rider = this.byId.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === PLAYER_TEAM_ID;
      const y = top + i * rowH;
      if (isPlayer) this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12);
      if (i === 0) this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.gold, 0.1);
      this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(46, y, 9, 9, col.jersey, 1);
      this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '14px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 ? '#f5c518' : isPlayer ? '#18b39a' : COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 78, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      const label = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      this.add.text(width - 20, y, label, { fontFamily: FONT, fontSize: '13px', color: i === 0 ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5);
    }
  }

  private roleLetter(x: number, y: number, role: ReturnType<typeof roleOf>): void {
    const def = ROLES_BY_ID.get(role)!;
    this.add.text(x, y, def.short, { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: `#${def.color.toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5);
  }

  private fmtTime(sec: number): string {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  private fmtGap(sec: number): string {
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
  }
}

import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM, TEAMS_BY_ID } from '../data/teams.ts';
import { PEAK_CELEBRATE_CONDITION } from '../data/tuning.ts';
import type { Rider, Stage, StageResult } from '../data/types.ts';
import { computeGc, isTourComplete, recordStageResult, type GcRow, type StageFatigueSummary, type TourState } from '../sim/standings.ts';
import { ROLES_BY_ID, roleOf, type TeamTactics } from '../sim/tactics.ts';
import { finishSeasonEvent, rosterById, type DynastyState, type EventSettlementSummary } from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { ScrollView } from '../ui/scrollView.ts';
import { COLORS, FONT } from '../ui/theme.ts';

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
const STAT_LABELS: Record<string, string> = {
  climbing: 'Climbing',
  flat: 'Flat power',
  sprint: 'Sprint',
  puncheur: 'Puncheur',
  endurance: 'Endurance',
  stamina: 'Stamina',
};

export class StageResultsScene extends Phaser.Scene {
  private byId!: Map<string, Rider>;
  private playerTeamId!: string;
  private pendingCamp?: DynastyState;
  private peakWin = false; // a player rider won this event while peaked (Season Focus ext, Part E)

  constructor() {
    super('StageResults');
  }

  create(data: ResultsData): void {
    const { width } = this.scale;
    const { tour, stage, result, dynasty } = data;
    const isTour = tour.stageIds.length > 1;
    this.byId = dynasty ? rosterById(dynasty) : RIDERS_BY_ID;
    this.playerTeamId = dynasty?.playerTeamId ?? PLAYER_TEAM.id;

    // BANK the stage: fatigue + GC + abandons, and advance the tour.
    const stageFatigue = recordStageResult(tour, stage, result, data.tacticsByTeam, data.stageRiders);
    const complete = isTourComplete(tour);

    // Event over? Bank it into the dynasty (points, carried fatigue, prize) + save.
    let settlement: EventSettlementSummary | undefined;
    if (dynasty && complete) {
      settlement = finishSeasonEvent(dynasty, tour);
      saveDynasty(dynasty);
    }
    // a training camp may have fired on banking — surface it (Season Focus ext, Part C)
    this.pendingCamp = dynasty && complete ? dynasty : undefined;

    // "nailed the peak": did a player rider win this event while peaked? (Part E)
    if (dynasty && (!isTour || complete)) {
      const winnerId = isTour ? computeGc(tour)[0]?.riderId : result.order.find((e) => !e.dnf)?.riderId;
      const winner = winnerId ? this.byId.get(winnerId) : undefined;
      const cond = winnerId ? data.stageRiders.find((r) => r.id === winnerId)?.condition ?? 0.5 : 0.5;
      this.peakWin = !!winner && winner.teamId === this.playerTeamId && cond >= PEAK_CELEBRATE_CONDITION;
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

    this.showConsequenceMoment(stageFatigue, settlement);
  }

  private showConsequenceMoment(stageRows: StageFatigueSummary[], settlement?: EventSettlementSummary): void {
    const rows = stageRows.filter((row) => this.byId.get(row.riderId)?.teamId === this.playerTeamId).slice(0, 6);
    if (rows.length === 0 && !settlement) return;

    const { width, height } = this.scale;
    const settlementLines = settlement ? 3 + (settlement.milestones.length > 0 ? 1 : 0) : 0;
    const panelH = 88 + rows.length * 25 + settlementLines * 22;
    const cy = height / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a18, 0.72).setInteractive();
    objects.push(shade);
    objects.push(this.add.rectangle(width / 2, cy, width - 36, panelH, COLORS.panel, 1).setStrokeStyle(2, settlement ? COLORS.gold : COLORS.buttonSelected));
    objects.push(this.add.text(width / 2, cy - panelH / 2 + 22, settlement ? 'EVENT SETTLED' : 'EFFORT REPORT', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: settlement ? '#f5c518' : COLORS.accentText,
    }).setOrigin(0.5));
    objects.push(this.add.text(width / 2, cy - panelH / 2 + 43, 'fatigue gained · saved vs Race · next stage', {
      fontFamily: FONT,
      fontSize: '10px',
      color: COLORS.textMuted,
    }).setOrigin(0.5));

    rows.forEach((row, index) => {
      const rider = this.byId.get(row.riderId);
      const y = cy - panelH / 2 + 69 + index * 25;
      objects.push(this.add.text(32, y, rider?.name ?? row.riderId, { fontFamily: FONT, fontSize: '12px', color: COLORS.text }).setOrigin(0, 0.5));
      const next = row.nextStage === null ? 'DNF' : row.nextStage.toFixed(1);
      objects.push(this.add.text(width - 32, y, `+${row.gained.toFixed(1)} · saved ${row.savedVsRace.toFixed(1)} · ${next}`, {
        fontFamily: FONT,
        fontSize: '11px',
        color: row.savedVsRace > 0 ? COLORS.accentText : COLORS.textMuted,
      }).setOrigin(1, 0.5));
    });

    let y = cy - panelH / 2 + 75 + rows.length * 25;
    if (settlement) {
      const rank = settlement.teamRankAfter === undefined
        ? 'unranked'
        : settlement.teamRankBefore === undefined
          ? `${settlement.teamRankAfter}`
          : `${settlement.teamRankBefore} -> ${settlement.teamRankAfter}`;
      objects.push(this.add.text(width / 2, y, `Team +${settlement.teamPointsGained} pts · rank ${rank}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.text }).setOrigin(0.5));
      y += 22;
      objects.push(this.add.text(width / 2, y, `Prize +${settlement.prizeMoney.toLocaleString()} · balance ${settlement.budgetBalance.toLocaleString()}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.accentText }).setOrigin(0.5));
      y += 22;
      objects.push(this.add.text(width / 2, y, `${settlement.objective.text}: ${settlement.objective.current}/${settlement.objective.target}`, { fontFamily: FONT, fontSize: '11px', color: settlement.objective.completed ? '#f5c518' : COLORS.textMuted }).setOrigin(0.5));
      if (settlement.milestones.length > 0) {
        y += 22;
        objects.push(this.add.text(width / 2, y, settlement.milestones.join(' · '), { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#f5c518' }).setOrigin(0.5));
      }
    }

    objects.push(this.add.text(width / 2, cy + panelH / 2 - 16, 'tap to continue', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5));
    const container = this.add.container(0, 0, objects).setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 180 });
    shade.on('pointerup', () => {
      this.tweens.add({
        targets: container,
        alpha: 0,
        duration: 140,
        onComplete: () => {
          container.destroy(true);
          if (settlement?.training && this.pendingCamp) this.showCampMoment(this.pendingCamp);
        },
      });
    });
  }

  /**
   * The "🏕️ Training Camp!" moment (Season Focus ext, Part C). When a camp fired on
   * banking the event, push it to the player — each rider's gain floats up with the
   * stat that sharpened — rather than leaving it to be found on the Development page.
   */
  private showCampMoment(dynasty: DynastyState): void {
    const camp = dynasty.lastTraining;
    if (!camp || camp.improvedCount === 0) return;
    const gainers = camp.perRider.filter((p) => p.gain > 0).slice(0, 6);
    if (gainers.length === 0) return;

    const { width, height } = this.scale;
    const rowH = 30;
    const panelH = 88 + gainers.length * rowH;
    const cy = height / 2;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a18, 0.72).setInteractive());
    objs.push(this.add.rectangle(width / 2, cy, width - 48, panelH, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold));
    objs.push(this.add.text(width / 2, cy - panelH / 2 + 22, '🏕️ Training Camp!', { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#f5c518' }).setOrigin(0.5));
    objs.push(this.add.text(width / 2, cy - panelH / 2 + 44, `the squad put in the work · +${camp.totalGain.toFixed(1)} pts`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5));

    gainers.forEach((p, i) => {
      const rider = this.byId.get(p.id);
      const y = cy - panelH / 2 + 70 + i * rowH;
      const stat = p.topStat ? STAT_LABELS[p.topStat] ?? p.topStat : 'form';
      objs.push(this.add.text(40, y, rider?.name ?? p.id, { fontFamily: FONT, fontSize: '14px', color: COLORS.text }).setOrigin(0, 0.5));
      objs.push(this.add.text(width - 128, y, stat, { fontFamily: FONT, fontSize: '11px', color: '#8fb4c8' }).setOrigin(1, 0.5));
      const gain = this.add.text(width - 40, y, `+${p.gain.toFixed(1)}`, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: COLORS.accentText }).setOrigin(1, 0.5);
      objs.push(gain);
      // a little float-up on the gain number
      this.tweens.add({ targets: gain, y: y - 4, duration: 500, delay: 120 * i, yoyo: true, ease: 'Quad.out' });
    });

    objs.push(this.add.text(width / 2, cy + panelH / 2 - 18, 'tap to continue', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5));
    const container = this.add.container(0, 0, objs);
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 260 });
    (objs[0] as Phaser.GameObjects.Rectangle).on('pointerup', () => {
      this.tweens.add({ targets: container, alpha: 0, duration: 220, onComplete: () => container.destroy(true) });
    });
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
    this.add.text(width / 2 - 150, 96, this.peakWin ? '🏆 WINNER · 🌟 NAILED THE PEAK' : '🏆 WINNER', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0, 0.5);
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
      const isPlayer = rider.teamId === this.playerTeamId;
      const y = top + i * rowH;
      const prev = i > 0 ? order[i - 1] : null;
      const sameGroup = prev && !e.dnf && !prev.dnf && Math.abs(e.timeSec - prev.timeSec) < 0.01;
      if (prev && !sameGroup) scroll.add(this.add.rectangle(width / 2, y - rowH / 2, width - 40, 1, COLORS.stroke, 0.6));
      if (isPlayer) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12));
      scroll.add(this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      scroll.add(this.add.rectangle(46, y, 9, 9, col.jersey, 1));
      scroll.add(this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '14px', color: isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5));
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
      const isPlayer = rider.teamId === this.playerTeamId;
      const y = top + 6 + i * rowH;
      const prev = i > 0 ? result.order[i - 1] : null;
      const same = prev && !e.dnf && !prev.dnf && Math.abs(e.timeSec - prev.timeSec) < 0.01;
      this.add.text(30, y, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      this.add.rectangle(42, y, 8, 8, col.jersey, 1);
      const name = this.add.text(54, y, rider.name, { fontFamily: FONT, fontSize: '13px', color: isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5);
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
    const scroll = new ScrollView(this, top - 2, 786, top + 8 + gc.length * rowH, width);
    const leadTime = gc[0]?.totalTimeSec ?? 0;
    for (let i = 0; i < gc.length; i++) {
      const row = gc[i];
      const rider = this.byId.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === this.playerTeamId;
      const y = top + 8 + i * rowH;
      if (isPlayer) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12));
      if (i === 0) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.gold, 0.1));
      scroll.add(this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      scroll.add(this.add.rectangle(46, y, 9, 9, col.jersey, 1));
      const name = this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '13px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 || isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5);
      scroll.add(name);
      if (isPlayer) scroll.add(this.roleLetter(60 + name.width + 5, y, roleOf(playerTactics, row.riderId)));
      const label = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      scroll.add(this.add.text(width - 24, y, label, { fontFamily: FONT, fontSize: '12px', color: i === 0 ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5));
    }
  }

  // --- tour finish: the overall winner + full final GC ------------------------
  private buildFinalGc(width: number, gc: GcRow[]): void {
    const champ = this.byId.get(gc[0].riderId)!;
    const champCol = teamColor(champ.teamId);
    const isPlayerChamp = champ.teamId === this.playerTeamId;

    this.add.rectangle(width / 2, 100, width - 30, 56, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    this.add.text(width / 2, 84, this.peakWin ? '🟡 OVERALL WINNER · 🌟 NAILED THE PEAK' : '🟡 OVERALL WINNER', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0.5);
    this.add.rectangle(width / 2 - 96, 108, 13, 13, champCol.jersey, 1).setOrigin(0.5);
    this.add.text(width / 2 - 82, 108, champ.name, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: isPlayerChamp ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5);

    const top = 168;
    const rowH = 26;
    const scroll = new ScrollView(this, 148, 792, top + gc.length * rowH, width);
    const leadTime = gc[0].totalTimeSec;
    for (let i = 0; i < gc.length; i++) {
      const row = gc[i];
      const rider = this.byId.get(row.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === this.playerTeamId;
      const y = top + i * rowH;
      if (isPlayer) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.buttonSelected, 0.12));
      if (i === 0) scroll.add(this.add.rectangle(width / 2, y, width - 24, rowH - 3, COLORS.gold, 0.1));
      scroll.add(this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      scroll.add(this.add.rectangle(46, y, 9, 9, col.jersey, 1));
      scroll.add(this.add.text(60, y, rider.name, { fontFamily: FONT, fontSize: '14px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 || isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5));
      scroll.add(this.add.text(width - 78, y, TEAMS_BY_ID.get(rider.teamId!)!.name, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      const label = i === 0 ? this.fmtTime(row.totalTimeSec) : `+${this.fmtGap(row.totalTimeSec - leadTime)}`;
      scroll.add(this.add.text(width - 20, y, label, { fontFamily: FONT, fontSize: '13px', color: i === 0 ? '#f5c518' : COLORS.textMuted }).setOrigin(1, 0.5));
    }
  }

  private roleLetter(x: number, y: number, role: ReturnType<typeof roleOf>): Phaser.GameObjects.Text {
    const def = ROLES_BY_ID.get(role)!;
    return this.add.text(x, y, def.short, { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: `#${def.color.toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5);
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

import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import type { Rider, Stage, StageType } from '../data/types.ts';
import { RACE_SQUAD_SIZE } from '../data/tuning.ts';
import { baseScore } from '../sim/stageSim.ts';
import { defaultTeamTactics, defaultTeamTacticsFor } from '../sim/raceSetup.ts';
import { currentRace } from '../sim/season.ts';
import { computeGc, createTour, type TourState } from '../sim/standings.ts';
import { ROLES, ROLES_BY_ID, type TacticRole, type TeamEffort, type TeamTactics } from '../sim/tactics.ts';
import { playerRiders, rosterById, startSeasonEvent, type DynastyState } from '../state/dynasty.ts';
import { Button, makeButton } from '../ui/button.ts';
import { StageProfileView } from '../ui/stageProfile.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const BLURBS: Record<StageType, string> = {
  flat: "A sprinters' day — expect a bunch kick unless the break holds.",
  hilly: 'Punchy, rolling terrain for fast finishers who can climb.',
  mountain: 'High passes all day — a climbers battleground.',
  summitFinish: 'Decided on the final climb. Pure climbers to the front.',
  descentFinish: 'A hard climb, then a daring plunge to the line.',
  cobbled: 'Brutal pavé — power and positioning over pure legs.',
};

interface RiderRow {
  id: string;
  bg: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Rectangle;
  chipText: Phaser.GameObjects.Text;
}

/**
 * Pre-stage screen: the ROLE SHEET (SPEC §5.5) plus, for tours, the team EFFORT
 * lever (§5.8) and the fatigue each rider is carrying into the stage. Pre-filled
 * with a sensible default so a quick player can just hit START.
 */
export class PreRaceScene extends Phaser.Scene {
  private tour!: TourState;
  private dynasty?: DynastyState;
  private byId!: Map<string, Rider>;
  private playerTeamId!: string;
  private squadIds: string[] = []; // the player's riders for this race
  private canRest = false; // season event start → the player may bench riders
  private rested = new Set<string>();
  private stage!: Stage;
  private roles!: Record<string, TacticRole>;
  private effort: TeamEffort = 'race';
  private selectedRiderId!: string;
  private rows: RiderRow[] = [];
  private roleButtons: { role: TacticRole; btn: Button }[] = [];
  private restButton?: Button;
  private effortButtons: { effort: TeamEffort; btn: Button }[] = [];
  private roleBlurb!: Phaser.GameObjects.Text;
  private startButton?: Button;
  private pickText?: Phaser.GameObjects.Text;

  constructor() {
    super('PreRace');
  }

  create(data: { tour?: TourState; raceId?: string; dynasty?: DynastyState }): void {
    this.rows = [];
    this.roleButtons = [];
    this.effortButtons = [];
    this.restButton = undefined;
    this.startButton = undefined;
    this.pickText = undefined;
    this.rested = new Set();
    this.effort = 'race';
    this.dynasty = data.dynasty;
    // Three ways in: mid-tour between stages (tour passed through), the start of a
    // season event (create a tour seeded with carried season fatigue), or a quick
    // one-off race (a fresh tour). Only create the tour once, at the event start.
    if (data.tour) this.tour = data.tour;
    else if (data.dynasty) this.tour = startSeasonEvent(data.dynasty, currentRace(data.dynasty.season)!);
    else this.tour = createTour(RACES_BY_ID.get(data.raceId!)!);
    // The squad is picked once, at the start of a season event (not between stages).
    this.canRest = !!data.dynasty && !data.tour;

    // dynasty squad + roster, or the static team for a quick race
    this.byId = this.dynasty ? rosterById(this.dynasty) : RIDERS_BY_ID;
    this.playerTeamId = this.dynasty?.playerTeamId ?? PLAYER_TEAM.id;
    if (this.dynasty && this.canRest) {
      // pick-5 at event start: the whole squad is choosable; startSeasonEvent
      // pre-selected the best 5 into the tour's starters, the rest begin benched.
      this.squadIds = playerRiders(this.dynasty).map((r) => r.id);
      this.rested = new Set(this.squadIds.filter((id) => !this.tour.starters!.has(id)));
    } else if (this.dynasty) {
      // between tour stages: the squad is locked to the 5 who started the tour
      this.squadIds = playerRiders(this.dynasty)
        .map((r) => r.id)
        .filter((id) => this.tour.starters!.has(id));
    } else {
      this.squadIds = PLAYER_TEAM.riderIds;
    }

    const { width } = this.scale;
    const race = this.dynasty ? currentRace(this.dynasty.season)! : RACES_BY_ID.get(this.tour.raceId)!;
    this.stage = STAGES_BY_ID.get(this.tour.stageIds[this.tour.stageIndex])!;
    const isTour = this.tour.stageIds.length > 1;
    const stageNo = this.tour.stageIndex + 1;

    // header
    const back = this.dynasty ? () => this.scene.start('SeasonHub', { dynasty: this.dynasty }) : () => this.scene.start('QuickRace');
    makeButton(this, 40, 36, '‹', back, { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, race.name, { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    const sub = isTour ? `Stage ${stageNo}/${this.tour.stageIds.length} · ${this.stage.type} · ${this.stage.lengthKm} km` : `${this.stage.type} · ${this.stage.lengthKm} km`;
    this.add.text(width / 2, 54, sub, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    // profile + course read
    new StageProfileView(this, width / 2 - 165, 72, 330, 58, this.stage.type);
    this.add.text(width / 2, 146, BLURBS[this.stage.type], { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted, align: 'center', wordWrap: { width: 330 } }).setOrigin(0.5);

    // GC context (tours, after stage 1)
    if (isTour && this.tour.results.length > 0) this.buildGcContext(width, 172);

    // role sheet — pre-filled default for this stage's terrain
    const defSheet = this.dynasty
      ? defaultTeamTacticsFor(this.playerTeamId, playerRiders(this.dynasty), this.stage)
      : defaultTeamTactics(PLAYER_TEAM, this.stage);
    this.roles = { ...defSheet.roles };
    this.selectedRiderId = this.squadIds.find((id) => this.roles[id] === 'leader') ?? this.squadIds[0];

    const top = isTour && this.tour.results.length > 0 ? 210 : 196;
    if (this.canRest) {
      // the header line doubles as the live "Starting X/5" counter (set in refresh)
      this.pickText = this.add.text(width / 2, top - 14, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    } else {
      this.add.text(width / 2, top - 14, 'ROLES — tap a rider, then a role', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
    }

    const rowH = 40;
    this.squadIds.forEach((id, i) => {
      const rider = this.byId.get(id)!;
      const y = top + 18 + i * rowH;
      const bg = this.add
        .rectangle(width / 2, y, width - 28, rowH - 5, COLORS.panel, 1)
        .setStrokeStyle(1, COLORS.stroke)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.selectRider(id));
      this.add.text(30, y, rider.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);

      // stage suitability (how well the rider's stats match today's terrain) + (in
      // the season) the "legs" bar for carried fatigue — the two inputs to the pick.
      // Labelled "suit", not "fit": this is terrain match, NOT the rider's fitness
      // (that's the fatigue bar to the right).
      this.add.text(30, y + 13, `suit ${Math.round(baseScore(rider, this.stage))}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);
      if (this.dynasty) this.buildFatiguePip(148, y, this.tour.fatigue.get(id) ?? 0);

      const chip = this.add.rectangle(width - 72, y, 98, 24, COLORS.panelAlt, 1);
      const chipText = this.add.text(width - 72, y, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: COLORS.textDark }).setOrigin(0.5);
      this.rows.push({ id, bg, chip, chipText });
    });

    // role palette (+ a Rest button on season events)
    const palY = top + 18 + this.squadIds.length * rowH + 6;
    const count = ROLES.length + (this.canRest ? 1 : 0);
    const gap = 6;
    const btnW = Math.floor((width - 24 - (count - 1) * gap) / count);
    const totalW = count * btnW + (count - 1) * gap;
    const startX = (width - totalW) / 2 + btnW / 2;
    ROLES.forEach((def, i) => {
      const btn = makeButton(this, startX + i * (btnW + gap), palY, def.label.split(' ')[0], () => this.assignRole(def.id), {
        width: btnW,
        height: 38,
        fontSize: 11,
      });
      this.roleButtons.push({ role: def.id, btn });
    });
    if (this.canRest) {
      this.restButton = makeButton(this, startX + ROLES.length * (btnW + gap), palY, 'Rest', () => this.toggleRest(), { width: btnW, height: 38, fontSize: 11 });
    }
    this.roleBlurb = this.add
      .text(width / 2, palY + 30, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted, align: 'center', wordWrap: { width: 340 } })
      .setOrigin(0.5, 0);

    // effort lever (tours only) — save the team's legs for a later stage
    let startY = palY + 84;
    if (isTour) {
      const effY = palY + 96;
      this.add.text(width / 2, effY - 20, 'TEAM EFFORT', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);
      const efforts: { id: TeamEffort; label: string }[] = [
        { id: 'race', label: 'Race' },
        { id: 'conserve', label: 'Conserve for GC' },
      ];
      efforts.forEach((e, i) => {
        const btn = makeButton(this, width / 2 + (i === 0 ? -85 : 85), effY, e.label, () => this.selectEffort(e.id), {
          width: 160,
          height: 34,
          fontSize: 13,
        });
        this.effortButtons.push({ effort: e.id, btn });
      });
      startY = effY + 44;
    }

    this.startButton = makeButton(this, width / 2, startY, 'START RACE →', () => this.start(), {
      width: 260,
      height: 50,
      fontSize: 21,
      fill: COLORS.buttonSelected,
    });

    this.refresh();
  }

  private buildGcContext(width: number, y: number): void {
    const gc = computeGc(this.tour);
    // the player's best-placed rider
    let best: { pos: number; id: string } | null = null;
    gc.forEach((row, i) => {
      if (best) return;
      if (this.byId.get(row.riderId)?.teamId === this.playerTeamId) best = { pos: i + 1, id: row.riderId };
    });
    const leaderName = gc[0] ? this.byId.get(gc[0].riderId)!.name.split(' ').slice(-1)[0] : '—';
    let text = `GC: ${leaderName} leads`;
    if (best) {
      const b = best as { pos: number; id: string };
      const name = this.byId.get(b.id)!.name.split(' ').slice(-1)[0];
      const gap = gc[b.pos - 1].gapSec;
      text += `   ·   you: ${name} ${ordinal(b.pos)}${gap > 0 ? ` +${fmtGap(gap)}` : ''}`;
    }
    this.add.text(width / 2, y, text, { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(0.5);
  }

  private buildFatiguePip(x: number, y: number, fatigue: number): void {
    // 0..~20 scale → 40px bar; green fresh, orange tired, red cooked
    const w = 40;
    const frac = Math.max(0, Math.min(1, fatigue / 20));
    const col = fatigue < 7 ? 0x2ecc71 : fatigue < 13 ? 0xe28f3b : 0xe23b3b;
    this.add.text(x, y - 9, 'legs', { fontFamily: FONT, fontSize: '8px', color: COLORS.textMuted }).setOrigin(0, 0.5);
    this.add.rectangle(x, y + 2, w, 6, COLORS.panelAlt, 1).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.stroke);
    this.add.rectangle(x, y + 2, w * frac, 6, col, 1).setOrigin(0, 0.5);
    this.add.text(x + w + 6, y + 2, fatigue.toFixed(0), { fontFamily: FONT, fontSize: '10px', color: `#${col.toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5);
  }

  private selectRider(id: string): void {
    this.selectedRiderId = id;
    this.refresh();
  }

  /** Riders currently picked to start (not benched). */
  private racingCount(): number {
    return this.squadIds.filter((id) => !this.rested.has(id)).length;
  }

  private assignRole(role: TacticRole): void {
    const id = this.selectedRiderId;
    // giving a benched rider a job selects them into the 5 — if there's room
    if (this.canRest && this.rested.has(id)) {
      if (this.racingCount() >= RACE_SQUAD_SIZE) {
        this.roleBlurb.setText(`Starting ${RACE_SQUAD_SIZE} already full — Rest a rider first.`);
        return;
      }
      this.rested.delete(id);
    }
    this.roles[id] = role;
    this.refresh();
  }

  private toggleRest(): void {
    const id = this.selectedRiderId;
    if (this.rested.has(id)) {
      if (this.racingCount() < RACE_SQUAD_SIZE) this.rested.delete(id); // pick into the 5 if there's room
    } else {
      this.rested.add(id); // bench
    }
    this.refresh();
  }

  private selectEffort(effort: TeamEffort): void {
    this.effort = effort;
    this.refresh();
  }

  private refresh(): void {
    const GREY = 0x5a5a8e;
    for (const row of this.rows) {
      const isRested = this.rested.has(row.id);
      const def = ROLES_BY_ID.get(this.roles[row.id] ?? 'free')!;
      const selected = row.id === this.selectedRiderId;
      row.bg.setStrokeStyle(selected ? 2 : 1, selected ? COLORS.buttonSelected : COLORS.stroke);
      row.bg.setFillStyle(selected ? COLORS.panelAlt : COLORS.panel);
      row.bg.setAlpha(isRested ? 0.55 : 1);
      row.chip.setFillStyle(isRested ? GREY : def.color);
      row.chipText.setText(isRested ? 'Rest' : def.label);
      row.chipText.setColor(isRested ? COLORS.text : COLORS.textDark);
    }
    const isRested = this.rested.has(this.selectedRiderId);
    const currentRole = this.roles[this.selectedRiderId] ?? 'free';
    for (const { role, btn } of this.roleButtons) btn.setSelected(!isRested && role === currentRole);
    this.restButton?.setSelected(isRested);
    for (const { effort, btn } of this.effortButtons) btn.setSelected(effort === this.effort);
    const name = this.byId.get(this.selectedRiderId)!.name.split(' ').slice(-1)[0];
    if (isRested) {
      this.roleBlurb.setText(`${name} — Benched: sits this race out and recovers for the next.`);
    } else {
      const def = ROLES_BY_ID.get(currentRole)!;
      this.roleBlurb.setText(`${name} — ${def.label}: ${def.blurb}`);
    }

    // pick-5 gate: START only when exactly RACE_SQUAD_SIZE are selected
    if (this.canRest) {
      const n = this.racingCount();
      const ok = n === RACE_SQUAD_SIZE;
      this.pickText?.setText(`PICK ${RACE_SQUAD_SIZE} · starting ${n}/${RACE_SQUAD_SIZE}  (tap a rider, then a role or Rest)`).setColor(ok ? '#18b39a' : '#e28f3b');
      this.startButton?.setEnabled(ok);
    }
  }

  private start(): void {
    // reconcile the player's tour starters with the picked 5 (rivals' 5s were set
    // by startSeasonEvent). A benched rider's role no longer counts.
    const roles = { ...this.roles };
    if (this.canRest && this.tour.starters) {
      for (const id of this.squadIds) this.tour.starters.delete(id);
      for (const id of this.squadIds) {
        if (this.rested.has(id)) delete roles[id];
        else this.tour.starters.add(id);
      }
    }
    const playerTactics: TeamTactics = { teamId: this.playerTeamId, roles, effort: this.effort };
    this.scene.start('Race', { tour: this.tour, playerTactics, dynasty: this.dynasty });
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmtGap(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
}

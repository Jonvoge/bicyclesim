import Phaser from 'phaser';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import type { Stage, StageResultEntry } from '../data/types.ts';
import { Rng } from '../sim/rng.ts';
import { buildTacticsMap } from '../sim/raceSetup.ts';
import { buildRaceStory, interpGap, type RaceStory, type RiderStory } from '../sim/raceNarrative.ts';
import type { TeamTactics } from '../sim/tactics.ts';
import { CodeDrawnRenderer } from '../render/codeDrawnRenderer.ts';
import { Button, makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

// --- animation pacing (cosmetic) ---
const MAIN_T_SECONDS = 11; // real seconds for the stage clock to run 0 → 1 at 1×
const FINISH_SPREAD = 0.0016; // extra stage-time per second of gap, for the finish reveal
const COMPRESS_K = 75; // gap→x compression: gap of K seconds sits halfway back
const MAX_ROWS = 15;

interface Actor {
  entry: StageResultEntry;
  story: RiderStory;
  glyph: Phaser.GameObjects.Container;
  tFinish: number;
  revealed: boolean;
  incidentShown: boolean;
  isPlayer: boolean;
}

export class RaceScene extends Phaser.Scene {
  private stage!: Stage;
  private story!: RaceStory;
  private actors: Actor[] = [];
  private t = 0; // stage clock (0..~1.1+)
  private maxFinish = 1;
  private speed = 1;
  private done = false;
  private revealed = 0;

  private trackLeft = 30;
  private finishX = 350;
  private roadTop = 150;
  private laneH = 15;
  private lbTop = 500;
  private rowH = 20;

  private progressBar!: Phaser.GameObjects.Rectangle;
  private kmText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private speedBtn!: Button;

  constructor() {
    super('Race');
  }

  create(data: { stageId: string; tactics: TeamTactics }): void {
    this.actors = [];
    this.t = 0;
    this.speed = 1;
    this.done = false;
    this.revealed = 0;

    const { width } = this.scale;
    this.finishX = width - 40;
    this.stage = STAGES_BY_ID.get(data.stageId)!;

    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const tacticsByTeam = buildTacticsMap(this.stage, data.tactics);
    this.story = buildRaceStory({
      stage: this.stage,
      riders: [...RIDERS_BY_ID.values()],
      tacticsByTeam,
      rng: new Rng(seed),
    });

    this.buildHeader(width);
    this.buildRoad(data.tactics.protectedRiderId);
    this.buildLeaderboardHeader(width);
  }

  private buildHeader(width: number): void {
    this.add.text(width / 2, 28, this.stage.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 52, `${this.stage.type} · ${this.stage.lengthKm} km`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    const barX = this.trackLeft;
    const barW = width - 2 * this.trackLeft;
    this.add.rectangle(barX, 80, barW, 8, COLORS.panel, 1).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.stroke);
    this.progressBar = this.add.rectangle(barX, 80, 0, 8, COLORS.buttonSelected, 1).setOrigin(0, 0.5);
    this.kmText = this.add.text(barX, 98, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0, 0.5);
    this.statusText = this.add.text(width - barX, 98, '', { fontFamily: FONT, fontSize: '12px', color: '#f5c518' }).setOrigin(1, 0.5);

    this.speedBtn = makeButton(this, width - 48, 30, '1×', () => this.cycleSpeed(), { width: 48, height: 26, fontSize: 14 });
    makeButton(this, width - 48, 62, 'Skip', () => this.skip(), { width: 48, height: 26, fontSize: 12 });

    // finish line (right edge = current race leader / the line)
    const fl = this.add.graphics();
    fl.lineStyle(2, 0xffffff, 0.4);
    for (let yy = this.roadTop - 6; yy < this.roadTop + 21 * this.laneH; yy += 10) fl.lineBetween(this.finishX, yy, this.finishX, yy + 5);
    this.add.text(this.finishX, this.roadTop - 18, 'FRONT', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5);
  }

  private buildRoad(protectedId: string): void {
    const renderer = new CodeDrawnRenderer();
    const order = this.story.result.order;
    const lanes = this.shuffledLanes(order.length);

    order.forEach((entry, rank) => {
      const rider = RIDERS_BY_ID.get(entry.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === 't-grenoble';
      const story = this.story.stories.get(entry.riderId)!;
      const laneY = this.roadTop + lanes[rank] * this.laneH;
      const glyph = renderer.draw(this, this.xFromGap(interpGap(story.gaps, 0)), laneY, {
        jerseyColor: col.jersey,
        accentColor: col.accent,
        emphasised: isPlayer,
      });
      glyph.setScale(0.78);
      glyph.y = laneY;

      // marker over the player's protected rider so you can follow your pick
      if (entry.riderId === protectedId) {
        const tri = this.add.triangle(0, -13, 0, 0, 8, 0, 4, 6, COLORS.gold, 1);
        glyph.add(tri);
      }

      const finalGap = entry.dnf ? Infinity : entry.timeSec - order[0].timeSec;
      const tFinish = entry.dnf ? Infinity : 1 + finalGap * FINISH_SPREAD;
      this.maxFinish = Number.isFinite(tFinish) ? Math.max(this.maxFinish, tFinish) : this.maxFinish;
      this.actors.push({ entry, story, glyph, tFinish, revealed: false, incidentShown: false, isPlayer });
    });
    // render front-runners on top
    this.actors.sort((a, b) => interpGap(a.story.gaps, 1) - interpGap(b.story.gaps, 1));
    this.actors.forEach((a) => this.children.bringToTop(a.glyph));
  }

  private buildLeaderboardHeader(width: number): void {
    this.add.rectangle(width / 2, this.lbTop - 20, width - 20, 1, COLORS.stroke, 1);
    this.add.text(20, this.lbTop - 34, 'FINISH ORDER', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted });
  }

  private shuffledLanes(n: number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    const rng = new Rng(0xa11ce ^ n);
    for (let i = n - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private xFromGap(gap: number): number {
    const span = this.finishX - this.trackLeft;
    return this.finishX - span * (gap / (gap + COMPRESS_K));
  }

  private cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
    this.speedBtn.setLabel(`${this.speed}×`);
  }

  private skip(): void {
    this.t = this.maxFinish + 1;
    for (const a of this.actors) a.glyph.x = this.xFromGap(interpGap(a.story.gaps, 1));
    this.finish();
  }

  update(_time: number, deltaMs: number): void {
    if (this.done) return;
    this.t += (deltaMs / 1000) * this.speed / MAIN_T_SECONDS;
    const tPos = Math.min(this.t, 1);

    // move riders by their gap-to-leader
    for (const a of this.actors) {
      const gap = interpGap(a.story.gaps, tPos);
      a.glyph.x = this.xFromGap(gap);
      if (!a.incidentShown && a.story.incident && tPos >= a.story.incident.t) {
        a.incidentShown = true;
        this.showIncident(a);
      }
    }

    this.updateStatus(tPos);

    // reveal finishers in order as the clock passes their finish time
    while (this.revealed < Math.min(MAX_ROWS, this.actors.length) && this.t >= this.orderedActor(this.revealed).tFinish) {
      this.revealRow(this.revealed);
      this.revealed++;
    }

    if (this.t >= this.maxFinish + 0.03) this.finish();
  }

  /** Actors in finishing order (result order), for staggered reveal. */
  private orderedActor(rank: number): Actor {
    const id = this.story.result.order[rank].riderId;
    return this.actors.find((a) => a.entry.riderId === id)!;
  }

  private updateStatus(tPos: number): void {
    const barW = this.scale.width - 2 * this.trackLeft;
    this.progressBar.width = barW * tPos;
    const kmToGo = Math.max(0, Math.round(this.stage.lengthKm * (1 - tPos)));
    this.kmText.setText(kmToGo > 0 ? `${kmToGo} km to go` : 'FINISH');

    if (tPos >= 1) {
      this.statusText.setText('');
      return;
    }
    // current lead of the break over the chasing bunch
    let breakGap = Infinity;
    let packGap = Infinity;
    for (const a of this.actors) {
      const g = interpGap(a.story.gaps, tPos);
      if (a.story.inBreak) breakGap = Math.min(breakGap, g);
      else if (a.story.role !== 'dropped') packGap = Math.min(packGap, g);
    }
    const lead = packGap - breakGap;
    if (this.story.breakIds.length > 0 && Number.isFinite(lead) && lead > 4 && tPos < 0.86) {
      this.statusText.setText(`Break +${this.fmtGap(lead)}`);
    } else if (tPos > 0.86) {
      this.statusText.setText('Finale!');
    } else {
      this.statusText.setText('Bunch together');
    }
  }

  private showIncident(a: Actor): void {
    const flash = this.add.circle(a.glyph.x, a.glyph.y - 2, 10, 0xe23b3b, 0.9);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 500, onComplete: () => flash.destroy() });
    a.glyph.setAlpha(0.55);
  }

  private revealRow(rank: number): void {
    const entry = this.story.result.order[rank];
    const rider = RIDERS_BY_ID.get(entry.riderId)!;
    const col = teamColor(rider.teamId);
    const y = this.lbTop + rank * this.rowH;
    const isWinner = rank === 0 && !entry.dnf;
    const actor = this.actors.find((x) => x.entry.riderId === entry.riderId)!;
    const inBreak = actor.story.inBreak;
    const nameColor = isWinner ? '#f5c518' : actor.isPlayer ? '#18b39a' : COLORS.text;
    const winTag = this.story.breakSurvived && isWinner ? 'WIN (break!)' : 'WIN';
    const right = entry.dnf ? 'DNF' : rank === 0 ? winTag : `+${this.fmtGap(entry.timeSec - this.story.result.order[0].timeSec)}`;

    const row = this.add.container(0, 0, [
      this.add.text(30, y, `${rank + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5),
      this.add.rectangle(42, y, 9, 9, col.jersey, 1),
      this.add.text(56, y, rider.name + (inBreak && !entry.dnf ? ' ↗' : ''), {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: isWinner ? 'bold' : 'normal',
        color: entry.dnf ? '#8a8ab0' : nameColor,
      }).setOrigin(0, 0.5),
      this.add.text(this.scale.width - 20, y, right, { fontFamily: FONT, fontSize: '13px', color: isWinner ? '#f5c518' : entry.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5),
    ]);
    row.setAlpha(0);
    this.tweens.add({ targets: row, alpha: 1, x: { from: 8, to: 0 }, duration: 200, ease: 'Quad.out' });
    if (isWinner) this.tweens.add({ targets: actor.glyph, scale: { from: 1.2, to: 0.78 }, duration: 400, ease: 'Quad.out' });
  }

  private fmtGap(sec: number): string {
    const s = Math.round(sec);
    if (s <= 0) return '0s';
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : `${ss}s`;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    // reveal any rows not yet shown (e.g. DNFs)
    while (this.revealed < Math.min(MAX_ROWS, this.actors.length)) {
      this.revealRow(this.revealed);
      this.revealed++;
    }
    this.progressBar.width = this.scale.width - 2 * this.trackLeft;
    this.kmText.setText('FINISH');
    this.statusText.setText('');

    const btn = makeButton(this, this.scale.width / 2, 822, 'Continue →', () => this.scene.start('StageResults', { stageId: this.stage.id, result: this.story.result }), {
      width: 220,
      height: 40,
      fontSize: 18,
      fill: COLORS.buttonSelected,
    });
    btn.container.setAlpha(0);
    this.tweens.add({ targets: btn.container, alpha: 1, duration: 300 });
  }
}

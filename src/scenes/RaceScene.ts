import Phaser from 'phaser';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import type { Stage, StageResult } from '../data/types.ts';
import { Rng } from '../sim/rng.ts';
import { buildTacticsMap } from '../sim/raceSetup.ts';
import { simulateStage } from '../sim/stageSim.ts';
import type { TeamTactics } from '../sim/tactics.ts';
import { CodeDrawnRenderer } from '../render/codeDrawnRenderer.ts';
import { Button, makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

// --- animation tuning (cosmetic, not gameplay) ---
const PACK_TIME = 8; // seconds for the winner to reach the line at 1×
const SPLIT_FRAC = 0.6; // bunched until this fraction of PACK_TIME
const GAP_ANIM = 0.05; // animation-seconds per real second of finishing gap
const MAX_ROWS = 15; // leaderboard rows to reveal

interface AnimEntry {
  riderId: string;
  gapSec: number;
  crossTime: number;
  glyph: Phaser.GameObjects.Container;
  finished: boolean;
  phase: number; // jitter phase
  isPlayer: boolean;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => t * t * (3 - 2 * t);

export class RaceScene extends Phaser.Scene {
  private stage!: Stage;
  private result!: StageResult;
  private entries: AnimEntry[] = [];
  private elapsed = 0;
  private speed = 1;
  private done = false;
  private revealed = 0;

  private trackLeft = 30;
  private startX = 40;
  private finishX = 350;
  private roadTop = 138;
  private laneH = 15;

  private progressBar!: Phaser.GameObjects.Rectangle;
  private kmText!: Phaser.GameObjects.Text;
  private lbTop = 498;
  private rowH = 20;
  private speedBtn!: Button;
  private continueBtn?: Button;

  constructor() {
    super('Race');
  }

  create(data: { stageId: string; tactics: TeamTactics }): void {
    this.entries = [];
    this.elapsed = 0;
    this.speed = 1;
    this.done = false;
    this.revealed = 0;
    this.continueBtn = undefined;

    const { width } = this.scale;
    this.finishX = width - 40;
    this.stage = STAGES_BY_ID.get(data.stageId)!;

    // Run the sim once with a fresh random seed → the result we'll animate to.
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const tacticsByTeam = buildTacticsMap(this.stage, data.tactics);
    this.result = simulateStage({
      stage: this.stage,
      riders: [...RIDERS_BY_ID.values()],
      tacticsByTeam,
      rng: new Rng(seed),
    });

    this.buildHeader(width);
    this.buildRoad();
    this.buildLeaderboardHeader(width);
  }

  private buildHeader(width: number): void {
    this.add.text(width / 2, 30, this.stage.name, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 56, `${this.stage.type} · ${this.stage.lengthKm} km`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    // progress bar
    const barX = this.trackLeft;
    const barW = width - 2 * this.trackLeft;
    this.add.rectangle(barX, 84, barW, 8, COLORS.panel, 1).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.stroke);
    this.progressBar = this.add.rectangle(barX, 84, 0, 8, COLORS.buttonSelected, 1).setOrigin(0, 0.5);
    this.kmText = this.add.text(width / 2, 104, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    // controls
    this.speedBtn = makeButton(this, width - 48, 34, '1×', () => this.cycleSpeed(), { width: 48, height: 28, fontSize: 15 });
    makeButton(this, width - 48, 68, 'Skip', () => this.skip(), { width: 48, height: 28, fontSize: 13 });
  }

  private buildRoad(): void {
    const { width } = this.scale;
    const renderer = new CodeDrawnRenderer();

    // finish line
    const fl = this.add.graphics();
    fl.lineStyle(2, 0xffffff, 0.5);
    for (let yy = this.roadTop - 6; yy < this.roadTop + 21 * this.laneH; yy += 10) {
      fl.lineBetween(this.finishX, yy, this.finishX, yy + 5);
    }
    this.add.text(this.finishX, this.roadTop - 18, 'FIN', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);
    void width;

    // one glyph per rider, in a fixed lane. Lanes are a seeded shuffle so lane
    // position does NOT reveal the finishing order (no spoilers as they line up).
    const order = this.result.order;
    const lanes = this.shuffledLanes(order.length);
    order.forEach((entry, rank) => {
      const rider = RIDERS_BY_ID.get(entry.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === 't-grenoble';
      const laneY = this.roadTop + lanes[rank] * this.laneH;
      const glyph = renderer.draw(this, this.startX, laneY, {
        jerseyColor: col.jersey,
        accentColor: col.accent,
        emphasised: isPlayer,
      });
      glyph.setScale(0.78);
      this.entries.push({
        riderId: entry.riderId,
        gapSec: entry.timeSec - order[0].timeSec,
        crossTime: PACK_TIME + (entry.timeSec - order[0].timeSec) * GAP_ANIM + rank * 0.002,
        glyph,
        finished: false,
        phase: (rank * 1.7) % (Math.PI * 2),
        isPlayer,
      });
    });
    // draw in crossTime order so leaders render on top
    this.entries.sort((a, b) => a.crossTime - b.crossTime);
  }

  /** A deterministic shuffle of [0..n) — stable per scene, unrelated to result. */
  private shuffledLanes(n: number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    const rng = new Rng(0xa11ce ^ n);
    for (let i = n - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private buildLeaderboardHeader(width: number): void {
    this.add.rectangle(width / 2, this.lbTop - 20, width - 20, 1, COLORS.stroke, 1);
    this.add.text(20, this.lbTop - 34, 'FINISH ORDER', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted });
  }

  private cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
    this.speedBtn.setLabel(`${this.speed}×`);
  }

  private skip(): void {
    // fast-forward: place everyone at the line, reveal full order, finish.
    this.elapsed = Math.max(...this.entries.map((e) => e.crossTime)) + 1;
    for (const e of this.entries) {
      e.glyph.x = this.finishX;
    }
    while (this.revealed < Math.min(MAX_ROWS, this.entries.length)) {
      this.revealRow(this.revealed);
      this.revealed++;
    }
    this.finish();
  }

  update(_time: number, deltaMs: number): void {
    if (this.done) return;
    this.elapsed += (deltaMs / 1000) * this.speed;

    const splitTime = PACK_TIME * SPLIT_FRAC;
    const splitX = this.trackLeft + (this.finishX - this.trackLeft) * 0.58;

    for (const e of this.entries) {
      let x: number;
      if (this.elapsed <= splitTime) {
        const f = easeInOut(this.elapsed / splitTime);
        const jitter = Math.sin(this.elapsed * 3 + e.phase) * 3;
        x = lerp(this.startX, splitX, f) + jitter;
      } else if (this.elapsed < e.crossTime) {
        const f2 = (this.elapsed - splitTime) / (e.crossTime - splitTime);
        x = lerp(splitX, this.finishX, f2);
      } else {
        x = this.finishX;
        e.finished = true;
      }
      e.glyph.x = Math.min(x, this.finishX);
    }

    // reveal finishers in order as they cross
    while (
      this.revealed < Math.min(MAX_ROWS, this.entries.length) &&
      this.elapsed >= this.entries[this.revealed].crossTime
    ) {
      this.revealRow(this.revealed);
      this.revealed++;
    }

    // progress readout (front of race)
    const frontFrac = Phaser.Math.Clamp(this.elapsed / PACK_TIME, 0, 1);
    const barW = this.scale.width - 2 * this.trackLeft;
    this.progressBar.width = barW * frontFrac;
    const kmToGo = Math.max(0, Math.round(this.stage.lengthKm * (1 - frontFrac)));
    this.kmText.setText(kmToGo > 0 ? `${kmToGo} km to go` : 'FINISH');

    const lastCross = this.entries[Math.min(MAX_ROWS, this.entries.length) - 1].crossTime;
    if (this.elapsed >= lastCross + 0.3) this.finish();
  }

  private revealRow(rank: number): void {
    const e = this.entries[rank];
    const rider = RIDERS_BY_ID.get(e.riderId)!;
    const col = teamColor(rider.teamId);
    const y = this.lbTop + rank * this.rowH;
    const isWinner = rank === 0;

    const nameColor = isWinner ? '#f5c518' : e.isPlayer ? '#18b39a' : COLORS.text;
    const row = this.add.container(0, 0, [
      this.add.text(30, y, `${rank + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5),
      this.add.rectangle(42, y, 9, 9, col.jersey, 1),
      this.add.text(56, y, rider.name, { fontFamily: FONT, fontSize: '14px', fontStyle: isWinner ? 'bold' : 'normal', color: nameColor }).setOrigin(0, 0.5),
      this.add
        .text(this.scale.width - 20, y, rank === 0 ? 'WIN' : `+${this.fmtGap(e.gapSec)}`, { fontFamily: FONT, fontSize: '13px', color: isWinner ? '#f5c518' : COLORS.textMuted })
        .setOrigin(1, 0.5),
    ]);
    row.setAlpha(0);
    this.tweens.add({ targets: row, alpha: 1, x: { from: 8, to: 0 }, duration: 220, ease: 'Quad.out' });
    if (isWinner) this.flashWinnerGlyph(e);
  }

  private flashWinnerGlyph(e: AnimEntry): void {
    this.tweens.add({ targets: e.glyph, scale: { from: 1.15, to: 0.78 }, duration: 400, ease: 'Quad.out' });
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
    this.progressBar.width = this.scale.width - 2 * this.trackLeft;
    this.kmText.setText('FINISH');
    this.continueBtn = makeButton(
      this,
      this.scale.width / 2,
      820,
      'Continue →',
      () => this.scene.start('StageResults', { stageId: this.stage.id, result: this.result }),
      { width: 220, height: 40, fontSize: 18, fill: COLORS.buttonSelected },
    );
    this.continueBtn.container.setAlpha(0);
    this.tweens.add({ targets: this.continueBtn.container, alpha: 1, duration: 300 });
  }
}

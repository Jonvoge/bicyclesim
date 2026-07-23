import Phaser from 'phaser';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import type { Stage, StageResultEntry } from '../data/types.ts';
import { Rng } from '../sim/rng.ts';
import { buildTacticsMap } from '../sim/raceSetup.ts';
import {
  buildRaceStory,
  interpGap,
  type RaceEvent,
  type RaceStory,
  type RiderStory,
} from '../sim/raceNarrative.ts';
import type { TeamTactics } from '../sim/tactics.ts';
import { CodeDrawnRenderer } from '../render/codeDrawnRenderer.ts';
import { Button, makeButton } from '../ui/button.ts';
import { StageProfileView } from '../ui/stageProfile.ts';
import { COLORS, FONT } from '../ui/theme.ts';

// --- animation pacing (cosmetic) ---
const MAIN_T_SECONDS = 16; // real seconds for the stage clock at 1× (slow enough to follow)
const FINALE_SLOWDOWN = 0.55; // clock rate in the finale, for tension
const FINISH_SPREAD = 0.0016; // extra stage-time per second of finishing gap
const COMPRESS_K = 90; // gap→spread shaping
const MAX_SPREAD = 0.5; // field never spans more than this fraction of the road…
const SPREAD_RATE = 0.62; // …and can't spread faster than this × progress (keeps everyone moving up)
const CLUSTER_GAP_SEC = 4; // riders within this render as one bunch
const MAX_ROWS = 12;

const frac = (n: number): number => n - Math.floor(n);

interface Actor {
  entry: StageResultEntry;
  story: RiderStory;
  glyph: Phaser.GameObjects.Container;
  tFinish: number;
  incidentShown: boolean;
  isPlayer: boolean;
  packSeed: number; // stable slot within a bunch
  out: boolean; // DNF'd and faded from the road
}

interface TickerLine {
  text: Phaser.GameObjects.Text;
}

export class RaceScene extends Phaser.Scene {
  private stage!: Stage;
  private story!: RaceStory;
  private actors: Actor[] = [];
  private t = 0;
  private maxFinish = 1;
  private speed = 1;
  private done = false;
  private revealed = 0;
  private eventIdx = 0;

  private trackLeft = 28;
  private raceLeftX = 52; // riders start here (left) and flow right toward the finish
  private frontX = 352; // finish line (right)
  private roadTop = 196;
  private roadBottom = 404;
  private lbTop = 540;
  private rowH = 20;
  private tickerTop = 438;

  private progressBar!: Phaser.GameObjects.Rectangle;
  private kmText!: Phaser.GameObjects.Text;
  private groupsText!: Phaser.GameObjects.Text;
  private profile!: StageProfileView;
  private speedBtn!: Button;
  private ticker: TickerLine[] = [];

  constructor() {
    super('Race');
  }

  create(data: { stageId: string; tactics: TeamTactics }): void {
    this.actors = [];
    this.ticker = [];
    this.t = 0;
    this.speed = 1;
    this.done = false;
    this.revealed = 0;
    this.eventIdx = 0;
    this.maxFinish = 1;

    const { width } = this.scale;
    this.frontX = width - 38;
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
    this.addRadioLine(`${this.stage.name} — ${this.stage.lengthKm} km`, 'info');
  }

  private buildHeader(width: number): void {
    this.add.text(width / 2, 26, this.stage.name, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 48, `${this.stage.type} · ${this.stage.lengthKm} km`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const barX = this.trackLeft;
    const barW = width - 2 * this.trackLeft;
    this.add.rectangle(barX, 66, barW, 7, COLORS.panel, 1).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.stroke);
    this.progressBar = this.add.rectangle(barX, 66, 0, 7, COLORS.buttonSelected, 1).setOrigin(0, 0.5);
    this.kmText = this.add.text(barX, 82, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0, 0.5);

    this.speedBtn = makeButton(this, width - 46, 26, '1×', () => this.cycleSpeed(), { width: 44, height: 24, fontSize: 13 });
    makeButton(this, width - 46, 56, 'Skip', () => this.skip(), { width: 44, height: 24, fontSize: 12 });

    // stage profile with live position marker
    this.profile = new StageProfileView(this, this.trackLeft, 96, width - 2 * this.trackLeft, 62, this.stage.type, { showMarker: true });

    // groups overview strip
    this.groupsText = this.add.text(width / 2, 176, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.text }).setOrigin(0.5);

    // road: start marker (left) and finish line (right); field flows left → right
    const fl = this.add.graphics();
    fl.lineStyle(1, 0xffffff, 0.15);
    fl.lineBetween(this.raceLeftX, this.roadTop, this.raceLeftX, this.roadBottom);
    fl.lineStyle(2, 0xffffff, 0.4);
    for (let yy = this.roadTop; yy < this.roadBottom; yy += 10) fl.lineBetween(this.frontX, yy, this.frontX, yy + 5);
    this.add.text(this.raceLeftX, this.roadTop - 10, 'START', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5);
    this.add.text(this.frontX, this.roadTop - 10, 'FINISH', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5);

    // race radio panel
    this.add.text(20, 420, 'RACE RADIO', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted });
    this.add.rectangle(width / 2, 432, width - 20, 1, COLORS.stroke, 1);

    // finish order
    this.add.text(20, 518, 'FINISH ORDER', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted });
    this.add.rectangle(width / 2, 532, width - 20, 1, COLORS.stroke, 1);
  }

  private buildRoad(protectedId: string): void {
    const renderer = new CodeDrawnRenderer();
    const order = this.story.result.order;

    // stable pack slots so bunch positions don't flicker
    const seeds = Array.from({ length: order.length }, (_, i) => i);
    const rng = new Rng(0xbadb1ce);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }

    order.forEach((entry, rank) => {
      const rider = RIDERS_BY_ID.get(entry.riderId)!;
      const col = teamColor(rider.teamId);
      const isPlayer = rider.teamId === 't-grenoble';
      const story = this.story.stories.get(entry.riderId)!;
      const glyph = renderer.draw(this, this.trackLeft + 30, (this.roadTop + this.roadBottom) / 2, {
        jerseyColor: col.jersey,
        accentColor: col.accent,
        emphasised: isPlayer,
      });
      glyph.setScale(0.74);

      if (entry.riderId === protectedId) {
        const tri = this.add.triangle(0, -14, 0, 0, 8, 0, 4, 6, COLORS.gold, 1);
        glyph.add(tri);
      }

      // finish timing: whole group crosses together, tiny stagger for readability
      const groupIdx = this.story.groups.findIndex((g) => g.ids.includes(entry.riderId));
      const inGroupIdx = groupIdx >= 0 ? this.story.groups[groupIdx].ids.indexOf(entry.riderId) : 0;
      const gapSec = groupIdx >= 0 ? this.story.groups[groupIdx].gapSec : Infinity;
      const tFinish = entry.dnf ? Infinity : 1 + gapSec * FINISH_SPREAD + inGroupIdx * 0.004;
      if (Number.isFinite(tFinish)) this.maxFinish = Math.max(this.maxFinish, tFinish);

      this.actors.push({ entry, story, glyph, tFinish, incidentShown: false, isPlayer, packSeed: seeds[rank], out: false });
    });
  }

  private cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
    this.speedBtn.setLabel(`${this.speed}×`);
  }

  private skip(): void {
    this.t = this.maxFinish + 1;
    while (this.eventIdx < this.story.events.length) {
      const e = this.story.events[this.eventIdx++];
      this.addRadioLine(e.text, e.kind);
    }
    this.layoutRiders(1);
    this.finish();
  }

  update(time: number, deltaMs: number): void {
    if (this.done) return;
    const inFinale = this.t > this.story.finaleT && this.t < 1;
    this.t += ((deltaMs / 1000) * this.speed * (inFinale ? FINALE_SLOWDOWN : 1)) / MAIN_T_SECONDS;
    const tPos = Math.min(this.t, 1);

    this.layoutRiders(tPos, time);

    // progress + km
    const barW = this.scale.width - 2 * this.trackLeft;
    this.progressBar.width = barW * tPos;
    const kmToGo = Math.max(0, Math.round(this.stage.lengthKm * (1 - tPos)));
    this.kmText.setText(kmToGo > 0 ? `${kmToGo} km to go` : 'FINISH');

    // radio
    while (this.eventIdx < this.story.events.length && this.story.events[this.eventIdx].t <= tPos) {
      const e = this.story.events[this.eventIdx++];
      this.addRadioLine(e.text, e.kind);
    }

    // reveal finish groups as the clock passes their crossing time
    while (this.revealed < Math.min(MAX_ROWS, this.actors.length) && this.t >= this.orderedActor(this.revealed).tFinish) {
      this.revealRow(this.revealed);
      this.revealed++;
    }

    if (this.t >= this.maxFinish + 0.03) this.finish();
  }

  /** Cluster riders by current gap and lay each cluster out as a compact bunch. */
  private layoutRiders(tPos: number, time = 0): void {
    const yMid = (this.roadTop + this.roadBottom) / 2;
    const live = this.actors.filter((a) => !a.out);
    const withGap = live.map((a) => ({ a, gap: interpGap(a.story.gaps, tPos) }));
    withGap.sort((x, y) => x.gap - y.gap);

    // build clusters
    const clusters: { gap: number; members: typeof withGap }[] = [];
    for (const item of withGap) {
      const cur = clusters[clusters.length - 1];
      if (!cur || item.gap - cur.members[cur.members.length - 1].gap > CLUSTER_GAP_SEC) {
        clusters.push({ gap: item.gap, members: [item] });
      } else {
        cur.members.push(item);
      }
    }

    // Position each rider in a compact blob behind its cluster's front. Slots are
    // a STABLE function of packSeed (not the frame's sort order), so riders don't
    // jump/flicker; and the whole blob is shifted to stay on-screen so the back of
    // the bunch never slides off the left edge.
    const headGap = clusters.length > 0 ? clusters[0].gap : 0;
    const leftBound = this.trackLeft + 4;
    for (const c of clusters) {
      const frontX = this.xForGap(c.gap - headGap, tPos);
      const size = c.members.length;
      const depth = Math.min(Math.ceil(size / 2) * 8, 64); // horizontal spread, capped
      const half = Math.min(6 + size * 1.3, 32); // vertical half-height (within road band)

      const placed = c.members.map((m) => {
        const u = frac(Math.sin(m.a.packSeed * 12.9898) * 43758.5453); // stable [0,1)
        const v = frac(Math.sin(m.a.packSeed * 78.233 + 1.7) * 43758.5453);
        const wobble = Math.sin(time / 520 + m.a.packSeed) * 1.1;
        return { m, x: frontX - 3 - u * depth, y: yMid + (v - 0.5) * 2 * half + wobble };
      });
      const minX = Math.min(...placed.map((p) => p.x));
      const shift = minX < leftBound ? leftBound - minX : 0;
      for (const p of placed) {
        p.m.a.glyph.x = p.x + shift;
        p.m.a.glyph.y = p.y;
      }

      // incidents: flash + fade when they happen
      for (const m of c.members) {
        const inc = m.a.story.incident;
        if (inc && !m.a.incidentShown && tPos >= inc.t) {
          m.a.incidentShown = true;
          const flash = this.add.circle(m.a.glyph.x, m.a.glyph.y, 11, 0xe23b3b, 0.9);
          this.tweens.add({ targets: flash, alpha: 0, scale: 1.9, duration: 550, onComplete: () => flash.destroy() });
          if (inc.dnf) {
            this.tweens.add({ targets: m.a.glyph, alpha: 0, duration: 1400, onComplete: () => (m.a.out = true) });
          } else {
            m.a.glyph.setAlpha(0.6);
          }
        }
      }
    }

    this.updateGroupsStrip(clusters, tPos);

    // group dots on the stage profile (leader first)
    const headGap2 = clusters.length > 0 ? clusters[0].gap : 0;
    const fracs = clusters.slice(0, 6).map((c) => Math.max(0, tPos - Math.min(0.16, (c.gap - headGap2) * 0.0008)));
    this.profile.setMarkers(fracs);
  }

  private updateGroupsStrip(clusters: { gap: number; members: { a: Actor }[] }[], tPos: number): void {
    if (tPos >= 1) {
      this.groupsText.setText('— Finish —');
      return;
    }
    // Read the strip the same way as the road: backmost group on the LEFT,
    // the front of the race (break / leaders) on the RIGHT.
    const biggest = clusters.reduce((m, c) => Math.max(m, c.members.length), 0);
    const shown = clusters.slice(0, 4);
    const items = shown.map((c, i) => {
      const n = c.members.length;
      let label: string;
      if (n === biggest && n > 3) label = `Peloton ${n}`;
      else if (i === 0 && c.members.every((m) => m.a.story.inBreak) && n < biggest) label = `Break ${n}`;
      else if (n <= 2) label = c.members.map((m) => RIDERS_BY_ID.get(m.a.entry.riderId)!.name.split(' ').slice(-1)[0]).join(', ');
      else label = `Group ${n}`;
      const gapToLead = c.gap - clusters[0].gap;
      return i === 0 ? label : `${label} +${this.fmtGap(gapToLead)}`;
    });
    items.reverse(); // front group ends up on the right
    if (clusters.length > 4) items.unshift('…');
    this.groupsText.setText(items.join('  ·  '));
  }

  /**
   * Left→right flow. The head of the race is at progress tPos; a group `gap`
   * seconds back sits a little behind — but the spread is capped by tPos so early
   * on the whole field is bunched near the start and everyone keeps moving forward
   * (no pack "stuck at the start" or drifting backwards).
   */
  private xForGap(gap: number, tPos: number): number {
    const desiredBehind = MAX_SPREAD * (gap / (gap + COMPRESS_K)); // 0..MAX_SPREAD
    const behind = Math.min(desiredBehind, tPos * SPREAD_RATE);
    const progress = Math.max(0, tPos - behind);
    return this.raceLeftX + (this.frontX - this.raceLeftX) * progress;
  }

  private addRadioLine(text: string, kind: RaceEvent['kind'] | 'info'): void {
    const colors: Record<string, string> = {
      break: '#f5c518',
      crash: '#e23b3b',
      puncture: '#e28f3b',
      catch: '#18b39a',
      finale: '#f5c518',
      finish: '#f5c518',
      info: '#8a8ab0',
    };
    // shift old lines down, cap at 4
    for (const line of this.ticker) line.text.y += 17;
    while (this.ticker.length >= 4) this.ticker.pop()!.text.destroy();
    const t = this.add.text(24, this.tickerTop, `• ${text}`, { fontFamily: FONT, fontSize: '13px', color: colors[kind] ?? colors.info });
    t.setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 250 });
    this.ticker.unshift({ text: t });
    this.ticker.forEach((l, i) => l.text.setAlpha(Math.max(0.35, 1 - i * 0.22)));
  }

  private orderedActor(rank: number): Actor {
    const id = this.story.result.order[rank].riderId;
    return this.actors.find((a) => a.entry.riderId === id)!;
  }

  private revealRow(rank: number): void {
    const entry = this.story.result.order[rank];
    const rider = RIDERS_BY_ID.get(entry.riderId)!;
    const col = teamColor(rider.teamId);
    const y = this.lbTop + rank * this.rowH;
    const isWinner = rank === 0 && !entry.dnf;
    const actor = this.actors.find((x) => x.entry.riderId === entry.riderId)!;
    const winnerTime = this.story.result.order[0].timeSec;

    // same group as the row above → "s.t." (same time), like real results
    const prev = rank > 0 ? this.story.result.order[rank - 1] : null;
    const sameAsPrev = prev && !entry.dnf && !prev.dnf && Math.abs(entry.timeSec - prev.timeSec) < 0.01;
    const winTag = this.story.breakSurvived && isWinner ? 'WIN (break!)' : 'WIN';
    const right = entry.dnf ? 'DNF' : isWinner ? winTag : sameAsPrev ? 's.t.' : `+${this.fmtGap(entry.timeSec - winnerTime)}`;
    const nameColor = isWinner ? '#f5c518' : actor.isPlayer ? '#18b39a' : COLORS.text;

    const row = this.add.container(0, 0, [
      this.add.text(30, y, `${rank + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5),
      this.add.rectangle(42, y, 9, 9, col.jersey, 1),
      this.add.text(56, y, rider.name + (actor.story.inBreak && !entry.dnf ? ' ↗' : ''), {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: isWinner ? 'bold' : 'normal',
        color: entry.dnf ? '#8a8ab0' : nameColor,
      }).setOrigin(0, 0.5),
      this.add.text(this.scale.width - 20, y, right, { fontFamily: FONT, fontSize: '13px', color: isWinner ? '#f5c518' : entry.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5),
    ]);
    row.setAlpha(0);
    this.tweens.add({ targets: row, alpha: 1, x: { from: 8, to: 0 }, duration: 200, ease: 'Quad.out' });
    if (isWinner) {
      this.addRadioLine(`${rider.name.split(' ').slice(-1)[0]} takes ${this.stage.name}!`, 'finish');
    }
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
    while (this.revealed < Math.min(MAX_ROWS, this.actors.length)) {
      this.revealRow(this.revealed);
      this.revealed++;
    }
    const extra = this.story.result.order.length - MAX_ROWS;
    if (extra > 0) {
      this.add.text(56, this.lbTop + MAX_ROWS * this.rowH, `… +${extra} more (full results next)`, { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0, 0.5);
    }
    this.progressBar.width = this.scale.width - 2 * this.trackLeft;
    this.kmText.setText('FINISH');
    this.profile.setMarkers([1]);

    const btn = makeButton(this, this.scale.width / 2, 818, 'Continue →', () => this.scene.start('StageResults', { stageId: this.stage.id, result: this.story.result }), {
      width: 220,
      height: 40,
      fontSize: 18,
      fill: COLORS.buttonSelected,
    });
    btn.container.setAlpha(0);
    this.tweens.add({ targets: btn.container, alpha: 1, duration: 300 });
  }
}

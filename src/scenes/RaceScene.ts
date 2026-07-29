import Phaser from 'phaser';
import { RIDERS, RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { teamColor } from '../data/teamColors.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import type { Rider, Stage, StageResultEntry } from '../data/types.ts';
import { Rng } from '../sim/rng.ts';
import { buildTacticsMap } from '../sim/raceSetup.ts';
import { ridersForStage, type TourState } from '../sim/standings.ts';
import { buildTacticsMapDyn, dynastyTeamColor, racingRoster, rosterById, type DynastyState } from '../state/dynasty.ts';
import {
  buildRaceStory,
  interpGap,
  type RaceEvent,
  type RaceStory,
  type RiderStory,
} from '../sim/raceNarrative.ts';
import { legReadFace, legReadLabel } from '../sim/legRead.ts';
import { ROLES_BY_ID, roleOf, type TeamTactics } from '../sim/tactics.ts';
import { makeRiderRenderer, preloadSpriteTextures } from '../render/index.ts';
import { Button, makeButton } from '../ui/button.ts';
import { StageProfileView } from '../ui/stageProfile.ts';
import { COLORS, FONT } from '../ui/theme.ts';

// --- animation pacing (cosmetic) ---
const MAIN_T_SECONDS = 16; // real seconds for the stage clock at 1× (slow enough to follow)
const FINALE_SLOWDOWN = 0.55; // clock rate in the finale, for tension
const FINISH_SPREAD = 0.0016; // extra stage-time per second of finishing gap
const COMPRESS_K = 90; // gap→offset shaping
const MAX_SPREAD = 0.18; // the road-length a gap can open (fraction) — kept modest so the whole field tracks the clock and the break is a clear-but-not-huge lead
const OPEN_T = 0.12; // a gap opens smoothly over the first this-much of the stage (everyone starts together)
const CLUSTER_GAP_SEC = 4; // riders within this render as one bunch
const MAX_ROWS = 12;
const MAX_GLYPHS_PER_GROUP = 10; // a big bunch is drawn as a compact clump of ~this many + a count (not 40 icons)
const EASE_RATE = 6; // per-second exponential easing toward slot targets
const FORM_DX = 9; // paceline column spacing (px)
const FORM_DY = 11; // paceline row spacing (px)
const GROUP_MIN_SEP = 16; // groups never visually overlap on the road (px)
const COUNT_LABEL_MIN = 5; // groups at least this big get a rider-count label
const GAP_LABEL_MIN_SEC = 10; // show "+m:ss" under a group this far behind
const LABEL_POOL = 6;
const SCROLL_PX_PER_SEC = 130; // roadside terrain scroll speed at 1× — the illusion of forward motion
const TERRAIN_REDRAW_SECONDS = 1 / 30;
const FINISH_REVEAL_T = 0.8; // the finish line is out of sight until the closing stretch, then it appears

const frac = (n: number): number => n - Math.floor(n);

interface Actor {
  entry: StageResultEntry;
  story: RiderStory;
  glyph: Phaser.GameObjects.Container;
  tFinish: number;
  incidentShown: boolean;
  isPlayer: boolean;
  packSeed: number; // stable slot within a bunch
  out: boolean; // DNF'd / finished and faded from the road
  runInFromX: number | null; // road x when the clock hit t=1 (finish run-in start)
  crossed: boolean;
  lastX: number; // furthest-right target so far — the road only flows forward (no backsliding)
}

interface TickerLine {
  text: Phaser.GameObjects.Text;
}

/**
 * The race view. Every rider is ONE always-visible glyph; groups are laid out as
 * compact paceline formations with stable slots, and all motion is eased — so
 * there is nothing to pop, swap or flicker. After the head of the race finishes,
 * each group rides in and crosses the line exactly when its result rows reveal.
 */
export class RaceScene extends Phaser.Scene {
  private tour!: TourState;
  private dynasty?: DynastyState;
  private byId!: Map<string, Rider>;
  private playerTeamId!: string;
  private stage!: Stage;
  private tactics!: TeamTactics; // the player's role sheet for this stage
  private tacticsByTeam!: Map<string, TeamTactics>;
  private stageRiders!: Rider[]; // fatigued copies handed to the sim
  private story!: RaceStory;
  private actors: Actor[] = [];
  private t = 0;
  private maxFinish = 1;
  private speed = 1;
  private done = false;
  private revealed = 0;
  private eventIdx = 0;
  private legReadOpen = false; // the "read the legs" reveal gates the race clock at the gun

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
  private startLine!: Phaser.GameObjects.Graphics;
  private startLabel!: Phaser.GameObjects.Text;
  private startFaded = false;
  private terrainGfx!: Phaser.GameObjects.Graphics;
  private finishGfx!: Phaser.GameObjects.Graphics;
  private finishLabel!: Phaser.GameObjects.Text;
  private scrollX = 0;
  private terrainRedrawElapsed = 0;
  private finishRevealed = false;
  private profile!: StageProfileView;
  private speedBtn!: Button;
  private ticker: TickerLine[] = [];
  private countLabels: Phaser.GameObjects.Text[] = [];
  private gapLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Race');
  }

  preload(): void {
    // load the sprite textures so RENDER_MODE can switch the rider look (cheap; the
    // code-drawn path ignores them). Phase 7.
    preloadSpriteTextures(this);
  }

  create(data: { tour: TourState; playerTactics: TeamTactics; dynasty?: DynastyState }): void {
    this.actors = [];
    this.ticker = [];
    this.countLabels = [];
    this.gapLabels = [];
    this.t = 0;
    this.speed = 1;
    this.done = false;
    this.revealed = 0;
    this.eventIdx = 0;
    this.legReadOpen = false;
    this.maxFinish = 1;
    this.startFaded = false;
    this.scrollX = 0;
    this.terrainRedrawElapsed = 0;
    this.finishRevealed = false;
    this.tour = data.tour;
    this.dynasty = data.dynasty;
    this.tactics = data.playerTactics;
    this.byId = this.dynasty ? rosterById(this.dynasty) : RIDERS_BY_ID;
    this.playerTeamId = this.dynasty?.playerTeamId ?? PLAYER_TEAM.id;

    const { width } = this.scale;
    this.frontX = width - 38;
    this.stage = STAGES_BY_ID.get(this.tour.stageIds[this.tour.stageIndex])!;

    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    // fatigued rider copies (abandoned riders already dropped), rival defaults + player sheet.
    // Dynasty races use the live squads; a quick race uses the static roster.
    const field = this.dynasty ? racingRoster(this.dynasty) : RIDERS;
    this.stageRiders = ridersForStage(this.tour, field);
    this.tacticsByTeam = this.dynasty ? buildTacticsMapDyn(this.dynasty, this.stage, this.tactics) : buildTacticsMap(this.stage, this.tactics);
    this.story = buildRaceStory({
      stage: this.stage,
      riders: this.stageRiders,
      tacticsByTeam: this.tacticsByTeam,
      rng: new Rng(seed),
      playerTeamId: this.playerTeamId,
    });

    this.buildHeader(width);
    this.buildRoad();
    this.addRadioLine(`${this.stage.name} — ${this.stage.lengthKm} km`, 'info');
    this.showLegReadReveal();
  }

  /**
   * "Read the legs" at the gun (Season Focus ext, Part B). Tactics are locked, so
   * this reveals — never lets you act on — how your squad woke up: each starter's
   * planned Condition (the bar) and today's form (the face). Gates the race clock
   * until dismissed, so the reveal lands before a pedal turns.
   */
  private showLegReadReveal(): void {
    const starters = this.stageRiders.filter((r) => r.teamId === this.playerTeamId);
    if (starters.length === 0) return;
    this.legReadOpen = true;
    const { width } = this.scale;
    const rowH = 34;
    const panelH = 74 + starters.length * rowH;
    const cy = 150 + panelH / 2;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const scrim = this.add.rectangle(width / 2, 316, width, 480, 0x0a0a18, 0.6).setInteractive();
    const panel = this.add.rectangle(width / 2, cy, width - 40, panelH, COLORS.panel, 1).setStrokeStyle(2, COLORS.gold);
    objs.push(scrim, panel);
    objs.push(this.add.text(width / 2, cy - panelH / 2 + 18, '🔍 READING THE LEGS', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#f5c518' }).setOrigin(0.5));
    objs.push(this.add.text(width / 2, cy - panelH / 2 + 36, 'how your squad woke up today', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5));

    starters.forEach((r, i) => {
      const y = cy - panelH / 2 + 60 + i * rowH;
      const read = this.story.legReads.get(r.id)?.read ?? 'normal';
      const cond = r.condition ?? 0.5;
      const barX = 190;
      const barW = 86;
      const condColor = cond > 0.66 ? 0x18b39a : cond > 0.45 ? 0xe0a23b : 0x8a8ab0;
      const labelColor = read === 'flying' ? COLORS.accentText : read === 'off' ? '#e23b3b' : COLORS.textMuted;
      objs.push(this.add.text(40, y, legReadFace(read), { fontFamily: FONT, fontSize: '18px' }).setOrigin(0, 0.5));
      objs.push(this.add.text(66, y, r.name.split(' ').slice(-1)[0], { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setOrigin(0, 0.5));
      objs.push(this.add.rectangle(barX, y, barW, 8, COLORS.buttonFill, 1).setOrigin(0, 0.5));
      objs.push(this.add.rectangle(barX, y, barW * cond, 8, condColor, 1).setOrigin(0, 0.5));
      objs.push(this.add.text(barX + barW + 8, y, legReadLabel(read), { fontFamily: FONT, fontSize: '11px', fontStyle: read === 'flying' || read === 'off' ? 'bold' : 'normal', color: labelColor }).setOrigin(0, 0.5));
    });

    const container = this.add.container(0, 0, objs);
    const btn = makeButton(this, width / 2, cy + panelH / 2 - 17, 'Race →', () => this.dismissLegRead(container), { width: 120, height: 30, fontSize: 14, fill: COLORS.buttonSelected });
    container.add(btn.container);
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 220 });
    this.time.delayedCall(3600, () => this.dismissLegRead(container));
  }

  private dismissLegRead(container: Phaser.GameObjects.Container): void {
    if (!this.legReadOpen) return;
    this.legReadOpen = false;
    this.tweens.add({ targets: container, alpha: 0, duration: 220, onComplete: () => container.destroy(true) });
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
    this.profile = new StageProfileView(this, this.trackLeft, 96, width - 2 * this.trackLeft, 62, this.stage, { showMarker: true });

    // groups overview strip
    this.groupsText = this.add.text(width / 2, 176, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.text }).setOrigin(0.5);

    // roadside terrain: verge posts that scroll past the field (drawn each frame in
    // drawTerrain). Created first so it sits behind the riders and the road lines —
    // it's what sells "the peloton is travelling" when the glyphs barely move.
    this.terrainGfx = this.add.graphics();

    // finish line (right): out of sight until the closing stretch, then it appears
    // as the finish comes up — nothing to ride "toward" for the bulk of the stage.
    this.finishGfx = this.add.graphics();
    this.finishGfx.lineStyle(2, 0xffffff, 0.4);
    for (let yy = this.roadTop; yy < this.roadBottom; yy += 10) this.finishGfx.lineBetween(this.frontX, yy, this.frontX, yy + 5);
    this.finishLabel = this.add.text(this.frontX, this.roadTop - 10, 'FINISH', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5);
    this.finishGfx.setAlpha(0);
    this.finishLabel.setAlpha(0);

    // start marker (left) — its own objects so it can recede once the race has
    // rolled out (a stationary line the field otherwise appears to ride back over)
    this.startLine = this.add.graphics();
    this.startLine.lineStyle(1, 0xffffff, 0.15);
    this.startLine.lineBetween(this.raceLeftX, this.roadTop, this.raceLeftX, this.roadBottom);
    this.startLabel = this.add.text(this.raceLeftX, this.roadTop - 10, 'START', { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5);

    // pooled on-road labels (group sizes, gaps)
    for (let i = 0; i < LABEL_POOL; i++) {
      this.countLabels.push(
        this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5).setVisible(false),
      );
      this.gapLabels.push(
        this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5).setVisible(false),
      );
    }

    // race radio panel
    this.add.text(20, 420, 'RACE RADIO', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted });
    this.add.rectangle(width / 2, 432, width - 20, 1, COLORS.stroke, 1);

    // finish order
    this.add.text(20, 518, 'FINISH ORDER', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted });
    this.add.rectangle(width / 2, 532, width - 20, 1, COLORS.stroke, 1);
  }

  private buildRoad(): void {
    const renderer = makeRiderRenderer();
    const order = this.story.result.order;

    // stable pack slots so bunch positions don't shuffle
    const seeds = Array.from({ length: order.length }, (_, i) => i);
    const rng = new Rng(0xbadb1ce);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }

    order.forEach((entry, rank) => {
      const rider = this.byId.get(entry.riderId)!;
      const col = this.dynasty ? dynastyTeamColor(this.dynasty, rider.teamId) : teamColor(rider.teamId);
      const isPlayer = rider.teamId === this.playerTeamId;
      const story = this.story.stories.get(entry.riderId)!;
      const glyph = renderer.draw(this, this.raceLeftX, (this.roadTop + this.roadBottom) / 2, {
        jerseyColor: col.jersey,
        accentColor: col.accent,
        emphasised: isPlayer,
      });
      glyph.setScale(0.74);

      // player riders wear their role over their head (leader gold, etc.)
      if (isPlayer) {
        const role = roleOf(this.tactics, entry.riderId);
        if (role === 'leader' || role === 'sprinter' || role === 'free') {
          const roleColor = ROLES_BY_ID.get(role)!.color;
          glyph.add(this.add.triangle(0, -14, 0, 0, 8, 0, 4, 6, roleColor, 1));
        }
      }

      // finish timing: whole group crosses together, tiny stagger for readability
      const groupIdx = this.story.groups.findIndex((g) => g.ids.includes(entry.riderId));
      const inGroupIdx = groupIdx >= 0 ? this.story.groups[groupIdx].ids.indexOf(entry.riderId) : 0;
      const gapSec = groupIdx >= 0 ? this.story.groups[groupIdx].gapSec : Infinity;
      const tFinish = entry.dnf ? Infinity : 1 + gapSec * FINISH_SPREAD + inGroupIdx * 0.004;
      if (Number.isFinite(tFinish)) this.maxFinish = Math.max(this.maxFinish, tFinish);

      this.actors.push({
        entry,
        story,
        glyph,
        tFinish,
        incidentShown: false,
        isPlayer,
        packSeed: seeds[rank],
        out: false,
        runInFromX: null,
        crossed: false,
        lastX: this.raceLeftX,
      });
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
    this.finish();
  }

  update(time: number, deltaMs: number): void {
    if (this.done || this.legReadOpen) return; // hold the clock at the gun during the leg-read reveal
    const inFinale = this.t > this.story.finaleT && this.t < 1;
    this.t += ((deltaMs / 1000) * this.speed * (inFinale ? FINALE_SLOWDOWN : 1)) / MAIN_T_SECONDS;
    const tPos = Math.min(this.t, 1);
    const dt = Math.min(deltaMs / 1000, 0.1);

    // scroll the roadside terrain past the field — the sense of speed the barely
    // moving glyphs can't give on their own
    this.terrainRedrawElapsed += dt;
    if (this.terrainRedrawElapsed >= TERRAIN_REDRAW_SECONDS) {
      this.drawTerrain(this.terrainRedrawElapsed);
      this.terrainRedrawElapsed = 0;
    }

    // once the field has rolled out, let the start marker recede up the road (slide
    // left + fade) rather than sitting there for the field to ride back across
    if (!this.startFaded && tPos > OPEN_T) {
      this.startFaded = true;
      this.tweens.add({ targets: [this.startLine, this.startLabel], x: '-=64', alpha: 0, duration: 700, ease: 'Quad.in' });
    }

    // the finish comes into sight in the closing stretch
    if (!this.finishRevealed && tPos >= FINISH_REVEAL_T) this.revealFinish();

    if (this.t < 1) this.layoutRiders(tPos, dt, time);
    else this.runInToLine();

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

  /** Cluster riders by current gap and lay each cluster out as a paceline formation. */
  private layoutRiders(tPos: number, dt: number, time: number): void {
    const yMid = (this.roadTop + this.roadBottom) / 2;
    const live = this.actors.filter((a) => !a.out);
    const withGap = live.map((a) => ({ a, gap: interpGap(a.story.gaps, tPos) }));
    withGap.sort((x, y) => x.gap - y.gap);

    // build clusters front-of-race first
    const clusters: { gap: number; members: typeof withGap }[] = [];
    for (const item of withGap) {
      const cur = clusters[clusters.length - 1];
      if (!cur || item.gap - cur.members[cur.members.length - 1].gap > CLUSTER_GAP_SEC) {
        clusters.push({ gap: item.gap, members: [item] });
      } else {
        cur.members.push(item);
      }
    }

    const headGap = clusters.length > 0 ? clusters[0].gap : 0;
    const ease = 1 - Math.exp(-EASE_RATE * dt);
    for (const l of this.countLabels) l.setVisible(false);
    for (const l of this.gapLabels) l.setVisible(false);

    let prevTailX = Infinity;
    let lastLabelX = Infinity;
    clusters.forEach((c, ci) => {
      const size = c.members.length;
      // a big bunch is drawn compactly: only ~MAX_GLYPHS_PER_GROUP riders on the
      // road (the count label carries the true size), so the peloton is a tidy
      // clump instead of a 40-icon slab that overlaps the groups fore and aft.
      const members = [...c.members].sort((m1, m2) => m1.a.packSeed - m2.a.packSeed);
      const shown = Math.min(size, MAX_GLYPHS_PER_GROUP);
      const rows = shown <= 1 ? 1 : shown <= 4 ? 2 : 3;
      const cols = Math.ceil(shown / rows);
      const depth = (cols - 1) * FORM_DX + 4;

      // desired position from the sim, then: never overlap the group ahead, and
      // never poke out past the finish line or off the left edge
      let frontX = this.xForGap(c.gap - headGap, tPos);
      frontX = Math.min(frontX, prevTailX - GROUP_MIN_SEP, this.frontX - 4);
      frontX = Math.max(frontX, this.trackLeft + 8 + depth);
      prevTailX = frontX - depth;

      // stable in-group order → stable slots; everything eases, nothing jumps.
      // A bunch bigger than the formation packs its overflow into the SAME slots
      // (a dense clump) rather than hiding riders — hiding made them blink and
      // teleport in and out of the back as the cluster membership flickered.
      members.forEach((m, i) => {
        const g = m.a.glyph;
        g.setVisible(true);
        const slot = i < shown ? i : (shown - 1) - ((i - shown) % Math.max(1, shown - 1));
        const col = Math.floor(slot / rows);
        const row = slot % rows;
        const jit = frac(Math.sin(m.a.packSeed * 78.233 + 1.7) * 43758.5453) - 0.5;
        const wob = Math.sin(time / 520 + m.a.packSeed) * 1.0;
        // overflow riders sit slightly off their shared slot so a packed bunch
        // reads as a dense clump, not a single stacked glyph
        const overflow = i >= shown ? (frac(Math.sin(m.a.packSeed * 12.9898) * 43758.5453) - 0.5) * 6 : 0;
        // the road only flows toward the finish: a rider who loses time falls off
        // the leader's pace, they never physically ride backwards. Clamp each
        // target so a shattering group / a caught break can't slingshot glyphs left
        // (and never back across the start line).
        const tx = Math.max(frontX - col * FORM_DX - (row % 2) * 3 + overflow, m.a.lastX);
        m.a.lastX = tx;
        const ty = yMid + (row - (rows - 1) / 2) * FORM_DY + jit * 4 + wob + overflow * 0.4;
        g.x += (tx - g.x) * ease;
        g.y += (ty - g.y) * ease;
      });
      this.handleIncidents(c.members, tPos);

      // on-road labels: size above big groups, gap below chasing groups
      const cxMid = frontX - depth / 2;
      if (size >= COUNT_LABEL_MIN && ci < this.countLabels.length) {
        this.countLabels[ci].setPosition(cxMid, yMid - (rows * FORM_DY) / 2 - 14).setText(`${size}`).setVisible(true);
      }
      const gapBehind = c.gap - headGap;
      // skip a gap label when it would print on top of the previous one
      if (ci > 0 && gapBehind >= GAP_LABEL_MIN_SEC && ci < this.gapLabels.length && lastLabelX - cxMid > 46) {
        this.gapLabels[ci].setPosition(cxMid, yMid + (rows * FORM_DY) / 2 + 14).setText(`+${this.fmtGap(gapBehind)}`).setVisible(true);
        lastLabelX = cxMid;
      }
    });

    this.updateGroupsStrip(clusters, tPos);

    // group dots on the stage profile (leader first)
    const fracs = clusters.slice(0, 6).map((c) => Math.max(0, tPos - Math.min(0.16, (c.gap - headGap) * 0.0008)));
    this.profile.setMarkers(fracs);
  }

  /**
   * After the head of the race hits the line (t ≥ 1), every remaining rider rides
   * in from wherever they were and crosses exactly when their result row reveals,
   * then fades — the road empties as the results fill.
   */
  private runInToLine(): void {
    for (const l of this.countLabels) l.setVisible(false);
    for (const l of this.gapLabels) l.setVisible(false);
    this.groupsText.setText('— Finish —');
    this.profile.setMarkers([1]);

    for (const a of this.actors) {
      if (a.out || a.crossed) continue;
      if (!Number.isFinite(a.tFinish)) {
        // still-rolling DNF (rare): just fade where they are
        a.crossed = true;
        this.tweens.add({ targets: a.glyph, alpha: 0, duration: 500, onComplete: () => (a.out = true) });
        continue;
      }
      if (a.runInFromX === null) a.runInFromX = a.glyph.x;
      const u = Math.min(1, (this.t - 1) / Math.max(a.tFinish - 1, 0.008));
      a.glyph.x = a.runInFromX + (this.frontX - a.runInFromX) * u;
      if (u >= 1) {
        a.crossed = true;
        if (a.entry.riderId === this.story.result.order[0].riderId) {
          // the winner gets a visible pop on the line
          const burst = this.add.circle(this.frontX, a.glyph.y, 12, COLORS.gold, 0.9);
          this.tweens.add({ targets: burst, alpha: 0, scale: 2.2, duration: 600, onComplete: () => burst.destroy() });
        }
        this.tweens.add({ targets: a.glyph, alpha: 0, duration: 450, onComplete: () => (a.out = true) });
      }
    }
  }

  /** Crash/puncture drama: a red flash at the rider, and DNFs fade off the road. */
  private handleIncidents(members: { a: Actor }[], tPos: number): void {
    for (const m of members) {
      const inc = m.a.story.incident;
      if (inc && !m.a.incidentShown && tPos >= inc.t) {
        m.a.incidentShown = true;
        const flash = this.add.circle(m.a.glyph.x, m.a.glyph.y, 11, 0xe23b3b, 0.9);
        this.tweens.add({ targets: flash, alpha: 0, scale: 1.9, duration: 550, onComplete: () => flash.destroy() });
        if (inc.dnf) this.tweens.add({ targets: m.a.glyph, alpha: 0, duration: 1400, onComplete: () => (m.a.out = true) });
        else m.a.glyph.setAlpha(0.6);
      }
    }
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
      else if (n <= 2) label = c.members.map((m) => this.byId.get(m.a.entry.riderId)!.name.split(' ').slice(-1)[0]).join(', ');
      else label = `Group ${n}`;
      const gapToLead = c.gap - clusters[0].gap;
      return i === 0 ? label : `${label} +${this.fmtGap(gapToLead)}`;
    });
    items.reverse(); // front group ends up on the right
    if (clusters.length > 4) items.unshift('…');
    this.groupsText.setText(items.join('  ·  '));
  }

  /**
   * Left→right flow. The whole field advances **with the clock** (progress ≈ tPos);
   * a group `gap` seconds back just sits a *bounded, constant* offset behind the
   * leader — so everyone keeps moving at race pace and a breakaway is simply the
   * front of the road, not the only thing moving. The offset opens smoothly over
   * the first `OPEN_T` of the stage so the bunch starts together.
   */
  private xForGap(gap: number, tPos: number): number {
    const offset = MAX_SPREAD * (gap / (gap + COMPRESS_K)); // 0..MAX_SPREAD, constant in tPos
    const open = Math.min(1, tPos / OPEN_T);
    const progress = Math.max(0.015, tPos - offset * open);
    return this.raceLeftX + (this.frontX - this.raceLeftX) * progress;
  }

  /**
   * Roadside verge posts scrolling right→left, redrawn each frame from a single
   * scroll accumulator. Two parallax depths give the road a little thickness. This
   * is the motion cue: the glyphs sit near-still (their x is race position, not
   * ground speed), so the *world* moving past is what reads as "riding".
   */
  private drawTerrain(dt: number): void {
    this.scrollX += SCROLL_PX_PER_SEC * dt * this.speed;
    const g = this.terrainGfx;
    g.clear();
    const left = this.trackLeft;
    const right = this.scale.width - this.trackLeft;
    const row = (y: number, len: number, spacing: number, parallax: number, alpha: number): void => {
      g.lineStyle(2, 0xffffff, alpha);
      const off = ((this.scrollX * parallax) % spacing + spacing) % spacing;
      for (let x = right - off; x >= left; x -= spacing) g.lineBetween(x, y, x, y + len);
    };
    // near verges (full speed) just inside the road band, plus a slower, fainter
    // far layer inset from them for depth — all clear of the rider lane at mid-road
    row(this.roadTop + 2, 7, 44, 1, 0.12);
    row(this.roadBottom - 9, 7, 44, 1, 0.12);
    row(this.roadTop + 15, 4, 92, 0.5, 0.06);
    row(this.roadBottom - 19, 4, 92, 0.5, 0.06);
  }

  private revealFinish(): void {
    this.finishRevealed = true;
    this.tweens.add({ targets: [this.finishGfx, this.finishLabel], alpha: 1, duration: 450 });
  }

  private addRadioLine(text: string, kind: RaceEvent['kind'] | 'info'): void {
    const colors: Record<string, string> = {
      break: '#f5c518',
      crash: '#e23b3b',
      puncture: '#e28f3b',
      catch: COLORS.accentText,
      finale: '#f5c518',
      finish: '#f5c518',
      legs: '#5fc9d6',
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
    const rider = this.byId.get(entry.riderId)!;
    const col = this.dynasty ? dynastyTeamColor(this.dynasty, rider.teamId) : teamColor(rider.teamId);
    const y = this.lbTop + rank * this.rowH;
    const isWinner = rank === 0 && !entry.dnf;
    const actor = this.actors.find((x) => x.entry.riderId === entry.riderId)!;
    const winnerTime = this.story.result.order[0].timeSec;

    // same group as the row above → "s.t." (same time), like real results
    const prev = rank > 0 ? this.story.result.order[rank - 1] : null;
    const sameAsPrev = prev && !entry.dnf && !prev.dnf && Math.abs(entry.timeSec - prev.timeSec) < 0.01;
    const winTag = this.story.breakSurvived && isWinner ? 'WIN (break!)' : 'WIN';
    const right = entry.dnf ? 'DNF' : isWinner ? winTag : sameAsPrev ? 's.t.' : `+${this.fmtGap(entry.timeSec - winnerTime)}`;
    const nameColor = isWinner || actor.isPlayer ? COLORS.accentText : COLORS.text;

    const items: Phaser.GameObjects.GameObject[] = [
      this.add.text(30, y, `${rank + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5),
      this.add.rectangle(42, y, 9, 9, col.jersey, 1),
      this.add.text(56, y, rider.name + (actor.story.inBreak && !entry.dnf ? ' ↗' : ''), {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: isWinner ? 'bold' : 'normal',
        color: entry.dnf ? '#8a8ab0' : nameColor,
      }).setOrigin(0, 0.5),
      this.add.text(this.scale.width - 20, y, right, { fontFamily: FONT, fontSize: '13px', color: isWinner ? '#f5c518' : entry.dnf ? '#e23b3b' : COLORS.textMuted }).setOrigin(1, 0.5),
    ];
    // player riders show their assigned role letter in its colour
    if (actor.isPlayer) {
      const def = ROLES_BY_ID.get(roleOf(this.tactics, entry.riderId))!;
      const nameText = items[2] as Phaser.GameObjects.Text;
      items.push(
        this.add.text(56 + nameText.width + 6, y, def.short, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: `#${def.color.toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5),
      );
    }
    const row = this.add.container(0, 0, items);
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
    for (const a of this.actors) if (!a.crossed) a.glyph.setVisible(false);
    for (const l of this.countLabels) l.setVisible(false);
    for (const l of this.gapLabels) l.setVisible(false);
    if (!this.finishRevealed) this.revealFinish(); // ensure the line is shown (e.g. after Skip)
    this.groupsText.setText('— Finish —');
    this.progressBar.width = this.scale.width - 2 * this.trackLeft;
    this.kmText.setText('FINISH');
    this.profile.setMarkers([1]);

    const btn = makeButton(
      this,
      this.scale.width / 2,
      818,
      'Continue →',
      () =>
        this.scene.start('StageResults', {
          tour: this.tour,
          dynasty: this.dynasty,
          stage: this.stage,
          result: this.story.result,
          stageRiders: this.stageRiders,
          tacticsByTeam: this.tacticsByTeam,
          playerTactics: this.tactics,
        }),
      {
        width: 220,
        height: 40,
        fontSize: 18,
        fill: COLORS.buttonSelected,
      },
    );
    btn.container.setAlpha(0);
    this.tweens.add({ targets: btn.container, alpha: 1, duration: 300 });
  }
}

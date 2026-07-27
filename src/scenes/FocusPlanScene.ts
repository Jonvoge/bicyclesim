import Phaser from 'phaser';
import { conditionForEvent, FOCUS_PLANS, FOCUS_PLANS_BY_ID, DEFAULT_FOCUS_PLAN_ID } from '../data/focusPlans.ts';
import { SEASON_CALENDAR } from '../data/races.ts';
import { teamColor } from '../data/teamColors.ts';
import { riderType } from '../sim/rating.ts';
import { playerRiders, setFocusPlan, type DynastyState } from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Season Focus (docs/cycling-sim-SEASON-FOCUS.md, Part A). The planning canvas: pick
 * each rider's season-long Condition plan — where in the calendar they peak. A pill
 * per rider cycles the plans; a sparkline shows their form curve across the year in
 * the plan's colour. Minimal friction — everyone already has a sensible default, so
 * this screen is a choice, not a chore.
 */
const BARS = ' ▁▂▃▄▅▆▇█';

export class FocusPlanScene extends Phaser.Scene {
  private dynasty!: DynastyState;

  constructor() {
    super('FocusPlan');
  }

  create(data: { dynasty: DynastyState }): void {
    this.dynasty = data.dynasty;
    const { width } = this.scale;
    const N = SEASON_CALENDAR.length;

    makeButton(this, 40, 30, '‹', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, 'Season Focus', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 47, 'when each rider peaks — tap a plan to change', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);

    // window legend across the calendar: spring / summer / autumn
    this.add.rectangle(width / 2, 74, width - 24, 20, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    const seg = (width - 24) / 3;
    const left = 12;
    const windows: [string, number][] = [
      ['SPRING', 0x4fb0c6],
      ['SUMMER', 0xe0a23b],
      ['AUTUMN', 0xc4623a],
    ];
    windows.forEach(([label, color], i) => {
      this.add.rectangle(left + seg * i, 74, 4, 12, color, 1).setOrigin(0, 0.5);
      this.add.text(left + seg * i + 10, 74, label, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);
    });

    // can't-peak-all-year reminder
    this.add.text(width / 2, 96, 'A rider can only truly peak for one window (or two smaller ones).', { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0.5);

    const squad = playerRiders(this.dynasty).slice().sort((a, b) => a.name.localeCompare(b.name));
    const top = 116;
    const rowH = 84;
    squad.forEach((r, i) => {
      const y = top + i * rowH;
      const planId = r.focusPlanId ?? DEFAULT_FOCUS_PLAN_ID;
      const plan = FOCUS_PLANS_BY_ID.get(planId) ?? FOCUS_PLANS_BY_ID.get(DEFAULT_FOCUS_PLAN_ID)!;
      const col = teamColor(r.teamId);

      this.add.rectangle(width / 2, y + 34, width - 24, rowH - 8, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
      this.add.rectangle(28, y + 12, 9, 9, col.jersey, 1);
      this.add.text(42, y + 12, r.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);
      this.add.text(42, y + 30, `${riderType(r)} · age ${r.age}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(0, 0.5);

      // the plan pill — tap to cycle to the next plan
      makeButton(this, width - 82, y + 16, plan.label, () => this.cyclePlan(r.id), {
        width: 148,
        height: 26,
        fontSize: 12,
        fill: plan.color,
      });
      this.add.text(width - 82, y + 34, plan.blurb, { fontFamily: FONT, fontSize: '9px', color: COLORS.textMuted }).setOrigin(0.5);

      // the rider's condition sparkline across the season, in the plan's colour
      let spark = '';
      for (let e = 0; e < N; e++) {
        const c = conditionForEvent(planId, e, N);
        spark += BARS[Math.max(0, Math.min(8, Math.round(c * 8)))];
      }
      this.add.text(42, y + 54, spark, { fontFamily: 'monospace', fontSize: '13px', color: `#${plan.color.toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5);
    });

    if (squad.length === 0) {
      this.add.text(width / 2, 200, 'No riders on the squad.', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
    }
  }

  private cyclePlan(riderId: string): void {
    const rider = this.dynasty.roster.find((r) => r.id === riderId);
    if (!rider) return;
    const ids = FOCUS_PLANS.map((p) => p.id);
    const cur = ids.indexOf(rider.focusPlanId ?? DEFAULT_FOCUS_PLAN_ID);
    const next = ids[(cur + 1) % ids.length];
    setFocusPlan(this.dynasty, riderId, next);
    saveDynasty(this.dynasty);
    this.scene.restart({ dynasty: this.dynasty });
  }
}

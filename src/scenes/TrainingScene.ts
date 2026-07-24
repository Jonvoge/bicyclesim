import Phaser from 'phaser';
import type { StatKey } from '../data/types.ts';
import { TRAINABLE_STATS } from '../sim/management.ts';
import { playerRiders, trainRider, type DynastyState } from '../state/dynasty.ts';
import { saveDynasty } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const STAT_LABEL: Record<string, string> = {
  climbing: 'CLM',
  flat: 'FLAT',
  sprint: 'SPR',
  puncheur: 'PUN',
  endurance: 'END',
  stamina: 'STA',
};

/**
 * Training (Phase 5): between races, coach a rider to nudge one stat up — but it
 * tires them (added season fatigue) and each rider can train only once per race
 * gap. So you trade a rider's race-freshness for slow growth; you can't sharpen
 * the whole squad and keep them all fresh for their targets.
 */
export class TrainingScene extends Phaser.Scene {
  private dynasty!: DynastyState;
  private selectedId!: string;
  private note = '';

  constructor() {
    super('Training');
  }

  create(data: { dynasty: DynastyState; selectedId?: string; note?: string }): void {
    this.dynasty = data.dynasty;
    const squad = playerRiders(this.dynasty);
    this.selectedId = data.selectedId && squad.some((r) => r.id === data.selectedId) ? data.selectedId : squad[0].id;
    this.note = data.note ?? '';
    const { width } = this.scale;

    makeButton(this, 40, 30, '‹', () => this.scene.start('Team', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 24, 'Training', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 47, 'coach a rider — it tires them, once per gap', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);

    // squad list — tap to select
    const top = 84;
    const rowH = 34;
    squad.forEach((r, i) => {
      const y = top + i * rowH;
      const selected = r.id === this.selectedId;
      const trained = this.dynasty.trainedThisGap.includes(r.id);
      const bg = this.add
        .rectangle(width / 2, y, width - 24, rowH - 5, selected ? COLORS.panelAlt : COLORS.panel, 1)
        .setStrokeStyle(selected ? 2 : 1, selected ? COLORS.buttonSelected : COLORS.stroke)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.scene.restart({ dynasty: this.dynasty, selectedId: r.id }));
      this.add.text(28, y, r.name, { fontFamily: FONT, fontSize: '14px', color: COLORS.text }).setOrigin(0, 0.5);
      const fatigue = this.dynasty.season.fatigue.get(r.id) ?? 0;
      this.add.text(width - 28, y, trained ? '✓ trained' : `legs ${fatigue.toFixed(0)}`, { fontFamily: FONT, fontSize: '11px', color: trained ? '#18b39a' : COLORS.textMuted }).setOrigin(1, 0.5);
    });

    // stat palette for the selected rider
    const rider = squad.find((r) => r.id === this.selectedId)!;
    const palTop = top + squad.length * rowH + 16;
    this.add.text(width / 2, palTop, `Train ${rider.name.split(' ').slice(-1)[0]} — tap a stat`, { fontFamily: FONT, fontSize: '13px', color: COLORS.text }).setOrigin(0.5);

    const cols = 3;
    const gap = 8;
    const btnW = Math.floor((width - 24 - (cols - 1) * gap) / cols);
    const btnH = 46;
    (TRAINABLE_STATS as StatKey[]).forEach((stat, i) => {
      const cx = 12 + btnW / 2 + (i % cols) * (btnW + gap);
      const cy = palTop + 28 + Math.floor(i / cols) * (btnH + gap);
      const val = Math.round(rider.stats[stat]);
      makeButton(this, cx, cy, `${STAT_LABEL[stat]} ${val}`, () => this.train(stat), { width: btnW, height: btnH, fontSize: 14 });
    });

    if (this.note) {
      const rows = Math.ceil(TRAINABLE_STATS.length / cols);
      this.add.text(width / 2, palTop + 28 + rows * (btnH + gap) + 6, this.note, { fontFamily: FONT, fontSize: '13px', color: '#18b39a' }).setOrigin(0.5);
    }
  }

  private train(stat: StatKey): void {
    const res = trainRider(this.dynasty, this.selectedId, stat);
    saveDynasty(this.dynasty);
    const note = res.ok ? `+${res.gain?.toFixed(1)} ${STAT_LABEL[stat]} — legs a little heavier` : (res.reason ?? '');
    this.scene.restart({ dynasty: this.dynasty, selectedId: this.selectedId, note });
  }
}

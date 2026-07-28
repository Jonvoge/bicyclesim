import Phaser from 'phaser';
import { createDynasty } from '../state/dynasty.ts';
import {
  clearSlot,
  loadDynastyFromSlot,
  setActiveSlot,
  slotInfos,
  type SlotInfo,
} from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/**
 * Title screen (Phase 8): a **save-slot picker** so more than one dynasty can be
 * on the go — the "put it down and pick it up" of a keeper. Tap an occupied slot
 * to continue it, an empty slot to start a new dynasty there; × wipes a slot.
 * Quick Race and the renderer test sit below.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width } = this.scale;

    this.add.text(width / 2, 96, 'BICYCLE SIM', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 136, 'run the team, ride the years', { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted }).setOrigin(0.5);

    this.add.text(width / 2, 186, 'DYNASTIES', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const slots = slotInfos();
    const top = 210;
    const rowH = 86;
    slots.forEach((info, i) => this.buildSlot(width, top + i * rowH, info));

    const y = top + slots.length * rowH + 20;
    makeButton(this, width / 2, y, 'Quick Race', () => this.scene.start('QuickRace'), { width: 300, height: 46, fontSize: 17 });
    makeButton(this, width / 2, y + 60, 'Renderers (art test)', () => this.scene.start('RenderCompare'), { width: 300, height: 38, fontSize: 14 });
  }

  private buildSlot(width: number, y: number, info: SlotInfo): void {
    const panel = this.add
      .rectangle(width / 2, y, width - 30, 72, info.occupied ? COLORS.panelAlt : COLORS.panel, 1)
      .setStrokeStyle(info.occupied ? 2 : 1, info.occupied ? COLORS.buttonSelected : COLORS.stroke)
      .setInteractive({ useHandCursor: true });
    panel.on('pointerover', () => panel.setFillStyle(COLORS.panelAlt));
    panel.on('pointerout', () => panel.setFillStyle(info.occupied ? COLORS.panelAlt : COLORS.panel));
    panel.on('pointerup', () => this.open(info));

    this.add.text(30, y - 18, `Slot ${info.slot + 1}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0, 0.5);

    if (info.occupied) {
      this.add.text(30, y + 4, `Season ${info.seasonNumber}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: COLORS.accentText }).setOrigin(0, 0.5);
      const races = info.totalRaces ? ` · ${info.racesDone}/${info.totalRaces} races` : '';
      this.add.text(30, y + 24, `Continue${races} · ${relTime(info.savedAt)}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0, 0.5);
      // delete (×) — its own hit area, above the panel
      makeButton(this, width - 44, y, '×', () => this.confirmDelete(info.slot), { width: 34, height: 34, fontSize: 20 });
    } else {
      this.add.text(30, y + 6, 'New dynasty', { fontFamily: FONT, fontSize: '18px', color: COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 30, y + 6, '＋', { fontFamily: FONT, fontSize: '22px', color: COLORS.textMuted }).setOrigin(1, 0.5);
    }
  }

  private open(info: SlotInfo): void {
    if (!info.occupied) {
      // new dynasty → choose your team first (it creates the dynasty in this slot)
      this.scene.start('TeamSelect', { slot: info.slot });
      return;
    }
    setActiveSlot(info.slot);
    const dynasty = loadDynastyFromSlot(info.slot) ?? createDynasty();
    this.scene.start('SeasonHub', { dynasty });
  }

  private confirmDelete(slot: number): void {
    // simple two-tap confirm: overlay a confirm/cancel strip
    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, width - 60, 150, COLORS.panel, 1).setStrokeStyle(2, COLORS.stroke);
    const q = this.add.text(width / 2, height / 2 - 34, `Delete Slot ${slot + 1}?`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    const wipe = makeButton(this, width / 2 - 70, height / 2 + 24, 'Delete', () => {
      clearSlot(slot);
      this.scene.restart();
    }, { width: 120, height: 40, fontSize: 15, fill: 0x8a2b2b });
    const cancel = makeButton(this, width / 2 + 70, height / 2 + 24, 'Cancel', () => {
      dim.destroy();
      panel.destroy();
      q.destroy();
      wipe.container.destroy();
      cancel.container.destroy();
    }, { width: 120, height: 40, fontSize: 15 });
  }
}

/** Short "time ago" for the slot subtitle. */
function relTime(savedAt?: number): string {
  if (!savedAt) return 'saved';
  const s = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

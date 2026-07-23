import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import type { Stage, StageType } from '../data/types.ts';
import { baseScore } from '../sim/stageSim.ts';
import { defaultTeamTactics } from '../sim/raceSetup.ts';
import { ROLES, ROLES_BY_ID, type TacticRole, type TeamTactics } from '../sim/tactics.ts';
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
 * Pre-race screen: the ROLE SHEET. One role per rider (SPEC §5.5) — tap a rider,
 * tap a role. The sheet starts pre-filled with a sensible default so a quick
 * player can just hit START.
 */
export class PreRaceScene extends Phaser.Scene {
  private roles!: Record<string, TacticRole>;
  private selectedRiderId!: string;
  private rows: RiderRow[] = [];
  private roleButtons: { role: TacticRole; btn: Button }[] = [];
  private roleBlurb!: Phaser.GameObjects.Text;

  constructor() {
    super('PreRace');
  }

  create(data: { raceId: string }): void {
    this.rows = [];
    this.roleButtons = [];
    const { width } = this.scale;
    const race = RACES_BY_ID.get(data.raceId)!;
    const stage = STAGES_BY_ID.get(race.stageIds[0])!;

    // header
    makeButton(this, 40, 40, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 36, fontSize: 20 });
    this.add.text(width / 2, 34, race.name, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 60, `${stage.type} · ${stage.lengthKm} km`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    // profile + one-line course read
    new StageProfileView(this, width / 2 - 165, 78, 330, 64, stage.type);
    this.add.text(width / 2, 158, BLURBS[stage.type], { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted, align: 'center', wordWrap: { width: 330 } }).setOrigin(0.5);

    // role sheet — pre-filled with the sensible default for this stage
    this.roles = { ...defaultTeamTactics(PLAYER_TEAM, stage).roles };
    this.selectedRiderId = PLAYER_TEAM.riderIds.find((id) => this.roles[id] === 'leader') ?? PLAYER_TEAM.riderIds[0];

    this.add.text(width / 2, 190, 'RIDER ROLES — tap a rider, then a role', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted }).setOrigin(0.5);

    const rowH = 42;
    const top = 226;
    PLAYER_TEAM.riderIds.forEach((id, i) => {
      const rider = RIDERS_BY_ID.get(id)!;
      const y = top + i * rowH;
      const bg = this.add
        .rectangle(width / 2, y, width - 28, rowH - 5, COLORS.panel, 1)
        .setStrokeStyle(1, COLORS.stroke)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => this.selectRider(id));
      this.add.text(30, y, rider.name, { fontFamily: FONT, fontSize: '15px', color: COLORS.text }).setOrigin(0, 0.5);
      this.add.text(width - 128, y, `fit ${Math.round(baseScore(rider, stage))}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0.5);
      const chip = this.add.rectangle(width - 72, y, 98, 24, COLORS.panelAlt, 1);
      const chipText = this.add.text(width - 72, y, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: COLORS.textDark }).setOrigin(0.5);
      this.rows.push({ id, bg, chip, chipText });
    });

    // role palette (applies to the selected rider)
    const palY = 508;
    const btnW = 66;
    const gap = 6;
    const totalW = ROLES.length * btnW + (ROLES.length - 1) * gap;
    const startX = (width - totalW) / 2 + btnW / 2;
    ROLES.forEach((def, i) => {
      const btn = makeButton(this, startX + i * (btnW + gap), palY, def.label.split(' ')[0], () => this.assignRole(def.id), {
        width: btnW,
        height: 40,
        fontSize: 11,
      });
      this.roleButtons.push({ role: def.id, btn });
    });
    this.roleBlurb = this.add
      .text(width / 2, 548, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.textMuted, align: 'center', wordWrap: { width: 340 } })
      .setOrigin(0.5, 0);

    // start
    makeButton(this, width / 2, 660, 'START RACE →', () => this.start(stage), {
      width: 260,
      height: 54,
      fontSize: 22,
      fill: COLORS.buttonSelected,
    });

    this.refresh();
  }

  private selectRider(id: string): void {
    this.selectedRiderId = id;
    this.refresh();
  }

  private assignRole(role: TacticRole): void {
    this.roles[this.selectedRiderId] = role;
    this.refresh();
  }

  private refresh(): void {
    for (const row of this.rows) {
      const def = ROLES_BY_ID.get(this.roles[row.id] ?? 'free')!;
      const selected = row.id === this.selectedRiderId;
      row.bg.setStrokeStyle(selected ? 2 : 1, selected ? COLORS.buttonSelected : COLORS.stroke);
      row.bg.setFillStyle(selected ? COLORS.panelAlt : COLORS.panel);
      row.chip.setFillStyle(def.color);
      row.chipText.setText(def.label);
    }
    const currentRole = this.roles[this.selectedRiderId] ?? 'free';
    for (const { role, btn } of this.roleButtons) btn.setSelected(role === currentRole);
    const def = ROLES_BY_ID.get(currentRole)!;
    const name = RIDERS_BY_ID.get(this.selectedRiderId)!.name.split(' ').slice(-1)[0];
    this.roleBlurb.setText(`${name} — ${def.label}: ${def.blurb}`);
  }

  private start(stage: Stage): void {
    const tactics: TeamTactics = { teamId: PLAYER_TEAM.id, roles: { ...this.roles } };
    this.scene.start('Race', { stageId: stage.id, tactics });
  }
}

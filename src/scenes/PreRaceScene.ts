import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { RIDERS_BY_ID } from '../data/riders.ts';
import { STAGES_BY_ID } from '../data/stages.ts';
import { PLAYER_TEAM } from '../data/teams.ts';
import type { Stage, StageType } from '../data/types.ts';
import { baseScore } from '../sim/stageSim.ts';
import { bestSuitedRider } from '../sim/raceSetup.ts';
import { strategiesForRaceType, type Strategy, type TeamTactics } from '../sim/tactics.ts';
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
  itt: 'Every rider alone against the clock.',
  ttt: 'Team time trial — the squad rides as one.',
};

export class PreRaceScene extends Phaser.Scene {
  private selectedRiderId!: string;
  private selectedStrategy: Strategy = 'PROTECT_LEADER';
  private riderButtons: { id: string; btn: Button }[] = [];
  private strategyButtons: { strategy: Strategy; btn: Button }[] = [];

  constructor() {
    super('PreRace');
  }

  create(data: { raceId: string }): void {
    this.riderButtons = [];
    this.strategyButtons = [];
    const { width } = this.scale;
    const race = RACES_BY_ID.get(data.raceId)!;
    const stage = STAGES_BY_ID.get(race.stageIds[0])!;

    // header
    makeButton(this, 40, 40, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 36, fontSize: 20 });
    this.add.text(width / 2, 34, race.name, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 62, `${stage.type} · ${stage.lengthKm} km`, { fontFamily: FONT, fontSize: '14px', color: COLORS.textMuted }).setOrigin(0.5);

    // profile
    new StageProfileView(this, width / 2 - 165, 88, 330, 70, stage.type);
    this.add.text(width / 2, 176, BLURBS[stage.type], { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted, align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);

    // protected rider picker
    this.selectedRiderId = bestSuitedRider(PLAYER_TEAM.riderIds, stage);
    this.add.text(width / 2, 214, 'PROTECTED RIDER', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);

    const cols = [width / 2 - 82, width / 2 + 82];
    PLAYER_TEAM.riderIds.forEach((id, i) => {
      const rider = RIDERS_BY_ID.get(id)!;
      const x = cols[i % 2];
      const y = 250 + Math.floor(i / 2) * 52;
      const btn = makeButton(this, x, y, rider.name.split(' ').slice(-1)[0], () => this.selectRider(id), {
        width: 150,
        height: 34,
        fontSize: 15,
      });
      // suitability hint
      this.add
        .text(x, y + 22, `fit ${Math.round(baseScore(rider, stage))}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted })
        .setOrigin(0.5)
        .setDepth(2);
      this.riderButtons.push({ id, btn });
    });

    // strategy picker — race-type-aware set (SPEC §5.5)
    this.add.text(width / 2, 420, 'STRATEGY', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5);
    const defs = strategiesForRaceType(race.type);
    this.selectedStrategy = defs[0].id;
    defs.forEach((def, i) => {
      const y = 456 + i * 62;
      const btn = makeButton(this, width / 2, y, def.label, () => this.selectStrategy(def.id), {
        width: 300,
        height: 34,
        fontSize: 16,
      });
      this.add
        .text(width / 2, y + 22, def.blurb, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted })
        .setOrigin(0.5)
        .setDepth(2);
      this.strategyButtons.push({ strategy: def.id, btn });
    });

    // start
    makeButton(this, width / 2, 690, 'START RACE →', () => this.start(stage), {
      width: 260,
      height: 54,
      fontSize: 22,
      fill: COLORS.buttonSelected,
    });

    this.refreshSelections();
  }

  private selectRider(id: string): void {
    this.selectedRiderId = id;
    this.refreshSelections();
  }

  private selectStrategy(s: Strategy): void {
    this.selectedStrategy = s;
    this.refreshSelections();
  }

  private refreshSelections(): void {
    for (const { id, btn } of this.riderButtons) btn.setSelected(id === this.selectedRiderId);
    for (const { strategy, btn } of this.strategyButtons) btn.setSelected(strategy === this.selectedStrategy);
  }

  private start(stage: Stage): void {
    const tactics: TeamTactics = {
      teamId: PLAYER_TEAM.id,
      protectedRiderId: this.selectedRiderId,
      strategy: this.selectedStrategy,
    };
    this.scene.start('Race', { stageId: stage.id, tactics });
  }

}

import Phaser from 'phaser';
import type { GeneratedWorldDraft, Rider, SquadProposal } from '../data/types.ts';
import { riderRating, riderType } from '../sim/rating.ts';
import { acceptSquadProposal } from '../sim/worldGeneration.ts';
import { createGeneratedDynasty } from '../state/dynasty.ts';
import { setActiveSlot } from '../state/dynastyStore.ts';
import { makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

export class SquadProposalScene extends Phaser.Scene {
  constructor() {
    super('SquadProposal');
  }

  create(data: { slot: number; draft: GeneratedWorldDraft }): void {
    const { width } = this.scale;
    makeButton(this, 34, 30, '‹', () => this.scene.start('TeamFounding', { slot: data.slot }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 28, 'Choose your first eight', { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(width / 2, 56, 'Three paths into the same generated world', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(0.5);
    const riderById = new Map(data.draft.riders.map((rider) => [rider.id, rider]));
    data.draft.proposals.forEach((proposal, index) => this.buildProposal(data, proposal, index, riderById));
  }

  private buildProposal(
    data: { slot: number; draft: GeneratedWorldDraft },
    proposal: SquadProposal,
    index: number,
    riderById: Map<string, Rider>,
  ): void {
    const { width } = this.scale;
    const y = 178 + index * 238;
    this.add.rectangle(width / 2, y, width - 28, 220, COLORS.panel, 1).setStrokeStyle(1, COLORS.stroke);
    this.add.text(30, y - 92, `OFFER ${String.fromCharCode(65 + index)}`, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: COLORS.accentText });
    this.add.text(width - 30, y - 92, `Rating ${proposal.totalRating}  ·  Age ${proposal.averageAge}`, { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }).setOrigin(1, 0);
    const riders = proposal.riderIds.map((id) => riderById.get(id)!).sort((left, right) => riderRating(right) - riderRating(left));
    riders.slice(0, 5).forEach((rider, riderIndex) => {
      const rowY = y - 61 + riderIndex * 24;
      this.add.text(32, rowY, rider.name, { fontFamily: FONT, fontSize: '12px', color: COLORS.text });
      this.add.text(width - 32, rowY, `${riderType(rider)}  ${riderRating(rider)}  ·  ${rider.age}`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted }).setOrigin(1, 0);
    });
    this.add.text(32, y + 54, `+ 3 support riders  ·  wages ${proposal.wageBill.toLocaleString()}/yr`, { fontFamily: FONT, fontSize: '10px', color: COLORS.textMuted });
    makeButton(this, width / 2, y + 88, 'Accept this squad', () => {
      setActiveSlot(data.slot);
      const accepted = acceptSquadProposal(data.draft, proposal.id);
      this.scene.start('SeasonHub', { dynasty: createGeneratedDynasty(accepted) });
    }, { width: 320, height: 36, fontSize: 14, fill: index === 0 ? COLORS.buttonSelected : COLORS.buttonFill });
  }
}
import Phaser from 'phaser';
import { COUNTRY_REGIONS } from '../data/countries.ts';
import { GENERATED_TEAM_PALETTES } from '../data/teamNames.ts';
import type { TeamPhilosophy } from '../data/types.ts';
import { generateWorldDraft } from '../sim/worldGeneration.ts';
import type { PlayerTeamInput } from '../sim/teamGeneration.ts';
import { Button, makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

const PHILOSOPHIES: { id: TeamPhilosophy; label: string }[] = [
  { id: 'mountain', label: 'Mountain' },
  { id: 'classics', label: 'Classics' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'development', label: 'Development' },
  { id: 'balanced', label: 'Balanced' },
];

const INPUT_STYLE = [
  'width:330px', 'height:38px', 'box-sizing:border-box', 'border:1px solid #464c53',
  'background:#202327', 'color:#f1f1ec', 'font:16px Arial,sans-serif', 'padding:0 12px',
  'outline:none', 'border-radius:3px',
].join(';');

function defaultAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.map((word) => word[0]).join('');
  return (initials.length >= 3 ? initials : name.replace(/[^a-z]/gi, '')).slice(0, 3).toUpperCase().padEnd(3, 'X');
}

export class TeamFoundingScene extends Phaser.Scene {
  private countryIndex = 0;
  private paletteIndex = 0;
  private philosophy: TeamPhilosophy = 'balanced';
  private philosophyButtons: Button[] = [];

  constructor() {
    super('TeamFounding');
  }

  create(data: { slot: number }): void {
    const { width } = this.scale;
    makeButton(this, 34, 30, '‹', () => this.scene.start('MainMenu'), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, 'Found your team', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(30, 72, 'TEAM NAME', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const nameInput = this.add.dom(width / 2, 112, 'input', INPUT_STYLE) as Phaser.GameObjects.DOMElement;
    const nameNode = nameInput.node as HTMLInputElement;
    nameNode.value = 'New Horizon Cycling';
    nameNode.maxLength = 28;
    nameNode.setAttribute('aria-label', 'Team name');

    this.add.text(30, 145, 'ABBREVIATION', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const abbreviationInput = this.add.dom(width / 2, 185, 'input', INPUT_STYLE) as Phaser.GameObjects.DOMElement;
    const abbreviationNode = abbreviationInput.node as HTMLInputElement;
    abbreviationNode.value = 'NHC';
    abbreviationNode.maxLength = 3;
    abbreviationNode.setAttribute('aria-label', 'Three-letter team abbreviation');
    let abbreviationEdited = false;
    abbreviationNode.addEventListener('input', () => {
      abbreviationEdited = true;
      abbreviationNode.value = abbreviationNode.value.replace(/[^a-z]/gi, '').toUpperCase();
    });
    nameNode.addEventListener('input', () => {
      if (!abbreviationEdited) abbreviationNode.value = defaultAbbreviation(nameNode.value);
    });

    this.add.text(30, 218, 'HOME REGION', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const countryButton = makeButton(this, width / 2, 256, COUNTRY_REGIONS[0].label, () => {
      this.countryIndex = (this.countryIndex + 1) % COUNTRY_REGIONS.length;
      countryButton.setLabel(COUNTRY_REGIONS[this.countryIndex].label);
    }, { width: 330, height: 38, fontSize: 14 });

    this.add.text(30, 292, 'PHILOSOPHY', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    this.philosophyButtons = PHILOSOPHIES.map((entry, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      return makeButton(this, 108 + column * 174, 328 + row * 42, entry.label, () => {
        this.philosophy = entry.id;
        this.refreshPhilosophies();
      }, { width: 160, height: 34, fontSize: 12 });
    });
    this.refreshPhilosophies();

    this.add.text(30, 436, 'JERSEY', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const swatches = GENERATED_TEAM_PALETTES.slice(0, 8).map((palette, index) => {
      const x = 48 + index * 42;
      const outer = this.add.rectangle(x, 475, 30, 30, palette.primary).setInteractive({ useHandCursor: true });
      this.add.rectangle(x + 7, 482, 10, 10, palette.accent);
      outer.on('pointerup', () => {
        this.paletteIndex = index;
        swatches.forEach((swatch, swatchIndex) => swatch.setStrokeStyle(swatchIndex === index ? 3 : 1, swatchIndex === index ? COLORS.buttonSelected : COLORS.stroke));
      });
      return outer.setStrokeStyle(index === 0 ? 3 : 1, index === 0 ? COLORS.buttonSelected : COLORS.stroke);
    });

    this.add.text(30, 515, 'WORLD SEED', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted });
    const seedInput = this.add.dom(width / 2, 555, 'input', INPUT_STYLE) as Phaser.GameObjects.DOMElement;
    const seedNode = seedInput.node as HTMLInputElement;
    seedNode.value = String(Date.now() >>> 0);
    seedNode.inputMode = 'numeric';
    seedNode.setAttribute('aria-label', 'World seed');
    const error = this.add.text(width / 2, 600, '', { fontFamily: FONT, fontSize: '12px', color: '#ff8e8e', align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5);

    makeButton(this, width / 2, 650, 'Generate squad offers', () => {
      const teamName = nameNode.value.trim();
      const shortName = abbreviationNode.value.trim().toUpperCase();
      const parsedSeed = Number.parseInt(seedNode.value, 10);
      if (teamName.length < 3) return void error.setText('Enter a team name with at least three characters.');
      if (!/^[A-Z]{3}$/.test(shortName)) return void error.setText('The abbreviation must be three letters.');
      if (!Number.isFinite(parsedSeed)) return void error.setText('Enter a numeric world seed.');
      const palette = GENERATED_TEAM_PALETTES[this.paletteIndex];
      const player: PlayerTeamInput = {
        name: teamName,
        shortName,
        country: COUNTRY_REGIONS[this.countryIndex].label,
        primaryColor: palette.primary,
        accentColor: palette.accent,
        philosophy: this.philosophy,
      };
      this.scene.start('SquadProposal', { slot: data.slot, draft: generateWorldDraft({ seed: parsedSeed, player }) });
    }, { width: 330, height: 48, fontSize: 16, fill: COLORS.buttonSelected });
  }

  private refreshPhilosophies(): void {
    this.philosophyButtons.forEach((button, index) => button.setSelected(PHILOSOPHIES[index].id === this.philosophy));
  }
}
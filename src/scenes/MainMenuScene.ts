import Phaser from 'phaser';

/**
 * Phase 0 scaffold: a title and a single (non-functional) button.
 * No game logic yet — that arrives in later phases.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.32, 'BICYCLE SIM', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#e6e6fa',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.32 + 44, 'team manager', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#8a8ab0',
      })
      .setOrigin(0.5);

    this.createButton(width / 2, height * 0.55, 'New Team', () => {
      // Phase 0: no game logic yet. Placeholder for the season flow.
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const paddingX = 28;
    const paddingY = 14;

    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#1a1a2e',
      })
      .setOrigin(0.5);

    const bg = this.add
      .rectangle(
        x,
        y,
        text.width + paddingX * 2,
        text.height + paddingY * 2,
        0xe6e6fa,
        1,
      )
      .setStrokeStyle(2, 0x8a8ab0);

    bg.setInteractive({ useHandCursor: true });
    text.setDepth(1);

    bg.on('pointerover', () => bg.setFillStyle(0xffffff));
    bg.on('pointerout', () => bg.setFillStyle(0xe6e6fa));
    bg.on('pointerdown', () => bg.setFillStyle(0xc9c9e6));
    bg.on('pointerup', () => {
      bg.setFillStyle(0xffffff);
      onClick();
    });
  }
}

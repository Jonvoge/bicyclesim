import Phaser from 'phaser';

/**
 * Phase 0 scaffold: BootScene does nothing but hand off to the menu.
 * Later phases load assets / saved game here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}

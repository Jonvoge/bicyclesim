import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { MainMenuScene } from './scenes/MainMenuScene.ts';
import { PreRaceScene } from './scenes/PreRaceScene.ts';
import { RaceScene } from './scenes/RaceScene.ts';
import { StageResultsScene } from './scenes/StageResultsScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Portrait canvas, roughly iPhone aspect. FIT letterboxes on other screens.
    width: 390,
    height: 844,
  },
  scene: [BootScene, MainMenuScene, PreRaceScene, RaceScene, StageResultsScene],
};

new Phaser.Game(config);

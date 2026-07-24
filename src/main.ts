import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { MainMenuScene } from './scenes/MainMenuScene.ts';
import { SeasonHubScene } from './scenes/SeasonHubScene.ts';
import { StandingsScene } from './scenes/StandingsScene.ts';
import { RidersScene } from './scenes/RidersScene.ts';
import { ArchiveScene } from './scenes/ArchiveScene.ts';
import { QuickRaceScene } from './scenes/QuickRaceScene.ts';
import { PreRaceScene } from './scenes/PreRaceScene.ts';
import { RaceScene } from './scenes/RaceScene.ts';
import { StageResultsScene } from './scenes/StageResultsScene.ts';
import { TeamScene } from './scenes/TeamScene.ts';
import { TransfersScene } from './scenes/TransfersScene.ts';
import { TrainingScene } from './scenes/TrainingScene.ts';
import { RolloverScene } from './scenes/RolloverScene.ts';
import { RenderCompareScene } from './scenes/RenderCompareScene.ts';
import { TeamSelectScene } from './scenes/TeamSelectScene.ts';

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
  scene: [BootScene, MainMenuScene, TeamSelectScene, SeasonHubScene, StandingsScene, RidersScene, ArchiveScene, TeamScene, TransfersScene, TrainingScene, RolloverScene, RenderCompareScene, QuickRaceScene, PreRaceScene, RaceScene, StageResultsScene],
};

const game = new Phaser.Game(config);

// Re-fit when iOS Safari shows/hides its toolbars (which changes the visible
// viewport height). FIT then rescales the whole design to stay fully on-screen.
const refit = (): void => {
  game.scale.refresh();
};
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', refit);
window.visualViewport?.addEventListener('resize', refit);

'use strict';

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 700,
  parent: 'game-container',
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    MenuScene,
    GameScene,
    LevelCompleteScene,
    GameOverScene,
    VictoryScene,
  ],
};

window.addEventListener('load', () => {
  window.game = new Phaser.Game(config);
});

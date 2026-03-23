'use strict';

class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const score = data.score || 0;
    const level = data.level || 1;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, width, height);

    this.add.text(width / 2, 140, 'GAME OVER', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '90px',
      color: '#EF4444',
      stroke: '#7F1D1D',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(width / 2, 255, `You made it to Level ${level}`, {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#D1D5DB',
    }).setOrigin(0.5);

    this.add.text(width / 2, 310, `FINAL SCORE: ${score}`, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '40px',
      color: '#FCD34D',
    }).setOrigin(0.5);

    // High score logic
    const prev = parseInt(localStorage.getItem('offroadHiScore') || '0', 10);
    if (score > prev) {
      localStorage.setItem('offroadHiScore', score);
      this.add.text(width / 2, 370, '★  NEW HIGH SCORE!  ★', {
        fontFamily: '"Arial Black", Arial',
        fontSize: '28px',
        color: '#F59E0B',
      }).setOrigin(0.5);
    } else {
      this.add.text(width / 2, 370, `High Score: ${prev}`, {
        fontFamily: 'Arial', fontSize: '22px', color: '#9CA3AF',
      }).setOrigin(0.5);
    }

    this._addBtn(width / 2, 470, '↺  TRY AGAIN', () => {
      this.registry.set('lives', 3);
      this.registry.set('score', 0);
      this.registry.set('currentLevel', 1);
      this.scene.start('GameScene');
    });

    this._addBtn(width / 2, 545, '⌂  MAIN MENU', () => this.scene.start('MenuScene'));

    this.input.keyboard.once('keydown-ENTER', () => {
      this.registry.set('lives', 3);
      this.registry.set('score', 0);
      this.registry.set('currentLevel', 1);
      this.scene.start('GameScene');
    });
  }

  _addBtn(x, y, label, cb) {
    const btn = this.add.text(x, y, label, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '26px',
      color: '#FFFFFF',
      backgroundColor: '#374151',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#4B5563' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#374151' }));
    btn.on('pointerdown', cb);
  }
}

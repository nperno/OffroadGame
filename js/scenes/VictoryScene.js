'use strict';

class VictoryScene extends Phaser.Scene {
  constructor() { super({ key: 'VictoryScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const score = data.score || 0;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x064E3B, 0x064E3B, 0x1A3A00, 0x1A3A00, 1);
    bg.fillRect(0, 0, width, height);

    // Celebration dots
    for (let i = 0; i < 80; i++) {
      const col = Phaser.Utils.Array.GetRandom([0xFCD34D, 0x34D399, 0x60A5FA, 0xF87171, 0xA78BFA]);
      bg.fillStyle(col, Phaser.Math.FloatBetween(0.4, 1.0));
      bg.fillCircle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(3, 10)
      );
    }

    this.add.text(width / 2, 100, '🏆  YOU WIN!  🏆', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '76px',
      color: '#FCD34D',
      stroke: '#78350F',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(width / 2, 210, 'All 6 levels conquered!', {
      fontFamily: 'Arial', fontSize: '28px', color: '#D1FAE5',
    }).setOrigin(0.5);

    this.add.text(width / 2, 275, `TOTAL SCORE: ${score}`, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '48px',
      color: '#F59E0B',
    }).setOrigin(0.5);

    const prev = parseInt(localStorage.getItem('offroadHiScore') || '0', 10);
    if (score > prev) {
      localStorage.setItem('offroadHiScore', score);
      this.add.text(width / 2, 355, '★  NEW HIGH SCORE!  ★', {
        fontFamily: '"Arial Black", Arial', fontSize: '32px', color: '#F59E0B',
      }).setOrigin(0.5);
    } else {
      this.add.text(width / 2, 355, `Previous Best: ${prev}`, {
        fontFamily: 'Arial', fontSize: '24px', color: '#9CA3AF',
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, 430, 'Congratulations, off-road champion!', {
      fontFamily: 'Arial', fontSize: '22px', color: '#A7F3D0',
    }).setOrigin(0.5);

    this._addBtn(width / 2, 530, '↺  PLAY AGAIN', () => {
      this.registry.set('lives', 3);
      this.registry.set('score', 0);
      this.registry.set('currentLevel', 1);
      this.scene.start('GameScene');
    });

    this._addBtn(width / 2, 610, '⌂  MAIN MENU', () => this.scene.start('MenuScene'));
  }

  _addBtn(x, y, label, cb) {
    const btn = this.add.text(x, y, label, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '26px',
      color: '#FFFFFF',
      backgroundColor: '#065F46',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#047857' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#065F46' }));
    btn.on('pointerdown', cb);
  }
}

'use strict';

class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  create() {
    const { width, height } = this.scale;

    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1A0800, 0x1A0800, 0x3A2000, 0x3A2000, 1);
    bg.fillRect(0, 0, width, height);

    // Ground texture dots
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const s = Phaser.Math.FloatBetween(1, 3);
      bg.fillStyle(0x5A3A10, 0.4);
      bg.fillCircle(x, y, s);
    }

    // Title
    this.add.text(width / 2, 130, 'OFF-ROAD', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '88px',
      color: '#F59E0B',
      stroke: '#7C2D00',
      strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(width / 2, 220, 'RAMPAGE', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '64px',
      color: '#EF4444',
      stroke: '#7C0000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    // Sub-title
    this.add.text(width / 2, 295, '6 grueling levels  ·  3 lives  ·  race the clock', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#D1D5DB',
    }).setOrigin(0.5);

    // Controls card
    const cardX = width / 2 - 180;
    const cardY = 340;
    const cardW = 360;
    const cardH = 180;
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.5);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 10);
    card.lineStyle(2, 0x6B7280, 0.6);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 10);

    const controls = [
      ['↑  /  W', 'Accelerate'],
      ['↓  /  S', 'Brake / Reverse'],
      ['←  /  →', 'Steer'],
      ['R',        'Respawn (lose a life)'],
    ];
    this.add.text(width / 2, cardY + 18, 'CONTROLS', {
      fontFamily: '"Arial Black", Arial', fontSize: '16px', color: '#F59E0B'
    }).setOrigin(0.5, 0);

    controls.forEach(([key, action], i) => {
      const cy = cardY + 48 + i * 32;
      this.add.text(cardX + 20, cy, key, {
        fontFamily: 'Courier New', fontSize: '16px', color: '#93C5FD'
      });
      this.add.text(cardX + cardW - 20, cy, action, {
        fontFamily: 'Arial', fontSize: '16px', color: '#D1D5DB'
      }).setOrigin(1, 0);
    });

    // High score
    const hi = localStorage.getItem('offroadHiScore') || 0;
    this.add.text(width / 2, 545, `HIGH SCORE: ${hi}`, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '22px',
      color: '#FCD34D',
    }).setOrigin(0.5);

    // Start button
    const btnY = 615;
    const btn = this.add.text(width / 2, btnY, '▶  PRESS ENTER TO START', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '28px',
      color: '#FFFFFF',
      backgroundColor: '#B45309',
      padding: { x: 28, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Pulse tween
    this.tweens.add({
      targets: btn,
      scaleX: 1.05, scaleY: 1.05,
      yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut'
    });

    btn.on('pointerdown', () => this._startGame());

    // Keyboard
    this.input.keyboard.once('keydown-ENTER', () => this._startGame());
    this.input.keyboard.once('keydown-SPACE', () => this._startGame());
  }

  _startGame() {
    Sounds.init();
    Sounds.resume();
    this.registry.set('lives', 3);
    this.registry.set('score', 0);
    this.registry.set('currentLevel', 1);
    this.scene.start('GameScene');
  }
}

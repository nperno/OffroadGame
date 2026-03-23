'use strict';

class LevelCompleteScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelCompleteScene' }); }

  create(data) {
    const { width, height } = this.scale;
    const { level, timeBonus, livesBonus, totalLevelScore, runningScore } = data;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.78);
    bg.fillRect(0, 0, width, height);

    // Panel
    const pw = 560, ph = 420;
    const px = (width - pw) / 2, py = (height - ph) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x1F2937, 0.95);
    panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(3, 0xF59E0B, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 14);

    this.add.text(width / 2, py + 36, `LEVEL ${level} COMPLETE!`, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '36px',
      color: '#FCD34D',
    }).setOrigin(0.5);

    this.add.text(width / 2, py + 88, LEVELS[level - 1].name, {
      fontFamily: 'Arial', fontSize: '20px', color: '#9CA3AF',
    }).setOrigin(0.5);

    // Score breakdown
    const rows = [
      ['Time Bonus',   `+${timeBonus}`],
      ['Lives Bonus',  `+${livesBonus}`],
      ['Level Score',  totalLevelScore],
      ['Running Total',runningScore],
    ];
    const colors = ['#93C5FD', '#34D399', '#F59E0B', '#F472B6'];
    rows.forEach(([label, val], i) => {
      const ry = py + 138 + i * 44;
      const isLast = i === rows.length - 1;
      if (isLast) {
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x4B5563, 0.8);
        sep.strokeLineShape(new Phaser.Geom.Line(px + 30, ry - 8, px + pw - 30, ry - 8));
      }
      this.add.text(px + 40, ry, label, {
        fontFamily: isLast ? '"Arial Black", Arial' : 'Arial',
        fontSize: isLast ? '22px' : '20px',
        color: '#D1D5DB',
      });
      this.add.text(px + pw - 40, ry, String(val), {
        fontFamily: '"Arial Black", Arial',
        fontSize: isLast ? '22px' : '20px',
        color: colors[i],
      }).setOrigin(1, 0);
    });

    // Continue / next level
    const isLast = level === 6;
    const btnLabel = isLast ? '🏆  SEE FINAL RESULTS' : `▶  LEVEL ${level + 1}`;
    const btn = this.add.text(width / 2, py + ph - 44, btnLabel, {
      fontFamily: '"Arial Black", Arial',
      fontSize: '24px',
      color: '#FFFFFF',
      backgroundColor: '#B45309',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#D97706' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#B45309' }));
    btn.on('pointerdown', () => this._proceed(isLast, level, runningScore));

    this.input.keyboard.once('keydown-ENTER', () => this._proceed(isLast, level, runningScore));
    this.input.keyboard.once('keydown-SPACE', () => this._proceed(isLast, level, runningScore));

    // Auto-advance after 8 s
    this.time.delayedCall(8000, () => this._proceed(isLast, level, runningScore));
  }

  _proceed(isLast, level, runningScore) {
    if (isLast) {
      this.scene.start('VictoryScene', { score: runningScore });
    } else {
      this.registry.set('currentLevel', level + 1);
      this.registry.set('score', runningScore);
      this.scene.start('GameScene');
    }
  }
}

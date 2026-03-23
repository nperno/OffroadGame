'use strict';

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    this._genJeep();
    this._genRock('rock', 30, 30, 13);
    this._genRock('rock_lg', 50, 50, 23);
    this._genBoulder();
    this._genCactus();
    this._genTree();
    this._genLog();
    this._genStump();
    this._genParticle();
    this.scene.start('MenuScene');
  }

  // ── helpers ────────────────────────────────────────────────

  _g() {
    const g = this.add.graphics();
    g._done = (key, w, h) => { g.generateTexture(key, w, h); g.destroy(); };
    return g;
  }

  // Top-down jeep (64 × 40), facing right
  _genJeep() {
    const g = this._g();
    const W = 64, H = 40;

    // Chassis
    g.fillStyle(0x4B5340);
    g.fillRoundedRect(2, 6, W - 4, H - 12, 4);

    // Hood (front-right)
    g.fillStyle(0x5A6250);
    g.fillRect(42, 8, 18, H - 16);

    // Windshield
    g.fillStyle(0x7BB8D4, 0.9);
    g.fillRect(32, 10, 12, H - 20);

    // Cab / roof interior
    g.fillStyle(0x363D2F);
    g.fillRect(10, 9, 22, H - 18);

    // Front grille stripe
    g.fillStyle(0x8A8A8A);
    g.fillRect(58, 12, 4, H - 24);

    // Headlights
    g.fillStyle(0xFEF3A0);
    g.fillCircle(61, 12, 3.5);
    g.fillCircle(61, H - 12, 3.5);

    // Tail lights
    g.fillStyle(0xCC2222);
    g.fillRect(1, 13, 4, 5);
    g.fillRect(1, H - 18, 4, 5);

    // Wheels (dark rubber)
    g.fillStyle(0x111111);
    g.fillRoundedRect(44, 0,  17, 10, 2);  // front-top
    g.fillRoundedRect(44, 30, 17, 10, 2);  // front-bottom
    g.fillRoundedRect(3,  0,  17, 10, 2);  // rear-top
    g.fillRoundedRect(3,  30, 17, 10, 2);  // rear-bottom

    // Wheel rims
    g.fillStyle(0x6A6A6A);
    g.fillCircle(53, 5,  3);
    g.fillCircle(53, 35, 3);
    g.fillCircle(12, 5,  3);
    g.fillCircle(12, 35, 3);

    // Spare tyre on back
    g.fillStyle(0x1A1A1A);
    g.fillCircle(6, H / 2, 5);
    g.fillStyle(0x5A5A5A);
    g.fillCircle(6, H / 2, 2);

    g._done('jeep', W, H);
  }

  _genRock(key, W, H, r) {
    const g = this._g();
    g.fillStyle(0x7A7A7A);
    g.fillCircle(W / 2, H / 2, r);
    g.fillStyle(0xAAAAAA);
    g.fillCircle(W / 2 - r * 0.3, H / 2 - r * 0.3, r * 0.4);
    g.fillStyle(0x505050);
    g.fillCircle(W / 2 + r * 0.3, H / 2 + r * 0.25, r * 0.28);
    g._done(key, W, H);
  }

  _genBoulder() {
    const g = this._g();
    const W = 68, H = 58;
    g.fillStyle(0x555555);
    g.fillEllipse(W / 2, H / 2, W - 4, H - 4);
    g.fillStyle(0x7A7A7A);
    g.fillEllipse(W / 2 - 10, H / 2 - 10, 28, 22);
    g.fillStyle(0x3A3A3A);
    g.fillEllipse(W / 2 + 12, H / 2 + 10, 18, 14);
    g._done('boulder', W, H);
  }

  _genCactus() {
    const g = this._g();
    const W = 22, H = 52;
    // trunk
    g.fillStyle(0x1A6B2E);
    g.fillRect(9, 14, 5, 35);
    // left arm
    g.fillRect(3,  26, 6,  4);
    g.fillRect(3,  18, 4,  12);
    // right arm
    g.fillRect(13, 20, 6,  4);
    g.fillRect(17, 14, 4,  12);
    // top
    g.fillRect(9, 8, 5, 8);
    // spine highlights
    g.fillStyle(0xD4F0A0, 0.5);
    g.fillRect(7,  12, 7, 2);
    g.fillRect(2,  24, 4, 2);
    g.fillRect(16, 18, 4, 2);
    g._done('cactus', W, H);
  }

  _genTree() {
    const g = this._g();
    const W = 54, H = 54;
    // outer dark canopy
    g.fillStyle(0x133A13);
    g.fillCircle(W / 2, H / 2, 26);
    // mid canopy
    g.fillStyle(0x1C5E1C);
    g.fillCircle(W / 2 - 4, H / 2 - 4, 18);
    // highlight blobs
    g.fillStyle(0x258A25);
    g.fillCircle(W / 2 + 6, H / 2 - 7, 10);
    g.fillCircle(W / 2 - 8, H / 2 + 7, 8);
    g._done('tree', W, H);
  }

  _genLog() {
    const g = this._g();
    const W = 80, H = 22;
    g.fillStyle(0x7A3E10);
    g.fillRoundedRect(2, 3, W - 4, H - 6, 4);
    // bark grain lines
    g.fillStyle(0x9A5A20, 0.5);
    g.fillRect(8,  6,  64, 3);
    g.fillRect(8,  13, 64, 3);
    g.fillStyle(0xBB7A30, 0.3);
    g.fillRect(18, 9,  44, 2);
    // end caps
    g.fillStyle(0x5A2A08);
    g.fillRoundedRect(2, 3, 8, H - 6, 3);
    g.fillRoundedRect(W - 10, 3, 8, H - 6, 3);
    g._done('log', W, H);
  }

  _genStump() {
    const g = this._g();
    const W = 32, H = 32;
    g.fillStyle(0x7A3E10);
    g.fillCircle(W / 2, H / 2, 14);
    // rings
    g.lineStyle(2, 0x5A2A08, 0.8);
    g.strokeCircle(W / 2, H / 2, 10);
    g.strokeCircle(W / 2, H / 2, 6);
    g.fillStyle(0xBB7A30);
    g.fillCircle(W / 2, H / 2, 2);
    g._done('stump', W, H);
  }

  _genParticle() {
    const g = this._g();
    g.fillStyle(0xAA8040);
    g.fillCircle(4, 4, 4);
    g._done('particle_dirt', 8, 8);
  }
}

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const JEEP_MAX_SPEED    = 360;   // px / s  (normal surface)
const JEEP_ACCEL        = 190;   // px / s²
const JEEP_BRAKE        = 420;   // px / s²
const JEEP_DRAG         = 1.8;   // linear decel (px/s per px/s) when no input
const JEEP_TURN_RATE    = 175;   // deg / s  at full speed
const JEEP_TURN_MIN_SPD = 30;    // min speed before turning has effect

const OFF_TRACK_SPEED_MULT = 0.55;
const OFF_TRACK_DAMAGE     = 1.5;  // hp / s

const CHECKPOINT_TS   = [0.28, 0.55, 0.82]; // progress thresholds
const FINISH_RADIUS   = 90;
const FINISH_MIN_PROG = 0.94;

const SAMPLE_COUNT = 380; // spline sample points

// ─────────────────────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  create() {
    this.lives        = this.registry.get('lives')        ?? 3;
    this.score        = this.registry.get('score')        ?? 0;
    this.levelIndex   = (this.registry.get('currentLevel') ?? 1) - 1;
    this.levelData    = LEVELS[this.levelIndex];

    this.health       = 100;
    this.timeLeft     = this.levelData.timeLimit;
    this.gameActive   = false; // starts after countdown
    this.levelDone    = false;

    // Per-run state
    this.currentSpeed    = 0;
    this.speedMult       = 1.0;  // current terrain modifier
    this.isOffTrack      = false;
    this.activeHazard    = null;
    this.trackProgress   = 0;    // 0→1 along spline
    this.nearestIdx      = 0;    // last nearest sample index
    this.checkpointsDone = [false, false, false];
    this.lastCheckpointT = 0;
    this.damageFlash          = 0;   // countdown timer for red flash
    this.levelScoreDamage     = 0;   // damage dealt this level (deducted from score)
    this._obstacleHitCooldown = 0;   // grace period after hitting an obstacle
    this._prevOffTrack        = false;
    this._prevHazardType      = null;

    this._buildWorld();
    this._placeObstacles();
    this._placeHazards();
    this._spawnJeep();
    this._setupCamera();
    this._buildHUD();
    this._setupKeys();
    this._setupParticles();
    this._startCountdown();
  }

  update(time, delta) {
    Sounds.resume(); // no-op after first call; ensures context is running

    if (!this.gameActive || this.levelDone) return;
    const dt = delta / 1000; // seconds

    if (this._dmgSoundCooldown > 0) this._dmgSoundCooldown -= dt;
    this._handleInput(dt);
    this._moveJeep(dt);
    this._checkOffTrack(dt);
    this._checkHazards(dt);
    this._checkCheckpoints();
    this._checkFinish();
    this._tickTimer(dt);
    this._updateHUD(dt);
    this._updateParticles();
    Sounds.updateEngine(this.currentSpeed / JEEP_MAX_SPEED);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  WORLD BUILDING
  // ══════════════════════════════════════════════════════════════════════════

  _buildWorld() {
    const ld   = this.levelData;
    const gfx  = this.add.graphics();

    // ── Background ──────────────────────────────────────────────────────────
    gfx.fillStyle(ld.bgColor);
    gfx.fillRect(0, 0, ld.worldWidth, ld.worldHeight);

    // ── Terrain decoration blobs ─────────────────────────────────────────────
    const rng = Phaser.Math.RNG ? new Phaser.Math.RNG(ld.id * 31337) : Math;
    const rand = (min, max) => min + Math.random() * (max - min);

    for (let i = 0; i < ld.decorCount; i++) {
      const x = rand(0, ld.worldWidth);
      const y = rand(0, ld.worldHeight);
      const r = rand(ld.decorMinSize, ld.decorMaxSize);
      gfx.fillStyle(ld.decorColor, rand(0.3, 0.7));
      if (i % 3 === 0) {
        gfx.fillEllipse(x, y, r * 1.6, r * 0.9);
      } else {
        gfx.fillCircle(x, y, r);
      }
    }

    // ── Spline ───────────────────────────────────────────────────────────────
    const pts = ld.waypoints.map(p => new Phaser.Math.Vector2(p.x, p.y));
    this.trackSpline = new Phaser.Curves.Spline(pts);
    this.trackSamples = this.trackSpline.getSpacedPoints(SAMPLE_COUNT);

    // Track shadow (slightly wider, darker)
    gfx.lineStyle(ld.trackWidth + 14, 0x000000, 0.35);
    this.trackSpline.draw(gfx, 180);

    // Track edge (white border)
    gfx.lineStyle(ld.trackWidth + 6, ld.trackEdgeColor, 0.9);
    this.trackSpline.draw(gfx, 180);

    // Track surface
    gfx.lineStyle(ld.trackWidth, ld.trackColor, 1);
    this.trackSpline.draw(gfx, 180);

    // ── Centre dashes ────────────────────────────────────────────────────────
    const dashGfx = this.add.graphics();
    dashGfx.lineStyle(3, 0xFFFFFF, 0.25);
    const totalPts = this.trackSamples.length;
    for (let i = 2; i < totalPts - 2; i += 14) {
      const a = this.trackSamples[i];
      const b = this.trackSamples[Math.min(i + 6, totalPts - 1)];
      dashGfx.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
    }

    // ── Checkpoints ──────────────────────────────────────────────────────────
    const cpColors = [0x00E5FF, 0x00FF88, 0xFF9900];
    CHECKPOINT_TS.forEach((t, i) => {
      const idx     = Math.floor(t * (totalPts - 1));
      const p       = this.trackSamples[idx];
      const tangent = this.trackSpline.getTangent(t);
      TrackUtils.drawCheckpointLine(
        dashGfx, p.x, p.y, tangent, ld.trackWidth / 2, cpColors[i]
      );
    });

    // ── Finish line ──────────────────────────────────────────────────────────
    const lastPt  = this.trackSamples[totalPts - 1];
    const lastT   = 1.0;
    const fTangent = this.trackSpline.getTangent(lastT);
    TrackUtils.drawFinishLine(
      dashGfx, lastPt.x, lastPt.y, fTangent, ld.trackWidth / 2 + 10
    );
    // FINISH text
    this.add.text(lastPt.x, lastPt.y - ld.trackWidth / 2 - 28, 'FINISH', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '20px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);

    // ── Start line ───────────────────────────────────────────────────────────
    const startPt   = this.trackSamples[0];
    const startT    = 0.0;
    const sTangent  = this.trackSpline.getTangent(startT);
    TrackUtils.drawCheckpointLine(
      dashGfx, startPt.x, startPt.y, sTangent, ld.trackWidth / 2, 0xFFFF00
    );
    this.add.text(startPt.x, startPt.y - ld.trackWidth / 2 - 28, 'START', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '20px',
      color: '#FFFF00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 1);
  }

  // ── Obstacles ──────────────────────────────────────────────────────────────
  _placeObstacles() {
    this.obstacleGroup = this.physics.add.staticGroup();

    this.levelData.obstacles.forEach(obs => {
      const cfg  = OBSTACLE_CONFIGS[obs.type];
      const spr  = this.obstacleGroup.create(obs.x, obs.y, obs.type);
      spr.setDisplaySize(cfg.w, cfg.h);
      spr._damage = cfg.damage;

      if (cfg.bodyR) {
        spr.setCircle(
          cfg.bodyR,
          (cfg.w / 2)  - cfg.bodyR,
          (cfg.h / 2)  - cfg.bodyR
        );
      } else {
        spr.setSize(cfg.w * 0.85, cfg.h * 0.85);
      }
      spr.refreshBody();
    });
  }

  // ── Hazard zones (rendered + stored for overlap checking) ─────────────────
  _placeHazards() {
    this.hazards = [];
    const gfx = this.add.graphics();

    this.levelData.hazards.forEach(h => {
      const cfg = HAZARD_CONFIGS[h.type];

      // Draw ellipse
      gfx.fillStyle(cfg.color, cfg.alpha);
      gfx.fillEllipse(h.x, h.y, h.w, h.h);

      // Add a pulsing border for dangerous hazards
      if (cfg.instant || cfg.damage >= 10) {
        gfx.lineStyle(3, cfg.color, 0.6);
        gfx.strokeEllipse(h.x, h.y, h.w + 10, h.h + 10);
      }

      // Label inside hazard
      this.add.text(h.x, h.y, cfg.label, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
        alpha: 0.7,
      }).setOrigin(0.5);

      this.hazards.push({
        ...h,
        rx: h.w / 2,
        ry: h.h / 2,
        ...cfg,
      });
    });
  }

  // ── Jeep spawn ─────────────────────────────────────────────────────────────
  _spawnJeep() {
    const wp0 = this.levelData.waypoints[0];
    const wp1 = this.levelData.waypoints[1];
    const startAngle = TrackUtils.angleBetween(wp0, wp1);

    this.jeep = this.physics.add.sprite(wp0.x, wp0.y, 'jeep');
    this.jeep.setAngle(startAngle);
    this.jeep.setDepth(10);
    this.jeep.body.setSize(54, 32);
    this.jeep.body.setOffset(5, 4);

    // Collision with obstacles
    this.physics.add.collider(
      this.jeep,
      this.obstacleGroup,
      this._onObstacleHit,
      null,
      this
    );
  }

  _onObstacleHit(jeep, obs) {
    if (this._obstacleHitCooldown > 0) return;
    this._obstacleHitCooldown = 0.5; // 0.5 s grace
    this.currentSpeed *= 0.25;
    this._applyDamage(obs._damage);
    Sounds.obstacleHit();
    this.cameras.main.shake(250, 0.012);
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  _setupCamera() {
    const ld = this.levelData;
    this.cameras.main.setBounds(0, 0, ld.worldWidth, ld.worldHeight);
    this.cameras.main.startFollow(this.jeep, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);
  }

  // ── Keys ───────────────────────────────────────────────────────────────────
  _setupKeys() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.respawnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.muteKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.input.keyboard.on('keydown-M', () => {
      const muted = Sounds.toggleMute();
      if (this.muteIndicator) {
        this.muteIndicator.setText(muted ? '🔇 MUTED' : '🔊').setAlpha(1);
        this.tweens.add({
          targets: this.muteIndicator, alpha: 0,
          delay: 1200, duration: 600, ease: 'Power2',
        });
      }
    });
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  _setupParticles() {
    // Phaser 3.60 particle API — manual emit only (frequency: -1)
    this.dirtEmitter = this.add.particles(0, 0, 'particle_dirt', {
      speed:    { min: 30, max: 110 },
      lifespan: 380,
      scale:    { start: 0.9, end: 0 },
      alpha:    { start: 0.65, end: 0 },
      angle:    { min: 0, max: 360 },
      frequency: -1,
    });
    this.dirtEmitter.setDepth(9);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  _buildHUD() {
    const W = this.scale.width;
    const H = this.scale.height;
    const sf = 0; // scrollFactor

    // ── Countdown overlay (shown during 3-2-1) ──
    this.countdownText = this.add.text(W / 2, H / 2, '', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '120px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 12,
    }).setOrigin(0.5).setScrollFactor(sf).setDepth(50);

    // ── Top bar background ──────────────────────────────────────────────────
    const topBar = this.add.graphics().setScrollFactor(sf).setDepth(20);
    topBar.fillStyle(0x000000, 0.55);
    topBar.fillRect(0, 0, W, 52);

    // ── Lives ───────────────────────────────────────────────────────────────
    this.livesText = this.add.text(16, 10, '', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '20px',
      color: '#EF4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(sf).setDepth(21);

    // ── Timer ───────────────────────────────────────────────────────────────
    this.timerText = this.add.text(W / 2, 10, '1:30', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '30px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(sf).setDepth(21);

    // ── Score ───────────────────────────────────────────────────────────────
    this.scoreText = this.add.text(W - 14, 10, 'SCORE: 0', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '20px',
      color: '#FCD34D',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(sf).setDepth(21);

    // ── Health bar ──────────────────────────────────────────────────────────
    const hbY  = H - 26;
    const hbX  = (W - 280) / 2;
    const hbW  = 280;
    const hbH  = 16;

    const hbBg = this.add.graphics().setScrollFactor(sf).setDepth(21);
    hbBg.fillStyle(0x000000, 0.6);
    hbBg.fillRoundedRect(hbX - 2, hbY - 2, hbW + 4, hbH + 4, 5);
    hbBg.fillStyle(0x7F1D1D, 0.9);
    hbBg.fillRoundedRect(hbX, hbY, hbW, hbH, 4);

    this.healthBar = this.add.graphics().setScrollFactor(sf).setDepth(22);

    this.add.text(hbX - 70, hbY, 'HEALTH', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#D1D5DB',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(sf).setDepth(22);

    this._hbX = hbX; this._hbY = hbY; this._hbW = hbW; this._hbH = hbH;

    // ── Level name ──────────────────────────────────────────────────────────
    this.add.text(W / 2, H - 44, `LEVEL ${this.levelData.id} — ${this.levelData.name}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#9CA3AF',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(sf).setDepth(21);

    // ── Progress bar ────────────────────────────────────────────────────────
    const pbY  = H - 10;
    const pbX  = 10;
    const pbW  = W - 20;
    const pbBg = this.add.graphics().setScrollFactor(sf).setDepth(21);
    pbBg.fillStyle(0x374151, 0.8);
    pbBg.fillRoundedRect(pbX, pbY - 8, pbW, 7, 3);
    pbBg.lineStyle(1, 0x6B7280, 0.5);
    pbBg.strokeRoundedRect(pbX, pbY - 8, pbW, 7, 3);

    this.progressBar = this.add.graphics().setScrollFactor(sf).setDepth(22);
    this._pbX = pbX; this._pbY = pbY; this._pbW = pbW;

    // ── Off-track warning ───────────────────────────────────────────────────
    this.offTrackWarn = this.add.text(W / 2, H / 2 - 60, 'OFF TRACK!', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '42px',
      color: '#FF4400',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(sf).setDepth(30).setVisible(false);

    // ── Hazard warning ──────────────────────────────────────────────────────
    this.hazardWarn = this.add.text(W / 2, H / 2 - 8, '', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '28px',
      color: '#FFAA00',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(sf).setDepth(30).setVisible(false);

    // ── Damage flash overlay ─────────────────────────────────────────────────
    this.dmgOverlay = this.add.graphics().setScrollFactor(sf).setDepth(40);

    // ── Checkpoint flash ─────────────────────────────────────────────────────
    this.cpFlash = this.add.text(W / 2, H / 2 + 60, '', {
      fontFamily: '"Arial Black", Arial',
      fontSize: '36px',
      color: '#00FF88',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(sf).setDepth(30).setAlpha(0);

    // ── Mute indicator ────────────────────────────────────────────────────────
    this.muteIndicator = this.add.text(W - 14, H - 44, '🔊', {
      fontFamily: 'Arial', fontSize: '14px', color: '#6B7280',
    }).setOrigin(1, 0).setScrollFactor(sf).setDepth(22).setAlpha(0);

    // Small hint: press M to mute
    this.add.text(W - 14, H - 26, 'M = mute', {
      fontFamily: 'Arial', fontSize: '11px', color: '#4B5563',
    }).setOrigin(1, 0).setScrollFactor(sf).setDepth(22);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  COUNTDOWN
  // ══════════════════════════════════════════════════════════════════════════

  _startCountdown() {
    this.gameActive = false;
    const W = this.scale.width;
    const H = this.scale.height;

    const show = (msg, color, delay, done, isGo = false) => {
      this.time.delayedCall(delay, () => {
        Sounds.countdownBeep(isGo);
        this.countdownText.setText(msg).setColor(color).setVisible(true);
        this.tweens.add({
          targets: this.countdownText,
          scaleX: 1.6, scaleY: 1.6,
          alpha: 0,
          duration: 800,
          ease: 'Power2',
          onComplete: done,
        });
      });
    };

    show('3',   '#FF4444', 0,    () => {});
    show('2',   '#FF8800', 900,  () => {});
    show('1',   '#FFFF00', 1800, () => {});
    show('GO!', '#00FF88', 2700, () => {
      this.countdownText.setVisible(false);
      this.gameActive = true;
    }, true);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  INPUT & MOVEMENT
  // ══════════════════════════════════════════════════════════════════════════

  _handleInput(dt) {
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    // Respawn with R key
    if (Phaser.Input.Keyboard.JustDown(this.respawnKey)) {
      this._loseLife();
      return;
    }

    // ── Speed ───────────────────────────────────────────────────────────────
    const effectiveMax = JEEP_MAX_SPEED * this.speedMult;
    if (up) {
      this.currentSpeed += JEEP_ACCEL * this.speedMult * dt;
      this.currentSpeed  = Math.min(this.currentSpeed, effectiveMax);
    } else if (down) {
      this.currentSpeed -= JEEP_BRAKE * dt;
    } else {
      // Natural drag
      const drag = JEEP_DRAG * dt * this.currentSpeed;
      this.currentSpeed = Math.max(0, this.currentSpeed - drag);
    }
    this.currentSpeed = Math.max(-effectiveMax * 0.4, this.currentSpeed);

    // ── Steering (speed-dependent) ──────────────────────────────────────────
    const speedFactor = Math.min(1, Math.abs(this.currentSpeed) / 120);
    const turn = JEEP_TURN_RATE * speedFactor * dt;
    const dir  = this.currentSpeed >= 0 ? 1 : -1;
    if (left)  this.jeep.angle -= turn * dir;
    if (right) this.jeep.angle += turn * dir;

    // ── Obstacle cooldown ───────────────────────────────────────────────────
    if (this._obstacleHitCooldown > 0) this._obstacleHitCooldown -= dt;
  }

  _moveJeep(dt) {
    const rad = Phaser.Math.DegToRad(this.jeep.angle);
    this.jeep.setVelocity(
      Math.cos(rad) * this.currentSpeed,
      Math.sin(rad) * this.currentSpeed
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TRACK / HAZARD DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  _checkOffTrack(dt) {
    const result = TrackUtils.findNearest(
      this.trackSamples, this.jeep.x, this.jeep.y, this.nearestIdx
    );
    this.nearestIdx    = result.index;
    this.trackProgress = TrackUtils.getProgress(result.index, this.trackSamples.length);

    const halfW = this.levelData.trackWidth / 2;
    this.isOffTrack = result.distance > halfW + 8;

    // Sound: toggle rumble layer on state change
    if (this.isOffTrack !== this._prevOffTrack) {
      Sounds.setOffTrack(this.isOffTrack);
      this._prevOffTrack = this.isOffTrack;
    }

    if (this.isOffTrack) {
      this.speedMult = Math.min(this.speedMult, OFF_TRACK_SPEED_MULT);
      this._applyDamage(OFF_TRACK_DAMAGE * dt);
      this.offTrackWarn.setVisible(true);
    } else {
      this.offTrackWarn.setVisible(false);
    }
  }

  _checkHazards(dt) {
    this.speedMult  = this.isOffTrack ? OFF_TRACK_SPEED_MULT : 1.0;
    this.activeHazard = null;

    for (const h of this.hazards) {
      const dx = this.jeep.x - h.x;
      const dy = this.jeep.y - h.y;
      // Ellipse membership test
      if ((dx * dx) / (h.rx * h.rx) + (dy * dy) / (h.ry * h.ry) <= 1) {
        this.activeHazard = h;

        if (h.instant) {
          this._loseLife();
          return;
        }
        // Play entry sound once per hazard type entry
        if (this._prevHazardType !== h.type) {
          Sounds.hazardEnter(h.type);
          this._prevHazardType = h.type;
        }
        this.speedMult = Math.min(this.speedMult, h.speedMult);
        this._applyDamage(h.damage * dt);
        break;
      }
    }

    if (this.activeHazard) {
      this.hazardWarn.setText(this.activeHazard.label).setVisible(true);
    } else {
      this.hazardWarn.setVisible(false);
      this._prevHazardType = null; // reset so re-entry triggers sound again
    }
  }

  _checkCheckpoints() {
    CHECKPOINT_TS.forEach((t, i) => {
      if (!this.checkpointsDone[i] && this.trackProgress >= t) {
        this.checkpointsDone[i] = true;
        this.lastCheckpointT    = t;
        this._onCheckpoint(i);
      }
    });
  }

  _onCheckpoint(i) {
    const bonus = 100;
    this.score += bonus;
    Sounds.checkpoint();
    this.cpFlash.setText(`CHECKPOINT +${bonus}`).setAlpha(1);
    this.tweens.add({
      targets: this.cpFlash,
      alpha: 0,
      duration: 1600,
      ease: 'Power2',
    });
  }

  _checkFinish() {
    if (this.trackProgress < FINISH_MIN_PROG) return;
    const last = this.trackSamples[this.trackSamples.length - 1];
    const d = Phaser.Math.Distance.Between(this.jeep.x, this.jeep.y, last.x, last.y);
    if (d < FINISH_RADIUS) {
      this._levelComplete();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TIMER
  // ══════════════════════════════════════════════════════════════════════════

  _tickTimer(dt) {
    if (!this.gameActive || this.levelDone) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._loseLife();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DAMAGE / LIVES
  // ══════════════════════════════════════════════════════════════════════════

  _applyDamage(amount) {
    if (amount <= 0) return;
    this.health -= amount;
    this.levelScoreDamage += amount;
    this.damageFlash = 0.18;
    // Play a brief damage tick every ~0.4s to avoid spam
    if (!this._dmgSoundCooldown || this._dmgSoundCooldown <= 0) {
      Sounds.takeDamage();
      this._dmgSoundCooldown = 0.4;
    }
    if (this.health <= 0) {
      this.health = 0;
      this._loseLife();
    }
  }

  _loseLife() {
    if (this.levelDone) return;
    this.lives--;
    this.registry.set('lives', this.lives);

    if (this.lives <= 0) {
      this._gameOver();
      return;
    }

    Sounds.loseLife();
    Sounds.setOffTrack(false);  // reset rumble on respawn
    this._prevOffTrack   = false;
    this._prevHazardType = null;

    // Respawn at last checkpoint
    this.health    = 100;
    this.timeLeft  = this.levelData.timeLimit;
    this.currentSpeed = 0;
    this.isOffTrack   = false;

    const t   = this.lastCheckpointT;
    const idx = Math.floor(t * (this.trackSamples.length - 1));
    const pos = this.trackSamples[idx];
    const tangent = this.trackSpline.getTangent(t);

    this.jeep.setPosition(pos.x, pos.y);
    this.jeep.setAngle(Phaser.Math.RadToDeg(Math.atan2(tangent.y, tangent.x)));

    this.cameras.main.flash(600, 255, 50, 50);

    // Brief invincibility
    this.gameActive = false;
    this.time.delayedCall(800, () => { this.gameActive = true; });
  }

  _gameOver() {
    this.levelDone  = true;
    this.gameActive = false;
    Sounds.gameOver();
    Sounds.setOffTrack(false);
    Sounds.updateEngine(0);
    this.time.delayedCall(400, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        level: this.levelData.id,
      });
    });
  }

  _levelComplete() {
    if (this.levelDone) return;
    this.levelDone = true;

    const timeBonus   = Math.floor(this.timeLeft * 6);
    const livesBonus  = this.lives * 75;
    const dmgPenalty  = Math.floor(this.levelScoreDamage);
    const totalLevelScore = 500 + timeBonus + livesBonus - dmgPenalty;
    const runningScore    = this.score + Math.max(0, totalLevelScore);

    this.registry.set('score', runningScore);
    this.registry.set('lives', this.lives);

    Sounds.levelComplete();
    Sounds.setOffTrack(false);
    Sounds.updateEngine(0);

    // Flash
    this.cameras.main.flash(400, 255, 255, 255);

    this.time.delayedCall(600, () => {
      this.scene.start('LevelCompleteScene', {
        level: this.levelData.id,
        timeBonus,
        livesBonus,
        totalLevelScore: Math.max(0, totalLevelScore),
        runningScore,
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HUD UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  _updateHUD(dt) {
    // Lives
    const lifeStr = '♥ '.repeat(this.lives).trim() || 'NONE';
    this.livesText.setText(`LIVES: ${lifeStr}`);

    // Timer
    const mins = Math.floor(this.timeLeft / 60);
    const secs = Math.floor(this.timeLeft % 60);
    const tStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    this.timerText.setText(tStr);
    this.timerText.setColor(this.timeLeft < 15 ? '#EF4444' : '#FFFFFF');

    // Score
    this.scoreText.setText(`SCORE: ${this.score}`);

    // Health bar
    this.healthBar.clear();
    const pct = Math.max(0, this.health / 100);
    const col = pct > 0.6 ? 0x22C55E : pct > 0.3 ? 0xEAB308 : 0xEF4444;
    this.healthBar.fillStyle(col, 0.95);
    this.healthBar.fillRoundedRect(
      this._hbX, this._hbY,
      this._hbW * pct, this._hbH,
      4
    );

    // Progress bar
    this.progressBar.clear();
    this.progressBar.fillStyle(0x3B82F6, 0.9);
    this.progressBar.fillRoundedRect(
      this._pbX, this._pbY - 8,
      this._pbW * this.trackProgress, 7,
      3
    );

    // Jeep icon on progress bar
    this.progressBar.fillStyle(0xFCD34D, 1);
    const jeepX = this._pbX + this._pbW * this.trackProgress;
    this.progressBar.fillTriangle(
      jeepX, this._pbY - 16,
      jeepX - 6, this._pbY - 8,
      jeepX + 6, this._pbY - 8
    );

    // Damage flash
    this.dmgOverlay.clear();
    if (this.damageFlash > 0) {
      const a = this.damageFlash / 0.18;
      this.dmgOverlay.fillStyle(0xFF0000, a * 0.35);
      this.dmgOverlay.fillRect(0, 0, this.scale.width, this.scale.height);
      this.damageFlash -= dt;
    }

    // Warn if low health
    if (this.health < 25 && Math.floor(this.time.now / 400) % 2 === 0) {
      this.healthBar.lineStyle(2, 0xFF0000, 1);
      this.healthBar.strokeRoundedRect(
        this._hbX, this._hbY, this._hbW, this._hbH, 4
      );
    }
  }

  _updateParticles() {
    if (!this.gameActive) return;
    const spd = Math.abs(this.currentSpeed);
    if (spd > 50) {
      // Emit dirt behind the jeep
      const ang = Phaser.Math.DegToRad(this.jeep.angle + 180);
      const ex  = this.jeep.x + Math.cos(ang) * 22;
      const ey  = this.jeep.y + Math.sin(ang) * 22;
      const cnt = Math.min(4, Math.ceil(spd / 100));
      try { this.dirtEmitter.explode(cnt, ex, ey); } catch (e) { /* ignore if unavailable */ }
    }
  }
}

# Off-Road Rampage 🚙

A top-down off-road racing game built with [Phaser 3](https://phaser.io/). Race against the clock across 6 progressively harder levels — from grassy meadows to volcanic hellscapes. All visuals and audio are generated procedurally; no external assets required.

## Play

Just open `index.html` in any modern browser. No build step, no dependencies to install.

```bash
git clone https://github.com/nperno/OffroadGame.git
cd OffroadGame
open index.html
```

> Tip: if audio doesn't start immediately, click the **PRESS ENTER TO START** button (browsers require a user gesture before playing audio).

## Controls

| Key | Action |
|-----|--------|
| `↑` / `W` | Accelerate |
| `↓` / `S` | Brake / Reverse |
| `←` / `→` or `A` / `D` | Steer |
| `R` | Manual respawn (costs a life) |
| `M` | Toggle mute |

## Gameplay

- **Race against the clock** — point-to-point courses, no AI opponents
- **3 lives** — lose one when health hits 0 or the timer runs out
- **Health bar** — drained by obstacles, hazards, and going off-track
- **3 checkpoints** per level — respawn here if you wipe out
- **Score** — base 500 pts + time bonus + lives bonus − damage taken, carried across all 6 levels
- **High score** saved to `localStorage`

## Levels

| # | Name | Hazards |
|---|------|---------|
| 1 | Meadow Dash | Mud patches, scattered rocks |
| 2 | Desert Crossing | Quicksand, cacti, sand drifts |
| 3 | Swamp Crossing | Mud pits, deep water (instant death), fallen logs |
| 4 | Forest Run | Dense trees, swamp pools, tight curves |
| 5 | Mountain Pass | Boulders, cliff edges (instant death), narrow track |
| 6 | Volcanic Crossing | Lava zones, ash clouds, boulders — narrowest track |

## Sound Effects

All audio is synthesised at runtime via the **Web Audio API**:

- Engine roar that pitches up with speed
- Off-track rumble layer
- Obstacle collision thud
- Hazard entry sounds (splash, sizzle, alarm)
- Checkpoint chime, level-complete fanfare, game-over dirge
- 3-2-1-GO countdown beeps

## Tech Stack

- **[Phaser 3.60](https://phaser.io/)** — game framework (loaded via CDN)
- **Web Audio API** — procedural sound synthesis
- Vanilla HTML / CSS / JS — no build tooling

## Project Structure

```
index.html
css/
  style.css
js/
  main.js                    # Phaser config
  data/
    LevelData.js             # All 6 level definitions + obstacle/hazard configs
  utils/
    TrackUtils.js            # Spline nearest-point, checkpoint/finish drawing
    SoundManager.js          # Procedural audio engine
  scenes/
    BootScene.js             # Programmatic texture generation
    MenuScene.js
    GameScene.js             # Core game loop (shared across all levels)
    LevelCompleteScene.js
    GameOverScene.js
    VictoryScene.js
```

## License

MIT

'use strict';

const TrackUtils = {
  /**
   * Find the nearest point in a sampled path array to (x, y).
   * Searches within `range` indices of `hint` for efficiency.
   * Falls back to full scan if the nearest is at a boundary.
   */
  findNearest(points, x, y, hint = 0, range = 60) {
    let minDist = Infinity;
    let minIdx = 0;
    const start = Math.max(0, hint - range);
    const end = Math.min(points.length - 1, hint + range);

    for (let i = start; i <= end; i++) {
      const d = Math.hypot(points[i].x - x, points[i].y - y);
      if (d < minDist) { minDist = d; minIdx = i; }
    }

    // If result is at a boundary, do a full scan to avoid getting stuck
    if (minIdx === start || minIdx === end) {
      for (let i = 0; i < points.length; i++) {
        const d = Math.hypot(points[i].x - x, points[i].y - y);
        if (d < minDist) { minDist = d; minIdx = i; }
      }
    }

    return { index: minIdx, distance: minDist };
  },

  /** Normalized progress along the track (0–1) */
  getProgress(index, total) {
    return index / (total - 1);
  },

  /** Angle in degrees from point a to point b */
  angleBetween(a, b) {
    return Phaser.Math.RadToDeg(Math.atan2(b.y - a.y, b.x - a.x));
  },

  /** Draw a checkered finish-line rectangle across the track */
  drawFinishLine(graphics, cx, cy, tangent, halfWidth, squareSize = 16) {
    const perp = { x: -tangent.y, y: tangent.x };
    const cols = Math.ceil((halfWidth * 2) / squareSize);
    const rows = 3;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isDark = (r + c) % 2 === 0;
        graphics.fillStyle(isDark ? 0x000000 : 0xffffff, 1);
        const ox = (c - cols / 2) * squareSize + squareSize / 2;
        const oy = (r - rows / 2) * squareSize + squareSize / 2;
        const wx = cx + perp.x * ox + tangent.x * oy;
        const wy = cy + perp.y * ox + tangent.y * oy;
        graphics.fillRect(wx - squareSize / 2, wy - squareSize / 2, squareSize, squareSize);
      }
    }
  },

  /** Draw a colored checkpoint stripe perpendicular to the track */
  drawCheckpointLine(graphics, cx, cy, tangent, halfWidth, color) {
    const perp = { x: -tangent.y, y: tangent.x };
    const x1 = cx + perp.x * (halfWidth + 10);
    const y1 = cy + perp.y * (halfWidth + 10);
    const x2 = cx - perp.x * (halfWidth + 10);
    const y2 = cy - perp.y * (halfWidth + 10);
    graphics.lineStyle(8, color, 0.9);
    graphics.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
  }
};

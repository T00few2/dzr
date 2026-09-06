const { workoutSegments } = require("./zwoBuilder");

/**
 * Render a Zwift-style workout profile as a PNG.
 *
 * A thin drawing layer: all the arithmetic lives in workoutSegments, which is pure and unit
 * tested. This file only turns those segments into pixels, so it needs no tests of its own —
 * which matters, because `canvas` is a native module that cannot be installed in CI.
 *
 * Rendering is best-effort by design. The .zwo file is the deliverable; the picture is a
 * convenience, so every failure path here returns null and the caller sends the workout anyway.
 */

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = { top: 28, right: 20, bottom: 34, left: 46 };

// Zone colours, FTP-relative, matching how riders talk about efforts.
const ZONES = [
  { max: 0.55, colour: "#7f8c8d" }, // recovery
  { max: 0.75, colour: "#3498db" }, // endurance
  { max: 0.9, colour: "#2ecc71" },  // tempo
  { max: 1.05, colour: "#f1c40f" }, // threshold
  { max: 1.2, colour: "#e67e22" },  // VO2
  { max: Infinity, colour: "#e74c3c" }, // anaerobic
];

function zoneColour(power) {
  return (ZONES.find((zone) => power <= zone.max) || ZONES[ZONES.length - 1]).colour;
}

/**
 * @returns {Buffer|null} PNG buffer, or null if the workout is empty or canvas is unavailable.
 */
function renderWorkoutChart(steps, { name = "" } = {}) {
  let createCanvas;
  try {
    // Required lazily: `canvas` is native, and a missing or unbuildable binary must not stop a
    // workout being delivered.
    ({ createCanvas } = require("canvas"));
  } catch (err) {
    console.warn("workout chart: canvas unavailable, sending without image:", err?.message || err);
    return null;
  }

  try {
    const segments = workoutSegments(steps);
    if (!segments.length) return null;

    const total = segments.reduce((sum, s) => sum + s.durationSeconds, 0);
    if (total <= 0) return null;

    const peak = Math.max(1.2, ...segments.map((s) => Math.max(s.powerFrom, s.powerTo)));

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const x = (seconds) => PADDING.left + (seconds / total) * plotWidth;
    const y = (power) => PADDING.top + plotHeight - (power / peak) * plotHeight;

    ctx.fillStyle = "#1b1f24";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Horizontal guides at meaningful FTP fractions, not arbitrary round numbers.
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "middle";
    for (const level of [0.5, 0.75, 1.0, 1.25]) {
      if (level > peak) continue;
      const gy = y(level);
      ctx.strokeStyle = level === 1.0 ? "#5b6570" : "#2c323a";
      ctx.lineWidth = level === 1.0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, gy);
      ctx.lineTo(WIDTH - PADDING.right, gy);
      ctx.stroke();
      ctx.fillStyle = "#8b949e";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(level * 100)}%`, PADDING.left - 6, gy);
    }

    // Each segment as a block, ramps drawn as a slope so a warmup reads as a warmup.
    for (const segment of segments) {
      const x0 = x(segment.startSeconds);
      const x1 = x(segment.startSeconds + segment.durationSeconds);
      const baseline = y(0);

      ctx.fillStyle = zoneColour(Math.max(segment.powerFrom, segment.powerTo));
      ctx.beginPath();
      ctx.moveTo(x0, baseline);
      ctx.lineTo(x0, y(segment.powerFrom));
      ctx.lineTo(x1, y(segment.powerTo));
      ctx.lineTo(x1, baseline);
      ctx.closePath();
      ctx.fill();

      // Hairline separators, but only when blocks are wide enough for one to be legible.
      if (x1 - x0 > 3) {
        ctx.strokeStyle = "rgba(27,31,36,0.65)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Axis line and duration labels.
    ctx.strokeStyle = "#5b6570";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y(0));
    ctx.lineTo(WIDTH - PADDING.right, y(0));
    ctx.stroke();

    ctx.fillStyle = "#8b949e";
    ctx.textAlign = "left";
    ctx.fillText("0 min", PADDING.left, HEIGHT - PADDING.bottom / 2);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(total / 60)} min`, WIDTH - PADDING.right, HEIGHT - PADDING.bottom / 2);

    if (name) {
      ctx.fillStyle = "#e6edf3";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(name).slice(0, 60), PADDING.left, PADDING.top / 2);
    }

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.warn("workout chart: render failed, sending without image:", err?.message || err);
    return null;
  }
}

module.exports = { renderWorkoutChart, zoneColour };

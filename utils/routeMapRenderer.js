const { createCanvas } = require("canvas");

const ROUTE_COLOR = "#fc6719";
const BG_COLOR = "#1a1d23";

/**
 * Project lat/lng into canvas pixels using a geographic bounding box.
 * bounds: [[north, west], [south, east]] (zwift-data / Leaflet imageOverlay style)
 */
function project(lat, lng, bounds, width, height, padding = 0) {
  const [[north, west], [south, east]] = bounds;
  const drawW = width - padding * 2;
  const drawH = height - padding * 2;
  const x = padding + ((lng - west) / (east - west)) * drawW;
  const y = padding + ((lat - north) / (south - north)) * drawH;
  return { x, y };
}

function getLatLngBounds(latlng) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of latlng) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  // Expand slightly so the line isn't glued to the edges
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.12, 0.002);
  return [
    [maxLat + latPad, minLng - lngPad], // north, west
    [minLat - latPad, maxLng + lngPad], // south, east
  ];
}

/**
 * Downsample dense polylines for cleaner drawing.
 */
function downsample(latlng, maxPoints = 800) {
  if (!Array.isArray(latlng) || latlng.length <= maxPoints) return latlng;
  const step = Math.ceil(latlng.length / maxPoints);
  const out = [];
  for (let i = 0; i < latlng.length; i += step) out.push(latlng[i]);
  const last = latlng[latlng.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Render a ZwiftQuiz-style route silhouette (orange line on dark background).
 * @returns {Buffer} PNG buffer
 */
function renderRouteSilhouette(latlng, options = {}) {
  const width = options.width || 900;
  const height = options.height || 700;
  const points = downsample(latlng);
  if (!points?.length) {
    throw new Error("No lat/lng points to render");
  }

  const bounds = getLatLngBounds(points);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Soft vignette
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7
  );
  grad.addColorStop(0, "rgba(255,255,255,0.03)");
  grad.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ROUTE_COLOR;
  ctx.lineWidth = options.lineWidth || 5;
  ctx.shadowColor = "rgba(252, 103, 25, 0.45)";
  ctx.shadowBlur = 8;

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [lat, lng] = points[i];
    const { x, y } = project(lat, lng, bounds, width, height, 36);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Start marker
  const [startLat, startLng] = points[0];
  const start = project(startLat, startLng, bounds, width, height, 36);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ROUTE_COLOR;
  ctx.beginPath();
  ctx.arc(start.x, start.y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

module.exports = {
  renderRouteSilhouette,
};

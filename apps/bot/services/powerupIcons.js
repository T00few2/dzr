// Zwift powerup ids and the support-site icons. 9 is a count sentinel, not a powerup.
const https = require("https");
const http = require("http");

const CDN = "https://content-cdn.zwift.com/support/EN/Cycling/Resources/Images/";
const ADVANCED = `${CDN}Advanced%20Features/`;

const POWERUPS = {
  0: { name: "Feather", url: `${ADVANCED}lightweight.png` },
  1: { name: "Draft", url: `${ADVANCED}draftboost.png` },
  2: { name: "Small XP", url: `${ADVANCED}Small%20Bonus.png` },
  3: { name: "Large XP", url: `${ADVANCED}Large%20Bonus.png` },
  4: { name: "Burrito", url: `${ADVANCED}Burrito.png` },
  5: { name: "Aero", url: `${ADVANCED}aeroboost.png` },
  6: { name: "Ghost", url: `${ADVANCED}invisible_63x67.jpg` },
  7: { name: "Steamroller", url: `${ADVANCED}streamroller_58x58.png` },
  8: { name: "Anvil", url: `${ADVANCED}Anvil_PowerUp.png` },
  10: { name: "Boost", url: `${CDN}Boost.png` },
};

const NAMES = {
  feather: 0,
  lightweight: 0,
  lightness: 0,
  draft: 1,
  draftboost: 1,
  van: 1,
  "small xp": 2,
  "small bonus": 2,
  small: 2,
  "large xp": 3,
  "large bonus": 3,
  bonus: 3,
  burrito: 4,
  aero: 5,
  aeroboost: 5,
  ghost: 6,
  invisible: 6,
  steamroller: 7,
  anvil: 8,
  boost: 10,
};

function powerupName(id) {
  const row = POWERUPS[id];
  return row ? row.name : null;
}

function resolvePowerupId(value) {
  if (typeof value === "number" && POWERUPS[value]) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (/^\d+$/.test(text) && POWERUPS[Number(text)]) return Number(text);
  return Object.prototype.hasOwnProperty.call(NAMES, text) ? NAMES[text] : null;
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("http:") ? http : https;
    lib
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
          res.resume();
          resolve(fetchBuffer(new URL(res.headers.location, url).href, redirects + 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

const iconCache = new Map();

async function loadPowerupImage(idOrName) {
  const id = resolvePowerupId(idOrName);
  if (id == null) return null;
  if (iconCache.has(id)) return iconCache.get(id);
  let canvas;
  try {
    canvas = require("canvas");
  } catch {
    iconCache.set(id, null);
    return null;
  }
  try {
    const image = await canvas.loadImage(await fetchBuffer(POWERUPS[id].url));
    iconCache.set(id, image);
    return image;
  } catch {
    iconCache.set(id, null);
    return null;
  }
}

module.exports = { POWERUPS, powerupName, resolvePowerupId, loadPowerupImage };

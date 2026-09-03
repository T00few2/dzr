const crypto = require("crypto");
const admin = require("firebase-admin");
const config = require("../config/config");
const shared = require("../constants.json");
const { db, getUserZwiftId, getLatestClubStats, isPaidClubMember } = require("./firebase");
const {
  canEncryptTokens,
  encryptedTokenFields,
  hasStravaRefreshToken,
  needsTokenMigration,
  readStravaTokens,
} = require("./tokenCrypto");

const COLLECTION = shared.firestore.stravaConnections || "strava_connections";
const STRAVA_API = "https://www.strava.com/api/v3";
const CONNECT_TOKEN_TTL_MS = 15 * 60 * 1000;
const TOKEN_REFRESH_SKEW_SEC = 60;

function notClubMemberResult() {
  return {
    success: false,
    not_club_member: true,
    message: "DZR Coach is only available to paid club members for the current year.",
  };
}

function hmac(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function mintConnectToken(discordId, ttlMs = CONNECT_TOKEN_TTL_MS) {
  const secret = String(config.strava?.connectSecret || "").trim();
  if (!secret) return null;
  const payload = { d: String(discordId), e: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

function getConnectUrl(discordId) {
  const token = mintConnectToken(discordId);
  if (!token) return null;
  const origin = String(config.strava?.siteOrigin || shared.siteOrigin || "").replace(/\/+$/, "");
  return `${origin}/strava/connect?token=${encodeURIComponent(token)}`;
}

async function hasClubMemberRole(userId) {
  return isPaidClubMember(userId);
}

async function getConnection(discordId) {
  const snap = await db.collection(COLLECTION).doc(String(discordId)).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  let tokens;
  try {
    tokens = readStravaTokens(data);
  } catch (err) {
    console.error("strava token decrypt failed:", err?.message || err);
    return null;
  }
  const conn = {
    id: snap.id,
    ...data,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
  if (needsTokenMigration(data) && tokens.refreshToken) {
    try {
      await persistEncryptedTokens(discordId, tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      console.warn("strava token migration failed:", err?.message || err);
    }
  }
  return conn;
}

async function persistEncryptedTokens(discordId, accessToken, refreshToken) {
  const patch = encryptedTokenFields(accessToken, refreshToken);
  if (canEncryptTokens()) {
    patch.accessToken = admin.firestore.FieldValue.delete();
    patch.refreshToken = admin.firestore.FieldValue.delete();
  }
  patch.updatedAt = new Date();
  await db.collection(COLLECTION).doc(String(discordId)).set(patch, { merge: true });
}

async function isStravaConnected(discordId) {
  const snap = await db.collection(COLLECTION).doc(String(discordId)).get();
  if (!snap.exists) return false;
  return hasStravaRefreshToken(snap.data() || {});
}

async function saveTokens(discordId, patch) {
  const next = { ...patch, updatedAt: new Date() };
  if (next.accessToken != null || next.refreshToken != null) {
    const existing = await db.collection(COLLECTION).doc(String(discordId)).get();
    const current = existing.exists ? readStravaTokens(existing.data() || {}) : { accessToken: "", refreshToken: "" };
    const access = next.accessToken != null ? String(next.accessToken) : current.accessToken;
    const refresh = next.refreshToken != null ? String(next.refreshToken) : current.refreshToken;
    Object.assign(next, encryptedTokenFields(access, refresh));
    if (canEncryptTokens()) {
      next.accessToken = admin.firestore.FieldValue.delete();
      next.refreshToken = admin.firestore.FieldValue.delete();
    } else {
      console.warn("STRAVA_TOKEN_KEY / STRAVA_CONNECT_SECRET missing; storing Strava tokens in plaintext");
    }
  }
  await db.collection(COLLECTION).doc(String(discordId)).set(next, { merge: true });
}

async function refreshAccessToken(conn, discordId) {
  const clientId = String(config.strava?.clientId || "").trim();
  const clientSecret = String(config.strava?.clientSecret || "").trim();
  if (!clientId || !clientSecret) {
    const err = new Error("STRAVA_CLIENT_ID/SECRET not configured");
    err.code = "strava_env";
    throw err;
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    const err = new Error("Strava token refresh failed");
    err.status = res.status;
    err.code = res.status === 400 || res.status === 401 ? "needs_reconnect" : "refresh_failed";
    throw err;
  }

  const next = {
    accessToken: String(body.access_token),
    refreshToken: String(body.refresh_token || conn.refreshToken),
    expiresAt: Number(body.expires_at) || Math.floor(Date.now() / 1000) + 20000,
    scopes: body.scope ? String(body.scope) : conn.scopes || null,
  };
  await saveTokens(discordId, next);
  return { ...conn, ...next };
}

async function getValidAccessToken(discordId) {
  const conn = await getConnection(discordId);
  if (!conn?.refreshToken) {
    const err = new Error("not_connected");
    err.code = "not_connected";
    throw err;
  }
  const expiresAt = Number(conn.expiresAt) || 0;
  const now = Math.floor(Date.now() / 1000);
  if (conn.accessToken && expiresAt > now + TOKEN_REFRESH_SKEW_SEC) {
    return { token: conn.accessToken, conn };
  }
  const refreshed = await refreshAccessToken(conn, discordId);
  return { token: refreshed.accessToken, conn: refreshed };
}

function reconnectResult(discordId) {
  return {
    success: false,
    needs_reconnect: true,
    connectUrl: getConnectUrl(discordId),
    message: "Strava connection expired or was revoked. Reconnect via the link.",
  };
}

async function stravaGet(discordId, path) {
  const { token, conn } = await getValidAccessToken(discordId);
  const res = await fetch(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error("strava_unauthorized");
    err.code = "needs_reconnect";
    throw err;
  }
  if (res.status === 429) {
    const err = new Error("strava_rate_limited");
    err.code = "rate_limited";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Strava ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return { data: await res.json(), conn };
}

function compactActivity(a) {
  if (!a || typeof a !== "object") return null;
  return {
    id: a.id,
    name: a.name,
    sport_type: a.sport_type || a.type,
    start_date: a.start_date || a.start_date_local,
    timezone: a.timezone || null,
    moving_time: a.moving_time,
    elapsed_time: a.elapsed_time,
    distance_m: a.distance,
    elevation_gain_m: a.total_elevation_gain,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    average_watts: a.average_watts ?? null,
    weighted_average_watts: a.weighted_average_watts ?? null,
    max_watts: a.max_watts ?? null,
    kilojoules: a.kilojoules ?? null,
    suffer_score: a.suffer_score ?? null,
    trainer: !!a.trainer,
    commute: !!a.commute,
  };
}

function compactActivityDetails(a) {
  const base = compactActivity(a);
  if (!base) return null;
  return {
    ...base,
    description: typeof a.description === "string" ? a.description.slice(0, 400) : null,
    calories: a.calories ?? null,
    average_cadence: a.average_cadence ?? null,
    device_watts: a.device_watts ?? null,
    athlete_id: a.athlete?.id ?? null,
    laps: Array.isArray(a.laps)
      ? a.laps.slice(0, 20).map((l) => ({
          name: l.name,
          elapsed_time: l.elapsed_time,
          moving_time: l.moving_time,
          distance_m: l.distance,
          average_watts: l.average_watts ?? null,
          average_heartrate: l.average_heartrate ?? null,
        }))
      : undefined,
  };
}

async function wrapCall(discordId, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === "not_connected" || err?.code === "needs_reconnect") {
      return reconnectResult(discordId);
    }
    if (err?.code === "rate_limited") {
      return { success: false, message: "Strava rate limit reached. Try again in a few minutes." };
    }
    if (err?.code === "strava_env") {
      return { success: false, message: "Strava is not configured on the bot." };
    }
    console.error("stravaService error:", err?.message || err);
    return { success: false, message: "Could not fetch Strava data. Try again later." };
  }
}

async function getAthleteProfile(discordId) {
  return wrapCall(discordId, async () => {
    const { data } = await stravaGet(discordId, "/athlete");
    return {
      success: true,
      athlete: {
        id: data.id,
        firstname: data.firstname,
        lastname: data.lastname,
        city: data.city || null,
        country: data.country || null,
        sex: data.sex || null,
        weight_kg: data.weight ?? null,
        ftp: data.ftp ?? null,
        clubs: Array.isArray(data.clubs)
          ? data.clubs.slice(0, 8).map((c) => c.name).filter(Boolean)
          : [],
      },
    };
  });
}

async function getAthleteStats(discordId) {
  return wrapCall(discordId, async () => {
    let conn = (await getValidAccessToken(discordId)).conn;
    let athleteId = conn.athleteId;
    if (!athleteId) {
      const profile = await stravaGet(discordId, "/athlete");
      athleteId = profile.data?.id;
      if (!athleteId) return { success: false, message: "Missing Strava athlete id." };
      await saveTokens(discordId, { athleteId: Number(athleteId) });
    }
    const { data } = await stravaGet(discordId, `/athletes/${athleteId}/stats`);
    return {
      success: true,
      stats: {
        recent_ride_totals: data.recent_ride_totals || null,
        ytd_ride_totals: data.ytd_ride_totals || null,
        all_ride_totals: data.all_ride_totals || null,
        recent_run_totals: data.recent_run_totals || null,
        ytd_run_totals: data.ytd_run_totals || null,
      },
    };
  });
}

async function getAthleteZones(discordId) {
  return wrapCall(discordId, async () => {
    const { data } = await stravaGet(discordId, "/athlete/zones");
    return {
      success: true,
      zones: {
        heart_rate: data.heart_rate || null,
        power: data.power || null,
      },
    };
  });
}

async function getRecentActivities(discordId, { days = 14, perPage = 30 } = {}) {
  const clampedDays = Math.min(Math.max(Number(days) || 14, 1), 28);
    const clampedPage = Math.min(Math.max(Number(perPage) || 30, 1), 50);
  const after = Math.floor((Date.now() - clampedDays * 24 * 60 * 60 * 1000) / 1000);
  return wrapCall(discordId, async () => {
    const { data } = await stravaGet(
      discordId,
      `/athlete/activities?after=${after}&per_page=${clampedPage}`
    );
    const list = Array.isArray(data) ? data : [];
    return {
      success: true,
      days: clampedDays,
      activities: list.map(compactActivity).filter(Boolean),
    };
  });
}

async function getActivityDetails(discordId, activityId) {
  const id = String(activityId || "").trim();
  if (!/^\d+$/.test(id)) {
    return { success: false, message: "Invalid activity id." };
  }
  return wrapCall(discordId, async () => {
    const { data, conn } = await stravaGet(discordId, `/activities/${id}`);
    const ownerId = data?.athlete?.id;
    if (conn.athleteId && ownerId && Number(ownerId) !== Number(conn.athleteId)) {
      return { success: false, message: "That activity is not yours." };
    }
    return {
      success: true,
      activity: compactActivityDetails(data),
    };
  });
}

async function getZwiftPowerContext(discordId) {
  try {
    const zwiftId = await getUserZwiftId(discordId);
    if (!zwiftId) {
      return { success: true, zwiftpower: { linked: false } };
    }
    const latest = await getLatestClubStats();
    const riders = Array.isArray(latest?.riders) ? latest.riders : [];
    const rider = riders.find((r) => String(r.riderId) === String(zwiftId));
    if (!rider) {
      return { success: true, zwiftpower: { linked: true, zwiftId, inClubStats: false } };
    }
    return {
      success: true,
      zwiftpower: {
        linked: true,
        zwiftId,
        name: rider.name || null,
        phenotype: rider.phenotype?.value || rider.phenotype || null,
        paceGroup: rider.zpCategory || rider.category || null,
        ftpWatts: rider.zpFTP ?? rider.ftp ?? null,
        veloCategory: rider.race?.current?.mixed?.category || rider.velo?.category || null,
      },
    };
  } catch (err) {
    console.error("getZwiftPowerContext error:", err?.message || err);
    return { success: false, message: "Could not load ZwiftPower context." };
  }
}

module.exports = {
  mintConnectToken,
  getConnectUrl,
  hasClubMemberRole,
  notClubMemberResult,
  isStravaConnected,
  getConnection,
  getAthleteProfile,
  getAthleteStats,
  getAthleteZones,
  getRecentActivities,
  getActivityDetails,
  getZwiftPowerContext,
};

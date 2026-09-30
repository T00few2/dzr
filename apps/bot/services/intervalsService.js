const crypto = require("crypto");
const admin = require("firebase-admin");
const config = require("../config/config");
const shared = require("../constants.json");
const { db, getUserZwiftId, getLatestClubStats, isPaidClubMember } = require("./firebase");
const metrics = require("./streamMetrics");
const weeklyLoad = require("./weeklyLoad");
const {
  canEncryptTokens,
  encryptedTokenFields,
  needsTokenMigration,
  readConnectionTokens,
} = require("./tokenCrypto");

const COLLECTION = shared.firestore.intervalsConnections || "intervals_connections";
const API = "https://intervals.icu/api/v1";
const CONNECT_TOKEN_TTL_MS = 15 * 60 * 1000;
const STREAM_CACHE_COLLECTION = "coach_activity_metrics";
const WEEKLY_LOAD_COLLECTION = "coach_weekly_load";
const USER_AGENT = "DZR-Coach/1.0";

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

function connectSecret() {
  return String(config.intervals?.connectSecret || "").trim();
}

function mintConnectToken(discordId, ttlMs = CONNECT_TOKEN_TTL_MS) {
  const secret = connectSecret();
  if (!secret) return null;
  const payload = { d: String(discordId), e: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

function getConnectUrl(discordId) {
  const token = mintConnectToken(discordId);
  if (!token) return null;
  const origin = String(config.intervals?.siteOrigin || shared.siteOrigin || "").replace(/\/+$/, "");
  return `${origin}/intervals/connect?token=${encodeURIComponent(token)}&force=1`;
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
    tokens = readConnectionTokens(data);
  } catch (err) {
    console.error("intervals token decrypt failed:", err?.message || err);
    return null;
  }
  const conn = {
    id: snap.id,
    ...data,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
  if (needsTokenMigration(data) && tokens.accessToken) {
    try {
      await persistEncryptedTokens(discordId, tokens.accessToken);
    } catch (err) {
      console.warn("intervals token migration failed:", err?.message || err);
    }
  }
  return conn;
}

async function persistEncryptedTokens(discordId, accessToken) {
  const patch = encryptedTokenFields(accessToken, "");
  if (canEncryptTokens()) {
    patch.accessToken = admin.firestore.FieldValue.delete();
    patch.refreshToken = admin.firestore.FieldValue.delete();
  }
  patch.updatedAt = new Date();
  await db.collection(COLLECTION).doc(String(discordId)).set(patch, { merge: true });
}

async function isConnected(discordId) {
  const conn = await getConnection(discordId);
  return Boolean(conn && String(conn.accessToken || "").trim());
}

function reconnectResult(discordId) {
  return {
    success: false,
    needs_reconnect: true,
    connectUrl: getConnectUrl(discordId),
    message: "intervals.icu connection was revoked. Reconnect via the link.",
  };
}

function copenhagenDate(offsetDays = 0) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date());
  if (!offsetDays) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

async function intervalsFetch(discordId, path, { method = "GET", body = null } = {}) {
  const conn = await getConnection(discordId);
  if (!conn?.accessToken) {
    const err = new Error("not_connected");
    err.code = "not_connected";
    throw err;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const err = new Error("intervals_unauthorized");
    err.code = "needs_reconnect";
    err.status = res.status;
    throw err;
  }
  if (res.status === 403) {
    const err = new Error("intervals_forbidden");
    err.code = "scope_denied";
    err.status = res.status;
    throw err;
  }
  if (res.status === 429) {
    const err = new Error("intervals_rate_limited");
    err.code = "rate_limited";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`intervals ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { data, conn };
}

async function wrapCall(discordId, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === "not_connected" || err?.code === "needs_reconnect") {
      return reconnectResult(discordId);
    }
    if (err?.code === "rate_limited") {
      return { success: false, message: "intervals.icu rate limit reached. Try again in a few minutes." };
    }
    if (err?.code === "scope_denied") {
      return {
        success: false,
        scope_denied: true,
        message: "intervals.icu refused that permission. Reconnect and allow the requested access.",
      };
    }
    console.error("intervalsService error:", err?.message || err);
    return { success: false, message: "Could not fetch intervals.icu data. Try again later." };
  }
}

function isUnreadableSource(activity) {
  return String(activity?.source || "").toUpperCase() === "STRAVA";
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactActivity(activity) {
  if (!activity || typeof activity !== "object") return null;
  if (isUnreadableSource(activity)) {
    return {
      id: activity.id ?? null,
      start_date: activity.start_date_local || activity.start_date || null,
      source: "STRAVA",
      unavailable: true,
    };
  }
  const device = String(activity.device_name || "");
  const type = activity.type || activity.sport_type || null;
  return {
    id: activity.id,
    name: activity.name || null,
    sport_type: type,
    start_date: activity.start_date_local || activity.start_date || null,
    timezone: activity.timezone || null,
    moving_time: activity.moving_time ?? null,
    elapsed_time: activity.elapsed_time ?? null,
    distance_m: activity.distance ?? null,
    elevation_gain_m: activity.total_elevation_gain ?? null,
    average_heartrate: activity.average_heartrate ?? null,
    max_heartrate: activity.max_heartrate ?? null,
    average_watts: activity.average_watts ?? null,
    weighted_average_watts: activity.icu_weighted_avg_watts ?? activity.weighted_average_watts ?? null,
    max_watts: activity.max_watts ?? null,
    kilojoules: activity.icu_joules != null ? Math.round(Number(activity.icu_joules) / 1000) : activity.kilojoules ?? null,
    training_load: activity.icu_training_load ?? null,
    trainer: type === "VirtualRide" || activity.indoor === true,
    commute: false,
    source: activity.source || null,
    device_name: device || null,
    garmin: /garmin/i.test(device),
  };
}

function readableActivities(list) {
  const rows = (Array.isArray(list) ? list : []).map(compactActivity).filter(Boolean);
  const activities = rows.filter((row) => !row.unavailable);
  const skippedUnreadable = rows.length - activities.length;
  return { activities, skippedUnreadable };
}

function unreadableSourceMessage(skipped) {
  if (!skipped) return null;
  return (
    `${skipped} activities came from the Strava API into intervals.icu and cannot be read. ` +
    "Connect Zwift directly in intervals.icu (Settings → Connections), and a head unit for outdoor rides. " +
    "Old rides need Download Old Data from Zwift, or Import All Strava Data from a Strava archive."
  );
}

function pickSportSettings(list) {
  const rows = Array.isArray(list) ? list : list ? [list] : [];
  const score = (row) => {
    const types = Array.isArray(row?.types) ? row.types : [];
    if (types.includes("VirtualRide")) return 3;
    if (types.includes("Ride")) return 2;
    if (row?.ftp || row?.indoor_ftp) return 1;
    return 0;
  };
  return rows.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { firstname: parts[0] || null, lastname: parts.slice(1).join(" ") || null };
}

async function getAthleteProfile(discordId) {
  return wrapCall(discordId, async () => {
    const [{ data: athlete }, settingsRes] = await Promise.all([
      intervalsFetch(discordId, "/athlete/0"),
      intervalsFetch(discordId, "/athlete/0/sport-settings").catch((err) => {
        if (err?.code === "needs_reconnect" || err?.code === "not_connected") throw err;
        return { data: [] };
      }),
    ]);
    const sport = pickSportSettings(settingsRes.data);
    const names = splitName(athlete?.name);
    const ftp = num(sport?.indoor_ftp) || num(sport?.ftp) || num(athlete?.icu_ftp);
    return {
      success: true,
      athlete: {
        id: athlete?.id ?? null,
        firstname: names.firstname,
        lastname: names.lastname,
        city: null,
        country: null,
        sex: athlete?.sex || null,
        weight_kg: num(sport?.weight) || num(athlete?.weight),
        ftp,
        clubs: [],
      },
    };
  });
}

function rideTotals(activities) {
  return activities.reduce(
    (acc, activity) => {
      const type = String(activity.sport_type || "");
      if (type && !/ride/i.test(type)) return acc;
      acc.count += 1;
      acc.distance += Number(activity.distance_m) || 0;
      acc.moving_time += Number(activity.moving_time) || 0;
      acc.elevation_gain += Number(activity.elevation_gain_m) || 0;
      return acc;
    },
    { count: 0, distance: 0, moving_time: 0, elevation_gain: 0 }
  );
}

function compactCurve(data) {
  const points = [];
  const push = (seconds, watts) => {
    const s = num(seconds);
    const w = num(watts);
    if (s && w) points.push({ seconds: s, watts: Math.round(w) });
  };
  if (Array.isArray(data)) {
    for (const row of data) push(row?.secs ?? row?.seconds ?? row?.duration, row?.watts ?? row?.power);
  } else if (data && Array.isArray(data.secs) && Array.isArray(data.watts)) {
    data.secs.forEach((seconds, i) => push(seconds, data.watts[i]));
  }
  const wanted = [5, 15, 30, 60, 300, 720, 1200];
  return wanted
    .map((seconds) => points.find((point) => point.seconds === seconds) || null)
    .filter(Boolean);
}

async function getAthleteStats(discordId) {
  return wrapCall(discordId, async () => {
    const newest = copenhagenDate(0);
    const yearStart = `${newest.slice(0, 4)}-01-01`;
    const recentStart = copenhagenDate(-28);
    const { data } = await intervalsFetch(
      discordId,
      `/athlete/0/activities?oldest=${yearStart}&newest=${newest}`
    );
    const { activities, skippedUnreadable } = readableActivities(data);
    const recent = activities.filter((activity) => String(activity.start_date || "") >= recentStart);
    let fitness = null;
    try {
      const wellness = await intervalsFetch(discordId, `/athlete/0/wellness/${newest}`);
      const row = wellness.data || {};
      const ctl = num(row.ctl);
      const atl = num(row.atl);
      if (ctl != null || atl != null) {
        fitness = { date: newest, ctl, atl, form: ctl != null && atl != null ? Math.round((ctl - atl) * 10) / 10 : null };
      }
    } catch (err) {
      if (err?.code === "needs_reconnect" || err?.code === "not_connected") throw err;
    }
    let powerCurve = [];
    try {
      const curve = await intervalsFetch(
        discordId,
        `/athlete/0/power-curves?oldest=${recentStart}&newest=${newest}`
      );
      powerCurve = compactCurve(curve.data);
    } catch (err) {
      if (err?.code === "needs_reconnect" || err?.code === "not_connected") throw err;
    }
    return {
      success: true,
      stats: {
        recent_ride_totals: rideTotals(recent),
        ytd_ride_totals: rideTotals(activities),
        fitness,
        power_curve: powerCurve,
      },
      message: unreadableSourceMessage(skippedUnreadable),
    };
  });
}

async function getAthleteZones(discordId) {
  return wrapCall(discordId, async () => {
    const { data } = await intervalsFetch(discordId, "/athlete/0/sport-settings");
    const sport = pickSportSettings(data);
    if (!sport) return { success: true, zones: { heart_rate: null, power: null } };
    return {
      success: true,
      zones: {
        heart_rate: {
          lthr: sport.lthr ?? null,
          max_hr: sport.max_hr ?? null,
          resting_hr: sport.resting_hr ?? null,
          zones: sport.hr_zones || null,
        },
        power: {
          ftp: num(sport.indoor_ftp) || num(sport.ftp),
          zones: sport.power_zones || null,
        },
      },
    };
  });
}

async function listActivities(discordId, oldest, newest) {
  const { data } = await intervalsFetch(
    discordId,
    `/athlete/0/activities?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`
  );
  return readableActivities(data);
}

async function getRecentActivities(discordId, { days = 14 } = {}) {
  const clampedDays = Math.min(Math.max(Number(days) || 14, 1), 28);
  return wrapCall(discordId, async () => {
    const newest = copenhagenDate(0);
    const oldest = copenhagenDate(-clampedDays);
    const { activities, skippedUnreadable } = await listActivities(discordId, oldest, newest);
    return {
      success: true,
      days: clampedDays,
      activities: activities.slice(0, 50),
      message: unreadableSourceMessage(skippedUnreadable),
    };
  });
}

function compactIntervals(activity) {
  const rows = Array.isArray(activity?.icu_intervals) ? activity.icu_intervals : [];
  return rows.slice(0, 20).map((row) => ({
    name: row.type || null,
    elapsed_time: row.elapsed_time ?? null,
    moving_time: row.moving_time ?? null,
    distance_m: row.distance ?? null,
    average_watts: row.average_watts ?? null,
    average_heartrate: row.average_heartrate ?? null,
    zone: row.zone ?? null,
    decoupling: row.decoupling ?? null,
  }));
}

async function getActivityDetails(discordId, activityId) {
  const id = String(activityId || "").trim();
  if (!/^[A-Za-z0-9]+$/.test(id)) return { success: false, message: "Invalid activity id." };
  return wrapCall(discordId, async () => {
    const { data, conn } = await intervalsFetch(discordId, `/activity/${encodeURIComponent(id)}?intervals=true`);
    if (isUnreadableSource(data)) {
      return { success: false, message: unreadableSourceMessage(1) };
    }
    const owner = data?.icu_athlete_id || data?.athlete_id;
    if (conn.athleteId && owner && String(owner) !== String(conn.athleteId)) {
      return { success: false, message: "That activity is not yours." };
    }
    const base = compactActivity(data);
    return {
      success: true,
      activity: {
        ...base,
        description: typeof data?.description === "string" ? data.description.slice(0, 400) : null,
        calories: data?.calories ?? null,
        average_cadence: data?.average_cadence ?? null,
        device_watts: data?.icu_ignore_power === true ? false : base?.average_watts != null || base?.weighted_average_watts != null,
        athlete_id: owner ?? null,
        laps: compactIntervals(data),
        garmin_note: base?.garmin
          ? "These numbers include data from a Garmin device. Say so if you display them."
          : null,
      },
    };
  });
}

function streamArray(streams, names) {
  for (const name of names) {
    const value = streams?.[name];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
  }
  return [];
}

async function getActivityMetrics(discordId, activityId) {
  const id = String(activityId || "").trim();
  if (!/^[A-Za-z0-9]+$/.test(id)) return { success: false, message: "Invalid activity id." };

  const cacheRef = db.collection(STREAM_CACHE_COLLECTION).doc(id);
  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() || {};
      if (String(data.discordId) === String(discordId)) {
        return { success: true, cached: true, metrics: data.metrics || null, message: data.message || null };
      }
    }
  } catch (err) {
    console.warn("activity metrics cache read failed:", err?.message || err);
  }

  return wrapCall(discordId, async () => {
    const { data: activity, conn } = await intervalsFetch(
      discordId,
      `/activity/${encodeURIComponent(id)}?intervals=true`
    );
    if (isUnreadableSource(activity)) {
      return { success: true, metrics: null, message: unreadableSourceMessage(1) };
    }
    if (activity?.icu_ignore_power === true) {
      return {
        success: true,
        metrics: null,
        message: "This ride has no usable power data. Comment on duration, heart rate and how it felt instead.",
      };
    }

    let streams = null;
    try {
      const streamRes = await intervalsFetch(
        discordId,
        `/activity/${encodeURIComponent(id)}/streams.json?types=time,watts,heartrate`
      );
      streams = streamRes.data;
    } catch (err) {
      if (err?.code === "needs_reconnect" || err?.code === "not_connected" || err?.code === "rate_limited") throw err;
    }

    const time = streamArray(streams, ["time"]);
    const watts = metrics.resampleTo1Hz(time, streamArray(streams, ["watts", "fixed_watts"]), "zero");
    const heartrate = metrics.resampleTo1Hz(time, streamArray(streams, ["heartrate", "heart_rate", "fixed_heartrate"]), "hold");
    const ftp = num(activity?.icu_ftp) || num(conn.ftp) || null;

    let summary = null;
    if (watts.length) {
      const np = metrics.normalizedPower(watts);
      const durationSeconds = watts.length;
      summary = {
        durationSeconds,
        averageWatts: Math.round(watts.reduce((a, b) => a + b, 0) / watts.length),
        normalizedPower: np,
        intensityFactor: metrics.intensityFactor(np, ftp),
        trainingStressScore: num(activity?.icu_training_load) || metrics.trainingStressScore(np, ftp, durationSeconds),
        meanMaxPower: metrics.meanMaxPower(watts),
        aerobicDecouplingPercent: metrics.aerobicDecoupling(watts, heartrate),
        intervals: ftp
          ? metrics.detectIntervals(watts, { thresholdWatts: Math.round(ftp * 0.95) }).slice(0, 12)
          : compactIntervals(activity).slice(0, 12),
        ftpUsed: ftp,
      };
    } else if (activity?.icu_weighted_avg_watts || activity?.icu_training_load) {
      const np = num(activity.icu_weighted_avg_watts);
      summary = {
        durationSeconds: num(activity.moving_time),
        averageWatts: num(activity.average_watts),
        normalizedPower: np,
        intensityFactor: metrics.intensityFactor(np, ftp),
        trainingStressScore: num(activity.icu_training_load),
        meanMaxPower: null,
        aerobicDecouplingPercent: null,
        intervals: compactIntervals(activity).slice(0, 12),
        ftpUsed: ftp,
      };
    }

    if (!summary) {
      return { success: true, metrics: null, message: "No power stream on this activity." };
    }

    try {
      await cacheRef.set({
        discordId: String(discordId),
        activityId: id,
        metrics: summary,
        message: null,
        cachedAt: new Date(),
      });
    } catch (err) {
      console.warn("activity metrics cache write failed:", err?.message || err);
    }
    return { success: true, metrics: summary };
  });
}

async function getZwiftPowerContext(discordId) {
  try {
    const zwiftId = await getUserZwiftId(discordId);
    if (!zwiftId) return { success: true, zwiftpower: { linked: false } };
    const latest = await getLatestClubStats();
    const riders = Array.isArray(latest?.riders) ? latest.riders : [];
    const rider = riders.find((r) => String(r.riderId) === String(zwiftId));
    if (!rider) return { success: true, zwiftpower: { linked: true, zwiftId, inClubStats: false } };
    return {
      success: true,
      zwiftpower: {
        linked: true,
        zwiftId,
        inClubStats: true,
        name: rider.name || null,
        paceGroup: rider.paceGroup ?? rider.category ?? null,
        veloCategory: rider.veloCategory ?? null,
        phenotype: rider.phenotype ?? null,
        ftp: rider.ftp ?? null,
      },
    };
  } catch (err) {
    console.error("getZwiftPowerContext error:", err?.message || err);
    return { success: false, message: "Could not load ZwiftPower context." };
  }
}

function compactWellness(row) {
  if (!row || typeof row !== "object") return null;
  const ctl = num(row.ctl);
  const atl = num(row.atl);
  return {
    date: row.id || row.date || null,
    weight_kg: num(row.weight),
    resting_hr: num(row.restingHR ?? row.resting_hr),
    hrv: num(row.hrv ?? row.hrvSDNN),
    sleep_hours: num(row.sleepSecs) != null ? Math.round((Number(row.sleepSecs) / 3600) * 10) / 10 : num(row.sleepHours),
    sleep_score: num(row.sleepScore),
    soreness: num(row.soreness),
    fatigue: num(row.fatigue),
    stress: num(row.stress),
    mood: num(row.mood),
    motivation: num(row.motivation),
    ctl,
    atl,
    form: ctl != null && atl != null ? Math.round((ctl - atl) * 10) / 10 : null,
    ramp_rate: num(row.rampRate),
  };
}

async function getWellness(discordId, { days = 14 } = {}) {
  const clampedDays = Math.min(Math.max(Number(days) || 14, 1), 28);
  return wrapCall(discordId, async () => {
    const newest = copenhagenDate(0);
    const oldest = copenhagenDate(-clampedDays);
    const { data } = await intervalsFetch(
      discordId,
      `/athlete/0/wellness?oldest=${oldest}&newest=${newest}`
    );
    const rows = (Array.isArray(data) ? data : [])
      .map(compactWellness)
      .filter((row) => row && row.date);
    return {
      success: true,
      days: clampedDays,
      wellness: rows,
      message: rows.length
        ? "Empty wellness fields mean the athlete has not logged them. Do not treat missing HRV, sleep or soreness as fine."
        : "No wellness rows in this window.",
    };
  });
}

async function getPlannedWorkouts(discordId, { days = 14 } = {}) {
  const clampedDays = Math.min(Math.max(Number(days) || 14, 1), 28);
  return wrapCall(discordId, async () => {
    const oldest = copenhagenDate(0);
    const newest = copenhagenDate(clampedDays);
    const { data } = await intervalsFetch(
      discordId,
      `/athlete/0/events?oldest=${oldest}&newest=${newest}&category=WORKOUT`
    );
    const events = (Array.isArray(data) ? data : []).slice(0, 20).map((event) => ({
      id: event.id ?? null,
      name: event.name || null,
      start_date: event.start_date_local || null,
      type: event.type || null,
      moving_time: event.moving_time ?? null,
      training_load: event.icu_training_load ?? null,
      description: typeof event.description === "string" ? event.description.slice(0, 240) : null,
    }));
    return { success: true, workouts: events };
  });
}

async function fetchActivityHistory(discordId, { days = 182 } = {}) {
  return wrapCall(discordId, async () => {
    const newest = copenhagenDate(0);
    const oldest = copenhagenDate(-days);
    const { activities, skippedUnreadable } = await listActivities(discordId, oldest, newest);
    return { success: true, days, activities, message: unreadableSourceMessage(skippedUnreadable) };
  });
}

async function getWeeklyLoad(discordId) {
  try {
    const snap = await db.collection(WEEKLY_LOAD_COLLECTION).doc(String(discordId)).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      weekly: Array.isArray(data.weekly) ? data.weekly : [],
      fitness: Array.isArray(data.fitness) ? data.fitness : [],
      athlete: data.athlete || null,
      zwiftpower: data.zwiftpower || null,
      updatedAt: data.updatedAt || null,
    };
  } catch (err) {
    console.warn("getWeeklyLoad failed:", err?.message || err);
    return null;
  }
}

function weeklyFitness(rows) {
  const byWeek = new Map();
  for (const row of rows) {
    if (!row?.date || row.ctl == null) continue;
    const week = weeklyLoad.weekStart(`${row.date}T12:00:00Z`);
    if (!week) continue;
    byWeek.set(week, { week, ctl: row.ctl, atl: row.atl, form: row.form });
  }
  return Array.from(byWeek.values()).slice(-12);
}

async function refreshWeeklyLoad(discordId, { days = 182 } = {}) {
  const history = await fetchActivityHistory(discordId, { days });
  if (!history?.success) return history;

  let ftp = null;
  let athlete = null;
  try {
    const profile = await getAthleteProfile(discordId);
    ftp = Number(profile?.athlete?.ftp) || null;
    athlete = profile?.athlete
      ? { weightKg: profile.athlete.weight_kg ?? null, ftp, sex: profile.athlete.sex || null }
      : null;
  } catch {
    ftp = null;
  }

  let fitness = [];
  try {
    const newest = copenhagenDate(0);
    const oldest = copenhagenDate(-days);
    const { data } = await intervalsFetch(discordId, `/athlete/0/wellness?oldest=${oldest}&newest=${newest}`);
    fitness = weeklyFitness((Array.isArray(data) ? data : []).map(compactWellness).filter(Boolean));
  } catch (err) {
    console.warn("wellness refresh failed:", err?.message || err);
  }

  let zwiftpower = null;
  try {
    const zp = await getZwiftPowerContext(discordId);
    if (zp?.success && zp.zwiftpower?.linked) {
      zwiftpower = {
        paceGroup: zp.zwiftpower.paceGroup ?? null,
        veloCategory: zp.zwiftpower.veloCategory ?? null,
        phenotype: zp.zwiftpower.phenotype ?? null,
      };
    }
  } catch {
    zwiftpower = null;
  }

  const weekly = weeklyLoad.rollupWeeks(history.activities, { ftp, weeks: 26 });
  await db.collection(WEEKLY_LOAD_COLLECTION).doc(String(discordId)).set({
    discordId: String(discordId),
    weekly,
    fitness,
    ftpUsed: ftp,
    athlete,
    zwiftpower,
    updatedAt: new Date(),
  });
  return { success: true, weeks: weekly.length };
}

function workoutExternalId(date, name) {
  const slug = String(name || "workout")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `dzr-${date}-${slug || "workout"}`;
}

async function upsertPlannedWorkout(discordId, { name, filename, xml, date }) {
  const rideDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : copenhagenDate(1);
  const externalId = workoutExternalId(rideDate, name);
  return wrapCall(discordId, async () => {
    await intervalsFetch(discordId, "/athlete/0/events/bulk?upsert=true", {
      method: "POST",
      body: [
        {
          category: "WORKOUT",
          type: "VirtualRide",
          start_date_local: `${rideDate}T00:00:00`,
          name: String(name || "DZR Coach workout").slice(0, 80),
          filename,
          file_contents: xml,
          external_id: externalId,
        },
      ],
    });
    const { data } = await intervalsFetch(
      discordId,
      `/athlete/0/events?oldest=${rideDate}&newest=${rideDate}&category=WORKOUT`
    );
    const event = (Array.isArray(data) ? data : []).find((row) => String(row.external_id) === externalId);
    const steps = event?.workout_doc?.steps;
    const parsed = Array.isArray(steps) && steps.length > 0;
    return {
      success: true,
      calendar: parsed,
      date: rideDate,
      message: parsed
        ? `Workout is on the intervals.icu calendar for ${rideDate}. If Zwift is connected in intervals.icu with planned-workout upload on, the next week of workouts appears under Zwift → Workouts → Custom → Intervals.icu. FTP on Zwift and intervals.icu must match.`
        : "The calendar write did not come back with workout steps. The Discord file was still sent.",
    };
  });
}

module.exports = {
  mintConnectToken,
  getConnectUrl,
  hasClubMemberRole,
  notClubMemberResult,
  isConnected,
  getAthleteProfile,
  getAthleteStats,
  getAthleteZones,
  getRecentActivities,
  getActivityDetails,
  getZwiftPowerContext,
  getActivityMetrics,
  getWellness,
  getPlannedWorkouts,
  fetchActivityHistory,
  getWeeklyLoad,
  refreshWeeklyLoad,
  upsertPlannedWorkout,
  copenhagenDate,
};

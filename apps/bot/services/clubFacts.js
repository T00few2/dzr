/**
 * Club facts that change, read live so the bot never repeats an old text.
 *
 * Membership fees come from the website's own /api/membership/settings, the same answer /join
 * shows. Teams looking for riders come from the role panels. A failed read returns null for that
 * part; callers leave the line out rather than guessing.
 */
const axios = require("axios");
const shared = require("../constants.json");

const SITE = String(shared.siteOrigin || "").replace(/\/+$/, "");
const CACHE_MS = 10 * 60 * 1000;
let membershipCache = { at: 0, value: null };

async function getMembershipFacts({ get = axios.get, now = Date.now() } = {}) {
  if (membershipCache.value && now - membershipCache.at < CACHE_MS) return membershipCache.value;
  try {
    const res = await get(`${SITE}/api/membership/settings`, { timeout: 8000 });
    const data = res?.data || {};
    const value = {
      minAmountDkk: Number(data.minAmountDkk),
      maxAmountDkk: Number(data.maxAmountDkk),
      coversYears: (Array.isArray(data.paymentOptions) ? data.paymentOptions : [])
        .flatMap((option) => (Array.isArray(option?.coversYears) ? option.coversYears : []))
        .filter((year, i, all) => Number.isInteger(year) && all.indexOf(year) === i)
        .sort(),
      paymentMethods: "MobilePay / Vipps",
      joinUrl: `${SITE}/join`,
    };
    if (!Number.isFinite(value.minAmountDkk) || !Number.isFinite(value.maxAmountDkk)) return null;
    membershipCache = { at: now, value };
    return value;
  } catch (error) {
    console.warn("Membership settings lookup failed:", error?.message || error);
    return null;
  }
}

function feeText(facts) {
  if (!facts) return null;
  const { minAmountDkk: min, maxAmountDkk: max } = facts;
  const amount = min === max ? `${min} kr.` : `${min}–${max} kr. (du vælger selv beløbet)`;
  const years = facts.coversYears.length ? ` for ${facts.coversYears.join("/")}` : "";
  return `${amount}${years}, betales med ${facts.paymentMethods}`;
}

async function getTeamsLookingForRiders({ getDZRTeamsAndSeries = require("./firebase").getDZRTeamsAndSeries } = {}) {
  try {
    const { teams } = await getDZRTeamsAndSeries();
    return teams
      .filter((team) => team.lookingForRiders)
      .map((team) => ({ name: team.teamName, series: team.raceSeries || null, division: team.division || null }));
  } catch (error) {
    console.warn("Teams lookup failed:", error?.message || error);
    return null;
  }
}

function resetCacheForTests() {
  membershipCache = { at: 0, value: null };
}

module.exports = { getMembershipFacts, feeText, getTeamsLookingForRiders, resetCacheForTests };

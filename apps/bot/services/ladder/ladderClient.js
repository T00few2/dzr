// Reads ladder.cycleracing.club through the Flask API (/ladder_page), which holds the club's ladder login.
const axios = require("axios");
const config = require("../../config/config");
const { parseFixtureList, parseFixture } = require("./ladderParser");

async function getPage(path) {
  const { baseUrl, apiKey } = config.contentApi;
  if (!baseUrl || !apiKey) throw new Error("CONTENT_API_BASE_URL and CONTENT_API_KEY must be set to read the ladder");
  try {
    const res = await axios.get(`${baseUrl}/ladder_page`, {
      params: { path },
      headers: { Authorization: `Bearer ${apiKey}` },
      responseType: "text",
      transformResponse: (body) => body,
      timeout: 60000,
    });
    return res.data;
  } catch (err) {
    const status = err.response ? err.response.status : "no response";
    const wrapped = new Error(`Ladder page ${path} failed: ${status} ${err.message}`);
    wrapped.userMessage = "Ladder-siden kunne ikke hentes lige nu. Prøv igen senere.";
    throw wrapped;
  }
}

// Route geometry never changes for a route id, so keep it for the lifetime of the process.
const routeCache = new Map();

async function getRoute(routeId) {
  if (!routeCache.has(routeId)) {
    routeCache.set(routeId, { data: JSON.parse(await getPage(`/path/${encodeURIComponent(routeId)}`)) });
  }
  return routeCache.get(routeId);
}

function fixturesPath(team) {
  return `/matchlist/fixtures/${encodeURIComponent(team)}`;
}

async function getFixtures(team) {
  return parseFixtureList(await getPage(fixturesPath(team)));
}

async function getFixture(id) {
  return { id: String(id), ...parseFixture(await getPage(`/fixture/${encodeURIComponent(id)}`)) };
}

// Start times never change once read, so each fixture page is fetched at most once per process for this.
const startCache = new Map();

async function getFixtureStart(id) {
  if (!startCache.has(id)) startCache.set(id, (await getFixture(id)).start);
  return startCache.get(id);
}

// Walks the fixture list in order and returns the first fixture that has not started yet, or null.
async function getNextFixture(team) {
  for (const { id } of await getFixtures(team)) {
    const fixture = await getFixture(id);
    if (fixture.start && new Date(fixture.start).getTime() > Date.now()) return fixture;
  }
  return null;
}

module.exports = { getPage, getRoute, fixturesPath, getFixtures, getFixture, getFixtureStart, getNextFixture };

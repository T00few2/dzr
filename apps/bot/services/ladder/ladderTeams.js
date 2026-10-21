// Ladder teams that get previews and reminders in the ladder channel.
const { createStore } = require("./ladderStore");

const MAX_TEAMS = 10;
const store = createStore("ladderTeams", () => ({}));

async function load() {
  return store.load();
}

function key(teamName) {
  return teamName.trim().toLowerCase();
}

// Accepts a plain team name or a ladder URL such as https://ladder.cycleracing.club/teamView/Chonky%20Chaser.
function parseTeamName(input) {
  const text = input.trim();
  const urlMatch = text.match(/^https?:\/\/[^/]+\/(?:teamView|matchlist\/fixtures)\/([^/?#]+)/i);
  if (urlMatch) {
    try {
      return decodeURIComponent(urlMatch[1]).trim();
    } catch {
      return urlMatch[1].trim();
    }
  }
  return text;
}

// channelId is the channel /ladder_link was used in: commands run there default to this team.
// Returns false when the team is new and the team limit has been reached.
async function link(teamName, channelId) {
  const teams = await load();
  if (!teams[key(teamName)] && Object.keys(teams).length >= MAX_TEAMS) return false;
  if (channelId) {
    for (const other of Object.values(teams)) if (other.channelId === String(channelId)) delete other.channelId;
  }
  teams[key(teamName)] = { ...teams[key(teamName)], name: teamName.trim(), ...(channelId ? { channelId: String(channelId) } : {}) };
  store.persist();
  return true;
}

async function findByChannel(channelId) {
  return Object.values(await load()).find((team) => team.channelId === String(channelId)) || null;
}

// Returns false when the team is not linked yet.
async function setPreviewMinutes(teamName, minutes) {
  const teams = await load();
  if (!teams[key(teamName)]) return false;
  teams[key(teamName)].previewMinutes = minutes;
  store.persist();
  return true;
}

async function unlink(teamName) {
  const teams = await load();
  const existed = key(teamName) in teams;
  delete teams[key(teamName)];
  store.persist();
  return existed;
}

async function list() {
  return Object.values(await load());
}

async function getTeam(teamName) {
  return (await load())[key(teamName)] || null;
}

module.exports = { MAX_TEAMS, parseTeamName, link, unlink, list, getTeam, findByChannel, setPreviewMinutes };

/**
 * New commits on main of the DZR monorepo, for the feature-news signal.
 *
 * The repo holds the website (app/, components/), the Flask API (apps/api) and the bot (apps/bot),
 * so one commit stream covers all three. Read over the GitHub API rather than a local checkout:
 * Render redeploys the bot only for apps/bot changes, so its own copy misses website work.
 * GITHUB_TOKEN is optional for a public repo and needed (read-only contents) for a private one.
 */
const REPO = process.env.ANNOUNCER_GITHUB_REPO || "T00few2/dzr";
const BRANCH = process.env.ANNOUNCER_GITHUB_BRANCH || "main";
const API = "https://api.github.com";

const AREAS = [
  ["apps/bot/", "Discord-botten"],
  ["apps/api/", "backend (API)"],
  ["app/", "hjemmesiden"],
  ["components/", "hjemmesiden"],
  ["packages/", "fælles kode"],
];

function areaOf(path) {
  return AREAS.find(([prefix]) => String(path).startsWith(prefix))?.[1] || null;
}

/** Commit subjects and bodies, without merges. Bodies are cut short: the subject carries the news. */
function compactCommits(rawCommits) {
  return (rawCommits || [])
    .map((raw) => {
      const [subject, ...rest] = String(raw?.commit?.message || "").split("\n");
      return { sha: raw?.sha, subject: subject.trim(), body: rest.join("\n").trim().slice(0, 300) };
    })
    .filter((commit) => commit.subject && !/^Merge (branch|pull request|remote-tracking)/i.test(commit.subject));
}

function areasOf(files) {
  return [...new Set((files || []).map((file) => areaOf(file?.filename)).filter(Boolean))];
}

async function getJson(fetchImpl, url) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "dzr-club-bot" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`GitHub ${response.status} for ${url}`);
  return response.json();
}

/**
 * Commits since `base`, or since `sinceIso` the first time (no base yet).
 * @returns {Promise<{ head: string|null, commits: Array<{ sha, subject, body }>, areas: string[] }>}
 */
async function fetchCommitLog({ base, sinceIso, fetchImpl = fetch }) {
  if (base) {
    const data = await getJson(fetchImpl, `${API}/repos/${REPO}/compare/${base}...${BRANCH}`);
    const commits = compactCommits(data.commits);
    const head = data.commits?.length ? data.commits[data.commits.length - 1].sha : base;
    return { head, commits, areas: areasOf(data.files) };
  }
  const list = await getJson(fetchImpl, `${API}/repos/${REPO}/commits?sha=${BRANCH}&per_page=100&since=${encodeURIComponent(sinceIso)}`);
  // The list is newest first.
  const head = list[0]?.sha || null;
  return { head, commits: compactCommits([...list].reverse()), areas: [] };
}

module.exports = { fetchCommitLog, compactCommits, areasOf, REPO };

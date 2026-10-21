/**
 * Read one public web page as text for DZR Helper, so it can open what a search found (a race
 * calendar, a rules page) instead of answering from a snippet.
 *
 * Only https on public hosts: the bot's own network and cloud metadata addresses are refused, and
 * every redirect is checked the same way. Pages are cut to a size the model can use. Zwift event
 * links are listed separately, because their details come from zwift_event, not from the page.
 */
const axios = require("axios");
const dns = require("node:dns").promises;
const net = require("node:net");

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 9000;
const MAX_REDIRECTS = 3;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function checkUrl(raw, { lookup = dns.lookup } = {}) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    return { ok: false, message: "That is not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, message: "Only https pages can be read." };
  if (url.username || url.password) return { ok: false, message: "URLs with credentials are refused." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) return { ok: false, message: "That host is not public." };
  try {
    const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return { ok: false, message: "That host is not public." };
    }
  } catch {
    return { ok: false, message: "That host could not be found." };
  }
  return { ok: true, url };
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}

/** Visible text, title and links of an HTML page. */
function htmlToText(html, baseUrl) {
  const source = String(html || "");
  const title = decodeEntities((source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim());
  const links = [];
  for (const match of source.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = new URL(decodeEntities(match[1]), baseUrl).toString();
      const label = decodeEntities(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (/^https?:/.test(href)) links.push({ href, label: label.slice(0, 120) });
    } catch {
      // A malformed href is just skipped.
    }
  }
  const text = decodeEntities(
    source
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)\s*>|<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]\s*>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text, links };
}

/** Zwift event ids linked from a page or mentioned in its text, in page order. */
function zwiftEventLinks(links, text) {
  const ids = new Map();
  const add = (id, label) => {
    if (!ids.has(id)) ids.set(id, { event_id: id, label: label || null });
  };
  for (const link of links) {
    const match = link.href.match(/zwift\.com\/(?:[a-z-]+\/)?events\/(?:[^/?#]+\/)*view\/(\d+)/i);
    if (match) add(match[1], link.label);
  }
  for (const match of String(text).matchAll(/zwift\.com\/(?:[a-z-]+\/)?events\/(?:[^/?#\s]+\/)*view\/(\d+)/gi)) add(match[1]);
  return Array.from(ids.values()).slice(0, 40);
}

async function readWebPage(rawUrl, { http = axios, lookup } = {}) {
  let target = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = await checkUrl(target, { lookup });
    if (!checked.ok) return { success: false, message: checked.message };
    let response;
    try {
      response = await http.get(checked.url.toString(), {
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: MAX_BYTES,
        responseType: "text",
        validateStatus: () => true,
        headers: { "User-Agent": "DZR-Helper/1.0 (+https://www.dzrracingseries.com)", Accept: "text/html,text/plain;q=0.9" },
      });
    } catch (err) {
      return { success: false, message: `Could not load the page (${err?.code || err?.message || "error"}).` };
    }
    if (response.status >= 300 && response.status < 400 && response.headers?.location) {
      target = new URL(response.headers.location, checked.url).toString();
      continue;
    }
    if (response.status !== 200) return { success: false, message: `The page answered ${response.status}.` };
    const type = String(response.headers?.["content-type"] || "");
    if (type && !/text\/(html|plain)|application\/xhtml/i.test(type)) {
      return { success: false, message: `That is not a web page (${type.split(";")[0]}).` };
    }
    const { title, text, links } = htmlToText(response.data, checked.url);
    const zwiftEvents = zwiftEventLinks(links, text);
    return {
      success: true,
      url: checked.url.toString(),
      title: title || undefined,
      text: text.slice(0, MAX_TEXT),
      text_truncated: text.length > MAX_TEXT || undefined,
      zwift_events: zwiftEvents.length ? zwiftEvents : undefined,
      note: text.length < 200
        ? "Almost no text: the page is probably drawn by JavaScript. Look for a Zwift event link or another source."
        : undefined,
    };
  }
  return { success: false, message: "Too many redirects." };
}

module.exports = { readWebPage, htmlToText, zwiftEventLinks, isPrivateAddress, checkUrl };

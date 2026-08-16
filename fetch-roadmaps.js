// fetch-roadmaps.js
// Récupère les dernières entrées de changelog/roadmap par éditeur, groupées
// par "vendor". Même protection par timeout que fetch-news.js.

import Parser from "rss-parser";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf-8"));

const TIMEOUT_MS = 20000;
const DAYS_WINDOW = Number(process.env.ROADMAP_WINDOW_DAYS || 14);

const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; DataIABot/1.0)" }
});

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) sur ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function withinWindow(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const ageDays = (Date.now() - d.getTime()) / 864e5;
  return ageDays <= DAYS_WINDOW;
}

async function fetchOneVendor(entry) {
  try {
    const feed = await withTimeout(parser.parseURL(entry.url), TIMEOUT_MS, entry.vendor);
    const items = (feed.items || [])
      .filter((item) => withinWindow(item.isoDate || item.pubDate))
      .slice(0, 8)
      .map((item) => ({
        title: (item.title || "").trim(),
        link: item.link,
        publishedAt: item.isoDate || item.pubDate || null,
        rawSummary: (item.contentSnippet || item.summary || "").trim().slice(0, 400)
      }));
    return { vendor: entry.vendor, sourceName: entry.name, items, ok: true };
  } catch (err) {
    console.error(`[fetch-roadmaps] échec sur ${entry.vendor} (${entry.url}) : ${err.message}`);
    return { vendor: entry.vendor, sourceName: entry.name, items: [], ok: false, error: err.message };
  }
}

export async function fetchAllRoadmaps() {
  const results = await Promise.all(sources.roadmaps.map(fetchOneVendor));

  const byVendor = new Map();
  for (const r of results) {
    if (!byVendor.has(r.vendor)) byVendor.set(r.vendor, { vendor: r.vendor, items: [], sources: [] });
    const bucket = byVendor.get(r.vendor);
    bucket.items.push(...r.items);
    bucket.sources.push({ name: r.sourceName, ok: r.ok, error: r.error || null });
  }

  return Array.from(byVendor.values()).map((v) => {
    v.items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return v;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllRoadmaps().then((vendors) => {
    console.log(JSON.stringify(vendors, null, 2));
    console.error(`\n${vendors.length} éditeurs traités.`);
  });
}

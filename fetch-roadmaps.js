// scripts/fetch-roadmaps.js
// Récupère les dernières entrées de changelog/roadmap par éditeur.
// Utilise les mêmes flux RSS que fetch-news.js mais les groupe par "vendor"
// pour construire une vue "diff" (nouveautés par éditeur).

import Parser from "rss-parser";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf-8"));

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; DataIABot/1.0)" }
});

const DAYS_WINDOW = Number(process.env.ROADMAP_WINDOW_DAYS || 14);

function withinWindow(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const ageDays = (Date.now() - d.getTime()) / 864e5;
  return ageDays <= DAYS_WINDOW;
}

async function fetchOneVendor(entry) {
  try {
    const feed = await parser.parseURL(entry.url);
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

  // Regroupe par éditeur (au cas où plusieurs flux pointent vers le même vendor)
  const byVendor = new Map();
  for (const r of results) {
    if (!byVendor.has(r.vendor)) byVendor.set(r.vendor, { vendor: r.vendor, items: [], sources: [] });
    const bucket = byVendor.get(r.vendor);
    bucket.items.push(...r.items);
    bucket.sources.push({ name: r.sourceName, ok: r.ok, error: r.error || null });
  }

  const vendors = Array.from(byVendor.values()).map((v) => {
    v.items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return v;
  });

  return vendors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllRoadmaps().then((vendors) => {
    console.log(JSON.stringify(vendors, null, 2));
    console.error(`\n${vendors.length} éditeurs traités.`);
  });
}

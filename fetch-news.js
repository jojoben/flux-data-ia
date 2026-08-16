// scripts/fetch-news.js
// Récupère les derniers articles des flux RSS "news" définis dans sources.json
// et retourne une liste d'items normalisés (sans résumé IA à ce stade).

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

const HOURS_WINDOW = Number(process.env.NEWS_WINDOW_HOURS || 48);

function withinWindow(dateStr) {
  if (!dateStr) return true; // si pas de date, on garde par défaut
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const ageHours = (Date.now() - d.getTime()) / 36e5;
  return ageHours <= HOURS_WINDOW;
}

async function fetchOneFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || [])
      .filter((item) => withinWindow(item.isoDate || item.pubDate))
      .map((item) => ({
        source: source.name,
        tag: source.tag || "Actu",
        title: (item.title || "").trim(),
        link: item.link,
        publishedAt: item.isoDate || item.pubDate || null,
        rawSummary: (item.contentSnippet || item.summary || "").trim().slice(0, 600)
      }));
  } catch (err) {
    console.error(`[fetch-news] échec sur ${source.name} (${source.url}) : ${err.message}`);
    return [];
  }
}

export async function fetchAllNews() {
  const results = await Promise.all(sources.news.map(fetchOneFeed));
  const items = results.flat();

  // Dédoublonnage simple par lien
  const seen = new Set();
  const deduped = items.filter((it) => {
    if (!it.link || seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });

  // Tri du plus récent au plus ancien
  deduped.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  return deduped;
}

// Permet aussi une exécution directe : node scripts/fetch-news.js
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllNews().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`\n${items.length} articles récupérés.`);
  });
}

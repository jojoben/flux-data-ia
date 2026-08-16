// scripts/build.js
// Orchestre tout le pipeline :
//   1. récupère les news et les roadmaps depuis les flux RSS
//   2. les résume/catégorise en français via l'API Anthropic
//   3. écrit site/data/news.json et site/data/roadmaps.json
//
// Usage : node scripts/build.js
// Nécessite ANTHROPIC_API_KEY dans l'environnement.

import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import { fetchAllNews } from "./fetch-news.js";
import { fetchAllRoadmaps } from "./fetch-roadmaps.js";
import { summarizeNews, summarizeRoadmaps } from "./summarize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;
async function main() {
  console.error("→ Récupération des news...");
  const rawNews = await fetchAllNews();
  console.error(`  ${rawNews.length} articles bruts récupérés.`);

  console.error("→ Récupération des roadmaps éditeurs...");
  const rawRoadmaps = await fetchAllRoadmaps();
  console.error(`  ${rawRoadmaps.length} éditeurs traités.`);

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  let news = rawNews;
  let roadmaps = rawRoadmaps;

  if (hasKey) {
    console.error("→ Résumé IA des news...");
    news = await summarizeNews(rawNews);
    console.error("→ Résumé IA des roadmaps...");
    roadmaps = await summarizeRoadmaps(rawRoadmaps);
  } else {
    console.error("⚠ ANTHROPIC_API_KEY absente : publication sans résumé IA (texte brut des flux).");
    news = rawNews.map((it) => ({ ...it, summary_fr: it.rawSummary, category: "Autre" }));
    roadmaps = rawRoadmaps.map((v) => ({
      ...v,
      items: v.items.map((it) => ({ ...it, summary_fr: it.rawSummary, diff_type: "updated" }))
    }));
  }

  mkdirSync(DATA_DIR, { recursive: true });

  writeFileSync(
    path.join(DATA_DIR, "news.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), items: news }, null, 2)
  );

  writeFileSync(
    path.join(DATA_DIR, "roadmaps.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), vendors: roadmaps }, null, 2)
  );

  console.error(`✔ Écrit ${news.length} news et ${roadmaps.length} éditeurs dans ${DATA_DIR}`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});

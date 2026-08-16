// build.js
// Orchestre tout le pipeline : fetch → résumé IA → écriture de news.json et
// roadmaps.json, à la racine du projet (structure plate).
//
// Usage : node build.js

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import { fetchAllNews } from "./fetch-news.js";
import { fetchAllRoadmaps } from "./fetch-roadmaps.js";
import { summarizeNews, summarizeRoadmaps } from "./summarize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  writeFileSync(
    path.join(__dirname, "news.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), items: news }, null, 2)
  );

  writeFileSync(
    path.join(__dirname, "roadmaps.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), vendors: roadmaps }, null, 2)
  );

  console.error(`✔ Écrit ${news.length} news et ${roadmaps.length} éditeurs.`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});

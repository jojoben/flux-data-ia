// scripts/summarize.js
// Utilise l'API Anthropic (Claude) pour :
//  - résumer chaque article en une phrase courte, en français
//  - catégoriser les news (Modèle / Produit / Recherche / Financement / Politique / Autre)
//  - catégoriser les entrées de roadmap en type de changement (added / updated / deprecated)
//
// Nécessite la variable d'environnement ANTHROPIC_API_KEY.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // rapide et économique, adapté à un résumé en batch
const CHUNK_SIZE = 15;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante dans l'environnement.");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Résume et catégorise une liste d'articles de news.
 * items: [{ title, rawSummary, source }]
 * Retourne le même tableau enrichi de { summary_fr, category }
 */
export async function summarizeNews(items) {
  const groups = chunk(items, CHUNK_SIZE);
  const enriched = [];

  for (const group of groups) {
    const payload = group.map((it, i) => ({
      index: i,
      title: it.title,
      source: it.source,
      excerpt: it.rawSummary
    }));

    const system =
      "Tu es un rédacteur spécialisé data & IA. Pour chaque article fourni en JSON, " +
      "réponds UNIQUEMENT avec un tableau JSON (rien d'autre, pas de ```), où chaque élément est : " +
      '{"index": <int>, "summary_fr": "<une phrase courte en français, factuelle, max 25 mots>", ' +
      '"category": "<Modèle|Produit|Recherche|Financement|Politique|Autre>"}';

    try {
      const result = await callClaude(system, JSON.stringify(payload));
      for (const r of result) {
        const original = group[r.index];
        if (original) enriched.push({ ...original, summary_fr: r.summary_fr, category: r.category });
      }
    } catch (err) {
      console.error(`[summarize] échec sur un lot de news : ${err.message}`);
      // fallback : on garde les articles sans résumé IA plutôt que de tout perdre
      for (const it of group) enriched.push({ ...it, summary_fr: it.rawSummary, category: "Autre" });
    }
  }

  return enriched;
}

/**
 * Résume et catégorise les entrées de roadmap (par éditeur) en style "diff".
 * vendors: [{ vendor, items: [{ title, rawSummary }] }]
 */
export async function summarizeRoadmaps(vendors) {
  const out = [];

  for (const v of vendors) {
    if (v.items.length === 0) {
      out.push({ ...v, items: [] });
      continue;
    }

    const payload = v.items.map((it, i) => ({ index: i, title: it.title, excerpt: it.rawSummary }));

    const system =
      "Tu es un veilleur technologique spécialisé en roadmaps produit IA/data. " +
      "Pour chaque entrée JSON, réponds UNIQUEMENT avec un tableau JSON (rien d'autre), où chaque élément est : " +
      '{"index": <int>, "summary_fr": "<une phrase courte en français, factuelle, max 20 mots>", ' +
      '"diff_type": "<added|updated|deprecated>"} ' +
      '(added = nouvelle fonctionnalité/produit/modèle, updated = mise à jour/amélioration, deprecated = retrait/dépréciation).';

    try {
      const result = await callClaude(system, JSON.stringify(payload));
      const items = v.items.map((it, i) => {
        const r = result.find((x) => x.index === i);
        return {
          ...it,
          summary_fr: r?.summary_fr || it.rawSummary,
          diff_type: r?.diff_type || "updated"
        };
      });
      out.push({ ...v, items });
    } catch (err) {
      console.error(`[summarize] échec sur le vendor ${v.vendor} : ${err.message}`);
      out.push({
        ...v,
        items: v.items.map((it) => ({ ...it, summary_fr: it.rawSummary, diff_type: "updated" }))
      });
    }
  }

  return out;
}

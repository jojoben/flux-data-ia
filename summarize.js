// summarize.js
// Appelle l'API Anthropic pour résumer/catégoriser les contenus en français.
// Nécessite ANTHROPIC_API_KEY. Chaque appel a un timeout strict pour éviter
// tout blocage du pipeline en cas de souci réseau.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const CHUNK_SIZE = 15;
const TIMEOUT_MS = 30000;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante dans l'environnement.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
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
      }),
      signal: controller.signal
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

    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } finally {
    clearTimeout(timer);
  }
}

export async function summarizeNews(items) {
  const groups = chunk(items, CHUNK_SIZE);
  const enriched = [];

  for (const group of groups) {
    const payload = group.map((it, i) => ({ index: i, title: it.title, source: it.source, excerpt: it.rawSummary }));

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
      for (const it of group) enriched.push({ ...it, summary_fr: it.rawSummary, category: "Autre" });
    }
  }

  return enriched;
}

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
        return { ...it, summary_fr: r?.summary_fr || it.rawSummary, diff_type: r?.diff_type || "updated" };
      });
      out.push({ ...v, items });
    } catch (err) {
      console.error(`[summarize] échec sur le vendor ${v.vendor} : ${err.message}`);
      out.push({ ...v, items: v.items.map((it) => ({ ...it, summary_fr: it.rawSummary, diff_type: "updated" })) });
    }
  }

  return out;
}

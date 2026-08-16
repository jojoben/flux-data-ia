# FLUX — Veille quotidienne Data & IA

Site statique qui publie chaque jour :
- les actualités **Data & IA** du marché (presse spécialisée + blogs éditeurs) ;
- les **roadmaps / changelogs** des principaux éditeurs (OpenAI, Google DeepMind, Microsoft, Hugging Face, GitHub, NVIDIA...), présentés façon "diff" (`+` nouveauté, `~` mise à jour, `−` dépréciation).

Le contenu est collecté automatiquement (flux RSS), puis résumé et catégorisé en français par l'API Anthropic (Claude), sans intervention manuelle, une fois par jour.

## Structure du projet

```
site/                 → le site statique (HTML/CSS/JS), à déployer tel quel
  index.html
  style.css
  script.js
  data/news.json      → généré automatiquement (news)
  data/roadmaps.json  → généré automatiquement (roadmaps)
scripts/
  sources.json        → LISTE DES SOURCES — le seul fichier à éditer pour ajouter/retirer un flux
  fetch-news.js        → récupère les flux "news"
  fetch-roadmaps.js    → récupère les flux "roadmaps", groupés par éditeur
  summarize.js         → appelle l'API Anthropic pour résumer/catégoriser en français
  build.js             → orchestre le tout et écrit site/data/*.json
.github/workflows/
  daily-update.yml     → exécution quotidienne automatique + déploiement GitHub Pages
```

## 1. Tester en local

```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."   # ta clé API Anthropic
npm run build                            # régénère site/data/news.json et roadmaps.json
```

Puis ouvre `site/index.html` via un petit serveur local (le `fetch()` du JS ne fonctionne pas en `file://`) :

```bash
npx serve site
# ou : python3 -m http.server --directory site 8080
```

Sans clé API (`ANTHROPIC_API_KEY` absente), `npm run build` fonctionne quand même : il publie les titres/extraits bruts des flux RSS, sans résumé IA — utile pour tester rapidement.

## 2. Mettre en ligne gratuitement (GitHub Pages)

1. Crée un dépôt GitHub et pousse ce projet dedans.
2. Dans **Settings → Secrets and variables → Actions**, ajoute un secret `ANTHROPIC_API_KEY` avec ta clé API Anthropic ([console.anthropic.com](https://console.anthropic.com)).
3. Dans **Settings → Pages**, choisis la source **GitHub Actions**.
4. Le workflow `.github/workflows/daily-update.yml` :
   - tourne chaque jour à 6h (heure de Paris, à ajuster en fonction de l'heure d'été/hiver dans le fichier `cron`),
   - régénère `site/data/*.json`,
   - commite les nouvelles données,
   - déploie le dossier `site/` sur GitHub Pages.
5. Tu peux aussi le lancer manuellement depuis l'onglet **Actions → Mise à jour quotidienne du site → Run workflow**.

Le site sera accessible à une URL du type `https://<ton-compte>.github.io/<nom-du-repo>/`.

## 3. Ajouter / modifier des sources

Tout se passe dans `scripts/sources.json` :

```json
{ "name": "Nom affiché", "url": "https://.../rss.xml", "tag": "Éditeur" }
```

- Section `news` : flux affichés dans la colonne "Actualités".
- Section `roadmaps` : flux groupés par `vendor` (nom de l'éditeur), affichés en style diff.

**Important** : certaines URLs de flux RSS peuvent changer ou disparaître (ex. le mirroir Anthropic, qui n'a pas de flux RSS officiel). Si une source cesse de fonctionner, le pipeline continue sans elle (l'erreur est loggée dans l'onglet Actions), mais pense à la corriger ou à la remplacer régulièrement.

Éditeurs sans flux RSS fiable à ce jour (à surveiller manuellement ou à scraper si besoin) :
- **Anthropic** — pas de flux RSS officiel ; le projet utilise un mirroir communautaire non garanti dans le temps.
- Certains changelogs propriétaires (Azure AI, Vertex AI) publient des pages HTML sans RSS stable — à ajouter en scraping HTML si tu veux les inclure (voir `fetch-roadmaps.js` comme point de départ).

## 4. Ajuster le rythme et la fenêtre temporelle

- `NEWS_WINDOW_HOURS` (défaut 48h) et `ROADMAP_WINDOW_DAYS` (défaut 14 jours) : variables d'environnement à définir avant `npm run build` pour élargir/réduire la fenêtre de fraîcheur des contenus.
- Le `cron` dans `daily-update.yml` contrôle la fréquence (par défaut : une fois par jour).

## 5. Coûts

- Hébergement GitHub Pages : gratuit.
- API Anthropic : facturée à l'usage (résumé de ~50-150 articles/jour avec un modèle économique — coût de l'ordre de quelques centimes par jour selon le volume).

# FLUX — Veille quotidienne Data & IA

Site statique publiant chaque jour les actus **Data & IA** et les **roadmaps éditeurs**, collectées automatiquement et résumées en français.

**Structure volontairement plate** (tous les fichiers à la racine, pas de sous-dossiers) : ça évite les soucis d'upload de dossiers imbriqués via l'interface web de GitHub.

## Fichiers

```
index.html, style.css, script.js   → le site
news.json, roadmaps.json           → données affichées (regénérées automatiquement)
sources.json                       → LISTE DES SOURCES — seul fichier à éditer pour ajouter un flux
fetch-news.js, fetch-roadmaps.js   → récupération des flux RSS (avec timeout strict)
summarize.js                       → résumé/catégorisation via l'API Anthropic
build.js                           → orchestrateur, écrit news.json et roadmaps.json
.github/workflows/daily-update.yml → exécution quotidienne + déploiement GitHub Pages
```

## Tester en local

```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."   # optionnel — sans clé, pas de résumé IA mais ça fonctionne
npm run build
npx serve .
```

## Mise en ligne (GitHub Pages)

1. Pousse tous ces fichiers à la racine d'un dépôt GitHub (garde `.github/workflows/daily-update.yml` intact).
2. (Optionnel) Ajoute le secret `ANTHROPIC_API_KEY` dans Settings → Secrets and variables → Actions.
3. Settings → Pages → Source : **GitHub Actions**.
4. Onglet Actions → « Mise à jour quotidienne du site » → **Run workflow**.
5. L'URL apparaît dans Settings → Pages une fois le déploiement terminé.

Le workflow tourne ensuite automatiquement chaque jour à 6h (Paris).

## Notes techniques importantes

- **Timeout strict par flux RSS** (20s) : si un site ne répond pas, il est ignoré plutôt que de bloquer tout le pipeline indéfiniment.
- **`timeout-minutes: 10`** sur le job GitHub Actions : filet de sécurité supplémentaire.
- Certains flux peuvent casser avec le temps (changement d'URL côté éditeur) : les erreurs sont loguées dans l'onglet Actions sans arrêter les autres sources.

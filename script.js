const DIFF_LABEL = {
  added: { prefix: "+", cls: "diff-line--added" },
  updated: { prefix: "~", cls: "diff-line--updated" },
  deprecated: { prefix: "−", cls: "diff-line--deprecated" }
};

const MOSAIC_COLORS = ["#FA6A1E", "#DE3411", "#8C1B0C", "#FFB100", "#F7F4EC", "#16130F"];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossible de charger ${path}`);
  return res.json();
}

function renderMosaic() {
  const el = document.getElementById("mosaic");
  if (!el) return;
  const cells = 24;
  let html = "";
  for (let i = 0; i < cells; i++) {
    const color = MOSAIC_COLORS[Math.floor(Math.random() * MOSAIC_COLORS.length)];
    html += `<div style="background:${color}"></div>`;
  }
  el.innerHTML = html;
}

function renderTicker(items) {
  const track = document.getElementById("tickerTrack");
  if (!items.length) return;
  const headlines = items.slice(0, 15).map((it) => `<span class="ticker__item">${escapeHtml(it.title)} — ${escapeHtml(it.source)}</span>`);
  track.innerHTML = headlines.join("") + headlines.join("");
}

function renderCategoryChips(items, onFilter) {
  const container = document.getElementById("categoryChips");
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.filter = cat;
    btn.textContent = cat;
    container.appendChild(btn);
  });

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    container.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    onFilter(btn.dataset.filter);
  });
}

function renderNews(items) {
  const list = document.getElementById("newsList");
  if (!items.length) {
    list.innerHTML = '<li class="feed__empty">Aucun article pour le moment.</li>';
    return;
  }
  list.innerHTML = items
    .map(
      (it) => `
      <li class="card">
        <div class="card__meta">
          <span class="card__source">${escapeHtml(it.source)}</span>
          <span class="badge">${escapeHtml(it.category || "Actu")}</span>
          <span>${formatDate(it.publishedAt)}</span>
        </div>
        <h3 class="card__title"><a href="${it.link}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a></h3>
        <p class="card__summary">${escapeHtml(it.summary_fr || it.rawSummary || "")}</p>
      </li>`
    )
    .join("");
}

function renderRoadmaps(vendors) {
  const container = document.getElementById("roadmapList");
  const withItems = vendors.filter((v) => v.items && v.items.length);

  if (!withItems.length) {
    container.innerHTML = '<p class="feed__empty">Aucune mise à jour récente détectée.</p>';
    return;
  }

  container.innerHTML = withItems
    .map((v) => {
      const lines = v.items
        .map((it) => {
          const conf = DIFF_LABEL[it.diff_type] || DIFF_LABEL.updated;
          return `
            <div class="diff-line ${conf.cls}">
              <span class="diff-line__prefix">${conf.prefix}</span>
              <span class="diff-line__body"><a href="${it.link}" target="_blank" rel="noopener">${escapeHtml(it.summary_fr || it.title)}</a></span>
              <span class="diff-line__date">${formatDate(it.publishedAt)}</span>
            </div>`;
        })
        .join("");
      return `
        <div class="roadmap__vendor">
          <div class="roadmap__vendor-head">${escapeHtml(v.vendor)}</div>
          ${lines}
        </div>`;
    })
    .join("");
}

async function init() {
  renderMosaic();

  try {
    const [newsData, roadmapData] = await Promise.all([
      loadJSON("news.json"),
      loadJSON("roadmaps.json")
    ]);

    const news = newsData.items || [];
    const roadmaps = roadmapData.vendors || [];

    document.getElementById("lastUpdated").textContent =
      "Dernière mise à jour : " + formatDate(newsData.generatedAt || roadmapData.generatedAt);

    renderTicker(news);
    renderNews(news);
    renderRoadmaps(roadmaps);

    renderCategoryChips(news, (filter) => {
      const filtered = filter === "Tous" ? news : news.filter((n) => n.category === filter);
      renderNews(filtered);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("newsList").innerHTML = '<li class="feed__empty">Erreur de chargement des données.</li>';
  }
}

init();

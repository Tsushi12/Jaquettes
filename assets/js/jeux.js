(function () {
  const listEl = () => document.getElementById("gamesList");
  const THUMB_DIR = "assets/data/thumbs_webp/";
  const DESKTOP_INITIAL_RENDER_BATCH = 80;
  const DESKTOP_RENDER_BATCH_SIZE = 120;
  const MOBILE_INITIAL_RENDER_BATCH = 16;
  const MOBILE_RENDER_BATCH_SIZE = 20;
  let renderCycle = 0;

  function isMobileRenderMode() {
    if (document.body?.classList.contains("mobile-layout")) return true;

    const viewportWidth = Math.max(
      window.innerWidth || 0,
      document.documentElement?.clientWidth || 0,
      window.visualViewport?.width || 0
    );
    const shortSide = Math.min(screen.width || 0, screen.height || 0);
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches || false;

    return (viewportWidth > 0 && viewportWidth <= 700) ||
      (coarsePointer && shortSide > 0 && shortSide <= 700);
  }

  function getRenderBatchConfig() {
    if (isMobileRenderMode()) {
      return { initial: MOBILE_INITIAL_RENDER_BATCH, next: MOBILE_RENDER_BATCH_SIZE };
    }
    return { initial: DESKTOP_INITIAL_RENDER_BATCH, next: DESKTOP_RENDER_BATCH_SIZE };
  }

  function applyEntryAnimationDelay(el, index) {
    if (!el || !el.style) return el;
    const delayStep = isMobileRenderMode() ? 10 : 16;
    el.style.animationDelay = Math.min(index, 8) * delayStep + "ms";
    return el;
  }

  function scheduleFrame(fn) {
    if (isMobileRenderMode()) {
      const run = () => window.setTimeout(fn, 28);
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
        return;
      }
      window.setTimeout(fn, 28);
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(fn);
      return;
    }
    window.setTimeout(fn, 16);
  }

  function applyTitleTail(el, text) {
    const t = (text || "").toString();
    const n = 6;
    el.innerHTML = "";
    if (t.length <= n) {
      el.textContent = t;
      return;
    }
    const main = document.createElement("span");
    main.textContent = t.slice(0, t.length - n);

    const tail = document.createElement("span");
    tail.className = "title-tail";
    tail.textContent = t.slice(t.length - n);

    el.appendChild(main);
    el.appendChild(tail);
  }

  function buildLink(dossier, fichier, extension) {
    let d = (dossier || "").trim();
    let f = (fichier || "").trim();
    let e = (extension || "").trim();

    if (!d && !f && !e) return "";
    d = d.replace(/\\/g, "/");
    if (d && !d.endsWith("/")) d += "/";
    if (e.startsWith(".")) e = e.slice(1);
    if (e) return d + f + "." + e;
    return d + f;
  }

  function buildPreviewLink(lien, apercu) {
    let src = (apercu || lien || "").trim();
    if (!src) return "";

    try {
      src = new URL(src, window.location.href).pathname;
    } catch (e) {
    }

    const parts = src.replace(/\\/g, "/").split("/").filter(Boolean);
    let file = parts.pop() || "";
    try { file = decodeURIComponent(file); } catch (e) { }

    const base = file.replace(/\.[^/.?#]+$/, "");
    return base ? THUMB_DIR + base + ".webp" : "";
  }

  function normalizeCoverRow(r) {
    const id = (r.id || "").trim();
    const titre = (r.titre || "").trim();
    const format = (r.format || "").trim();

    let lien = (r.lien || "").trim();
    if (!lien) lien = buildLink(r.dossier, r.fichier, r.extension);

    const apercu = buildPreviewLink(lien, r.apercu);

    if (!id || !titre || !format || !lien || !apercu) return null;
    return { id, titre, format, lien, apercu };
  }

  function modulesToCovers(modules) {
    const rows = [];
    for (const m of modules) {
      for (const it of m.items) rows.push({ id: it.id, titre: m.titre, format: it.format, lien: it.lien, apercu: it.apercu });
    }
    return rows;
  }

  function loadFromFallback() {
    let data = window.GAMES_DATA;
    if (!data) return [];
    if (!Array.isArray(data)) data = [data];
    if (!data.length) return [];

    const first = data[0];
    if (first && Array.isArray(first.items)) return modulesToCovers(data);

    const rows = [];
    for (const r of window.GAMES_DATA) {
      const row = normalizeCoverRow(r);
      if (row) rows.push(row);
    }
    return rows;
  }

  function groupByTitle(rows) {
    const map = new Map();
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

    for (const r of rows) {
      const titre = (r.titre || "").trim();
      const key = titre.toLowerCase();
      if (!map.has(key)) map.set(key, { titre, items: [], sortId: r.id });
      const m = map.get(key);
      if (!m.titre && titre) m.titre = titre;
      m.items.push({ id: r.id, format: r.format, lien: r.lien, apercu: r.apercu });

      if (coll.compare(r.id, m.sortId) < 0) m.sortId = r.id;
    }

    const modules = Array.from(map.values());

    for (const m of modules) {
      m.items.sort((a, b) => {
        const c = (a.format || "").localeCompare(b.format || "", "fr");
        if (c !== 0) return c;
        return coll.compare(a.id, b.id);
      });
    }

    modules.sort((a, b) => coll.compare(a.sortId, b.sortId));
    return modules;
  }

  function createCoverCard(gameTitle, it) {
    const a = document.createElement("a");
    a.className = "cover-card";
    a.href = it.lien;
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.src = it.apercu;
    img.alt = gameTitle + " - " + it.format;
    img.loading = "lazy";
    img.decoding = "async";

    const meta = document.createElement("div");
    meta.className = "cover-meta";

    const fmt = document.createElement("div");
    fmt.className = "cover-format";
    fmt.textContent = it.format;

    meta.appendChild(fmt);
    a.appendChild(img);
    a.appendChild(meta);
    return a;
  }

  function createGamePanel(m) {
    const panel = document.createElement("div");
    panel.className = "movie-panel";

    const grid = document.createElement("div");
    grid.className = "cover-grid";

    const fragment = document.createDocumentFragment();
    for (const it of m.items) fragment.appendChild(createCoverCard(m.titre, it));
    grid.appendChild(fragment);
    panel.appendChild(grid);
    return panel;
  }

  function ensureGamePanel(details, m) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createGamePanel(m));
    details.dataset.lazyLoaded = "true";
  }

  function createGameDetails(m) {
    const details = document.createElement("details");
    details.className = "movie-details";

    const summary = document.createElement("summary");

    const left = document.createElement("div");
    left.className = "movie-summary-title";

    const title = document.createElement("div");
    title.className = "movie-title";
    applyTitleTail(title, m.titre);

    left.appendChild(title);

    const chev = document.createElement("div");
    chev.className = "movie-chevron";
    chev.textContent = "▼";

    summary.appendChild(left);
    summary.appendChild(chev);
    details.appendChild(summary);

    details.addEventListener("toggle", () => {
      if (details.open) ensureGamePanel(details, m);
    });

    return details;
  }

  function renderBatched(host, modules) {
    const token = ++renderCycle;
    host.replaceChildren();

    if (!modules.length) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucun jeu trouvé.";
      host.appendChild(p);
      return;
    }

    let index = 0;
    const batchConfig = getRenderBatchConfig();

    function appendBatch(size) {
      if (token !== renderCycle) return;

      const end = Math.min(index + size, modules.length);
      const fragment = document.createDocumentFragment();
      const batchStart = index;
      for (; index < end; index += 1) {
        const node = createGameDetails(modules[index]);
        applyEntryAnimationDelay(node, index - batchStart);
        fragment.appendChild(node);
      }
      host.appendChild(fragment);

      if (index < modules.length) {
        scheduleFrame(() => appendBatch(batchConfig.next));
      }
    }

    appendBatch(batchConfig.initial);
  }

  function render(modules) {
    const host = listEl();
    if (!host) return;
    renderBatched(host, modules || []);
  }

  function searchGames() {
    const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const filtered = window.__GAMES_MODULES.filter(m => (m.titre || "").toLowerCase().includes(q));
    render(filtered);
  }

  function init() {
    const coverRows = loadFromFallback();
    window.__DATA_SOURCE = "js";

    window.__GAMES_MODULES = groupByTitle(coverRows);
    render(window.__GAMES_MODULES);
    window.searchGames = searchGames;
  }

  document.addEventListener("DOMContentLoaded", init);
})();

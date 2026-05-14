(function () {
  const listEl = () => document.getElementById("moviesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];
  const THUMB_DIR = "assets/data/thumbs_webp/";
  const INITIAL_RENDER_BATCH = 80;
  const RENDER_BATCH_SIZE = 120;
  let renderCycle = 0;

  function applyEntryAnimationDelay(el, index) {
    if (!el || !el.style) return el;
    el.style.animationDelay = Math.min(index, 8) * 16 + "ms";
    return el;
  }

  function scheduleFrame(fn) {
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

  function loadFromFallback() {
    if (!Array.isArray(window.MOVIES_DATA) || !window.MOVIES_DATA.length) return [];

    const first = window.MOVIES_DATA[0];
    if (first && Array.isArray(first.items)) {
      const modules = [];
      for (const m of window.MOVIES_DATA) {
        if (!m || !m.titre || !Array.isArray(m.items)) continue;
        const items = [];
        for (const it of m.items) {
          const row = normalizeCoverRow({ id: it.id, titre: m.titre, format: it.format, lien: it.lien, apercu: it.apercu });
          if (row) items.push(row);
        }
        if (items.length) modules.push({ titre: m.titre, sortId: (m.sortId || "").trim(), items });
      }
      return modulesToCovers(modules);
    }

    const rows = [];
    for (const r of window.MOVIES_DATA) {
      const row = normalizeCoverRow(r);
      if (row) rows.push(row);
    }
    return rows;
  }

  function modulesToCovers(modules) {
    const rows = [];
    for (const m of modules) {
      for (const it of m.items) rows.push({ id: it.id, titre: m.titre, format: it.format, lien: it.lien, apercu: it.apercu });
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
        const ia = FORMAT_PRIORITY.indexOf(a.format);
        const ib = FORMAT_PRIORITY.indexOf(b.format);
        const pa = ia === -1 ? 999 : ia;
        const pb = ib === -1 ? 999 : ib;
        if (pa !== pb) return pa - pb;
        const c = coll.compare(a.id, b.id);
        if (c !== 0) return c;
        return (a.format || "").localeCompare(b.format || "", "fr");
      });
    }

    modules.sort((a, b) => coll.compare(a.sortId, b.sortId));
    return modules;
  }

  function createCoverCard(movieTitle, it) {
    const a = document.createElement("a");
    a.className = "cover-card";
    a.href = it.lien;
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.src = it.apercu;
    img.alt = movieTitle + " - " + it.format;
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

  function createMoviePanel(m) {
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

  function ensureMoviePanel(details, m) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createMoviePanel(m));
    details.dataset.lazyLoaded = "true";
  }

  function createMovieDetails(m) {
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
      if (details.open) ensureMoviePanel(details, m);
    });

    return details;
  }

  function renderBatched(host, modules) {
    const token = ++renderCycle;
    host.replaceChildren();

    if (!modules.length) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucun film trouvé.";
      host.appendChild(p);
      return;
    }

    let index = 0;

    function appendBatch(size) {
      if (token !== renderCycle) return;

      const end = Math.min(index + size, modules.length);
      const fragment = document.createDocumentFragment();
      const batchStart = index;
      for (; index < end; index += 1) {
        const node = createMovieDetails(modules[index]);
        applyEntryAnimationDelay(node, index - batchStart);
        fragment.appendChild(node);
      }
      host.appendChild(fragment);

      if (index < modules.length) {
        scheduleFrame(() => appendBatch(RENDER_BATCH_SIZE));
      }
    }

    appendBatch(INITIAL_RENDER_BATCH);
  }

  function render(modules) {
    const host = listEl();
    if (!host) return;
    renderBatched(host, modules || []);
  }

  function searchMovies() {
    const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const filtered = window.__MOVIES_MODULES.filter(m => {
      const titleMatch = (m.titre || "").toLowerCase().includes(q);
      const idMatch = (m.sortId || "").toLowerCase().includes(q);
      const anyCoverId = (m.items || []).some(it => (it.id || "").toLowerCase().includes(q));
      return titleMatch || idMatch || anyCoverId;
    });
    render(filtered);
  }

  function init() {
    const coverRows = loadFromFallback();
    window.__DATA_SOURCE = "js";

    window.__MOVIES_MODULES = groupByTitle(coverRows);
    render(window.__MOVIES_MODULES);
    window.searchMovies = searchMovies;
  }

  document.addEventListener("DOMContentLoaded", init);
})();

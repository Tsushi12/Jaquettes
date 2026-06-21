(function () {
  const listEl = () => document.getElementById("moviesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];
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
    const marker = " |";
    const markerStart = t.indexOf(marker);
    const start = markerStart === -1 ? -1 : markerStart + 1;
    const end = start === -1 ? -1 : t.indexOf("|", start + 1);

    el.innerHTML = "";
    if (start === -1 || end === -1) {
      el.textContent = t;
      return;
    }

    const main = document.createElement("span");
    main.textContent = t.slice(0, start);

    const tail = document.createElement("span");
    tail.className = "title-tail";
    tail.textContent = t.slice(start + 1, end);

    el.appendChild(main);
    el.appendChild(tail);

    if (end + 1 < t.length) {
      const after = document.createElement("span");
      after.textContent = t.slice(end + 1);
      el.appendChild(after);
    }
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

  function getIdCategory(id) {
    const s = (id || "").trim();
    const first = s.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
    return /^[A-Z]$/.test(first) ? first + " :" : "# :";
  }

  function getCategoryRank(category) {
    if (category === "# :") return 0;
    const first = (category || "").charAt(0).toUpperCase();
    return /^[A-Z]$/.test(first) ? first.charCodeAt(0) - 64 : 0;
  }
  function loadFromFallback() {
    if (!Array.isArray(window.MOVIES_DATA) || !window.MOVIES_DATA.length) return [];

    const first = window.MOVIES_DATA[0];
    if (first && Array.isArray(first.titles)) {
      const rows = [];
      for (const group of window.MOVIES_DATA) {
        for (const m of group.titles || []) {
          if (!m || !m.titre || !Array.isArray(m.items)) continue;
          for (const it of m.items) {
            const row = normalizeCoverRow({ id: it.id, titre: m.titre, format: it.format, lien: it.lien, apercu: it.apercu });
            if (row) rows.push(row);
          }
        }
      }
      return rows;
    }

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

  function groupByCategory(rows) {
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
    const map = new Map();

    for (const r of rows) {
      const category = getIdCategory(r.id);
      if (!map.has(category)) {
        map.set(category, { category, rank: getCategoryRank(category), sortId: r.id, rows: [] });
      }
      const group = map.get(category);
      group.rows.push(r);
      if (coll.compare(r.id, group.sortId) < 0) group.sortId = r.id;
    }

    const groups = Array.from(map.values()).sort((a, b) => a.rank - b.rank);
    return groups.map(group => ({
      category: group.category,
      sortId: group.sortId,
      titles: groupByTitle(group.rows),
    }));
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

  function createCategoryDivider(category, isFirst) {
    const wrap = document.createElement("div");
    wrap.className = "category-divider";

    if (!isFirst) {
      wrap.classList.add("category-divider-with-separator");
      const hr = document.createElement("hr");
      wrap.appendChild(hr);
    }

    const h2 = document.createElement("h2");
    h2.className = "category-title";
    h2.textContent = category;
    wrap.appendChild(h2);
    return wrap;
  }

  function flattenRenderItems(groups) {
    const items = [];
    let isFirstCategory = true;

    for (const group of groups || []) {
      if (!group || !(group.titles || []).length) continue;
      items.push({ kind: "divider", category: group.category || "# :", isFirst: isFirstCategory });
      isFirstCategory = false;
      for (const title of group.titles) items.push({ kind: "title", title });
    }

    return items;
  }

  function createRenderNode(item) {
    if (item.kind === "divider") return createCategoryDivider(item.category, item.isFirst);
    return createMovieDetails(item.title);
  }

  function renderBatched(host, groups) {
    const token = ++renderCycle;
    host.replaceChildren();

    const items = flattenRenderItems(groups || []);
    const hasTitles = items.some(item => item.kind === "title");

    if (!hasTitles) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucun film trouvé.";
      host.appendChild(p);
      return;
    }

    let index = 0;
    const batchConfig = getRenderBatchConfig();

    function appendBatch(size) {
      if (token !== renderCycle) return;

      const end = Math.min(index + size, items.length);
      const fragment = document.createDocumentFragment();
      const batchStart = index;
      for (; index < end; index += 1) {
        const node = createRenderNode(items[index]);
        applyEntryAnimationDelay(node, index - batchStart);
        fragment.appendChild(node);
      }
      host.appendChild(fragment);

      if (index < items.length) {
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

  function filterGroups(groups, q) {
    if (!q) return groups;

    const ql = q.toLowerCase();
    const out = [];

    for (const group of groups || []) {
      const categoryMatch = (group.category || "").toLowerCase().includes(ql);
      const titles = [];

      for (const m of group.titles || []) {
        const titleMatch = (m.titre || "").toLowerCase().includes(ql);
        const idMatch = (m.sortId || "").toLowerCase().includes(ql);
        const anyCoverId = (m.items || []).some(it => (it.id || "").toLowerCase().includes(ql));
        if (categoryMatch || titleMatch || idMatch || anyCoverId) titles.push(m);
      }

      if (titles.length) out.push({ ...group, titles });
    }

    return out;
  }

  function searchMovies() {
    const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    render(filterGroups(window.__MOVIES_GROUPS, q));
  }
  function init() {
    const coverRows = loadFromFallback();
    window.__DATA_SOURCE = "js";

    window.__MOVIES_GROUPS = groupByCategory(coverRows);
    window.__MOVIES_MODULES = window.__MOVIES_GROUPS.flatMap(group => group.titles || []);
    render(window.__MOVIES_GROUPS);
    window.searchMovies = searchMovies;
  }

  document.addEventListener("DOMContentLoaded", init);
})();

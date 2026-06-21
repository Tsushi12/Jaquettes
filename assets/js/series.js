(function () {
  const listEl = () => document.getElementById("seriesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];
  const THUMB_DIR = "assets/data/thumbs_webp/";
  const DESKTOP_INITIAL_RENDER_BATCH = 70;
  const DESKTOP_RENDER_BATCH_SIZE = 100;
  const MOBILE_INITIAL_RENDER_BATCH = 12;
  const MOBILE_RENDER_BATCH_SIZE = 16;
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

  function normalizeRow(r) {
    const id = (r.id || "").trim();
    const titre = (r.titre || "").trim();
    const saison = (r.saison || "").trim();
    const format = (r.format || "").trim();

    let lien = (r.lien || "").trim();
    if (!lien) lien = buildLink(r.dossier, r.fichier, r.extension);

    const apercu = buildPreviewLink(lien, r.apercu);

    if (!id || !titre || !saison || !format || !lien || !apercu) return null;
    return { id, titre, saison, format, lien, apercu };
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
  function rowsFromFallback() {
    let data = window.SERIES_DATA;
    if (!data) return [];
    if (!Array.isArray(data)) data = [data];
    if (!data.length) return [];

    const rows = [];
    for (const groupOrSeries of data) {
      const seriesList = Array.isArray(groupOrSeries?.series) ? groupOrSeries.series : [groupOrSeries];
      for (const s of seriesList) {
        if (!s || !s.titre || !Array.isArray(s.seasons)) continue;
        for (const seas of s.seasons) {
          if (!seas || !seas.saison || !Array.isArray(seas.items)) continue;
          for (const it of seas.items) {
            const row = normalizeRow({
              id: it.id,
              titre: s.titre,
              saison: seas.saison,
              format: it.format,
              lien: it.lien,
              apercu: it.apercu,
            });
            if (row) rows.push(row);
          }
        }
      }
    }
    return rows;
  }
  function groupSeries(rows) {
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

    const seriesMap = new Map();
    for (const r of rows) {
      const title = (r.titre || "").trim();
      const key = title.toLowerCase();
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { titre: title, sortId: r.id, seasons: new Map() });
      }
      const s = seriesMap.get(key);

      if (coll.compare(r.id, s.sortId) < 0) s.sortId = r.id;

      const seasonName = (r.saison || "").trim();
      const sk = seasonName.toLowerCase();
      if (!s.seasons.has(sk)) {
        s.seasons.set(sk, { saison: seasonName, sortId: r.id, items: [] });
      }
      const seas = s.seasons.get(sk);

      if (coll.compare(r.id, seas.sortId) < 0) seas.sortId = r.id;
      seas.items.push({ id: r.id, format: r.format, lien: r.lien, apercu: r.apercu });
    }

    const modules = [];
    for (const s of seriesMap.values()) {
      const seasons = Array.from(s.seasons.values());

      for (const seas of seasons) {
        seas.items.sort((a, b) => {
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

      seasons.sort((a, b) => coll.compare(a.sortId, b.sortId));
      modules.push({ titre: s.titre, sortId: s.sortId, seasons });
    }

    modules.sort((a, b) => coll.compare(a.sortId, b.sortId));
    return modules;
  }

  function groupSeriesByCategory(rows) {
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
      series: groupSeries(group.rows),
    }));
  }
  function createCoverCard(seriesTitle, seasonName, it) {
    const a = document.createElement("a");
    a.className = "cover-card";
    a.href = it.lien;
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.src = it.apercu;
    img.alt = seriesTitle + " - " + seasonName + " - " + it.format;
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

  function createSeasonPanel(seriesTitle, seas) {
    const wrap = document.createElement("div");
    wrap.className = "season-panel";

    const grid = document.createElement("div");
    grid.className = "cover-grid";

    const fragment = document.createDocumentFragment();
    for (const it of seas.items) fragment.appendChild(createCoverCard(seriesTitle, seas.saison, it));
    grid.appendChild(fragment);
    wrap.appendChild(grid);
    return wrap;
  }

  function ensureSeasonPanel(details, seriesTitle, seas) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createSeasonPanel(seriesTitle, seas));
    details.dataset.lazyLoaded = "true";
  }

  function createSeasonDetails(seriesTitle, seas) {
    const sd = document.createElement("details");
    sd.className = "season-details";

    const ss = document.createElement("summary");
    ss.textContent = seas.saison;
    sd.appendChild(ss);

    sd.addEventListener("toggle", () => {
      if (sd.open) ensureSeasonPanel(sd, seriesTitle, seas);
    });

    return sd;
  }

  function createSeriesPanel(s) {
    const panel = document.createElement("div");
    panel.className = "movie-panel";

    const fragment = document.createDocumentFragment();
    for (const seas of s.seasons) {
      fragment.appendChild(createSeasonDetails(s.titre, seas));
    }
    panel.appendChild(fragment);
    return panel;
  }

  function ensureSeriesPanel(details, s) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createSeriesPanel(s));
    details.dataset.lazyLoaded = "true";
  }

  function createSeriesDetails(s) {
    const details = document.createElement("details");
    details.className = "movie-details";

    const summary = document.createElement("summary");

    const left = document.createElement("div");
    left.className = "movie-summary-title";

    const title = document.createElement("div");
    title.className = "movie-title";
    applyTitleTail(title, s.titre);

    left.appendChild(title);

    const chev = document.createElement("div");
    chev.className = "movie-chevron";
    chev.textContent = "▼";

    summary.appendChild(left);
    summary.appendChild(chev);
    details.appendChild(summary);

    details.addEventListener("toggle", () => {
      if (details.open) ensureSeriesPanel(details, s);
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
      if (!group || !(group.series || []).length) continue;
      items.push({ kind: "divider", category: group.category || "# :", isFirst: isFirstCategory });
      isFirstCategory = false;
      for (const serie of group.series) items.push({ kind: "series", serie });
    }

    return items;
  }

  function createRenderNode(item) {
    if (item.kind === "divider") return createCategoryDivider(item.category, item.isFirst);
    return createSeriesDetails(item.serie);
  }

  function renderBatched(host, groups) {
    const token = ++renderCycle;
    host.replaceChildren();

    const items = flattenRenderItems(groups || []);
    const hasSeries = items.some(item => item.kind === "series");

    if (!hasSeries) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucune série trouvée.";
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

  function normalizeSearchText(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\u0153/g, "oe")
      .replace(/\u00e6/g, "ae")
      .replace(/\u00f8/g, "o")
      .replace(/\u00df/g, "ss")
      .replace(/[\u0027\u0060\u00B4\u02B9\u02BA\u02BB\u02BC\u02BD\u02BE\u02C8\u02CA\u02CB\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "");
  }
  function filterGroups(groups, q) {
    const ql = normalizeSearchText(q);
    if (!ql) return groups;
    const out = [];

    for (const group of groups || []) {
      const categoryMatch = normalizeSearchText(group.category).includes(ql);
      const series = [];

      for (const s of group.series || []) {
        const titleMatch = normalizeSearchText(s.titre).includes(ql);
        if (categoryMatch || titleMatch) {
          series.push(s);
          continue;
        }

        const seasons = [];
        for (const seas of s.seasons || []) {
          const seasonMatch = normalizeSearchText(seas.saison).includes(ql);
          if (seasonMatch) {
            seasons.push(seas);
            continue;
          }

          const items = (seas.items || []).filter(it => {
            return normalizeSearchText(it.format).includes(ql) ||
              normalizeSearchText(it.id).includes(ql);
          });
          if (items.length) seasons.push({ ...seas, items });
        }

        if (seasons.length) series.push({ ...s, seasons });
      }

      if (series.length) out.push({ ...group, series });
    }

    return out;
  }
  function searchSeries() {
    const q = (document.getElementById("searchInput")?.value || "").trim();
    render(filterGroups(window.__SERIES_GROUPS, q));
  }

  function init() {
    const rows = rowsFromFallback();
    window.__DATA_SOURCE = "js";

    window.__SERIES_GROUPS = groupSeriesByCategory(rows);
    window.__SERIES_MODULES = window.__SERIES_GROUPS.flatMap(group => group.series || []);
    render(window.__SERIES_GROUPS);
    window.searchSeries = searchSeries;
  }

  document.addEventListener("DOMContentLoaded", init);
})();

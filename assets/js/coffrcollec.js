(function () {
  const listEl = () => document.getElementById("coffrcollecList");

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
    const type = (r.type || "").trim();
    const coffrcollec = (r.coffrcollec || "").trim();
    const format = (r.format || "").trim();

    let lien = (r.lien || "").trim();
    if (!lien) lien = buildLink(r.dossier, r.fichier, r.extension);

    const apercu = buildPreviewLink(lien, r.apercu);

    if (!id || !titre || !type || !coffrcollec || !format || !lien || !apercu) return null;
    return { id, titre, type, coffrcollec, format, lien, apercu };
  }

  function rowsFromFallback() {
    let data = window.COFFRCOLLEC_DATA;
    if (!data) return [];
    if (!Array.isArray(data)) data = [data];
    if (!data.length) return [];

    const rows = [];

    for (const group of data) {
      if (group && Array.isArray(group.titles)) {
        const type = (group.type || "").trim();
        for (const title of group.titles) {
          if (!title || !title.titre || !Array.isArray(title.coffrcollecs)) continue;
          for (const cc of title.coffrcollecs) {
            if (!cc || !cc.coffrcollec || !Array.isArray(cc.items)) continue;
            for (const it of cc.items) {
              const row = normalizeRow({
                id: it.id,
                titre: title.titre,
                type,
                coffrcollec: cc.coffrcollec,
                format: it.format,
                lien: it.lien,
                apercu: it.apercu,
              });
              if (row) rows.push(row);
            }
          }
        }
        continue;
      }

      const row = normalizeRow(group || {});
      if (row) rows.push(row);
    }

    return rows;
  }

  function groupCoffrcollec(rows) {
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
    const typeMap = new Map();

    for (const r of rows) {
      const typeName = (r.type || "").trim();
      const typeKey = typeName.toLowerCase();
      if (!typeMap.has(typeKey)) {
        typeMap.set(typeKey, { type: typeName, sortId: r.id, titles: new Map() });
      }
      const typeGroup = typeMap.get(typeKey);
      if (coll.compare(r.id, typeGroup.sortId) < 0) typeGroup.sortId = r.id;

      const title = (r.titre || "").trim();
      const titleKey = title.toLowerCase();
      if (!typeGroup.titles.has(titleKey)) {
        typeGroup.titles.set(titleKey, { titre: title, sortId: r.id, coffrcollecs: new Map() });
      }
      const titleGroup = typeGroup.titles.get(titleKey);
      if (coll.compare(r.id, titleGroup.sortId) < 0) titleGroup.sortId = r.id;

      const coffrName = (r.coffrcollec || "").trim();
      const coffrKey = coffrName.toLowerCase();
      if (!titleGroup.coffrcollecs.has(coffrKey)) {
        titleGroup.coffrcollecs.set(coffrKey, { coffrcollec: coffrName, sortId: r.id, items: [] });
      }
      const coffrGroup = titleGroup.coffrcollecs.get(coffrKey);
      if (coll.compare(r.id, coffrGroup.sortId) < 0) coffrGroup.sortId = r.id;
      coffrGroup.items.push({ id: r.id, format: r.format, lien: r.lien, apercu: r.apercu });
    }

    const groups = [];
    for (const typeGroup of typeMap.values()) {
      const titles = [];

      for (const titleGroup of typeGroup.titles.values()) {
        const coffrcollecs = Array.from(titleGroup.coffrcollecs.values());

        for (const coffrGroup of coffrcollecs) {
          coffrGroup.items.sort((a, b) => {
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

        coffrcollecs.sort((a, b) => coll.compare(a.sortId, b.sortId));
        titles.push({ titre: titleGroup.titre, sortId: titleGroup.sortId, coffrcollecs });
      }

      titles.sort((a, b) => coll.compare(a.sortId, b.sortId));
      groups.push({ type: typeGroup.type, sortId: typeGroup.sortId, titles });
    }

    groups.sort((a, b) => coll.compare(a.sortId, b.sortId));
    return groups;
  }

  function createTypeDivider(type, isFirst) {
    const wrap = document.createElement("div");
    wrap.className = "coffrcollec-type-divider";

    if (!isFirst) {
      wrap.classList.add("coffrcollec-type-divider-with-separator");

      const hr = document.createElement("hr");
      wrap.appendChild(hr);
    }

    const h2 = document.createElement("h2");
    h2.className = "coffrcollec-type-title";
    h2.textContent = type;

    wrap.appendChild(h2);
    return wrap;
  }

  function createCoverCard(title, coffrName, it) {
    const a = document.createElement("a");
    a.className = "cover-card";
    a.href = it.lien;
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.src = it.apercu;
    img.alt = title + " - " + coffrName + " - " + it.format;
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

  function createCoffrPanel(title, cc) {
    const wrap = document.createElement("div");
    wrap.className = "season-panel";

    const grid = document.createElement("div");
    grid.className = "cover-grid";

    const fragment = document.createDocumentFragment();
    for (const it of cc.items) fragment.appendChild(createCoverCard(title, cc.coffrcollec, it));
    grid.appendChild(fragment);
    wrap.appendChild(grid);
    return wrap;
  }

  function ensureCoffrPanel(details, title, cc) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createCoffrPanel(title, cc));
    details.dataset.lazyLoaded = "true";
  }

  function createCoffrDetails(title, cc) {
    const sd = document.createElement("details");
    sd.className = "season-details";

    const ss = document.createElement("summary");
    ss.textContent = cc.coffrcollec;
    sd.appendChild(ss);

    sd.addEventListener("toggle", () => {
      if (sd.open) ensureCoffrPanel(sd, title, cc);
    });

    return sd;
  }

  function createTitlePanel(titleGroup) {
    const panel = document.createElement("div");
    panel.className = "movie-panel";

    const fragment = document.createDocumentFragment();
    for (const cc of titleGroup.coffrcollecs) {
      fragment.appendChild(createCoffrDetails(titleGroup.titre, cc));
    }
    panel.appendChild(fragment);
    return panel;
  }

  function ensureTitlePanel(details, titleGroup) {
    if (details.dataset.lazyLoaded === "true") return;
    details.appendChild(createTitlePanel(titleGroup));
    details.dataset.lazyLoaded = "true";
  }

  function createTitleDetails(titleGroup) {
    const details = document.createElement("details");
    details.className = "movie-details";

    const summary = document.createElement("summary");

    const left = document.createElement("div");
    left.className = "movie-summary-title";

    const title = document.createElement("div");
    title.className = "movie-title";
    applyTitleTail(title, titleGroup.titre);

    left.appendChild(title);

    const chev = document.createElement("div");
    chev.className = "movie-chevron";
    chev.textContent = "▼";

    summary.appendChild(left);
    summary.appendChild(chev);
    details.appendChild(summary);

    details.addEventListener("toggle", () => {
      if (details.open) ensureTitlePanel(details, titleGroup);
    });

    return details;
  }

  function flattenRenderItems(groups) {
    const items = [];
    let isFirstTypeBlock = true;

    for (const group of groups) {
      if (!group || !(group.titles || []).length) continue;

      items.push({ kind: "divider", type: group.type || "Autre", isFirst: isFirstTypeBlock });
      isFirstTypeBlock = false;

      for (const titleGroup of group.titles) {
        items.push({ kind: "title", titleGroup });
      }
    }

    return items;
  }

  function createRenderNode(item) {
    if (item.kind === "divider") return createTypeDivider(item.type, item.isFirst);
    return createTitleDetails(item.titleGroup);
  }

  function renderBatched(host, groups) {
    const token = ++renderCycle;
    host.replaceChildren();

    const items = flattenRenderItems(groups || []);
    const hasTitles = items.some(item => item.kind === "title");

    if (!hasTitles) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucun coffret ou collection trouvé.";
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

  function render(groups) {
    const host = listEl();
    if (!host) return;
    renderBatched(host, groups || []);
  }

  function filterGroups(groups, q) {
    if (!q) return groups;

    const ql = q.toLowerCase();
    const out = [];

    for (const group of groups) {
      const typeMatch = (group.type || "").toLowerCase().includes(ql);
      const titles = [];

      for (const titleGroup of group.titles || []) {
        const titleMatch = (titleGroup.titre || "").toLowerCase().includes(ql);
        if (typeMatch || titleMatch) {
          titles.push(titleGroup);
          continue;
        }

        const coffrcollecs = [];
        for (const cc of titleGroup.coffrcollecs || []) {
          const coffrMatch = (cc.coffrcollec || "").toLowerCase().includes(ql);
          if (coffrMatch) {
            coffrcollecs.push(cc);
            continue;
          }

          const items = (cc.items || []).filter(it => {
            return (it.format || "").toLowerCase().includes(ql) ||
              (it.id || "").toLowerCase().includes(ql);
          });

          if (items.length) coffrcollecs.push({ ...cc, items });
        }

        if (coffrcollecs.length) titles.push({ ...titleGroup, coffrcollecs });
      }

      if (titles.length) out.push({ ...group, titles });
    }

    return out;
  }

  function searchCoffrcollec() {
    const q = (document.getElementById("searchInput")?.value || "").trim();
    render(filterGroups(window.__COFFRCOLLEC_MODULES, q));
  }

  function init() {
    const rows = rowsFromFallback();
    window.__DATA_SOURCE = "js";

    window.__COFFRCOLLEC_MODULES = groupCoffrcollec(rows);
    render(window.__COFFRCOLLEC_MODULES);
    window.searchCoffrcollec = searchCoffrcollec;
  }

  document.addEventListener("DOMContentLoaded", init);
})();

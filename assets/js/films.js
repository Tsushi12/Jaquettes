(function () {
  const listEl = () => document.getElementById("moviesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];
  const THUMB_DIR = "assets/data/thumbs_webp/";

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

    // Support 2 fallback shapes:
    // A) covers rows: [{id,titre,format,lien...}, ...]
    // B) modules: [{titre, sortId, items:[{id,format,lien}...]}...]
    const first = window.MOVIES_DATA[0];
    if (first && Array.isArray(first.items)) {
      // modules
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

    // rows
    const rows = [];
    for (const r of window.MOVIES_DATA) {
      const row = normalizeCoverRow(r);
      if (row) rows.push(row);
    }
    console.info("[films] fallback rows OK:", rows.length, "jaquettes");
    return rows;
  }

  function modulesToCovers(modules) {
    // Convert modules back to cover rows (internal helper)
    const rows = [];
    for (const m of modules) {
      for (const it of m.items) rows.push({ id: it.id, titre: m.titre, format: it.format, lien: it.lien, apercu: it.apercu });
    }
    return rows;
  }

  function groupByTitle(rows) {
    // Group by movie title (titre). Each movie becomes a module (even if 1 cover).
    const map = new Map(); // titreKey -> module
    for (const r of rows) {
      const titre = (r.titre || "").trim();
      const key = titre.toLowerCase();
      if (!map.has(key)) map.set(key, { titre, items: [], sortId: r.id });
      const m = map.get(key);
      if (!m.titre && titre) m.titre = titre;
      m.items.push({ id: r.id, format: r.format, lien: r.lien, apercu: r.apercu });

      // Keep smallest id as sortId
      const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
      if (coll.compare(r.id, m.sortId) < 0) m.sortId = r.id;
    }

    const modules = Array.from(map.values());

    // sort covers within module
    for (const m of modules) {
      m.items.sort((a, b) => {
        const ia = FORMAT_PRIORITY.indexOf(a.format);
        const ib = FORMAT_PRIORITY.indexOf(b.format);
        const pa = ia === -1 ? 999 : ia;
        const pb = ib === -1 ? 999 : ib;
        if (pa !== pb) return pa - pb;
        // tie-breaker: id then format
        const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
        const c = coll.compare(a.id, b.id);
        if (c !== 0) return c;
        return (a.format || "").localeCompare(b.format || "", "fr");
      });
    }

    // sort modules by sortId (id order)
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
    modules.sort((a, b) => coll.compare(a.sortId, b.sortId));

    return modules;
  }

  function render(modules) {
    const host = listEl();
    if (!host) return;

    host.innerHTML = "";
    if (!modules.length) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucun film trouvé.";
      host.appendChild(p);
      return;
    }

    for (const m of modules) {
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

      const panel = document.createElement("div");
      panel.className = "movie-panel";

      const grid = document.createElement("div");
      grid.className = "cover-grid";

      for (const it of m.items) {
        const a = document.createElement("a");
        a.className = "cover-card";
        a.href = it.lien;
        a.target = "_blank";
        a.rel = "noopener";

        const img = document.createElement("img");
        img.src = it.apercu;
        img.alt = m.titre + " - " + it.format;
        img.loading = "lazy";

        const meta = document.createElement("div");
        meta.className = "cover-meta";

        const fmt = document.createElement("div");
        fmt.className = "cover-format";
        fmt.textContent = it.format;

        meta.appendChild(fmt);

        a.appendChild(img);
        a.appendChild(meta);
        grid.appendChild(a);
      }

      panel.appendChild(grid);

      details.appendChild(summary);
      details.appendChild(panel);
      host.appendChild(details);
    }
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
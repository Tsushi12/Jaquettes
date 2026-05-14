(function () {
  const listEl = () => document.getElementById("seriesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];
  const THUMB_DIR = "assets/data/thumbs_webp/";

  function applyTitleTail(el, text) {
    const t = (text || "").toString();
    const n = 13;
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

  function rowsFromFallback() {
    let data = window.SERIES_DATA;
    if (!data) return [];
    if (!Array.isArray(data)) data = [data];
    if (!data.length) return [];
    // Expect module shape
    const rows = [];
    for (const s of data) {
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
    return rows;
  }

  function groupSeries(rows) {
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

    const seriesMap = new Map(); // titleKey -> {titre, sortId, seasonsMap}
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

  function render(modules) {
    const host = listEl();
    if (!host) return;

    host.innerHTML = "";
    if (!modules.length) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "Aucune série trouvée.";
      host.appendChild(p);
      return;
    }

    for (const s of modules) {
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

      const panel = document.createElement("div");
      panel.className = "movie-panel";

      for (const seas of s.seasons) {
        const sd = document.createElement("details");
        sd.className = "season-details";

        const ss = document.createElement("summary");
        ss.textContent = seas.saison;

        const grid = document.createElement("div");
        grid.className = "cover-grid";

        for (const it of seas.items) {
          const a = document.createElement("a");
          a.className = "cover-card";
          a.href = it.lien;
          a.target = "_blank";
          a.rel = "noopener";

          const img = document.createElement("img");
          img.src = it.apercu;
          img.alt = s.titre + " - " + seas.saison + " - " + it.format;
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

        const wrap = document.createElement("div");
        wrap.className = "season-panel";
        wrap.appendChild(grid);

        sd.appendChild(ss);
        sd.appendChild(wrap);
        panel.appendChild(sd);
      }

      details.appendChild(summary);
      details.appendChild(panel);
      host.appendChild(details);
    }
  }

  function filterModules(modules, q) {
    if (!q) return modules;

    const ql = q.toLowerCase();
    const out = [];

    for (const s of modules) {
      const titleMatch = (s.titre || "").toLowerCase().includes(ql);
      if (titleMatch) {
        out.push(s);
        continue;
      }

      const seasons = [];
      for (const seas of s.seasons || []) {
        const seasonMatch = (seas.saison || "").toLowerCase().includes(ql);
        if (seasonMatch) {
          seasons.push(seas);
          continue;
        }

        const items = (seas.items || []).filter(it => (it.format || "").toLowerCase().includes(ql));
        if (items.length) seasons.push({ ...seas, items });
      }

      if (seasons.length) out.push({ ...s, seasons });
    }

    return out;
  }

  function searchSeries() {
    const q = (document.getElementById("searchInput")?.value || "").trim();
    render(filterModules(window.__SERIES_MODULES, q));
  }

  function init() {
    const rows = rowsFromFallback();
    window.__DATA_SOURCE = "js";

    window.__SERIES_MODULES = groupSeries(rows);
    render(window.__SERIES_MODULES);
    window.searchSeries = searchSeries;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
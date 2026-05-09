(function () {
  const CSV_URL = "assets/data/series.csv";
  const listEl = () => document.getElementById("seriesList");

  const FORMAT_PRIORITY = ["4K Ultra HD", "Blu-Ray", "DVD"];

  function detectDelimiter(line) {
    const candidates = [";", ",", "\t"];
    let best = ";";
    let bestCount = -1;
    for (const d of candidates) {
      const re = new RegExp(d === "\t" ? "\\t" : "\\" + d, "g");
      const c = (line.match(re) || []).length;
      if (c > bestCount) {
        bestCount = c;
        best = d;
      }
    }
    return best;
  }

  function parseLine(line, delim) {
    const out = [];
    let i = 0;
    let field = "";
    let inQuotes = false;

    while (i < line.length) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (ch === delim) {
        out.push(field.trim());
        field = "";
        i++;
        continue;
      }

      field += ch;
      i++;
    }

    out.push(field.trim());
    return out;
  }

  function normalizeHeader(h) {
    return (h || "").trim().toLowerCase();
  }

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

  function normalizeRow(r) {
    const id = (r.id || "").trim();
    const titre = (r.titre || "").trim();
    const saison = (r.saison || "").trim();
    const format = (r.format || "").trim();

    let lien = (r.lien || "").trim();
    if (!lien) lien = buildLink(r.dossier, r.fichier, r.extension);

    if (!id || !titre || !saison || !format || !lien) return null;
    return { id, titre, saison, format, lien };
  }

  function parseCSV(text) {
    const rows = [];
    const cleaned = text.replace(/^\uFEFF/, "");
    const lines = cleaned
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(l => l.trim() !== "");

    if (!lines.length) return rows;

    const delim = detectDelimiter(lines[0]);
    const header = parseLine(lines[0], delim).map(normalizeHeader);
    const hasHeader =
      header.includes("id") &&
      header.includes("titre") &&
      header.includes("saison") &&
      header.includes("format");

    const idx = {
      id: header.indexOf("id"),
      titre: header.indexOf("titre"),
      saison: header.indexOf("saison"),
      format: header.indexOf("format"),
      lien: header.indexOf("lien"),
      dossier: header.indexOf("dossier"),
      fichier: header.indexOf("fichier"),
      extension: header.indexOf("extension"),
    };

    const startAt = hasHeader ? 1 : 0;

    for (let li = startAt; li < lines.length; li++) {
      const cols = parseLine(lines[li], delim);
      const obj = {
        id: idx.id >= 0 ? cols[idx.id] : cols[0],
        titre: idx.titre >= 0 ? cols[idx.titre] : cols[1],
        saison: idx.saison >= 0 ? cols[idx.saison] : cols[2],
        format: idx.format >= 0 ? cols[idx.format] : cols[3],
        lien: idx.lien >= 0 ? cols[idx.lien] : "",
        dossier: idx.dossier >= 0 ? cols[idx.dossier] : "",
        fichier: idx.fichier >= 0 ? cols[idx.fichier] : "",
        extension: idx.extension >= 0 ? cols[idx.extension] : "",
      };

      const row = normalizeRow(obj);
      if (row) rows.push(row);
    }
    return rows;
  }

  async function loadFromCSV() {
    if (location.protocol === "file:") throw new Error("CSV blocked on file://");
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("CSV parsed empty");
    return rows;
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
      seas.items.push({ id: r.id, format: r.format, lien: r.lien });
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
      p.textContent =
        (location.protocol === "file:")
          ? "Aucune donnée chargée. En file://, exécute GENERER_FILMS_JS.bat après avoir modifié le CSV."
          : "Aucune série trouvée (vérifie assets/data/series.csv).";
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
          img.src = it.lien;
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

  async function init() {
    let rows = [];
    try {
      rows = await loadFromCSV();
    } catch (e) {
      rows = rowsFromFallback();
    }

    window.__SERIES_MODULES = groupSeries(rows);
    render(window.__SERIES_MODULES);
    window.searchSeries = searchSeries;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
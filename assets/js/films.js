(function () {
  const CSV_URL = "assets/data/films.csv";
  const listEl = () => document.getElementById("moviesList");

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

  // Normalize a "row" (one cover) from either schema
  function normalizeCoverRow(r) {
    const id = (r.id || "").trim();
    const titre = (r.titre || "").trim();
    const format = (r.format || "").trim();

    let lien = (r.lien || "").trim();
    if (!lien) lien = buildLink(r.dossier, r.fichier, r.extension);

    if (!id || !titre || !format || !lien) return null;
    return { id, titre, format, lien };
  }

  function parseCSV(text) {
    const rows = [];
    const cleaned = text.replace(/^\uFEFF/, ""); // BOM
    const lines = cleaned
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(l => l.trim() !== "");

    if (!lines.length) return rows;

    const delim = detectDelimiter(lines[0]);
    const header = parseLine(lines[0], delim).map(normalizeHeader);
    const hasHeader = header.includes("id") && header.includes("titre") && header.includes("format");

    const idx = {
      id: header.indexOf("id"),
      titre: header.indexOf("titre"),
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
        format: idx.format >= 0 ? cols[idx.format] : cols[2],
        lien: idx.lien >= 0 ? cols[idx.lien] : "",
        dossier: idx.dossier >= 0 ? cols[idx.dossier] : "",
        fichier: idx.fichier >= 0 ? cols[idx.fichier] : "",
        extension: idx.extension >= 0 ? cols[idx.extension] : "",
      };

      const row = normalizeCoverRow(obj);
      if (row) rows.push(row);
    }

    return rows;
  }

  async function loadFromCSV() {
    // On file://, fetch du CSV est souvent bloqué → fallback JS
    if (location.protocol === "file:") {
      throw new Error("CSV blocked on file://");
    }

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("CSV parsed empty");
    console.info("[films] CSV OK:", rows.length, "jaquettes");
    return rows;
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
          const row = normalizeCoverRow({ id: it.id, titre: m.titre, format: it.format, lien: it.lien });
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
      for (const it of m.items) rows.push({ id: it.id, titre: m.titre, format: it.format, lien: it.lien });
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
      m.items.push({ id: r.id, format: r.format, lien: r.lien });

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
      p.textContent =
        (location.protocol === "file:")
          ? "Aucune donnée chargée. En file://, exécute GENERER_FILMS_JS.bat après avoir modifié le CSV."
          : "Aucun film trouvé (vérifie assets/data/films.csv).";
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
        img.src = it.lien;
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

  async function init() {
    let coverRows = [];
    try {
      coverRows = await loadFromCSV();
      window.__DATA_SOURCE = "csv";
    } catch (e) {
      coverRows = loadFromFallback();
      window.__DATA_SOURCE = "fallback";
    }

    window.__MOVIES_MODULES = groupByTitle(coverRows);
    render(window.__MOVIES_MODULES);
    window.searchMovies = searchMovies;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
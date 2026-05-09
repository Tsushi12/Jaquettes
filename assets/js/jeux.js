(function () {
  const CSV_URL = "assets/data/jeux.csv";
  const listEl = () => document.getElementById("gamesList");

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
    const cleaned = text.replace(/^\uFEFF/, "");
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
    if (location.protocol === "file:") throw new Error("CSV blocked on file://");

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("CSV parsed empty");
    return rows;
  }

  function modulesToCovers(modules) {
    const rows = [];
    for (const m of modules) {
      for (const it of m.items) rows.push({ id: it.id, titre: m.titre, format: it.format, lien: it.lien });
    }
    return rows;
  }

  function loadFromFallback() {
    // Accept: array of modules OR single module object
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
    const map = new Map(); // titreKey -> module
    const coll = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

    for (const r of rows) {
      const titre = (r.titre || "").trim();
      const key = titre.toLowerCase();
      if (!map.has(key)) map.set(key, { titre, items: [], sortId: r.id });
      const m = map.get(key);
      if (!m.titre && titre) m.titre = titre;
      m.items.push({ id: r.id, format: r.format, lien: r.lien });

      if (coll.compare(r.id, m.sortId) < 0) m.sortId = r.id;
    }

    const modules = Array.from(map.values());

    // sort items: format then id
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
          : "Aucun jeu trouvé (vérifie assets/data/jeux.csv).";
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

  function searchGames() {
    const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const filtered = window.__GAMES_MODULES.filter(m => (m.titre || "").toLowerCase().includes(q));
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

    window.__GAMES_MODULES = groupByTitle(coverRows);
    render(window.__GAMES_MODULES);
    window.searchGames = searchGames;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
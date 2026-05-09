(function () {
  const CSV_URL = "assets/data/games.csv";
  const listEl = () => document.getElementById("gamesList");

  // Optionnel: ordre de priorité des plateformes/éditions (laisse vide si tu veux un tri alphabétique)
  const FORMAT_PRIORITY = [
    "PS5", "PS4", "PS3", "PS2",
    "Xbox Series", "Xbox One", "Xbox 360", "Xbox",
    "Nintendo Switch", "Wii U", "Wii",
    "PC"
  ];

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

  function isImageLink(link) {
    const l = (link || "").toLowerCase();
    return l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png") || l.endsWith(".webp");
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
    console.info("[jeux] CSV OK:", rows.length, "jaquettes");
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
    if (!Array.isArray(window.GAMES_DATA) || !window.GAMES_DATA.length) return [];

    // Support 2 fallback shapes:
    // A) cover rows: [{id,titre,format,lien...}, ...]
    // B) modules: [{titre, sortId, items:[{id,format,lien}...]}...]
    const first = window.GAMES_DATA[0];
    if (first && Array.isArray(first.items)) {
      return modulesToCovers(window.GAMES_DATA);
    }

    const rows = [];
    for (const r of window.GAMES_DATA) {
      const row = normalizeCoverRow(r);
      if (row) rows.push(row);
    }
    console.info("[jeux] fallback rows OK:", rows.length, "jaquettes");
    return rows;
  }

  function formatPriorityIndex(fmt) {
    if (!FORMAT_PRIORITY.length) return 999;
    const f = (fmt || "").toLowerCase();
    for (let i = 0; i < FORMAT_PRIORITY.length; i++) {
      const p = FORMAT_PRIORITY[i].toLowerCase();
      if (f === p || f.startsWith(p + " ") || f.startsWith(p + " -") || f.startsWith(p + "(")) return i;
    }
    return 999;
  }

  function naturalIdKey(s) {
    const m = String(s || "").trim().match(/^([A-Za-z]*)(\d+)?(.*)$/);
    if (!m) return ["", 0, ""];
    return [m[1].toLowerCase(), m[2] ? parseInt(m[2], 10) : 0, m[3].toLowerCase()];
  }

  function groupByTitle(rows) {
    const map = new Map(); // titreKey -> module
    for (const r of rows) {
      const titre = (r.titre || "").trim();
      const key = titre.toLowerCase();
      if (!map.has(key)) map.set(key, { titre, items: [], sortId: r.id });
      const m = map.get(key);
      if (!m.titre && titre) m.titre = titre;
      m.items.push({ id: r.id, format: r.format, lien: r.lien });

      // Keep smallest id as sortId
      if (naturalIdKey(r.id).join("|") < naturalIdKey(m.sortId).join("|")) m.sortId = r.id;
    }

    const modules = Array.from(map.values());

    for (const m of modules) {
      m.items.sort((a, b) => {
        const pa = formatPriorityIndex(a.format);
        const pb = formatPriorityIndex(b.format);
        if (pa !== pb) return pa - pb;

        const ka = naturalIdKey(a.id);
        const kb = naturalIdKey(b.id);
        const c1 = ka[0].localeCompare(kb[0], "fr");
        if (c1 !== 0) return c1;
        if (ka[1] !== kb[1]) return ka[1] - kb[1];
        const c2 = ka[2].localeCompare(kb[2], "fr");
        if (c2 !== 0) return c2;

        return (a.format || "").localeCompare(b.format || "", "fr");
      });
    }

    modules.sort((a, b) => {
      const ka = naturalIdKey(a.sortId);
      const kb = naturalIdKey(b.sortId);
      const c1 = ka[0].localeCompare(kb[0], "fr");
      if (c1 !== 0) return c1;
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2].localeCompare(kb[2], "fr");
    });

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
          ? "Aucune donnée chargée. En file://, exécute GENERER_FILMS_JS.bat après avoir modifié le CSV des jeux."
          : "Aucun jeu trouvé (vérifie assets/data/games.csv).";
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
      title.textContent = m.titre;

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

        if (isImageLink(it.lien)) {
          const img = document.createElement("img");
          img.src = it.lien;
          img.alt = m.titre + " - " + it.format;
          img.loading = "lazy";
          a.appendChild(img);
        } else {
          const ph = document.createElement("div");
          ph.className = "cover-placeholder";
          ph.textContent = "Fichier";
          a.appendChild(ph);
        }

        const meta = document.createElement("div");
        meta.className = "cover-meta";

        const fmt = document.createElement("div");
        fmt.className = "cover-format";
        fmt.textContent = it.format;

        meta.appendChild(fmt);

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
    const filtered = window.__GAMES_MODULES.filter(m => {
      const titleMatch = (m.titre || "").toLowerCase().includes(q);
      const anyFormat = (m.items || []).some(it => (it.format || "").toLowerCase().includes(q));
      return titleMatch || anyFormat;
    });
    render(filtered);
  }

  async function init() {
    let coverRows = [];
    try {
      coverRows = await loadFromCSV();
      window.__DATA_SOURCE_GAMES = "csv";
    } catch (e) {
      coverRows = loadFromFallback();
      window.__DATA_SOURCE_GAMES = "fallback";
    }

    window.__GAMES_MODULES = groupByTitle(coverRows);
    render(window.__GAMES_MODULES);
    window.searchGames = searchGames;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
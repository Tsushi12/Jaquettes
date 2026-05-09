// Sidebar HTML fallback (works even when opened via file://)
const SIDEBAR_FALLBACK_HTML = `<div class="sidebar" id="site-sidebar">
  <ul class="sidebar-menu">
    <li class="brand">
      <a href="index.html" data-nav="index" class="brand-link">
        <span class="brand-mark" aria-hidden="true">J</span>
        <span class="brand-copy">
          <span class="brand-title">Jaquettes</span>
          <span class="brand-sub">Bibliothèque</span>
        </span>
      </a>
    </li>

    <li class="nav-section-label">Navigation</li>
    <li><a href="films.html" data-nav="films"><span class="nav-icon" aria-hidden="true">🎬</span><span>Films</span></a></li>
    <li><a href="series.html" data-nav="series"><span class="nav-icon" aria-hidden="true">📺</span><span>Séries</span></a></li>
    <li><a href="jeux.html" data-nav="jeux"><span class="nav-icon" aria-hidden="true">🎮</span><span>Jeux Vidéo</span></a></li>

    <li><a href="https://www.themoviedb.org/?language=fr" target="_blank" rel="noopener noreferrer" class="no-bg utility-link"><img src="front_pic/tmdb.png" alt="TMDB Logo"><span>TMDb</span></a></li>
    <li><a href="https://github.com/Tsushi12" target="_blank" rel="noopener noreferrer" class="no-bg utility-link"><img src="front_pic/github.png" alt="GitHub Logo"><span>GitHub</span></a></li>
    <li><a href="https://www.linkedin.com/in/driss-el-bouffi-25a394316" target="_blank" rel="noopener noreferrer" class="no-bg utility-link"><img src="front_pic/linkedin.png" alt="LinkedIn Logo"><span>LinkedIn</span></a></li>
    <li><a href="https://elbdweb.github.io/El_Bouffi/" target="_blank" rel="noopener noreferrer" class="no-bg utility-link"><img src="front_pic/portfolio.png" alt="Portfolio Logo"><span>Mon portfolio</span></a></li>
  </ul>
</div>`;

async function getSidebarHtml() {
  try {
    const res = await fetch("partials/sidebar.html", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } catch (e) {
    return SIDEBAR_FALLBACK_HTML;
  }
}

function applyActiveLink(root) {
  const page = document.body.dataset.page;
  if (!page) return;
  const a = root.querySelector(`a[data-nav="${page}"]`);
  if (a) a.classList.add("active");
}

function applyBackground() {
  const page = (document.body.dataset.page || "").toLowerCase();

  const gradients = {
    index:
      "radial-gradient(circle at 15% 10%, rgba(212,175,55,0.22) 0%, rgba(26,11,11,0.00) 42%)," +
      "radial-gradient(circle at 90% 25%, rgba(177,58,44,0.20) 0%, rgba(26,11,11,0.00) 48%)," +
      "linear-gradient(135deg, #1a0b0b 0%, #0f0707 55%, #1d0b0b 100%)",

    films:
      "radial-gradient(circle at 20% 12%, rgba(212,175,55,0.18) 0%, rgba(15,7,7,0.00) 45%)," +
      "radial-gradient(circle at 85% 18%, rgba(177,58,44,0.18) 0%, rgba(15,7,7,0.00) 46%)," +
      "linear-gradient(135deg, #120707 0%, #0b0707 55%, #1a0b0b 100%)",

    series:
      "radial-gradient(circle at 18% 12%, rgba(212,175,55,0.18) 0%, rgba(15,7,7,0.00) 45%)," +
      "radial-gradient(circle at 82% 22%, rgba(177,58,44,0.18) 0%, rgba(15,7,7,0.00) 46%)," +
      "linear-gradient(135deg, #120707 0%, #0b0707 55%, #1a0b0b 100%)",

    jeux:
      "radial-gradient(circle at 18% 14%, rgba(212,175,55,0.16) 0%, rgba(12,8,8,0.00) 46%)," +
      "radial-gradient(circle at 88% 30%, rgba(177,58,44,0.16) 0%, rgba(12,8,8,0.00) 48%)," +
      "linear-gradient(135deg, #130808 0%, #0b0707 55%, #1a0b0b 100%)",

    default:
      "radial-gradient(circle at 20% 10%, rgba(212,175,55,0.16) 0%, rgba(26,11,11,0.00) 44%)," +
      "radial-gradient(circle at 90% 20%, rgba(177,58,44,0.14) 0%, rgba(26,11,11,0.00) 48%)," +
      "linear-gradient(135deg, #1a0b0b 0%, #0f0707 55%, #1d0b0b 100%)"
  };

  document.body.style.backgroundImage = gradients[page] || gradients.default;
}


function setupMobileSidebar(host) {
  const sidebar = host.querySelector(".sidebar");
  if (!sidebar) return;

  if (document.querySelector(".mobile-nav-toggle")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-nav-toggle";
  toggle.setAttribute("aria-controls", sidebar.id || "site-sidebar");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `<span aria-hidden="true">☰</span><span>Menu</span>`;

  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  backdrop.hidden = true;

  document.body.insertBefore(toggle, document.body.firstChild);
  document.body.insertBefore(backdrop, document.body.firstChild);

  function closeMenu() {
    document.body.classList.remove("sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  }

  function openMenu() {
    document.body.classList.add("sidebar-open");
    toggle.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
  }

  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("sidebar-open")) closeMenu();
    else openMenu();
  });

  backdrop.addEventListener("click", closeMenu);

  host.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link && window.matchMedia("(max-width: 700px)").matches) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 700px)").matches) closeMenu();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  applyBackground();

  const host = document.getElementById("sidebar-host");
  if (!host) return;

  host.innerHTML = await getSidebarHtml();
  applyActiveLink(host);
  setupMobileSidebar(host);
});

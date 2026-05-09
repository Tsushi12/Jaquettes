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



function normalizeHtmlForCompare(html) {
  return String(html || "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

function getViewportWidth() {
  return Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
}

function getDeviceScreenWidth() {
  return Math.round(Math.min(
    screen.width || window.innerWidth || 0,
    screen.height || window.innerHeight || 0
  ));
}

function isTouchDevice() {
  return (
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function isPhoneDevice() {
  const screenWidth = getDeviceScreenWidth();
  return isTouchDevice() && screenWidth > 0 && screenWidth <= 600;
}

function looksLikeForcedDesktopMode() {
  const screenWidth = getDeviceScreenWidth();
  const viewportWidth = getViewportWidth();

  if (!isPhoneDevice() || !screenWidth || !viewportWidth) return false;

  return viewportWidth >= 760 && viewportWidth >= screenWidth * 1.6;
}

function shouldUseMobileLayout() {
  if (looksLikeForcedDesktopMode()) return false;

  const viewportWidth = getViewportWidth();
  const screenAvailableWidth = screen.availWidth || screen.width || 0;
  const browserWidth = window.outerWidth || viewportWidth;
  const isNarrowViewport = viewportWidth > 0 && viewportWidth <= 1100;
  const isHalfScreenOrLess = screenAvailableWidth > 0 && browserWidth <= screenAvailableWidth * 0.52;

  if (isPhoneDevice()) return true;

  return isNarrowViewport || isHalfScreenOrLess;
}

function applyResponsiveMode() {
  document.body.classList.toggle("mobile-layout", shouldUseMobileLayout());

  if (!document.body.classList.contains("mobile-layout")) {
    document.body.classList.remove("sidebar-open");
    const toggle = document.querySelector(".mobile-nav-toggle");
    const backdrop = document.querySelector(".sidebar-backdrop");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
  }
}

function setupMobileSidebar(host) {
  const sidebar = host.querySelector(".sidebar");
  if (!sidebar) return;

  if (!sidebar.id) sidebar.id = "site-sidebar";

  let toggle = document.querySelector(".mobile-nav-toggle");
  let backdrop = document.querySelector(".sidebar-backdrop");

  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mobile-nav-toggle";
    toggle.setAttribute("aria-controls", sidebar.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span aria-hidden="true">☰</span><span>Menu</span>`;
    document.body.insertBefore(toggle, document.body.firstChild);
  }

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    backdrop.hidden = true;
    document.body.insertBefore(backdrop, document.body.firstChild);
  }

  if (document.body.dataset.sidebarReady === "true") {
    applyResponsiveMode();
    return;
  }
  document.body.dataset.sidebarReady = "true";

  function closeMenu() {
    document.body.classList.remove("sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  }

  function openMenu() {
    if (!document.body.classList.contains("mobile-layout")) return;
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
    if (link && document.body.classList.contains("mobile-layout")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const refreshResponsiveMode = () => applyResponsiveMode();
  window.addEventListener("resize", refreshResponsiveMode);
  window.addEventListener("orientationchange", refreshResponsiveMode);
  window.visualViewport?.addEventListener("resize", refreshResponsiveMode);

  applyResponsiveMode();
}

function initLayout() {
  applyBackground();

  const host = document.getElementById("sidebar-host");
  if (!host) return;

  if (!host.querySelector(".sidebar")) {
    host.innerHTML = SIDEBAR_FALLBACK_HTML;
  }

  applyActiveLink(host);
  setupMobileSidebar(host);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLayout);
} else {
  initLayout();
}

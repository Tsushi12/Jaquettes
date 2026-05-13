// Sidebar HTML fallback (works even when opened via file://)
const SIDEBAR_FALLBACK_HTML = `<div class="sidebar" id="site-sidebar">
  <ul class="sidebar-menu">
    <li class="brand">
      <a href="index.html" data-nav="index" class="brand-link">
        <span class="brand-mark" aria-hidden="true">
          <img src="front_pic/favicon.svg" alt="">
        </span>
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
    <li><a href="https://www.cinemapassion.com/jaquette-blu-ray-1-9.php" target="_blank" rel="noopener noreferrer" class="no-bg utility-link"><img src="front_pic/cinemapassion.png" alt="Cinéma Passion Logo"><span>Cinéma Passion</span></a></li>
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
      "radial-gradient(circle at 14% 10%, rgba(242,242,242,0.20) 0%, rgba(18,18,18,0.00) 44%)," +
      "radial-gradient(circle at 88% 24%, rgba(176,176,176,0.16) 0%, rgba(18,18,18,0.00) 50%)," +
      "linear-gradient(135deg, #2a2a2a 0%, #101010 56%, #d9d9d9 100%)",

    films:
      "radial-gradient(circle at 18% 12%, rgba(142,104,70,0.22) 0%, rgba(22,19,17,0.00) 46%)," +
      "radial-gradient(circle at 86% 22%, rgba(105,82,65,0.18) 0%, rgba(22,19,17,0.00) 50%)," +
      "linear-gradient(140deg, #1f1915 0%, #141313 58%, #282019 100%)",

    series:
      "radial-gradient(circle at 16% 12%, rgba(78,121,142,0.22) 0%, rgba(18,22,25,0.00) 46%)," +
      "radial-gradient(circle at 84% 24%, rgba(69,86,112,0.18) 0%, rgba(18,22,25,0.00) 50%)," +
      "linear-gradient(138deg, #151d22 0%, #111416 57%, #1d242a 100%)",

    jeux:
      "radial-gradient(circle at 17% 13%, rgba(132,50,86,0.24) 0%, rgba(20,13,18,0.00) 46%)," +
      "radial-gradient(circle at 86% 26%, rgba(95,50,104,0.20) 0%, rgba(20,13,18,0.00) 50%)," +
      "linear-gradient(140deg, #24131b 0%, #141014 58%, #2a1724 100%)",

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

function getVisualViewportWidth() {
  return Math.round(window.visualViewport?.width || 0);
}

function getLayoutViewportWidth() {
  return Math.round(Math.max(
    window.innerWidth || 0,
    document.documentElement?.clientWidth || 0,
    document.body?.clientWidth || 0
  ));
}

function getViewportWidth() {
  return getLayoutViewportWidth() || getVisualViewportWidth();
}

function isTouchDevice() {
  return (
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function getScreenShortSide() {
  const w = screen.width || 0;
  const h = screen.height || 0;
  return Math.min(w || h, h || w);
}

function isPhoneBrowser() {
  const ua = navigator.userAgent || "";
  const phoneUa = /iPhone|iPod|Android.*Mobile|Windows Phone|Mobile/i.test(ua);
  const screenShortSide = getScreenShortSide();

  return isTouchDevice() && (phoneUa || (screenShortSide > 0 && screenShortSide <= 600));
}

const PHONE_LAYOUT_SESSION_KEY = "jaquettesPhoneLayoutMode";
const DESKTOP_PHONE_VIEWPORT = "width=device-width, initial-scale=0.24, minimum-scale=0.24, maximum-scale=5.0, viewport-fit=cover";
const MOBILE_PHONE_VIEWPORT = "width=device-width, initial-scale=0.74, minimum-scale=0.74, maximum-scale=5.0, viewport-fit=cover";

let stablePhoneLayoutMode = null;

function readStoredPhoneLayoutMode() {
  try {
    const value = sessionStorage.getItem(PHONE_LAYOUT_SESSION_KEY);
    return value === "desktop" || value === "mobile" ? value : null;
  } catch (e) {
    return null;
  }
}

function storePhoneLayoutMode(mode) {
  if (mode !== "desktop" && mode !== "mobile") return;
  try {
    sessionStorage.setItem(PHONE_LAYOUT_SESSION_KEY, mode);
  } catch (e) {
    /* sessionStorage can be unavailable in some private contexts. */
  }
}

function detectForcedDesktopModeOnPhone() {
  if (!isPhoneBrowser()) return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const screenShortSide = getScreenShortSide();
  const visualViewportWidth = getVisualViewportWidth();
  const layoutViewportWidth = getLayoutViewportWidth();
  const widestViewport = Math.max(visualViewportWidth, layoutViewportWidth);

  if (!screenShortSide || !widestViewport) return false;

  const desktopSizedLayoutViewport =
    layoutViewportWidth >= 900 ||
    layoutViewportWidth >= screenShortSide * 1.7;

  const desktopSizedAnyViewport = widestViewport >= 900;

  const desktopUserAgentOnPhoneScreen =
    screenShortSide <= 600 &&
    !/iPhone|iPod|Android.*Mobile|Windows Phone|Mobile/i.test(ua) &&
    (/Macintosh|Mac OS X|Windows NT|X11|Linux x86_64/i.test(ua) || platform === "MacIntel");

  return desktopSizedLayoutViewport || desktopSizedAnyViewport || desktopUserAgentOnPhoneScreen;
}

function getStablePhoneLayoutMode() {
  if (!isPhoneBrowser()) return null;

  if (!stablePhoneLayoutMode) {
    stablePhoneLayoutMode = detectForcedDesktopModeOnPhone() ? "desktop" : "mobile";
    storePhoneLayoutMode(stablePhoneLayoutMode);
  }

  return stablePhoneLayoutMode;
}

function ensureViewportMeta() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  return meta;
}

function applyPhoneViewportMode() {
  const phoneLayoutMode = getStablePhoneLayoutMode();
  if (!phoneLayoutMode) return;

  const meta = ensureViewportMeta();
  const nextContent = phoneLayoutMode === "desktop" ? DESKTOP_PHONE_VIEWPORT : MOBILE_PHONE_VIEWPORT;

  if (meta.getAttribute("content") !== nextContent) {
    meta.setAttribute("content", nextContent);
  }
}

function looksLikeForcedDesktopMode() {
  return getStablePhoneLayoutMode() === "desktop";
}

function shouldUseMobileLayout() {
  const phoneLayoutMode = getStablePhoneLayoutMode();

  if (phoneLayoutMode === "desktop") return false;
  if (phoneLayoutMode === "mobile") return true;

  const viewportWidth = getViewportWidth();
  const screenAvailableWidth = screen.availWidth || screen.width || 0;
  const browserWidth = window.outerWidth || viewportWidth;
  const isNarrowViewport = viewportWidth > 0 && viewportWidth <= 1100;
  const isHalfScreenOrLess = screenAvailableWidth > 0 && browserWidth <= screenAvailableWidth * 0.52;

  return isNarrowViewport || isHalfScreenOrLess;
}

function applyResponsiveMode() {
  applyPhoneViewportMode();
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
    if (!link) return;

    const href = link.getAttribute("href") || "";
    const isInternalPageLink = /^(index|films|series|jeux)\.html(?:[?#].*)?$/i.test(href);

    if (isInternalPageLink) {
      const phoneLayoutMode = getStablePhoneLayoutMode();
      if (phoneLayoutMode) storePhoneLayoutMode(phoneLayoutMode);
    }

    if (document.body.classList.contains("mobile-layout")) closeMenu();
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
  applyPhoneViewportMode();
  applyBackground();

  const host = document.getElementById("sidebar-host");
  if (!host) return;

  if (!host.querySelector(".sidebar")) {
    host.innerHTML = SIDEBAR_FALLBACK_HTML;
  }

  applyActiveLink(host);
  setupMobileSidebar(host);
}

applyPhoneViewportMode();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLayout);
} else {
  initLayout();
}

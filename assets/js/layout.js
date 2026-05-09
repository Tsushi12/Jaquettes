// Sidebar HTML fallback (works even when opened via file://)
const SIDEBAR_FALLBACK_HTML = `<div class="sidebar">
  <ul>
    <li class="brand"><a href="index.html" data-nav="index"><span class="brand-title">Jaquettes</span><span class="brand-sub">Bibliothèque</span></a></li>
    <li><a href="films.html" data-nav="films">Films</a></li>
    <li><a href="series.html" data-nav="series">Séries</a></li>
    <li><a href="jeux.html" data-nav="jeux">Jeux Vidéo</a></li>

    <li><a href="https://www.themoviedb.org/?language=fr" target="_blank" rel="noopener noreferrer" class="no-bg"><img src="FrontPic/tmdb.png" alt="TMDB Logo"> TMDb</a></li>
    <li><a href="https://github.com/Tsushi12" target="_blank" rel="noopener noreferrer" class="no-bg"><img src="FrontPic/github.png" alt="GitHub Logo"> GitHub</a></li>
    <li><a href="https://www.linkedin.com/in/driss-el-bouffi-25a394316" target="_blank" rel="noopener noreferrer" class="no-bg"><img src="FrontPic/linkedin.png" alt="LinkedIn Logo"> LinkedIn</a></li>
    <li><a href="https://elbdweb.github.io/El_Bouffi/" target="_blank" rel="noopener noreferrer" class="no-bg"><img src="FrontPic/portfolio.png" alt="Portfolio Logo"> Mon portfolio</a></li>
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

document.addEventListener("DOMContentLoaded", async () => {
  applyBackground();

  const host = document.getElementById("sidebar-host");
  if (!host) return;

  host.innerHTML = await getSidebarHtml();
  applyActiveLink(host);
});

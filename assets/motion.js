// Animações de rolagem, imagens e feedbacks. Não depende de nenhum outro script
// e não altera cart.js / menu.js / firebase.js: só observa o DOM.
(function () {
  const REVEAL = [
    ".section-head",
    ".section .wrap > .eyebrow",
    ".section .wrap > h2",
    ".card",
    ".prose > *",
    ".split > div > .eyebrow",
    ".split > div > h2",
    ".field",
    ".summary",
    ".empty-state",
    "footer .footer-inner",
  ].join(",");

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("is-in");
                io.unobserve(e.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
        )
      : null;

  function scan() {
    // 1) elementos que entram com reveal (inclui os criados depois via JS)
    const fresh = [...document.querySelectorAll(REVEAL)].filter((el) => !el.classList.contains("reveal"));
    const perParent = new Map();
    fresh.forEach((el) => {
      const i = perParent.get(el.parentNode) || 0;
      perParent.set(el.parentNode, i + 1);
      el.style.setProperty("--d", (i % 4) * 80 + "ms");
      el.classList.add("reveal");
      if (io) io.observe(el);
      else el.classList.add("is-in");
    });

    // 2) imagens que já carregaram antes do listener existir
    document.querySelectorAll("img:not(.is-loaded)").forEach((img) => {
      if (img.complete && img.naturalWidth > 0) img.classList.add("is-loaded");
    });
  }

  // Fade das imagens (load/error não "borbulham", então usamos captura)
  const markLoaded = (e) => {
    if (e.target.tagName === "IMG") e.target.classList.add("is-loaded");
  };
  document.addEventListener("load", markLoaded, true);
  document.addEventListener("error", markLoaded, true);

  // Header ganha sombra ao rolar
  const header = document.getElementById("site-header");
  const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Feedbacks: botão "Adicionado ✓" e badge do carrinho
  let ready = false;
  setTimeout(() => (ready = true), 800);

  function flash(btn) {
    if (btn.classList.contains("is-added")) return;
    btn.classList.add("is-added");
    setTimeout(() => btn.classList.remove("is-added"), 1300);
  }

  function checkBadge(badge) {
    const txt = badge.textContent;
    if (badge.dataset.prev === txt) return;
    const first = badge.dataset.prev === undefined;
    badge.dataset.prev = txt;
    if (first || !ready) return;
    badge.classList.remove("bump");
    void badge.offsetWidth; // reinicia a animação
    badge.classList.add("bump");
    badge.addEventListener("animationend", () => badge.classList.remove("bump"), { once: true });
  }

  let queued = false;
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el || !el.closest) continue;
      const btn = el.closest(".card .btn");
      if (btn && btn.textContent.includes("✓")) flash(btn);
      const badge = el.closest("[data-cart-count]");
      if (badge) checkBadge(badge);
    }
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    }
  });

  scan();
  document.querySelectorAll("[data-cart-count]").forEach(checkBadge);
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
})();

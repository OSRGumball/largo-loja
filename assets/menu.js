// Injeta o header (logo + navegação + carrinho) em qualquer página que tenha
// um <div id="site-header"></div>. Assim o menu é editado em um único lugar.
(function () {
  const currentPage = location.pathname.split("/").pop() || "index.html";

  const links = [
    { href: "index.html", label: "Início" },
    { href: "produtos.html", label: "Produtos" },
    { href: "sobre.html", label: "Sobre" },
    { href: "contato.html", label: "Contato" },
  ];

  // Nota: conta.html não entra em `links` (nav principal) porque já tem
  // seu próprio atalho em .account-link no cabeçalho — evita duplicidade.

  const navLinksHTML = links
    .map(
      (l) =>
        `<a href="${l.href}" class="nav-link${l.href === currentPage ? " is-active" : ""}">${l.label}</a>`
    )
    .join("");

  const headerHTML = `
    <div class="header-inner">
      <a href="index.html" class="logo">LARGO</a>

      <nav class="nav-desktop" aria-label="Navegação principal">
        ${navLinksHTML}
      </nav>

      <div class="header-actions">
        <a href="conta.html" class="account-link" id="accountLink">Entrar</a>
        <a href="checkout.html" class="cart-link" aria-label="Ver carrinho">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="10" cy="21" r="1"/>
            <circle cx="18" cy="21" r="1"/>
          </svg>
          <span class="cart-badge" data-cart-count>0</span>
        </a>
        <button class="hamburger" id="hamburgerBtn" aria-label="Abrir menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>

    <nav class="nav-mobile" id="navMobile" aria-label="Navegação móvel">
      ${navLinksHTML}
      <a href="conta.html" id="accountLinkMobile">Entrar</a>
    </nav>
  `;

  const headerEl = document.getElementById("site-header");
  if (headerEl) {
    headerEl.innerHTML = headerHTML;

    const btn = document.getElementById("hamburgerBtn");
    const nav = document.getElementById("navMobile");
    btn.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      btn.classList.toggle("is-open", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        btn.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      })
    );

    // Reflete o estado de login (definido em assets/firebase.js, que é
    // um módulo carregado à parte — por isso escutamos este evento em vez
    // de ler window.largoCurrentUser diretamente aqui).
    const updateAccountLinks = (user) => {
      const label = user ? user.displayName || user.email.split("@")[0] : "Entrar";
      document.getElementById("accountLink").textContent = label;
      document.getElementById("accountLinkMobile").textContent = label;
    };

    document.addEventListener("largo-auth-changed", (e) => updateAccountLinks(e.detail.user));
    if (window.largoCurrentUser !== undefined) {
      updateAccountLinks(window.largoCurrentUser);
    }
  }
})();

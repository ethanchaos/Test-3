// ============================================================
// CHAOS CONFIGURATIONS — Shared Navigation & Utilities
// flat file structure — all pages at same level
// ============================================================

const CONFIGHUB_URL = 'https://vpnconfighub.netlify.app/';

const NAV_LINKS = [
  { label: "Home",       href: "blog-home.html" },
  { label: "About",      href: "blog-about.html" },
  { label: "VPN Basics", href: "blog-vpn-basics.html" },
  { label: "SNI",        href: "blog-sni-explained.html" },
  { label: "Freenet",    href: "blog-freenet.html" },
  { label: "Config Hub", href: CONFIGHUB_URL, external: true },
  { label: "Guides",     href: "blog-setup-guides.html" },
  { label: "Tools",      href: "blog-tools.html" },
  { label: "Blog",       href: "blog-articles.html" },
];

const FOOTER_LINKS = {
  "Ethan Chaos": [
    { label: "About Ethan Chaos",   href: "blog-about.html" },
    { label: "Mr. Ethan Chaos",     href: "blog-mr-ethan-chaos.html" },
    { label: "Research Profile",    href: "blog-ethan-researcher.html" },
    { label: "Vision & Mission",    href: "blog-ethan-vision.html" },
    { label: "Chaos Corb",          href: "blog-chaos-corb.html" },
  ],
  "Network Tech": [
    { label: "VPN Basics",              href: "blog-vpn-basics.html" },
    { label: "VPN Tunneling Deep Dive", href: "blog-vpn-tunneling.html" },
    { label: "How SNI Works",           href: "blog-sni-explained.html" },
    { label: "SNI Filtering",           href: "blog-sni-filtering.html" },
    { label: "Free vs Paid VPNs",       href: "blog-free-vs-paid.html" },
    { label: "VPS & Hosting",           href: "blog-vps-hosting.html" },
  ],
  "Free Net": [
    { label: "Freenet Explained",       href: "blog-freenet.html" },
    { label: "Discovery of Free Net",   href: "blog-freenet-history.html" },
    { label: "Zero-Rated Sites",        href: "blog-zero-rated.html" },
    { label: "Network Restrictions",    href: "blog-network-restrictions.html" },
    { label: "Digital Access",          href: "blog-digital-access.html" },
  ],
  "Tools & Hub": [
    { label: "Config Hub",     href: CONFIGHUB_URL, external: true },
    { label: "Setup Guides",   href: "blog-setup-guides.html" },
    { label: "Tools",          href: "blog-tools.html" },
    { label: "Blog",           href: "blog-articles.html" },
    { label: "Community",      href: "blog-contact.html" },
  ],
};

// ---- BUILD NAV ----
function buildNav(activePage) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  nav.innerHTML = `
    <a class="nav-logo" href="blog-home.html">
      <div class="nav-logo-icon">C</div>
      Chaos<span>Config</span>
    </a>
    <ul class="nav-links">
      ${NAV_LINKS.map(l => {
        const active = l.label === activePage ? ' active' : '';
        const target = l.external ? ' target="_blank" rel="noopener"' : '';
        return `<li><a href="${l.href}"${target} class="${active}">${l.label}</a></li>`;
      }).join('')}
      <li><a href="blog-contact.html" class="nav-cta${activePage === 'Contact' ? ' active' : ''}">Community</a></li>
    </ul>
    <div class="hamburger" onclick="toggleMobile()" id="hamburger">
      <span></span><span></span><span></span>
    </div>
  `;

  const mm = document.getElementById('mobile-menu');
  if (mm) {
    mm.innerHTML = NAV_LINKS.map(l => {
      const target = l.external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${l.href}"${target}>${l.label}</a>`;
    }).join('') + `<a href="blog-contact.html">Community</a>`;
  }
}

// ---- BUILD FOOTER ----
function buildFooter() {
  const footer = document.getElementById('main-footer');
  if (!footer) return;

  const cols = Object.entries(FOOTER_LINKS).map(([title, links]) => `
    <div class="footer-col">
      <h5>${title}</h5>
      <ul>
        ${links.map(l => {
          const target = l.external ? ' target="_blank" rel="noopener"' : '';
          return `<li><a href="${l.href}"${target}>${l.label}</a></li>`;
        }).join('')}
      </ul>
    </div>
  `).join('');

  footer.innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="nav-logo" href="blog-home.html">
          <div class="nav-logo-icon">C</div>
          Chaos<span style="color:var(--accent)">Config</span>
        </a>
        <p style="margin-top:12px">Built by <strong style="color:var(--text-dark)">Ethan Chaos</strong> — developer, network researcher, and builder behind <a href="${CONFIGHUB_URL}" target="_blank" style="color:var(--accent)">VPN Config Hub</a> and Chaos Configurations. Real knowledge. Real configs. Real understanding.</p>
      </div>
      ${cols}
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Chaos Configurations · Ethan Chaos. All rights reserved.</span>
      <span>
        <a href="blog-about.html">About</a> ·
        <a href="blog-contact.html">Contact</a> ·
        <a href="${CONFIGHUB_URL}" target="_blank">Config Hub ↗</a>
      </span>
    </div>
  `;
}

function toggleMobile() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
});

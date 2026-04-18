/* ============================================================
   ConfigHub — main.js
   Loads links.json + cards.json, builds all dynamic UI,
   then fetches live metadata from GitHub.
   ============================================================ */

/* ── Boot MainActivty (addon/plugin controller) ── */
const _maScript = document.createElement('script');
_maScript.src = 'mainactivity.js';
document.head.appendChild(_maScript);


const METADATA_URL =
  'https://raw.githubusercontent.com/ethanchaos/Test-3/main/metadata.json';

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [linksData, cardsData] = await Promise.all([
      fetchJSON('links.json'),
      fetchJSON('cards.json'),
    ]);

    buildNavDropdown(linksData.navDropdown);
    buildBottomNav(linksData.bottomNav);
    buildCards(cardsData);
    initNavToggle();
    initBottomNavActive();
    initScrollAnimation();
    fetchMetadata();
  } catch (err) {
    console.error('ConfigHub boot error:', err);
  }
});

/* ── Generic JSON fetcher ── */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

/* ── Build header dropdown from links.json ── */
function buildNavDropdown(items) {
  const menu = document.getElementById('dropdownMenu');
  if (!menu) return;
  menu.innerHTML = items
    .map(
      (link) => `
      <a href="${link.href}" ${link.external ? 'target="_blank"' : ''}>
        <i class="${link.icon}"></i> ${link.label}
      </a>`
    )
    .join('');
}

/* ── Build bottom nav from links.json ── */
function buildBottomNav(items) {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  nav.innerHTML = items
    .map((item) => {
      if (item.type === 'fab') {
        return `
          <a href="${item.href}" class="bottom-nav-item bottom-nav-upload" data-nav="${item.id}">
            <div class="upload-fab"><i class="${item.icon}"></i></div>
            <span>${item.label}</span>
          </a>`;
      }
      return `
        <a href="${item.href}" ${item.external ? 'target="_blank"' : ''}
           class="bottom-nav-item${item.active ? ' active' : ''}" data-nav="${item.id}">
          <div class="nav-icon-wrap"><i class="${item.icon}"></i></div>
          <span>${item.label}</span>
        </a>`;
    })
    .join('');
}

/* ── Build VPN cards from cards.json (only show:true entries) ── */
function buildCards(cards) {
  const grid = document.getElementById('modsGrid');
  if (!grid) return;

  const visible = cards.filter((c) => c.show);

  if (visible.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="fas fa-box-open"></i>
        <h3>No VPNs Available</h3>
        <p>All VPNs are currently disabled. Check back later.</p>
      </div>`;
    return;
  }

  grid.innerHTML = visible
    .map(
      (card) => `
      <a href="${card.page}" class="mod-item" data-id="${card.id}">
        <div class="status-light ${card.status}"></div>
        <img src="${card.image}" alt="${card.name}"
             onerror="this.src='${card.fallbackImage}'">
        <p class="mod-name">${card.name}</p>
        <div class="mod-meta">
          <span class="last-updated">Updated: --</span><br>
          <span class="config-count">-- Configs Available</span>
        </div>
      </a>`
    )
    .join('');
}

/* ── Hamburger toggle ── */
function initNavToggle() {
  const navToggle    = document.getElementById('navToggle');
  const dropdownMenu = document.getElementById('dropdownMenu');
  if (!navToggle || !dropdownMenu) return;

  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    navToggle.classList.toggle('active');
    dropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.nav-container') &&
      !e.target.closest('.dropdown-menu')
    ) {
      navToggle.classList.remove('active');
      dropdownMenu.classList.remove('active');
    }
  });

  dropdownMenu.addEventListener('click', () => {
    navToggle.classList.remove('active');
    dropdownMenu.classList.remove('active');
  });
}

/* ── Bottom nav active state ── */
function initBottomNavActive() {
  const items = document.querySelectorAll(
    '.bottom-nav-item:not(.bottom-nav-upload)'
  );
  items.forEach((item) => {
    item.addEventListener('click', function () {
      items.forEach((i) => i.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/* ── Card scroll animation ── */
function initScrollAnimation() {
  const cards = document.querySelectorAll('.mod-item');
  cards.forEach((box) => {
    box.style.opacity   = '0';
    box.style.transform = 'translateY(10px)';
    box.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  });

  function animate() {
    document.querySelectorAll('.mod-item').forEach((box, i) => {
      if (box.getBoundingClientRect().top < window.innerHeight / 0.8) {
        setTimeout(() => {
          box.style.opacity   = '1';
          box.style.transform = 'translateY(0)';
        }, 70 * i);
      }
    });
  }

  window.addEventListener('scroll', animate);
  animate();
}

/* ── Live metadata from GitHub ── */
async function fetchMetadata() {
  try {
    const res = await fetch(METADATA_URL);
    if (!res.ok) throw new Error('Metadata fetch failed');
    const data = await res.json();

    document.querySelectorAll('.mod-item').forEach((card) => {
      const id   = card.getAttribute('data-id');
      const meta = data[id];
      if (!meta) return;
      card.querySelector('.last-updated').textContent =
        `Updated: ${formatUpdatedTime(meta.last_updated)}`;
      card.querySelector('.config-count').textContent =
        `${meta.count} Configs Available`;
    });
  } catch (err) {
    console.warn('Could not load metadata:', err.message);
  }
}

/* ── Time formatter ── */
function formatUpdatedTime(dateStr) {
  const now     = new Date();
  const updated = new Date(dateStr);
  const diff    = now - updated;
  const minute  = 60 * 1000;
  const hour    = 60 * minute;
  const day     = 24 * hour;
  if (diff < minute)   return 'now';
  if (diff < hour)     return `${Math.floor(diff / minute)} min ago`;
  if (diff < day)      return `${Math.floor(diff / hour)} hours ago`;
  if (diff < 2 * day)  return 'yesterday';
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`;
  return updated.toLocaleDateString();
}

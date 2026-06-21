// ── DRAWER ──
const menuBtn       = document.getElementById('menu-btn');
const drawer        = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');

function openDrawer()  { drawer.classList.add('open'); drawerOverlay.classList.add('open'); }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); }

menuBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ── SEARCH ──
const searchBtn     = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const searchClose   = document.getElementById('search-close');
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

// Build tutorial data from cards — thumbnail now uses img src
const ALL_CARDS = [...document.querySelectorAll('#tut-grid .tut-card')];
const TUTORIAL_DATA = ALL_CARDS.map(c => {
  const thumb = c.querySelector('.card-thumb');
  const img   = thumb?.querySelector('img');
  const thumbClass = thumb?.className || '';
  const colorMap = {
    'thumb-green':  '#3ddc84',
    'thumb-amber':  '#f5a623',
    'thumb-blue':   '#4fa3e0',
    'thumb-purple': '#a06eff',
    'thumb-red':    '#ff5050'
  };
  const color = Object.entries(colorMap).find(([k]) => thumbClass.includes(k))?.[1] || '#555';
  return {
    title:    c.querySelector('.card-title')?.textContent || '',
    desc:     c.querySelector('.card-desc')?.textContent  || '',
    tags:     c.dataset.tags || '',
    href:     c.href,
    badge:    c.querySelector('.card-badge')?.textContent || '',
    imgSrc:   img?.src || '',
    color
  };
});

function openSearch()  {
  searchOverlay.classList.add('open');
  setTimeout(() => searchInput.focus(), 80);
  renderSearch('');
}
function closeSearch() {
  searchOverlay.classList.remove('open');
  searchInput.value = '';
}

searchBtn.addEventListener('click', openSearch);
searchClose.addEventListener('click', closeSearch);
searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.matches('input,textarea')) { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); closeDrawer(); }
});

function renderSearch(q) {
  const term = q.trim().toLowerCase();
  if (!term) {
    searchResults.innerHTML = '<div class="search-empty">Type to search tutorials…</div>';
    return;
  }
  const hits = TUTORIAL_DATA.filter(t =>
    t.title.toLowerCase().includes(term) ||
    t.desc.toLowerCase().includes(term)  ||
    t.tags.toLowerCase().includes(term)
  );
  if (!hits.length) {
    searchResults.innerHTML = `<div class="search-empty">No results for "${q}"</div>`;
    return;
  }
  searchResults.innerHTML = hits.map(t => `
    <a class="search-result-item" href="${t.href}">
      <div class="sri-thumb" style="border: 1px solid ${t.color}33;">
        ${t.imgSrc ? `<img src="${t.imgSrc}" alt="" loading="lazy" />` : `<div style="width:100%;height:100%;background:${t.color}22;"></div>`}
      </div>
      <div class="sri-body">
        <div class="sri-title">${t.title}</div>
        <div class="sri-sub">${t.badge} · ${t.desc.slice(0, 60)}…</div>
      </div>
    </a>`).join('');
}

searchInput.addEventListener('input', () => renderSearch(searchInput.value));

// ── FILTER CHIPS ──
const chips        = document.querySelectorAll('.chip[data-filter]');
const cards        = document.querySelectorAll('#tut-grid .tut-card');
const featuredCard = document.getElementById('featured-card');
const countPill    = document.getElementById('count');
const empty        = document.getElementById('empty');
let active = 'all';

function update() {
  let visible = 0;
  cards.forEach((c, i) => {
    const tags = (c.dataset.tags || '').split(' ');
    const show = active === 'all' || tags.includes(active);
    if (show) {
      c.hidden = false;
      c.classList.remove('animate-in');
      void c.offsetWidth;
      c.style.animationDelay = (i * 0.05) + 's';
      c.style.opacity = '0';
      c.classList.add('animate-in');
      visible++;
    } else {
      c.hidden = true;
    }
  });

  if (featuredCard) {
    const fTags = (featuredCard.dataset.tags || '').split(' ');
    featuredCard.style.display = (active !== 'all' && !fTags.includes(active)) ? 'none' : '';
  }

  countPill.textContent = visible + ' tutorial' + (visible !== 1 ? 's' : '');
  empty.style.display = visible === 0 ? 'flex' : 'none';
}

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    active = chip.dataset.filter;
    update();
  });
});

// ── ANIMATE-IN CSS SWAP ──
document.addEventListener('animationend', e => {
  if (e.target.classList.contains('animate-in')) {
    e.target.style.opacity = '1';
    e.target.classList.remove('animate-in');
  }
});

update();

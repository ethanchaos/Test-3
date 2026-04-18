/* ── News.js — ConfigHub Updates UI ── */

/* ── Boot MainActivty (addon/plugin controller) ── */
const _maScript = document.createElement('script');
_maScript.src = 'mainactivity.js';
document.head.appendChild(_maScript);

// ── Category config (accent colour + tag class) ──────────────────────────────
const CAT_CONFIG = {
  vpn:     { color: '#3c64b4', tagClass: 'tag-vpn' },
  scanner: { color: '#7a5500', tagClass: 'tag-scanner' },
  system:  { color: '#333333', tagClass: 'tag-system' },
  tools:   { color: '#503282', tagClass: 'tag-tools' },
  hotfix:  { color: '#b4283c', tagClass: 'tag-hotfix' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let activeFilter  = 'all';
let showSavedOnly = false;
const savedIds    = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a yyyy-mm-dd date string into "DD Mon YYYY".
 * Date is computed entirely in JS — no backend needed.
 */
function formatDate(isoDate) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

// ── Render: Top Story (featured) ──────────────────────────────────────────────
function renderTopStory(story) {
  if (!story) return;

  const cfg  = CAT_CONFIG[story.category] || CAT_CONFIG.system;
  const date = formatDate(story.date);

  document.getElementById('featuredTitle').textContent       = story.title;
  document.getElementById('featuredDesc').textContent        = story.description;
  document.getElementById('featuredDate').textContent        = date;
  document.getElementById('featuredTag').className           = `tag ${cfg.tagClass}`;
  document.getElementById('featuredTag').textContent         = story.category.toUpperCase();

  const linkEl = document.getElementById('featuredLink');
  if (story.link) {
    linkEl.href = story.link;
    linkEl.style.display = 'inline-block';
  } else {
    linkEl.style.display = 'none';
  }
}

// ── Render: Feed cards ────────────────────────────────────────────────────────
function renderFeed(updates) {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';

  updates.forEach((item, idx) => {
    const cfg  = CAT_CONFIG[item.category] || CAT_CONFIG.system;
    const date = formatDate(item.date);

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id  = item.id;
    card.dataset.cat = item.category;
    card.dataset.title = item.title.toLowerCase();
    card.dataset.desc  = item.description.toLowerCase();

    // Build inner HTML
    let topBadges = `<span class="tag ${cfg.tagClass}">${item.category.toUpperCase()}</span>`;
    if (item.isNew) topBadges += `<span class="badge-new">NEW</span>`;

    let actionBtn = '';
    if (item.link) {
      actionBtn = `<a class="card-action-btn" href="${item.link}" onclick="event.stopPropagation()">↗ View</a>`;
    }

    card.innerHTML = `
      <div class="card-accent" style="background:${cfg.color}"></div>
      <div class="card-body">
        <div class="card-top">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${topBadges}
          </div>
          <button class="card-save-btn" data-idx="${idx}" title="Save">♡</button>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <span class="card-date">${date}</span>
        ${actionBtn}
      </div>
    `;

    // Save button handler
    card.querySelector('.card-save-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleSave(e.currentTarget, idx);
    });

    feed.appendChild(card);
  });
}

// ── Filter logic ──────────────────────────────────────────────────────────────
function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#feed .card');
  let visible = 0;

  cards.forEach((card, idx) => {
    const matchCat    = activeFilter === 'all' || card.dataset.cat === activeFilter;
    const matchSearch = !query
      || card.dataset.title.includes(query)
      || card.dataset.desc.includes(query);
    const matchSaved  = !showSavedOnly || savedIds.has(idx);

    const show = matchCat && matchSearch && matchSaved;
    card.style.display = show ? '' : 'none';
    card.dataset.hidden = show ? 'false' : 'true';
    if (show) visible++;
  });

  document.getElementById('emptyState').classList.toggle('visible', visible === 0);
}

function setFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.cat;
  applyFilters();
}

// ── Save / bookmark ───────────────────────────────────────────────────────────
function toggleSave(btn, idx) {
  const card = btn.closest('.card');

  if (savedIds.has(idx)) {
    savedIds.delete(idx);
    btn.textContent = '♡';
    btn.classList.remove('saved');
    card.classList.remove('saved');
  } else {
    savedIds.add(idx);
    btn.textContent = '♥';
    btn.classList.add('saved');
    card.classList.add('saved');
  }

  const count   = savedIds.size;
  const countEl = document.getElementById('savedCount');
  countEl.textContent = count;
  countEl.classList.toggle('visible', count > 0);
  applyFilters();
}

function toggleSavedView() {
  showSavedOnly = !showSavedOnly;
  document.getElementById('savedToggle').classList.toggle('active', showSavedOnly);
  applyFilters();
}

// ── Navbar toggle ─────────────────────────────────────────────────────────────
function initNavbar() {
  const navToggle    = document.getElementById('navToggle');
  const dropdownMenu = document.getElementById('dropdownMenu');

  navToggle.addEventListener('click', e => {
    e.stopPropagation();
    navToggle.classList.toggle('active');
    dropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.nav-container')) {
      navToggle.classList.remove('active');
      dropdownMenu.classList.remove('active');
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('News.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderTopStory(data.topStory);
    renderFeed(data.updates);
    initNavbar();

    // Wire search input
    document.getElementById('searchInput')
      .addEventListener('input', applyFilters);

  } catch (err) {
    console.error('Failed to load News.json:', err);
    document.getElementById('feed').innerHTML =
      `<p style="padding:20px;color:#b4283c;font-size:13px;">
        ⚠ Could not load updates. Make sure News.json is in the same folder.
       </p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);

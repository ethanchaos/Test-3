
/* ── Boot MainActivty (addon/plugin controller) ── */
const _maScript = document.createElement('script');
_maScript.src = 'mainactivity.js';
document.head.appendChild(_maScript);


// ── Nav toggle ──────────────────────────────────────────────
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

dropdownMenu.addEventListener('click', () => {
    navToggle.classList.remove('active');
    dropdownMenu.classList.remove('active');
});

// ── Scroll reveal ────────────────────────────────────────────
function revealCards() {
    document.querySelectorAll('.app-card').forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92) {
            setTimeout(() => card.classList.add('visible'), 40 * index);
        }
    });
}

// ── Build a single card element from a data object ───────────
function buildCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';

    const fallback = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';

    card.innerHTML = `
        <img class="app-icon"
             src="${app.icon}"
             alt="${app.name}"
             onerror="this.src='${fallback}'">
        <div class="app-info">
            <div class="app-name">${app.name}</div>
            <div class="app-desc">${app.desc}</div>
            <div class="app-meta">
                <span class="app-rating"><i class="fas fa-star"></i> ${app.rating.toFixed(1)}</span>
                <span class="app-size">${app.size}</span>
                <span class="app-version">${app.version}</span>
            </div>
        </div>
        <a href="${app.url}"
           target="_blank"
           class="download-btn"
           title="Download ${app.name}">
            <i class="fas fa-download"></i>
        </a>
    `;

    return card;
}

// ── Fetch data and render ────────────────────────────────────
async function loadApps() {
    const list = document.getElementById('appsList');

    try {
        const res  = await fetch('apps.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const apps = await res.json();
        allApps = apps;   // expose to search

        list.innerHTML = ''; // clear any placeholder content

        apps.forEach(app => list.appendChild(buildCard(app)));

        // kick off reveal after cards are in the DOM
        window.addEventListener('scroll', revealCards);
        revealCards();

    } catch (err) {
        list.innerHTML = `<p style="padding:1rem;color:#c0392b;">
            Failed to load apps. (${err.message})
        </p>`;
        console.error('apps.js loadApps():', err);
    }
}

document.addEventListener('DOMContentLoaded', loadApps);

// ── Search ────────────────────────────────────────────────────
let allApps = [];   // populated after fetch

const searchIconBtn  = document.getElementById('searchIconBtn');
const searchOverlay  = document.getElementById('searchOverlay');
const searchBackdrop = document.getElementById('searchBackdrop');
const searchPanel    = document.getElementById('searchPanel');
const searchInput    = document.getElementById('searchInput');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const searchResults  = document.getElementById('searchResults');
const searchEmpty    = document.getElementById('searchEmpty');

function openSearch() {
    searchOverlay.classList.add('open');
    searchIconBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => searchInput.focus(), 200);
    renderResults('');  // show hint / all apps
}

function closeSearch() {
    searchOverlay.classList.remove('open');
    searchIconBtn.classList.remove('active');
    document.body.style.overflow = '';
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchEmpty.classList.remove('show');
}

searchIconBtn.addEventListener('click',  openSearch);
searchCloseBtn.addEventListener('click', closeSearch);
searchBackdrop.addEventListener('click', closeSearch);

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
});

function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
        '<mark>$1</mark>');
}

function renderResults(query) {
    searchResults.innerHTML = '';
    searchEmpty.classList.remove('show');

    const q = query.trim().toLowerCase();

    if (!q) {
        // Show hint when empty
        const hint = document.createElement('div');
        hint.className = 'search-hint';
        hint.textContent = 'All Apps';
        searchResults.appendChild(hint);
    }

    const filtered = q
        ? allApps.filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.desc.toLowerCase().includes(q)
          )
        : allApps;

    if (filtered.length === 0) {
        searchEmpty.classList.add('show');
        return;
    }

    if (q) {
        const count = document.createElement('div');
        count.className = 'search-count';
        count.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
        searchResults.appendChild(count);
    }

    const fallback = 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png';

    filtered.forEach((app, i) => {
        const a = document.createElement('a');
        a.className = 'search-result-item';
        a.href = app.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.animationDelay = `${i * 35}ms`;
        a.innerHTML = `
            <img class="search-result-icon"
                 src="${app.icon}" alt="${app.name}"
                 onerror="this.src='${fallback}'">
            <div class="search-result-info">
                <div class="search-result-name">${highlight(app.name, q)}</div>
                <div class="search-result-desc">${app.desc}</div>
            </div>
            <i class="fas fa-chevron-right search-result-arrow"></i>
        `;
        // Close search when user taps a result
        a.addEventListener('click', () => closeSearch());
        searchResults.appendChild(a);
    });
}

searchInput.addEventListener('input', () => {
    renderResults(searchInput.value);
});


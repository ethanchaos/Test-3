/* ══════════════════════════════════════════════
   nmap-tutorial.js — Chaos Configurations
   v3 — session-aware auth · IndexedDB progress
        copy-reads progress · scroll animations
   ══════════════════════════════════════════════ */

/* ══ SESSION CHECK — dvx_session ══
   Reads localStorage for 'dvx_session'.
   Not logged in  → show Login + Sign Up buttons.
   Logged in      → hide the auth block entirely.
*/
(function checkSession() {
  const drawerAuth = document.querySelector('.drawer-auth');
  if (!drawerAuth) return;
  if (!localStorage.getItem('dvx_session')) {
    drawerAuth.style.display = 'flex';   // not logged in — show both
  } else {
    drawerAuth.style.display = 'none';   // logged in — hide
  }
})();

/* ══ LOCAL DB (IndexedDB) ══
   Saves per-tutorial progress so it survives refreshes.
   Key: tutorial page title   Value: array of completed step numbers
*/
const DB_NAME    = 'chaos-tutorial-progress';
const DB_STORE   = 'progress';
const DB_VERSION = 1;
const TUTORIAL_KEY = document.title.trim();

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(DB_STORE)) {
        d.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function loadProgress() {
  if (!db) return new Set();
  return new Promise(resolve => {
    const tx  = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(TUTORIAL_KEY);
    req.onsuccess = e => {
      const rec = e.target.result;
      resolve(rec ? new Set(rec.steps) : new Set());
    };
    req.onerror = () => resolve(new Set());
  });
}

async function saveProgress(stepSet) {
  if (!db) return;
  return new Promise(resolve => {
    const tx  = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).put({ id: TUTORIAL_KEY, steps: [...stepSet] });
    req.onsuccess = () => resolve();
    req.onerror   = () => resolve();
  });
}

/* ══ PROGRESS TRACKING ══ */
const TOTAL_STEPS = 6;
const completed   = new Set();

function updateProgress() {
  const pct   = Math.round((completed.size / TOTAL_STEPS) * 100);
  const fill  = document.getElementById('progress-fill');
  const pctEl = document.getElementById('progress-pct');

  fill.style.width  = pct + '%';
  pctEl.textContent = pct + '%';

  /* Pulse glow on progress bar */
  fill.classList.remove('pulse');
  void fill.offsetWidth; // force reflow
  fill.classList.add('pulse');

  /* Sync TOC dots */
  completed.forEach(s => {
    const link = document.querySelector('.toc-link[data-toc="' + s + '"]');
    if (link) { link.classList.add('done'); link.classList.remove('active'); }
  });

  if (completed.size === TOTAL_STEPS) {
    const cc = document.getElementById('completion-card');
    if (cc) {
      cc.style.display = 'block';
      setTimeout(() => cc.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    }
  }

  saveProgress(completed);
}

function markStep(step) {
  completed.add(step);
  const btn = document.querySelector('.step-btn[data-step="' + step + '"]');
  if (btn) { btn.textContent = '✓ Done'; btn.classList.add('done'); }
  const tocLink = document.querySelector('.toc-link[data-toc="' + step + '"]');
  if (tocLink) { tocLink.classList.add('done'); }
  updateProgress();
}

function unmarkStep(step) {
  completed.delete(step);
  const btn = document.querySelector('.step-btn[data-step="' + step + '"]');
  if (btn) { btn.textContent = 'Mark as read'; btn.classList.remove('done'); }
  const tocLink = document.querySelector('.toc-link[data-toc="' + step + '"]');
  if (tocLink) tocLink.classList.remove('done');
  const cc = document.getElementById('completion-card');
  if (cc) cc.style.display = 'none';
  updateProgress();
}

/* ══ COPY BUTTONS — copy also advances progress ══ */
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const text    = btn.dataset.copy;
    const orig    = btn.innerHTML;
    const section = btn.closest('.tut-section');
    const stepNum = section ? parseInt(section.dataset.section) : null;

    const success = () => {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>Copied!`;
      btn.classList.add('copied');

      /* Mark section as read when code is copied */
      if (stepNum && !completed.has(stepNum)) {
        setTimeout(() => markStep(stepNum), 400);
      }

      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('copied');
      }, 1800);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(success).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      success();
    }
  });
});

/* ══ STEP BUTTONS (manual toggle) ══ */
document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const step = parseInt(btn.dataset.step);
    if (completed.has(step)) {
      unmarkStep(step);
    } else {
      markStep(step);
    }
  });
});

/* ══ OS TABS ══ */
document.querySelectorAll('.os-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const os      = tab.dataset.os;
    const section = tab.closest('.tut-section');
    section.querySelectorAll('.os-tab').forEach(t => t.classList.remove('active'));
    section.querySelectorAll('.os-panel').forEach(p => {
      p.classList.remove('active');
      p.style.animation = '';
    });
    tab.classList.add('active');
    const panel = section.querySelector('#os-' + os);
    if (panel) {
      panel.classList.add('active');
      panel.style.animation = 'tab-slide-in .22s cubic-bezier(.4,0,.2,1)';
    }
  });
});

/* ══ DRAWER ══ */
const menuBtn       = document.getElementById('menu-btn');
const drawer        = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');
const openDrawer  = () => { drawer.classList.add('open'); drawerOverlay.classList.add('open'); };
const closeDrawer = () => { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); };
menuBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

/* ══ SEARCH ══ */
const searchBtn     = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const searchClose   = document.getElementById('search-close');
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const openSearch  = () => { searchOverlay.classList.add('open'); setTimeout(() => searchInput.focus(), 80); };
const closeSearch = () => {
  searchOverlay.classList.remove('open');
  searchInput.value = '';
  searchResults.innerHTML = '<div class="search-empty">Type to search tutorials\u2026</div>';
};
searchBtn.addEventListener('click', openSearch);
searchClose.addEventListener('click', closeSearch);
searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.matches('input,textarea')) { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); closeDrawer(); }
});
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    searchResults.innerHTML = '<div class="search-empty">Type to search tutorials\u2026</div>';
    return;
  }
  searchResults.innerHTML = '<div class="search-empty">No results \u2014 try the tutorials index.</div>';
});

/* ══ SCROLL SPY ══ */
const sections = document.querySelectorAll('.tut-section[data-section]');
const tocLinks = document.querySelectorAll('.toc-link[data-toc]');
const spy = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.dataset.section;
      tocLinks.forEach(l => { if (!l.classList.contains('done')) l.classList.remove('active'); });
      const a = document.querySelector('.toc-link[data-toc="' + id + '"]');
      if (a && !a.classList.contains('done')) a.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });
sections.forEach(s => spy.observe(s));

/* ══ SMOOTH TOC SCROLL ══ */
tocLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(link.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ══ SECTION ENTER ANIMATIONS ══ */
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      sectionObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.07 });
document.querySelectorAll('.tut-section, .tut-img-wrap, .info-card, .code-block, .related-card').forEach(el => {
  el.classList.add('anim-ready');
  sectionObserver.observe(el);
});

/* ══ BOOT: restore saved progress from IndexedDB ══ */
(async () => {
  try {
    db = await openDB();
    const saved = await loadProgress();
    saved.forEach(step => {
      completed.add(step);
      const btn = document.querySelector('.step-btn[data-step="' + step + '"]');
      if (btn) { btn.textContent = '✓ Done'; btn.classList.add('done'); }
      const tocLink = document.querySelector('.toc-link[data-toc="' + step + '"]');
      if (tocLink) { tocLink.classList.add('done'); tocLink.classList.remove('active'); }
    });
    if (completed.size > 0) {
      const pct = Math.round((completed.size / TOTAL_STEPS) * 100);
      document.getElementById('progress-fill').style.width = pct + '%';
      document.getElementById('progress-pct').textContent  = pct + '%';
      if (completed.size === TOTAL_STEPS) {
        const cc = document.getElementById('completion-card');
        if (cc) cc.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('LocalDB unavailable:', e);
  }
})();

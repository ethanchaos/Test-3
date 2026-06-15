// ── Header scroll shadow ──
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    // ── Hamburger ──
    const navToggle    = document.getElementById('navToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');
    navToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        navToggle.classList.toggle('active');
        dropdownMenu.classList.toggle('active');
    });
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-right') && !e.target.closest('.dropdown-menu')) {
            navToggle.classList.remove('active');
            dropdownMenu.classList.remove('active');
        }
    });

    // ── Scroll reveal ──
    const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));

    // ── Trigger hero reveals immediately ──
    document.querySelectorAll('.hero .reveal, .hero .reveal-right').forEach(el => {
        setTimeout(() => el.classList.add('visible'), 100);
    });

    // ── Particle burst — teal/blue dots ──
    (function spawnParticles() {
        const wrapper = document.querySelector('.hero-wrapper');
        if (!wrapper) return;

        // Alternate between teal and blue
        const colours = [
            'rgba(9,68,208,0.65)',
            'rgba(14,165,160,0.65)',
            'rgba(56,189,248,0.55)',
            'rgba(9,68,208,0.45)',
        ];

        function spawn() {
            const p = document.createElement('div');
            p.className = 'hero-particle';

            const startX = 55 + Math.random() * 45;
            const startY = 45 + Math.random() * 55;
            const angle  = (Math.random() * 150 + 185) * (Math.PI / 180);
            const dist   = 90 + Math.random() * 200;
            const dx     = Math.cos(angle) * dist;
            const dy     = Math.sin(angle) * dist;
            const duration = 3500 + Math.random() * 4500;
            const size   = 2 + Math.random() * 3.5;
            const colour = colours[Math.floor(Math.random() * colours.length)];

            p.style.cssText = `
                left: ${startX}%;
                top:  ${startY}%;
                width:  ${size}px;
                height: ${size}px;
                background: ${colour};
                box-shadow: 0 0 ${size * 2}px ${colour};
                --dx: ${dx}px;
                --dy: ${dy}px;
                animation-duration: ${duration}ms;
                animation-delay: 0ms;
                opacity: 0;
            `;

            wrapper.appendChild(p);
            setTimeout(() => p.remove(), duration + 100);
        }

        setInterval(spawn, 200);
        for (let i = 0; i < 22; i++) setTimeout(spawn, i * 80);
    })();

    // ── Stat number count-up animation ──
    function animateCount(el, target, suffix = '') {
        const isText = isNaN(parseInt(target));
        if (isText) return;
        let start = 0;
        const end = parseInt(target);
        const dur = 1200;
        const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / dur, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * end) + suffix;
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    const statNums = document.querySelectorAll('.hero-stat-num');
    statNums.forEach(el => {
        const raw = el.textContent.trim();
        if (raw === '6+') {
            let start = null;
            const step = (ts) => {
                if (!start) start = ts;
                const p = Math.min((ts - start) / 1000, 1);
                const e = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.floor(e * 6) + '+';
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
    });
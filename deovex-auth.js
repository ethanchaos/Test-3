/* ════════════════════════════════════════════════════════════════
   deovex-auth.js — Auth System powered by Supabase
   ─────────────────────────────────────────────────────────────
   Database : Supabase (replaces GitHub JSON files)
   Auth     : Supabase Auth (email/password under the hood,
              but the UI still takes a USERNAME — we store
              username in user_metadata and in a profiles table)

   Two Supabase tables used:
   ┌─────────────────────────────────────────────────────────┐
   │ auth.users  (managed by Supabase — passwords live here) │
   │ public.profiles                                         │
   │   id         uuid  PK  references auth.users(id)        │
   │   username   text  UNIQUE NOT NULL                      │
   │   province   text                                       │
   │   email      text                                       │
   │   whatsapp   text                                       │
   │   telegram   text                                       │
   │   facebook   text                                       │
   │   created_at timestamptz DEFAULT now()                  │
   └─────────────────────────────────────────────────────────┘

   HOW TO CREATE THE TABLE (run once in Supabase SQL editor):
   ───────────────────────────────────────────────────────────
   create table public.profiles (
     id          uuid primary key references auth.users(id) on delete cascade,
     username    text unique not null,
     province    text,
     email       text,
     whatsapp    text,
     telegram    text,
     facebook    text,
     created_at  timestamptz default now()
   );
   alter table public.profiles enable row level security;
   create policy "Users can read own profile"
     on public.profiles for select using (auth.uid() = id);
   create policy "Users can insert own profile"
     on public.profiles for insert with check (auth.uid() = id);

   IMPORTANT — because the UI is username-based (not email),
   we store the user as:
     email = username@chaosconfigurations.co.za  (synthetic)
   The user never sees or types this email — it is built
   automatically from their chosen username.
   ════════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    /* ══════════════════════════════════════════════════════════
       SUPABASE CONFIG
       ══════════════════════════════════════════════════════════ */
    const SUPABASE_URL = 'https://omrwedjwdxijrxtnnuta.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_2q9UhmHCJY3EpmfhDOSFIg_agcz9uYX';

    /* Synthetic email domain — users only ever type a username */
    const EMAIL_DOMAIN = 'chaosconfigurations.co.za';

    const SESSION_KEY  = 'dvx_session';
    const MAIN_DOMAIN  = 'https://chaosconfigurations.co.za';
    const LOGIN_PATH   = '/login';

    /* ══════════════════════════════════════════════════════════
       LAZY-LOAD Supabase SDK then initialise client
       ══════════════════════════════════════════════════════════ */
    let _sb = null;  /* will hold the Supabase client once ready */

    function _loadSDK() {
        return new Promise(function (resolve, reject) {
            if (global.supabase && global.supabase.createClient) {
                _sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                return resolve();
            }
            /* SDK not yet on page — inject it */
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            s.onload = function () {
                _sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                resolve();
            };
            s.onerror = function () { reject(new Error('Failed to load Supabase SDK')); };
            document.head.appendChild(s);
        });
    }

    /* Ensure SDK is ready before any call */
    async function _client() {
        if (!_sb) await _loadSDK();
        return _sb;
    }

    /* Build the synthetic email from a username */
    function _toEmail(username) {
        return username.toLowerCase().trim() + '@' + EMAIL_DOMAIN;
    }

    /* ══════════════════════════════════════════════════════════
       SESSION helpers  (mirrors Supabase session into localStorage
       so DeovexAuth.isLoggedIn() is sync / instant)
       ══════════════════════════════════════════════════════════ */
    function _saveSession(username, userId) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            username  : username,
            userId    : userId,
            loggedInAt: new Date().toISOString()
        }));
    }

    function _clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function _getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    /* ══════════════════════════════════════════════════════════
       REDIRECT helpers
       ══════════════════════════════════════════════════════════ */
    function _getNextUrl() {
        const params    = new URLSearchParams(window.location.search);
        const fromParam = params.get('next');
        if (fromParam) {
            sessionStorage.setItem('dvx_next', fromParam);
            return fromParam;
        }
        const stored = sessionStorage.getItem('dvx_next');
        if (stored) {
            sessionStorage.removeItem('dvx_next');
            return stored;
        }
        return MAIN_DOMAIN + '/';
    }

    /* ══════════════════════════════════════════════════════════
       PUBLIC API
       ══════════════════════════════════════════════════════════ */
    const DeovexAuth = {

        isLoggedIn : function () { return _getSession() !== null; },
        currentUser: function () { const s = _getSession(); return s ? s.username : null; },
        getNextUrl : _getNextUrl,

        logout: async function () {
            const sb = await _client();
            await sb.auth.signOut();
            _clearSession();
            window.location.href = MAIN_DOMAIN + LOGIN_PATH;
        },

        guard: function () {
            if (!DeovexAuth.isLoggedIn()) {
                const currentUrl = window.location.href;
                sessionStorage.setItem('dvx_next', currentUrl);
                window.location.href = MAIN_DOMAIN + LOGIN_PATH +
                                       '?next=' + encodeURIComponent(currentUrl);
            }
        },

        /* ── login ───────────────────────────────────────────
           { username, password }
        ──────────────────────────────────────────────────────── */
        login: async function (opts) {
            try {
                const username = (opts.username || '').trim().toLowerCase();
                const password = (opts.password || '').trim();

                if (!username || !password) {
                    return { ok: false, message: 'Username and password are required.' };
                }

                const sb = await _client();
                const { data, error } = await sb.auth.signInWithPassword({
                    email   : _toEmail(username),
                    password: password
                });

                if (error) {
                    /* Map Supabase error messages to friendly ones */
                    if (error.message.includes('Invalid login')) {
                        return { ok: false, message: 'Incorrect username or password.' };
                    }
                    return { ok: false, message: error.message };
                }

                _saveSession(username, data.user.id);
                return { ok: true };

            } catch (err) {
                console.error('[DeovexAuth] login error:', err);
                return { ok: false, message: 'Login failed. Please try again.' };
            }
        },

        /* ── signup ──────────────────────────────────────────
           { username, password, province, email?,
             whatsapp?, telegram?, facebook? }
        ──────────────────────────────────────────────────────── */
        signup: async function (opts) {
            try {
                const username = (opts.username || '').trim().toLowerCase();
                const password = (opts.password || '').trim();

                if (!username || password.length < 6) {
                    return { ok: false, message: 'Invalid username or password.' };
                }

                const sb = await _client();

                /* ── 1. Check username is not already taken ── */
                const { data: existing } = await sb
                    .from('profiles')
                    .select('username')
                    .eq('username', username)
                    .maybeSingle();

                if (existing) {
                    return { ok: false, message: 'That username is already taken.' };
                }

                /* ── 2. Create auth user ── */
                const { data, error: signUpError } = await sb.auth.signUp({
                    email   : _toEmail(username),
                    password: password,
                    options : {
                        data: { username: username }   /* stored in user_metadata */
                    }
                });

                if (signUpError) {
                    if (signUpError.message.includes('already registered')) {
                        return { ok: false, message: 'That username is already taken.' };
                    }
                    return { ok: false, message: signUpError.message };
                }

                /* ── 3. Insert profile row ── */
                const { error: profileError } = await sb
                    .from('profiles')
                    .insert({
                        id      : data.user.id,
                        username: username,
                        province: opts.province || null,
                        email   : opts.email    || null,
                        whatsapp: opts.whatsapp || null,
                        telegram: opts.telegram || null,
                        facebook: opts.facebook || null
                    });

                if (profileError) {
                    console.error('[DeovexAuth] profile insert error:', profileError);
                    /* Auth user was created — still save session, profile can retry */
                }

                /* ── 4. Auto-login (Supabase signUp already sets a session) ── */
                _saveSession(username, data.user.id);
                return { ok: true };

            } catch (err) {
                console.error('[DeovexAuth] signup error:', err);
                return { ok: false, message: err.message || 'Signup failed. Please try again.' };
            }
        }
    };

    global.DeovexAuth = DeovexAuth;

})(window);

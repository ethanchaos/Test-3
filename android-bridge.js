/**
 * android-bridge.js
 *
 * Provides the AndroidBridge integration for the chaos configurations
 * login and signup pages. This script runs in the WebView inside the
 * ConfigHub Android app and facilitates communication between the web
 * page and the native Android code.
 *
 * It wraps around the existing deovex-auth.js system to intercept
 * authentication success/failure and notify the Android app.
 *
 * NOTE: deovex-auth.js exposes DeovexAuth.login(opts) / DeovexAuth.signup(opts)
 * which resolve to { ok: true } or { ok: false, message }. They do NOT return
 * a user object, so we pull username/userId back out of localStorage
 * ('dvx_session'), which DeovexAuth writes internally on success.
 */

(function(global) {
    'use strict';

    const SESSION_KEY = 'dvx_session';

    // ─────────────────────────────────────────────────────────────
    // Environment Detection
    // ─────────────────────────────────────────────────────────────

    const isNativeApp = typeof window.AndroidBridge !== 'undefined';

    console.log('[AndroidBridge]', isNativeApp ? 'App detected ✓' : 'Browser mode');

    global.isConfigHubApp = isNativeApp;

    function _readSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Wrapper for DeovexAuth.login
    // ─────────────────────────────────────────────────────────────

    function wrapLoginHandler() {
        const checkInterval = setInterval(() => {
            if (global.DeovexAuth && global.DeovexAuth.login) {
                clearInterval(checkInterval);

                const originalLogin = global.DeovexAuth.login;

                global.DeovexAuth.login = function(opts) {
                    console.log('[AndroidBridge] Attempting login...');

                    return originalLogin.call(this, opts).then(result => {
                        if (result && result.ok) {
                            console.log('[AndroidBridge] Login successful');

                            if (isNativeApp) {
                                const session = _readSession();
                                const username = (session && session.username) ||
                                                  (opts && opts.username) || '';
                                const userId = (session && session.userId) || '';

                                try {
                                    window.AndroidBridge.onAuthSuccess(username, userId);
                                    console.log('[AndroidBridge] Sent to Android ✓');
                                } catch (err) {
                                    console.error('[AndroidBridge] Error sending to Android:', err);
                                }
                            } else {
                                console.log('[AndroidBridge] Browser mode - normal redirect');
                            }
                        } else if (isNativeApp) {
                            try {
                                window.AndroidBridge.onAuthFailure(
                                    (result && result.message) || 'Login failed.'
                                );
                            } catch (bridgeErr) {
                                console.error('[AndroidBridge] Error sending error to Android:', bridgeErr);
                            }
                        }

                        return result;
                    }).catch(err => {
                        console.error('[AndroidBridge] Login failed:', err);
                        if (isNativeApp) {
                            try {
                                window.AndroidBridge.onAuthFailure(err.message);
                            } catch (bridgeErr) {
                                console.error('[AndroidBridge] Error sending error to Android:', bridgeErr);
                            }
                        }
                        throw err;
                    });
                };

                console.log('[AndroidBridge] Login wrapper installed ✓');
            }
        }, 100);

        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    // ─────────────────────────────────────────────────────────────
    // Wrapper for DeovexAuth.signup
    // ─────────────────────────────────────────────────────────────

    function wrapSignupHandler() {
        const checkInterval = setInterval(() => {
            if (global.DeovexAuth && global.DeovexAuth.signup) {
                clearInterval(checkInterval);

                const originalSignup = global.DeovexAuth.signup;

                global.DeovexAuth.signup = function(opts) {
                    console.log('[AndroidBridge] Attempting signup...');

                    return originalSignup.call(this, opts).then(result => {
                        if (result && result.ok) {
                            console.log('[AndroidBridge] Signup successful');

                            if (isNativeApp) {
                                const session = _readSession();
                                const username = (session && session.username) ||
                                                  (opts && opts.username) || '';
                                const userId = (session && session.userId) || '';

                                try {
                                    window.AndroidBridge.onAuthSuccess(username, userId);
                                    console.log('[AndroidBridge] Sent to Android ✓');
                                } catch (err) {
                                    console.error('[AndroidBridge] Error sending to Android:', err);
                                }
                            } else {
                                console.log('[AndroidBridge] Browser mode - normal flow');
                            }
                        } else if (isNativeApp) {
                            try {
                                window.AndroidBridge.onAuthFailure(
                                    (result && result.message) || 'Signup failed.'
                                );
                            } catch (bridgeErr) {
                                console.error('[AndroidBridge] Error sending error to Android:', bridgeErr);
                            }
                        }

                        return result;
                    }).catch(err => {
                        console.error('[AndroidBridge] Signup failed:', err);
                        if (isNativeApp) {
                            try {
                                window.AndroidBridge.onAuthFailure(err.message);
                            } catch (bridgeErr) {
                                console.error('[AndroidBridge] Error sending error to Android:', bridgeErr);
                            }
                        }
                        throw err;
                    });
                };

                console.log('[AndroidBridge] Signup wrapper installed ✓');
            }
        }, 100);

        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: Manual auth success (for edge cases)
    // ─────────────────────────────────────────────────────────────

    global.AndroidAuthBridge = {
        notifySuccess: function(username, userId) {
            console.log('[AndroidBridge] Manual success notification');
            if (isNativeApp) {
                try {
                    window.AndroidBridge.onAuthSuccess(username, userId);
                } catch (err) {
                    console.error('[AndroidBridge] Error:', err);
                }
            } else {
                console.log('[AndroidBridge] Browser mode - skipped');
            }
        },

        notifyError: function(errorMessage) {
            console.log('[AndroidBridge] Manual error notification');
            if (isNativeApp) {
                try {
                    window.AndroidBridge.onAuthFailure(errorMessage);
                } catch (err) {
                    console.error('[AndroidBridge] Error:', err);
                }
            } else {
                console.log('[AndroidBridge] Browser mode - skipped');
            }
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Initialize Wrappers
    // ─────────────────────────────────────────────────────────────

    if (isNativeApp) {
        console.log('[AndroidBridge] Initializing auth wrappers...');
        wrapLoginHandler();
        wrapSignupHandler();
    }

    if (isNativeApp) {
        try {
            const testBridge = window.AndroidBridge;
            console.log('[AndroidBridge] Bridge available:', {
                hasOnSuccess: typeof testBridge.onAuthSuccess === 'function',
                hasOnFailure: typeof testBridge.onAuthFailure === 'function',
                hasIsApp: typeof testBridge.isNativeApp === 'function'
            });
        } catch (err) {
            console.warn('[AndroidBridge] Bridge not fully ready yet:', err);
        }
    }

})( window );

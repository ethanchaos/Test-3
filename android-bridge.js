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
 */

(function(global) {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // Environment Detection
    // ─────────────────────────────────────────────────────────────

    /**
     * Detect if running in the ConfigHub Android app.
     * The Android WebView injects a window.AndroidBridge object,
     * so we check for its existence.
     */
    const isNativeApp = typeof window.AndroidBridge !== 'undefined';

    console.log('[AndroidBridge]', isNativeApp ? 'App detected ✓' : 'Browser mode');

    // Store this globally so other scripts can check
    global.isConfigHubApp = isNativeApp;

    // ─────────────────────────────────────────────────────────────
    // Wrapper for DeovexAuth Login
    // ─────────────────────────────────────────────────────────────

    /**
     * Wraps the DeovexAuth.signInWithEmail() method to intercept
     * the result and notify the Android app on success.
     * 
     * This is called from the deovex-login.js script (external).
     */
    function wrapLoginHandler() {
        // Wait for DeovexAuth to be available
        const checkInterval = setInterval(() => {
            if (global.DeovexAuth && global.DeovexAuth.signInWithEmail) {
                clearInterval(checkInterval);
                
                // Store original method
                const originalSignIn = global.DeovexAuth.signInWithEmail;
                
                // Wrap it
                global.DeovexAuth.signInWithEmail = function(email, password) {
                    console.log('[AndroidBridge] Attempting login...');
                    
                    // Call original
                    return originalSignIn.call(this, email, password)
                        .then(user => {
                            console.log('[AndroidBridge] Login successful:', user);
                            
                            // Extract username (might be in user_metadata)
                            const username = 
                                user.user_metadata?.username || 
                                email.split('@')[0];
                            
                            // If in app, notify Android
                            if (isNativeApp) {
                                try {
                                    window.AndroidBridge.onAuthSuccess(username, user.id);
                                    console.log('[AndroidBridge] Sent to Android ✓');
                                } catch (err) {
                                    console.error('[AndroidBridge] Error sending to Android:', err);
                                    throw err;
                                }
                            } else {
                                // In browser: redirect normally (let deovex-login.js handle it)
                                console.log('[AndroidBridge] Browser mode - normal redirect');
                            }
                            
                            return user;
                        })
                        .catch(err => {
                            console.error('[AndroidBridge] Login failed:', err);
                            
                            // Notify Android of error
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
        
        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    // ─────────────────────────────────────────────────────────────
    // Wrapper for DeovexAuth Signup
    // ─────────────────────────────────────────────────────────────

    /**
     * Wraps the DeovexAuth.signUpWithEmail() method to intercept
     * the result and notify the Android app on success.
     * 
     * This is called from the deovex-signup.js script (external).
     */
    function wrapSignupHandler() {
        // Wait for DeovexAuth to be available
        const checkInterval = setInterval(() => {
            if (global.DeovexAuth && global.DeovexAuth.signUpWithEmail) {
                clearInterval(checkInterval);
                
                // Store original method
                const originalSignUp = global.DeovexAuth.signUpWithEmail;
                
                // Wrap it
                global.DeovexAuth.signUpWithEmail = function(email, password, userData) {
                    console.log('[AndroidBridge] Attempting signup...');
                    
                    // Call original
                    return originalSignUp.call(this, email, password, userData)
                        .then(user => {
                            console.log('[AndroidBridge] Signup successful:', user);
                            
                            // Extract username
                            const username = userData?.username || email.split('@')[0];
                            
                            // If in app, notify Android
                            if (isNativeApp) {
                                try {
                                    window.AndroidBridge.onAuthSuccess(username, user.id);
                                    console.log('[AndroidBridge] Sent to Android ✓');
                                } catch (err) {
                                    console.error('[AndroidBridge] Error sending to Android:', err);
                                    throw err;
                                }
                            } else {
                                // In browser: show welcome page (handled by deovex-signup.js)
                                console.log('[AndroidBridge] Browser mode - normal flow');
                            }
                            
                            return user;
                        })
                        .catch(err => {
                            console.error('[AndroidBridge] Signup failed:', err);
                            
                            // Notify Android of error
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
        
        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    // ─────────────────────────────────────────────────────────────
    // Helper: Manual auth success (for edge cases)
    // ─────────────────────────────────────────────────────────────

    /**
     * If for some reason the auto-wrapping doesn't work,
     * you can call this manually from your custom auth code.
     * 
     * Usage:
     *   window.AndroidAuthBridge.notifySuccess('username', 'user-id-123')
     */
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

    // Start watching for DeovexAuth and wrap its methods
    if (isNativeApp) {
        console.log('[AndroidBridge] Initializing auth wrappers...');
        wrapLoginHandler();
        wrapSignupHandler();
    }

    // ─────────────────────────────────────────────────────────────
    // Debugging: Log when AndroidBridge becomes available
    // ─────────────────────────────────────────────────────────────

    if (isNativeApp) {
        // Verify the bridge exists and has the methods we need
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

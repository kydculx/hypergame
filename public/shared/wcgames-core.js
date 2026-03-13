/**
 * WCGames Core Library
 * Standardizes State, UI, and Communication across all HTML5 games.
 */
(function () {
    const WCGames = {
        state: 'INIT', // INIT, PLAYING, PAUSED, OVER
        config: {},
        lastGameOverTime: 0,
        debug: false,
        isAdmin: false,
        dt: 0,
        _lastTime: 0,
        _adminWhitelist: (window.WCGamesConfig && window.WCGamesConfig.ADMIN_WHITELIST) || [
            'kydculx@gmail.com'
        ],

        init(config) {
            this.config = config;
            const params = new URLSearchParams(window.location.search);
            this.debug = params.has('debug');
            this.sessionKey = params.get('sk') || '';

            // Centralized Admin Detection
            const userEmail = params.get('u');
            if (userEmail && this._adminWhitelist.includes(userEmail)) {
                this.isAdmin = true;
                if (this.debug) console.log(`[WCGames] Admin Access Granted: ${userEmail}`);
            }

            this.setupUI();
            this.setupListeners();
            this.setupVisibilityHandler();
            this.setupAdSense();
            this.setupAdminUI();
            this.notifyReady();

            // Show start screen by default
            if (!config.skipStartScreen) {
                this.showPopup('start-screen');
            }

            if (this.debug) console.log(`[WCGames] Initialized: ${config.id}`);
        },

        setupUI() {
            // Apply wcg-ready to body to reveal popups
            document.body.classList.add('wcg-ready');

            // Standardize existing screens if they exist
            ['start-screen', 'game-over', 'game-over-screen'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;

                el.classList.add('wcg-overlay');

                // Wrap content in wcg-popup if not already
                if (!el.querySelector('.wcg-popup')) {
                    const popup = document.createElement('div');
                    popup.className = 'wcg-popup';
                    while (el.firstChild) popup.appendChild(el.firstChild);
                    el.appendChild(popup);
                }
            });
        },

        setupListeners() {
            // Global key listeners
            window.addEventListener('keyup', (e) => {
                if (e.code === 'Space' && this.state === 'OVER') {
                    // Prevent accidental restart if space was pressed during game over transition
                    if (Date.now() - this.lastGameOverTime > 500) {
                        this.restart();
                    }
                }
            });

            // Prevent context menu to avoid long-press issues on mobile
            window.addEventListener('contextmenu', (e) => e.preventDefault());
        },

        setupVisibilityHandler() {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (this.state === 'PLAYING') this.pause();
                } else {
                    if (this.state === 'PAUSED') this.resume();
                }
            });
        },

        start() {
            if (this.state === 'PLAYING') return;
            this.state = 'PLAYING';
            this._lastTime = performance.now();
            this.hideAllPopups();
            this.safeCall(this.config.onStart);
        },

        pause() {
            if (this.state !== 'PLAYING') return;
            this.state = 'PAUSED';
            this.safeCall(this.config.onPause);
            if (this.debug) console.log('[WCGames] Game Paused');
        },

        resume() {
            if (this.state !== 'PAUSED') return;
            this.state = 'PLAYING';
            this._lastTime = performance.now(); // Reset timer to avoid dt spike
            this.safeCall(this.config.onResume);
            if (this.debug) console.log('[WCGames] Game Resumed');
        },

        gameOver(score) {
            if (this.state === 'OVER') return;
            // Validate score
            const finalScore = parseInt(score) || 0;

            this.state = 'OVER';
            this.lastGameOverTime = Date.now();
            this.showPopup('game-over', { score: finalScore });
            this.notifyGameOver(finalScore);
            this.safeCall(this.config.onGameOver, finalScore);
        },

        restart() {
            this.hideAllPopups();
            this.safeCall(this.config.onRestart);
            this.start();
        },

        // Utilities
        updateDelta() {
            const now = performance.now();
            const delta = (now - this._lastTime) / 1000;
            this._lastTime = now;
            // Cap delta to 1/30s to prevent spikes after tab switching
            this.dt = Math.min(delta, 0.033);
            return this.dt;
        },

        safeCall(fn, ...args) {
            if (typeof fn === 'function') {
                try {
                    fn(...args);
                } catch (e) {
                    console.error('[WCGames] Callback Error:', e);
                }
            }
        },

        showPopup(id, data = {}) {
            const el = document.getElementById(id);
            if (!el) return;

            if (id === 'game-over' || id === 'game-over-screen') {
                const scoreEl = document.getElementById('final-score');
                if (scoreEl) scoreEl.textContent = Math.abs(data.score || 0);
            }

            el.classList.add('wcg-visible');
        },

        hideAllPopups() {
            document.querySelectorAll('.wcg-overlay').forEach(el => {
                el.classList.remove('wcg-visible');
            });
        },

        // Platform Communication
        notifyReady() {
            window.parent.postMessage({ type: 'GAME_READY' }, '*');
        },

        _getSignature(score) {
            const salt = "WCG_SECURE_VERIFIER_2024";
            return btoa(score.toString() + (this.sessionKey || '') + salt).split('').reverse().join('');
        },

        notifyGameOver(score) {
            // Block zero or negative scores from being registered on the platform
            if (typeof score !== 'number' || score <= 0) {
                if (this.debug) console.log(`[WCGames] Blocked zero-score submission for notifyGameOver: ${score}`);
                return;
            }

            window.parent.postMessage({
                type: 'GAME_OVER',
                payload: {
                    score,
                    signature: this._getSignature(score)
                }
            }, '*');
        },

        submitScore(score) {
            if (typeof score !== 'number' || isNaN(score) || score <= 0) {
                if (this.debug) console.log(`[WCGames] Blocked zero-score submission for submitScore: ${score}`);
                return;
            }

            window.parent.postMessage({
                type: 'SUBMIT_SCORE',
                payload: {
                    score,
                    signature: this._getSignature(score)
                }
            }, '*');
        },

        showLeaderboard() {
            window.parent.postMessage({ type: 'SHOW_LEADERBOARD' }, '*');
        },

        /**
         * Global AudioManager to replace duplicated code in games.
         */
        Audio: {
            ctx: null,
            lastPlayed: {}, // 오디오 스로틀링을 위한 타임스탬프 기록
            init() {
                if (this.ctx) return;
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            },
            play(freq, type = 'sine', dur = 0.1, vol = 0.1) {
                if (!this.ctx) this.init();
                if (this.ctx.state === 'suspended') this.ctx.resume();

                // 오디오 스로틀링 (동일 주파수 연속 재생 방지)
                const key = `${freq}_${type}`;
                const now = Date.now();
                if (this.lastPlayed[key] && now - this.lastPlayed[key] < 200) return;
                this.lastPlayed[key] = now;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = type;
                if (Array.isArray(freq)) {
                    const startFreq = freq[0];
                    const endFreq = freq.length > 1 ? freq[1] : freq[0];
                    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + dur);
                } else {
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                }

                gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + dur);
            }
        },

        setupAdSense() {
            const config = window.WCGamesConfig || {};
            const clientID = config.ADSENSE_ID;
            if (!clientID) return;

            // Automatically find and initialize bottom-banner if it exists
            const banner = document.getElementById('bottom-banner');
            if (banner && banner.style.display !== 'none !important') {
                const script = document.createElement('script');
                script.async = true;
                script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientID}`;
                script.crossOrigin = 'anonymous';
                banner.prepend(script);

                // Push ads if ins element exists
                const ins = banner.querySelector('ins.adsbygoogle');
                if (ins && !ins.getAttribute('data-ad-client')) {
                    ins.setAttribute('data-ad-client', clientID);
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                }
            }
        },

        setupAdminUI() {
            // Automatically reveal elements with 'wcg-admin-only' class if isAdmin is true
            if (this.isAdmin) {
                document.querySelectorAll('.wcg-admin-only').forEach(el => {
                    el.style.display = 'block';
                });
            }
        }
    };

    window.WCGames = WCGames;
})();

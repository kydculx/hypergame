/**
 * WCGames Core Library
 * Standardizes State, UI, and Communication across all HTML5 games.
 */
(function () {
    const WCGames = {
        state: 'INIT', // INIT, PLAYING, OVER
        config: {},
        lastGameOverTime: 0,

        init(config) {
            this.config = config;
            this.setupUI();
            this.setupListeners();
            this.notifyReady();

            // Show start screen by default
            if (!config.skipStartScreen) {
                this.showPopup('start-screen');
            }

            console.log(`[WCGames] Initialized: ${config.id}`);
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
        },

        start() {
            this.state = 'PLAYING';
            this.hideAllPopups();
            if (this.config.onStart) this.config.onStart();
        },

        gameOver(score) {
            this.state = 'OVER';
            this.lastGameOverTime = Date.now();
            this.showPopup('game-over', { score });
            this.notifyGameOver(score);
            if (this.config.onGameOver) this.config.onGameOver(score);
        },

        restart() {
            this.hideAllPopups();
            if (this.config.onRestart) this.config.onRestart();
            this.start();
        },

        showPopup(id, data = {}) {
            const el = document.getElementById(id);
            if (!el) return;

            if (id === 'game-over' || id === 'game-over-screen') {
                const scoreEl = document.getElementById('final-score');
                if (scoreEl) scoreEl.textContent = data.score || 0;
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

        notifyGameOver(score) {
            window.parent.postMessage({ type: 'GAME_OVER', payload: { score } }, '*');
        },

        submitScore(score) {
            window.parent.postMessage({ type: 'SUBMIT_SCORE', payload: { score } }, '*');
        }
    };

    window.WCGames = WCGames;
})();

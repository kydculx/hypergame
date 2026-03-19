// Piano Tiles Rhythm Logic with Map Editor
// Syncs with YouTube IFrame API

// Multi-language shim for shared i18n system
const i18n = {
    t: (key, ...args) => {
        if (!window.WCGamesTranslation) return key;
        let text = window.WCGamesTranslation[key] || key;
        // Simple placeholder support {0}, {1}, etc.
        args.forEach((arg, i) => {
            text = text.replace(`{${i}}`, arg);
        });
        return text;
    },
    updatePlaceholders: () => {
        if (!window.WCGamesTranslation) return;
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (window.WCGamesTranslation[key]) {
                el.placeholder = window.WCGamesTranslation[key];
            }
        });
    },
    setLang: (lang) => {
        if (typeof updateTranslations === 'function') updateTranslations(lang);
    }
};
window.i18n = i18n;

// Listen for language changes to update placeholders (shared i18n handles innerText)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LANGUAGE_CHANGED') {
        // Give shared script a moment to fetch/set window.WCGamesTranslation
        setTimeout(() => i18n.updatePlaceholders(), 100);
    }
});
// Initial placeholder update
window.addEventListener('load', () => {
    setTimeout(() => i18n.updatePlaceholders(), 500);
});

let player;
let isGameStarted = false;
let isEditMode = false;
let startTime = 0;
let notes = [];
let recordedNotes = [];
let score = 0;
let combo = 0;
let lastLocalTime = 0;
let gameEndTimeout = null;
let countdownInterval = null;
let selectedNote = null;

let db = null;
let currentEditingSongId = null;
let currentUserEmail = null;
let isVerifyingPlayback = false; // Stage 2 verification flag

// Game States
const GameState = {
    MENU: 'MENU',
    SETUP: 'SETUP',
    PLAY: 'PLAY',
    EDIT: 'EDIT'
};
let currentState = GameState.MENU;

// Initialize Supabase if config exists
if (typeof WCGamesConfig !== 'undefined') {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = WCGamesConfig;
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Auth detection logic
    const initAuth = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        currentUserEmail = urlParams.get('u');

        // If not in URL, try to get from session
        if (!currentUserEmail) {
            try {
                const { data: { session } } = await db.auth.getSession();
                if (session && session.user) {
                    currentUserEmail = session.user.email;
                    console.log('Logged in as:', currentUserEmail);
                    // Reload songs to show edit/delete buttons if email was found late
                    if (currentState === GameState.MENU) loadSongs();
                }
            } catch (e) {
                console.warn('Session check failed', e);
            }
        }
    };
    initAuth();
}

// UI Elements
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const msgEl = document.getElementById('msg');
const ytUrlInput = document.getElementById('yt-url');
const setupUI = document.getElementById('setup-ui');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Constants
const LANES = 4;
const NOTE_SPEED = 0.5; // pixel per ms
const HIT_THRESHOLD = 150; // ms

// State
let laneFlashes = [0, 0, 0, 0];
let activeInputs = [null, null, null, null];
let particles = []; // Particle system for hit feedback

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// YouTube API Setup
function initYouTubePlayer(initialVideoId = null) {
    const videoId = initialVideoId || extractVideoId(ytUrlInput.value) || '60ItHLz5WEA'; // Default placeholder
    console.log('Initializing with ID:', videoId);

    // If player already exists, just load the new ID
    if (player && typeof player.loadVideoById === 'function') {
        player.cueVideoById(videoId);
        return;
    }

    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            playsinline: 1, // CRITICAL for iOS support
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.href
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });

    // CSS Pointer Events to hide overlay
    const playerEl = document.getElementById('player');
    if (playerEl) playerEl.style.pointerEvents = 'none';
}

function extractVideoId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

function getFullUrl() {
    const val = ytUrlInput.value.trim();
    if (!val) return "";
    if (val.includes("://") || val.includes("www.") || val.includes("youtube.")) return val;
    if (val.length === 11) return `https://www.youtube.com/watch?v=${val}`;
    return val;
}

// Call this when script loads
function onYouTubeIframeAPIReady() {
    console.log('YT API Ready');
    // Early initialization to ensure player object exists for iOS "unlock"
    initYouTubePlayer();
    loadSongs().then(() => {
        // Ready
    });
}
// If API already loaded (hot reload)
if (window.YT && window.YT.Player) {
    onYouTubeIframeAPIReady();
}

function onPlayerReady(event) {
    console.log('Player Ready');
}

function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    let errorKey = 'error';
    switch (event.data) {
        case 2: errorKey = 'invalid_url'; break;
        case 5: errorKey = 'video_error'; break;
        case 100: errorKey = 'video_error'; break;
        case 101:
        case 150: errorKey = 'restricted_video'; break;
    }
    const msg = i18n.t(errorKey);

    if (isVerifyingPlayback) {
        // Stage 2 Failure: Block registration immediately
        showCustomModal(i18n.t('registration_blocked'), msg, true);
        const urlInput = document.getElementById('yt-url');
        if (urlInput) urlInput.value = ''; // Reset input to force valid video
        isVerifyingPlayback = false;
    } else {
        showCustomModal(i18n.t('video_error'), msg + '\n' + i18n.t('video_error'), true);
    }
}

let isAutoMode = false;

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        // Generate notes if in auto mode and not already generated
        if (isAutoMode && notes.length === 0) {
            console.log('Auto-mode active but patterns are disabled (BPM removed).');
        }

        if (!isGameStarted) {
            // isGameStarted is set in startGame()
            // startTime is set in startGame()
            console.log('Video Playback Started - Syncing time');
        }
    } else if (event.data === YT.PlayerState.ENDED) {
        // End handling here if needed
    }
}

// --- Menu Controls ---

function setGameState(newState) {
    console.log(`Transitioning State: ${currentState} -> ${newState}`);
    currentState = newState;

    // Default: Hide all main UI containers
    const containers = [
        'song-selection', 'setup-modal-overlay', 'ui-overlay',
        'editor-ui', 'global-back-btn', 'player-ui-overlay',
        'countdown-overlay', 'custom-modal-overlay'
    ];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Handle specific state logic
    switch (newState) {
        case GameState.MENU:
            document.getElementById('song-selection').style.display = 'flex';
            if (player) {
                try {
                    if (typeof player.stopVideo === 'function') player.stopVideo();
                    if (typeof player.pauseVideo === 'function') player.pauseVideo();
                } catch (e) { console.warn('Player stop failed', e); }
            }
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            isGameStarted = false;
            isEditMode = false;
            currentEditingSongId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Reset editor inputs
            document.getElementById('song-title-input').value = '';
            document.getElementById('song-artist-input').value = '';
            ytUrlInput.value = '';
            break;

        case GameState.SETUP:
            document.getElementById('song-selection').style.display = 'flex'; // Keep list visible
            document.getElementById('setup-modal-overlay').style.display = 'flex';
            break;

        case GameState.PLAY:
            document.getElementById('ui-overlay').style.display = 'block';
            document.getElementById('playback-controls').style.display = 'none';
            document.getElementById('player-ui-overlay').style.display = 'none'; // Hide center play btn
            document.getElementById('global-back-btn').style.display = 'block';
            isEditMode = false;
            // Note: isGameStarted will be set in countdown finish
            break;

        case GameState.EDIT:
            document.getElementById('editor-ui').style.display = 'block';
            document.getElementById('player-ui-overlay').style.display = 'block'; // Show center play btn in editor
            document.getElementById('global-back-btn').style.display = 'block';
            isEditMode = true;
            isGameStarted = true;
            break;
    }

    resize();
}

const backBtn = document.getElementById('global-back-btn');
backBtn.addEventListener('click', () => {
    console.log('Back button clicked');
    setGameState(GameState.MENU);
});
backBtn.addEventListener('touchend', (e) => {
    // Prevent double fire but ensure it works on mobile
    if (e.cancelable) e.preventDefault();
    setGameState(GameState.MENU);
});

function startGame(edit = false, auto = false) {
    const url = getFullUrl();
    if (!url) {
        showCustomModal(i18n.t('required'), i18n.t('video_url_required'), true);
        return;
    }
    const videoId = extractVideoId(url);
    if (!videoId) {
        showCustomModal(i18n.t('error'), i18n.t('invalid_url'), true);
        return;
    }

    isAutoMode = auto;
    if (isAutoMode) notes = [];

    // Reset Game State
    score = 0;
    combo = 0;
    updateUI();

    if (gameEndTimeout) {
        clearTimeout(gameEndTimeout);
        gameEndTimeout = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Sort notes and reset state
    notes.sort((a, b) => a.time - b.time);
    notes.forEach(n => {
        n.hit = false;
        n.isHolding = false;
        n.missed = false;
        n.fullyDone = false;
    });

    // Set state first
    setGameState(edit ? GameState.EDIT : GameState.PLAY);

    // Ensure player is initialized
    if (!player) {
        initYouTubePlayer(videoId);
    } else {
        // iOS Unlock Logic: Direct user-click event MUST trigger playback.
        // We load the video, play it (muted), then immediately pause/seek.
        try {
            if (!edit) {
                player.loadVideoById({
                    videoId: videoId
                });
                // Mute for conservative autoplay policies
                if (player.mute) player.mute();
                player.playVideo();

                // Immediately pause and seek back to 0 to "unlock"
                setTimeout(() => {
                    if (player && typeof player.pauseVideo === 'function') {
                        player.pauseVideo();
                        player.seekTo(0);
                        if (player.unMute) player.unMute(); // Unmute for actual game start
                    }
                }, 500);
            } else {
                player.cueVideoById({ videoId });
            }
        } catch (e) {
            console.error("Player interaction failed:", e);
        }
    }

    // Reset Controls
    const startBtn = document.getElementById('main-play-btn');
    if (startBtn) startBtn.innerText = i18n.t('start');

    const seekbar = document.getElementById('editor-seekbar');
    if (seekbar) {
        seekbar.value = 0;
        try {
            seekbar.max = player && player.getDuration ? player.getDuration() : 0;
        } catch (e) { }
    }
    const timeEl = document.getElementById('editor-time');
    if (timeEl) timeEl.innerText = "0:00 / 0:00";

    // updateStartButton(); // Removed as it was undefined

    // Start game loop immediately for lead-in rendering
    lastVideoTime = 0;
    lastLocalTime = performance.now();
    isGameStarted = true;

    if (edit) {
        requestAnimationFrame(gameLoop);
    } else {
        // Start countdown with negative time sync
        const countdownSeconds = 3;
        startTime = lastLocalTime + (countdownSeconds * 1000); // Target sync point

        startCountdown(() => {
            if (player && typeof player.playVideo === 'function') {
                if (player.unMute) player.unMute();
                player.playVideo();
            }
        });
        requestAnimationFrame(gameLoop);
    }
}


function startCountdown(onComplete) {
    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');
    let count = 3;

    overlay.style.display = 'flex';
    text.innerText = count;
    playCountdownSound(count);

    countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            text.innerText = count;
            playCountdownSound(count);
        } else if (count === 0) {
            text.innerText = i18n.t('go');
            playCountdownSound(0);
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            overlay.style.display = 'none';
            if (onComplete) onComplete();
        }
    }, 1000);
}

function goBackToMenu() {
    setGameState(GameState.MENU);
}

document.getElementById('manual-btn').onclick = () => {
    if (!currentUserEmail) {
        window.parent.postMessage({ type: 'REQUEST_LOGIN' }, '*');
        return;
    }
    currentEditingSongId = null;
    notes = [];
    setGameState(GameState.SETUP);
};

document.getElementById('back-to-list').onclick = () => setGameState(GameState.MENU);
document.getElementById('edit-btn').onclick = () => startGame(true);

function togglePlay() {
    if (!player) return;
    const state = player.getPlayerState();
    const playBtns = [
        document.getElementById('main-play-btn'),
        document.getElementById('editor-play-btn'),
        document.getElementById('center-play-btn')
    ];

    const svgPlay = document.getElementById('svg-play');
    const svgPause = document.getElementById('svg-pause');

    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        playBtns.forEach(btn => {
            if (btn) {
                if (btn.id === 'center-play-btn') {
                    if (svgPlay) svgPlay.style.display = 'block';
                    if (svgPause) svgPause.style.display = 'none';
                } else {
                    btn.innerText = (btn.id === 'main-play-btn') ? i18n.t('start') : i18n.t('play');
                }
            }
        });
    } else {
        player.playVideo();
        if (currentState === GameState.EDIT || currentState === GameState.PLAY) {
            isGameStarted = true;
        }
        playBtns.forEach(btn => {
            if (btn) {
                if (btn.id === 'center-play-btn') {
                    if (svgPlay) svgPlay.style.display = 'none';
                    if (svgPause) svgPause.style.display = 'block';
                } else {
                    btn.innerText = (btn.id === 'main-play-btn') ? i18n.t('pause') : i18n.t('pause');
                }
            }
        });
    }
}

function stopAndReset() {
    if (!player) return;
    player.seekTo(0, true);
    player.pauseVideo();

    const playBtns = [document.getElementById('main-play-btn'), document.getElementById('editor-play-btn')];
    playBtns.forEach(btn => { if (btn) btn.innerText = (btn.id === 'main-play-btn') ? i18n.t('start') : i18n.t('play'); });

    lastVideoTime = 0;
    lastLocalTime = performance.now();

    notes.forEach(n => {
        n.hit = false;
        n.isHolding = false;
        n.missed = false;
        n.fullyDone = false;
    });
    score = 0;
    combo = 0;
    updateUI();
}

const playBtn = document.getElementById('main-play-btn');
if (playBtn) playBtn.onclick = togglePlay;
const editorPlayBtn = document.getElementById('editor-play-btn');
if (editorPlayBtn) editorPlayBtn.onclick = togglePlay;
const centerPlayBtn = document.getElementById('center-play-btn');
if (centerPlayBtn) centerPlayBtn.onclick = togglePlay;

const stopBtn = document.getElementById('main-stop-btn');
if (stopBtn) stopBtn.onclick = stopAndReset;
const editorStopBtn = document.getElementById('editor-stop-btn');
if (editorStopBtn) editorStopBtn.onclick = stopAndReset;

// Editor seekbar logic
const editorSeekbar = document.getElementById('editor-seekbar');
if (editorSeekbar) {
    editorSeekbar.oninput = (e) => {
        const time = parseFloat(e.target.value);
        const wasPaused = player.getPlayerState() !== YT.PlayerState.PLAYING;

        player.seekTo(time, true);
        if (wasPaused) player.pauseVideo();

        lastVideoTime = time * 1000;
        lastLocalTime = performance.now();

        notes.forEach(n => {
            if (n.time > lastVideoTime - 100) n.hit = false;
        });
    };
}

let modalTimeout = null;
async function showCustomModal(title, message, isAlert = false, isLoading = false) {
    const overlay = document.getElementById('custom-modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    // Clear any pending close timeout
    if (modalTimeout) {
        clearTimeout(modalTimeout);
        modalTimeout = null;
    }

    titleEl.innerText = title;
    messageEl.innerText = message;

    if (isAlert) {
        cancelBtn.style.display = 'none';
        confirmBtn.innerText = i18n.t('ok');
        confirmBtn.className = 'modal-btn modal-btn-confirm success';
        confirmBtn.disabled = false;
    } else if (isLoading) {
        cancelBtn.style.display = 'none';
        confirmBtn.innerText = i18n.t('processing');
        confirmBtn.className = 'modal-btn modal-btn-confirm';
        confirmBtn.disabled = true;
    } else {
        cancelBtn.style.display = 'block';
        confirmBtn.innerText = i18n.t('delete');
        confirmBtn.disabled = false;
        confirmBtn.className = 'modal-btn modal-btn-confirm';
    }

    overlay.style.display = 'flex';
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    if (isLoading) return; // Don't return promise for loading state

    return new Promise((resolve) => {
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            overlay.classList.remove('active');
            modalTimeout = setTimeout(() => {
                overlay.style.display = 'none';
                modalTimeout = null;
            }, 300);
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Update button text explicitly if needed
        if (isAlert) {
            confirmBtn.innerText = i18n.t('ok');
        } else if (isLoading) {
            confirmBtn.innerText = '...';
        } else {
            confirmBtn.innerText = i18n.t('delete');
        }
        cancelBtn.innerText = i18n.t('cancel');
    });
}

// Helper to check if a user has administrative privileges
function checkIsAdmin(email) {
    if (!email) return false;
    const normalizedEmail = email.toLowerCase().trim();
    return WCGamesConfig?.ADMIN_WHITELIST?.some(adminEmail => adminEmail.toLowerCase().trim() === normalizedEmail);
}

async function loadSongs() {
    if (!db) return;
    try {
        const { data, error } = await db.from('piano_tiles_songs').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        const listEl = document.getElementById('song-list');
        listEl.innerHTML = '';

        if (data.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; opacity: 0.5;">${i18n.t('no_songs')}</div>`;
            return;
        }

        data.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card';

            const isAdmin = checkIsAdmin(currentUserEmail);
            const isCreator = (song.editor_email && currentUserEmail && (song.editor_email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim())) || isAdmin;

            card.innerHTML = `
                <img class="thumb" src="${getThumbnail(song.youtube_url)}" alt="thumbnail">
                <div class="info">
                    <div class="title">
                        ${song.title} 
                        <span class="badges-container"></span>
                    </div>
                    <div class="artist">${song.artist}</div>
                </div>
            `;

            if (isCreator) {
                const badgeContainer = card.querySelector('.badges-container');

                const editBadge = document.createElement('span');
                editBadge.className = 'edit-badge';
                editBadge.innerText = i18n.t('edit');
                editBadge.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    editSong(song);
                };

                const deleteBadge = document.createElement('span');
                deleteBadge.className = 'delete-badge';
                deleteBadge.innerText = i18n.t('delete');
                deleteBadge.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteSong(song.id, song.title);
                };

                badgeContainer.appendChild(editBadge);
                badgeContainer.appendChild(deleteBadge);
            }

            card.onclick = (e) => {
                // Prevent selection if clicking inside badges container or on a badge
                if (e.target.closest('.badges-container') || e.target.classList.contains('edit-badge') || e.target.classList.contains('delete-badge')) {
                    return;
                }
                selectSong(song);
            };
            listEl.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading songs:', err);
    }
}

async function deleteSong(songId, songTitle) {
    if (!db) return;

    console.log('--- DELETION DIAGNOSTICS ---');
    console.log('Song ID:', songId);
    console.log('Logged in as:', currentUserEmail);

    const confirmed = await showCustomModal(i18n.t('delete_song_confirm_title'), i18n.t('delete_song_confirm_msg', songTitle));
    if (!confirmed) return;

    // Show loading state
    showCustomModal(i18n.t('saving'), i18n.t('updating_db'), false, true);

    try {
        console.log('Final confirmation. Deleting...');
        const { error, count } = await db.from('piano_tiles_songs').delete({ count: 'exact' }).eq('id', songId);

        if (error) {
            console.error('Database Error:', error);
            throw error;
        }

        console.log('Rows affected:', count);

        if (count === 0) {
            throw new Error(i18n.t('permission_denied', currentUserEmail || 'Anonymous'));
        }

        // Refresh the list immediately so it's gone in the background
        loadSongs();

        // If the deleted song was the one currently selected/loaded in setup, clear it
        if (ytUrlInput.value && extractVideoId(ytUrlInput.value) === extractVideoId(songId)) {
            ytUrlInput.value = '';
            notes = [];
            currentEditingSongId = null;
        }

        await showCustomModal(i18n.t('success'), i18n.t('song_deleted'), true);
    } catch (err) {
        console.error('Full Deletion Error Object:', err);
        const debugMsg = `
            ID: ${songId}
            User: ${currentUserEmail || 'None'}
            Error: ${err.message || 'Unknown'}
        `;
        showCustomModal(i18n.t('deletion_failed'), i18n.t('something_went_wrong', debugMsg), true);
    }
}

function getThumbnail(url) {
    const id = extractVideoId(url);
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

function selectSong(song) {
    playSelectSound();
    currentEditingSongId = null;
    ytUrlInput.value = extractVideoId(song.youtube_url);
    document.getElementById('song-title-input').value = song.title || '';
    document.getElementById('song-artist-input').value = song.artist || '';

    // Handle backward compatibility
    let rawData = song.notes_data;
    if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch (e) { rawData = []; }
    }

    if (rawData && !Array.isArray(rawData) && rawData.notes) {
        notes = rawData.notes;
    } else {
        notes = Array.isArray(rawData) ? rawData : [];
    }

    // Start playing immediately
    startGame(false);
}

function editSong(song) {
    playSelectSound();
    currentEditingSongId = song.id;
    ytUrlInput.value = extractVideoId(song.youtube_url);
    document.getElementById('song-title-input').value = song.title || '';
    document.getElementById('song-artist-input').value = song.artist || '';

    // Handle backward compatibility
    let rawData = song.notes_data;
    if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch (e) { rawData = []; }
    }

    if (rawData && !Array.isArray(rawData) && rawData.notes) {
        notes = rawData.notes;
    } else {
        notes = Array.isArray(rawData) ? rawData : [];
    }

    const noteCountEl = document.getElementById('note-count');
    if (noteCountEl) noteCountEl.innerText = notes.length;
    setGameState(GameState.SETUP);
    document.getElementById('edit-btn').click();
}

async function fetchYouTubeMetadata(url) {
    if (!url) return;

    // Normalize to full URL for consistency
    const fullUrl = getFullUrl();
    const videoId = extractVideoId(url);
    if (!videoId) return;

    // IMMEDIATE VALIDATION: Stage 1 (oEmbed)
    const isEmbeddable = await checkEmbeddable(fullUrl);
    if (!isEmbeddable) {
        showCustomModal(i18n.t('registration_blocked'), i18n.t('owner_disabled_embed'), true);
        ytUrlInput.value = ''; // Clear the input
        return;
    }

    // STAGE 2: Deep Verification (Silent Player Cue)
    // We cue the video to trigger YouTube's internal domain/licensing checks
    if (player && player.cueVideoById) {
        console.log('Starting Stage 2 Deep Verification for:', videoId);
        isVerifyingPlayback = true;
        try {
            player.cueVideoById(videoId);
            // Reset verification flag after 3 seconds if no error occurs
            setTimeout(() => { isVerifyingPlayback = false; }, 3000);
        } catch (err) {
            console.warn("Deep verification trigger failed:", err);
            isVerifyingPlayback = false;
        }
    }

    const titleIn = document.getElementById('song-title-input');
    const artistIn = document.getElementById('song-artist-input');

    // Only auto-fetch if fields are empty or have default "Unknown" values
    const shouldFetch = !titleIn.value.trim() ||
        titleIn.value === "Unknown Title" ||
        !artistIn.value.trim() ||
        artistIn.value === "Unknown Artist";

    if (shouldFetch) {
        try {
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(fullUrl)}`);
            const data = await response.json();
            if (data.title) {
                let title = data.title;
                let artist = data.author_name || "Unknown Artist";

                const parts = data.title.split(' - ');
                if (parts.length > 1) {
                    artist = parts[0];
                    title = parts[1];
                }

                if (!titleIn.value.trim() || titleIn.value === "Unknown Title") titleIn.value = title;
                if (!artistIn.value.trim() || artistIn.value === "Unknown Artist") artistIn.value = artist;
            }
        } catch (e) {
            console.warn("Metadata fetch failed", e);
        }
    }

    // Also proactively cue the video in the player
    if (player && player.cueVideoById) {
        try {
            player.cueVideoById(videoId);
        } catch (err) {
            console.warn("Proactive cue failed:", err);
        }
    }
}

// Auto-fetch metadata when URL changes
ytUrlInput.addEventListener('blur', () => fetchYouTubeMetadata(ytUrlInput.value));
ytUrlInput.addEventListener('change', () => fetchYouTubeMetadata(ytUrlInput.value));

async function saveSongToDB() {
    if (!db) {
        showCustomModal(i18n.t('error'), i18n.t('db_not_connected'), true);
        return;
    }

    const url = getFullUrl();
    if (!url) {
        showCustomModal(i18n.t('required'), i18n.t('video_url_required'), true);
        return;
    }

    // Proactive Verification: Check if the video is embeddable before saving
    showCustomModal(i18n.t('verifying'), i18n.t('checking_restrictions'), false, true);
    const isEmbeddable = await checkEmbeddable(url);
    if (!isEmbeddable) {
        showCustomModal(i18n.t('registration_blocked'), i18n.t('owner_disabled_embed'), true);
        return;
    }

    // Show loading state immediately
    showCustomModal(i18n.t('saving'), i18n.t('updating_db'), false, true);

    let title = document.getElementById('song-title-input').value.trim();
    let artist = document.getElementById('song-artist-input').value.trim();

    // If fields are empty, try one last fetch and wait for it
    if (!title || !artist || title === "Unknown Title") {
        console.log('Fields empty or default, attempting one last metadata fetch...');
        try {
            const response = await fetch(`https://noembed.com/embed?url=${url}`);
            const data = await response.json();
            if (data.title) {
                let fetchedTitle = data.title;
                let fetchedArtist = data.author_name || "Unknown Artist";
                const parts = data.title.split(' - ');
                if (parts.length > 1) {
                    fetchedArtist = parts[0];
                    fetchedTitle = parts[1];
                }
                if (!title || title === "Unknown Title") title = fetchedTitle;
                if (!artist || artist === "Unknown Artist") artist = fetchedArtist;

                // Update UI too
                document.getElementById('song-title-input').value = title;
                document.getElementById('song-artist-input').value = artist;
            }
        } catch (e) { console.warn("Final metadata fetch failed", e); }
    }

    // Handlers for defaults
    title = title || "Unknown Title";
    artist = artist || "Unknown Artist";

    console.log('--- SAVE DIAGNOSTICS ---');
    console.log('Payload Title:', title);
    console.log('Payload Artist:', artist);
    console.log('Payload URL:', url);
    console.log('User:', currentUserEmail);
    console.log('Editing ID:', currentEditingSongId);

    try {
        const payload = {
            title,
            artist,
            youtube_url: url,
            notes_data: {
                notes: notes
            },
            editor_email: currentUserEmail
        };

        let result;
        if (currentEditingSongId) {
            console.log('Performing UPDATE...');
            result = await db.from('piano_tiles_songs').update(payload).eq('id', currentEditingSongId).select();
        } else {
            console.log('Performing INSERT...');
            result = await db.from('piano_tiles_songs').insert([payload]).select();
        }

        if (result.error) {
            console.error('Database Error:', result.error);
            throw result.error;
        }

        console.log('Save result data:', result.data);
        if (!result.data || result.data.length === 0) {
            console.warn('Success but no data returned (RLS might have blocked it)');
            throw new Error('Save failed: Permission denied or record not found.');
        }

        await showCustomModal(i18n.t('success'), i18n.t('map_saved'), true);
        goBackToMenu();
        loadSongs();
    } catch (err) {
        console.error('Save failed error object:', err);
        const debugMsg = `
            Env: ${currentUserEmail || 'Not Logged In'}
            ID: ${currentEditingSongId || 'New Song'}
            Error: ${err.message || 'Check Console'}
        `;
        showCustomModal(i18n.t('save_failed'), i18n.t('something_went_wrong', debugMsg), true);
    }
}

document.getElementById('save-db-btn').onclick = saveSongToDB;

// --- Gameplay Logic ---

window.addEventListener('keydown', e => {
    if (!isGameStarted) return;
    const key = e.key.toUpperCase();
    const map = { 'D': 0, 'F': 1, 'J': 2, 'K': 3 };
    if (map[key] !== undefined) handleInputDown(map[key]);
});

window.addEventListener('keyup', e => {
    if (!isGameStarted) return;
    const key = e.key.toUpperCase();
    const map = { 'D': 0, 'F': 1, 'J': 2, 'K': 3 };
    if (map[key] !== undefined) handleInputUp(map[key]);
});

window.addEventListener('keydown', e => {
    if (isEditMode && selectedNote) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            notes = notes.filter(n => n !== selectedNote);
            selectedNote = null;
            document.getElementById('note-count').innerText = notes.length;
        }
    }
});

canvas.addEventListener('contextmenu', e => {
    if (isEditMode) e.preventDefault();
});

const handlePointer = (e) => {
    if (!isGameStarted) return;
    e.preventDefault();
    const isDown = e.type === 'mousedown' || e.type === 'touchstart';
    const rect = canvas.getBoundingClientRect();

    const now = performance.now();
    const videoTimeMs = player.getCurrentTime() * 1000;
    const currentTime = videoTimeMs + (now - lastLocalTime);

    // Right-click delete in editor
    if (isDown && e.button === 2 && isEditMode) {
        const x = e.clientX - rect.left;
        const laneIdx = Math.floor((x / rect.width) * LANES);
        const targetNote = findNoteAt(laneIdx, currentTime);
        if (targetNote) {
            notes = notes.filter(n => n !== targetNote);
            if (selectedNote === targetNote) selectedNote = null;
            document.getElementById('note-count').innerText = notes.length;
        }
        return;
    }

    const processTouches = (touches) => {
        for (let i = 0; i < touches.length; i++) {
            const x = touches[i].clientX - rect.left;
            const laneIdx = Math.floor((x / rect.width) * LANES);
            if (isDown) handleInputDown(laneIdx);
            else handleInputUp(laneIdx);
        }
    };

    if (e.changedTouches) {
        processTouches(e.changedTouches);
    } else {
        const x = e.clientX - rect.left;
        const laneIdx = Math.floor((x / rect.width) * LANES);
        if (isDown) handleInputDown(laneIdx);
        else handleInputUp(laneIdx);
    }
};

canvas.addEventListener('mousedown', handlePointer);
canvas.addEventListener('touchstart', handlePointer, { passive: false });
window.addEventListener('mouseup', handlePointer);
window.addEventListener('touchend', handlePointer);

function handleInputDown(laneIdx) {
    if (!isGameStarted) return;
    const now = performance.now();
    const videoTimeMs = player.getCurrentTime() * 1000;
    const currentTime = videoTimeMs + (now - lastLocalTime);

    laneFlashes[laneIdx] = 1.0;
    if (isEditMode) {
        // Simple hit detection for selection
        const targetNote = findNoteAt(laneIdx, currentTime);
        if (targetNote) {
            selectedNote = targetNote;
            return;
        }
        selectedNote = null;
        activeInputs[laneIdx] = { startTime: currentTime };
    } else {
        // Find the earliest unhit, unmissed note in this lane
        for (let n of notes) {
            if (!n.hit && !n.missed && n.lane === laneIdx) {
                const diff = Math.abs(n.time - currentTime);
                if (diff < HIT_THRESHOLD) {
                    if (n.duration) {
                        n.isHolding = true;
                        activeInputs[laneIdx] = { startTime: currentTime, noteRef: n };
                    } else {
                        n.hit = true;
                        // n.fullyDone = true; // Removed: Let the note fall through the screen
                        processHit(diff, laneIdx);
                    }
                    return; // Processed
                } else if (currentTime > n.time + HIT_THRESHOLD) {
                    // Note already too far past to hit
                    continue;
                } else {
                    // Note still in the future, don't look further
                    break;
                }
            }
        }
    }
}

function handleInputUp(laneIdx) {
    const inputState = activeInputs[laneIdx];
    if (!inputState) return;

    const now = performance.now();
    const videoTimeMs = player.getCurrentTime() * 1000;
    const currentTime = videoTimeMs + (now - lastLocalTime);

    if (isEditMode) {
        const duration = Math.round(currentTime - inputState.startTime);
        const note = {
            time: Math.round(inputState.startTime),
            lane: laneIdx,
            hit: false,
            fullyDone: false
        };
        if (duration > 200) note.duration = duration;
        notes.push(note);
        document.getElementById('note-count').innerText = notes.length;
    } else if (inputState.noteRef) {
        const n = inputState.noteRef;
        const actualDuration = currentTime - inputState.startTime;
        const durationDiff = Math.abs(actualDuration - n.duration);
        n.hit = true;
        n.isHolding = false;
        // n.fullyDone = true; // Removed: Let the tail fall through
        processHit(durationDiff, laneIdx, 'RELEASE');
    }

    activeInputs[laneIdx] = null;
    laneFlashes[laneIdx] = 0;
}

function processHit(diff, laneIdx, type = 'TAP') {
    if (isEditMode) return;

    // Add particles for feedback
    const laneWidth = canvas.width / LANES;
    const hitLineY = canvas.height * 0.85;
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: laneIdx * laneWidth + laneWidth / 2,
            y: hitLineY,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 1) * 10,
            life: 1.0,
            color: type === 'RELEASE' ? '#f472b6' : '#22d3ee'
        });
    }

    let rating = i18n.t('perfect');
    let color = '#22d3ee';
    let points = 1000;

    if (diff > 100) {
        rating = i18n.t('good');
        color = '#22c55e';
        points = 500;
    } else if (diff > 50) {
        rating = i18n.t('great');
        color = '#a855f7';
        points = 800;
    }

    laneFlashes[laneIdx] = 0.5;
    combo++;
    score += points + (combo * 10);
    showMsg(rating, color);
    updateUI();
}

function showMsg(text, color) {
    msgEl.innerText = text;
    msgEl.style.color = color;
    msgEl.classList.remove('hit');
    void msgEl.offsetWidth; // Force reflow to restart animation
    msgEl.classList.add('hit');
}

function updateUI() {
    scoreEl.innerText = score.toLocaleString().padStart(7, '0');
    comboEl.innerHTML = `<span data-i18n="combo_label">${i18n.t('combo_label')}</span> ${combo}`;
}

// --- Rendering ---
function gameLoop() {
    if (!player || typeof player.getPlayerState !== 'function') {
        if (currentState !== GameState.MENU) requestAnimationFrame(gameLoop);
        return;
    }
    // Stop loop if we are back in menu
    if (currentState === GameState.MENU) return;

    let state;
    try {
        state = player.getPlayerState();
    } catch (e) {
        requestAnimationFrame(gameLoop);
        return;
    }

    let videoTimeMs = 0;
    try {
        videoTimeMs = player.getCurrentTime() * 1000;
    } catch (e) { }

    const now = performance.now();
    const isPlaying = (state === YT.PlayerState.PLAYING);
    let currentTime;

    if (isPlaying) {
        // Sync local clock to video clock only when video moves or at very start
        if (videoTimeMs !== lastVideoTime || (videoTimeMs === 0 && lastLocalTime === 0)) {
            lastVideoTime = videoTimeMs;
            lastLocalTime = now;
        }
        currentTime = videoTimeMs + (now - lastLocalTime);
    } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.BUFFERING) {
        currentTime = videoTimeMs;
        lastVideoTime = videoTimeMs;
        lastLocalTime = now;
    } else if (isGameStarted && !isEditMode) {
        // Lead-in period (Countdown)
        currentTime = -(startTime - now);
    } else {
        currentTime = videoTimeMs;
    }

    // Update Editor UI
    const seekbar = document.getElementById('editor-seekbar');
    const timeEl = document.getElementById('editor-time');

    if (seekbar || timeEl) {
        let duration = 0;
        let vTime = 0;
        try {
            duration = player.getDuration() || 0;
            vTime = player.getCurrentTime() || 0;
        } catch (e) { }

        if (seekbar && duration > 0) {
            seekbar.max = duration;
            seekbar.value = vTime;
        }

        if (timeEl) {
            const formatTime = (s) => {
                if (isNaN(s) || s < 0) return "0:00";
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return `${m}:${sec.toString().padStart(2, '0')}`;
            };
            timeEl.innerText = `${formatTime(vTime)} / ${formatTime(duration)}`;
        }
    }

    const syncOffsetInput = null; // Removed

    // Handle recording dot blinking
    const recDot = document.getElementById('rec-dot');
    if (recDot) {
        if (isPlaying && currentState === GameState.EDIT) {
            recDot.classList.add('blinking');
        } else {
            recDot.classList.remove('blinking');
        }
    }

    // Update Bottom Progress Fill
    const bottomFill = document.getElementById('bottom-progress-fill');
    if (bottomFill) {
        let duration = 0;
        let vTime = 0;
        try {
            duration = player.getDuration() || 0;
            vTime = player.getCurrentTime() || 0;
        } catch (e) { }
        if (duration > 0) {
            bottomFill.style.width = `${(vTime / duration) * 100}%`;
        }
    }

    // Check for game end with a safety buffer to let final notes fall
    if (state === YT.PlayerState.ENDED) {
        if (!gameEndTimeout) {
            gameEndTimeout = setTimeout(() => {
                if (isGameStarted) {
                    isGameStarted = false;
                    console.log("Game Ended - Buffer expired");
                }
                gameEndTimeout = null;
            }, 3000);
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Add contrast overlay
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5; // gravity
        p.life -= 0.05;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    const laneWidth = canvas.width / LANES;
    const hitLineY = canvas.height * 0.85;

    for (let i = 0; i < LANES; i++) {
        if (activeInputs[i]) {
            laneFlashes[i] = 1.0;
        }

        if (laneFlashes[i] > 0) {
            ctx.fillStyle = `rgba(34, 211, 238, ${laneFlashes[i] * 0.3})`;
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            if (!activeInputs[i]) laneFlashes[i] -= 0.05;
        }

        if (i > 0) {
            ctx.strokeStyle = `rgba(34, 211, 238, 0.1)`;
            ctx.beginPath();
            ctx.moveTo(i * laneWidth, 0);
            ctx.lineTo(i * laneWidth, canvas.height);
            ctx.stroke();
        }
    }

    ctx.strokeStyle = `rgba(34, 211, 238, 0.3)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(canvas.width, hitLineY);
    ctx.stroke();

    // Travel Time Calculation
    const travelTime = hitLineY / NOTE_SPEED;

    notes.forEach(note => {
        if (note.fullyDone) return;

        const timeDiff = note.time - currentTime;
        const y = hitLineY - (timeDiff * NOTE_SPEED);
        const h = note.duration ? note.duration * NOTE_SPEED : 0;

        // Long note tail position (top edge as it falls)
        const tailY = y - h;

    // Visual Miss Threshold
    if (!note.hit && !note.missed && currentTime > note.time + HIT_THRESHOLD) {
            if (!isEditMode) {
                note.missed = true;
                combo = 0;
                updateUI();
            }
        }

        // Cleanup: Extremely generous boundary (2000px) to prevent "popping"
        if (tailY > canvas.height + 2000) {
            note.fullyDone = true;
            return;
        }

        if (y < -200) return;

        // Rendering
        const laneX = note.lane * laneWidth;
        ctx.save();

        // Highlight if selected
        if (isEditMode && selectedNote === note) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(laneX + 5, y - h - 5, laneWidth - 10, (h || 30) + 10);
        }

        if (note.hit) {
            ctx.globalAlpha = 0.6;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#fff';
        } else if (note.missed) {
            ctx.globalAlpha = 0.3;
        }

        if (note.duration) {
            // NO CLIPPING - Let the note fall naturally past the line
            if (note.hit) {
                ctx.fillStyle = 'rgba(34, 211, 238, 0.6)';
            } else {
                ctx.fillStyle = note.isHolding ? 'rgba(255, 255, 255, 1)' : 'rgba(34, 211, 238, 0.9)';
            }
            ctx.fillRect(laneX + 10, y - h, laneWidth - 20, h);

            // Leading edge
            ctx.fillStyle = '#fff';
            ctx.fillRect(laneX + 5, y - 5, laneWidth - 10, 10);

            if (note.isHolding) {
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#22d3ee';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(laneX + 5, y - 5, laneWidth - 10, 10);
            }
        } else {
            ctx.fillStyle = note.hit ? '#fff' : (note.missed ? '#555' : '#fff');
            ctx.fillRect(laneX + 5, y - 10, laneWidth - 10, 20);
        }
        ctx.restore();
    });

    // console.log(`Rendering frame: t=${Math.round(currentTime)} notes=${notes.length}`);

    if (currentState !== GameState.MENU) requestAnimationFrame(gameLoop);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSelectSound() {
    console.log('--- SFX: Selection Sound Played ---');
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Short, bright sine beep for selection
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playCountdownSound(count) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sine';
    // Higher pitch for "GO!" (count 0)
    const freq = count === 0 ? 880 : 440;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function copyMap() {
    const data = JSON.stringify(notes);
    navigator.clipboard.writeText(data).then(() => showCustomModal(i18n.t('copied'), i18n.t('map_copied'), true));
}

async function testRecording() {
    isEditMode = false;
    isGameStarted = true;
    score = 0;
    combo = 0;
    updateUI();

    // Reset and sort notes
    notes.sort((a, b) => a.time - b.time);
    notes.forEach(n => {
        n.hit = false;
        n.missed = false;
        n.isHolding = false;
        n.fullyDone = false;
    });

    player.seekTo(0);
    player.playVideo();
}

function findNoteAt(lane, time) {
    const THRESHOLD = 300; // ms tolerance for clicking
    return notes.find(n => n.lane === lane && Math.abs(n.time - time) < THRESHOLD);
}

async function checkEmbeddable(url) {
    try {
        // Use noembed as a proxy to bypass potential CORS issues with direct YouTube oEmbed
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (!response.ok) return false;

        const data = await response.json();

        // If data.error exists or title is missing, it's likely private or invalid
        if (data.error || !data.title) return false;

        // noembed returns an 'html' field if it's a video that can be embedded
        return !!data.html;
    } catch (e) {
        console.warn("Embed check failed:", e);
        return false;
    }
}

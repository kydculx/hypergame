// Lightweight iframe i18n script
const I18N_STORAGE_KEY = 'i18nextLng';

function autoTagElements() {
    // Dynamically assign data-i18n tags based on standard WCGames CSS structure

    // Start Screen
    const startTitle = document.querySelector('#start-screen h1') || document.querySelector('#start-screen h2');
    if (startTitle) startTitle.setAttribute('data-i18n', 'title');

    const startInst = document.querySelector('#start-screen p');
    if (startInst) startInst.setAttribute('data-i18n', 'instruction');

    const startBtn = document.querySelector('#start-screen button');
    if (startBtn) startBtn.setAttribute('data-i18n', 'play');

    // Game Over Screen (Handles #game-over, #game-over-screen, #game-over-modal)
    const overTitle = document.querySelector('[id*="game-over"] h1') || document.querySelector('[id*="game-over"] div.title');
    if (overTitle) overTitle.setAttribute('data-i18n', 'game_over');

    // The "Final Score:" text node before the span
    const overScoreWrap = document.querySelector('[id*="game-over"] p') || document.querySelector('[id*="game-over"] div[style*="font-size: 24px"]');
    if (overScoreWrap) {
        // We will just tag the text node if possible, or wrap it. 
        // For simplicity, we create a specific key for 'Final Score: ' and set it.
        // But since the child is a span with the score, we can't just replace innerHTML.
        // Let's create a span around the text node.
        Array.from(overScoreWrap.childNodes).forEach(node => {
            if (node.nodeType === 3 && node.textContent.trim().length > 0) { // Text node
                const span = document.createElement('span');
                span.setAttribute('data-i18n', 'final_score');
                // The span wrapper doesn't have the text yet, updateTranslations will fill it.
                overScoreWrap.insertBefore(span, node);
                node.remove();
            }
        });
    }

    const overBtn = document.querySelector('[id*="game-over"] button');
    if (overBtn) overBtn.setAttribute('data-i18n', 'play_again');
}

async function updateTranslations(lang) {
    const normalizedLang = lang.startsWith('ko') ? 'ko' : 'en';

    try {
        const res = await fetch(`locales/${normalizedLang}/translation.json`);
        if (!res.ok) throw new Error('Translation not found');
        const translations = await res.json();

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.innerText = translations[key];
            }
        });
    } catch (e) {
        console.error('Failed to load translations:', e);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    autoTagElements();

    let currentLang = 'en';
    try {
        const stored = localStorage.getItem(I18N_STORAGE_KEY);
        if (stored) currentLang = stored;
    } catch (e) { }

    updateTranslations(currentLang);
});

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LANGUAGE_CHANGED') {
        updateTranslations(event.data.payload.lang);
    }
});

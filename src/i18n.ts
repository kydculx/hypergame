import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import Platform Translations
import translationEN from './locales/en/translation.json';
import translationKO from './locales/ko/translation.json';

// Utility to build games mapping from glob
function buildGameLocales(globResult: Record<string, any>) {
    const folderToGameId: Record<string, string> = {
        'stack': 'stack-tower',
        'neon': 'neon-jump',
        'breakout': 'neon-breakout'
    };
    const gamesLocal: Record<string, any> = {};
    for (const path in globResult) {
        // Path Example: '../public/games/2048/locales/en/translation.json'
        const parts = path.split('/');
        const folderName = parts[3]; // corrected index: .. (0), public (1), games (2), 2048 (3)
        const gameId = folderToGameId[folderName] || folderName;
        gamesLocal[gameId] = globResult[path].default || globResult[path];
    }
    return gamesLocal;
}

const resources = {
    en: {
        translation: {
            ...translationEN,
            games: buildGameLocales(import.meta.glob('../public/games/*/locales/en/translation.json', { eager: true }))
        }
    },
    ko: {
        translation: {
            ...translationKO,
            games: buildGameLocales(import.meta.glob('../public/games/*/locales/ko/translation.json', { eager: true }))
        }
    }
};

i18n
    // Detects user language from browser settings and localStorage
    .use(LanguageDetector)
    // Passes i18n instance to react-i18next
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'ko',
        supportedLngs: ['ko', 'en'],
        interpolation: {
            escapeValue: false, // React already safeguards against XSS
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'], // caches the language in local storage
        }
    });

export default i18n;

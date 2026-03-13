/**
 * Global Type Definitions for WCGames
 */

export interface WCGamesConfig {
    ADMIN_WHITELIST?: string[];
    GTM_ID?: string;
    ADSENSE_ID?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    GAME_DIMENSIONS?: {
        PORTRAIT: { width: number, height: number };
        LANDSCAPE: { width: number, height: number };
    };
}

declare global {
    interface Window {
        WCGamesConfig?: WCGamesConfig;
    }
}

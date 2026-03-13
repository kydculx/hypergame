/**
 * WCGames Shared Configuration
 * This file contains global settings for all WCGames and the platform.
 */
window.WCGamesConfig = {
    // Admin email whitelist for accessing debug tools and cheats
    ADMIN_WHITELIST: [
        'kydculx@gmail.com'
    ],
    // Google Tag Manager ID
    GTM_ID: 'GTM-KZ2RT667',
    // AdSense Publisher ID
    ADSENSE_ID: 'ca-pub-6684397532194817',
    // Supabase Configuration
    SUPABASE_URL: 'https://mwjyhytwdqokszwqzeot.supabase.co',
    // Note: This is an anonymous public key, safe to include in client-side code
    SUPABASE_ANON_KEY: 'sb_publishable_enOATIXffA7szKBGrRVQjg_dhoBdzfP',
    // Standard Game Dimensions
    GAME_DIMENSIONS: {
        PORTRAIT: { width: 480, height: 854 },
        LANDSCAPE: { width: 854, height: 480 } // Using standard HD-ready as default
    }
};

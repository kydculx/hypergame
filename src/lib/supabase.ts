import { createClient } from '@supabase/supabase-js';

// WCGamesConfig is now defined in src/types/wcgames.d.ts

const config = window.WCGamesConfig || {};
const supabaseUrl = config.SUPABASE_URL;
const supabaseAnonKey = config.SUPABASE_ANON_KEY;

// Warn instead of crashing if keys are missing (allows UI to load during dev)
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables in WCGamesConfig. Leaderboard will be disabled.');
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

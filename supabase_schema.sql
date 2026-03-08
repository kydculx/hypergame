-- 1. Create scores table if it doesn't exist
CREATE TABLE IF NOT EXISTS scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id text NOT NULL,
  user_name text NOT NULL,
  score integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ENABLE RLS
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES
DROP POLICY IF EXISTS "Leaderboard is public" ON scores;
CREATE POLICY "Leaderboard is public" ON scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert scores" ON scores;
-- In a real production app, you might want to switch this to authenticated users only
-- or use a service role for insertion from a secure backend.
-- For now, we keep it as is but note the risk.
CREATE POLICY "Anyone can insert scores" ON scores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own scores" ON scores;
-- Restrict updates: only if the system matches (placeholder for more advanced auth logic)
-- If using Supabase Auth, you would use: USING (auth.uid() = id) 
-- Since we are currently using an anonymous setup with user_name, we should at least 
-- ensure that updates are not globally allowed without restriction.
CREATE POLICY "Users can update their own scores" ON scores FOR UPDATE USING (false); 
-- Note: Setting to false effectively disables public updates until a proper auth check is added.


-- 4. [CRITICAL] UNIQUE CONSTRAINT AND CLEANUP
-- upsert functioning correctly depends on this constraint.
-- First, cleanup any duplicates that would prevent adding the constraint:
DELETE FROM scores
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id, user_name ORDER BY score DESC, created_at ASC) as rn
    FROM scores
  ) t
  WHERE t.rn = 1
);

-- Add the unique constraint
ALTER TABLE scores DROP CONSTRAINT IF EXISTS unique_user_game;
ALTER TABLE scores ADD CONSTRAINT unique_user_game UNIQUE (game_id, user_name);

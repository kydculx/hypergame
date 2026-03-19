# Database Schema (Supabase)

## Tables
- **`game_stats`**: Tracks total play counts.
  - `game_id` (PK)
  - `play_count` (int)
- **`game_daily_stats`**: Tracks daily play counts for trends.
  - `game_id` (FK)
  - `date` (date)
  - `play_count` (int)
- **`scores`**: User rankings.
  - `game_id`, `user_name`, `score`, `created_at`.
- **`messages`**: Chat history.
- **`posts` / `comments`**: Community board data.

- **`piano_tiles_songs`**: Stores rhythm game tracks.
  - `id` (uuid, PK)
  - `title` (text)
  - `artist` (text)
  - `youtube_url` (text)
  - `bpm` (int)
  - `notes_data` (jsonb)
  - `created_at` (timestamp with time zone)

```sql
CREATE TABLE piano_tiles_songs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  artist text,
  youtube_url text NOT NULL,
  bpm integer NOT NULL,
  notes_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE piano_tiles_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON piano_tiles_songs FOR SELECT USING (true);
CREATE POLICY "Allow anon insert (for demo)" ON piano_tiles_songs FOR INSERT WITH CHECK (true);
```

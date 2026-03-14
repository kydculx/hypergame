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

## Functions (PostgreSQL / RPC)
- **`increment_play_count`**:
  ```sql
  -- Logic:
  -- 1. Update game_stats (total)
  -- 2. Upsert into game_daily_stats for CURRENT_DATE
  ```

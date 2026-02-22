-- Create a table for global high scores
create table scores (
  id uuid default gen_random_uuid() primary key,
  game_id text not null,
  user_name text not null,
  score integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table scores enable row level security;

-- Policy: Allow anyone to read the leaderboard
create policy "Leaderboard is public"
  on scores for select
  using (true);

-- Policy: Allow anonymous users to submit scores
create policy "Anyone can insert scores"
  on scores for insert
  with check (true);

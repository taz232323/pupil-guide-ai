
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_username text;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS leaderboard_anonymous boolean NOT NULL DEFAULT false;

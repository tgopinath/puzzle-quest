-- Puzzle Quest — hosted schema (Supabase / PostgreSQL)
-- Mirrors src/core/db.ts. Parents sign in with Supabase Auth; children never have logins.

create table users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  parent_name text not null,
  email       text not null,
  pin_hash    text not null,              -- bcrypt of the 4-digit parent PIN
  created_at  timestamptz not null default now()
);

create table children (
  child_id   uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references users(user_id) on delete cascade,
  child_name text not null check (char_length(child_name) <= 20),
  age_group  text not null check (age_group in ('junior','thinker','master')),
  avatar     text not null,
  costume    text,
  xp int not null default 0, coins int not null default 20, stars int not null default 0,
  streak_count int not null default 0, streak_best int not null default 0, streak_last_day date,
  world_levels jsonb not null default '{}',
  owned_costumes text[] not null default '{}',
  unlocked_avatars text[] not null default '{}',
  daily_done date,
  created_at timestamptz not null default now()
);

create table child_settings (
  child_id uuid primary key references children(child_id) on delete cascade,
  sound boolean not null default true,
  timers boolean not null default true,
  audio_instructions boolean not null default true,
  daily_limit_min int not null default 0
);

create table puzzle_categories (
  category_id   text primary key,           -- jigsaw, shapes, number, arrange, memory, logic, pattern, maze
  category_name text not null,
  description   text
);

-- Puzzles are generated procedurally; this table holds admin-authored content
-- (custom odd-one-out sets, picture stories) and optional fixed puzzles.
create table puzzles (
  puzzle_id      uuid primary key default gen_random_uuid(),
  category_id    text not null references puzzle_categories(category_id),
  difficulty     smallint not null check (difficulty between 1 and 5),
  question_data  jsonb not null,
  answer_data    jsonb not null,
  hint_data      jsonb,
  estimated_time int not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table game_progress (
  progress_id        uuid primary key default gen_random_uuid(),
  child_id           uuid not null references children(child_id) on delete cascade,
  category_id        text not null references puzzle_categories(category_id),
  current_difficulty smallint not null check (current_difficulty between 1 and 5),
  history            jsonb not null default '[]',   -- engine window since last change
  completed_puzzles  int not null default 0,
  attempts           int not null default 0,
  correct            int not null default 0,
  support_next       boolean not null default false,
  updated_at         timestamptz not null default now(),
  unique (child_id, category_id)
);

create table puzzle_attempts (
  attempt_id     uuid primary key default gen_random_uuid(),
  child_id       uuid not null references children(child_id) on delete cascade,
  puzzle_id      text not null,               -- generated id (category-difficulty-seed) or puzzles.puzzle_id
  category_id    text not null references puzzle_categories(category_id),
  difficulty     smallint not null,
  is_correct     boolean not null,
  time_taken     int not null,
  expected_time  int not null,
  hints_used     int not null,
  mistakes       int not null,
  attempts_count int not null,                 -- retries + 1
  score          real not null,
  stars          smallint not null,
  is_daily       boolean not null default false,
  completed_at   timestamptz not null default now()
);
create index on puzzle_attempts (child_id, completed_at desc);

create table achievements (
  achievement_id   text primary key,
  achievement_name text not null,
  description      text not null,
  reward_type      text not null check (reward_type in ('coins','avatar','costume')),
  reward_value     text not null
);

create table child_achievements (
  child_id       uuid not null references children(child_id) on delete cascade,
  achievement_id text not null references achievements(achievement_id),
  earned_at      timestamptz not null default now(),
  primary key (child_id, achievement_id)
);

create table play_sessions (
  child_id uuid not null references children(child_id) on delete cascade,
  day      date not null,
  seconds  int not null default 0,
  primary key (child_id, day)
);

-- ---------- Row-level security: a parent only ever sees their own children ----------
alter table users              enable row level security;
alter table children           enable row level security;
alter table child_settings     enable row level security;
alter table game_progress      enable row level security;
alter table puzzle_attempts    enable row level security;
alter table child_achievements enable row level security;
alter table play_sessions      enable row level security;
alter table puzzles            enable row level security;
alter table puzzle_categories  enable row level security;
alter table achievements       enable row level security;

create policy own_user on users for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_children on children for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create or replace function owns_child(c uuid) returns boolean language sql stable security definer as
$$ select exists (select 1 from children where child_id = c and parent_id = auth.uid()) $$;

create policy own_settings     on child_settings     for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy own_progress     on game_progress      for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy own_attempts     on puzzle_attempts    for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy own_achievements on child_achievements for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy own_sessions     on play_sessions      for all using (owns_child(child_id)) with check (owns_child(child_id));

-- Catalog tables are readable by signed-in parents; writes are admin-only (service role).
create policy read_puzzles      on puzzles           for select using (auth.role() = 'authenticated' and active);
create policy read_categories   on puzzle_categories for select using (auth.role() = 'authenticated');
create policy read_achievements on achievements      for select using (auth.role() = 'authenticated');

insert into puzzle_categories values
  ('jigsaw','Jigsaw','Assemble a picture from pieces'),
  ('shapes','Shapes','Match and rotate shapes into outlines'),
  ('number','Numbers','Counting, sequences and arithmetic'),
  ('arrange','Stories','Put pictures in order'),
  ('memory','Memory','Find matching pairs'),
  ('logic','Logic','Odd one out and analogies'),
  ('pattern','Patterns','Complete the sequence'),
  ('maze','Mazes','Find the way to the treasure');

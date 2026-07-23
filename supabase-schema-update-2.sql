-- ============================================================
-- NUR TOURNAMENTS — схема базы данных для Supabase
-- Выполнить целиком в Supabase: SQL Editor -> New query -> Run
-- ============================================================

-- Профили пользователей (username + флаг администратора)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Автоматически создаёт профиль при регистрации нового пользователя
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Команды
create table teams (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('5x5', '2x2')),
  name text not null,
  tag text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  max_size int not null,
  created_at timestamptz not null default now()
);

-- Состав команды (просто имена, без привязки к аккаунтам)
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  member_name text not null
);

-- Турниры
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('5x5', '2x2')),
  name text not null,
  status text not null default 'registration' check (status in ('registration', 'live', 'finished')),
  created_at timestamptz not null default now()
);

-- Регистрации команд на турнир
create table tournament_teams (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (tournament_id, team_id)
);

-- Матчи турнирной сетки
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round int not null,
  match_index int not null,
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  winner_id uuid references teams(id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table matches enable row level security;

-- profiles: читать могут все, менять через приложение нельзя
-- (флаг is_admin ставится вручную в Table Editor — см. README)
create policy "profiles_select_all" on profiles for select using (true);

-- teams: читать могут все; создавать может только владелец на себя
create policy "teams_select_all" on teams for select using (true);
create policy "teams_insert_own" on teams for insert with check (auth.uid() = owner_id);

-- team_members: читать могут все; добавлять может только владелец команды
create policy "team_members_select_all" on team_members for select using (true);
create policy "team_members_insert_by_owner" on team_members for insert with check (
  exists (select 1 from teams where teams.id = team_members.team_id and teams.owner_id = auth.uid())
);

-- tournaments: читать могут все; создавать/менять/удалять — только админы
create policy "tournaments_select_all" on tournaments for select using (true);
create policy "tournaments_admin_all" on tournaments for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

-- tournament_teams: читать могут все; регистрировать может только владелец команды
create policy "tournament_teams_select_all" on tournament_teams for select using (true);
create policy "tournament_teams_insert_by_owner" on tournament_teams for insert with check (
  exists (select 1 from teams where teams.id = tournament_teams.team_id and teams.owner_id = auth.uid())
);

-- matches: читать могут все; создавать/менять — только админы
create policy "matches_select_all" on matches for select using (true);
create policy "matches_admin_all" on matches for all using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

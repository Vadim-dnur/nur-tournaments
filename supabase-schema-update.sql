-- ============================================================
-- NUR TOURNAMENTS — обновление: разрешить владельцу удалять
-- свою команду и свою регистрацию на турнир.
-- Выполнить один раз в Supabase: SQL Editor -> New query -> Run
-- ============================================================

create policy "teams_delete_own" on teams for delete using (
  auth.uid() = owner_id
);

create policy "tournament_teams_delete_own" on tournament_teams for delete using (
  exists (select 1 from teams where teams.id = tournament_teams.team_id and teams.owner_id = auth.uid())
);

-- ============================================================
-- NUR TOURNAMENTS — обновление 2:
-- баннер турнира, призовой фонд, лимит команд
-- Выполнить один раз в Supabase: SQL Editor -> New query -> Run
-- ============================================================

alter table tournaments add column if not exists banner_url text;
alter table tournaments add column if not exists prize_pool text;
alter table tournaments add column if not exists max_teams int;

-- Публичный бакет для картинок-баннеров турниров
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "banners_public_read" on storage.objects for select using (
  bucket_id = 'banners'
);

create policy "banners_admin_insert" on storage.objects for insert with check (
  bucket_id = 'banners'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "banners_admin_update" on storage.objects for update using (
  bucket_id = 'banners'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "banners_admin_delete" on storage.objects for delete using (
  bucket_id = 'banners'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

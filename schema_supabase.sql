-- ════════════════════════════════════════════════════════════════════════
--  مِنبَر (نسخة السحابة) — قاعدة بيانات Supabase كاملة
--  شغّلها كاملة في: Supabase → SQL Editor → Run.  آمنة للإعادة.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── الملفات الشخصية (صف لكل مستخدم Auth) ──
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  role          text not null default 'user' check (role in ('user','admin')),
  premium_until timestamptz not null default 'epoch',
  ui_language   text not null default 'ar',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- إنشاء صف profile تلقائيًا عند التسجيل
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── المشاريع (التفريغ المحفوظ) ──
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text,
  filename    text,
  media_url   text,
  language    text not null default 'ar',
  status      text not null default 'uploaded' check (status in ('uploaded','processing','done','error')),
  duration    real not null default 0,
  is_limited  boolean not null default false,
  transcript  jsonb not null default '[]'::jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

-- ── المقاطع المُصدّرة (اختياري) ──
create table if not exists clips (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text,
  start_s    real, end_s real,
  url        text,
  created_at timestamptz not null default now()
);

-- ── دالة مساعدة للدور ──
create or replace function my_role() returns text language sql stable as
$$ select coalesce((select role from profiles where id = auth.uid()), 'anon') $$;

-- ════════════ RLS ════════════
alter table profiles enable row level security;
alter table projects enable row level security;
alter table clips    enable row level security;

drop policy if exists p_sel  on profiles;
drop policy if exists p_self on profiles;
drop policy if exists p_ins  on profiles;
create policy p_sel  on profiles for select using (id = auth.uid() or my_role() = 'admin');
create policy p_self on profiles for update using (id = auth.uid() or my_role() = 'admin');
create policy p_ins  on profiles for insert with check (id = auth.uid());

drop policy if exists pr_all on projects;
create policy pr_all on projects for all
  using (owner_id = auth.uid() or my_role() = 'admin')
  with check (owner_id = auth.uid() or my_role() = 'admin');

drop policy if exists cl_all on clips;
create policy cl_all on clips for all
  using (owner_id = auth.uid() or my_role() = 'admin')
  with check (owner_id = auth.uid() or my_role() = 'admin');

-- ════════════ التخزين (الفيديو) ════════════
insert into storage.buckets (id, name, public) values ('media','media', true)
  on conflict (id) do nothing;
do $$ begin
  begin create policy "media read" on storage.objects for select using (bucket_id = 'media');
  exception when duplicate_object then null; end;
  begin create policy "media write" on storage.objects for insert to authenticated with check (bucket_id = 'media');
  exception when duplicate_object then null; end;
  begin create policy "media update" on storage.objects for update to authenticated using (bucket_id = 'media');
  exception when duplicate_object then null; end;
  begin create policy "media delete" on storage.objects for delete to authenticated using (bucket_id = 'media');
  exception when duplicate_object then null; end;
end $$;

-- ════════════ إنشاء أدمن ════════════
-- بعد تسجيل حسابك من التطبيق، نفّذ (بدّل البريد):
-- update profiles set role='admin' where email='you@example.com';
-- ولتفعيل اشتراك مستخدم سنة:
-- update profiles set premium_until = now() + interval '365 days' where email='user@example.com';

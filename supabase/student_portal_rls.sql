-- MET Academy — Student portal RLS (learning platform, not admin)
-- Run in Supabase SQL Editor after tables exist.
-- Safe to re-run (drops named policies first).
--
-- Student brief (v1.0):
--   • users: SELECT own row only — no INSERT/UPDATE/DELETE for students
--   • modules: SELECT where is_published = true — no writes
--   • activation_tokens: no student access (backend service_role only)
--   • admins: no student access
--
-- Direct PostgREST access as authenticated uses auth.uid().
-- public.users.id MUST equal auth.users.id for each student (link on signup / admin creates user).
--
-- Node API uses SUPABASE_SERVICE_ROLE_KEY → bypasses RLS; unchanged.

-- ---------------------------------------------------------------------------
-- 1) Enable RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.modules enable row level security;
alter table public.activation_tokens enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admins'
  ) then
    execute 'alter table public.admins enable row level security';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Drop old policies (names we own)
-- ---------------------------------------------------------------------------

drop policy if exists "student_select_own_profile" on public.users;
drop policy if exists "student_select_published_modules" on public.modules;

-- ---------------------------------------------------------------------------
-- 3) Policies — authenticated (Supabase Auth JWT) = student in this model
-- ---------------------------------------------------------------------------

create policy "student_select_own_profile"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

create policy "student_select_published_modules"
  on public.modules
  for select
  to authenticated
  using (is_published = true);

-- activation_tokens & admins: no policies → no access for roles without bypass
-- (combined with revokes + no grants below)

-- ---------------------------------------------------------------------------
-- 4) Privileges — anon: nothing. authenticated: safe column sets only.
--    (Excludes password_hash on users and video_id on modules for direct client reads.)
-- ---------------------------------------------------------------------------

revoke all on table public.users from anon, authenticated;
revoke all on table public.modules from anon, authenticated;
revoke all on table public.activation_tokens from anon, authenticated;

grant select (id, full_name, email, status, created_at, last_login_at)
  on table public.users
  to authenticated;

grant select (
    id,
    order_index,
    title,
    description,
    duration_seconds,
    thumbnail_url,
    is_published,
    created_at
  )
  on table public.modules
  to authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admins'
  ) then
    execute 'revoke all on table public.admins from anon, authenticated';
  end if;
end $$;

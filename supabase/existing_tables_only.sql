-- Use this when users / modules / activation_tokens / admins ALREADY exist in Supabase.
-- Paste in SQL Editor and run once (safe to re-run for most statements).
--
-- Does NOT create tables — only: enum, missing columns/constraints, indexes, RLS, revokes.
-- Your Node API uses service_role → it bypasses RLS.

-- ---------------------------------------------------------------------------
-- 1) Enum for users.status (no-op if type already exists)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_status as enum ('pending', 'active', 'disabled');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2) users — add columns if an older schema omitted them
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists created_at timestamptz not null default now();

alter table public.users
  add column if not exists last_login_at timestamptz null;

-- If status is plain text with valid labels, try to switch to enum (ignore if already enum)
do $$
begin
  alter table public.users
    alter column status type public.user_status
    using (status::text::public.user_status);
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3) activation_tokens — backend requires `type` ('activation' | 'reset')
-- ---------------------------------------------------------------------------

alter table public.activation_tokens
  add column if not exists type text;

update public.activation_tokens
set type = 'activation'
where type is null;

alter table public.activation_tokens
  alter column type set default 'activation';

alter table public.activation_tokens
  alter column type set not null;

alter table public.activation_tokens
  drop constraint if exists activation_tokens_type_check;

alter table public.activation_tokens
  add constraint activation_tokens_type_check
    check (type in ('activation', 'reset'));

-- ---------------------------------------------------------------------------
-- 4) modules — created_at + unique order_index (per your ERD)
-- ---------------------------------------------------------------------------

alter table public.modules
  add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table public.modules
    add constraint modules_order_index_unique unique (order_index);
exception
  when duplicate_object then null;
end $$;

create index if not exists activation_tokens_token_type_idx
  on public.activation_tokens (token, type);

alter table public.modules
  add column if not exists thumbnail_url text null;

-- ---------------------------------------------------------------------------
-- 5) Student portal RLS (same as supabase/student_portal_rls.sql)
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.modules enable row level security;
alter table public.activation_tokens enable row level security;

drop policy if exists "student_select_own_profile" on public.users;
drop policy if exists "student_select_published_modules" on public.modules;

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
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'admins'
  ) then
    execute 'alter table public.admins enable row level security';
    execute 'revoke all on table public.admins from anon, authenticated';
  end if;
end $$;

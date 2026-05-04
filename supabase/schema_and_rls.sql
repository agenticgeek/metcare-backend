-- MET Academy — align with your ERD + this Express backend + RLS
-- Supabase → SQL Editor → New query → Run
--
-- If tables already exist: use existing_tables_only.sql instead (no CREATE TABLE noise).
--
-- Backend needs on activation_tokens: column `type` IN ('activation','reset').
-- Your diagram may omit it; this script adds it if missing.
--
-- Node uses SUPABASE_SERVICE_ROLE_KEY → bypasses RLS.
-- Section 4 applies student-portal RLS for anon/authenticated (see student_portal_rls.sql).

-- ---------------------------------------------------------------------------
-- 1) Enum for users.status (matches ERD: user_status)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_status as enum ('pending', 'active', 'disabled');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Tables — create only if missing (greenfield). Brownfield: section 3.
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now(),
  last_login_at timestamptz null
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  order_index int4 not null,
  title text not null,
  description text null,
  video_id text null,
  thumbnail_url text null,
  duration_seconds int4 null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint modules_order_index_unique unique (order_index)
);

create table if not exists public.activation_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null unique,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  type text not null default 'activation'
    constraint activation_tokens_type_check check (type in ('activation', 'reset'))
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) Brownfield — your tables already exist: add only what the backend needs
-- ---------------------------------------------------------------------------

-- users.created_at / last_login_at (if an older schema skipped them)
alter table public.users
  add column if not exists created_at timestamptz not null default now();

alter table public.users
  add column if not exists last_login_at timestamptz null;

-- activation_tokens.type (required by auth.controller for activate vs reset-password)
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

-- modules.created_at / thumbnail_url
alter table public.modules
  add column if not exists created_at timestamptz not null default now();

alter table public.modules
  add column if not exists thumbnail_url text null;

-- Unique order_index (your ERD). Safe if constraint already exists from CREATE TABLE.
do $$ begin
  alter table public.modules
    add constraint modules_order_index_unique unique (order_index);
exception
  when duplicate_object then null;
end $$;

-- Helpful lookup for token + type (login flows)
create index if not exists activation_tokens_token_type_idx
  on public.activation_tokens (token, type);

-- If users.status is still text from an old script, convert to enum (skip errors)
do $$
begin
  alter table public.users
    alter column status type public.user_status
    using (status::text::public.user_status);
exception
  when others then
    -- already enum or incompatible data; fix data manually if needed
    null;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Student portal RLS (learning platform — not admin)
--    public.users.id must match auth.users.id when using Supabase Auth from the client.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.modules enable row level security;
alter table public.activation_tokens enable row level security;
alter table public.admins enable row level security;

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
revoke all on table public.admins from anon, authenticated;

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

-- ---------------------------------------------------------------------------
-- 5) OPTIONAL — tie public.users.id to Supabase Auth (uncomment when ready)
-- ---------------------------------------------------------------------------
/*
alter table public.users
  add constraint users_auth_fk foreign key (id) references auth.users (id) on delete cascade;
*/

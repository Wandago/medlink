-- =========================================================
-- MEDLINK KE — database schema (Supabase / Postgres)
-- ---------------------------------------------------------
-- Auth is handled by Clerk. Supabase trusts Clerk session
-- tokens through the Clerk third-party auth integration, so
-- inside SQL the signed-in user's Clerk ID is:
--     auth.jwt() ->> 'sub'
--
-- Run this whole file once in: Supabase dashboard > SQL Editor.
-- It is safe to re-run (everything is "if not exists" / "or replace").
-- =========================================================

create extension if not exists pgcrypto;

-- Shorthand for "the signed-in Clerk user".
create or replace function public.requesting_user_id()
returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- ---------------------------------------------------------
-- PROFILES — one row per Clerk user, created during onboarding
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id             text primary key default public.requesting_user_id(),
  username       text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  full_name      text not null check (char_length(full_name) between 1 and 80),
  university_id  text not null,
  course_id      text not null,
  year           text not null,
  bio            text not null default '' check (char_length(bio) <= 280),
  interests      text[] not null default '{}',
  current_units  text[] not null default '{}',
  color          text not null default '#A66DF5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles: readable by signed-in users" on public.profiles;
create policy "profiles: readable by signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = public.requesting_user_id());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = public.requesting_user_id())
  with check (id = public.requesting_user_id());

-- ---------------------------------------------------------
-- FOLLOWS
-- ---------------------------------------------------------
create table if not exists public.follows (
  follower_id  text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  following_id text not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;

drop policy if exists "follows: readable" on public.follows;
create policy "follows: readable" on public.follows
  for select to authenticated using (true);
drop policy if exists "follows: follow as yourself" on public.follows;
create policy "follows: follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = public.requesting_user_id());
drop policy if exists "follows: unfollow as yourself" on public.follows;
create policy "follows: unfollow as yourself" on public.follows
  for delete to authenticated using (follower_id = public.requesting_user_id());

-- ---------------------------------------------------------
-- COMMUNITIES + MEMBERSHIP
-- ---------------------------------------------------------
create table if not exists public.communities (
  id          text primary key,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.communities enable row level security;

drop policy if exists "communities: readable" on public.communities;
create policy "communities: readable" on public.communities
  for select to authenticated using (true);

insert into public.communities (id, name, description) values
  ('anatomy',        'Anatomy',                   'High-yield discussions, mnemonics and dissection-week survival tips.'),
  ('surgery',        'Surgery',                   'For students on surgical rotations and future surgeons-in-training.'),
  ('public-health',  'Public Health',             'Epidemiology, community health placements and research chats.'),
  ('med-students-ke','Medical Students in Kenya', 'The general home base — announcements, opportunities, and banter.')
on conflict (id) do nothing;

create table if not exists public.community_members (
  community_id text not null references public.communities(id) on delete cascade,
  user_id      text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_members enable row level security;

drop policy if exists "community_members: readable" on public.community_members;
create policy "community_members: readable" on public.community_members
  for select to authenticated using (true);
drop policy if exists "community_members: join as yourself" on public.community_members;
create policy "community_members: join as yourself" on public.community_members
  for insert to authenticated with check (user_id = public.requesting_user_id());
drop policy if exists "community_members: leave as yourself" on public.community_members;
create policy "community_members: leave as yourself" on public.community_members
  for delete to authenticated using (user_id = public.requesting_user_id());

-- ---------------------------------------------------------
-- POSTS (community feeds + unit groups), LIKES, COMMENTS
-- A post belongs to a community, a unit group, or neither (general feed).
-- ---------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  community_id text references public.communities(id) on delete cascade,
  unit         text check (unit is null or char_length(unit) <= 120),
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);
create index if not exists posts_created_idx   on public.posts (created_at desc);
create index if not exists posts_community_idx on public.posts (community_id, created_at desc);
create index if not exists posts_unit_idx      on public.posts (unit, created_at desc);
alter table public.posts enable row level security;

drop policy if exists "posts: readable" on public.posts;
create policy "posts: readable" on public.posts
  for select to authenticated using (true);
drop policy if exists "posts: create as yourself" on public.posts;
create policy "posts: create as yourself" on public.posts
  for insert to authenticated with check (author_id = public.requesting_user_id());
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts
  for delete to authenticated using (author_id = public.requesting_user_id());

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

drop policy if exists "post_likes: readable" on public.post_likes;
create policy "post_likes: readable" on public.post_likes
  for select to authenticated using (true);
drop policy if exists "post_likes: like as yourself" on public.post_likes;
create policy "post_likes: like as yourself" on public.post_likes
  for insert to authenticated with check (user_id = public.requesting_user_id());
drop policy if exists "post_likes: unlike as yourself" on public.post_likes;
create policy "post_likes: unlike as yourself" on public.post_likes
  for delete to authenticated using (user_id = public.requesting_user_id());

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists "post_comments: readable" on public.post_comments;
create policy "post_comments: readable" on public.post_comments
  for select to authenticated using (true);
drop policy if exists "post_comments: comment as yourself" on public.post_comments;
create policy "post_comments: comment as yourself" on public.post_comments
  for insert to authenticated with check (author_id = public.requesting_user_id());
drop policy if exists "post_comments: delete own" on public.post_comments;
create policy "post_comments: delete own" on public.post_comments
  for delete to authenticated using (author_id = public.requesting_user_id());

-- ---------------------------------------------------------
-- RESOURCES (study library) + SAVES + REPORTS
-- Files live in the "resources" storage bucket under <user_id>/...
-- ---------------------------------------------------------
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  author_id   text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 140),
  unit        text not null check (char_length(unit) between 1 and 120),
  type        text not null check (type in ('Notes', 'Summary', 'Past Paper', 'MCQ', 'Practical Guide', 'Slides', 'Other')),
  description text not null default '' check (char_length(description) <= 1000),
  file_path   text not null,
  file_name   text not null,
  file_type   text not null default '',
  file_size   bigint not null default 0,
  views       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists resources_created_idx on public.resources (created_at desc);
create index if not exists resources_unit_idx    on public.resources (unit);
alter table public.resources enable row level security;

drop policy if exists "resources: readable" on public.resources;
create policy "resources: readable" on public.resources
  for select to authenticated using (true);
drop policy if exists "resources: upload as yourself" on public.resources;
create policy "resources: upload as yourself" on public.resources
  for insert to authenticated
  with check (author_id = public.requesting_user_id()
              and split_part(file_path, '/', 1) = public.requesting_user_id());
drop policy if exists "resources: delete own" on public.resources;
create policy "resources: delete own" on public.resources
  for delete to authenticated using (author_id = public.requesting_user_id());

-- View counter without giving clients UPDATE rights on resources.
create or replace function public.increment_resource_views(rid uuid)
returns void language sql security definer set search_path = public as $$
  update public.resources set views = views + 1 where id = rid;
$$;
revoke all on function public.increment_resource_views(uuid) from public, anon;
grant execute on function public.increment_resource_views(uuid) to authenticated;

create table if not exists public.saved_resources (
  user_id     text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, resource_id)
);
alter table public.saved_resources enable row level security;

drop policy if exists "saved_resources: readable" on public.saved_resources;
create policy "saved_resources: readable" on public.saved_resources
  for select to authenticated using (true);
drop policy if exists "saved_resources: save as yourself" on public.saved_resources;
create policy "saved_resources: save as yourself" on public.saved_resources
  for insert to authenticated with check (user_id = public.requesting_user_id());
drop policy if exists "saved_resources: unsave as yourself" on public.saved_resources;
create policy "saved_resources: unsave as yourself" on public.saved_resources
  for delete to authenticated using (user_id = public.requesting_user_id());

create table if not exists public.resource_reports (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  reporter_id text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 500),
  created_at  timestamptz not null default now()
);
alter table public.resource_reports enable row level security;

-- Anyone signed in can file a report; nobody can read them from the app
-- (review them in the Supabase dashboard).
drop policy if exists "resource_reports: report as yourself" on public.resource_reports;
create policy "resource_reports: report as yourself" on public.resource_reports
  for insert to authenticated with check (reporter_id = public.requesting_user_id());

-- ---------------------------------------------------------
-- DIRECT MESSAGES
-- ---------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  recipient_id text not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx    on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;

drop policy if exists "messages: read your own conversations" on public.messages;
create policy "messages: read your own conversations" on public.messages
  for select to authenticated
  using (sender_id = public.requesting_user_id() or recipient_id = public.requesting_user_id());
drop policy if exists "messages: send as yourself" on public.messages;
create policy "messages: send as yourself" on public.messages
  for insert to authenticated with check (sender_id = public.requesting_user_id());
drop policy if exists "messages: recipient marks read" on public.messages;
create policy "messages: recipient marks read" on public.messages
  for update to authenticated
  using (recipient_id = public.requesting_user_id())
  with check (recipient_id = public.requesting_user_id());

-- Recipients may only touch read_at, never the message itself.
revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------
-- STORAGE — "resources" bucket (public read, owner-only write)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources', 'resources', true, 20971520,  -- 20 MB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resources bucket: upload into own folder" on storage.objects;
create policy "resources bucket: upload into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = public.requesting_user_id());
drop policy if exists "resources bucket: delete own files" on storage.objects;
create policy "resources bucket: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = public.requesting_user_id());

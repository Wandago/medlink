-- =========================================================
-- MEDLINK KE — database schema (Supabase / Postgres)
-- ---------------------------------------------------------
-- Auth is handled by Clerk. Supabase trusts Clerk session
-- tokens through the Clerk third-party auth integration, so
-- inside SQL the signed-in user's Clerk ID is:
--     auth.jwt() ->> 'sub'
--
-- Run this whole file once in: Supabase dashboard > SQL Editor.
-- It is safe to re-run (everything is "if not exists" / "or replace"),
-- so after pulling a new version just run the whole file again.
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
-- ---------------------------------------------------------
-- ROLES + SUSPENSIONS
-- Everyone is a student unless they have a row in user_roles.
--   super_admin  everything, including making other admins
--   admin        everything except managing admins / super admins
--   moderator    analytics, activity and content moderation
-- Roles are changed only through set_user_role() (below).
-- Make yourself the first super admin (after signing up in the app):
--   insert into public.user_roles (user_id, role)
--   select id, 'super_admin' from public.profiles where username = 'your_username';
-- ---------------------------------------------------------
create table if not exists public.user_roles (
  user_id    text primary key references public.profiles(id) on delete cascade,
  role       text not null check (role in ('super_admin', 'admin', 'moderator')),
  granted_by text,
  granted_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

drop policy if exists "user_roles: readable" on public.user_roles;
create policy "user_roles: readable" on public.user_roles
  for select to authenticated using (true);

create table if not exists public.user_suspensions (
  user_id      text primary key references public.profiles(id) on delete cascade,
  reason       text not null default '' check (char_length(reason) <= 500),
  suspended_by text,
  created_at   timestamptz not null default now()
);
alter table public.user_suspensions enable row level security;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = public.requesting_user_id()
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'super_admin'), false)
$$;
-- Signed in and not suspended: required to post, upload, comment, message.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.requesting_user_id() is not null
     and not exists (select 1 from public.user_suspensions where user_id = public.requesting_user_id())
$$;

drop policy if exists "user_suspensions: own or staff" on public.user_suspensions;
create policy "user_suspensions: own or staff" on public.user_suspensions
  for select to authenticated using (user_id = public.requesting_user_id() or public.is_staff());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = public.requesting_user_id() and public.is_active_user())
  with check (id = public.requesting_user_id());
drop policy if exists "profiles: admins edit anyone" on public.profiles;
create policy "profiles: admins edit anyone" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private per-user details (email as reported by Clerk). Visible to the user and admins only.
create table if not exists public.user_private (
  user_id    text primary key default public.requesting_user_id() references public.profiles(id) on delete cascade,
  email      text not null default '' check (char_length(email) <= 320),
  updated_at timestamptz not null default now()
);
alter table public.user_private enable row level security;

drop policy if exists "user_private: own or admin" on public.user_private;
create policy "user_private: own or admin" on public.user_private
  for select to authenticated using (user_id = public.requesting_user_id() or public.is_admin());
drop policy if exists "user_private: write own" on public.user_private;
create policy "user_private: write own" on public.user_private
  for insert to authenticated with check (user_id = public.requesting_user_id());
drop policy if exists "user_private: update own" on public.user_private;
create policy "user_private: update own" on public.user_private
  for update to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

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
  for insert to authenticated with check (follower_id = public.requesting_user_id() and public.is_active_user());
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
alter table public.communities add column if not exists image_url text not null default '';
alter table public.communities enable row level security;

drop policy if exists "communities: readable" on public.communities;
create policy "communities: readable" on public.communities
  for select to anon, authenticated using (true);
drop policy if exists "communities: admins create" on public.communities;
create policy "communities: admins create" on public.communities
  for insert to authenticated with check (public.is_admin());
drop policy if exists "communities: admins edit" on public.communities;
create policy "communities: admins edit" on public.communities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "communities: admins delete" on public.communities;
create policy "communities: admins delete" on public.communities
  for delete to authenticated using (public.is_admin());

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
  for insert to authenticated with check (author_id = public.requesting_user_id() and public.is_active_user());
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts
  for delete to authenticated using (author_id = public.requesting_user_id());
drop policy if exists "posts: staff delete" on public.posts;
create policy "posts: staff delete" on public.posts
  for delete to authenticated using (public.is_staff());

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
  for insert to authenticated with check (author_id = public.requesting_user_id() and public.is_active_user());
drop policy if exists "post_comments: delete own" on public.post_comments;
create policy "post_comments: delete own" on public.post_comments
  for delete to authenticated using (author_id = public.requesting_user_id());
drop policy if exists "post_comments: staff delete" on public.post_comments;
create policy "post_comments: staff delete" on public.post_comments
  for delete to authenticated using (public.is_staff());

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
              and split_part(file_path, '/', 1) = public.requesting_user_id()
              and public.is_active_user());
drop policy if exists "resources: delete own" on public.resources;
create policy "resources: delete own" on public.resources
  for delete to authenticated using (author_id = public.requesting_user_id());
drop policy if exists "resources: staff delete" on public.resources;
create policy "resources: staff delete" on public.resources
  for delete to authenticated using (public.is_staff());
drop policy if exists "resources: staff edit" on public.resources;
create policy "resources: staff edit" on public.resources
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

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
alter table public.resource_reports add column if not exists status text not null default 'open';
alter table public.resource_reports add column if not exists resolved_by text;
alter table public.resource_reports add column if not exists resolved_at timestamptz;
alter table public.resource_reports drop constraint if exists resource_reports_status_check;
alter table public.resource_reports add constraint resource_reports_status_check
  check (status in ('open', 'resolved', 'dismissed'));
alter table public.resource_reports enable row level security;

-- Anyone signed in can file a report; only staff can read and resolve them.
drop policy if exists "resource_reports: report as yourself" on public.resource_reports;
create policy "resource_reports: report as yourself" on public.resource_reports
  for insert to authenticated with check (reporter_id = public.requesting_user_id() and status = 'open');
drop policy if exists "resource_reports: staff read" on public.resource_reports;
create policy "resource_reports: staff read" on public.resource_reports
  for select to authenticated using (public.is_staff());
drop policy if exists "resource_reports: staff resolve" on public.resource_reports;
create policy "resource_reports: staff resolve" on public.resource_reports
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

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
  for insert to authenticated with check (sender_id = public.requesting_user_id() and public.is_active_user());
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
-- Storage only deletes files the user can also "see", so owners and staff get a select rule.
drop policy if exists "resources bucket: owners and staff see files" on storage.objects;
create policy "resources bucket: owners and staff see files" on storage.objects
  for select to authenticated
  using (bucket_id = 'resources'
         and ((storage.foldername(name))[1] = public.requesting_user_id() or public.is_staff()));
drop policy if exists "resources bucket: delete own files" on storage.objects;
create policy "resources bucket: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = public.requesting_user_id());
drop policy if exists "resources bucket: staff delete" on storage.objects;
create policy "resources bucket: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and public.is_staff());

-- =========================================================
-- SITE IMAGES — every photo on the site can be swapped from
-- the admin page. Rows override the defaults shipped in /img.
-- Uploaded files live in the public "site-media" bucket.
-- =========================================================
create table if not exists public.site_images (
  slot       text primary key check (slot ~ '^[a-z0-9_-]{2,60}$'),
  url        text not null check (char_length(url) <= 800 and (url ~ '^https://' or url ~ '^img/')),
  alt        text not null default '' check (char_length(alt) <= 200),
  updated_by text default public.requesting_user_id(),
  updated_at timestamptz not null default now()
);
alter table public.site_images enable row level security;

drop policy if exists "site_images: public read" on public.site_images;
create policy "site_images: public read" on public.site_images
  for select to anon, authenticated using (true);
drop policy if exists "site_images: admins write" on public.site_images;
create policy "site_images: admins write" on public.site_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608,  -- 8 MB
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site-media: admins list" on storage.objects;
create policy "site-media: admins list" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "site-media: admins upload" on storage.objects;
create policy "site-media: admins upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "site-media: admins replace" on storage.objects;
create policy "site-media: admins replace" on storage.objects
  for update to authenticated using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "site-media: admins delete" on storage.objects;
create policy "site-media: admins delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());

-- =========================================================
-- ANALYTICS EVENTS — page views, clicks, actions, traffic
-- sources. Written by the browser (signed in or not); only
-- staff can read them. user_id is always taken from the
-- session token, never from the client.
-- =========================================================
create table if not exists public.events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  user_id       text default public.requesting_user_id(),
  visitor_id    text not null check (char_length(visitor_id) between 8 and 64),
  session_id    text not null check (char_length(session_id) between 8 and 64),
  type          text not null check (type in ('page_view', 'action', 'page_leave', 'error')),
  name          text not null check (char_length(name) between 1 and 60),
  path          text not null default '' check (char_length(path) <= 300),
  props         jsonb not null default '{}' check (pg_column_size(props) <= 4000),
  referrer      text not null default '' check (char_length(referrer) <= 500),
  referrer_host text not null default '' check (char_length(referrer_host) <= 200),
  utm_source    text not null default '' check (char_length(utm_source) <= 100),
  utm_medium    text not null default '' check (char_length(utm_medium) <= 100),
  utm_campaign  text not null default '' check (char_length(utm_campaign) <= 100),
  utm_term      text not null default '' check (char_length(utm_term) <= 100),
  utm_content   text not null default '' check (char_length(utm_content) <= 100),
  landing_path  text not null default '' check (char_length(landing_path) <= 300),
  device        text not null default '' check (device in ('', 'mobile', 'tablet', 'desktop')),
  browser       text not null default '' check (char_length(browser) <= 40),
  os            text not null default '' check (char_length(os) <= 40),
  screen_w      integer check (screen_w between 0 and 20000),
  language      text not null default '' check (char_length(language) <= 20),
  timezone      text not null default '' check (char_length(timezone) <= 60),
  duration_ms   integer check (duration_ms between 0 and 86400000)
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_user_idx    on public.events (user_id, created_at desc);
create index if not exists events_session_idx on public.events (session_id, created_at);
alter table public.events enable row level security;

revoke insert, update, delete on public.events from anon, authenticated;
grant insert (visitor_id, session_id, type, name, path, props, referrer, referrer_host,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_path,
              device, browser, os, screen_w, language, timezone, duration_ms)
  on public.events to anon, authenticated;

drop policy if exists "events: anyone can record" on public.events;
create policy "events: anyone can record" on public.events
  for insert to anon, authenticated with check (true);
drop policy if exists "events: staff read" on public.events;
create policy "events: staff read" on public.events
  for select to authenticated using (public.is_staff());

-- =========================================================
-- ACTIVITY LOG — written by database triggers, so it records
-- what really happened (not what a browser claims). Message
-- bodies are never copied here.
-- =========================================================
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id   text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_actor_idx   on public.activity_log (actor_id, created_at desc);
alter table public.activity_log enable row level security;
revoke insert, update, delete on public.activity_log from anon, authenticated;

drop policy if exists "activity_log: staff read" on public.activity_log;
create policy "activity_log: staff read" on public.activity_log
  for select to authenticated using (public.is_staff());

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  verb     text  := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_action text;
  v_entity text;
  v_id     text;
  v_det    jsonb := '{}';
begin
  -- View-counter bumps are not edits.
  if tg_table_name = 'resources' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'views') = (to_jsonb(old) - 'views') then
    return null;
  end if;

  case tg_table_name
    when 'profiles' then
      v_entity := 'user'; v_id := r->>'id';
      v_action := case tg_op when 'INSERT' then 'user_joined' else 'profile_updated' end;
      v_det := jsonb_build_object('username', r->>'username', 'university_id', r->>'university_id',
                                  'course_id', r->>'course_id', 'year', r->>'year');
    when 'posts' then
      v_entity := 'post'; v_id := r->>'id'; v_action := 'post_' || verb;
      v_det := jsonb_build_object('author_id', r->>'author_id', 'community_id', r->>'community_id',
                                  'unit', r->>'unit', 'preview', left(r->>'body', 140));
    when 'post_comments' then
      v_entity := 'comment'; v_id := r->>'id'; v_action := 'comment_' || verb;
      v_det := jsonb_build_object('author_id', r->>'author_id', 'post_id', r->>'post_id', 'preview', left(r->>'body', 140));
    when 'post_likes' then
      v_entity := 'post'; v_id := r->>'post_id'; v_action := 'post_liked';
    when 'resources' then
      v_entity := 'resource'; v_id := r->>'id'; v_action := 'resource_' || case verb when 'created' then 'uploaded' else verb end;
      v_det := jsonb_build_object('author_id', r->>'author_id', 'title', r->>'title', 'unit', r->>'unit', 'type', r->>'type');
    when 'saved_resources' then
      v_entity := 'resource'; v_id := r->>'resource_id'; v_action := 'resource_saved';
    when 'resource_reports' then
      v_entity := 'report'; v_id := r->>'id';
      v_action := case tg_op when 'INSERT' then 'resource_reported' else 'report_' || (r->>'status') end;
      v_det := jsonb_build_object('resource_id', r->>'resource_id', 'reason', left(r->>'reason', 140));
    when 'follows' then
      v_entity := 'user'; v_id := r->>'following_id'; v_action := 'user_followed';
    when 'community_members' then
      v_entity := 'community'; v_id := r->>'community_id';
      v_action := case tg_op when 'INSERT' then 'community_joined' else 'community_left' end;
    when 'communities' then
      v_entity := 'community'; v_id := r->>'id'; v_action := 'community_' || verb;
      v_det := jsonb_build_object('name', r->>'name');
    when 'messages' then
      v_entity := 'message'; v_id := r->>'id'; v_action := 'message_sent';
      v_det := jsonb_build_object('recipient_id', r->>'recipient_id');
    when 'user_roles' then
      v_entity := 'user'; v_id := r->>'user_id';
      v_action := case tg_op when 'DELETE' then 'role_revoked' else 'role_granted' end;
      v_det := jsonb_build_object('role', r->>'role',
                                  'previous', case when tg_op = 'UPDATE' then to_jsonb(old)->>'role' end);
    when 'user_suspensions' then
      v_entity := 'user'; v_id := r->>'user_id';
      v_action := case tg_op when 'DELETE' then 'user_unsuspended' else 'user_suspended' end;
      v_det := jsonb_build_object('reason', r->>'reason');
    when 'exam_sets' then
      v_entity := 'exam'; v_id := r->>'id'; v_action := 'exam_set_' || verb;
      v_det := jsonb_build_object('title', r->>'title', 'subject', r->>'subject', 'source', r->>'source');
    when 'exam_attempts' then
      v_entity := 'exam'; v_id := r->>'set_id'; v_action := 'exam_completed';
      v_det := jsonb_build_object('score', r->>'score', 'total', r->>'total');
    when 'exam_papers' then
      v_entity := 'paper'; v_id := r->>'id'; v_action := 'exam_paper_' || verb;
      v_det := jsonb_build_object('title', r->>'title', 'url', r->>'url');
    when 'role_invites' then
      v_entity := 'invite'; v_id := r->>'email';
      v_action := case tg_op when 'DELETE' then 'role_invite_removed' else 'role_invited' end;
      v_det := jsonb_build_object('email', r->>'email', 'role', r->>'role');
    when 'site_images' then
      v_entity := 'image'; v_id := r->>'slot';
      v_action := case tg_op when 'DELETE' then 'image_reset' else 'image_changed' end;
      v_det := jsonb_build_object('url', r->>'url');
    else
      v_entity := tg_table_name; v_id := r->>'id'; v_action := tg_table_name || '_' || verb;
  end case;

  insert into public.activity_log (actor_id, action, entity, entity_id, details)
  values (public.requesting_user_id(), v_action, v_entity, v_id, v_det);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'posts', 'post_comments', 'post_likes', 'resources', 'saved_resources',
                           'resource_reports', 'follows', 'community_members', 'communities', 'messages',
                           'user_roles', 'user_suspensions', 'site_images']
  loop
    execute format('drop trigger if exists log_activity on public.%I', t);
  end loop;
end $$;
create trigger log_activity after insert or update on public.profiles            for each row execute function public.log_activity();
create trigger log_activity after insert or delete on public.posts               for each row execute function public.log_activity();
create trigger log_activity after insert or delete on public.post_comments       for each row execute function public.log_activity();
create trigger log_activity after insert           on public.post_likes          for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.resources for each row execute function public.log_activity();
create trigger log_activity after insert           on public.saved_resources     for each row execute function public.log_activity();
create trigger log_activity after insert or update on public.resource_reports    for each row execute function public.log_activity();
create trigger log_activity after insert           on public.follows             for each row execute function public.log_activity();
create trigger log_activity after insert or delete on public.community_members   for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.communities      for each row execute function public.log_activity();
create trigger log_activity after insert           on public.messages            for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.user_roles       for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.user_suspensions for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.site_images      for each row execute function public.log_activity();

-- =========================================================
-- ADMIN FUNCTIONS
-- =========================================================
create or replace function public.set_user_role(target text, new_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me   text := public.requesting_user_id();
  mine text := public.my_role();
  cur  text;
begin
  if mine is null or mine not in ('admin', 'super_admin') then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new_role is not null and new_role not in ('super_admin', 'admin', 'moderator') then
    raise exception 'Unknown role: %', new_role;
  end if;
  if target = me then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'User not found';
  end if;
  select role into cur from public.user_roles where user_id = target;
  if mine = 'admin' and (coalesce(new_role, '') in ('admin', 'super_admin') or coalesce(cur, '') in ('admin', 'super_admin')) then
    raise exception 'Only a super admin can manage admins' using errcode = '42501';
  end if;
  if new_role is null then
    delete from public.user_roles where user_id = target;
  else
    insert into public.user_roles (user_id, role, granted_by) values (target, new_role, me)
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
end $$;

create or replace function public.set_user_suspended(target text, suspend boolean, reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  me    text := public.requesting_user_id();
  mine  text := public.my_role();
  their text;
begin
  if mine is null or mine not in ('admin', 'super_admin') then
    raise exception 'Only admins can suspend users' using errcode = '42501';
  end if;
  if target = me then
    raise exception 'You cannot suspend yourself' using errcode = '42501';
  end if;
  select role into their from public.user_roles where user_id = target;
  if their is not null and mine <> 'super_admin' then
    raise exception 'Only a super admin can suspend staff' using errcode = '42501';
  end if;
  if suspend then
    insert into public.user_suspensions (user_id, reason, suspended_by)
    values (target, left(coalesce(reason, ''), 500), me)
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, created_at = now();
  else
    delete from public.user_suspensions where user_id = target;
  end if;
end $$;

-- Group a visit by where it came from: UTM source first, then the referring site.
create or replace function public.traffic_source(p_utm text, p_host text)
returns text language sql immutable as $$
  select case
    when coalesce(p_utm, '') <> '' then lower(p_utm)
    when coalesce(p_host, '') = '' then 'direct'
    when p_host ~* '(^|\.)google\.' then 'google'
    when p_host ~* '(^|\.)bing\.com$' then 'bing'
    when p_host ~* 'whatsapp|(^|\.)wa\.me$' then 'whatsapp'
    when p_host ~* '(^|\.)(facebook\.com|fb\.com|fb\.me)$' then 'facebook'
    when p_host ~* '(^|\.)instagram\.com$' then 'instagram'
    when p_host ~* '(^|\.)(t\.co|twitter\.com|x\.com)$' then 'x'
    when p_host ~* '(^|\.)(linkedin\.com|lnkd\.in)$' then 'linkedin'
    when p_host ~* '(^|\.)tiktok\.com$' then 'tiktok'
    when p_host ~* '(^|\.)(youtube\.com|youtu\.be)$' then 'youtube'
    when p_host ~* '(^|\.)(telegram\.org|t\.me)$' then 'telegram'
    when p_host ~* '(^|\.)(chatgpt\.com|openai\.com)$' then 'chatgpt'
    else regexp_replace(lower(p_host), '^(www|m|l|lm)\.', '')
  end
$$;

-- One call returns everything the admin dashboard charts need.
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz     text := 'Africa/Nairobi';
  days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  today  date := (now() at time zone tz)::date;
  since  timestamptz := ((today - (days - 1))::timestamp) at time zone tz;
  prev   timestamptz := since - make_interval(days => days);
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  with ev as (select * from public.events where created_at >= since),
  prev_ev as (select * from public.events where created_at >= prev and created_at < since),
  sess as (
    select distinct on (session_id) session_id, visitor_id,
           public.traffic_source(utm_source, referrer_host) as source,
           referrer_host, utm_source, utm_medium, utm_campaign, landing_path,
           device, browser, os, timezone, language
    from ev order by session_id, created_at
  ),
  pv as (select session_id, count(*) as n from ev where type = 'page_view' group by session_id),
  conv as (select distinct session_id from ev where type = 'action' and name = 'sign_up_complete'),
  sess_full as (
    select s.*, coalesce(pv.n, 0) as views, (c.session_id is not null) as converted
    from sess s left join pv on pv.session_id = s.session_id left join conv c on c.session_id = s.session_id
  ),
  day_list as (select generate_series(today - (days - 1), today, interval '1 day')::date as day),
  ev_day as (
    select (created_at at time zone tz)::date as day,
           count(*) filter (where type = 'page_view') as views,
           count(distinct visitor_id) as visitors,
           count(distinct user_id) as active_users
    from ev group by 1
  ),
  signup_day as (select (created_at at time zone tz)::date as day, count(*) as n from public.profiles where created_at >= since group by 1),
  post_day   as (select (created_at at time zone tz)::date as day, count(*) as n from public.posts where created_at >= since group by 1),
  upload_day as (select (created_at at time zone tz)::date as day, count(*) as n from public.resources where created_at >= since group by 1)
  select jsonb_build_object(
    'days', days,
    'since', since,
    'totals', jsonb_build_object(
      'users',           (select count(*) from public.profiles),
      'new_users',       (select count(*) from public.profiles where created_at >= since),
      'prev_new_users',  (select count(*) from public.profiles where created_at >= prev and created_at < since),
      'posts',           (select count(*) from public.posts),
      'new_posts',       (select count(*) from public.posts where created_at >= since),
      'comments',        (select count(*) from public.post_comments),
      'resources',       (select count(*) from public.resources),
      'new_resources',   (select count(*) from public.resources where created_at >= since),
      'messages',        (select count(*) from public.messages),
      'new_messages',    (select count(*) from public.messages where created_at >= since),
      'communities',     (select count(*) from public.communities),
      'open_reports',    (select count(*) from public.resource_reports where status = 'open'),
      'suspended',       (select count(*) from public.user_suspensions),
      'staff',           (select count(*) from public.user_roles),
      'page_views',      (select count(*) from ev where type = 'page_view'),
      'prev_page_views', (select count(*) from prev_ev where type = 'page_view'),
      'visitors',        (select count(distinct visitor_id) from ev),
      'prev_visitors',   (select count(distinct visitor_id) from prev_ev),
      'sessions',        (select count(*) from sess),
      'active_users',    (select count(distinct user_id) from ev where user_id is not null),
      'prev_active_users', (select count(distinct user_id) from prev_ev where user_id is not null),
      'bounce_rate',     (select round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0), 1) from sess_full),
      'pages_per_session', (select round(avg(views), 2) from sess_full where views > 0),
      'avg_engaged_seconds', (select round(coalesce(sum(duration_ms), 0) / 1000.0
                                 / nullif((select count(*) from ev where type = 'page_view'), 0), 1)
                              from ev where type = 'page_leave'),
      'signups_tracked', (select count(*) from conv)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'day', d.day, 'views', coalesce(e.views, 0), 'visitors', coalesce(e.visitors, 0),
                'active_users', coalesce(e.active_users, 0), 'signups', coalesce(s.n, 0),
                'posts', coalesce(p.n, 0), 'uploads', coalesce(u.n, 0)) order by d.day), '[]')
              from day_list d
              left join ev_day e on e.day = d.day
              left join signup_day s on s.day = d.day
              left join post_day p on p.day = d.day
              left join upload_day u on u.day = d.day),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'views', coalesce(n, 0)) order by h), '[]')
              from generate_series(0, 23) h
              left join (select extract(hour from created_at at time zone tz)::int as hr, count(*) as n
                         from ev where type = 'page_view' group by 1) x on x.hr = h),
    'weekdays', (select coalesce(jsonb_agg(jsonb_build_object('dow', dw, 'views', coalesce(n, 0)) order by dw), '[]')
              from generate_series(0, 6) dw
              left join (select extract(dow from created_at at time zone tz)::int as d, count(*) as n
                         from ev where type = 'page_view' group by 1) x on x.d = dw),
    'top_pages', (select coalesce(jsonb_agg(t order by t.views desc), '[]') from (
                    select path, count(*) filter (where type = 'page_view') as views,
                           count(distinct visitor_id) filter (where type = 'page_view') as visitors,
                           round(coalesce(sum(duration_ms) filter (where type = 'page_leave'), 0) / 1000.0
                                 / nullif(count(*) filter (where type = 'page_view'), 0), 1) as avg_seconds
                    from ev group by path having count(*) filter (where type = 'page_view') > 0
                    order by 2 desc limit 15) t),
    'sources', (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select source, count(*) as sessions, count(distinct visitor_id) as visitors,
                           sum(views) as views, count(*) filter (where converted) as signups,
                           round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0), 1) as bounce_rate
                    from sess_full group by source order by 2 desc limit 20) t),
    'referrers', (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select referrer_host, count(*) as sessions, count(*) filter (where converted) as signups
                    from sess_full where referrer_host <> '' group by 1 order by 2 desc limit 20) t),
    'campaigns', (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select utm_campaign, utm_source, utm_medium, count(*) as sessions,
                           count(distinct visitor_id) as visitors, count(*) filter (where converted) as signups
                    from sess_full where utm_campaign <> '' or utm_source <> '' or utm_medium <> ''
                    group by 1, 2, 3 order by 4 desc limit 20) t),
    'landing_pages', (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select landing_path, count(*) as sessions, count(*) filter (where converted) as signups,
                           round(100.0 * count(*) filter (where views <= 1) / nullif(count(*), 0), 1) as bounce_rate
                    from sess_full group by 1 order by 2 desc limit 15) t),
    'devices',   (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select coalesce(nullif(device, ''), 'unknown') as label, count(*) as sessions from sess_full group by 1) t),
    'browsers',  (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select coalesce(nullif(browser, ''), 'Other') as label, count(*) as sessions from sess_full group by 1 order by 2 desc limit 8) t),
    'os',        (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select coalesce(nullif(os, ''), 'Other') as label, count(*) as sessions from sess_full group by 1 order by 2 desc limit 8) t),
    'timezones', (select coalesce(jsonb_agg(t order by t.sessions desc), '[]') from (
                    select coalesce(nullif(timezone, ''), 'Unknown') as label, count(*) as sessions from sess_full group by 1 order by 2 desc limit 10) t),
    'actions',   (select coalesce(jsonb_agg(t order by t.count desc), '[]') from (
                    select name, count(*) as count, count(distinct coalesce(user_id, visitor_id)) as people
                    from ev where type = 'action' group by name order by 2 desc limit 30) t),
    'errors',    (select coalesce(jsonb_agg(t order by t.created_at desc), '[]') from (
                    select created_at, name, path, props from ev where type = 'error' order by created_at desc limit 15) t),
    'top_resources', (select coalesce(jsonb_agg(t order by t.views desc), '[]') from (
                    select r.id, r.title, r.unit, r.type, r.views,
                           (select count(*) from public.saved_resources s where s.resource_id = r.id) as saves
                    from public.resources r order by r.views desc limit 8) t),
    'top_users', (select coalesce(jsonb_agg(t order by t.events desc), '[]') from (
                    select p.id, p.username, p.full_name, p.color, count(*) as events,
                           count(*) filter (where e.type = 'page_view') as views, max(e.created_at) as last_seen
                    from ev e join public.profiles p on p.id = e.user_id
                    group by p.id, p.username, p.full_name, p.color order by 5 desc limit 10) t),
    'universities', (select coalesce(jsonb_agg(t order by t.users desc), '[]') from (
                    select university_id as label, count(*) as users from public.profiles group by 1) t),
    'courses', (select coalesce(jsonb_agg(t order by t.users desc), '[]') from (
                    select course_id as label, count(*) as users from public.profiles group by 1) t),
    'years', (select coalesce(jsonb_agg(t order by t.label), '[]') from (
                    select year as label, count(*) as users from public.profiles group by 1) t)
  ) into result;
  return result;
end $$;

-- Users table for the admin page (profile + role + suspension + activity counts).
-- Emails are only returned to admins.
create or replace function public.admin_users(p_q text default '', p_filter text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id text, username text, full_name text, university_id text, course_id text, year text, color text,
  bio text, created_at timestamptz, email text, role text, suspended boolean, suspension_reason text,
  last_seen timestamptz, events bigint, posts bigint, resources bigint, total bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.* from public.profiles p
    left join public.user_roles r on r.user_id = p.id
    left join public.user_suspensions s on s.user_id = p.id
    where public.is_staff()
      and (coalesce(p_q, '') = ''
           or p.username ilike '%' || p_q || '%'
           or p.full_name ilike '%' || p_q || '%'
           or (public.is_admin() and exists (select 1 from public.user_private up
                                             where up.user_id = p.id and up.email ilike '%' || p_q || '%')))
      and (coalesce(p_filter, '') = ''
           or (p_filter = 'staff' and r.role is not null)
           or (p_filter = 'suspended' and s.user_id is not null)
           or (p_filter = r.role))
  )
  select b.id, b.username, b.full_name, b.university_id, b.course_id, b.year, b.color, b.bio, b.created_at,
         case when public.is_admin() then (select up.email from public.user_private up where up.user_id = b.id) end,
         r.role, s.user_id is not null, s.reason,
         (select max(e.created_at) from public.events e where e.user_id = b.id),
         (select count(*) from public.events e where e.user_id = b.id),
         (select count(*) from public.posts x where x.author_id = b.id),
         (select count(*) from public.resources x where x.author_id = b.id),
         count(*) over ()
  from base b
  left join public.user_roles r on r.user_id = b.id
  left join public.user_suspensions s on s.user_id = b.id
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.set_user_role(text, text) from public, anon;
revoke all on function public.set_user_suspended(text, boolean, text) from public, anon;
revoke all on function public.admin_stats(integer) from public, anon;
revoke all on function public.admin_users(text, text, integer, integer) from public, anon;
grant execute on function public.set_user_role(text, text) to authenticated;
grant execute on function public.set_user_suspended(text, boolean, text) to authenticated;
grant execute on function public.admin_stats(integer) to authenticated;
grant execute on function public.admin_users(text, text, integer, integer) to authenticated;

-- =========================================================
-- v3 — simpler communities, invite links, exam bank,
-- admin invites
-- =========================================================

-- One-off data fixes run once, keyed here.
create table if not exists public.app_meta (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_meta enable row level security;  -- no policies: not reachable from the app

-- ---------------------------------------------------------
-- COMMUNITIES — broad on purpose: one per course, a few topics,
-- and one for everyone. Year/course show on each member instead.
-- ---------------------------------------------------------
alter table public.communities add column if not exists kind text not null default 'topic';
alter table public.communities add column if not exists course_id text;
alter table public.communities drop constraint if exists communities_kind_check;
alter table public.communities add constraint communities_kind_check check (kind in ('general', 'course', 'topic'));

insert into public.communities (id, name, description, kind, course_id) values
  ('course-mbchb',     'MBChB',             'Everyone studying medicine — every year, every university.',      'course', 'mbchb'),
  ('course-nursing',   'Nursing',           'Nursing students across Kenya — placements, notes and support.',  'course', 'nursing'),
  ('course-clinmed',   'Clinical Medicine', 'Clinical officers in training — rotations, exams and tips.',      'course', 'clinmed'),
  ('course-pharmacy',  'Pharmacy',          'Pharmacology, pharmaceutics and everything in between.',          'course', 'pharmacy'),
  ('course-dentistry', 'Dentistry',         'Dental students — clinics, techniques and study help.',           'course', 'dentistry')
on conflict (id) do update set kind = excluded.kind, course_id = excluded.course_id;
update public.communities set kind = 'general' where id = 'med-students-ke';

-- Everyone joins the general community and their course community automatically.
create or replace function public.auto_join_communities()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.course_id is not distinct from new.course_id then
    return null;
  end if;
  insert into public.community_members (community_id, user_id)
  select c.id, new.id from public.communities c
  where c.kind = 'general' or (c.kind = 'course' and c.course_id = new.course_id)
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists auto_join_communities on public.profiles;
create trigger auto_join_communities after insert or update on public.profiles
  for each row execute function public.auto_join_communities();

-- Existing students: add them once (never re-adds someone who later leaves).
do $$
begin
  if not exists (select 1 from public.app_meta where key = 'backfill_course_communities_v1') then
    insert into public.community_members (community_id, user_id)
    select c.id, p.id from public.profiles p
    join public.communities c on c.kind = 'general' or (c.kind = 'course' and c.course_id = p.course_id)
    on conflict do nothing;
    insert into public.app_meta (key, value) values ('backfill_course_communities_v1', 'done');
  end if;
end $$;

-- What an invite link shows before someone signs up (initials only, no names).
create or replace function public.community_preview(cid text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'image_url', c.image_url, 'kind', c.kind,
    'members', (select count(*) from public.community_members m where m.community_id = c.id),
    'posts',   (select count(*) from public.posts p where p.community_id = c.id),
    'faces',   (select coalesce(jsonb_agg(jsonb_build_object('initials', f.initials, 'color', f.color)), '[]')
                from (select upper(left(split_part(pr.full_name, ' ', 1), 1) || left(split_part(pr.full_name, ' ', 2), 1)) as initials, pr.color
                      from public.community_members m join public.profiles pr on pr.id = m.user_id
                      where m.community_id = c.id order by m.joined_at desc limit 5) f))
  from public.communities c where c.id = cid
$$;
grant execute on function public.community_preview(text) to anon, authenticated;

-- ---------------------------------------------------------
-- EXAM BANK — practice sets (imported or typed in by staff),
-- links to past papers, and where to find more online.
-- ---------------------------------------------------------
create table if not exists public.exam_sets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 140),
  subject     text not null default '' check (char_length(subject) <= 80),
  unit        text not null default '' check (char_length(unit) <= 120),
  course_id   text,
  description text not null default '' check (char_length(description) <= 500),
  source      text not null default '' check (char_length(source) <= 200),
  source_url  text not null default '' check (char_length(source_url) <= 500),
  published   boolean not null default true,
  created_by  text default public.requesting_user_id(),
  created_at  timestamptz not null default now()
);
create index if not exists exam_sets_created_idx on public.exam_sets (created_at desc);
alter table public.exam_sets enable row level security;

drop policy if exists "exam_sets: readable" on public.exam_sets;
create policy "exam_sets: readable" on public.exam_sets
  for select to authenticated using (published or public.is_staff());
drop policy if exists "exam_sets: staff write" on public.exam_sets;
create policy "exam_sets: staff write" on public.exam_sets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.exam_questions (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references public.exam_sets(id) on delete cascade,
  position    integer not null default 0,
  question    text not null check (char_length(question) between 1 and 3000),
  options     text[] not null check (array_length(options, 1) between 2 and 6),
  correct     integer not null check (correct >= 0 and correct < 6),
  explanation text not null default '' check (char_length(explanation) <= 4000),
  source_ref  text not null default '' check (char_length(source_ref) <= 200)
);
create index if not exists exam_questions_set_idx on public.exam_questions (set_id, position);
alter table public.exam_questions enable row level security;

drop policy if exists "exam_questions: readable" on public.exam_questions;
create policy "exam_questions: readable" on public.exam_questions
  for select to authenticated
  using (exists (select 1 from public.exam_sets s where s.id = set_id and (s.published or public.is_staff())));
drop policy if exists "exam_questions: staff write" on public.exam_questions;
create policy "exam_questions: staff write" on public.exam_questions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.exam_attempts (
  id         bigint generated always as identity primary key,
  user_id    text not null default public.requesting_user_id() references public.profiles(id) on delete cascade,
  set_id     uuid not null references public.exam_sets(id) on delete cascade,
  score      integer not null check (score >= 0),
  total      integer not null check (total > 0 and score <= total),
  created_at timestamptz not null default now()
);
create index if not exists exam_attempts_user_idx on public.exam_attempts (user_id, created_at desc);
alter table public.exam_attempts enable row level security;

drop policy if exists "exam_attempts: own or staff" on public.exam_attempts;
create policy "exam_attempts: own or staff" on public.exam_attempts
  for select to authenticated using (user_id = public.requesting_user_id() or public.is_staff());
drop policy if exists "exam_attempts: record own" on public.exam_attempts;
create policy "exam_attempts: record own" on public.exam_attempts
  for insert to authenticated with check (user_id = public.requesting_user_id());

create table if not exists public.exam_papers (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 160),
  unit          text not null default '' check (char_length(unit) <= 120),
  university_id text not null default '' check (char_length(university_id) <= 40),
  year          text not null default '' check (char_length(year) <= 20),
  url           text not null check (char_length(url) <= 800 and url ~ '^https?://'),
  notes         text not null default '' check (char_length(notes) <= 300),
  created_by    text default public.requesting_user_id(),
  created_at    timestamptz not null default now()
);
alter table public.exam_papers enable row level security;

drop policy if exists "exam_papers: readable" on public.exam_papers;
create policy "exam_papers: readable" on public.exam_papers
  for select to authenticated using (true);
drop policy if exists "exam_papers: staff write" on public.exam_papers;
create policy "exam_papers: staff write" on public.exam_papers
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Where students can look for more papers. search_url uses {q} for the search words.
create table if not exists public.exam_sources (
  id            text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name          text not null check (char_length(name) between 2 and 120),
  university_id text not null default '',
  home_url      text not null check (home_url ~ '^https?://'),
  search_url    text not null default '' check (search_url = '' or search_url ~ '^https?://'),
  position      integer not null default 0
);
alter table public.exam_sources enable row level security;

drop policy if exists "exam_sources: readable" on public.exam_sources;
create policy "exam_sources: readable" on public.exam_sources
  for select to authenticated using (true);
drop policy if exists "exam_sources: admins write" on public.exam_sources;
create policy "exam_sources: admins write" on public.exam_sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.exam_sources (id, name, university_id, home_url, search_url, position) values
  ('uon',      'University of Nairobi Digital Repository', 'uon',     'https://erepository.uonbi.ac.ke',   'https://www.google.com/search?q=site%3Aerepository.uonbi.ac.ke+{q}', 1),
  ('ku',       'Kenyatta University Repository',           'ku',      'https://ir-library.ku.ac.ke',       'https://www.google.com/search?q=site%3Air-library.ku.ac.ke+{q}',     2),
  ('moi',      'Moi University Repository',                'moi',     'https://ir.mu.ac.ke',               'https://www.google.com/search?q=site%3Air.mu.ac.ke+{q}',             3),
  ('jkuat',    'JKUAT Repository',                         'jkuat',   'https://ir.jkuat.ac.ke',            'https://www.google.com/search?q=site%3Air.jkuat.ac.ke+{q}',          4),
  ('egerton',  'Egerton University Repository',            'egerton', 'http://ir-library.egerton.ac.ke',   'https://www.google.com/search?q=site%3Air-library.egerton.ac.ke+{q}', 5),
  ('maseno',   'Maseno University Repository',             'maseno',  'https://repository.maseno.ac.ke',   'https://www.google.com/search?q=site%3Arepository.maseno.ac.ke+{q}', 6),
  ('mku',      'Mount Kenya University Repository',        'mku',     'https://repository.mku.ac.ke',      'https://www.google.com/search?q=site%3Arepository.mku.ac.ke+{q}',    7),
  ('aku',      'Aga Khan University eCommons',             '',        'https://ecommons.aku.edu',          'https://www.google.com/search?q=site%3Aecommons.aku.edu+{q}',        8),
  ('kenyaplex','KenyaPlex — university past papers',       '',        'https://www.kenyaplex.com/exams/',  'https://www.google.com/search?q=site%3Akenyaplex.com%2Fexams+{q}',   9)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- ADMIN INVITES — give someone a role by email, before or after
-- they join. Claimed on their next visit. Needs the email in the
-- Clerk session token (Clerk > Sessions > Customize session token:
--   { "email": "{{user.primary_email_address}}" } )
-- so the database can trust it.
-- ---------------------------------------------------------
create table if not exists public.role_invites (
  email      text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       text not null check (role in ('super_admin', 'admin', 'moderator')),
  invited_by text default public.requesting_user_id(),
  created_at timestamptz not null default now()
);
alter table public.role_invites enable row level security;

drop policy if exists "role_invites: admins read" on public.role_invites;
create policy "role_invites: admins read" on public.role_invites
  for select to authenticated using (public.is_admin());
drop policy if exists "role_invites: admins invite" on public.role_invites;
create policy "role_invites: admins invite" on public.role_invites
  for insert to authenticated
  with check (public.is_admin() and (role = 'moderator' or public.my_role() = 'super_admin'));
drop policy if exists "role_invites: admins revoke" on public.role_invites;
create policy "role_invites: admins revoke" on public.role_invites
  for delete to authenticated
  using (public.is_admin() and (role = 'moderator' or public.my_role() = 'super_admin'));

create or replace function public.claim_role_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  me      text := public.requesting_user_id();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  inv     public.role_invites%rowtype;
begin
  if me is null or v_email is null then return null; end if;
  select * into inv from public.role_invites where email = v_email;
  if not found then return null; end if;
  if not exists (select 1 from public.profiles where id = me) then return null; end if;  -- finish onboarding first
  if not exists (select 1 from public.user_roles where user_id = me) then
    insert into public.user_roles (user_id, role, granted_by) values (me, inv.role, inv.invited_by);
  end if;
  delete from public.role_invites where email = v_email;
  return inv.role;
end $$;
revoke all on function public.claim_role_invite() from public, anon;
grant execute on function public.claim_role_invite() to authenticated;

-- Activity logging for the v3 tables (function defined above).
do $$
declare t text;
begin
  foreach t in array array['exam_sets', 'exam_attempts', 'exam_papers', 'role_invites'] loop
    execute format('drop trigger if exists log_activity on public.%I', t);
  end loop;
end $$;
create trigger log_activity after insert or delete on public.exam_sets     for each row execute function public.log_activity();
create trigger log_activity after insert           on public.exam_attempts for each row execute function public.log_activity();
create trigger log_activity after insert or delete on public.exam_papers   for each row execute function public.log_activity();
create trigger log_activity after insert or delete on public.role_invites  for each row execute function public.log_activity();

# MedLink KE

Your medical school, all in one place — free study resources, exam practice, unit study groups,
communities and messaging for medical students in Kenya.

Plain HTML/CSS/JS (no framework, no bundler).

| Concern        | Service  | Notes |
| -------------- | -------- | ----- |
| Authentication | **Clerk** | Sign-up, sign-in, sessions, account management |
| Data + files   | **Supabase** | Postgres with Row Level Security, Storage for uploads |
| Hosting        | **Vercel** | Static deploy; `scripts/build.mjs` injects keys at build time |

Supabase never handles logins — it trusts Clerk session tokens through Clerk's official
[Supabase integration](https://clerk.com/docs/integrations/databases/supabase). Inside the database the
signed-in user is `auth.jwt() ->> 'sub'` (their Clerk user ID), and every table is locked down with RLS.

---

## Setup (about 10 minutes)

### 1. Clerk
1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and pick the sign-in
   methods you want (email, Google, …).
2. **Configure → API keys** → copy the **Publishable key** (`pk_test_…`).
3. Open the **Supabase integration** setup ([dashboard.clerk.com/setup/supabase](https://dashboard.clerk.com/setup/supabase)),
   click **Activate Supabase integration**, and copy the **Clerk domain** it shows.

### 2. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste the whole of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates all tables, security policies, the 4 starter communities, the `resources` and `site-media`
   storage buckets, analytics + activity logging, roles and the admin functions.
3. **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk** → paste the Clerk domain.
4. **Project Settings → API** → copy the **Project URL** and the **publishable / anon key**
   (never the `service_role` / secret key).

### 3. Vercel
1. **Project → Settings → Environment Variables**, add:

   | Name | Value |
   | ---- | ----- |
   | `CLERK_PUBLISHABLE_KEY` | `pk_test_…` from Clerk |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | publishable / anon key |

2. Redeploy. `vercel.json` runs `node scripts/build.mjs`, which copies the site into `dist/` and
   writes `dist/config.js` from those variables.

> Clerk **development** keys (`pk_test_…`) work on any `*.vercel.app` URL — perfect for testing and
> sharing. Clerk **production** keys require a domain you own.

### Running locally
```bash
cp config.example.js config.js   # then fill in the three values
npx serve .                      # or any static file server
```

---

## How it's organised

```
app.js              runtime: config checks, Clerk boot, Supabase client, all queries, shared UI
data.js             static catalogue: universities, courses, units, interests, practice questions, news
theme.js            light / dark theme (runs before first paint)
styles.css          design system        landing.css   landing page only
admin.html/js/css   admin dashboard (analytics, activity, users & roles, content, images)
img/                default site photos (Unsplash, see img/CREDITS.md) — replaceable from the admin page
*.html              one file per page; each calls MedLink.run({ page }, async ({ api, me }) => …)
supabase/schema.sql database schema + RLS + storage bucket
scripts/build.mjs   Vercel build: copies files to dist/ and writes config.js from env vars
```

### What's live
- **Accounts** — Clerk sign-up / sign-in / sign-out, account & security settings.
- **Onboarding** — username (unique), course → university → year, current units, interests. Editable later.
- **Study Library** — upload PDFs, Word, PowerPoint, images (≤ 20 MB) per unit; filter, preview, download,
  save, report, delete your own.
- **Unit study groups** — every unit has a shared feed; see how many students take it.
- **Communities** — join/leave, post, like, comment.
- **Messages** — direct messages with unread badges (refreshes every 5 seconds).
- **Profiles** — follow/unfollow, followers, posts, resources, communities, MedPoints.
- **Search** — resources, students, communities and discussions.
- Exam Bank practice questions and Medical News are static content in `data.js`.

## Admin dashboard (`admin.html`)

### Become the first super admin
1. Sign up in the app and finish onboarding.
2. Supabase → **SQL Editor** → run (with your username):
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin' from public.profiles where username = 'your_username';
   ```
3. Reload — an orange shield appears in the top bar and **Admin** in the sidebar.

After that, give other people roles from **Admin → Users & roles**.

| Role | Can |
| ---- | --- |
| **Super admin** | Everything, including making admins / super admins and suspending staff |
| **Admin** | Site images, communities, edit profiles, suspend students, make moderators |
| **Moderator** | Analytics, activity, reports; edit or remove posts, comments and resources |

Every rule is enforced in the database (RLS + `set_user_role`, `set_user_suspended`, `admin_stats`,
`admin_users` in `schema.sql`), not just by hiding buttons.

### What's in it
- **Overview** — page views, visitors, sign-ups, active members, bounce rate, time on page (with change vs the
  previous period), traffic and sign-up charts, devices, top pages, live activity, all-time totals.
- **Traffic** — sources (Google, WhatsApp, Instagram, Facebook, X, TikTok, direct…), referring sites, UTM
  campaigns with sign-up conversion, landing pages, hour-of-day / day-of-week, devices, browsers, OS,
  time zones, students by university / programme / year, and a **campaign link builder**.
  WhatsApp hides where clicks come from — share tagged links (`?utm_source=whatsapp&utm_campaign=…`).
- **Activity** — the server-side activity log (sign-ups, posts, uploads, likes, saves, follows, joins,
  messages sent — never message text — role changes, suspensions, image changes) and a live stream of
  page views, clicks, time on page and JavaScript errors. Auto-refresh available.
- **Users & roles** — search by name, username or email; assign roles; suspend / unsuspend with a reason
  (suspended users can read but not post, upload, comment or message); edit name / bio; per-user timeline
  of visits, traffic sources and actions.
- **Content** — edit or delete any resource, post or comment.
- **Reports** — resolve, dismiss, reopen, or delete the reported resource.
- **Communities** — create, rename, re-describe, change the cover photo, delete.
- **Site images** — every photo on the site has a slot; replace it by uploading, picking from the media
  library, or pasting a link, and reset to the built-in photo any time. The media library lists uploads with
  where each one is used, and lets you delete them.

### What's tracked
`app.js` records page views, clicks on anything marked `data-track`, links to other sites, key actions
(sign-up, sign-in/out, uploads, downloads, views, saves, likes, comments, posts, follows, joins, searches,
messages sent, quiz starts/results), time actively spent on each page, and JavaScript errors — together with the
visit's traffic source (referrer + UTM), landing page, device, browser, OS, screen width, language and time zone.
Visitors get a random anonymous ID; signed-in events are linked to the user by the database itself.
Only staff can read the data. The landing-page footer tells visitors anonymous statistics are collected.

### Upgrading an existing project
Re-run the whole of `supabase/schema.sql` in the SQL Editor — it only adds what's missing.

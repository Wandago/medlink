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
   This creates all tables, security policies, the 4 starter communities and the `resources` storage bucket.
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

### Moderation
Reports land in the `resource_reports` table — review them in the Supabase Table Editor.

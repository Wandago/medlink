/* =========================================================
   MEDLINK KE — runtime configuration TEMPLATE
   ---------------------------------------------------------
   This file IS committed. It contains no real credentials.

   LOCAL SETUP:
     1. Copy this file to `config.js`  (config.js is gitignored)
     2. Fill in the three values below
     3. Serve the folder (e.g. `npx serve .`) and open it

   ON VERCEL you don't need this file: set the same three
   values as Environment Variables and `scripts/build.mjs`
   writes config.js during the deploy.

   All three values are PUBLISHABLE keys — they are designed
   to live in the browser. Access is enforced by Clerk
   sessions + Supabase Row Level Security.

   NEVER put a Clerk secret key (sk_...) or the Supabase
   service_role / sb_secret_ key here. The app refuses to
   start if it detects a Supabase secret key.
========================================================= */
window.MEDLINK_CONFIG = {
  // Clerk dashboard > Configure > API keys > Publishable key
  CLERK_PUBLISHABLE_KEY: "pk_test_YOUR-CLERK-PUBLISHABLE-KEY",

  // Supabase dashboard > Project Settings > API
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR-SUPABASE-PUBLISHABLE-OR-ANON-KEY",
};

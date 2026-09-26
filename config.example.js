/* =========================================================
   MEDLINK KE — Supabase configuration TEMPLATE
   ---------------------------------------------------------
   This file IS committed to version control. It contains no
   real credentials — only the shape of the config.

   SETUP:
     1. Copy this file to `config.js`  (config.js is gitignored)
     2. Fill in the two values from your Supabase dashboard:
          Project Settings > API
     3. Reload the page

   ONLY ever put the PUBLISHABLE (anon) key here.
   It is safe in a browser: it is designed to be public and is
   constrained by Row Level Security on the database.

   NEVER put the service_role / secret key in this file, or in
   any other file the browser downloads. It bypasses RLS and
   would give anyone full read/write access to your data.
========================================================= */
window.MEDLINK_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR-PUBLISHABLE-ANON-KEY",
};

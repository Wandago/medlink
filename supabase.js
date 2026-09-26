/* =========================================================
   MEDLINK KE — centralized Supabase client
   ---------------------------------------------------------
   The ONE place the Supabase client is created. Every future
   feature (auth, profiles, resources, messaging, storage)
   should import it from here rather than calling
   createClient() again.

   Load order required on every page:
     1. https://cdn.jsdelivr.net/.../supabase-js  (UMD global)
     2. config.js                                 (credentials)
     3. supabase.js                        (this file)

   Nothing here touches the DOM or the UI, and nothing here
   creates tables or queries data yet — this only establishes
   and verifies the connection.

   DESIGN NOTE: every failure path is non-fatal. If the CDN is
   unreachable, or config.js is missing, or the keys are still
   placeholders, the app logs a clear warning and carries on
   running exactly as it does today on localStorage.
========================================================= */
(function () {
  "use strict";

  var PLACEHOLDERS = ["YOUR-PROJECT-REF", "YOUR-PUBLISHABLE-ANON-KEY"];

  function looksLikePlaceholder(value) {
    if (!value) return true;
    for (var i = 0; i < PLACEHOLDERS.length; i++) {
      if (String(value).indexOf(PLACEHOLDERS[i]) !== -1) return true;
    }
    return false;
  }

  // ---- 1. read configuration -------------------------------------------
  var config = window.MEDLINK_CONFIG || null;
  var url = config && config.SUPABASE_URL;
  var key = config && config.SUPABASE_PUBLISHABLE_KEY;

  var status = { ready: false, reason: null };

  if (!config) {
    status.reason = "config-missing";
  } else if (looksLikePlaceholder(url) || looksLikePlaceholder(key)) {
    status.reason = "config-placeholder";
  } else if (!/^https:\/\/.+\.supabase\.(co|in)$/.test(String(url).replace(/\/+$/, ""))) {
    status.reason = "config-url-invalid";
  }

  // Guard against a secret key being pasted in by mistake. The service_role
  // JWT carries "service_role" in its payload; it must never reach a browser.
  if (!status.reason && typeof key === "string" && key.indexOf(".") !== -1) {
    try {
      var payload = JSON.parse(atob(key.split(".")[1]));
      if (payload && payload.role && payload.role !== "anon") {
        status.reason = "config-secret-key";
      }
    } catch (e) { /* not a JWT (newer publishable keys aren't) — fine */ }
  }

  // ---- 2. check the library actually loaded ----------------------------
  var lib = window.supabase;
  if (!status.reason && (!lib || typeof lib.createClient !== "function")) {
    status.reason = "library-missing";
  }

  // ---- 3. create the single client -------------------------------------
  var client = null;
  if (!status.reason) {
    try {
      client = lib.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "medlink_auth",
        },
      });
      status.ready = true;
    } catch (err) {
      status.reason = "client-init-failed";
      status.error = err && err.message;
    }
  }

  var MESSAGES = {
    "config-missing":
      "config.js not found. Copy config.example.js to config.js and add your project values.",
    "config-placeholder":
      "config.js still has placeholder values. Add your real SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    "config-url-invalid":
      "SUPABASE_URL does not look like a Supabase project URL (expected https://<ref>.supabase.co).",
    "config-secret-key":
      "That looks like a SECRET/service_role key. Never use it in the browser — use the publishable (anon) key.",
    "library-missing":
      "The supabase-js library did not load. Check the CDN <script> tag and your network connection.",
    "client-init-failed":
      "supabase-js failed to initialise the client.",
  };

  /**
   * Small connection test. Confirms the client initialised and that the
   * project endpoint is reachable and accepts our key.
   *
   * Deliberately queries NO tables — none exist yet. It calls the REST
   * root, which answers for any project regardless of schema.
   *
   * @returns {Promise<{ok: boolean, stage: string, detail: string}>}
   */
  function testConnection() {
    if (!status.ready) {
      return Promise.resolve({
        ok: false,
        stage: "init",
        detail: MESSAGES[status.reason] || "Supabase client is not configured.",
      });
    }

    // Local check first: does the auth module respond?
    return client.auth.getSession()
      .then(function () {
        // Network check: REST root returns 200 for a valid project + key,
        // and needs no tables to exist.
        return fetch(String(url).replace(/\/+$/, "") + "/rest/v1/", {
          headers: { apikey: key, Authorization: "Bearer " + key },
        });
      })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          return { ok: false, stage: "auth", detail: "Project reachable, but the key was rejected (" + res.status + "). Check SUPABASE_PUBLISHABLE_KEY." };
        }
        if (!res.ok) {
          return { ok: false, stage: "network", detail: "Project responded with HTTP " + res.status + "." };
        }
        return { ok: true, stage: "connected", detail: "Supabase client initialised and project reachable." };
      })
      .catch(function (err) {
        return {
          ok: false,
          stage: "network",
          detail: "Could not reach the project: " + (err && err.message ? err.message : "network error"),
        };
      });
  }

  // ---- 4. expose a single global --------------------------------------
  window.MedLinkSupabase = {
    /** The shared SupabaseClient, or null if not configured. */
    client: client,
    /** True when the client was created successfully. */
    isReady: function () { return status.ready; },
    /** Machine-readable reason the client is unavailable, or null. */
    reason: function () { return status.reason; },
    /** Human-readable explanation, or null. */
    message: function () { return status.reason ? MESSAGES[status.reason] : null; },
    /** Run the connection test. Returns a Promise. */
    testConnection: testConnection,
  };

  // ---- 5. one-line status in the console, no UI impact -----------------
  if (status.ready) {
    console.info("%c[MedLink] Supabase client initialised.", "color:#7C3AED;font-weight:600");
    console.info("[MedLink] Run  await MedLinkSupabase.testConnection()  to verify connectivity.");
  } else {
    console.warn(
      "[MedLink] Supabase not connected — " + (MESSAGES[status.reason] || status.reason) +
      "\n[MedLink] The app continues to run on local storage; nothing is broken."
    );
  }
})();

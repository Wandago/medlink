/* =========================================================
   MEDLINK KE — application runtime
   ---------------------------------------------------------
   Auth: Clerk (sign-in / sign-up / sessions).
   Data: Supabase Postgres + Storage, which trusts Clerk session
         tokens via the Clerk third-party-auth integration.

   Page load order (end of <body>):
     config.js  ->  data.js  ->  app.js  ->  page script
   Every page script calls:
     MedLink.run({ page: "dashboard" }, async (ctx) => { ... })
   ctx = { sb, clerk, me, role, suspension, api }

   Also here: analytics (page views, actions, engagement time and
   traffic sources -> "events" table), roles and site images.
========================================================= */
(function () {
  "use strict";

  var SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  var CLERK_JS_VERSION = "5";

  // ---------------------------------------------------------------------
  // Small DOM helpers (global — used by every page script)
  // ---------------------------------------------------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (kv) {
      var k = kv[0], v = kv[1];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return node;
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function safeColor(c) { return /^#[0-9A-Fa-f]{6}$/.test(c || "") ? c : "#1A56F0"; }
  function param(name) { return new URLSearchParams(location.search).get(name); }
  function profileHref(p) { return "profile.html?u=" + encodeURIComponent(p.username); }
  function timeAgo(ts) {
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    if (s < 604800) return Math.floor(s / 86400) + "d";
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function formatBytes(n) {
    if (!n) return "";
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function plural(n, word) { return Number(n).toLocaleString() + " " + word + (n === 1 ? "" : "s"); }
  function count(embed) { return (embed && embed[0] && embed[0].count) || 0; }
  function must(res) { if (res.error) throw res.error; return res.data; }

  // Only allow same-site page redirects like "dashboard.html?x=1".
  function safeRedirect(target) {
    return target && /^[a-z-]+\.html(\?[^#]*)?$/.test(target) ? target : null;
  }
  function currentPage() {
    var file = location.pathname.split("/").pop() || "index.html";
    if (!/\.html$/.test(file)) file = file + ".html";
    return file + location.search;
  }
  function go(href) { location.href = href; }

  // ---------------------------------------------------------------------
  // Feedback: toast, modal, empty/error states
  // ---------------------------------------------------------------------
  function toast(message, kind) {
    var host = qs("#toast-host") || document.body.appendChild(el("div", { id: "toast-host", class: "toast-host", role: "status", "aria-live": "polite" }));
    var t = el("div", { class: "toast" + (kind ? " toast-" + kind : "") }, [message]);
    host.appendChild(t);
    setTimeout(function () { t.classList.add("leaving"); }, 3200);
    setTimeout(function () { t.remove(); }, 3600);
  }
  function errorMessage(err) {
    if (!err) return "Something went wrong.";
    var msg = err.message || String(err);
    if (/duplicate key/i.test(msg)) return "That already exists.";
    if (/row-level security/i.test(msg)) return "You don't have permission to do that.";
    if (/Failed to fetch|NetworkError/i.test(msg)) return "Network error — check your connection.";
    return msg;
  }
  function reportError(err) {
    console.error("[MedLink]", err);
    toast(errorMessage(err), "error");
  }
  function modal(title, body, opts) {
    opts = opts || {};
    var backdrop = el("div", { class: "modal-backdrop" });
    var box = el("div", { class: "modal card" + (opts.wide ? " modal-wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title });
    var close = function () { backdrop.remove(); document.removeEventListener("keydown", onKey); };
    var onKey = function (e) { if (e.key === "Escape") close(); };
    box.appendChild(el("div", { class: "modal-head" }, [
      el("h2", { class: "disp" }, [title]),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Close", onclick: close }, ["✕"]),
    ]));
    box.appendChild(body);
    backdrop.appendChild(box);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop && !opts.sticky) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(backdrop);
    var first = qs("input, select, textarea, button:not(.icon-btn)", box);
    if (first) first.focus();
    return close;
  }
  function emptyState(text, action) {
    return el("div", { class: "empty-state" }, [el("div", {}, [text]), action || null]);
  }
  function loadingState() { return el("div", { class: "loading-state" }, ["Loading…"]); }

  // ---------------------------------------------------------------------
  // Analytics — page views, actions, engagement time, traffic sources.
  // Rows go to the Supabase "events" table, which only staff can read.
  // The database fills in user_id from the session token itself.
  // ---------------------------------------------------------------------
  var tracker = (function () {
    var VISITOR_KEY = "ml_vid", SESSION_KEY = "ml_session", IDLE_MS = 30 * 60 * 1000;
    // Hops through sign-in providers are not traffic sources.
    var AUTH_HOSTS = /(^|\.)(clerk\.accounts\.dev|clerk\.com|accounts\.dev)$|^clerk\.|^accounts\.google\.|^appleid\.apple\.com$/;
    var queue = [], client = null, timer = null, started = false, errors = 0;
    var visibleSince = Date.now(), engaged = 0;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
    function newId() {
      return (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
    }
    function clip(v, n) { return String(v == null ? "" : v).slice(0, n); }

    var visitorId = lsGet(VISITOR_KEY);
    if (!visitorId || visitorId.length < 8) { visitorId = newId(); lsSet(VISITOR_KEY, visitorId); }

    var ua = navigator.userAgent || "";
    var device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet"
      : /Mobi|iPhone|iPod|Android/i.test(ua) ? "mobile" : "desktop";
    var browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";
    var os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS"
      : /CrOS/.test(ua) ? "ChromeOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
    var timezone = "";
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* old browser */ }

    function pagePath() {
      var f = location.pathname.split("/").pop() || "index.html";
      return "/" + (/\.html$/.test(f) ? f : f + ".html");
    }
    function attribution() {
      var q = new URLSearchParams(location.search);
      var ref = document.referrer || "", host = "";
      try { if (ref) { var u = new URL(ref); host = u.hostname; ref = u.origin + u.pathname; } } catch (e) { ref = ""; }
      if (host === location.hostname || AUTH_HOSTS.test(host)) { ref = ""; host = ""; }
      return {
        referrer: clip(ref, 500), referrer_host: clip(host, 200),
        utm_source: clip(q.get("utm_source"), 100).toLowerCase(), utm_medium: clip(q.get("utm_medium"), 100).toLowerCase(),
        utm_campaign: clip(q.get("utm_campaign"), 100), utm_term: clip(q.get("utm_term"), 100), utm_content: clip(q.get("utm_content"), 100),
      };
    }
    // A session ends after 30 idle minutes, or when a new campaign link is opened.
    function session() {
      var now = Date.now(), s = null;
      try { s = JSON.parse(lsGet(SESSION_KEY) || "null"); } catch (e) { s = null; }
      var a = attribution();
      if (!s || !s.id || now - (s.last || 0) > IDLE_MS || (a.utm_source && a.utm_source !== s.utm_source)) {
        s = Object.assign({ id: newId(), landing: pagePath() }, a);
      }
      s.last = now;
      lsSet(SESSION_KEY, JSON.stringify(s));
      return s;
    }
    function cleanProps(props) {
      var out = {};
      Object.keys(props || {}).slice(0, 12).forEach(function (k) {
        var v = props[k];
        if (v == null) return;
        out[clip(k, 40)] = typeof v === "number" || typeof v === "boolean" ? v : clip(v, 200);
      });
      return out;
    }
    function build(type, name, props, duration) {
      var s = session();
      return {
        visitor_id: visitorId, session_id: s.id, type: type, name: clip(name, 60), path: pagePath(),
        props: cleanProps(props), referrer: s.referrer || "", referrer_host: s.referrer_host || "",
        utm_source: s.utm_source || "", utm_medium: s.utm_medium || "", utm_campaign: s.utm_campaign || "",
        utm_term: s.utm_term || "", utm_content: s.utm_content || "", landing_path: clip(s.landing || "", 300),
        device: device, browser: browser, os: os, screen_w: Math.min(20000, Math.max(0, screen.width | 0)),
        language: clip(navigator.language, 20), timezone: clip(timezone, 60),
        duration_ms: duration == null ? null : Math.min(86400000, Math.max(0, Math.round(duration))),
      };
    }
    function flush() {
      clearTimeout(timer); timer = null;
      if (!client) return Promise.resolve();
      var sends = [];
      while (queue.length) {
        sends.push(client.from("events").insert(queue.splice(0, 20)).then(function (res) {
          if (res.error) console.warn("[MedLink] analytics:", res.error.message);
        }));
      }
      return Promise.all(sends);
    }
    function push(row) {
      queue.push(row);
      if (queue.length > 200) queue.shift();
      if (client && !timer) timer = setTimeout(flush, 1500);
    }
    function sendEngagement() {
      if (visibleSince) { engaged += Date.now() - visibleSince; visibleSince = 0; }
      if (started && engaged >= 1000) {
        push(build("page_leave", "engaged", {}, engaged));
        engaged = 0;
      }
      flush();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") sendEngagement();
      else visibleSince = Date.now();
    });
    window.addEventListener("pagehide", sendEngagement);

    // Anything marked data-track="name" is counted when clicked, as are links to other sites.
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-track]");
      if (t) push(build("action", t.getAttribute("data-track"), { label: (t.textContent || "").trim().slice(0, 80) }));
      var a = e.target.closest && e.target.closest("a[href]");
      if (a && a.hostname && a.hostname !== location.hostname && /^https?:$/.test(a.protocol)) {
        push(build("action", "outbound_click", { href: a.href.slice(0, 200) }));
      }
    }, true);
    window.addEventListener("error", function (e) {
      if (++errors > 5) return;
      push(build("error", "js_error", { message: e.message, source: (e.filename || "").split("/").pop() + ":" + (e.lineno || 0) }));
    });
    window.addEventListener("unhandledrejection", function (e) {
      if (++errors > 5) return;
      var r = e.reason || {};
      push(build("error", "promise_error", { message: r.message || String(r) }));
    });

    return {
      start: function (url, key, getToken) {
        client = window.supabase.createClient(url, key, {
          accessToken: getToken,
          // keepalive lets the last batch survive the page closing.
          global: { fetch: function (u, o) { return fetch(u, Object.assign({}, o, { keepalive: true })); } },
        });
      },
      pageView: function (props) {
        if (started) return;
        started = true;
        push(build("page_view", "page_view", props));
        flush();
      },
      action: function (name, props) { push(build("action", name, props)); },
      // Send now and wait (briefly) — for events right before a redirect.
      flushNow: function (ms) {
        return Promise.race([flush(), new Promise(function (r) { setTimeout(r, ms || 800); })]).catch(function () {});
      },
      visitorId: function () { return visitorId; },
    };
  })();
  function track(name, props) { tracker.action(name, props); }

  // ---------------------------------------------------------------------
  // Site images — every photo has a slot (see SITE_IMAGES in data.js).
  // Admins override slots in the site_images table; the last known
  // overrides are cached so returning visitors don't see the old photo.
  // ---------------------------------------------------------------------
  var IMAGE_CACHE_KEY = "ml_site_images";
  var siteImageMap = (function () {
    try { return JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || "null") || {}; } catch (e) { return {}; }
  })();
  function siteImageDefault(slot) {
    var def = (typeof SITE_IMAGES !== "undefined" ? SITE_IMAGES : []).find(function (x) { return x.slot === slot; });
    return def ? def.src : "";
  }
  function siteImageUrl(slot) {
    return (siteImageMap[slot] && siteImageMap[slot].url) || siteImageDefault(slot);
  }
  function cssUrl(url) { return 'url("' + String(url).replace(/["\\\n\r]/g, "") + '")'; }
  function applySiteImages(root) {
    qsa("[data-slot]", root).forEach(function (n) {
      var slot = n.getAttribute("data-slot"), url = siteImageUrl(slot);
      if (!url) return;
      if (n.tagName === "IMG") {
        if (n.getAttribute("src") !== url) n.setAttribute("src", url);
        var alt = siteImageMap[slot] && siteImageMap[slot].alt;
        if (alt) n.setAttribute("alt", alt);
      } else {
        n.style.backgroundImage = cssUrl(url);
      }
    });
  }
  async function refreshSiteImages() {
    try {
      var rows = must(await ctx.sb.from("site_images").select("slot,url,alt"));
      siteImageMap = {};
      rows.forEach(function (r) { siteImageMap[r.slot] = { url: r.url, alt: r.alt }; });
      try { localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(siteImageMap)); } catch (e) { /* private mode */ }
      applySiteImages();
    } catch (err) { console.warn("[MedLink] site images:", errorMessage(err)); }
  }
  function communityImage(c) {
    return (c && c.image_url) || (typeof COMMUNITY_IMAGES !== "undefined" && c && COMMUNITY_IMAGES[c.id]) || "";
  }
  function communityColor(c) {
    var id = String((c && c.id) || ""), h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    var list = typeof COMMUNITY_FALLBACK_COLORS !== "undefined" ? COMMUNITY_FALLBACK_COLORS : ["#1A56F0"];
    return list[h % list.length];
  }
  applySiteImages();

  // ---------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------
  function readConfig() {
    var c = window.MEDLINK_CONFIG || {};
    var clerkKey = String(c.CLERK_PUBLISHABLE_KEY || "").trim();
    var sbUrl = normalizeSupabaseUrl(c.SUPABASE_URL);
    var sbKey = String(c.SUPABASE_PUBLISHABLE_KEY || "").trim();
    var problems = [];
    if (!window.MEDLINK_CONFIG) problems.push("config.js is missing. Copy config.example.js to config.js (or set the Vercel environment variables) and fill in your keys.");
    if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]{10,}$/.test(clerkKey)) problems.push("CLERK_PUBLISHABLE_KEY is missing or invalid (it starts with pk_test_ or pk_live_).");
    if (!/^https:\/\/\S+$/.test(sbUrl) || /YOUR-/i.test(sbUrl)) problems.push("SUPABASE_URL is missing (it looks like https://<project-ref>.supabase.co).");
    if (!sbKey || /YOUR-/i.test(sbKey)) problems.push("SUPABASE_PUBLISHABLE_KEY is missing (use the publishable / anon key).");
    if (/^sb_secret_/.test(sbKey) || jwtRole(sbKey) === "service_role") {
      problems.push("SUPABASE_PUBLISHABLE_KEY looks like a SECRET key. Never ship it to the browser — use the publishable (anon) key.");
    }
    return { clerkKey: clerkKey, sbUrl: sbUrl, sbKey: sbKey, problems: problems };
  }
  // People paste the REST endpoint (".../rest/v1/") or a dashboard link; only the origin is wanted.
  function normalizeSupabaseUrl(raw) {
    var s = String(raw || "").trim().replace(/^["']+|["']+$/g, "");
    var dash = /supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(s);
    if (dash) return "https://" + dash[1] + ".supabase.co";
    try { return new URL(s).origin; } catch (e) { return s.replace(/\/+$/, ""); }
  }
  // Turn the usual first-run database errors into a concrete next step.
  function databaseHint(err) {
    var msg = (err && (err.message || err.hint || err.code)) || String(err);
    if (/Invalid path/i.test(msg)) return "SUPABASE_URL must be just https://<project-ref>.supabase.co — nothing after .co. Fix it in Vercel > Settings > Environment Variables, then redeploy.";
    if (/Invalid API key|No API key/i.test(msg)) return "SUPABASE_PUBLISHABLE_KEY is wrong. Copy the publishable (or anon) key from Supabase > Project Settings > API Keys, then redeploy.";
    if (/JW[ST]|PGRST30|alg|signature|No suitable key/i.test(msg)) return "Supabase doesn't trust Clerk sign-ins yet. In Supabase > Authentication > Sign In / Providers > Third-party Auth, add Clerk with your Clerk domain (from dashboard.clerk.com/setup/supabase).";
    if (/does not exist|PGRST20[25]|schema cache/i.test(msg)) return "The database tables are missing. Run the whole of supabase/schema.sql in Supabase > SQL Editor.";
    return "If this is a fresh setup: run supabase/schema.sql in the Supabase SQL Editor, and connect Clerk under Supabase > Authentication > Third-party Auth.";
  }
  function jwtRole(key) {
    try { return JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch (e) { return null; }
  }
  function clerkAppearance() {
    var font = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      variables: dark
        ? { colorPrimary: "#5B8CFF", colorBackground: "#121A33", colorText: "#E8EEFF", colorTextSecondary: "#A9B6D6",
            colorInputBackground: "#0A1022", colorInputText: "#E8EEFF", colorNeutral: "#E8EEFF", borderRadius: "14px", fontFamily: font }
        : { colorPrimary: "#1A56F0", colorText: "#0B1533", borderRadius: "14px", fontFamily: font },
    };
  }
  // Clerk publishable keys encode their Frontend API host: pk_test_<base64(host + "$")>
  function clerkFrontendApi(pk) {
    return atob(pk.split("_")[2]).replace(/\$$/, "");
  }

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      Object.entries(attrs || {}).forEach(function (kv) { s.setAttribute(kv[0], kv[1]); });
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src.split("/")[2] + ". Check your connection.")); };
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------------
  // Boot splash + setup / fatal screens
  // ---------------------------------------------------------------------
  var splash = el("div", { class: "boot-splash", "aria-label": "Loading" }, [
    el("span", { class: "brand-mark boot-mark", html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.2l1.6-4.2 2.6 8.4 2-5.2 1.4 3H21"/></svg>' }),
  ]);
  if (!document.body.classList.contains("lp-page")) document.body.appendChild(splash);
  function ready() { splash.remove(); document.body.classList.add("ready"); }

  function renderNotice(title, lines, extra) {
    ready();
    document.body.classList.add("notice-page");
    var list = el("ul", { class: "notice-list" }, lines.map(function (l) { return el("li", {}, [l]); }));
    document.body.replaceChildren(el("div", { class: "notice-wrap" }, [
      el("div", { class: "card notice-card" }, [
        el("h1", { class: "disp" }, [title]),
        list,
        extra || null,
      ]),
    ]));
  }
  function renderSetupNeeded(problems) {
    renderNotice("MedLink needs a little setup", problems,
      el("p", { class: "muted" }, ["See README.md in the repository for the step-by-step Clerk + Supabase setup."]));
  }

  // Never resolves: used after a redirect so page code simply stops.
  function halt() { return new Promise(function () {}); }

  // ---------------------------------------------------------------------
  // Core context
  // ---------------------------------------------------------------------
  var ctx = { sb: null, clerk: null, me: null, role: null, suspension: null, api: null, configured: false };

  async function boot(opts) {
    opts = Object.assign({ page: null, auth: "required", authPage: "sign-in.html", profile: "required", shell: true, allowUnconfigured: false, staff: false }, opts);
    var cfg = readConfig();
    if (cfg.problems.length) {
      if (opts.allowUnconfigured) { ready(); return ctx; }
      renderSetupNeeded(cfg.problems);
      return halt();
    }

    try {
      await Promise.all([
        window.supabase ? Promise.resolve() : loadScript(SUPABASE_JS),
        window.Clerk ? Promise.resolve() : loadScript(
          "https://" + clerkFrontendApi(cfg.clerkKey) + "/npm/@clerk/clerk-js@" + CLERK_JS_VERSION + "/dist/clerk.browser.js",
          { "data-clerk-publishable-key": cfg.clerkKey }
        ),
      ]);
      await window.Clerk.load({
        signInUrl: new URL("sign-in.html", location.href).href,
        signUpUrl: new URL("sign-up.html", location.href).href,
        afterSignOutUrl: new URL("index.html", location.href).href,
        appearance: clerkAppearance(),
      });
    } catch (err) {
      console.error(err);
      if (opts.allowUnconfigured) { ready(); return ctx; }
      renderNotice("Couldn't start MedLink", [errorMessage(err), "Check that CLERK_PUBLISHABLE_KEY is correct and try reloading."]);
      return halt();
    }

    var clerk = window.Clerk;
    ctx.clerk = clerk;
    ctx.configured = true;
    var signedIn = !!clerk.user;
    var getToken = async function () {
      return clerk.session ? (await clerk.session.getToken()) : null;
    };
    tracker.start(cfg.sbUrl, cfg.sbKey, getToken);

    if (opts.auth === "required" && !signedIn) {
      go(opts.authPage + "?redirect=" + encodeURIComponent(currentPage()));
      return halt();
    }
    if (opts.auth === "guest-only" && signedIn) {
      go(safeRedirect(param("redirect")) || "dashboard.html");
      return halt();
    }

    ctx.sb = window.supabase.createClient(cfg.sbUrl, cfg.sbKey, { accessToken: getToken });
    ctx.api = api;
    refreshSiteImages();

    if (signedIn) {
      try {
        var found = await Promise.all([api.myProfile(), api.myStatus()]);
        ctx.me = found[0];
        ctx.role = found[1].role;
        ctx.suspension = found[1].suspension;
        if (ctx.me && !ctx.role) ctx.role = await claimInvite(clerk.user.id);
      } catch (err) {
        console.error(err);
        renderNotice("Couldn't reach the database", [errorMessage(err), databaseHint(err)]);
        return halt();
      }
      if (!ctx.me && opts.profile === "required") {
        go("onboarding.html");
        return halt();
      }
      // Bookkeeping only — never allowed to break the page.
      try { noteSignIn(clerk.user); if (ctx.me) syncPrivate(clerk.user); } catch (err) { console.warn("[MedLink]", err); }
    }

    tracker.pageView({ signed_in: signedIn, role: ctx.role || undefined });

    if (opts.staff && !ctx.role) {
      renderNotice("Admins only", [
        "This page is for MedLink staff. Your account (@" + (ctx.me ? ctx.me.username : "?") + ") doesn't have a staff role.",
        "Setting up for the first time? In Supabase > SQL Editor run the latest supabase/schema.sql, then:",
      ], el("pre", { class: "notice-code" }, [
        "insert into public.user_roles (user_id, role)\nselect id, 'super_admin' from public.profiles\nwhere username = '" + (ctx.me ? ctx.me.username : "your_username") + "';",
      ]));
      return halt();
    }

    if (opts.shell && ctx.me) renderShell(opts.page, ctx.me);
    ready();
    return ctx;
  }

  // An admin may have invited this email to a role; check once per browser session.
  async function claimInvite(userId) {
    var key = "ml_invite_checked";
    try { if (sessionStorage.getItem(key) === userId) return null; } catch (e) { /* private mode */ }
    try {
      var res = await sb().rpc("claim_role_invite");
      try { sessionStorage.setItem(key, userId); } catch (e) { /* private mode */ }
      if (res.data) { setTimeout(function () { toast("You've been made " + (ROLE_LABELS[res.data] || res.data) + " — the Admin page is in the menu.", "success"); }, 600); }
      return res.data || null;
    } catch (err) { return null; }
  }

  // Count a sign-in the first time we see a user on this browser (cleared on sign-out).
  function noteSignIn(user) {
    var key = "ml_uid", prev = null;
    try { prev = localStorage.getItem(key); } catch (e) { /* private mode */ }
    if (prev === user.id) return;
    try { localStorage.setItem(key, user.id); } catch (e) { /* private mode */ }
    track("sign_in", { method: (user.externalAccounts && user.externalAccounts[0] && user.externalAccounts[0].provider) || "email" });
  }
  // Keep the admin-only copy of the user's email current (once per browser session).
  function syncPrivate(user) {
    var email = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : "";
    var key = "ml_private_synced", mark = user.id + "|" + email;
    try { if (sessionStorage.getItem(key) === mark) return; } catch (e) { /* private mode */ }
    sb().from("user_private").upsert({ user_id: user.id, email: email.slice(0, 320), updated_at: new Date().toISOString() })
      .then(function (res) {
        if (res.error) { console.warn("[MedLink] private profile:", res.error.message); return; }
        try { sessionStorage.setItem(key, mark); } catch (e) { /* private mode */ }
      });
  }
  async function signOut(redirectTo) {
    track("sign_out");
    try { localStorage.removeItem("ml_uid"); sessionStorage.removeItem("ml_private_synced"); } catch (e) { /* private mode */ }
    await ctx.clerk.signOut({ redirectUrl: new URL(redirectTo || "index.html", location.href).href });
  }

  async function run(opts, main) {
    var c = await boot(opts);
    try {
      await main(c);
    } catch (err) {
      reportError(err);
    }
  }

  // ---------------------------------------------------------------------
  // Data access — every Supabase query lives here
  // ---------------------------------------------------------------------
  var PROFILE_COLS = "id,username,full_name,university_id,university_name,country,course_id,year,bio,interests,current_units,color,created_at";
  // "!author_id" names the foreign key: likes/saves/reports also link these tables to profiles.
  var AUTHOR = "author:profiles!author_id(id,username,full_name,university_id,university_name,country,course_id,year,color)";
  var RES_SELECT = "*," + AUTHOR + ",saved_resources(count)";
  var POST_SELECT = "*," + AUTHOR + ",post_likes(count),post_comments(count),community:communities(id,name)";
  var BUCKET = "resources";
  var MEDIA_BUCKET = "site-media";

  function sb() { return ctx.sb; }
  function myId() { return ctx.clerk && ctx.clerk.user ? ctx.clerk.user.id : null; }

  var api = {
    // ---- profiles ----
    myProfile: async function () {
      return must(await sb().from("profiles").select(PROFILE_COLS).eq("id", myId()).maybeSingle());
    },
    // Role + suspension. Tolerates a database that hasn't been upgraded yet.
    myStatus: async function () {
      var res = await Promise.all([
        sb().from("user_roles").select("role").eq("user_id", myId()).maybeSingle(),
        sb().from("user_suspensions").select("reason,created_at").eq("user_id", myId()).maybeSingle(),
      ]);
      res.forEach(function (r) { if (r.error) console.warn("[MedLink] status:", r.error.message); });
      return { role: res[0].data ? res[0].data.role : null, suspension: res[1].data || null };
    },
    rolesFor: async function (ids) {
      ids = Array.from(new Set(ids)).filter(Boolean);
      if (!ids.length) return {};
      var res = await sb().from("user_roles").select("user_id,role").in("user_id", ids);
      var map = {};
      (res.data || []).forEach(function (r) { map[r.user_id] = r.role; });
      return map;
    },
    profileByUsername: async function (username) {
      return must(await sb().from("profiles").select(PROFILE_COLS).eq("username", username).maybeSingle());
    },
    profilesByIds: async function (ids) {
      ids = Array.from(new Set(ids)).filter(Boolean);
      if (!ids.length) return [];
      return must(await sb().from("profiles").select(PROFILE_COLS).in("id", ids));
    },
    usernameTaken: async function (username) {
      var row = must(await sb().from("profiles").select("id").eq("username", username).maybeSingle());
      return !!row && row.id !== myId();
    },
    createProfile: async function (fields) {
      var row = must(await sb().from("profiles").insert(Object.assign({}, fields, { id: myId() })).select(PROFILE_COLS).single());
      track("sign_up_complete", { university: fields.university_name || fields.university_id, country: fields.country, course: fields.course_id, year: fields.year });
      return row;
    },
    updateProfile: async function (fields) {
      var row = must(await sb().from("profiles").update(fields).eq("id", myId()).select(PROFILE_COLS).single());
      ctx.me = row;
      return row;
    },
    followCounts: async function (id) {
      var res = await Promise.all([
        sb().from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", id),
        sb().from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", id),
      ]);
      res.forEach(must);
      return { followers: res[0].count || 0, following: res[1].count || 0 };
    },
    followingIds: async function () {
      var rows = must(await sb().from("follows").select("following_id").eq("follower_id", myId()));
      return new Set(rows.map(function (r) { return r.following_id; }));
    },
    setFollowing: async function (id, on) {
      if (on) must(await sb().from("follows").insert({ follower_id: myId(), following_id: id }));
      else must(await sb().from("follows").delete().eq("follower_id", myId()).eq("following_id", id));
      track(on ? "follow" : "unfollow", { user_id: id });
    },
    suggestedProfiles: async function (limit, me) {
      var rows = must(await sb().from("profiles").select(PROFILE_COLS).neq("id", myId()).order("created_at", { ascending: false }).limit(60));
      var following = await api.followingIds();
      var score = function (p) {
        return (p.university_id === me.university_id ? 2 : 0) + (p.country === me.country ? 1 : 0) + (p.course_id === me.course_id ? 1 : 0) + (p.year === me.year ? 1 : 0);
      };
      return rows.filter(function (p) { return !following.has(p.id); })
        .sort(function (a, b) { return score(b) - score(a); })
        .slice(0, limit);
    },

    // ---- resources ----
    resources: async function (o) {
      o = o || {};
      var q = sb().from("resources").select(RES_SELECT);
      if (o.unit) q = q.eq("unit", o.unit);
      if (o.units) q = q.in("unit", o.units);
      if (o.type) q = q.eq("type", o.type);
      if (o.authorId) q = q.eq("author_id", o.authorId);
      q = q.order(o.order || "created_at", { ascending: false }).limit(o.limit || 60);
      return must(await q);
    },
    resource: async function (id) {
      return must(await sb().from("resources").select(RES_SELECT).eq("id", id).maybeSingle());
    },
    uploadResource: async function (f) {
      var safeName = f.file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
      var path = myId() + "/" + crypto.randomUUID() + "-" + safeName;
      must(await sb().storage.from(BUCKET).upload(path, f.file, { contentType: f.file.type || "application/octet-stream", upsert: false }));
      var res = await sb().from("resources").insert({
        author_id: myId(), title: f.title, unit: f.unit, type: f.type, description: f.description || "",
        file_path: path, file_name: f.file.name.slice(0, 200), file_type: f.file.type || "", file_size: f.file.size,
      }).select("id").single();
      if (res.error) {
        await sb().storage.from(BUCKET).remove([path]);
        throw res.error;
      }
      track("resource_upload", { id: res.data.id, unit: f.unit, type: f.type, size: f.file.size });
      return res.data;
    },
    deleteResource: async function (r) {
      must(await sb().from("resources").delete().eq("id", r.id));
      await sb().storage.from(BUCKET).remove([r.file_path]);
      track("resource_delete", { id: r.id, title: r.title });
    },
    fileUrl: function (path, download) {
      return sb().storage.from(BUCKET).getPublicUrl(path, download ? { download: true } : undefined).data.publicUrl;
    },
    savedIds: async function () {
      var rows = must(await sb().from("saved_resources").select("resource_id").eq("user_id", myId()));
      return new Set(rows.map(function (r) { return r.resource_id; }));
    },
    setSaved: async function (resourceId, on) {
      if (on) must(await sb().from("saved_resources").insert({ user_id: myId(), resource_id: resourceId }));
      else must(await sb().from("saved_resources").delete().eq("user_id", myId()).eq("resource_id", resourceId));
      track(on ? "resource_save" : "resource_unsave", { id: resourceId });
    },
    savedResources: async function () {
      var rows = must(await sb().from("saved_resources").select("created_at,resource:resources(" + RES_SELECT + ")")
        .eq("user_id", myId()).order("created_at", { ascending: false }));
      return rows.map(function (r) { return r.resource; }).filter(Boolean);
    },
    incrementViews: async function (id) {
      await sb().rpc("increment_resource_views", { rid: id });
    },
    report: async function (resourceId, reason) {
      must(await sb().from("resource_reports").insert({ resource_id: resourceId, reporter_id: myId(), reason: reason || "" }));
      track("resource_report", { id: resourceId });
    },

    // ---- posts / likes / comments ----
    posts: async function (o) {
      o = o || {};
      var q = sb().from("posts").select(POST_SELECT);
      if (o.communityId) q = q.eq("community_id", o.communityId);
      if (o.unit) q = q.eq("unit", o.unit);
      if (o.authorId) q = q.eq("author_id", o.authorId);
      if (o.general) q = q.is("community_id", null).is("unit", null);
      return must(await q.order("created_at", { ascending: false }).limit(o.limit || 30));
    },
    createPost: async function (p) {
      var row = must(await sb().from("posts").insert({
        author_id: myId(), body: p.body, community_id: p.communityId || null, unit: p.unit || null,
      }).select(POST_SELECT).single());
      track("post_create", { community: p.communityId || "", unit: p.unit || "", length: p.body.length });
      return row;
    },
    deletePost: async function (id) {
      must(await sb().from("posts").delete().eq("id", id));
      track("post_delete", { id: id });
    },
    likedIds: async function (postIds) {
      if (!postIds.length) return new Set();
      var rows = must(await sb().from("post_likes").select("post_id").eq("user_id", myId()).in("post_id", postIds));
      return new Set(rows.map(function (r) { return r.post_id; }));
    },
    setLiked: async function (postId, on) {
      if (on) must(await sb().from("post_likes").insert({ post_id: postId, user_id: myId() }));
      else must(await sb().from("post_likes").delete().eq("post_id", postId).eq("user_id", myId()));
      track(on ? "post_like" : "post_unlike", { id: postId });
    },
    comments: async function (postId) {
      return must(await sb().from("post_comments").select("*," + AUTHOR).eq("post_id", postId).order("created_at", { ascending: true }));
    },
    addComment: async function (postId, body) {
      var row = must(await sb().from("post_comments").insert({ post_id: postId, author_id: myId(), body: body }).select("*," + AUTHOR).single());
      track("comment_create", { post_id: postId });
      return row;
    },
    deleteComment: async function (id) {
      must(await sb().from("post_comments").delete().eq("id", id));
    },

    // ---- communities ----
    communities: async function () {
      return must(await sb().from("communities").select("*,community_members(count)").order("name"));
    },
    community: async function (id) {
      return must(await sb().from("communities").select("*,community_members(count)").eq("id", id).maybeSingle());
    },
    myCommunityIds: async function (userId) {
      var rows = must(await sb().from("community_members").select("community_id").eq("user_id", userId || myId()));
      return new Set(rows.map(function (r) { return r.community_id; }));
    },
    setMember: async function (communityId, on) {
      if (on) must(await sb().from("community_members").insert({ community_id: communityId, user_id: myId() }));
      else must(await sb().from("community_members").delete().eq("community_id", communityId).eq("user_id", myId()));
      track(on ? "community_join" : "community_leave", { id: communityId });
    },
    unitStats: async function (unit) {
      var res = await Promise.all([
        sb().from("profiles").select("id", { count: "exact", head: true }).contains("current_units", [unit]),
        sb().from("posts").select("id", { count: "exact", head: true }).eq("unit", unit),
        sb().from("resources").select("id", { count: "exact", head: true }).eq("unit", unit),
      ]);
      res.forEach(must);
      return { members: res[0].count || 0, posts: res[1].count || 0, resources: res[2].count || 0 };
    },

    // ---- messages ----
    myMessages: async function () {
      // RLS only returns messages you sent or received.
      return must(await sb().from("messages").select("*").order("created_at", { ascending: false }).limit(1000));
    },
    sendMessage: async function (toId, body) {
      var row = must(await sb().from("messages").insert({ sender_id: myId(), recipient_id: toId, body: body }).select("*").single());
      track("message_send", { length: body.length });
      return row;
    },
    markRead: async function (fromId) {
      must(await sb().from("messages").update({ read_at: new Date().toISOString() })
        .eq("sender_id", fromId).eq("recipient_id", myId()).is("read_at", null));
    },
    unreadCount: async function () {
      var res = await sb().from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", myId()).is("read_at", null);
      must(res);
      return res.count || 0;
    },

    // ---- search ----
    search: async function (raw) {
      var q = String(raw || "").replace(/^@/, "").replace(/[^\p{L}\p{N}\s._-]/gu, " ").replace(/\s+/g, " ").trim();
      if (q.length < 2) return { q: q, resources: [], profiles: [], communities: [], posts: [] };
      var like = "%" + q + "%";
      track("search", { q: q.slice(0, 80) });
      var res = await Promise.all([
        sb().from("resources").select(RES_SELECT).ilike("title", like).limit(20),
        sb().from("resources").select(RES_SELECT).ilike("unit", like).limit(20),
        sb().from("profiles").select(PROFILE_COLS).ilike("username", like).limit(20),
        sb().from("profiles").select(PROFILE_COLS).ilike("full_name", like).limit(20),
        sb().from("communities").select("*,community_members(count)").ilike("name", like),
        sb().from("posts").select(POST_SELECT).ilike("body", like).order("created_at", { ascending: false }).limit(20),
      ]);
      res.forEach(must);
      var uniq = function (rows) {
        var seen = new Set();
        return rows.filter(function (r) { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      };
      return {
        q: q,
        resources: uniq(res[0].data.concat(res[1].data)),
        profiles: uniq(res[2].data.concat(res[3].data)).filter(function (p) { return p.id !== myId(); }),
        communities: res[4].data,
        posts: res[5].data,
      };
    },

    // ---- gamification ----
    medPoints: async function (id) {
      var res = await Promise.all([
        sb().from("resources").select("id", { count: "exact", head: true }).eq("author_id", id),
        sb().from("posts").select("id", { count: "exact", head: true }).eq("author_id", id),
        sb().from("post_comments").select("id", { count: "exact", head: true }).eq("author_id", id),
      ]);
      res.forEach(must);
      return (res[0].count || 0) * 20 + (res[1].count || 0) * 5 + (res[2].count || 0) * 2;
    },

    // ---- community extras ----
    communityPreview: async function (id) {
      return must(await sb().rpc("community_preview", { cid: id }));
    },
    // Latest members of every community, for the avatar stacks and "recent activity".
    communityFaces: async function (limit) {
      var rows = must(await sb().from("community_members")
        .select("community_id,joined_at,user:profiles!user_id(id,username,full_name,color,course_id,year,university_id,university_name,country)")
        .order("joined_at", { ascending: false }).limit(limit || 400));
      var map = {};
      rows.forEach(function (r) { if (r.user) (map[r.community_id] = map[r.community_id] || []).push(r.user); });
      return { byCommunity: map, recent: rows.filter(function (r) { return r.user; }) };
    },
    communityMembers: async function (id) {
      var rows = must(await sb().from("community_members").select("joined_at,user:profiles!user_id(" + PROFILE_COLS + ")")
        .eq("community_id", id).order("joined_at", { ascending: false }).limit(300));
      return rows.map(function (r) { return r.user; }).filter(Boolean);
    },
    // Most active posters over the last N days.
    topContributors: async function (days, limit) {
      var since = new Date(Date.now() - (days || 30) * 864e5).toISOString();
      var rows = must(await sb().from("posts").select("author_id," + AUTHOR).gte("created_at", since).limit(600));
      var tally = {};
      rows.forEach(function (r) {
        if (!r.author) return;
        var t = tally[r.author_id] = tally[r.author_id] || { profile: r.author, posts: 0 };
        t.posts++;
      });
      return Object.values(tally).sort(function (a, b) { return b.posts - a.posts; }).slice(0, limit || 5);
    },

    // ---- exam bank ----
    examSets: async function () {
      return must(await sb().from("exam_sets").select("*,exam_questions(count)").order("created_at", { ascending: false }).limit(300));
    },
    examSet: async function (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id || "")) return null;
      var set = must(await sb().from("exam_sets").select("*").eq("id", id).maybeSingle());
      if (!set) return null;
      set.questions = must(await sb().from("exam_questions").select("*").eq("set_id", id).order("position"));
      return set;
    },
    myAttempts: async function () {
      return must(await sb().from("exam_attempts").select("set_id,score,total,created_at").eq("user_id", myId())
        .order("created_at", { ascending: false }).limit(500));
    },
    saveAttempt: async function (setId, score, total) {
      must(await sb().from("exam_attempts").insert({ user_id: myId(), set_id: setId, score: score, total: total }));
    },
    examPapers: async function () {
      return must(await sb().from("exam_papers").select("*").order("created_at", { ascending: false }).limit(300));
    },
    examSources: async function () {
      return must(await sb().from("exam_sources").select("*").order("position"));
    },

    // ---- site images (public read) ----
    siteImages: async function () {
      return must(await sb().from("site_images").select("*").order("slot"));
    },
  };

  // ---------------------------------------------------------------------
  // Admin API — the database enforces every permission (RLS + checks
  // inside the functions); these helpers only save typing.
  // ---------------------------------------------------------------------
  api.admin = {
    stats: async function (days) {
      return must(await sb().rpc("admin_stats", { p_days: days }));
    },
    users: async function (o) {
      o = o || {};
      return must(await sb().rpc("admin_users", { p_q: o.q || "", p_filter: o.filter || "", p_limit: o.limit || 50, p_offset: o.offset || 0 }));
    },
    setRole: async function (userId, role) {
      must(await sb().rpc("set_user_role", { target: userId, new_role: role || null }));
      track("admin_set_role", { user_id: userId, role: role || "student" });
    },
    setSuspended: async function (userId, on, reason) {
      must(await sb().rpc("set_user_suspended", { target: userId, suspend: !!on, reason: reason || "" }));
      track(on ? "admin_suspend" : "admin_unsuspend", { user_id: userId });
    },
    updateProfile: async function (userId, fields) {
      return must(await sb().from("profiles").update(fields).eq("id", userId).select(PROFILE_COLS).single());
    },
    activity: async function (o) {
      o = o || {};
      var q = sb().from("activity_log").select("*");
      if (o.actorId) q = q.eq("actor_id", o.actorId);
      if (o.action) q = q.eq("action", o.action);
      if (o.entity) q = q.eq("entity", o.entity);
      if (o.before) q = q.lt("id", o.before);
      return must(await q.order("id", { ascending: false }).limit(o.limit || 50));
    },
    events: async function (o) {
      o = o || {};
      var q = sb().from("events").select("*");
      if (o.userId) q = q.eq("user_id", o.userId);
      if (o.type) q = q.eq("type", o.type);
      if (o.name) q = q.eq("name", o.name);
      if (o.sessionId) q = q.eq("session_id", o.sessionId);
      if (o.before) q = q.lt("id", o.before);
      return must(await q.order("id", { ascending: false }).limit(o.limit || 50));
    },
    reports: async function (status) {
      var q = sb().from("resource_reports")
        .select("*,resource:resources!resource_id(id,title,unit,type,file_path,author_id),reporter:profiles!reporter_id(id,username,full_name,color)");
      if (status) q = q.eq("status", status);
      return must(await q.order("created_at", { ascending: false }).limit(100));
    },
    resolveReport: async function (id, status) {
      must(await sb().from("resource_reports").update({ status: status, resolved_by: myId(), resolved_at: new Date().toISOString() }).eq("id", id));
    },
    resources: async function (o) {
      o = o || {};
      var q = sb().from("resources").select(RES_SELECT);
      if (o.q) q = q.ilike("title", "%" + o.q + "%");
      return must(await q.order("created_at", { ascending: false }).limit(o.limit || 50));
    },
    updateResource: async function (id, fields) {
      return must(await sb().from("resources").update(fields).eq("id", id).select(RES_SELECT).single());
    },
    posts: async function (o) {
      o = o || {};
      var q = sb().from("posts").select(POST_SELECT);
      if (o.q) q = q.ilike("body", "%" + o.q + "%");
      return must(await q.order("created_at", { ascending: false }).limit(o.limit || 50));
    },
    comments: async function (o) {
      o = o || {};
      var q = sb().from("post_comments").select("*," + AUTHOR);
      if (o.q) q = q.ilike("body", "%" + o.q + "%");
      return must(await q.order("created_at", { ascending: false }).limit(o.limit || 50));
    },
    saveCommunity: async function (c, isNew) {
      var fields = { name: c.name, description: c.description, image_url: c.image_url || "", kind: c.kind || "topic", course_id: c.course_id || null, country: c.country || null };
      if (isNew) return must(await sb().from("communities").insert(Object.assign({ id: c.id }, fields)).select("*").single());
      return must(await sb().from("communities").update(fields).eq("id", c.id).select("*").single());
    },
    deleteCommunity: async function (id) {
      must(await sb().from("communities").delete().eq("id", id));
    },
    setSiteImage: async function (slot, url, alt) {
      must(await sb().from("site_images").upsert({ slot: slot, url: url, alt: alt || "", updated_by: myId(), updated_at: new Date().toISOString() }));
      await refreshSiteImages();
    },
    resetSiteImage: async function (slot) {
      must(await sb().from("site_images").delete().eq("slot", slot));
      await refreshSiteImages();
    },
    media: async function () {
      var rows = must(await sb().storage.from(MEDIA_BUCKET).list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } }));
      return rows.filter(function (f) { return f.id && f.name !== ".emptyFolderPlaceholder"; }).map(function (f) {
        return { name: f.name, size: f.metadata ? f.metadata.size : 0, type: f.metadata ? f.metadata.mimetype : "",
                 created_at: f.created_at, url: api.admin.mediaUrl(f.name) };
      });
    },
    mediaUrl: function (name) {
      return sb().storage.from(MEDIA_BUCKET).getPublicUrl(name).data.publicUrl;
    },
    uploadMedia: async function (file) {
      var safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "image";
      var name = Date.now().toString(36) + "-" + safe;
      must(await sb().storage.from(MEDIA_BUCKET).upload(name, file, { contentType: file.type, upsert: false }));
      track("admin_media_upload", { name: name, size: file.size });
      return { name: name, url: api.admin.mediaUrl(name) };
    },
    deleteMedia: async function (name) {
      must(await sb().storage.from(MEDIA_BUCKET).remove([name]));
      track("admin_media_delete", { name: name });
    },

    // exam bank
    createExamSet: async function (set, questions) {
      var row = must(await sb().from("exam_sets").insert(set).select("id").single());
      for (var i = 0; i < questions.length; i += 100) {
        var chunk = questions.slice(i, i + 100).map(function (q, j) {
          return { set_id: row.id, position: i + j, question: q.question, options: q.options, correct: q.correct,
                   explanation: q.explanation || "", source_ref: q.source_ref || "" };
        });
        var res = await sb().from("exam_questions").insert(chunk);
        if (res.error) { await sb().from("exam_sets").delete().eq("id", row.id); throw res.error; }
      }
      track("admin_exam_set_create", { id: row.id, questions: questions.length, source: set.source });
      return row;
    },
    setExamPublished: async function (id, on) {
      must(await sb().from("exam_sets").update({ published: !!on }).eq("id", id));
    },
    deleteExamSet: async function (id) {
      must(await sb().from("exam_sets").delete().eq("id", id));
    },
    addPaper: async function (p) {
      return must(await sb().from("exam_papers").insert(p).select("*").single());
    },
    deletePaper: async function (id) {
      must(await sb().from("exam_papers").delete().eq("id", id));
    },
    saveSource: async function (src, isNew) {
      if (isNew) return must(await sb().from("exam_sources").insert(src).select("*").single());
      return must(await sb().from("exam_sources").update(src).eq("id", src.id).select("*").single());
    },
    deleteSource: async function (id) {
      must(await sb().from("exam_sources").delete().eq("id", id));
    },

    // role invites (claimed by the invitee's verified email on their next visit)
    invites: async function () {
      return must(await sb().from("role_invites").select("*").order("created_at", { ascending: false }));
    },
    invite: async function (email, role) {
      must(await sb().from("role_invites").insert({ email: String(email).trim().toLowerCase(), role: role }));
      track("admin_invite", { role: role });
    },
    revokeInvite: async function (email) {
      must(await sb().from("role_invites").delete().eq("email", email));
    },
  };

  // ---------------------------------------------------------------------
  // Shell: top bar, sidebar, bottom nav
  // ---------------------------------------------------------------------
  var ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>';
  var ICON_MARK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.2l1.6-4.2 2.6 8.4 2-5.2 1.4 3H21"/></svg>';
  var ICON_SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var ICON_THEME = '<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    + '<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8"/></svg>';

  function avatarNode(p, size, asLink) {
    var node = el(asLink ? "a" : "div", {
      class: "avatar" + (size ? " " + size : ""),
      style: "background:" + safeColor(p && p.color),
      href: asLink && p ? profileHref(p) : null,
      title: p ? p.full_name : null,
    }, [initials(p ? p.full_name : "?") || "?"]);
    return node;
  }

  function icon(paths, size) {
    return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
  }
  var ICONS = {
    dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    study: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    exams: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
    units: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    communities: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    discover: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    news: '<path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5M8 17h3"/>',
    messages: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    saved: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    admin: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  };
  var ROLE_LABELS = { super_admin: "Super admin", admin: "Admin", moderator: "Moderator" };

  function renderShell(active, me) {
    var isStaff = !!ctx.role;
    var menu = [
      ["dashboard", "dashboard.html", "Home"],
      ["study", "study.html", "Study library"],
      ["exams", "exams.html", "Exam bank"],
      ["communities", "communities.html", "Communities"],
      ["messages", "messages.html", "Messages"],
    ];
    var general = [
      ["units", "units.html", "My units"],
      ["discover", "discover.html", "Discover"],
      ["news", "news.html", "Medical news"],
      ["saved", "saved.html", "Saved"],
      ["settings", "settings.html", "Settings"],
    ];
    if (isStaff) general.push(["admin", "admin.html", "Admin"]);
    var bottom = [
      ["dashboard", "dashboard.html", "Home"],
      ["study", "study.html", "Study"],
      ["exams", "exams.html", "Exams"],
      ["communities", "communities.html", "Groups"],
      ["messages", "messages.html", "Messages"],
    ];

    var searchInput = el("input", { type: "text", name: "q", placeholder: "Search notes, @students, communities…", "aria-label": "Search", value: active === "search" ? (param("q") || "") : null });
    var searchForm = el("form", { class: "topbar-search", action: "search.html", method: "get", html: ICON_SEARCH }, [searchInput]);
    searchForm.addEventListener("submit", function (e) { if (!searchInput.value.trim()) e.preventDefault(); });

    var topbar = el("header", { class: "topbar" }, [
      el("div", { class: "topbar-inner" }, [
        el("a", { href: "dashboard.html", class: "brand" }, [
          el("span", { class: "brand-mark", html: ICON_MARK }), " ", el("span", { class: "brand-text" }, ["MedLink KE"]),
        ]),
        searchForm,
        isStaff ? el("a", { class: "icon-btn admin-quick", href: "admin.html", "aria-label": "Admin dashboard", title: "Admin dashboard", html: icon(ICONS.admin, 18) }) : null,
        el("button", { class: "icon-btn theme-toggle", "data-theme-toggle": true, type: "button", "aria-label": "Switch theme", html: ICON_THEME }),
        el("a", { class: "topbar-me", href: profileHref(me), "aria-label": "Your profile" }, [
          avatarNode(me, "", false),
          el("span", { class: "topbar-me-text" }, [
            el("span", { class: "topbar-me-name" }, [me.full_name]),
            el("span", { class: "topbar-me-sub" }, [ctx.role ? ROLE_LABELS[ctx.role] : "@" + me.username]),
          ]),
        ]),
      ]),
    ]);

    var badgeSlots = [];
    var navItem = function (item) {
      var a = el("a", { href: item[1], class: "nav-item" + (item[0] === active ? " active" : "") }, [
        el("span", { class: "nav-icon", html: icon(ICONS[item[0]], 19) }), el("span", {}, [item[2]]),
      ]);
      if (item[0] === "messages") badgeSlots.push(a);
      return a;
    };
    var points = el("b", {}, ["…"]);
    var sidebar = el("nav", { class: "sidebar", "aria-label": "Main" }, [el("div", { class: "nav-label" }, ["Menu"])]
      .concat(menu.map(navItem), [el("div", { class: "nav-label" }, ["General"])], general.map(navItem), [
        el("div", { class: "sidebar-foot" }, [
          el("a", { class: "mp-row", href: profileHref(me), title: "Share notes (+20), post (+5), comment (+2)" }, [el("span", {}, ["🏅 MedPoints"]), points]),
          el("button", { type: "button", class: "nav-item signout", onclick: function () { signOut(); } }, [
            el("span", { class: "nav-icon", html: icon(ICONS.logout, 19) }), el("span", {}, ["Sign out"]),
          ]),
        ]),
      ]));
    var bottomNav = el("nav", { class: "bottom-nav", "aria-label": "Main" }, bottom.map(function (item) {
      var a = el("a", { href: item[1], class: item[0] === active ? "active" : "" }, [
        el("span", { class: "bn-icon", html: icon(ICONS[item[0]], 21) }), item[2],
      ]);
      if (item[0] === "messages") badgeSlots.push(a);
      return a;
    }));

    var page = qs("#page");
    page.classList.add("main-content");
    page.hidden = false;
    if (ctx.suspension) {
      page.prepend(el("div", { class: "suspended-banner", role: "alert" }, [
        el("strong", {}, ["Your account is suspended. "]),
        "You can still read and download, but posting, uploading, commenting and messaging are turned off.",
        ctx.suspension.reason ? el("span", { class: "suspended-reason" }, [" Reason: " + ctx.suspension.reason]) : null,
      ]));
    }
    var body = el("div", { class: "shell-body" }, [sidebar]);
    page.parentNode.insertBefore(topbar, page);
    page.parentNode.insertBefore(body, page);
    body.appendChild(page);
    body.after(bottomNav);

    // Theme toggle was created after theme.js wired existing buttons.
    var tt = qs("[data-theme-toggle]", topbar);
    tt.addEventListener("click", function () { window.MedLinkTheme && window.MedLinkTheme.toggle(); });

    api.unreadCount().then(function (n) {
      if (!n) return;
      badgeSlots.forEach(function (a) { a.appendChild(el("span", { class: "nav-badge" }, [n > 99 ? "99+" : String(n)])); });
    }).catch(function (e) { console.warn(e); });
    api.medPoints(me.id).then(function (n) { points.textContent = n.toLocaleString(); })
      .catch(function () { points.textContent = "—"; });
  }

  // ---------------------------------------------------------------------
  // Shared render helpers
  // ---------------------------------------------------------------------
  function metaLine(p) {
    var abroad = p.country && ctx.me && p.country !== ctx.me.country ? countryFlag(p.country) : "";
    return [courseName(p.course_id), p.year, (uniLabel(p) + (abroad ? " " + abroad : "")).trim()].filter(Boolean).join(" · ");
  }

  function resourceCardNode(r) {
    var author = r.author;
    var ts = typeStyle(r.type);
    return el("a", { class: "card resource-card", href: "resource.html?id=" + encodeURIComponent(r.id), style: "--tc:" + ts.color + ";--tc-soft:" + ts.soft }, [
      el("div", { class: "rc-cover", "aria-hidden": "true" }, [
        el("span", { class: "rc-type" }, [r.type]),
        el("span", { class: "rc-ext" }, [fileExt(r.file_name)]),
      ]),
      el("div", { class: "title" }, [r.title]),
      el("div", { class: "meta" }, [r.unit + (author && uniLabel(author) ? " · " + uniLabel(author) : "")]),
      el("div", { class: "bottom-row" }, [
        el("span", { class: "author-link" }, author ? [author.full_name] : ["MedLink student"]),
        el("span", { class: "rc-stats" }, ["👁 " + (r.views || 0) + " · 🔖 " + count(r.saved_resources)]),
      ]),
    ]);
  }
  function fileExt(name) {
    var m = /\.([A-Za-z0-9]{1,5})$/.exec(name || "");
    return m ? m[1].toUpperCase() : "FILE";
  }

  function feedPostNode(post, opts) {
    opts = opts || {};
    var me = ctx.me;
    var author = post.author || {};
    var liked = opts.liked ? opts.liked.has(post.id) : false;
    var likes = count(post.post_likes);
    var comments = count(post.post_comments);

    var where = post.community
      ? el("a", { href: "communities.html?c=" + encodeURIComponent(post.community.id), class: "post-where" }, ["in " + post.community.name])
      : post.unit ? el("a", { href: "communities.html?unit=" + encodeURIComponent(post.unit), class: "post-where" }, ["in " + post.unit]) : null;

    var likeBtn = el("button", { type: "button", class: "post-action" + (liked ? " on" : ""), "aria-pressed": liked ? "true" : "false" });
    var paintLike = function () { likeBtn.textContent = (liked ? "❤️ " : "🤍 ") + likes; likeBtn.classList.toggle("on", liked); likeBtn.setAttribute("aria-pressed", String(liked)); };
    paintLike();
    likeBtn.addEventListener("click", async function () {
      liked = !liked; likes += liked ? 1 : -1; paintLike();
      try { await api.setLiked(post.id, liked); if (opts.liked) opts.liked[liked ? "add" : "delete"](post.id); }
      catch (err) { liked = !liked; likes += liked ? 1 : -1; paintLike(); reportError(err); }
    });

    var commentBtn = el("button", { type: "button", class: "post-action" }, ["💬 " + comments]);
    var thread = el("div", { class: "comments", hidden: true });
    var loaded = false;
    commentBtn.addEventListener("click", async function () {
      thread.hidden = !thread.hidden;
      if (thread.hidden || loaded) return;
      loaded = true;
      thread.replaceChildren(loadingState());
      try {
        var rows = await api.comments(post.id);
        thread.replaceChildren();
        var list = el("div", { class: "comment-list" }, rows.map(commentNode));
        var input = el("input", { type: "text", maxlength: "1000", placeholder: "Write a comment…", "aria-label": "Write a comment" });
        var send = el("button", { class: "btn btn-primary btn-sm", type: "submit" }, ["Reply"]);
        var form = el("form", { class: "comment-form" }, [input, send]);
        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          var body = input.value.trim();
          if (!body) return;
          send.disabled = true;
          try {
            var c = await api.addComment(post.id, body);
            list.appendChild(commentNode(c));
            input.value = "";
            comments += 1; commentBtn.textContent = "💬 " + comments;
          } catch (err) { reportError(err); }
          send.disabled = false;
        });
        thread.append(list, form);
        input.focus();
      } catch (err) { loaded = false; thread.replaceChildren(); reportError(err); }
    });
    function commentNode(c) {
      var a = c.author || {};
      var row = el("div", { class: "comment" }, [
        avatarNode(a, "sm", true),
        el("div", { class: "comment-main" }, [
          el("div", { class: "comment-head" }, [
            el("a", { href: a.username ? profileHref(a) : "#", class: "post-name" }, [a.full_name || "Unknown"]),
            el("span", { class: "post-handle" }, [" · " + timeAgo(c.created_at)]),
          ]),
          el("div", { class: "comment-body" }, [c.body]),
        ]),
      ]);
      if (me && (c.author_id === me.id || ctx.role)) {
        row.appendChild(el("button", { type: "button", class: "link-btn", "aria-label": "Delete comment", onclick: async function () {
          if (!confirm("Delete this comment?")) return;
          try { await api.deleteComment(c.id); row.remove(); comments -= 1; commentBtn.textContent = "💬 " + comments; } catch (err) { reportError(err); }
        } }, ["Delete"]));
      }
      return row;
    }

    var actions = el("div", { class: "post-actions" }, [likeBtn, commentBtn]);
    if (me && (post.author_id === me.id || ctx.role)) {
      actions.appendChild(el("button", { type: "button", class: "post-action danger", onclick: async function () {
        if (!confirm("Delete this post?")) return;
        try { await api.deletePost(post.id); card.remove(); toast("Post deleted."); } catch (err) { reportError(err); }
      } }, ["Delete"]));
    }

    var card = el("article", { class: "card post-card" }, [
      el("div", { class: "post-author-row" }, [
        avatarNode(author, "", true),
        el("div", { class: "post-name-row" }, [
          el("a", { href: author.username ? profileHref(author) : "#", class: "post-name" }, [author.full_name || "Unknown"]),
          el("span", { class: "post-handle" }, [author.username ? "@" + author.username : ""]),
        ]),
      ]),
      el("div", { class: "post-meta" }, [metaLine(author) + " · " + timeAgo(post.created_at) + " ", where]),
      el("div", { class: "post-body" }, [post.body]),
      actions,
      thread,
    ]);
    return card;
  }

  // Post list with one likes lookup for the whole batch.
  async function renderPosts(container, posts, emptyText) {
    container.replaceChildren();
    if (!posts.length) { container.appendChild(emptyState(emptyText || "No posts yet.")); return; }
    var liked = await api.likedIds(posts.map(function (p) { return p.id; }));
    posts.forEach(function (p) { container.appendChild(feedPostNode(p, { liked: liked })); });
  }

  function composerNode(opts) {
    var ta = el("textarea", { rows: "3", maxlength: "2000", placeholder: opts.placeholder || "Share something with your classmates…", "aria-label": "Write a post" });
    var counter = el("span", { class: "faint composer-count" }, ["0 / 2000"]);
    var btn = el("button", { class: "btn btn-primary btn-sm", type: "submit", disabled: true }, ["Post"]);
    var form = el("form", { class: "card composer" }, [
      el("div", { class: "composer-row" }, [avatarNode(ctx.me, "", false), ta]),
      el("div", { class: "composer-foot" }, [counter, btn]),
    ]);
    ta.addEventListener("input", function () {
      counter.textContent = ta.value.length + " / 2000";
      btn.disabled = !ta.value.trim();
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var body = ta.value.trim();
      if (!body) return;
      btn.disabled = true;
      try {
        var post = await api.createPost({ body: body, communityId: opts.communityId, unit: opts.unit });
        ta.value = ""; counter.textContent = "0 / 2000";
        opts.onPosted(post);
      } catch (err) { reportError(err); btn.disabled = false; }
    });
    return form;
  }

  function studentRowNode(p, opts) {
    opts = opts || {};
    var following = opts.following || new Set();
    var isMe = ctx.me && p.id === ctx.me.id;
    var row = el("div", { class: "card pad student-row" }, [
      el("a", { class: "row-gap student-link", href: profileHref(p) }, [
        avatarNode(p, "", false),
        el("div", { class: "student-text" }, [
          el("div", { class: "student-name" }, [p.full_name]),
          el("div", { class: "handle" }, ["@" + p.username]),
          el("div", { class: "faint student-meta" }, [metaLine(p)]),
        ]),
      ]),
    ]);
    if (!isMe) {
      var on = following.has(p.id);
      var btn = el("button", { type: "button", class: "btn btn-ghost btn-sm" }, [on ? "Following" : "Follow"]);
      btn.addEventListener("click", async function () {
        btn.disabled = true;
        try {
          on = !on;
          await api.setFollowing(p.id, on);
          following[on ? "add" : "delete"](p.id);
          btn.textContent = on ? "Following" : "Follow";
        } catch (err) { on = !on; reportError(err); }
        btn.disabled = false;
      });
      row.appendChild(btn);
    }
    return row;
  }

  var KIND_LABELS = { general: "Everyone", course: "Course", topic: "Topic", country: "Country" };
  function communityCoverNode(c, cls) {
    var img = communityImage(c);
    var cover = el("div", { class: cls || "cc-cover", style: "--cc:" + communityColor(c) });
    if (img) cover.style.backgroundImage = cssUrl(img);
    else cover.appendChild(el("span", { class: "cc-letter" }, [c.name.charAt(0)]));
    return cover;
  }
  function facesNode(people, total) {
    people = (people || []).slice(0, 4);
    var wrap = el("div", { class: "faces" }, people.map(function (p) { return avatarNode(p, "sm", false); }));
    var extra = (total || 0) - people.length;
    wrap.appendChild(el("span", { class: "more" }, [extra > 0 ? "+" + extra.toLocaleString() : plural(total || 0, "member")]));
    return wrap;
  }
  // opts: { joined, faces, onChange(joined) } — a boolean second argument still means "joined".
  function communityCardNode(c, opts) {
    if (typeof opts !== "object" || !opts) opts = { joined: !!opts };
    var joined = !!opts.joined;
    var href = "communities.html?c=" + encodeURIComponent(c.id);
    var members = count(c.community_members);
    var cover = el("a", { href: href, class: "cc-cover", style: "--cc:" + communityColor(c), "aria-label": c.name });
    var img = communityImage(c);
    if (img) cover.style.backgroundImage = cssUrl(img); else cover.appendChild(el("span", { class: "cc-letter" }, [c.name.charAt(0)]));
    cover.appendChild(el("span", { class: "cc-kind" }, [KIND_LABELS[c.kind] || "Community"]));
    cover.appendChild(el("button", { type: "button", class: "cc-share", "aria-label": "Invite people to " + c.name, title: "Invite people",
      html: icon(ICONS.share, 16), onclick: function (e) { e.preventDefault(); shareCommunity(c); } }));
    var btn = el("button", { type: "button", class: "btn btn-sm " + (joined ? "is-on" : "btn-dark") }, [joined ? "Joined ✓" : "Join"]);
    btn.addEventListener("click", async function () {
      btn.disabled = true;
      try {
        joined = !joined;
        await api.setMember(c.id, joined);
        members += joined ? 1 : -1;
        btn.className = "btn btn-sm " + (joined ? "is-on" : "btn-dark");
        btn.textContent = joined ? "Joined ✓" : "Join";
        if (joined) toast("Joined " + c.name + ".", "success");
        if (opts.onChange) opts.onChange(joined);
      } catch (err) { joined = !joined; reportError(err); }
      btn.disabled = false;
    });
    return el("div", { class: "card community-card" }, [
      cover,
      el("div", { class: "cc-body" }, [
        el("a", { href: href, class: "community-name" }, [c.name]),
        el("div", { class: "community-desc" }, [c.description]),
        el("div", { class: "cc-foot" }, [facesNode(opts.faces, members), btn]),
      ]),
    ]);
  }

  // Invite links carry the channel as utm_source so the admin Traffic tab shows which ones work.
  function inviteLink(c, channel) {
    var u = new URL("join.html", location.href);
    u.searchParams.set("c", c.id);
    if (ctx.me) u.searchParams.set("ref", ctx.me.username);
    u.searchParams.set("utm_source", channel || "invite");
    u.searchParams.set("utm_medium", "invite");
    u.searchParams.set("utm_campaign", "community-" + c.id);
    return u.href;
  }
  function shareCommunity(c) {
    var text = "Join me in the " + c.name + " community on MedLink KE — free notes, past papers and study help for medical students.";
    var link = inviteLink(c, "link");
    var input = el("input", { type: "text", readonly: true, value: link, "aria-label": "Invite link" });
    var copy = el("button", { type: "button", class: "btn btn-primary btn-sm" }, ["Copy link"]);
    copy.addEventListener("click", async function () {
      try { await navigator.clipboard.writeText(link); copy.textContent = "Copied ✓"; } catch (e) { input.select(); }
      track("invite_share", { community: c.id, channel: "copy" });
    });
    var channels = [
      ["WhatsApp", "#25D366", "💬", function () { return "https://wa.me/?text=" + encodeURIComponent(text + "\n" + inviteLink(c, "whatsapp")); }],
      ["Telegram", "#229ED9", "✈️", function () { return "https://t.me/share/url?url=" + encodeURIComponent(inviteLink(c, "telegram")) + "&text=" + encodeURIComponent(text); }],
      ["X", "#111827", "𝕏", function () { return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(inviteLink(c, "x")); }],
      ["Facebook", "#1877F2", "f", function () { return "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(inviteLink(c, "facebook")); }],
      ["Email", "#7B61FF", "✉️", function () { return "mailto:?subject=" + encodeURIComponent("Join " + c.name + " on MedLink KE") + "&body=" + encodeURIComponent(text + "\n\n" + inviteLink(c, "email")); }],
      ["SMS", "#10B39E", "📱", function () { return "sms:?&body=" + encodeURIComponent(text + " " + inviteLink(c, "sms")); }],
    ];
    var grid = el("div", { class: "share-grid" }, channels.map(function (ch) {
      return el("a", { href: ch[3](), target: "_blank", rel: "noopener", onclick: function () { track("invite_share", { community: c.id, channel: ch[0].toLowerCase() }); } }, [
        el("span", { class: "ic", style: "background:" + ch[1] }, [ch[2]]), ch[0],
      ]);
    }));
    var body = el("div", {}, [
      el("p", { class: "muted", style: "margin:0;font-size:13.5px;line-height:1.5" }, ["Anyone with this link can see " + c.name + " and join in one tap — new students are taken through sign-up first."]),
      el("div", { class: "share-link" }, [input, copy]),
      grid,
      navigator.share ? el("button", { type: "button", class: "btn btn-ghost btn-block", style: "margin-top:10px", onclick: function () {
        track("invite_share", { community: c.id, channel: "native" });
        navigator.share({ title: c.name + " on MedLink KE", text: text, url: inviteLink(c, "share") }).catch(function () {});
      } }, ["More options…"]) : null,
    ]);
    modal("Invite people to " + c.name, body);
  }

  // A community someone chose on an invite page, remembered through sign-up/onboarding.
  var PENDING_KEY = "ml_pending_join";
  var pendingJoin = {
    get: function () { try { return localStorage.getItem(PENDING_KEY); } catch (e) { return null; } },
    set: function (id) { try { localStorage.setItem(PENDING_KEY, id); } catch (e) { /* private mode */ } },
    clear: function () { try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* private mode */ } },
  };

  // ---------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------
  Object.assign(window, {
    el: el, qs: qs, qsa: qsa, escapeHtml: escapeHtml, safeColor: safeColor, param: param,
    profileHref: profileHref, timeAgo: timeAgo, formatBytes: formatBytes, count: count, plural: plural,
  });
  window.MedLink = {
    run: run,
    boot: boot,
    ctx: ctx,
    api: api,
    go: go,
    safeRedirect: safeRedirect,
    toast: toast,
    modal: modal,
    reportError: reportError,
    errorMessage: errorMessage,
    emptyState: emptyState,
    loadingState: loadingState,
    avatarNode: avatarNode,
    metaLine: metaLine,
    resourceCardNode: resourceCardNode,
    feedPostNode: feedPostNode,
    renderPosts: renderPosts,
    composerNode: composerNode,
    studentRowNode: studentRowNode,
    communityCardNode: communityCardNode,
    communityCoverNode: communityCoverNode,
    facesNode: facesNode,
    shareCommunity: shareCommunity,
    inviteLink: inviteLink,
    pendingJoin: pendingJoin,
    KIND_LABELS: KIND_LABELS,
    communityImage: communityImage,
    communityColor: communityColor,
    fileExt: fileExt,
    track: track,
    flushTracking: tracker.flushNow,
    visitorId: tracker.visitorId,
    signOut: signOut,
    icon: icon,
    ICONS: ICONS,
    ROLE_LABELS: ROLE_LABELS,
    siteImageUrl: siteImageUrl,
    siteImageDefault: siteImageDefault,
    applySiteImages: applySiteImages,
    cssUrl: cssUrl,
  };
})();

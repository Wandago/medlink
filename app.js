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
   ctx = { sb, clerk, me, api }
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
  function safeColor(c) { return /^#[0-9A-Fa-f]{6}$/.test(c || "") ? c : "#A66DF5"; }
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
    var box = el("div", { class: "modal card", role: "dialog", "aria-modal": "true", "aria-label": title });
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
  // Configuration
  // ---------------------------------------------------------------------
  function readConfig() {
    var c = window.MEDLINK_CONFIG || {};
    var clerkKey = String(c.CLERK_PUBLISHABLE_KEY || "").trim();
    var sbUrl = String(c.SUPABASE_URL || "").trim().replace(/\/+$/, "");
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
  function jwtRole(key) {
    try { return JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch (e) { return null; }
  }
  function clerkAppearance() {
    var font = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      variables: dark
        ? { colorPrimary: "#8B5CF6", colorBackground: "#1D1930", colorText: "#ECE9F5", colorTextSecondary: "#B5AECC",
            colorInputBackground: "#14111F", colorInputText: "#ECE9F5", colorNeutral: "#ECE9F5", borderRadius: "12px", fontFamily: font }
        : { colorPrimary: "#6D28D9", borderRadius: "12px", fontFamily: font },
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
  var ctx = { sb: null, clerk: null, me: null, api: null, configured: false };

  async function boot(opts) {
    opts = Object.assign({ page: null, auth: "required", profile: "required", shell: true, allowUnconfigured: false }, opts);
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

    if (opts.auth === "required" && !signedIn) {
      go("sign-in.html?redirect=" + encodeURIComponent(currentPage()));
      return halt();
    }
    if (opts.auth === "guest-only" && signedIn) {
      go(safeRedirect(param("redirect")) || "dashboard.html");
      return halt();
    }

    ctx.sb = window.supabase.createClient(cfg.sbUrl, cfg.sbKey, {
      accessToken: async function () {
        return clerk.session ? (await clerk.session.getToken()) : null;
      },
    });
    ctx.api = api;

    if (signedIn) {
      try {
        ctx.me = await api.myProfile();
      } catch (err) {
        console.error(err);
        renderNotice("Couldn't reach the database", [
          errorMessage(err),
          "If this is a fresh setup: run supabase/schema.sql in the Supabase SQL Editor, and connect Clerk under Supabase > Authentication > Third-party Auth.",
        ]);
        return halt();
      }
      if (!ctx.me && opts.profile === "required") {
        go("onboarding.html");
        return halt();
      }
    }

    if (opts.shell && ctx.me) renderShell(opts.page, ctx.me);
    ready();
    return ctx;
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
  var PROFILE_COLS = "id,username,full_name,university_id,course_id,year,bio,interests,current_units,color,created_at";
  var AUTHOR = "author:profiles(id,username,full_name,university_id,course_id,year,color)";
  var RES_SELECT = "*," + AUTHOR + ",saved_resources(count)";
  var POST_SELECT = "*," + AUTHOR + ",post_likes(count),post_comments(count),community:communities(id,name)";
  var BUCKET = "resources";

  function sb() { return ctx.sb; }
  function myId() { return ctx.clerk && ctx.clerk.user ? ctx.clerk.user.id : null; }

  var api = {
    // ---- profiles ----
    myProfile: async function () {
      return must(await sb().from("profiles").select(PROFILE_COLS).eq("id", myId()).maybeSingle());
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
      return must(await sb().from("profiles").insert(Object.assign({}, fields, { id: myId() })).select(PROFILE_COLS).single());
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
    },
    suggestedProfiles: async function (limit, me) {
      var rows = must(await sb().from("profiles").select(PROFILE_COLS).neq("id", myId()).order("created_at", { ascending: false }).limit(60));
      var following = await api.followingIds();
      var score = function (p) {
        return (p.university_id === me.university_id ? 2 : 0) + (p.course_id === me.course_id ? 1 : 0) + (p.year === me.year ? 1 : 0);
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
      return res.data;
    },
    deleteResource: async function (r) {
      must(await sb().from("resources").delete().eq("id", r.id));
      await sb().storage.from(BUCKET).remove([r.file_path]);
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
      return must(await sb().from("posts").insert({
        author_id: myId(), body: p.body, community_id: p.communityId || null, unit: p.unit || null,
      }).select(POST_SELECT).single());
    },
    deletePost: async function (id) {
      must(await sb().from("posts").delete().eq("id", id));
    },
    likedIds: async function (postIds) {
      if (!postIds.length) return new Set();
      var rows = must(await sb().from("post_likes").select("post_id").eq("user_id", myId()).in("post_id", postIds));
      return new Set(rows.map(function (r) { return r.post_id; }));
    },
    setLiked: async function (postId, on) {
      if (on) must(await sb().from("post_likes").insert({ post_id: postId, user_id: myId() }));
      else must(await sb().from("post_likes").delete().eq("post_id", postId).eq("user_id", myId()));
    },
    comments: async function (postId) {
      return must(await sb().from("post_comments").select("*," + AUTHOR).eq("post_id", postId).order("created_at", { ascending: true }));
    },
    addComment: async function (postId, body) {
      return must(await sb().from("post_comments").insert({ post_id: postId, author_id: myId(), body: body }).select("*," + AUTHOR).single());
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
      return must(await sb().from("messages").insert({ sender_id: myId(), recipient_id: toId, body: body }).select("*").single());
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

  function renderShell(active, me) {
    var nav = [
      ["dashboard", "dashboard.html", "🏠", "Home"],
      ["study", "study.html", "📚", "Study"],
      ["exams", "exams.html", "📝", "Exam Bank"],
      ["units", "units.html", "🩺", "Current Units"],
      ["communities", "communities.html", "👥", "Communities"],
      ["discover", "discover.html", "🧭", "Discover"],
      ["news", "news.html", "📰", "News"],
      ["messages", "messages.html", "💬", "Messages"],
      null,
      ["saved", "saved.html", "🔖", "Saved"],
      ["profile", profileHref(me), "👤", "Profile"],
      ["settings", "settings.html", "⚙️", "Settings"],
    ];
    var bottom = [
      ["dashboard", "dashboard.html", "🏠", "Home"],
      ["study", "study.html", "📚", "Study"],
      ["communities", "communities.html", "👥", "Groups"],
      ["messages", "messages.html", "💬", "Messages"],
      ["profile", profileHref(me), "👤", "Profile"],
    ];

    var searchInput = el("input", { type: "text", name: "q", placeholder: "Search resources, @usernames, communities…", "aria-label": "Search", value: active === "search" ? (param("q") || "") : null });
    var searchForm = el("form", { class: "topbar-search", action: "search.html", method: "get", html: ICON_SEARCH }, [searchInput]);
    searchForm.addEventListener("submit", function (e) { if (!searchInput.value.trim()) e.preventDefault(); });

    var topbar = el("header", { class: "topbar" }, [
      el("div", { class: "topbar-inner" }, [
        el("a", { href: "index.html", class: "back-btn", "aria-label": "Back to home page", html: ICON_BACK }),
        el("a", { href: "dashboard.html", class: "brand" }, [
          el("span", { class: "brand-mark", html: ICON_MARK }), " ", el("span", { class: "brand-text" }, ["MedLink KE"]),
        ]),
        searchForm,
        el("button", { class: "icon-btn theme-toggle", "data-theme-toggle": true, type: "button", "aria-label": "Switch theme", html: ICON_THEME }),
        (function () { var a = avatarNode(me, "", true); a.classList.add("avatar-link"); return a; })(),
      ]),
    ]);

    var badgeSlots = [];
    var navItem = function (item, cls) {
      var a = el("a", { href: item[1], class: cls + (item[0] === active ? " active" : "") }, cls === "nav-item"
        ? [item[2] + " " + item[3]]
        : [el("span", { class: "bn-icon" }, [item[2]]), item[3]]);
      if (item[0] === "messages") badgeSlots.push(a);
      return a;
    };
    var points = el("div", { class: "title" }, ["🏅 … MedPoints"]);
    var sidebar = el("nav", { class: "sidebar", "aria-label": "Main" },
      nav.map(function (item) { return item ? navItem(item, "nav-item") : el("div", { class: "nav-divider" }); })
        .concat([el("div", { class: "medpoints-card" }, [points, el("div", { class: "desc" }, ["Earn points by sharing notes (20), posting (5) and helping in comments (2)."])])]));
    var bottomNav = el("nav", { class: "bottom-nav", "aria-label": "Main" }, bottom.map(function (item) { return navItem(item, ""); }));

    var page = qs("#page");
    page.classList.add("main-content");
    page.hidden = false;
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
    api.medPoints(me.id).then(function (n) { points.textContent = "🏅 " + n.toLocaleString() + " MedPoints"; })
      .catch(function () { points.textContent = "🏅 MedPoints"; });
  }

  // ---------------------------------------------------------------------
  // Shared render helpers
  // ---------------------------------------------------------------------
  function metaLine(p) {
    return [courseName(p.course_id), p.year, uniAbbr(p.university_id)].filter(Boolean).join(" · ");
  }

  function resourceCardNode(r) {
    var author = r.author;
    var card = el("a", { class: "card resource-card", href: "resource.html?id=" + encodeURIComponent(r.id) }, [
      el("div", { class: "top-row" }, [el("span", { class: "chip" }, [r.type]), el("span", { class: "file-ext" }, [fileExt(r.file_name)])]),
      el("div", { class: "title" }, [r.title]),
      el("div", { class: "meta" }, [r.unit + (author ? " · " + uniAbbr(author.university_id) : "")]),
      el("div", { class: "bottom-row" }, [
        el("span", { class: "author-link" }, author ? [author.full_name + " ", el("span", { class: "handle" }, ["@" + author.username])] : ["MedLink student"]),
        el("span", {}, ["🔖 " + count(r.saved_resources)]),
      ]),
    ]);
    return card;
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
      if (me && c.author_id === me.id) {
        row.appendChild(el("button", { type: "button", class: "link-btn", "aria-label": "Delete comment", onclick: async function () {
          if (!confirm("Delete this comment?")) return;
          try { await api.deleteComment(c.id); row.remove(); comments -= 1; commentBtn.textContent = "💬 " + comments; } catch (err) { reportError(err); }
        } }, ["Delete"]));
      }
      return row;
    }

    var actions = el("div", { class: "post-actions" }, [likeBtn, commentBtn]);
    if (me && post.author_id === me.id) {
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

  function communityCardNode(c, joined) {
    return el("a", { href: "communities.html?c=" + encodeURIComponent(c.id), class: "card pad community-card" }, [
      el("div", { class: "avatar md", style: "background:var(--panel);" }, [c.name.charAt(0)]),
      el("div", { class: "community-name" }, [c.name]),
      el("div", { class: "faint community-count" }, [plural(count(c.community_members), "member") + (joined ? " · Joined" : "")]),
      el("div", { class: "muted community-desc" }, [c.description]),
      el("span", { class: "btn btn-ghost btn-block" }, [joined ? "Open community" : "View community"]),
    ]);
  }

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
    fileExt: fileExt,
  };
})();

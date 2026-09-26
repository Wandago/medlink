/* =========================================================
   MEDLINK KE — admin dashboard
   ---------------------------------------------------------
   Every permission is enforced again by the database (RLS
   and the admin_* / set_* functions in schema.sql). Hiding a
   button here is only for convenience.
========================================================= */
MedLink.run({ page: "admin", staff: true }, async ({ api, me, role }) => {
  const A = api.admin;
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuper = role === "super_admin";
  const ROLE_LABELS = MedLink.ROLE_LABELS;
  const toast = MedLink.toast, fail = MedLink.reportError;

  // ------------------------------------------------------------------
  // Formatting helpers
  // ------------------------------------------------------------------
  const fmt = n => Number(n || 0).toLocaleString();
  const fmtShort = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n));
  const fmtDur = sec => {
    sec = Math.round(Number(sec || 0));
    if (sec < 60) return sec + "s";
    return Math.floor(sec / 60) + "m " + String(sec % 60).padStart(2, "0") + "s";
  };
  const dayLabel = d => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const hourLabel = h => (h % 12 || 12) + (h < 12 ? "am" : "pm");
  const when = ts => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const pretty = s => String(s || "").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
  const pageName = p => {
    const f = String(p || "").replace(/^\//, "").replace(/\.html$/, "");
    return f === "" || f === "index" ? "Landing page" : pretty(f);
  };
  const PALETTE = ["#1A56F0", "#FF7A1A", "#FF4F9A", "#10B39E", "#7B61FF", "#F5A300", "#0EA5E9", "#8BC34A", "#E5484D", "#45516E"];
  const hashColor = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
  const SOURCE_COLORS = {
    direct: "#7B61FF", google: "#4285F4", whatsapp: "#25D366", facebook: "#1877F2", instagram: "#E1306C", x: "#111827",
    linkedin: "#0A66C2", tiktok: "#FF0050", youtube: "#FF0000", telegram: "#229ED9", chatgpt: "#10A37F", bing: "#008373",
  };
  const sourceColor = s => SOURCE_COLORS[s] || hashColor(s);
  const srcDot = s => el("span", { class: "src-dot", style: "background:" + sourceColor(s) }, [s === "direct" ? "→" : String(s).charAt(0)]);
  const delta = (cur, prev) => {
    cur = Number(cur || 0); prev = Number(prev || 0);
    if (!prev && !cur) return el("span", { class: "delta flat" }, ["—"]);
    if (!prev) return el("span", { class: "delta up" }, ["new"]);
    const pct = Math.round((cur - prev) / prev * 100);
    return el("span", { class: "delta " + (pct > 0 ? "up" : pct < 0 ? "down" : "flat") }, [(pct > 0 ? "▲ " : pct < 0 ? "▼ " : "") + Math.abs(pct) + "%"]);
  };
  const userCell = (p, sub) => el("div", { class: "a-user" }, [
    MedLink.avatarNode(p || {}, "sm", !!(p && p.username)),
    el("div", { class: "who" }, [
      el("b", {}, [p ? p.full_name : "Unknown"]),
      el("span", {}, [sub != null ? sub : p ? "@" + p.username : ""]),
    ]),
  ]);

  // ------------------------------------------------------------------
  // Tiny SVG chart kit (no library needed)
  // ------------------------------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs, kids) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    (kids || []).forEach(k => k != null && n.appendChild(typeof k === "object" ? k : document.createTextNode(String(k))));
    return n;
  };
  const niceMax = v => {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v))), x = v / p;
    return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10) * p;
  };
  let gradSeq = 0;

  function lineChart(rows, series, opts = {}) {
    const W = 640, H = opts.height || 230, L = 40, R = 12, T = 12, B = 28;
    const max = niceMax(Math.max(0, ...rows.flatMap(r => series.map(s => r[s.key] || 0))));
    const n = rows.length;
    const x = i => L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
    const y = v => T + (H - T - B) * (1 - v / max);
    const label = opts.xLabel || (r => dayLabel(r.day));
    const svg = S("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": opts.label || "Chart" });
    const defs = S("defs");
    svg.appendChild(defs);
    for (let g = 0; g <= 4; g++) {
      const v = max * g / 4;
      svg.append(S("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid-line" }),
        S("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, [fmtShort(v)]));
    }
    const step = Math.max(1, Math.ceil(n / 8));
    rows.forEach((r, i) => {
      // Skip the final label when it would collide with the previous one.
      if (i % step === 0 || (i === n - 1 && i % step >= step / 2)) svg.appendChild(S("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, [label(r, i)]));
    });
    series.forEach(sr => {
      const id = "lg" + (++gradSeq);
      defs.appendChild(S("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        S("stop", { offset: "0%", "stop-color": sr.color, "stop-opacity": .28 }),
        S("stop", { offset: "100%", "stop-color": sr.color, "stop-opacity": 0 }),
      ]));
      const pts = rows.map((r, i) => [x(i), y(r[sr.key] || 0)]);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      if (sr.fill !== false && n > 1) svg.appendChild(S("path", { d: `${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: `url(#${id})` }));
      svg.appendChild(S("path", { d, fill: "none", stroke: sr.color, "stroke-width": 2.6, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      if (n <= 31) pts.forEach(p => svg.appendChild(S("circle", { cx: p[0], cy: p[1], r: n <= 14 ? 3.5 : 2.2, fill: sr.color })));
    });
    const w = (W - L - R) / Math.max(1, n - 1);
    rows.forEach((r, i) => {
      const hit = S("rect", { x: x(i) - w / 2, y: T, width: Math.max(w, 6), height: H - T - B, class: "hit" });
      hit.appendChild(S("title", {}, [label(r, i) + " — " + series.map(sr => sr.label + ": " + fmt(r[sr.key])).join(" · ")]));
      svg.appendChild(hit);
    });
    return el("div", {}, [svg, el("div", { class: "legend" }, series.map(sr => el("span", {}, [el("i", { style: "background:" + sr.color }), sr.label])))]);
  }

  function barChart(items, opts = {}) {
    const W = 640, H = opts.height || 200, L = 34, R = 6, T = 12, B = 26;
    const top = Math.max(0, ...items.map(i => i.value));
    const max = niceMax(top);
    const n = items.length, slot = (W - L - R) / Math.max(1, n), bw = Math.min(40, slot * .62);
    const y = v => T + (H - T - B) * (1 - v / max);
    const color = opts.color || "#1A56F0";
    const svg = S("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": opts.label || "Bar chart" });
    for (let g = 0; g <= 3; g++) {
      const v = max * g / 3;
      svg.append(S("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid-line" }),
        S("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, [fmtShort(v)]));
    }
    const step = Math.max(1, Math.ceil(n / (opts.maxLabels || 12)));
    items.forEach((it, i) => {
      const bx = L + i * slot + (slot - bw) / 2;
      const h = Math.max(3, y(0) - y(it.value));
      const bar = S("rect", {
        x: bx, y: y(0) - h, width: bw, height: h, rx: Math.min(bw / 2, 9),
        fill: color, "fill-opacity": it.value === top && top > 0 ? 1 : it.value ? .38 : .15,
      });
      bar.appendChild(S("title", {}, [(it.title || it.label) + ": " + fmt(it.value)]));
      svg.appendChild(bar);
      if (i % step === 0) svg.appendChild(S("text", { x: bx + bw / 2, y: H - 8, "text-anchor": "middle" }, [it.label]));
    });
    return svg;
  }

  function donut(items, opts = {}) {
    items = items.filter(i => i.value > 0);
    const total = items.reduce((a, b) => a + b.value, 0);
    const r = 54, C = 2 * Math.PI * r;
    const svg = S("svg", { viewBox: "0 0 150 150", role: "img", "aria-label": opts.label || "Donut chart" });
    svg.appendChild(S("circle", { cx: 75, cy: 75, r, fill: "none", stroke: "var(--surface-2)", "stroke-width": 20 }));
    let off = 0;
    items.forEach(it => {
      const len = total ? it.value / total * C : 0;
      const seg = S("circle", {
        cx: 75, cy: 75, r, fill: "none", stroke: it.color, "stroke-width": 20,
        "stroke-dasharray": `${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`, "stroke-dashoffset": -off, transform: "rotate(-90 75 75)",
      });
      seg.appendChild(S("title", {}, [it.label + ": " + fmt(it.value)]));
      svg.appendChild(seg);
      off += len;
    });
    svg.append(S("text", { x: 75, y: 76, "text-anchor": "middle", class: "donut-total" }, [fmtShort(total)]),
      S("text", { x: 75, y: 94, "text-anchor": "middle", class: "donut-sub" }, [opts.unit || "total"]));
    return el("div", { class: "donut-wrap" }, [svg, el("div", { class: "donut-legend" }, items.length ? items.map(it => el("div", {}, [
      el("i", { style: "background:" + it.color }), el("span", {}, [it.label]),
      el("b", {}, [Math.round(it.value / total * 100) + "%"]),
    ])) : [el("span", { class: "faint" }, ["No data yet"])])]);
  }

  function hbars(items, opts = {}) {
    if (!items.length) return el("div", { class: "faint", style: "font-size:13px;" }, [opts.empty || "No data yet."]);
    const max = Math.max(...items.map(i => i.value), 1);
    return el("div", { class: "hbars" }, items.map((it, i) => el("div", { class: "hbar-row", title: it.title || null }, [
      el("div", { class: "hbar-label" }, [it.icon || null, el("span", {}, [it.label])]),
      el("div", { class: "hbar-val" }, [fmt(it.value) + (opts.suffix || "")]),
      el("div", { class: "hbar-track" }, [el("div", { class: "hbar-fill", style: `width:${Math.max(2, it.value / max * 100)}%;--bar:${it.color || PALETTE[i % PALETTE.length]}` })]),
    ])));
  }

  function table(cols, rows, empty) {
    if (!rows.length) return MedLink.emptyState(empty || "Nothing here yet.");
    return el("div", { class: "a-table-wrap" }, [el("table", { class: "a-table" }, [
      el("thead", {}, [el("tr", {}, cols.map(c => el("th", { class: c.cls || null }, [c.label])))]),
      el("tbody", {}, rows.map(r => el("tr", {}, cols.map(c => {
        const v = c.render(r);
        return el("td", { class: c.cls || null }, [v == null ? "" : typeof v === "object" ? v : String(v)]);
      })))),
    ])]);
  }

  const card = (title, sub, body, extra) => el("div", { class: "a-card" }, [
    el("div", { class: "a-card-head" }, [el("div", {}, [el("h3", {}, [title]), sub ? el("div", { class: "sub" }, [sub]) : null]), extra || null]),
    body,
  ]);
  const kpi = o => el(o.href ? "a" : "div", { class: "a-card kpi " + (o.cls || ""), href: o.href || null, style: o.soft ? "--k-soft:" + o.soft : null }, [
    el("div", { class: "kpi-top" }, [o.label, el("span", { class: "kpi-ic" }, [o.icon])]),
    el("div", { class: "kpi-num" }, [typeof o.value === "number" ? fmt(o.value) : String(o.value)]),
    el("div", { class: "kpi-foot" }, o.foot || []),
  ]);
  const subtabs = (options, current, onPick) => {
    const wrap = el("div", { class: "subtabs" });
    options.forEach(([key, label]) => wrap.appendChild(el("button", {
      type: "button", class: key === current ? "active" : null,
      onclick: ev => { qsa("button", wrap).forEach(b => b.classList.remove("active")); ev.currentTarget.classList.add("active"); onPick(key); },
    }, [label])));
    return wrap;
  };
  const confirmDo = async (question, fn) => { if (!confirm(question)) return false; try { await fn(); return true; } catch (e) { fail(e); return false; } };

  // ------------------------------------------------------------------
  // State, tabs and range
  // ------------------------------------------------------------------
  let days = 30;
  try { days = Number(localStorage.getItem("ml_admin_days")) || 30; } catch (e) { /* private mode */ }
  let stats = null;
  const loaded = {};
  const TABS = [
    ["overview", "📊 Overview"], ["traffic", "🚦 Traffic"], ["activity", "⚡ Activity"], ["users", "👥 Users & roles"],
    ["content", "📚 Content"], ["reports", "🚩 Reports"], ["communities", "🏘️ Communities"],
  ].concat(isAdmin ? [["images", "🖼️ Site images"]] : []);
  const RENDER = {
    overview: renderOverview, traffic: renderTraffic, activity: renderActivity, users: renderUsers,
    content: renderContent, reports: renderReports, communities: renderCommunities, images: renderImages,
  };

  qs("#adminWho").textContent = `Signed in as @${me.username} · ${ROLE_LABELS[role]}`;
  const tabsNav = qs("#adminTabs");
  TABS.forEach(([key, label]) => tabsNav.appendChild(el("button", { type: "button", class: "admin-tab", "data-tab": key, onclick: () => show(key) }, [label])));

  const seg = qs("#rangeSeg");
  const paintRange = () => qsa("button", seg).forEach(b => b.classList.toggle("active", Number(b.dataset.days) === days));
  qsa("button", seg).forEach(b => b.addEventListener("click", async () => {
    days = Number(b.dataset.days);
    try { localStorage.setItem("ml_admin_days", String(days)); } catch (e) { /* private mode */ }
    paintRange();
    await loadStats();
  }));
  paintRange();
  qs("#refreshBtn").addEventListener("click", async () => {
    Object.keys(loaded).forEach(k => delete loaded[k]);
    await loadStats();
  });

  function current() {
    const h = location.hash.replace("#", "");
    return TABS.some(t => t[0] === h) ? h : "overview";
  }
  async function show(tab, force) {
    if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
    qsa(".admin-tab", tabsNav).forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    qsa(".admin-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + tab));
    if (loaded[tab] && !force) return;
    loaded[tab] = true;
    const panel = qs("#tab-" + tab);
    panel.replaceChildren(MedLink.loadingState());
    try { await RENDER[tab](panel); } catch (e) { loaded[tab] = false; panel.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
  }
  window.addEventListener("hashchange", () => show(current()));

  async function loadStats() {
    try {
      stats = await A.stats(days);
    } catch (e) {
      const msg = MedLink.errorMessage(e);
      qs("#tab-overview").replaceChildren(el("div", { class: "a-card" }, [
        el("h3", {}, ["Couldn't load analytics"]),
        el("p", { class: "a-note" }, [msg]),
        el("p", { class: "a-note" }, ["If you just upgraded, run the latest supabase/schema.sql in the Supabase SQL Editor."]),
      ]));
      throw e;
    }
    const reportsTab = qs('[data-tab="reports"]', tabsNav);
    qs(".count", reportsTab)?.remove();
    if (stats.totals.open_reports) reportsTab.appendChild(el("span", { class: "count" }, [String(stats.totals.open_reports)]));
    delete loaded.overview; delete loaded.traffic; delete loaded.activity;
    await show(current(), true);
  }

  const periodLabel = () => days === 1 ? "today" : `last ${days} days`;
  const prevLabel = () => days === 1 ? "vs yesterday" : `vs previous ${days} days`;

  // ------------------------------------------------------------------
  // OVERVIEW
  // ------------------------------------------------------------------
  async function renderOverview(p) {
    const t = stats.totals;
    const trafficRows = days === 1 ? stats.hours : stats.daily;
    const trafficOpts = days === 1 ? { xLabel: r => hourLabel(r.hour) } : {};
    const trafficSeries = days === 1
      ? [{ key: "views", label: "Page views", color: "#1A56F0" }]
      : [{ key: "views", label: "Page views", color: "#1A56F0" }, { key: "visitors", label: "Visitors", color: "#FF7A1A" }];
    const sources = stats.sources.slice(0, 6).map(s => ({ label: s.source, value: s.sessions, color: sourceColor(s.source) }));

    const feedBox = el("div", { class: "feed" }, [MedLink.loadingState()]);
    const totalsGrid = el("div", { class: "a-grid k4", style: "margin:0;" }, [
      ["Students", t.users, "var(--accent-soft)", "🎓"], ["Posts", t.posts, "var(--purple-soft)", "💬"],
      ["Comments", t.comments, "var(--sky-soft)", "💭"], ["Resources", t.resources, "var(--orange-soft)", "📘"],
      ["Messages", t.messages, "var(--yellow-soft)", "✉️"], ["Communities", t.communities, "var(--teal-soft)", "🏘️"],
      ["Staff", t.staff, "var(--lime-soft)", "🛡️"], ["Suspended", t.suspended, "var(--error-bg)", "⛔"],
    ].map(([label, v, soft, icon]) => kpi({ label, value: v, icon, soft })));

    p.replaceChildren(
      el("div", { class: "a-grid k4" }, [
        kpi({ label: "Page views", icon: "👀", value: t.page_views, cls: "solid", foot: [delta(t.page_views, t.prev_page_views), prevLabel()] }),
        kpi({ label: "Unique visitors", icon: "🧑‍🎓", value: t.visitors, soft: "var(--orange-soft)", foot: [delta(t.visitors, t.prev_visitors), prevLabel()] }),
        kpi({ label: "New sign-ups", icon: "✨", value: t.new_users, soft: "var(--pink-soft)", foot: [delta(t.new_users, t.prev_new_users), fmt(t.users) + " students in total"] }),
        kpi({ label: "Active members", icon: "🔥", value: t.active_users, cls: "lime", foot: [delta(t.active_users, t.prev_active_users), "signed-in & active"] }),
        kpi({ label: "Sessions", icon: "🧭", value: t.sessions, soft: "var(--purple-soft)", foot: [(t.pages_per_session || 0) + " pages per session"] }),
        kpi({ label: "Bounce rate", icon: "↩️", value: (t.bounce_rate == null ? 0 : t.bounce_rate) + "%", soft: "var(--sky-soft)", foot: ["left after one page"] }),
        kpi({ label: "Avg. time on page", icon: "⏱️", value: fmtDur(t.avg_engaged_seconds), soft: "var(--teal-soft)", foot: ["actively viewing"] }),
        kpi({ label: "Open reports", icon: "🚩", value: t.open_reports, soft: "var(--error-bg)", href: "#reports", foot: [t.open_reports ? "Needs review →" : "All clear 🎉"] }),
      ]),
      el("div", { class: "a-grid c21" }, [
        card("Traffic", days === 1 ? "Page views by hour today (EAT)" : "Page views and unique visitors per day, " + periodLabel(), lineChart(trafficRows, trafficSeries, trafficOpts)),
        card("Where visitors come from", "Sessions by source", donut(sources, { unit: "sessions" }), el("a", { class: "a-btn", href: "#traffic" }, ["Details"])),
      ]),
      el("div", { class: "a-grid c11" }, [
        card("New sign-ups", "Profiles created per day", barChart(stats.daily.map(d => ({ label: dayLabel(d.day), value: d.signups })), { color: "#FF4F9A", maxLabels: 8 })),
        card("Content created", "Posts and uploaded resources per day", lineChart(stats.daily, [
          { key: "posts", label: "Posts", color: "#7B61FF", fill: false }, { key: "uploads", label: "Uploads", color: "#10B39E", fill: false },
        ], { height: 200 })),
      ]),
      el("div", { class: "a-grid c111" }, [
        card("Top pages", periodLabel(), hbars(stats.top_pages.slice(0, 7).map(r => ({ label: pageName(r.path), value: r.views, title: r.path })))),
        card("Devices", "Sessions by device type", donut(stats.devices.map(d => ({
          label: d.label, value: d.sessions, color: { mobile: "#1A56F0", desktop: "#FF7A1A", tablet: "#10B39E" }[d.label] || "#7B61FF",
        })), { unit: "sessions" })),
        card("Latest activity", "Live from the database", feedBox, el("a", { class: "a-btn", href: "#activity" }, ["All"])),
      ]),
      card("MedLink at a glance", "All-time totals", totalsGrid),
    );
    const rows = await A.activity({ limit: 7 });
    await fillActivity(feedBox, rows);
  }

  // ------------------------------------------------------------------
  // TRAFFIC
  // ------------------------------------------------------------------
  async function renderTraffic(p) {
    const convRate = (s, sessions) => sessions ? Math.round(s / sessions * 1000) / 10 + "%" : "—";
    const hours = stats.hours.map(h => ({ label: h.hour % 3 === 0 ? hourLabel(h.hour) : "", title: hourLabel(h.hour), value: h.views }));
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdays = stats.weekdays.map(d => ({ label: dows[d.dow], value: d.views }));

    p.replaceChildren(
      el("div", { class: "a-grid c21" }, [
        card("Traffic sources", "UTM source if the link was tagged, otherwise the referring site", table([
          { label: "Source", render: r => el("div", { class: "hbar-label" }, [srcDot(r.source), el("span", { style: "text-transform:capitalize" }, [r.source])]) },
          { label: "Sessions", cls: "num", render: r => fmt(r.sessions) },
          { label: "Visitors", cls: "num", render: r => fmt(r.visitors) },
          { label: "Page views", cls: "num", render: r => fmt(r.views) },
          { label: "Sign-ups", cls: "num", render: r => fmt(r.signups) },
          { label: "Conversion", cls: "num", render: r => convRate(r.signups, r.sessions) },
          { label: "Bounce", cls: "num", render: r => (r.bounce_rate == null ? 0 : r.bounce_rate) + "%" },
        ], stats.sources, "No visits recorded yet.")),
        card("Share of sessions", periodLabel(), donut(stats.sources.slice(0, 8).map(s => ({ label: s.source, value: s.sessions, color: sourceColor(s.source) })), { unit: "sessions" })),
      ]),
      el("div", { class: "a-grid c11" }, [
        card("Referring sites", "Websites and apps that linked to MedLink", table([
          { label: "Site", render: r => r.referrer_host },
          { label: "Sessions", cls: "num", render: r => fmt(r.sessions) },
          { label: "Sign-ups", cls: "num", render: r => fmt(r.signups) },
        ], stats.referrers, "No referring sites yet — most visits are direct or from untagged WhatsApp links.")),
        card("Campaigns", "Visits from tagged links (utm_…)", table([
          { label: "Campaign", render: r => r.utm_campaign || "(none)" },
          { label: "Source / medium", render: r => [r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || "—" },
          { label: "Sessions", cls: "num", render: r => fmt(r.sessions) },
          { label: "Sign-ups", cls: "num", render: r => fmt(r.signups) },
        ], stats.campaigns, "No tagged links used yet — create one with the link builder below.")),
      ]),
      el("div", { class: "a-grid c11" }, [
        card("Landing pages", "The first page of each visit", table([
          { label: "Page", render: r => pageName(r.landing_path) },
          { label: "Sessions", cls: "num", render: r => fmt(r.sessions) },
          { label: "Sign-ups", cls: "num", render: r => fmt(r.signups) },
          { label: "Bounce", cls: "num", render: r => (r.bounce_rate == null ? 0 : r.bounce_rate) + "%" },
        ], stats.landing_pages)),
        card("All pages", "Views and average engaged time", table([
          { label: "Page", render: r => pageName(r.path) },
          { label: "Views", cls: "num", render: r => fmt(r.views) },
          { label: "Visitors", cls: "num", render: r => fmt(r.visitors) },
          { label: "Avg. time", cls: "num", render: r => fmtDur(r.avg_seconds) },
        ], stats.top_pages)),
      ]),
      el("div", { class: "a-grid c11" }, [
        card("When students visit", "Page views by hour of day (East Africa Time)", barChart(hours, { color: "#1A56F0", maxLabels: 24 })),
        card("Busiest days", "Page views by day of the week", barChart(weekdays, { color: "#FF7A1A" })),
      ]),
      el("div", { class: "a-grid c111" }, [
        card("Devices", "", donut(stats.devices.map(d => ({ label: d.label, value: d.sessions, color: { mobile: "#1A56F0", desktop: "#FF7A1A", tablet: "#10B39E" }[d.label] || "#7B61FF" })), { unit: "sessions" })),
        card("Browsers", "", hbars(stats.browsers.map(b => ({ label: b.label, value: b.sessions })))),
        card("Operating systems", "", hbars(stats.os.map(b => ({ label: b.label, value: b.sessions })))),
      ]),
      el("div", { class: "a-grid c111" }, [
        card("Time zones", "A rough guide to where visitors are", hbars(stats.timezones.map(b => ({ label: b.label.replace(/_/g, " "), value: b.sessions })))),
        card("Students by university", "All-time", hbars(stats.universities.slice(0, 8).map(u => ({ label: uniAbbr(u.label) || u.label, title: uniName(u.label), value: u.users })))),
        card("Students by programme & year", "All-time", el("div", {}, [
          hbars(stats.courses.slice(0, 5).map(c => ({ label: courseName(c.label) || c.label, value: c.users }))),
          el("div", { style: "height:14px" }),
          barChart(stats.years.map(y => ({ label: y.label.replace("Year ", "Y"), title: y.label, value: y.users })), { color: "#7B61FF", height: 150 }),
        ])),
      ]),
      utmBuilder(),
    );
  }

  function utmBuilder() {
    const base = new URL(".", location.href).href;
    const page = el("select", {}, [["", "Landing page"], ["sign-up.html", "Sign-up page"], ["study.html", "Study library"], ["exams.html", "Exam bank"]].map(([v, l]) => el("option", { value: v }, [l])));
    const source = el("input", { type: "text", value: "whatsapp", list: "utmSources", placeholder: "whatsapp" });
    const medium = el("input", { type: "text", value: "social", placeholder: "social" });
    const campaign = el("input", { type: "text", value: "", placeholder: "e.g. uon-year1-launch" });
    const out = el("input", { type: "text", readonly: true, "aria-label": "Tagged link" });
    const clean = v => v.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    const update = () => {
      const u = new URL(page.value || "", base);
      [["utm_source", source.value], ["utm_medium", medium.value], ["utm_campaign", campaign.value]].forEach(([k, v]) => { v = clean(v); if (v) u.searchParams.set(k, v); });
      out.value = u.href;
    };
    [page, source, medium, campaign].forEach(n => n.addEventListener("input", update));
    update();
    return card("Campaign link builder", "WhatsApp and most apps hide where a click came from — share tagged links so every visit is counted under the right source.", el("div", {}, [
      el("datalist", { id: "utmSources" }, ["whatsapp", "instagram", "tiktok", "facebook", "x", "telegram", "email", "poster", "class-rep"].map(v => el("option", { value: v }))),
      el("div", { class: "utm-grid" }, [
        el("label", {}, ["Page", page]), el("label", {}, ["Source", source]), el("label", {}, ["Medium", medium]), el("label", {}, ["Campaign", campaign]),
      ]),
      el("div", { class: "utm-out" }, [out, el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: async () => {
        try { await navigator.clipboard.writeText(out.value); toast("Link copied.", "success"); } catch (e) { out.select(); }
      } }, ["Copy link"])]),
    ]));
  }

  // ------------------------------------------------------------------
  // ACTIVITY
  // ------------------------------------------------------------------
  const ACT = {
    user_joined: ["🎉", "joined MedLink", "var(--accent-soft)"],
    profile_updated: ["✏️", "updated a profile", "var(--surface-2)"],
    post_created: ["💬", "posted", "var(--purple-soft)"],
    post_deleted: ["🗑️", "deleted a post", "var(--error-bg)"],
    comment_created: ["💭", "commented", "var(--sky-soft)"],
    comment_deleted: ["🗑️", "deleted a comment", "var(--error-bg)"],
    post_liked: ["❤️", "liked a post", "var(--pink-soft)"],
    resource_uploaded: ["📘", "uploaded", "var(--orange-soft)"],
    resource_updated: ["📝", "edited", "var(--orange-soft)"],
    resource_deleted: ["🗑️", "deleted", "var(--error-bg)"],
    resource_saved: ["🔖", "saved a resource", "var(--pink-soft)"],
    resource_reported: ["🚩", "reported a resource", "var(--error-bg)"],
    report_resolved: ["✅", "resolved a report", "var(--success-bg)"],
    report_dismissed: ["👌", "dismissed a report", "var(--surface-2)"],
    report_open: ["🚩", "reopened a report", "var(--error-bg)"],
    user_followed: ["➕", "followed", "var(--teal-soft)"],
    community_joined: ["👥", "joined", "var(--purple-soft)"],
    community_left: ["👋", "left", "var(--surface-2)"],
    community_created: ["🏘️", "created the community", "var(--teal-soft)"],
    community_updated: ["🏘️", "edited the community", "var(--teal-soft)"],
    community_deleted: ["🗑️", "deleted the community", "var(--error-bg)"],
    message_sent: ["✉️", "sent a message to", "var(--yellow-soft)"],
    role_granted: ["🛡️", "changed the role of", "var(--orange-soft)"],
    role_revoked: ["🛡️", "removed the staff role of", "var(--orange-soft)"],
    user_suspended: ["⛔", "suspended", "var(--error-bg)"],
    user_unsuspended: ["✅", "lifted the suspension of", "var(--success-bg)"],
    image_changed: ["🖼️", "changed the site image", "var(--lime-soft)"],
    image_reset: ["🖼️", "reset the site image", "var(--lime-soft)"],
  };
  const slotLabel = slot => (SITE_IMAGES.find(s => s.slot === slot) || {}).label || slot;

  async function fillActivity(box, rows) {
    const ids = [];
    rows.forEach(r => {
      ids.push(r.actor_id);
      if (r.entity === "user") ids.push(r.entity_id);
      if (r.details && r.details.recipient_id) ids.push(r.details.recipient_id);
    });
    const people = {};
    (await api.profilesByIds(ids)).forEach(p => { people[p.id] = p; });
    const name = id => people[id] ? people[id].full_name : id ? "someone" : "System";
    box.replaceChildren(...(rows.length ? rows.map(r => {
      const [ic, verb, soft] = ACT[r.action] || ["•", pretty(r.action), "var(--surface-2)"];
      const d = r.details || {};
      let target = null, detail = "";
      if (r.entity === "user" && r.action !== "user_joined" && r.action !== "profile_updated") target = name(r.entity_id);
      if (r.action === "profile_updated") detail = "@" + (d.username || "");
      if (r.action === "user_joined") detail = [uniAbbr(d.university_id), courseName(d.course_id), d.year].filter(Boolean).join(" · ");
      if (r.action === "role_granted") detail = "→ " + (ROLE_LABELS[d.role] || d.role) + (d.previous ? " (was " + (ROLE_LABELS[d.previous] || d.previous) + ")" : "");
      if (r.action === "role_revoked") detail = "was " + (ROLE_LABELS[d.role] || d.role);
      if (r.action === "user_suspended") detail = d.reason ? "Reason: " + d.reason : "";
      if (r.entity === "resource" && d.title) target = "“" + d.title + "”";
      if (r.entity === "resource" && d.unit) detail = [d.type, d.unit].filter(Boolean).join(" · ");
      if (r.entity === "post" || r.entity === "comment") detail = d.preview || "";
      if (r.entity === "community") target = d.name || r.entity_id;
      if (r.entity === "report") detail = d.reason ? "“" + d.reason + "”" : "";
      if (r.entity === "message") target = name(d.recipient_id);
      if (r.entity === "image") target = slotLabel(r.entity_id);
      return el("div", { class: "feed-row" }, [
        el("div", { class: "feed-ic", style: "--f-soft:" + soft }, [ic]),
        el("div", { class: "feed-text" }, [
          el("b", {}, [name(r.actor_id)]), " " + verb + " ", target ? el("b", {}, [target]) : null,
          detail ? el("span", { class: "detail" }, [detail]) : null,
        ]),
        el("div", { class: "feed-time", title: when(r.created_at) }, [timeAgo(r.created_at)]),
      ]);
    }) : [MedLink.emptyState("No activity yet.")]));
  }

  async function fillEvents(box, rows) {
    const people = {};
    (await api.profilesByIds(rows.map(r => r.user_id))).forEach(p => { people[p.id] = p; });
    const ICON = { page_view: ["👀", "var(--accent-soft)"], action: ["⚡", "var(--orange-soft)"], page_leave: ["⏱️", "var(--teal-soft)"], error: ["⚠️", "var(--error-bg)"] };
    box.replaceChildren(...(rows.length ? rows.map(r => {
      const who = people[r.user_id] ? people[r.user_id].full_name : "Visitor " + r.visitor_id.slice(0, 5);
      const [ic, soft] = ICON[r.type] || ["•", "var(--surface-2)"];
      const props = Object.entries(r.props || {}).filter(([k]) => !["signed_in"].includes(k)).map(([k, v]) => k + ": " + v).join(" · ");
      const text = r.type === "page_view" ? ["viewed ", el("b", {}, [pageName(r.path)])]
        : r.type === "page_leave" ? ["spent ", el("b", {}, [fmtDur((r.duration_ms || 0) / 1000)]), " on " + pageName(r.path)]
        : r.type === "error" ? ["hit an error on " + pageName(r.path)]
        : [el("b", {}, [pretty(r.name)]), " on " + pageName(r.path)];
      const src = [r.utm_source || r.referrer_host || "direct", r.device, r.browser, r.os].filter(Boolean).join(" · ");
      return el("div", { class: "feed-row" }, [
        el("div", { class: "feed-ic", style: "--f-soft:" + soft }, [ic]),
        el("div", { class: "feed-text" }, [el("b", {}, [who]), " ", ...text, el("span", { class: "detail" }, [[props, src].filter(Boolean).join("  —  ")])]),
        el("div", { class: "feed-time", title: when(r.created_at) }, [timeAgo(r.created_at)]),
      ]);
    }) : [MedLink.emptyState("No events recorded yet.")]));
  }

  async function renderActivity(p) {
    let mode = "db", filter = "", timer = null, oldest = null;
    const list = el("div", { class: "feed" });
    const more = el("button", { type: "button", class: "a-btn" }, ["Load more"]);
    const filterSel = el("select", { "aria-label": "Filter" });
    const live = el("label", { class: "row-gap", style: "font-size:13px;font-weight:600;" }, [
      el("input", { type: "checkbox" }), el("span", {}, [el("span", { class: "live-dot" }), "Auto-refresh"]),
    ]);
    const fillFilter = () => {
      const opts = mode === "db"
        ? [["", "All activity"]].concat(Object.keys(ACT).map(k => [k, pretty(k)]))
        : [["", "All events"], ["type:page_view", "Page views"], ["type:action", "Actions & clicks"], ["type:page_leave", "Time on page"], ["type:error", "Errors"]]
          .concat(stats.actions.map(a => ["name:" + a.name, pretty(a.name)]));
      filterSel.replaceChildren(...opts.map(([v, l]) => el("option", { value: v }, [l])));
      filter = "";
    };
    const query = async (before) => {
      if (mode === "db") return A.activity({ limit: 40, action: filter || null, before });
      const [k, v] = filter.split(":");
      return A.events({ limit: 40, before, type: k === "type" ? v : null, name: k === "name" ? v : null });
    };
    const load = async (append) => {
      try {
        const rows = await query(append ? oldest : null);
        oldest = rows.length ? rows[rows.length - 1].id : oldest;
        const box = el("div");
        await (mode === "db" ? fillActivity(box, rows) : fillEvents(box, rows));
        if (append) list.append(...box.childNodes); else list.replaceChildren(...box.childNodes);
        more.hidden = rows.length < 40;
      } catch (e) { fail(e); }
    };
    filterSel.addEventListener("change", () => { filter = filterSel.value; load(false); });
    more.addEventListener("click", () => load(true));
    qs("input", live).addEventListener("change", e => {
      clearInterval(timer);
      if (e.target.checked) timer = setInterval(() => { if (qs("#tab-activity").classList.contains("active") && !document.hidden) load(false); }, 10000);
    });
    fillFilter();

    p.replaceChildren(
      el("div", { class: "a-grid c11" }, [
        card("Top actions", "What people do most, " + periodLabel(), hbars(stats.actions.slice(0, 10).map(a => ({ label: pretty(a.name), value: a.count, title: fmt(a.people) + " people" })))),
        card("Errors seen by users", "Latest JavaScript errors (helps catch bugs)", stats.errors.length ? el("div", { class: "feed" }, stats.errors.map(e => el("div", { class: "feed-row" }, [
          el("div", { class: "feed-ic", style: "--f-soft:var(--error-bg)" }, ["⚠️"]),
          el("div", { class: "feed-text" }, [el("b", {}, [(e.props && e.props.message) || e.name]), el("span", { class: "detail" }, [pageName(e.path) + (e.props && e.props.source ? " · " + e.props.source : "")])]),
          el("div", { class: "feed-time" }, [timeAgo(e.created_at)]),
        ]))) : el("div", { class: "faint", style: "font-size:13px;" }, ["No errors recorded 🎉"])),
      ]),
      card("Activity log", "Database activity is recorded by the server itself; events come from browsers (page views, clicks, time on page).", el("div", {}, [
        el("div", { class: "a-toolbar" }, [
          subtabs([["db", "Database activity"], ["events", "Page views & clicks"]], mode, m => { mode = m; oldest = null; fillFilter(); load(false); }),
          filterSel, live,
        ]),
        list,
        el("div", { class: "a-pager" }, [el("span", {}, ["Newest first"]), more]),
      ])),
    );
    await load(false);
  }

  // ------------------------------------------------------------------
  // USERS & ROLES
  // ------------------------------------------------------------------
  async function renderUsers(p) {
    const PAGE = 50;
    let q = "", filter = "", offset = 0;
    const search = el("input", { type: "search", placeholder: "Search name, @username" + (isAdmin ? " or email" : "") + "…", "aria-label": "Search users" });
    const filterSel = el("select", { "aria-label": "Filter users" }, [
      ["", "Everyone"], ["staff", "All staff"], ["super_admin", "Super admins"], ["admin", "Admins"], ["moderator", "Moderators"], ["suspended", "Suspended"],
    ].map(([v, l]) => el("option", { value: v }, [l])));
    const body = el("div", {}, [MedLink.loadingState()]);
    const pager = el("div", { class: "a-pager" });

    const roleOptions = isSuper ? ["", "moderator", "admin", "super_admin"] : ["", "moderator"];
    const canChangeRole = u => isAdmin && u.id !== me.id && (isSuper || !["admin", "super_admin"].includes(u.role));
    const canSuspend = u => isAdmin && u.id !== me.id && (isSuper || !u.role);

    const roleCell = u => {
      if (!canChangeRole(u)) return el("span", { class: "badge " + (u.role || "student") }, [u.role ? ROLE_LABELS[u.role] : "Student"]);
      const sel = el("select", { class: "role-select", "aria-label": "Role for @" + u.username },
        roleOptions.map(r => el("option", { value: r, selected: (u.role || "") === r }, [r ? ROLE_LABELS[r] : "Student"])));
      sel.addEventListener("change", async () => {
        const next = sel.value || null;
        const label = next ? ROLE_LABELS[next] : "Student";
        if (!confirm(`Make @${u.username} ${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}?`)) { sel.value = u.role || ""; return; }
        try { await A.setRole(u.id, next); u.role = next; toast(`@${u.username} is now ${label}.`, "success"); }
        catch (e) { sel.value = u.role || ""; fail(e); }
      });
      return sel;
    };

    const load = async () => {
      body.replaceChildren(MedLink.loadingState());
      try {
        const rows = await A.users({ q, filter, limit: PAGE, offset });
        const total = rows.length ? Number(rows[0].total) : 0;
        body.replaceChildren(table([
          { label: "Student", render: u => userCell(u, "@" + u.username + (u.email ? " · " + u.email : "")) },
          { label: "Studying", render: u => el("div", { class: "muted-cell" }, [[uniAbbr(u.university_id), courseName(u.course_id), u.year].filter(Boolean).join(" · ")]) },
          { label: "Joined", cls: "nowrap", render: u => el("span", { title: when(u.created_at) }, [timeAgo(u.created_at)]) },
          { label: "Last seen", cls: "nowrap", render: u => u.last_seen ? el("span", { title: when(u.last_seen) }, [timeAgo(u.last_seen)]) : "—" },
          { label: "Activity", cls: "nowrap", render: u => el("span", { class: "muted-cell" }, [`${fmt(u.events)} events · ${fmt(u.posts)} posts · ${fmt(u.resources)} uploads`]) },
          { label: "Role", render: roleCell },
          { label: "Status", render: u => u.suspended ? el("span", { class: "badge bad", title: u.suspension_reason || "" }, ["Suspended"]) : el("span", { class: "badge ok" }, ["Active"]) },
          { label: "", render: u => el("div", { class: "a-actions" }, [
            el("button", { type: "button", class: "a-btn", onclick: () => openUser(u) }, ["View"]),
            isAdmin ? el("button", { type: "button", class: "a-btn", onclick: () => editUser(u, load) }, ["Edit"]) : null,
            canSuspend(u) ? el("button", { type: "button", class: "a-btn danger", onclick: () => toggleSuspend(u, load) }, [u.suspended ? "Unsuspend" : "Suspend"]) : null,
          ]) },
        ], rows, "No students match."));
        pager.replaceChildren(
          el("span", {}, [total ? `${offset + 1}–${offset + rows.length} of ${fmt(total)}` : "0 students"]),
          el("div", { class: "a-actions" }, [
            el("button", { type: "button", class: "a-btn", disabled: offset === 0, onclick: () => { offset = Math.max(0, offset - PAGE); load(); } }, ["‹ Prev"]),
            el("button", { type: "button", class: "a-btn", disabled: offset + rows.length >= total, onclick: () => { offset += PAGE; load(); } }, ["Next ›"]),
          ]),
        );
      } catch (e) { body.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
    };
    let t = null;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { q = search.value.trim(); offset = 0; load(); }, 300); });
    filterSel.addEventListener("change", () => { filter = filterSel.value; offset = 0; load(); });

    p.replaceChildren(
      card("Users & roles", isAdmin ? "Assign roles, edit profiles and suspend accounts." : "Moderators can view users; admins manage roles.", el("div", {}, [
        el("div", { class: "a-toolbar" }, [search, filterSel]),
        body, pager,
      ])),
      card("What each role can do", "", el("div", { class: "a-grid c111", style: "margin:0" }, [
        ["super_admin", "Everything — including making other admins and super admins, and suspending staff."],
        ["admin", "Everything except managing admins: site images, communities, users, moderator roles, suspensions."],
        ["moderator", "Analytics, activity, reports and removing or editing posts, comments and resources."],
      ].map(([r, text]) => el("div", {}, [el("span", { class: "badge " + r }, [ROLE_LABELS[r]]), el("p", { class: "a-note" }, [text])])))),
    );
    await load();
  }

  async function toggleSuspend(u, reload) {
    if (u.suspended) {
      await confirmDo(`Lift the suspension on @${u.username}?`, async () => { await A.setSuspended(u.id, false); toast("Suspension lifted.", "success"); reload(); });
      return;
    }
    const reason = prompt(`Suspend @${u.username}? They'll still be able to read, but not post, upload, comment or message.\n\nReason (shown to them):`, "");
    if (reason === null) return;
    try { await A.setSuspended(u.id, true, reason.trim()); toast(`@${u.username} suspended.`, "success"); reload(); } catch (e) { fail(e); }
  }

  function editUser(u, reload) {
    const name = el("input", { type: "text", value: u.full_name, maxlength: "80", required: true });
    const bio = el("textarea", { rows: "3", maxlength: "280" }, [u.bio || ""]);
    const save = el("button", { class: "btn btn-primary", type: "submit" }, ["Save changes"]);
    const form = el("form", {}, [
      el("div", { class: "field" }, [el("label", {}, ["Full name"]), name]),
      el("div", { class: "field" }, [el("label", {}, ["Bio"]), bio]),
      el("p", { class: "a-note" }, ["Username, course and units can only be changed by the student. Email and password are managed in Clerk."]),
      save,
    ]);
    const close = MedLink.modal(`Edit @${u.username}`, form);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      save.disabled = true;
      try { await A.updateProfile(u.id, { full_name: name.value.trim(), bio: bio.value.trim() }); toast("Profile updated.", "success"); close(); reload(); }
      catch (err) { fail(err); save.disabled = false; }
    });
  }

  async function openUser(u) {
    const bodyNode = el("div", {}, [MedLink.loadingState()]);
    MedLink.modal(u.full_name, bodyNode, { wide: true });
    try {
      const [events, acts, follows] = await Promise.all([A.events({ userId: u.id, limit: 200 }), A.activity({ actorId: u.id, limit: 60 }), api.followCounts(u.id)]);
      const sessions = [];
      const seen = {};
      events.forEach(e => {
        let s = seen[e.session_id];
        if (!s) { s = seen[e.session_id] = { id: e.session_id, start: e.created_at, source: e.utm_source || e.referrer_host || "direct", landing: e.landing_path, device: e.device, browser: e.browser, views: 0 }; sessions.push(s); }
        if (e.created_at < s.start) s.start = e.created_at;
        if (e.type === "page_view") s.views++;
      });
      const feed = el("div", { class: "feed" });
      await fillActivity(feed, acts);
      const evFeed = el("div", { class: "feed" });
      await fillEvents(evFeed, events.slice(0, 40));
      bodyNode.replaceChildren(
        el("div", { class: "u-head" }, [
          MedLink.avatarNode(u, "lg", false),
          el("div", { style: "flex:1;min-width:0" }, [
            el("div", { style: "font-weight:800;font-size:18px" }, [u.full_name]),
            el("div", { class: "faint", style: "font-size:13px" }, ["@" + u.username + (u.email ? " · " + u.email : "")]),
            el("div", { class: "faint", style: "font-size:13px" }, [[uniName(u.university_id), courseName(u.course_id), u.year].filter(Boolean).join(" · ")]),
          ]),
          el("span", { class: "badge " + (u.role || "student") }, [u.role ? ROLE_LABELS[u.role] : "Student"]),
          u.suspended ? el("span", { class: "badge bad" }, ["Suspended"]) : null,
          el("a", { class: "a-btn", href: profileHref(u) }, ["Open profile"]),
        ]),
        el("div", { class: "u-stats" }, [
          ["Joined", timeAgo(u.created_at)], ["Last seen", u.last_seen ? timeAgo(u.last_seen) : "—"],
          ["Posts / uploads", fmt(u.posts) + " / " + fmt(u.resources)], ["Followers", fmt(follows.followers)],
        ].map(([l, v]) => el("div", { class: "u-stat" }, [el("b", {}, [v]), el("span", {}, [l])]))),
        el("div", { class: "u-cols" }, [
          el("div", {}, [el("h4", {}, ["What they did"]), el("div", { class: "u-scroll" }, [feed]),
            el("h4", { style: "margin-top:16px" }, ["Pages & clicks"]), el("div", { class: "u-scroll" }, [evFeed])]),
          el("div", {}, [el("h4", {}, ["Recent visits"]), el("div", { class: "u-scroll" }, sessions.length ? sessions.slice(0, 15).map(s => el("div", { class: "sess-row" }, [
            el("div", { class: "hbar-label" }, [srcDot(s.source), el("span", {}, [el("b", {}, [s.source]), " · " + s.views + " pages"])]),
            el("div", { class: "faint", style: "margin-top:4px" }, [when(s.start) + " · " + [s.device, s.browser].filter(Boolean).join(", ") + (s.landing ? " · landed on " + pageName(s.landing) : "")]),
          ])) : [el("div", { class: "faint", style: "font-size:13px" }, ["No visits recorded yet."])])]),
        ]),
      );
    } catch (e) { bodyNode.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
  }

  // ------------------------------------------------------------------
  // CONTENT
  // ------------------------------------------------------------------
  async function renderContent(p) {
    let kind = "resources", q = "";
    const search = el("input", { type: "search", placeholder: "Search…", "aria-label": "Search content" });
    const body = el("div", {}, [MedLink.loadingState()]);
    const load = async () => {
      body.replaceChildren(MedLink.loadingState());
      try {
        if (kind === "resources") {
          const rows = await A.resources({ q, limit: 100 });
          body.replaceChildren(table([
            { label: "Resource", render: r => el("a", { href: "resource.html?id=" + encodeURIComponent(r.id), style: "font-weight:700" }, [r.title]) },
            { label: "Type", render: r => { const ts = typeStyle(r.type); return el("span", { class: "badge", style: `background:${ts.soft};color:${ts.color}` }, [ts.icon + " " + r.type]); } },
            { label: "Unit", render: r => el("span", { class: "muted-cell" }, [r.unit]) },
            { label: "By", render: r => userCell(r.author) },
            { label: "Views", cls: "num", render: r => fmt(r.views) },
            { label: "Saves", cls: "num", render: r => fmt(count(r.saved_resources)) },
            { label: "Added", cls: "nowrap", render: r => timeAgo(r.created_at) },
            { label: "", render: r => el("div", { class: "a-actions" }, [
              el("button", { type: "button", class: "a-btn", onclick: () => editResource(r, load) }, ["Edit"]),
              el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo(`Delete “${r.title}” and its file? This can't be undone.`, async () => { await api.deleteResource(r); toast("Resource deleted."); load(); }) }, ["Delete"]),
            ]) },
          ], rows, "No resources found."));
        } else if (kind === "posts") {
          const rows = await A.posts({ q, limit: 100 });
          body.replaceChildren(table([
            { label: "Post", render: r => el("div", { style: "max-width:420px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word" }, [r.body.length > 220 ? r.body.slice(0, 220) + "…" : r.body]) },
            { label: "By", render: r => userCell(r.author) },
            { label: "Where", render: r => r.community ? el("a", { class: "handle", href: "communities.html?c=" + encodeURIComponent(r.community.id) }, [r.community.name]) : r.unit ? el("a", { class: "handle", href: "communities.html?unit=" + encodeURIComponent(r.unit) }, [r.unit]) : "Main feed" },
            { label: "❤️", cls: "num", render: r => fmt(count(r.post_likes)) },
            { label: "💬", cls: "num", render: r => fmt(count(r.post_comments)) },
            { label: "Posted", cls: "nowrap", render: r => timeAgo(r.created_at) },
            { label: "", render: r => el("div", { class: "a-actions" }, [
              el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo("Delete this post and its comments?", async () => { await api.deletePost(r.id); toast("Post deleted."); load(); }) }, ["Delete"]),
            ]) },
          ], rows, "No posts found."));
        } else {
          const rows = await A.comments({ q, limit: 100 });
          body.replaceChildren(table([
            { label: "Comment", render: r => el("div", { style: "max-width:460px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word" }, [r.body]) },
            { label: "By", render: r => userCell(r.author) },
            { label: "Posted", cls: "nowrap", render: r => timeAgo(r.created_at) },
            { label: "", render: r => el("div", { class: "a-actions" }, [
              el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo("Delete this comment?", async () => { await api.deleteComment(r.id); toast("Comment deleted."); load(); }) }, ["Delete"]),
            ]) },
          ], rows, "No comments found."));
        }
      } catch (e) { body.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
    };
    let t = null;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { q = search.value.trim(); load(); }, 300); });
    p.replaceChildren(card("Content", "Everything students have shared. Edit or remove anything that breaks the rules.", el("div", {}, [
      el("div", { class: "a-toolbar" }, [subtabs([["resources", "📘 Resources"], ["posts", "💬 Posts"], ["comments", "💭 Comments"]], kind, k => { kind = k; load(); }), search]),
      body,
    ])));
    await load();
  }

  function editResource(r, reload) {
    const title = el("input", { type: "text", value: r.title, minlength: "3", maxlength: "140", required: true });
    const unit = el("input", { type: "text", value: r.unit, maxlength: "120", required: true });
    const type = el("select", {}, RESOURCE_TYPES.map(t => el("option", { value: t, selected: t === r.type }, [t])));
    const desc = el("textarea", { rows: "4", maxlength: "1000" }, [r.description || ""]);
    const save = el("button", { class: "btn btn-primary", type: "submit" }, ["Save changes"]);
    const form = el("form", {}, [
      el("div", { class: "field" }, [el("label", {}, ["Title"]), title]),
      el("div", { class: "two-col" }, [el("div", { class: "field" }, [el("label", {}, ["Unit"]), unit]), el("div", { class: "field" }, [el("label", {}, ["Type"]), type])]),
      el("div", { class: "field" }, [el("label", {}, ["Description"]), desc]),
      save,
    ]);
    const close = MedLink.modal("Edit resource", form);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      save.disabled = true;
      try {
        await A.updateResource(r.id, { title: title.value.trim(), unit: unit.value.trim(), type: type.value, description: desc.value.trim() });
        toast("Resource updated.", "success"); close(); reload();
      } catch (err) { fail(err); save.disabled = false; }
    });
  }

  // ------------------------------------------------------------------
  // REPORTS
  // ------------------------------------------------------------------
  async function renderReports(p) {
    let status = "open";
    const body = el("div", {}, [MedLink.loadingState()]);
    const load = async () => {
      body.replaceChildren(MedLink.loadingState());
      try {
        const rows = await A.reports(status === "all" ? null : status);
        body.replaceChildren(...(rows.length ? rows.map(r => {
          const res = r.resource;
          const badge = { open: "warn", resolved: "ok", dismissed: "student" }[r.status];
          return el("div", { class: "report-card" }, [
            el("div", {}, [
              el("div", { class: "row-gap", style: "flex-wrap:wrap" }, [
                el("span", { class: "badge " + badge }, [pretty(r.status)]),
                res ? el("a", { href: "resource.html?id=" + encodeURIComponent(res.id), style: "font-weight:800" }, [res.title]) : el("b", {}, ["(resource deleted)"]),
                res ? el("span", { class: "faint", style: "font-size:12.5px" }, [res.type + " · " + res.unit]) : null,
              ]),
              el("div", { class: "report-reason" }, [r.reason ? "“" + r.reason + "”" : el("span", { class: "faint" }, ["No reason given"])]),
              el("div", { class: "faint", style: "font-size:12px" }, ["Reported by " + (r.reporter ? r.reporter.full_name + " (@" + r.reporter.username + ")" : "someone") + " · " + timeAgo(r.created_at)
                + (r.resolved_at ? " · " + r.status + " " + timeAgo(r.resolved_at) : "")]),
            ]),
            el("div", { class: "a-actions" }, [
              res ? el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo(`Delete “${res.title}” and resolve this report?`, async () => {
                await A.resolveReport(r.id, "resolved");
                await api.deleteResource(res);
                toast("Resource removed.", "success"); load();
              }) }, ["Delete resource"]) : null,
              r.status !== "resolved" ? el("button", { type: "button", class: "a-btn primary", onclick: () => confirmDo("Mark this report as resolved?", async () => { await A.resolveReport(r.id, "resolved"); load(); }) }, ["Resolve"]) : null,
              r.status !== "dismissed" ? el("button", { type: "button", class: "a-btn", onclick: () => confirmDo("Dismiss this report (no action needed)?", async () => { await A.resolveReport(r.id, "dismissed"); load(); }) }, ["Dismiss"]) : null,
              r.status !== "open" ? el("button", { type: "button", class: "a-btn", onclick: () => confirmDo("Reopen this report?", async () => { await A.resolveReport(r.id, "open"); load(); }) }, ["Reopen"]) : null,
            ]),
          ]);
        }) : [MedLink.emptyState(status === "open" ? "No open reports — all clear 🎉" : "Nothing here.")]));
      } catch (e) { body.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
    };
    p.replaceChildren(card("Reported resources", "Students flag resources that are wrong, copyrighted or inappropriate.", el("div", {}, [
      el("div", { class: "a-toolbar" }, [subtabs([["open", "Open"], ["resolved", "Resolved"], ["dismissed", "Dismissed"], ["all", "All"]], status, s => { status = s; load(); })]),
      body,
    ])));
    await load();
  }

  // ------------------------------------------------------------------
  // COMMUNITIES
  // ------------------------------------------------------------------
  async function renderCommunities(p) {
    const grid = el("div", { class: "comm-admin-grid" }, [MedLink.loadingState()]);
    const load = async () => {
      try {
        const rows = await api.communities();
        grid.replaceChildren(...rows.map(c => el("div", { class: "card community-card" }, [
          MedLink.communityCoverNode(c),
          el("div", { class: "cc-body" }, [
            el("div", { class: "community-name" }, [c.name]),
            el("div", { class: "faint community-count" }, [plural(count(c.community_members), "member") + " · /" + c.id]),
            el("div", { class: "muted community-desc" }, [c.description || "No description."]),
            el("div", { class: "a-actions", style: "justify-content:flex-start" }, [
              el("a", { class: "a-btn", href: "communities.html?c=" + encodeURIComponent(c.id) }, ["Open"]),
              isAdmin ? el("button", { type: "button", class: "a-btn", onclick: () => editCommunity(c, load) }, ["Edit"]) : null,
              isAdmin ? el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo(`Delete “${c.name}”? Its posts and memberships are deleted too.`, async () => { await A.deleteCommunity(c.id); toast("Community deleted."); load(); }) }, ["Delete"]) : null,
            ]),
          ]),
        ])));
      } catch (e) { grid.replaceChildren(MedLink.emptyState(MedLink.errorMessage(e))); fail(e); }
    };
    p.replaceChildren(card("Communities", isAdmin ? "Create, rename, re-photo or remove communities." : "Only admins can edit communities.", grid,
      isAdmin ? el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: () => editCommunity(null, load) }, ["+ New community"]) : null));
    await load();
  }

  function editCommunity(c, reload) {
    const isNew = !c;
    c = c || { id: "", name: "", description: "", image_url: "" };
    const name = el("input", { type: "text", value: c.name, maxlength: "60", required: true });
    const slug = el("input", { type: "text", value: c.id, maxlength: "40", pattern: "[a-z0-9\\-]{2,40}", required: true, disabled: !isNew });
    const desc = el("textarea", { rows: "3", maxlength: "300" }, [c.description || ""]);
    let imageUrl = c.image_url || "";
    const preview = el("div", { class: "cc-cover", style: "border-radius:16px;margin-bottom:10px" });
    const paint = () => {
      const img = imageUrl || MedLink.communityImage({ id: slug.value });
      preview.style.backgroundImage = img ? MedLink.cssUrl(img) : "none";
      preview.style.setProperty("--cc", MedLink.communityColor({ id: slug.value || name.value }));
    };
    if (isNew) name.addEventListener("input", () => { slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); paint(); });
    paint();
    const save = el("button", { class: "btn btn-primary", type: "submit" }, [isNew ? "Create community" : "Save changes"]);
    const form = el("form", {}, [
      el("div", { class: "field" }, [el("label", {}, ["Name"]), name]),
      el("div", { class: "field" }, [el("label", {}, ["Link name"]), slug, el("div", { class: "field-hint" }, ["communities.html?c=… — lowercase letters, numbers and dashes. Can't be changed later."])]),
      el("div", { class: "field" }, [el("label", {}, ["Description"]), desc]),
      el("div", { class: "field" }, [el("label", {}, ["Cover photo"]), preview, el("div", { class: "a-actions", style: "justify-content:flex-start" }, [
        el("button", { type: "button", class: "a-btn", onclick: async () => { const url = await pickImage("Community cover"); if (url) { imageUrl = url; paint(); } } }, ["Choose photo…"]),
        el("button", { type: "button", class: "a-btn", onclick: () => { imageUrl = ""; paint(); } }, ["Use default"]),
      ])]),
      save,
    ]);
    const close = MedLink.modal(isNew ? "New community" : "Edit " + c.name, form);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!/^[a-z0-9-]{2,40}$/.test(slug.value)) return toast("Link name: 2–40 lowercase letters, numbers or dashes.", "error");
      save.disabled = true;
      try {
        await A.saveCommunity({ id: slug.value, name: name.value.trim(), description: desc.value.trim(), image_url: imageUrl }, isNew);
        toast(isNew ? "Community created." : "Community saved.", "success"); close(); reload();
      } catch (err) { fail(err); save.disabled = false; }
    });
  }

  // ------------------------------------------------------------------
  // SITE IMAGES + MEDIA LIBRARY
  // ------------------------------------------------------------------
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_IMAGE = 8 * 1024 * 1024;
  function checkImage(file) {
    if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: use a PNG, JPG, WebP or GIF image.`);
    if (file.size > MAX_IMAGE) throw new Error(`${file.name} is larger than 8 MB.`);
  }

  // Resolves with a chosen image URL (uploaded, from the library, or pasted), or null.
  function pickImage(title) {
    return new Promise(resolve => {
      let done = false, close = null;
      const finish = url => { if (done) return; done = true; if (close) close(); resolve(url); };
      const grid = el("div", { class: "media-pick" }, [MedLink.loadingState()]);
      const file = el("input", { type: "file", accept: IMAGE_TYPES.join(","), hidden: true });
      const drop = el("div", { class: "dropzone" }, ["Drop an image here or ", el("button", { type: "button", class: "a-btn primary", onclick: () => file.click() }, ["Upload from device"]), el("div", { class: "field-hint" }, ["PNG, JPG, WebP or GIF · up to 8 MB · wide photos work best"])]);
      const url = el("input", { type: "url", placeholder: "…or paste an image link (https://)", style: "flex:1;min-width:0;font:inherit;font-size:13px;padding:9px 14px;border-radius:999px;border:1px solid var(--border-strong);background:var(--input-bg);color:var(--text)" });
      const upload = async f => {
        try { checkImage(f); drop.classList.add("over"); const r = await A.uploadMedia(f); toast("Uploaded.", "success"); finish(r.url); }
        catch (e) { drop.classList.remove("over"); fail(e); }
      };
      file.addEventListener("change", () => file.files[0] && upload(file.files[0]));
      drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
      const body = el("div", {}, [
        drop, file,
        el("div", { class: "img-group-title", style: "margin-top:16px" }, ["Or pick from your library"]),
        grid,
        el("div", { class: "utm-out" }, [url, el("button", { type: "button", class: "a-btn", onclick: () => {
          if (!/^https:\/\/\S+$/.test(url.value.trim())) return toast("Paste a link starting with https://", "error");
          finish(url.value.trim());
        } }, ["Use link"])]),
      ]);
      close = MedLink.modal(title || "Choose an image", body, { wide: true });
      // Resolve null if the modal is closed any other way.
      const watcher = new MutationObserver(() => { if (!document.body.contains(body)) { watcher.disconnect(); finish(null); } });
      watcher.observe(document.body, { childList: true });
      A.media().then(items => {
        grid.replaceChildren(...(items.length ? items.map(m => el("button", { type: "button", title: m.name, onclick: () => finish(m.url) }, [el("img", { src: m.url, alt: m.name, loading: "lazy" })]))
          : [el("div", { class: "faint", style: "font-size:13px;grid-column:1/-1" }, ["Your library is empty — upload the first image above."])]));
      }).catch(e => { grid.replaceChildren(el("div", { class: "faint", style: "font-size:13px;grid-column:1/-1" }, [MedLink.errorMessage(e)])); });
    });
  }

  async function renderImages(p) {
    const slotsBox = el("div", {}, [MedLink.loadingState()]);
    const mediaBox = el("div", { class: "img-grid" }, [MedLink.loadingState()]);
    const file = el("input", { type: "file", accept: IMAGE_TYPES.join(","), multiple: true, hidden: true });
    const drop = el("div", { class: "dropzone", style: "margin-bottom:16px" }, ["Drop images here or ", el("button", { type: "button", class: "a-btn primary", onclick: () => file.click() }, ["Upload images"]),
      el("div", { class: "field-hint" }, ["They're stored in your Supabase “site-media” bucket and can be used for any slot or community cover."])]);
    let custom = {}, communities = [];

    const loadSlots = async () => {
      const rows = await api.siteImages();
      custom = {};
      rows.forEach(r => { custom[r.slot] = r; });
      const groups = {};
      SITE_IMAGES.forEach(s => { (groups[s.group] = groups[s.group] || []).push(s); });
      slotsBox.replaceChildren(...Object.entries(groups).flatMap(([group, slots]) => [
        el("div", { class: "img-group-title" }, [group]),
        el("div", { class: "img-grid" }, slots.map(s => {
          const c = custom[s.slot];
          const url = c ? c.url : s.src;
          return el("div", { class: "img-card" }, [
            el("div", { class: "img-prev", style: "background-image:" + MedLink.cssUrl(url) }, [el("span", { class: "badge " + (c ? "admin" : "student") }, [c ? "Custom" : "Default"])]),
            el("div", { class: "img-body" }, [
              el("div", { class: "img-title" }, [s.label]),
              el("div", { class: "img-sub" }, [c ? "Changed " + timeAgo(c.updated_at) : "Built-in photo"]),
              el("div", { class: "a-actions" }, [
                el("button", { type: "button", class: "a-btn primary", onclick: async () => {
                  const next = await pickImage("Replace: " + s.label);
                  if (!next) return;
                  try { await A.setSiteImage(s.slot, next, s.alt); toast("Image updated across the site.", "success"); await refresh(); } catch (e) { fail(e); }
                } }, ["Replace"]),
                c ? el("button", { type: "button", class: "a-btn", onclick: () => confirmDo(`Go back to the built-in photo for “${s.label}”?`, async () => { await A.resetSiteImage(s.slot); toast("Reset to default."); await refresh(); }) }, ["Reset"]) : null,
                el("a", { class: "a-btn", href: url, target: "_blank", rel: "noopener" }, ["View"]),
              ]),
            ]),
          ]);
        })),
      ]));
    };
    const usedBy = url => SITE_IMAGES.filter(s => custom[s.slot] && custom[s.slot].url === url).map(s => s.label)
      .concat(communities.filter(c => c.image_url === url).map(c => c.name + " cover"));
    const loadMedia = async () => {
      communities = await api.communities();
      const items = await A.media();
      mediaBox.replaceChildren(...(items.length ? items.map(m => {
        const uses = usedBy(m.url);
        return el("div", { class: "img-card" }, [
          el("div", { class: "img-prev", style: "background-image:" + MedLink.cssUrl(m.url) }, [uses.length ? el("span", { class: "badge ok" }, ["In use"]) : null]),
          el("div", { class: "img-body" }, [
            el("div", { class: "img-sub" }, [m.name]),
            el("div", { class: "img-sub" }, [[formatBytes(m.size), m.created_at ? timeAgo(m.created_at) : ""].filter(Boolean).join(" · ") + (uses.length ? " · " + uses.join(", ") : "")]),
            el("div", { class: "a-actions" }, [
              el("button", { type: "button", class: "a-btn", onclick: async () => { try { await navigator.clipboard.writeText(m.url); toast("Link copied.", "success"); } catch (e) { prompt("Copy this link:", m.url); } } }, ["Copy link"]),
              el("button", { type: "button", class: "a-btn danger", onclick: () => confirmDo(
                uses.length ? `This image is used for: ${uses.join(", ")}.\nDelete it anyway? Those places will show a broken image until you replace or reset them.` : `Delete ${m.name}?`,
                async () => { await A.deleteMedia(m.name); toast("Image deleted."); await refresh(); }) }, ["Delete"]),
            ]),
          ]),
        ]);
      }) : [el("div", { class: "faint", style: "font-size:13px" }, ["No uploads yet."])]));
    };
    const refresh = async () => {
      try { await loadSlots(); await loadMedia(); } catch (e) { fail(e); }
    };
    const uploadAll = async files => {
      for (const f of files) {
        try { checkImage(f); await A.uploadMedia(f); } catch (e) { fail(e); }
      }
      toast("Upload finished.", "success");
      await loadMedia();
    };
    file.addEventListener("change", () => uploadAll(Array.from(file.files)));
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); uploadAll(Array.from(e.dataTransfer.files)); });

    p.replaceChildren(
      card("Site images", "Every photo on MedLink. Replace one and it changes for every visitor straight away.", slotsBox),
      el("div", { style: "height:16px" }),
      card("Media library", "Images you've uploaded", el("div", {}, [drop, file, mediaBox])),
    );
    await refresh();
  }

  // ------------------------------------------------------------------
  // Go
  // ------------------------------------------------------------------
  await loadStats();
});

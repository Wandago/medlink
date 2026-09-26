/* =========================================================
   MEDLINK KE — theme engine
   Loaded synchronously in <head> so the theme is applied
   before first paint (no flash of the wrong theme).
========================================================= */
(function () {
  var KEY = "medlink_theme";       // "light" | "dark" | absent (= follow system)
  var ACCOUNT_KEY = "medlink_me";  // theme is mirrored here when signed in

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  // Explicit choice wins; otherwise follow the operating system.
  function resolve() {
    var s = stored();
    if (s === "light" || s === "dark") return s;
    return systemPrefersDark() ? "dark" : "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#14111F" : "#FFFFFF");
  }

  // Run immediately — this file is loaded in <head>, before <body> renders.
  apply(resolve());

  function mirrorToAccount(theme) {
    try {
      var raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return;
      var me = JSON.parse(raw);
      if (!me) return;
      me.theme = theme; // travels with the account once a backend exists
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(me));
    } catch (e) { /* account sync is best-effort only */ }
  }

  function setTheme(theme, persist) {
    apply(theme);
    if (persist !== false) {
      try { localStorage.setItem(KEY, theme); } catch (e) {}
      mirrorToAccount(theme);
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  function useSystem() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    var theme = systemPrefersDark() ? "dark" : "light";
    apply(theme);
    mirrorToAccount("system");
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  function current() { return document.documentElement.getAttribute("data-theme") || "light"; }
  function preference() { return stored() || "system"; }
  function toggle() { setTheme(current() === "dark" ? "light" : "dark"); }

  // Track the OS while the user hasn't made an explicit choice.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function (e) { if (!stored()) apply(e.matches ? "dark" : "light"); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  window.MedLinkTheme = {
    set: setTheme, toggle: toggle, useSystem: useSystem,
    current: current, preference: preference,
  };

  // Wire up any [data-theme-toggle] button on the page.
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-toggle]"), function (btn) {
      function label() {
        var next = current() === "dark" ? "light" : "dark";
        btn.setAttribute("aria-label", "Switch to " + next + " mode");
        btn.setAttribute("title", "Switch to " + next + " mode");
      }
      label();
      btn.addEventListener("click", function () { toggle(); label(); });
      document.addEventListener("themechange", label);
    });
  });
})();

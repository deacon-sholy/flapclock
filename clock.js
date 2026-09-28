/* FlapClock - split-flap flip clock, live time + day */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var rootEl = document.documentElement;
  var clockEl = $("#clock");
  var timeEl = $("#clock-time");
  var dayEl = $("#day-line");
  var helpEl = $("#help");
  var hintEl = $("#hint");

  var THEMES = ["white", "amber", "ice", "mint", "rose"];
  var GLOW_MAX = 0.55;

  // Bump when defaults change so previously-saved settings don't override them.
  var SETTINGS_VERSION = 3;

  /* ---------------- locale ---------------- */

  // 12- vs 24-hour is a locale preference rather than a fixed choice, so ask
  // Intl what the default hour cycle makes of 1 PM. resolvedOptions().hour12
  // is undefined on plenty of builds, so compare rendered output instead.
  function localeIs12h() {
    try {
      var s = new Intl.DateTimeFormat(undefined, { hour: "numeric" })
        .format(new Date(2020, 0, 1, 13, 0, 0));
      var h = parseInt(String(s).replace(/[^0-9]/g, ""), 10);
      return h === h && h !== 13;   // h === h rules out NaN; assume 24-hour then
    } catch (e) { return false; }
  }

  // "AM"/"PM" is not universal - ja-JP wants 午前/午後, de-DE wants vorm./nachm.
  // Ask the locale for its own day-period words, but only accept them when they
  // are actually short. Newer CLDR resolves dayPeriod "short" for en-US to
  // "in the afternoon", which is far too long to sit under a clock, so those
  // locales fall back to the Latin AM/PM convention.
  var periods = null;
  function dayPeriods() {
    if (periods) return periods;
    periods = { am: "AM", pm: "PM" };
    try {
      var f = new Intl.DateTimeFormat(undefined, {
        hour: "numeric", minute: "2-digit", hour12: true, dayPeriod: "short"
      });
      function part(d) {
        var all = f.formatToParts(d);
        for (var i = 0; i < all.length; i++) {
          if (all[i].type === "dayPeriod") return all[i].value;
        }
        return "";
      }
      var am = part(new Date(2020, 0, 1, 3, 0, 0));
      var pm = part(new Date(2020, 0, 1, 15, 0, 0));
      if (am && pm && am.length <= 4 && pm.length <= 4) periods = { am: am, pm: pm };
    } catch (e) {}
    return periods;
  }

  var DEFAULTS = {
    hour24: !localeIs12h(),
    showSeconds: true,
    showDay: true,
    showAmpm: true,
    showFlaps: true,
    blinkColon: true,
    glow: true,
    showCredit: true,
    theme: "white",
    dim: 0,      // 0..0.8
    size: 1      // 0.3..1
  };
  var state = load();

  function load() {
    var s = {};
    for (var k in DEFAULTS) s[k] = DEFAULTS[k];
    try {
      var raw = localStorage.getItem("flapclock.settings");
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.__v === SETTINGS_VERSION) {
          for (var k in DEFAULTS) if (k in saved) s[k] = saved[k];
        }
      }
    } catch (e) {}
    if (THEMES.indexOf(s.theme) === -1) s.theme = "white";
    return s;
  }
  function save() {
    try {
      var out = { __v: SETTINGS_VERSION };
      for (var k in DEFAULTS) out[k] = state[k];
      localStorage.setItem("flapclock.settings", JSON.stringify(out));
    } catch (e) {}
  }

  /* ---------------- build DOM ---------------- */

  function makeCard() {
    var card = document.createElement("div");
    card.className = "card";
    card.dataset.v = "";
    card.innerHTML =
      '<div class="half top"><span class="glyph"></span></div>' +
      '<div class="half bottom"><span class="glyph"></span></div>' +
      '<div class="leaf leaf-a"><span class="glyph"></span></div>' +
      '<div class="leaf leaf-b"><span class="glyph"></span></div>';
    return card;
  }

  function makeColon() {
    var c = document.createElement("div");
    c.className = "colon";
    c.innerHTML = "<i></i><i></i>";
    return c;
  }

  var cards = [];
  var ampmEl = null;

  function build() {
    timeEl.innerHTML = "";
    cards = [];
    ampmEl = null;
    var groups = state.showSeconds ? ["H", "M", "S"] : ["H", "M"];

    groups.forEach(function (name, gi) {
      if (gi > 0) timeEl.appendChild(makeColon());
      var g = document.createElement("div");
      g.className = "group";
      g.dataset.unit = name;
      for (var i = 0; i < 2; i++) {
        var c = makeCard();
        g.appendChild(c);
        cards.push(c);
      }
      if (gi === 0) {
        ampmEl = document.createElement("div");
        ampmEl.className = "ampm";
        g.appendChild(ampmEl);
      }
      timeEl.appendChild(g);
    });

    document.body.classList.toggle("no-flap", !state.showFlaps);
    update(true);
  }

  /* ---------------- time formatting ---------------- */

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];

  var dayFmt = null;
  function dayFormatter() {
    if (dayFmt === null) {
      try {
        dayFmt = new Intl.DateTimeFormat(undefined, {
          weekday: "long", month: "long", day: "numeric", year: "numeric"
        });
      } catch (e) {
        dayFmt = false;
      }
    }
    return dayFmt || null;
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function parts(d) {
    var h = d.getHours();
    var suffix = "";
    if (!state.hour24) {
      var dp = dayPeriods();
      suffix = h < 12 ? dp.am : dp.pm;
      h = h % 12;
      if (h === 0) h = 12;
    }
    var digits = (pad2(h) + pad2(d.getMinutes())).split("");
    if (state.showSeconds) digits = digits.concat(pad2(d.getSeconds()).split(""));

    var f = dayFormatter();
    var day = f
      ? f.format(d)
      : DAYS[d.getDay()] + "  \u00b7  " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();

    return { digits: digits, ampm: suffix, day: day };
  }

  /* ---------------- flip ---------------- */

  // Mirrors --half-dur in styles.css so the JS timers and the CSS transition
  // never drift apart (including the reduced-motion override).
  var HALF = 170;
  function readHalfDur() {
    var v = parseFloat(getComputedStyle(rootEl).getPropertyValue("--half-dur"));
    return isFinite(v) && v > 0 ? v : 170;
  }

  function setStatic(card, topCh, botCh) {
    $(".half.top .glyph", card).textContent = topCh;
    $(".half.bottom .glyph", card).textContent = botCh;
    card.classList.remove("flipping", "flip-a", "flip-b");
  }

  function flip(card, oldCh, newCh) {
    if (card.dataset.flipping) return;
    card.dataset.flipping = "1";

    $(".half.top .glyph", card).textContent = newCh;
    $(".half.bottom .glyph", card).textContent = oldCh;
    $(".leaf-a .glyph", card).textContent = oldCh;
    $(".leaf-b .glyph", card).textContent = newCh;

    card.classList.add("flipping");
    void card.offsetWidth; // commit starting transform
    card.classList.add("flip-a");

    setTimeout(function () { card.classList.add("flip-b"); }, HALF);
    setTimeout(function () {
      card.classList.remove("flipping", "flip-a", "flip-b");
      delete card.dataset.flipping;
      $(".half.bottom .glyph", card).textContent = newCh;
    }, HALF * 2);
  }

  /* ---------------- tick ---------------- */

  var lastDay = null;

  function update() {
    var p = parts(new Date());

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var ch = p.digits[i];
      if (!ch) continue;
      var cur = card.dataset.v || "";
      if (ch === cur) continue;
      card.dataset.v = ch;
      if (!cur) {
        setStatic(card, ch, ch);
      } else if (state.showFlaps) {
        flip(card, cur, ch);
      } else {
        setStatic(card, ch, ch);
      }
    }

    if (ampmEl) {
      ampmEl.textContent = (!state.hour24 && state.showAmpm) ? p.ampm : "";
    }

    var dayText = state.showDay ? p.day : "";
    if (dayText !== lastDay) {
      lastDay = dayText;
      if (dayEl.textContent) {
        // crossfade so midnight doesn't snap
        dayEl.classList.add("swap");
        setTimeout(function () {
          dayEl.textContent = dayText;
          dayEl.classList.remove("swap");
        }, 220);
      } else {
        dayEl.textContent = dayText;
      }
    }

    // colon blinks in phase with the system clock, not a free-running timer
    var s = Math.floor(Date.now() / 1000);
    rootEl.classList.toggle("colon-off", state.blinkColon && s % 2 === 1);
  }

  // Fire on the second boundary and re-derive from the wall clock each time,
  // so the display self-corrects after sleep, suspend or a clock change.
  var tickTimer = null;
  function tick() {
    try { update(); } catch (e) {}
    clearTimeout(tickTimer);
    tickTimer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }

  /* ---------------- layout ---------------- */

  function layout() {
    var numDigits = state.showSeconds ? 6 : 4;
    var numColons = state.showSeconds ? 2 : 1;
    var groups = numDigits / 2;

    var widthU =
      0.30 +                       // outer padding
      numDigits * 0.60 +           // digit cards
      groups * 0.05 +              // gap inside each group
      numColons * (0.26 + 0.12);   // colon + its margins

    // AM/PM sits outside the hours group, so it eats into the usable width.
    if (!state.hour24 && state.showAmpm) widthU += 0.22;

    var heightU = 1.0 +
      (state.showDay ? 0.34 : 0.02) +
      (state.showCredit ? 0.22 : 0);

    var W = window.innerWidth, H = window.innerHeight;
    var dh = Math.min((H * 0.90) / heightU, (W * 0.92) / widthU);
    if (!isFinite(dh) || dh <= 0) dh = 200;
    dh = Math.max(48, dh * state.size);

    rootEl.style.setProperty("--dh", dh + "px");
    rootEl.style.setProperty("--dim", state.dim);
    rootEl.style.setProperty("--glow", state.glow ? GLOW_MAX : 0);
    document.body.classList.toggle("glow-on", state.glow);
    HALF = readHalfDur();
  }

  /* ---------------- controls ---------------- */

  function setBtn(act, on) {
    var b = $('[data-act="' + act + '"]');
    if (!b) return;
    b.classList.toggle("on", !!on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function syncUI() {
    setBtn("fmt", state.hour24);
    setBtn("sec", state.showSeconds);
    setBtn("day", state.showDay);
    setBtn("ampm", state.showAmpm);
    setBtn("flaps", state.showFlaps);
    setBtn("blink", state.blinkColon);
    setBtn("glow", state.glow);
    setBtn("credit", state.showCredit);
    document.body.classList.toggle("glow-on", state.glow);
    document.body.classList.toggle("no-credit", !state.showCredit);
    rootEl.dataset.theme = state.theme;
    var tb = $('[data-act="theme"]');
    if (tb) tb.textContent = state.theme;
    var dim = $('[data-act="dim"]');
    if (dim) dim.value = Math.round(state.dim * 100);
    var size = $('[data-act="size"]');
    if (size) size.value = Math.round(state.size * 100);
  }

  function cycleTheme() {
    state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
  }

  function toggle(key) {
    switch (key) {
      case "fmt":   state.hour24 = !state.hour24; layout(); break;
      case "sec":   state.showSeconds = !state.showSeconds; layout(); build(); break;
      case "day":   state.showDay = !state.showDay; layout(); break;
      case "ampm":  state.showAmpm = !state.showAmpm; layout(); break;
      case "flaps": state.showFlaps = !state.showFlaps; build(); break;
      case "blink": state.blinkColon = !state.blinkColon; break;
      case "glow":  state.glow = !state.glow; layout(); break;
      case "credit": state.showCredit = !state.showCredit; layout(); break;
      case "theme": cycleTheme(); break;
    }
    save();
    syncUI();
    update();
  }

  function nudgeDim(delta) {
    state.dim = Math.min(0.8, Math.max(0, state.dim + delta));
    layout(); save(); syncUI();
  }
  function nudgeSize(delta) {
    state.size = Math.min(1, Math.max(0.3, state.size + delta));
    layout(); save(); syncUI();
  }

  function inFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    var el = document.documentElement;
    if (!inFullscreen()) {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        var p = req.call(el);
        if (p && p.catch) p.catch(function () {});
      }
    } else {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) ex.call(document);
    }
  }

  function exitApp() {
    if (inFullscreen()) toggleFullscreen();
    window.close();
    // Browsers refuse window.close() on tabs they opened themselves, so tell
    // the user what to do rather than letting the button do nothing.
    setTimeout(function () {
      if (!window.closed) flash("Press Alt+F4 to close this window");
    }, 250);
  }

  function showHelp(on) {
    helpEl.hidden = !on;
  }

  /* ---------------- hint / messages ---------------- */

  var hintTimer = null;
  function flash(msg) {
    hintEl.textContent = msg;
    hintEl.classList.remove("gone");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hintEl.classList.add("gone"); }, 3500);
  }

  /* ---------------- events ---------------- */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (btn) {
      var act = btn.getAttribute("data-act");
      if (act === "full") return toggleFullscreen();
      if (act === "exit") return exitApp();
      if (act === "help") return showHelp(true);
      if (act === "help-close") return showHelp(false);
      if (act === "dim" || act === "size") return;
      return toggle(act);
    }
    if (!helpEl.hidden && e.target === helpEl) showHelp(false);
  });

  document.addEventListener("input", function (e) {
    var act = e.target.getAttribute && e.target.getAttribute("data-act");
    if (act === "dim") {
      state.dim = Math.min(0.8, Math.max(0, (+e.target.value || 0) / 100));
      layout(); save();
    } else if (act === "size") {
      state.size = Math.min(1, Math.max(0.3, (+e.target.value || 100) / 100));
      layout(); save();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    wake();
    var k = e.key;
    if (k === "Escape") { showHelp(false); return; }
    if (k === "f" || k === "F" || k === " ") { e.preventDefault(); toggleFullscreen(); }
    else if (k === "t" || k === "T") toggle("fmt");
    else if (k === "s" || k === "S") toggle("sec");
    else if (k === "d" || k === "D") toggle("day");
    else if (k === "a" || k === "A") toggle("ampm");
    else if (k === "h" || k === "H") toggle("flaps");
    else if (k === "k" || k === "K") toggle("blink");
    else if (k === "c" || k === "C") toggle("theme");
    else if (k === "g" || k === "G") toggle("glow");
    else if (k === "b" || k === "B") toggle("credit");
    else if (k === "[") nudgeDim(-0.05);
    else if (k === "]") nudgeDim(0.05);
    else if (k === "-" || k === "_") nudgeSize(-0.05);
    else if (k === "=" || k === "+") nudgeSize(0.05);
    else if (k === "?" || k === "/") { e.preventDefault(); showHelp(helpEl.hidden); }
  });

  clockEl.addEventListener("dblclick", toggleFullscreen);

  window.addEventListener("resize", layout);
  document.addEventListener("fullscreenchange", layout);
  document.addEventListener("webkitfullscreenchange", layout);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  /* ---------------- idle / screensaver behaviour ---------------- */

  var idleTimer = null;
  function wake() {
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      document.body.classList.add("idle");
    }, 2200);
  }
  ["mousemove", "mousedown", "wheel", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, wake, { passive: true });
  });

  /* ---------------- go ---------------- */

  layout();
  build();
  syncUI();
  tick();
  wake();

  setTimeout(function () { hintEl.classList.add("gone"); }, 6000);
})();

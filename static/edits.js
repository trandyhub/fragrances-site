/* fragrances.taraga.net: on-site edits.
   1) Overlay: loads data/edits.json (committed by the editor API) and shows any edit that is newer than this build
      (ratings, R/N, public comments, Today's Featured, calendar). Beauvoir's next build bakes the edits in.
   2) Editor: the footer "Edit" link (or #edit) opens a PIN prompt, then a small panel that saves through the API.
   The PIN is never in this page; the API checks it and returns a short-lived token kept in sessionStorage. */
(function () {
  "use strict";
  var S = document.currentScript, ROOT = (S && S.dataset.root) || "/", API = (S && S.dataset.api) || "";
  var bm = document.querySelector('meta[name="taraga-build"]'), BUILD = bm ? bm.content : "";
  var TOKEN_KEY = "taragaEditToken", LOCAL_KEY = "taragaEditsLocal";
  var SLOTS = [["day", "Cologne of the Day"], ["gym", "Workout"], ["sleep", "Night Time"]];
  var meta = null, frags = null;

  function qsa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function nyToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  function fmt(x) { return x == null || x === "" ? "\u2014" : String(+(+x).toFixed(2)); }
  function fmtn(x) { return x == null || x === "" ? "\u2014" : (+x).toFixed(3); }
  function r3(x) { return Math.round((x + 1e-9) * 1000) / 1000; }
  function newer(at, seen) { return !!at && (!seen || String(at) > String(seen)); }
  function ids(v) { return !v ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]; }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function loadMeta() { return meta ? Promise.resolve(meta) : getJSON(ROOT + "data/editor.json?v=" + encodeURIComponent(BUILD)).then(function (m) { meta = m; return m; }); }
  function loadFrags() { return frags ? Promise.resolve(frags) : getJSON(ROOT + "data/fragments.json?v=" + encodeURIComponent(BUILD)).then(function (f) { frags = f; return f; }); }
  function col(id) { return meta && meta.colognes.find(function (c) { return c.id === id; }); }
  function bucket(r) { if (r == null) return "Not rated"; r = +r; return r >= 9 ? "9 \u2013 10" : r >= 8 ? "8 \u2013 8.99" : r >= 7 ? "7 \u2013 7.99" : r >= 6 ? "6 \u2013 6.99" : "Below 6"; }

  // ------------------------------------------------------------------ overlay
  function pendingOf(doc) {
    var out = { colognes: {}, featured: {} }, ap = (meta && meta.applied) || {};
    var apc = ap.colognes || {}, apf = ap.featured || {};
    if (!doc) return out;
    Object.keys(doc.colognes || {}).forEach(function (id) {
      var rec = doc.colognes[id], seen = apc[id] || {}, o = {};
      if ("randy_rating" in rec && newer(rec.randy_rating_at, seen.randy_rating_at)) o.r = rec.randy_rating;
      if ("comment" in rec && newer(rec.comment_at, seen.comment_at)) o.comment = rec.comment;
      if (Object.keys(o).length) out.colognes[id] = o;
    });
    Object.keys(doc.featured || {}).forEach(function (d) {
      var rec = doc.featured[d];
      if (newer(rec.at, apf[d])) { var o = {}; SLOTS.forEach(function (s) { if (s[0] in rec) o[s[0]] = rec[s[0]]; }); out.featured[d] = o; }
    });
    return out;
  }

  function setStars(box, r, before) {
    var st = box.querySelector(".stars");
    if (!st) { st = document.createElement("span"); st.className = "stars"; st.setAttribute("aria-hidden", "true"); st.appendChild(document.createElement("span")); box.insertBefore(st, before || null); }
    st.firstChild.style.width = Math.max(0, Math.min(100, r * 10)).toFixed(1) + "%";
  }

  function applyRating(id, r) {
    var c = col(id); if (!c || c.enh) return;
    var R = null, N = null;
    if (c.p != null && c.p !== "") { R = r3(r * c.w_r + c.p * c.w_p); N = c.rmax ? r3(R / c.rmax) : null; }
    c.r = r;
    qsa('[data-rr="' + id + '"]').forEach(function (el) { var b = el.querySelector("b"); setStars(el, r, b); b.textContent = fmt(r); });
    qsa('[data-rn="' + id + '"]').forEach(function (el) { el.textContent = fmtn(N); });
    qsa('[data-rnbar="' + id + '"] span').forEach(function (el) { el.style.width = ((N || 0) * 100).toFixed(1) + "%"; });
    qsa('li[data-id="' + id + '"]').forEach(function (li) { li.dataset.r = r; li.dataset.n = N == null ? -1 : N; li.dataset.rb = bucket(r); });
    qsa('[data-scores="' + id + '"]').forEach(function (el) {
      var b = el.querySelectorAll(".score");
      if (b[0]) { b[0].querySelector(".sval").innerHTML = fmt(r) + "<small>/10</small>"; setStars(b[0], r, null); }
      if (b[2]) b[2].querySelector(".sval").innerHTML = fmt(R) + "<small>/" + fmt(c.rmax) + "</small>";
      if (b[3]) { b[3].querySelector(".sval").textContent = fmtn(N); var nb = b[3].querySelector(".nbar span"); if (nb) nb.style.width = ((N || 0) * 100).toFixed(1) + "%"; }
    });
    if (R != null) qsa('[data-calc="' + id + '"]').forEach(function (el) {
      el.innerHTML = "R = " + fmt(r) + " \u00d7 " + fmt(c.w_r) + " + " + fmt(c.p) + " \u00d7 " + fmt(c.w_p) + " = <b>" + fmt(R) + "</b> of " + fmt(c.rmax) +
        " &nbsp;\u00b7&nbsp; N = " + fmt(R) + " \u00f7 " + fmt(c.rmax) + " = <b>" + fmtn(N) + '</b> <a href="' + ROOT + 'rating-formula/">How scores work</a>';
    });
    var cal = window.TaragaCal;
    if (cal) Object.keys(cal.data).forEach(function (d) { var rec = cal.data[d]; Object.keys(rec).forEach(function (s) { (rec[s].layer || [rec[s]]).forEach(function (p) { if (p.id === id) p.r = r; }); }); });
  }

  function applyComment(id, text) {
    var c = col(id); if (c) c.comment = text;
    qsa('[data-comment="' + id + '"]').forEach(function (el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (!(n.nodeType === 1 && n.classList.contains("clbl"))) el.removeChild(n); });
      el.appendChild(document.createTextNode(text));
      el.hidden = !text;
    });
  }

  function dayHtml(day) {
    var F = frags.items, hero = "", rest = [];
    SLOTS.forEach(function (s) {
      var key = s[0], label = s[1], list = ids(day[key]).filter(function (id) { return F[id]; }), its = list.map(function (id) { return F[id]; });
      if (!its.length) return;
      if (key === "day") {
        if (its.length === 1) { hero = its[0].hero; return; }
        hero = '<article class="fhero layered"><div class="fhero-label">Cologne of the Day <span class="layer-tag">Layered</span></div><h2 class="fhero-combo">' +
          list.map(function (id, i) { return '<a href="__ROOT__fragrances/' + id + '/">' + its[i].name + "</a>"; }).join(' <span class="plus">+</span> ') +
          '</h2><div class="fhero-layers n' + its.length + '">' + its.map(function (x) { return x.panel_rich; }).join("") + "</div></article>";
        return;
      }
      rest.push(its.length === 1 ? its[0].small[key] : '<article class="feat feat-' + key + ' layered"><div class="feat-label">' + label +
        ' <span class="layer-tag">Layered</span></div><div class="feat-layers n' + its.length + '">' + its.map(function (x) { return x.panel; }).join("") + "</div></article>");
    });
    var html = hero + (rest.length ? '<div class="feat-sub n' + rest.length + '">' + rest.join("") + "</div>" : "");
    return (html || frags.empty).split("__ROOT__").join(ROOT);
  }

  function stripHtml(day) {
    var F = frags.items, out = [];
    SLOTS.forEach(function (s) {
      var its = ids(day[s[0]]).map(function (id) { return F[id]; }).filter(Boolean);
      var imgs = its.map(function (x, i) { return (i ? '<span class="fs-plus" aria-hidden="true">+</span>' : "") + x.strip.img; }).join("");
      if (!its.some(function (x) { return x.strip.img; })) return;
      var layered = its.length > 1, marks = "";
      if (its.some(function (x) { return x.strip.marks.indexOf("fs-new") >= 0; })) marks += ' <em class="fs-new"><span class="star" aria-hidden="true">\u2726</span>New</em>';
      if (its.some(function (x) { return x.strip.marks.indexOf("fs-sig") >= 0; })) marks += ' <em class="fs-sig">\u2605 Signature</em>';
      out.push('<span class="fs-pick' + (layered ? " layered" : "") + '"><span class="fs-thumbs">' + imgs + "</span><span><small>" + s[1] + (layered ? " \u00b7 Layered" : "") +
        "</small>" + its.map(function (x) { return x.strip.name; }).join(" + ") + marks + "</span></span>");
    });
    var html = out.length ? '<span class="fs-picks">' + out.join("") + "</span>" : '<span class="fs-soon">Today\u2019s picks are coming soon</span>';
    return html.split("__ROOT__").join(ROOT);
  }

  function longDate(iso) { var d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }

  function applyFeatured(date, slots) {
    var base = (meta.featured || {})[date] || { day: null, gym: null, sleep: null }, day = {};
    SLOTS.forEach(function (s) { day[s[0]] = s[0] in slots ? slots[s[0]] : base[s[0]]; });
    meta.featured[date] = day;
    var F = frags.items;
    if (date === nyToday()) {
      var fp = document.getElementById("featPicks");
      if (fp) { fp.innerHTML = dayHtml(day); fp.dataset.date = date; var fd = document.getElementById("featDate"); if (fd) fd.textContent = longDate(date); }
      var inner = document.querySelector(".fstrip .fs-picks, .fstrip .fs-soon");
      if (inner) { var t = document.createElement("span"); t.innerHTML = stripHtml(day); inner.parentNode.replaceChild(t.firstChild, inner); var sd = document.getElementById("fsDate"); if (sd) sd.textContent = longDate(date); }
    }
    var cal = window.TaragaCal;
    if (cal) {
      var rec = {};
      SLOTS.forEach(function (s) { var its = ids(day[s[0]]).map(function (id) { return F[id] && F[id].cal; }).filter(Boolean); if (its.length === 1) rec[s[0]] = its[0]; else if (its.length) rec[s[0]] = { layer: its }; });
      if (Object.keys(rec).length) cal.data[date] = rec; else delete cal.data[date];
    }
  }

  function currentDoc(remote) {
    var local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); } catch (e) {}
    if (local && (Date.now() - local.saved > 15 * 60 * 1000 || (remote && remote.updated_at >= local.doc.updated_at))) { localStorage.removeItem(LOCAL_KEY); local = null; }
    return local ? local.doc : remote;
  }

  function overlay() {
    return getJSON(ROOT + "data/edits.json?t=" + Date.now()).then(function (remote) {
      var doc = currentDoc(remote);
      if (!doc) return;
      return loadMeta().then(function () {
        if (!meta) return;
        var p = pendingOf(doc), dates = Object.keys(p.featured);
        var go = dates.length ? loadFrags() : Promise.resolve(null);
        return go.then(function () {
          if (frags) dates.forEach(function (d) { applyFeatured(d, p.featured[d]); });
          Object.keys(p.colognes).forEach(function (id) { var o = p.colognes[id]; if ("r" in o) applyRating(id, o.r); if ("comment" in o) applyComment(id, o.comment); });
          if (window.TaragaCal) window.TaragaCal.refresh();
        });
      });
    });
  }

  // ------------------------------------------------------------------ editor
  var CSS = ".ed-back{position:fixed;inset:0;background:rgba(20,33,61,.45);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px;overflow:auto}" +
    ".ed-box{background:#fff;border-radius:6px;max-width:560px;width:100%;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:14px/1.5 var(--sans,system-ui)}" +
    ".ed-box h2{font-family:var(--serif,Georgia);margin:0 0 6px;font-size:26px;color:var(--navy,#14213d)}.ed-x{float:right;border:0;background:none;font-size:22px;cursor:pointer;line-height:1}" +
    ".ed-box label{display:block;font-weight:600;margin:12px 0 4px}.ed-box input,.ed-box select,.ed-box textarea{width:100%;font:inherit;padding:8px 10px;border:1px solid #cfcbc2;border-radius:3px;background:#fff}" +
    ".ed-box textarea{min-height:90px;resize:vertical}.ed-pin{letter-spacing:.6em;font-size:22px!important;text-align:center;max-width:180px}" +
    ".ed-row{display:flex;gap:8px}.ed-row>*{flex:1}.ed-tabs{display:flex;gap:6px;margin:10px 0 4px;border-bottom:1px solid #e6e4df}" +
    ".ed-tabs button{border:0;background:none;padding:8px 10px;cursor:pointer;font:inherit;border-bottom:2px solid transparent}.ed-tabs button.on{border-color:var(--gold,#b8913f);font-weight:600}" +
    ".ed-btn{margin-top:14px;background:var(--navy,#14213d);color:#fff;border:0;border-radius:3px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}.ed-btn[disabled]{opacity:.5}" +
    ".ed-link{border:0;background:none;color:var(--muted,#6b6b74);text-decoration:underline;cursor:pointer;font:inherit;padding:0}" +
    ".ed-msg{margin-top:10px;min-height:1.5em}.ed-msg.err{color:#a3271c}.ed-msg.ok{color:#2c6e3a}.ed-hint{color:var(--muted,#6b6b74);font-size:12.5px;margin:4px 0 0}" +
    ".edit-foot{margin:8px 0 0;font-size:12px}.edit-foot a{color:var(--muted,#6b6b74);text-decoration:underline}";

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "text") e.textContent = attrs[k]; else if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { if (k) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return e;
  }
  function token() {
    try { var t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null"); if (t && Date.parse(t.expires_at) > Date.now() + 30000) return t.token; } catch (e) {}
    sessionStorage.removeItem(TOKEN_KEY); return "";
  }
  function post(path, body, tok) {
    var h = { "Content-Type": "application/json" }; if (tok) h.Authorization = "Bearer " + tok;
    return fetch(API + path, { method: "POST", headers: h, body: JSON.stringify(body), mode: "cors", credentials: "omit" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { status: 0, error: "Could not reach the editor. Check your connection and try again." }; });
  }

  var back = null;
  function close() { if (back) { back.remove(); back = null; } if (location.hash === "#edit") history.replaceState(null, "", location.pathname + location.search); }
  function open() {
    if (!document.getElementById("edCss")) document.head.appendChild(el("style", { id: "edCss", text: CSS }));
    close();
    back = el("div", { class: "ed-back", role: "dialog", "aria-modal": "true", "aria-label": "Edit the site" });
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
    if (token()) panel(); else pinForm();
  }
  function box(title) {
    back.innerHTML = "";
    var b = el("div", { class: "ed-box" }, [el("button", { class: "ed-x", type: "button", "aria-label": "Close", text: "\u00d7" }), el("h2", { text: title })]);
    b.firstChild.onclick = close; back.appendChild(b); return b;
  }

  function pinForm(msg) {
    var b = box("Sign in to edit");
    var inp = el("input", { class: "ed-pin", type: "password", inputmode: "numeric", pattern: "[0-9]*", maxlength: "4", autocomplete: "off", "aria-label": "4-digit PIN" });
    var m = el("div", { class: "ed-msg" + (msg ? " err" : ""), text: msg || "" });
    var btn = el("button", { class: "ed-btn", type: "submit", text: "Sign in" });
    var f = el("form", {}, [el("label", { text: "Your 4-digit PIN" }), inp, btn, m]);
    f.onsubmit = function (e) {
      e.preventDefault();
      if (!/^\d{4}$/.test(inp.value)) { m.className = "ed-msg err"; m.textContent = "Enter the 4 digits."; return; }
      btn.disabled = true; m.className = "ed-msg"; m.textContent = "Checking\u2026";
      post("/api/login", { pin: inp.value }).then(function (j) {
        btn.disabled = false; inp.value = "";
        if (j.status === 200 && j.token) { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: j.token, expires_at: j.expires_at })); panel(); }
        else { m.className = "ed-msg err"; m.textContent = j.error || "Sign-in failed."; inp.focus(); }
      });
    };
    b.appendChild(f); inp.focus();
  }

  function options(sel, list, blank) {
    sel.innerHTML = "";
    if (blank) sel.appendChild(el("option", { value: "", text: blank }));
    list.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.house + " \u2014 " + c.name + (c.enh ? " (enhancer)" : "") })); });
  }

  function panel() {
    var b = box("Edit the site");
    var msg = el("div", { class: "ed-msg" });
    var out = el("button", { class: "ed-link", type: "button", text: "Sign out" });
    out.onclick = function () { sessionStorage.removeItem(TOKEN_KEY); close(); };
    var tR = el("button", { type: "button", class: "on", text: "Ratings & notes" }), tF = el("button", { type: "button", text: "Today\u2019s Featured" });
    var body = el("div");
    b.appendChild(el("div", { class: "ed-tabs" }, [tR, tF]));
    b.appendChild(body); b.appendChild(msg); b.appendChild(el("p", { class: "ed-hint" }, [out]));
    function say(t, kind) { msg.className = "ed-msg" + (kind ? " " + kind : ""); msg.textContent = t; }
    function save(payload, btn) {
      var tok = token(); if (!tok) { pinForm("Your session ended. Please sign in again."); return; }
      btn.disabled = true; say("Saving\u2026");
      post("/api/edit", payload, tok).then(function (j) {
        btn.disabled = false;
        if (j.status === 401) { sessionStorage.removeItem(TOKEN_KEY); pinForm(j.error || "Please sign in again."); return; }
        if (j.status !== 200) { say(j.error || "Saving failed.", "err"); return; }
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ doc: j.edits, saved: Date.now() }));
        say("Saved. It shows here now, and for everyone in about 1\u20132 minutes.", "ok");
        overlay();
      });
    }
    loadMeta().then(function () {
      if (!meta) { say("Could not load the fragrance list. Reload the page and try again.", "err"); return; }
      function ratings() {
        tR.className = "on"; tF.className = ""; body.innerHTML = ""; say("");
        var filt = el("input", { type: "search", placeholder: "Filter by name or house" });
        var sel = el("select", { "aria-label": "Fragrance" });
        var rate = el("input", { type: "number", min: "1", max: "10", step: "0.25", inputmode: "decimal" });
        var com = el("textarea", { maxlength: "600" });
        var btn = el("button", { class: "ed-btn", type: "button", text: "Save" });
        var all = meta.colognes.slice();
        function fill() { var q = filt.value.toLowerCase(), cur = sel.value; options(sel, all.filter(function (c) { return !q || (c.house + " " + c.name).toLowerCase().indexOf(q) >= 0; })); if (cur) sel.value = cur; show(); }
        function show() { var c = col(sel.value); if (!c) return; rate.value = c.r == null ? "" : c.r; rate.disabled = !!c.enh; com.value = c.comment || ""; }
        filt.oninput = fill; sel.onchange = show;
        btn.onclick = function () {
          var c = col(sel.value); if (!c) return;
          var rec = {}, v = rate.value.trim();
          if (!c.enh && v !== "" && +v !== c.r) {
            var r = +v; if (!(r >= 1 && r <= 10) || Math.round(r * 4) !== r * 4) { say("Rating must be 1 to 10 in steps of 0.25.", "err"); return; }
            rec.randy_rating = r;
          }
          if (com.value.trim() !== (c.comment || "")) rec.comment = com.value.trim();
          if (!Object.keys(rec).length) { say("Nothing changed."); return; }
          var p = { colognes: {} }; p.colognes[c.id] = rec; save(p, btn);
        };
        body.appendChild(el("label", { text: "Fragrance" })); body.appendChild(filt); body.appendChild(el("div", { style: "height:6px" })); body.appendChild(sel);
        body.appendChild(el("label", { text: "Your rating (1\u201310, steps of 0.25)" })); body.appendChild(rate);
        body.appendChild(el("label", { text: "Your notes" })); body.appendChild(com);
        body.appendChild(el("p", { class: "ed-hint", text: "Shown publicly on the site as \u201cRandy\u2019s notes\u201d. R and N update from your rating automatically." }));
        body.appendChild(btn);
        fill();
        var m = /\/fragrances\/([^/]+)\//.exec(location.pathname); if (m && col(m[1])) { sel.value = m[1]; show(); }
      }
      function featured() {
        tF.className = "on"; tR.className = ""; body.innerHTML = ""; say("");
        var owned = meta.colognes.filter(function (c) { return c.status === "owned"; });
        var date = el("input", { type: "date", value: nyToday() });
        var btn = el("button", { class: "ed-btn", type: "button", text: "Save picks" });
        var rows = {};
        body.appendChild(el("label", { text: "Date" })); body.appendChild(date);
        SLOTS.forEach(function (s) {
          var a = el("select", { "aria-label": s[1] }), l = el("select", { "aria-label": s[1] + " layered with" });
          options(a, owned.filter(function (c) { return !c.enh; }), "\u2014 none \u2014"); options(l, owned, "+ layer with\u2026 (optional)");
          rows[s[0]] = [a, l];
          body.appendChild(el("label", { text: s[1] })); body.appendChild(el("div", { class: "ed-row" }, [a, l]));
        });
        function load() {
          var day = (meta.featured || {})[date.value] || {};
          SLOTS.forEach(function (s) { var v = ids(day[s[0]]); rows[s[0]][0].value = v[0] || ""; rows[s[0]][1].value = v[1] || ""; });
        }
        date.onchange = load; load();
        btn.onclick = function () {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { say("Pick a date.", "err"); return; }
          var rec = {};
          SLOTS.forEach(function (s) {
            var a = rows[s[0]][0].value, l = rows[s[0]][1].value;
            rec[s[0]] = !a ? null : l && l !== a ? [a, l] : a;
          });
          var p = { featured: {} }; p.featured[date.value] = rec; save(p, btn);
        };
        body.appendChild(el("p", { class: "ed-hint", text: "Owned bottles only. Empty slots are hidden on the page." }));
        body.appendChild(btn);
      }
      tR.onclick = ratings; tF.onclick = featured; ratings();
    });
  }

  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("[data-edit-open]"); if (a) { e.preventDefault(); open(); } });
  window.addEventListener("hashchange", function () { if (location.hash === "#edit") open(); });
  if (location.hash === "#edit") open();
  overlay();
  window.TaragaEdits = { overlay: overlay, open: open };
})();

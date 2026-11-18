(function () {
  "use strict";

  /* Pure synchronous UTF-8 SHA-256 (zero external dependencies, works in <head>) */
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 0x3f),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f)
        );
      }
    }
    return out;
  }

  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rrot(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256(str) {
    var msg = utf8Bytes(String(str));
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    msg.push(
      (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
      (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff
    );

    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = new Array(64);

    for (var i = 0; i < msg.length; i += 64) {
      for (var t = 0; t < 16; t++) {
        var j = i + t * 4;
        W[t] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
      }
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = (rrot(W[t2 - 15], 7) ^ rrot(W[t2 - 15], 18) ^ (W[t2 - 15] >>> 3)) >>> 0;
        var s1 = (rrot(W[t2 - 2], 17) ^ rrot(W[t2 - 2], 19) ^ (W[t2 - 2] >>> 10)) >>> 0;
        W[t2] = (W[t2 - 16] + s0 + W[t2 - 7] + s1) >>> 0;
      }

      var a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
      for (var r = 0; r < 64; r++) {
        var S1 = (rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var temp1 = (h + S1 + ch + K256[r] + W[r]) >>> 0;
        var S0 = (rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
      H5 = (H5 + f) >>> 0;
      H6 = (H6 + g) >>> 0;
      H7 = (H7 + h) >>> 0;
    }

    function hex32(n) {
      return ("00000000" + (n >>> 0).toString(16)).slice(-8);
    }
    return hex32(H0) + hex32(H1) + hex32(H2) + hex32(H3) + hex32(H4) + hex32(H5) + hex32(H6) + hex32(H7);
  }

  var SALT_PREFIX = "medmrf-portal-v1:";
  var STORAGE_PREFIX = "medmrf_proj_unlock_v1_";
  var memStore = {};

  var PROJECTS = {
    bullying: {
      id: "bullying",
      title: "التنمّر من منظور علم النفس",
      subtitle: "أدخل الرقم السري الخاص بهذا المشروع لاستعراض النسخ التفاعلية",
      accent: "#38bdf8",
      hash: "2f37f99add778e3be24b3e5a7c133cc221e08a39f83e3a59b43f12853ede1c4e"
    },
    qabas: {
      id: "qabas",
      title: "موسوعة واستوديو شرح قبس النور المبين",
      subtitle: "أدخل الرقم السري الخاص بدروس القبس لفتح الموسوعة والاستوديو",
      accent: "#f59e0b",
      hash: "2a0cdf6374d3db420a47f284a8eeb8b9fb3a36134eeaa32be74232968a548a41"
    }
  };

  function getSavedToken(projectId) {
    try {
      var val = sessionStorage.getItem(STORAGE_PREFIX + projectId);
      if (val) return val;
    } catch (e) {}
    return memStore[projectId] || "";
  }

  function setSavedToken(projectId, token) {
    memStore[projectId] = token;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + projectId, token);
    } catch (e) {}
  }

  function clearSavedToken(projectId) {
    delete memStore[projectId];
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + projectId);
    } catch (e) {}
  }

  function isUnlocked(projectId) {
    var cfg = PROJECTS[projectId];
    if (!cfg) return true;
    return getSavedToken(projectId) === cfg.hash;
  }

  function verifyAndUnlock(projectId, rawPasscode) {
    var cfg = PROJECTS[projectId];
    if (!cfg) return false;
    var normalized = String(rawPasscode == null ? "" : rawPasscode).trim().toLowerCase();
    if (!normalized) return false;
    var digest = sha256(SALT_PREFIX + projectId + ":" + normalized);
    if (digest === cfg.hash) {
      setSavedToken(projectId, digest);
      return true;
    }
    return false;
  }

  function lockProject(projectId) {
    clearSavedToken(projectId);
  }

  function lockAll() {
    Object.keys(PROJECTS).forEach(clearSavedToken);
  }

  function anyUnlocked() {
    return Object.keys(PROJECTS).some(isUnlocked);
  }

  var GATE_STYLES = [
    "html[data-project-locked='true'], html[data-project-locked='true'] body {",
    "  overflow: hidden !important;",
    "}",
    "html[data-project-locked='true'] body > *:not(#project-auth-gate) {",
    "  visibility: hidden !important;",
    "  opacity: 0 !important;",
    "  pointer-events: none !important;",
    "}",
    "#project-auth-gate, #project-auth-modal {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 2147483000;",
    "  display: flex;",
    "  align-items: safe center;",
    "  justify-content: center;",
    "  overflow-y: auto;",
    "  -webkit-overflow-scrolling: touch;",
    "  padding: max(1rem, env(safe-area-inset-top, 1rem)) max(1rem, env(safe-area-inset-right, 1rem)) max(1.25rem, env(safe-area-inset-bottom, 1.25rem)) max(1rem, env(safe-area-inset-left, 1rem));",
    "  direction: rtl;",
    "  font-family: 'IBM Plex Sans Arabic', 'Readex Pro', system-ui, -apple-system, sans-serif;",
    "  background: radial-gradient(ellipse 80% 55% at 50% 0%, rgba(56, 189, 248, 0.14), transparent 70%), #080b11;",
    "  color: #f8fafc;",
    "  -webkit-font-smoothing: antialiased;",
    "  transition: opacity 0.26s ease, visibility 0.26s ease;",
    "}",
    "#project-auth-modal {",
    "  background: rgba(6, 9, 15, 0.80);",
    "  backdrop-filter: blur(18px) saturate(150%);",
    "  -webkit-backdrop-filter: blur(18px) saturate(150%);",
    "}",
    "html[data-theme='light'] #project-auth-gate, html[data-theme='stone'] #project-auth-gate, html[data-theme='paper'] #project-auth-gate, html[data-theme='linen'] #project-auth-gate, #project-auth-gate[data-gate-theme='light'] {",
    "  background: radial-gradient(ellipse 80% 55% at 50% 0%, rgba(2, 132, 199, 0.11), transparent 70%), #f5f3ee;",
    "  color: #0f172a;",
    "}",
    "html[data-theme='light'] #project-auth-modal, html[data-theme='stone'] #project-auth-modal, html[data-theme='paper'] #project-auth-modal, html[data-theme='linen'] #project-auth-modal {",
    "  background: rgba(15, 23, 42, 0.48);",
    "}",
    "#project-auth-gate.is-unlocking, #project-auth-modal.is-closing {",
    "  opacity: 0;",
    "  visibility: hidden;",
    "  pointer-events: none;",
    "}",
    ".pg-card {",
    "  width: min(420px, 100%);",
    "  margin: auto 0;",
    "  padding: clamp(1.35rem, 4vw, 1.85rem);",
    "  border-radius: 24px;",
    "  background: rgba(16, 22, 35, 0.92);",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10), 0 26px 64px rgba(0, 0, 0, 0.55);",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: center;",
    "  text-align: center;",
    "  gap: 0.9rem;",
    "  animation: pgCardIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;",
    "}",
    "html[data-theme='light'] .pg-card, html[data-theme='stone'] .pg-card, html[data-theme='paper'] .pg-card, html[data-theme='linen'] .pg-card, #project-auth-gate[data-gate-theme='light'] .pg-card {",
    "  background: rgba(255, 255, 255, 0.97);",
    "  border-color: rgba(15, 23, 42, 0.12);",
    "  color: #0f172a;",
    "  box-shadow: inset 0 1px 0 #ffffff, 0 22px 54px rgba(15, 23, 42, 0.16);",
    "}",
    "@keyframes pgCardIn {",
    "  0% { opacity: 0; transform: translateY(12px) scale(0.96); }",
    "  100% { opacity: 1; transform: translateY(0) scale(1); }",
    "}",
    "@keyframes pgShake {",
    "  0%, 100% { transform: translateX(0); }",
    "  20% { transform: translateX(-8px); }",
    "  40% { transform: translateX(8px); }",
    "  60% { transform: translateX(-5px); }",
    "  80% { transform: translateX(5px); }",
    "}",
    ".pg-card.is-shaking {",
    "  animation: pgShake 0.36s ease;",
    "}",
    ".pg-icon-ring {",
    "  width: 56px;",
    "  height: 56px;",
    "  border-radius: 18px;",
    "  display: grid;",
    "  place-items: center;",
    "  background: rgba(56, 189, 248, 0.14);",
    "  border: 1.5px solid var(--pg-accent, #38bdf8);",
    "  color: var(--pg-accent, #38bdf8);",
    "  box-shadow: 0 0 26px rgba(56, 189, 248, 0.18);",
    "}",
    ".pg-badge {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 0.35rem;",
    "  padding: 0.24rem 0.72rem;",
    "  border-radius: 999px;",
    "  font-size: 0.75rem;",
    "  font-weight: 700;",
    "  background: rgba(255, 255, 255, 0.06);",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "  color: #cbd5e1;",
    "}",
    "html[data-theme='light'] .pg-badge, html[data-theme='stone'] .pg-badge, html[data-theme='paper'] .pg-badge, html[data-theme='linen'] .pg-badge, #project-auth-gate[data-gate-theme='light'] .pg-badge {",
    "  background: rgba(15, 23, 42, 0.05);",
    "  border-color: rgba(15, 23, 42, 0.12);",
    "  color: #475569;",
    "}",
    ".pg-title {",
    "  margin: 0;",
    "  font-size: clamp(1.15rem, 3.6vw, 1.35rem);",
    "  font-weight: 800;",
    "  line-height: 1.35;",
    "}",
    ".pg-sub {",
    "  margin: 0;",
    "  font-size: 0.88rem;",
    "  line-height: 1.6;",
    "  color: #94a3b8;",
    "}",
    "html[data-theme='light'] .pg-sub, html[data-theme='stone'] .pg-sub, html[data-theme='paper'] .pg-sub, html[data-theme='linen'] .pg-sub, #project-auth-gate[data-gate-theme='light'] .pg-sub {",
    "  color: #64748b;",
    "}",
    ".pg-form {",
    "  width: 100%;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 0.72rem;",
    "  margin-top: 0.2rem;",
    "}",
    ".pg-field-wrap {",
    "  position: relative;",
    "  width: 100%;",
    "  display: flex;",
    "  align-items: center;",
    "}",
    ".pg-input {",
    "  width: 100%;",
    "  height: 50px;",
    "  padding: 0 2.8rem;",
    "  border-radius: 14px;",
    "  border: 1.5px solid rgba(255, 255, 255, 0.16);",
    "  background: rgba(8, 11, 18, 0.75);",
    "  color: #f8fafc;",
    "  font-size: 16px;", /* 16px prevents iOS Safari viewport auto-zoom! */
    "  font-weight: 700;",
    "  text-align: center;",
    "  direction: ltr;",
    "  outline: none;",
    "  transition: border-color 0.2s ease, box-shadow 0.2s ease;",
    "}",
    ".pg-input:placeholder-shown {",
    "  direction: rtl;",
    "}",
    "html[data-theme='light'] .pg-input, html[data-theme='stone'] .pg-input, html[data-theme='paper'] .pg-input, html[data-theme='linen'] .pg-input, #project-auth-gate[data-gate-theme='light'] .pg-input {",
    "  background: #f8fafc;",
    "  border-color: rgba(15, 23, 42, 0.18);",
    "  color: #0f172a;",
    "}",
    ".pg-input:focus {",
    "  border-color: var(--pg-accent, #38bdf8);",
    "  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.20);",
    "}",
    ".pg-input.is-error {",
    "  border-color: #f43f5e;",
    "  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.20);",
    "}",
    ".pg-eye-btn {",
    "  position: absolute;",
    "  left: 8px;",
    "  width: 36px;",
    "  height: 36px;",
    "  border-radius: 10px;",
    "  border: none;",
    "  background: transparent;",
    "  color: #94a3b8;",
    "  display: grid;",
    "  place-items: center;",
    "  cursor: pointer;",
    "  -webkit-tap-highlight-color: transparent;",
    "}",
    ".pg-eye-btn:hover {",
    "  color: var(--pg-accent, #38bdf8);",
    "}",
    ".pg-error-msg {",
    "  min-height: 1.25rem;",
    "  margin: -0.2rem 0 0;",
    "  font-size: 0.82rem;",
    "  font-weight: 700;",
    "  color: #fb7185;",
    "}",
    "html[data-theme='light'] .pg-error-msg, html[data-theme='stone'] .pg-error-msg, html[data-theme='paper'] .pg-error-msg, html[data-theme='linen'] .pg-error-msg, #project-auth-gate[data-gate-theme='light'] .pg-error-msg {",
    "  color: #e11d48;",
    "}",
    ".pg-submit-btn {",
    "  width: 100%;",
    "  min-height: 48px;",
    "  padding: 0.65rem 1.2rem;",
    "  border-radius: 14px;",
    "  border: 1px solid var(--pg-accent, #38bdf8);",
    "  background: var(--pg-accent, #38bdf8);",
    "  color: #06101d;",
    "  font-family: inherit;",
    "  font-size: 0.95rem;",
    "  font-weight: 800;",
    "  cursor: pointer;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 0.5rem;",
    "  -webkit-tap-highlight-color: transparent;",
    "  transition: transform 0.18s ease, filter 0.18s ease;",
    "}",
    ".pg-submit-btn:hover {",
    "  filter: brightness(1.07);",
    "  transform: translateY(-1px);",
    "}",
    ".pg-submit-btn:active {",
    "  transform: translateY(0) scale(0.99);",
    "}",
    ".pg-secondary-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 0.4rem;",
    "  min-height: 40px;",
    "  padding: 0.4rem 0.95rem;",
    "  border-radius: 999px;",
    "  border: 1px solid rgba(148, 163, 184, 0.24);",
    "  background: transparent;",
    "  color: inherit;",
    "  opacity: 0.82;",
    "  text-decoration: none;",
    "  font-family: inherit;",
    "  font-size: 0.82rem;",
    "  font-weight: 700;",
    "  cursor: pointer;",
    "  transition: opacity 0.2s ease, border-color 0.2s ease;",
    "}",
    ".pg-secondary-btn:hover {",
    "  opacity: 1;",
    "  border-color: var(--pg-accent, #38bdf8);",
    "}",
    "@media (max-height: 500px) {",
    "  #project-auth-gate, #project-auth-modal {",
    "    padding: 0.55rem 0.85rem;",
    "  }",
    "  .pg-card {",
    "    padding: 0.9rem 1.1rem;",
    "    gap: 0.42rem;",
    "    border-radius: 18px;",
    "  }",
    "  .pg-icon-ring {",
    "    width: 38px;",
    "    height: 38px;",
    "    border-radius: 12px;",
    "  }",
    "  .pg-icon-ring svg { width: 20px; height: 20px; }",
    "  .pg-sub { display: none; }",
    "  .pg-title { font-size: 1.02rem; }",
    "  .pg-form { gap: 0.42rem; margin-top: 0.1rem; }",
    "  .pg-input { height: 42px; border-radius: 11px; }",
    "  .pg-error-msg { min-height: 0; margin: 0; font-size: 0.76rem; }",
    "  .pg-submit-btn { min-height: 40px; padding: 0.45rem 1rem; border-radius: 11px; font-size: 0.88rem; }",
    "  .pg-secondary-btn { min-height: 32px; padding: 0.25rem 0.75rem; font-size: 0.76rem; }",
    "}"
  ].join("\n");

  function ensureGateStyles() {
    if (document.getElementById("project-gate-styles")) return;
    var st = document.createElement("style");
    st.id = "project-gate-styles";
    st.textContent = GATE_STYLES;
    (document.head || document.documentElement).appendChild(st);
  }

  function buildGateCardMarkup(cfg, secondaryHtml) {
    return (
      '<div class="pg-card" style="--pg-accent:' + cfg.accent + ';">' +
        '<div class="pg-icon-ring" aria-hidden="true">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="4" y="11" width="16" height="10" rx="2.5"></rect>' +
            '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path>' +
            '<circle cx="12" cy="16" r="1.4" fill="currentColor"></circle>' +
          '</svg>' +
        '</div>' +
        '<span class="pg-badge">مشروع محمي برقم سري</span>' +
        '<h2 class="pg-title">' + cfg.title + '</h2>' +
        '<p class="pg-sub">' + cfg.subtitle + '</p>' +
        '<form class="pg-form" autocomplete="off" novalidate>' +
          '<div class="pg-field-wrap">' +
            '<input type="password" class="pg-input" placeholder="الرقم السري..." aria-label="الرقم السري" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" required />' +
            '<button type="button" class="pg-eye-btn" title="إظهار / إخفاء الرقم السري" aria-label="إظهار أو إخفاء الرقم السري">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
                '<circle cx="12" cy="12" r="3"></circle>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="pg-error-msg" role="alert" aria-live="assertive"></div>' +
          '<button type="submit" class="pg-submit-btn">' +
            '<span>فتح المشروع</span>' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<line x1="19" y1="12" x2="5" y2="12"></line>' +
              '<polyline points="12 19 5 12 12 5"></polyline>' +
            '</svg>' +
          '</button>' +
        '</form>' +
        secondaryHtml +
      '</div>'
    );
  }

  function wireCardBehavior(hostEl, projectId, onUnlocked, onCancel) {
    var card = hostEl.querySelector(".pg-card");
    var form = hostEl.querySelector(".pg-form");
    var input = hostEl.querySelector(".pg-input");
    var eyeBtn = hostEl.querySelector(".pg-eye-btn");
    var errEl = hostEl.querySelector(".pg-error-msg");
    var cancelBtn = hostEl.querySelector("[data-pg-cancel]");

    // Stop events inside the gate from bubbling to underlying presentation/reader engines
    ["keydown", "keyup", "keypress", "click", "touchstart", "touchend", "wheel"].forEach(function (evt) {
      hostEl.addEventListener(evt, function (e) {
        if (evt === "keydown" && e.key === "Escape" && typeof onCancel === "function") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          return;
        }
        e.stopPropagation();
      });
    });

    if (eyeBtn && input) {
      eyeBtn.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        input.focus();
      });
    }

    if (input) {
      input.addEventListener("input", function () {
        input.classList.remove("is-error");
        if (errEl) errEl.textContent = "";
      });
      setTimeout(function () {
        try { input.focus(); } catch (e) {}
      }, 40);
    }

    if (cancelBtn && typeof onCancel === "function") {
      cancelBtn.addEventListener("click", function (e) {
        e.preventDefault();
        onCancel();
      });
    }

    if (typeof onCancel === "function") {
      hostEl.addEventListener("click", function (e) {
        if (e.target === hostEl) onCancel();
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var val = input ? input.value : "";
        if (verifyAndUnlock(projectId, val)) {
          if (errEl) errEl.textContent = "";
          onUnlocked();
        } else {
          if (errEl) errEl.textContent = "الرقم السري غير صحيح، يرجى المحاولة مجدداً";
          if (input) {
            input.classList.add("is-error");
            input.select();
          }
          if (card) {
            card.classList.remove("is-shaking");
            void card.offsetWidth;
            card.classList.add("is-shaking");
          }
        }
      });
    }
  }

  /* Modal prompt used on the Root Showcase (/projects/) before navigating */
  function promptModal(projectId, onSuccess) {
    ensureGateStyles();
    if (isUnlocked(projectId)) {
      if (typeof onSuccess === "function") onSuccess();
      return;
    }
    var cfg = PROJECTS[projectId];
    if (!cfg) {
      if (typeof onSuccess === "function") onSuccess();
      return;
    }

    var existing = document.getElementById("project-auth-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.id = "project-auth-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "إدخال الرقم السري — " + cfg.title);
    modal.innerHTML = buildGateCardMarkup(
      cfg,
      '<button type="button" class="pg-secondary-btn" data-pg-cancel="1">إلغاء والعودة</button>'
    );

    function closeModal() {
      modal.classList.add("is-closing");
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 240);
    }

    document.body.appendChild(modal);
    wireCardBehavior(
      modal,
      projectId,
      function () {
        closeModal();
        if (typeof onSuccess === "function") onSuccess();
      },
      closeModal
    );
  }

  /* Full-page gate enforced automatically when data-project-id is set on the <script> tag */
  function enforcePageGate(projectId, portalUrl) {
    ensureGateStyles();
    var savedGateTheme = "";
    try {
      var savedTheme = localStorage.getItem("projects_portal_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        savedGateTheme = savedTheme;
      }
    } catch (e) {}

    if (isUnlocked(projectId)) {
      document.documentElement.removeAttribute("data-project-locked");
      return;
    }

    var cfg = PROJECTS[projectId];
    if (!cfg) return;

    document.documentElement.setAttribute("data-project-locked", "true");

    // Block capture-phase events outside the gate while locked
    function captureBlocker(e) {
      if (document.documentElement.getAttribute("data-project-locked") !== "true") return;
      var gate = document.getElementById("project-auth-gate");
      if (gate && gate.contains(e.target)) return;
      e.stopImmediatePropagation();
      if (e.type === "keydown" || e.type === "wheel") {
        e.preventDefault();
        var inp = gate && gate.querySelector(".pg-input");
        if (inp && e.type === "keydown" && e.key.length === 1) {
          try { inp.focus(); } catch (err) {}
        }
      }
    }

    ["keydown", "keyup", "keypress", "wheel"].forEach(function (evt) {
      window.addEventListener(evt, captureBlocker, true);
    });

    function mountGateOverlay() {
      if (document.getElementById("project-auth-gate")) return;
      if (!document.body) return;

      var gate = document.createElement("div");
      gate.id = "project-auth-gate";
      if (savedGateTheme) gate.setAttribute("data-gate-theme", savedGateTheme);
      gate.setAttribute("role", "dialog");
      gate.setAttribute("aria-modal", "true");
      gate.setAttribute("aria-label", "بوابة الرقم السري — " + cfg.title);

      var backHref = portalUrl || "../";
      gate.innerHTML = buildGateCardMarkup(
        cfg,
        '<a href="' + backHref + '" class="pg-secondary-btn">العودة إلى بوابة المشاريع ↩</a>'
      );

      document.body.appendChild(gate);

      wireCardBehavior(
        gate,
        projectId,
        function () {
          document.documentElement.removeAttribute("data-project-locked");
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new CustomEvent("project:unlocked", { detail: { projectId: projectId } }));
          gate.classList.add("is-unlocking");
          setTimeout(function () {
            if (gate.parentNode) gate.parentNode.removeChild(gate);
            window.dispatchEvent(new Event("resize"));
          }, 260);
        },
        null
      );
    }

    if (document.body) {
      mountGateOverlay();
    } else {
      document.addEventListener("DOMContentLoaded", mountGateOverlay);
    }
  }

  window.ProjectGate = {
    PROJECTS: PROJECTS,
    sha256: sha256,
    isUnlocked: isUnlocked,
    verifyAndUnlock: verifyAndUnlock,
    lockProject: lockProject,
    lockAll: lockAll,
    anyUnlocked: anyUnlocked,
    promptModal: promptModal,
    enforcePageGate: enforcePageGate
  };

  var currentScript = document.currentScript;
  if (currentScript) {
    var pid = currentScript.getAttribute("data-project-id");
    var purl = currentScript.getAttribute("data-portal-url") || "../";
    if (pid) {
      enforcePageGate(pid, purl);
    }
  }
})();

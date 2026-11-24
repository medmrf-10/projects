(function (globalScope) {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalScope;
  root.NeuroLab = root.NeuroLab || {};

  var CONFIG_STORAGE_KEY = "neurolab_repo_sync_cfg_v1";
  var SESSION_TOKEN_KEY = "neurolab_repo_sync_tok_session_v1";
  var CHECKINS_STORAGE_KEY = "neurolab_daily_checkins_v1";
  var NOTES_STORAGE_KEY = "neurolab_session_notes_v1";
  var MAX_CONFLICT_RETRIES = 3;

  var DEFAULT_CONFIG = {
    owner: "medmrf-10",
    repo: "zme",
    branch: "main",
    filePath: "ALL/health/psycho/LabLongitudinalLog.md",
    rememberToken: true,
    dayCondition: "normal",
    token: "",
    lastSyncedAt: null,
    lastCommitSha: null,
    syncedFingerprints: {}
  };

  var DAY_CONDITIONS = [
    { id: "normal", label: "اعتيادي" },
    { id: "rested", label: "يقظ ومرتاح" },
    { id: "fatigued", label: "إجهاد أو نقص نوم" },
    { id: "sleep_inertia", label: "جمود استيقاظ صباحي" },
    { id: "post_exercise", label: "بعد مشي أو رياضة" },
    { id: "treatment_followup", label: "متابعة علاجية" }
  ];

  var PHASE_LABELS_AR = {
    baseline: "خط الأساس القاعدي",
    sleep_inertia: "جمود الاستيقاظ الصباحي",
    post_washout: "ما بعد الغسيل الدوائي",
    metabolic: "الدعم الاستقلابي والكرياتين",
    med_early: "العلاج الدوائي المبكر",
    med_stable: "استقرار العلاج الدوائي",
    post_airway: "ما بعد إصلاح مجرى التنفس"
  };

  var V2_PROBE_META = {
    isolation: { code: "P1 · ISO", title: "العزل الانتباهي وكبح المشتتات", baseline: 13 },
    updating: { code: "P2 · UPD", title: "تحديث الذاكرة العاملة النشطة", baseline: 44 },
    gating: { code: "P3 · GAT", title: "البوابة الحسية الحركية وكبح التداخل", baseline: 18 },
    binding: { code: "P4 · BND", title: "الربط السياقي والمنطقي", baseline: 50 },
    vigilance: { code: "P5 · VIG", title: "التيقظ المستدام وعدّاد الدورة", baseline: 56 },
    control: { code: "P6 · CTL", title: "مرساة التحكم الضابطة", baseline: 98 },
    battery_v2: { code: "B6 · الشاملة", title: "البطارية الجراحية الشاملة ستة مسبارات", baseline: 36 }
  };

  var V3_PROBE_META = {
    d1_tbrs: { code: "D1 · TBRS", title: "صمود الربط تحت الحمل", unit: "%", higherIsBetter: true },
    d2_refback_m3: { code: "D2 · M3-RB", title: "التحديث السريع وبوابة المرجع", unit: "%", higherIsBetter: true },
    d3_bays_analog: { code: "D3 · Bays", title: "سعة ودقة الاتجاهات المتزامنة", unit: "", prefix: "K=", higherIsBetter: true },
    d4_consolidation_soa: { code: "D4 · SOA75", title: "سرعة التوطيد الباليستي", unit: "%", higherIsBetter: true },
    d5_pvt5: { code: "D5 · PVT-5", title: "اليقظة المستدامة خمس دقائق", unit: " s⁻¹", higherIsBetter: true }
  };

  var FALSIFY_PROBE_META = {
    f1_crossmodal: { code: "F1 · القنوات", title: "تقاطع القنوات واستقلال المسودة المكانية" },
    f2_suppression: { code: "F2 · كتم اللسان", title: "كتم اللسان الداخلي أثناء التسلسل المكاني" },
    f3_spatial_slots: { code: "F3 · الصناديق", title: "تحديث المتغيرات في الصناديق المكانية" },
    f4_polarity_axis: { code: "F4 · القطبية", title: "ضريبة قلب الصفات والمسطرة البصرية" }
  };

  var DOC_TITLE = "# السجل الطولي للبطارية النفس-فيزيائية (**LabLongitudinalLog**)";
  var METHODOLOGY_HEADING = "## منهجية التدوين والمزامنة عبر الأيام";
  var SUMMARY_HEADING = "## ملخص المسار الطولي عبر الأيام";
  var DAY_HEADING_PREFIX = "## سجل يوم ";

  var METHODOLOGY_LINES = [
    "1. يوثق هذا السجل نتائج الفحوص النفس-فيزيائية المرسلة عبر زر الحفظ من مختبر التتبع العصبي مصنفة زمنياً حسب الأيام والمراحل العلاجية لرصد التغير الموثوق عبر الزمن.",
    "2. يبدأ الترقيم من **1.** تحت كل قسم يومي مستقل بترميز **UTF-8** وأرقام مشرقية (**1, 2, 3**) وبإزاحة جدولة حقيقية (**Tab**) دون أسطر فارغة أو نقاط غير مرقمة أو جداول أو أقواس زاوية."
  ];

  var memConfig = Object.assign({}, DEFAULT_CONFIG, { syncedFingerprints: {} });
  var memCheckins = [];
  var syncInFlightPromise = null;
  var customTransport = null;
  var customApiBaseUrl = "https://api.github.com";
  var uiHooks = {
    onRefreshViews: null,
    showToast: null
  };
  var pendingSaveAfterModal = false;
  var pendingPullAfterModal = false;
  var pendingTriggerButton = null;
  var modalKeyCaptureBound = false;

  /* ================= 1. SANITIZATION, CODECS & DETERMINISTIC HASHING ================= */

  function toAsciiDigits(val) {
    return String(val == null ? "" : val).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (ch) {
      var code = ch.charCodeAt(0);
      if (code >= 0x0660 && code <= 0x0669) {
        return String.fromCharCode(code - 0x0660 + 48);
      }
      return String.fromCharCode(code - 0x06F0 + 48);
    });
  }

  function stripHiddenBidi(val) {
    return String(val == null ? "" : val).replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g, "");
  }

  function escapeHtml(str) {
    return toAsciiDigits(stripHiddenBidi(str))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeVaultText(raw, stripStars) {
    var s = stripHiddenBidi(toAsciiDigits(raw))
      .replace(/\r\n/g, " ")
      .replace(/[\r\n\t]+/g, " ");
    // Convert comparison operators before digits/letters into pure Arabic words so zero < or > ever appear
    s = s
      .replace(/<\s*(?=[0-9A-Za-z±+-])/g, "أقل من ")
      .replace(/>\s*(?=[0-9A-Za-z±+-])/g, "فوق ")
      .replace(/</g, "«")
      .replace(/>/g, "»")
      .replace(/\|/g, " / ")
      .replace(/`/g, "");
    if (stripStars !== false) {
      s = s.replace(/\*/g, "");
    }
    s = s.replace(/^(?:[-*+•▪◦‣–—]+\s+)+/, "").trim();
    if (/^[-*_•▪◦]+$/.test(s)) return "";
    return s.replace(/\s{2,}/g, " ").trim();
  }

  function ensureArabicStart(line) {
    var trimmed = String(line == null ? "" : line).trim();
    if (!trimmed) return "بيان فارغ";
    var first = trimmed.charCodeAt(0);
    var isArabic =
      (first >= 0x0600 && first <= 0x06FF) ||
      (first >= 0x0750 && first <= 0x077F) ||
      (first >= 0x08A0 && first <= 0x08FF) ||
      (first >= 0xFB50 && first <= 0xFDFF) ||
      (first >= 0xFE70 && first <= 0xFEFF);
    return isArabic ? trimmed : "بيان: " + trimmed;
  }

  function shortHash(input) {
    var str = String(input == null ? "" : input);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
  }

  function sanitizeRunKey(raw) {
    var cleaned = toAsciiDigits(String(raw == null ? "" : raw))
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
    return cleaned || "run-" + shortHash(String(Date.now()));
  }

  function fmtSignedNum(val, unit, decimals) {
    var n = Number(val);
    if (!Number.isFinite(n)) return "0" + (unit || "");
    var d = typeof decimals === "number" ? decimals : 1;
    var abs = Math.abs(n);
    var txt = Number.isInteger(abs) && d <= 1 ? String(abs) : abs.toFixed(d).replace(/\.0+$/, "");
    var sign = n > 0 ? "+" : n < 0 ? "-" : "+";
    return toAsciiDigits(sign + txt + (unit || ""));
  }

  function fmtNum(val, decimals) {
    var n = Number(val);
    if (!Number.isFinite(n)) return "0";
    var d = typeof decimals === "number" ? decimals : 1;
    if (Number.isInteger(n)) return toAsciiDigits(String(n));
    return toAsciiDigits(n.toFixed(d).replace(/\.0+$/, ""));
  }

  function utf8ToBase64(str) {
    var clean = String(str == null ? "" : str);
    if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
      var bytes = new TextEncoder().encode(clean);
      var bin = "";
      var chunk = 8192;
      for (var i = 0; i < bytes.length; i += chunk) {
        var sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
        var part = "";
        for (var j = 0; j < sub.length; j += 1) {
          part += String.fromCharCode(sub[j]);
        }
        bin += part;
      }
      return btoa(bin);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(clean, "utf8").toString("base64");
    }
    throw new Error("Base64 encoder unavailable");
  }

  function base64ToUtf8(b64) {
    var cleaned = String(b64 == null ? "" : b64).replace(/[\r\n\s]+/g, "");
    if (!cleaned) return "";
    if (typeof TextDecoder !== "undefined" && typeof atob === "function") {
      var bin = atob(cleaned);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i) & 0xff;
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(cleaned, "base64").toString("utf8");
    }
    throw new Error("Base64 decoder unavailable");
  }

  function parseEpochMs(tsVal) {
    if (typeof tsVal === "number" && Number.isFinite(tsVal) && tsVal > 0) {
      return Math.round(tsVal);
    }
    if (typeof tsVal === "string" && tsVal.trim()) {
      var asNum = Number(tsVal);
      if (Number.isFinite(asNum) && asNum > 946684800000) {
        return Math.round(asNum);
      }
      var parsed = Date.parse(tsVal);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 0;
  }

  function formatLocalYmd(epochMs) {
    var d = new Date(epochMs > 0 ? epochMs : Date.now());
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return toAsciiDigits(yyyy + "-" + mm + "-" + dd);
  }

  function formatLocalHm(epochMs) {
    var d = new Date(epochMs > 0 ? epochMs : Date.now());
    var hh = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return toAsciiDigits(hh + ":" + min);
  }

  function compactIsoStamp(epochMs) {
    var d = new Date(epochMs > 0 ? epochMs : Date.now());
    return toAsciiDigits(
      d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0") +
      "T" +
      String(d.getUTCHours()).padStart(2, "0") +
      String(d.getUTCMinutes()).padStart(2, "0") +
      String(d.getUTCSeconds()).padStart(2, "0")
    );
  }

  /* ================= 2. CONFIGURATION & TOKEN PERSISTENCE ================= */

  function cleanToken(rawToken) {
    var t = stripHiddenBidi(String(rawToken == null ? "" : rawToken)).trim();
    t = t.replace(/^(?:Bearer|token)\s+/i, "").trim();
    return t;
  }

  function getConditionLabel(condId) {
    var id = String(condId || "normal").trim();
    for (var i = 0; i < DAY_CONDITIONS.length; i += 1) {
      if (DAY_CONDITIONS[i].id === id) return DAY_CONDITIONS[i].label;
    }
    var custom = sanitizeVaultText(id, true);
    return custom || "اعتيادي";
  }

  function getPhaseLabel(phaseId) {
    var pid = String(phaseId || "baseline").trim();
    if (PHASE_LABELS_AR[pid]) return PHASE_LABELS_AR[pid];
    var S = (root.NeuroLab && root.NeuroLab.Stimuli) || root.Stimuli || null;
    if (S && Array.isArray(S.PHASES)) {
      for (var i = 0; i < S.PHASES.length; i += 1) {
        var p = S.PHASES[i];
        if (p && String(p.id || p.key) === pid) {
          var rawLbl = String(p.short || p.label || p.labelAr || pid).split("(")[0].trim();
          return sanitizeVaultText(rawLbl, true) || pid;
        }
      }
    }
    return sanitizeVaultText(pid, true) || "خط الأساس القاعدي";
  }

  function normalizeConfig(raw) {
    var src = raw && typeof raw === "object" ? raw : {};
    var owner = stripHiddenBidi(toAsciiDigits(src.owner != null ? src.owner : DEFAULT_CONFIG.owner)).trim();
    var repo = stripHiddenBidi(toAsciiDigits(src.repo != null ? src.repo : DEFAULT_CONFIG.repo)).trim().replace(/\.git$/i, "");
    var branch = stripHiddenBidi(toAsciiDigits(src.branch != null ? src.branch : DEFAULT_CONFIG.branch)).trim();
    var filePath = stripHiddenBidi(toAsciiDigits(src.filePath != null ? src.filePath : DEFAULT_CONFIG.filePath))
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/{2,}/g, "/");
    var rememberToken = src.rememberToken !== false;
    var dayCondition = String(src.dayCondition || DEFAULT_CONFIG.dayCondition).trim() || "normal";
    var token = cleanToken(src.token != null ? src.token : "");

    var fps = {};
    if (src.syncedFingerprints && typeof src.syncedFingerprints === "object" && !Array.isArray(src.syncedFingerprints)) {
      var keys = Object.keys(src.syncedFingerprints);
      for (var i = 0; i < keys.length; i += 1) {
        if (src.syncedFingerprints[keys[i]]) {
          fps[keys[i]] = true;
        }
      }
    }

    return {
      owner: owner || DEFAULT_CONFIG.owner,
      repo: repo || DEFAULT_CONFIG.repo,
      branch: branch || DEFAULT_CONFIG.branch,
      filePath: filePath || DEFAULT_CONFIG.filePath,
      rememberToken: rememberToken,
      dayCondition: dayCondition,
      token: token,
      lastSyncedAt: src.lastSyncedAt || null,
      lastCommitSha: src.lastCommitSha || null,
      syncedFingerprints: fps
    };
  }

  function loadConfig() {
    var base = Object.assign({}, memConfig);
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          base = Object.assign(base, parsed);
        }
      }
    } catch (_) {}

    if (!base.token) {
      try {
        if (typeof sessionStorage !== "undefined") {
          var sessTok = sessionStorage.getItem(SESSION_TOKEN_KEY);
          if (sessTok) base.token = sessTok;
        }
      } catch (_) {}
    }

    var norm = normalizeConfig(base);
    memConfig = norm;
    return Object.assign({}, norm, {
      syncedFingerprints: Object.assign({}, norm.syncedFingerprints)
    });
  }

  function saveConfig(partial) {
    var cur = loadConfig();
    var merged = normalizeConfig(Object.assign({}, cur, partial || {}));
    if (partial && partial.syncedFingerprints && typeof partial.syncedFingerprints === "object") {
      merged.syncedFingerprints = normalizeConfig({ syncedFingerprints: partial.syncedFingerprints }).syncedFingerprints;
    }
    memConfig = merged;

    var toDisk = {
      owner: merged.owner,
      repo: merged.repo,
      branch: merged.branch,
      filePath: merged.filePath,
      rememberToken: merged.rememberToken,
      dayCondition: merged.dayCondition,
      token: merged.rememberToken ? merged.token : "",
      lastSyncedAt: merged.lastSyncedAt,
      lastCommitSha: merged.lastCommitSha,
      syncedFingerprints: merged.syncedFingerprints
    };

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(toDisk));
      }
    } catch (_) {}

    try {
      if (typeof sessionStorage !== "undefined") {
        if (!merged.rememberToken && merged.token) {
          sessionStorage.setItem(SESSION_TOKEN_KEY, merged.token);
        } else {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
        }
      }
    } catch (_) {}

    return Object.assign({}, merged, {
      syncedFingerprints: Object.assign({}, merged.syncedFingerprints)
    });
  }

  function clearToken() {
    var next = saveConfig({ token: "" });
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch (_) {}
    refreshUi();
    return next;
  }

  function validateConfig(cfg, requireToken) {
    var c = normalizeConfig(cfg);
    if (!c.owner || /[\/\s]/.test(c.owner)) {
      return { ok: false, error: "اسم مالك المستودع (Owner) غير صالح." };
    }
    if (!c.repo || /[\/\s]/.test(c.repo)) {
      return { ok: false, error: "اسم المستودع (Repo) غير صالح." };
    }
    if (!c.branch || /\.\.|[\s~^:?*\[\\]/.test(c.branch)) {
      return { ok: false, error: "اسم الفرع (Branch) غير صالح." };
    }
    if (!c.filePath || c.filePath.slice(-1) === "/") {
      return { ok: false, error: "يرجى تحديد مسار ملف ماركداون صالح داخل المستودع." };
    }
    var segs = c.filePath.split("/");
    for (var i = 0; i < segs.length; i += 1) {
      if (!segs[i] || segs[i] === "." || segs[i] === "..") {
        return { ok: false, error: "مسار الملف يحتوي على مقاطع غير مسموحة." };
      }
    }
    if (!/\.md$/i.test(c.filePath)) {
      return { ok: false, error: "يجب أن ينتهي مسار السجل بامتداد .md ليوافق خزنة الملاحظات." };
    }
    if (requireToken !== false) {
      if (!c.token) {
        return { ok: false, needsToken: true, error: "يرجى إدخال رمز الوصول الدقيق (Fine-Grained PAT) الخاص بمستودع zme." };
      }
      if (!/^[\x21-\x7E]+$/.test(c.token) || c.token.length < 12) {
        return {
          ok: false,
          isAuthError: true,
          error: "رمز الوصول المدخل يحتوي على محارف غير صالحة — يرجى لصق رمز GitHub الإنجليزي الصحيح (Fine-Grained PAT)."
        };
      }
    }
    return { ok: true, config: c };
  }

  /* ================= 3. DAILY CHECK-INS & ACTIVE CONTEXT SNAPSHOT ================= */

  function getActiveSessionNotes() {
    if (typeof document !== "undefined") {
      var inp = document.getElementById("sessionNotesInput");
      if (inp && typeof inp.value === "string") {
        return sanitizeVaultText(inp.value, true);
      }
    }
    try {
      if (typeof localStorage !== "undefined") {
        return sanitizeVaultText(localStorage.getItem(NOTES_STORAGE_KEY) || "", true);
      }
    } catch (_) {}
    return "";
  }

  function getActiveClinicalSnapshot() {
    var cfg = loadConfig();
    var A = (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || null;
    var ctx = {};
    if (A && typeof A.getContext === "function") {
      try { ctx = A.getContext() || {}; } catch (_) {}
    }
    return {
      phase: String(ctx.phase || "baseline"),
      sleepQuality: Number.isFinite(Number(ctx.sleepQuality)) ? Number(ctx.sleepQuality) : 6,
      alertness: Number.isFinite(Number(ctx.alertness)) ? Number(ctx.alertness) : 8,
      nasalPatency: Number.isFinite(Number(ctx.nasalPatency)) ? Number(ctx.nasalPatency) : 5,
      delayAversionEpisodes: Number.isFinite(Number(ctx.delayAversionEpisodes)) ? Number(ctx.delayAversionEpisodes) : 2,
      sequenceLapses: Number.isFinite(Number(ctx.sequenceLapses)) ? Number(ctx.sequenceLapses) : 2,
      dayCondition: cfg.dayCondition || "normal",
      dayConditionLabel: getConditionLabel(cfg.dayCondition || "normal"),
      notes: getActiveSessionNotes()
    };
  }

  function loadCheckins() {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(CHECKINS_STORAGE_KEY);
        if (raw) {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            memCheckins = arr;
            return arr.slice();
          }
        }
      }
    } catch (_) {}
    return memCheckins.slice();
  }

  function saveCheckins(list) {
    var clean = Array.isArray(list) ? list.slice(0, 90) : [];
    memCheckins = clean;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(clean));
      }
    } catch (_) {}
    return clean;
  }

  function recordDailyCheckin(customOverrides) {
    var snap = Object.assign(getActiveClinicalSnapshot(), customOverrides || {});
    var nowMs = parseEpochMs(snap.timestamp) || Date.now();
    var dayYmd = formatLocalYmd(nowMs);
    var runKey = sanitizeRunKey(
      "checkin-" + dayYmd + "-" + compactIsoStamp(nowMs) + "-" +
      shortHash(dayYmd + "|" + snap.phase + "|" + snap.dayCondition + "|" + snap.alertness + "|" + snap.sleepQuality + "|" + snap.notes)
    );
    var item = {
      id: runKey,
      timestamp: nowMs,
      timestampIso: new Date(nowMs).toISOString(),
      phase: snap.phase,
      dayCondition: snap.dayCondition,
      sleepQuality: snap.sleepQuality,
      alertness: snap.alertness,
      nasalPatency: snap.nasalPatency,
      delayAversionEpisodes: snap.delayAversionEpisodes,
      sequenceLapses: snap.sequenceLapses,
      notes: sanitizeVaultText(snap.notes || "", true)
    };
    var list = loadCheckins();
    list.unshift(item);
    saveCheckins(list);
    refreshUi();
    return item;
  }

  function clearLocalCheckins() {
    memCheckins = [];
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(CHECKINS_STORAGE_KEY);
      }
    } catch (_) {}
    refreshUi();
  }

  /* ================= 4. MULTI-SUITE ENTRY COLLECTION & NORMALIZATION ================= */

  function formatSafeD4Soa(rec) {
    var DC = root.NeuroLab && root.NeuroLab.DeepCore;
    var raw = "";
    if (DC && typeof DC.formatD4Soa75 === "function") {
      try { raw = DC.formatD4Soa75(rec, false); } catch (_) {}
    }
    if (!raw) {
      if (rec.soa75AtFloor) raw = "أقل من 350 ms";
      else if (rec.soa75ExceededCeiling) raw = "فوق 1450 ms";
      else if (Number.isFinite(Number(rec.soa75Ms))) raw = Math.round(Number(rec.soa75Ms)) + " ms";
      else raw = "غير محدد";
    }
    return sanitizeVaultText(raw, true);
  }

  function normalizeDeepEntry(rec, fallbackSnap) {
    if (!rec || typeof rec !== "object" || rec.isFamiliarization) return null;
    var expId = String(rec.expId || "");
    var meta = V3_PROBE_META[expId];
    if (!meta) return null;

    var epochMs = parseEpochMs(rec.timestamp);
    if (!epochMs) epochMs = Date.now();
    var isoStr = new Date(epochMs).toISOString();
    var dayYmd = formatLocalYmd(epochMs);
    var envMs = rec.env && rec.env.isoTimestamp ? parseEpochMs(rec.env.isoTimestamp) : 0;
    var useEnvTime =
      envMs > 0 &&
      Math.abs(envMs - epochMs) < 120000 &&
      rec.env &&
      rec.env.localTimeHHMM &&
      /^\d{2}:\d{2}$/.test(toAsciiDigits(rec.env.localTimeHHMM));
    var timeHm = useEnvTime
      ? toAsciiDigits(rec.env.localTimeHHMM)
      : formatLocalHm(epochMs);

    var phaseId = String(rec.phase || (fallbackSnap && fallbackSnap.phase) || "baseline");
    var phaseLabel = getPhaseLabel(phaseId);
    var condId = String(rec.dayCondition || (fallbackSnap && fallbackSnap.dayCondition) || "normal");
    var condLabel = getConditionLabel(condId);
    var formId = String(rec.formId || "A").toUpperCase();
    if (formId !== "A" && formId !== "B" && formId !== "C") formId = "A";

    var alertness = Number.isFinite(Number(rec.alertness)) ? Number(rec.alertness) : (fallbackSnap ? fallbackSnap.alertness : 8);
    var sleepQuality = Number.isFinite(Number(rec.sleepQuality)) ? Number(rec.sleepQuality) : (fallbackSnap ? fallbackSnap.sleepQuality : 6);
    var nasalPatency = Number.isFinite(Number(rec.nasalPatency)) ? Number(rec.nasalPatency) : (fallbackSnap ? fallbackSnap.nasalPatency : 5);
    var hz = Number((rec.env && rec.env.refreshHz) || rec.refreshHz || 60);
    var noteText = sanitizeVaultText(rec.notes != null ? rec.notes : "", true);

    var headlineVal = "";
    var numericMetric = 0;
    var mainLine = "";
    var subLine = "";

    if (expId === "d1_tbrs") {
      var pHigh = Number(rec.pTargetHighPct ?? 0);
      var pLow = Number(rec.pTargetLowPct ?? 0);
      var dTbrs = Number(rec.deltaTbrs ?? 0);
      var pSwap = Number(rec.pSwapHighCorrPct ?? rec.pSwapHighPct ?? 0);
      var pGuess = Number(rec.pGuessHighPct ?? 0);
      var cal1 = Number(rec.calibratedScorePct ?? pHigh);
      headlineVal = fmtNum(pHigh, 1) + "%";
      numericMetric = pHigh;
      mainLine =
        "المؤشرات الرئيسية: الدرجة المعايرة **" + fmtNum(cal1, 1) + "%**، صمود الحمل العالي **" + fmtNum(pHigh, 1) +
        "%**، دقة الحمل المنخفض **" + fmtNum(pLow, 1) + "%**، فارق الحمل **" + fmtNum(dTbrs, 2) +
        "**، تبديل المواقع **" + fmtNum(pSwap, 1) + "%**، تخمين عشوائي **" + fmtNum(pGuess, 1) + "%**.";
      subLine =
        "المقاييس الفرعية: حمل المعالجة المنخفض **" + fmtNum(rec.clLow ?? 0, 2) + "** والعالي **" + fmtNum(rec.clHigh ?? 0, 2) +
        "**، دقة الأحكام البصرية **" + fmtNum(rec.procAccPct ?? 0, 1) + "%** بمتوسط زمن **" + fmtNum(rec.procMeanRtMs ?? 0, 0) + " ms**.";
    } else if (expId === "d2_refback_m3") {
      var pTarg = Number(rec.pTargetPct ?? 0);
      var lag0 = Number(rec.lag0AccPct ?? 0);
      var lag1 = Number(rec.lag1PlusAccPct ?? 0);
      var sw2 = Number(rec.pSwapCorrPct ?? 0);
      var st2 = Number(rec.pStaleCorrPct ?? 0);
      var gu2 = Number(rec.pGuessPct ?? 0);
      var cal2 = Number(rec.calibratedScorePct ?? pTarg);
      headlineVal = fmtNum(pTarg, 1) + "%";
      numericMetric = pTarg;
      mainLine =
        "المؤشرات الرئيسية: الدرجة المعايرة **" + fmtNum(cal2, 1) + "%**، إصابة الهدف **" + fmtNum(pTarg, 1) +
        "%**، البؤرة النشطة **" + fmtNum(lag0, 1) + "%**، الرف الجانبي **" + fmtNum(lag1, 1) +
        "%**، تبديل الأدوار **" + fmtNum(sw2, 1) + "%**، أثر متقادم **" + fmtNum(st2, 1) + "%**، تخمين صافي **" + fmtNum(gu2, 1) + "%**.";
      subLine =
        "المقاييس الفرعية: بوابة التحديث الحمراء **" + fmtNum(rec.redAccPct ?? 0, 1) + "%** بزمن **" + fmtNum(rec.redMeanRtMs ?? 0, 0) +
        " ms**، وبوابة المقارنة الزرقاء **" + fmtNum(rec.blueAccPct ?? 0, 1) + "%** بزمن **" + fmtNum(rec.blueMeanRtMs ?? 0, 0) + " ms**.";
    } else if (expId === "d3_bays_analog") {
      var kVal = Number(rec.K ?? 0);
      var cal3 = Number(rec.calibratedScorePct ?? 0);
      headlineVal = "K=" + fmtNum(kVal, 2);
      numericMetric = kVal;
      mainLine =
        "المؤشرات الرئيسية: الدرجة المعايرة **" + fmtNum(cal3, 1) + "%**، السعة الفعالة **K=" + fmtNum(kVal, 2) +
        "**، احتمال الهدف **" + fmtNum(rec.alphaPct ?? 0, 1) + "%**، التبديل المكاني **" + fmtNum(rec.betaPct ?? 0, 1) +
        "%**، التخمين **" + fmtNum(rec.gammaPct ?? 0, 1) + "%**، انحراف الدقة **" + fmtNum(rec.sigmaDeg ?? 0, 1) + "°**.";
      subLine =
        "المقاييس الفرعية: تبديل الفاصل القصير **" + fmtNum(rec.betaShortPct ?? 0, 1) + "%**، تغير التخمين عبر التأخير **" +
        fmtSignedNum(rec.deltaGammaDelayPct ?? 0, "%", 1) + "**، متوسط الخطأ الزاوي **" + fmtNum(rec.cMAE ?? 0, 1) + "°**.";
    } else if (expId === "d4_consolidation_soa") {
      var soaTxt = formatSafeD4Soa(rec);
      var auc = Number(rec.aucConsPct ?? 0);
      var cal4 = Number(rec.calibratedScorePct ?? auc);
      headlineVal = soaTxt + " / AUC " + fmtNum(auc, 1) + "%";
      numericMetric = auc;
      mainLine =
        "المؤشرات الرئيسية: الدرجة المعايرة **" + fmtNum(cal4, 1) + "%**، عتبة التوطيد **" + soaTxt +
        "**، مساحة التوطيد **" + fmtNum(auc, 1) + "%**، المتوسط الخام **" + fmtNum(rec.aucRawPct ?? 0, 1) + "%**.";
      subLine =
        "المقاييس الفرعية: الدقة عبر الفواصل الأربع **" + fmtNum(rec.acc350Pct ?? 0, 0) + "% / " + fmtNum(rec.acc650Pct ?? 0, 0) +
        "% / " + fmtNum(rec.acc1050Pct ?? 0, 0) + "% / " + fmtNum(rec.acc1450Pct ?? 0, 0) + "%**، التبديل السريع مقابل البطيء **" +
        fmtNum(rec.fastSwapCorrPct ?? 0, 0) + "% / " + fmtNum(rec.slowSwapCorrPct ?? 0, 0) + "%**، القرار الرجعي **" +
        fmtNum(rec.interruptAccPct ?? 0, 0) + "%** بزمن **" + fmtNum(rec.interruptMeanRtMs ?? 0, 0) + " ms**.";
    } else if (expId === "d5_pvt5") {
      var speed = Number(rec.meanReciprocalSpeed ?? 0);
      var cal5 = Number(rec.calibratedScorePct ?? 0);
      headlineVal = fmtNum(speed, 2) + " s⁻¹";
      numericMetric = speed;
      mainLine =
        "المؤشرات الرئيسية: الدرجة المعايرة **" + fmtNum(cal5, 1) + "%**، السرعة التبادلية **" + fmtNum(speed, 2) +
        " s⁻¹**، الوسيط **" + fmtNum(rec.medianRtMs ?? 0, 0) + " ms**، أسرع وأبطأ عشرة بالمئة **" +
        fmtNum(rec.fastest10RtMs ?? 0, 0) + " / " + fmtNum(rec.slowest10RtMs ?? 0, 0) + " ms**، الهفوات الكبرى والصغرى **" +
        fmtNum(rec.lapses500Pct ?? 0, 1) + "% / " + fmtNum(rec.lapses355Pct ?? 0, 1) + "%**، الاستباق **" + fmtNum(rec.falseStarts ?? 0, 0) + "**.";
      subLine =
        "المقاييس الفرعية: تفكيك التوزيع **" + fmtNum(rec.muMs ?? 0, 0) + " / " + fmtNum(rec.sigmaMs ?? 0, 0) + " / " +
        fmtNum(rec.tauMs ?? 0, 0) + " ms**، ذيل الفاصل البطيء والسريع والمبكر **" + fmtNum(rec.slowIsiTauMs ?? 0, 0) + " / " +
        fmtNum(rec.fastIsiTauMs ?? 0, 0) + " / " + fmtNum(rec.earlySlowIsiTauMs ?? 0, 0) + " ms**، ميل الاستدامة **" +
        fmtSignedNum(rec.betaToTRecipPerMin ?? 0, " s⁻¹/min", 2) + "**.";
    }

    var runKey = rec.syncRunKey
      ? sanitizeRunKey(rec.syncRunKey)
      : sanitizeRunKey("v3-" + expId + "-" + compactIsoStamp(epochMs) + "-" + shortHash(expId + "|" + epochMs + "|" + headlineVal));

    var contextLine =
      "السياق اليومي: المرحلة **" + phaseLabel + "** بمعرف **" + sanitizeVaultText(phaseId, true) +
      "**، الحالة اليومية **" + condLabel + "**، النموذج **Form " + formId +
      "**، اليقظة **" + fmtNum(alertness, 0) + "/10**، النوم **" + fmtNum(sleepQuality, 0) +
      "/10**، المجرى الهوائي **" + fmtNum(nasalPatency, 0) + "/10**، التردد **" + fmtNum(hz, 0) + "Hz**.";

    return {
      runKey: runKey,
      suiteKind: "deep_v3",
      suiteLabelAr: "النسخة العميقة",
      probeKey: expId,
      probeCode: meta.code,
      probeTitleAr: meta.title,
      epochMs: epochMs,
      timestampIso: isoStr,
      dayYmd: dayYmd,
      timeHm: timeHm,
      phaseId: phaseId,
      phaseLabel: phaseLabel,
      conditionId: condId,
      conditionLabel: condLabel,
      formId: formId,
      headlineVal: headlineVal,
      numericMetric: numericMetric,
      metricUnit: meta.unit || "",
      metricPrefix: meta.prefix || "",
      higherIsBetter: meta.higherIsBetter !== false,
      contextLine: contextLine,
      mainMetricsLine: mainLine,
      subMetricsLine: subLine,
      noteText: noteText
    };
  }

  function normalizeV2Record(rec, fallbackSnap) {
    if (!rec || typeof rec !== "object") return null;
    var pid = String(rec.probeId || "");
    var meta = V2_PROBE_META[pid];
    if (!meta) return null;

    var epochMs = parseEpochMs(rec.timestamp) || Date.now();
    var isoStr = new Date(epochMs).toISOString();
    var dayYmd = formatLocalYmd(epochMs);
    var timeHm = formatLocalHm(epochMs);

    var score = Number(rec.score ?? 0);
    var delta = Number.isFinite(Number(rec.deltaFromBaseline))
      ? Number(rec.deltaFromBaseline)
      : score - meta.baseline;
    var rci = Number.isFinite(Number(rec.rci)) ? Number(rec.rci) : null;
    var rtMean = Number.isFinite(Number(rec.rtMeanMs)) && Number(rec.rtMeanMs) > 0 ? Math.round(Number(rec.rtMeanMs)) : null;

    var phaseId = String(rec.phase || (fallbackSnap && fallbackSnap.phase) || "baseline");
    var phaseLabel = getPhaseLabel(phaseId);
    var condId = String(rec.dayCondition || (fallbackSnap && fallbackSnap.dayCondition) || "normal");
    var condLabel = getConditionLabel(condId);
    var alertness = Number.isFinite(Number(rec.alertness)) ? Number(rec.alertness) : 8;
    var sleepQuality = Number.isFinite(Number(rec.sleepQuality)) ? Number(rec.sleepQuality) : 6;
    var nasalPatency = Number.isFinite(Number(rec.nasalPatency)) ? Number(rec.nasalPatency) : 5;
    var noteText = sanitizeVaultText(rec.notes || "", true);

    var headlineVal = fmtNum(score, 1) + "%";
    var mainLine =
      "المؤشرات الرئيسية: الدرجة **" + headlineVal + "**، الفارق عن الأساس **" + fmtSignedNum(delta, "%", 1) + "**" +
      (rci !== null ? "، مؤشر التغير الموثوق **RCI " + fmtSignedNum(rci, "", 2) + "**" : "") +
      (rtMean !== null ? "، متوسط زمن الاستجابة **" + fmtNum(rtMean, 0) + " ms**" : "") + ".";

    var subParts = [];
    var sm = rec.submetrics && typeof rec.submetrics === "object" ? rec.submetrics : null;
    if (sm) {
      var smKeys = Object.keys(sm).slice(0, 5);
      for (var i = 0; i < smKeys.length; i += 1) {
        var k = smKeys[i];
        var v = sm[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          subParts.push(sanitizeVaultText(k, true) + " **" + fmtNum(v, 1) + "**");
        }
      }
    }
    var subLine = subParts.length > 0
      ? "المقاييس الفرعية: " + subParts.join("، ") + "."
      : "";

    var runKey = rec.id
      ? sanitizeRunKey("v2-" + rec.id)
      : sanitizeRunKey("v2-" + pid + "-" + compactIsoStamp(epochMs) + "-" + shortHash(pid + "|" + epochMs + "|" + score));

    var contextLine =
      "السياق اليومي: المرحلة **" + phaseLabel + "** بمعرف **" + sanitizeVaultText(phaseId, true) +
      "**، الحالة اليومية **" + condLabel + "**، اليقظة **" + fmtNum(alertness, 0) +
      "/10**، النوم **" + fmtNum(sleepQuality, 0) + "/10**، المجرى الهوائي **" + fmtNum(nasalPatency, 0) + "/10**.";

    return {
      runKey: runKey,
      suiteKind: "surgical_v2",
      suiteLabelAr: "المسبار الجراحي",
      probeKey: pid,
      probeCode: meta.code,
      probeTitleAr: meta.title,
      epochMs: epochMs,
      timestampIso: isoStr,
      dayYmd: dayYmd,
      timeHm: timeHm,
      phaseId: phaseId,
      phaseLabel: phaseLabel,
      conditionId: condId,
      conditionLabel: condLabel,
      formId: "",
      headlineVal: headlineVal,
      numericMetric: score,
      metricUnit: "%",
      metricPrefix: "",
      higherIsBetter: true,
      contextLine: contextLine,
      mainMetricsLine: mainLine,
      subMetricsLine: subLine,
      noteText: noteText
    };
  }

  function normalizeV2BatteryRun(bat, fallbackSnap) {
    if (!bat || typeof bat !== "object") return null;
    var epochMs = parseEpochMs(bat.timestamp) || Date.now();
    var isoStr = new Date(epochMs).toISOString();
    var dayYmd = formatLocalYmd(epochMs);
    var timeHm = formatLocalHm(epochMs);

    var comp = Number(bat.compositeDeficitScore ?? 0);
    var ctrl = Number(bat.controlScore ?? 98);
    var delta = comp - 36;
    var gap = ctrl - comp;
    var phaseId = String(bat.phase || (fallbackSnap && fallbackSnap.phase) || "baseline");
    var phaseLabel = getPhaseLabel(phaseId);
    var condId = String(bat.dayCondition || (fallbackSnap && fallbackSnap.dayCondition) || "normal");
    var condLabel = getConditionLabel(condId);

    var scores = bat.probeScores && typeof bat.probeScores === "object" ? bat.probeScores : {};
    var subParts = [];
    var pOrder = ["isolation", "updating", "gating", "binding", "vigilance", "control"];
    for (var i = 0; i < pOrder.length; i += 1) {
      var pk = pOrder[i];
      if (typeof scores[pk] === "number") {
        subParts.push(V2_PROBE_META[pk].code + " **" + fmtNum(scores[pk], 1) + "%**");
      }
    }

    var headlineVal = fmtNum(comp, 1) + "%";
    var runKey = bat.id
      ? sanitizeRunKey("v2bat-" + bat.id)
      : sanitizeRunKey("v2bat-" + compactIsoStamp(epochMs) + "-" + shortHash("bat|" + epochMs + "|" + comp));

    return {
      runKey: runKey,
      suiteKind: "surgical_v2",
      suiteLabelAr: "حصيلة البطارية",
      probeKey: "battery_v2",
      probeCode: V2_PROBE_META.battery_v2.code,
      probeTitleAr: V2_PROBE_META.battery_v2.title,
      epochMs: epochMs,
      timestampIso: isoStr,
      dayYmd: dayYmd,
      timeHm: timeHm,
      phaseId: phaseId,
      phaseLabel: phaseLabel,
      conditionId: condId,
      conditionLabel: condLabel,
      formId: "",
      headlineVal: headlineVal,
      numericMetric: comp,
      metricUnit: "%",
      metricPrefix: "",
      higherIsBetter: true,
      contextLine:
        "السياق اليومي: المرحلة **" + phaseLabel + "** بمعرف **" + sanitizeVaultText(phaseId, true) +
        "**، الحالة اليومية **" + condLabel + "**.",
      mainMetricsLine:
        "المؤشرات الرئيسية: مركب المناطق الخمس **" + headlineVal + "**، الفارق عن الأساس **" +
        fmtSignedNum(delta, "%", 1) + "**، مرساة الضبط **" + fmtNum(ctrl, 1) + "%**، فجوة التباين **" + fmtNum(gap, 1) + "%**.",
      subMetricsLine: subParts.length > 0 ? "المقاييس الفرعية: " + subParts.join("، ") + "." : "",
      noteText: sanitizeVaultText(bat.notes || "", true)
    };
  }

  function normalizeFalsifyEntry(rec, fallbackSnap) {
    if (!rec || typeof rec !== "object") return null;
    var expId = String(rec.expId || "");
    var meta = FALSIFY_PROBE_META[expId];
    if (!meta) return null;

    var epochMs = parseEpochMs(rec.timestamp) || Date.now();
    var isoStr = new Date(epochMs).toISOString();
    var dayYmd = formatLocalYmd(epochMs);
    var timeHm = formatLocalHm(epochMs);
    var phaseId = String(rec.phase || (fallbackSnap && fallbackSnap.phase) || "baseline");
    var phaseLabel = getPhaseLabel(phaseId);
    var condId = String(rec.dayCondition || (fallbackSnap && fallbackSnap.dayCondition) || "normal");
    var condLabel = getConditionLabel(condId);

    var headlineVal = "";
    var numericMetric = 0;
    var mainLine = "";

    if (expId === "f1_crossmodal") {
      numericMetric = Number(rec.svPct ?? 0);
      headlineVal = fmtNum(numericMetric, 1) + "%";
      mainLine =
        "المؤشرات الرئيسية: مربعات مع حساب **" + fmtNum(rec.svPct ?? 0, 1) + "%**، كلمات مع حساب **" +
        fmtNum(rec.vvPct ?? 0, 1) + "%**، مربعات مع شكل **" + fmtNum(rec.ssPct ?? 0, 1) + "%**، كلمات مع شكل **" +
        fmtNum(rec.vsPct ?? 0, 1) + "%**.";
    } else if (expId === "f2_suppression") {
      numericMetric = Number(rec.spatialVocalPct ?? 0);
      headlineVal = fmtNum(numericMetric, 1) + "%";
      mainLine =
        "المؤشرات الرئيسية: دقة المربعات مع كتم اللسان **" + fmtNum(rec.spatialVocalPct ?? 0, 1) +
        "%**، صامت **" + fmtNum(rec.spatialSilentPct ?? 0, 1) + "%**، هبوط الكتم **" +
        fmtNum(rec.spatialDropPct ?? 0, 1) + "%**، توقف اللسان **" + fmtNum(rec.tongueFreezeCount ?? 0, 0) + "**.";
    } else if (expId === "f3_spatial_slots") {
      numericMetric = Number(rec.spatial3Pct ?? 0);
      headlineVal = fmtNum(numericMetric, 1) + "%";
      mainLine =
        "المؤشرات الرئيسية: الصناديق المكانية **" + fmtNum(rec.spatial3Pct ?? 0, 1) +
        "%**، التحديث النصي **" + fmtNum(rec.verbal3Pct ?? 0, 1) + "%**، فارق الإنقاذ المكاني **" +
        fmtSignedNum(rec.spatialRescueDeltaPct ?? 0, "%", 1) + "**.";
    } else if (expId === "f4_polarity_axis") {
      numericMetric = Number(rec.axisReliefPct ?? 0);
      headlineVal = fmtNum(numericMetric, 1) + "%";
      mainLine =
        "المؤشرات الرئيسية: انمحاء ضريبة القلب **" + fmtNum(rec.axisReliefPct ?? 0, 1) +
        "%**، كلفة القلب اللفظي **" + fmtNum(rec.verbalFlipCostMs ?? 0, 0) + " ms**، مع المسطرة البصرية **" +
        fmtNum(rec.axisFlipCostMs ?? 0, 0) + " ms**، عكس القاعدة غير المكاني **" + fmtNum(rec.nonSpatialRuleFlipCostMs ?? 0, 0) + " ms**.";
    }

    var runKey = rec.syncRunKey
      ? sanitizeRunKey(rec.syncRunKey)
      : sanitizeRunKey("f1-" + expId + "-" + compactIsoStamp(epochMs) + "-" + shortHash(expId + "|" + epochMs + "|" + headlineVal));

    return {
      runKey: runKey,
      suiteKind: "falsify_v1",
      suiteLabelAr: "تجربة الحسم",
      probeKey: expId,
      probeCode: meta.code,
      probeTitleAr: meta.title,
      epochMs: epochMs,
      timestampIso: isoStr,
      dayYmd: dayYmd,
      timeHm: timeHm,
      phaseId: phaseId,
      phaseLabel: phaseLabel,
      conditionId: condId,
      conditionLabel: condLabel,
      formId: "",
      headlineVal: headlineVal,
      numericMetric: numericMetric,
      metricUnit: "%",
      metricPrefix: "",
      higherIsBetter: true,
      contextLine:
        "السياق اليومي: المرحلة **" + phaseLabel + "** بمعرف **" + sanitizeVaultText(phaseId, true) +
        "**، الحالة اليومية **" + condLabel + "**.",
      mainMetricsLine: mainLine,
      subMetricsLine: "",
      noteText: sanitizeVaultText(rec.notes || "", true)
    };
  }

  function normalizeCheckinEntry(chk) {
    if (!chk || typeof chk !== "object") return null;
    var epochMs = parseEpochMs(chk.timestamp) || Date.now();
    var isoStr = new Date(epochMs).toISOString();
    var dayYmd = formatLocalYmd(epochMs);
    var timeHm = formatLocalHm(epochMs);
    var phaseId = String(chk.phase || "baseline");
    var phaseLabel = getPhaseLabel(phaseId);
    var condId = String(chk.dayCondition || "normal");
    var condLabel = getConditionLabel(condId);
    var alertness = Number(chk.alertness ?? 8);
    var sleepQuality = Number(chk.sleepQuality ?? 6);
    var nasalPatency = Number(chk.nasalPatency ?? 5);
    var slowEp = Number(chk.delayAversionEpisodes ?? 0);
    var lapses = Number(chk.sequenceLapses ?? 0);

    var headlineVal = "يقظة " + fmtNum(alertness, 0) + "/10 · نوم " + fmtNum(sleepQuality, 0) + "/10";
    var runKey = sanitizeRunKey(chk.id || ("checkin-" + dayYmd + "-" + compactIsoStamp(epochMs)));

    return {
      runKey: runKey,
      suiteKind: "daily_checkin",
      suiteLabelAr: "رصد سريري",
      probeKey: "clinical_context",
      probeCode: "سياق يومي",
      probeTitleAr: "المؤشرات السريرية اليومية المرافقة",
      epochMs: epochMs,
      timestampIso: isoStr,
      dayYmd: dayYmd,
      timeHm: timeHm,
      phaseId: phaseId,
      phaseLabel: phaseLabel,
      conditionId: condId,
      conditionLabel: condLabel,
      formId: "",
      headlineVal: headlineVal,
      numericMetric: alertness * 10,
      metricUnit: "",
      metricPrefix: "",
      higherIsBetter: true,
      contextLine:
        "السياق اليومي: المرحلة **" + phaseLabel + "** بمعرف **" + sanitizeVaultText(phaseId, true) +
        "**، الحالة اليومية **" + condLabel + "**.",
      mainMetricsLine:
        "المؤشرات الرئيسية: اليقظة **" + fmtNum(alertness, 0) + "/10**، جودة النوم **" + fmtNum(sleepQuality, 0) +
        "/10**، انفتاح المجرى الهوائي **" + fmtNum(nasalPatency, 0) + "/10**، نوبات ضيق البطء **" +
        fmtNum(slowEp, 0) + "**، هفوات التسلسل اليومي **" + fmtNum(lapses, 0) + "**.",
      subMetricsLine: "",
      noteText: sanitizeVaultText(chk.notes || "", true)
    };
  }

  function collectAllLocalEntries() {
    var snap = getActiveClinicalSnapshot();
    var seenKeys = {};
    var seenSemantic = {};
    var list = [];

    function pushUnique(norm) {
      if (!norm || !norm.runKey) return;
      var semKey = norm.suiteKind + "|" + norm.probeKey + "|" + Math.floor(norm.epochMs / 1000) + "|" + norm.headlineVal;
      if (seenKeys[norm.runKey] || seenSemantic[semKey]) return;
      seenKeys[norm.runKey] = true;
      seenSemantic[semKey] = true;
      list.push(norm);
    }

    // 1. Deep V3 (D1-D5)
    var DC = root.NeuroLab && root.NeuroLab.DeepCore;
    if (DC && typeof DC.loadState === "function") {
      try {
        var dst = DC.loadState();
        if (dst) {
          if (Array.isArray(dst.history)) {
            for (var h = 0; h < dst.history.length; h += 1) {
              pushUnique(normalizeDeepEntry(dst.history[h], snap));
            }
          }
          if (dst.results && typeof dst.results === "object") {
            var rKeys = Object.keys(dst.results);
            for (var r = 0; r < rKeys.length; r += 1) {
              pushUnique(normalizeDeepEntry(dst.results[rKeys[r]], snap));
            }
          }
        }
      } catch (_) {}
    }

    // 2. Surgical V1-V2 (P1-P6 + Full Battery)
    var A = (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || null;
    if (A && typeof A.loadState === "function") {
      try {
        var ast = A.loadState();
        if (ast) {
          if (Array.isArray(ast.records)) {
            for (var i = 0; i < ast.records.length; i += 1) {
              pushUnique(normalizeV2Record(ast.records[i], snap));
            }
          }
          if (Array.isArray(ast.batteryRuns)) {
            for (var b = 0; b < ast.batteryRuns.length; b += 1) {
              pushUnique(normalizeV2BatteryRun(ast.batteryRuns[b], snap));
            }
          }
        }
      } catch (_) {}
    }

    // 3. Falsify V1 (F1-F4)
    var FC = root.NeuroLab && root.NeuroLab.FalsifyCore;
    if (FC && typeof FC.loadState === "function") {
      try {
        var fst = FC.loadState();
        if (fst) {
          if (Array.isArray(fst.history)) {
            for (var fh = 0; fh < fst.history.length; fh += 1) {
              pushUnique(normalizeFalsifyEntry(fst.history[fh], snap));
            }
          }
          if (fst.results && typeof fst.results === "object") {
            var fk = Object.keys(fst.results);
            for (var fi = 0; fi < fk.length; fi += 1) {
              pushUnique(normalizeFalsifyEntry(fst.results[fk[fi]], snap));
            }
          }
        }
      } catch (_) {}
    }

    // 4. Standalone Daily Clinical Check-ins
    var chks = loadCheckins();
    for (var c = 0; c < chks.length; c += 1) {
      pushUnique(normalizeCheckinEntry(chks[c]));
    }

    list.sort(function (a, b) {
      return a.epochMs - b.epochMs;
    });
    return list;
  }

  function getSyncStats() {
    var cfg = loadConfig();
    var all = collectAllLocalEntries();
    var unsynced = [];
    var synced = [];
    for (var i = 0; i < all.length; i += 1) {
      if (cfg.syncedFingerprints[all[i].runKey]) {
        synced.push(all[i]);
      } else {
        unsynced.push(all[i]);
      }
    }
    return {
      totalLocal: all.length,
      unsyncedCount: unsynced.length,
      syncedCount: synced.length,
      unsyncedEntries: unsynced,
      allEntries: all,
      isConfigured: Boolean(cfg.token && cfg.owner && cfg.repo && cfg.filePath),
      lastSyncedAt: cfg.lastSyncedAt,
      lastCommitSha: cfg.lastCommitSha
    };
  }

  /* ================= 5. OBSIDIAN VAULT MARKDOWN FORMATTER, PARSER & VALIDATOR ================= */

  function renderEntryBodyLines(entry) {
    var headTitle =
      entry.suiteLabelAr + " **" + sanitizeVaultText(entry.probeCode, true) + "** (" +
      sanitizeVaultText(entry.probeTitleAr, true) + ") الساعة **" + sanitizeVaultText(entry.timeHm, true) +
      "** بنتيجة **" + sanitizeVaultText(entry.headlineVal, true) + "**:";

    var children = [];
    children.push(ensureArabicStart(entry.contextLine));
    children.push(ensureArabicStart(entry.mainMetricsLine));
    if (entry.subMetricsLine) {
      children.push(ensureArabicStart(entry.subMetricsLine));
    }
    if (entry.noteText) {
      children.push("الملاحظة السياقية: " + sanitizeVaultText(entry.noteText, true) + ".");
    }
    children.push(
      "البصمة المرجعية: المعرف **" + sanitizeRunKey(entry.runKey) +
      "** والمنظومة **" + sanitizeVaultText(entry.suiteKind, true) +
      "** والمسبار **" + sanitizeVaultText(entry.probeKey, true) +
      "** والتوقيت **" + sanitizeVaultText(entry.timestampIso, true) +
      "** والقيمة **" + sanitizeVaultText(entry.headlineVal, true) + "**."
    );

    var lines = [ensureArabicStart(headTitle)];
    for (var i = 0; i < children.length; i += 1) {
      lines.push("\t" + (i + 1) + ". " + children[i]);
    }
    return lines;
  }

  function parseSingleDayEntryBlock(dayYmd, rawLinesWithoutTopNum, orderIdx) {
    var head = rawLinesWithoutTopNum[0] || "";
    var joined = rawLinesWithoutTopNum.join("\n");

    var keyMatch = joined.match(/المعرف \*\*([A-Za-z0-9_-]+)\*\*/);
    var suiteMatch = joined.match(/والمنظومة \*\*([A-Za-z0-9_-]+)\*\*/);
    var probeMatch = joined.match(/والمسبار \*\*([A-Za-z0-9_-]+)\*\*/);
    var tsMatch = joined.match(/والتوقيت \*\*([0-9T:.\-+Z]+)\*\*/);
    var valMatch = joined.match(/والقيمة \*\*([^*]+)\*\*/) || head.match(/بنتيجة \*\*([^*]+)\*\*/);
    var timeMatch = head.match(/الساعة \*\*([0-9]{2}:[0-9]{2})\*\*/);
    var codeMatch = head.match(/\*\*([^*]+)\*\*/);
    var phaseLabelMatch = joined.match(/المرحلة \*\*([^*]+)\*\*/);
    var phaseIdMatch = joined.match(/بمعرف \*\*([A-Za-z0-9_-]+)\*\*/);
    var condMatch = joined.match(/الحالة اليومية \*\*([^*]+)\*\*/);
    var formMatch = joined.match(/النموذج \*\*Form ([ABC])\*\*/);

    var timeHm = timeMatch ? timeMatch[1] : "12:00";
    var isoStr = tsMatch ? tsMatch[1] : (dayYmd + "T" + timeHm + ":00.000Z");
    var epochMs = parseEpochMs(isoStr);
    if (!epochMs) {
      epochMs = parseEpochMs(dayYmd + "T12:00:00Z") + orderIdx;
    }

    var probeKey = probeMatch ? probeMatch[1] : "";
    var probeCode = codeMatch ? codeMatch[1] : (probeKey || "فحص");
    var headlineVal = valMatch ? valMatch[1].trim() : "";

    var numericMetric = null;
    var metricUnit = "";
    var metricPrefix = "";
    if (headlineVal) {
      var kMatch = headlineVal.match(/^K\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
      var aucMatch = headlineVal.match(/AUC\s+([+-]?\d+(?:\.\d+)?)%/i);
      var speedMatch = headlineVal.match(/([+-]?\d+(?:\.\d+)?)\s*s⁻¹/);
      var pctMatch = headlineVal.match(/([+-]?\d+(?:\.\d+)?)%/);
      if (kMatch) {
        numericMetric = Number(kMatch[1]);
        metricPrefix = "K=";
      } else if (aucMatch) {
        numericMetric = Number(aucMatch[1]);
        metricUnit = "%";
      } else if (speedMatch) {
        numericMetric = Number(speedMatch[1]);
        metricUnit = " s⁻¹";
      } else if (pctMatch) {
        numericMetric = Number(pctMatch[1]);
        metricUnit = "%";
      }
    }

    return {
      runKey: keyMatch ? keyMatch[1] : null,
      suiteKind: suiteMatch ? suiteMatch[1] : "manual",
      probeKey: probeKey,
      probeCode: probeCode,
      dayYmd: dayYmd,
      timeHm: timeHm,
      timestampIso: isoStr,
      epochMs: epochMs,
      phaseId: phaseIdMatch ? phaseIdMatch[1] : "baseline",
      phaseLabel: phaseLabelMatch ? phaseLabelMatch[1] : "خط الأساس القاعدي",
      conditionLabel: condMatch ? condMatch[1] : "اعتيادي",
      formId: formMatch ? formMatch[1] : "A",
      headlineVal: headlineVal,
      numericMetric: numericMetric,
      metricUnit: metricUnit,
      metricPrefix: metricPrefix,
      rawLines: rawLinesWithoutTopNum.slice()
    };
  }

  function parseLongitudinalMarkdown(existingMd) {
    var result = {
      dayMap: {},
      extraSections: [],
      existingRunKeys: {},
      allParsedEntries: []
    };
    if (!existingMd || typeof existingMd !== "string" || !existingMd.trim()) {
      return result;
    }

    var lines = toAsciiDigits(existingMd.replace(/\r\n/g, "\n").replace(/\r/g, "\n")).split("\n");
    var sections = [];
    var currentSec = null;

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (line.indexOf("## ") === 0) {
        if (currentSec) sections.push(currentSec);
        currentSec = { heading: line.trim(), bodyLines: [] };
      } else if (currentSec) {
        currentSec.bodyLines.push(line);
      }
    }
    if (currentSec) sections.push(currentSec);

    for (var s = 0; s < sections.length; s += 1) {
      var sec = sections[s];
      if (sec.heading === METHODOLOGY_HEADING || sec.heading === SUMMARY_HEADING) {
        continue;
      }
      var dayMatch = sec.heading.match(/^##\s+سجل يوم\s+\**(\d{4}-\d{2}-\d{2})\**/);
      if (!dayMatch) {
        var trimmedBody = sec.bodyLines.slice();
        while (trimmedBody.length > 0 && !trimmedBody[trimmedBody.length - 1].trim()) {
          trimmedBody.pop();
        }
        while (trimmedBody.length > 0 && !trimmedBody[0].trim()) {
          trimmedBody.shift();
        }
        result.extraSections.push({
          heading: sec.heading,
          bodyLines: trimmedBody
        });
        continue;
      }

      var dayYmd = dayMatch[1];
      if (!result.dayMap[dayYmd]) result.dayMap[dayYmd] = [];

      var blocks = [];
      var curBlock = null;
      for (var b = 0; b < sec.bodyLines.length; b += 1) {
        var bLine = sec.bodyLines[b];
        if (!bLine.trim()) continue;
        var topMatch = bLine.match(/^([0-9]+)\.\s+(.*)$/);
        if (topMatch) {
          if (curBlock) blocks.push(curBlock);
          curBlock = [topMatch[2]];
        } else if (curBlock && /^\t+/.test(bLine)) {
          curBlock.push(bLine);
        } else if (curBlock) {
          curBlock.push("\t" + bLine.trim());
        }
      }
      if (curBlock) blocks.push(curBlock);

      for (var k = 0; k < blocks.length; k += 1) {
        var parsedItem = parseSingleDayEntryBlock(dayYmd, blocks[k], k);
        result.dayMap[dayYmd].push(parsedItem);
        result.allParsedEntries.push(parsedItem);
        if (parsedItem.runKey) {
          result.existingRunKeys[parsedItem.runKey] = true;
        }
      }
    }

    return result;
  }

  function buildSummarySectionLines(dayKeysDesc, dayMap, nowStampStr) {
    if (!dayKeysDesc || dayKeysDesc.length === 0) {
      return [
        "1. حالة الرصد الطولي: السجل مهيأ لاستقبال الجلسات اليومية المرسلة عبر زر الحفظ من المختبر وتوليد مقارنات الأداء عبر الأيام تلقائياً."
      ];
    }

    var totalDays = dayKeysDesc.length;
    var oldestDay = dayKeysDesc[dayKeysDesc.length - 1];
    var newestDay = dayKeysDesc[0];
    var totalRuns = 0;
    var chronologicalEntries = [];

    for (var d = dayKeysDesc.length - 1; d >= 0; d -= 1) {
      var dk = dayKeysDesc[d];
      var items = dayMap[dk] || [];
      totalRuns += items.length;
      for (var j = 0; j < items.length; j += 1) {
        chronologicalEntries.push(items[j]);
      }
    }

    var out = [];
    out.push(
      "1. نطاق الرصد الطولي: إجمالي الأيام المسجلة **" + totalDays +
      "** من **" + oldestDay + "** إلى **" + newestDay +
      "** بإجمالي **" + totalRuns + "** قياسات محفوظة وآخر تحديث بتاريخ **" + sanitizeVaultText(nowStampStr, true) + "**."
    );

    out.push("2. حصيلة الأيام المسجلة من الأحدث إلى الأقدم:");
    for (var i = 0; i < dayKeysDesc.length; i += 1) {
      var dayKey = dayKeysDesc[i];
      var dayEntries = dayMap[dayKey] || [];
      var lastEntry = dayEntries[dayEntries.length - 1] || {};
      var phLbl = sanitizeVaultText(lastEntry.phaseLabel || "خط الأساس القاعدي", true);
      var condLbl = sanitizeVaultText(lastEntry.conditionLabel || "اعتيادي", true);

      var metricSummaries = [];
      for (var m = 0; m < dayEntries.length; m += 1) {
        var de = dayEntries[m];
        if (de.probeCode && de.headlineVal) {
          metricSummaries.push("**" + sanitizeVaultText(de.probeCode, true) + "** بقيمة **" + sanitizeVaultText(de.headlineVal, true) + "**");
        }
      }
      var metricsTail = metricSummaries.length > 0
        ? metricSummaries.slice(0, 8).join("، ")
        : "جلسة مدونة";

      out.push(
        "\t" + (i + 1) + ". يوم **" + dayKey + "** بعدد **" + dayEntries.length +
        "** قياس ضمن مرحلة **" + phLbl + "** وحالة **" + condLbl + "**: سجل " + metricsTail + "."
      );
    }

    // Cross-day repeated probe deltas
    var byProbe = {};
    var probeOrder = [];
    for (var c = 0; c < chronologicalEntries.length; c += 1) {
      var ce = chronologicalEntries[c];
      if (!ce.probeKey || ce.probeKey === "clinical_context" || !Number.isFinite(ce.numericMetric)) continue;
      if (!byProbe[ce.probeKey]) {
        byProbe[ce.probeKey] = [];
        probeOrder.push(ce.probeKey);
      }
      byProbe[ce.probeKey].push(ce);
    }

    var repeatedLines = [];
    for (var p = 0; p < probeOrder.length; p += 1) {
      var pk = probeOrder[p];
      var arr = byProbe[pk];
      if (arr.length < 2) continue;
      var first = arr[0];
      var latest = arr[arr.length - 1];
      var diff = latest.numericMetric - first.numericMetric;
      var dec = (latest.metricUnit === " s⁻¹" || latest.metricPrefix === "K=") ? 2 : 1;
      var firstDisp = (first.metricPrefix || "") + fmtNum(first.numericMetric, dec) + (first.metricUnit || "");
      var latestDisp = (latest.metricPrefix || "") + fmtNum(latest.numericMetric, dec) + (latest.metricUnit || "");
      var diffDisp = fmtSignedNum(diff, latest.metricUnit || "", dec);

      repeatedLines.push(
        "مسبار **" + sanitizeVaultText(latest.probeCode, true) + "**: انتقل من **" + firstDisp +
        "** في **" + first.dayYmd + "** إلى **" + latestDisp + "** في **" + latest.dayYmd +
        "** بفارق **" + diffDisp + "** عبر **" + arr.length + "** قياسات."
      );
    }

    if (repeatedLines.length > 0) {
      out.push("3. مقارنة التغير عبر الأيام للمسابير المتكررة:");
      for (var rl = 0; rl < repeatedLines.length; rl += 1) {
        out.push("\t" + (rl + 1) + ". " + repeatedLines[rl]);
      }
    }

    return out;
  }

  function validateObsidianMarkdown(md) {
    var errors = [];
    var text = String(md || "");
    if (/[<>]/.test(text)) {
      errors.push("Angle brackets < or > detected");
    }
    if (/\|/.test(text)) {
      errors.push("Pipe character | (table syntax) detected");
    }
    if (/`/.test(text)) {
      errors.push("Backtick character detected");
    }
    if (/[\u0660-\u0669\u06F0-\u06F9]/.test(text)) {
      errors.push("Hindi/Eastern digits detected instead of ASCII 0-9");
    }

    var lines = text.replace(/\r\n/g, "\n").split("\n");
    var inSection = false;
    var expectedTopNum = 1;
    var sawListItemInSection = false;
    var blankAfterListItem = false;

    for (var i = 0; i < lines.length; i += 1) {
      var ln = lines[i];
      if (!ln.trim()) {
        if (inSection && sawListItemInSection) {
          blankAfterListItem = true;
        }
        continue;
      }
      if (/^\t*[-*+•]\s/.test(ln)) {
        errors.push("Unnumbered bullet detected at line " + (i + 1));
      }
      if (ln.indexOf("# ") === 0) {
        inSection = false;
        continue;
      }
      if (ln.indexOf("## ") === 0) {
        inSection = true;
        expectedTopNum = 1;
        sawListItemInSection = false;
        blankAfterListItem = false;
        continue;
      }
      if (inSection) {
        if (blankAfterListItem) {
          errors.push("Blank line between list items inside section at line " + (i + 1));
          blankAfterListItem = false;
        }
        var topM = ln.match(/^([0-9]+)\.\s+(.*)$/);
        if (topM) {
          var actualNum = Number(topM[1]);
          if (actualNum !== expectedTopNum) {
            errors.push("Expected top-level item " + expectedTopNum + ". but found " + actualNum + ". at line " + (i + 1));
          }
          expectedTopNum = actualNum + 1;
          sawListItemInSection = true;
        } else if (/^\t+[0-9]+\.\s+/.test(ln)) {
          sawListItemInSection = true;
        }
      }
    }

    return { ok: errors.length === 0, errors: errors };
  }

  function mergeEntriesIntoMarkdown(existingMd, incomingEntries, nowEpochMs) {
    var parsed = parseLongitudinalMarkdown(existingMd);
    var dayMap = parsed.dayMap;
    var existingRunKeys = Object.assign({}, parsed.existingRunKeys);

    var incoming = Array.isArray(incomingEntries) ? incomingEntries : [];
    var addedEntries = [];
    var touchedDaysMap = {};

    for (var i = 0; i < incoming.length; i += 1) {
      var ent = incoming[i];
      if (!ent || !ent.runKey) continue;
      if (existingRunKeys[ent.runKey]) continue;

      existingRunKeys[ent.runKey] = true;
      addedEntries.push(ent);
      touchedDaysMap[ent.dayYmd] = true;

      if (!dayMap[ent.dayYmd]) dayMap[ent.dayYmd] = [];
      dayMap[ent.dayYmd].push({
        runKey: ent.runKey,
        suiteKind: ent.suiteKind,
        probeKey: ent.probeKey,
        probeCode: ent.probeCode,
        dayYmd: ent.dayYmd,
        timeHm: ent.timeHm,
        timestampIso: ent.timestampIso,
        epochMs: ent.epochMs,
        phaseId: ent.phaseId,
        phaseLabel: ent.phaseLabel,
        conditionLabel: ent.conditionLabel,
        formId: ent.formId,
        headlineVal: ent.headlineVal,
        numericMetric: ent.numericMetric,
        metricUnit: ent.metricUnit,
        metricPrefix: ent.metricPrefix,
        rawLines: renderEntryBodyLines(ent)
      });
    }

    var dayKeysDesc = Object.keys(dayMap).sort(function (a, b) {
      return a < b ? 1 : a > b ? -1 : 0;
    });

    var totalRuns = 0;
    for (var d = 0; d < dayKeysDesc.length; d += 1) {
      var dk = dayKeysDesc[d];
      dayMap[dk].sort(function (a, b) {
        return (a.epochMs || 0) - (b.epochMs || 0);
      });
      totalRuns += dayMap[dk].length;
    }

    var refMs = parseEpochMs(nowEpochMs) || Date.now();
    var nowStampStr = formatLocalYmd(refMs) + " " + formatLocalHm(refMs);

    var outLines = [];
    outLines.push(DOC_TITLE);
    outLines.push("");
    outLines.push(METHODOLOGY_HEADING);
    for (var m = 0; m < METHODOLOGY_LINES.length; m += 1) {
      outLines.push(METHODOLOGY_LINES[m]);
    }
    outLines.push("");
    outLines.push(SUMMARY_HEADING);
    var summaryLines = buildSummarySectionLines(dayKeysDesc, dayMap, nowStampStr);
    for (var s = 0; s < summaryLines.length; s += 1) {
      outLines.push(summaryLines[s]);
    }

    for (var k = 0; k < dayKeysDesc.length; k += 1) {
      var dayKey = dayKeysDesc[k];
      var entriesForDay = dayMap[dayKey];
      if (!entriesForDay || entriesForDay.length === 0) continue;
      outLines.push("");
      outLines.push(DAY_HEADING_PREFIX + "**" + dayKey + "**");
      for (var e = 0; e < entriesForDay.length; e += 1) {
        var rawBlock = entriesForDay[e].rawLines;
        outLines.push((e + 1) + ". " + rawBlock[0]);
        for (var sub = 1; sub < rawBlock.length; sub += 1) {
          outLines.push(rawBlock[sub]);
        }
      }
    }

    for (var ex = 0; ex < parsed.extraSections.length; ex += 1) {
      var extra = parsed.extraSections[ex];
      outLines.push("");
      outLines.push(extra.heading);
      for (var el = 0; el < extra.bodyLines.length; el += 1) {
        outLines.push(extra.bodyLines[el]);
      }
    }

    var finalDoc = toAsciiDigits(outLines.join("\n")) + "\n";
    var validation = validateObsidianMarkdown(finalDoc);

    return {
      addedCount: addedEntries.length,
      addedEntries: addedEntries,
      touchedDays: Object.keys(touchedDaysMap).sort(),
      totalDays: dayKeysDesc.length,
      totalRuns: totalRuns,
      allRunKeys: existingRunKeys,
      updatedDocument: finalDoc,
      validation: validation
    };
  }

  /* ================= 6. GITHUB CONTENTS API NETWORK LAYER ================= */

  function encodeSegment(seg) {
    return encodeURIComponent(String(seg == null ? "" : seg));
  }

  function encodeRepoPath(path) {
    return String(path == null ? "" : path)
      .split("/")
      .filter(function (p) { return p.length > 0; })
      .map(encodeSegment)
      .join("/");
  }

  function buildHeaders(token, withJsonContentType) {
    var h = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (withJsonContentType) {
      h["Content-Type"] = "application/json; charset=utf-8";
    }
    return h;
  }

  async function defaultFetchTransport(req) {
    var init = {
      method: req.method || "GET",
      headers: req.headers || {},
      cache: "no-store"
    };
    if (req.body != null) {
      init.body = req.body;
    }
    var resp = await fetch(req.url, init);
    var bodyText = await resp.text();
    return {
      status: resp.status,
      body: bodyText
    };
  }

  function executeHttp(req) {
    var fn = customTransport || defaultFetchTransport;
    return fn(req);
  }

  async function testConnection(configOverride) {
    var candidate = configOverride ? Object.assign({}, loadConfig(), configOverride) : loadConfig();
    var check = validateConfig(candidate, true);
    if (!check.ok) {
      return { ok: false, status: "invalid", message: check.error };
    }
    var cfg = check.config;
    var url = customApiBaseUrl.replace(/\/+$/, "") + "/repos/" + encodeSegment(cfg.owner) + "/" + encodeSegment(cfg.repo);

    var resp;
    try {
      resp = await executeHttp({
        method: "GET",
        url: url,
        headers: buildHeaders(cfg.token, false)
      });
    } catch (_) {
      return {
        ok: false,
        isNetworkError: true,
        status: "network_error",
        message: "تعذر الاتصال بالإنترنت — تحقق من الشبكة وحاول مجدداً."
      };
    }

    if (resp.status === 200) {
      var pushPerm = null;
      try {
        var parsed = JSON.parse(resp.body || "{}");
        if (parsed && parsed.permissions && typeof parsed.permissions.push === "boolean") {
          pushPerm = parsed.permissions.push;
        }
      } catch (_) {}

      if (pushPerm === false) {
        return {
          ok: false,
          status: "warning",
          message: "تم الوصول للمستودع لكن الرمز يفتقر لصلاحية الكتابة (Contents: Read and write)."
        };
      }
      saveConfig(cfg);
      return {
        ok: true,
        status: "connected",
        message: "الاتصال ناجح ✓ المستودع " + cfg.owner + "/" + cfg.repo + " جاهز لحفظ النتائج عبر الأيام."
      };
    }
    if (resp.status === 401) {
      return { ok: false, isAuthError: true, status: "auth_error", message: "فشل المصادقة (401): رمز GitHub غير صالح أو منتهي الصلاحية." };
    }
    if (resp.status === 403) {
      return { ok: false, isAuthError: true, status: "forbidden", message: "صلاحيات غير كافية (403): فعّل صلاحية Contents بمستوى Read and write." };
    }
    if (resp.status === 404) {
      return { ok: false, isAuthError: true, status: "not_found", message: "المستودع غير موجود أو الرمز لا يملك صلاحية الوصول إليه (404)." };
    }
    return { ok: false, status: "http_error", message: "فشل اختبار الاتصال برمز حالة (" + resp.status + ")." };
  }

  async function fetchRemoteMarkdownFile(cfg) {
    var base = customApiBaseUrl.replace(/\/+$/, "");
    var contentsBase =
      base + "/repos/" + encodeSegment(cfg.owner) + "/" + encodeSegment(cfg.repo) +
      "/contents/" + encodeRepoPath(cfg.filePath);
    var getUrl = contentsBase + "?ref=" + encodeSegment(cfg.branch);
    var headers = buildHeaders(cfg.token, false);

    var resp = await executeHttp({
      method: "GET",
      url: getUrl,
      headers: headers
    });

    if (resp.status === 404) {
      return { ok: true, exists: false, sha: null, content: "", contentsBase: contentsBase };
    }
    if (resp.status === 401) {
      return { ok: false, isAuthError: true, error: "فشل المصادقة (401): تحقق من رمز الوصول الدقيق (Fine-Grained PAT)." };
    }
    if (resp.status === 403) {
      return { ok: false, isAuthError: true, error: "صلاحيات غير كافية (403): يتطلب صلاحية Contents قراءة وكتابة." };
    }
    if (resp.status !== 200) {
      return { ok: false, error: "تعذر قراءة ملف السجل من GitHub (" + resp.status + ")." };
    }

    var obj;
    try {
      obj = JSON.parse(resp.body || "{}");
    } catch (_) {
      return { ok: false, error: "تعذر تحليل استجابة GitHub لملف السجل." };
    }

    if (Array.isArray(obj) || (obj.type && obj.type !== "file")) {
      return { ok: false, error: "المسار المحدد يشير إلى مجلد وليس ملف ماركداون (.md)." };
    }
    if (!obj.sha) {
      return { ok: false, error: "لم تُرجع واجهة GitHub بصمة SHA للملف." };
    }

    var decoded = "";
    if (typeof obj.content === "string" && obj.content.replace(/\s+/g, "").length > 0) {
      decoded = base64ToUtf8(obj.content);
    } else if (Number(obj.size) > 0 && obj.sha) {
      var blobUrl = base + "/repos/" + encodeSegment(cfg.owner) + "/" + encodeSegment(cfg.repo) + "/git/blobs/" + encodeSegment(obj.sha);
      var blobResp = await executeHttp({ method: "GET", url: blobUrl, headers: headers });
      if (blobResp.status !== 200) {
        return { ok: false, error: "تعذر قراءة محتوى الملف الكبير من GitHub (" + blobResp.status + ")." };
      }
      var blobObj = JSON.parse(blobResp.body || "{}");
      decoded = base64ToUtf8(blobObj.content || "");
    }

    return {
      ok: true,
      exists: true,
      sha: obj.sha,
      content: decoded,
      contentsBase: contentsBase
    };
  }

  async function pushToRepo(options) {
    if (syncInFlightPromise) {
      return syncInFlightPromise;
    }

    var opts = options || {};
    syncInFlightPromise = (async function () {
      syncSettingsInputsIfPresent();
      var currentCfg = opts.config ? normalizeConfig(Object.assign({}, loadConfig(), opts.config)) : loadConfig();
      var check = validateConfig(currentCfg, true);
      if (!check.ok) {
        return {
          ok: false,
          needsToken: Boolean(check.needsToken),
          isAuthError: Boolean(check.isAuthError),
          message: check.error
        };
      }
      var cfg = check.config;

      if (opts.includeDailyCheckin) {
        recordDailyCheckin({ timestamp: opts.nowEpochMs || Date.now() });
      }

      var allEntries = Array.isArray(opts.entriesOverride) ? opts.entriesOverride : collectAllLocalEntries();
      if (allEntries.length === 0) {
        return {
          ok: false,
          status: "empty_local",
          message: "لا توجد نتائج مسجلة بعد — أكمل مسباراً واحداً على الأقل أو احفظ مؤشرات اليوم ثم اضغط حفظ."
        };
      }

      var headersJson = buildHeaders(cfg.token, true);

      for (var attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
        var remote;
        try {
          remote = await fetchRemoteMarkdownFile(cfg);
        } catch (_) {
          return {
            ok: false,
            isNetworkError: true,
            message: "تعذر الاتصال بالإنترنت — جميع النتائج محفوظة محلياً وبانتظار الإرسال."
          };
        }

        if (!remote.ok) {
          return {
            ok: false,
            isAuthError: Boolean(remote.isAuthError),
            message: remote.error
          };
        }

        var mergeRes = mergeEntriesIntoMarkdown(remote.content, allEntries, opts.nowEpochMs || Date.now());
        if (!mergeRes.validation.ok) {
          return {
            ok: false,
            message: "فشل فحص تنسيق السجل قبل الإرسال: " + mergeRes.validation.errors[0]
          };
        }

        var mergedFingerprints = Object.assign({}, cfg.syncedFingerprints, mergeRes.allRunKeys);

        if (mergeRes.addedCount === 0 && remote.exists) {
          saveConfig({ syncedFingerprints: mergedFingerprints });
          refreshUi();
          return {
            ok: true,
            status: "up_to_date",
            addedCount: 0,
            totalDays: mergeRes.totalDays,
            totalRuns: mergeRes.totalRuns,
            message: "جميع النتائج الحالية (" + mergeRes.totalRuns + " قياس عبر " + mergeRes.totalDays + " أيام) محفوظة مسبقاً في الريبو ✓"
          };
        }

        var daysTag = mergeRes.touchedDays.length > 0
          ? mergeRes.touchedDays.join(", ")
          : formatLocalYmd(Date.now());
        var commitMsg =
          "chore(psycho): save " + mergeRes.addedCount + " neuro-lab result(s) [" + daysTag + "]";

        var putPayloadObj = {
          message: commitMsg,
          content: utf8ToBase64(mergeRes.updatedDocument),
          branch: cfg.branch
        };
        if (remote.sha) {
          putPayloadObj.sha = remote.sha;
        }

        var putResp;
        try {
          putResp = await executeHttp({
            method: "PUT",
            url: remote.contentsBase,
            headers: headersJson,
            body: JSON.stringify(putPayloadObj)
          });
        } catch (_) {
          return {
            ok: false,
            isNetworkError: true,
            message: "انقطع الاتصال أثناء الإرسال — النتائج محفوظة محلياً ويمكن إعادة إرسالها."
          };
        }

        if (putResp.status === 200 || putResp.status === 201) {
          var commitSha = null;
          try {
            var putJson = JSON.parse(putResp.body || "{}");
            if (putJson && putJson.commit && putJson.commit.sha) {
              commitSha = String(putJson.commit.sha);
            }
          } catch (_) {}

          var nowIso = new Date().toISOString();
          saveConfig({
            owner: cfg.owner,
            repo: cfg.repo,
            branch: cfg.branch,
            filePath: cfg.filePath,
            token: cfg.token,
            lastSyncedAt: nowIso,
            lastCommitSha: commitSha,
            syncedFingerprints: mergedFingerprints
          });
          refreshUi();

          var shortSha = commitSha ? commitSha.slice(0, 7) : "";
          return {
            ok: true,
            status: "pushed",
            addedCount: mergeRes.addedCount,
            touchedDays: mergeRes.touchedDays,
            totalDays: mergeRes.totalDays,
            totalRuns: mergeRes.totalRuns,
            commitSha: commitSha,
            message:
              "تم حفظ وإرسال " + mergeRes.addedCount + " نتيجة إلى " + cfg.repo +
              " بنجاح ✓ (إجمالي " + mergeRes.totalDays + " أيام" + (shortSha ? " · " + shortSha : "") + ")"
          };
        }

        if (putResp.status === 409) {
          if (attempt < MAX_CONFLICT_RETRIES) {
            continue;
          }
          return {
            ok: false,
            message: "تعارض متكرر أثناء التحديث في GitHub (409) — يرجى المحاولة مرة أخرى."
          };
        }
        if (putResp.status === 401) {
          return { ok: false, isAuthError: true, message: "فشل المصادقة (401): تحقق من صلاحية رمز GitHub." };
        }
        if (putResp.status === 403) {
          return { ok: false, isAuthError: true, message: "صلاحيات غير كافية (403): فعّل صلاحية Contents قراءة وكتابة." };
        }
        if (putResp.status === 422) {
          return { ok: false, message: "رفض GitHub التحديث (422): تحقق من اسم الفرع ومسار الملف." };
        }
        return {
          ok: false,
          message: "تعذر حفظ النتائج في GitHub برمز حالة (" + putResp.status + ")."
        };
      }

      return { ok: false, message: "تعذر إتمام المزامنة بعد عدة محاولات." };
    })();

    try {
      setGlobalButtonsLoading(true);
      return await syncInFlightPromise;
    } finally {
      syncInFlightPromise = null;
      setGlobalButtonsLoading(false);
    }
  }

  /* ================= 7. RESTORE / PULL FROM REPO ACROSS DEVICES ================= */

  function extractNumberAfterLabel(text, labelPattern) {
    var re = new RegExp(labelPattern + "\\s*\\*\\*([+-]?\\d+(?:\\.\\d+)?)");
    var m = text.match(re);
    return m ? Number(m[1]) : null;
  }

  function reconstructLocalStatesFromParsed(parsedEntries) {
    var importedDeep = 0;
    var importedV2 = 0;
    var importedFalsify = 0;

    var DC = root.NeuroLab && root.NeuroLab.DeepCore;
    var A = (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || null;
    var FC = root.NeuroLab && root.NeuroLab.FalsifyCore;

    var deepCur = DC && typeof DC.loadState === "function" ? DC.loadState() : null;
    var deepExistingKeys = {};
    if (deepCur && Array.isArray(deepCur.history)) {
      for (var dh = 0; dh < deepCur.history.length; dh += 1) {
        var di = deepCur.history[dh];
        var dk = di.syncRunKey || ("sem|" + di.expId + "|" + Math.floor(parseEpochMs(di.timestamp) / 1000));
        deepExistingKeys[dk] = true;
        deepExistingKeys["sem|" + di.expId + "|" + Math.floor(parseEpochMs(di.timestamp) / 1000)] = true;
      }
    }

    var deepToMerge = [];
    var v2RecordsToMerge = [];
    var falsifyToMerge = [];

    for (var i = 0; i < parsedEntries.length; i += 1) {
      var pe = parsedEntries[i];
      var fullText = (pe.rawLines || []).join(" ");

      if (pe.suiteKind === "deep_v3" && V3_PROBE_META[pe.probeKey]) {
        var semKey = "sem|" + pe.probeKey + "|" + Math.floor(pe.epochMs / 1000);
        if (deepExistingKeys[pe.runKey] || deepExistingKeys[semKey]) continue;
        deepExistingKeys[pe.runKey] = true;
        deepExistingKeys[semKey] = true;

        var rec = {
          expId: pe.probeKey,
          syncRunKey: pe.runKey,
          timestamp: pe.timestampIso,
          formId: pe.formId || "A",
          phase: pe.phaseId || "baseline",
          isFamiliarization: false,
          calibratedScorePct: extractNumberAfterLabel(fullText, "الدرجة المعايرة") ?? 0,
          alertness: extractNumberAfterLabel(fullText, "اليقظة") ?? 8,
          sleepQuality: extractNumberAfterLabel(fullText, "النوم") ?? 6,
          nasalPatency: extractNumberAfterLabel(fullText, "المجرى الهوائي") ?? 5,
          refreshHz: extractNumberAfterLabel(fullText, "التردد") ?? 60
        };

        if (pe.probeKey === "d1_tbrs") {
          rec.pTargetHighPct = extractNumberAfterLabel(fullText, "صمود الحمل العالي") ?? (pe.numericMetric || 0);
          rec.pTargetLowPct = extractNumberAfterLabel(fullText, "دقة الحمل المنخفض") ?? rec.pTargetHighPct;
          rec.deltaTbrs = extractNumberAfterLabel(fullText, "فارق الحمل") ?? 0;
          rec.pSwapHighCorrPct = extractNumberAfterLabel(fullText, "تبديل المواقع") ?? 0;
          rec.pGuessHighPct = extractNumberAfterLabel(fullText, "تخمين عشوائي") ?? 0;
          rec.clLow = extractNumberAfterLabel(fullText, "حمل المعالجة المنخفض") ?? 0.33;
          rec.clHigh = extractNumberAfterLabel(fullText, "والعالي") ?? 0.58;
          rec.procAccPct = extractNumberAfterLabel(fullText, "دقة الأحكام البصرية") ?? 90;
          rec.procMeanRtMs = extractNumberAfterLabel(fullText, "بمتوسط زمن") ?? 600;
        } else if (pe.probeKey === "d2_refback_m3") {
          rec.pTargetPct = extractNumberAfterLabel(fullText, "إصابة الهدف") ?? (pe.numericMetric || 0);
          rec.lag0AccPct = extractNumberAfterLabel(fullText, "البؤرة النشطة") ?? rec.pTargetPct;
          rec.lag1PlusAccPct = extractNumberAfterLabel(fullText, "الرف الجانبي") ?? rec.pTargetPct;
          rec.pSwapCorrPct = extractNumberAfterLabel(fullText, "تبديل الأدوار") ?? 0;
          rec.pStaleCorrPct = extractNumberAfterLabel(fullText, "أثر متقادم") ?? 0;
          rec.pGuessPct = extractNumberAfterLabel(fullText, "تخمين صافي") ?? 0;
          rec.redAccPct = extractNumberAfterLabel(fullText, "بوابة التحديث الحمراء") ?? 85;
          rec.blueAccPct = extractNumberAfterLabel(fullText, "وبوابة المقارنة الزرقاء") ?? 85;
        } else if (pe.probeKey === "d3_bays_analog") {
          var kM = fullText.match(/السعة الفعالة \*\*K=([+-]?\d+(?:\.\d+)?)\*\*/);
          rec.K = kM ? Number(kM[1]) : (pe.numericMetric || 0);
          rec.alphaPct = extractNumberAfterLabel(fullText, "احتمال الهدف") ?? 0;
          rec.betaPct = extractNumberAfterLabel(fullText, "التبديل المكاني") ?? 0;
          rec.gammaPct = extractNumberAfterLabel(fullText, "التخمين") ?? 0;
          rec.sigmaDeg = extractNumberAfterLabel(fullText, "انحراف الدقة") ?? 15;
          rec.betaShortPct = extractNumberAfterLabel(fullText, "تبديل الفاصل القصير") ?? rec.betaPct;
          rec.deltaGammaDelayPct = extractNumberAfterLabel(fullText, "تغير التخمين عبر التأخير") ?? 0;
          rec.cMAE = extractNumberAfterLabel(fullText, "متوسط الخطأ الزاوي") ?? 15;
        } else if (pe.probeKey === "d4_consolidation_soa") {
          var soaM = fullText.match(/عتبة التوطيد \*\*([^*]+)\*\*/);
          var soaRaw = soaM ? soaM[1] : "850 ms";
          var cleanSoaDigits = soaRaw.replace(/,/g, "");
          var numSoa = cleanSoaDigits.match(/(\d+(?:\.\d+)?)/);
          rec.soa75Ms = numSoa ? Number(numSoa[1]) : 850;
          rec.soa75AtFloor = soaRaw.indexOf("أقل من") !== -1 || soaRaw.indexOf("≤") !== -1;
          rec.soa75ExceededCeiling = soaRaw.indexOf("فوق") !== -1 || soaRaw.indexOf("≥") !== -1;
          rec.aucConsPct = extractNumberAfterLabel(fullText, "مساحة التوطيد") ?? (pe.numericMetric || 0);
          rec.aucRawPct = extractNumberAfterLabel(fullText, "المتوسط الخام") ?? rec.aucConsPct;
          rec.interruptAccPct = extractNumberAfterLabel(fullText, "القرار الرجعي") ?? 90;
        } else if (pe.probeKey === "d5_pvt5") {
          rec.meanReciprocalSpeed = extractNumberAfterLabel(fullText, "السرعة التبادلية") ?? (pe.numericMetric || 0);
          rec.medianRtMs = extractNumberAfterLabel(fullText, "الوسيط") ?? 280;
          rec.lapses500Pct = extractNumberAfterLabel(fullText, "الهفوات الكبرى والصغرى") ?? 0;
          rec.falseStarts = extractNumberAfterLabel(fullText, "الاستباق") ?? 0;
          var distM = fullText.match(/تفكيك التوزيع \*\*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*ms\*\*/);
          rec.muMs = distM ? Number(distM[1]) : 250;
          rec.sigmaMs = distM ? Number(distM[2]) : 20;
          rec.tauMs = distM ? Number(distM[3]) : 35;
          rec.betaToTRecipPerMin = extractNumberAfterLabel(fullText, "ميل الاستدامة") ?? 0;
        }

        deepToMerge.push(rec);
      } else if (pe.suiteKind === "surgical_v2" && pe.probeKey && pe.probeKey !== "battery_v2" && V2_PROBE_META[pe.probeKey]) {
        v2RecordsToMerge.push({
          id: pe.runKey.replace(/^v2-/, ""),
          probeId: pe.probeKey,
          timestamp: pe.epochMs,
          score: Number.isFinite(pe.numericMetric) ? pe.numericMetric : 0,
          rtMeanMs: extractNumberAfterLabel(fullText, "متوسط زمن الاستجابة") ?? 0,
          phase: pe.phaseId || "baseline",
          alertness: extractNumberAfterLabel(fullText, "اليقظة") ?? 8,
          sleepQuality: extractNumberAfterLabel(fullText, "النوم") ?? 6,
          nasalPatency: extractNumberAfterLabel(fullText, "المجرى الهوائي") ?? 5
        });
      } else if (pe.suiteKind === "falsify_v1" && FALSIFY_PROBE_META[pe.probeKey]) {
        var fRec = {
          expId: pe.probeKey,
          syncRunKey: pe.runKey,
          timestamp: pe.timestampIso,
          phase: pe.phaseId || "baseline"
        };
        if (pe.probeKey === "f1_crossmodal") {
          fRec.svPct = extractNumberAfterLabel(fullText, "مربعات مع حساب") ?? (pe.numericMetric || 0);
          fRec.vvPct = extractNumberAfterLabel(fullText, "كلمات مع حساب") ?? 0;
          fRec.ssPct = extractNumberAfterLabel(fullText, "مربعات مع شكل") ?? 0;
          fRec.vsPct = extractNumberAfterLabel(fullText, "كلمات مع شكل") ?? 0;
        } else if (pe.probeKey === "f2_suppression") {
          fRec.spatialVocalPct = extractNumberAfterLabel(fullText, "دقة المربعات مع كتم اللسان") ?? (pe.numericMetric || 0);
          fRec.spatialSilentPct = extractNumberAfterLabel(fullText, "صامت") ?? 0;
          fRec.spatialDropPct = extractNumberAfterLabel(fullText, "هبوط الكتم") ?? 0;
          fRec.tongueFreezeCount = extractNumberAfterLabel(fullText, "توقف اللسان") ?? 0;
        } else if (pe.probeKey === "f3_spatial_slots") {
          fRec.spatial3Pct = extractNumberAfterLabel(fullText, "الصناديق المكانية") ?? (pe.numericMetric || 0);
          fRec.verbal3Pct = extractNumberAfterLabel(fullText, "التحديث النصي") ?? 0;
          fRec.spatialRescueDeltaPct = extractNumberAfterLabel(fullText, "فارق الإنقاذ المكاني") ?? 0;
        } else if (pe.probeKey === "f4_polarity_axis") {
          fRec.axisReliefPct = extractNumberAfterLabel(fullText, "انمحاء ضريبة القلب") ?? (pe.numericMetric || 0);
          fRec.verbalFlipCostMs = extractNumberAfterLabel(fullText, "كلفة القلب اللفظي") ?? 0;
          fRec.axisFlipCostMs = extractNumberAfterLabel(fullText, "مع المسطرة البصرية") ?? 0;
          fRec.nonSpatialRuleFlipCostMs = extractNumberAfterLabel(fullText, "عكس القاعدة غير المكاني") ?? 0;
        }
        falsifyToMerge.push(fRec);
      }
    }

    if (deepToMerge.length > 0 && DC && typeof DC.loadState === "function" && typeof DC.importStateJSON === "function") {
      deepToMerge.sort(function (a, b) { return parseEpochMs(b.timestamp) - parseEpochMs(a.timestamp); });
      var latestByExp = {};
      var oldestByExp = {};
      for (var dIdx = 0; dIdx < deepToMerge.length; dIdx += 1) {
        var dItem = deepToMerge[dIdx];
        if (!latestByExp[dItem.expId]) latestByExp[dItem.expId] = dItem;
        oldestByExp[dItem.expId] = dItem;
      }
      var dImport = DC.importStateJSON({
        suite: "neurolab_deep_v3",
        baselineResults: oldestByExp,
        results: latestByExp,
        history: deepToMerge
      });
      if (dImport && dImport.ok) importedDeep = deepToMerge.length;
    }

    if (v2RecordsToMerge.length > 0 && A && typeof A.importJSON === "function") {
      var aImport = A.importJSON(JSON.stringify({ records: v2RecordsToMerge }));
      if (aImport && aImport.ok) importedV2 = Number(aImport.count || 0);
    }

    if (falsifyToMerge.length > 0 && FC && typeof FC.loadState === "function" && typeof FC.importStateJSON === "function") {
      var curF = FC.loadState();
      var existingFSet = {};
      if (curF && Array.isArray(curF.history)) {
        for (var x = 0; x < curF.history.length; x += 1) {
          var fi = curF.history[x];
          existingFSet[fi.syncRunKey || (fi.expId + "|" + Math.floor(parseEpochMs(fi.timestamp) / 1000))] = true;
        }
      }
      var freshF = falsifyToMerge.filter(function (f) {
        return !existingFSet[f.syncRunKey] && !existingFSet[f.expId + "|" + Math.floor(parseEpochMs(f.timestamp) / 1000)];
      });
      if (freshF.length > 0) {
        freshF.sort(function (a, b) { return parseEpochMs(b.timestamp) - parseEpochMs(a.timestamp); });
        var latestF = {};
        for (var y = 0; y < freshF.length; y += 1) {
          if (!latestF[freshF[y].expId]) latestF[freshF[y].expId] = freshF[y];
        }
        var fRes = FC.importStateJSON({ suite: "neurolab_falsify_v1", results: latestF, history: freshF });
        if (fRes && fRes.ok) importedFalsify = freshF.length;
      }
    }

    return {
      importedTotal: importedDeep + importedV2 + importedFalsify,
      importedDeep: importedDeep,
      importedV2: importedV2,
      importedFalsify: importedFalsify
    };
  }

  async function pullFromRepo(configOverride) {
    if (syncInFlightPromise) return syncInFlightPromise;
    syncSettingsInputsIfPresent();
    var candidate = configOverride ? normalizeConfig(Object.assign({}, loadConfig(), configOverride)) : loadConfig();
    var check = validateConfig(candidate, true);
    if (!check.ok) {
      return {
        ok: false,
        needsToken: Boolean(check.needsToken),
        isAuthError: Boolean(check.isAuthError),
        message: check.error
      };
    }
    var cfg = check.config;

    var remote;
    try {
      remote = await fetchRemoteMarkdownFile(cfg);
    } catch (_) {
      return { ok: false, isNetworkError: true, message: "تعذر الاتصال بالإنترنت لاسترجاع السجل." };
    }

    if (!remote.ok) {
      return { ok: false, isAuthError: Boolean(remote.isAuthError), message: remote.error };
    }
    if (!remote.exists || !remote.content.trim()) {
      return { ok: true, status: "empty_remote", importedTotal: 0, message: "ملف السجل في الريبو فارغ حالياً ولا يحتوي على جلسات سابقة." };
    }

    var parsed = parseLongitudinalMarkdown(remote.content);
    var recStats = reconstructLocalStatesFromParsed(parsed.allParsedEntries);

    var nextFps = Object.assign({}, cfg.syncedFingerprints, parsed.existingRunKeys);
    var localNow = collectAllLocalEntries();
    for (var i = 0; i < localNow.length; i += 1) {
      if (parsed.existingRunKeys[localNow[i].runKey]) {
        nextFps[localNow[i].runKey] = true;
      }
    }

    saveConfig({
      owner: cfg.owner,
      repo: cfg.repo,
      branch: cfg.branch,
      filePath: cfg.filePath,
      token: cfg.token,
      syncedFingerprints: nextFps
    });

    if (typeof uiHooks.onRefreshViews === "function") {
      try { uiHooks.onRefreshViews(); } catch (_) {}
    }
    refreshUi();

    var dayCount = Object.keys(parsed.dayMap).length;
    return {
      ok: true,
      status: "pulled",
      totalDays: dayCount,
      totalRemoteRuns: parsed.allParsedEntries.length,
      importedTotal: recStats.importedTotal,
      message:
        recStats.importedTotal > 0
          ? "تم استرجاع ودمج " + recStats.importedTotal + " قياس جديد من الريبو عبر " + dayCount + " أيام ✓"
          : "السجل المحلي متطابق بالفعل مع الريبو (" + parsed.allParsedEntries.length + " قياس عبر " + dayCount + " أيام) ✓"
    };
  }

  /* ================= 8. CROSS-DAY UI RENDERING & BUTTON ORCHESTRATION ================= */

  function notifyToast(msg) {
    if (typeof uiHooks.showToast === "function") {
      uiHooks.showToast(msg);
      return;
    }
    if (typeof document !== "undefined") {
      var toastEl = document.getElementById("toastEl");
      if (toastEl) {
        toastEl.textContent = toAsciiDigits(msg);
        toastEl.hidden = false;
        setTimeout(function () { toastEl.hidden = true; }, 3200);
      }
    }
  }

  function isModalOpen() {
    if (typeof document === "undefined") return false;
    var modal = document.getElementById("repoSyncModal");
    return Boolean(modal && !modal.hidden);
  }

  function buildDayGroupsForUi() {
    var cfg = loadConfig();
    var all = collectAllLocalEntries();
    var map = {};
    for (var i = 0; i < all.length; i += 1) {
      var e = all[i];
      if (!map[e.dayYmd]) map[e.dayYmd] = [];
      map[e.dayYmd].push(Object.assign({}, e, {
        isSynced: Boolean(cfg.syncedFingerprints[e.runKey])
      }));
    }
    var daysDesc = Object.keys(map).sort(function (a, b) {
      return a < b ? 1 : a > b ? -1 : 0;
    });
    return daysDesc.map(function (dayKey, idx) {
      var items = map[dayKey];
      var syncedCount = items.filter(function (x) { return x.isSynced; }).length;
      return {
        dayNumber: daysDesc.length - idx,
        dayYmd: dayKey,
        entries: items,
        totalCount: items.length,
        syncedCount: syncedCount,
        allSynced: syncedCount === items.length,
        latestPhase: items[items.length - 1].phaseLabel,
        latestCondition: items[items.length - 1].conditionLabel
      };
    });
  }

  function renderCrossDayCardHtml(contextId) {
    var stats = getSyncStats();
    var dayGroups = buildDayGroupsForUi();
    var cfg = loadConfig();
    var btnId = contextId ? "btnCrossDaySave_" + contextId : "btnCrossDaySave";
    var pullBtnId = contextId ? "btnCrossDayPull_" + contextId : "btnCrossDayPull";

    var statusChipHtml = stats.unsyncedCount > 0
      ? '<span class="repo-status-chip is-pending">بانتظار الحفظ: <strong class="ltr-iso">' + stats.unsyncedCount + "</strong></span>"
      : (stats.totalLocal > 0
          ? '<span class="repo-status-chip is-synced">محفوظ بالكامل في <span class="ltr-iso">' + escapeHtml(cfg.repo) + "</span> ✓</span>"
          : '<span class="repo-status-chip">جاهز للرصد اليومي</span>');

    var bodyHtml = "";
    if (dayGroups.length === 0) {
      bodyHtml =
        '<div class="empty-state">لم تُسجل جلسات يومية على هذا الجهاز بعد — نفّذ فحصاً ثم اضغط «حفظ النتائج في الريبو»، أو استرجع سجلك السابق من المستودع.</div>';
    } else {
      bodyHtml =
        '<ol class="cross-day-list">' +
        dayGroups.slice(0, 14).map(function (dg) {
          var syncBadge = dg.allSynced
            ? '<span class="delta-pill is-up">مرسل للريبو ✓</span>'
            : '<span class="delta-pill is-neutral">محلي (' + toAsciiDigits((dg.totalCount - dg.syncedCount) + " غير مرسل") + ")</span>";
          var pillsHtml = dg.entries.map(function (en) {
            return (
              '<span class="metric-pill">' +
              '<span>' + escapeHtml(en.probeCode) + ':</span> ' +
              '<strong class="ltr-iso">' + escapeHtml(en.headlineVal) + '</strong>' +
              '</span>'
            );
          }).join("");

          return (
            '<li class="history-item cross-day-item">' +
            '<div class="history-item-body">' +
            '<div class="history-item-head">' +
            '<div class="probe-metrics-row">' +
            '<span class="probe-code">اليوم <span class="ltr-iso">' + dg.dayNumber + "</span></span>" +
            '<strong class="ltr-iso">' + escapeHtml(dg.dayYmd) + "</strong>" +
            '<span class="metric-pill">' + escapeHtml(dg.latestPhase) + "</span>" +
            '<span class="metric-pill">' + escapeHtml(dg.latestCondition) + "</span>" +
            "</div>" +
            syncBadge +
            "</div>" +
            '<div class="probe-metrics-row" style="margin-top:4px;">' + pillsHtml + "</div>" +
            "</div></li>"
          );
        }).join("") +
        "</ol>";
    }

    return (
      '<section class="card repo-crossday-card" aria-label="سجل المتابعة اليومية عبر الأيام">' +
      '<div class="repo-crossday-head">' +
      '<div>' +
      '<h3 class="section-title">سجل المتابعة عبر الأيام والمزامنة مع الريبو (<span class="ltr-iso">' + escapeHtml(cfg.owner + "/" + cfg.repo) + "</span>)</h3>" +
      '<p class="section-sub">تُحفظ النتائج مقسمة تلقائياً حسب تاريخ كل يوم في ملف <span class="ltr-iso">' + escapeHtml(cfg.filePath) + "</span> لمقارنة الأداء عبر الأيام والمراحل</p>" +
      "</div>" +
      '<div class="repo-crossday-actions">' +
      statusChipHtml +
      '<button id="' + escapeHtml(btnId) + '" type="button" class="btn-repo-save" data-repo-save-btn>' +
      renderSaveButtonInnerHtml(stats) +
      "</button>" +
      '<button id="' + escapeHtml(pullBtnId) + '" type="button" class="btn-ghost" data-repo-pull-btn>استرجاع من الريبو</button>' +
      "</div>" +
      "</div>" +
      bodyHtml +
      "</section>"
    );
  }

  function renderSaveButtonInnerHtml(statsOverride) {
    var st = statsOverride || getSyncStats();
    var iconSvg =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
      '<polyline points="17 8 12 3 7 8" />' +
      '<line x1="12" y1="3" x2="12" y2="15" />' +
      "</svg>";

    if (st.unsyncedCount > 0) {
      return (
        iconSvg +
        '<span>حفظ النتائج في الريبو</span>' +
        '<span class="repo-badge ltr-iso">' + toAsciiDigits(st.unsyncedCount) + "</span>"
      );
    }
    if (st.totalLocal > 0 && st.syncedCount === st.totalLocal) {
      return (
        iconSvg +
        '<span>محفوظ في الريبو ✓</span>'
      );
    }
    return iconSvg + '<span>حفظ في الريبو</span>';
  }

  function setGlobalButtonsLoading(isLoading) {
    if (typeof document === "undefined") return;
    var btns = document.querySelectorAll("[data-repo-save-btn]");
    var stats = getSyncStats();
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      b.disabled = Boolean(isLoading);
      if (isLoading) {
        b.classList.add("is-loading");
        b.innerHTML = '<span>جارٍ الحفظ في الريبو...</span>';
      } else {
        b.classList.remove("is-loading");
        b.classList.toggle("is-synced", stats.totalLocal > 0 && stats.unsyncedCount === 0);
        if (b.id === "topRepoSaveBtn") {
          updateTopbarButtonDom(b, stats);
        } else {
          b.innerHTML = renderSaveButtonInnerHtml(stats);
        }
      }
    }
  }

  function updateTopbarButtonDom(topBtn, stats) {
    if (!topBtn) return;
    var st = stats || getSyncStats();
    var iconSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
      '<polyline points="17 8 12 3 7 8" />' +
      '<line x1="12" y1="3" x2="12" y2="15" />' +
      "</svg>";

    topBtn.classList.toggle("has-unsynced", st.unsyncedCount > 0);
    topBtn.classList.toggle("is-synced", st.totalLocal > 0 && st.unsyncedCount === 0);

    if (st.unsyncedCount > 0) {
      topBtn.innerHTML =
        iconSvg +
        '<span class="top-repo-label-full">حفظ في الريبو</span>' +
        '<span class="top-repo-label-short">حفظ</span>' +
        '<span class="repo-badge ltr-iso">' + toAsciiDigits(st.unsyncedCount) + "</span>";
    } else if (st.totalLocal > 0) {
      topBtn.innerHTML =
        iconSvg +
        '<span class="top-repo-label-full">محفوظ بالريبو ✓</span>' +
        '<span class="top-repo-label-short">محفوظ ✓</span>';
    } else {
      topBtn.innerHTML =
        iconSvg +
        '<span class="top-repo-label-full">حفظ في الريبو</span>' +
        '<span class="top-repo-label-short">حفظ</span>';
    }
  }

  function syncSettingsInputsIfPresent() {
    if (typeof document === "undefined") return;
    var ownerEl = document.getElementById("repoOwnerInput");
    var repoEl = document.getElementById("repoNameInput");
    var branchEl = document.getElementById("repoBranchInput");
    var pathEl = document.getElementById("repoPathInput");
    var tokenEl = document.getElementById("repoTokenInput");
    var remEl = document.getElementById("repoRememberTokenInput");
    var condEl = document.getElementById("dayConditionSelect");

    var patch = {};
    var touched = false;
    if (ownerEl && ownerEl.value.trim()) { patch.owner = ownerEl.value; touched = true; }
    if (repoEl && repoEl.value.trim()) { patch.repo = repoEl.value; touched = true; }
    if (branchEl && branchEl.value.trim()) { patch.branch = branchEl.value; touched = true; }
    if (pathEl && pathEl.value.trim()) { patch.filePath = pathEl.value; touched = true; }
    if (remEl) { patch.rememberToken = Boolean(remEl.checked); touched = true; }
    if (tokenEl && tokenEl.value.trim()) { patch.token = tokenEl.value; touched = true; }
    if (condEl && condEl.value) { patch.dayCondition = condEl.value; touched = true; }

    if (touched) {
      saveConfig(patch);
    }
  }

  function hydrateSettingsCardDom() {
    if (typeof document === "undefined") return;
    var cfg = loadConfig();
    var stats = getSyncStats();

    var ownerEl = document.getElementById("repoOwnerInput");
    var repoEl = document.getElementById("repoNameInput");
    var branchEl = document.getElementById("repoBranchInput");
    var pathEl = document.getElementById("repoPathInput");
    var tokenEl = document.getElementById("repoTokenInput");
    var remEl = document.getElementById("repoRememberTokenInput");

    if (ownerEl && document.activeElement !== ownerEl) ownerEl.value = cfg.owner;
    if (repoEl && document.activeElement !== repoEl) repoEl.value = cfg.repo;
    if (branchEl && document.activeElement !== branchEl) branchEl.value = cfg.branch;
    if (pathEl && document.activeElement !== pathEl) pathEl.value = cfg.filePath;
    if (tokenEl && document.activeElement !== tokenEl) tokenEl.value = cfg.token;
    if (remEl) remEl.checked = cfg.rememberToken !== false;

    var condSelects = document.querySelectorAll(".js-day-condition-select");
    for (var i = 0; i < condSelects.length; i += 1) {
      var sel = condSelects[i];
      if (sel.options.length === 0) {
        sel.innerHTML = DAY_CONDITIONS.map(function (c) {
          return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.label) + "</option>";
        }).join("");
      }
      if (sel.value !== cfg.dayCondition) {
        sel.value = cfg.dayCondition;
      }
    }

    var statusBanner = document.getElementById("repoSyncStatusBanner");
    if (statusBanner) {
      var lastTxt = cfg.lastSyncedAt
        ? formatLocalYmd(parseEpochMs(cfg.lastSyncedAt)) + " " + formatLocalHm(parseEpochMs(cfg.lastSyncedAt))
        : "لم يُزامَن بعد";
      var shaTxt = cfg.lastCommitSha ? " · التزام " + cfg.lastCommitSha.slice(0, 7) : "";
      var tokenState = cfg.token ? "الرمز مضبوط ✓" : "بانتظار لصق الرمز (Fine-Grained PAT)";
      statusBanner.innerHTML =
        '<span>الحالة: <strong>' + escapeHtml(tokenState) + '</strong></span>' +
        '<span>غير مرسل: <strong class="ltr-iso">' + toAsciiDigits(stats.unsyncedCount) + '</strong> من <strong class="ltr-iso">' + toAsciiDigits(stats.totalLocal) + '</strong></span>' +
        '<span>آخر إرسال: <strong class="ltr-iso">' + escapeHtml(lastTxt + shaTxt) + '</strong></span>';
    }
  }

  function refreshUi() {
    if (typeof document === "undefined") return;
    var stats = getSyncStats();

    var topBtn = document.getElementById("topRepoSaveBtn");
    if (topBtn && !syncInFlightPromise) {
      updateTopbarButtonDom(topBtn, stats);
    }

    var allSaveBtns = document.querySelectorAll("[data-repo-save-btn]");
    for (var i = 0; i < allSaveBtns.length; i += 1) {
      var b = allSaveBtns[i];
      if (b.id === "topRepoSaveBtn" || syncInFlightPromise) continue;
      b.classList.toggle("is-synced", stats.totalLocal > 0 && stats.unsyncedCount === 0);
      b.innerHTML = renderSaveButtonInnerHtml(stats);
    }

    var crossDayMount = document.getElementById("crossDayTrendsMount");
    if (crossDayMount) {
      crossDayMount.innerHTML = renderCrossDayCardHtml("trends");
    }
    var deepCrossMount = document.getElementById("deepCrossDayMount");
    if (deepCrossMount) {
      deepCrossMount.innerHTML = renderCrossDayCardHtml("deep");
    }

    hydrateSettingsCardDom();
  }

  function openSetupModal(opts) {
    if (typeof document === "undefined") return;
    var o = opts || {};
    pendingSaveAfterModal = Boolean(o.saveAfterConfig);
    pendingPullAfterModal = Boolean(o.pullAfterConfig);
    pendingTriggerButton = o.triggerBtn || null;

    var modal = document.getElementById("repoSyncModal");
    if (!modal) return;

    var cfg = loadConfig();
    var mOwner = document.getElementById("modalRepoOwner");
    var mRepo = document.getElementById("modalRepoName");
    var mBranch = document.getElementById("modalRepoBranch");
    var mPath = document.getElementById("modalRepoPath");
    var mToken = document.getElementById("modalRepoToken");
    var mRem = document.getElementById("modalRepoRemember");
    var mCond = document.getElementById("modalDayCondition");
    var mNote = document.getElementById("modalSessionNote");
    var mFeedback = document.getElementById("modalRepoFeedback");

    if (mOwner) mOwner.value = cfg.owner;
    if (mRepo) mRepo.value = cfg.repo;
    if (mBranch) mBranch.value = cfg.branch;
    if (mPath) mPath.value = cfg.filePath;
    if (mToken) mToken.value = cfg.token;
    if (mRem) mRem.checked = cfg.rememberToken !== false;
    if (mCond) {
      mCond.innerHTML = DAY_CONDITIONS.map(function (c) {
        return '<option value="' + escapeHtml(c.id) + '"' + (c.id === cfg.dayCondition ? " selected" : "") + ">" + escapeHtml(c.label) + "</option>";
      }).join("");
    }
    if (mNote) {
      mNote.value = getActiveSessionNotes();
    }
    if (mFeedback) {
      mFeedback.hidden = true;
      mFeedback.textContent = "";
    }

    modal.hidden = false;
    if (mToken && !cfg.token) {
      setTimeout(function () { try { mToken.focus(); } catch (_) {} }, 30);
    }
  }

  function closeSetupModal() {
    if (typeof document === "undefined") return;
    var modal = document.getElementById("repoSyncModal");
    if (modal) modal.hidden = true;
    pendingSaveAfterModal = false;
    pendingPullAfterModal = false;
    pendingTriggerButton = null;
  }

  async function handleSaveButtonTrigger(btnEl, extraOpts) {
    syncSettingsInputsIfPresent();
    var cfg = loadConfig();
    var stats = getSyncStats();

    if (!cfg.token) {
      openSetupModal({ saveAfterConfig: true, triggerBtn: btnEl });
      return { ok: false, openedModal: true };
    }

    if (stats.totalLocal === 0 && !(extraOpts && extraOpts.includeDailyCheckin)) {
      notifyToast("لا توجد نتائج مسجلة بعد — أكمل فحصاً واحداً على الأقل ثم اضغط حفظ في الريبو.");
      return { ok: false, status: "empty_local" };
    }

    var res = await pushToRepo(extraOpts || {});
    if (res.needsToken || res.isAuthError) {
      openSetupModal({ saveAfterConfig: true, triggerBtn: btnEl });
      var fb = typeof document !== "undefined" ? document.getElementById("modalRepoFeedback") : null;
      if (fb) {
        fb.textContent = toAsciiDigits(res.message);
        fb.className = "repo-modal-feedback is-error";
        fb.hidden = false;
      }
      return res;
    }

    notifyToast(res.message);
    refreshUi();
    return res;
  }

  function bindGlobalEvents() {
    if (typeof document === "undefined") return;

    var modalBackdrop = document.getElementById("repoSyncModal");
    if (modalBackdrop && !modalKeyCaptureBound) {
      modalKeyCaptureBound = true;
      modalBackdrop.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          closeSetupModal();
          return;
        }
        // Stop bubbling at modal boundary so inputs/forms inside modal work 100% normally
        // while window-level Arena shortcuts (Enter/Space/F/J) underneath never fire!
        ev.stopPropagation();
      });
    }

    document.addEventListener("click", function (ev) {
      var saveBtn = ev.target && ev.target.closest ? ev.target.closest("[data-repo-save-btn]") : null;
      if (saveBtn) {
        ev.preventDefault();
        var includeChk = saveBtn.hasAttribute("data-include-checkin");
        handleSaveButtonTrigger(saveBtn, { includeDailyCheckin: includeChk });
        return;
      }

      var pullBtn = ev.target && ev.target.closest ? ev.target.closest("[data-repo-pull-btn]") : null;
      if (pullBtn) {
        ev.preventDefault();
        syncSettingsInputsIfPresent();
        var curCfg = loadConfig();
        if (!curCfg.token) {
          openSetupModal({ saveAfterConfig: false, pullAfterConfig: true, triggerBtn: pullBtn });
          return;
        }
        pullBtn.disabled = true;
        pullFromRepo().then(function (res) {
          pullBtn.disabled = false;
          notifyToast(res.message);
          if (res.isAuthError) {
            openSetupModal({ saveAfterConfig: false, pullAfterConfig: true });
          }
        });
        return;
      }

      var openSettingsBtn = ev.target && ev.target.closest ? ev.target.closest("[data-repo-settings-btn]") : null;
      if (openSettingsBtn) {
        ev.preventDefault();
        openSetupModal({ saveAfterConfig: false });
      }
    });

    document.addEventListener("change", function (ev) {
      var target = ev.target;
      if (!target) return;
      if (target.classList && target.classList.contains("js-day-condition-select")) {
        saveConfig({ dayCondition: target.value });
        refreshUi();
      }
    });

    var testBtn = document.getElementById("btnRepoTestConn");
    if (testBtn) {
      testBtn.addEventListener("click", async function () {
        syncSettingsInputsIfPresent();
        testBtn.disabled = true;
        var origTxt = testBtn.textContent;
        testBtn.textContent = "جارٍ الاختبار...";
        var res = await testConnection();
        testBtn.disabled = false;
        testBtn.textContent = origTxt;
        notifyToast(res.message);
        refreshUi();
      });
    }

    var saveCfgBtn = document.getElementById("btnRepoSaveConfig");
    if (saveCfgBtn) {
      saveCfgBtn.addEventListener("click", function () {
        syncSettingsInputsIfPresent();
        refreshUi();
        notifyToast("تم حفظ إعدادات مستودع GitHub على هذا الجهاز.");
      });
    }

    var pasteBtn = document.getElementById("btnRepoPasteToken");
    if (pasteBtn) {
      pasteBtn.addEventListener("click", async function () {
        if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
          try {
            var txt = await navigator.clipboard.readText();
            var inp = document.getElementById("repoTokenInput");
            if (inp && txt && txt.trim()) {
              inp.value = cleanToken(txt);
              saveConfig({ token: inp.value });
              refreshUi();
              notifyToast("تم لصق رمز الوصول بنجاح.");
              return;
            }
          } catch (_) {}
        }
        var inpFallback = document.getElementById("repoTokenInput");
        if (inpFallback) inpFallback.focus();
        notifyToast("الصق الرمز مباشرة داخل حقل رمز الوصول.");
      });
    }

    var toggleVisBtn = document.getElementById("btnRepoToggleToken");
    if (toggleVisBtn) {
      toggleVisBtn.addEventListener("click", function () {
        var inp = document.getElementById("repoTokenInput");
        if (!inp) return;
        var nextType = inp.type === "password" ? "text" : "password";
        inp.type = nextType;
        toggleVisBtn.textContent = nextType === "password" ? "إظهار" : "إخفاء";
      });
    }

    var clearTokBtn = document.getElementById("btnRepoClearToken");
    if (clearTokBtn) {
      clearTokBtn.addEventListener("click", function () {
        var inp = document.getElementById("repoTokenInput");
        if (inp) inp.value = "";
        clearToken();
        notifyToast("تم مسح رمز GitHub من المتصفح.");
      });
    }

    var modalCloseBtn = document.getElementById("btnCloseRepoModal");
    var modalBackdrop = document.getElementById("repoSyncModal");
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", closeSetupModal);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", function (ev) {
        if (ev.target === modalBackdrop) closeSetupModal();
      });
    }

    var modalPasteBtn = document.getElementById("btnModalPasteToken");
    if (modalPasteBtn) {
      modalPasteBtn.addEventListener("click", async function () {
        var mToken = document.getElementById("modalRepoToken");
        if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
          try {
            var txt = await navigator.clipboard.readText();
            if (mToken && txt && txt.trim()) {
              mToken.value = cleanToken(txt);
              return;
            }
          } catch (_) {}
        }
        if (mToken) mToken.focus();
      });
    }

    var modalForm = document.getElementById("repoSyncModalForm");
    if (modalForm) {
      modalForm.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var mOwner = document.getElementById("modalRepoOwner");
        var mRepo = document.getElementById("modalRepoName");
        var mBranch = document.getElementById("modalRepoBranch");
        var mPath = document.getElementById("modalRepoPath");
        var mToken = document.getElementById("modalRepoToken");
        var mRem = document.getElementById("modalRepoRemember");
        var mCond = document.getElementById("modalDayCondition");
        var mNote = document.getElementById("modalSessionNote");
        var mFeedback = document.getElementById("modalRepoFeedback");
        var submitBtn = document.getElementById("btnModalSaveAndPush");

        var nextCfg = saveConfig({
          owner: mOwner ? mOwner.value : DEFAULT_CONFIG.owner,
          repo: mRepo ? mRepo.value : DEFAULT_CONFIG.repo,
          branch: mBranch ? mBranch.value : DEFAULT_CONFIG.branch,
          filePath: mPath ? mPath.value : DEFAULT_CONFIG.filePath,
          token: mToken ? mToken.value : "",
          rememberToken: mRem ? mRem.checked : true,
          dayCondition: mCond ? mCond.value : "normal"
        });

        if (mNote) {
          var mainNoteInp = document.getElementById("sessionNotesInput");
          if (mainNoteInp) mainNoteInp.value = mNote.value;
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(NOTES_STORAGE_KEY, mNote.value.trim());
            }
          } catch (_) {}
        }

        var vCheck = validateConfig(nextCfg, true);
        if (!vCheck.ok) {
          if (mFeedback) {
            mFeedback.textContent = toAsciiDigits(vCheck.error);
            mFeedback.className = "repo-modal-feedback is-error";
            mFeedback.hidden = false;
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (mFeedback) {
          mFeedback.textContent = "جارٍ التحقق من الاتصال وحفظ النتائج في الريبو...";
          mFeedback.className = "repo-modal-feedback";
          mFeedback.hidden = false;
        }

        var stats = getSyncStats();
        if (pendingPullAfterModal) {
          var pullRes = await pullFromRepo(nextCfg);
          if (submitBtn) submitBtn.disabled = false;
          if (!pullRes.ok) {
            if (mFeedback) {
              mFeedback.textContent = toAsciiDigits(pullRes.message);
              mFeedback.className = "repo-modal-feedback is-error";
              mFeedback.hidden = false;
            }
            return;
          }
          closeSetupModal();
          notifyToast(pullRes.message);
          refreshUi();
        } else if (pendingSaveAfterModal && stats.totalLocal > 0) {
          var pushRes = await pushToRepo();
          if (submitBtn) submitBtn.disabled = false;
          if (!pushRes.ok) {
            if (mFeedback) {
              mFeedback.textContent = toAsciiDigits(pushRes.message);
              mFeedback.className = "repo-modal-feedback is-error";
              mFeedback.hidden = false;
            }
            return;
          }
          closeSetupModal();
          notifyToast(pushRes.message);
          refreshUi();
        } else {
          var connRes = await testConnection(nextCfg);
          if (submitBtn) submitBtn.disabled = false;
          if (!connRes.ok) {
            if (mFeedback) {
              mFeedback.textContent = toAsciiDigits(connRes.message);
              mFeedback.className = "repo-modal-feedback is-error";
              mFeedback.hidden = false;
            }
            return;
          }
          closeSetupModal();
          notifyToast(connRes.message);
          refreshUi();
        }
      });
    }
  }

  function init(opts) {
    var o = opts || {};
    if (typeof o.onRefreshViews === "function") uiHooks.onRefreshViews = o.onRefreshViews;
    if (typeof o.showToast === "function") uiHooks.showToast = o.showToast;
    loadConfig();
    bindGlobalEvents();
    refreshUi();
  }

  var RepoSync = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    DAY_CONDITIONS: DAY_CONDITIONS,
    init: init,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    clearToken: clearToken,
    cleanToken: cleanToken,
    validateConfig: validateConfig,
    sanitizeVaultText: sanitizeVaultText,
    ensureArabicStart: ensureArabicStart,
    utf8ToBase64: utf8ToBase64,
    base64ToUtf8: base64ToUtf8,
    getConditionLabel: getConditionLabel,
    getActiveClinicalSnapshot: getActiveClinicalSnapshot,
    recordDailyCheckin: recordDailyCheckin,
    clearLocalCheckins: clearLocalCheckins,
    collectAllLocalEntries: collectAllLocalEntries,
    getSyncStats: getSyncStats,
    parseLongitudinalMarkdown: parseLongitudinalMarkdown,
    mergeEntriesIntoMarkdown: mergeEntriesIntoMarkdown,
    validateObsidianMarkdown: validateObsidianMarkdown,
    testConnection: testConnection,
    pushToRepo: pushToRepo,
    pullFromRepo: pullFromRepo,
    saveFromButton: handleSaveButtonTrigger,
    openSetupModal: openSetupModal,
    closeSetupModal: closeSetupModal,
    isModalOpen: isModalOpen,
    renderSaveButtonInnerHtml: renderSaveButtonInnerHtml,
    renderCrossDayCardHtml: renderCrossDayCardHtml,
    refreshUi: refreshUi,
    setTransportForTest: function (fn, baseUrl) {
      customTransport = fn || null;
      if (baseUrl) customApiBaseUrl = baseUrl;
    }
  };

  root.NeuroLab.RepoSync = RepoSync;
  root.RepoSync = RepoSync;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = RepoSync;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

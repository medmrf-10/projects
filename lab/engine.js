(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var domRefs = {
    overlay: null,
    stage: null,
    titleEl: null,
    progressEl: null,
    abortBtn: null
  };

  var callbacks = {
    getContext: null,
    onSessionUpdate: null
  };

  var activeTimers = [];
  var activeRafs = [];
  var activeKeyHandler = null;
  var activeVisHandler = null;
  var runToken = 0;

  var sessionState = {
    isBattery: false,
    batteryRunId: null,
    batteryQueue: [],
    batteryIndex: 0,
    batteryScores: {},
    currentProbeId: null,
    contextSnapshot: null,
    tabInterruptions: 0,
    estimatedFrameMs: 16.7,
    encodingGuardActive: false,
    encodingPausedForVisibility: false,
    onEncodingResume: null
  };

  function getStimuli() {
    return (root.NeuroLab && root.NeuroLab.Stimuli) || root.Stimuli || {};
  }

  function getAnalytics() {
    return (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || {};
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveDom() {
    if (!domRefs.overlay && typeof document !== "undefined") {
      domRefs.overlay = document.getElementById("arenaOverlay");
      domRefs.stage = document.getElementById("arenaStage");
      domRefs.titleEl = document.getElementById("arenaTitle");
      domRefs.progressEl = document.getElementById("arenaProgress");
      domRefs.abortBtn = document.getElementById("arenaAbortBtn");
    }
  }

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function scheduleTimer(fn, ms) {
    var token = runToken;
    var id = setTimeout(function () {
      if (token !== runToken) return;
      fn();
    }, Math.max(0, Number(ms) || 0));
    activeTimers.push(id);
    return id;
  }

  // Frame-synchronized onset helper: invokes onPainted(paintTs) on exact VSync paint
  // Includes a 34ms fallback guard so background/headless tabs never stall
  function onNextFramePaint(onPainted) {
    var token = runToken;
    var fired = false;
    function done(ts) {
      if (fired || token !== runToken) return;
      fired = true;
      onPainted(ts);
    }
    if (
      typeof requestAnimationFrame === "function" &&
      (typeof document === "undefined" || document.visibilityState !== "hidden")
    ) {
      var rafId = requestAnimationFrame(function () {
        done(nowMs());
      });
      activeRafs.push(rafId);
      scheduleTimer(function () {
        done(nowMs());
      }, 34);
    } else {
      done(nowMs());
    }
  }

  // Frame-accurate stimulus duration scheduler synchronized to VSync when visible
  function scheduleFrameAccurate(fn, durationMs) {
    var token = runToken;
    var target = nowMs() + Math.max(0, durationMs);
    var completed = false;

    function finish() {
      if (completed || token !== runToken) return;
      completed = true;
      fn();
    }

    if (
      durationMs >= 40 &&
      typeof requestAnimationFrame === "function" &&
      (typeof document === "undefined" || document.visibilityState !== "hidden")
    ) {
      var leadMs = Math.max(0, durationMs - Math.max(18, sessionState.estimatedFrameMs * 1.4));
      scheduleTimer(function () {
        function step() {
          if (completed || token !== runToken) return;
          if (nowMs() >= target - sessionState.estimatedFrameMs * 0.45) {
            finish();
          } else {
            var rId = requestAnimationFrame(step);
            activeRafs.push(rId);
          }
        }
        var r0 = requestAnimationFrame(step);
        activeRafs.push(r0);
      }, leadMs);
      // Safety ceiling in case tab becomes hidden mid-stimulus
      scheduleTimer(finish, durationMs + 36);
    } else {
      scheduleTimer(finish, durationMs);
    }
  }

  // Eliminates 60-130ms pointerup/click release latency for human touch/mouse
  // while remaining 100% compatible with keyboard Enter/Space and programmatic .click()
  function bindFastPress(el, handler) {
    if (!el) return;
    var downLock = false;
    var lockTimer = null;

    el.addEventListener("pointerdown", function (ev) {
      if (el.disabled) return;
      if (typeof ev.button === "number" && ev.button !== 0) return;
      downLock = true;
      clearTimeout(lockTimer);
      lockTimer = setTimeout(function () {
        downLock = false;
      }, 450);
      handler(ev, nowMs());
    });

    el.addEventListener("click", function (ev) {
      if (el.disabled) return;
      if (downLock) {
        downLock = false;
        return;
      }
      handler(ev, nowMs());
    });
  }

  function calibrateDisplayRefresh() {
    if (typeof requestAnimationFrame !== "function") return;
    var stamps = [];
    function probeFrame(ts) {
      stamps.push(ts || nowMs());
      if (stamps.length < 5) {
        requestAnimationFrame(probeFrame);
      } else {
        var diffs = [];
        for (var i = 1; i < stamps.length; i += 1) {
          var d = stamps[i] - stamps[i - 1];
          if (d >= 4 && d <= 35) diffs.push(d);
        }
        if (diffs.length > 0) {
          sessionState.estimatedFrameMs = median(diffs);
        }
      }
    }
    requestAnimationFrame(probeFrame);
  }

  function bindKeyHandler(handler) {
    unbindKeyHandler();
    if (typeof window === "undefined") return;
    activeKeyHandler = function (ev) {
      if (!domRefs.overlay || domRefs.overlay.hidden) return;
      if (ev.repeat) return; // Reject held-key OS autorepeat artifacts
      handler(ev);
    };
    window.addEventListener("keydown", activeKeyHandler);
  }

  function unbindKeyHandler() {
    if (activeKeyHandler && typeof window !== "undefined") {
      window.removeEventListener("keydown", activeKeyHandler);
      activeKeyHandler = null;
    }
  }

  function setEncodingVisibilityGuard(onInterruptedReplay) {
    sessionState.encodingGuardActive = typeof onInterruptedReplay === "function";
    sessionState.encodingPausedForVisibility = false;
    sessionState.onEncodingResume = typeof onInterruptedReplay === "function" ? onInterruptedReplay : null;
  }

  function clearEncodingVisibilityGuard() {
    sessionState.encodingGuardActive = false;
    sessionState.encodingPausedForVisibility = false;
    sessionState.onEncodingResume = null;
  }

  function bindVisibilityGuard() {
    unbindVisibilityGuard();
    if (typeof document === "undefined") return;
    activeVisHandler = function () {
      if (!domRefs.overlay || domRefs.overlay.hidden) return;
      if (document.visibilityState === "hidden") {
        sessionState.tabInterruptions += 1;
        // If tab was hidden mid-flash during transient stimulus encoding, halt unseen flash immediately
        if (sessionState.encodingGuardActive && sessionState.onEncodingResume) {
          var resumeCb = sessionState.onEncodingResume;
          cleanupActive();
          sessionState.encodingPausedForVisibility = true;
          sessionState.onEncodingResume = resumeCb;
          if (domRefs.stage) {
            domRefs.stage.innerHTML =
              '<div class="stimulus-card">' +
              '<div class="warmup-feedback is-warning">توقف العرض العابر مؤقتا بسبب مغادرة التبويب؛ ستُعاد الجولة بمثير جديد فور العودة لضمان سلامة الإدراك البصري.</div>' +
              '<button id="btnResumeEncodingNow" type="button" class="btn-primary">استئناف الجولة بمثير جديد</button>' +
              "</div>";
            var rBtn = document.getElementById("btnResumeEncodingNow");
            if (rBtn) {
              rBtn.addEventListener("click", function () {
                if (!sessionState.onEncodingResume) return;
                var fn = sessionState.onEncodingResume;
                clearEncodingVisibilityGuard();
                fn();
              });
            }
          }
        }
      } else if (document.visibilityState === "visible" && sessionState.encodingPausedForVisibility && sessionState.onEncodingResume) {
        var autoFn = sessionState.onEncodingResume;
        clearEncodingVisibilityGuard();
        scheduleTimer(function () {
          autoFn();
        }, 320);
      }
    };
    document.addEventListener("visibilitychange", activeVisHandler);
  }

  function unbindVisibilityGuard() {
    if (activeVisHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", activeVisHandler);
      activeVisHandler = null;
    }
  }

  function cleanupActive() {
    runToken += 1;
    clearEncodingVisibilityGuard();
    for (var i = 0; i < activeTimers.length; i += 1) {
      clearTimeout(activeTimers[i]);
    }
    activeTimers = [];
    for (var r = 0; r < activeRafs.length; r += 1) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(activeRafs[r]);
      }
    }
    activeRafs = [];
    unbindKeyHandler();
  }

  function openOverlay() {
    resolveDom();
    sessionState.tabInterruptions = 0;
    bindVisibilityGuard();
    calibrateDisplayRefresh();
    if (domRefs.stage && domRefs.stage.parentElement && domRefs.stage.parentElement.classList) {
      domRefs.stage.parentElement.classList.remove("is-canvas-stage");
    }
    if (domRefs.overlay) {
      domRefs.overlay.hidden = false;
      domRefs.overlay.scrollTop = 0;
    }
  }

  function closeOverlay() {
    cleanupActive();
    unbindVisibilityGuard();
    resolveDom();
    if (domRefs.overlay) {
      domRefs.overlay.scrollTop = 0;
      domRefs.overlay.hidden = true;
    }
    if (domRefs.stage) {
      domRefs.stage.innerHTML = "";
    }
    if (callbacks.onSessionUpdate) {
      try {
        callbacks.onSessionUpdate();
      } catch (_) {}
    }
  }

  function setHeader(titleText, progressText) {
    resolveDom();
    if (domRefs.titleEl) {
      domRefs.titleEl.textContent = titleText || "";
    }
    if (domRefs.progressEl) {
      domRefs.progressEl.textContent = progressText || "";
    }
  }

  function findProbeMeta(probeId) {
    var S = getStimuli();
    var list = Array.isArray(S.PROBES) ? S.PROBES : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === probeId) return list[i];
    }
    return {
      id: probeId,
      code: probeId.toUpperCase(),
      title: probeId,
      region: "الشبكة الجبهية التنفيذية",
      deficitName: "قياس وظيفي معزول",
      baselineScore: 40,
      normScore: 85,
      instructions: ["اتبع الخطوات المعروضة على الشاشة بدقة."],
      example: ""
    };
  }

  function mean(nums) {
    if (!nums || nums.length === 0) return 0;
    var s = 0;
    for (var i = 0; i < nums.length; i += 1) s += nums[i];
    return Math.round(s / nums.length);
  }

  function median(nums) {
    if (!nums || nums.length === 0) return 0;
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? Math.round(sorted[m])
      : Math.round((sorted[m - 1] + sorted[m]) / 2);
  }

  // Order-preserving Longest Common Subsequence length (Lewandowsky et al., 2010):
  // Prevents rank-shift zeroing when an early item evaporates while later items are recalled in exact relative order
  function computeOrderedLCS(recalledArr, expectedArr) {
    var m = recalledArr.length;
    var n = expectedArr.length;
    if (m === 0 || n === 0) return 0;
    var dp = [];
    for (var i = 0; i <= m; i += 1) {
      var row = [];
      for (var j = 0; j <= n; j += 1) row.push(0);
      dp.push(row);
    }
    for (var r = 1; r <= m; r += 1) {
      for (var c = 1; c <= n; c += 1) {
        if (recalledArr[r - 1] === expectedArr[c - 1]) {
          dp[r][c] = dp[r - 1][c - 1] + 1;
        } else {
          dp[r][c] = Math.max(dp[r - 1][c], dp[r][c - 1]);
        }
      }
    }
    return dp[m][n];
  }

  // High-Threshold Guess-Corrected Ordered Stream Recall (Macmillan & Creelman, 2005):
  // Honest "__FORGOT__" clicks incur 0 penalty (2/3 ordered = 66.7%), whereas blind foil guessing averages ~0%!
  function scoreOrderedStreamRecall(chosenSlots, expectedOrdered, totalPoolSize) {
    var k = expectedOrdered.length;
    if (k === 0) return { pct: 100, orderedHits: 0, intrusions: 0 };
    var recalled = [];
    var intrusions = 0;
    for (var i = 0; i < chosenSlots.length; i += 1) {
      var v = chosenSlots[i];
      if (!v || v === "__FORGOT__") continue;
      recalled.push(v);
      if (expectedOrdered.indexOf(v) === -1) {
        intrusions += 1;
      }
    }
    var orderedHits = computeOrderedLCS(recalled, expectedOrdered);
    var foilCount = Math.max(1, totalPoolSize - k);
    var guessPenalty = (k / foilCount) * intrusions;
    var netHits = Math.max(0, Math.min(k, orderedHits - guessPenalty));
    return {
      pct: Math.round((netHits / k) * 100),
      orderedHits: orderedHits,
      intrusions: intrusions
    };
  }

  function computeSplitHalf(trialScoresPct) {
    var A = getAnalytics();
    if (typeof A.computeSplitHalfReliability === "function") {
      return A.computeSplitHalfReliability(trialScoresPct);
    }
    if (!trialScoresPct || trialScoresPct.length < 2) return 100;
    var o = [], e = [];
    for (var i = 0; i < trialScoresPct.length; i += 1) {
      if (i % 2 === 0) o.push(trialScoresPct[i]);
      else e.push(trialScoresPct[i]);
    }
    return Math.max(0, Math.min(100, Math.round(100 - Math.abs(mean(o) - mean(e)) * 0.85)));
  }

  function computeLisasSafe(correctRts, allRts, errRate) {
    var A = getAnalytics();
    if (typeof A.computeLISAS === "function") {
      return A.computeLISAS(correctRts, allRts, errRate);
    }
    return mean(allRts);
  }

  function renderDots(total, activeIdx) {
    var html = '<div class="stim-progress-dots">';
    for (var i = 0; i < total; i += 1) {
      var cls = i < activeIdx ? "dot is-done" : i === activeIdx ? "dot is-active" : "dot";
      html += '<span class="' + cls + '"></span>';
    }
    html += "</div>";
    return html;
  }

  function startCountdownBar(barEl, durationMs) {
    if (!barEl || !durationMs || durationMs <= 0) return;
    var token = runToken;
    var startTs = nowMs();
    barEl.style.width = "100%";

    function tick() {
      if (token !== runToken) return;
      var elapsed = nowMs() - startTs;
      var remPct = Math.max(0, Math.min(100, (1 - elapsed / durationMs) * 100));
      barEl.style.width = remPct.toFixed(1) + "%";
      if (remPct <= 25) {
        barEl.classList.add("is-urgent");
      }
      if (elapsed < durationMs && typeof requestAnimationFrame === "function") {
        var rId = requestAnimationFrame(tick);
        activeRafs.push(rId);
      }
    }
    if (typeof requestAnimationFrame === "function") {
      var r0 = requestAnimationFrame(tick);
      activeRafs.push(r0);
    }
  }

  function captureContext(opts) {
    var A = getAnalytics();
    var baseCtx = typeof A.getContext === "function" ? A.getContext() : {};
    var uiCtx = typeof callbacks.getContext === "function" ? callbacks.getContext() : {};
    var passedCtx = opts && opts.context ? opts.context : opts || {};
    return Object.assign({}, baseCtx, uiCtx, passedCtx);
  }

  function init(config) {
    if (config && typeof config === "object") {
      domRefs.overlay = config.arenaOverlay || config.overlay || domRefs.overlay;
      domRefs.stage = config.arenaStage || config.stage || domRefs.stage;
      domRefs.titleEl = config.arenaTitle || config.titleEl || domRefs.titleEl;
      domRefs.progressEl = config.arenaProgress || config.progressEl || domRefs.progressEl;
      domRefs.abortBtn = config.arenaAbortBtn || config.abortBtn || domRefs.abortBtn;
      if (typeof config.getContext === "function") callbacks.getContext = config.getContext;
      if (typeof config.onSessionUpdate === "function") callbacks.onSessionUpdate = config.onSessionUpdate;
    }
  }

  function abort() {
    sessionState.isBattery = false;
    sessionState.batteryRunId = null;
    closeOverlay();
  }

  function startFullBattery(opts) {
    cleanupActive();
    sessionState.contextSnapshot = captureContext(opts);
    if (opts && typeof opts.onSessionUpdate === "function") {
      callbacks.onSessionUpdate = opts.onSessionUpdate;
    }
    sessionState.isBattery = true;
    sessionState.batteryRunId = "bat_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    sessionState.batteryQueue = ["isolation", "updating", "gating", "binding", "vigilance", "control"];
    sessionState.batteryIndex = 0;
    sessionState.batteryScores = {};
    openOverlay();
    launchProbeIntro(sessionState.batteryQueue[0]);
  }

  function startSingleProbe(probeId, opts) {
    cleanupActive();
    sessionState.contextSnapshot = captureContext(opts);
    if (opts && typeof opts.onSessionUpdate === "function") {
      callbacks.onSessionUpdate = opts.onSessionUpdate;
    }
    sessionState.isBattery = false;
    sessionState.batteryRunId = null;
    sessionState.currentProbeId = probeId;
    openOverlay();
    launchProbeIntro(probeId);
  }

  function formatProgressPrefix(trialText) {
    var cleanTrial = String(trialText || "").replace(/^Trial\s+/i, "");
    if (sessionState.isBattery) {
      return "مسبار " + (sessionState.batteryIndex + 1) + "/6 · " + cleanTrial;
    }
    return cleanTrial;
  }

  function formatInlineTechHtml(rawStr) {
    var s = esc(rawStr);
    var slots = [];
    function keep(html) {
      var id = slots.length;
      slots.push(html);
      return "\uE000" + id + "\uE001";
    }
    s = s.replace(/\((Space|Enter)\)/g, function (_m, k) {
      return keep('<kbd class="kbd-chip ltr-iso">' + k + "</kbd>");
    });
    s = s.replace(/\(([^()\uE000\uE001]+)\)/g, function (full, inner) {
      if (/[\u0600-\u06FF]/.test(inner)) return full;
      if (/^\d+\s*[–-]\s*\d+$/.test(inner.trim())) {
        return keep('<kbd class="kbd-chip ltr-iso">' + inner.trim() + "</kbd>");
      }
      if (/^\d+$/.test(inner.trim())) return full;
      return keep('<span class="ltr-iso">' + full + "</span>");
    });
    s = s.replace(/(?:\b(?:p|RCI)\s*(?:&lt;|&gt;|=|≥|≤)\s*[±+-]?\d+(?:\.\d+)?|(?:&lt;|&gt;|≥|≤)\s*[±+-]?\d+(?:\.\d+)?%?)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    s = s.replace(/(?:~?\d+(?:\.\d+)?\s*(?:ms|s)\b|~?\d+(?:\.\d+)?%|[±+-]\d+(?:\.\d+)?%?|\b\d+\s*[–-]\s*\d+\b|\bZ2×Z2\b|\b2D\b|\bMAP-MLE(?:\s+Tau)?\b|\bABBA\b|\bTBRS\b|\bDLPFC\b|\bLeft\s+IFS\b|\bRLPFC\b|\brAI\b|\bIFG\b|\bDMN\b|\bTau\b|\bMu\b|\bLag\s*(?:0|≥\s*1)\b)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    return s.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return slots[Number(idx)];
    }).replace(/<\/kbd>\s*\.\s*$/, "</kbd>");
  }

  function launchProbeIntro(probeId, warmupDoneNote) {
    cleanupActive();
    sessionState.currentProbeId = probeId;
    sessionState.tabInterruptions = 0;
    var meta = findProbeMeta(probeId);
    var shortCode = String(meta.code || probeId.toUpperCase()).split("·")[0].trim();
    setHeader(
      shortCode + " — " + meta.title,
      sessionState.isBattery ? "البطارية " + (sessionState.batteryIndex + 1) + " / 6" : "جاهز للبدء"
    );

    var stepsHtml = "";
    var steps = Array.isArray(meta.instructions) ? meta.instructions : [];
    for (var i = 0; i < steps.length; i += 1) {
      var stLine = formatInlineTechHtml(steps[i]);
      var colonPos = stLine.indexOf(":");
      if (colonPos > 0 && colonPos < 28) {
        stLine = "<strong>" + stLine.slice(0, colonPos + 1) + "</strong>" + stLine.slice(colonPos + 1);
      }
      stepsHtml += "<li>" + stLine + "</li>";
    }

    var warmupBanner = warmupDoneNote
      ? '<div class="warmup-feedback">' + esc(warmupDoneNote) + "</div>"
      : "";

    var flowHtml = "";
    if (Array.isArray(meta.flowSteps) && meta.flowSteps.length > 0) {
      flowHtml =
        '<div class="probe-flow-box" aria-label="مسار الجولة">' +
        '<span class="probe-flow-label">مسار الجولة</span>' +
        '<div class="probe-flow-track">' +
        meta.flowSteps.map(function (fs, idx) {
          var stepHtml = '<span class="flow-step">' + formatInlineTechHtml(fs) + "</span>";
          return idx === 0
            ? stepHtml
            : '<span class="flow-step-unit"><span class="flow-arrow" aria-hidden="true">←</span>' + stepHtml + "</span>";
        }).join("") +
        "</div></div>";
    } else if (meta.example) {
      flowHtml = '<div class="probe-example-box">' + esc(meta.example) + "</div>";
    }

    var domainTag = meta.domainTag || meta.shortTitle || meta.region;
    var metaChip = meta.metaChip || (meta.durationSec ? "~" + Math.max(1, Math.round((meta.durationSec / 60) * 10) / 10) + " د" : "");
    var isCtrlCls = meta.isControl || probeId === "control" ? " is-control" : "";

    domRefs.stage.innerHTML =
      '<div class="probe-intro' + isCtrlCls + '">' +
      '<div class="probe-intro-top">' +
      '<div class="probe-intro-badges">' +
      '<span class="probe-code ltr-iso">' + esc(shortCode) + "</span>" +
      '<span class="probe-domain-tag">' + formatInlineTechHtml(domainTag) + "</span>" +
      "</div>" +
      (metaChip ? '<div class="probe-intro-meta"><span class="intro-meta-chip">' + formatInlineTechHtml(metaChip) + "</span></div>" : "") +
      "</div>" +
      '<h2 class="probe-intro-title">' +
      esc(meta.title) +
      "</h2>" +
      warmupBanner +
      '<ol class="probe-steps">' +
      stepsHtml +
      "</ol>" +
      flowHtml +
      '<div class="result-actions">' +
      '<button id="btnWarmupProbe" type="button" class="btn-ghost">تجربة سريعة (غير محسوبة)</button>' +
      '<button id="btnStartProbeNow" type="button" class="btn-primary"><span>ابدأ الآن</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
      "</div>" +
      "</div>";

    var startBtn = document.getElementById("btnStartProbeNow");
    var warmupBtn = document.getElementById("btnWarmupProbe");

    var triggerStart = function () {
      cleanupActive();
      sessionState.tabInterruptions = 0;
      dispatchProbeRunner(probeId);
    };
    var triggerWarmup = function () {
      cleanupActive();
      runInteractiveWarmup(probeId);
    };

    if (startBtn) startBtn.addEventListener("click", triggerStart);
    if (warmupBtn) warmupBtn.addEventListener("click", triggerWarmup);

    bindKeyHandler(function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        triggerStart();
      }
    });
  }

  /* =========================================================================
     UNSCORED INTERACTIVE PRACTICE WARMUP (Full Hands-On Across All 6 Probes)
     ========================================================================= */
  function runInteractiveWarmup(probeId) {
    cleanupActive();
    var S = getStimuli();
    var meta = findProbeMeta(probeId);
    var sample = typeof S.generateWarmupTrial === "function" ? S.generateWarmupTrial(probeId) : null;
    setHeader(meta.title + " — تجربة سريعة", "تدريب غير محسوب");

    if (probeId === "isolation" && sample) {
      var wIdx = 0;
      var wLen = sample.words.length;
      function showWarmIsoWord() {
        if (wIdx >= wLen) {
          var optsH = sample.taskOptions.map(function (o) {
            return '<button type="button" class="opt-btn" data-v="' + esc(o) + '"><span class="ltr-iso">' + esc(o) + "</span></button>";
          }).join("");
          var promptStr = String(sample.taskPrompt || "");
          var promptHtml = promptStr.trim().indexOf("(") === 0
            ? '<span class="ltr-iso math-expr">' + esc(promptStr) + "</span>"
            : esc(promptStr);
          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<div class="stim-label">المسألة</div>' +
            '<p class="task-question">' + promptHtml + "</p>" +
            '<div class="options-grid">' + optsH + "</div></div>";
          var bs = domRefs.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < bs.length; b += 1) {
            bs[b].addEventListener("click", function (ev) {
              var mathOk = ev.currentTarget.getAttribute("data-v") === sample.taskAnswer;
              showWarmIsoRecall(mathOk);
            });
          }
          return;
        }
        domRefs.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
          (wIdx + 1) + " / " + wLen +
          '</span></div><div class="stim-word">' +
          esc(sample.words[wIdx]) +
          "</div></div>";
        wIdx += 1;
        scheduleFrameAccurate(showWarmIsoWord, 860);
      }

      function showWarmIsoRecall(mathOk) {
        var picks = [];
        function drawPad() {
          var sl = "";
          for (var i = 0; i < wLen; i += 1) {
            var v = picks[i];
            sl += '<div class="slot-pill' + (v ? " is-filled" : i === picks.length ? " is-active" : "") + '">' +
              (v ? (v === "__FORGOT__" ? "؟" : esc(v)) : "خانة " + (i + 1)) + "</div>";
          }
          var kh = sample.distractorPool.map(function (w) {
            return '<button type="button" class="key-btn" data-w="' + esc(w) + '"' + (picks.indexOf(w) !== -1 ? " disabled" : "") + ">" + esc(w) + "</button>";
          }).join("");
          domRefs.stage.innerHTML =
            '<div class="task-box"><p class="task-question">رتّب الكلمات (1 ← 4):</p>' +
            '<div class="recall-slots">' + sl + '</div><div class="keypad-grid">' + kh + "</div>" +
            '<div class="arena-utility-row"><button id="wIsoForgot" type="button" class="btn-forgot">نسيت ؟</button></div></div>';
          var kbs = domRefs.stage.querySelectorAll(".key-btn");
          for (var k = 0; k < kbs.length; k += 1) {
            kbs[k].addEventListener("click", function (e) { addPick(e.currentTarget.getAttribute("data-w")); });
          }
          document.getElementById("wIsoForgot").addEventListener("click", function () { addPick("__FORGOT__"); });
        }
        function addPick(v) {
          picks.push(v);
          if (picks.length >= wLen) {
            var hits = 0;
            for (var c = 0; c < wLen; c += 1) if (picks[c] === sample.words[c]) hits += 1;
            launchProbeIntro(
              probeId,
              "نتيجة التجربة: " + hits + "/" + wLen +
              " (" + sample.words.join(" ← ") + ") · المسألة " + (mathOk ? "صحيحة" : "جوابها " + sample.taskAnswer) + "."
            );
          } else {
            drawPad();
          }
        }
        drawPad();
      }
      showWarmIsoWord();
      return;
    }

    if (probeId === "updating" && sample) {
      var uStep = -1;
      function renderWarmUpd() {
        cleanupActive();
        if (uStep === -1) {
          var initTxt = sample.vars.map(function (vn) {
            return esc(vn) + ': <span class="ltr-iso">' + sample.initial[vn] + "</span>";
          }).join(" &nbsp;|&nbsp; ");
          domRefs.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label">البداية</div>' +
            '<div class="stim-step-text">' + initTxt + "</div>" +
            '<button id="wUpdGo" type="button" class="btn-primary">ابدأ</button></div>';
          document.getElementById("wUpdGo").addEventListener("click", function () { uStep = 0; renderWarmUpd(); });
          return;
        }
        if (uStep < sample.steps.length) {
          domRefs.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
            (uStep + 1) + " / " + sample.steps.length + '</span></div>' +
            '<div class="stim-step-text">' + esc(sample.steps[uStep].text) + "</div>" +
            '<button id="wUpdStep" type="button" class="btn-primary">التالي</button></div>';
          document.getElementById("wUpdStep").addEventListener("click", function () { uStep += 1; renderWarmUpd(); });
          return;
        }
        var targetV = sample.queryOrder[0];
        var np = "";
        for (var d = 1; d <= 9; d += 1) np += '<button type="button" class="key-btn" data-d="' + d + '">' + d + "</button>";
        domRefs.stage.innerHTML =
          '<div class="task-box"><div class="stim-label"><span class="ltr-iso">1 / 1</span></div>' +
          '<p class="task-question">' + esc(targetV) + ' = ؟</p>' +
          '<div class="keypad-grid is-numpad">' + np + "</div></div>";
        var nbs = domRefs.stage.querySelectorAll(".key-btn");
        for (var n = 0; n < nbs.length; n += 1) {
          nbs[n].addEventListener("click", function (ev) {
            var got = Number(ev.currentTarget.getAttribute("data-d"));
            var ans = sample.final[targetV];
            launchProbeIntro(
              probeId,
              "نتيجة التجربة: " + targetV + " = " + ans +
              (got === ans ? " (صحيحة)." : " (اخترت " + got + ").")
            );
          });
        }
      }
      renderWarmUpd();
      return;
    }

    if (probeId === "gating" && sample) {
      var gIdx = 0;
      var wNums = [];
      function showWarmGate() {
        if (gIdx >= sample.sequence.length) {
          renderWarmGateNums();
          return;
        }
        var it = sample.sequence[gIdx];
        domRefs.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
          (gIdx + 1) + ' / 4</span></div><div class="stim-token">' + esc(it.value) + "</div></div>";
        gIdx += 1;
        scheduleFrameAccurate(showWarmGate, 900);
      }
      function renderWarmGateNums() {
        var np = "";
        for (var n = 1; n <= 9; n += 1) {
          var dis = wNums.indexOf(String(n)) !== -1 ? " disabled" : "";
          np += '<button type="button" class="key-btn" data-n="' + n + '"' + dis + ">" + n + "</button>";
        }
        domRefs.stage.innerHTML =
          '<div class="task-box"><div class="stim-label"><span class="ltr-iso">1 / 2</span></div>' +
          '<p class="task-question">1) الأرقام: من الأصغر للأكبر</p>' +
          '<div class="keypad-grid is-numpad">' + np + "</div></div>";
        var nbs = domRefs.stage.querySelectorAll(".key-btn");
        for (var b = 0; b < nbs.length; b += 1) {
          nbs[b].addEventListener("click", function (e) {
            wNums.push(e.currentTarget.getAttribute("data-n"));
            if (wNums.length >= 2) {
              launchProbeIntro(
                probeId,
                "نتيجة التجربة: الأرقام (3 ← 7)، وتليها في الاختبار الكلمات عكسيا (عذر ← غرض)."
              );
            } else {
              renderWarmGateNums();
            }
          });
        }
      }
      showWarmGate();
      return;
    }

    if (probeId === "binding" && sample) {
      var bpIdx = 0;
      function showWarmPremise() {
        cleanupActive();
        if (bpIdx < sample.premises.length) {
          domRefs.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
            (bpIdx + 1) + " / " + sample.premises.length + '</span></div>' +
            '<div class="stim-step-text">' + esc(sample.premises[bpIdx]) + "</div>" +
            '<button id="wBndNext" type="button" class="btn-primary">' +
            (bpIdx < sample.premises.length - 1 ? "التالي" : "السؤال") + "</button></div>";
          document.getElementById("wBndNext").addEventListener("click", function () { bpIdx += 1; showWarmPremise(); });
          return;
        }
        var oh = sample.entities.map(function (ent) {
          return '<button type="button" class="opt-btn" data-e="' + esc(ent) + '">' + esc(ent) + "</button>";
        }).join("");
        domRefs.stage.innerHTML =
          '<div class="task-box"><div class="stim-label">السؤال</div>' +
          '<p class="task-question">' + esc(sample.question) + "</p>" +
          '<div class="options-grid">' + oh + "</div></div>";
        var obs = domRefs.stage.querySelectorAll(".opt-btn");
        for (var k = 0; k < obs.length; k += 1) {
          obs[k].addEventListener("click", function (e) {
            var ch = e.currentTarget.getAttribute("data-e");
            launchProbeIntro(
              probeId,
              "نتيجة التجربة: «" + sample.answer + "» (" + (ch === sample.answer ? "صحيحة" : "اخترت «" + ch + "»") + ")."
            );
          });
        }
      }
      showWarmPremise();
      return;
    }

    if (probeId === "vigilance" && sample) {
      var vpIdx = 0;
      var vHits = 0;
      var vWaiting = false;
      domRefs.stage.innerHTML =
        '<div class="vigilance-pad">' +
        '<div class="stim-label">4 ومضات تجريبية</div>' +
        '<div id="wVigRing" class="pulse-ring">●</div>' +
        '<p id="wVigMsg" class="vig-status-msg">انتظر الضوء...</p>' +
        '<div class="vig-actions">' +
        '<button id="wVigStep" type="button" class="vig-btn-step">ومضة 1 أو 2 أو 3</button>' +
        '<button id="wVigClose" type="button" class="vig-btn-close">الومضة 4 فقط</button>' +
        "</div></div>";
      var wRing = document.getElementById("wVigRing");
      var wMsg = document.getElementById("wVigMsg");
      function onWarmTap(kind) {
        if (!vWaiting) return;
        vWaiting = false;
        var ok = (vpIdx < 4 && kind === "step") || (vpIdx === 4 && kind === "close");
        if (ok) vHits += 1;
        if (wMsg) wMsg.textContent = ok ? "صحيح (" + vpIdx + " / 4)" : "الومضة 4 لها الزر الثاني فقط";
      }
      bindFastPress(document.getElementById("wVigStep"), function () { onWarmTap("step"); });
      bindFastPress(document.getElementById("wVigClose"), function () { onWarmTap("close"); });
      function fireWarmPulse() {
        if (vpIdx >= 4) {
          launchProbeIntro(probeId, "نتيجة التجربة: " + vHits + " / 4.");
          return;
        }
        vpIdx += 1;
        vWaiting = true;
        if (wRing) wRing.classList.add("is-flashing");
        if (wMsg) wMsg.textContent = "ومضة " + vpIdx + " / 4";
        scheduleFrameAccurate(function () {
          if (wRing) wRing.classList.remove("is-flashing");
        }, 240);
        scheduleFrameAccurate(fireWarmPulse, sample.intervalsMs[vpIdx - 1] || 1500);
      }
      scheduleFrameAccurate(fireWarmPulse, 700);
      return;
    }

    if (probeId === "control" && sample) {
      domRefs.stage.innerHTML =
        '<div class="visual-canvas-wrap"><div class="stim-label">التقط الشكل</div>' +
        '<div class="visual-svg-box">' + renderVisualStimulusSVG(sample, null) + "</div></div>";
      scheduleFrameAccurate(function () {
        domRefs.stage.innerHTML =
          '<div class="visual-canvas-wrap"><div class="stim-label">...</div>' +
          '<div class="visual-svg-box">' + renderMaskSVG(sample.maskSeed || 777) + "</div></div>";
        scheduleFrameAccurate(function () {
          var gh = "";
          for (var o = 0; o < 4; o += 1) {
            gh += '<button type="button" class="visual-opt-btn" data-o="' + o + '">' + renderVisualStimulusSVG(sample, o) + "</button>";
          }
          domRefs.stage.innerHTML =
            '<div class="task-box"><p class="task-question">الشكل المطابق؟</p>' +
            '<div class="visual-options-grid">' + gh + "</div></div>";
          var vbs = domRefs.stage.querySelectorAll(".visual-opt-btn");
          for (var b = 0; b < vbs.length; b += 1) {
            vbs[b].addEventListener("click", function (e) {
              var ok = Number(e.currentTarget.getAttribute("data-o")) === Number(sample.correctIndex);
              launchProbeIntro(
                probeId,
                "نتيجة التجربة: " + (ok ? "مطابقة صحيحة." : "انتبه لنسب التقسيم.")
              );
            });
          }
        }, 500);
      }, 800);
      return;
    }

    launchProbeIntro(probeId, "جاهز للبدء.");
  }

  function dispatchProbeRunner(probeId) {
    if (probeId === "isolation") return runIsolationProbe();
    if (probeId === "updating") return runUpdatingProbe();
    if (probeId === "gating") return runGatingProbe();
    if (probeId === "binding") return runBindingProbe();
    if (probeId === "vigilance") return runVigilanceProbe();
    if (probeId === "control") return runControlProbe();
  }

  /* =========================================================================
     PROBE 1: ISOLATION (6-Trial Counterbalanced TBRS + PI Lures & Wipeout)
     ========================================================================= */
  function runIsolationProbe() {
    var S = getStimuli();
    var trials = S.generateIsolationTrials(6);
    var meta = findProbeMeta("isolation");
    var results = [];
    var idx = 0;
    var replayCounts = {};

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishIsolation(results);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      // Guard transient 4-word presentation against mid-encoding tab backgrounding (capped at 1 fresh replay per trial)
      if ((replayCounts[idx] || 0) < 1) {
        setEncodingVisibilityGuard(function () {
          replayCounts[idx] = (replayCounts[idx] || 0) + 1;
          var freshSet = S.generateIsolationTrials(trials.length);
          for (var f = 0; f < freshSet.length; f += 1) {
            if (freshSet[f].taskType === tr.taskType) {
              trials[idx] = freshSet[f];
              break;
            }
          }
          nextTrial();
        });
      }

      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">احفظ 4 كلمات بالترتيب</div>' +
        '<div class="stim-num">+</div>' +
        "</div>";

      scheduleFrameAccurate(function () {
        presentWord(0);
      }, 560);

      function presentWord(wIdx) {
        if (wIdx >= tr.words.length) {
          clearEncodingVisibilityGuard();
          if (tr.taskType === "pure") {
            return showSilentMaintenance();
          }
          return showProcessingTask();
        }
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          (wIdx + 1) +
          " / 4</span></div>" +
          '<div class="stim-word">' +
          esc(tr.words[wIdx]) +
          "</div>" +
          renderDots(tr.words.length, wIdx) +
          "</div>";

        onNextFramePaint(function () {
          scheduleFrameAccurate(function () {
            domRefs.stage.innerHTML = '<div class="stimulus-card"></div>';
            scheduleFrameAccurate(function () {
              presentWord(wIdx + 1);
            }, tr.wordIsiMs || 180);
          }, tr.wordExposureMs || 900);
        });
      }

      function showSilentMaintenance() {
        var holdMs = tr.retentionMs || 4200;
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">احتفظ بالكلمات...</div>' +
          '<div class="stim-num" style="opacity:0.45;">•</div>' +
          '<div class="tbrs-timer-track"><div id="pureHoldBar" class="tbrs-timer-fill"></div></div>' +
          "</div>";
        startCountdownBar(document.getElementById("pureHoldBar"), holdMs);
        scheduleFrameAccurate(function () {
          showSerialRecall(true, 0, false, 0);
        }, holdMs);
      }

      function showProcessingTask() {
        var deadlineMs = tr.deadlineMs || (tr.taskType === "math" ? 8800 : 12500);
        var optsHtml = "";
        for (var o = 0; o < tr.taskOptions.length; o += 1) {
          var isNum = /^\d+$/.test(tr.taskOptions[o]);
          optsHtml +=
            '<button type="button" class="opt-btn" data-opt-idx="' +
            o +
            '">' +
            (isNum ? '<span class="ltr-iso">' + esc(tr.taskOptions[o]) + "</span>" : esc(tr.taskOptions[o])) +
            "</button>";
        }

        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label">المسألة</div>' +
          '<div class="tbrs-timer-track" aria-hidden="true"><div id="isoTaskTimerBar" class="tbrs-timer-fill"></div></div>' +
          '<p class="task-question">' +
          (tr.taskType === "math"
            ? '<span class="ltr-iso math-expr">' + esc(tr.taskPrompt) + "</span>"
            : esc(tr.taskPrompt)) +
          "</p>" +
          '<div class="options-grid">' +
          optsHtml +
          "</div>" +
          "</div>";

        var tOnset = nowMs();
        var answered = false;

        onNextFramePaint(function (paintTs) {
          tOnset = paintTs;
          startCountdownBar(document.getElementById("isoTaskTimerBar"), deadlineMs);
        });

        var chooseTaskOpt = function (chosenVal, eventTs, isTimeout) {
          if (answered) return;
          answered = true;
          cleanupActive();
          var taskRtMs = Math.max(0, Math.round((eventTs || nowMs()) - tOnset));
          var taskCorrect = !isTimeout && String(chosenVal) === String(tr.taskAnswer);
          showSerialRecall(taskCorrect, taskRtMs, Boolean(isTimeout), deadlineMs);
        };

        // Enforce TBRS cognitive-load deadline so covert rehearsal before answering is impossible
        scheduleTimer(function () {
          chooseTaskOpt("__TIMEOUT__", nowMs(), true);
        }, deadlineMs);

        var optBtns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < optBtns.length; b += 1) {
          (function (btnEl) {
            bindFastPress(btnEl, function (_ev, pressTs) {
              var i = Number(btnEl.getAttribute("data-opt-idx"));
              chooseTaskOpt(tr.taskOptions[i], pressTs, false);
            });
          })(optBtns[b]);
        }

        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.taskOptions.length) {
            ev.preventDefault();
            chooseTaskOpt(tr.taskOptions[n - 1], nowMs(), false);
          }
        });
      }

      function showSerialRecall(taskCorrect, taskRtMs, taskTimedOut, deadlineMs) {
        var chosenWords = [];
        var tRecallStart = nowMs();

        function renderRecallUI() {
          var slotsHtml = "";
          for (var s = 0; s < 4; s += 1) {
            var entry = chosenWords[s];
            if (!entry) {
              var activeCls = s === chosenWords.length ? "slot-pill is-active" : "slot-pill";
              slotsHtml += '<div class="' + activeCls + '">خانة <span class="ltr-iso">' + (s + 1) + "</span></div>";
            } else if (entry === "__FORGOT__") {
              slotsHtml += '<div class="slot-pill is-forgotten">؟</div>';
            } else {
              slotsHtml += '<div class="slot-pill is-filled">' + esc(entry) + "</div>";
            }
          }

          var keysHtml = "";
          for (var k = 0; k < tr.distractorPool.length; k += 1) {
            var w = tr.distractorPool[k];
            var alreadyUsed = chosenWords.indexOf(w) !== -1;
            keysHtml +=
              '<button type="button" class="key-btn" data-word="' +
              esc(w) +
              '"' +
              (alreadyUsed ? " disabled" : "") +
              ">" +
              esc(w) +
              "</button>";
          }

          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<p class="task-question">رتّب الكلمات (1 ← 4):</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid">' +
            keysHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotSlot" type="button" class="btn-forgot">نسيت ؟</button>' +
            '<button id="btnUndoSlot" type="button" class="btn-undo"' +
            (chosenWords.length === 0 ? " disabled" : "") +
            ">تراجع</button>" +
            "</div>" +
            "</div>";

          var keyBtns = domRefs.stage.querySelectorAll(".key-btn");
          for (var b = 0; b < keyBtns.length; b += 1) {
            keyBtns[b].addEventListener("click", function (ev) {
              pushChoice(ev.currentTarget.getAttribute("data-word"));
            });
          }
          var fBtn = document.getElementById("btnForgotSlot");
          if (fBtn) {
            fBtn.addEventListener("click", function () {
              pushChoice("__FORGOT__");
            });
          }
          var uBtn = document.getElementById("btnUndoSlot");
          if (uBtn) {
            uBtn.addEventListener("click", function () {
              if (chosenWords.length > 0) {
                chosenWords.pop();
                renderRecallUI();
              }
            });
          }
        }

        function pushChoice(val) {
          if (chosenWords.length >= 4) return;
          chosenWords.push(val);
          if (chosenWords.length === 4) {
            var slotHits = [0, 0, 0, 0];
            var strictHits = 0;
            var itemSurvived = 0;
            var transpositions = 0;
            var omissions = 0;
            var intrusions = 0;
            var piIntrusions = 0;
            var piList = Array.isArray(tr.priorLures) ? tr.priorLures : [];

            for (var c = 0; c < 4; c += 1) {
              var picked = chosenWords[c];
              if (picked === tr.words[c]) {
                slotHits[c] = 1;
                strictHits += 1;
                itemSurvived += 1;
              } else if (picked === "__FORGOT__") {
                omissions += 1;
              } else if (tr.words.indexOf(picked) !== -1) {
                itemSurvived += 1;
                transpositions += 1;
              } else {
                intrusions += 1;
                if (piList.indexOf(picked) !== -1) {
                  piIntrusions += 1;
                }
              }
            }

            var nonForgotRecalled = chosenWords.filter(function (x) { return x !== "__FORGOT__"; });
            var relativeOrderHits = computeOrderedLCS(nonForgotRecalled, tr.words);

            results.push({
              taskType: tr.taskType,
              taskCorrect: taskCorrect,
              taskTimedOut: taskTimedOut,
              fastGuess: tr.taskType !== "pure" && !taskCorrect && taskRtMs > 0 && taskRtMs < 550,
              taskRtMs: taskRtMs,
              deadlineMs: deadlineMs || 0,
              recallRtMs: Math.round(nowMs() - tRecallStart),
              hits: strictHits,
              relativeOrderHits: relativeOrderHits,
              itemSurvived: itemSurvived,
              transpositions: transpositions,
              omissions: omissions,
              intrusions: intrusions,
              piIntrusions: piIntrusions,
              wipeouts: omissions + intrusions,
              slotHits: slotHits
            });
            idx += 1;
            scheduleTimer(nextTrial, 200);
          } else {
            renderRecallUI();
          }
        }

        renderRecallUI();
      }
    }

    nextTrial();
  }

  function finishIsolation(results) {
    var pureHits = 0, pureTotal = 0;
    var gatedMathSum = 0, mathTotal = 0, gatedLogicSum = 0, logicTotal = 0;
    var weightedLoadedSum = 0, loadedSlotsTotal = 0;
    var s1 = 0, smid = 0, s4 = 0, loadedCount = 0;
    var taskAccCount = 0, transpositionsTotal = 0, wipeoutsTotal = 0, piIntrusionsTotal = 0;
    var loadedRts = [], correctTaskRts = [], loadedTrialScores = [], clRatios = [];

    for (var p = 0; p < results.length; p += 1) {
      if (results[p].taskType !== "pure") {
        loadedCount += 1;
        if (results[p].taskCorrect) taskAccCount += 1;
      }
    }
    var denomLoaded = Math.max(1, loadedCount);
    var taskAccPct = Math.round((taskAccCount / denomLoaded) * 100);

    for (var i = 0; i < results.length; i += 1) {
      var r = results[i];
      if (r.taskType === "pure") {
        pureHits += r.hits;
        pureTotal += 4;
        continue;
      }

      loadedSlotsTotal += 4;
      loadedRts.push(r.taskRtMs);
      if (r.deadlineMs > 0) {
        clRatios.push(Math.min(100, Math.round((r.taskRtMs / r.deadlineMs) * 100)));
      }
      if (r.taskCorrect) {
        correctTaskRts.push(r.taskRtMs);
      }

      // Conway et al. (2005) conditional dual-task engagement gate:
      // Applied consistently across finalScore, mathSurvivalPct, logicSurvivalPct, and processingWipeoutPct!
      var engagementWeight = 1.0;
      if (!r.taskCorrect) {
        if (r.fastGuess || r.taskTimedOut || (r.taskRtMs > 0 && r.taskRtMs < 550)) {
          engagementWeight = 0.0;
        } else if (taskAccPct >= 75) {
          engagementWeight = 0.75;
        } else {
          engagementWeight = 0.25 * (taskAccPct / 75);
        }
      }
      var weightedHits = r.hits * engagementWeight;
      weightedLoadedSum += weightedHits;
      loadedTrialScores.push(Math.round((weightedHits / 4) * 100));

      s1 += r.slotHits[0] * engagementWeight;
      smid += (r.slotHits[1] + r.slotHits[2]) * engagementWeight;
      s4 += r.slotHits[3] * engagementWeight;
      transpositionsTotal += r.transpositions;
      wipeoutsTotal += r.wipeouts;
      piIntrusionsTotal += r.piIntrusions || 0;

      if (r.taskType === "math") {
        gatedMathSum += weightedHits;
        mathTotal += 4;
      } else {
        gatedLogicSum += weightedHits;
        logicTotal += 4;
      }
    }

    var pureSpanPct = pureTotal > 0 ? Math.round((pureHits / pureTotal) * 100) : 100;
    var gatedRecallPct = loadedSlotsTotal > 0 ? Math.round((weightedLoadedSum / loadedSlotsTotal) * 100) : 0;
    var finalScore = Math.max(0, Math.min(100, gatedRecallPct));

    var processingWipeoutPct = Math.max(0, pureSpanPct - finalScore);
    var mathSurvivalPct = mathTotal > 0 ? Math.round((gatedMathSum / mathTotal) * 100) : 0;
    var logicSurvivalPct = logicTotal > 0 ? Math.round((gatedLogicSum / logicTotal) * 100) : 0;
    var slot1Pct = Math.round((s1 / denomLoaded) * 100);
    var middleSlotsPct = Math.round((smid / (denomLoaded * 2)) * 100);
    var slot4Pct = Math.round((s4 / denomLoaded) * 100);
    var meanRt = mean(loadedRts);
    var cognitiveLoadPct = mean(clRatios);
    var lisasMs = computeLisasSafe(correctTaskRts, loadedRts, 1 - taskAccPct / 100);
    var splitHalfPct = computeSplitHalf(loadedTrialScores);

    var tradeoffNote = taskAccPct < 75
      ? " [تنبيه Conway et al. (2005): دقة المعالجة الفاصلة (" + taskAccPct + "%) دون معيار الصلاحية 75% فطُبّق تصحيح مقايضة التسميع على البقاء]."
      : "";

    var diag =
      "السعة المجردة الصافية الموازنة زمنيا بلغت " +
      pureSpanPct +
      "%، ثم سجل البقاء الفعال " +
      mathSurvivalPct +
      "% بعد الحساب و" +
      logicSurvivalPct +
      "% بعد المنطق المقلوب (صافي المسح بالمعالجة: " +
      processingWipeoutPct +
      "% تحت حمل TBRS قدره " +
      cognitiveLoadPct +
      "%)؛ رُصدت " +
      wipeoutsTotal +
      " حالات مسح/إقحام (منها " +
      piIntrusionsTotal +
      " تداخلات من الجولة السابقة) مقابل " +
      transpositionsTotal +
      " إبدال ترتيب." +
      tradeoffNote;

    completeProbe(
      "isolation",
      finalScore,
      meanRt,
      {
        pureSpanPct: pureSpanPct,
        processingWipeoutPct: processingWipeoutPct,
        mathSurvivalPct: mathSurvivalPct,
        logicSurvivalPct: logicSurvivalPct,
        slot1Pct: slot1Pct,
        middleSlotsPct: middleSlotsPct,
        slot4Pct: slot4Pct,
        transpositionCount: transpositionsTotal,
        wipeoutCount: wipeoutsTotal,
        piIntrusionCount: piIntrusionsTotal,
        cognitiveLoadPct: cognitiveLoadPct,
        taskAccPct: taskAccPct,
        taskMeanRtMs: meanRt,
        lisasMs: lisasMs,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "السعة الصافية الموازنة", val: pureSpanPct + "%" },
        { label: "صافي المسح بالمعالجة", val: processingWipeoutPct + "%" },
        { label: "البقاء بعد الحساب", val: mathSurvivalPct + "%" },
        { label: "البقاء بعد المنطق", val: logicSurvivalPct + "%" },
        { label: "إبدال الترتيب / تداخل سابق", val: transpositionsTotal + " / " + piIntrusionsTotal },
        { label: "دقة المسألة الفاصلة", val: taskAccPct + "%" }
      ],
      diag
    );
  }

  /* =========================================================================
     PROBE 2: UPDATING (Oberauer Focus vs Peripheral Shelf & Switch Cost)
     ========================================================================= */
  function runUpdatingProbe() {
    var S = getStimuli();
    var trials = S.generateUpdatingTrials(5);
    var meta = findProbeMeta("updating");
    var idx = 0;
    var lastTrustedStepTs = 0;

    var stats = {
      twoCorrect: 0,
      twoTotal: 0,
      threeCorrect: 0,
      threeTotal: 0,
      semanticCorrect: 0,
      semanticTotal: 0,
      inFocusCorrect: 0,
      inFocusTotal: 0,
      peripheralCorrect: 0,
      peripheralTotal: 0,
      staleErrors: 0,
      decayErrors: 0,
      swapErrors: 0,
      calcErrors: 0,
      repeatStepRts: [],
      switchStepRts: [],
      allStepRts: [],
      trialScores: []
    };

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishUpdating(stats);
      }
      var tr = trials[idx];
      var trialHits = 0;
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      var initParts = [];
      for (var v = 0; v < tr.vars.length; v += 1) {
        var vn = tr.vars[v];
        var unitStr = tr.units && tr.units[vn] ? " " + tr.units[vn] : "";
        initParts.push(esc(vn) + ': <span class="ltr-iso">' + tr.initial[vn] + "</span>" + esc(unitStr));
      }

      var initCapMs = tr.initDeadlineMs || 9500;
      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">البداية</div>' +
        '<div class="tbrs-timer-track"><div id="updInitBar" class="tbrs-timer-fill"></div></div>' +
        '<div class="stim-step-text">' +
        initParts.join(" &nbsp;|&nbsp; ") +
        "</div>" +
        '<button id="btnBeginSteps" type="button" class="btn-primary"><span>ابدأ</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
        "</div>";

      startCountdownBar(document.getElementById("updInitBar"), initCapMs);

      var stepStarted = false;
      var goSteps = function (ev) {
        if (stepStarted) return;
        if (ev && ev.isTrusted) lastTrustedStepTs = nowMs();
        stepStarted = true;
        cleanupActive();
        showStep(0);
      };
      document.getElementById("btnBeginSteps").addEventListener("click", goSteps);
      scheduleTimer(function () { goSteps(null); }, initCapMs);
      bindKeyHandler(function (ev) {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          goSteps(ev);
        }
      });

      function showStep(sIdx) {
        cleanupActive();
        if (sIdx >= tr.steps.length) {
          return askFinalVars(0);
        }
        var stepObj = tr.steps[sIdx];
        var stepCapMs = tr.stepDeadlineMs || 8500;
        var tStep = nowMs();

        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          (sIdx + 1) +
          " / " +
          tr.steps.length +
          "</span></div>" +
          '<div class="tbrs-timer-track"><div id="updStepBar" class="tbrs-timer-fill"></div></div>' +
          '<div class="stim-step-text">' +
          esc(stepObj.text) +
          "</div>" +
          renderDots(tr.steps.length, sIdx) +
          '<button id="btnNextUpdateStep" type="button" class="btn-primary"><span>التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
          "</div>";

        onNextFramePaint(function (paintTs) {
          tStep = paintTs;
          startCountdownBar(document.getElementById("updStepBar"), stepCapMs);
        });

        var doneStep = false;
        var advance = function (pressTs, isTimeout, rawEv) {
          if (doneStep) return;
          var curTs = pressTs || nowMs();
          // Guard against accidental <160ms hardware double-tap skip-through while preserving programmatic .click()
          if (rawEv && rawEv.isTrusted && curTs - lastTrustedStepTs < 160) return;
          if (rawEv && rawEv.isTrusted) lastTrustedStepTs = curTs;

          doneStep = true;
          cleanupActive();
          var rt = Math.max(120, Math.round(curTs - tStep));
          if (!isTimeout) {
            stats.allStepRts.push(rt);
            // Exclude timed-out 8500ms ceilings and <220ms accidental skips from Garavan/Oberauer Focus-Switch Cost
            if (rt >= 220 || !(rawEv && rawEv.isTrusted)) {
              if (stepObj.transition === "repeat") {
                stats.repeatStepRts.push(rt);
              } else if (stepObj.transition === "switch") {
                stats.switchStepRts.push(rt);
              }
            }
          }
          showStep(sIdx + 1);
        };

        bindFastPress(document.getElementById("btnNextUpdateStep"), function (ev, pressTs) {
          advance(pressTs, false, ev);
        });
        scheduleTimer(function () {
          advance(nowMs(), true, null);
        }, stepCapMs);

        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            advance(nowMs(), false, ev);
          }
        });
      }

      var queryList = Array.isArray(tr.queryOrder) && tr.queryOrder.length === tr.vars.length
        ? tr.queryOrder
        : tr.vars;

      function askFinalVars(qIdx) {
        cleanupActive();
        if (qIdx >= queryList.length) {
          stats.trialScores.push(Math.round((trialHits / queryList.length) * 100));
          idx += 1;
          scheduleTimer(nextTrial, 200);
          return;
        }
        var varName = queryList[qIdx];
        var isInFocus = tr.lagByVar ? tr.lagByVar[varName] === 0 : varName === tr.inFocusVar;
        var numpadHtml = "";
        for (var n = 1; n <= 9; n += 1) {
          numpadHtml += '<button type="button" class="key-btn" data-num="' + n + '">' + n + "</button>";
        }

        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          (qIdx + 1) +
          " / " +
          queryList.length +
          "</span></div>" +
          '<p class="task-question">' +
          esc(varName) +
          " = ؟</p>" +
          '<div class="keypad-grid is-numpad">' +
          numpadHtml +
          "</div>" +
          '<div class="arena-utility-row">' +
          '<button id="btnForgotVar" type="button" class="btn-forgot">نسيت الرقم ؟</button>' +
          "</div>" +
          "</div>";

        var submitVarAnswer = function (valOrForgot) {
          unbindKeyHandler();
          var trueFinal = tr.final[varName];
          var isTwo = tr.vars.length === 2;
          if (isTwo) stats.twoTotal += 1;
          else stats.threeTotal += 1;
          if (tr.isSemantic || tr.units) stats.semanticTotal += 1;

          if (isInFocus) stats.inFocusTotal += 1;
          else stats.peripheralTotal += 1;

          if (valOrForgot === "__FORGOT__") {
            stats.decayErrors += 1;
          } else {
            var numVal = Number(valOrForgot);
            if (numVal === trueFinal) {
              trialHits += 1;
              if (isTwo) stats.twoCorrect += 1;
              else stats.threeCorrect += 1;
              if (tr.isSemantic || tr.units) stats.semanticCorrect += 1;
              if (isInFocus) stats.inFocusCorrect += 1;
              else stats.peripheralCorrect += 1;
            } else {
              var prevVals = tr.historyByVar[varName] || [];
              var otherFinals = [];
              for (var ov = 0; ov < tr.vars.length; ov += 1) {
                if (tr.vars[ov] !== varName) otherFinals.push(tr.final[tr.vars[ov]]);
              }
              if (prevVals.indexOf(numVal) !== -1) {
                stats.staleErrors += 1;
              } else if (otherFinals.indexOf(numVal) !== -1) {
                stats.swapErrors += 1;
              } else {
                stats.calcErrors += 1;
              }
            }
          }
          askFinalVars(qIdx + 1);
        };

        var numBtns = domRefs.stage.querySelectorAll(".key-btn");
        for (var b = 0; b < numBtns.length; b += 1) {
          numBtns[b].addEventListener("click", function (ev) {
            submitVarAnswer(ev.currentTarget.getAttribute("data-num"));
          });
        }
        document.getElementById("btnForgotVar").addEventListener("click", function () {
          submitVarAnswer("__FORGOT__");
        });

        bindKeyHandler(function (ev) {
          if (/^[1-9]$/.test(ev.key)) {
            ev.preventDefault();
            submitVarAnswer(ev.key);
          }
        });
      }
    }

    nextTrial();
  }

  function finishUpdating(stats) {
    var totalVars = stats.twoTotal + stats.threeTotal;
    var totalCorrect = stats.twoCorrect + stats.threeCorrect;
    var score = totalVars > 0 ? Math.round((totalCorrect / totalVars) * 100) : 0;
    var twoVarPct = stats.twoTotal > 0 ? Math.round((stats.twoCorrect / stats.twoTotal) * 100) : 0;
    var threeVarPct = stats.threeTotal > 0 ? Math.round((stats.threeCorrect / stats.threeTotal) * 100) : 0;
    var semanticAccPct = stats.semanticTotal > 0 ? Math.round((stats.semanticCorrect / stats.semanticTotal) * 100) : threeVarPct;
    var inFocusAccPct = stats.inFocusTotal > 0 ? Math.round((stats.inFocusCorrect / stats.inFocusTotal) * 100) : 0;
    var peripheralAccPct = stats.peripheralTotal > 0 ? Math.round((stats.peripheralCorrect / stats.peripheralTotal) * 100) : 0;

    var meanStepRt = mean(stats.allStepRts);
    var medSwitch = median(stats.switchStepRts);
    var medRepeat = median(stats.repeatStepRts);
    var focusSwitchCostMs =
      stats.switchStepRts.length > 0 && stats.repeatStepRts.length > 0
        ? Math.round(medSwitch - medRepeat)
        : 0;
    var lisasMs = computeLisasSafe(stats.allStepRts, stats.allStepRts, 1 - score / 100);
    var splitHalfPct = computeSplitHalf(stats.trialScores);

    var diag =
      "بؤرة الانتباه النشطة (Lag 0) سجلت " +
      inFocusAccPct +
      "% مقابل " +
      peripheralAccPct +
      "% في الرف الجانبي (Lag ≥ 1، والمسميات الدلالية " +
      semanticAccPct +
      "%)؛ رُصدت " +
      stats.staleErrors +
      " أخطاء التصاق بالقيمة القديمة و" +
      stats.decayErrors +
      " حالات تبخر و" +
      stats.swapErrors +
      " حالات خلط و" +
      stats.calcErrors +
      " زلات حسابية معزولة، بكلفة تبديل بؤرة " +
      (focusSwitchCostMs >= 0 ? "+" : "") +
      focusSwitchCostMs +
      " ms.";

    completeProbe(
      "updating",
      score,
      meanStepRt,
      {
        inFocusAccPct: inFocusAccPct,
        peripheralAccPct: peripheralAccPct,
        twoVarPct: twoVarPct,
        threeVarPct: threeVarPct,
        semanticAccPct: semanticAccPct,
        staleErrors: stats.staleErrors,
        decayErrors: stats.decayErrors,
        swapErrors: stats.swapErrors,
        calcErrors: stats.calcErrors,
        focusSwitchCostMs: focusSwitchCostMs,
        stepMeanRtMs: meanStepRt,
        lisasMs: lisasMs,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "بؤرة الانتباه النشطة", val: inFocusAccPct + "%" },
        { label: "صمود الرف الجانبي", val: peripheralAccPct + "%" },
        { label: "دقة 2 مقابل 3 متغيرات", val: twoVarPct + "% / " + threeVarPct + "%" },
        { label: "التصاق القيمة القديمة", val: String(stats.staleErrors) },
        { label: "تبخر الرقم الأخير", val: String(stats.decayErrors) },
        { label: "كلفة تبديل البؤرة", val: (focusSwitchCostMs >= 0 ? "+" : "") + focusSwitchCostMs + " ms" }
      ],
      diag
    );
  }

  /* =========================================================================
     PROBE 3: GATING (6-Trial ABBA Counterbalanced + LCS Guess-Corrected)
     ========================================================================= */
  function runGatingProbe() {
    var S = getStimuli();
    var trials = S.generateGatingTrials(6);
    var meta = findProbeMeta("gating");
    var idx = 0;
    var trialScores = [];
    var itemAssemblyRts = [];
    var replayCounts = {};

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishGating(trialScores, itemAssemblyRts);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      if ((replayCounts[idx] || 0) < 1) {
        setEncodingVisibilityGuard(function () {
          replayCounts[idx] = (replayCounts[idx] || 0) + 1;
          var freshG = S.generateGatingTrials(trials.length);
          for (var f = 0; f < freshG.length; f += 1) {
            if (freshG[f].mode === tr.mode && freshG[f].pairCount === tr.pairCount) {
              trials[idx] = freshG[f];
              break;
            }
          }
          nextTrial();
        });
      }

      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">الأرقام تصاعديا · الكلمات عكسيا</div>' +
        '<div class="stim-num">+</div>' +
        "</div>";

      scheduleFrameAccurate(function () {
        showItem(0);
      }, 600);

      function showItem(sIdx) {
        if (sIdx >= tr.sequence.length) {
          clearEncodingVisibilityGuard();
          return askNumbersPhase();
        }
        var item = tr.sequence[sIdx];
        var isNum = item.kind === "num";
        // No category pre-cue ("رقم" / "كلمة") — forces bottom-up Left IFS input gating upon reading!
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          (sIdx + 1) +
          " / " +
          tr.sequence.length +
          "</span></div>" +
          '<div class="stim-token' +
          (isNum ? " ltr-iso" : "") +
          '">' +
          esc(item.value) +
          "</div>" +
          renderDots(tr.sequence.length, sIdx) +
          "</div>";

        onNextFramePaint(function () {
          scheduleFrameAccurate(function () {
            domRefs.stage.innerHTML = '<div class="stimulus-card"></div>';
            scheduleFrameAccurate(function () {
              showItem(sIdx + 1);
            }, tr.itemIsiMs || 190);
          }, tr.itemExposureMs || 950);
        });
      }

      var chosenNums = [];
      var chosenWords = [];
      var lastChoiceTs = nowMs();

      function askNumbersPhase() {
        var need = tr.expectedNumbersAsc.length;
        lastChoiceTs = nowMs();

        function renderNumStage() {
          var slotsHtml = "";
          for (var i = 0; i < need; i += 1) {
            var val = chosenNums[i];
            if (!val) {
              slotsHtml +=
                '<div class="slot-pill' +
                (i === chosenNums.length ? " is-active" : "") +
                '">رقم <span class="ltr-iso">' +
                (i + 1) +
                "</span></div>";
            } else if (val === "__FORGOT__") {
              slotsHtml += '<div class="slot-pill is-forgotten">؟</div>';
            } else {
              slotsHtml += '<div class="slot-pill is-filled"><span class="ltr-iso">' + esc(val) + "</span></div>";
            }
          }

          var padHtml = "";
          for (var n = 1; n <= 9; n += 1) {
            var used = chosenNums.indexOf(String(n)) !== -1;
            padHtml +=
              '<button type="button" class="key-btn" data-num="' +
              n +
              '"' +
              (used ? " disabled" : "") +
              ">" +
              n +
              "</button>";
          }

          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<div class="stim-label"><span class="ltr-iso">1 / 2</span></div>' +
            '<p class="task-question">1) الأرقام: من الأصغر للأكبر</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid is-numpad">' +
            padHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotGNum" type="button" class="btn-forgot">نسيت الرقم ؟</button>' +
            '<button id="btnUndoGNum" type="button" class="btn-undo"' +
            (chosenNums.length === 0 ? " disabled" : "") +
            ">تراجع</button>" +
            "</div>" +
            "</div>";

          var btns = domRefs.stage.querySelectorAll(".key-btn");
          for (var b = 0; b < btns.length; b += 1) {
            btns[b].addEventListener("click", function (ev) {
              pushNum(ev.currentTarget.getAttribute("data-num"));
            });
          }
          document.getElementById("btnForgotGNum").addEventListener("click", function () {
            pushNum("__FORGOT__");
          });
          document.getElementById("btnUndoGNum").addEventListener("click", function () {
            if (chosenNums.length > 0) {
              chosenNums.pop();
              lastChoiceTs = nowMs();
              renderNumStage();
            }
          });
        }

        function pushNum(v) {
          if (chosenNums.length >= need) return;
          var now = nowMs();
          itemAssemblyRts.push(Math.max(80, Math.round(now - lastChoiceTs)));
          lastChoiceTs = now;
          chosenNums.push(v);
          if (chosenNums.length === need) {
            unbindKeyHandler();
            scheduleTimer(askWordsPhase, 180);
          } else {
            renderNumStage();
          }
        }

        bindKeyHandler(function (ev) {
          if (/^[1-9]$/.test(ev.key) && chosenNums.indexOf(ev.key) === -1) {
            ev.preventDefault();
            pushNum(ev.key);
          }
        });

        renderNumStage();
      }

      function askWordsPhase() {
        var needW = tr.expectedWordsRev.length;
        lastChoiceTs = nowMs();

        function renderWordStage() {
          var slotsHtml = "";
          for (var i = 0; i < needW; i += 1) {
            var val = chosenWords[i];
            if (!val) {
              slotsHtml +=
                '<div class="slot-pill' +
                (i === chosenWords.length ? " is-active" : "") +
                '">كلمة <span class="ltr-iso">' +
                (i + 1) +
                "</span></div>";
            } else if (val === "__FORGOT__") {
              slotsHtml += '<div class="slot-pill is-forgotten">؟</div>';
            } else {
              slotsHtml += '<div class="slot-pill is-filled">' + esc(val) + "</div>";
            }
          }

          var padHtml = "";
          for (var k = 0; k < tr.wordPool.length; k += 1) {
            var w = tr.wordPool[k];
            var used = chosenWords.indexOf(w) !== -1;
            padHtml +=
              '<button type="button" class="key-btn" data-w="' +
              esc(w) +
              '"' +
              (used ? " disabled" : "") +
              ">" +
              esc(w) +
              "</button>";
          }

          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<div class="stim-label"><span class="ltr-iso">2 / 2</span></div>' +
            '<p class="task-question">2) الكلمات: من الأخيرة للأولى</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid">' +
            padHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotGWord" type="button" class="btn-forgot">نسيت الكلمة ؟</button>' +
            '<button id="btnUndoGWord" type="button" class="btn-undo"' +
            (chosenWords.length === 0 ? " disabled" : "") +
            ">تراجع</button>" +
            "</div>" +
            "</div>";

          var btns = domRefs.stage.querySelectorAll(".key-btn");
          for (var b = 0; b < btns.length; b += 1) {
            btns[b].addEventListener("click", function (ev) {
              pushWord(ev.currentTarget.getAttribute("data-w"));
            });
          }
          document.getElementById("btnForgotGWord").addEventListener("click", function () {
            pushWord("__FORGOT__");
          });
          document.getElementById("btnUndoGWord").addEventListener("click", function () {
            if (chosenWords.length > 0) {
              chosenWords.pop();
              lastChoiceTs = nowMs();
              renderWordStage();
            }
          });
        }

        function pushWord(w) {
          if (chosenWords.length >= needW) return;
          var now = nowMs();
          itemAssemblyRts.push(Math.max(80, Math.round(now - lastChoiceTs)));
          lastChoiceTs = now;
          chosenWords.push(w);
          if (chosenWords.length === needW) {
            // Score via order-preserving LCS + High-Threshold Intrusion Correction (eliminates rank-shift zeroing!)
            var numEval = scoreOrderedStreamRecall(chosenNums, tr.expectedNumbersAsc, 9);
            var wordEval = scoreOrderedStreamRecall(chosenWords, tr.expectedWordsRev, tr.wordPool.length || 12);
            var pct = Math.round((numEval.pct + wordEval.pct) / 2);
            trialScores.push({
              mode: tr.mode,
              pairs: tr.pairCount,
              pct: pct,
              numPct: numEval.pct,
              wordPct: wordEval.pct
            });
            idx += 1;
            scheduleTimer(nextTrial, 220);
          } else {
            renderWordStage();
          }
        }

        renderWordStage();
      }
    }

    nextTrial();
  }

  function finishGating(trialScores, itemAssemblyRts) {
    var blockedArr = [], alt4Arr = [], alt6Arr = [];
    var altNumArr = [], altWordArr = [], allAltScores = [];

    for (var i = 0; i < trialScores.length; i += 1) {
      var t = trialScores[i];
      if (t.mode === "blocked") {
        blockedArr.push(t.pct);
      } else {
        allAltScores.push(t.pct);
        altNumArr.push(t.numPct);
        altWordArr.push(t.wordPct);
        if (t.pairs === 2) alt4Arr.push(t.pct);
        else alt6Arr.push(t.pct);
      }
    }

    var blockedPct = mean(blockedArr);
    var alt4Pct = mean(alt4Arr);
    var alt6Pct = mean(alt6Arr);
    var numStreamAltPct = mean(altNumArr);
    var wordStreamAltPct = mean(altWordArr);
    var alternatingPct = Math.round(0.30 * alt4Pct + 0.70 * alt6Pct);
    var switchingPenalty = Math.max(0, Math.round(blockedPct - alt6Pct));
    var meanAssemblyRtMs = mean(itemAssemblyRts);
    var splitHalfPct = computeSplitHalf(allAltScores);

    var diag =
      "الفرز المتكتل المتناظر (ABBA) سجل " +
      blockedPct +
      "% مقابل " +
      alt6Pct +
      "% عند تناوب 6 عناصر (عقوبة التناوب الطرحية الصافية: " +
      switchingPenalty +
      "%)؛ تحت التناوب صمد مسار الأرقام المرتب بنسبة " +
      numStreamAltPct +
      "% ومسار عكس الكلمات بنسبة " +
      wordStreamAltPct +
      "%.";

    completeProbe(
      "gating",
      alternatingPct,
      meanAssemblyRtMs,
      {
        blockedPct: blockedPct,
        alt4Pct: alt4Pct,
        alt6Pct: alt6Pct,
        alternatingPct: alternatingPct,
        switchingPenalty: switchingPenalty,
        numStreamAltPct: numStreamAltPct,
        wordStreamAltPct: wordStreamAltPct,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "دقة المتكتل المتوازن", val: blockedPct + "%" },
        { label: "تناوب 4 عناصر", val: alt4Pct + "%" },
        { label: "تناوب 6 عناصر", val: alt6Pct + "%" },
        { label: "عقوبة التناوب الصافية", val: switchingPenalty + "%" },
        { label: "مسار الأرقام مقابل الكلمات", val: numStreamAltPct + "% / " + wordStreamAltPct + "%" },
        { label: "زمن اختيار العنصر", val: meanAssemblyRtMs + " ms" }
      ],
      diag
    );
  }

  /* =========================================================================
     PROBE 4: BINDING (Non-Redundant 6-Foil Matrix + Syntactic Slot Verification)
     ========================================================================= */
  function runBindingProbe() {
    var S = getStimuli();
    var trials = S.generateBindingTrials(6);
    var meta = findProbeMeta("binding");
    var idx = 0;
    var records = [];
    var lastTrustedPremiseTs = 0;

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishBinding(records);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      var premiseRts = [];
      showPremise(0);

      function showPremise(pIdx) {
        cleanupActive();
        if (pIdx >= tr.premises.length) {
          return showBindingQuestion();
        }
        var t0 = nowMs();
        var totalP = tr.premises.length;
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          (pIdx + 1) +
          " / " +
          totalP +
          "</span></div>" +
          '<div class="stim-step-text">' +
          esc(tr.premises[pIdx]) +
          "</div>" +
          renderDots(totalP, pIdx) +
          '<button id="btnNextPremise" type="button" class="btn-primary"><span>' +
          (pIdx < totalP - 1 ? "التالي" : "السؤال") +
          '</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
          "</div>";

        onNextFramePaint(function (pTs) {
          t0 = pTs;
        });

        var advanced = false;
        var adv = function (pressTs, rawEv) {
          if (advanced) return;
          var curTs = pressTs || nowMs();
          if (rawEv && rawEv.isTrusted && curTs - lastTrustedPremiseTs < 160) return;
          if (rawEv && rawEv.isTrusted) lastTrustedPremiseTs = curTs;

          advanced = true;
          unbindKeyHandler();
          premiseRts.push(Math.max(120, Math.round(curTs - t0)));
          showPremise(pIdx + 1);
        };
        bindFastPress(document.getElementById("btnNextPremise"), function (ev, pressTs) {
          adv(pressTs, ev);
        });
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            adv(nowMs(), ev);
          }
        });
      }

      function showBindingQuestion() {
        cleanupActive();
        var tQ = nowMs();
        var optsHtml = "";
        for (var e = 0; e < tr.entities.length; e += 1) {
          optsHtml +=
            '<button type="button" class="opt-btn" data-ent-idx="' +
            e +
            '">' +
            esc(tr.entities[e]) +
            "</button>";
        }

        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label">السؤال</div>' +
          '<p class="task-question">' +
          esc(tr.question) +
          "</p>" +
          '<div class="options-grid">' +
          optsHtml +
          "</div>" +
          '<div class="arena-utility-row">' +
          '<button id="btnPointerDecay" type="button" class="btn-forgot">نسيت الاسم فقط (أعرف موقعه)</button>' +
          "</div>" +
          "</div>";

        onNextFramePaint(function (pTs) {
          tQ = pTs;
        });

        var decided = false;
        var sumPremisesMs = 0;
        for (var p = 0; p < premiseRts.length; p += 1) sumPremisesMs += premiseRts[p];

        function recordAndAdvance(val, isPointerDecayReport, nodeVerified, qRt) {
          var isExact = !isPointerDecayReport && val === tr.answer;
          var isFoil =
            !isPointerDecayReport &&
            !isExact &&
            Array.isArray(tr.foilEntities) &&
            tr.foilEntities.indexOf(val) !== -1;
          var isPolaritySwap =
            !isPointerDecayReport &&
            !isExact &&
            !isFoil;

          records.push({
            polarity: tr.polarity,
            correct: isExact,
            verifiedPointerDecay: Boolean(isPointerDecayReport && nodeVerified),
            unverifiedCollapse: Boolean(isPointerDecayReport && !nodeVerified),
            foilIntrusion: isFoil,
            polarityError: isPolaritySwap,
            qRtMs: qRt,
            totalRtMs: qRt + sumPremisesMs
          });
          idx += 1;
          scheduleTimer(nextTrial, 200);
        }

        function askObjectiveStructuralCheck(qRt) {
          cleanupActive();
          var sc = tr.structuralCheck;
          if (!sc || !Array.isArray(sc.options)) {
            return recordAndAdvance("", true, true, qRt);
          }

          var scHtml = "";
          for (var s = 0; s < sc.options.length; s += 1) {
            scHtml +=
              '<button type="button" class="opt-btn" data-sc-idx="' +
              s +
              '">' +
              esc(sc.options[s]) +
              "</button>";
          }

          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<div class="stim-label">فحص الموقع</div>' +
            '<p class="task-question">' +
            esc(sc.prompt) +
            "</p>" +
            '<div class="options-grid">' +
            scHtml +
            "</div>" +
            "</div>";

          var scBtns = domRefs.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < scBtns.length; b += 1) {
            scBtns[b].addEventListener("click", function (ev) {
              unbindKeyHandler();
              var pickIdx = Number(ev.currentTarget.getAttribute("data-sc-idx"));
              var okNode = sc.options[pickIdx] === sc.answer;
              recordAndAdvance("", true, okNode, qRt);
            });
          }

          bindKeyHandler(function (ev) {
            var n = Number(ev.key);
            if (n >= 1 && n <= sc.options.length) {
              ev.preventDefault();
              unbindKeyHandler();
              var okNode = sc.options[n - 1] === sc.answer;
              recordAndAdvance("", true, okNode, qRt);
            }
          });
        }

        var choose = function (val, isPointerDecay, pressTs) {
          if (decided) return;
          decided = true;
          unbindKeyHandler();
          var qRt = Math.max(120, Math.round((pressTs || nowMs()) - tQ));
          if (isPointerDecay) {
            askObjectiveStructuralCheck(qRt);
          } else {
            recordAndAdvance(val, false, false, qRt);
          }
        };

        var btns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < btns.length; b += 1) {
          (function (btnEl) {
            bindFastPress(btnEl, function (_ev, pressTs) {
              var k = Number(btnEl.getAttribute("data-ent-idx"));
              choose(tr.entities[k], false, pressTs);
            });
          })(btns[b]);
        }
        document.getElementById("btnPointerDecay").addEventListener("click", function () {
          choose("", true, nowMs());
        });

        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.entities.length) {
            ev.preventDefault();
            choose(tr.entities[n - 1], false, nowMs());
          }
        });
      }
    }

    nextTrial();
  }

  function finishBinding(records) {
    var linCorrect = 0, linCount = 0, flipCorrect = 0, flipCount = 0;
    var verifiedPointerDecayCount = 0, polarityErrorCount = 0, foilIntrusionCount = 0;
    var structuralResolvedTotal = 0;
    var linRts = [], flipRts = [], allQ = [], correctQ = [], trialScores = [];

    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      allQ.push(r.qRtMs);
      if (r.correct) {
        correctQ.push(r.qRtMs);
        structuralResolvedTotal += 1;
      } else if (r.verifiedPointerDecay) {
        verifiedPointerDecayCount += 1;
        structuralResolvedTotal += 1;
      }
      if (r.polarityError) polarityErrorCount += 1;
      if (r.foilIntrusion) foilIntrusionCount += 1;

      trialScores.push(r.correct ? 100 : 0);

      if (r.polarity === "linear") {
        linCount += 1;
        if (r.correct) linCorrect += 1;
        linRts.push(r.totalRtMs);
      } else {
        flipCount += 1;
        if (r.correct) flipCorrect += 1;
        flipRts.push(r.totalRtMs);
      }
    }

    var score = Math.round(((linCorrect + flipCorrect) / Math.max(1, records.length)) * 100);
    var structuralResolutionPct = Math.round((structuralResolvedTotal / Math.max(1, records.length)) * 100);
    var linearAccPct = linCount > 0 ? Math.round((linCorrect / linCount) * 100) : 0;
    var flippedAccPct = flipCount > 0 ? Math.round((flipCorrect / flipCount) * 100) : 0;
    var linMean = mean(linRts);
    var flipMean = mean(flipRts);
    var flipCost = Math.round(flipMean - linMean);
    var meanQRt = mean(allQ);
    var lisasMs = computeLisasSafe(correctQ, allQ, 1 - score / 100);
    var splitHalfPct = computeSplitHalf(trialScores);

    var diag =
      "دقة ربط الاسم الكامل بلغت " +
      linearAccPct +
      "% في الاتجاه الموحد مقابل " +
      flippedAccPct +
      "% عند انقلاب القطبية، بينما بلغت سلامة حل العقدة البنيوية " +
      structuralResolutionPct +
      "% (مع ثبوت " +
      verifiedPointerDecayCount +
      " حالات انفكاك محقق للاسم عن عقدة صحيحة، و" +
      polarityErrorCount +
      " أخطاء عكس قطبية، و" +
      foilIntrusionCount +
      " اقتحامات لبدائل غير مذكورة).";

    completeProbe(
      "binding",
      score,
      meanQRt,
      {
        linearAccPct: linearAccPct,
        flippedAccPct: flippedAccPct,
        structuralResolutionPct: structuralResolutionPct,
        pointerDecayCount: verifiedPointerDecayCount + foilIntrusionCount,
        verifiedPointerDecayCount: verifiedPointerDecayCount,
        polarityErrorCount: polarityErrorCount,
        foilIntrusionCount: foilIntrusionCount,
        linearRtMs: linMean,
        flippedRtMs: flipMean,
        polarityFlipRtCostMs: flipCost,
        lisasMs: lisasMs,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "دقة الاتجاه الموحد", val: linearAccPct + "%" },
        { label: "دقة انقلاب القطبية", val: flippedAccPct + "%" },
        { label: "سلامة العقدة البنيوية", val: structuralResolutionPct + "%" },
        { label: "تبخر اسم محقق بنيويا", val: String(verifiedPointerDecayCount) },
        { label: "أخطاء عكس القطبية", val: String(polarityErrorCount) },
        { label: "كلفة قلب القطبية", val: (flipCost >= 0 ? "+" : "") + flipCost + " ms" }
      ],
      diag
    );
  }

  /* =========================================================================
     PROBE 5: VIGILANCE (Endogenous Cycle Resync + Ex-Gaussian Tau + PVT)
     ========================================================================= */
  function runVigilanceProbe() {
    var S = getStimuli();
    var cfg = S.generateVigilanceConfig();
    var meta = findProbeMeta("vigilance");
    setHeader(meta.title, sessionState.isBattery ? "مسبار 5/6 · متصل" : "متصل · 36 ومضة");

    domRefs.stage.innerHTML =
      '<div class="vigilance-pad">' +
      '<div class="probe-bar-track" style="max-width:340px;"><div id="vigProgFill" class="probe-bar-fill" style="width:0%"></div></div>' +
      '<div id="vigPulseRing" class="pulse-ring">●</div>' +
      '<p id="vigStatusMsg" class="vig-status-msg">ضغطة واحدة لكل ضوء: ثلاث بالأول ورابعتها بالثاني</p>' +
      '<div class="vig-actions">' +
      '<button id="btnVigStep" type="button" class="vig-btn-step"><span>ومضة 1 أو 2 أو 3</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
      '<button id="btnVigClose" type="button" class="vig-btn-close"><span>الومضة 4 فقط</span><kbd class="kbd-chip ltr-iso">Enter</kbd></button>' +
      "</div>" +
      '<div class="arena-utility-row">' +
      '<button id="btnVigReset" type="button" class="vig-btn-reset">ضاع العدّ — أعد من 1</button>' +
      "</div>" +
      "</div>";

    var ringEl = document.getElementById("vigPulseRing");
    var msgEl = document.getElementById("vigStatusMsg");
    var fillEl = document.getElementById("vigProgFill");

    var pulseIdx = 0;
    var presentedBeats = 0; // Flashes presented since last boundary
    var tappedInCycle = 0;  // Valid conscious user responses since last boundary
    var missedInCycle = 0;  // Unanswered flashes in current cycle (prevents missed-pulse phase cascade!)
    var respondedCurrent = true;
    var lastBeatAction = "";
    var pulseStartTs = 0;
    var lastValidRespTs = 0;

    var validRts = [];
    var half1Rts = [];
    var half2Rts = [];
    var halfPulseScores = [];

    var stepOrCloseCorrect = 0;
    var exactCycles = 0;
    var prematureClosures = 0;
    var autopilotOverruns = 0;
    var localSleepLapses = 0;
    var missedPulses = 0;
    var falseStarts = 0;
    var dmnResets = 0;
    var bounceGuardMs = cfg.bounceGuardMs || 220;

    function handleAction(actionType, pressTs) {
      var eventTime = pressTs || nowMs();

      if (actionType === "reset") {
        dmnResets += 1;
        presentedBeats = 0;
        tappedInCycle = 0;
        missedInCycle = 0;
        respondedCurrent = true;
        lastBeatAction = "";
        lastValidRespTs = eventTime;
        if (msgEl) msgEl.textContent = "تمت إعادة المزامنة — الومضة القادمة ستكون رقم 1";
        return;
      }

      if (pulseIdx === 0) {
        falseStarts += 1;
        if (msgEl) msgEl.textContent = "انتبه: استجابة استباقية قبل الومضة الأولى";
        return;
      }

      if (respondedCurrent) {
        if (
          actionType === "close" &&
          lastBeatAction === "step" &&
          tappedInCycle >= cfg.cycleLength
        ) {
          if (tappedInCycle % cfg.cycleLength === 0) {
            autopilotOverruns = Math.max(0, autopilotOverruns - 1);
          }
          if (halfPulseScores.length > 0) {
            halfPulseScores[halfPulseScores.length - 1] = 65;
          }
          presentedBeats = 0;
          tappedInCycle = 0;
          missedInCycle = 0;
          lastBeatAction = "close";
          lastValidRespTs = eventTime;
          if (msgEl) msgEl.textContent = "تم إغلاق الدورة 4 (ابدأ من 1)";
          return;
        }
        // Ignore <220ms multi-touch fat-finger / button-release bounce after a valid response!
        if (lastValidRespTs > 0 && eventTime - lastValidRespTs < bounceGuardMs) {
          return;
        }
        falseStarts += 1;
        if (msgEl) msgEl.textContent = "انتبه: لا تضغط قبل ظهور الومضة الضوئية";
        return;
      }

      var rt = Math.max(1, Math.round(eventTime - pulseStartTs));

      // Basner & Dinges (2011) PVT standard: RT < 120ms is an anticipatory false start, not a true visual response
      if (rt < (cfg.anticipationMs || 120)) {
        falseStarts += 1;
        if (msgEl) msgEl.innerHTML = 'استباقي مبكر (<span class="ltr-iso">' + rt + " ms &lt; 120 ms</span>)";
        return;
      }

      respondedCurrent = true;
      lastBeatAction = actionType;
      lastValidRespTs = eventTime;
      tappedInCycle += 1;
      validRts.push(rt);
      if (pulseIdx <= Math.floor(cfg.totalPulses / 2)) {
        half1Rts.push(rt);
      } else {
        half2Rts.push(rt);
      }

      if (rt > cfg.lapseThresholdMs) {
        localSleepLapses += 1;
      }

      var pulseHit = 0;
      if (actionType === "close") {
        // Exact boundary if 4 conscious taps OR (4 presented flashes when a motor tap timed out mid-cycle)
        var isExactConscious4 = tappedInCycle === cfg.cycleLength;
        var isMotorTimeout4 = missedInCycle > 0 && presentedBeats === cfg.cycleLength;
        if (isExactConscious4 || isMotorTimeout4) {
          exactCycles = Math.min(Math.floor(cfg.totalPulses / cfg.cycleLength), exactCycles + 1);
          stepOrCloseCorrect += 1;
          pulseHit = 100;
        } else if (tappedInCycle < cfg.cycleLength && presentedBeats < cfg.cycleLength) {
          prematureClosures += 1;
        } else {
          pulseHit = 50;
        }
        // Crucial endogenous resynchronization: closing a cycle resets user's internal accumulator to 0!
        presentedBeats = 0;
        tappedInCycle = 0;
        missedInCycle = 0;
      } else {
        // actionType === "step": DLS Autopilot Overrun occurs when user taps "step" 4+ times without closing!
        if (tappedInCycle >= cfg.cycleLength && tappedInCycle % cfg.cycleLength === 0) {
          autopilotOverruns += 1;
        } else {
          stepOrCloseCorrect += 1;
          pulseHit = 100;
        }
      }

      halfPulseScores.push(pulseHit);
      if (msgEl) {
        msgEl.innerHTML = '<span class="ltr-iso">' + rt + " ms</span>";
      }
    }

    bindFastPress(document.getElementById("btnVigStep"), function (_ev, ts) {
      handleAction("step", ts);
    });
    bindFastPress(document.getElementById("btnVigClose"), function (_ev, ts) {
      handleAction("close", ts);
    });
    bindFastPress(document.getElementById("btnVigReset"), function (_ev, ts) {
      handleAction("reset", ts);
    });

    bindKeyHandler(function (ev) {
      var ts = nowMs();
      if (ev.key === " ") {
        ev.preventDefault();
        handleAction("step", ts);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        handleAction("close", ts);
      } else if (ev.key === "r" || ev.key === "R" || ev.key === "0") {
        ev.preventDefault();
        handleAction("reset", ts);
      }
    });

    function fireNextPulse() {
      if (pulseIdx > 0 && !respondedCurrent) {
        missedPulses += 1;
        missedInCycle += 1;
        localSleepLapses += 1;
        halfPulseScores.push(0);
      }

      if (pulseIdx >= cfg.totalPulses) {
        return finishVigilance({
          totalPulses: cfg.totalPulses,
          expectedCycles: Math.floor(cfg.totalPulses / cfg.cycleLength),
          validRts: validRts,
          half1Rts: half1Rts,
          half2Rts: half2Rts,
          halfPulseScores: halfPulseScores,
          stepOrCloseCorrect: stepOrCloseCorrect,
          exactCycles: exactCycles,
          prematureClosures: prematureClosures,
          autopilotOverruns: autopilotOverruns,
          localSleepLapses: localSleepLapses,
          missedPulses: missedPulses,
          falseStarts: falseStarts,
          dmnResets: dmnResets
        });
      }

      var currentInterval =
        Array.isArray(cfg.intervalsMs) && cfg.intervalsMs[pulseIdx]
          ? cfg.intervalsMs[pulseIdx]
          : cfg.baseIntervalMs + Math.floor((Math.random() * 2 - 1) * cfg.jitterMs);

      pulseIdx += 1;
      presentedBeats += 1;
      respondedCurrent = false;
      lastBeatAction = "";

      if (fillEl) {
        fillEl.style.width = Math.round((pulseIdx / cfg.totalPulses) * 100) + "%";
      }
      if (ringEl) {
        ringEl.classList.add("is-flashing");
      }

      onNextFramePaint(function (paintTs) {
        pulseStartTs = paintTs;
        scheduleFrameAccurate(function () {
          if (ringEl) ringEl.classList.remove("is-flashing");
        }, cfg.flashDurationMs);
      });

      scheduleFrameAccurate(fireNextPulse, currentInterval);
    }

    scheduleFrameAccurate(fireNextPulse, 900);
  }

  function finishVigilance(st) {
    var A = getAnalytics();
    var exG = typeof A.computeExGaussian === "function"
      ? A.computeExGaussian(st.validRts)
      : { meanMs: mean(st.validRts), medianMs: median(st.validRts), icvPct: 0, tauMs: 0, muMs: mean(st.validRts) };

    var expectedCycles = Math.max(1, st.expectedCycles);
    var cycleCloseAccPct = Math.min(100, Math.round((st.exactCycles / expectedCycles) * 100));
    var overallAcc = st.totalPulses > 0 ? Math.round((st.stepOrCloseCorrect / st.totalPulses) * 100) : 0;

    var medH1 = median(st.half1Rts);
    var medH2 = median(st.half2Rts);
    var vigilanceDecrementMs =
      st.half1Rts.length > 0 && st.half2Rts.length > 0 ? Math.round(medH2 - medH1) : 0;

    var stabilityScore = Math.max(
      0,
      100 - st.localSleepLapses * 10 - st.dmnResets * 13 - st.falseStarts * 5
    );
    var cycleComposite = Math.round(0.55 * cycleCloseAccPct + 0.45 * overallAcc);
    var finalScore = Math.max(0, Math.min(100, Math.round(0.65 * cycleComposite + 0.35 * stabilityScore)));
    var splitHalfPct = computeSplitHalf(st.halfPulseScores);

    var diag =
      "أُغلقت " +
      st.exactCycles +
      " من " +
      expectedCycles +
      " دورات رباعية بدقة (" +
      cycleCloseAccPct +
      "%) مع " +
      st.autopilotOverruns +
      " حالات تجاوز على الطيار الآلي و" +
      st.prematureClosures +
      " إغلاقات مبكرة؛ الذيل الأسي للشرود والنوم الموضعي (MAP-MLE Tau) بلغ " +
      exG.tauMs +
      " ms مقابل سرعة قاعدية (Mu) " +
      exG.muMs +
      " ms، وهفوات النوم الموضعي " +
      st.localSleepLapses +
      " (منها " +
      st.missedPulses +
      " ومضات فائتة).";

    completeProbe(
      "vigilance",
      finalScore,
      exG.meanMs,
      {
        cycleCloseAccPct: cycleCloseAccPct,
        overallStepAccPct: overallAcc,
        autopilotOverruns: st.autopilotOverruns,
        prematureClosures: st.prematureClosures,
        localSleepLapses: localSleepLapsesCount(st),
        missedPulses: st.missedPulses,
        dmnResets: st.dmnResets,
        falseStarts: st.falseStarts,
        meanRtMs: exG.meanMs,
        medianRtMs: exG.medianMs,
        rtTauMs: exG.tauMs,
        rtIcvPct: exG.icvPct,
        vigilanceDecrementMs: vigilanceDecrementMs,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "دقة إغلاق الدورة 4", val: cycleCloseAccPct + "%" },
        { label: "ذيل الشرود الأسي (Tau)", val: exG.tauMs + " ms" },
        { label: "تجاوز الطيار الآلي", val: String(st.autopilotOverruns) },
        { label: "هفوات النوم الموضعي", val: String(st.localSleepLapses) },
        { label: "وسيط الاستجابة / التدهور", val: exG.medianMs + " ms (" + (vigilanceDecrementMs >= 0 ? "+" : "") + vigilanceDecrementMs + ")" },
        { label: "ضياع العدّاد (DMN)", val: String(st.dmnResets) }
      ],
      diag
    );
  }

  function localSleepLapsesCount(st) {
    return typeof st.localSleepLapses === "number" ? st.localSleepLapses : 0;
  }

  /* =========================================================================
     PROBE 6: CONTROL ANCHOR (Stack + Rule-Interrupt + Z2xZ2 2D Visual Cache)
     ========================================================================= */
  function renderPolygonSVG(points) {
    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon points="' +
      points.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
      '" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="50" r="2.1" fill="currentColor" opacity="0.42"/>' +
      "</svg>"
    );
  }

  function renderProportionWindowSVG(spec) {
    var w = spec ? spec.w : 66;
    var h = spec ? spec.h : 64;
    var x0 = Math.round((100 - w) / 2 * 10) / 10;
    var y0 = Math.round((100 - h) / 2 * 10) / 10;
    var vx = Math.round((x0 + (w * (spec ? spec.sx : 60)) / 100) * 10) / 10;
    var hy = Math.round((y0 + (h * (spec ? spec.sy : 38)) / 100) * 10) / 10;

    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="2" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="2.7"/>' +
      '<line x1="' + vx + '" y1="' + y0 + '" x2="' + vx + '" y2="' + (y0 + h) + '" stroke="currentColor" stroke-width="2.4"/>' +
      '<line x1="' + x0 + '" y1="' + hy + '" x2="' + (x0 + w) + '" y2="' + hy + '" stroke="currentColor" stroke-width="2.4"/>' +
      '<circle cx="' + vx + '" cy="' + hy + '" r="2.4" fill="currentColor"/>' +
      "</svg>"
    );
  }

  function renderVisualStimulusSVG(tr, optionIdx) {
    if (tr.visualSubtype === "window" && tr.targetWindow) {
      var winSpec = typeof optionIdx === "number" ? tr.optionsWindows[optionIdx] : tr.targetWindow;
      return renderProportionWindowSVG(winSpec);
    }
    var pts = typeof optionIdx === "number" ? tr.optionsPoints[optionIdx] : tr.targetPoints;
    return renderPolygonSVG(pts);
  }

  // High-density multi-orientation contour + spatial-frequency luminance mask
  // Terminates V1 oriented-edge iconic persistence (<300ms) to isolate pure V4/LOC Visual Cache
  function renderMaskSVG(seed) {
    var s = Number(seed) || 1337;
    function nextRand() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s & 0xffff) / 65536;
    }

    var parts = [];
    for (var r = 0; r < 10; r += 1) {
      for (var c = 0; c < 10; c += 1) {
        if ((r + c) % 2 === 0) {
          parts.push(
            '<rect x="' + (c * 10) + '" y="' + (r * 10) + '" width="10" height="10" fill="currentColor" opacity="0.28"/>'
          );
        }
      }
    }
    for (var l = 0; l < 28; l += 1) {
      var x1 = Math.round(nextRand() * 96 + 2);
      var y1 = Math.round(nextRand() * 96 + 2);
      var x2 = Math.round(nextRand() * 96 + 2);
      var y2 = Math.round(nextRand() * 96 + 2);
      parts.push(
        '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="currentColor" stroke-width="2.4" opacity="0.68"/>'
      );
    }
    for (var k = 0; k < 5; k += 1) {
      var cx = Math.round(nextRand() * 68 + 16);
      var cy = Math.round(nextRand() * 68 + 16);
      var rad = Math.round(nextRand() * 18 + 8);
      parts.push(
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="none" stroke="currentColor" stroke-width="2.1" opacity="0.55"/>'
      );
    }
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + parts.join("") + "</svg>";
  }

  function runControlProbe() {
    var S = getStimuli();
    var trials = S.generateControlTrials();
    var meta = findProbeMeta("control");
    var idx = 0;
    var stackHits = 0, stackTotal = 0;
    var ruleHits = 0, ruleTotal = 0;
    var visHits = 0, visTotal = 0;
    var stackRts = [], visRts = [], trialScores = [];
    var visReplayCounts = {};
    var lastTrustedFrameTs = 0;

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishControl(stackHits, stackTotal, ruleHits, ruleTotal, visHits, visTotal, stackRts, visRts, trialScores);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      if (tr.kind === "stack") {
        runStackTrial(tr);
      } else if (tr.kind === "rule_interrupt") {
        runRuleInterruptTrial(tr);
      } else {
        runVisualTrial(tr);
      }
    }

    function runStackTrial(tr) {
      var frames = [
        { label: "1 / 3", text: tr.frame1Text, btn: "التالي" },
        { label: "2 / 3", text: tr.frame2Text, btn: "التالي" },
        { label: "3 / 3", text: tr.frame3Text, btn: "احسب الناتج" }
      ];

      function showFrame(fIdx) {
        cleanupActive();
        if (fIdx >= frames.length) {
          var t0 = nowMs();
          var optsHtml = "";
          for (var o = 0; o < tr.options.length; o += 1) {
            optsHtml +=
              '<button type="button" class="opt-btn" data-val="' +
              tr.options[o] +
              '"><span class="ltr-iso">' +
              tr.options[o] +
              "</span></button>";
          }
          domRefs.stage.innerHTML =
            '<div class="task-box">' +
            '<div class="stim-label">الجواب</div>' +
            '<p class="task-question">' +
            esc(tr.closeText) +
            "</p>" +
            '<div class="options-grid">' +
            optsHtml +
            "</div>" +
            "</div>";

          onNextFramePaint(function (pTs) { t0 = pTs; });

          var pickedDone = false;
          var pick = function (val, pressTs) {
            if (pickedDone) return;
            pickedDone = true;
            unbindKeyHandler();
            stackRts.push(Math.max(100, Math.round((pressTs || nowMs()) - t0)));
            stackTotal += 1;
            var hit = Number(val) === Number(tr.answer);
            if (hit) stackHits += 1;
            trialScores.push(hit ? 100 : 0);
            idx += 1;
            scheduleTimer(nextTrial, 200);
          };

          var btns = domRefs.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < btns.length; b += 1) {
            (function (btnEl) {
              bindFastPress(btnEl, function (_ev, pressTs) {
                pick(btnEl.getAttribute("data-val"), pressTs);
              });
            })(btns[b]);
          }
          bindKeyHandler(function (ev) {
            var n = Number(ev.key);
            if (n >= 1 && n <= tr.options.length) {
              ev.preventDefault();
              pick(tr.options[n - 1], nowMs());
            }
          });
          return;
        }

        var fr = frames[fIdx];
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label"><span class="ltr-iso">' +
          esc(fr.label) +
          "</span></div>" +
          '<div class="stim-step-text"><span class="ltr-iso math-expr">' +
          esc(fr.text) +
          "</span></div>" +
          renderDots(3, fIdx) +
          '<button id="btnNextStackFrame" type="button" class="btn-primary"><span>' +
          esc(fr.btn) +
          '</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
          "</div>";

        var adv = function (ev) {
          var curTs = nowMs();
          if (ev && ev.isTrusted && curTs - lastTrustedFrameTs < 160) return;
          if (ev && ev.isTrusted) lastTrustedFrameTs = curTs;
          unbindKeyHandler();
          showFrame(fIdx + 1);
        };
        document.getElementById("btnNextStackFrame").addEventListener("click", adv);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            adv(ev);
          }
        });
      }

      showFrame(0);
    }

    function runRuleInterruptTrial(tr) {
      // Step 1: Encode IF-ELSE rule -> Step 2: Compute single accumulator -> Step 3: Semantic interruption -> Step 4: Apply rule
      function stepRule() {
        cleanupActive();
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">الشرط (<span class="ltr-iso">1 / 3</span>)</div>' +
          '<div class="stim-step-text">' + esc(tr.ruleText) + "</div>" +
          renderDots(3, 0) +
          '<button id="btnRuleNext1" type="button" class="btn-primary"><span>التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
          "</div>";
        var go = function (ev) {
          var curTs = nowMs();
          if (ev && ev.isTrusted && curTs - lastTrustedFrameTs < 160) return;
          if (ev && ev.isTrusted) lastTrustedFrameTs = curTs;
          unbindKeyHandler();
          stepAccum();
        };
        document.getElementById("btnRuleNext1").addEventListener("click", go);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); go(ev); }
        });
      }

      function stepAccum() {
        cleanupActive();
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">العدد (<span class="ltr-iso">2 / 3</span>)</div>' +
          '<div class="stim-step-text">' + esc(tr.calcText) + "</div>" +
          renderDots(3, 1) +
          '<button id="btnRuleNext2" type="button" class="btn-primary"><span>التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
          "</div>";
        var go = function (ev) {
          var curTs = nowMs();
          if (ev && ev.isTrusted && curTs - lastTrustedFrameTs < 160) return;
          if (ev && ev.isTrusted) lastTrustedFrameTs = curTs;
          unbindKeyHandler();
          stepInterrupt();
        };
        document.getElementById("btnRuleNext2").addEventListener("click", go);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); go(ev); }
        });
      }

      function stepInterrupt() {
        cleanupActive();
        var iHtml = "";
        for (var i = 0; i < tr.interruptOptions.length; i += 1) {
          iHtml +=
            '<button type="button" class="opt-btn" data-iv="' +
            esc(tr.interruptOptions[i]) +
            '">' +
            esc(tr.interruptOptions[i]) +
            "</button>";
        }
        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label">مقاطعة (<span class="ltr-iso">3 / 3</span>)</div>' +
          '<p class="task-question">' + esc(tr.interruptPrompt) + "</p>" +
          '<div class="options-grid">' + iHtml + "</div>" +
          "</div>";

        var pickIntr = function (chosenI) {
          unbindKeyHandler();
          var intrOk = chosenI === tr.interruptAnswer;
          stepApply(intrOk);
        };
        var btns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < btns.length; b += 1) {
          btns[b].addEventListener("click", function (ev) {
            pickIntr(ev.currentTarget.getAttribute("data-iv"));
          });
        }
        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.interruptOptions.length) {
            ev.preventDefault();
            pickIntr(tr.interruptOptions[n - 1]);
          }
        });
      }

      function stepApply(intrOk) {
        cleanupActive();
        var t0 = nowMs();
        var oHtml = "";
        for (var o = 0; o < tr.options.length; o += 1) {
          oHtml +=
            '<button type="button" class="opt-btn" data-rv="' +
            tr.options[o] +
            '"><span class="ltr-iso">' +
            tr.options[o] +
            "</span></button>";
        }
        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label">التطبيق</div>' +
          '<p class="task-question">' + esc(tr.applyPrompt) + "</p>" +
          '<div class="options-grid">' + oHtml + "</div>" +
          "</div>";

        onNextFramePaint(function (pTs) { t0 = pTs; });

        var doneApply = false;
        var finishRule = function (val, pressTs) {
          if (doneApply) return;
          doneApply = true;
          unbindKeyHandler();
          stackRts.push(Math.max(100, Math.round((pressTs || nowMs()) - t0)));
          ruleTotal += 1;
          var hit = intrOk && Number(val) === Number(tr.answer);
          if (hit) ruleHits += 1;
          trialScores.push(hit ? 100 : 0);
          idx += 1;
          scheduleTimer(nextTrial, 200);
        };

        var btns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < btns.length; b += 1) {
          (function (btnEl) {
            bindFastPress(btnEl, function (_ev, pressTs) {
              finishRule(btnEl.getAttribute("data-rv"), pressTs);
            });
          })(btns[b]);
        }
        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.options.length) {
            ev.preventDefault();
            finishRule(tr.options[n - 1], nowMs());
          }
        });
      }

      stepRule();
    }

    function runVisualTrial(tr) {
      // Guard the transient 800ms visual flash against tab backgrounding:
      // If tab hides during fixation/flash/mask, regenerate a fresh Z2xZ2 visual trial on return!
      if ((visReplayCounts[idx] || 0) < 2) {
        setEncodingVisibilityGuard(function () {
          visReplayCounts[idx] = (visReplayCounts[idx] || 0) + 1;
          var freshCtrl = S.generateControlTrials();
          for (var f = 0; f < freshCtrl.length; f += 1) {
            if (freshCtrl[f].kind === "visual2d" && freshCtrl[f].visualSubtype === tr.visualSubtype) {
              trials[idx] = freshCtrl[f];
              break;
            }
          }
          nextTrial();
        });
      }

      domRefs.stage.innerHTML =
        '<div class="visual-canvas-wrap">' +
        '<div class="stim-label">التقط الشكل</div>' +
        '<div class="visual-svg-box"><span class="stim-num">+</span></div>' +
        "</div>";

      scheduleFrameAccurate(function () {
        domRefs.stage.innerHTML =
          '<div class="visual-canvas-wrap">' +
          '<div class="stim-label">التقط الشكل</div>' +
          '<div class="visual-svg-box">' +
          renderVisualStimulusSVG(tr, null) +
          "</div>" +
          "</div>";

        onNextFramePaint(function () {
          scheduleFrameAccurate(function () {
            domRefs.stage.innerHTML =
              '<div class="visual-canvas-wrap">' +
              '<div class="stim-label">...</div>' +
              '<div class="visual-svg-box">' +
              renderMaskSVG(tr.maskSeed) +
              "</div>" +
              "</div>";

            onNextFramePaint(function () {
              scheduleFrameAccurate(function () {
                clearEncodingVisibilityGuard();
                domRefs.stage.innerHTML =
                  '<div class="visual-canvas-wrap">' +
                  '<div class="stim-label">احتفظ بالشكل...</div>' +
                  '<div class="visual-svg-box"></div>' +
                  "</div>";

                scheduleFrameAccurate(function () {
                  var t0 = nowMs();
                  var numOpts = tr.visualSubtype === "window" ? tr.optionsWindows.length : tr.optionsPoints.length;
                  var gridHtml = "";
                  for (var o = 0; o < numOpts; o += 1) {
                    gridHtml +=
                      '<button type="button" class="visual-opt-btn" data-opt="' +
                      o +
                      '">' +
                      renderVisualStimulusSVG(tr, o) +
                      "</button>";
                  }

                  domRefs.stage.innerHTML =
                    '<div class="task-box">' +
                    '<p class="task-question">الشكل المطابق؟</p>' +
                    '<div class="visual-options-grid">' +
                    gridHtml +
                    "</div>" +
                    "</div>";

                  onNextFramePaint(function (pTs) { t0 = pTs; });

                  var visPicked = false;
                  var pickVis = function (chosenIdx, pressTs) {
                    if (visPicked) return;
                    visPicked = true;
                    unbindKeyHandler();
                    visRts.push(Math.max(100, Math.round((pressTs || nowMs()) - t0)));
                    visTotal += 1;
                    var hit = Number(chosenIdx) === Number(tr.correctIndex);
                    if (hit) visHits += 1;
                    trialScores.push(hit ? 100 : 0);
                    idx += 1;
                    scheduleTimer(nextTrial, 200);
                  };

                  var btns = domRefs.stage.querySelectorAll(".visual-opt-btn");
                  for (var b = 0; b < btns.length; b += 1) {
                    (function (btnEl) {
                      bindFastPress(btnEl, function (_ev, pressTs) {
                        pickVis(btnEl.getAttribute("data-opt"), pressTs);
                      });
                    })(btns[b]);
                  }
                  bindKeyHandler(function (ev) {
                    var n = Number(ev.key);
                    if (n >= 1 && n <= 4) {
                      ev.preventDefault();
                      pickVis(n - 1, nowMs());
                    }
                  });
                }, tr.delayMs);
              }, tr.maskMs);
            });
          }, tr.flashMs);
        });
      }, 550);
    }

    nextTrial();
  }

  function finishControl(stackHits, stackTotal, ruleHits, ruleTotal, visHits, visTotal, stackRts, visRts, trialScores) {
    var frontalHits = stackHits + ruleHits;
    var frontalTotal = stackTotal + ruleTotal;
    var stackAccPct = frontalTotal > 0 ? Math.round((frontalHits / frontalTotal) * 100) : 0;
    var ruleInterruptAccPct = ruleTotal > 0 ? Math.round((ruleHits / ruleTotal) * 100) : 100;
    var visual2dAccPct = visTotal > 0 ? Math.round((visHits / visTotal) * 100) : 0;

    var totalTrials = frontalTotal + visTotal;
    var score = totalTrials > 0 ? Math.round(((frontalHits + visHits) / totalTrials) * 100) : 0;
    var stackRtMs = mean(stackRts);
    var visual2dRtMs = mean(visRts);
    var allMean = mean(stackRts.concat(visRts));
    var splitHalfPct = computeSplitHalf(trialScores);

    var diag =
      "مكدس الاستدعاء والقاعدة الشرطية تحت المقاطعة سجلا " +
      stackAccPct +
      "%، والمخزن البصري الصامت (ومضة 0.8s ثم فجوة 3.2s بتناظر Z2×Z2) سجل " +
      visual2dAccPct +
      "%؛ " +
      (score >= 82
        ? "ثبات المرساة فوق 82% يؤكد سلامة اليقظة العامة وصلاحية الجلسة للتفسير البؤري."
        : "هبوط المرساة دون 82% يشير إلى إرهاق عام عابر ينبغي مراعاته عند قراءة بقية المسبارات.");

    completeProbe(
      "control",
      score,
      allMean,
      {
        stackAccPct: stackAccPct,
        ruleInterruptAccPct: ruleInterruptAccPct,
        visual2dAccPct: visual2dAccPct,
        stackRtMs: stackRtMs,
        visual2dRtMs: visual2dRtMs,
        splitHalfPct: splitHalfPct
      },
      [
        { label: "المكدس والقاعدة الشرطية", val: stackAccPct + "%" },
        { label: "صمود القاعدة بعد المقاطعة", val: ruleInterruptAccPct + "%" },
        { label: "المخزن البصري (2D · 3.2s)", val: visual2dAccPct + "%" },
        { label: "زمن حل المكدس والشرط", val: stackRtMs + " ms" },
        { label: "زمن مطابقة التناسب (2D)", val: visual2dRtMs + " ms" },
        { label: "اتساق الجلسة النصفي", val: splitHalfPct + "%" }
      ],
      diag
    );
  }

  /* =========================================================================
     COMPLETION, PERSISTENCE & REPORT RENDERING (WITH RCI & VALIDITY)
     ========================================================================= */
  function completeProbe(probeId, score, rtMeanMs, submetrics, displayCards, diagnosisText) {
    cleanupActive();
    var A = getAnalytics();
    var meta = findProbeMeta(probeId);
    var ctx = sessionState.contextSnapshot || captureContext();
    var nowTs = Date.now();
    var recId = "rec_" + probeId + "_" + nowTs + "_" + Math.floor(Math.random() * 1000);

    var enrichedSubmetrics = Object.assign({}, submetrics || {});
    if (sessionState.tabInterruptions > 0) {
      enrichedSubmetrics.tabInterruptions = sessionState.tabInterruptions;
    }

    var saved = null;
    if (typeof A.recordProbeResult === "function") {
      try {
        saved = A.recordProbeResult({
          id: recId,
          timestamp: nowTs,
          batteryRunId: sessionState.isBattery ? sessionState.batteryRunId : null,
          probeId: probeId,
          score: score,
          rtMeanMs: rtMeanMs,
          submetrics: enrichedSubmetrics,
          phase: ctx.phase,
          sleepQuality: ctx.sleepQuality,
          alertness: ctx.alertness,
          nasalPatency: ctx.nasalPatency,
          delayAversionEpisodes: ctx.delayAversionEpisodes,
          sequenceLapses: ctx.sequenceLapses,
          notes: ctx.notes || ""
        });
      } catch (err) {
        console.error("recordProbeResult error:", err);
      }
    }

    if (sessionState.isBattery) {
      sessionState.batteryScores[probeId] = score;
    }

    if (callbacks.onSessionUpdate) {
      try {
        callbacks.onSessionUpdate(saved);
      } catch (_) {}
    }

    var deltaBase = saved && typeof saved.deltaFromBaseline === "number"
      ? saved.deltaFromBaseline
      : score - (meta.baselineScore || 0);
    var deltaSign = deltaBase > 0 ? "+" : "";
    var deltaCls = deltaBase > 0 ? "is-up" : deltaBase < 0 ? "is-down" : "is-neutral";

    var rciInfo = typeof A.computeRCI === "function"
      ? A.computeRCI(deltaBase, probeId, 1, 1)
      : { rci: 0, sem: meta.sem || 8, statusAr: "معاير", isReliable: false };
    var rciCls = rciInfo.rci >= 1.96 ? "is-up" : rciInfo.rci <= -1.96 ? "is-down" : "is-neutral";

    var cardsHtml = "";
    for (var i = 0; i < displayCards.length; i += 1) {
      cardsHtml +=
        '<div class="submetric-card">' +
        '<span class="stim-label">' +
        formatInlineTechHtml(displayCards[i].label) +
        "</span>" +
        '<strong style="font-size:1.06rem;"><span class="ltr-iso">' +
        esc(displayCards[i].val) +
        "</span></strong>" +
        "</div>";
    }

    var interruptionNotice =
      sessionState.tabInterruptions > 0
        ? '<div class="warmup-feedback is-warning">ملاحظة ضبط الجودة: رُصدت مغادرة للتبويب أثناء القياس (' +
          sessionState.tabInterruptions +
          " مرة)؛ يُفضل عدم مغادرة النافذة لضمان دقة الملي ثانية.</div>"
        : "";

    var isLastBatteryStep =
      sessionState.isBattery && sessionState.batteryIndex >= sessionState.batteryQueue.length - 1;

    setHeader(meta.title + " — النتيجة", score + "%");

    var actionsHtml = "";
    if (sessionState.isBattery && !isLastBatteryStep) {
      var nextMeta = findProbeMeta(sessionState.batteryQueue[sessionState.batteryIndex + 1]);
      actionsHtml =
        '<button id="btnNextBatteryProbe" type="button" class="btn-primary"><span>المسبار التالي: ' +
        esc(nextMeta.shortTitle || nextMeta.title) +
        '</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    } else if (isLastBatteryStep) {
      actionsHtml =
        '<button id="btnFinishFullBattery" type="button" class="btn-primary"><span>عرض الحصيلة الجراحية للبطارية الكاملة</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    } else {
      actionsHtml =
        '<button id="btnRetryProbe" type="button" class="btn-ghost">إعادة فحص المنطقة</button>' +
        '<button id="btnDoneProbe" type="button" class="btn-primary"><span>حفظ والعودة للوحة القيادة</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    }

    domRefs.stage.innerHTML =
      '<div class="result-report">' +
      '<div class="score-hero">' +
      '<div class="score-ring-val">' +
      score +
      "%</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
      '<span class="delta-pill ' +
      deltaCls +
      '">عن خط الأساس: <span class="ltr-iso">' +
      deltaSign +
      deltaBase +
      "% (±" +
      rciInfo.sem +
      "%)</span></span>" +
      '<span class="delta-pill ' +
      rciCls +
      '">' +
      formatInlineTechHtml(rciInfo.statusAr) +
      ' <span class="ltr-iso">(RCI ' +
      (rciInfo.rci > 0 ? "+" : "") +
      rciInfo.rci +
      ")</span></span>" +
      '<span class="delta-pill is-neutral">الهدف السليم: <span class="ltr-iso">' +
      (meta.normScore || 85) +
      "%</span></span>" +
      "</div>" +
      "</div>" +
      interruptionNotice +
      '<div class="submetrics-grid">' +
      cardsHtml +
      "</div>" +
      '<div class="diagnosis-callout">' +
      formatInlineTechHtml(diagnosisText) +
      "</div>" +
      '<div class="result-actions">' +
      actionsHtml +
      "</div>" +
      "</div>";

    if (sessionState.isBattery && !isLastBatteryStep) {
      var goNext = function () {
        unbindKeyHandler();
        sessionState.batteryIndex += 1;
        launchProbeIntro(sessionState.batteryQueue[sessionState.batteryIndex]);
      };
      document.getElementById("btnNextBatteryProbe").addEventListener("click", goNext);
      bindKeyHandler(function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          goNext();
        }
      });
    } else if (isLastBatteryStep) {
      var showFinal = function () {
        unbindKeyHandler();
        renderFullBatterySummary();
      };
      document.getElementById("btnFinishFullBattery").addEventListener("click", showFinal);
      bindKeyHandler(function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          showFinal();
        }
      });
    } else {
      document.getElementById("btnRetryProbe").addEventListener("click", function () {
        startSingleProbe(probeId, sessionState.contextSnapshot);
      });
      var closeFn = function () {
        closeOverlay();
      };
      document.getElementById("btnDoneProbe").addEventListener("click", closeFn);
      bindKeyHandler(function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          closeFn();
        }
      });
    }
  }

  function renderFullBatterySummary() {
    var A = getAnalytics();
    var ctx = sessionState.contextSnapshot || captureContext();
    var runRec = null;
    if (typeof A.finalizeBatteryRun === "function") {
      try {
        runRec = A.finalizeBatteryRun(sessionState.batteryRunId, sessionState.batteryScores, ctx);
      } catch (err) {
        console.error("finalizeBatteryRun error:", err);
      }
    }
    if (callbacks.onSessionUpdate) {
      try {
        callbacks.onSessionUpdate();
      } catch (_) {}
    }

    var comp = runRec ? runRec.compositeDeficitScore : 0;
    var ctrl = runRec ? runRec.controlScore : sessionState.batteryScores.control || 0;
    var deltaComp = comp - 36;
    var gap = ctrl - comp;
    var compRciObj = typeof A.computeRCI === "function"
      ? A.computeRCI(deltaComp, "composite", 1, 1)
      : { rci: 0, statusAr: "معاير", ci95Pts: 10.7 };
    var ctrlValid = ctrl >= 82;

    setHeader("الحصيلة الجراحية للبطارية الكاملة", "اكتملت 6 / 6");

    domRefs.stage.innerHTML =
      '<div class="result-report">' +
      '<div class="score-hero">' +
      '<div class="stim-label">مؤشر المناطق الخمس المتضررة المركب</div>' +
      '<div class="score-ring-val">' +
      comp +
      "%</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
      '<span class="delta-pill ' +
      (deltaComp >= 0 ? "is-up" : "is-down") +
      '">عن خط الأساس (<span class="ltr-iso">36%</span>): <span class="ltr-iso">' +
      (deltaComp >= 0 ? "+" : "") +
      deltaComp +
      "%</span></span>" +
      '<span class="delta-pill ' +
      (compRciObj.rci >= 1.96 ? "is-up" : compRciObj.rci <= -1.96 ? "is-down" : "is-neutral") +
      '">' +
      formatInlineTechHtml(compRciObj.statusAr) +
      ' <span class="ltr-iso">(RCI ' +
      (compRciObj.rci > 0 ? "+" : "") +
      compRciObj.rci +
      ")</span></span>" +
      '<span class="delta-pill ' +
      (ctrlValid ? "is-neutral" : "is-down") +
      '">مرساة الضبط: <span class="ltr-iso">' +
      ctrl +
      "%</span></span>" +
      '<span class="delta-pill is-neutral">فجوة التباين: <span class="ltr-iso">' +
      gap +
      "</span> نقطة</span>" +
      "</div>" +
      "</div>" +
      '<div class="diagnosis-callout">' +
      formatInlineTechHtml(
        ctrlValid
          ? "اكتمل توثيق المسبارات الستة بثبات سليم لمرساة الضبط (≥82%)؛ تبلغ عتبة التحسن المركب الموثوق إحصائيا عند p<0.05 مقدار +" +
            compRciObj.ci95Pts +
            " نقطة فوق خط الأساس. راجع تبويب المنحنيات لمعاينة التحليل الإحصائي الشامل."
          : "تنبيه منهجي: سجلت مرساة الضبط هبوطا دون 82% مما يشير إلى إرهاق عام أو نعاس عارض في هذه الجلسة؛ راجع تبويب المنحنيات لمقارنة الجلسة بالسجل الطولي."
      ) +
      "</div>" +
      '<div class="result-actions">' +
      '<button id="btnCloseBatterySummary" type="button" class="btn-primary"><span>العودة إلى لوحة القيادة والمنحنيات</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
      "</div>" +
      "</div>";

    sessionState.isBattery = false;
    sessionState.batteryRunId = null;

    var doneAll = function () {
      closeOverlay();
    };
    document.getElementById("btnCloseBatterySummary").addEventListener("click", doneAll);
    bindKeyHandler(function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        doneAll();
      }
    });
  }

  var Engine = {
    init: init,
    configure: init,
    abort: abort,
    stop: abort,
    startFullBattery: startFullBattery,
    startBattery: startFullBattery,
    runBattery: startFullBattery,
    launchBattery: startFullBattery,
    startSingleProbe: startSingleProbe,
    startProbe: startSingleProbe,
    runProbe: startSingleProbe,
    launchProbe: startSingleProbe,
    runInteractiveWarmup: runInteractiveWarmup
  };

  root.NeuroLab.Engine = Engine;
  root.Engine = Engine;
})();

(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var mountEl = null;
  var activeRunToken = 0;
  var activeRafId = null;
  var uiRafId = null;
  var keyHandler = null;
  var pointerCleanups = [];
  var visibilityBound = false;

  var isBattery = false;
  var isFamiliarizationRun = false;
  var batteryQueue = [
    "d1_tbrs",
    "d2_refback_m3",
    "d3_bays_analog",
    "d4_consolidation_soa",
    "d5_pvt5"
  ];
  var batteryIdx = 0;

  var resetArmed = false;
  var resetArmedAtMs = 0;

  // Calibrated hardware VSync timing state (strictly performance.now() monotonic clock)
  var displayCalib = {
    calibrated: false,
    calibrating: false,
    refreshHz: 60,
    frameMs: 16.67
  };

  // Per-probe runtime integrity telemetry
  var activeProbeGuard = null;

  function getCore() {
    return root.NeuroLab.DeepCore;
  }

  function getAnalytics() {
    return (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || null;
  }

  function getStimuli() {
    return (root.NeuroLab && root.NeuroLab.Stimuli) || root.Stimuli || null;
  }

  // Strictly unified monotonic clock: performance.now() ONLY (never mixed with rAF timestamp argument)
  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function esc(str) {
    var Core = getCore();
    var ascii = Core ? Core.toAsciiDigits(str) : String(str == null ? "" : str);
    return ascii
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ================= 1. rAF SCHEDULER, DISPLAY CALIBRATION & GUARDS ================= */

  function cancelMainRaf() {
    if (activeRafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(activeRafId);
    }
    activeRafId = null;
  }

  function clearActiveRun() {
    activeRunToken += 1;
    cancelMainRaf();
    for (var i = 0; i < pointerCleanups.length; i += 1) {
      try { pointerCleanups[i](); } catch (_) {}
    }
    pointerCleanups = [];
    unbindKeys();
  }

  function addPointerCleanup(fn) {
    pointerCleanups.push(fn);
  }

  function bindKeys(fn) {
    unbindKeys();
    keyHandler = function (ev) {
      // Strictly reject keyboard auto-repeat events across all tasks
      if (ev && ev.repeat) return;
      var RSKey = root.NeuroLab && root.NeuroLab.RepoSync;
      if (RSKey && typeof RSKey.shouldIgnoreArenaKey === "function" && RSKey.shouldIgnoreArenaKey(ev)) return;
      fn(ev);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", keyHandler);
    }
  }

  function unbindKeys() {
    if (keyHandler && typeof window !== "undefined") {
      window.removeEventListener("keydown", keyHandler);
    }
    keyHandler = null;
  }

  function isRightChoiceKey(ev) {
    var code = String(ev.code || "");
    var k = String(ev.key || "").toLowerCase();
    return code === "KeyJ" || k === "j" || k === "ت" || ev.key === "ArrowRight";
  }

  function isLeftChoiceKey(ev) {
    var code = String(ev.code || "");
    var k = String(ev.key || "").toLowerCase();
    return code === "KeyF" || k === "f" || k === "ب" || ev.key === "ArrowLeft";
  }

  function isUpChoiceKey(ev) {
    var code = String(ev.code || "");
    var k = String(ev.key || "").toLowerCase();
    return code === "KeyW" || k === "w" || k === "ص" || ev.key === "ArrowUp";
  }

  function isDownChoiceKey(ev) {
    var code = String(ev.code || "");
    var k = String(ev.key || "").toLowerCase();
    return code === "KeyS" || k === "s" || k === "س" || ev.key === "ArrowDown";
  }

  function scheduleUiDelay(durationMs, callback) {
    if (typeof requestAnimationFrame !== "function") {
      callback();
      return;
    }
    var start = nowMs();
    function tick() {
      if (nowMs() - start >= durationMs) {
        callback();
        return;
      }
      uiRafId = requestAnimationFrame(tick);
    }
    uiRafId = requestAnimationFrame(tick);
  }

  function showBannerToast(msg) {
    var toastEl = document.getElementById("toastEl");
    if (!toastEl) return;
    var Core = getCore();
    toastEl.textContent = Core ? Core.toAsciiDigits(msg) : msg;
    toastEl.hidden = false;
    var shownAt = nowMs();
    toastEl.setAttribute("data-shown-at", String(shownAt));
    scheduleUiDelay(2800, function () {
      if (toastEl.getAttribute("data-shown-at") === String(shownAt)) {
        toastEl.hidden = true;
      }
    });
  }

  var calibWaiters = [];

  // Measure actual display refreshHz using performance.now() deltas across rAF frames (never reading rAF(ts)!)
  function calibrateDisplayRefresh(forceRecalibrate, onDone) {
    if (displayCalib.calibrated && !forceRecalibrate) {
      if (onDone) onDone(displayCalib);
      return;
    }
    if (typeof requestAnimationFrame !== "function" || (typeof document !== "undefined" && document.hidden)) {
      displayCalib = { calibrated: true, calibrating: false, refreshHz: 60, frameMs: 16.67 };
      if (onDone) onDone(displayCalib);
      return;
    }

    if (onDone) calibWaiters.push(onDone);
    if (displayCalib.calibrating) return;

    displayCalib.calibrating = true;
    var dts = [];
    var prevNow = null;
    var frameIdx = 0;
    var totalSamples = 44;

    function sampleTick() {
      var curNow = nowMs();
      if (prevNow !== null) {
        var dt = curNow - prevNow;
        if (frameIdx >= 4 && dt >= 3.5 && dt <= 42.0) {
          dts.push(dt);
        }
      }
      prevNow = curNow;
      frameIdx += 1;

      if (frameIdx < totalSamples && !(typeof document !== "undefined" && document.hidden)) {
        requestAnimationFrame(sampleTick);
        return;
      }

      if (dts.length >= 8) {
        var sorted = dts.slice().sort(function (a, b) { return a - b; });
        var trim = Math.floor(sorted.length * 0.2);
        var midSlice = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
        var sum = 0;
        for (var i = 0; i < midSlice.length; i += 1) sum += midSlice[i];
        var meanDt = sum / midSlice.length;
        var rawHz = 1000 / meanDt;
        var stdRates = [60, 75, 90, 100, 120, 144, 165, 240];
        var bestHz = Math.round(rawHz);
        for (var s = 0; s < stdRates.length; s += 1) {
          if (Math.abs(rawHz - stdRates[s]) <= 3.2) {
            bestHz = stdRates[s];
            break;
          }
        }
        bestHz = Math.max(30, Math.min(240, bestHz));
        displayCalib = {
          calibrated: true,
          calibrating: false,
          refreshHz: bestHz,
          frameMs: Math.round((1000 / bestHz) * 100) / 100
        };
      } else {
        displayCalib = { calibrated: true, calibrating: false, refreshHz: 60, frameMs: 16.67 };
      }

      var pending = calibWaiters.slice();
      calibWaiters = [];
      for (var w = 0; w < pending.length; w += 1) {
        try { pending[w](displayCalib); } catch (_) {}
      }
    }

    requestAnimationFrame(sampleTick);
  }

  // Wall-clock monotonic rAF phase runner (immune to 10-120Hz ProMotion / VRR refresh switching)
  function runFramePhase(durationMs, opts) {
    var o = opts || {};
    var myToken = activeRunToken;
    var fMs = displayCalib.frameMs || 16.67;
    var liveFrameMs = Math.min(20, Math.max(4, fMs));
    var onsetNow = null;
    var prevTickNow = null;
    var framesCount = 0;
    var droppedInPhase = 0;

    function stepFrame() {
      if (myToken !== activeRunToken) return;
      if (typeof document !== "undefined" && document.hidden && activeProbeGuard) {
        handleVisibilityInterruption();
        return;
      }

      var tNow = nowMs();
      if (onsetNow === null) {
        onsetNow = tNow;
        prevTickNow = tNow;
        if (typeof o.onStart === "function") {
          o.onStart(onsetNow);
        }
        if (myToken !== activeRunToken) return;
        activeRafId = requestAnimationFrame(stepFrame);
        return;
      }

      var dt = tNow - prevTickNow;
      prevTickNow = tNow;
      framesCount += 1;
      if (dt >= 3.5 && dt <= 42.0) {
        liveFrameMs = liveFrameMs * 0.7 + Math.min(20, dt) * 0.3;
      }

      if (dt > Math.max(28, 1.8 * fMs)) {
        droppedInPhase += 1;
        if (activeProbeGuard) {
          activeProbeGuard.droppedFrames += 1;
          if (o.isCriticalExposure) {
            activeProbeGuard.criticalDropTrials += 1;
          }
        }
        if (typeof o.onFrameDrop === "function") {
          o.onFrameDrop(dt, droppedInPhase);
        }
      }

      var wallElapsed = tNow - onsetNow;
      if (typeof o.onTick === "function") {
        o.onTick(wallElapsed, framesCount, tNow);
      }
      if (myToken !== activeRunToken) return;

      // Terminate strictly on monotonic performance.now() wall-clock (prevents premature frame-count cutoffs on VRR/ProMotion)
      if (wallElapsed >= durationMs - Math.min(4.5, 0.35 * liveFrameMs)) {
        activeRafId = null;
        if (typeof o.onComplete === "function") {
          o.onComplete(wallElapsed, droppedInPhase, tNow);
        }
        return;
      }

      activeRafId = requestAnimationFrame(stepFrame);
    }

    activeRafId = requestAnimationFrame(stepFrame);
  }

  function ensureVisibilityListener() {
    if (visibilityBound || typeof document === "undefined") return;
    visibilityBound = true;
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && activeProbeGuard && !activeProbeGuard.isPaused) {
        handleVisibilityInterruption();
      }
    });
  }

  function handleVisibilityInterruption() {
    if (!activeProbeGuard || activeProbeGuard.isPaused) return;
    activeProbeGuard.isPaused = true;
    activeProbeGuard.visibilityInterruptions += 1;
    clearActiveRun();

    var a = domArena();
    if (!a.stage) return;
    a.stage.innerHTML =
      '<div class="task-box">' +
      '<div class="probe-region-badge">حارس ثبات النافذة</div>' +
      '<p class="task-question">توقف القياس مؤقتا بسبب مغادرة النافذة منعا لتلوث زمن الاستجابة.</p>' +
      '<div class="result-actions">' +
      '<button id="btnResumeVis" type="button" class="btn-primary"><span>استئناف من المحاولة الحالية</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
      '</div></div>';

    var doResume = function () {
      if (!activeProbeGuard) return;
      if (typeof document !== "undefined" && document.hidden) return;
      activeProbeGuard.isPaused = false;
      clearActiveRun();
      if (typeof activeProbeGuard.resumeFn === "function") {
        activeProbeGuard.resumeFn();
      }
    };
    var btn = document.getElementById("btnResumeVis");
    if (btn) btn.addEventListener("click", doResume);
    bindKeys(function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        doResume();
      }
    });
  }

  /* ================= 2. CANVAS & OFFSCREEN PRE-RENDERING ENGINE ================= */

  function isDarkTheme() {
    if (typeof document === "undefined" || !document.documentElement) return false;
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function getCanvasPalette() {
    var dark = isDarkTheme();
    return {
      bg: dark ? "#0c1110" : "#f5f7f5",
      surface: dark ? "#161f1c" : "#ffffff",
      border: dark ? "#2a3934" : "#d8e0db",
      borderStrong: dark ? "#5b736b" : "#667570",
      ink: dark ? "#ebf1ef" : "#111816",
      muted: dark ? "#8fa19a" : "#667570",
      accent: dark ? "#25c49a" : "#0d6652",
      accentSoft: dark ? "rgba(37, 196, 154, 0.15)" : "rgba(13, 102, 82, 0.11)",
      glyphFill: dark ? "rgba(235, 241, 239, 0.15)" : "rgba(17, 24, 22, 0.11)",
      gateRed: dark ? "#f87171" : "#dc2626",
      gateRedSoft: dark ? "rgba(248, 113, 113, 0.15)" : "rgba(220, 38, 38, 0.12)",
      gateBlue: dark ? "#60a5fa" : "#2563eb",
      gateBlueSoft: dark ? "rgba(96, 165, 250, 0.15)" : "rgba(37, 99, 235, 0.12)",
      baysBg: dark ? "#141c1a" : "#eef2f0",
      baysRing: dark ? "#455c54" : "#8fa19a",
      baysBar: dark ? "#f4f8f7" : "#0b1311",
      baysCue: dark ? "#25c49a" : "#095040",
      baysCueSoft: dark ? "rgba(37, 196, 154, 0.16)" : "rgba(13, 102, 82, 0.13)"
    };
  }

  function getDpr() {
    var raw = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    return Math.min(2.5, Math.max(1, raw));
  }

  function createStageCanvas(logicalW, logicalH, extraClass) {
    var dpr = getDpr();
    var c = document.createElement("canvas");
    c.width = Math.round(logicalW * dpr);
    c.height = Math.round(logicalH * dpr);
    c.className = "deep-stage-canvas" + (extraClass ? " " + extraClass : "");
    c.style.aspectRatio = logicalW + " / " + logicalH;
    c.style.maxWidth = logicalW + "px";
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas: c, ctx: ctx, w: logicalW, h: logicalH, dpr: dpr };
  }

  // OffscreenCanvas with clean fallback to detached HTMLCanvasElement for cross-browser compatibility
  function createBufferCanvas(logicalW, logicalH) {
    var dpr = getDpr();
    var pw = Math.round(logicalW * dpr);
    var ph = Math.round(logicalH * dpr);
    var buf = null;
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        var oc = new OffscreenCanvas(pw, ph);
        var octx = oc.getContext("2d");
        if (octx) {
          octx.scale(dpr, dpr);
          buf = { canvas: oc, ctx: octx, w: logicalW, h: logicalH, dpr: dpr };
        }
      } catch (_) {}
    }
    if (!buf) {
      var hc = document.createElement("canvas");
      hc.width = pw;
      hc.height = ph;
      var hctx = hc.getContext("2d");
      hctx.scale(dpr, dpr);
      buf = { canvas: hc, ctx: hctx, w: logicalW, h: logicalH, dpr: dpr };
    }
    return buf;
  }

  function blitBuffer(targetStage, bufferObj) {
    var ctx = targetStage.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, targetStage.canvas.width, targetStage.canvas.height);
    ctx.drawImage(bufferObj.canvas, 0, 0);
    ctx.restore();
  }

  function drawFixationCross(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - size, cy);
    ctx.lineTo(cx + size, cy);
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy + size);
    ctx.stroke();
    ctx.restore();
  }

  function drawCountdownStripOnCanvas(ctx, w, ratioRemaining, accentColor) {
    var r = Math.max(0, Math.min(1, ratioRemaining));
    ctx.save();
    ctx.fillStyle = "rgba(148, 163, 184, 0.22)";
    ctx.fillRect(16, 10, w - 32, 5);
    ctx.fillStyle = r < 0.25 ? "#ef4444" : (accentColor || "#0284c7");
    ctx.fillRect(16, 10, (w - 32) * r, 5);
    ctx.restore();
  }

  function drawVcsGlyph(ctx, cx, cy, radius, formId, glyphIdx, strokeColor, fillColor) {
    var Core = getCore();
    var pts = Core.getGlyphPoints(formId, glyphIdx, 72);
    if (!pts || pts.length === 0) return;
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < pts.length; i += 1) {
      var px = cx + pts[i].x * radius;
      var py = cy + pts[i].y * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawPatternMaskPatch(ctx, cx, cy, radius, seed, bgOverride) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    var pal = getCanvasPalette();
    ctx.fillStyle = bgOverride || pal.surface;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // High-contrast multi-orientation + checkerboard scramble mask
    var step = Math.max(6, Math.round(radius / 3.2));
    var s = Number(seed) || 17;
    for (var gx = -radius; gx < radius; gx += step) {
      for (var gy = -radius; gy < radius; gy += step) {
        s = (s * 1664525 + 1013904223) >>> 0;
        if ((s & 3) < 2) {
          ctx.fillStyle = (s & 4) ? pal.ink : pal.muted;
          ctx.globalAlpha = 0.34;
          ctx.fillRect(cx + gx, cy + gy, step * 0.85, step * 0.85);
        }
      }
    }
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.1;
    for (var k = 0; k < 11; k += 1) {
      var ang = (((seed * 29 + k * 33) % 180) * Math.PI) / 180;
      var off = ((k % 3) - 1) * (radius * 0.32);
      var nx = -Math.sin(ang) * off;
      var ny = Math.cos(ang) * off;
      var dx = Math.cos(ang) * radius * 0.92;
      var dy = Math.sin(ang) * radius * 0.92;
      ctx.beginPath();
      ctx.moveTo(cx + nx - dx, cy + ny - dy);
      ctx.lineTo(cx + nx + dx, cy + ny + dy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = pal.borderStrong;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawAsymmetricRoleFrame(ctx, cx, cy, halfSize, roleSpec, opts) {
    var o = opts || {};
    var hs = halfSize;
    ctx.save();
    ctx.beginPath();
    if (roleSpec.shape === "chamfer") {
      var ch = hs * 0.30;
      ctx.moveTo(cx - hs + ch, cy - hs);
      ctx.lineTo(cx + hs - ch, cy - hs);
      ctx.lineTo(cx + hs, cy - hs + ch);
      ctx.lineTo(cx + hs, cy + hs - ch);
      ctx.lineTo(cx + hs - ch, cy + hs);
      ctx.lineTo(cx - hs + ch, cy + hs);
      ctx.lineTo(cx - hs, cy + hs - ch);
      ctx.lineTo(cx - hs, cy - hs + ch);
    } else if (roleSpec.shape === "notched") {
      var nt = hs * 0.22;
      ctx.moveTo(cx - hs, cy - hs);
      ctx.lineTo(cx + hs, cy - hs);
      ctx.lineTo(cx + hs - nt, cy);
      ctx.lineTo(cx + hs, cy + hs);
      ctx.lineTo(cx - hs, cy + hs);
      ctx.lineTo(cx - hs + nt, cy);
    } else {
      var st = hs * 0.26;
      ctx.moveTo(cx - hs, cy - hs + st);
      ctx.lineTo(cx - hs + st, cy - hs + st);
      ctx.lineTo(cx - hs + st, cy - hs);
      ctx.lineTo(cx + hs, cy - hs);
      ctx.lineTo(cx + hs, cy + hs - st);
      ctx.lineTo(cx + hs - st, cy + hs - st);
      ctx.lineTo(cx + hs - st, cy + hs);
      ctx.lineTo(cx - hs, cy + hs);
    }
    ctx.closePath();

    ctx.fillStyle = o.fillOverride || roleSpec.fillSoft;
    ctx.fill();
    ctx.strokeStyle = o. dimmed ? "rgba(148,163,184,0.45)" : roleSpec.stroke;
    ctx.lineWidth = o.active ? 3.2 : 2.2;
    ctx.stroke();

    // Optional Reference-Back Gate Outer Halo (Red solid double = Update; Blue dashed = Compare only)
    if (o.gateKind === "update_red" || o.gateKind === "compare_blue") {
      var pad = 7;
      var isRed = o.gateKind === "update_red";
      var darkMode = isDarkTheme();
      ctx.strokeStyle = isRed ? (darkMode ? "#f87171" : "#dc2626") : (darkMode ? "#60a5fa" : "#2563eb");
      ctx.lineWidth = 3.2;
      if (!isRed) ctx.setLineDash([7, 5]);
      ctx.strokeRect(cx - hs - pad, cy - hs - pad, (hs + pad) * 2, (hs + pad) * 2);
      if (isRed) {
        ctx.lineWidth = 1.4;
        ctx.strokeRect(cx - hs - pad - 4, cy - hs - pad - 4, (hs + pad + 4) * 2, (hs + pad + 4) * 2);
      }
    }
    ctx.restore();
  }

  function renderGlyphButtonsGrid(container, optionsList, formId, colsClass, onPick) {
    var pal = getCanvasPalette();
    container.innerHTML = "";
    var grid = document.createElement("div");
    grid.className = colsClass;

    for (var i = 0; i < optionsList.length; i += 1) {
      (function (idx) {
        var opt = optionsList[idx];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "glyph-opt-btn";
        btn.setAttribute("aria-label", "خيار " + (idx + 1));

        var mini = createStageCanvas(64, 64, "glyph-mini-canvas");
        drawVcsGlyph(mini.ctx, 32, 32, 24, formId, opt.glyphIdx, pal.ink, pal.glyphFill);

        var keyBadge = document.createElement("span");
        keyBadge.className = "glyph-key-hint ltr-iso";
        keyBadge.textContent = String(idx + 1);

        btn.appendChild(mini.canvas);
        btn.appendChild(keyBadge);
        btn.addEventListener("click", function () {
          onPick(opt, idx);
        });
        grid.appendChild(btn);
      })(i);
    }
    container.appendChild(grid);
  }

  /* ================= 3. ARENA & NAVIGATION SHELL ================= */

  function domArena() {
    return {
      overlay: document.getElementById("arenaOverlay"),
      stage: document.getElementById("arenaStage"),
      title: document.getElementById("arenaTitle"),
      prog: document.getElementById("arenaProgress")
    };
  }

  function setHeader(title, prog) {
    var Core = getCore();
    var a = domArena();
    if (a.title) a.title.textContent = Core ? Core.toAsciiDigits(title || "") : (title || "");
    if (a.prog) a.prog.textContent = Core ? Core.toAsciiDigits(prog || "") : (prog || "");
  }

  function setCanvasStageMode(enabled) {
    var a = domArena();
    var wrap = a.stage && a.stage.parentElement;
    if (wrap && wrap.classList) {
      wrap.classList.toggle("is-canvas-stage", Boolean(enabled));
    }
  }

  function openArena() {
    ensureVisibilityListener();
    clearActiveRun();
    setCanvasStageMode(false);
    var a = domArena();
    if (a.overlay) {
      a.overlay.hidden = false;
      a.overlay.scrollTop = 0;
    }
  }

  function closeArena() {
    activeProbeGuard = null;
    isFamiliarizationRun = false;
    clearActiveRun();
    setCanvasStageMode(false);
    var a = domArena();
    if (a.overlay) {
      a.overlay.scrollTop = 0;
      a.overlay.hidden = true;
    }
    if (a.stage) a.stage.innerHTML = "";
    render();
  }

  function abort() {
    isBattery = false;
    isFamiliarizationRun = false;
    activeProbeGuard = null;
    clearActiveRun();
    setCanvasStageMode(false);
    var a = domArena();
    if (a.overlay) {
      a.overlay.scrollTop = 0;
      a.overlay.hidden = true;
    }
    if (a.stage) a.stage.innerHTML = "";
    render();
  }

  function findMeta(expId) {
    var list = getCore().EXPERIMENTS;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === expId) return list[i];
    }
    return list[0];
  }

  function launchWithCalibration(startFn) {
    openArena();
    if (displayCalib.calibrated) {
      startFn();
      return;
    }
    var a = domArena();
    setHeader("معايرة تردد الشاشة (VSync)", "قياس rAF");
    a.stage.innerHTML =
      '<div class="stimulus-card">' +
      '<div class="stim-label">جارٍ قياس تردد التحديث الفعلي للشاشة لضبط الإطارات بالمللي ثانية...</div>' +
      '<div class="stim-num">+</div>' +
      '</div>';
    calibrateDisplayRefresh(true, function () {
      startFn();
    });
  }

  function startFullBattery() {
    isBattery = true;
    isFamiliarizationRun = false;
    batteryIdx = 0;
    launchWithCalibration(function () {
      showExperimentIntro(batteryQueue[0]);
    });
  }

  function startFamiliarizationPass() {
    isBattery = true;
    isFamiliarizationRun = true;
    batteryIdx = 0;
    launchWithCalibration(function () {
      showExperimentIntro(batteryQueue[0]);
    });
  }

  function startExperiment(expId) {
    isBattery = false;
    isFamiliarizationRun = false;
    launchWithCalibration(function () {
      showExperimentIntro(expId);
    });
  }

  function formatDeepStepHtml(rawStr) {
    var s = esc(rawStr);
    var colonIdx = s.indexOf(":");
    if (colonIdx > 0 && colonIdx < 36 && s.charAt(0) !== "[") {
      s = "<strong>" + s.slice(0, colonIdx + 1) + "</strong>" + s.slice(colonIdx + 1);
    }
    var slots = [];
    function keep(html) {
      var id = slots.length;
      slots.push(html);
      return "\uE000" + id + "\uE001";
    }
    s = s
      .replace(/\[أحمر · تحديث\]/g, function () { return keep('<span class="inline-gate is-red">أحمر · تحديث</span>'); })
      .replace(/\[أزرق · مقارنة فقط\]/g, function () { return keep('<span class="inline-gate is-blue">أزرق · مقارنة فقط</span>'); })
      .replace(/\(؟\)/g, function () { return keep('<strong class="intro-q-mark">؟</strong>'); })
      .replace(/\(\+\)/g, function () { return keep('<kbd class="kbd-chip ltr-iso">+</kbd>'); })
      .replace(/\((W · ↑|S · ↓|J · →|F · ←|Space|Enter|1–4|1–6)\)/g, function (_m, inner) {
        return keep('<kbd class="kbd-chip ltr-iso">' + inner + "</kbd>");
      })
      .replace(/\(([^()\uE000\uE001]+)\)/g, function (full, inner) {
        if (/[\u0600-\u06FF]/.test(inner)) return full;
        return keep('<span class="ltr-iso" style="white-space:nowrap;">' + full + "</span>");
      })
      .replace(/(?:~?\d+(?:,\d+)?(?:\.\d+)?\s*(?:ms|s|Hz)(?![A-Za-z])|~?\d+\s*[–-]\s*\d+|~?\d+\.\d+)/g, function (m) {
        return keep('<span class="ltr-iso">' + m + "</span>");
      });
    return s.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return slots[Number(idx)];
    }).replace(/<\/kbd>\s*\.\s*$/, "</kbd>");
  }

  function isolateDeepTechSpans(escapedStr) {
    var s = String(escapedStr == null ? "" : escapedStr);
    var slots = [];
    function keep(html) {
      var id = slots.length;
      slots.push(html);
      return "\uE000" + id + "\uE001";
    }
    s = s.replace(/\(([^()\uE000\uE001]+)\)/g, function (full, inner) {
      if (/[\u0621-\u064A\u0671-\u06D3]/.test(inner) || inner.indexOf("←") !== -1 || /^\d+$/.test(inner.trim())) {
        return full;
      }
      return keep('<span class="ltr-iso">(' + inner.replace(/،/g, ",") + ")</span>");
    });
    s = s.replace(/(?:(?:Chrome|Safari|Firefox|Edge|Browser)\s*\/\s*(?:macOS|iOS|Windows|Android|Linux|OS)|\bRCI\s*90%[+-]?|\bForm\s+[ABC]\b|\bPVT-5\b|\b2-AFC\b|\bReference-Back\b|\bMAP(?:\s+Ex-Gaussian|\s+β)?\b|\bEx-Gaussian\b|\bSlow-ISI(?:\s+Tau|\s*τ)?\b|\bFast-ISI(?:\s*τ)?\b|\bHigh-CL\b|\bLow-CL\b|\bBays(?:\s+2016)?\b|\bM3(?:-RB)?\b|\bSOA75\b|\bD[1-5]\b|\bTBRS\b|\bT0\b|\bSWS\b)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    s = s.replace(/(?:(?:0\.9s:|3\.8s:)\s*[±+-]?\d+(?:\.\d+)?%|(?:P_target|P_swap(?:,corr)?|P_stale(?:,corr)?|P_guess|Δ_TBRS|Δγ(?:_delay)?|SOA_75|AUC(?:_cons)?|Mean 1\/RT|1\/RT|β_ToT|β_0\.9s|σ_θ|cMAE|L_500|L_355|ISI|ICC|SEM|SE_diff|FS|CL|K|α|β|γ|μ|σ|τ|z|Δ)(?:\s*(?:=|:|≥|≤|&lt;|&gt;)\s*(?:&gt;|&lt;|[>≥≤])?[±+-]?\d+(?:,\d+)?(?:\.\d+)?(?:\s*(?:ms|%|°|Hz|s⁻¹(?:\/min)?|s(?![A-Za-z])))?)?)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    s = s.replace(/(?:[±+-]?\d+(?:\.\d+)?[%°]?(?:\s*[\/–:-]\s*\d+(?:\.\d+)?[%°]?)+(?:\s*(?:ms|%|°|Hz|s(?![A-Za-z])))?)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    s = s.replace(/(?:(?:&gt;|&lt;|[>≥≤~])?[±+-]?\d+(?:,\d+)?(?:\.\d+)?(?:\s*(?:ms|%|°|Hz|s⁻¹(?:\/min)?|s(?![A-Za-z])))|[±+-]\d+(?:\.\d+)?|~?\d+\.\d+)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    return s.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return slots[Number(idx)];
    });
  }

  function formatDeepRichHtml(rawStr) {
    var s = esc(rawStr);
    var tags = [];
    s = s.replace(/\[([^\]]+)\]/g, function (_m, inner) {
      var id = tags.length;
      tags.push('<span class="verdict-tag">' + isolateDeepTechSpans(inner) + "</span>");
      return "\uE002" + id + "\uE003";
    });
    s = isolateDeepTechSpans(s);
    return s.replace(/\uE002(\d+)\uE003/g, function (_m, idx) {
      return tags[Number(idx)];
    });
  }

  function formatMetricValHtml(rawVal) {
    var str = String(rawVal == null ? "" : rawVal);
    if (str.indexOf("←") !== -1) {
      return str.split("←").map(function (part) {
        return formatMetricValHtml(part.trim());
      }).join(" ← ");
    }
    if (!/[\u0600-\u06FF]/.test(str)) {
      return '<span class="ltr-iso">' + esc(str) + "</span>";
    }
    return formatDeepRichHtml(str);
  }

  function showExperimentIntro(expId) {
    clearActiveRun();
    activeProbeGuard = null;
    setCanvasStageMode(false);
    var Core = getCore();
    var st = Core.loadState();
    var meta = findMeta(expId);
    var a = domArena();
    if (a.overlay) a.overlay.scrollTop = 0;
    var shortCode = meta.shortCode || String(meta.code || "").split("·")[0].trim();

    var modeBadge = isFamiliarizationRun
      ? "تهيئة " + (batteryIdx + 1) + " / 5"
      : (isBattery ? "البطارية " + (batteryIdx + 1) + " / 5" : "جاهز للبدء");

    setHeader(shortCode + " — " + meta.shortTitle, modeBadge);

    var stepsHtml = meta.instructions.map(function (s) {
      return "<li>" + formatDeepStepHtml(s) + "</li>";
    }).join("");

    var flowHtml = "";
    if (Array.isArray(meta.flowSteps) && meta.flowSteps.length > 0) {
      flowHtml =
        '<div class="probe-flow-box" aria-label="مسار الجولة">' +
        '<span class="probe-flow-label">مسار الجولة</span>' +
        '<div class="probe-flow-track">' +
        meta.flowSteps.map(function (fs, idx) {
          var stepHtml = '<span class="flow-step">' + formatDeepStepHtml(fs) + "</span>";
          return idx === 0
            ? stepHtml
            : '<span class="flow-step-unit"><span class="flow-arrow" aria-hidden="true">←</span>' + stepHtml + "</span>";
        }).join("") +
        "</div></div>";
    } else if (meta.example) {
      flowHtml = '<div class="probe-example-box">' + esc(meta.example) + "</div>";
    }

    var domainTag = meta.domainTag || meta.shortTitle;
    var metaChip = isFamiliarizationRun
      ? (meta.famMetaChip || "تهيئة تمهيدية")
      : (meta.metaChip || ("~" + meta.durationMin + " د"));
    var usesForm = expId === "d1_tbrs" || expId === "d2_refback_m3" || expId === "d4_consolidation_soa";
    var techChip = (usesForm ? "Form " + st.activeForm + " · " : "") + displayCalib.refreshHz + "Hz";

    a.stage.innerHTML =
      '<div class="probe-intro">' +
      '<div class="probe-intro-top">' +
      '<div class="probe-intro-badges">' +
      '<span class="probe-code ltr-iso">' + esc(shortCode) + "</span>" +
      '<span class="probe-domain-tag">' + formatDeepRichHtml(domainTag) + "</span>" +
      "</div>" +
      '<div class="probe-intro-meta">' +
      '<span class="intro-meta-chip">' + formatDeepStepHtml(metaChip) + "</span>" +
      '<span class="intro-meta-chip ltr-iso">' + esc(techChip) + "</span>" +
      "</div>" +
      "</div>" +
      '<h2 class="probe-intro-title">' + formatDeepRichHtml(meta.title) + "</h2>" +
      (isFamiliarizationRun
        ? '<div class="warmup-feedback" style="margin:0;">وضع التهيئة التمهيدية (~2 د إجمالا): تدريب مختصر على الأزرار والإيقاع يُستبعد تلقائيا من السجل الطولي.</div>'
        : "") +
      '<ol class="probe-steps">' + stepsHtml + "</ol>" +
      flowHtml +
      '<div class="result-actions">' +
      '<button id="btnDeepStart" type="button" class="btn-primary"><span>ابدأ الآن</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
      "</div>" +
      "</div>";

    var go = function () {
      clearActiveRun();
      setCanvasStageMode(true);
      if (a.overlay) a.overlay.scrollTop = 0;
      if (expId === "d1_tbrs") return runD1();
      if (expId === "d2_refback_m3") return runD2();
      if (expId === "d3_bays_analog") return runD3();
      if (expId === "d4_consolidation_soa") return runD4();
      return runD5();
    };
    document.getElementById("btnDeepStart").addEventListener("click", go);
    bindKeys(function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  }

  function showExperimentResult(expId, headlineScore, cards, summaryText) {
    activeProbeGuard = null;
    clearActiveRun();
    setCanvasStageMode(false);
    var Core = getCore();
    var meta = findMeta(expId);
    var a = domArena();
    if (a.overlay) a.overlay.scrollTop = 0;

    if (isFamiliarizationRun) {
      var isLastFam = batteryIdx >= batteryQueue.length - 1;
      if (!isLastFam) {
        batteryIdx += 1;
        showExperimentIntro(batteryQueue[batteryIdx]);
        return;
      }
      var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
      Core.markFamiliarizationComplete(envSnap);
      setHeader("اكتملت جولة التهيئة التمهيدية", "مستبعدة من السجل");
      a.stage.innerHTML =
        '<div class="result-report">' +
        '<div class="probe-region-badge">تم امتصاص أثر تعلّم الواجهة</div>' +
        '<div class="diagnosis-callout">اكتملت التهيئة التمهيدية للمسابير الخمسة بنجاح واستُبعدت بياناتها بالكامل من السجل الطولي. يمكنك الآن تسجيل خط الأساس المرجعي <span class="ltr-iso">T0</span> بأعلى ثبات سيكومتري.</div>' +
        '<div class="result-actions">' +
        '<button id="btnStartScoredAfterFam" type="button" class="btn-primary">بدء البطارية الرسمية المعتمدة T0</button>' +
        '<button id="btnCloseFamDone" type="button" class="btn-ghost"><span>العودة للوحة القياس</span><kbd class="kbd-chip ltr-iso">Enter</kbd></button>' +
        '</div></div>';

      document.getElementById("btnStartScoredAfterFam").addEventListener("click", function () {
        startFullBattery();
      });
      var finishFam = function () {
        isBattery = false;
        isFamiliarizationRun = false;
        closeArena();
      };
      document.getElementById("btnCloseFamDone").addEventListener("click", finishFam);
      bindKeys(function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          finishFam();
        }
      });
      return;
    }

    setHeader(meta.shortTitle + " — النتيجة", headlineScore);

    var cardsHtml = cards.map(function (c) {
      return (
        '<div class="submetric-card">' +
        '<span class="stim-label">' + formatDeepRichHtml(c.label) + "</span>" +
        '<strong style="font-size:1.02rem;">' + formatMetricValHtml(c.val) + "</strong>" +
        "</div>"
      );
    }).join("");

    var isLast = isBattery && batteryIdx >= batteryQueue.length - 1;
    var RS = root.NeuroLab && root.NeuroLab.RepoSync;
    var repoSaveInner = RS && typeof RS.renderSaveButtonInnerHtml === "function"
      ? RS.renderSaveButtonInnerHtml()
      : "<span>حفظ في الريبو</span>";
    var saveRepoBtnHtml =
      '<button id="btnDeepSaveRepo" type="button" class="btn-repo-save" data-repo-save-btn>' + repoSaveInner + "</button>";
    var nextBtnHtml = "";
    if (isBattery && !isLast) {
      var nxt = findMeta(batteryQueue[batteryIdx + 1]);
      nextBtnHtml =
        saveRepoBtnHtml +
        '<button id="btnDeepNext" type="button" class="btn-primary"><span>المسبار التالي: ' + esc(nxt.shortTitle) + '</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    } else {
      nextBtnHtml =
        saveRepoBtnHtml +
        '<button id="btnDeepRetryOne" type="button" class="btn-ghost">إعادة هذا المسبار</button>' +
        '<button id="btnDeepDone" type="button" class="btn-primary"><span>عرض لوحة القياس العميق</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    }

    a.stage.innerHTML =
      '<div class="result-report">' +
      '<div class="score-hero"><div class="score-ring-val"><span class="ltr-iso">' + esc(headlineScore) + "</span></div></div>" +
      '<div class="submetrics-grid">' + cardsHtml + "</div>" +
      '<div class="diagnosis-callout">' + formatDeepRichHtml(summaryText) + "</div>" +
      (RS && typeof RS.renderArenaContextBarHtml === "function" ? RS.renderArenaContextBarHtml() : "") +
      '<div class="result-actions">' + nextBtnHtml + "</div>" +
      "</div>";

    if (RS && typeof RS.refreshUi === "function") {
      try { RS.refreshUi(); } catch (_) {}
    }

    var retryBtn = document.getElementById("btnDeepRetryOne");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        showExperimentIntro(expId);
      });
    }

    var proceed = function () {
      if (isBattery && !isLast) {
        batteryIdx += 1;
        showExperimentIntro(batteryQueue[batteryIdx]);
      } else {
        isBattery = false;
        closeArena();
      }
    };
    var bNext = document.getElementById("btnDeepNext") || document.getElementById("btnDeepDone");
    if (bNext) bNext.addEventListener("click", proceed);
    bindKeys(function (ev) {
      if (RS && typeof RS.isModalOpen === "function" && RS.isModalOpen()) return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        proceed();
      }
    });
  }

  /* ================= 4. PROBE 1: D1 TBRS FIXED 4,000ms WINDOW ================= */

  function runD1() {
    var Core = getCore();
    var st = Core.loadState();
    var formId = st.activeForm;
    var trials = Core.generateD1Trials({ formId: formId, isFamiliarization: isFamiliarizationRun });
    var idx = 0;
    var records = [];
    var a = domArena();

    activeProbeGuard = {
      expId: "d1_tbrs",
      isPaused: false,
      droppedFrames: 0,
      criticalDropTrials: 0,
      visibilityInterruptions: 0,
      resumeFn: function () {
        if (idx < trials.length) {
          trials[idx] = Core.regenerateD1SingleTrial(trials[idx]);
        }
        runSingleTrial();
      }
    };

    function ringPosXY(angleDeg, w, h, ringR) {
      var rad = (angleDeg * Math.PI) / 180;
      return {
        x: w / 2 + Math.cos(rad) * ringR,
        y: h / 2 + Math.sin(rad) * ringR
      };
    }

    function runSingleTrial() {
      clearActiveRun();
      if (idx >= trials.length) {
        var scored = Core.scoreD1Trials(records);
        var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
        Core.saveExperimentResult("d1_tbrs", Object.assign({
          isFamiliarization: isFamiliarizationRun,
          formId: formId,
          env: envSnap,
          refreshHz: displayCalib.refreshHz,
          frameMs: displayCalib.frameMs,
          droppedFrames: activeProbeGuard ? activeProbeGuard.droppedFrames : 0,
          visibilityInterruptions: activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0
        }, scored));

        var sumText = isFamiliarizationRun ? "" : Core.computeDeepVerdictSummary().verdicts[0];
        return showExperimentResult(
          "d1_tbrs",
          scored.pTargetHighPct + "%",
          [
            { label: "صمود الربط (حمل منخفض ← عالٍ)", val: scored.pTargetLowPct + "% ← " + scored.pTargetHighPct + "%" },
            { label: "الحمل الفعلي المقاس (CL Low / High)", val: scored.clLow + " / " + scored.clHigh },
            { label: "ميل التلاشي بالزمن (Δ_TBRS)", val: String(scored.deltaTbrs) },
            { label: "تبديل High-CL مقابل تلاشي/تخمين", val: scored.pSwapHighCorrPct + "% / " + scored.pGuessHighPct + "%" },
            { label: "دقة الأحكام البصرية وزمنها", val: scored.procAccPct + "% · " + scored.procMeanRtMs + " ms" },
            { label: "إطارات ساقطة / انقطاعات", val: (activeProbeGuard ? activeProbeGuard.droppedFrames : 0) + " / " + (activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0) }
          ],
          sumText
        );
      }

      var tr = trials[idx];
      var pal = getCanvasPalette();
      setHeader(
        "D1 — تلاشي الربط · " + (tr.cond === "high" ? "حمل عالٍ" : "حمل منخفض"),
        (idx + 1) + " / " + trials.length
      );

      var W = 400, H = 268, ringR = 86, slotR = 31;

      // Offscreen pre-rendering of Fixation, 2,000ms Simultaneous 3-Glyph Array, and 150ms Pattern Mask
      var bufFix = createBufferCanvas(W, H);
      bufFix.ctx.fillStyle = pal.surface;
      bufFix.ctx.fillRect(0, 0, W, H);
      for (var s0 = 0; s0 < 3; s0 += 1) {
        var p0 = ringPosXY(tr.ringAnglesDeg[s0], W, H, ringR);
        bufFix.ctx.strokeStyle = pal.border;
        bufFix.ctx.lineWidth = 1.6;
        bufFix.ctx.beginPath();
        bufFix.ctx.arc(p0.x, p0.y, slotR, 0, Math.PI * 2);
        bufFix.ctx.stroke();
      }
      drawFixationCross(bufFix.ctx, W / 2, H / 2, 8, pal.ink);

      var bufEncode = createBufferCanvas(W, H);
      bufEncode.ctx.fillStyle = pal.surface;
      bufEncode.ctx.fillRect(0, 0, W, H);
      for (var s1 = 0; s1 < 3; s1 += 1) {
        var p1 = ringPosXY(tr.ringAnglesDeg[s1], W, H, ringR);
        bufEncode.ctx.fillStyle = pal.accentSoft;
        bufEncode.ctx.strokeStyle = pal.borderStrong;
        bufEncode.ctx.lineWidth = 1.9;
        bufEncode.ctx.beginPath();
        bufEncode.ctx.arc(p1.x, p1.y, slotR, 0, Math.PI * 2);
        bufEncode.ctx.fill();
        bufEncode.ctx.stroke();
        drawVcsGlyph(bufEncode.ctx, p1.x, p1.y, slotR * 0.72, tr.formId, tr.arrayGlyphs[s1], pal.ink, pal.glyphFill);
      }
      drawFixationCross(bufEncode.ctx, W / 2, H / 2, 6, pal.muted);

      var bufMask = createBufferCanvas(W, H);
      bufMask.ctx.fillStyle = pal.surface;
      bufMask.ctx.fillRect(0, 0, W, H);
      for (var s2 = 0; s2 < 3; s2 += 1) {
        var p2 = ringPosXY(tr.ringAnglesDeg[s2], W, H, ringR);
        drawPatternMaskPatch(bufMask.ctx, p2.x, p2.y, slotR, tr.maskSeed + s2 * 47);
      }
      drawFixationCross(bufMask.ctx, W / 2, H / 2, 6, pal.muted);

      a.stage.innerHTML =
        '<div class="task-box deep-canvas-box">' +
        '<div id="d1SubLabel" class="stim-label">احفظ مواقع الرموز الثلاثة معا <span class="ltr-iso">(2.0 s)</span></div>' +
        '<div id="d1CanvasMount" class="deep-canvas-wrap"></div>' +
        '<div id="d1ControlsMount"></div>' +
        '</div>';

      var stageObj = createStageCanvas(W, H);
      document.getElementById("d1CanvasMount").appendChild(stageObj.canvas);
      var subLabel = document.getElementById("d1SubLabel");
      var controlsMount = document.getElementById("d1ControlsMount");

      function mountD1VerticalButtons() {
        if (!document.getElementById("d1BtnTop")) {
          controlsMount.innerHTML =
            '<div class="nback-actions">' +
            '<button id="d1BtnTop" type="button" class="opt-btn"><span>▲ فوق</span><kbd class="kbd-chip ltr-iso">W · ↑</kbd></button>' +
            '<button id="d1BtnBot" type="button" class="opt-btn"><span>▼ تحت</span><kbd class="kbd-chip ltr-iso">S · ↓</kbd></button>' +
            '</div>';
        }
      }

      function drawTbrsCanvasFrame(wallElapsed, showStim, barPos, stepIdxDisplay, totalStepsDisplay) {
        var ctx = stageObj.ctx;
        ctx.fillStyle = pal.surface;
        ctx.fillRect(0, 0, W, H);
        drawCountdownStripOnCanvas(ctx, W, 1 - wallElapsed / tr.retentionWindowMs, pal.accent);

        // Central discrimination box (68x68)
        var bx = W / 2 - 34, by = H / 2 - 34, bw = 68, bh = 68;
        ctx.strokeStyle = showStim ? pal.accent : pal.borderStrong;
        ctx.lineWidth = showStim ? 2.4 : 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Midline divider
        ctx.strokeStyle = pal.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(bx + 6, H / 2);
        ctx.lineTo(bx + bw - 6, H / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (showStim) {
          var barY = barPos === "top" ? (H / 2 - 21) : (H / 2 + 13);
          ctx.fillStyle = pal.ink;
          ctx.fillRect(W / 2 - 20, barY, 40, 8);
        } else {
          drawFixationCross(ctx, W / 2, H / 2, 5, pal.muted);
        }

        // Subtle step counter so consecutive identical bar positions clearly onset as distinct events
        if (typeof stepIdxDisplay === "number" && stepIdxDisplay >= 0) {
          ctx.fillStyle = pal.muted;
          ctx.font = "600 11px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText((stepIdxDisplay + 1) + "/" + totalStepsDisplay, W / 2, by + bh + 8);
        }
      }

      // Phase 1: Fixation (200ms) -> Phase 2: Simultaneous Array (2,000ms) -> Phase 3: Mask (150ms) -> Phase 4: Post-mask Prep (350ms) -> Phase 5: Strictly Fixed 4,000ms TBRS Window
      runFramePhase(tr.fixationMs, {
        onStart: function () { blitBuffer(stageObj, bufFix); },
        onComplete: function () {
          runFramePhase(tr.encodeMs, {
            isCriticalExposure: true,
            onStart: function () {
              blitBuffer(stageObj, bufEncode);
              drawCountdownStripOnCanvas(stageObj.ctx, W, 1, pal.accent);
            },
            onTick: function (wallElapsed) {
              blitBuffer(stageObj, bufEncode);
              drawCountdownStripOnCanvas(stageObj.ctx, W, 1 - wallElapsed / tr.encodeMs, pal.accent);
            },
            onComplete: function () {
              runFramePhase(tr.maskMs, {
                onStart: function () { blitBuffer(stageObj, bufMask); },
                onComplete: function () {
                  subLabel.textContent = "استعد للشريط المركزي: فوق أم تحت";
                  mountD1VerticalButtons();
                  drawTbrsCanvasFrame(0, false, "top", -1, tr.judgements.length);
                  runFramePhase(tr.postMaskPrepMs || 350, {
                    onStart: function () {
                      drawTbrsCanvasFrame(0, false, "top", -1, tr.judgements.length);
                    },
                    onComplete: function () {
                      runFixedTbrsWindow();
                    }
                  });
                }
              });
            }
          });
        }
      });

      function runFixedTbrsWindow() {
        subLabel.innerHTML = 'نافذة الاحتفاظ <span class="ltr-iso">(4.0s)</span> — حدّد موضع الشريط فورا';
        mountD1VerticalButtons();

        var procResults = tr.judgements.map(function (j) {
          return { stepIndex: j.stepIndex, rtMs: null, correct: false, slotMs: j.slotMs };
        });

        var activeStepIdx = -1;
        var stepOnsetNow = 0;
        var stepAnswered = false;

        function submitStepChoice(choseTop) {
          if (activeStepIdx < 0 || activeStepIdx >= tr.judgements.length) return;
          var rt = Math.round(nowMs() - stepOnsetNow);
          // Guard against <110ms motor spillover across 1000ms/2000ms slot boundaries: credit unanswered prior slot without locking out current slot
          if (rt < 110) {
            if (activeStepIdx > 0 && procResults[activeStepIdx - 1] && procResults[activeStepIdx - 1].rtMs === null) {
              var prevSpec = tr.judgements[activeStepIdx - 1];
              procResults[activeStepIdx - 1] = {
                stepIndex: activeStepIdx - 1,
                rtMs: prevSpec.slotMs,
                correct: Boolean(choseTop) === Boolean(prevSpec.expectTop),
                slotMs: prevSpec.slotMs
              };
            }
            return;
          }
          if (stepAnswered) return;
          stepAnswered = true;
          var jSpec = tr.judgements[activeStepIdx];
          procResults[activeStepIdx] = {
            stepIndex: activeStepIdx,
            rtMs: rt,
            correct: Boolean(choseTop) === Boolean(jSpec.expectTop),
            slotMs: jSpec.slotMs
          };
          // Clear stimulus to allow free attentional refreshing ONLY for remaining ms of this sub-slot; NEVER ends 4,000ms window early!
        }

        document.getElementById("d1BtnTop").addEventListener("click", function () { submitStepChoice(true); });
        document.getElementById("d1BtnBot").addEventListener("click", function () { submitStepChoice(false); });
        bindKeys(function (ev) {
          if (isUpChoiceKey(ev)) { ev.preventDefault(); submitStepChoice(true); }
          else if (isDownChoiceKey(ev)) { ev.preventDefault(); submitStepChoice(false); }
        });

        var slotMs = tr.judgements[0].slotMs;
        var offGapMs = slotMs <= 1100 ? 120 : 150;
        var nSteps = tr.judgements.length;

        runFramePhase(tr.retentionWindowMs, {
          onStart: function (t0) {
            activeStepIdx = 0;
            stepOnsetNow = t0;
            stepAnswered = false;
            drawTbrsCanvasFrame(0, true, tr.judgements[0].barPos, 0, nSteps);
          },
          onTick: function (wallElapsed, _fc, tNow) {
            var nextIdx = Math.min(nSteps - 1, Math.floor(wallElapsed / slotMs));
            if (nextIdx !== activeStepIdx) {
              activeStepIdx = nextIdx;
              stepOnsetNow = tNow;
              stepAnswered = false;
            }
            var withinSlotMs = wallElapsed - activeStepIdx * slotMs;
            var showBar = !stepAnswered && withinSlotMs < (slotMs - offGapMs);
            var jCur = tr.judgements[activeStepIdx];
            drawTbrsCanvasFrame(wallElapsed, showBar, jCur.barPos, activeStepIdx, nSteps);
          },
          onComplete: function () {
            unbindKeys();
            showD1Recall4AFC(procResults);
          }
        });
      }

      function showD1Recall4AFC(procResults) {
        subLabel.textContent = "اختر الرمز الذي ظهر في الدائرة المضيئة بـ (؟):";
        controlsMount.innerHTML = "";

        function drawCueCanvas(remRatio) {
          var ctx = stageObj.ctx;
          ctx.fillStyle = pal.surface;
          ctx.fillRect(0, 0, W, H);
          drawCountdownStripOnCanvas(ctx, W, remRatio, pal.accent);
          for (var s = 0; s < 3; s += 1) {
            var p = ringPosXY(tr.ringAnglesDeg[s], W, H, ringR);
            var isProbe = s === tr.probeSlot;
            ctx.fillStyle = isProbe ? pal.accentSoft : "transparent";
            ctx.strokeStyle = isProbe ? pal.accent : pal.border;
            ctx.lineWidth = isProbe ? 3.0 : 1.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, slotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (isProbe) {
              ctx.fillStyle = pal.accent;
              ctx.font = "700 22px 'IBM Plex Sans Arabic', sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("؟", p.x, p.y + 1);
            }
          }
        }

        var answeredRecall = false;
        var recallStart = nowMs();

        function finishRecall(pickedOpt) {
          if (answeredRecall) return;
          answeredRecall = true;
          clearActiveRun();
          controlsMount.innerHTML = "";
          records.push({
            trialIndex: tr.trialIndex,
            cond: tr.cond,
            chosenKind: pickedOpt ? pickedOpt.kind : null,
            recallRtMs: pickedOpt ? Math.round(nowMs() - recallStart) : null,
            procResults: procResults
          });
          idx += 1;
          runFramePhase(tr.itiMs, {
            onComplete: function () { runSingleTrial(); }
          });
        }

        renderGlyphButtonsGrid(controlsMount, tr.options, tr.formId, "glyph-choice-grid-4", function (opt) {
          finishRecall(opt);
        });

        bindKeys(function (ev) {
          var num = Number(Core.toAsciiDigits(ev.key || ""));
          if (num >= 1 && num <= 4) {
            ev.preventDefault();
            finishRecall(tr.options[num - 1]);
          }
        });

        runFramePhase(tr.recallDeadlineMs, {
          onStart: function () { drawCueCanvas(1); },
          onTick: function (wallElapsed) {
            drawCueCanvas(1 - wallElapsed / tr.recallDeadlineMs);
          },
          onComplete: function () {
            finishRecall(null);
          }
        });
      }
    }

    runSingleTrial();
  }

  /* ================= 5. PROBE 2: D2 RAPID MUTATING + REFERENCE-BACK + M3 ================= */

  function runD2() {
    var Core = getCore();
    var st = Core.loadState();
    var formId = st.activeForm;
    var trials = Core.generateD2Trials({ formId: formId, isFamiliarization: isFamiliarizationRun });
    var idx = 0;
    var records = [];
    var a = domArena();

    activeProbeGuard = {
      expId: "d2_refback_m3",
      isPaused: false,
      droppedFrames: 0,
      criticalDropTrials: 0,
      visibilityInterruptions: 0,
      resumeFn: function () {
        if (idx < trials.length) {
          trials[idx] = Core.regenerateD2SingleTrial(trials[idx]);
        }
        runSingleTrial();
      }
    };

    function runSingleTrial() {
      clearActiveRun();
      if (idx >= trials.length) {
        var scored = Core.scoreD2Trials(records);
        var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
        Core.saveExperimentResult("d2_refback_m3", Object.assign({
          isFamiliarization: isFamiliarizationRun,
          formId: formId,
          env: envSnap,
          refreshHz: displayCalib.refreshHz,
          frameMs: displayCalib.frameMs,
          droppedFrames: activeProbeGuard ? activeProbeGuard.droppedFrames : 0,
          visibilityInterruptions: activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0
        }, scored));

        var sumText = isFamiliarizationRun ? "" : Core.computeDeepVerdictSummary().verdicts[1];
        return showExperimentResult(
          "d2_refback_m3",
          scored.pTargetPct + "%",
          [
            { label: "إصابة الهدف M3 (P_target)", val: scored.pTargetPct + "% (شامل: " + scored.effectiveTargetPct + "%)" },
            { label: "البؤرة Lag 0 مقابل الرف Lag≥1", val: scored.lag0AccPct + "% / " + scored.lag1PlusAccPct + "%" },
            { label: "تبديل P_swap,corr / متقادم P_stale,corr", val: scored.pSwapCorrPct + "% / " + scored.pStaleCorrPct + "%" },
            { label: "تخمين M3 المصحح (P_guess)", val: scored.pGuessPct + "%" },
            { label: "بوابة التحديث الأحمر (دقة · زمن)", val: scored.redAccPct + "% · " + scored.redMeanRtMs + " ms" },
            { label: "بوابة المقارنة الزرقاء (دقة · زمن)", val: scored.blueAccPct + "% · " + scored.blueMeanRtMs + " ms" }
          ],
          sumText
        );
      }

      var tr = trials[idx];
      var pal = getCanvasPalette();
      var roles = Core.ROLE_FRAMES_3;
      setHeader("D2 · الطفرة السريعة وبوابة التحديث", (idx + 1) + " / " + trials.length);

      var W = 420, H = 268, halfBox = 35;

      function drawThreeRolesScene(ctx, glyphsBySlot, opts) {
        var o = opts || {};
        ctx.fillStyle = pal.surface;
        ctx.fillRect(0, 0, W, H);
        if (typeof o.remRatio === "number") {
          drawCountdownStripOnCanvas(ctx, W, o.remRatio, o.barColor || pal.accent);
        }
        for (var r = 0; r < 3; r += 1) {
          var spec = roles[r];
          var cx = spec.normX * W;
          var cy = spec.normY * H;
          var isFocused = o.activeRole === r;
          drawAsymmetricRoleFrame(ctx, cx, cy, halfBox, spec, {
            active: isFocused,
            dimmed: o.activeRole !== undefined && !isFocused,
            gateKind: isFocused ? o.gateKind : null
          });
          if (o.masked) {
            drawPatternMaskPatch(ctx, cx, cy, halfBox * 0.85, tr.maskSeed + r * 53);
          } else if (o.probeQuestion && isFocused) {
            ctx.fillStyle = spec.stroke;
            ctx.font = "700 24px 'IBM Plex Sans Arabic', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("؟", cx, cy + 1);
          } else if (glyphsBySlot && glyphsBySlot[r] !== null && glyphsBySlot[r] !== undefined) {
            drawVcsGlyph(ctx, cx, cy, halfBox * 0.68, tr.formId, glyphsBySlot[r], pal.ink, pal.glyphFill);
          }
        }
      }

      // Pre-render initial fixation, simultaneous 2,000ms encoding, 150ms mask, and rapid 800ms (500ms exposure) mutation buffers
      var bufFix = createBufferCanvas(W, H);
      drawThreeRolesScene(bufFix.ctx, [null, null, null], {});
      drawFixationCross(bufFix.ctx, W / 2, H / 2, 7, pal.ink);

      var bufEncode = createBufferCanvas(W, H);
      drawThreeRolesScene(bufEncode.ctx, tr.initialGlyphs, {});

      var bufMask = createBufferCanvas(W, H);
      drawThreeRolesScene(bufMask.ctx, [null, null, null], { masked: true });

      var bufBlank = createBufferCanvas(W, H);
      drawThreeRolesScene(bufBlank.ctx, [null, null, null], {});

      var mutBuffers = tr.rapidMutations.map(function (mut) {
        var b = createBufferCanvas(W, H);
        var arr = [null, null, null];
        arr[mut.roleIdx] = mut.glyphIdx;
        drawThreeRolesScene(b.ctx, arr, { activeRole: mut.roleIdx });
        return b;
      });

      a.stage.innerHTML =
        '<div class="task-box deep-canvas-box">' +
        '<div id="d2SubLabel" class="stim-label">احفظ الرموز الثلاثة داخل إطاراتها <span class="ltr-iso">(2.0 s)</span></div>' +
        '<div id="d2CanvasMount" class="deep-canvas-wrap"></div>' +
        '<div id="d2ControlsMount"></div>' +
        '</div>';

      var stageObj = createStageCanvas(W, H);
      document.getElementById("d2CanvasMount").appendChild(stageObj.canvas);
      var subLabel = document.getElementById("d2SubLabel");
      var controlsMount = document.getElementById("d2ControlsMount");
      var gateResults = [];

      // 1. Fixation (200ms) -> 2. Encode (2,000ms) -> 3. Mask (150ms) -> 4. Post-mask blank (200ms) -> 5. Rapid sub-second mutations (SOA=800ms)
      runFramePhase(tr.fixationMs, {
        onStart: function () { blitBuffer(stageObj, bufFix); },
        onComplete: function () {
          runFramePhase(tr.encodeMs, {
            isCriticalExposure: true,
            onStart: function () {
              blitBuffer(stageObj, bufEncode);
              drawCountdownStripOnCanvas(stageObj.ctx, W, 1, pal.accent);
            },
            onTick: function (wallElapsed) {
              blitBuffer(stageObj, bufEncode);
              drawCountdownStripOnCanvas(stageObj.ctx, W, 1 - wallElapsed / tr.encodeMs, pal.accent);
            },
            onComplete: function () {
              runFramePhase(tr.maskMs, {
                onStart: function () { blitBuffer(stageObj, bufMask); },
                onComplete: function () {
                  runFramePhase(tr.postMaskBlankMs || 200, {
                    onStart: function () { blitBuffer(stageObj, bufBlank); },
                    onComplete: function () {
                      runRapidMutation(0);
                    }
                  });
                }
              });
            }
          });
        }
      });

      function runRapidMutation(mIdx) {
        if (mIdx >= tr.rapidMutations.length) {
          return runRefBackStep(0);
        }
        var mut = tr.rapidMutations[mIdx];
        subLabel.innerHTML = 'تحديث تلقائي بلا ضغط <span class="ltr-iso">(' + (mIdx + 1) + '/2 · 500 ms)</span> — احفظ الرمز الجديد';
        runFramePhase(mut.exposureMs, {
          isCriticalExposure: true,
          onStart: function () { blitBuffer(stageObj, mutBuffers[mIdx]); },
          onComplete: function () {
            runFramePhase(mut.isiMs, {
              onStart: function () { blitBuffer(stageObj, bufBlank); },
              onComplete: function () {
                runRapidMutation(mIdx + 1);
              }
            });
          }
        });
      }

      function runRefBackStep(rbIdx) {
        if (rbIdx >= tr.refBackSteps.length) {
          return runFinal6AfcProbe();
        }
        var stp = tr.refBackSteps[rbIdx];
        var isRed = stp.gateKind === "update_red";
        subLabel.innerHTML = isRed
          ? '<span class="gate-pill is-red">أحمر · تحديث: قارن بالمحفوظ ثم احفظ الجديد</span>'
          : '<span class="gate-pill is-blue">أزرق · مقارنة فقط: قارن دون تغيير المحفوظ</span>';

        controlsMount.innerHTML =
          '<div class="nback-actions">' +
          '<button id="d2MatchBtn" type="button" class="opt-btn"><span>طابق</span><kbd class="kbd-chip ltr-iso">J · →</kbd></button>' +
          '<button id="d2DiffBtn" type="button" class="opt-btn"><span>مختلف</span><kbd class="kbd-chip ltr-iso">F · ←</kbd></button>' +
          '</div>';

        var shownArr = [null, null, null];
        shownArr[stp.roleIdx] = stp.shownGlyph;
        var doneStep = false;
        var stepStart = nowMs();

        function finishGateStep(saidMatch) {
          if (doneStep) return;
          var rt = saidMatch === null ? null : Math.round(nowMs() - stepStart);
          if (saidMatch !== null && rt < 95) return;
          doneStep = true;
          clearActiveRun();
          gateResults.push({
            stepIndex: stp.stepIndex,
            gateKind: stp.gateKind,
            transition: stp.gateTransition || stp.transition,
            gateTransition: stp.gateTransition || stp.transition,
            roleTransition: stp.roleTransition || null,
            rtMs: rt,
            correct: saidMatch !== null && rt >= 130 && Boolean(saidMatch) === Boolean(stp.isMatch)
          });
          controlsMount.innerHTML = "";
          runFramePhase(stp.isiMs, {
            onStart: function () { blitBuffer(stageObj, bufBlank); },
            onComplete: function () { runRefBackStep(rbIdx + 1); }
          });
        }

        document.getElementById("d2MatchBtn").addEventListener("click", function () { finishGateStep(true); });
        document.getElementById("d2DiffBtn").addEventListener("click", function () { finishGateStep(false); });
        bindKeys(function (ev) {
          if (isRightChoiceKey(ev)) { ev.preventDefault(); finishGateStep(true); }
          else if (isLeftChoiceKey(ev)) { ev.preventDefault(); finishGateStep(false); }
        });

        var barCol = isRed ? "#dc2626" : "#2563eb";
        runFramePhase(stp.deadlineMs, {
          onStart: function () {
            stepStart = nowMs();
            drawThreeRolesScene(stageObj.ctx, shownArr, { activeRole: stp.roleIdx, gateKind: stp.gateKind, remRatio: 1, barColor: barCol });
          },
          onTick: function (wallElapsed) {
            drawThreeRolesScene(stageObj.ctx, shownArr, {
              activeRole: stp.roleIdx,
              gateKind: stp.gateKind,
              remRatio: 1 - wallElapsed / stp.deadlineMs,
              barColor: barCol
            });
          },
          onComplete: function () { finishGateStep(null); }
        });
      }

      function runFinal6AfcProbe() {
        subLabel.innerHTML = 'اختر الرمز النشط حاليا للإطار المميز بـ (؟) <span class="ltr-iso">(1–6)</span>:';
        controlsMount.innerHTML = "";
        var doneProbe = false;
        var probeStart = nowMs();

        function finishProbe(pickedOpt) {
          if (doneProbe) return;
          doneProbe = true;
          clearActiveRun();
          controlsMount.innerHTML = "";
          records.push({
            trialIndex: tr.trialIndex,
            isLag0: tr.isLag0,
            chosenCategory: pickedOpt ? pickedOpt.category : null,
            probeRtMs: pickedOpt ? Math.round(nowMs() - probeStart) : null,
            gateResults: gateResults
          });
          idx += 1;
          runFramePhase(tr.itiMs, {
            onComplete: function () { runSingleTrial(); }
          });
        }

        renderGlyphButtonsGrid(controlsMount, tr.options6, tr.formId, "glyph-choice-grid-6", function (opt) {
          finishProbe(opt);
        });

        bindKeys(function (ev) {
          var num = Number(Core.toAsciiDigits(ev.key || ""));
          if (num >= 1 && num <= 6) {
            ev.preventDefault();
            finishProbe(tr.options6[num - 1]);
          }
        });

        runFramePhase(tr.probeDeadlineMs, {
          onStart: function () {
            probeStart = nowMs();
            drawThreeRolesScene(stageObj.ctx, [null, null, null], { activeRole: tr.probeRole, probeQuestion: true, remRatio: 1 });
          },
          onTick: function (wallElapsed) {
            drawThreeRolesScene(stageObj.ctx, [null, null, null], {
              activeRole: tr.probeRole,
              probeQuestion: true,
              remRatio: 1 - wallElapsed / tr.probeDeadlineMs
            });
          },
          onComplete: function () { finishProbe(null); }
        });
      }
    }

    runSingleTrial();
  }

  /* ================= 6. PROBE 3: D3 MASKED BAYS N=4 (600ms + 200ms ISI · 0.9s vs 3.8s) ================= */

  function runD3() {
    var Core = getCore();
    var st = Core.loadState();
    var formId = st.activeForm;
    var trials = Core.generateD3Trials({ formId: formId, isFamiliarization: isFamiliarizationRun });
    var idx = 0;
    var records = [];
    var a = domArena();
    var syllables = ["با", "بي", "بو"];

    var W = 360, H = 288, cx = W / 2, cy = H / 2, ringR = 94, nodeR = 34;
    var stageObj = null;
    var pacerEl = null;
    var sylEl = null;
    var dotEl = null;
    var respMount = null;

    activeProbeGuard = {
      expId: "d3_bays_analog",
      isPaused: false,
      droppedFrames: 0,
      criticalDropTrials: 0,
      visibilityInterruptions: 0,
      resumeFn: function () {
        if (idx < trials.length) {
          trials[idx] = Core.regenerateD3SingleTrial(trials[idx]);
        }
        runSingleTrial();
      }
    };

    function ringPos(deg, centerX, centerY, r) {
      var rad = (deg * Math.PI) / 180;
      return { x: centerX + Math.cos(rad) * r, y: centerY + Math.sin(rad) * r };
    }

    function drawOrientedGaborPatch(ctx, px, py, r, angleDeg, pal, opts) {
      var o = opts || {};
      ctx.save();
      if (o.dimmed) {
        ctx.globalAlpha = 0.42;
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      if (o.cued) {
        ctx.fillStyle = pal.baysCueSoft;
        ctx.fill();
      }
      ctx.strokeStyle = o.cued ? pal.baysCue : pal.baysRing;
      ctx.lineWidth = o.cued ? 3.4 : 1.7;
      ctx.stroke();

      if (o.cuedQuestion) {
        ctx.fillStyle = pal.baysCue;
        ctx.font = "700 21px 'IBM Plex Sans Arabic', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("؟", px, py + 1);
      } else if (!o.empty) {
        var rad = (angleDeg * Math.PI) / 180;
        var len = r * 0.80;
        var dx = Math.cos(rad) * len;
        var dy = Math.sin(rad) * len;
        ctx.strokeStyle = pal.baysBar;
        ctx.lineWidth = 4.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();

        ctx.fillStyle = pal.baysBar;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function ensureD3StageShell() {
      var existingCanvas = document.getElementById("d3Canvas");
      if (stageObj && existingCanvas === stageObj.canvas) return;
      a.stage.innerHTML =
        '<div class="task-box deep-canvas-box">' +
        '<div id="d3Pacer" class="suppression-pacer is-frozen" aria-live="off">' +
        '<span id="d3PacerDot" class="pacer-dot"></span>' +
        '<span>كبح لفظي هادئ: <strong id="d3Syllable">با — بي — بو</strong></span>' +
        '</div>' +
        '<div id="d3CanvasMount" class="deep-canvas-wrap"></div>' +
        '<div id="d3ResponseMount"></div>' +
        '</div>';

      stageObj = createStageCanvas(W, H);
      stageObj.canvas.id = "d3Canvas";
      stageObj.canvas.style.touchAction = "none";
      document.getElementById("d3CanvasMount").appendChild(stageObj.canvas);
      pacerEl = document.getElementById("d3Pacer");
      sylEl = document.getElementById("d3Syllable");
      dotEl = document.getElementById("d3PacerDot");
      respMount = document.getElementById("d3ResponseMount");
    }

    function runSingleTrial() {
      clearActiveRun();
      if (a.overlay && a.overlay.scrollTop !== 0) {
        a.overlay.scrollTop = 0;
      }
      if (idx >= trials.length) {
        var scored = Core.scoreD3Trials(records);
        var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
        Core.saveExperimentResult("d3_bays_analog", Object.assign({
          isFamiliarization: isFamiliarizationRun,
          formId: formId,
          env: envSnap,
          refreshHz: displayCalib.refreshHz,
          frameMs: displayCalib.frameMs,
          droppedFrames: activeProbeGuard ? activeProbeGuard.droppedFrames : 0,
          visibilityInterruptions: activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0
        }, scored));

        var sumText = isFamiliarizationRun ? "" : Core.computeDeepVerdictSummary().verdicts[2];
        return showExperimentResult(
          "d3_bays_analog",
          "K=" + scored.K + " · " + scored.sigmaDeg + "°",
          [
            { label: "احتمال الهدف والسعة (α · K=4α)", val: scored.alphaPct + "% · K=" + scored.K },
            { label: "معدل التبديل (MAP β / Bays 2016)", val: scored.betaPct + "% / " + scored.bays2016SwapPct + "%" },
            { label: "معدل التخمين الكلي (γ)", val: scored.gammaPct + "%" },
            { label: "قفزة الفقد بالتأخير (0.9s ← 3.8s)", val: Core.fmtSigned(scored.deltaGammaDelayPct, "%") + " · " + scored.gammaShortPct + "% ← " + scored.gammaLongPct + "%" },
            { label: "الانحراف الدائري والخطأ (σ_θ · cMAE)", val: scored.sigmaDeg + "° · " + scored.cMAE + "°" },
            { label: "تبديل التأخير القصير 0.9s (β_0.9s)", val: scored.betaShortPct + "%" }
          ],
          sumText
        );
      }

      ensureD3StageShell();

      var tr = trials[idx];
      var pal = getCanvasPalette();
      var itiMs = Number.isFinite(tr.itiMs) ? tr.itiMs : 400;
      var fixationMs = Number.isFinite(tr.fixationMs) ? tr.fixationMs : 750;
      var exposureMs = Number.isFinite(tr.exposureMs) ? tr.exposureMs : 600;
      var isiMs = Number.isFinite(tr.isiMs) ? tr.isiMs : 200;
      var maskMs = Number.isFinite(tr.maskMs) ? tr.maskMs : 150;
      var delayMs = Number.isFinite(tr.delayMs) ? tr.delayMs : (tr.isLong ? 3600 : 700);
      var responseDeadlineMs = Number.isFinite(tr.responseDeadlineMs) ? tr.responseDeadlineMs : 10000;
      var suppressionPaceMs = Number.isFinite(tr.suppressionPaceMs) ? tr.suppressionPaceMs : 550;

      setHeader(
        "D3 — خليط الزوايا · " + (tr.isLong ? "تأخير\u00A03.8s" : "تأخير\u00A00.9s"),
        (idx + 1) + " / " + trials.length
      );

      // Freeze pacer completely during fixation, stimulus, isi, and mask (zero peripheral motion!)
      if (dotEl) dotEl.classList.remove("is-beat");
      if (sylEl) sylEl.textContent = "با — بي — بو";
      if (pacerEl) {
        pacerEl.classList.add("is-frozen");
        pacerEl.style.visibility = "visible";
      }
      if (respMount) respMount.innerHTML = "";
      stageObj.canvas.style.cursor = "default";

      // Offscreen pre-rendered buffers for 750ms Fixation/ISI, 600ms N=4 Array, and 150ms Pattern Mask
      var bufFix = createBufferCanvas(W, H);
      bufFix.ctx.fillStyle = pal.baysBg;
      bufFix.ctx.fillRect(0, 0, W, H);
      for (var i0 = 0; i0 < 4; i0 += 1) {
        var p0 = ringPos(tr.ringLocationsDeg[i0], cx, cy, ringR);
        drawOrientedGaborPatch(bufFix.ctx, p0.x, p0.y, nodeR, 0, pal, { empty: true });
      }
      drawFixationCross(bufFix.ctx, cx, cy, 7, pal.baysBar);

      var bufFlash = createBufferCanvas(W, H);
      bufFlash.ctx.fillStyle = pal.baysBg;
      bufFlash.ctx.fillRect(0, 0, W, H);
      for (var i1 = 0; i1 < 4; i1 += 1) {
        var p1 = ringPos(tr.ringLocationsDeg[i1], cx, cy, ringR);
        drawOrientedGaborPatch(bufFlash.ctx, p1.x, p1.y, nodeR, tr.angles[i1], pal, {});
      }
      drawFixationCross(bufFlash.ctx, cx, cy, 6, pal.baysBar);

      var bufMask = createBufferCanvas(W, H);
      bufMask.ctx.fillStyle = pal.baysBg;
      bufMask.ctx.fillRect(0, 0, W, H);
      for (var i2 = 0; i2 < 4; i2 += 1) {
        var p2 = ringPos(tr.ringLocationsDeg[i2], cx, cy, ringR);
        drawPatternMaskPatch(bufMask.ctx, p2.x, p2.y, nodeR, tr.maskSeed + i2 * 61, pal.baysBg);
      }
      drawFixationCross(bufMask.ctx, cx, cy, 6, pal.baysBar);

      var pacerOriginNow = 0;
      var lastBeatIdx = -1;

      function syncSuppressionPacer(tNow) {
        var elapsed = Math.max(0, tNow - pacerOriginNow);
        var beatIdx = Math.floor(elapsed / suppressionPaceMs);
        var withinBeat = elapsed % suppressionPaceMs;
        if (beatIdx !== lastBeatIdx) {
          lastBeatIdx = beatIdx;
          if (sylEl) sylEl.textContent = syllables[beatIdx % 3];
        }
        if (dotEl) {
          dotEl.classList.toggle("is-beat", withinBeat < 160);
        }
      }

      function drawFixationGazeCue(wallElapsed) {
        blitBuffer(stageObj, bufFix);
        // Smooth converging centering ring during 0..500ms; steady (+) lock during final 250ms before flash
        var lockSpanMs = Math.min(500, Math.max(250, fixationMs - 250));
        if (wallElapsed < lockSpanMs) {
          var prog = Math.max(0, Math.min(1, wallElapsed / lockSpanMs));
          var ease = 1 - (1 - prog) * (1 - prog);
          var cueR = 26 - 16 * ease;
          var ctx = stageObj.ctx;
          ctx.save();
          ctx.strokeStyle = pal.baysCue;
          ctx.globalAlpha = 0.38 * (1 - 0.32 * prog);
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(cx, cy, cueR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Phase 1: Fixation (750ms) with calm converging gaze-centering lock on (+)
      runFramePhase(fixationMs, {
        onStart: function () {
          stageObj.canvas.dataset.phase = "fixation";
          drawFixationGazeCue(0);
        },
        onTick: function (wallElapsed) {
          drawFixationGazeCue(wallElapsed);
        },
        onComplete: function () {
          // Phase 2: Simultaneous N=4 Orientation Array (600ms)
          runFramePhase(exposureMs, {
            isCriticalExposure: true,
            onStart: function () {
              stageObj.canvas.dataset.phase = "stimulus";
              blitBuffer(stageObj, bufFlash);
            },
            onComplete: function () {
              // Phase 3: Clean Unmasked Blank Consolidation ISI (200ms -> 800ms stimulus-to-mask SOA)
              runFramePhase(isiMs, {
                onStart: function () {
                  stageObj.canvas.dataset.phase = "isi";
                  blitBuffer(stageObj, bufFix);
                },
                onComplete: function () {
                  // Phase 4: Oriented-Line / Checkerboard Afterimage Mask (150ms)
                  runFramePhase(maskMs, {
                    onStart: function () {
                      stageObj.canvas.dataset.phase = "mask";
                      blitBuffer(stageObj, bufMask);
                    },
                    onComplete: function () {
                      // Phase 5: Post-Mask Blank Retention (700ms vs 3,600ms => 0.9s vs 3.8s total blank retention)
                      runFramePhase(delayMs, {
                        onStart: function (tNow) {
                          stageObj.canvas.dataset.phase = "delay";
                          if (pacerEl) pacerEl.classList.remove("is-frozen");
                          pacerOriginNow = tNow;
                          lastBeatIdx = -1;
                          syncSuppressionPacer(tNow);
                          blitBuffer(stageObj, bufFix);
                          if (tr.isLong) {
                            drawCountdownStripOnCanvas(stageObj.ctx, W, 1, pal.baysCue);
                          }
                        },
                        onTick: function (wallElapsed, _f, tNow) {
                          syncSuppressionPacer(tNow);
                          if (tr.isLong) {
                            blitBuffer(stageObj, bufFix);
                            drawCountdownStripOnCanvas(stageObj.ctx, W, 1 - wallElapsed / delayMs, pal.baysCue);
                          }
                        },
                        onComplete: function () {
                          showAnalogDialCanvas();
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });

      function showAnalogDialCanvas() {
        // Keep top slot height locked via visibility:hidden so canvas fixation (cx, cy) shifts 0px!
        if (dotEl) dotEl.classList.remove("is-beat");
        if (pacerEl) {
          pacerEl.classList.add("is-frozen");
          pacerEl.style.visibility = "hidden";
        }
        stageObj.canvas.dataset.phase = "response";

        var curAngle = tr.initDialAngle;
        var touched = false;
        var finished = false;
        var respStart = nowMs();

        // Draw spatial cue on the main ring canvas + interactive analog dial (ZERO numeric degrees!)
        function drawCueAndDial(remRatio) {
          var ctx = stageObj.ctx;
          ctx.fillStyle = pal.baysBg;
          ctx.fillRect(0, 0, W, H);
          drawCountdownStripOnCanvas(ctx, W, remRatio, pal.baysCue);

          for (var i = 0; i < 4; i += 1) {
            var p = ringPos(tr.ringLocationsDeg[i], cx, cy, ringR);
            var isProbe = i === tr.probeIdx;
            if (isProbe && touched) {
              // Live visual orientation preview inside the cued ring location (zero degree numbers!)
              drawOrientedGaborPatch(ctx, p.x, p.y, nodeR, curAngle, pal, { cued: true });
            } else {
              drawOrientedGaborPatch(ctx, p.x, p.y, nodeR, 0, pal, {
                empty: !isProbe,
                dimmed: !isProbe,
                cued: isProbe,
                cuedQuestion: isProbe
              });
            }
          }

          // Interactive central dial ring (radius 42 around center)
          var dialR = 42;
          ctx.save();
          ctx.fillStyle = pal.surface;
          ctx.strokeStyle = pal.baysCue;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, dialR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          var rad = (curAngle * Math.PI) / 180;
          var dx = Math.cos(rad) * (dialR - 8);
          var dy = Math.sin(rad) * (dialR - 8);
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 4.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx - dx, cy - dy);
          ctx.lineTo(cx + dx, cy + dy);
          ctx.stroke();

          ctx.fillStyle = pal.baysCue;
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, 5.5, 0, Math.PI * 2);
          ctx.arc(cx - dx, cy - dy, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        respMount.innerHTML =
          '<div id="d3ScrubTrack" class="d3-scrub-track" role="slider" aria-valuemin="0" aria-valuemax="180" aria-valuenow="' + Math.round(curAngle) + '" aria-label="شريط تدوير الميل باللمس دون حجب الحلقة">' +
          '<span id="d3ScrubThumb" class="d3-scrub-thumb"></span>' +
          '<span class="d3-scrub-hint">اسحب أفقيا لتدوير الميل دون حجب الحلقة</span>' +
          '</div>' +
          '<div class="orient-fine-row">' +
          '<button type="button" class="btn-ghost d3-rot-btn" data-delta="-6" aria-label="تدوير عكس عقارب الساعة">⟲</button>' +
          '<button type="button" class="btn-ghost d3-rot-btn" data-delta="-1.5" aria-label="تدوير دقيق لليسار">‹</button>' +
          '<button id="d3ConfirmBtn" type="button" class="btn-primary" disabled>حرّك الميل أولا للتأكيد</button>' +
          '<button type="button" class="btn-ghost d3-rot-btn" data-delta="1.5" aria-label="تدوير دقيق لليمين">›</button>' +
          '<button type="button" class="btn-ghost d3-rot-btn" data-delta="6" aria-label="تدوير مع عقارب الساعة">⟳</button>' +
          '</div>';

        var confirmBtn = document.getElementById("d3ConfirmBtn");
        var scrubTrack = document.getElementById("d3ScrubTrack");
        var scrubThumb = document.getElementById("d3ScrubThumb");

        function syncScrubThumb() {
          if (!scrubThumb) return;
          var pct = Math.max(4, Math.min(96, (curAngle / 180) * 100));
          scrubThumb.style.left = pct.toFixed(1) + "%";
          if (scrubTrack) {
            scrubTrack.setAttribute("aria-valuenow", String(Math.round(curAngle)));
          }
        }

        function markAdjusted(newAngle) {
          curAngle = ((Number(newAngle) % 180) + 180) % 180;
          syncScrubThumb();
          if (!touched) {
            touched = true;
            if (scrubTrack && scrubTrack.classList) {
              scrubTrack.classList.add("is-touched");
            }
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<span>تأكيد الميل</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd>';
          }
          if (!finished) {
            drawCueAndDial(Math.max(0, 1 - (nowMs() - respStart) / responseDeadlineMs));
          }
        }
        syncScrubThumb();

        var dragging = false;
        function updateFromPointer(ev) {
          var rect = stageObj.canvas.getBoundingClientRect();
          var px = ev.clientX - (rect.left + rect.width / 2);
          var py = ev.clientY - (rect.top + rect.height / 2);
          if (Math.hypot(px, py) < 12) return;
          var deg = (Math.atan2(py, px) * 180) / Math.PI;
          markAdjusted(deg);
        }

        var onDown = function (ev) {
          if (ev.cancelable) ev.preventDefault();
          dragging = true;
          if (stageObj.canvas.setPointerCapture && ev.pointerId !== undefined) {
            try { stageObj.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
          }
          updateFromPointer(ev);
        };
        var onMove = function (ev) {
          if (!dragging) return;
          if (ev.cancelable) ev.preventDefault();
          updateFromPointer(ev);
        };
        var onUp = function () { dragging = false; };

        stageObj.canvas.style.cursor = "grab";
        stageObj.canvas.style.touchAction = "none";
        stageObj.canvas.addEventListener("pointerdown", onDown);
        stageObj.canvas.addEventListener("pointermove", onMove);
        stageObj.canvas.addEventListener("pointerup", onUp);
        stageObj.canvas.addEventListener("pointercancel", onUp);

        // Endless relative rotary drum below the ring canvas (zero initial jump, zero screen-edge wall, 0% thumb occlusion)
        var scrubbing = false;
        var scrubStartX = 0;
        var scrubStartAngle = curAngle;
        var onScrubDown = function (ev) {
          if (ev.cancelable) ev.preventDefault();
          scrubbing = true;
          scrubStartX = ev.clientX;
          scrubStartAngle = curAngle;
          if (scrubTrack && scrubTrack.setPointerCapture && ev.pointerId !== undefined) {
            try { scrubTrack.setPointerCapture(ev.pointerId); } catch (_) {}
          }
          markAdjusted(curAngle);
        };
        var onScrubMove = function (ev) {
          if (!scrubbing || !scrubTrack) return;
          if (ev.cancelable) ev.preventDefault();
          var rect = scrubTrack.getBoundingClientRect();
          var w = Math.max(120, rect.width);
          var deltaDeg = ((ev.clientX - scrubStartX) / w) * 180;
          markAdjusted(scrubStartAngle + deltaDeg);
        };
        var onScrubUp = function () { scrubbing = false; };

        if (scrubTrack) {
          scrubTrack.addEventListener("pointerdown", onScrubDown);
          scrubTrack.addEventListener("pointermove", onScrubMove);
          scrubTrack.addEventListener("pointerup", onScrubUp);
          scrubTrack.addEventListener("pointercancel", onScrubUp);
        }

        addPointerCleanup(function () {
          stageObj.canvas.removeEventListener("pointerdown", onDown);
          stageObj.canvas.removeEventListener("pointermove", onMove);
          stageObj.canvas.removeEventListener("pointerup", onUp);
          stageObj.canvas.removeEventListener("pointercancel", onUp);
          if (scrubTrack) {
            scrubTrack.removeEventListener("pointerdown", onScrubDown);
            scrubTrack.removeEventListener("pointermove", onScrubMove);
            scrubTrack.removeEventListener("pointerup", onScrubUp);
            scrubTrack.removeEventListener("pointercancel", onScrubUp);
          }
        });

        var rotBtns = respMount.querySelectorAll(".d3-rot-btn");
        for (var b = 0; b < rotBtns.length; b += 1) {
          rotBtns[b].addEventListener("click", function (ev) {
            var d = Number(ev.currentTarget.getAttribute("data-delta")) || 0;
            markAdjusted(curAngle + d);
          });
        }

        function drawItiBlank() {
          var ctx = stageObj.ctx;
          ctx.fillStyle = pal.baysBg;
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.fillStyle = pal.baysRing;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        function commitResponse(fromTimeout) {
          if (finished) return;
          if (!fromTimeout && !touched) return;
          finished = true;
          clearActiveRun();

          records.push({
            trialIndex: tr.trialIndex,
            isLong: tr.isLong,
            targetAngle: tr.targetAngle,
            nonTargetAngles: tr.nonTargetAngles,
            respAngle: touched ? Core.round1(curAngle) : NaN,
            omitted: !touched,
            rtMs: Math.round(nowMs() - respStart)
          });

          idx += 1;

          // Immediate visual release & start of 1,150ms (400ms ITI + 750ms Fixation) gaze-return turnaround
          if (respMount) respMount.innerHTML = "";
          if (pacerEl) pacerEl.style.visibility = "hidden";
          stageObj.canvas.style.cursor = "default";
          stageObj.canvas.dataset.phase = "iti";
          drawItiBlank();

          runFramePhase(itiMs, {
            onStart: function () {
              stageObj.canvas.dataset.phase = "iti";
              drawItiBlank();
            },
            onComplete: function () { runSingleTrial(); }
          });
        }

        confirmBtn.addEventListener("click", function () { commitResponse(false); });
        bindKeys(function (ev) {
          if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
            ev.preventDefault();
            markAdjusted(curAngle + (ev.shiftKey ? 7 : 2));
          } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
            ev.preventDefault();
            markAdjusted(curAngle - (ev.shiftKey ? 7 : 2));
          } else if (ev.key === "Enter" && touched) {
            ev.preventDefault();
            commitResponse(false);
          }
        });

        runFramePhase(responseDeadlineMs, {
          onStart: function () {
            stageObj.canvas.dataset.phase = "response";
            respStart = nowMs();
            drawCueAndDial(1);
          },
          onTick: function (wallElapsed) {
            drawCueAndDial(1 - wallElapsed / responseDeadlineMs);
          },
          onComplete: function () {
            commitResponse(true);
          }
        });
      }
    }

    runSingleTrial();
  }

  /* ================= 7. PROBE 4: D4 BALLISTIC CONSOLIDATION (SOA_75 & AUC_cons) ================= */

  function runD4() {
    var Core = getCore();
    var st = Core.loadState();
    var formId = st.activeForm;
    var trials = Core.generateD4Trials({ formId: formId, isFamiliarization: isFamiliarizationRun });
    var idx = 0;
    var records = [];
    var a = domArena();

    activeProbeGuard = {
      expId: "d4_consolidation_soa",
      isPaused: false,
      droppedFrames: 0,
      criticalDropTrials: 0,
      visibilityInterruptions: 0,
      resumeFn: function () {
        if (idx < trials.length) {
          trials[idx] = Core.regenerateD4SingleTrial(trials[idx]);
        }
        runSingleTrial();
      }
    };

    function runSingleTrial() {
      clearActiveRun();
      if (idx >= trials.length) {
        var scored = Core.scoreD4Trials(records);
        var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
        Core.saveExperimentResult("d4_consolidation_soa", Object.assign({
          isFamiliarization: isFamiliarizationRun,
          formId: formId,
          env: envSnap,
          refreshHz: displayCalib.refreshHz,
          frameMs: displayCalib.frameMs,
          droppedFrames: activeProbeGuard ? activeProbeGuard.droppedFrames : 0,
          visibilityInterruptions: activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0
        }, scored));

        var soaDisp = Core.formatD4Soa75(scored, false);
        var sumText = isFamiliarizationRun ? "" : Core.computeDeepVerdictSummary().verdicts[3];
        return showExperimentResult(
          "d4_consolidation_soa",
          soaDisp,
          [
            { label: "عتبة التوطيد الحرجة (SOA_75)", val: soaDisp },
            { label: "مساحة التوطيد المعيارية (AUC_cons)", val: scored.aucConsPct + "% (خام: " + scored.aucRawPct + "%)" },
            { label: "الدقة عند 350 / 650 ms", val: scored.acc350Pct + "% / " + scored.acc650Pct + "%" },
            { label: "الدقة عند 1050 / 1450 ms", val: scored.acc1050Pct + "% / " + scored.acc1450Pct + "%" },
            { label: "التبديل السريع مقابل البطيء", val: scored.fastSwapCorrPct + "% / " + scored.slowSwapCorrPct + "%" },
            { label: "دقة القرار القاطع الرجعي (2-AFC)", val: scored.interruptAccPct + "% · " + scored.interruptMeanRtMs + " ms" }
          ],
          sumText
        );
      }

      var tr = trials[idx];
      var pal = getCanvasPalette();
      var roles = Core.ROLE_FRAMES_3;
      setHeader(
        "D4 — التوطيد الباليستي",
        (idx + 1) + " / " + trials.length
      );

      var W = 380, H = 240, cx = W / 2, cy = H / 2, halfBox = 48;

      var bufFix = createBufferCanvas(W, H);
      bufFix.ctx.fillStyle = pal.surface;
      bufFix.ctx.fillRect(0, 0, W, H);
      drawFixationCross(bufFix.ctx, cx, cy, 8, pal.ink);

      var bufBlank = createBufferCanvas(W, H);
      bufBlank.ctx.fillStyle = pal.surface;
      bufBlank.ctx.fillRect(0, 0, W, H);

      var itemBuffers = tr.streamBindings.map(function (b) {
        var buf = createBufferCanvas(W, H);
        buf.ctx.fillStyle = pal.surface;
        buf.ctx.fillRect(0, 0, W, H);
        drawAsymmetricRoleFrame(buf.ctx, cx, cy, halfBox, roles[b.roleIdx], { active: true });
        drawVcsGlyph(buf.ctx, cx, cy, halfBox * 0.68, tr.formId, b.glyphIdx, pal.ink, pal.glyphFill);
        return buf;
      });

      var maskBuffers = [0, 1, 2].map(function (k) {
        var buf = createBufferCanvas(W, H);
        buf.ctx.fillStyle = pal.surface;
        buf.ctx.fillRect(0, 0, W, H);
        drawPatternMaskPatch(buf.ctx, cx, cy, halfBox * 0.96, tr.maskSeed + k * 71);
        return buf;
      });

      a.stage.innerHTML =
        '<div class="task-box deep-canvas-box">' +
        '<div id="d4SubLabel" class="stim-label">احفظ الروابط الثلاثة المتعاقبة في المركز</div>' +
        '<div id="d4CanvasMount" class="deep-canvas-wrap"></div>' +
        '<div id="d4ControlsMount"></div>' +
        '</div>';

      var stageObj = createStageCanvas(W, H);
      document.getElementById("d4CanvasMount").appendChild(stageObj.canvas);
      var subLabel = document.getElementById("d4SubLabel");
      var controlsMount = document.getElementById("d4ControlsMount");

      runFramePhase(tr.fixationMs, {
        onStart: function () { blitBuffer(stageObj, bufFix); },
        onComplete: function () {
          presentStreamBinding(0);
        }
      });

      function presentStreamBinding(sPos) {
        if (sPos >= 3) {
          return runRetroactive2AfcInterrupt();
        }
        // 250ms exposure + 100ms pattern mask + gap
        // For items 0 and 1: gap = soaMs - 350 (so onset-to-onset = exact soaMs!)
        // For item 2 (third binding): post-binding delay before 2-AFC = exact 250ms (100ms mask + 150ms blank)!
        var blankAfterMaskMs = sPos < 2 ? tr.interItemBlankMs : 150;

        runFramePhase(tr.itemExposureMs, {
          isCriticalExposure: true,
          onStart: function () { blitBuffer(stageObj, itemBuffers[sPos]); },
          onComplete: function () {
            runFramePhase(tr.itemMaskMs, {
              onStart: function () { blitBuffer(stageObj, maskBuffers[sPos]); },
              onComplete: function () {
                if (blankAfterMaskMs <= 0) {
                  presentStreamBinding(sPos + 1);
                } else {
                  runFramePhase(blankAfterMaskMs, {
                    onStart: function () { blitBuffer(stageObj, bufBlank); },
                    onComplete: function () { presentStreamBinding(sPos + 1); }
                  });
                }
              }
            });
          }
        });
      }

      function runRetroactive2AfcInterrupt() {
        subLabel.textContent = "حدّد فورا اتجاه السهم المزدوج: يمين أم يسار؟";
        controlsMount.innerHTML =
          '<div class="nback-actions">' +
          '<button id="d4RightBtn" type="button" class="opt-btn"><span>يمين »</span><kbd class="kbd-chip ltr-iso">J · →</kbd></button>' +
          '<button id="d4LeftBtn" type="button" class="opt-btn"><span>« يسار</span><kbd class="kbd-chip ltr-iso">F · ←</kbd></button>' +
          '</div>';

        var doneInt = false;
        var intStart = nowMs();

        function drawChevronScene(remRatio) {
          var ctx = stageObj.ctx;
          ctx.fillStyle = pal.surface;
          ctx.fillRect(0, 0, W, H);
          drawCountdownStripOnCanvas(ctx, W, remRatio, "#f59e0b");

          var dirSign = tr.interruptExpectRight ? 1 : -1;
          ctx.save();
          ctx.strokeStyle = pal.ink;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (var offset = -14; offset <= 14; offset += 28) {
            ctx.beginPath();
            ctx.moveTo(cx + offset - dirSign * 14, cy - 22);
            ctx.lineTo(cx + offset + dirSign * 14, cy);
            ctx.lineTo(cx + offset - dirSign * 14, cy + 22);
            ctx.stroke();
          }
          ctx.restore();
        }

        function finishInterrupt(pickedRight) {
          if (doneInt) return;
          doneInt = true;
          clearActiveRun();
          var rt = pickedRight === null ? null : Math.round(nowMs() - intStart);
          var intOk = pickedRight !== null && rt >= 110 && Boolean(pickedRight) === Boolean(tr.interruptExpectRight);
          runBindingRecall4AFC(rt, intOk);
        }

        document.getElementById("d4RightBtn").addEventListener("click", function () { finishInterrupt(true); });
        document.getElementById("d4LeftBtn").addEventListener("click", function () { finishInterrupt(false); });
        bindKeys(function (ev) {
          if (isRightChoiceKey(ev)) { ev.preventDefault(); finishInterrupt(true); }
          else if (isLeftChoiceKey(ev)) { ev.preventDefault(); finishInterrupt(false); }
        });

        runFramePhase(tr.interruptDeadlineMs, {
          onStart: function () {
            intStart = nowMs();
            drawChevronScene(1);
          },
          onTick: function (wallElapsed) {
            drawChevronScene(1 - wallElapsed / tr.interruptDeadlineMs);
          },
          onComplete: function () { finishInterrupt(null); }
        });
      }

      function runBindingRecall4AFC(interruptRtMs, interruptCorrect) {
        subLabel.innerHTML = 'اختر الرمز الذي ارتبط بهذا الإطار <span class="ltr-iso">(1–4)</span>:';
        controlsMount.innerHTML = "";
        var doneRec = false;
        var recStart = nowMs();
        var probedRoleSpec = roles[tr.probeRoleIdx];

        function drawProbedFrame(remRatio) {
          var ctx = stageObj.ctx;
          ctx.fillStyle = pal.surface;
          ctx.fillRect(0, 0, W, H);
          drawCountdownStripOnCanvas(ctx, W, remRatio, pal.accent);
          drawAsymmetricRoleFrame(ctx, cx, cy, halfBox, probedRoleSpec, { active: true });
          ctx.fillStyle = probedRoleSpec.stroke;
          ctx.font = "700 28px 'IBM Plex Sans Arabic', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("؟", cx, cy + 2);
        }

        function finishRecall(pickedOpt) {
          if (doneRec) return;
          doneRec = true;
          clearActiveRun();
          controlsMount.innerHTML = "";
          records.push({
            trialIndex: tr.trialIndex,
            soaMs: tr.soaMs,
            probeSerialPos: tr.probeSerialPos,
            chosenKind: pickedOpt ? pickedOpt.kind : null,
            recallRtMs: pickedOpt ? Math.round(nowMs() - recStart) : null,
            interruptRtMs: interruptRtMs,
            interruptCorrect: interruptCorrect
          });
          idx += 1;
          runFramePhase(tr.itiMs, {
            onComplete: function () { runSingleTrial(); }
          });
        }

        renderGlyphButtonsGrid(controlsMount, tr.options4, tr.formId, "glyph-choice-grid-4", function (opt) {
          finishRecall(opt);
        });

        bindKeys(function (ev) {
          var num = Number(Core.toAsciiDigits(ev.key || ""));
          if (num >= 1 && num <= 4) {
            ev.preventDefault();
            finishRecall(tr.options4[num - 1]);
          }
        });

        runFramePhase(tr.recallDeadlineMs, {
          onStart: function () {
            recStart = nowMs();
            drawProbedFrame(1);
          },
          onTick: function (wallElapsed) {
            drawProbedFrame(1 - wallElapsed / tr.recallDeadlineMs);
          },
          onComplete: function () { finishRecall(null); }
        });
      }
    }

    runSingleTrial();
  }

  /* ================= 8. PROBE 5: D5 STANDARD 5.0-MINUTE PVT-5 (300,000ms) ================= */

  function runD5() {
    var Core = getCore();
    var sched = Core.generateD5Schedule({ isFamiliarization: isFamiliarizationRun });
    var totalDurationMs = sched.totalDurationMs;
    var events = [];
    var minuteCursors = [0, 0, 0, 0, 0, 0];
    var accumulatedTaskMs = 0;
    var a = domArena();

    activeProbeGuard = {
      expId: "d5_pvt5",
      isPaused: false,
      droppedFrames: 0,
      criticalDropTrials: 0,
      visibilityInterruptions: 0,
      resumeFn: function () { launchPvtLoop(); }
    };

    function nextStratifiedIsi(elapsedMs) {
      var minIdx = Core.clamp(Math.floor(elapsedMs / 60000), 0, 5);
      var pool = sched.minutePools[minIdx];
      var cur = minuteCursors[minIdx] % pool.length;
      minuteCursors[minIdx] += 1;
      return pool[cur];
    }

    function finishPvt5() {
      clearActiveRun();
      var scored = Core.analyzeD5Pvt(events, totalDurationMs);
      var envSnap = Core.buildEnvironmentSnapshot(displayCalib.refreshHz, displayCalib.frameMs);
      Core.saveExperimentResult("d5_pvt5", Object.assign({
        isFamiliarization: isFamiliarizationRun,
        env: envSnap,
        refreshHz: displayCalib.refreshHz,
        frameMs: displayCalib.frameMs,
        droppedFrames: activeProbeGuard ? activeProbeGuard.droppedFrames : 0,
        visibilityInterruptions: activeProbeGuard ? activeProbeGuard.visibilityInterruptions : 0
      }, scored));

      var sumText = isFamiliarizationRun ? "" : Core.computeDeepVerdictSummary().verdicts[4];
      return showExperimentResult(
        "d5_pvt5",
        scored.meanReciprocalSpeed + " s⁻¹",
        [
          { label: "متوسط سرعة الاستجابة (Mean 1/RT)", val: scored.meanReciprocalSpeed + " s⁻¹ · وسيط " + scored.medianRtMs + " ms" },
          { label: "أسرع 10% / أبطأ 10%", val: scored.fastest10RtMs + " ms / " + scored.slowest10RtMs + " ms" },
          { label: "الهفوات (L_500 / L_355) والاستباق", val: scored.lapses500Pct + "% / " + scored.lapses355Pct + "% · FS=" + scored.falseStarts },
          { label: "تفكيك MAP Ex-Gaussian (μ · σ · τ)", val: scored.muMs + " · " + scored.sigmaMs + " · " + scored.tauMs + " ms" },
          { label: "ذيل الشرود: بطيء / سريع / د1–2", val: scored.slowIsiTauMs + " / " + scored.fastIsiTauMs + " / " + scored.earlySlowIsiTauMs + " ms" },
          { label: "ميل التدهور عبر الدقائق الخمس (β_ToT)", val: Core.fmtSigned(scored.betaToTRecipPerMin, " s⁻¹/min", 2) }
        ],
        sumText
      );
    }

    function launchPvtLoop() {
      clearActiveRun();
      var W = 400, H = 220;
      a.stage.innerHTML =
        '<div class="task-box deep-canvas-box">' +
        '<div class="stim-label">فور انطلاق عدّاد المللي ثانية اضغط Space أو انقر اللوحة مباشرة</div>' +
        '<div id="d5CanvasMount" class="deep-canvas-wrap"></div>' +
        '<div class="result-actions">' +
        '<button id="d5TapBtn" type="button" class="btn-primary pvt-tap-btn"><span>استجابة فورية (أو نقر اللوحة)</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button>' +
        '</div></div>';

      var stageObj = createStageCanvas(W, H, "pvt-canvas-stage");
      document.getElementById("d5CanvasMount").appendChild(stageObj.canvas);
      var tapBtn = document.getElementById("d5TapBtn");

      var myToken = activeRunToken;
      var fMs = displayCalib.frameMs || 16.67;
      var prevNow = null;

      // State machine: "isi" | "counting" | "feedback"
      var stateMode = "isi";
      var currentIsiMs = nextStratifiedIsi(accumulatedTaskMs);
      var phaseElapsedMs = 0;
      var stimOnsetNow = 0;
      var feedbackText = "";
      var feedbackColor = "#38bdf8";

      function drawPvtCanvas(liveRtMs) {
        var ctx = stageObj.ctx;
        // High-contrast dark background (#181b22) per standard PVT-5 specification
        ctx.fillStyle = "#181b22";
        ctx.fillRect(0, 0, W, H);

        // Subtle top progress bar across 5.0 minutes
        var progRatio = Math.min(1, accumulatedTaskMs / totalDurationMs);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(18, 12, W - 36, 4);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(18, 12, (W - 36) * progRatio, 4);

        // High-contrast central white frame
        var bx = W / 2 - 118, by = H / 2 - 44, bw = 236, bh = 88;
        ctx.strokeStyle = stateMode === "counting" ? "#ff4d4f" : "#e2e8f0";
        ctx.lineWidth = stateMode === "counting" ? 3.0 : 2.2;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (stateMode === "counting") {
          var padded = String(Math.min(9999, Math.max(0, Math.round(liveRtMs)))).padStart(4, "0");
          ctx.fillStyle = "#ff4d4f";
          ctx.font = "700 42px 'JetBrains Mono', monospace";
          ctx.fillText(padded, W / 2, H / 2 + 2);
        } else if (stateMode === "feedback") {
          ctx.fillStyle = feedbackColor;
          ctx.font = "700 22px 'JetBrains Mono', 'IBM Plex Sans Arabic', sans-serif";
          ctx.fillText(feedbackText, W / 2, H / 2 + 2);
        } else {
          ctx.fillStyle = "rgba(226, 232, 240, 0.35)";
          ctx.beginPath();
          ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function handleUserTrigger() {
        if (myToken !== activeRunToken) return;
        var tNow = nowMs();

        if (stateMode === "isi") {
          events.push({
            isFalseStart: true,
            rtMs: 0,
            isiMs: currentIsiMs,
            elapsedMs: accumulatedTaskMs
          });
          stateMode = "feedback";
          phaseElapsedMs = 0;
          feedbackText = "استباق مبكر!";
          feedbackColor = "#f59e0b";
          return;
        }

        if (stateMode === "counting") {
          var rt = Math.round(tNow - stimOnsetNow);
          if (rt < sched.falseStartThresholdMs) {
            events.push({
              isFalseStart: true,
              rtMs: rt,
              isiMs: currentIsiMs,
              elapsedMs: accumulatedTaskMs
            });
            stateMode = "feedback";
            phaseElapsedMs = 0;
            feedbackText = "استباق (<100 ms)";
            feedbackColor = "#f59e0b";
          } else {
            events.push({
              isFalseStart: false,
              timedOut: false,
              rtMs: rt,
              isiMs: currentIsiMs,
              elapsedMs: accumulatedTaskMs
            });
            stateMode = "feedback";
            phaseElapsedMs = 0;
            feedbackText = rt + " ms";
            feedbackColor = rt >= 500 ? "#f87171" : (rt >= 355 ? "#fbbf24" : "#34d399");
          }
        }
      }

      var onPointerTrigger = function (ev) {
        ev.preventDefault();
        handleUserTrigger();
      };
      stageObj.canvas.addEventListener("pointerdown", onPointerTrigger);
      tapBtn.addEventListener("pointerdown", onPointerTrigger);
      addPointerCleanup(function () {
        stageObj.canvas.removeEventListener("pointerdown", onPointerTrigger);
        tapBtn.removeEventListener("pointerdown", onPointerTrigger);
      });

      bindKeys(function (ev) {
        if (ev.key === " " || ev.code === "Space" || ev.key === "Enter" || isRightChoiceKey(ev)) {
          ev.preventDefault();
          handleUserTrigger();
        }
      });

      var lastHeaderMin = -1;

      function pvtFrameTick() {
        if (myToken !== activeRunToken) return;
        if (typeof document !== "undefined" && document.hidden && activeProbeGuard) {
          handleVisibilityInterruption();
          return;
        }

        var tNow = nowMs();
        if (prevNow === null) {
          prevNow = tNow;
          drawPvtCanvas(0);
          activeRafId = requestAnimationFrame(pvtFrameTick);
          return;
        }

        var dt = tNow - prevNow;
        prevNow = tNow;

        if (dt > Math.max(28, 1.8 * fMs) && activeProbeGuard) {
          activeProbeGuard.droppedFrames += 1;
        }

        accumulatedTaskMs += dt;
        phaseElapsedMs += dt;

        var curMinDisplay = Math.min(5, Math.floor(accumulatedTaskMs / 60000) + 1);
        if (curMinDisplay !== lastHeaderMin) {
          lastHeaderMin = curMinDisplay;
          setHeader(
            isFamiliarizationRun ? "D5 — تهيئة التيقظ" : "D5 — اليقظة المستدامة",
            isFamiliarizationRun ? "تهيئة 24s" : "الدقيقة " + curMinDisplay + " / 5"
          );
        }

        if (stateMode === "isi") {
          if (accumulatedTaskMs >= totalDurationMs) {
            finishPvt5();
            return;
          }
          // Only launch a new counter if at least 950ms remain in the 300,000ms window
          var remWindow = totalDurationMs - accumulatedTaskMs;
          if (phaseElapsedMs >= currentIsiMs && remWindow >= 950) {
            stateMode = "counting";
            phaseElapsedMs = 0;
            stimOnsetNow = tNow;
          }
          drawPvtCanvas(0);
        } else if (stateMode === "counting") {
          var liveRt = tNow - stimOnsetNow;
          if (liveRt >= sched.lapseTimeoutMs) {
            events.push({
              isFalseStart: false,
              timedOut: true,
              rtMs: 10000,
              isiMs: currentIsiMs,
              elapsedMs: accumulatedTaskMs
            });
            stateMode = "feedback";
            phaseElapsedMs = 0;
            feedbackText = "تجاوز المهلة (10,000 ms)";
            feedbackColor = "#f87171";
            drawPvtCanvas(10000);
          } else {
            drawPvtCanvas(liveRt);
          }
        } else if (stateMode === "feedback") {
          drawPvtCanvas(0);
          if (phaseElapsedMs >= sched.feedbackMs) {
            if (accumulatedTaskMs >= totalDurationMs) {
              finishPvt5();
              return;
            }
            stateMode = "isi";
            phaseElapsedMs = 0;
            currentIsiMs = nextStratifiedIsi(accumulatedTaskMs);
          }
        }

        activeRafId = requestAnimationFrame(pvtFrameTick);
      }

      activeRafId = requestAnimationFrame(pvtFrameTick);
    }

    launchPvtLoop();
  }

  /* ================= 9. CLIPBOARD & DASHBOARD PANEL RENDERER ================= */

  function copyTextWithFallback(text, onSuccess, onFail) {
    var Core = getCore();
    var clean = Core ? Core.toAsciiDigits(text) : String(text || "");

    function fallbackExecCopy() {
      var area = document.createElement("textarea");
      area.value = clean;
      area.setAttribute("readonly", "readonly");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) {
          if (onSuccess) onSuccess();
        } else if (onFail) {
          onFail();
        }
      } catch (_) {
        document.body.removeChild(area);
        if (onFail) onFail();
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        navigator.clipboard.writeText(clean).then(function () {
          if (onSuccess) onSuccess();
        }).catch(function () {
          fallbackExecCopy();
        });
        return;
      } catch (_) {}
    }
    fallbackExecCopy();
  }

  function getAvailablePhases() {
    var S = getStimuli();
    if (S && Array.isArray(S.PHASES) && S.PHASES.length > 0) return S.PHASES;
    return [
      { id: "baseline", label: "خط الأساس القاعدي (قبل التدخل)" },
      { id: "sleep_inertia", label: "فحص جمود الاستيقاظ الصباحي (+15د)" },
      { id: "post_washout", label: "ما بعد الغسيل الدوائي العارض (6–8 أسابيع)" },
      { id: "metabolic", label: "الدعم الاستقلابي والكرياتين والتأهيل العضلي" },
      { id: "med_early", label: "العلاج الدوائي الجبهي المبكر (أسبوع 1–4)" },
      { id: "med_stable", label: "استقرار العلاج الدوائي الجبهي (أسبوع 6–12+)" },
      { id: "post_airway", label: "ما بعد إصلاح مجرى التنفس واسترداد النوم العميق" }
    ];
  }

  function getActivePhaseId() {
    var mainSel = typeof document !== "undefined" ? document.getElementById("phaseSelect") : null;
    if (mainSel && mainSel.value) return mainSel.value;
    var A = getAnalytics();
    if (A && typeof A.getContext === "function") {
      try {
        var c = A.getContext();
        if (c && c.phase) return c.phase;
      } catch (_) {}
    }
    return "baseline";
  }

  function syncPhaseAcrossApp(nextPhaseId) {
    var A = getAnalytics();
    if (A && typeof A.updateContext === "function") {
      try { A.updateContext({ phase: nextPhaseId }); } catch (_) {}
    }
    var mainSel = typeof document !== "undefined" ? document.getElementById("phaseSelect") : null;
    if (mainSel && mainSel.value !== nextPhaseId) {
      mainSel.value = nextPhaseId;
      try { mainSel.dispatchEvent(new Event("change")); } catch (_) {}
    }
  }

  function render() {
    var Core = getCore();
    if (!Core) return;
    var target = mountEl || (typeof document !== "undefined" ? document.getElementById("deepMount") : null);
    if (!target) return;
    mountEl = target;

    if (resetArmed && nowMs() - resetArmedAtMs > 4000) {
      resetArmed = false;
    }

    var st = Core.loadState();
    var summary = Core.computeDeepVerdictSummary(st);
    var res = st.results || {};

    var d1 = res.d1_tbrs;
    var d2 = res.d2_refback_m3;
    var d3 = res.d3_bays_analog;
    var d4 = res.d4_consolidation_soa;
    var d5 = res.d5_pvt5;

    var kpi1Val = d1 ? d1.pTargetHighPct + "% (Δ=" + d1.deltaTbrs + ")" : "—";
    var kpi2Val = d2 ? d2.pTargetPct + "% (Swap " + d2.pSwapCorrPct + "%)" : "—";
    var kpi3Val = d3 ? "K=" + d3.K + " (Δγ " + Core.fmtSigned(d3.deltaGammaDelayPct, "%") + ")" : "—";
    var kpi4Val = d4 ? Core.formatD4Soa75(d4, false) : (d5 ? d5.meanReciprocalSpeed + " s⁻¹" : "—");
    if (d4 && d5) {
      kpi4Val = Core.formatD4Soa75(d4, true) + " · " + d5.meanReciprocalSpeed + "s⁻¹";
    }

    var phases = getAvailablePhases();
    var curPhase = getActivePhaseId();
    var phaseOptsHtml = phases.map(function (p) {
      var pid = String(p.id || p.key || "baseline");
      var plbl = p.label || p.labelAr || pid;
      return '<option value="' + esc(pid) + '"' + (pid === curPhase ? " selected" : "") + ">" + esc(plbl) + "</option>";
    }).join("");

    var formBtnsHtml = Core.FORM_IDS.map(function (fid) {
      var activeCls = st.activeForm === fid ? " is-active" : "";
      return '<button type="button" class="filter-pill btn-deep-form' + activeCls + '" data-form-id="' + fid + '">Form ' + fid + "</button>";
    }).join("");

    var envAlertsHtml = "";
    if (summary.envAlerts && summary.envAlerts.length > 0) {
      envAlertsHtml =
        '<div class="env-alert-banner" role="alert">' +
        summary.envAlerts.map(function (al, idx) {
          return "<div>" + formatDeepRichHtml((idx + 1) + ". " + al) + "</div>";
        }).join("") +
        "</div>";
    }

    var diffSigHtml = "";
    if (summary.differentialSignatures && summary.differentialSignatures.length > 0) {
      diffSigHtml =
        '<section class="card verdict-box">' +
        '<h3 class="section-title" style="margin-bottom:4px;">مصفوفة البصمات التفريقية الأربع من الأرقام المقاسة</h3>' +
        '<ol class="verdict-list">' +
        summary.differentialSignatures.map(function (sig) {
          return "<li><strong>" + formatDeepRichHtml(sig.title) + ":</strong> " + formatDeepRichHtml(sig.body) + "</li>";
        }).join("") +
        "</ol></section>";
    }

    var rciHtml = "";
    if (summary.rciItems && summary.rciItems.length > 0) {
      rciHtml =
        '<section class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<div>' +
        '<h3 class="section-title">معيار التغير الموثوق الطولي (<span class="ltr-iso">RCI 90% = ±1.64 × SE_diff</span> · للمقاييس ذات <span class="ltr-iso">ICC ≥ 0.75</span>)</h3>' +
        '<p class="section-sub">تُستبعد الفروق الطرحية ذات الموثوقية الصفرية وتُقارن القيم المطلقة بمرجع <span class="ltr-iso">T0</span></p>' +
        '</div>' +
        '<button id="btnReanchorT0" type="button" class="btn-ghost">تثبيت الحالي كمرجع T0 جديد</button>' +
        '</div>' +
        '<ol class="verdict-list">' +
        summary.rciItems.map(function (it, idx) {
          var dec = it.unit === " s⁻¹" || it.unit === "" ? 2 : 1;
          var shortT0 = Core.getPhaseShortAr ? Core.getPhaseShortAr(it.phaseT0 || "baseline") : (it.phaseT0Label || "خط الأساس");
          var shortT1 = it.hasFollowup
            ? (Core.getPhaseShortAr ? Core.getPhaseShortAr(it.phaseT1 || "baseline") : (it.phaseT1Label || "الحالي"))
            : null;
          var ctxBadgeHtml = it.hasFollowup && shortT1
            ? '<span class="verdict-tag is-context">' + formatDeepRichHtml(shortT0 + " · Form " + (it.formT0 || "A") + " ← " + shortT1 + " · Form " + (it.formT1 || "A")) + "</span> "
            : '<span class="verdict-tag is-context">' + formatDeepRichHtml(shortT0 + " · Form " + (it.formT0 || "A")) + "</span> ";
          var line = it.hasFollowup
            ? "مرجع T0: " + it.valT0 + it.unit + " ← الحالي: " + it.valT1 + it.unit +
              " (Δ=" + Core.fmtSigned(it.delta, it.unit, dec) + " · z=" + Core.fmtSigned(it.zRci, "", 2) +
              " · عتبة RCI 90%: ±" + it.rci90Threshold + it.unit + ") — " + it.statusAr
            : "قيمة T0: " + it.valT0 + it.unit + " · ICC=" + it.icc + " · SEM=" + it.sem + it.unit + " · " + it.statusAr;
          return "<li><strong>" + formatDeepRichHtml((idx + 1) + ". " + it.labelAr) + ":</strong> " + ctxBadgeHtml + formatDeepRichHtml(line) + "</li>";
        }).join("") +
        "</ol></section>";
    }

    var vListHtml = summary.verdicts.map(function (v) {
      return "<li>" + formatDeepRichHtml(v) + "</li>";
    }).join("");

    var cardsHtml = Core.EXPERIMENTS.map(function (exp) {
      var r = res[exp.id];
      var shortCode = exp.shortCode || String(exp.code || "").split("·")[0].trim();
      var statusHtml = '<span class="probe-status-pill">' + formatDeepStepHtml(exp.metaChip || ("~" + exp.durationMin + " د")) + "</span>";
      if (r) {
        var mBadge = "";
        if (exp.id === "d1_tbrs") mBadge = "High-CL: " + r.pTargetHighPct + "% · Δ=" + r.deltaTbrs;
        else if (exp.id === "d2_refback_m3") mBadge = "P_target: " + r.pTargetPct + "% · Swap: " + r.pSwapCorrPct + "%";
        else if (exp.id === "d3_bays_analog") mBadge = "K=" + r.K + " · β=" + r.betaPct + "% · σ=" + r.sigmaDeg + "°";
        else if (exp.id === "d4_consolidation_soa") mBadge = "SOA_75=" + Core.formatD4Soa75(r, true) + " · AUC=" + r.aucConsPct + "%";
        else if (exp.id === "d5_pvt5") mBadge = "1/RT=" + r.meanReciprocalSpeed + "s⁻¹ · τ=" + r.tauMs + "ms";
        statusHtml = '<span class="probe-status-pill is-done"><span class="ltr-iso">' + esc(mBadge) + "</span></span>";
      }
      return (
        '<article class="probe-card">' +
        '<div class="probe-badges">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
        '<span class="probe-code ltr-iso">' + esc(shortCode) + "</span>" +
        (exp.domainTag ? '<span class="probe-role-tag">' + formatDeepRichHtml(exp.domainTag) + "</span>" : "") +
        "</div>" +
        statusHtml +
        "</div>" +
        '<h3 class="card-title">' + formatDeepRichHtml(exp.title) + "</h3>" +
        '<p class="card-subtitle">' + formatDeepRichHtml(exp.targetQuestion) + "</p>" +
        '<button type="button" class="btn-start-probe btn-run-deep-one" data-d-id="' + esc(exp.id) + '">' +
        (r ? "إعادة تشغيل هذا المسبار" : "بدء هذا المسبار منفردا") +
        "</button>" +
        "</article>"
      );
    }).join("");

    var deepHistHtml = "";
    if (Array.isArray(st.history) && st.history.length > 0) {
      var histItemsHtml = st.history.slice(0, 25).map(function (rec, hIdx) {
        var meta = findMeta(rec.expId);
        var orderNum = st.history.length - hIdx;
        var phLabel = Core.getPhaseLabelAr(rec.phase || "baseline");
        var dObj = rec.timestamp ? new Date(rec.timestamp) : null;
        var tsStr = dObj && !Number.isNaN(dObj.getTime())
          ? dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, "0") + "-" + String(dObj.getDate()).padStart(2, "0") +
            " " + String(dObj.getHours()).padStart(2, "0") + ":" + String(dObj.getMinutes()).padStart(2, "0")
          : (rec.env && rec.env.localTimeHHMM ? rec.env.localTimeHHMM : "");
        var hzTag = rec.env && rec.env.refreshHz ? rec.env.refreshHz + "Hz" : (rec.refreshHz ? rec.refreshHz + "Hz" : "60Hz");
        var metricTxt = "";
        if (rec.expId === "d1_tbrs") metricTxt = "High-CL " + rec.pTargetHighPct + "% · Δ=" + rec.deltaTbrs;
        else if (rec.expId === "d2_refback_m3") metricTxt = "P_target " + rec.pTargetPct + "% · Swap " + rec.pSwapCorrPct + "% · Stale " + rec.pStaleCorrPct + "%";
        else if (rec.expId === "d3_bays_analog") metricTxt = "K=" + rec.K + " · β_0.9s=" + rec.betaShortPct + "% · Δγ=" + Core.fmtSigned(rec.deltaGammaDelayPct, "%");
        else if (rec.expId === "d4_consolidation_soa") metricTxt = "SOA_75=" + Core.formatD4Soa75(rec, true) + " · AUC=" + rec.aucConsPct + "%";
        else if (rec.expId === "d5_pvt5") metricTxt = "1/RT=" + rec.meanReciprocalSpeed + "s⁻¹ · τ=" + rec.tauMs + "ms · β_ToT=" + Core.fmtSigned(rec.betaToTRecipPerMin, "", 2);

        return (
          '<li class="history-item">' +
          '<div class="history-item-body">' +
          '<div class="history-item-head">' +
          '<div class="probe-metrics-row">' +
          '<span class="probe-code">#' + esc(orderNum) + '</span>' +
          '<strong>' + esc((meta.shortCode || meta.code) + " — " + meta.shortTitle) + '</strong>' +
          '<span class="metric-pill">' + esc(phLabel) + '</span>' +
          '<span class="metric-pill ltr-iso">Form ' + esc(rec.formId || "A") + '</span>' +
          '</div>' +
          '<strong class="ltr-iso">' + esc(metricTxt) + '</strong>' +
          '</div>' +
          '<div class="summary-sub">التوقيت: <span class="ltr-iso">' + esc(tsStr) + " · " + esc(hzTag) +
          (rec.env && rec.env.browserOs ? " · " + esc(rec.env.browserOs) : "") + '</span></div>' +
          '</div></li>'
        );
      }).join("");

      deepHistHtml =
        '<section class="card">' +
        '<h3 class="section-title" style="margin-bottom:8px;">السجل الزمني الطولي للنسخة الثالثة (مرتبط بالمراحل ونماذج الرموز)</h3>' +
        '<ol class="history-list">' + histItemsHtml + '</ol>' +
        '</section>';
    }

    var famStatusHtml = st.familiarization && st.familiarization.completed
      ? 'التهيئة: مكتملة (<span class="ltr-iso">' + esc(st.familiarization.runsCount) + "</span>)"
      : 'التهيئة: مستحسنة قبل <span class="ltr-iso">T0</span>';

    var hzHtml = displayCalib.calibrated
      ? '<span class="ltr-iso">' + esc(displayCalib.refreshHz + "Hz (" + displayCalib.frameMs + "ms)") + "</span>"
      : '<span class="ltr-iso">60Hz</span> افتراضي';

    target.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
      '<section class="card">' +
      '<div>' +
      '<h2 class="section-title">النسخة الثالثة المرقّاة: البطارية السيكوفيزيائية المقاومة للتكتيل (~16 د)</h2>' +
      '<p class="section-sub">مقفلة على إطارات الشاشة مع عشوائية مشفرة وتدوير نماذج الرموز المتعامدة (<span class="ltr-iso">Form A/B/C</span>) لإغلاق مسارات التكتيل واستخراج البصمات التفريقية ومؤشرات <span class="ltr-iso">RCI 90%</span>.</p>' +
      "</div>" +
      '<div class="deep-calib-bar" style="margin-top:0;">' +
      '<div class="deep-calib-item">' +
      '<label for="deepPhaseSelect" class="stim-label">مرحلة التتبع:</label>' +
      '<select id="deepPhaseSelect" class="phase-select">' + phaseOptsHtml + '</select>' +
      '</div>' +
      '<div class="deep-calib-item">' +
      '<label for="deepConditionSelect" class="stim-label">حالة اليوم:</label>' +
      '<select id="deepConditionSelect" class="phase-select js-day-condition-select"></select>' +
      '</div>' +
      '<div class="deep-calib-item">' +
      '<span class="stim-label">نموذج الرموز:</span>' +
      '<div class="form-pill-group">' + formBtnsHtml + '</div>' +
      '</div>' +
      '<div class="deep-calib-item">' +
      '<span class="stim-label">' + hzHtml + " · " + famStatusHtml + '</span>' +
      '<button id="btnRecalibHz" type="button" class="btn-ghost" style="min-height:34px;padding:4px 11px;font-size:0.8rem;">معايرة التردد</button>' +
      '</div>' +
      '</div>' +
      envAlertsHtml +
      '<div class="suite-toolbar">' +
      '<div class="suite-primary-actions">' +
      '<button id="btnRunFullDeep" type="button" class="btn-primary">بدء البطارية العميقة المعتمدة — 5 مسابير (~16 د)</button>' +
      '<button id="btnRunFamiliarization" type="button" class="btn-ghost">جولة تهيئة تمهيدية (~2 د · مستبعدة)</button>' +
      "</div>" +
      '<div class="suite-util-actions">' +
      '<button id="btnSyncDeepRepo" type="button" class="btn-repo-save" data-repo-save-btn>حفظ النتائج في الريبو</button>' +
      '<button id="btnCopyDeepReport" type="button" class="btn-ghost">نسخ التقرير</button>' +
      '<button id="btnExportDeepJson" type="button" class="btn-ghost">تصدير JSON</button>' +
      '<button id="btnImportDeepJson" type="button" class="btn-ghost">استيراد JSON</button>' +
      '<input id="inputImportDeepJson" type="file" accept=".json,application/json" hidden />' +
      '<button id="btnResetDeep" type="button" class="btn-danger">' + (resetArmed ? "اضغط ثانية لتأكيد المسح" : "مسح السجل") + "</button>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<div class="hero-summary-grid">' +
      '<article class="summary-card"><h3 class="summary-label">' + formatDeepRichHtml("1. صمود الربط تحت الحمل (D1 · TBRS)") + '</h3><div class="summary-value ltr-iso">' + esc(kpi1Val) + '</div><div class="summary-sub">نافذة ثابتة <span class="ltr-iso">4,000ms</span> (<span class="ltr-iso">4</span> أحكام مقابل حكمين)</div></article>' +
      '<article class="summary-card"><h3 class="summary-label">' + formatDeepRichHtml("2. التحديث السريع وتفكيك البوابة (D2 · M3)") + '</h3><div class="summary-value ltr-iso">' + esc(kpi2Val) + '</div><div class="summary-sub">طفرات <span class="ltr-iso">500ms</span> + بوابة تحديث/مقارنة وستة بدائل</div></article>' +
      '<article class="summary-card"><h3 class="summary-label">' + formatDeepRichHtml("3. سعة خليط Bays المقنّع (D3)") + '</h3><div class="summary-value ltr-iso">' + esc(kpi3Val) + '</div><div class="summary-sub">عرض <span class="ltr-iso">600ms</span> وتوطيد <span class="ltr-iso">200ms</span> لـ <span class="ltr-iso">4</span> عناصر (<span class="ltr-iso">0.9s</span> / <span class="ltr-iso">3.8s</span>)</div></article>' +
      '<article class="summary-card"><h3 class="summary-label">' + formatDeepRichHtml("4. التوطيد واليقظة الممتدة (D4 · D5)") + '</h3><div class="summary-value ltr-iso">' + esc(kpi4Val) + '</div><div class="summary-sub">عتبة التدفق <span class="ltr-iso">SOA_75</span> وسرعة <span class="ltr-iso">PVT-5</span> التبادلية</div></article>' +
      "</div>" +
      '<div class="deep-probes-grid">' + cardsHtml + "</div>" +
      diffSigHtml +
      rciHtml +
      '<section class="card verdict-box">' +
      '<h3 class="section-title" style="margin-bottom:4px;">' + formatDeepRichHtml(summary.overallHeadline) + "</h3>" +
      '<ol class="verdict-list">' + vListHtml + "</ol>" +
      "</section>" +
      '<div id="deepCrossDayMount"></div>' +
      deepHistHtml +
      "</div>";

    var phaseSel = document.getElementById("deepPhaseSelect");
    if (phaseSel) {
      phaseSel.addEventListener("change", function () {
        syncPhaseAcrossApp(phaseSel.value);
        render();
      });
    }

    var formBtns = target.querySelectorAll(".btn-deep-form");
    for (var fb = 0; fb < formBtns.length; fb += 1) {
      formBtns[fb].addEventListener("click", function (ev) {
        var nextF = ev.currentTarget.getAttribute("data-form-id");
        Core.setActiveForm(nextF);
        render();
        showBannerToast("تم تفعيل مجموعة الرموز المتعامدة Form " + nextF + ".");
      });
    }

    var recalBtn = document.getElementById("btnRecalibHz");
    if (recalBtn) {
      recalBtn.addEventListener("click", function () {
        recalBtn.disabled = true;
        recalBtn.textContent = "جارٍ القياس...";
        calibrateDisplayRefresh(true, function (cal) {
          render();
          showBannerToast("تمت معايرة الشاشة: " + cal.refreshHz + "Hz (" + cal.frameMs + " ms/frame).");
        });
      });
    }

    var reanchorBtn = document.getElementById("btnReanchorT0");
    if (reanchorBtn) {
      reanchorBtn.addEventListener("click", function () {
        Core.reanchorBaselineToCurrent();
        render();
        showBannerToast("تم تثبيت النتائج الحالية كمرجع خط أساس T0 جديد لمقارنات RCI 90%.");
      });
    }

    var famBtn = document.getElementById("btnRunFamiliarization");
    if (famBtn) famBtn.addEventListener("click", startFamiliarizationPass);

    var fullBtn = document.getElementById("btnRunFullDeep");
    if (fullBtn) fullBtn.addEventListener("click", startFullBattery);

    var copyBtn = document.getElementById("btnCopyDeepReport");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyTextWithFallback(
          summary.plainTextReport,
          function () {
            showBannerToast("تم نسخ التقرير التفريقي العميق إلى الحافظة.");
          },
          function () {
            showBannerToast("تعذر النسخ التلقائي إلى الحافظة.");
          }
        );
      });
    }

    var expBtn = document.getElementById("btnExportDeepJson");
    if (expBtn) {
      expBtn.addEventListener("click", function () {
        var jsonStr = Core.exportStateJSON();
        var blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "neuro-lab-deep-v3.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showBannerToast("تم تصدير سجل النسخة الثالثة بصيغة JSON.");
      });
    }

    var impBtn = document.getElementById("btnImportDeepJson");
    var impInput = document.getElementById("inputImportDeepJson");
    if (impBtn && impInput) {
      impBtn.addEventListener("click", function () {
        impInput.click();
      });
      impInput.addEventListener("change", function () {
        var file = impInput.files && impInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var out = Core.importStateJSON(String(reader.result || ""));
          impInput.value = "";
          if (out && out.ok) {
            render();
            showBannerToast("تم استيراد سجل النسخة الثالثة (" + out.count + " مسابير).");
          } else {
            showBannerToast((out && out.error) || "تعذر استيراد ملف النسخة الثالثة.");
          }
        };
        reader.readAsText(file, "utf-8");
      });
    }

    var resetBtn = document.getElementById("btnResetDeep");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!resetArmed || nowMs() - resetArmedAtMs > 4000) {
          resetArmed = true;
          resetArmedAtMs = nowMs();
          resetBtn.textContent = "اضغط ثانية لتأكيد المسح";
          scheduleUiDelay(4050, function () {
            if (resetArmed && nowMs() - resetArmedAtMs >= 4000) {
              resetArmed = false;
              render();
            }
          });
          return;
        }
        resetArmed = false;
        Core.clearState();
        render();
        showBannerToast("تم مسح سجل النسخة الثالثة.");
      });
    }

    var oneBtns = target.querySelectorAll(".btn-run-deep-one");
    for (var i = 0; i < oneBtns.length; i += 1) {
      oneBtns[i].addEventListener("click", function (ev) {
        startExperiment(ev.currentTarget.getAttribute("data-d-id"));
      });
    }

    if (root.NeuroLab && root.NeuroLab.RepoSync && typeof root.NeuroLab.RepoSync.refreshUi === "function") {
      try { root.NeuroLab.RepoSync.refreshUi(); } catch (_) {}
    }
  }

  function init(opts) {
    if (opts && opts.mountEl) mountEl = opts.mountEl;
    ensureVisibilityListener();
    render();
    // Background non-blocking VSync calibration once visible
    if (typeof document !== "undefined" && !document.hidden) {
      calibrateDisplayRefresh(false, function () {
        if (!activeProbeGuard) render();
      });
    }
  }

  root.NeuroLab.Deep = {
    init: init,
    render: render,
    calibrateDisplayRefresh: calibrateDisplayRefresh,
    getDisplayCalibration: function () { return Object.assign({}, displayCalib); },
    startFamiliarizationPass: startFamiliarizationPass,
    startFullBattery: startFullBattery,
    startExperiment: startExperiment,
    abort: abort,
    getState: function () { return getCore().loadState(); },
    computeDeepVerdictSummary: function () { return getCore().computeDeepVerdictSummary(); }
  };
})();

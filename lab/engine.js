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
  var runToken = 0;

  var sessionState = {
    isBattery: false,
    batteryRunId: null,
    batteryQueue: [],
    batteryIndex: 0,
    batteryScores: {},
    currentProbeId: null,
    contextSnapshot: null
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

  function scheduleTimer(fn, ms) {
    var token = runToken;
    var id = setTimeout(function () {
      if (token !== runToken) return;
      fn();
    }, ms);
    activeTimers.push(id);
    return id;
  }

  function bindKeyHandler(handler) {
    unbindKeyHandler();
    if (typeof window === "undefined") return;
    activeKeyHandler = function (ev) {
      if (!domRefs.overlay || domRefs.overlay.hidden) return;
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

  function cleanupActive() {
    runToken += 1;
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
    if (domRefs.overlay) {
      domRefs.overlay.hidden = false;
    }
  }

  function closeOverlay() {
    cleanupActive();
    resolveDom();
    if (domRefs.overlay) {
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

  function stdDev(nums) {
    if (!nums || nums.length < 2) return 0;
    var m = 0;
    for (var i = 0; i < nums.length; i += 1) m += nums[i];
    m = m / nums.length;
    var sq = 0;
    for (var k = 0; k < nums.length; k += 1) {
      var d = nums[k] - m;
      sq += d * d;
    }
    return Math.sqrt(sq / nums.length);
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
    if (sessionState.isBattery) {
      return "M" + (sessionState.batteryIndex + 1) + "/6 · " + trialText;
    }
    return trialText;
  }

  function launchProbeIntro(probeId) {
    cleanupActive();
    sessionState.currentProbeId = probeId;
    var meta = findProbeMeta(probeId);
    setHeader(
      meta.code + " — " + meta.title,
      sessionState.isBattery ? "Battery " + (sessionState.batteryIndex + 1) + "/6" : "Ready"
    );

    var stepsHtml = "";
    var steps = Array.isArray(meta.instructions) ? meta.instructions : [];
    for (var i = 0; i < steps.length; i += 1) {
      stepsHtml += "<li>" + esc(steps[i]) + "</li>";
    }

    domRefs.stage.innerHTML =
      '<div class="probe-intro">' +
      '<div class="probe-region-badge">' +
      esc(meta.region) +
      "</div>" +
      '<h2 class="probe-title" style="font-size:1.3rem;margin:0;">' +
      esc(meta.title) +
      "</h2>" +
      '<p class="probe-deficit" style="margin:0;">العطل المستهدف: <strong>' +
      esc(meta.deficitName || meta.deficit || "") +
      "</strong></p>" +
      '<ol class="probe-steps">' +
      stepsHtml +
      "</ol>" +
      (meta.example ? '<div class="probe-example-box">' + esc(meta.example) + "</div>" : "") +
      '<div class="result-actions">' +
      '<button id="btnStartProbeNow" type="button" class="btn-primary">ابدأ القياس الآن (Enter)</button>' +
      "</div>" +
      "</div>";

    var startBtn = document.getElementById("btnStartProbeNow");
    var triggerStart = function () {
      cleanupActive();
      dispatchProbeRunner(probeId);
    };
    if (startBtn) startBtn.addEventListener("click", triggerStart);
    bindKeyHandler(function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        triggerStart();
      }
    });
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
     PROBE 1: ISOLATION (Storage under Processing Load)
     ========================================================================= */
  function runIsolationProbe() {
    var S = getStimuli();
    var trials = S.generateIsolationTrials(4);
    var meta = findProbeMeta("isolation");
    var results = [];
    var idx = 0;

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishIsolation(results);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      // Fixation 550ms
      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">استعد لحفظ 4 كلمات بترتيبها</div>' +
        '<div class="stim-num">+</div>' +
        "</div>";

      scheduleTimer(function () {
        presentWord(0);
      }, 550);

      function presentWord(wIdx) {
        if (wIdx >= tr.words.length) {
          return showProcessingTask();
        }
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">الكلمة <span class="ltr-iso">' +
          (wIdx + 1) +
          " / " +
          tr.words.length +
          "</span></div>" +
          '<div class="stim-word">' +
          esc(tr.words[wIdx]) +
          "</div>" +
          renderDots(tr.words.length, wIdx) +
          "</div>";

        scheduleTimer(function () {
          domRefs.stage.innerHTML = '<div class="stimulus-card"></div>';
          scheduleTimer(function () {
            presentWord(wIdx + 1);
          }, 160);
        }, 920);
      }

      function showProcessingTask() {
        var t0 = performance.now();
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
          '<div class="stim-label">' +
          (tr.taskType === "math" ? "معالجة حسابية فورية" : "معالجة منطقية علائقية فورية") +
          "</div>" +
          '<p class="task-question">' +
          esc(tr.taskPrompt) +
          "</p>" +
          '<div class="options-grid">' +
          optsHtml +
          "</div>" +
          "</div>";

        var chooseTaskOpt = function (chosenVal) {
          unbindKeyHandler();
          var taskRtMs = Math.round(performance.now() - t0);
          var taskCorrect = String(chosenVal) === String(tr.taskAnswer);
          showSerialRecall(taskCorrect, taskRtMs);
        };

        var optBtns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < optBtns.length; b += 1) {
          optBtns[b].addEventListener("click", function (ev) {
            var i = Number(ev.currentTarget.getAttribute("data-opt-idx"));
            chooseTaskOpt(tr.taskOptions[i]);
          });
        }

        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.taskOptions.length) {
            ev.preventDefault();
            chooseTaskOpt(tr.taskOptions[n - 1]);
          }
        });
      }

      function showSerialRecall(taskCorrect, taskRtMs) {
        var chosenWords = [];

        function renderRecallUI() {
          var slotsHtml = "";
          for (var s = 0; s < 4; s += 1) {
            var entry = chosenWords[s];
            if (!entry) {
              var activeCls = s === chosenWords.length ? "slot-pill is-active" : "slot-pill";
              slotsHtml += '<div class="' + activeCls + '">خانة <span class="ltr-iso">' + (s + 1) + "</span></div>";
            } else if (entry === "__FORGOT__") {
              slotsHtml += '<div class="slot-pill is-forgotten">تبخرت ؟</div>';
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
            '<p class="task-question">انقر الكلمات الأربع بترتيب ظهورها الأصلي من الخانة 1 إلى 4:</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid">' +
            keysHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotSlot" type="button" class="btn-forgot">تبخر العنصر ؟</button>' +
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
            var hits = 0;
            for (var c = 0; c < 4; c += 1) {
              if (chosenWords[c] === tr.words[c]) {
                slotHits[c] = 1;
                hits += 1;
              }
            }
            results.push({
              taskType: tr.taskType,
              taskCorrect: taskCorrect,
              taskRtMs: taskRtMs,
              hits: hits,
              slotHits: slotHits
            });
            idx += 1;
            scheduleTimer(nextTrial, 220);
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
    var mathHits = 0, mathTotal = 0, logicHits = 0, logicTotal = 0;
    var s1 = 0, smid = 0, s4 = 0, taskAcc = 0;
    var rts = [];

    for (var i = 0; i < results.length; i += 1) {
      var r = results[i];
      rts.push(r.taskRtMs);
      if (r.taskCorrect) taskAcc += 1;
      s1 += r.slotHits[0];
      smid += r.slotHits[1] + r.slotHits[2];
      s4 += r.slotHits[3];
      if (r.taskType === "math") {
        mathHits += r.hits;
        mathTotal += 4;
      } else {
        logicHits += r.hits;
        logicTotal += 4;
      }
    }

    var totalSlots = results.length * 4;
    var rawRecallPct = Math.round(((mathHits + logicHits) / totalSlots) * 100);
    var taskAccPct = Math.round((taskAcc / results.length) * 100);
    var penalty = taskAccPct < 75 ? Math.round((75 - taskAccPct) * 0.25) : 0;
    var finalScore = Math.max(0, Math.min(100, rawRecallPct - penalty));

    var mathSurvivalPct = mathTotal > 0 ? Math.round((mathHits / mathTotal) * 100) : 0;
    var logicSurvivalPct = logicTotal > 0 ? Math.round((logicHits / logicTotal) * 100) : 0;
    var slot1Pct = Math.round((s1 / results.length) * 100);
    var middleSlotsPct = Math.round((smid / (results.length * 2)) * 100);
    var slot4Pct = Math.round((s4 / results.length) * 100);
    var meanRt = mean(rts);

    var diag =
      "صمد من المخزون الخلفي " +
      mathSurvivalPct +
      "% بعد الحساب مقابل " +
      logicSurvivalPct +
      "% بعد المقارنة المنطقية، مع بقاء الخانة الأولى بنسبة " +
      slot1Pct +
      "% والخانتين الوسطيين بنسبة " +
      middleSlotsPct +
      "%.";

    completeProbe("isolation", finalScore, meanRt, {
      mathSurvivalPct: mathSurvivalPct,
      logicSurvivalPct: logicSurvivalPct,
      slot1Pct: slot1Pct,
      middleSlotsPct: middleSlotsPct,
      slot4Pct: slot4Pct,
      taskAccPct: taskAccPct,
      taskMeanRtMs: meanRt
    }, [
      { label: "البقاء بعد الحساب", val: mathSurvivalPct + "%" },
      { label: "البقاء بعد المنطق", val: logicSurvivalPct + "%" },
      { label: "صمود الرأس الأول", val: slot1Pct + "%" },
      { label: "صمود الوسط (2–3)", val: middleSlotsPct + "%" },
      { label: "دقة المسألة الوسيطة", val: taskAccPct + "%" },
      { label: "متوسط زمن المسألة", val: meanRt + " ms" }
    ], diag);
  }

  /* =========================================================================
     PROBE 2: UPDATING (Peripheral Decay & Proactive Interference)
     ========================================================================= */
  function runUpdatingProbe() {
    var S = getStimuli();
    var trials = S.generateUpdatingTrials(4);
    var meta = findProbeMeta("updating");
    var idx = 0;

    var stats = {
      twoCorrect: 0,
      twoTotal: 0,
      threeCorrect: 0,
      threeTotal: 0,
      staleErrors: 0,
      decayErrors: 0,
      swapErrors: 0,
      calcErrors: 0,
      stepRts: []
    };

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishUpdating(stats);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      var initParts = [];
      for (var v = 0; v < tr.vars.length; v += 1) {
        var vn = tr.vars[v];
        var unitStr = tr.units && tr.units[vn] ? " " + tr.units[vn] : "";
        initParts.push(esc(vn) + ': <span class="ltr-iso">' + tr.initial[vn] + "</span>" + esc(unitStr));
      }

      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">القيم الابتدائية (' +
        tr.vars.length +
        " متغيرات)</div>" +
        '<div class="stim-step-text">' +
        initParts.join(" &nbsp;|&nbsp; ") +
        "</div>" +
        '<button id="btnBeginSteps" type="button" class="btn-primary">حفظت البداية — اعرض الخطوات (مسافة)</button>' +
        "</div>";

      var goSteps = function () {
        unbindKeyHandler();
        showStep(0);
      };
      document.getElementById("btnBeginSteps").addEventListener("click", goSteps);
      bindKeyHandler(function (ev) {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          goSteps();
        }
      });

      function showStep(sIdx) {
        if (sIdx >= tr.steps.length) {
          return askFinalVars(0);
        }
        var stepObj = tr.steps[sIdx];
        var tStep = performance.now();

        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">الخطوة <span class="ltr-iso">' +
          (sIdx + 1) +
          " / " +
          tr.steps.length +
          "</span></div>" +
          '<div class="stim-step-text">' +
          esc(stepObj.text) +
          "</div>" +
          renderDots(tr.steps.length, sIdx) +
          '<button id="btnNextUpdateStep" type="button" class="btn-primary">تم التحديث — التالي (مسافة)</button>' +
          "</div>";

        var advance = function () {
          unbindKeyHandler();
          stats.stepRts.push(Math.round(performance.now() - tStep));
          showStep(sIdx + 1);
        };
        document.getElementById("btnNextUpdateStep").addEventListener("click", advance);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            advance();
          }
        });
      }

      function askFinalVars(vIdx) {
        if (vIdx >= tr.vars.length) {
          idx += 1;
          scheduleTimer(nextTrial, 200);
          return;
        }
        var varName = tr.vars[vIdx];
        var numpadHtml = "";
        for (var n = 1; n <= 9; n += 1) {
          numpadHtml += '<button type="button" class="key-btn" data-num="' + n + '">' + n + "</button>";
        }

        domRefs.stage.innerHTML =
          '<div class="task-box">' +
          '<div class="stim-label">استرجاع المتغير <span class="ltr-iso">' +
          (vIdx + 1) +
          " / " +
          tr.vars.length +
          "</span></div>" +
          '<p class="task-question">ما القيمة النهائية للمتغير «' +
          esc(varName) +
          "»؟</p>" +
          '<div class="keypad-grid is-numpad">' +
          numpadHtml +
          "</div>" +
          '<div class="arena-utility-row">' +
          '<button id="btnForgotVar" type="button" class="btn-forgot">تبخر الرقم في اللحظة الأخيرة ؟</button>' +
          "</div>" +
          "</div>";

        var submitVarAnswer = function (valOrForgot) {
          unbindKeyHandler();
          var trueFinal = tr.final[varName];
          var isTwo = tr.vars.length === 2;
          if (isTwo) stats.twoTotal += 1;
          else stats.threeTotal += 1;

          if (valOrForgot === "__FORGOT__") {
            stats.decayErrors += 1;
          } else {
            var numVal = Number(valOrForgot);
            if (numVal === trueFinal) {
              if (isTwo) stats.twoCorrect += 1;
              else stats.threeCorrect += 1;
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
          askFinalVars(vIdx + 1);
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
    var meanStepRt = mean(stats.stepRts);

    var diag =
      "دقة متغيرين: " +
      twoVarPct +
      "% مقابل 3 متغيرات: " +
      threeVarPct +
      "%؛ سُجلت " +
      stats.staleErrors +
      " أخطاء التصاق بالقيمة القديمة و" +
      stats.decayErrors +
      " حالات تبخر في الرف الجانبي.";

    completeProbe("updating", score, meanStepRt, {
      twoVarPct: twoVarPct,
      threeVarPct: threeVarPct,
      staleErrors: stats.staleErrors,
      decayErrors: stats.decayErrors,
      swapErrors: stats.swapErrors,
      stepMeanRtMs: meanStepRt
    }, [
      { label: "دقة متغيرين", val: twoVarPct + "%" },
      { label: "دقة 3 متغيرات", val: threeVarPct + "%" },
      { label: "التصاق قيمة قديمة", val: String(stats.staleErrors) },
      { label: "تبخر الرقم الأخير", val: String(stats.decayErrors) },
      { label: "خلط بين متغيرين", val: String(stats.swapErrors) },
      { label: "زمن خطوة التحديث", val: meanStepRt + " ms" }
    ], diag);
  }

  /* =========================================================================
     PROBE 3: GATING (Blocked vs Alternating Mode-Switching Cost)
     ========================================================================= */
  function runGatingProbe() {
    var S = getStimuli();
    var trials = S.generateGatingTrials(4);
    var meta = findProbeMeta("gating");
    var idx = 0;
    var trialScores = [];

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishGating(trialScores);
      }
      var tr = trials[idx];
      var modeTitle = tr.mode === "blocked" ? "جولة متكتلة ضابطة" : "جولة متناوبة فاحصة";
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      domRefs.stage.innerHTML =
        '<div class="stimulus-card">' +
        '<div class="stim-label">' +
        modeTitle +
        " (" +
        tr.sequence.length +
        " عناصر)</div>" +
        '<div class="stim-num">+</div>' +
        "</div>";

      scheduleTimer(function () {
        showItem(0);
      }, 600);

      function showItem(sIdx) {
        if (sIdx >= tr.sequence.length) {
          return askNumbersPhase();
        }
        var item = tr.sequence[sIdx];
        var isNum = item.kind === "num";
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">' +
          (isNum ? "رقم" : "كلمة") +
          ' (<span class="ltr-iso">' +
          (sIdx + 1) +
          "/" +
          tr.sequence.length +
          "</span>)</div>" +
          (isNum
            ? '<div class="stim-num">' + esc(item.value) + "</div>"
            : '<div class="stim-word">' + esc(item.value) + "</div>") +
          renderDots(tr.sequence.length, sIdx) +
          "</div>";

        scheduleTimer(function () {
          domRefs.stage.innerHTML = '<div class="stimulus-card"></div>';
          scheduleTimer(function () {
            showItem(sIdx + 1);
          }, 170);
        }, 1020);
      }

      var chosenNums = [];
      var chosenWords = [];

      function askNumbersPhase() {
        var need = tr.expectedNumbersAsc.length;

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
            '<div class="stim-label">المرحلة 1 من 2 — فرز الأرقام</div>' +
            '<p class="task-question">اختر الأرقام وحدها مرتبة من الأصغر إلى الأكبر:</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid is-numpad">' +
            padHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotGNum" type="button" class="btn-forgot">تبخر الرقم ؟</button>' +
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
              renderNumStage();
            }
          });
        }

        function pushNum(v) {
          if (chosenNums.length >= need) return;
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
            '<div class="stim-label">المرحلة 2 من 2 — عكس الكلمات</div>' +
            '<p class="task-question">اختر الكلمات وحدها مرتبة عكسيا من الأخيرة إلى الأولى:</p>' +
            '<div class="recall-slots">' +
            slotsHtml +
            "</div>" +
            '<div class="keypad-grid">' +
            padHtml +
            "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="btnForgotGWord" type="button" class="btn-forgot">تبخرت الكلمة ؟</button>' +
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
              renderWordStage();
            }
          });
        }

        function pushWord(w) {
          if (chosenWords.length >= needW) return;
          chosenWords.push(w);
          if (chosenWords.length === needW) {
            var hits = 0;
            for (var a = 0; a < needW; a += 1) {
              if (chosenNums[a] === tr.expectedNumbersAsc[a]) hits += 1;
              if (chosenWords[a] === tr.expectedWordsRev[a]) hits += 1;
            }
            var pct = Math.round((hits / (needW * 2)) * 100);
            trialScores.push({ mode: tr.mode, pairs: tr.pairCount, pct: pct });
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

  function finishGating(trialScores) {
    var blockedArr = [], alt4Arr = [], alt6Arr = [];
    for (var i = 0; i < trialScores.length; i += 1) {
      var t = trialScores[i];
      if (t.mode === "blocked") blockedArr.push(t.pct);
      else if (t.pairs === 2) alt4Arr.push(t.pct);
      else alt6Arr.push(t.pct);
    }

    var blockedPct = mean(blockedArr);
    var alt4Pct = mean(alt4Arr);
    var alt6Pct = mean(alt6Arr);
    var alternatingPct = Math.round(0.25 * alt4Pct + 0.75 * alt6Pct);
    var switchingPenalty = Math.max(0, Math.round(blockedPct - alt6Pct));

    var diag =
      "الفرز المتكتل سجل " +
      blockedPct +
      "% مقابل " +
      alt6Pct +
      "% عند تناوب 6 عناصر؛ عقوبة التناوب الصافية على بوابة الإدخال بلغت " +
      switchingPenalty +
      " نقطة مئوية.";

    completeProbe("gating", alternatingPct, 0, {
      blockedPct: blockedPct,
      alt4Pct: alt4Pct,
      alt6Pct: alt6Pct,
      alternatingPct: alternatingPct,
      switchingPenalty: switchingPenalty
    }, [
      { label: "دقة المتكتل (6 عناصر)", val: blockedPct + "%" },
      { label: "تناوب 4 عناصر", val: alt4Pct + "%" },
      { label: "تناوب 6 عناصر", val: alt6Pct + "%" },
      { label: "عقوبة التناوب الصافية", val: switchingPenalty + "%" }
    ], diag);
  }

  /* =========================================================================
     PROBE 4: BINDING (Lexical Pointer Binding & Polarity Flip)
     ========================================================================= */
  function runBindingProbe() {
    var S = getStimuli();
    var trials = S.generateBindingTrials(5);
    var meta = findProbeMeta("binding");
    var idx = 0;
    var records = [];

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
        if (pIdx >= tr.premises.length) {
          return showBindingQuestion();
        }
        var t0 = performance.now();
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">المقدمة <span class="ltr-iso">' +
          (pIdx + 1) +
          " / 3</span> (تختفي بعد الانتقال)</div>" +
          '<div class="stim-step-text">' +
          esc(tr.premises[pIdx]) +
          "</div>" +
          renderDots(3, pIdx) +
          '<button id="btnNextPremise" type="button" class="btn-primary">' +
          (pIdx < 2 ? "الجملة التالية (مسافة)" : "اعرض السؤال (مسافة)") +
          "</button>" +
          "</div>";

        var adv = function () {
          unbindKeyHandler();
          premiseRts.push(Math.round(performance.now() - t0));
          showPremise(pIdx + 1);
        };
        document.getElementById("btnNextPremise").addEventListener("click", adv);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            adv();
          }
        });
      }

      function showBindingQuestion() {
        var tQ = performance.now();
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
          '<div class="stim-label">' +
          (tr.polarity === "flipped" ? "علاقات مقلوبة القطبية" : "علاقات خطية متسقة") +
          "</div>" +
          '<p class="task-question">' +
          esc(tr.question) +
          "</p>" +
          '<div class="options-grid">' +
          optsHtml +
          "</div>" +
          '<div class="arena-utility-row">' +
          '<button id="btnPointerDecay" type="button" class="btn-forgot">عرفت الموقع المنطقي وتبخر الاسم اللفظي</button>' +
          "</div>" +
          "</div>";

        var choose = function (val, isPointerDecay) {
          unbindKeyHandler();
          var qRt = Math.round(performance.now() - tQ);
          var totalReadAndSolve = qRt + premiseRts[0] + premiseRts[1] + premiseRts[2];
          records.push({
            polarity: tr.polarity,
            correct: !isPointerDecay && val === tr.answer,
            pointerDecay: Boolean(isPointerDecay),
            qRtMs: qRt,
            totalRtMs: totalReadAndSolve
          });
          idx += 1;
          scheduleTimer(nextTrial, 200);
        };

        var btns = domRefs.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < btns.length; b += 1) {
          btns[b].addEventListener("click", function (ev) {
            var k = Number(ev.currentTarget.getAttribute("data-ent-idx"));
            choose(tr.entities[k], false);
          });
        }
        document.getElementById("btnPointerDecay").addEventListener("click", function () {
          choose("", true);
        });

        bindKeyHandler(function (ev) {
          var n = Number(ev.key);
          if (n >= 1 && n <= tr.entities.length) {
            ev.preventDefault();
            choose(tr.entities[n - 1], false);
          }
        });
      }
    }

    nextTrial();
  }

  function finishBinding(records) {
    var linCorrect = 0, linCount = 0, flipCorrect = 0, flipCount = 0;
    var pointerDecayCount = 0;
    var linRts = [], flipRts = [], allQ = [];

    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      allQ.push(r.qRtMs);
      if (r.pointerDecay) pointerDecayCount += 1;
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

    var score = Math.round(((linCorrect + flipCorrect) / records.length) * 100);
    var linearAccPct = linCount > 0 ? Math.round((linCorrect / linCount) * 100) : 0;
    var flippedAccPct = flipCount > 0 ? Math.round((flipCorrect / flipCount) * 100) : 0;
    var linMean = mean(linRts);
    var flipMean = mean(flipRts);
    var flipCost = Math.round(flipMean - linMean);

    var diag =
      "دقة الاتجاه الموحد " +
      linearAccPct +
      "% مقابل " +
      flippedAccPct +
      "% عند انقلاب القطبية، مع تسجيل " +
      pointerDecayCount +
      " مرات انفكاك للاسم اللفظي عن عقدته المنطقية.";

    completeProbe("binding", score, mean(allQ), {
      linearAccPct: linearAccPct,
      flippedAccPct: flippedAccPct,
      pointerDecayCount: pointerDecayCount,
      linearRtMs: linMean,
      flippedRtMs: flipMean,
      polarityFlipRtCostMs: flipCost
    }, [
      { label: "دقة الاتجاه الموحد", val: linearAccPct + "%" },
      { label: "دقة انقلاب القطبية", val: flippedAccPct + "%" },
      { label: "تبخر الاسم مع بقاء العقدة", val: String(pointerDecayCount) },
      { label: "كلفة قلب القطبية", val: (flipCost >= 0 ? "+" : "") + flipCost + " ms" }
    ], diag);
  }

  /* =========================================================================
     PROBE 5: VIGILANCE (4-Beat RLPFC Sequence Counter & Local Sleep Lapses)
     ========================================================================= */
  function runVigilanceProbe() {
    var S = getStimuli();
    var cfg = S.generateVigilanceConfig();
    var meta = findProbeMeta("vigilance");
    setHeader(meta.title, sessionState.isBattery ? "Battery 5/6 · Continuous" : "Continuous");

    domRefs.stage.innerHTML =
      '<div class="vigilance-pad">' +
      '<div class="probe-bar-track" style="max-width:340px;"><div id="vigProgFill" class="probe-bar-fill" style="width:0%"></div></div>' +
      '<div id="vigPulseRing" class="pulse-ring">●</div>' +
      '<p id="vigStatusMsg" class="vig-status-msg">عدّ الومضات في دورات رباعية (1، 2، 3 ثم أغلق 4)</p>' +
      '<div class="vig-actions">' +
      '<button id="btnVigStep" type="button" class="vig-btn-step">خطوة 1 أو 2 أو 3 (مسافة)</button>' +
      '<button id="btnVigClose" type="button" class="vig-btn-close">إغلاق الدورة 4 (Enter)</button>' +
      "</div>" +
      '<div class="arena-utility-row">' +
      '<button id="btnVigReset" type="button" class="vig-btn-reset">ضاع العدّاد مني — أعد من 1</button>' +
      "</div>" +
      "</div>";

    var ringEl = document.getElementById("vigPulseRing");
    var msgEl = document.getElementById("vigStatusMsg");
    var fillEl = document.getElementById("vigProgFill");

    var pulseIdx = 0;
    var internalCyclePos = 0; // 1..4
    var respondedCurrent = true;
    var pulseStartTs = 0;

    var rts = [];
    var stepCorrect = 0;
    var stepTotal = 0;
    var closeCorrect = 0;
    var closeTotal = 0;
    var localSleepLapses = 0;
    var missedPulses = 0;
    var dmnResets = 0;

    function handleAction(actionType) {
      if (actionType === "reset") {
        dmnResets += 1;
        internalCyclePos = 0;
        respondedCurrent = true;
        if (msgEl) msgEl.textContent = "تمت إعادة المزامنة — الومضة القادمة ستكون رقم 1";
        return;
      }
      if (respondedCurrent || pulseIdx === 0) return;
      respondedCurrent = true;
      var rt = Math.round(performance.now() - pulseStartTs);
      rts.push(rt);
      if (rt > cfg.lapseThresholdMs) {
        localSleepLapses += 1;
      }

      var expectedClose = internalCyclePos === 4;
      if (expectedClose) {
        if (actionType === "close") closeCorrect += 1;
      } else {
        if (actionType === "step") stepCorrect += 1;
      }

      if (msgEl) {
        msgEl.textContent = rt + " ms";
      }
    }

    document.getElementById("btnVigStep").addEventListener("click", function () {
      handleAction("step");
    });
    document.getElementById("btnVigClose").addEventListener("click", function () {
      handleAction("close");
    });
    document.getElementById("btnVigReset").addEventListener("click", function () {
      handleAction("reset");
    });

    bindKeyHandler(function (ev) {
      if (ev.key === " ") {
        ev.preventDefault();
        handleAction("step");
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        handleAction("close");
      } else if (ev.key === "r" || ev.key === "R" || ev.key === "0") {
        ev.preventDefault();
        handleAction("reset");
      }
    });

    function fireNextPulse() {
      // Evaluate missed previous pulse
      if (pulseIdx > 0 && !respondedCurrent) {
        missedPulses += 1;
        localSleepLapses += 1;
      }

      if (pulseIdx >= cfg.totalPulses) {
        return finishVigilance({
          rts: rts,
          stepCorrect: stepCorrect,
          stepTotal: stepTotal,
          closeCorrect: closeCorrect,
          closeTotal: closeTotal,
          localSleepLapses: localSleepLapses,
          missedPulses: missedPulses,
          dmnResets: dmnResets
        });
      }

      pulseIdx += 1;
      internalCyclePos = (internalCyclePos % cfg.cycleLength) + 1;
      if (internalCyclePos === 4) closeTotal += 1;
      else stepTotal += 1;

      respondedCurrent = false;
      pulseStartTs = performance.now();

      if (fillEl) {
        fillEl.style.width = Math.round((pulseIdx / cfg.totalPulses) * 100) + "%";
      }
      if (ringEl) {
        ringEl.classList.add("is-flashing");
      }
      scheduleTimer(function () {
        if (ringEl) ringEl.classList.remove("is-flashing");
      }, cfg.flashDurationMs);

      var jitter = Math.floor((Math.random() * 2 - 1) * cfg.jitterMs);
      scheduleTimer(fireNextPulse, cfg.baseIntervalMs + jitter);
    }

    scheduleTimer(fireNextPulse, 850);
  }

  function finishVigilance(st) {
    var totalPulses = st.stepTotal + st.closeTotal;
    var overallAcc = totalPulses > 0 ? Math.round(((st.stepCorrect + st.closeCorrect) / totalPulses) * 100) : 0;
    var cycleCloseAccPct = st.closeTotal > 0 ? Math.round((st.closeCorrect / st.closeTotal) * 100) : 0;
    var meanRtMs = mean(st.rts);
    var sd = stdDev(st.rts);
    var rtIcvPct = meanRtMs > 0 ? Math.round((sd / meanRtMs) * 100) : 0;

    var stabilityScore = Math.max(0, 100 - st.localSleepLapses * 11 - st.dmnResets * 14);
    var cycleComposite = Math.round(0.55 * cycleCloseAccPct + 0.45 * overallAcc);
    var finalScore = Math.max(0, Math.min(100, Math.round(0.65 * cycleComposite + 0.35 * stabilityScore)));

    var diag =
      "دقة إغلاق الدورة الرابعة سجلت " +
      cycleCloseAccPct +
      "%، مع رصد " +
      st.localSleepLapses +
      " هفوات نوم موضعي (>900ms أو فوات) و" +
      st.dmnResets +
      " مرات إعادة ضبط لضياع العدّاد.";

    completeProbe("vigilance", finalScore, meanRtMs, {
      cycleCloseAccPct: cycleCloseAccPct,
      overallStepAccPct: overallAcc,
      localSleepLapses: st.localSleepLapses,
      dmnResets: st.dmnResets,
      meanRtMs: meanRtMs,
      rtIcvPct: rtIcvPct
    }, [
      { label: "دقة إغلاق الدورة 4", val: cycleCloseAccPct + "%" },
      { label: "الدقة الكلية للخطوات", val: overallAcc + "%" },
      { label: "هفوات النوم الموضعي", val: String(st.localSleepLapses) },
      { label: "ضياع العدّاد (DMN)", val: String(st.dmnResets) },
      { label: "متوسط الاستجابة", val: meanRtMs + " ms" },
      { label: "معامل التذبذب ICV", val: rtIcvPct + "%" }
    ], diag);
  }

  /* =========================================================================
     PROBE 6: CONTROL ANCHOR (3-Level Call Stack + 0.8s 2D Visual Flash)
     ========================================================================= */
  function renderPolygonSVG(points) {
    var d = "";
    for (var i = 0; i < points.length; i += 1) {
      d += (i === 0 ? "M " : " L ") + points[i][0] + " " + points[i][1];
    }
    d += " Z";
    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon points="' +
      points.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
      '" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="50" r="2.2" fill="currentColor" opacity="0.45"/>' +
      "</svg>"
    );
  }

  function renderMaskSVG() {
    var cells = "";
    for (var r = 0; r < 8; r += 1) {
      for (var c = 0; c < 8; c += 1) {
        if ((r + c) % 2 === 0) {
          cells += '<rect x="' + c * 12.5 + '" y="' + r * 12.5 + '" width="12.5" height="12.5" fill="currentColor" opacity="0.55"/>';
        }
      }
    }
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + cells + "</svg>";
  }

  function runControlProbe() {
    var S = getStimuli();
    var trials = S.generateControlTrials();
    var meta = findProbeMeta("control");
    var idx = 0;
    var stackHits = 0, stackTotal = 0, visHits = 0, visTotal = 0;
    var stackRts = [], visRts = [];

    function nextTrial() {
      cleanupActive();
      if (idx >= trials.length) {
        return finishControl(stackHits, stackTotal, visHits, visTotal, stackRts, visRts);
      }
      var tr = trials[idx];
      setHeader(meta.title, formatProgressPrefix("Trial " + (idx + 1) + "/" + trials.length));

      if (tr.kind === "stack") {
        runStackTrial(tr);
      } else {
        runVisualTrial(tr);
      }
    }

    function runStackTrial(tr) {
      var frames = [
        { label: "الطبقة 1 من 3 (الأصل)", text: tr.frame1Text, btn: "افتح الفرع الأول (مسافة)" },
        { label: "الطبقة 2 من 3 (الفرع الأول)", text: tr.frame2Text, btn: "افتح الفرع الثاني (مسافة)" },
        { label: "الطبقة 3 من 3 (القاعدة المباشرة)", text: tr.frame3Text, btn: "احسب وعوّض صعودا (مسافة)" }
      ];

      function showFrame(fIdx) {
        if (fIdx >= frames.length) {
          var t0 = performance.now();
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
            '<div class="stim-label">إغلاق المكدس الصاعد</div>' +
            '<p class="task-question">' +
            esc(tr.closeText) +
            "</p>" +
            '<div class="options-grid">' +
            optsHtml +
            "</div>" +
            "</div>";

          var pick = function (val) {
            unbindKeyHandler();
            stackRts.push(Math.round(performance.now() - t0));
            stackTotal += 1;
            if (Number(val) === Number(tr.answer)) stackHits += 1;
            idx += 1;
            scheduleTimer(nextTrial, 200);
          };

          var btns = domRefs.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < btns.length; b += 1) {
            btns[b].addEventListener("click", function (ev) {
              pick(ev.currentTarget.getAttribute("data-val"));
            });
          }
          bindKeyHandler(function (ev) {
            var n = Number(ev.key);
            if (n >= 1 && n <= tr.options.length) {
              ev.preventDefault();
              pick(tr.options[n - 1]);
            }
          });
          return;
        }

        var fr = frames[fIdx];
        domRefs.stage.innerHTML =
          '<div class="stimulus-card">' +
          '<div class="stim-label">' +
          esc(fr.label) +
          "</div>" +
          '<div class="stim-step-text">' +
          esc(fr.text) +
          "</div>" +
          renderDots(3, fIdx) +
          '<button id="btnNextStackFrame" type="button" class="btn-primary">' +
          esc(fr.btn) +
          "</button>" +
          "</div>";

        var adv = function () {
          unbindKeyHandler();
          showFrame(fIdx + 1);
        };
        document.getElementById("btnNextStackFrame").addEventListener("click", adv);
        bindKeyHandler(function (ev) {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            adv();
          }
        });
      }

      showFrame(0);
    }

    function runVisualTrial(tr) {
      domRefs.stage.innerHTML =
        '<div class="visual-canvas-wrap">' +
        '<div class="stim-label">ثبّت بصرك لالتقاط التناسب المسطح (0.8 ثانية)</div>' +
        '<div class="visual-svg-box"><span class="stim-num">+</span></div>' +
        "</div>";

      scheduleTimer(function () {
        domRefs.stage.innerHTML =
          '<div class="visual-canvas-wrap">' +
          '<div class="stim-label">ومضة الشكل الهدف</div>' +
          '<div class="visual-svg-box">' +
          renderPolygonSVG(tr.targetPoints) +
          "</div>" +
          "</div>";

        scheduleTimer(function () {
          domRefs.stage.innerHTML =
            '<div class="visual-canvas-wrap">' +
            '<div class="stim-label">قناع بصري</div>' +
            '<div class="visual-svg-box">' +
            renderMaskSVG() +
            "</div>" +
            "</div>";

          scheduleTimer(function () {
            domRefs.stage.innerHTML =
              '<div class="visual-canvas-wrap">' +
              '<div class="stim-label">احتفاظ صامت (2 ثانية)...</div>' +
              '<div class="visual-svg-box"></div>' +
              "</div>";

            scheduleTimer(function () {
              var t0 = performance.now();
              var gridHtml = "";
              for (var o = 0; o < tr.optionsPoints.length; o += 1) {
                gridHtml +=
                  '<button type="button" class="visual-opt-btn" data-opt="' +
                  o +
                  '">' +
                  renderPolygonSVG(tr.optionsPoints[o]) +
                  "</button>";
              }

              domRefs.stage.innerHTML =
                '<div class="task-box">' +
                '<p class="task-question">اختر الشكل المطابق تماما للشكل الذي ومض:</p>' +
                '<div class="visual-options-grid">' +
                gridHtml +
                "</div>" +
                "</div>";

              var pickVis = function (chosenIdx) {
                unbindKeyHandler();
                visRts.push(Math.round(performance.now() - t0));
                visTotal += 1;
                if (Number(chosenIdx) === Number(tr.correctIndex)) visHits += 1;
                idx += 1;
                scheduleTimer(nextTrial, 200);
              };

              var btns = domRefs.stage.querySelectorAll(".visual-opt-btn");
              for (var b = 0; b < btns.length; b += 1) {
                btns[b].addEventListener("click", function (ev) {
                  pickVis(ev.currentTarget.getAttribute("data-opt"));
                });
              }
              bindKeyHandler(function (ev) {
                var n = Number(ev.key);
                if (n >= 1 && n <= 4) {
                  ev.preventDefault();
                  pickVis(n - 1);
                }
              });
            }, tr.delayMs);
          }, tr.maskMs);
        }, tr.flashMs);
      }, 550);
    }

    nextTrial();
  }

  function finishControl(stackHits, stackTotal, visHits, visTotal, stackRts, visRts) {
    var stackAccPct = stackTotal > 0 ? Math.round((stackHits / stackTotal) * 100) : 0;
    var visual2dAccPct = visTotal > 0 ? Math.round((visHits / visTotal) * 100) : 0;
    var score = Math.round(0.5 * stackAccPct + 0.5 * visual2dAccPct);
    var stackRtMs = mean(stackRts);
    var visual2dRtMs = mean(visRts);
    var allMean = mean(stackRts.concat(visRts));

    var diag =
      "مكدس الأقواس الهرمي سجل " +
      stackAccPct +
      "% وومضة التناسب المسطح (0.8 ثانية) سجلت " +
      visual2dAccPct +
      "%؛ يمثل هذا المسبار خط الضبط السليم لمقارنة المناطق المتضررة.";

    completeProbe("control", score, allMean, {
      stackAccPct: stackAccPct,
      visual2dAccPct: visual2dAccPct,
      stackRtMs: stackRtMs,
      visual2dRtMs: visual2dRtMs
    }, [
      { label: "مكدس 3 طبقات", val: stackAccPct + "%" },
      { label: "ومضة 2D (0.8s)", val: visual2dAccPct + "%" },
      { label: "زمن حل المكدس", val: stackRtMs + " ms" },
      { label: "زمن مطابقة 2D", val: visual2dRtMs + " ms" }
    ], diag);
  }

  /* =========================================================================
     COMPLETION, PERSISTENCE & REPORT RENDERING
     ========================================================================= */
  function completeProbe(probeId, score, rtMeanMs, submetrics, displayCards, diagnosisText) {
    cleanupActive();
    var A = getAnalytics();
    var meta = findProbeMeta(probeId);
    var ctx = sessionState.contextSnapshot || captureContext();
    var nowTs = Date.now();
    var recId = "rec_" + probeId + "_" + nowTs + "_" + Math.floor(Math.random() * 1000);

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
          submetrics: submetrics,
          phase: ctx.phase,
          sleepQuality: ctx.sleepQuality,
          alertness: ctx.alertness,
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

    var cardsHtml = "";
    for (var i = 0; i < displayCards.length; i += 1) {
      cardsHtml +=
        '<div class="submetric-card">' +
        '<span class="stim-label">' +
        esc(displayCards[i].label) +
        "</span>" +
        '<strong style="font-size:1.08rem;"><span class="ltr-iso">' +
        esc(displayCards[i].val) +
        "</span></strong>" +
        "</div>";
    }

    var isLastBatteryStep =
      sessionState.isBattery && sessionState.batteryIndex >= sessionState.batteryQueue.length - 1;

    setHeader(meta.title + " — النتيجة", score + "%");

    var actionsHtml = "";
    if (sessionState.isBattery && !isLastBatteryStep) {
      var nextMeta = findProbeMeta(sessionState.batteryQueue[sessionState.batteryIndex + 1]);
      actionsHtml =
        '<button id="btnNextBatteryProbe" type="button" class="btn-primary">المسبار التالي: ' +
        esc(nextMeta.shortTitle || nextMeta.title) +
        " (Enter)</button>";
    } else if (isLastBatteryStep) {
      actionsHtml =
        '<button id="btnFinishFullBattery" type="button" class="btn-primary">عرض الحصيلة الجراحية للبطارية الكاملة (Enter)</button>';
    } else {
      actionsHtml =
        '<button id="btnRetryProbe" type="button" class="btn-ghost">إعادة فحص المنطقة</button>' +
        '<button id="btnDoneProbe" type="button" class="btn-primary">حفظ والعودة للوحة القيادة (Enter)</button>';
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
      "%</span></span>" +
      '<span class="delta-pill is-neutral">الهدف السليم: <span class="ltr-iso">' +
      (meta.normScore || 85) +
      "%</span></span>" +
      "</div>" +
      "</div>" +
      '<div class="submetrics-grid">' +
      cardsHtml +
      "</div>" +
      '<div class="diagnosis-callout">' +
      esc(diagnosisText) +
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

    setHeader("الحصيلة الجراحية للبطارية الكاملة", "6/6 Completed");

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
      '">التحسن عن خط الأساس (36%): <span class="ltr-iso">' +
      (deltaComp >= 0 ? "+" : "") +
      deltaComp +
      "%</span></span>" +
      '<span class="delta-pill is-neutral">مرساة التحكم: <span class="ltr-iso">' +
      ctrl +
      "%</span></span>" +
      '<span class="delta-pill is-neutral">فجوة التباين الحالية: <span class="ltr-iso">' +
      gap +
      " نقطة</span></span>" +
      "</div>" +
      "</div>" +
      '<div class="diagnosis-callout">' +
      "اكتمل توثيق المسبارات الستة وحُفظت الجلسة في السجل الطولي؛ انتقل إلى تبويب المنحنيات لمقارنة ردم الفجوة العصبية عبر المراحل العلاجية." +
      "</div>" +
      '<div class="result-actions">' +
      '<button id="btnCloseBatterySummary" type="button" class="btn-primary">العودة إلى لوحة القيادة والمنحنيات (Enter)</button>' +
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
    launchProbe: startSingleProbe
  };

  root.NeuroLab.Engine = Engine;
  root.Engine = Engine;
})();

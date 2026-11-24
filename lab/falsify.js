(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var mountEl = null;
  var timers = [];
  var intervals = [];
  var keyHandler = null;
  var isBattery = false;
  var batteryQueue = ["f1_crossmodal", "f2_suppression", "f3_spatial_slots", "f4_polarity_axis"];
  var batteryIdx = 0;
  var resetArmed = false;
  var resetTimer = null;

  function getCore() {
    return root.NeuroLab.FalsifyCore;
  }

  function esc(str) {
    var Core = getCore();
    var ascii = Core && Core.toAsciiDigits ? Core.toAsciiDigits(str) : String(str == null ? "" : str);
    return ascii
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nowMs() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i += 1) s += arr[i];
    return Math.round(s / arr.length);
  }

  function addTimer(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function addInterval(fn, ms) {
    var id = setInterval(fn, ms);
    intervals.push(id);
    return id;
  }

  function bindKeys(fn) {
    unbindKeys();
    keyHandler = fn;
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

  function clearTimers() {
    for (var i = 0; i < timers.length; i += 1) clearTimeout(timers[i]);
    for (var j = 0; j < intervals.length; j += 1) clearInterval(intervals[j]);
    timers = [];
    intervals = [];
    unbindKeys();
  }

  function domArena() {
    return {
      overlay: document.getElementById("arenaOverlay"),
      stage: document.getElementById("arenaStage"),
      title: document.getElementById("arenaTitle"),
      prog: document.getElementById("arenaProgress")
    };
  }

  function openArena() {
    clearTimers();
    var a = domArena();
    if (a.stage && a.stage.parentElement && a.stage.parentElement.classList) {
      a.stage.parentElement.classList.remove("is-canvas-stage");
    }
    if (a.overlay) {
      a.overlay.hidden = false;
      a.overlay.scrollTop = 0;
    }
  }

  function closeArena() {
    clearTimers();
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
    clearTimers();
    var a = domArena();
    if (a.overlay) {
      a.overlay.scrollTop = 0;
      a.overlay.hidden = true;
    }
    if (a.stage) a.stage.innerHTML = "";
    render();
  }

  function setHeader(title, prog) {
    var a = domArena();
    if (a.title) a.title.textContent = title || "";
    if (a.prog) a.prog.textContent = prog || "";
  }

  function startCountdownBar(el, totalMs) {
    if (!el || !totalMs) return;
    var t0 = nowMs();
    el.style.width = "100%";
    addInterval(function () {
      var pct = Math.max(0, 100 - ((nowMs() - t0) / totalMs) * 100);
      el.style.width = pct.toFixed(1) + "%";
      if (pct < 28) el.classList.add("is-urgent");
    }, 60);
  }

  function findMeta(expId) {
    var list = getCore().EXPERIMENTS;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === expId) return list[i];
    }
    return list[0];
  }

  function startFullBattery() {
    isBattery = true;
    batteryIdx = 0;
    openArena();
    showExperimentIntro(batteryQueue[0]);
  }

  function startExperiment(expId) {
    isBattery = false;
    openArena();
    showExperimentIntro(expId);
  }

  function formatRichTextHtml(rawStr) {
    var s = esc(rawStr);
    var slots = [];
    function keep(html) {
      var id = slots.length;
      slots.push(html);
      return "\uE000" + id + "\uE001";
    }
    s = s.replace(/\[([^\]]+)\]/g, function (_m, inner) {
      return keep('<span class="verdict-tag">' + inner + "</span>");
    });
    s = s.replace(/\((Space|Enter|\d+\s*[–-]\s*\d+)\)/g, function (_m, inner) {
      return keep('<kbd class="kbd-chip ltr-iso">' + inner + "</kbd>");
    });
    s = s.replace(/\(([^()\uE000\uE001]+)\)/g, function (full, inner) {
      if (/[\u0600-\u06FF]/.test(inner) || /^\d+$/.test(inner.trim())) return full;
      return keep('<span class="ltr-iso">' + full + "</span>");
    });
    s = s.replace(/(?:~?\d+(?:\.\d+)?\s*(?:ms|s)\b|[±+-]?\d+(?:\.\d+)?(?:\s*ms|\s*s)\b|~?[±+-]?\d+(?:\.\d+)?%|[±+-]\d+(?:\.\d+)?|~?\d+\.\d+|\b\d+\s*×\s*\d+\b|\b(?:2D|F[1-4]|D[1-5])\b)/g, function (m) {
      return keep('<span class="ltr-iso">' + m + "</span>");
    });
    return s.replace(/\uE000(\d+)\uE001/g, function (_m, idx) {
      return slots[Number(idx)];
    }).replace(/<\/kbd>\s*\.\s*$/, "</kbd>");
  }

  function showExperimentIntro(expId) {
    clearTimers();
    var meta = findMeta(expId);
    var a = domArena();
    var shortCode = meta.shortCode || String(meta.code || "").split("·")[0].trim();
    setHeader(
      shortCode + " — " + meta.title,
      isBattery ? "حسم " + (batteryIdx + 1) + " / 4" : "تجربة فاصلة"
    );

    var stepsHtml = meta.instructions.map(function (s) {
      var stLine = formatRichTextHtml(s);
      var colonPos = stLine.indexOf(":");
      if (colonPos > 0 && colonPos < 30) {
        stLine = "<strong>" + stLine.slice(0, colonPos + 1) + "</strong>" + stLine.slice(colonPos + 1);
      }
      return "<li>" + stLine + "</li>";
    }).join("");

    var flowHtml = "";
    if (Array.isArray(meta.flowSteps) && meta.flowSteps.length > 0) {
      flowHtml =
        '<div class="probe-flow-box" aria-label="مسار الجولة">' +
        '<span class="probe-flow-label">مسار الجولة</span>' +
        '<div class="probe-flow-track">' +
        meta.flowSteps.map(function (fs, idx) {
          var stepHtml = '<span class="flow-step">' + formatRichTextHtml(fs) + "</span>";
          return idx === 0
            ? stepHtml
            : '<span class="flow-step-unit"><span class="flow-arrow" aria-hidden="true">←</span>' + stepHtml + "</span>";
        }).join("") +
        "</div></div>";
    } else if (meta.example) {
      flowHtml = '<div class="probe-example-box">' + formatRichTextHtml(meta.example) + "</div>";
    }

    var domainTag = meta.domainTag || meta.shortTitle;
    var metaChip = meta.metaChip || "تجربة حسم";

    a.stage.innerHTML =
      '<div class="probe-intro">' +
      '<div class="probe-intro-top">' +
      '<div class="probe-intro-badges">' +
      '<span class="probe-code ltr-iso">' + esc(shortCode) + "</span>" +
      '<span class="probe-domain-tag">' + esc(domainTag) + "</span>" +
      "</div>" +
      '<div class="probe-intro-meta">' +
      '<span class="intro-meta-chip">' + formatRichTextHtml(metaChip) + "</span>" +
      "</div>" +
      "</div>" +
      '<h2 class="probe-intro-title">' + esc(meta.title) + "</h2>" +
      '<ol class="probe-steps">' + stepsHtml + "</ol>" +
      flowHtml +
      '<div class="result-actions">' +
      '<button id="btnFalsifyStart" type="button" class="btn-primary"><span>ابدأ الآن</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
      "</div>" +
      "</div>";

    var go = function () {
      clearTimers();
      if (a.overlay) a.overlay.scrollTop = 0;
      if (expId === "f1_crossmodal") return runF1();
      if (expId === "f2_suppression") return runF2();
      if (expId === "f3_spatial_slots") return runF3();
      return runF4();
    };
    document.getElementById("btnFalsifyStart").addEventListener("click", go);
    bindKeys(function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        go();
      }
    });
  }

  function showExperimentResult(expId, headlineScore, cards, summaryText) {
    clearTimers();
    var meta = findMeta(expId);
    var a = domArena();
    setHeader(meta.shortTitle + " — النتيجة", headlineScore);

    var cardsHtml = cards.map(function (c) {
      return (
        '<div class="submetric-card">' +
        '<span class="stim-label">' + formatRichTextHtml(c.label) + "</span>" +
        '<strong style="font-size:1.05rem;"><span class="ltr-iso">' + esc(c.val) + "</span></strong>" +
        "</div>"
      );
    }).join("");

    var isLast = isBattery && batteryIdx >= batteryQueue.length - 1;
    var RS = root.NeuroLab && root.NeuroLab.RepoSync;
    var saveBtnHtml = '<button id="btnFalsifySaveRepo" type="button" class="btn-repo-save" data-repo-save-btn><span>حفظ في الريبو</span></button>';
    var nextBtnHtml = "";
    if (isBattery && !isLast) {
      var nxt = findMeta(batteryQueue[batteryIdx + 1]);
      nextBtnHtml = saveBtnHtml + '<button id="btnFalsifyNext" type="button" class="btn-primary"><span>التجربة التالية: ' + esc(nxt.shortTitle) + '</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    } else {
      nextBtnHtml = saveBtnHtml + '<button id="btnFalsifyDone" type="button" class="btn-primary"><span>عرض لوحة الحكم الجراحي الكامل</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>';
    }

    a.stage.innerHTML =
      '<div class="result-report">' +
      '<div class="score-hero"><div class="score-ring-val"><span class="ltr-iso">' + esc(headlineScore) + "</span></div></div>" +
      '<div class="submetrics-grid">' + cardsHtml + "</div>" +
      '<div class="diagnosis-callout">' + formatRichTextHtml(summaryText) + "</div>" +
      '<div class="result-actions">' + nextBtnHtml + "</div>" +
      "</div>";

    if (RS && typeof RS.refreshUi === "function") {
      try { RS.refreshUi(); } catch (_) {}
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
    var bNext = document.getElementById("btnFalsifyNext") || document.getElementById("btnFalsifyDone");
    if (bNext) bNext.addEventListener("click", proceed);
    bindKeys(function (ev) {
      if (RS && typeof RS.isModalOpen === "function" && RS.isModalOpen()) return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        proceed();
      }
    });
  }

  /* ================= F1: 2x2 CROSS-MODAL INTERFERENCE ================= */
  function runF1() {
    var Core = getCore();
    var trials = Core.generateF1Trials();
    var idx = 0;
    var cellScores = { VV: [], VS: [], SV: [], SS: [] };
    var procHits = 0;
    var a = domArena();

    function nextTrial() {
      clearTimers();
      if (idx >= trials.length) {
        var vvPct = mean(cellScores.VV);
        var vsPct = mean(cellScores.VS);
        var svPct = mean(cellScores.SV);
        var ssPct = mean(cellScores.SS);
        var procAccPct = Math.round((procHits / trials.length) * 100);
        Core.saveExperimentResult("f1_crossmodal", {
          vvPct: vvPct,
          vsPct: vsPct,
          svPct: svPct,
          ssPct: ssPct,
          procAccPct: procAccPct
        });
        return showExperimentResult(
          "f1_crossmodal",
          svPct + "%",
          [
            { label: "كلمات + حساب (VV)", val: vvPct + "%" },
            { label: "كلمات + شكل صامت (VS)", val: vsPct + "%" },
            { label: "مربعات 4×4 + حساب (SV)", val: svPct + "%" },
            { label: "مربعات 4×4 + شكل (SS)", val: ssPct + "%" },
            { label: "دقة المسألة الفاصلة", val: procAccPct + "%" }
          ],
          Core.computeVerdictSummary().verdicts[0]
        );
      }

      var tr = trials[idx];
      setHeader("F1 · تقاطع القنوات", (idx + 1) + " / " + trials.length);

      a.stage.innerHTML =
        '<div class="stimulus-card"><div class="stim-label">' +
        (tr.storageKind === "words" ? "احفظ 4 كلمات بالترتيب" : "احفظ 4 مربعات مضيئة بالترتيب") +
        '</div><div class="stim-num">+</div></div>';

      addTimer(function () {
        if (tr.storageKind === "words") showWord(0);
        else showCorsiFlash(0);
      }, 520);

      function showWord(wIdx) {
        if (wIdx >= 4) return showInterveningTask();
        a.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
          (wIdx + 1) + ' / 4</span></div><div class="stim-word">' + esc(tr.words[wIdx]) + "</div></div>";
        addTimer(function () {
          a.stage.innerHTML = '<div class="stimulus-card"></div>';
          addTimer(function () { showWord(wIdx + 1); }, 170);
        }, 880);
      }

      function showCorsiFlash(cIdx) {
        if (cIdx >= 4) return showInterveningTask();
        var activeCell = tr.corsiPath[cIdx];
        var cellsHtml = "";
        for (var k = 0; k < 16; k += 1) {
          cellsHtml += '<button type="button" class="corsi-cell' + (k === activeCell ? " is-lit" : "") + '" disabled></button>';
        }
        a.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' +
          (cIdx + 1) + ' / 4</span></div><div class="corsi-grid">' + cellsHtml + "</div></div>";
        addTimer(function () {
          var blank = "";
          for (var b = 0; b < 16; b += 1) blank += '<button type="button" class="corsi-cell" disabled></button>';
          a.stage.innerHTML = '<div class="stimulus-card"><div class="stim-label">&nbsp;</div><div class="corsi-grid">' + blank + "</div></div>";
          addTimer(function () { showCorsiFlash(cIdx + 1); }, 170);
        }, 840);
      }

      function showInterveningTask() {
        clearTimers();
        var tk = tr.task;
        var doneTask = false;
        var finishTask = function (ok) {
          if (doneTask) return;
          doneTask = true;
          clearTimers();
          if (ok) procHits += 1;
          if (tr.storageKind === "words") recallWords(ok);
          else recallCorsi(ok);
        };

        if (tk.kind === "math") {
          var optsH = tk.options.map(function (o) {
            return '<button type="button" class="opt-btn" data-v="' + esc(o) + '"><span class="ltr-iso">' + esc(o) + "</span></button>";
          }).join("");
          a.stage.innerHTML =
            '<div class="task-box"><div class="stim-label">المسألة</div>' +
            '<div class="tbrs-timer-track"><div id="f1Bar" class="tbrs-timer-fill"></div></div>' +
            '<p class="task-question"><span class="ltr-iso math-expr">' + esc(tk.prompt) + "</span></p>" +
            '<div class="options-grid">' + optsH + "</div></div>";
          startCountdownBar(document.getElementById("f1Bar"), tk.deadlineMs);
          var bs = a.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < bs.length; b += 1) {
            bs[b].addEventListener("click", function (ev) {
              finishTask(ev.currentTarget.getAttribute("data-v") === tk.answer);
            });
          }
        } else {
          var vOpts = "";
          for (var o = 0; o < 4; o += 1) {
            vOpts += '<button type="button" class="visual-opt-btn" data-o="' + o + '">' + Core.renderPolySVG(tk.optionsPoints[o]) + "</button>";
          }
          a.stage.innerHTML =
            '<div class="task-box"><div class="stim-label">اختر المطابق</div>' +
            '<div class="tbrs-timer-track"><div id="f1Bar" class="tbrs-timer-fill"></div></div>' +
            '<div class="simul-poly-target">' + Core.renderPolySVG(tk.targetPoints) + "</div>" +
            '<div class="visual-options-grid">' + vOpts + "</div></div>";
          startCountdownBar(document.getElementById("f1Bar"), tk.deadlineMs);
          var vbs = a.stage.querySelectorAll(".visual-opt-btn");
          for (var v = 0; v < vbs.length; v += 1) {
            vbs[v].addEventListener("click", function (ev) {
              finishTask(Number(ev.currentTarget.getAttribute("data-o")) === tk.correctIndex);
            });
          }
        }
        addTimer(function () { finishTask(false); }, tk.deadlineMs);
      }

      function commitRecall(hits, taskOk) {
        var weight = taskOk ? 1.0 : 0.5;
        cellScores[tr.cell].push(Math.round((hits / 4) * 100 * weight));
        idx += 1;
        addTimer(nextTrial, 180);
      }

      function recallWords(taskOk) {
        var picks = [];
        function draw() {
          var sl = "";
          for (var s = 0; s < 4; s += 1) {
            var val = picks[s];
            sl += '<div class="slot-pill' + (val ? " is-filled" : s === picks.length ? " is-active" : "") + '">' +
              (val ? (val === "__F__" ? "؟" : esc(val)) : (s + 1)) + "</div>";
          }
          var kh = tr.wordPool.map(function (w) {
            return '<button type="button" class="key-btn" data-w="' + esc(w) + '"' + (picks.indexOf(w) !== -1 ? " disabled" : "") + ">" + esc(w) + "</button>";
          }).join("");
          a.stage.innerHTML =
            '<div class="task-box"><p class="task-question">رتّب الكلمات (1 ← 4):</p>' +
            '<div class="recall-slots">' + sl + '</div><div class="keypad-grid">' + kh + "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="f1Forgot" type="button" class="btn-forgot">نسيت ؟</button>' +
            '<button id="f1Undo" type="button" class="btn-undo"' + (picks.length === 0 ? " disabled" : "") + ">تراجع</button>" +
            "</div></div>";
          var kbs = a.stage.querySelectorAll(".key-btn");
          for (var b = 0; b < kbs.length; b += 1) {
            kbs[b].addEventListener("click", function (ev) { push(ev.currentTarget.getAttribute("data-w")); });
          }
          document.getElementById("f1Forgot").addEventListener("click", function () { push("__F__"); });
          document.getElementById("f1Undo").addEventListener("click", function () {
            if (picks.length > 0) { picks.pop(); draw(); }
          });
        }
        function push(v) {
          picks.push(v);
          if (picks.length === 4) {
            var h = 0;
            for (var i = 0; i < 4; i += 1) if (picks[i] === tr.words[i]) h += 1;
            commitRecall(h, taskOk);
          } else draw();
        }
        draw();
      }

      function recallCorsi(taskOk) {
        var picks = [];
        function draw() {
          var gh = "";
          for (var c = 0; c < 16; c += 1) {
            var pIdx = picks.indexOf(c);
            gh += '<button type="button" class="corsi-cell' + (pIdx !== -1 ? " is-picked" : "") + '" data-c="' + c + '"' +
              (pIdx !== -1 ? " disabled" : "") + ">" + (pIdx !== -1 ? (pIdx + 1) : "") + "</button>";
          }
          a.stage.innerHTML =
            '<div class="task-box"><p class="task-question">انقر المربعات بالترتيب (<span class="ltr-iso">' + picks.length + '/4</span>):</p>' +
            '<div class="corsi-grid">' + gh + "</div>" +
            '<div class="arena-utility-row">' +
            '<button id="f1CForgot" type="button" class="btn-forgot">نسيت ؟</button>' +
            '<button id="f1CUndo" type="button" class="btn-undo"' + (picks.length === 0 ? " disabled" : "") + ">تراجع</button>" +
            "</div></div>";
          var cbs = a.stage.querySelectorAll(".corsi-cell");
          for (var b = 0; b < cbs.length; b += 1) {
            cbs[b].addEventListener("click", function (ev) { push(Number(ev.currentTarget.getAttribute("data-c"))); });
          }
          document.getElementById("f1CForgot").addEventListener("click", function () { push(-1); });
          document.getElementById("f1CUndo").addEventListener("click", function () {
            if (picks.length > 0) { picks.pop(); draw(); }
          });
        }
        function push(v) {
          picks.push(v);
          if (picks.length === 4) {
            var h = 0;
            for (var i = 0; i < 4; i += 1) if (picks[i] === tr.corsiPath[i]) h += 1;
            commitRecall(h, taskOk);
          } else draw();
        }
        draw();
      }
    }

    nextTrial();
  }

  /* ================= F2: ARTICULATORY SUPPRESSION ================= */
  function runF2() {
    var Core = getCore();
    var trials = Core.generateF2Trials();
    var idx = 0;
    var spSilent = [], spVocal = [], relSilent = [], relVocal = [];
    var rtSilent = [], rtVocal = [];
    var tongueFreezeCount = 0;
    var replayUsed = {};
    var a = domArena();

    function pacerHtml(mode) {
      if (mode !== "vocal") {
        return '<div class="stim-label">صامت كالمعتاد</div>';
      }
      return '<div class="suppression-pacer"><span id="supBeatDot" class="pacer-dot is-beat"></span><span>ردّد بصوت مسموع متصل: واحد — اثنان</span></div>';
    }

    function startPacerIfVocal(mode) {
      if (mode !== "vocal") return;
      var on = true;
      addInterval(function () {
        var d = document.getElementById("supBeatDot");
        if (d) {
          on = !on;
          d.classList.toggle("is-beat", on);
        }
      }, 580);
    }

    function nextTrial() {
      clearTimers();
      if (idx >= trials.length) {
        var sSil = mean(spSilent);
        var sVoc = mean(spVocal);
        var drop = Math.max(0, sSil - sVoc);
        var rSil = mean(relSilent);
        var rVoc = mean(relVocal);
        var rtS = mean(rtSilent);
        var rtV = mean(rtVocal);
        Core.saveExperimentResult("f2_suppression", {
          spatialSilentPct: sSil,
          spatialVocalPct: sVoc,
          spatialDropPct: drop,
          relSilentPct: rSil,
          relVocalPct: rVoc,
          relRtSilentMs: rtS,
          relRtVocalMs: rtV,
          tongueFreezeCount: tongueFreezeCount
        });
        return showExperimentResult(
          "f2_suppression",
          sVoc + "%",
          [
            { label: "مربعات (صامت مقابل كتم اللسان)", val: sSil + "% / " + sVoc + "%" },
            { label: "هبوط الفضاء بكتم اللسان", val: "-" + drop + "%" },
            { label: "عكس الصفات (صامت / كتم)", val: rSil + "% / " + rVoc + "%" },
            { label: "زمن عكس الصفة (صامت / كتم)", val: rtS + " / " + rtV + " ms" },
            { label: "توقف اللسان القسري للتفكير", val: String(tongueFreezeCount) }
          ],
          Core.computeVerdictSummary().verdicts[1]
        );
      }

      var tr = trials[idx];
      setHeader("F2 · كتم اللسان الصوتي", (idx + 1) + " / " + trials.length);

      a.stage.innerHTML =
        '<div class="stimulus-card">' +
        pacerHtml(tr.mode) +
        '<div class="stim-step-text">' +
        (tr.mode === "vocal" ? "ابدأ الآن بترديد «واحد — اثنان» بصوت مسموع متصل" : "جولة صامتة اعتيادية") +
        '</div><button id="f2GoBtn" type="button" class="btn-primary"><span>ابدأ الجولة</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
      startPacerIfVocal(tr.mode);

      var go = function () {
        clearTimers();
        if (tr.kind === "corsi5") runCorsi5(tr);
        else runRelFlip(tr);
      };
      document.getElementById("f2GoBtn").addEventListener("click", go);
      bindKeys(function (ev) {
        if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); go(); }
      });
    }

    function afterTrialCheck(tr, commitFn) {
      clearTimers();
      if (tr.mode !== "vocal") {
        commitFn();
        idx += 1;
        return addTimer(nextTrial, 180);
      }
      a.stage.innerHTML =
        '<div class="task-box">' +
        '<p class="task-question">هل استمر لسانك بترديد «واحد — اثنان» طوال الجولة دون انقطاع؟</p>' +
        '<div class="result-actions">' +
        '<button id="f2Kept" type="button" class="btn-primary"><span>نعم، استمر دون توقف</span><kbd class="kbd-on-btn ltr-iso">Enter</kbd></button>' +
        '<button id="f2Froze" type="button" class="btn-ghost">توقف لساني أثناء التفكير (سجّل وأعد)</button>' +
        "</div></div>";

      var confirmKept = function () {
        clearTimers();
        commitFn();
        idx += 1;
        nextTrial();
      };
      document.getElementById("f2Kept").addEventListener("click", confirmKept);
      document.getElementById("f2Froze").addEventListener("click", function () {
        clearTimers();
        tongueFreezeCount += 1;
        var used = replayUsed[idx] || 0;
        if (used < 2) {
          replayUsed[idx] = used + 1;
          var fresh = getCore().generateF2Trials();
          for (var f = 0; f < fresh.length; f += 1) {
            if (fresh[f].kind === tr.kind && fresh[f].mode === "vocal") {
              trials[idx] = fresh[f];
              break;
            }
          }
          nextTrial();
        } else {
          commitFn();
          idx += 1;
          nextTrial();
        }
      });
      bindKeys(function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); confirmKept(); }
      });
    }

    function runCorsi5(tr) {
      startPacerIfVocal(tr.mode);
      var step = 0;
      function flash() {
        if (step >= 5) return askGrid();
        var lit = tr.corsiPath[step];
        var gh = "";
        for (var c = 0; c < 16; c += 1) {
          gh += '<button type="button" class="corsi-cell' + (c === lit ? " is-lit" : "") + '" disabled></button>';
        }
        a.stage.innerHTML =
          '<div class="stimulus-card">' + pacerHtml(tr.mode) +
          '<div class="stim-label"><span class="ltr-iso">' + (step + 1) + ' / 5</span></div>' +
          '<div class="corsi-grid">' + gh + "</div></div>";
        addTimer(function () {
          step += 1;
          flash();
        }, 900);
      }
      function askGrid() {
        var picks = [];
        function draw() {
          var gh = "";
          for (var c = 0; c < 16; c += 1) {
            var pIdx = picks.indexOf(c);
            gh += '<button type="button" class="corsi-cell' + (pIdx !== -1 ? " is-picked" : "") + '" data-c="' + c + '"' +
              (pIdx !== -1 ? " disabled" : "") + ">" + (pIdx !== -1 ? (pIdx + 1) : "") + "</button>";
          }
          a.stage.innerHTML =
            '<div class="task-box">' + pacerHtml(tr.mode) +
            '<p class="task-question">انقر المربعات الخمسة بترتيبها (<span class="ltr-iso">' + picks.length + '/5</span>):</p>' +
            '<div class="corsi-grid">' + gh + "</div>" +
            '<div class="arena-utility-row"><button id="f2Forgot" type="button" class="btn-forgot">نسيت ؟</button></div></div>';
          var cbs = a.stage.querySelectorAll(".corsi-cell");
          for (var b = 0; b < cbs.length; b += 1) {
            cbs[b].addEventListener("click", function (ev) { push(Number(ev.currentTarget.getAttribute("data-c"))); });
          }
          document.getElementById("f2Forgot").addEventListener("click", function () { push(-1); });
        }
        function push(v) {
          picks.push(v);
          if (picks.length === 5) {
            var h = 0;
            for (var i = 0; i < 5; i += 1) if (picks[i] === tr.corsiPath[i]) h += 1;
            var pct = Math.round((h / 5) * 100);
            afterTrialCheck(tr, function () {
              if (tr.mode === "vocal") spVocal.push(pct);
              else spSilent.push(pct);
            });
          } else draw();
        }
        draw();
      }
      flash();
    }

    function runRelFlip(tr) {
      startPacerIfVocal(tr.mode);
      var pIdx = 0;
      var tStart = nowMs();
      function showP() {
        unbindKeys();
        if (pIdx >= 2) return showQ();
        a.stage.innerHTML =
          '<div class="stimulus-card">' + pacerHtml(tr.mode) +
          '<div class="stim-label"><span class="ltr-iso">' + (pIdx + 1) + ' / 2</span></div>' +
          '<div class="stim-step-text">' + esc(tr.premises[pIdx]) + "</div>" +
          '<button id="f2NextP" type="button" class="btn-primary"><span>' + (pIdx === 0 ? "التالي" : "السؤال") + '</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
        var adv = function () { pIdx += 1; showP(); };
        document.getElementById("f2NextP").addEventListener("click", adv);
        bindKeys(function (ev) {
          if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); adv(); }
        });
      }
      function showQ() {
        var oh = tr.options.map(function (o) {
          return '<button type="button" class="opt-btn" data-o="' + esc(o) + '">' + esc(o) + "</button>";
        }).join("");
        a.stage.innerHTML =
          '<div class="task-box">' + pacerHtml(tr.mode) +
          '<p class="task-question">' + esc(tr.question) + "</p>" +
          '<div class="options-grid">' + oh + "</div></div>";
        var bs = a.stage.querySelectorAll(".opt-btn");
        for (var b = 0; b < bs.length; b += 1) {
          bs[b].addEventListener("click", function (ev) {
            var chosen = ev.currentTarget.getAttribute("data-o");
            var rt = Math.round(nowMs() - tStart);
            var ok = chosen === tr.answer ? 100 : 0;
            afterTrialCheck(tr, function () {
              if (tr.mode === "vocal") { relVocal.push(ok); rtVocal.push(rt); }
              else { relSilent.push(ok); rtSilent.push(rt); }
            });
          });
        }
      }
      showP();
    }

    nextTrial();
  }

  /* ================= F3: SPATIAL SLOTS VS CENTRAL VERBAL ================= */
  function runF3() {
    var Core = getCore();
    var trials = Core.generateF3Trials();
    var idx = 0;
    var vHits = 0, vTot = 0, sHits = 0, sTot = 0;
    var vSwaps = 0, sSwaps = 0;
    var a = domArena();

    function renderThreeBoxes(activeIdx, contentList) {
      var html = '<div class="spatial-slots-stage">';
      for (var i = 0; i < 3; i += 1) {
        var cls = "spatial-slot-box" + (i === 2 ? " slot-bottom" : "") + (i === activeIdx ? " is-active" : "");
        html += '<div class="' + cls + '"><span class="ltr-iso math-expr">' + contentList[i] + "</span></div>";
      }
      html += "</div>";
      return html;
    }

    function nextTrial() {
      clearTimers();
      if (idx >= trials.length) {
        var verbal3Pct = Math.round((vHits / Math.max(1, vTot)) * 100);
        var spatial3Pct = Math.round((sHits / Math.max(1, sTot)) * 100);
        var delta = spatial3Pct - verbal3Pct;
        Core.saveExperimentResult("f3_spatial_slots", {
          verbal3Pct: verbal3Pct,
          spatial3Pct: spatial3Pct,
          spatialRescueDeltaPct: delta,
          verbalSwapErrors: vSwaps,
          spatialSwapErrors: sSwaps
        });
        return showExperimentResult(
          "f3_spatial_slots",
          spatial3Pct + "%",
          [
            { label: "تحديث نصي مركزي (3 متغيرات)", val: verbal3Pct + "%" },
            { label: "تحديث في 3 صناديق مكانية ثابتة", val: spatial3Pct + "%" },
            { label: "أثر الإنقاذ المكاني", val: (delta > 0 ? "+" : "") + delta + "%" },
            { label: "خلط الأصناف (نصي / مكاني)", val: vSwaps + " / " + sSwaps }
          ],
          Core.computeVerdictSummary().verdicts[2]
        );
      }

      var tr = trials[idx];
      setHeader("F3 · الإنقاذ المكاني للمتغيرات", (idx + 1) + " / " + trials.length);

      if (tr.mode === "verbal") {
        a.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label">البداية (نصي مركزي)</div>' +
          '<div class="stim-step-text">ألف: <span class="ltr-iso">' + tr.initial[0] +
          '</span> &nbsp;|&nbsp; باء: <span class="ltr-iso">' + tr.initial[1] +
          '</span> &nbsp;|&nbsp; جيم: <span class="ltr-iso">' + tr.initial[2] + "</span></div>" +
          '<button id="f3Start" type="button" class="btn-primary"><span>ابدأ</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
      } else {
        a.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label">احفظ رقم كل صندوق في مكانه</div>' +
          renderThreeBoxes(-1, [String(tr.initial[0]), String(tr.initial[1]), String(tr.initial[2])]) +
          '<button id="f3Start" type="button" class="btn-primary"><span>ابدأ</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
      }

      var sIdx = 0;
      var startSteps = function () {
        clearTimers();
        showStep();
      };
      document.getElementById("f3Start").addEventListener("click", startSteps);
      bindKeys(function (ev) {
        if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); startSteps(); }
      });

      function showStep() {
        clearTimers();
        if (sIdx >= tr.steps.length) return askQuery(0);
        var st = tr.steps[sIdx];
        if (tr.mode === "verbal") {
          a.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' + (sIdx + 1) + ' / 5</span></div>' +
            '<div class="tbrs-timer-track"><div id="f3Bar" class="tbrs-timer-fill"></div></div>' +
            '<div class="stim-step-text">' + esc(st.verbalText) + "</div>" +
            '<button id="f3Next" type="button" class="btn-primary"><span>التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
        } else {
          var labels = ["•", "•", "•"];
          labels[st.slotIdx] = esc(st.text);
          a.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label"><span class="ltr-iso">' + (sIdx + 1) + ' / 5</span></div>' +
            '<div class="tbrs-timer-track"><div id="f3Bar" class="tbrs-timer-fill"></div></div>' +
            renderThreeBoxes(st.slotIdx, labels) +
            '<button id="f3Next" type="button" class="btn-primary"><span>التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
        }
        startCountdownBar(document.getElementById("f3Bar"), 8500);
        var adv = function () { clearTimers(); sIdx += 1; showStep(); };
        document.getElementById("f3Next").addEventListener("click", adv);
        addTimer(adv, 8500);
        bindKeys(function (ev) {
          if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); adv(); }
        });
      }

      function askQuery(qPos) {
        clearTimers();
        if (qPos >= 3) {
          idx += 1;
          return addTimer(nextTrial, 180);
        }
        var targetSlot = tr.queryOrder[qPos];
        var pad = "";
        for (var n = 1; n <= 9; n += 1) {
          pad += '<button type="button" class="key-btn" data-n="' + n + '">' + n + "</button>";
        }

        if (tr.mode === "verbal") {
          a.stage.innerHTML =
            '<div class="task-box"><div class="stim-label"><span class="ltr-iso">' + (qPos + 1) + ' / 3</span></div>' +
            '<p class="task-question">' + esc(tr.vars[targetSlot]) + " = ؟</p>" +
            '<div class="keypad-grid is-numpad">' + pad + "</div>" +
            '<div class="arena-utility-row"><button id="f3Forgot" type="button" class="btn-forgot">نسيت الرقم ؟</button></div></div>';
        } else {
          var qLabels = ["", "", ""];
          qLabels[targetSlot] = "؟";
          a.stage.innerHTML =
            '<div class="task-box"><div class="stim-label">كم صار هذا الصندوق؟ (<span class="ltr-iso">' + (qPos + 1) + '/3</span>)</div>' +
            renderThreeBoxes(targetSlot, qLabels) +
            '<div class="keypad-grid is-numpad">' + pad + "</div>" +
            '<div class="arena-utility-row"><button id="f3Forgot" type="button" class="btn-forgot">نسيت الرقم ؟</button></div></div>';
        }

        var submit = function (val) {
          clearTimers();
          var ans = tr.final[targetSlot];
          var isSwap = val !== ans && tr.final.indexOf(val) !== -1;
          if (tr.mode === "verbal") {
            vTot += 1;
            if (val === ans) vHits += 1;
            else if (isSwap) vSwaps += 1;
          } else {
            sTot += 1;
            if (val === ans) sHits += 1;
            else if (isSwap) sSwaps += 1;
          }
          askQuery(qPos + 1);
        };

        var bs = a.stage.querySelectorAll(".key-btn");
        for (var b = 0; b < bs.length; b += 1) {
          bs[b].addEventListener("click", function (ev) { submit(Number(ev.currentTarget.getAttribute("data-n"))); });
        }
        document.getElementById("f3Forgot").addEventListener("click", function () { submit(-1); });
        bindKeys(function (ev) {
          if (/^[1-9]$/.test(ev.key)) { ev.preventDefault(); submit(Number(ev.key)); }
        });
      }
    }

    nextTrial();
  }

  /* ================= F4: POLARITY-FLIP DISSECTION ================= */
  function runF4() {
    var Core = getCore();
    var trials = Core.generateF4Trials();
    var idx = 0;
    var linRts = [], flipVRts = [], flipARts = [];
    var linAcc = [], flipVAcc = [], flipAAcc = [], signAcc = [];
    var sameStepRts = [], flipStepRts = [];
    var a = domArena();

    function nextTrial() {
      clearTimers();
      if (idx >= trials.length) {
        var linRtMs = mean(linRts);
        var flipVerbalRtMs = mean(flipVRts);
        var flipAxisRtMs = mean(flipARts);
        var verbalFlipCostMs = flipVerbalRtMs - linRtMs;
        var axisFlipCostMs = flipAxisRtMs - linRtMs;
        var axisReliefPct = verbalFlipCostMs > 400
          ? Math.max(0, Math.min(100, Math.round(((verbalFlipCostMs - axisFlipCostMs) / verbalFlipCostMs) * 100)))
          : 0;
        var nonSpatialRuleFlipCostMs = Math.max(0, mean(flipStepRts) - mean(sameStepRts));

        Core.saveExperimentResult("f4_polarity_axis", {
          linAccPct: mean(linAcc),
          flipVerbalAccPct: mean(flipVAcc),
          flipAxisAccPct: mean(flipAAcc),
          signAccPct: mean(signAcc),
          linRtMs: linRtMs,
          flipVerbalRtMs: flipVerbalRtMs,
          flipAxisRtMs: flipAxisRtMs,
          verbalFlipCostMs: verbalFlipCostMs,
          axisFlipCostMs: axisFlipCostMs,
          axisReliefPct: axisReliefPct,
          nonSpatialRuleFlipCostMs: nonSpatialRuleFlipCostMs
        });

        var fmtS = function (v) { return v > 0 ? "+" + v + " ms" : v < 0 ? "-" + Math.abs(v) + " ms" : "0 ms"; };
        return showExperimentResult(
          "f4_polarity_axis",
          fmtS(axisFlipCostMs),
          [
            { label: "ضريبة القلب اللفظي المجرد", val: fmtS(verbalFlipCostMs) },
            { label: "ضريبة القلب مع المسطرة البصرية", val: fmtS(axisFlipCostMs) },
            { label: "نسبة انمحاء الضريبة بالمسطرة", val: axisReliefPct + "%" },
            { label: "كلفة عكس الإشارة غير المكاني", val: fmtS(nonSpatialRuleFlipCostMs) },
            { label: "دقة المقلوب (مجرد / بمسطرة)", val: mean(flipVAcc) + "% / " + mean(flipAAcc) + "%" }
          ],
          Core.computeVerdictSummary().verdicts[3]
        );
      }

      var tr = trials[idx];
      setHeader("F4 · تشريح ضريبة القلب", (idx + 1) + " / " + trials.length);

      if (tr.kind === "rel") {
        var pIdx = 0;
        var tTotal0 = nowMs();
        var axisTop = tr.cond === "flipped_axis"
          ? '<div class="axis-guide-bar"><span>الأدنى (1)</span><span>◄─── الأوسط (2) ───►</span><span>الأعلى (3)</span></div>'
          : "";

        var showP = function () {
          clearTimers();
          if (pIdx >= 2) return showQ();
          var hintHtml = "";
          if (tr.axisHints && tr.axisHints[pIdx]) {
            var rawHint = String(tr.axisHints[pIdx]);
            var hParts = rawHint.split("◄──");
            if (hParts.length === 2) {
              hintHtml =
                '<div class="axis-hint-pill"><span>' + esc(hParts[0].trim()) +
                '</span><span class="ltr-iso">◄──</span><span>' + esc(hParts[1].trim()) + "</span></div>";
            } else {
              hintHtml = '<div class="axis-hint-pill"><span>' + esc(rawHint) + "</span></div>";
            }
          }
          a.stage.innerHTML =
            '<div class="stimulus-card">' + axisTop +
            '<div class="stim-label"><span class="ltr-iso">' + (pIdx + 1) + ' / 2</span></div>' +
            '<div class="stim-step-text">' + esc(tr.premises[pIdx]) + "</div>" +
            hintHtml +
            '<button id="f4Next" type="button" class="btn-primary"><span>' + (pIdx === 0 ? "التالي" : "السؤال") + '</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
          var adv = function () { pIdx += 1; showP(); };
          document.getElementById("f4Next").addEventListener("click", adv);
          bindKeys(function (ev) {
            if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); adv(); }
          });
        };

        var showQ = function () {
          var oh = tr.options.map(function (o) {
            return '<button type="button" class="opt-btn" data-o="' + esc(o) + '">' + esc(o) + "</button>";
          }).join("");
          a.stage.innerHTML =
            '<div class="task-box">' + axisTop +
            '<p class="task-question">' + esc(tr.question) + "</p>" +
            '<div class="options-grid">' + oh + "</div></div>";
          var bs = a.stage.querySelectorAll(".opt-btn");
          for (var b = 0; b < bs.length; b += 1) {
            bs[b].addEventListener("click", function (ev) {
              var rt = Math.round(nowMs() - tTotal0);
              var hit = ev.currentTarget.getAttribute("data-o") === tr.answer ? 100 : 0;
              if (tr.cond === "linear_verbal") { linRts.push(rt); linAcc.push(hit); }
              else if (tr.cond === "flipped_verbal") { flipVRts.push(rt); flipVAcc.push(hit); }
              else { flipARts.push(rt); flipAAcc.push(hit); }
              idx += 1;
              addTimer(nextTrial, 180);
            });
          }
        };

        showP();
      } else {
        a.stage.innerHTML =
          '<div class="stimulus-card"><div class="stim-label">قاعدة غير مكانية</div>' +
          '<div class="stim-step-text">البداية: <span class="ltr-iso">' + tr.startVal +
          "</span> &nbsp;|&nbsp; القاعدة: <strong>" + esc(tr.baseRule) + "</strong></div>" +
          '<button id="f4SGo" type="button" class="btn-primary"><span>ابدأ</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';

        var sStep = 0;
        var runSignStep = function () {
          clearTimers();
          if (sStep >= 2) {
            var oh = tr.options.map(function (o) {
              return '<button type="button" class="opt-btn" data-o="' + esc(o) + '"><span class="ltr-iso">' + esc(o) + "</span></button>";
            }).join("");
            a.stage.innerHTML =
              '<div class="task-box"><p class="task-question">الناتج النهائي = ؟</p>' +
              '<div class="options-grid">' + oh + "</div></div>";
            var bs = a.stage.querySelectorAll(".opt-btn");
            for (var b = 0; b < bs.length; b += 1) {
              bs[b].addEventListener("click", function (ev) {
                signAcc.push(ev.currentTarget.getAttribute("data-o") === tr.answer ? 100 : 0);
                idx += 1;
                addTimer(nextTrial, 180);
              });
            }
            return;
          }
          var stObj = tr.steps[sStep];
          var t0 = nowMs();
          a.stage.innerHTML =
            '<div class="stimulus-card"><div class="stim-label">خطوة <span class="ltr-iso">' + (sStep + 1) + ' / 2</span></div>' +
            '<div class="stim-step-text">' + esc(stObj.label) + "</div>" +
            '<button id="f4SNext" type="button" class="btn-primary"><span>تم الحساب — التالي</span><kbd class="kbd-on-btn ltr-iso">Space</kbd></button></div>';
          var adv = function () {
            var rt = Math.round(nowMs() - t0);
            if (stObj.ruleMode === "same") sameStepRts.push(rt);
            else flipStepRts.push(rt);
            sStep += 1;
            runSignStep();
          };
          document.getElementById("f4SNext").addEventListener("click", adv);
          bindKeys(function (ev) {
            if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); adv(); }
          });
        };

        document.getElementById("f4SGo").addEventListener("click", runSignStep);
        bindKeys(function (ev) {
          if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); runSignStep(); }
        });
      }
    }

    nextTrial();
  }

  /* ================= DASHBOARD PANEL RENDERER ================= */
  function render() {
    var Core = getCore();
    if (!Core) return;
    var target = mountEl || document.getElementById("falsifyMount");
    if (!target) return;
    mountEl = target;

    var st = Core.loadState();
    var summary = Core.computeVerdictSummary(st);
    var res = st.results || {};

    var vListHtml = summary.verdicts.map(function (v) {
      return "<li>" + formatRichTextHtml(v) + "</li>";
    }).join("");

    var cardsHtml = Core.EXPERIMENTS.map(function (exp) {
      var r = res[exp.id];
      var shortCode = exp.shortCode || String(exp.code || "").split("·")[0].trim();
      var statusHtml = '<span class="probe-status-pill">' + formatRichTextHtml(exp.metaChip || "غير منفذ بعد") + "</span>";
      if (r) {
        var mTxt = "";
        if (exp.id === "f1_crossmodal") mTxt = "مربعات+حساب " + r.svPct + "% · كلمات+حساب " + r.vvPct + "%";
        else if (exp.id === "f2_suppression") mTxt = "كتم اللسان " + r.spatialVocalPct + "% · توقف " + r.tongueFreezeCount;
        else if (exp.id === "f3_spatial_slots") mTxt = "مكاني " + r.spatial3Pct + "% · نصي " + r.verbal3Pct + "%";
        else if (exp.id === "f4_polarity_axis") mTxt = "انمحاء الضريبة " + r.axisReliefPct + "%";
        statusHtml = '<span class="probe-status-pill is-done">' + formatRichTextHtml(mTxt) + "</span>";
      }
      return (
        '<article class="probe-card">' +
        '<div class="probe-badges">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
        '<span class="probe-code ltr-iso">' + esc(shortCode) + "</span>" +
        (exp.domainTag ? '<span class="probe-role-tag">' + esc(exp.domainTag) + "</span>" : "") +
        "</div>" +
        statusHtml +
        "</div>" +
        '<h3 class="card-title">' + esc(exp.title) + "</h3>" +
        '<p class="card-subtitle">' + formatRichTextHtml(exp.targetQuestion) + "</p>" +
        '<button type="button" class="btn-start-probe btn-run-falsify-one" data-f-id="' + esc(exp.id) + '">' +
        (r ? "إعادة تشغيل هذه التجربة" : "بدء هذه التجربة منفردة") +
        "</button>" +
        "</article>"
      );
    }).join("");

    target.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
      '<section class="card">' +
      '<div>' +
      '<h2 class="section-title">مختبر الحسم والتكذيب الجراحي (4 تجارب فاصلة — 30 جولة)</h2>' +
      '<p class="section-sub">يفحص بالتجربة المضادة فرضية انحشار الحفظ والحساب في قناة لفظية واحدة وغياب المسودة المكانية، لفصل ما هو بنيوي عما هو كيميائي قابل للعلاج.</p>' +
      "</div>" +
      '<div class="suite-toolbar">' +
      '<div class="suite-primary-actions">' +
      '<button id="btnRunFullFalsify" type="button" class="btn-primary">بدء بطارية الحسم الكاملة — 4 تجارب متتالية</button>' +
      "</div>" +
      '<div class="suite-util-actions">' +
      '<button id="btnSyncFalsifyRepo" type="button" class="btn-repo-save" data-repo-save-btn>حفظ النتائج في الريبو</button>' +
      '<button id="btnCopyFalsifyReport" type="button" class="btn-ghost">نسخ تقرير الحسم</button>' +
      '<button id="btnResetFalsify" type="button" class="btn-danger">' + (resetArmed ? "اضغط ثانية لتأكيد المسح" : "مسح السجل") + "</button>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<div class="falsify-grid">' + cardsHtml + "</div>" +
      '<section class="card verdict-box">' +
      '<h3 class="section-title" style="margin-bottom:4px;">' + formatRichTextHtml(summary.overallHeadline) + "</h3>" +
      '<ol class="verdict-list">' + vListHtml + "</ol>" +
      "</section>" +
      "</div>";

    var fullBtn = document.getElementById("btnRunFullFalsify");
    if (fullBtn) fullBtn.addEventListener("click", startFullBattery);

    var copyBtn = document.getElementById("btnCopyFalsifyReport");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = summary.plainTextReport;
        var markCopied = function () {
          copyBtn.textContent = "تم نسخ تقرير الحسم";
          setTimeout(function () { copyBtn.textContent = "نسخ تقرير الحسم"; }, 1800);
        };
        var fallbackCopy = function () {
          var area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "readonly");
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          try { if (document.execCommand("copy")) markCopied(); } catch (_) {}
          document.body.removeChild(area);
        };
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          try {
            navigator.clipboard.writeText(text).then(markCopied).catch(fallbackCopy);
            return;
          } catch (_) {}
        }
        fallbackCopy();
      });
    }

    var resetBtn = document.getElementById("btnResetFalsify");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!resetArmed) {
          resetArmed = true;
          resetBtn.textContent = "اضغط ثانية لتأكيد المسح";
          clearTimeout(resetTimer);
          resetTimer = setTimeout(function () {
            resetArmed = false;
            render();
          }, 3800);
          return;
        }
        clearTimeout(resetTimer);
        resetArmed = false;
        Core.clearState();
        render();
      });
    }

    var oneBtns = target.querySelectorAll(".btn-run-falsify-one");
    for (var i = 0; i < oneBtns.length; i += 1) {
      oneBtns[i].addEventListener("click", function (ev) {
        startExperiment(ev.currentTarget.getAttribute("data-f-id"));
      });
    }

    if (root.NeuroLab && root.NeuroLab.RepoSync && typeof root.NeuroLab.RepoSync.refreshUi === "function") {
      try { root.NeuroLab.RepoSync.refreshUi(); } catch (_) {}
    }
  }

  function init(opts) {
    if (opts && opts.mountEl) mountEl = opts.mountEl;
    render();
  }

  root.NeuroLab.Falsify = {
    init: init,
    render: render,
    startFullBattery: startFullBattery,
    startExperiment: startExperiment,
    abort: abort,
    getState: function () { return getCore().loadState(); },
    computeVerdictSummary: function () { return getCore().computeVerdictSummary(); }
  };
})();

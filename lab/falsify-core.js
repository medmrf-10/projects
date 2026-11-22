(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var STORAGE_KEY = "neurolab_falsify_v1";

  var EXPERIMENTS = [
    {
      id: "f1_crossmodal",
      order: 1,
      code: "F1 · 2×2",
      shortCode: "F1",
      domainTag: "تقاطع القنوات · لفظي × مكاني",
      metaChip: "8 جولات · ~2 د",
      title: "مصفوفة التقاطع ثنائية القنوات (لفظي × مكاني)",
      shortTitle: "تقاطع القنوات",
      targetQuestion: "هل تملك مسودة مكانية مسطحة (2D) مستقلة عن القناة اللفظية، وهل المسح لفظي خاص أم انتباهي عام؟",
      instructions: [
        "احفظ التسلسل: 4 كلمات أو 4 مربعات مضيئة بترتيب ظهورها.",
        "حل المهمة الفاصلة: مسألة حسابية أو مطابقة شكل صامت قبل انتهاء الشريط.",
        "أعِد الترتيب: استرجع العناصر الأربعة بترتيبها من 1 إلى 4."
      ],
      flowSteps: [
        "حفظ 4 كلمات أو مربعات",
        "حساب أو شكل صامت",
        "استرجاع بالترتيب (1–4)"
      ],
      example: "4 مربعات مضيئة ← مسألة فاصلة ← نقر المربعات بالترتيب"
    },
    {
      id: "f2_suppression",
      order: 2,
      code: "F2 · SUP",
      shortCode: "F2",
      domainTag: "عزل التسميع الداخلي",
      metaChip: "8 جولات · ~2 د",
      title: "اختبار كتم اللسان الصوتي (واحد — اثنان)",
      shortTitle: "كتم اللسان الصوتي",
      targetQuestion: "هل يعتمد دماغك سرا على اللسان الداخلي لحفظ المواقع المكانية وعكس الصفات؟",
      instructions: [
        "الجولات الصامتة: احفظ المربعات أو اعكس الصفة كالمعتاد دون كلام.",
        "جولات كتم اللسان: ردّد بصوت مسموع ومتصل «واحد — اثنان» طوال الجولة دون أي توقف.",
        "تأكيد الاستمرار: حدّد بعد جولة الكتم إن استمر لسانك متصلا أو توقف عفويا أثناء التفكير."
      ],
      flowSteps: [
        "ترديد «واحد — اثنان» بصوت مسموع",
        "5 مربعات أو عكس صفة",
        "تأكيد استمرار اللسان"
      ],
      example: "ترديد مسموع متصل «واحد — اثنان» + حفظ 5 مربعات أو عكس صفة"
    },
    {
      id: "f3_spatial_slots",
      order: 3,
      code: "F3 · SLT",
      shortCode: "F3",
      domainTag: "الفرز المكاني مقابل النصي",
      metaChip: "6 جولات · ~2.5 د",
      title: "الإنقاذ المكاني لتحديث 3 متغيرات",
      shortTitle: "الإنقاذ المكاني للمتغيرات",
      targetQuestion: "هل انهيار الـ 3 متغيرات (23%) سببه غياب الفرز المكاني أم تسرب كيميائي جبهي يبقى حتى مع صناديق مكانية ثابتة؟",
      instructions: [
        "الجولات النصية: احفظ (ألف، باء، جيم) في الوسط وحدّث المتغير المذكور فقط.",
        "الجولات المكانية: احفظ رقم كل صندوق في موقعه الثابت وحدّث الصندوق المضيء فقط.",
        "الإجابة النهائية: أدخل الرقم النهائي لكل متغير أو صندوق عبر الأرقام (1–9)."
      ],
      flowSteps: [
        "حفظ 3 أرقام ابتدائية",
        "5 خطوات تحديث متتابعة",
        "إدخال القيم النهائية (1–9)"
      ],
      example: "حفظ 3 صناديق مكانية ← تحديث الصندوق المضيء ← إدخال الرقم النهائي"
    },
    {
      id: "f4_polarity_axis",
      order: 4,
      code: "F4 · AXS",
      shortCode: "F4",
      domainTag: "تشريح عكس القطبية",
      metaChip: "8 جولات · ~2 د",
      title: "تشريح ضريبة عكس الصفات والمسطرة البصرية",
      shortTitle: "تشريح ضريبة القلب",
      targetQuestion: "هل ضريبة الـ +9.2 ثانية سببها غياب المسطرة المكانية الذهنية أم بطء تبديل القاعدة الجبهي العام؟",
      instructions: [
        "قراءة المقدمات: تقدّم بين البطاقتين بضغط (Space) فور استيعاب العلاقة.",
        "المسطرة البصرية: تظهر في بعض الجولات المقلوبة لمقارنة أثرها بالحل الذهني المجرد.",
        "عكس الإشارة: طبّق قاعدة الجمع أو اعكسها لطرح حسب تعليمة الخطوة بأسرع دقة."
      ],
      flowSteps: [
        "قراءة المقدمتين (Space)",
        "مقارنة مجردة أو بمسطرة أو إشارة",
        "اختيار الجواب الأسرع"
      ],
      example: "قراءة المقدمتين ← استنتاج الترتيب أو عكس القاعدة ← اختيار الجواب"
    }
  ];

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function getWordsPool() {
    var S = root.NeuroLab && root.NeuroLab.Stimuli;
    if (S && Array.isArray(S.ABSTRACT_WORDS) && S.ABSTRACT_WORDS.length >= 40) {
      return S.ABSTRACT_WORDS;
    }
    return [
      "شرط", "قصد", "عذر", "نفي", "سبب", "حكم", "وعد", "غرض",
      "فكرة", "خطة", "غاية", "قيمة", "فرصة", "خبرة", "ثقة", "أمل",
      "قرار", "نظام", "حوار", "نجاح", "هدوء", "يقين", "واجب", "نتيجة"
    ];
  }

  function getTriadsPool() {
    var S = root.NeuroLab && root.NeuroLab.Stimuli;
    if (S && Array.isArray(S.BINDING_TRIADS) && S.BINDING_TRIADS.length >= 6) {
      return S.BINDING_TRIADS;
    }
    return [
      {
        items: ["مشروع الشمال", "مشروع الجنوب", "مشروع الشرق", "مشروع الغرب", "مشروع الوسط", "مشروع الساحل"],
        more: "أكبر ميزانية من",
        less: "أصغر ميزانية من",
        askMax: "الأكبر ميزانية؟",
        askMin: "الأصغر ميزانية؟"
      }
    ];
  }

  function pickWords(count, excludeMap) {
    var used = excludeMap || {};
    var pool = shuffle(getWordsPool());
    var out = [];
    for (var i = 0; i < pool.length && out.length < count; i += 1) {
      var w = pool[i];
      if (!used[w]) {
        used[w] = true;
        out.push(w);
      }
    }
    return out;
  }

  function buildZeroLeakOptions(answer, optionCount, asStrings) {
    var numOpts = optionCount === 4 ? 4 : 6;
    var ans = Math.round(Number(answer) || 20);
    var bigStep = Math.random() < 0.5 ? 4 : 6;
    var numDoublets = numOpts / 2;
    var valid = [];
    for (var k = 0; k < numDoublets; k += 1) {
      for (var j = 0; j <= 1; j += 1) {
        var b0 = ans - k * bigStep - j;
        if (b0 >= 2) valid.push(b0);
      }
    }
    var base0 = valid.length > 0 ? valid[randInt(0, valid.length - 1)] : Math.max(2, ans - 1);
    var vals = [];
    for (var d = 0; d < numDoublets; d += 1) {
      vals.push(base0 + d * bigStep);
      vals.push(base0 + d * bigStep + 1);
    }
    if (vals.indexOf(ans) === -1) vals[0] = ans;
    var mixed = shuffle(vals);
    return asStrings ? mixed.map(String) : mixed;
  }

  function buildMathTask() {
    var a = randInt(5, 9);
    var b = randInt(4, 8);
    var prod = a * b;
    var addMode = Math.random() < 0.5;
    var maxSub = Math.min(14, prod - 16);
    var c = addMode ? randInt(5, 12) : randInt(4, Math.max(4, maxSub));
    var ans = addMode ? prod + c : prod - c;
    var prompt = addMode
      ? "(" + a + " × " + b + ") + " + c + " = ؟"
      : "(" + a + " × " + b + ") − " + c + " = ؟";
    return {
      kind: "math",
      prompt: prompt,
      options: buildZeroLeakOptions(ans, 6, true),
      answer: String(ans),
      deadlineMs: 8800
    };
  }

  function renderPolySVG(points) {
    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon points="' +
      points.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
      '" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="50" r="2.1" fill="currentColor" opacity="0.42"/>' +
      "</svg>"
    );
  }

  function buildSimulPolyTask() {
    var n = 7;
    var baseAngles = [];
    var offset = randInt(8, 42) * (Math.PI / 180);
    var baseRadii = [];
    for (var i = 0; i < n; i += 1) {
      baseAngles.push(offset + (i * 2 * Math.PI) / n + randInt(-4, 4) * (Math.PI / 180));
      baseRadii.push(randInt(21, 31));
    }
    var v0 = randInt(0, n - 1);
    var a1 = v0, a2 = (v0 + 3) % n, b1 = (v0 + 2) % n, b2 = (v0 + 5) % n;
    var magA = 11, magB = 11;

    function mkPts(bitA, bitB) {
      var r = baseRadii.slice();
      var tw = [0, 0, 0, 0, 0, 0, 0];
      if (bitA) { r[a1] += magA; r[a2] -= 9; tw[a1] = 0.1; }
      if (bitB) { r[b1] += magB; r[b2] -= 9; tw[b1] = -0.1; }
      var pts = [];
      for (var k = 0; k < n; k += 1) {
        var ang = baseAngles[k] + tw[k];
        var x = Math.round((50 + r[k] * Math.cos(ang)) * 10) / 10;
        var y = Math.round((50 + r[k] * Math.sin(ang)) * 10) / 10;
        pts.push([Math.max(8, Math.min(92, x)), Math.max(8, Math.min(92, y))]);
      }
      return pts;
    }

    var orbit = [mkPts(0, 0), mkPts(1, 0), mkPts(0, 1), mkPts(1, 1)];
    var tCorner = randInt(0, 3);
    var indexed = orbit.map(function (pts, idx) {
      return { isTarget: idx === tCorner, pts: pts };
    });
    var mixed = shuffle(indexed);
    var correctIdx = 0;
    var optPts = mixed.map(function (item, idx) {
      if (item.isTarget) correctIdx = idx;
      return item.pts;
    });

    return {
      kind: "poly",
      targetPoints: orbit[tCorner],
      optionsPoints: optPts,
      correctIndex: correctIdx,
      deadlineMs: 8800
    };
  }

  function pickCorsiPath(len) {
    var all = [];
    for (var i = 0; i < 16; i += 1) all.push(i);
    for (var att = 0; att < 80; att += 1) {
      var path = shuffle(all).slice(0, len);
      var rows = {}, cols = {};
      var adjSteps = 0;
      for (var k = 0; k < path.length; k += 1) {
        rows[Math.floor(path[k] / 4)] = true;
        cols[path[k] % 4] = true;
        if (k > 0) {
          var dr = Math.abs(Math.floor(path[k] / 4) - Math.floor(path[k - 1] / 4));
          var dc = Math.abs((path[k] % 4) - (path[k - 1] % 4));
          if (dr + dc === 1) adjSteps += 1;
        }
      }
      if (Object.keys(rows).length >= 2 && Object.keys(cols).length >= 2 && adjSteps <= len - 2) {
        return path;
      }
    }
    return [1, 10, 4, 15, 6].slice(0, len);
  }

  function generateF1Trials() {
    var cells = Math.random() < 0.5
      ? ["VV", "VS", "SV", "SS", "SS", "SV", "VS", "VV"]
      : ["SV", "VV", "SS", "VS", "VS", "SS", "VV", "SV"];
    var usedWords = {};
    var out = [];
    for (var i = 0; i < cells.length; i += 1) {
      var c = cells[i];
      var storageKind = c.charAt(0) === "V" ? "words" : "corsi";
      var procKind = c.charAt(1) === "V" ? "math" : "poly";
      var words = storageKind === "words" ? pickWords(4, usedWords) : [];
      var localEx = Object.assign({}, usedWords);
      var foils = storageKind === "words" ? pickWords(8, localEx) : [];
      out.push({
        trialIndex: i,
        cell: c,
        storageKind: storageKind,
        procKind: procKind,
        words: words,
        wordPool: storageKind === "words" ? shuffle(words.concat(foils)) : [],
        corsiPath: storageKind === "corsi" ? pickCorsiPath(4) : [],
        task: procKind === "math" ? buildMathTask() : buildSimulPolyTask()
      });
    }
    return out;
  }

  function buildInvertedRelItem(triad, withAxisHints, isLinear) {
    var dom = shuffle(triad.items);
    var ord = dom.slice(0, 3); // ord[0] < ord[1] < ord[2]
    var eMin = ord[0], eMid = ord[1], eMax = ord[2];
    var askMin = Math.random() < 0.5;
    var p1, p2, h1, h2;

    if (isLinear) {
      var useMore = Math.random() < 0.5;
      if (useMore) {
        p1 = eMax + " " + triad.more + " " + eMid;
        p2 = eMid + " " + triad.more + " " + eMin;
      } else {
        p1 = eMin + " " + triad.less + " " + eMid;
        p2 = eMid + " " + triad.less + " " + eMax;
      }
      if (Math.random() < 0.5) { var tmpL = p1; p1 = p2; p2 = tmpL; }
      return {
        premises: [p1, p2],
        axisHints: null,
        question: askMin ? triad.askMin : triad.askMax,
        options: shuffle(dom),
        answer: askMin ? eMin : eMax
      };
    }

    var midFirst = Math.random() < 0.5;
    var pairA = midFirst
      ? { text: eMid + " " + triad.less + " " + eMax, hint: eMid + "  ◄──  " + eMax }
      : { text: eMax + " " + triad.more + " " + eMid, hint: eMid + "  ◄──  " + eMax };
    var pairB = midFirst
      ? { text: eMid + " " + triad.more + " " + eMin, hint: eMin + "  ◄──  " + eMid }
      : { text: eMin + " " + triad.less + " " + eMid, hint: eMin + "  ◄──  " + eMid };

    var pairs = shuffle([pairA, pairB]);
    h1 = pairs[0].hint;
    h2 = pairs[1].hint;

    return {
      premises: [pairs[0].text, pairs[1].text],
      axisHints: withAxisHints ? [h1, h2] : null,
      question: askMin ? triad.askMin : triad.askMax,
      options: shuffle(dom),
      answer: askMin ? eMin : eMax
    };
  }

  function generateF2Trials() {
    var triads = shuffle(getTriadsPool());
    var specs = [
      { kind: "corsi5", mode: "silent" },
      { kind: "corsi5", mode: "vocal" },
      { kind: "rel_flip", mode: "silent" },
      { kind: "rel_flip", mode: "vocal" },
      { kind: "rel_flip", mode: "vocal" },
      { kind: "rel_flip", mode: "silent" },
      { kind: "corsi5", mode: "vocal" },
      { kind: "corsi5", mode: "silent" }
    ];
    var out = [];
    var rCounter = 0;
    for (var i = 0; i < specs.length; i += 1) {
      var sp = specs[i];
      if (sp.kind === "corsi5") {
        out.push({
          trialIndex: i,
          kind: "corsi5",
          mode: sp.mode,
          corsiPath: pickCorsiPath(5)
        });
      } else {
        var rel = buildInvertedRelItem(triads[rCounter % triads.length], false, false);
        rCounter += 1;
        out.push({
          trialIndex: i,
          kind: "rel_flip",
          mode: sp.mode,
          premises: rel.premises,
          question: rel.question,
          options: rel.options,
          answer: rel.answer
        });
      }
    }
    return out;
  }

  function buildSingle3VarTrial(trialIndex, mode) {
    var varNames = ["ألف", "باء", "جيم"];
    for (var att = 0; att < 500; att += 1) {
      var digs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      var init = [digs[0], digs[1], digs[2]];
      var cur = init.slice();
      var sched = shuffle([0, 1, 2]).concat(shuffle([0, 1]));
      var steps = [];
      var ok = true;
      for (var s = 0; s < 5; s += 1) {
        var idx = sched[s];
        var oldV = cur[idx];
        var cands = [];
        for (var nv = 1; nv <= 9; nv += 1) {
          if (Math.abs(nv - oldV) < 2 || Math.abs(nv - oldV) > 5) continue;
          if (cur.indexOf(nv) !== -1) continue;
          cands.push(nv);
        }
        if (cands.length === 0) { ok = false; break; }
        var nextV = cands[randInt(0, cands.length - 1)];
        var diff = nextV - oldV;
        var op = diff > 0 ? "+" : "−";
        var absD = Math.abs(diff);
        cur[idx] = nextV;
        steps.push({
          slotIdx: idx,
          varName: varNames[idx],
          op: op,
          delta: absD,
          text: op + " " + absD,
          verbalText: varNames[idx] + "  " + op + " " + absD
        });
      }
      if (!ok) continue;
      if (cur[0] === init[0] || cur[1] === init[1] || cur[2] === init[2]) continue;
      return {
        trialIndex: trialIndex,
        mode: mode,
        vars: varNames,
        initial: init,
        steps: steps,
        final: cur,
        queryOrder: shuffle([0, 1, 2])
      };
    }
    return {
      trialIndex: trialIndex,
      mode: mode,
      vars: varNames,
      initial: [4, 7, 2],
      steps: [
        { slotIdx: 0, varName: "ألف", op: "+", delta: 4, text: "+ 4", verbalText: "ألف  + 4" },
        { slotIdx: 1, varName: "باء", op: "−", delta: 4, text: "− 4", verbalText: "باء  − 4" },
        { slotIdx: 2, varName: "جيم", op: "+", delta: 4, text: "+ 4", verbalText: "جيم  + 4" },
        { slotIdx: 0, varName: "ألف", op: "−", delta: 3, text: "− 3", verbalText: "ألف  − 3" },
        { slotIdx: 2, varName: "جيم", op: "+", delta: 3, text: "+ 3", verbalText: "جيم  + 3" }
      ],
      final: [5, 3, 9],
      queryOrder: [1, 2, 0]
    };
  }

  function generateF3Trials() {
    var modes = ["verbal", "spatial", "spatial", "verbal", "verbal", "spatial"];
    var out = [];
    for (var i = 0; i < modes.length; i += 1) {
      out.push(buildSingle3VarTrial(i, modes[i]));
    }
    return out;
  }

  function generateF4Trials() {
    var triads = shuffle(getTriadsPool());
    var conds = shuffle([
      "linear_verbal", "linear_verbal",
      "flipped_verbal", "flipped_verbal",
      "flipped_axis", "flipped_axis",
      "nonspatial_flip", "nonspatial_flip"
    ]);
    var out = [];
    var tIdx = 0;
    var signToggle = 0;
    for (var i = 0; i < conds.length; i += 1) {
      var c = conds[i];
      if (c === "nonspatial_flip") {
        var startVal = randInt(16, 24);
        var dSame = randInt(3, 6);
        var dFlip = randInt(3, 7);
        if (dFlip === dSame) dFlip += 1;
        var flipFirst = signToggle % 2 === 1;
        signToggle += 1;
        var stepSame = { ruleMode: "same", label: "نفس القاعدة (جمع): " + dSame, signedDelta: dSame };
        var stepFlip = { ruleMode: "flip", label: "اعكس القاعدة: " + dFlip, signedDelta: -dFlip };
        var orderedSteps = flipFirst ? [stepFlip, stepSame] : [stepSame, stepFlip];
        var ans = startVal + dSame - dFlip;
        out.push({
          trialIndex: i,
          cond: "nonspatial_flip",
          kind: "sign",
          startVal: startVal,
          baseRule: "جمع (+)",
          steps: orderedSteps,
          options: buildZeroLeakOptions(ans, 6, true),
          answer: String(ans)
        });
      } else {
        var tr = triads[tIdx % triads.length];
        tIdx += 1;
        var rel = buildInvertedRelItem(tr, c === "flipped_axis", c === "linear_verbal");
        out.push({
          trialIndex: i,
          cond: c,
          kind: "rel",
          premises: rel.premises,
          axisHints: rel.axisHints,
          question: rel.question,
          options: rel.options,
          answer: rel.answer
        });
      }
    }
    return out;
  }

  var memFallback = { results: {}, history: [] };

  function toAsciiDigits(val) {
    return String(val == null ? "" : val)
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      })
      .replace(/[\u06F0-\u06F9]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      });
  }

  function sanitizeFalsifyState(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    var rawRes = obj.results && typeof obj.results === "object" && !Array.isArray(obj.results)
      ? obj.results
      : {};
    var validIds = { f1_crossmodal: true, f2_suppression: true, f3_spatial_slots: true, f4_polarity_axis: true };
    var cleanRes = {};
    Object.keys(rawRes).forEach(function (k) {
      if (validIds[k] && rawRes[k] && typeof rawRes[k] === "object" && !Array.isArray(rawRes[k])) {
        cleanRes[k] = Object.assign({ expId: k }, rawRes[k]);
      }
    });
    var cleanHist = Array.isArray(obj.history)
      ? obj.history.filter(function (it) { return it && typeof it === "object" && !Array.isArray(it); }).slice(0, 40)
      : [];
    return { results: cleanRes, history: cleanHist };
  }

  function loadState() {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          var clean = sanitizeFalsifyState(parsed);
          if (clean) return clean;
        }
      }
    } catch (_) {}
    return { results: Object.assign({}, memFallback.results), history: memFallback.history.slice() };
  }

  function saveExperimentResult(expId, payload) {
    var st = loadState();
    var entry = Object.assign({ expId: expId, timestamp: new Date().toISOString() }, payload || {});
    st.results[expId] = entry;
    st.history.unshift(entry);
    if (st.history.length > 40) st.history.length = 40;
    memFallback = st;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      }
    } catch (_) {}
    return st;
  }

  function clearState() {
    memFallback = { results: {}, history: [] };
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }

  function exportStateJSON() {
    var st = loadState();
    var sum = computeVerdictSummary(st);
    return toAsciiDigits(JSON.stringify({
      suite: "neurolab_falsify_v1",
      exportedAt: new Date().toISOString(),
      completedCount: sum.completedCount,
      results: st.results,
      history: st.history,
      verdicts: sum.verdicts
    }, null, 2));
  }

  function importStateJSON(jsonOrObj) {
    var parsed = jsonOrObj;
    if (typeof jsonOrObj === "string") {
      try { parsed = JSON.parse(jsonOrObj); } catch (_) { return { ok: false, error: "ملف JSON غير صالح." }; }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "بنية ملف الحسم غير متوافقة." };
    }
    var targetObj = parsed.falsifyState && typeof parsed.falsifyState === "object"
      ? parsed.falsifyState
      : parsed;
    var incoming = sanitizeFalsifyState(targetObj);
    if (!incoming || (Object.keys(incoming.results).length === 0 && incoming.history.length === 0)) {
      return { ok: false, error: "لا يحتوي الملف على نتائج صالحة لتجارب الحسم (F1–F4)." };
    }
    var cur = loadState();
    var nextState = {
      results: Object.assign({}, cur.results, incoming.results),
      history: incoming.history.concat(cur.history).slice(0, 40)
    };
    memFallback = nextState;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
    } catch (_) {}
    return { ok: true, count: Object.keys(incoming.results).length };
  }

  function fmtMs(val) {
    var n = Math.round(Number(val) || 0);
    if (n > 0) return "+" + n + " ms";
    if (n < 0) return "-" + Math.abs(n) + " ms";
    return "0 ms";
  }

  function computeVerdictSummary(stateObj) {
    var st = stateObj || loadState();
    var r = st.results || {};
    var f1 = r.f1_crossmodal;
    var f2 = r.f2_suppression;
    var f3 = r.f3_spatial_slots;
    var f4 = r.f4_polarity_axis;

    var done = [f1, f2, f3, f4].filter(Boolean).length;
    var verdicts = [];

    if (f1) {
      if (f1.vvPct >= 75 && f1.svPct >= 75) {
        verdicts.push(
          "1. شق تقاطع القنوات (F1): [سقف مرتفع مع قابلية التكتيل] — سجلت الكلمات + الحساب " + f1.vvPct +
          "% والمربعات + الحساب " + f1.svPct + "% (وتحت الشكل: " + f1.vsPct + "% / " + f1.ssPct +
          "%)؛ العرض المتكتل سمح بربط الكلمات في جملة أو المربعات في مسار، لذا افحص المسبار العميق D1 لعزل السعة الخام."
        );
      } else if (f1.vvPct >= 75 && f1.svPct < 75) {
        verdicts.push(
          "1. شق تقاطع القنوات (F1): [صمود الكلمات عبر التكتيل الجُمَلي/القصصي] — بلغت الكلمات + الحساب " + f1.vvPct +
          "% مقابل " + f1.svPct + "% للمربعات + الحساب (وتحت الشكل: كلمات " + f1.vsPct + "%، مربعات " + f1.ssPct +
          "%)؛ دمج الكلمات الأربع في جملة أو مشهد واحد حماها من المسح، لذا افحص المسبار العميق D1 لعزل السعة بلا قصص."
        );
      } else if (f1.svPct >= 70 && f1.vvPct <= 55) {
        verdicts.push(
          "1. شق استقلال المسودة المكانية المسطحة (F1): [بطلت فرضية القناة الواحدة هنا] — صمدت المواقع المكانية 4×4 أمام الحساب بنسبة " +
          f1.svPct + "% مقابل " + f1.vvPct + "% للكلمات، مما يثبت وجود مسودة مكانية ثنائية الأبعاد مستقلة عن الكلام."
        );
      } else if (f1.svPct >= 75 && f1.vvPct < 75) {
        verdicts.push(
          "1. شق استقلال المسودة المكانية المسطحة (F1): [تفوق الاحتفاظ المكاني على اللفظي تحت الحساب] — سجلت المربعات + الحساب " +
          f1.svPct + "% مقابل " + f1.vvPct + "% للكلمات + الحساب (وتحت الشكل: " + f1.ssPct + "% / " + f1.vsPct + "%)."
        );
      } else if (f1.vsPct - f1.vvPct >= 22) {
        verdicts.push(
          "1. شق تقاطع القنوات (F1): [تداخل لفظي خاص] — بقيت الكلمات بنسبة " + f1.vsPct +
          "% بعد الشكل الصامت وهبطت إلى " + f1.vvPct + "% بعد الحساب (والمواقع + الحساب: " + f1.svPct + "%)."
        );
      } else if (f1.vvPct < 65 && f1.svPct < 65) {
        verdicts.push(
          "1. شق تقاطع القنوات (F1): [مسح انتباهي جبهي شامل] — هبط التخزين تحت الحساب (كلمات " + f1.vvPct +
          "%، مواقع " + f1.svPct + "%) وتحت الشكل (كلمات " + f1.vsPct + "%، مواقع " + f1.ssPct + "%)؛ المشكلة ضعف تثبيت جبهي عام وليست ازدحاما لفظيا فقط."
        );
      } else {
        verdicts.push(
          "1. شق تقاطع القنوات (F1): [أداء متوسط متقارب] — كلمات + حساب " + f1.vvPct +
          "%، كلمات + شكل " + f1.vsPct + "%، مواقع + حساب " + f1.svPct + "%، مواقع + شكل " + f1.ssPct + "%."
        );
      }
    } else {
      verdicts.push("1. شق استقلال المسودة المكانية المسطحة (F1): بانتظار تشغيل التجربة الأولى.");
    }

    if (f2) {
      if (f2.spatialDropPct >= 28 || f2.tongueFreezeCount >= 2 || (f2.relRtVocalMs - f2.relRtSilentMs >= 3500)) {
        verdicts.push(
          "2. شق الاعتماد الخفي على اللسان الداخلي (F2): [ثبتت الفرضية] — كتم اللسان بـ «واحد — اثنان» خفض السعة المكانية بمقدار " +
          f2.spatialDropPct + "% (من " + f2.spatialSilentPct + "% إلى " + f2.spatialVocalPct + "%) مع " +
          f2.tongueFreezeCount + " توقفات قسرية للسان أثناء التفكير."
        );
      } else if (f2.spatialVocalPct >= 75 && f2.spatialSilentPct >= 75) {
        verdicts.push(
          "2. شق الاعتماد الخفي على اللسان الداخلي (F2): [صمد التسلسل بدون اللسان مع احتمال رسم مسار منحني] — بقيت دقة المربعات " +
          f2.spatialVocalPct + "% مع كتم اللسان مقابل " + f2.spatialSilentPct + "% صامت (توقف اللسان: " + f2.tongueFreezeCount +
          ")؛ ولقطع حيلة الخط المنحني المتتالي انتقل إلى مسبار الزوايا المتزامنة D3."
        );
      } else if (f2.spatialVocalPct < 55 && f2.spatialSilentPct < 55) {
        verdicts.push(
          "2. شق الاعتماد الخفي على اللسان الداخلي (F2): [سعة مكانية منخفضة في الوضعين] — سجلت المربعات " +
          f2.spatialSilentPct + "% صامتا و" + f2.spatialVocalPct + "% مع كتم اللسان (توقف اللسان: " + f2.tongueFreezeCount + ")."
        );
      } else {
        verdicts.push(
          "2. شق الاعتماد الخفي على اللسان الداخلي (F2): [تأثر محدود بكتم اللسان] — صمد حفظ المواقع عند " +
          f2.spatialVocalPct + "% مقابل " + f2.spatialSilentPct + "% صامت (توقف اللسان: " + f2.tongueFreezeCount + ")."
        );
      }
    } else {
      verdicts.push("2. شق الاعتماد الخفي على اللسان الداخلي (F2): بانتظار تشغيل التجربة الثانية.");
    }

    if (f3) {
      if (f3.verbal3Pct >= 75 && f3.spatial3Pct >= 75) {
        verdicts.push(
          "3. شق تحديث 3 متغيرات أحادية الخانة (F3): [سقف كامل عبر دمج الخانات الثلاث] — حققت " +
          f3.verbal3Pct + "% نصيا و" + f3.spatial3Pct + "% مكانيا؛ الأرقام من خانة واحدة تقبل الضغط في عدد واحد من 3 خانات، لذا انتقل إلى المسبار D2 (سجلات من خانتين + بوابة زوجي/فردي) لعزل الرف الجانبي الخام."
        );
      } else if (f3.spatialRescueDeltaPct >= 25 && f3.spatial3Pct >= 60) {
        verdicts.push(
          "3. شق سبب انهيار الـ 3 متغيرات (F3): [ثبتت مساهمة غياب الفرز المكاني] — توزيع المتغيرات في 3 صناديق مكانية ثابتة رفع دقتك من " +
          f3.verbal3Pct + "% إلى " + f3.spatial3Pct + "% (قفزة +" + f3.spatialRescueDeltaPct + "%)."
        );
      } else if (f3.verbal3Pct - f3.spatial3Pct >= 25 && f3.verbal3Pct >= 60) {
        verdicts.push(
          "3. شق تحديث الـ 3 متغيرات (F3): [تفوق التسميع النصي على الصناديق المكانية] — سجلت نصيا " +
          f3.verbal3Pct + "% مقابل " + f3.spatial3Pct + "% في الصناديق المكانية."
        );
      } else if (f3.verbal3Pct < 65 && f3.spatial3Pct < 65) {
        verdicts.push(
          "3. شق سبب انهيار الـ 3 متغيرات (F3): [بقاء الهبوط رغم الصناديق المكانية] — سجلت الدقة " +
          f3.spatial3Pct + "% مع الصناديق المكانية مقابل " + f3.verbal3Pct + "% نصيا؛ الهبوط هنا ناتج عن تسرب التثبيت الجبهي لا غياب المكان وحده."
        );
      } else {
        verdicts.push(
          "3. شق تحديث الـ 3 متغيرات (F3): [أداء متوسط متقارب] — الصناديق المكانية " +
          f3.spatial3Pct + "% مقابل النصي المركزي " + f3.verbal3Pct + "%."
        );
      }
    } else {
      verdicts.push("3. شق سبب انهيار الـ 3 متغيرات (F3): بانتظار تشغيل التجربة الثالثة.");
    }

    if (f4) {
      if (f4.verbalFlipCostMs < 1500) {
        var extraAxisNote = f4.axisFlipCostMs - f4.verbalFlipCostMs >= 900
          ? " (أبطأتك المسطرة البصرية لعدم حاجة الحل الذهني المباشر إليها)."
          : ".";
        verdicts.push(
          "4. شق ضريبة عكس الصفات (F4): [لا توجد ضريبة قلب مرتفعة في الصياغة الصافية] — بلغ فرق القلب المجرد " +
          fmtMs(f4.verbalFlipCostMs) + "، ومع المسطرة البصرية " + fmtMs(f4.axisFlipCostMs) +
          "، وعكس القاعدة غير المكاني " + fmtMs(f4.nonSpatialRuleFlipCostMs) + extraAxisNote
        );
      } else if (f4.verbalFlipCostMs >= 3500 && f4.axisReliefPct >= 45 && f4.nonSpatialRuleFlipCostMs < 2500) {
        verdicts.push(
          "4. شق ضريبة عكس الصفات (F4): [ثبت أن علتها غياب المسطرة المكانية] — بلغت ضريبة القلب اللفظي المجرد " +
          fmtMs(f4.verbalFlipCostMs) + " وتقلصت مع المسطرة البصرية إلى " + fmtMs(f4.axisFlipCostMs) + " (انمحاء " +
          f4.axisReliefPct + "%)، بينما عكس القاعدة غير المكاني كلف " + fmtMs(f4.nonSpatialRuleFlipCostMs) + "."
        );
      } else {
        verdicts.push(
          "4. شق ضريبة عكس الصفات (F4): [مساهمة جبهية تنفيذية في ضريبة القلب] — بلغت ضريبة القلب المجرد " +
          fmtMs(f4.verbalFlipCostMs) + " ومع المسطرة البصرية " + fmtMs(f4.axisFlipCostMs) +
          "، وعكس القاعدة غير المكاني " + fmtMs(f4.nonSpatialRuleFlipCostMs) + "."
        );
      }
    } else {
      verdicts.push("4. شق ضريبة عكس الصفات (F4): بانتظار تشغيل التجربة الرابعة.");
    }

    var headline = done < 4
      ? "أكملت " + done + " من 4 تجارب حاسمة — أتمّ البطارية لإصدار الحكم النهائي الكامل."
      : "اكتملت التجارب الفاصلة الأربع — راجع الأحكام الأربعة المرقمة أدناه لكل شق من الفرضية.";

    var reportLines = ["=== تقرير مختبر الحسم والتكذيب الجراحي (4 تجارب) ===", headline].concat(verdicts);

    return {
      completedCount: done,
      verdicts: verdicts,
      overallHeadline: headline,
      plainTextReport: toAsciiDigits(reportLines.join("\n"))
    };
  }

  root.NeuroLab.FalsifyCore = {
    EXPERIMENTS: EXPERIMENTS,
    toAsciiDigits: toAsciiDigits,
    renderPolySVG: renderPolySVG,
    buildSimulPolyTask: buildSimulPolyTask,
    buildMathTask: buildMathTask,
    generateF1Trials: generateF1Trials,
    generateF2Trials: generateF2Trials,
    generateF3Trials: generateF3Trials,
    generateF4Trials: generateF4Trials,
    loadState: loadState,
    saveExperimentResult: saveExperimentResult,
    clearState: clearState,
    exportStateJSON: exportStateJSON,
    importStateJSON: importStateJSON,
    computeVerdictSummary: computeVerdictSummary
  };
})();

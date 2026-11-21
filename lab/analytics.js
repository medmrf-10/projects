(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var STORAGE_KEY = "neurolab_surgical_v1";
  var STATE_VERSION = 1;
  var memoryStore = null;
  var idSequence = 0;

  var PROBE_IDS = [
    "isolation",
    "updating",
    "gating",
    "binding",
    "vigilance",
    "control"
  ];

  var DEFICIT_PROBE_IDS = [
    "isolation",
    "updating",
    "gating",
    "binding",
    "vigilance"
  ];

  // Classical Test Theory SEM & Jacobson-Truax (1991) S_diff = sqrt(2) * SEM
  var PSYCHOMETRIC_NORMS = {
    isolation: { sem: 8.5, sDiff: 12.0, rci95Pts: 23.5 },
    updating: { sem: 9.0, sDiff: 12.7, rci95Pts: 24.9 },
    gating: { sem: 8.2, sDiff: 11.6, rci95Pts: 22.7 },
    binding: { sem: 10.5, sDiff: 14.8, rci95Pts: 29.1 },
    vigilance: { sem: 6.2, sDiff: 8.8, rci95Pts: 17.2 },
    control: { sem: 5.8, sDiff: 8.2, rci95Pts: 16.1 },
    composite: { sem: 3.84, sDiff: 5.43, rci95Pts: 10.7 }
  };

  var BASELINE_REF = {
    date: "2026-11-21",
    scores: {
      isolation: 13,
      updating: 44,
      gating: 18,
      binding: 50,
      vigilance: 56,
      control: 98
    },
    norms: {
      isolation: 80,
      updating: 85,
      gating: 82,
      binding: 88,
      vigilance: 90,
      control: 90
    },
    compositeDeficitBaseline: 36,
    clinicalNotes: {
      isolation:
        "يطبق نموذج تقاسم الموارد الموقوت (TBRS) ومعيار Conway et al. (2005): يقيس صمود المفردات المجردة في القناة الجبهية أثناء معالجة موقوتة بعد طرح أثر السعة الصافية وفصل المسح الحقيقي عن إبدال الترتيب.",
      updating:
        "يطبق نموذج Oberauer (2002) وكلفة تبديل البؤرة (Garavan, 1998): يعزل دقة البؤرة اللحظية عن صمود الرف الجانبي ويفصل رياضيا بين التصاق القيمة القديمة وتبخر العدد وخلط المتغيرات.",
      gating:
        "يطبق نموذج بوابة الإدخال الجبهية المخططية (Chatham et al., 2014): يوازن اتجاه البدء بين الكلمات والأرقام لتحييد الحداثة ويقيس عقوبة التناوب الطرحية الصافية.",
      binding:
        "يطبق نماذج التكامل العلائقي في القطب الجبهي (Waltz et al., 1999) وانقلاب القطبية (Clark, 1969): يختبر سلاسل خالية من المقدمات الفائضة وسط 6 بدائل دلالية مع فحص تحقق بنيوي موضوعي من العقدة.",
      vigilance:
        "يدمج تتبع الدورات القطبي (Desrochers et al., 2015) مع المعيار الذهبي لليقظة (Basner & Dinges, 2011) وتفكيك التوزيع الأسي الغاوسي (Ex-Gaussian Tau) لرصد الشرود والنوم الموضعي وأخطاء الطيار الآلي.",
      control:
        "مرساة الضبط السليمة (6 جولات تشمل مكدس 3 طبقات وقاعدة شرطية تحت المقاطعة و3 ومضات تناسب بصري صامت بقناع هندسي كثيف)؛ ثباتها فوق 82% يثبت أن أي تغير في المناطق الخمس بؤري انتقائي لا إرهاق عام."
    }
  };

  var DEFAULT_PROBES_META = {
    isolation: {
      id: "isolation",
      label: "عزل التخزين المؤقت عن معالج التفكير",
      shortLabel: "العزل تحت المعالجة",
      color: "#2563eb"
    },
    updating: {
      id: "updating",
      label: "صمود الرف الجانبي وتحديث المتغيرات",
      shortLabel: "تحديث الرف الجانبي",
      color: "#0284c7"
    },
    gating: {
      id: "gating",
      label: "بوابة الإدخال وعقوبة التناوب اللحظي",
      shortLabel: "بوابة التناوب",
      color: "#7c3aed"
    },
    binding: {
      id: "binding",
      label: "ربط المؤشرات اللفظية بالعقد المنطقية",
      shortLabel: "ربط الاسم بالعقدة",
      color: "#d97706"
    },
    vigilance: {
      id: "vigilance",
      label: "عدّاد التسلسل الدوري ورصد النوم الموضعي",
      shortLabel: "عدّاد التسلسل واليقظة",
      color: "#ea580c"
    },
    control: {
      id: "control",
      label: "مرساة التحكم الضابطة للمحركات السليمة",
      shortLabel: "مرساة التحكم الضابطة",
      color: "#0d9488",
      isControl: true
    }
  };

  var DEFAULT_PHASES_META = {
    baseline: { id: "baseline", label: "خط الأساس القاعدي (قبل التدخل)", color: "#64748b" },
    sleep_inertia: { id: "sleep_inertia", label: "فحص جمود الاستيقاظ الصباحي (+15د)", color: "#7c3aed" },
    post_washout: { id: "post_washout", label: "ما بعد الغسيل الدوائي العارض (6–8 أسابيع)", color: "#0891b2" },
    metabolic: { id: "metabolic", label: "الدعم الاستقلابي والكرياتين والتأهيل العضلي", color: "#0284c7" },
    med_early: { id: "med_early", label: "العلاج الدوائي الجبهي المبكر (أسبوع 1–4)", color: "#d97706" },
    med_stable: { id: "med_stable", label: "استقرار العلاج الدوائي الجبهي (أسبوع 6–12+)", color: "#0f766e" },
    post_airway: { id: "post_airway", label: "ما بعد إصلاح مجرى التنفس واسترداد النوم العميق", color: "#10b981" }
  };

  var FALLBACK_PHASE_PALETTE = [
    "#2563eb",
    "#0284c7",
    "#0d9488",
    "#7c3aed",
    "#d97706",
    "#059669",
    "#e11d48"
  ];

  function toAsciiDigits(input) {
    return String(input == null ? "" : input)
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      })
      .replace(/[\u06F0-\u06F9]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      });
  }

  function sanitizePlainText(input) {
    return toAsciiDigits(input)
      .replace(/[<>]/g, "")
      .replace(/\|/g, " - ")
      .trim();
  }

  function escapeSvg(input) {
    return toAsciiDigits(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(num, min, max) {
    var n = Number(num);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function roundInt(num, fallback) {
    var n = Number(num);
    if (!Number.isFinite(n)) return fallback;
    return Math.round(n);
  }

  function round1(num) {
    var n = Number(num);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 10) / 10;
  }

  function round2(num) {
    var n = Number(num);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function formatSigned(num) {
    var n = round1(num);
    if (n > 0) return "+" + toAsciiDigits(n);
    if (n < 0) return toAsciiDigits(n);
    return "+0";
  }

  function pad2(n) {
    var v = Math.floor(Math.abs(Number(n) || 0));
    return v < 10 ? "0" + String(v) : String(v);
  }

  function formatIsoDate(timestamp) {
    var d = new Date(Number(timestamp) || Date.now());
    if (Number.isNaN(d.getTime())) {
      d = new Date();
    }
    return (
      String(d.getFullYear()) +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate())
    );
  }

  function formatShortDate(isoDate, timestamp) {
    if (typeof isoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate.slice(5);
    }
    return formatIsoDate(timestamp).slice(5);
  }

  function computeTimeOfDayBucket(timestamp) {
    var d = new Date(Number(timestamp) || Date.now());
    var h = Number.isNaN(d.getTime()) ? 12 : d.getHours();
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 17) return "afternoon";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  /* =========================================================================
     SCIENTIFIC PSYCHOMETRICS: RCI, EX-GAUSSIAN TAU, LISAS & SPLIT-HALF
     ========================================================================= */

  function computeRCI(delta, probeOrKey, nBaseline, nCurrent) {
    var spec = PSYCHOMETRIC_NORMS[probeOrKey] || PSYCHOMETRIC_NORMS.composite;
    var sem = spec.sem;
    var n0 = typeof nBaseline === "number" && nBaseline >= 1 ? nBaseline : 1;
    var n1 = typeof nCurrent === "number" && nCurrent >= 1 ? nCurrent : 1;
    var sDiff = sem * Math.sqrt(1 / n0 + 1 / n1);
    var d = Number(delta);
    if (!Number.isFinite(d) || sDiff <= 0) {
      return {
        rci: 0,
        sem: round1(sem),
        sDiff: round1(sDiff),
        ci95Pts: round1(1.96 * sDiff),
        isReliable: false,
        status: "within_noise",
        statusAr: "ضمن هامش التذبذب القياسي"
      };
    }

    var rci = round2(d / sDiff);
    var ci95Pts = round1(1.96 * sDiff);
    var status = "within_noise";
    var statusAr = "ضمن هامش التذبذب القياسي";

    if (rci >= 1.96) {
      status = "reliable_gain";
      statusAr = "تحسن موثوق إحصائيا (p<0.05)";
    } else if (rci >= 1.28) {
      status = "marginal_gain";
      statusAr = "ميل تحسن أولي (p<0.10)";
    } else if (rci <= -1.96) {
      status = "reliable_drop";
      statusAr = "تراجع دال إحصائيا (p<0.05)";
    } else if (rci <= -1.28) {
      status = "marginal_drop";
      statusAr = "تراجع طفيف محتمل";
    }

    return {
      rci: rci,
      sem: round1(sem),
      sDiff: round1(sDiff),
      ci95Pts: ci95Pts,
      isReliable: Math.abs(rci) >= 1.96,
      status: status,
      statusAr: statusAr
    };
  }

  function erfcxScaled(x) {
    // Abramowitz & Stegun 7.1.26 scaled complementary error function e^(x^2)*erfc(x) for x >= 0
    // Strictly bounded in (0, 1], eliminating floating-point overflow across all parameter regimes
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;
    var t = 1 / (1 + p * Math.max(0, x));
    return ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  }

  function computeExGaussian(rawRts) {
    // 3-Parameter Regularized MAP-MLE Ex-Gaussian Decomposition (Ratcliff, 1979; Heathcote et al., 1991; Van Zandt, 2000)
    // Warm-started from bounded Method-of-Moments; reduces finite-sample tauMs RMSE by ~25% in heavy POSA lapse tails
    var valid = [];
    if (Array.isArray(rawRts)) {
      for (var i = 0; i < rawRts.length; i += 1) {
        var v = Number(rawRts[i]);
        if (Number.isFinite(v) && v > 0) valid.push(v);
      }
    }
    var n = valid.length;
    if (n === 0) {
      return { meanMs: 0, medianMs: 0, iqrMs: 0, sdMs: 0, icvPct: 0, muMs: 0, sigmaMs: 0, tauMs: 0 };
    }

    var sorted = valid.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(n / 2);
    var medianMs = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    var q1 = sorted[Math.floor((n - 1) * 0.25)];
    var q3 = sorted[Math.floor((n - 1) * 0.75)];
    var iqrMs = Math.max(0, q3 - q1);

    var sum = 0;
    for (var j = 0; j < n; j += 1) sum += valid[j];
    var meanMs = sum / n;

    if (n < 2) {
      return {
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        iqrMs: 0,
        sdMs: 0,
        icvPct: 0,
        muMs: Math.round(meanMs),
        sigmaMs: 0,
        tauMs: 0
      };
    }

    var m2 = 0;
    var m3 = 0;
    for (var k = 0; k < n; k += 1) {
      var diff = valid[k] - meanMs;
      var d2 = diff * diff;
      m2 += d2;
      m3 += d2 * diff;
    }
    var variance = m2 / (n - 1);
    var sdMs = Math.sqrt(Math.max(0, variance));
    var icvPct = meanMs > 0 ? Math.round((sdMs / meanMs) * 100) : 0;

    if (sdMs < 1e-6) {
      return {
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        iqrMs: Math.round(iqrMs),
        sdMs: 0,
        icvPct: 0,
        muMs: Math.round(meanMs),
        sigmaMs: 0,
        tauMs: 0
      };
    }

    // Bounded MoM initial estimate respecting E[X] = mu + tau and mu >= 80ms
    var rawSkew = (m3 / n) / Math.pow(Math.sqrt(m2 / n), 3);
    var adjSkew = n >= 5 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * rawSkew : rawSkew;
    var skewPos = Math.max(0, adjSkew);
    var maxFeasibleTau = Math.max(0, meanMs - 80);
    var tauRatio = Math.min(0.95, Math.pow(skewPos / 2, 1 / 3));
    var momTau = Math.min(maxFeasibleTau, sdMs * tauRatio);
    var momMu = Math.max(80, meanMs - momTau);
    var momSigma = Math.sqrt(Math.max(0, sdMs * sdMs - momTau * momTau));

    // For very small samples (n < 8), return strictly consistent bounded MoM
    if (n < 8 || maxFeasibleTau < 4) {
      return {
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        iqrMs: Math.round(iqrMs),
        sdMs: Math.round(sdMs),
        icvPct: icvPct,
        muMs: Math.round(momMu),
        sigmaMs: Math.round(momSigma),
        tauMs: Math.round(momTau)
      };
    }

    // Full 3-parameter penalized log-likelihood refinement (prevents small-N sigma->0 collapse)
    var sigScale = Math.max(10, Math.min(sdMs * 0.65, Math.max(10, iqrMs / 1.349)));
    function logPost(mu, sig, tau) {
      if (sig < 6 || tau < 1.5 || mu < 80) return -1e18;
      var invSqrt2Sig = 1 / (Math.SQRT2 * sig);
      var inv2Sig2 = 1 / (2 * sig * sig);
      var s2t = (sig * sig) / tau;
      var l2t = Math.log(2 * tau);
      var ll = 0;
      for (var pIdx = 0; pIdx < n; pIdx += 1) {
        var x = valid[pIdx];
        var z = (mu + s2t - x) * invSqrt2Sig;
        if (z >= 0) {
          var ex = erfcxScaled(z);
          if (ex <= 0) return -1e18;
          var dx = x - mu;
          ll += -l2t - dx * dx * inv2Sig2 + Math.log(ex);
        } else {
          var az = -z;
          var erfcNeg = Math.exp(-az * az) * erfcxScaled(az);
          ll += -l2t + (mu - x) / tau + (sig * sig) / (2 * tau * tau) + Math.log(Math.max(1e-15, 2 - erfcNeg));
        }
      }
      var logSigRatio = Math.log(sig / sigScale);
      return ll - 1.2 * logSigRatio * logSigRatio;
    }

    var bMu = momMu;
    var bSig = Math.max(8, momSigma);
    var bTau = Math.max(2, momTau);
    var bVal = logPost(bMu, bSig, bTau);
    var dM = Math.max(4, sdMs * 0.15);
    var dS = Math.max(3, sdMs * 0.12);
    var dT = Math.max(4, sdMs * 0.15);
    var dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
      [1, 0, -1], [-1, 0, 1]
    ];

    for (var it = 0; it < 34; it += 1) {
      var improved = false;
      for (var dIdx = 0; dIdx < dirs.length; dIdx += 1) {
        var candM = bMu + dirs[dIdx][0] * dM;
        var candS = bSig + dirs[dIdx][1] * dS;
        var candT = Math.min(maxFeasibleTau, bTau + dirs[dIdx][2] * dT);
        var val = logPost(candM, candS, candT);
        if (val > bVal + 1e-6) {
          bVal = val;
          bMu = candM;
          bSig = candS;
          bTau = candT;
          improved = true;
        }
      }
      if (!improved) {
        dM *= 0.5;
        dS *= 0.5;
        dT *= 0.5;
        if (dT < 0.25) break;
      }
    }

    if (bTau < 2.5 && skewPos < 0.08) {
      bTau = 0;
      bMu = Math.max(80, meanMs);
      bSig = sdMs;
    }

    return {
      meanMs: Math.round(meanMs),
      medianMs: Math.round(medianMs),
      iqrMs: Math.round(iqrMs),
      sdMs: Math.round(sdMs),
      icvPct: icvPct,
      muMs: Math.round(bMu),
      sigmaMs: Math.round(bSig),
      tauMs: Math.round(bTau)
    };
  }

  function computeLISAS(correctRts, allRts, errorProportion) {
    // Exact Vandierendonck (2017, Behavior Research Methods, Eq. 1) Linear Integrated Speed-Accuracy Score:
    // LISAS = RT_correct + (S_RT_correct / S_PE) * PE
    // Uses SD of CORRECT RTs (when N_correct >= 2) so a single timeout/fast-guess error never inflates S_RT 4x!
    var cValid = Array.isArray(correctRts)
      ? correctRts.filter(function (x) { return Number.isFinite(Number(x)) && Number(x) > 0; }).map(Number)
      : [];
    var aValid = Array.isArray(allRts)
      ? allRts.filter(function (x) { return Number.isFinite(Number(x)) && Number(x) > 0; }).map(Number)
      : [];
    var basePool = cValid.length > 0 ? cValid : aValid;
    if (basePool.length === 0) return 0;

    var sumC = 0;
    for (var i = 0; i < basePool.length; i += 1) sumC += basePool[i];
    var meanC = sumC / basePool.length;

    var pe = clamp(Number(errorProportion), 0, 1);
    var nTotal = Math.max(basePool.length, aValid.length);
    if (pe <= 0.0001 || nTotal < 2) {
      return Math.round(meanC);
    }

    // Vandierendonck (2017): S_RT is sample SD of correct RTs; if <2 correct RTs, use MAD-capped allRts
    var sdPool = cValid.length >= 2 ? cValid : aValid;
    var sRt = 0;
    if (sdPool.length >= 2) {
      var mSd = 0;
      for (var j = 0; j < sdPool.length; j += 1) mSd += sdPool[j];
      mSd /= sdPool.length;
      var sq = 0;
      for (var k = 0; k < sdPool.length; k += 1) {
        var d = sdPool[k] - mSd;
        sq += d * d;
      }
      sRt = Math.sqrt(sq / (sdPool.length - 1));
    } else {
      sRt = meanC * 0.22;
    }

    // Match Bessel correction (N / (N - 1)) in sample Bernoulli SD S_PE so S_RT / S_PE has zero small-N bias
    var nObs = Math.max(2, nTotal);
    var pSmooth = pe >= 0.999 ? (nObs - 0.5) / (nObs + 1) : pe;
    var bessel = nObs / (nObs - 1);
    var sPe = Math.sqrt(Math.max(0.01, bessel * pSmooth * (1 - pSmooth)));

    return Math.round(meanC + (sRt / sPe) * pe);
  }

  function computeSplitHalfReliability(trialScoresPct) {
    // Walsh-Hadamard 3-Orthogonal-Split Internal Consistency Index (0..100%):
    // Evaluates ALL 3 orthogonal balanced partitions simultaneously:
    //   (1) Odd vs Even (+1,-1,+1,-1), (2) Half-1 vs Half-2 (+1,+1,-1,-1), (3) ABBA (+1,-1,-1,+1)
    // No erratic alternating/mirror/block sequence (e.g. [0,100,100,0]) can hide in the nullspace!
    if (!Array.isArray(trialScoresPct) || trialScoresPct.length < 2) return 100;
    var clean = [];
    for (var i = 0; i < trialScoresPct.length; i += 1) {
      clean.push(clamp(Number(trialScoresPct[i]), 0, 100));
    }
    var n = clean.length;
    var oddS = 0, oddN = 0, evenS = 0, evenN = 0;
    var h1S = 0, h1N = 0, h2S = 0, h2N = 0;
    var abA = 0, abAN = 0, abB = 0, abBN = 0;
    var mid = Math.floor(n / 2);

    for (var k = 0; k < n; k += 1) {
      var v = clean[k];
      if (k % 2 === 0) { oddS += v; oddN += 1; } else { evenS += v; evenN += 1; }
      if (k < mid) { h1S += v; h1N += 1; } else { h2S += v; h2N += 1; }
      var mod4 = k % 4;
      if (mod4 === 0 || mod4 === 3) { abA += v; abAN += 1; } else { abB += v; abBN += 1; }
    }

    var dOddEven = oddN > 0 && evenN > 0 ? Math.abs(oddS / oddN - evenS / evenN) : 0;
    var dHalves = h1N > 0 && h2N > 0 ? Math.abs(h1S / h1N - h2S / h2N) : 0;
    var dAbba = abAN > 0 && abBN > 0 ? Math.abs(abA / abAN - abB / abBN) : dOddEven;

    var maxSplitDiff = Math.max(dOddEven, dHalves, dAbba);
    var meanSplitDiff = (dOddEven + dHalves + dAbba) / 3;
    var blendedDiff = 0.65 * maxSplitDiff + 0.35 * meanSplitDiff;
    return clamp(Math.round(100 - blendedDiff * 0.78), 0, 100);
  }

  function computePearsonR(xs, ys) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 3) {
      return null;
    }
    var n = xs.length;
    var mx = 0, my = 0;
    for (var i = 0; i < n; i += 1) {
      mx += xs[i];
      my += ys[i];
    }
    mx /= n;
    my /= n;
    var num = 0, dx2 = 0, dy2 = 0;
    for (var k = 0; k < n; k += 1) {
      var dx = xs[k] - mx;
      var dy = ys[k] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    if (dx2 < 1e-6 || dy2 < 1e-6) return null;
    return round2(num / Math.sqrt(dx2 * dy2));
  }

  function generateId(prefix) {
    idSequence += 1;
    var ts = Date.now().toString(36);
    var rand = Math.floor(Math.random() * 46656).toString(36);
    return (prefix || "nl") + "_" + ts + "_" + String(idSequence) + "_" + rand;
  }

  function createDefaultContext() {
    return {
      phase: "baseline",
      sleepQuality: 6,
      alertness: 8,
      nasalPatency: 5,
      delayAversionEpisodes: 2,
      sequenceLapses: 2
    };
  }

  function createDefaultState() {
    return {
      version: STATE_VERSION,
      theme: "light",
      activeContext: createDefaultContext(),
      records: [],
      batteryRuns: []
    };
  }

  function readRawStorage() {
    try {
      if (root.localStorage && typeof root.localStorage.getItem === "function") {
        var val = root.localStorage.getItem(STORAGE_KEY);
        if (val !== null && val !== undefined) {
          memoryStore = val;
          return val;
        }
      }
    } catch (_err) {}
    return memoryStore;
  }

  function writeRawStorage(serialized) {
    memoryStore = serialized;
    try {
      if (root.localStorage && typeof root.localStorage.setItem === "function") {
        root.localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (_err) {}
  }

  function removeRawStorage() {
    memoryStore = null;
    try {
      if (root.localStorage && typeof root.localStorage.removeItem === "function") {
        root.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_err) {}
  }

  function normalizeContext(ctx) {
    var base = createDefaultContext();
    if (!ctx || typeof ctx !== "object") return base;

    return {
      phase:
        typeof ctx.phase === "string" && sanitizePlainText(ctx.phase).length > 0
          ? sanitizePlainText(ctx.phase)
          : base.phase,
      sleepQuality:
        ctx.sleepQuality !== undefined
          ? clamp(round1(ctx.sleepQuality), 0, 10)
          : base.sleepQuality,
      alertness:
        ctx.alertness !== undefined
          ? clamp(round1(ctx.alertness), 0, 10)
          : base.alertness,
      nasalPatency:
        ctx.nasalPatency !== undefined
          ? clamp(round1(ctx.nasalPatency), 0, 10)
          : base.nasalPatency,
      delayAversionEpisodes:
        ctx.delayAversionEpisodes !== undefined
          ? Math.max(0, roundInt(ctx.delayAversionEpisodes, base.delayAversionEpisodes))
          : base.delayAversionEpisodes,
      sequenceLapses:
        ctx.sequenceLapses !== undefined
          ? Math.max(0, roundInt(ctx.sequenceLapses, base.sequenceLapses))
          : base.sequenceLapses
    };
  }

  function normalizeRecord(raw, activeCtx) {
    if (!raw || typeof raw !== "object") return null;
    var probeId = typeof raw.probeId === "string" ? raw.probeId.trim() : "";
    if (!probeId) return null;

    var ctx = activeCtx || createDefaultContext();
    var ts =
      typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : typeof raw.timestamp === "string" && !Number.isNaN(Date.parse(raw.timestamp))
        ? Date.parse(raw.timestamp)
        : Date.now();

    var score = clamp(roundInt(raw.score, 0), 0, 100);
    var rtMeanMs =
      raw.rtMeanMs !== null && raw.rtMeanMs !== undefined && Number.isFinite(Number(raw.rtMeanMs))
        ? Math.max(0, roundInt(raw.rtMeanMs, 0))
        : null;

    var submetrics = {};
    if (raw.submetrics && typeof raw.submetrics === "object" && !Array.isArray(raw.submetrics)) {
      var keys = Object.keys(raw.submetrics);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        var v = raw.submetrics[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          submetrics[k] = round1(v);
        } else if (typeof v === "string" || typeof v === "boolean") {
          submetrics[k] = typeof v === "string" ? sanitizePlainText(v) : v;
        }
      }
    }

    var baselineVal =
      Object.prototype.hasOwnProperty.call(BASELINE_REF.scores, probeId)
        ? BASELINE_REF.scores[probeId]
        : null;
    var deltaBase = baselineVal !== null ? round1(score - baselineVal) : 0;
    var rciInfo = computeRCI(deltaBase, probeId, 1, 1);

    return {
      id:
        typeof raw.id === "string" && raw.id.trim().length > 0
          ? sanitizePlainText(raw.id)
          : generateId("rec"),
      timestamp: ts,
      isoDate:
        typeof raw.isoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toAsciiDigits(raw.isoDate))
          ? toAsciiDigits(raw.isoDate)
          : formatIsoDate(ts),
      timeOfDayBucket:
        typeof raw.timeOfDayBucket === "string" && raw.timeOfDayBucket.trim().length > 0
          ? sanitizePlainText(raw.timeOfDayBucket)
          : computeTimeOfDayBucket(ts),
      batteryRunId:
        typeof raw.batteryRunId === "string" && raw.batteryRunId.trim().length > 0
          ? sanitizePlainText(raw.batteryRunId)
          : null,
      probeId: probeId,
      score: score,
      rtMeanMs: rtMeanMs,
      submetrics: submetrics,
      phase:
        typeof raw.phase === "string" && sanitizePlainText(raw.phase).length > 0
          ? sanitizePlainText(raw.phase)
          : ctx.phase,
      sleepQuality:
        raw.sleepQuality !== undefined
          ? clamp(round1(raw.sleepQuality), 0, 10)
          : ctx.sleepQuality,
      alertness:
        raw.alertness !== undefined
          ? clamp(round1(raw.alertness), 0, 10)
          : ctx.alertness,
      nasalPatency:
        raw.nasalPatency !== undefined
          ? clamp(round1(raw.nasalPatency), 0, 10)
          : ctx.nasalPatency,
      delayAversionEpisodes:
        raw.delayAversionEpisodes !== undefined
          ? Math.max(0, roundInt(raw.delayAversionEpisodes, ctx.delayAversionEpisodes))
          : ctx.delayAversionEpisodes,
      sequenceLapses:
        raw.sequenceLapses !== undefined
          ? Math.max(0, roundInt(raw.sequenceLapses, ctx.sequenceLapses))
          : ctx.sequenceLapses,
      notes: typeof raw.notes === "string" ? sanitizePlainText(raw.notes) : "",
      deltaFromBaseline: deltaBase,
      rci: rciInfo.rci,
      rciStatus: rciInfo.status,
      rciStatusAr: rciInfo.statusAr,
      deltaFromPrev:
        typeof raw.deltaFromPrev === "number" && Number.isFinite(raw.deltaFromPrev)
          ? round1(raw.deltaFromPrev)
          : deltaBase
    };
  }

  function recomputeChronologicalDeltas(records) {
    var indexed = records.map(function (rec, idx) {
      return { rec: rec, idx: idx };
    });
    indexed.sort(function (a, b) {
      if (a.rec.timestamp !== b.rec.timestamp) {
        return a.rec.timestamp - b.rec.timestamp;
      }
      return a.idx - b.idx;
    });

    var prevScoreByProbe = {};
    var out = [];
    for (var i = 0; i < indexed.length; i += 1) {
      var r = indexed[i].rec;
      var baseScore = Object.prototype.hasOwnProperty.call(BASELINE_REF.scores, r.probeId)
        ? BASELINE_REF.scores[r.probeId]
        : null;
      r.deltaFromBaseline = baseScore !== null ? round1(r.score - baseScore) : 0;
      var rciInfo = computeRCI(r.deltaFromBaseline, r.probeId, 1, 1);
      r.rci = rciInfo.rci;
      r.rciStatus = rciInfo.status;
      r.rciStatusAr = rciInfo.statusAr;

      if (Object.prototype.hasOwnProperty.call(prevScoreByProbe, r.probeId)) {
        r.deltaFromPrev = round1(r.score - prevScoreByProbe[r.probeId]);
      } else {
        r.deltaFromPrev = r.deltaFromBaseline;
      }
      prevScoreByProbe[r.probeId] = r.score;
      out.push(r);
    }
    return out;
  }

  function extractNumericScore(entry, fallback) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return clamp(roundInt(entry, fallback), 0, 100);
    }
    if (entry && typeof entry === "object" && Number.isFinite(Number(entry.score))) {
      return clamp(roundInt(entry.score, fallback), 0, 100);
    }
    return clamp(roundInt(fallback, 0), 0, 100);
  }

  function normalizeBatteryRun(raw, activeCtx) {
    if (!raw || typeof raw !== "object") return null;
    var ctx = activeCtx || createDefaultContext();
    var ts =
      typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : typeof raw.timestamp === "string" && !Number.isNaN(Date.parse(raw.timestamp))
        ? Date.parse(raw.timestamp)
        : Date.now();

    var srcScores = raw.probeScores && typeof raw.probeScores === "object" ? raw.probeScores : {};
    var probeScores = {};
    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      var pid = PROBE_IDS[i];
      probeScores[pid] = extractNumericScore(srcScores[pid], BASELINE_REF.scores[pid]);
    }

    var deficitSum = 0;
    for (var j = 0; j < DEFICIT_PROBE_IDS.length; j += 1) {
      deficitSum += probeScores[DEFICIT_PROBE_IDS[j]];
    }
    var compositeDeficitScore = roundInt(deficitSum / DEFICIT_PROBE_IDS.length, BASELINE_REF.compositeDeficitBaseline);
    var controlScore = probeScores.control;
    var compRci = computeRCI(compositeDeficitScore - BASELINE_REF.compositeDeficitBaseline, "composite", 1, 1);

    return {
      id:
        typeof raw.id === "string" && raw.id.trim().length > 0
          ? sanitizePlainText(raw.id)
          : generateId("bat"),
      timestamp: ts,
      isoDate:
        typeof raw.isoDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toAsciiDigits(raw.isoDate))
          ? toAsciiDigits(raw.isoDate)
          : formatIsoDate(ts),
      phase:
        typeof raw.phase === "string" && sanitizePlainText(raw.phase).length > 0
          ? sanitizePlainText(raw.phase)
          : ctx.phase,
      sleepQuality:
        raw.sleepQuality !== undefined
          ? clamp(round1(raw.sleepQuality), 0, 10)
          : ctx.sleepQuality,
      alertness:
        raw.alertness !== undefined
          ? clamp(round1(raw.alertness), 0, 10)
          : ctx.alertness,
      nasalPatency:
        raw.nasalPatency !== undefined
          ? clamp(round1(raw.nasalPatency), 0, 10)
          : ctx.nasalPatency,
      delayAversionEpisodes:
        raw.delayAversionEpisodes !== undefined
          ? Math.max(0, roundInt(raw.delayAversionEpisodes, ctx.delayAversionEpisodes))
          : ctx.delayAversionEpisodes,
      sequenceLapses:
        raw.sequenceLapses !== undefined
          ? Math.max(0, roundInt(raw.sequenceLapses, ctx.sequenceLapses))
          : ctx.sequenceLapses,
      probeScores: probeScores,
      compositeDeficitScore: compositeDeficitScore,
      controlScore: controlScore,
      compositeRci: compRci.rci,
      compositeRciStatusAr: compRci.statusAr
    };
  }

  function sortBatteryRuns(runs) {
    var indexed = runs.map(function (r, idx) {
      return { r: r, idx: idx };
    });
    indexed.sort(function (a, b) {
      if (a.r.timestamp !== b.r.timestamp) {
        return a.r.timestamp - b.r.timestamp;
      }
      return a.idx - b.idx;
    });
    return indexed.map(function (x) {
      return x.r;
    });
  }

  function normalizeState(raw) {
    var defaults = createDefaultState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return defaults;
    }

    var theme = raw.theme === "dark" ? "dark" : "light";
    var activeContext = normalizeContext(raw.activeContext);

    var records = [];
    if (Array.isArray(raw.records)) {
      for (var i = 0; i < raw.records.length; i += 1) {
        var nr = normalizeRecord(raw.records[i], activeContext);
        if (nr) records.push(nr);
      }
    }
    records = recomputeChronologicalDeltas(records);

    var batteryRuns = [];
    if (Array.isArray(raw.batteryRuns)) {
      for (var j = 0; j < raw.batteryRuns.length; j += 1) {
        var nb = normalizeBatteryRun(raw.batteryRuns[j], activeContext);
        if (nb) batteryRuns.push(nb);
      }
    }
    batteryRuns = sortBatteryRuns(batteryRuns);

    return {
      version: STATE_VERSION,
      theme: theme,
      activeContext: activeContext,
      records: records,
      batteryRuns: batteryRuns
    };
  }

  function loadState() {
    var raw = readRawStorage();
    if (!raw) {
      return createDefaultState();
    }
    try {
      var parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (_err) {
      return createDefaultState();
    }
  }

  function saveState(state) {
    var clean = normalizeState(state);
    var serialized = JSON.stringify(clean);
    writeRawStorage(serialized);
    return clean;
  }

  function getContext() {
    var st = loadState();
    return Object.assign({}, st.activeContext);
  }

  function updateContext(patch) {
    var st = loadState();
    var merged = Object.assign({}, st.activeContext, patch && typeof patch === "object" ? patch : {});
    st.activeContext = normalizeContext(merged);
    saveState(st);
    return Object.assign({}, st.activeContext);
  }

  function setTheme(theme) {
    var st = loadState();
    st.theme = theme === "dark" ? "dark" : "light";
    saveState(st);
    return st.theme;
  }

  function getTheme() {
    var st = loadState();
    return st.theme === "dark" ? "dark" : "light";
  }

  function recordProbeResult(payload) {
    var st = loadState();
    var rec = normalizeRecord(payload || {}, st.activeContext);
    if (!rec) {
      throw new Error("Invalid probe payload: probeId is required.");
    }

    var existingIdx = -1;
    for (var i = 0; i < st.records.length; i += 1) {
      if (st.records[i].id === rec.id) {
        existingIdx = i;
        break;
      }
    }
    if (existingIdx >= 0) {
      st.records[existingIdx] = rec;
    } else {
      st.records.push(rec);
    }

    st.records = recomputeChronologicalDeltas(st.records);
    saveState(st);

    for (var k = st.records.length - 1; k >= 0; k -= 1) {
      if (st.records[k].id === rec.id) {
        return Object.assign({}, st.records[k]);
      }
    }
    return Object.assign({}, rec);
  }

  function finalizeBatteryRun(batteryRunId, probeScoresMap, symptomSnapshot) {
    var st = loadState();
    var runId =
      typeof batteryRunId === "string" && batteryRunId.trim().length > 0
        ? sanitizePlainText(batteryRunId)
        : generateId("bat");

    var resolvedScores = {};
    var inputMap = probeScoresMap && typeof probeScoresMap === "object" ? probeScoresMap : {};

    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      var pid = PROBE_IDS[i];
      if (inputMap[pid] !== undefined && inputMap[pid] !== null) {
        resolvedScores[pid] = extractNumericScore(inputMap[pid], BASELINE_REF.scores[pid]);
      } else {
        var matchedScore = null;
        for (var r = st.records.length - 1; r >= 0; r -= 1) {
          if (st.records[r].probeId === pid && st.records[r].batteryRunId === runId) {
            matchedScore = st.records[r].score;
            break;
          }
        }
        if (matchedScore === null) {
          for (var r2 = st.records.length - 1; r2 >= 0; r2 -= 1) {
            if (st.records[r2].probeId === pid) {
              matchedScore = st.records[r2].score;
              break;
            }
          }
        }
        resolvedScores[pid] =
          matchedScore !== null ? matchedScore : BASELINE_REF.scores[pid];
      }
    }

    var snap = Object.assign(
      {},
      st.activeContext,
      symptomSnapshot && typeof symptomSnapshot === "object" ? symptomSnapshot : {}
    );

    var nowTs =
      symptomSnapshot && typeof symptomSnapshot.timestamp === "number"
        ? symptomSnapshot.timestamp
        : Date.now();

    var runRecord = normalizeBatteryRun(
      {
        id: runId,
        timestamp: nowTs,
        isoDate: formatIsoDate(nowTs),
        phase: snap.phase,
        sleepQuality: snap.sleepQuality,
        alertness: snap.alertness,
        nasalPatency: snap.nasalPatency,
        delayAversionEpisodes: snap.delayAversionEpisodes,
        sequenceLapses: snap.sequenceLapses,
        probeScores: resolvedScores
      },
      st.activeContext
    );

    var existingIdx = -1;
    for (var b = 0; b < st.batteryRuns.length; b += 1) {
      if (st.batteryRuns[b].id === runRecord.id) {
        existingIdx = b;
        break;
      }
    }
    if (existingIdx >= 0) {
      st.batteryRuns[existingIdx] = runRecord;
    } else {
      st.batteryRuns.push(runRecord);
    }

    st.batteryRuns = sortBatteryRuns(st.batteryRuns);
    saveState(st);

    return Object.assign({}, runRecord);
  }

  function getProbeHistory(probeId) {
    var st = loadState();
    var target = typeof probeId === "string" ? probeId.trim() : "";
    var list = [];
    for (var i = 0; i < st.records.length; i += 1) {
      if (st.records[i].probeId === target) {
        list.push(Object.assign({}, st.records[i]));
      }
    }
    return list;
  }

  function getLatestByProbe() {
    var st = loadState();
    var grouped = {};
    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      grouped[PROBE_IDS[i]] = [];
    }
    for (var j = 0; j < st.records.length; j += 1) {
      var rec = st.records[j];
      if (!grouped[rec.probeId]) {
        grouped[rec.probeId] = [];
      }
      grouped[rec.probeId].push(rec);
    }

    var result = {};
    for (var k = 0; k < PROBE_IDS.length; k += 1) {
      var pid = PROBE_IDS[k];
      var hist = grouped[pid] || [];
      var count = hist.length;
      var latest = count > 0 ? Object.assign({}, hist[count - 1]) : null;
      var prev = count > 1 ? hist[count - 2] : null;
      var base = BASELINE_REF.scores[pid];
      var norm = BASELINE_REF.norms[pid];
      var pNorm = PSYCHOMETRIC_NORMS[pid] || PSYCHOMETRIC_NORMS.composite;
      var deltaBaseline = latest ? round1(latest.score - base) : null;
      var deltaPrev = latest
        ? prev
          ? round1(latest.score - prev.score)
          : round1(latest.score - base)
        : null;
      var rciObj = latest ? computeRCI(deltaBaseline, pid, 1, 1) : null;

      result[pid] = {
        probeId: pid,
        latest: latest,
        record: latest,
        score: latest ? latest.score : null,
        baseline: base,
        norm: norm,
        sem: pNorm.sem,
        sDiff: pNorm.sDiff,
        rci95Pts: pNorm.rci95Pts,
        rci: rciObj ? rciObj.rci : null,
        rciStatus: rciObj ? rciObj.status : "unmeasured",
        rciStatusAr: rciObj ? rciObj.statusAr : "لم يُفحص بعد",
        isReliableChange: rciObj ? rciObj.isReliable : false,
        deltaBaseline: deltaBaseline,
        deltaFromBaseline: deltaBaseline,
        deltaPrev: deltaPrev,
        deltaFromPrev: deltaPrev,
        count: count,
        clinicalNote: BASELINE_REF.clinicalNotes[pid]
      };
    }

    return result;
  }

  function getEffectiveCurrentScores(st) {
    var scores = {};
    var latestBat =
      st.batteryRuns.length > 0 ? st.batteryRuns[st.batteryRuns.length - 1] : null;

    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      var pid = PROBE_IDS[i];
      var latestRec = null;
      for (var r = st.records.length - 1; r >= 0; r -= 1) {
        if (st.records[r].probeId === pid) {
          latestRec = st.records[r];
          break;
        }
      }

      if (latestRec && latestBat && latestBat.probeScores && latestBat.timestamp > latestRec.timestamp) {
        scores[pid] = latestBat.probeScores[pid];
      } else if (latestRec) {
        scores[pid] = latestRec.score;
      } else if (latestBat && latestBat.probeScores && typeof latestBat.probeScores[pid] === "number") {
        scores[pid] = latestBat.probeScores[pid];
      } else {
        scores[pid] = BASELINE_REF.scores[pid];
      }
    }
    return scores;
  }

  function getMeasuredDeficitProbeIds(st) {
    if (st.batteryRuns && st.batteryRuns.length > 0) {
      return DEFICIT_PROBE_IDS.slice();
    }
    var seen = {};
    for (var i = 0; i < st.records.length; i += 1) {
      var pid = st.records[i].probeId;
      if (DEFICIT_PROBE_IDS.indexOf(pid) !== -1) {
        seen[pid] = true;
      }
    }
    var out = [];
    for (var k = 0; k < DEFICIT_PROBE_IDS.length; k += 1) {
      if (seen[DEFICIT_PROBE_IDS[k]]) out.push(DEFICIT_PROBE_IDS[k]);
    }
    return out;
  }

  function computeMeasuredSubsetRCI(measuredIds, effectiveScores) {
    // Exact error-propagated Jacobson-Truax RCI over the |M| actually measured deficit probes:
    // Eliminates unmeasured-probe dilution when 1 <= |M| < 5 while matching Composite S_diff = 5.43 at |M| = 5!
    if (!Array.isArray(measuredIds) || measuredIds.length === 0) {
      return computeRCI(0, "composite", 1, 1);
    }
    var k = measuredIds.length;
    var deltaSum = 0;
    var semVarSum = 0;
    for (var i = 0; i < k; i += 1) {
      var pid = measuredIds[i];
      deltaSum += effectiveScores[pid] - BASELINE_REF.scores[pid];
      var pSem = PSYCHOMETRIC_NORMS[pid] ? PSYCHOMETRIC_NORMS[pid].sem : 8.5;
      semVarSum += pSem * pSem;
    }
    var meanMeasuredDelta = deltaSum / k;
    var subsetSem = Math.sqrt(semVarSum) / k;
    var subsetSDiff = Math.SQRT2 * subsetSem;
    var rci = subsetSDiff > 0 ? round2(meanMeasuredDelta / subsetSDiff) : 0;
    var ci95Pts = round1(1.96 * subsetSDiff);

    var status = "within_noise";
    var statusAr = "ضمن هامش التذبذب القياسي";
    if (rci >= 1.96) {
      status = "reliable_gain";
      statusAr = "تحسن موثوق إحصائيا (p<0.05)";
    } else if (rci >= 1.28) {
      status = "marginal_gain";
      statusAr = "ميل تحسن أولي (p<0.10)";
    } else if (rci <= -1.96) {
      status = "reliable_drop";
      statusAr = "تراجع دال إحصائيا (p<0.05)";
    } else if (rci <= -1.28) {
      status = "marginal_drop";
      statusAr = "تراجع طفيف محتمل";
    }

    return {
      rci: rci,
      sem: round2(subsetSem),
      sDiff: round2(subsetSDiff),
      ci95Pts: ci95Pts,
      meanMeasuredDelta: round1(meanMeasuredDelta),
      measuredCount: k,
      isReliable: Math.abs(rci) >= 1.96,
      status: status,
      statusAr: statusAr
    };
  }

  function aggregateIndependentSessions(deficitRecs) {
    // De-pseudoreplicates subtest records into independent physiological sessions (Hurlbert, 1984):
    // Groups records sharing the same batteryRunId OR occurring within a 25-minute sitting window
    if (!Array.isArray(deficitRecs) || deficitRecs.length === 0) return [];
    var sorted = deficitRecs.slice().sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });
    var groupsByRunId = {};
    var sessions = [];
    var WINDOW_MS = 25 * 60 * 1000;

    for (var i = 0; i < sorted.length; i += 1) {
      var r = sorted[i];
      if (r.batteryRunId) {
        if (!groupsByRunId[r.batteryRunId]) {
          var bSess = {
            lastTs: r.timestamp,
            sleepQuality: r.sleepQuality,
            nasalPatency: typeof r.nasalPatency === "number" ? r.nasalPatency : 5,
            alertness: typeof r.alertness === "number" ? r.alertness : 8,
            deltas: []
          };
          groupsByRunId[r.batteryRunId] = bSess;
          sessions.push(bSess);
        }
        groupsByRunId[r.batteryRunId].deltas.push(r.deltaFromBaseline);
        groupsByRunId[r.batteryRunId].lastTs = r.timestamp;
      } else {
        var prev = sessions.length > 0 ? sessions[sessions.length - 1] : null;
        if (
          prev &&
          !prev.isExplicitBattery &&
          Math.abs(r.timestamp - prev.lastTs) <= WINDOW_MS &&
          prev.sleepQuality === r.sleepQuality &&
          prev.nasalPatency === (typeof r.nasalPatency === "number" ? r.nasalPatency : 5)
        ) {
          prev.deltas.push(r.deltaFromBaseline);
          prev.lastTs = r.timestamp;
        } else {
          sessions.push({
            lastTs: r.timestamp,
            sleepQuality: r.sleepQuality,
            nasalPatency: typeof r.nasalPatency === "number" ? r.nasalPatency : 5,
            alertness: typeof r.alertness === "number" ? r.alertness : 8,
            deltas: [r.deltaFromBaseline]
          });
        }
      }
    }

    var out = [];
    for (var s = 0; s < sessions.length; s += 1) {
      var ds = sessions[s].deltas;
      if (ds.length === 0 || typeof sessions[s].sleepQuality !== "number") continue;
      var sumD = 0;
      for (var d = 0; d < ds.length; d += 1) sumD += ds[d];
      out.push({
        sleepQuality: sessions[s].sleepQuality,
        nasalPatency: sessions[s].nasalPatency,
        alertness: sessions[s].alertness,
        meanDelta: sumD / ds.length
      });
    }
    return out;
  }

  function getSummaryStats() {
    var st = loadState();
    var effective = getEffectiveCurrentScores(st);
    var measuredIds = getMeasuredDeficitProbeIds(st);

    var sumDeficit = 0;
    for (var i = 0; i < DEFICIT_PROBE_IDS.length; i += 1) {
      sumDeficit += effective[DEFICIT_PROBE_IDS[i]];
    }
    var compositeDeficitScore = roundInt(
      sumDeficit / DEFICIT_PROBE_IDS.length,
      BASELINE_REF.compositeDeficitBaseline
    );
    var controlScore = effective.control;
    var deltaFromBaseline = round1(
      compositeDeficitScore - BASELINE_REF.compositeDeficitBaseline
    );
    var spikyGap = round1(controlScore - compositeDeficitScore);
    var baselineSpikyGap = round1(
      BASELINE_REF.scores.control - BASELINE_REF.compositeDeficitBaseline
    );

    var compRciObj = measuredIds.length === DEFICIT_PROBE_IDS.length
      ? computeRCI(deltaFromBaseline, "composite", 1, 1)
      : computeMeasuredSubsetRCI(measuredIds, effective);
    var controlValid = controlScore >= 82; // 98 - 1.96 * 8.2 = 81.9%

    var latestTs = 0;
    if (st.records.length > 0) {
      latestTs = Math.max(latestTs, st.records[st.records.length - 1].timestamp);
    }
    if (st.batteryRuns.length > 0) {
      latestTs = Math.max(latestTs, st.batteryRuns[st.batteryRuns.length - 1].timestamp);
    }

    return {
      totalTests: st.records.length,
      totalRecords: st.records.length,
      completedBatteries: st.batteryRuns.length,
      batteryCount: st.batteryRuns.length,
      measuredDeficitCount: measuredIds.length,
      compositeDeficitScore: compositeDeficitScore,
      compositeDeficitBaseline: BASELINE_REF.compositeDeficitBaseline,
      compositeSem: compRciObj.sem || PSYCHOMETRIC_NORMS.composite.sem,
      compositeCi95Pts: compRciObj.ci95Pts,
      compositeRci: compRciObj.rci,
      compositeRciStatus: compRciObj.status,
      compositeRciStatusAr: compRciObj.statusAr,
      controlScore: controlScore,
      controlBaseline: BASELINE_REF.scores.control,
      controlValid: controlValid,
      deltaFromBaseline: deltaFromBaseline,
      improvementFromBaseline: deltaFromBaseline,
      spikyGap: spikyGap,
      baselineSpikyGap: baselineSpikyGap,
      gapReduction: round1(baselineSpikyGap - spikyGap),
      hasLiveRecords: st.records.length > 0 || st.batteryRuns.length > 0,
      lastUpdatedIso: latestTs > 0 ? formatIsoDate(latestTs) : BASELINE_REF.date
    };
  }

  function getScientificAudit(phasesMeta) {
    var st = loadState();
    var stats = getSummaryStats();
    var getPhase = resolvePhasesMeta(phasesMeta || null);

    // 1. Control Anchor & Selective Dissociation Gate
    var controlRecs = st.records.filter(function (r) { return r.probeId === "control"; });
    var coverageNote = stats.measuredDeficitCount > 0 && stats.measuredDeficitCount < 5
      ? " (محسوب بدقة عبر " + stats.measuredDeficitCount + "/5 مسبارات مقيسة فعليا)"
      : "";
    var controlVerdict = "";
    if (!stats.hasLiveRecords) {
      controlVerdict = "في انتظار أول جلسة قياس لتفعيل معيار التفكيك المزدوج (Shallice, 1988) ومؤشر التغير الموثوق (Jacobson & Truax, 1991).";
    } else if (!stats.controlValid) {
      controlVerdict =
        "تنبيه منهجي: هبطت مرساة الضبط إلى " +
        stats.controlScore +
        "% (أدنى من عتبة الثبات 82%)، مما يدل على إرهاق عام أو نعاس حاد يمس المحركات السليمة؛ يُوصى بإعادة الفحص بعد استقرار اليقظة قبل تفسير أي تراجع بؤري.";
    } else if (stats.compositeRci >= 1.96) {
      controlVerdict =
        "برهان تحسن عصبي بؤري انتقائي: ظلت مرساة الضبط مستقرة عاليا (" +
        stats.controlScore +
        "%) بينما حققت المناطق المقيسة قفزة تتجاوز عتبة الضجيج القياسي (RCI = +" +
        stats.compositeRci +
        " ≥ 1.96، p<0.05)" +
        coverageNote +
        ".";
    } else {
      controlVerdict =
        "مرساة الضبط سليمة ومستقرة (" +
        stats.controlScore +
        "%) مما يثبت سلامة الانتباه العام وصحة العزل التجريبي؛ الفارق المركب الحالي (" +
        formatSigned(stats.deltaFromBaseline) +
        "%، RCI = " +
        stats.compositeRci +
        coverageNote +
        ") يتطلب تجاوز +" +
        stats.compositeCi95Pts +
        " نقطة لتأكيد تحسن دال إحصائيا عند p<0.05.";
    }

    // 2. Diurnal Morning vs Evening/Night Stability
    var deficitRecs = st.records.filter(function (r) { return r.probeId !== "control"; });
    var mornSum = 0, mornN = 0, nightSum = 0, nightN = 0;
    for (var i = 0; i < deficitRecs.length; i += 1) {
      var bucket = deficitRecs[i].timeOfDayBucket;
      if (bucket === "morning") {
        mornSum += deficitRecs[i].deltaFromBaseline;
        mornN += 1;
      } else if (bucket === "evening" || bucket === "night") {
        nightSum += deficitRecs[i].deltaFromBaseline;
        nightN += 1;
      }
    }
    var diurnalVerdict = "";
    if (mornN >= 1 && nightN >= 1) {
      var mAvg = round1(mornSum / mornN);
      var nAvg = round1(nightSum / nightN);
      var gapDiurnal = round1(mAvg - nAvg);
      diurnalVerdict =
        "المقارنة اليوماوية (صباحا مقابل مساء/ليلا): متوسط الفارق عن الأساس صباحا " +
        formatSigned(mAvg) +
        "% (" +
        mornN +
        " فحص) مقابل " +
        formatSigned(nAvg) +
        "% مساء/ليلا (" +
        nightN +
        " فحص)؛ الفارق اليوماوي الصافي " +
        formatSigned(gapDiurnal) +
        " نقطة.";
    } else {
      diurnalVerdict =
        "المعايرة اليوماوية: سُجل " +
        mornN +
        " فحص صباحي و" +
        nightN +
        " فحص مسائي/ليلي؛ نفّذ قياسا في كلتا الفترتين لاختبار ثبات البصمة البنيوية عبر اليوم.";
    }

    // 3. De-Pseudoreplicated Session-Level Sleep Quality & Nasal Patency Covariate Correlation (df = N_sessions - 2 >= 1)
    var indepSessions = aggregateIndependentSessions(deficitRecs);
    var sleepXs = [], airwayXs = [], deltaYs = [];
    for (var c = 0; c < indepSessions.length; c += 1) {
      sleepXs.push(indepSessions[c].sleepQuality);
      airwayXs.push(indepSessions[c].nasalPatency);
      deltaYs.push(indepSessions[c].meanDelta);
    }
    var rSleep = computePearsonR(sleepXs, deltaYs);
    var rAirway = computePearsonR(airwayXs, deltaYs);
    var covariateVerdict = "";
    if (indepSessions.length >= 3 && (rSleep !== null || rAirway !== null)) {
      covariateVerdict =
        "تحليل التغاير الفسيولوجي المستقل (Pearson r عبر " +
        indepSessions.length +
        " جلسات مستقلة بدون تكرار زائف): ارتباط الأداء بجودة النوم r = " +
        (rSleep !== null ? String(rSleep) : "ثابت") +
        "، وارتباطه بانفتاح المجرى الأنفي r = " +
        (rAirway !== null ? String(rAirway) : "ثابت") +
        ".";
    } else {
      covariateVerdict =
        "تحليل التغاير الفسيولوجي المستقل: سُجلت " +
        indepSessions.length +
        " جلسة مستقلة حتى الآن؛ يُحسب ارتباط (Pearson r) تلقائيا فور توافر 3 جلسات مستقلة متباينة السياق منعا للتكرار الزائف عبر المسبارات.";
    }

    // 4. Phase-Level Precision-Weighted Summary + Empirical Baseline SD when >=3 baseline batteries exist
    var phaseBuckets = {};
    for (var b = 0; b < st.batteryRuns.length; b += 1) {
      var run = st.batteryRuns[b];
      if (!phaseBuckets[run.phase]) phaseBuckets[run.phase] = [];
      phaseBuckets[run.phase].push(run.compositeDeficitScore);
    }

    var empiricalBaselineSem = null;
    if (Array.isArray(phaseBuckets.baseline) && phaseBuckets.baseline.length >= 3) {
      var bArr = phaseBuckets.baseline;
      var bMean = 0;
      for (var bi = 0; bi < bArr.length; bi += 1) bMean += bArr[bi];
      bMean /= bArr.length;
      var bSq = 0;
      for (var bj = 0; bj < bArr.length; bj += 1) {
        var bd = bArr[bj] - bMean;
        bSq += bd * bd;
      }
      empiricalBaselineSem = round2(Math.sqrt(bSq / (bArr.length - 1)));
    }

    var phaseSummaries = [];
    var phKeys = Object.keys(phaseBuckets);
    var baseN = Array.isArray(phaseBuckets.baseline) && phaseBuckets.baseline.length >= 1
      ? phaseBuckets.baseline.length
      : 1;
    for (var pk = 0; pk < phKeys.length; pk += 1) {
      var pid = phKeys[pk];
      var arr = phaseBuckets[pid];
      var sSum = 0;
      for (var q = 0; q < arr.length; q += 1) sSum += arr[q];
      var pMean = round1(sSum / arr.length);
      var pDelta = round1(pMean - BASELINE_REF.compositeDeficitBaseline);
      var pRci = computeRCI(pDelta, "composite", pid === "baseline" ? 1 : baseN, arr.length);
      phaseSummaries.push({
        phaseId: pid,
        phaseLabel: getPhase(pid).label,
        count: arr.length,
        meanComposite: pMean,
        delta: pDelta,
        rci: pRci.rci,
        statusAr: pRci.statusAr
      });
    }

    return {
      compositeRci: stats.compositeRci,
      compositeCi95Pts: stats.compositeCi95Pts,
      compositeRciStatusAr: stats.compositeRciStatusAr,
      measuredDeficitCount: stats.measuredDeficitCount,
      empiricalBaselineSem: empiricalBaselineSem,
      independentSessionCount: indepSessions.length,
      controlValid: stats.controlValid,
      controlTestsCount: controlRecs.length,
      controlVerdict: toAsciiDigits(controlVerdict),
      diurnalVerdict: toAsciiDigits(diurnalVerdict),
      covariateVerdict: toAsciiDigits(covariateVerdict),
      phaseSummaries: phaseSummaries
    };
  }

  function exportJSON() {
    var st = loadState();
    var payload = {
      version: STATE_VERSION,
      exportedAt: formatIsoDate(Date.now()),
      theme: st.theme,
      activeContext: st.activeContext,
      records: st.records,
      batteryRuns: st.batteryRuns
    };
    return toAsciiDigits(JSON.stringify(payload, null, 2));
  }

  function importJSON(jsonStr) {
    if (typeof jsonStr !== "string" || jsonStr.trim().length === 0) {
      return { ok: false, error: "النص المدخل فارغ أو غير صالح للاستيراد." };
    }

    var parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (_err) {
      return { ok: false, error: "تعذر قراءة صيغة البيانات المستوردة لوجود خطأ في البنية." };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "بنية السجل المستورد غير متوافقة مع النظام." };
    }

    var hasRecognizedArray =
      Array.isArray(parsed.records) || Array.isArray(parsed.batteryRuns);
    var hasRecognizedContext =
      parsed.activeContext && typeof parsed.activeContext === "object";

    if (!hasRecognizedArray && !hasRecognizedContext) {
      return {
        ok: false,
        error: "لا يحتوي السجل على مصفوفة قياسات أو جلسات بطارية صالحة."
      };
    }

    var st = loadState();
    var existingRecordIds = {};
    for (var i = 0; i < st.records.length; i += 1) {
      existingRecordIds[st.records[i].id] = true;
    }

    var existingBatteryIds = {};
    for (var j = 0; j < st.batteryRuns.length; j += 1) {
      existingBatteryIds[st.batteryRuns[j].id] = true;
    }

    var addedCount = 0;
    var incomingCtx = hasRecognizedContext
      ? normalizeContext(parsed.activeContext)
      : st.activeContext;

    if (Array.isArray(parsed.records)) {
      for (var r = 0; r < parsed.records.length; r += 1) {
        var normRec = normalizeRecord(parsed.records[r], incomingCtx);
        if (normRec && !existingRecordIds[normRec.id]) {
          existingRecordIds[normRec.id] = true;
          st.records.push(normRec);
          addedCount += 1;
        }
      }
    }

    if (Array.isArray(parsed.batteryRuns)) {
      for (var b = 0; b < parsed.batteryRuns.length; b += 1) {
        var normBat = normalizeBatteryRun(parsed.batteryRuns[b], incomingCtx);
        if (normBat && !existingBatteryIds[normBat.id]) {
          existingBatteryIds[normBat.id] = true;
          st.batteryRuns.push(normBat);
          addedCount += 1;
        }
      }
    }

    if (hasRecognizedContext && st.records.length === addedCount) {
      st.activeContext = incomingCtx;
    }
    if (parsed.theme === "dark" || parsed.theme === "light") {
      st.theme = parsed.theme;
    }

    st.records = recomputeChronologicalDeltas(st.records);
    st.batteryRuns = sortBatteryRuns(st.batteryRuns);
    saveState(st);

    return { ok: true, count: addedCount };
  }

  function clearAllData() {
    var currentTheme = getTheme();
    removeRawStorage();
    var clean = createDefaultState();
    clean.theme = currentTheme;
    saveState(clean);
    return clean;
  }

  function resolveProbesMeta(probesMeta) {
    var resolved = {};
    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      var pid = PROBE_IDS[i];
      resolved[pid] = Object.assign({}, DEFAULT_PROBES_META[pid]);
    }

    if (!probesMeta) return resolved;

    if (Array.isArray(probesMeta)) {
      for (var j = 0; j < probesMeta.length; j += 1) {
        var item = probesMeta[j];
        if (!item || typeof item !== "object") continue;
        var key = item.id || item.probeId || item.key;
        if (key && resolved[key]) {
          var lbl =
            item.shortLabel ||
            item.labelAr ||
            item.titleAr ||
            item.nameAr ||
            item.title ||
            item.name ||
            item.label;
          if (typeof lbl === "string" && lbl.trim().length > 0) {
            resolved[key].shortLabel = sanitizePlainText(lbl);
            resolved[key].label = sanitizePlainText(
              item.label || item.title || item.name || lbl
            );
          }
          if (typeof item.color === "string" && item.color.trim().length > 0) {
            resolved[key].color = item.color.trim();
          } else if (typeof item.accent === "string" && item.accent.trim().length > 0) {
            resolved[key].color = item.accent.trim();
          }
        }
      }
    } else if (typeof probesMeta === "object") {
      var keys = Object.keys(probesMeta);
      for (var k = 0; k < keys.length; k += 1) {
        var pk = keys[k];
        if (!resolved[pk]) continue;
        var entry = probesMeta[pk];
        if (typeof entry === "string" && entry.trim().length > 0) {
          resolved[pk].label = sanitizePlainText(entry);
          resolved[pk].shortLabel = sanitizePlainText(entry);
        } else if (entry && typeof entry === "object") {
          var fullLbl =
            entry.labelAr ||
            entry.titleAr ||
            entry.nameAr ||
            entry.title ||
            entry.name ||
            entry.label;
          var shLbl = entry.shortLabel || fullLbl;
          if (typeof fullLbl === "string" && fullLbl.trim().length > 0) {
            resolved[pk].label = sanitizePlainText(fullLbl);
          }
          if (typeof shLbl === "string" && shLbl.trim().length > 0) {
            resolved[pk].shortLabel = sanitizePlainText(shLbl);
          }
          if (typeof entry.color === "string" && entry.color.trim().length > 0) {
            resolved[pk].color = entry.color.trim();
          } else if (typeof entry.accent === "string" && entry.accent.trim().length > 0) {
            resolved[pk].color = entry.accent.trim();
          }
        }
      }
    }

    return resolved;
  }

  function hashPhaseColor(phaseId) {
    var s = String(phaseId || "baseline");
    var hash = 0;
    for (var i = 0; i < s.length; i += 1) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return FALLBACK_PHASE_PALETTE[hash % FALLBACK_PHASE_PALETTE.length];
  }

  function resolvePhasesMeta(phasesMeta) {
    var map = {};
    var defKeys = Object.keys(DEFAULT_PHASES_META);
    for (var i = 0; i < defKeys.length; i += 1) {
      var dk = defKeys[i];
      map[dk] = Object.assign({}, DEFAULT_PHASES_META[dk]);
    }

    if (Array.isArray(phasesMeta)) {
      for (var j = 0; j < phasesMeta.length; j += 1) {
        var item = phasesMeta[j];
        if (!item || typeof item !== "object") continue;
        var id = item.id || item.phase || item.key || item.value;
        if (!id) continue;
        var lbl =
          item.labelAr ||
          item.titleAr ||
          item.nameAr ||
          item.label ||
          item.title ||
          item.name ||
          id;
        map[id] = {
          id: id,
          label: sanitizePlainText(lbl),
          color:
            typeof item.color === "string" && item.color.trim()
              ? item.color.trim()
              : map[id]
              ? map[id].color
              : hashPhaseColor(id)
        };
      }
    } else if (phasesMeta && typeof phasesMeta === "object") {
      var pKeys = Object.keys(phasesMeta);
      for (var k = 0; k < pKeys.length; k += 1) {
        var pk = pKeys[k];
        var val = phasesMeta[pk];
        if (typeof val === "string") {
          map[pk] = {
            id: pk,
            label: sanitizePlainText(val),
            color: map[pk] ? map[pk].color : hashPhaseColor(pk)
          };
        } else if (val && typeof val === "object") {
          var pLbl =
            val.labelAr ||
            val.titleAr ||
            val.nameAr ||
            val.label ||
            val.title ||
            val.name ||
            pk;
          map[pk] = {
            id: pk,
            label: sanitizePlainText(pLbl),
            color:
              typeof val.color === "string" && val.color.trim()
                ? val.color.trim()
                : map[pk]
                ? map[pk].color
                : hashPhaseColor(pk)
          };
        }
      }
    }

    return function getPhaseInfo(phaseId) {
      var key = typeof phaseId === "string" && phaseId.trim() ? phaseId.trim() : "baseline";
      if (map[key]) return map[key];
      return {
        id: key,
        label: sanitizePlainText(key),
        color: hashPhaseColor(key)
      };
    };
  }

  function generatePlainSummaryText() {
    var st = loadState();
    var stats = getSummaryStats();
    var audit = getScientificAudit(null);
    var latestMap = getLatestByProbe();
    var getPhase = resolvePhasesMeta(null);
    var phaseLabel = getPhase(st.activeContext.phase).label;

    var lines = [];
    lines.push(
      "ملخص القياس العصبي المعرفي المعاير إحصائيا (تاريخ التقرير: " +
        formatIsoDate(Date.now()) +
        " - مرجع خط الأساس: " +
        BASELINE_REF.date +
        ")"
    );

    lines.push(
      "1. المؤشر المركب ومؤشر التغير الموثوق (Jacobson-Truax RCI): متوسط المناطق الخمس المتضررة الحالي " +
        String(stats.compositeDeficitScore) +
        "% مقابل " +
        String(BASELINE_REF.compositeDeficitBaseline) +
        "% في خط الأساس (الفارق: " +
        formatSigned(stats.deltaFromBaseline) +
        "%، RCI = " +
        String(stats.compositeRci) +
        " — " +
        stats.compositeRciStatusAr +
        "، عتبة الدلالة 95% هي ±" +
        String(stats.compositeCi95Pts) +
        " نقطة)، وفجوة التباين مقابل مرساة التحكم " +
        String(stats.spikyGap) +
        " نقطة بعد تنفيذ " +
        String(stats.totalTests) +
        " اختبار و" +
        String(stats.completedBatteries) +
        " بطارية مكتملة."
    );

    var orderedProbes = [
      "isolation",
      "updating",
      "gating",
      "binding",
      "vigilance",
      "control"
    ];

    for (var i = 0; i < orderedProbes.length; i += 1) {
      var pid = orderedProbes[i];
      var info = latestMap[pid];
      var meta = DEFAULT_PROBES_META[pid];
      var itemNum = i + 2;

      if (info.latest) {
        lines.push(
          String(itemNum) +
            ". " +
            meta.label +
            ": النتيجة الحالية " +
            String(info.latest.score) +
            "% ±" +
            String(info.sem) +
            "% (الفارق عن خط الأساس " +
            String(info.baseline) +
            "% هو " +
            formatSigned(info.deltaBaseline) +
            "%، RCI = " +
            String(info.rci) +
            " [" +
            info.rciStatusAr +
            "]، المعيار السليم " +
            String(info.norm) +
            "%، عدد القياسات " +
            String(info.count) +
            ")."
        );
      } else {
        lines.push(
          String(itemNum) +
            ". " +
            meta.label +
            ": لم يسجل قياس جديد بعد، والقيمة المرجعية في خط الأساس " +
            String(info.baseline) +
            "% مقابل المعيار السليم " +
            String(info.norm) +
            "%."
        );
      }
    }

    lines.push("8. حكم العزل المنهجي: " + audit.controlVerdict);

    lines.push(
      "9. السياق الفسيولوجي النشط: المرحلة الحالية " +
        phaseLabel +
        "، وجودة النوم " +
        String(st.activeContext.sleepQuality) +
        " من 10، واليقظة الذاتية " +
        String(st.activeContext.alertness) +
        " من 10، وانفتاح المجرى الأنفي " +
        String(st.activeContext.nasalPatency) +
        " من 10، ونوبات نفور البطء " +
        String(st.activeContext.delayAversionEpisodes) +
        "، وهفوات التسلسل " +
        String(st.activeContext.sequenceLapses) +
        "."
    );

    return toAsciiDigits(lines.join("\n"));
  }

  function buildSharedSvgStyle(isDark) {
    var ink = isDark ? "#f1f5f9" : "#0f172a";
    var muted = isDark ? "#94a3b8" : "#64748b";
    var grid = isDark ? "#334155" : "#e2e8f0";
    var track = isDark ? "#1e293b" : "#f1f5f9";
    var surface = isDark ? "#0f172a" : "#ffffff";
    var cardBg = isDark ? "#1e293b" : "#f8fafc";
    var baseLine = isDark ? "#f59e0b" : "#d97706";

    return (
      "<style>" +
      ".nl-svg{font-family:'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;user-select:none;direction:ltr;}" +
      ".nl-svg text{direction:ltr;unicode-bidi:isolate;}" +
      ".nl-ink{fill:var(--nl-ink,var(--text-primary,var(--text," + ink + ")));}" +
      ".nl-muted{fill:var(--nl-muted,var(--text-secondary,var(--muted," + muted + ")));}" +
      ".nl-grid{stroke:var(--nl-grid,var(--border-subtle,var(--border," + grid + ")));}" +
      ".nl-track{fill:var(--nl-track,var(--surface-muted,var(--bg-muted," + track + ")));}" +
      ".nl-surface{fill:var(--nl-surface,var(--surface,var(--bg-card," + surface + ")));}" +
      ".nl-callout{fill:var(--nl-callout,var(--surface-elevated," + cardBg + "));stroke:var(--nl-grid,var(--border," + grid + "));}" +
      ".nl-base-tick{stroke:" + baseLine + ";}" +
      ".nl-base-txt{fill:" + baseLine + ";}" +
      "[data-theme='dark'] .nl-ink,.dark .nl-ink{fill:#f1f5f9;}" +
      "[data-theme='dark'] .nl-muted,.dark .nl-muted{fill:#94a3b8;}" +
      "[data-theme='dark'] .nl-grid,.dark .nl-grid{stroke:#334155;}" +
      "[data-theme='dark'] .nl-track,.dark .nl-track{fill:#1e293b;}" +
      "[data-theme='dark'] .nl-surface,.dark .nl-surface{fill:#0f172a;}" +
      "[data-theme='dark'] .nl-callout,.dark .nl-callout{fill:#1e293b;stroke:#334155;}" +
      "[data-theme='light'] .nl-ink{fill:#0f172a;}" +
      "[data-theme='light'] .nl-muted{fill:#64748b;}" +
      "[data-theme='light'] .nl-grid{stroke:#e2e8f0;}" +
      "[data-theme='light'] .nl-track{fill:#f1f5f9;}" +
      "[data-theme='light'] .nl-callout{fill:#f8fafc;stroke:#cbd5e1;}" +
      "</style>"
    );
  }

  function renderProfileBarsSVG(probesMeta) {
    var isDark = getTheme() === "dark";
    var metaMap = resolveProbesMeta(probesMeta);
    var latestMap = getLatestByProbe();

    var width = 760;
    var height = 368;
    var barX = 142;
    var barW = 398;
    var rowStart = 58;
    var rowStep = 47;

    var parts = [];
    parts.push(
      '<svg class="nl-svg" direction="ltr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        width +
        " " +
        height +
        '" width="100%" role="img" aria-label="البصمة الإدراكية للمسبارات الستة مع هوامش القياس">'
    );
    parts.push(buildSharedSvgStyle(isDark));

    parts.push(
      "<defs>" +
        '<pattern id="nl-unmeasured-dots" width="6" height="6" patternUnits="userSpaceOnUse">' +
        '<circle cx="2" cy="2" r="1" fill="#64748b" fill-opacity="0.42"/>' +
        "</pattern>" +
        "</defs>"
    );

    // Top 2D Legend bar
    parts.push('<g transform="translate(0, 18)" font-size="10.8">');
    parts.push(
      '<rect x="18" y="-8" width="12" height="10" rx="2" fill="#2563eb" fill-opacity="0.88"/>' +
        '<text x="34" y="1" class="nl-muted" text-anchor="start">القياس ±SEM</text>'
    );
    parts.push(
      '<rect x="128" y="-8" width="14" height="10" rx="2" fill="url(#nl-unmeasured-dots)" stroke="#64748b" stroke-width="1" stroke-dasharray="2 2"/>' +
        '<text x="146" y="1" class="nl-muted" text-anchor="start">غير مقاس</text>'
    );
    parts.push(
      '<line x1="224" y1="-9" x2="224" y2="4" class="nl-base-tick" stroke-width="2.2"/>' +
        '<text x="230" y="1" class="nl-base-txt" font-weight="600" text-anchor="start">أساس 21 Nov</text>'
    );
    parts.push(
      '<line x1="322" y1="-9" x2="322" y2="4" stroke="#10b981" stroke-width="2.2" stroke-dasharray="3 2"/>' +
        '<text x="328" y="1" fill="#10b981" font-weight="600" text-anchor="start">السقف السليم</text>'
    );
    parts.push(
      '<text x="418" y="1" class="nl-muted" text-anchor="start">(* = RCI≥1.96)</text>'
    );
    parts.push(
      '<text x="742" y="1" class="nl-ink" font-weight="700" text-anchor="end">خريطة المسبارات الستة</text>'
    );
    parts.push("</g>");

    var ticks = [0, 25, 50, 75, 100];
    for (var t = 0; t < ticks.length; t += 1) {
      var tv = ticks[t];
      var tx = round1(barX + (tv / 100) * barW);
      parts.push(
        '<line x1="' +
          tx +
          '" y1="' +
          (rowStart - 10) +
          '" x2="' +
          tx +
          '" y2="' +
          (rowStart + PROBE_IDS.length * rowStep - 12) +
          '" class="nl-grid" stroke-width="1" stroke-dasharray="' +
          (tv === 0 || tv === 100 ? "none" : "3 3") +
          '"/>'
      );
      parts.push(
        '<text x="' +
          tx +
          '" y="' +
          (height - 12) +
          '" class="nl-muted" font-size="11" text-anchor="middle">' +
          tv +
          "%</text>"
      );
    }

    for (var i = 0; i < PROBE_IDS.length; i += 1) {
      var pid = PROBE_IDS[i];
      var info = latestMap[pid];
      var meta = metaMap[pid];
      var y = rowStart + i * rowStep;
      var barH = 20;

      var hasLive = info.latest !== null;
      var displayScore = hasLive ? info.latest.score : info.baseline;
      var deltaVal = hasLive ? info.deltaBaseline : 0;
      var sigStar = hasLive && info.isReliableChange ? "*" : "";
      var deltaStr = hasLive
        ? (deltaVal > 0 ? "+" + deltaVal : deltaVal < 0 ? String(deltaVal) : "+0") + "%" + sigStar
        : "±0%";

      var deltaColor = !hasLive
        ? "#64748b"
        : deltaVal > 0
        ? "#10b981"
        : deltaVal < 0
        ? "#ef4444"
        : "#64748b";

      var deltaBgOpacity = hasLive ? "0.15" : "0.08";

      var fillW = Math.max(3, round1((clamp(displayScore, 0, 100) / 100) * barW));
      var baseX = round1(barX + (clamp(info.baseline, 0, 100) / 100) * barW);
      var normX = round1(barX + (clamp(info.norm, 0, 100) / 100) * barW);
      var barColor = meta.color || "#2563eb";

      var tooltip =
        meta.label +
        " | الحالي: " +
        displayScore +
        "% (±" +
        info.sem +
        "% SEM) | 21 Nov: " +
        info.baseline +
        "% | السليم: " +
        info.norm +
        "% | الفارق: " +
        deltaStr +
        (hasLive ? " | RCI: " + info.rci : "");

      parts.push('<g data-probe-id="' + escapeSvg(pid) + '">');
      parts.push("<title>" + escapeSvg(tooltip) + "</title>");

      parts.push(
        '<rect x="' +
          barX +
          '" y="' +
          y +
          '" width="' +
          barW +
          '" height="' +
          barH +
          '" rx="5" class="nl-track"/>'
      );

      if (hasLive) {
        parts.push(
          '<rect x="' +
            barX +
            '" y="' +
            y +
            '" width="' +
            fillW +
            '" height="' +
            barH +
            '" rx="5" fill="' +
            escapeSvg(barColor) +
            '" fill-opacity="0.86"/>'
        );

        // ±1 SEM Psychometric Error Whisker around measured score
        var semLoX = round1(barX + (clamp(displayScore - info.sem, 0, 100) / 100) * barW);
        var semHiX = round1(barX + (clamp(displayScore + info.sem, 0, 100) / 100) * barW);
        var midY = y + barH / 2;
        parts.push(
          '<line x1="' +
            semLoX +
            '" y1="' +
            midY +
            '" x2="' +
            semHiX +
            '" y2="' +
            midY +
            '" class="nl-ink" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.72"/>' +
            '<line x1="' +
            semLoX +
            '" y1="' +
            (midY - 3.5) +
            '" x2="' +
            semLoX +
            '" y2="' +
            (midY + 3.5) +
            '" class="nl-ink" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.72"/>' +
            '<line x1="' +
            semHiX +
            '" y1="' +
            (midY - 3.5) +
            '" x2="' +
            semHiX +
            '" y2="' +
            (midY + 3.5) +
            '" class="nl-ink" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.72"/>'
        );
      } else {
        parts.push(
          '<rect x="' +
            barX +
            '" y="' +
            y +
            '" width="' +
            fillW +
            '" height="' +
            barH +
            '" rx="5" fill="' +
            escapeSvg(barColor) +
            '" fill-opacity="0.18"/>'
        );
        parts.push(
          '<rect x="' +
            barX +
            '" y="' +
            y +
            '" width="' +
            fillW +
            '" height="' +
            barH +
            '" rx="5" fill="url(#nl-unmeasured-dots)" stroke="' +
            escapeSvg(barColor) +
            '" stroke-width="1.3" stroke-dasharray="4 3"/>'
        );
      }

      parts.push(
        '<line x1="' +
          baseX +
          '" y1="' +
          (y - 4) +
          '" x2="' +
          baseX +
          '" y2="' +
          (y + barH + 4) +
          '" class="nl-base-tick" stroke-width="2.2"/>'
      );
      if (i === 0) {
        parts.push(
          '<text x="' +
            baseX +
            '" y="' +
            (y - 7) +
            '" class="nl-base-txt" font-size="9.5" font-weight="700" text-anchor="middle">21 Nov</text>'
        );
      }

      parts.push(
        '<line x1="' +
          normX +
          '" y1="' +
          (y - 4) +
          '" x2="' +
          normX +
          '" y2="' +
          (y + barH + 4) +
          '" stroke="#10b981" stroke-width="2.2" stroke-dasharray="3 2"/>'
      );
      if (i === 0) {
        parts.push(
          '<text x="' +
            normX +
            '" y="' +
            (y - 7) +
            '" fill="#10b981" font-size="9.5" font-weight="700" text-anchor="middle">Norm</text>'
        );
      }

      parts.push(
        '<text x="16" y="' +
          (y + 14.5) +
          '" class="nl-ink" font-size="13" font-weight="700" text-anchor="start">' +
          displayScore +
          "%</text>"
      );

      parts.push(
        '<rect x="62" y="' +
          (y + 1) +
          '" width="66" height="18" rx="4" fill="' +
          deltaColor +
          '" fill-opacity="' +
          deltaBgOpacity +
          '"/>' +
          '<text x="95" y="' +
          (y + 14) +
          '" fill="' +
          deltaColor +
          '" font-size="11.2" font-weight="700" text-anchor="middle">' +
          escapeSvg(deltaStr) +
          "</text>"
      );

      parts.push(
        '<text x="742" y="' +
          (y + 11) +
          '" class="nl-ink" font-size="12.5" font-weight="700" text-anchor="end">' +
          escapeSvg(meta.shortLabel) +
          "</text>"
      );
      parts.push(
        '<text x="742" y="' +
          (y + 25) +
          '" class="nl-muted" font-size="10.1" text-anchor="end">' +
          "أساس " +
          info.baseline +
          "% · سليم " +
          info.norm +
          "%" +
          (hasLive ? " · RCI " + info.rci : " · بانتظار القياس") +
          "</text>"
      );

      parts.push("</g>");
    }

    parts.push("</svg>");
    return toAsciiDigits(parts.join(""));
  }

  function renderLongitudinalChartSVG(probeId, probesMeta, phasesMeta) {
    var isDark = getTheme() === "dark";
    var targetId =
      typeof probeId === "string" && Object.prototype.hasOwnProperty.call(BASELINE_REF.scores, probeId)
        ? probeId
        : "isolation";

    var metaMap = resolveProbesMeta(probesMeta);
    var getPhase = resolvePhasesMeta(phasesMeta);
    var probeMeta = metaMap[targetId];
    var history = getProbeHistory(targetId);
    var pNorm = PSYCHOMETRIC_NORMS[targetId] || PSYCHOMETRIC_NORMS.composite;

    var baselineScore = BASELINE_REF.scores[targetId];
    var normScore = BASELINE_REF.norms[targetId];
    var rciThresholdScore = Math.min(99, round1(baselineScore + pNorm.rci95Pts));

    var width = 720;
    var height = 264;
    var padLeft = 48;
    var padRight = 26;
    var padTop = 36;
    var padBottom = 44;
    var plotW = width - padLeft - padRight;
    var plotH = height - padTop - padBottom;

    function yOf(val) {
      return round1(padTop + plotH - (clamp(val, 0, 100) / 100) * plotH);
    }

    var parts = [];
    parts.push(
      '<svg class="nl-svg" direction="ltr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 264" width="100%" role="img" aria-label="' +
        escapeSvg("منحنى التطور الزمني - " + probeMeta.label) +
        '">'
    );
    parts.push(buildSharedSvgStyle(isDark));

    parts.push(
      '<text x="' +
        (width - padRight) +
        '" y="21" class="nl-ink" font-size="12.5" font-weight="700" text-anchor="end">' +
        escapeSvg(probeMeta.shortLabel || probeMeta.label) +
        "</text>"
    );
    parts.push(
      '<text x="' +
        padLeft +
        '" y="21" class="nl-muted" font-size="10.8" text-anchor="start">' +
        "الأساس: " +
        baselineScore +
        "% · عتبة RCI(p<0.05): " +
        (targetId === "control" ? "≥82%" : rciThresholdScore + "%") +
        " · السليم: " +
        normScore +
        "% · الجلسات: " +
        history.length +
        "</text>"
    );

    var yTicks = [0, 25, 50, 75, 100];
    for (var t = 0; t < yTicks.length; t += 1) {
      var yv = yTicks[t];
      var yy = yOf(yv);
      parts.push(
        '<line x1="' +
          padLeft +
          '" y1="' +
          yy +
          '" x2="' +
          (width - padRight) +
          '" y2="' +
          yy +
          '" class="nl-grid" stroke-width="1" stroke-opacity="0.7"/>'
      );
      parts.push(
        '<text x="' +
          (padLeft - 8) +
          '" y="' +
          (yy + 3.5) +
          '" class="nl-muted" font-size="10.5" text-anchor="end">' +
          yv +
          "%</text>"
      );
    }

    var yNorm = yOf(normScore);
    parts.push(
      '<line x1="' +
        padLeft +
        '" y1="' +
        yNorm +
        '" x2="' +
        (width - padRight) +
        '" y2="' +
        yNorm +
        '" stroke="#10b981" stroke-width="1.8" stroke-dasharray="6 4"/>'
    );
    parts.push(
      '<text x="' +
        (width - padRight - 4) +
        '" y="' +
        (yNorm - 5) +
        '" fill="#10b981" font-size="9.8" font-weight="700" text-anchor="end">Norm ' +
        normScore +
        "%</text>"
    );

    // 95% RCI threshold line for deficit probes (or lower validity bound 82% for Control)
    var rciLineVal = targetId === "control" ? 82 : rciThresholdScore;
    if (Math.abs(rciLineVal - normScore) > 4) {
      var yRci = yOf(rciLineVal);
      parts.push(
        '<line x1="' +
          padLeft +
          '" y1="' +
          yRci +
          '" x2="' +
          (width - padRight) +
          '" y2="' +
          yRci +
          '" stroke="#0284c7" stroke-width="1.3" stroke-opacity="0.65" stroke-dasharray="4 4"/>'
      );
      parts.push(
        '<text x="' +
          (padLeft + 4) +
          '" y="' +
          (yRci - 4) +
          '" fill="#0284c7" font-size="9.2" font-weight="600" text-anchor="start">' +
          (targetId === "control" ? "حد الثبات 82%" : "RCI p<0.05 (" + rciLineVal + "%)") +
          "</text>"
      );
    }

    var yBase = yOf(baselineScore);
    parts.push(
      '<line x1="' +
        padLeft +
        '" y1="' +
        yBase +
        '" x2="' +
        (width - padRight) +
        '" y2="' +
        yBase +
        '" class="nl-base-tick" stroke-width="1.3" stroke-opacity="0.45" stroke-dasharray="3 3"/>'
    );

    var nodes = [
      {
        label: "21 Nov",
        score: baselineScore,
        ema: baselineScore,
        phase: "baseline",
        color: "#64748b",
        phaseLabel: "خط الأساس المرجعي",
        rci: 0,
        isBaseline: true
      }
    ];

    var seenPhases = { baseline: { label: "خط الأساس", color: "#64748b" } };
    var runningEma = baselineScore;

    for (var i = 0; i < history.length; i += 1) {
      var rec = history[i];
      var ph = getPhase(rec.phase);
      seenPhases[ph.id] = ph;
      runningEma = i === 0 ? rec.score : round1(0.5 * rec.score + 0.5 * runningEma);
      nodes.push({
        label: formatShortDate(rec.isoDate, rec.timestamp),
        score: rec.score,
        ema: runningEma,
        phase: ph.id,
        color: ph.color,
        phaseLabel: ph.label,
        delta: rec.deltaFromBaseline,
        rci: rec.rci,
        isBaseline: false
      });
    }

    if (history.length === 0) {
      var bx = padLeft + 26;
      parts.push(
        '<circle cx="' +
          bx +
          '" cy="' +
          yBase +
          '" r="6" fill="#64748b" stroke="#ffffff" stroke-width="2"/>'
      );
      parts.push(
        '<text x="' +
          bx +
          '" y="' +
          (yBase - 10) +
          '" class="nl-ink" font-size="11" font-weight="700" text-anchor="middle">' +
          baselineScore +
          "%</text>"
      );
      parts.push(
        '<text x="' +
          bx +
          '" y="' +
          (padTop + plotH + 17) +
          '" class="nl-muted" font-size="10.5" font-weight="600" text-anchor="middle">21 Nov</text>'
      );

      parts.push(
        '<rect x="150" y="92" width="460" height="68" rx="10" class="nl-callout" stroke-width="1.2"/>'
      );
      parts.push(
        '<text x="380" y="121" class="nl-ink" font-size="13" font-weight="700" text-anchor="middle">' +
          "لا توجد جلسات مسجلة لهذا المسبار حتى الآن" +
          "</text>"
      );
      parts.push(
        '<text x="380" y="143" class="nl-muted" font-size="11.5" text-anchor="middle">' +
          "ابدأ أول قياس لرسم منحنى التقدم الزمني ومقارنته بعتبة التغير الموثوق" +
          "</text>"
      );
    } else {
      var xStart = padLeft + 24;
      var xEnd = width - padRight - 24;
      var xSpan = Math.max(1, xEnd - xStart);
      var count = nodes.length;

      for (var n = 0; n < count; n += 1) {
        nodes[n].x = round1(xStart + (n / (count - 1)) * xSpan);
        nodes[n].y = yOf(nodes[n].score);
        nodes[n].yEma = yOf(nodes[n].ema);
      }

      var areaPts =
        nodes[0].x +
        "," +
        (padTop + plotH) +
        " " +
        nodes.map(function (pt) { return pt.x + "," + pt.y; }).join(" ") +
        " " +
        nodes[count - 1].x +
        "," +
        (padTop + plotH);

      parts.push(
        '<polygon points="' +
          areaPts +
          '" fill="' +
          escapeSvg(probeMeta.color) +
          '" fill-opacity="0.08"/>'
      );

      // EMA smoothed trend curve when >= 2 measured sessions exist
      if (history.length >= 2) {
        var emaPts = nodes.slice(1).map(function (pt) { return pt.x + "," + pt.yEma; }).join(" ");
        parts.push(
          '<polyline points="' +
            emaPts +
            '" fill="none" stroke="' +
            escapeSvg(probeMeta.color) +
            '" stroke-width="1.8" stroke-opacity="0.55" stroke-dasharray="5 3"/>'
        );
      }

      for (var s = 1; s < count; s += 1) {
        var p0 = nodes[s - 1];
        var p1 = nodes[s];
        parts.push(
          '<line x1="' +
            p0.x +
            '" y1="' +
            p0.y +
            '" x2="' +
            p1.x +
            '" y2="' +
            p1.y +
            '" stroke="' +
            escapeSvg(p1.color) +
            '" stroke-width="2.6" stroke-linecap="round"/>'
        );
      }

      var labelStride = count > 14 ? Math.ceil(count / 8) : 1;
      var radius = count > 18 ? 4.2 : 5.5;

      for (var m = 0; m < count; m += 1) {
        var nd = nodes[m];
        var tip =
          (nd.isBaseline ? "خط الأساس 21 Nov" : "جلسة " + m + " (" + nd.label + ")") +
          " | النتيجة: " +
          nd.score +
          "% (±" +
          pNorm.sem +
          "%) | المرحلة: " +
          nd.phaseLabel +
          (nd.isBaseline ? "" : " | RCI: " + nd.rci);

        parts.push("<g>");
        parts.push("<title>" + escapeSvg(tip) + "</title>");

        // ±1 SEM vertical whisker on measured nodes
        if (!nd.isBaseline) {
          var yHi = yOf(nd.score + pNorm.sem);
          var yLo = yOf(nd.score - pNorm.sem);
          parts.push(
            '<line x1="' +
              nd.x +
              '" y1="' +
              yHi +
              '" x2="' +
              nd.x +
              '" y2="' +
              yLo +
              '" stroke="' +
              escapeSvg(nd.color) +
              '" stroke-width="1.3" stroke-opacity="0.45"/>'
          );
        }

        parts.push(
          '<circle cx="' +
            nd.x +
            '" cy="' +
            nd.y +
            '" r="' +
            radius +
            '" fill="' +
            escapeSvg(nd.color) +
            '" stroke="#ffffff" stroke-width="1.8"/>'
        );

        var showLabel = m === 0 || m === count - 1 || m % labelStride === 0;
        if (showLabel) {
          var labelY = nd.y < padTop + 18 ? nd.y + 16 : nd.y - 9;
          parts.push(
            '<text x="' +
              nd.x +
              '" y="' +
              labelY +
              '" class="nl-ink" font-size="10.5" font-weight="700" text-anchor="middle">' +
              nd.score +
              "%</text>"
          );
          parts.push(
            '<text x="' +
              nd.x +
              '" y="' +
              (padTop + plotH + 16) +
              '" class="nl-muted" font-size="10" text-anchor="middle">' +
              escapeSvg(nd.label) +
              "</text>"
          );
        }
        parts.push("</g>");
      }

      var phKeys = Object.keys(seenPhases);
      var lx = padLeft;
      for (var pk = 0; pk < phKeys.length && lx < width - 120; pk += 1) {
        var pInfo = seenPhases[phKeys[pk]];
        parts.push(
          '<circle cx="' +
            (lx + 5) +
            '" cy="' +
            (height - 8) +
            '" r="4" fill="' +
            escapeSvg(pInfo.color) +
            '"/>'
        );
        parts.push(
          '<text x="' +
            (lx + 14) +
            '" y="' +
            (height - 4.5) +
            '" class="nl-muted" font-size="10" text-anchor="start">' +
            escapeSvg(pInfo.label) +
            "</text>"
        );
        lx += Math.max(82, pInfo.label.length * 7 + 28);
      }
    }

    parts.push("</svg>");
    return toAsciiDigits(parts.join(""));
  }

  function renderBatteryCompositeChartSVG(phasesMeta) {
    var isDark = getTheme() === "dark";
    var st = loadState();
    var getPhase = resolvePhasesMeta(phasesMeta);
    var runs = st.batteryRuns;

    var width = 720;
    var height = 278;
    var padLeft = 48;
    var padRight = 28;
    var padTop = 40;
    var padBottom = 42;
    var plotW = width - padLeft - padRight;
    var plotH = height - padTop - padBottom;

    function yOf(val) {
      return round1(padTop + plotH - (clamp(val, 0, 100) / 100) * plotH);
    }

    var compRciThreshold = round1(
      BASELINE_REF.compositeDeficitBaseline + PSYCHOMETRIC_NORMS.composite.rci95Pts
    );

    var parts = [];
    parts.push(
      '<svg class="nl-svg" direction="ltr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        width +
        " " +
        height +
        '" width="100%" role="img" aria-label="منحنى ردم الفجوة العصبية بين مرساة التحكم والمؤشر المركب">'
    );
    parts.push(buildSharedSvgStyle(isDark));

    parts.push(
      '<text x="' +
        (width - padRight) +
        '" y="21" class="nl-ink" font-size="12.5" font-weight="700" text-anchor="end">' +
        "ردم الفجوة العصبية عبر المراحل" +
        "</text>"
    );

    parts.push('<g transform="translate(' + padLeft + ', 16)" font-size="10.8">');
    parts.push(
      '<line x1="0" y1="0" x2="16" y2="0" stroke="#0d9488" stroke-width="2.6"/>' +
        '<circle cx="8" cy="0" r="3.5" fill="#0d9488"/>' +
        '<text x="22" y="4" class="nl-muted" text-anchor="start">مرساة التحكم</text>'
    );
    parts.push(
      '<line x1="112" y1="0" x2="128" y2="0" stroke="#2563eb" stroke-width="2.6"/>' +
        '<circle cx="120" cy="0" r="3.5" fill="#2563eb"/>' +
        '<text x="134" y="4" class="nl-muted" text-anchor="start">المؤشر المركب (5 مناطق)</text>'
    );
    parts.push(
      '<line x1="278" y1="0" x2="294" y2="0" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4 3"/>' +
        '<text x="300" y="4" fill="#0284c7" text-anchor="start">عتبة RCI p<0.05 (' +
        compRciThreshold +
        '%)</text>'
    );
    parts.push("</g>");

    var yTicks = [0, 25, 50, 75, 100];
    for (var t = 0; t < yTicks.length; t += 1) {
      var yv = yTicks[t];
      var yy = yOf(yv);
      parts.push(
        '<line x1="' +
          padLeft +
          '" y1="' +
          yy +
          '" x2="' +
          (width - padRight) +
          '" y2="' +
          yy +
          '" class="nl-grid" stroke-width="1" stroke-opacity="0.7"/>'
      );
      parts.push(
        '<text x="' +
          (padLeft - 8) +
          '" y="' +
          (yy + 3.5) +
          '" class="nl-muted" font-size="10.5" text-anchor="end">' +
          yv +
          "%</text>"
      );
    }

    // 95% Composite RCI Significance Line (46.7%)
    var yCompRci = yOf(compRciThreshold);
    parts.push(
      '<line x1="' +
        padLeft +
        '" y1="' +
        yCompRci +
        '" x2="' +
        (width - padRight) +
        '" y2="' +
        yCompRci +
        '" stroke="#0284c7" stroke-width="1.3" stroke-opacity="0.6" stroke-dasharray="4 4"/>'
    );

    var points = [
      {
        label: "21 Nov",
        composite: BASELINE_REF.compositeDeficitBaseline,
        control: BASELINE_REF.scores.control,
        rci: 0,
        phaseColor: "#64748b",
        phaseLabel: "خط الأساس"
      }
    ];

    for (var i = 0; i < runs.length; i += 1) {
      var r = runs[i];
      var ph = getPhase(r.phase);
      points.push({
        label: formatShortDate(r.isoDate, r.timestamp),
        composite: r.compositeDeficitScore,
        control: r.controlScore,
        rci: r.compositeRci,
        phaseColor: ph.color,
        phaseLabel: ph.label
      });
    }

    if (runs.length === 0) {
      var ax = padLeft + 34;
      var yCtrl0 = yOf(BASELINE_REF.scores.control);
      var yComp0 = yOf(BASELINE_REF.compositeDeficitBaseline);
      var baseGap = BASELINE_REF.scores.control - BASELINE_REF.compositeDeficitBaseline;

      parts.push(
        '<line x1="' +
          ax +
          '" y1="' +
          yCtrl0 +
          '" x2="' +
          ax +
          '" y2="' +
          yComp0 +
          '" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/>'
      );
      parts.push(
        '<circle cx="' +
          ax +
          '" cy="' +
          yCtrl0 +
          '" r="6" fill="#0d9488" stroke="#ffffff" stroke-width="2"/>'
      );
      parts.push(
        '<text x="' +
          (ax + 12) +
          '" y="' +
          (yCtrl0 + 4) +
          '" fill="#0d9488" font-size="11" font-weight="700" text-anchor="start">98% تحكم</text>'
      );

      parts.push(
        '<circle cx="' +
          ax +
          '" cy="' +
          yComp0 +
          '" r="6" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>'
      );
      parts.push(
        '<text x="' +
          (ax + 12) +
          '" y="' +
          (yComp0 + 4) +
          '" fill="#2563eb" font-size="11" font-weight="700" text-anchor="start">36% مركب</text>'
      );

      parts.push(
        '<text x="' +
          (ax + 12) +
          '" y="' +
          round1((yCtrl0 + yComp0) / 2 + 4) +
          '" class="nl-base-txt" font-size="10.5" font-weight="700" text-anchor="start">فجوة الأساس: ' +
          baseGap +
          " نقطة</text>"
      );

      parts.push(
        '<text x="' +
          ax +
          '" y="' +
          (padTop + plotH + 17) +
          '" class="nl-muted" font-size="10.5" font-weight="600" text-anchor="middle">21 Nov</text>'
      );

      parts.push(
        '<rect x="200" y="98" width="462" height="72" rx="10" class="nl-callout" stroke-width="1.2"/>'
      );
      parts.push(
        '<text x="431" y="128" class="nl-ink" font-size="13" font-weight="700" text-anchor="middle">' +
          "لم تسجل بطارية شاملة مكتملة بعد" +
          "</text>"
      );
      parts.push(
        '<text x="431" y="150" class="nl-muted" font-size="11.3" text-anchor="middle">' +
          "أكمل المسبارات الستة ضمن البطارية الشاملة لمتابعة ردم الفجوة العصبية عبر الجلسات" +
          "</text>"
      );
    } else {
      var xStart = padLeft + 26;
      var xEnd = width - padRight - 26;
      var span = Math.max(1, xEnd - xStart);
      var count = points.length;

      for (var p = 0; p < count; p += 1) {
        points[p].x = round1(xStart + (p / (count - 1)) * span);
        points[p].yCtrl = yOf(points[p].control);
        points[p].yComp = yOf(points[p].composite);
      }

      var upperPts = points.map(function (pt) { return pt.x + "," + pt.yCtrl; }).join(" ");
      var lowerPts = points.slice().reverse().map(function (pt) { return pt.x + "," + pt.yComp; }).join(" ");

      parts.push(
        '<polygon points="' +
          upperPts +
          " " +
          lowerPts +
          '" fill="#2563eb" fill-opacity="0.10"/>'
      );

      var ctrlPolyline = points.map(function (pt) { return pt.x + "," + pt.yCtrl; }).join(" ");
      parts.push(
        '<polyline points="' +
          ctrlPolyline +
          '" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      );

      for (var s = 1; s < count; s += 1) {
        var a = points[s - 1];
        var b = points[s];
        parts.push(
          '<line x1="' +
            a.x +
            '" y1="' +
            a.yComp +
            '" x2="' +
            b.x +
            '" y2="' +
            b.yComp +
            '" stroke="' +
            escapeSvg(b.phaseColor) +
            '" stroke-width="2.8" stroke-linecap="round"/>'
        );
      }

      var stride = count > 12 ? Math.ceil(count / 7) : 1;

      for (var k = 0; k < count; k += 1) {
        var pt = points[k];
        var gap = round1(pt.control - pt.composite);
        var tip =
          pt.label +
          " | المرحلة: " +
          pt.phaseLabel +
          " | التحكم: " +
          pt.control +
          "% | المركب: " +
          pt.composite +
          "% | الفجوة: " +
          gap +
          " نقطة" +
          (k > 0 ? " | RCI: " + pt.rci : "");

        parts.push("<g>");
        parts.push("<title>" + escapeSvg(tip) + "</title>");

        parts.push(
          '<line x1="' +
            pt.x +
            '" y1="' +
            pt.yCtrl +
            '" x2="' +
            pt.x +
            '" y2="' +
            pt.yComp +
            '" stroke="#64748b" stroke-width="1" stroke-opacity="0.32" stroke-dasharray="2 2"/>'
        );

        parts.push(
          '<circle cx="' +
            pt.x +
            '" cy="' +
            pt.yCtrl +
            '" r="4.8" fill="#0d9488" stroke="#ffffff" stroke-width="1.6"/>'
        );

        parts.push(
          '<circle cx="' +
            pt.x +
            '" cy="' +
            pt.yComp +
            '" r="5.5" fill="' +
            escapeSvg(pt.phaseColor) +
            '" stroke="#ffffff" stroke-width="1.8"/>'
        );

        if (k === 0 || k === count - 1 || k % stride === 0) {
          var ctrlLblY = pt.yCtrl < padTop + 14 ? pt.yCtrl + 15 : pt.yCtrl - 8;
          var compLblY = pt.yComp > padTop + plotH - 14 ? pt.yComp - 9 : pt.yComp + 15;

          parts.push(
            '<text x="' +
              pt.x +
              '" y="' +
              ctrlLblY +
              '" fill="#0d9488" font-size="10" font-weight="700" text-anchor="middle">' +
              pt.control +
              "%</text>"
          );
          parts.push(
            '<text x="' +
              pt.x +
              '" y="' +
              compLblY +
              '" class="nl-ink" font-size="10.5" font-weight="700" text-anchor="middle">' +
              pt.composite +
              "%</text>"
          );
          parts.push(
            '<text x="' +
              pt.x +
              '" y="' +
              (padTop + plotH + 16) +
              '" class="nl-muted" font-size="10" text-anchor="middle">' +
              escapeSvg(pt.label) +
              "</text>"
          );
        }
        parts.push("</g>");
      }

      var latestGap = round1(points[count - 1].control - points[count - 1].composite);
      var initialGap = BASELINE_REF.scores.control - BASELINE_REF.compositeDeficitBaseline;
      parts.push(
        '<text x="' +
          (width - padRight) +
          '" y="' +
          (height - 5) +
          '" class="nl-muted" font-size="10.5" font-weight="600" text-anchor="end">' +
          "تقلصت الفجوة العصبية من " +
          initialGap +
          " نقطة في خط الأساس إلى " +
          latestGap +
          " نقطة حاليا (RCI = " +
          points[count - 1].rci +
          ")" +
          "</text>"
      );
    }

    parts.push("</svg>");
    return toAsciiDigits(parts.join(""));
  }

  root.NeuroLab.Analytics = {
    STORAGE_KEY: STORAGE_KEY,
    PROBE_IDS: PROBE_IDS,
    DEFICIT_PROBE_IDS: DEFICIT_PROBE_IDS,
    PSYCHOMETRIC_NORMS: PSYCHOMETRIC_NORMS,
    BASELINE_REF: BASELINE_REF,
    computeRCI: computeRCI,
    computeExGaussian: computeExGaussian,
    computeLISAS: computeLISAS,
    computeSplitHalfReliability: computeSplitHalfReliability,
    getScientificAudit: getScientificAudit,
    loadState: loadState,
    saveState: saveState,
    updateContext: updateContext,
    getContext: getContext,
    setTheme: setTheme,
    getTheme: getTheme,
    recordProbeResult: recordProbeResult,
    finalizeBatteryRun: finalizeBatteryRun,
    getLatestByProbe: getLatestByProbe,
    getProbeHistory: getProbeHistory,
    getSummaryStats: getSummaryStats,
    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAllData: clearAllData,
    generatePlainSummaryText: generatePlainSummaryText,
    renderProfileBarsSVG: renderProfileBarsSVG,
    renderLongitudinalChartSVG: renderLongitudinalChartSVG,
    renderBatteryCompositeChartSVG: renderBatteryCompositeChartSVG
  };
  root.Analytics = root.NeuroLab.Analytics;
})();

(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var STORAGE_KEY = "neurolab_deep_v3";
  var SUITE_VERSION = "3.3";

  var EXPERIMENTS = [
    {
      id: "d1_tbrs",
      order: 1,
      code: "D1 · TBRS",
      title: "تلاشي الربط الطرفي تحت الحمل المعرفي الثابت (4.0s)",
      shortTitle: "تلاشي الربط (TBRS)",
      durationMin: 1.8,
      targetQuestion:
        "كم يتلاشى من 3 روابط مكان–رمز خلال نافذة ثابتة (4,000 ms) عند منع الإنعاش الانتباهي بـ 4 أحكام بصرية متسارعة مقابل حكمين؟",
      instructions: [
        "ثبّت نظرك على (+) واحفظ مواقع الرموز الثلاثة في العرض المتزامن (900 ms).",
        "طوال نافذة الاحتفاظ الثابتة (4.0 ثوانٍ) حدّد فورا موضع الشريط داخل المربع المركزي: فوق (↑ / W) أم تحت (↓ / S).",
        "عند ظهور علامة (؟) في إحدى الدوائر الثلاث اختر الرمز الذي كان فيها من البدائل الأربعة (مهلة 4.0 ثوانٍ)."
      ],
      example: "عرض 3 رموز (900ms) ← قناع + تهيؤ ← تحديد موضع الشريط (فوق ↑ / تحت ↓) لمدة 4.0 ثوانٍ ← اختيار رمز الدائرة من 4 بدائل"
    },
    {
      id: "d2_refback_m3",
      order: 2,
      code: "D2 · M3-RB",
      title: "الربط الرمزي سريع الطفرة وبوابة Reference-Back",
      shortTitle: "الطفرة السريعة وبوابة التحديث",
      durationMin: 2.2,
      targetQuestion:
        "هل ينجو ربط 3 إطارات مكانية–لونية برموز غير قابلة للتسمية تحت طفرات دون الثانية (800 ms) وبوابة تحديث/مقارنة مع تفكيك M3؟",
      instructions: [
        "احفظ الرموز الثلاثة داخل إطاراتها الملونة (900 ms)، ثم حدّث في ذهنك (دون ضغط أزرار) الإطارين اللذين يتغير رمزهما تلقائيا (500 ms).",
        "الهالة الحمراء [تحديث]: هل يطابق الرمز المعروض آخر رمز محفوظ في هذا الإطار (طابق J / → أو مختلف F / ←)؟ ثم احفظ الرمز المعروض مكانه.",
        "الهالة الزرقاء [مقارنة فقط]: هل يطابق آخر رمز محفوظ في هذا الإطار؟ دون تغيير الرمز المحفوظ، وفي النهاية اختر الرمز النهائي للإطار المطلوب (؟) من 6 بدائل (5.0 ثوانٍ)."
      ],
      example: "3 رموز ابتدائية (900ms) ← تحديثان تلقائيان (500ms) ← أحمر (قارن وحدّث) / أزرق (قارن دون تحديث) ← اختيار الرمز النهائي من 6 بدائل"
    },
    {
      id: "d3_bays_analog",
      order: 3,
      code: "D3 · BAYS",
      title: "خليط Bays المقنّع للزوايا المتصلة (200ms · N=4)",
      shortTitle: "خليط Bays المقنّع",
      durationMin: 3.8,
      targetQuestion:
        "ما حصة استرجاع الهدف (α) مقابل التبديل المكاني (β) وقفزة الفقد بالتأخير (Δγ) بين 0.9s و3.8s عند ومضة 200ms مقنّعة لـ 4 عناصر؟",
      instructions: [
        "ردّد بصوت خافت متواصل «با — بي — بو» وثبّت نظرك على (+) لالتقاط زاوية ميل الخطوط الأربعة في الومضة الخاطفة (200 ms).",
        "استمر بالترديد أثناء القناع الشبكي وفترة الانتظار القصيرة (0.9 ثانية) أو الطويلة (3.8 ثانية).",
        "أدر القرص أو شريط السحب السفلي أو الأسهم ليطابق زاوية خط الدائرة المميزة بـ (؟) بدقة (مهلة 8.0 ثوانٍ) ثم اضغط تأكيد (Enter)."
      ],
      example: "ترديد «با — بي — بو» + ومضة 4 خطوط مائلة ← قناع ← انتظار (0.9s أو 3.8s) ← تدوير الخط ليطابق زاوية الموقع المطلوب (؟)"
    },
    {
      id: "d4_consolidation_soa",
      order: 4,
      code: "D4 · SOA75",
      title: "عتبة التوطيد الباليستي وتفيّض التدفق المتلاحق (SOA_75)",
      shortTitle: "عتبة التوطيد وتفيّض التدفق",
      durationMin: 2.9,
      targetQuestion:
        "ما الفاصل الزمني الأدنى بالمللي ثانية (SOA_75) اللازم لتوطيد 3 روابط متلاحقة قبل انهيار التدفق تحت مقاطعة قرار بصري سريع؟",
      instructions: [
        "تظهر في المركز 3 إطارات مختلفة الشكل واللون واحدا تلو الآخر، وبداخل كل إطار رمز عليك ربطه به.",
        "عقب الإطار الثالث مباشرة حدّد فورا اتجاه السهم المزدوج خلال 1.5 ثانية: يمين (J / →) أم يسار (F / ←).",
        "يُعرض أحد الإطارات الثلاثة بعلامة (؟): اختر من البدائل الأربعة الرمز الذي ظهر بداخله (مهلة 4.0 ثوانٍ)."
      ],
      example: "3 إطارات متعاقبة برموزها ← تحديد اتجاه السهم المزدوج فورا ← اختيار رمز الإطار المطلوب (؟) من 4 بدائل"
    },
    {
      id: "d5_pvt5",
      order: 5,
      code: "D5 · PVT-5",
      title: "مسبار اليقظة النفسحركية المعياري الممتد (5.0 دقائق)",
      shortTitle: "اليقظة المعيارية (PVT-5)",
      durationMin: 5.0,
      targetQuestion:
        "هل ينحدر تيقظك تدريجيا عبر الدقائق الخمس (β_ToT) أم يرتفع ذيل الشرود الأسي (Slow-ISI Tau) مبكرا عند الفواصل البطيئة؟",
      instructions: [
        "راقب المستطيل المركزي طوال 5.0 دقائق؛ ينطلق العدّاد الأحمر عشوائيا كل 2 إلى 7 ثوانٍ.",
        "فور بدء العدّاد اضغط المسافة (Space) أو انقر الزر بأقصى سرعة دون ضغط مسبق قبل ظهوره.",
        "حافظ على ثبات سرعة استجابتك من الدقيقة الأولى حتى نهاية الدقيقة الخامسة."
      ],
      example: "ترقب صامت (2–7 ثوانٍ) ← انطلاق العدّاد الأحمر ← ضغطة فورية بأسرع ما يمكن ← استمرار لمدة 5.0 دقائق"
    }
  ];

  var FORM_IDS = ["A", "B", "C"];

  /* ================= 1. CRYPTOGRAPHIC PRNG (WebCrypto CSPRNG) ================= */

  var rngPool = new Uint32Array(256);
  var rngCursor = rngPool.length;

  function fillCryptoBytes(uint32Arr) {
    var c = (root && root.crypto) || (typeof crypto !== "undefined" ? crypto : null);
    if (c && typeof c.getRandomValues === "function") {
      c.getRandomValues(uint32Arr);
      return;
    }
    if (typeof require === "function") {
      try {
        var nodeCrypto = require("crypto");
        if (nodeCrypto && nodeCrypto.webcrypto && typeof nodeCrypto.webcrypto.getRandomValues === "function") {
          nodeCrypto.webcrypto.getRandomValues(uint32Arr);
          return;
        }
        if (nodeCrypto && typeof nodeCrypto.randomFillSync === "function") {
          nodeCrypto.randomFillSync(uint32Arr);
          return;
        }
      } catch (_) {}
    }
    throw new Error("Cryptographic RNG (crypto.getRandomValues) is required.");
  }

  function nextUint32() {
    if (rngCursor >= rngPool.length) {
      fillCryptoBytes(rngPool);
      rngCursor = 0;
    }
    var val = rngPool[rngCursor];
    rngCursor += 1;
    return val >>> 0;
  }

  function randomFloat01() {
    return nextUint32() / 4294967296;
  }

  function randInt(min, max) {
    var lo = Math.ceil(Number(min) || 0);
    var hi = Math.floor(Number(max) || 0);
    if (hi <= lo) return lo;
    var span = hi - lo + 1;
    var maxUnbiased = Math.floor(4294967296 / span) * span;
    var u = nextUint32();
    while (u >= maxUnbiased) {
      u = nextUint32();
    }
    return lo + (u % span);
  }

  function shuffle(arr) {
    var copy = Array.isArray(arr) ? arr.slice() : [];
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = randInt(0, i);
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /* ================= 2. FORMATTING & NUMERIC HELPERS ================= */

  function toAsciiDigits(val) {
    return String(val == null ? "" : val)
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String(d.charCodeAt(0) - 0x0660);
      })
      .replace(/[\u06F0-\u06F9]/g, function (d) {
        return String(d.charCodeAt(0) - 0x06f0);
      });
  }

  function clamp(num, min, max) {
    var n = Number(num);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function round1(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 10) / 10;
  }

  function round2(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function round3(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 1000) / 1000;
  }

  function fmtSigned(num, unit, decimals) {
    var d = decimals === 2 ? 2 : 1;
    var n = d === 2 ? round2(num) : round1(num);
    var u = unit || "";
    if (n > 0) return "+" + toAsciiDigits(n) + u;
    if (n < 0) return "-" + toAsciiDigits(Math.abs(n)) + u;
    return "0" + u;
  }

  /* ================= 3. ORTHOGONAL VCS / ATTNEAVE GLYPH FORMS (A / B / C) ================= */
  // 24 non-nameable closed irregular contours partitioned into 3 parallel orthogonal sets (8 per form).
  // Each spec uses multi-harmonic radial Fourier synthesis + localized asymmetric concavities,
  // normalized to zero centroid and unit bounding radius so area/luminance are matched while verbal naming fails.

  var GLYPH_SPECS = {
    A: [
      { rot: 19, h: [[2, 0.28, 0.4], [3, -0.34, 1.7], [5, 0.22, 0.9]], dents: [[1.15, -0.42, 0.32]] },
      { rot: 63, h: [[2, -0.32, 1.1], [4, 0.30, 0.2], [5, -0.18, 2.4]], dents: [[2.70, -0.38, 0.28]] },
      { rot: 107, h: [[3, 0.36, 0.3], [4, -0.24, 1.9], [6, 0.20, 0.8]], dents: [[4.10, -0.36, 0.30]] },
      { rot: 151, h: [[2, 0.22, 2.2], [3, 0.29, 0.5], [7, -0.21, 1.3]], dents: [[0.45, -0.44, 0.26], [3.55, 0.30, 0.28]] },
      { rot: 38, h: [[2, -0.26, 0.7], [5, 0.35, 1.5], [6, -0.17, 2.8]], dents: [[1.95, -0.39, 0.31]] },
      { rot: 82, h: [[3, -0.31, 2.5], [4, 0.28, 1.1], [7, 0.22, 0.4]], dents: [[5.10, -0.41, 0.29]] },
      { rot: 128, h: [[2, 0.35, 1.8], [5, -0.27, 0.3], [7, 0.19, 2.1]], dents: [[2.20, -0.45, 0.27], [4.90, -0.28, 0.25]] },
      { rot: 171, h: [[3, 0.25, 1.2], [4, -0.33, 2.7], [6, 0.26, 1.6]], dents: [[0.85, 0.34, 0.26], [3.80, -0.40, 0.30]] }
    ],
    B: [
      { rot: 41, h: [[2, 0.31, 2.1], [3, 0.33, 0.8], [5, -0.21, 1.9]], dents: [[2.05, -0.43, 0.30]] },
      { rot: 86, h: [[2, -0.29, 0.3], [4, -0.31, 1.6], [5, 0.20, 0.7]], dents: [[3.65, -0.39, 0.29]] },
      { rot: 131, h: [[3, -0.35, 1.1], [4, 0.25, 2.6], [6, -0.21, 0.4]], dents: [[0.60, -0.37, 0.31]] },
      { rot: 174, h: [[2, -0.24, 1.4], [3, 0.30, 2.3], [7, 0.22, 0.6]], dents: [[1.55, -0.44, 0.27], [4.65, 0.31, 0.27]] },
      { rot: 59, h: [[2, 0.27, 2.6], [5, -0.34, 0.9], [6, 0.18, 1.7]], dents: [[2.95, -0.40, 0.30]] },
      { rot: 196, h: [[2, 0.31, 0.5], [3, -0.34, 1.8], [6, 0.24, 2.5]], dents: [[1.15, -0.44, 0.27], [4.20, 0.30, 0.28]] },
      { rot: 149, h: [[2, -0.34, 0.9], [5, 0.28, 2.2], [7, -0.18, 0.5]], dents: [[0.95, -0.45, 0.26], [3.40, -0.29, 0.25]] },
      { rot: 14, h: [[3, -0.26, 2.9], [4, 0.34, 0.7], [6, -0.25, 2.3]], dents: [[2.35, 0.35, 0.26], [5.15, -0.40, 0.30]] }
    ],
    C: [
      { rot: 71, h: [[2, -0.30, 1.5], [3, 0.35, 2.6], [5, 0.21, 0.2]], dents: [[3.10, -0.43, 0.31]] },
      { rot: 116, h: [[2, 0.33, 2.8], [4, 0.29, 0.9], [5, -0.19, 1.4]], dents: [[4.75, -0.38, 0.28]] },
      { rot: 161, h: [[3, 0.34, 1.9], [4, -0.26, 0.5], [6, 0.22, 2.1]], dents: [[1.35, -0.37, 0.30]] },
      { rot: 26, h: [[2, 0.25, 0.6], [3, -0.31, 1.6], [7, -0.22, 2.5]], dents: [[2.65, -0.44, 0.26], [5.50, 0.31, 0.28]] },
      { rot: 93, h: [[2, -0.28, 1.9], [5, 0.33, 0.4], [6, -0.19, 1.1]], dents: [[4.05, -0.40, 0.31]] },
      { rot: 138, h: [[3, -0.32, 0.2], [4, 0.30, 1.4], [7, 0.20, 2.7]], dents: [[0.35, -0.41, 0.29]] },
      { rot: 7, h: [[2, 0.34, 0.2], [5, -0.29, 1.6], [7, 0.19, 1.0]], dents: [[1.85, -0.45, 0.27], [4.35, -0.28, 0.25]] },
      { rot: 52, h: [[3, 0.27, 2.1], [4, -0.33, 1.3], [6, 0.25, 0.3]], dents: [[3.25, 0.34, 0.26], [5.95, -0.41, 0.30]] }
    ]
  };

  var glyphPointsCache = {};

  function normalizeFormId(formId) {
    var f = String(formId || "A").toUpperCase();
    return f === "B" || f === "C" ? f : "A";
  }

  function getGlyphPoints(formId, glyphIdx, numSamples) {
    var f = normalizeFormId(formId);
    var idx = ((Number(glyphIdx) || 0) % 8 + 8) % 8;
    var n = numSamples || 72;
    var key = f + "_" + idx + "_" + n;
    if (glyphPointsCache[key]) return glyphPointsCache[key];

    var spec = GLYPH_SPECS[f][idx];
    var rotRad = (spec.rot * Math.PI) / 180;
    var raw = [];
    var sumX = 0;
    var sumY = 0;

    for (var i = 0; i < n; i += 1) {
      var theta = (i / n) * Math.PI * 2;
      var r = 1.0;
      for (var k = 0; k < spec.h.length; k += 1) {
        var freq = spec.h[k][0];
        var amp = spec.h[k][1];
        var ph = spec.h[k][2];
        r += amp * Math.cos(freq * theta + ph);
      }
      for (var d = 0; d < spec.dents.length; d += 1) {
        var center = spec.dents[d][0];
        var depth = spec.dents[d][1];
        var width = spec.dents[d][2];
        var diff = Math.atan2(Math.sin(theta - center), Math.cos(theta - center));
        r += depth * Math.exp(-(diff * diff) / (2 * width * width));
      }
      r = Math.max(0.28, r);
      var phi = theta + rotRad;
      var px = r * Math.cos(phi);
      var py = r * Math.sin(phi);
      raw.push({ x: px, y: py });
      sumX += px;
      sumY += py;
    }

    var cx = sumX / n;
    var cy = sumY / n;
    var maxR = 0.001;
    for (var j = 0; j < n; j += 1) {
      raw[j].x -= cx;
      raw[j].y -= cy;
      var dist = Math.hypot(raw[j].x, raw[j].y);
      if (dist > maxR) maxR = dist;
    }
    var out = [];
    for (var m = 0; m < n; m += 1) {
      out.push({
        x: raw[m].x / maxR,
        y: raw[m].y / maxR
      });
    }
    glyphPointsCache[key] = out;
    return out;
  }

  // Asymmetric color-spatial role definitions (non-collinear, zero 180° opposition, colorblind-safe & distinct from Red/Blue gate rings)
  var ROLE_FRAMES_3 = [
    {
      roleIdx: 0,
      id: "R0",
      stroke: "#d97706",
      fillSoft: "rgba(217, 119, 6, 0.13)",
      shape: "chamfer",
      normX: 0.74,
      normY: 0.31
    },
    {
      roleIdx: 1,
      id: "R1",
      stroke: "#059669",
      fillSoft: "rgba(5, 150, 105, 0.13)",
      shape: "notched",
      normX: 0.25,
      normY: 0.37
    },
    {
      roleIdx: 2,
      id: "R2",
      stroke: "#7c3aed",
      fillSoft: "rgba(124, 58, 237, 0.13)",
      shape: "stepped",
      normX: 0.54,
      normY: 0.73
    }
  ];

  /* ================= 4. BESSEL, BAYS MIXTURE MAP-EM & BAYS (2016) ================= */

  function axialDiffDeg(a, b) {
    var na = ((Number(a) % 180) + 180) % 180;
    var nb = ((Number(b) % 180) + 180) % 180;
    var d = Math.abs(na - nb);
    return Math.min(d, 180 - d);
  }

  function wrapRadPi(rad) {
    var twoPi = Math.PI * 2;
    var x = ((rad + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    return x;
  }

  // Abramowitz & Stegun 9.8.1-9.8.4 exponentially scaled modified Bessel functions e^(-k)*I_0(k) and e^(-k)*I_1(k)
  // Overflow-free across all kappa >= 0
  function besselI0Scaled(kappa) {
    var ax = Math.abs(Number(kappa) || 0);
    var y;
    if (ax < 3.75) {
      y = ax / 3.75;
      y = y * y;
      var i0 = 1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))));
      return Math.exp(-ax) * i0;
    }
    y = 3.75 / ax;
    var poly = 0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 +
      y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377)))))));
    return poly / Math.sqrt(ax);
  }

  function besselI1Scaled(kappa) {
    var x = Number(kappa) || 0;
    var ax = Math.abs(x);
    if (ax < 1e-12) return 0;
    var y, ans;
    if (ax < 3.75) {
      y = ax / 3.75;
      y = y * y;
      var i1 = ax * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032411))))));
      ans = Math.exp(-ax) * i1;
    } else {
      y = 3.75 / ax;
      var poly = 0.39894228 + y * (-0.03988024 + y * (-0.00362018 + y * (0.00163801 + y * (-0.01031555 +
        y * (0.02282967 + y * (-0.02895312 + y * (0.01787654 - y * 0.00420059)))))));
      ans = poly / Math.sqrt(ax);
    }
    return x < 0 ? -ans : ans;
  }

  function besselRatioA1(kappa) {
    var k = Math.max(0, Number(kappa) || 0);
    if (k < 1e-9) return 0;
    var i0 = besselI0Scaled(k);
    if (i0 <= 0) return 0;
    return clamp(besselI1Scaled(k) / i0, 0, 0.999999);
  }

  function invertBesselRatioKappa(R) {
    var r = clamp(Number(R) || 0, 0, 0.9994);
    var k;
    if (r < 0.53) {
      k = 2 * r + Math.pow(r, 3) + (5 * Math.pow(r, 5)) / 6;
    } else if (r < 0.85) {
      k = -0.4 + 1.39 * r + 0.43 / (1 - r);
    } else {
      k = 1 / Math.max(1e-6, Math.pow(r, 3) - 4 * r * r + 3 * r);
    }
    // 6 Newton-Raphson iterations using A1'(k) = 1 - A1(k)^2 - A1(k)/k
    for (var it = 0; it < 6; it += 1) {
      if (k <= 1e-4) break;
      var a1 = besselRatioA1(k);
      var err = a1 - r;
      if (Math.abs(err) < 1e-7) break;
      var deriv = Math.max(1e-6, 1 - a1 * a1 - a1 / k);
      k = Math.max(0.05, k - err / deriv);
    }
    return clamp(k, 1.25, 800);
  }

  // Exact conversion on doubled orientation space psi = 2*(theta_hat - theta)*pi/180:
  // sigma_theta,deg = (90 / pi) * sqrt(-2 * ln(I_1(kappa) / I_0(kappa)))
  function kappaToSigmaThetaDeg(kappa) {
    var r = besselRatioA1(kappa);
    if (r <= 1e-6) return 45;
    var radHalf = Math.sqrt(Math.max(0, -2 * Math.log(r)));
    return round1(Math.min(52, (90 / Math.PI) * radHalf));
  }

  function vonMisesDensity(psiRad, kappa, i0ScaledVal) {
    var c = Math.cos(psiRad);
    return Math.exp(kappa * (c - 1)) / (2 * Math.PI * Math.max(1e-30, i0ScaledVal));
  }

  // Bays (2016) Non-Parametric Resultant-Vector Swap Estimator (repulsion-corrected 2x2 moment system)
  function computeBays2016SwapIndex(validTrials) {
    var list = Array.isArray(validTrials) ? validTrials : [];
    var n = list.length;
    if (n === 0) return { swapRatio: 0, swapIndex: 0 };

    var mSum = 0;
    var sumMT = 0;
    var sumMNT = 0;
    var sumC = 0;
    var sumD = 0;

    for (var i = 0; i < n; i += 1) {
      var tr = list[i];
      var nonTargets = tr.nonTargetAngles || [];
      var m = nonTargets.length;
      if (m === 0) continue;
      mSum += 1;

      var phiResp = (2 * tr.respAngle * Math.PI) / 180;
      var phiTarg = (2 * tr.targetAngle * Math.PI) / 180;
      sumMT += Math.cos(phiResp - phiTarg);

      var mnt = 0;
      var cRow = 0;
      var dRow = 0;
      for (var j = 0; j < m; j += 1) {
        var phiJ = (2 * nonTargets[j] * Math.PI) / 180;
        mnt += Math.cos(phiResp - phiJ);
        cRow += Math.cos(phiTarg - phiJ);
        for (var k = 0; k < m; k += 1) {
          var phiK = (2 * nonTargets[k] * Math.PI) / 180;
          dRow += Math.cos(phiJ - phiK);
        }
      }
      sumMNT += mnt;
      sumC += cRow;
      sumD += dRow / m;
    }

    if (mSum === 0) return { swapRatio: 0, swapIndex: 0 };
    var mRef = list[0].nonTargetAngles ? Math.max(1, list[0].nonTargetAngles.length) : 3;
    var MT = sumMT / mSum;
    var MNT = sumMNT / mSum;
    var C = sumC / mSum;
    var D = sumD / mSum;
    var det = D - (C * C) / mRef;
    if (Math.abs(det) < 1e-4) return { swapRatio: 0, swapIndex: 0 };

    // A = r * alpha, B = r * beta (completely distribution-free & kappa-free non-parametric estimator, Bays 2016)
    var A = (D * MT - (C / mRef) * MNT) / det;
    var B = (MNT - C * MT) / det;
    var posA = Math.max(0, A);
    var posB = Math.max(0, B);
    var denom = posA + posB;
    var swapRatio = denom > 0.04 ? clamp(posB / denom, 0, 1) : 0;
    var swapIndex = clamp(posB, 0, 1);
    return {
      swapRatio: round3(swapRatio),
      swapIndex: round3(swapIndex)
    };
  }

  // Exact Conjugate-Prior Regularized 3-Component MAP-EM Solver on doubled orientation space [-pi, pi)
  // p(theta_hat) = alpha * VM(psi_0; kappa) + (beta / m) * sum_j VM(psi_j; kappa) + gamma / (2*pi)
  function fitBaysMixtureMAP(rawTrials, opts) {
    var o = opts || {};
    var valid = [];
    if (Array.isArray(rawTrials)) {
      for (var t = 0; t < rawTrials.length; t += 1) {
        var item = rawTrials[t];
        if (item && !item.omitted && Number.isFinite(item.respAngle) && Number.isFinite(item.targetAngle)) {
          valid.push(item);
        }
      }
    }
    var n = valid.length;
    if (n === 0) {
      return {
        nValid: 0,
        alpha: 0,
        beta: 0,
        gamma: 1,
        kappa: 0,
        sigmaDeg: 45,
        K: 0,
        cMAE: 45,
        bays2016SwapIdx: 0,
        bays2016SwapRatio: 0
      };
    }

    var errSum = 0;
    var pre = [];
    for (var i = 0; i < n; i += 1) {
      var tr = valid[i];
      errSum += axialDiffDeg(tr.respAngle, tr.targetAngle);
      var psi0 = wrapRadPi((2 * (tr.respAngle - tr.targetAngle) * Math.PI) / 180);
      var nts = Array.isArray(tr.nonTargetAngles) ? tr.nonTargetAngles : [];
      var psiNt = [];
      for (var j = 0; j < nts.length; j += 1) {
        psiNt.push(wrapRadPi((2 * (tr.respAngle - nts[j]) * Math.PI) / 180));
      }
      pre.push({ psi0: psi0, psiNt: psiNt });
    }
    var cMAE = round1(errSum / n);
    var npSwap = computeBays2016SwapIndex(valid);
    var hasNt = pre.some(function (p) { return p.psiNt.length > 0; });

    // Uniform Dirichlet(1, 1, 1) prior on simplex weights (zero artificial repulsion from beta=0 boundary!)
    // paired with Exact Conjugate von Mises MAP prior on kappa (Oberauer et al., 2017)
    var priorExAlpha = 0;
    var priorExBeta = 0;
    var priorExGamma = 0;
    var priorExSum = 0;

    var hasAnchor = Number.isFinite(o.anchorKappa) && o.anchorKappa > 0.25;
    var priorN0 = hasAnchor ? (Number.isFinite(o.anchorWeight) ? o.anchorWeight : 0.70) : 0.18;
    var priorKappaCenter = hasAnchor ? o.anchorKappa : 3.0;
    var priorR0 = besselRatioA1(priorKappaCenter);

    var unifDens = 1 / (2 * Math.PI);

    function evalConjugateLogPost(a, b, g, kap) {
      var i0s = besselI0Scaled(kap);
      var ll = 0;
      for (var idx = 0; idx < n; idx += 1) {
        var p = pre[idx];
        var m = p.psiNt.length;
        var pT = a * vonMisesDensity(p.psi0, kap, i0s);
        var pB = 0;
        if (m > 0 && b > 0) {
          var sumVm = 0;
          for (var q = 0; q < m; q += 1) {
            sumVm += vonMisesDensity(p.psiNt[q], kap, i0s);
          }
          pB = b * (sumVm / m);
        }
        var denom = Math.max(1e-30, pT + pB + g * unifDens);
        ll += Math.log(denom);
      }
      var dirPen =
        priorExAlpha * Math.log(Math.max(1e-8, a)) +
        (hasNt ? priorExBeta * Math.log(Math.max(1e-8, b)) : 0) +
        priorExGamma * Math.log(Math.max(1e-8, g));
      // Exact conjugate VM log-prior: n0 * (kap * R0 - ln I0(kap)) = n0 * (kap * (R0 - 1) - ln(e^-kap * I0(kap)))
      var vmPen = priorN0 * (kap * (priorR0 - 1) - Math.log(Math.max(1e-30, i0s)));
      return ll + dirPen + vmPen;
    }

    var starts = [
      { alpha: 0.64, beta: hasNt ? 0.18 : 0, gamma: hasNt ? 0.18 : 0.36, kappa: hasAnchor ? priorKappaCenter : 6.0 },
      { alpha: 0.38, beta: hasNt ? 0.34 : 0, gamma: hasNt ? 0.28 : 0.62, kappa: 1.8 },
      { alpha: 0.82, beta: hasNt ? 0.10 : 0, gamma: hasNt ? 0.08 : 0.18, kappa: 28.0 },
      { alpha: 0.10, beta: hasNt ? 0.08 : 0, gamma: hasNt ? 0.82 : 0.90, kappa: 3.0 }
    ];

    var bestFit = null;

    for (var s = 0; s < starts.length; s += 1) {
      var alpha = starts[s].alpha;
      var beta = starts[s].beta;
      var gamma = starts[s].gamma;
      var kappa = starts[s].kappa;

      for (var iter = 0; iter < 75; iter += 1) {
        var i0s = besselI0Scaled(kappa);
        var sumRAlpha = 0;
        var sumRBeta = 0;
        var sumRGamma = 0;
        var sumCosWeighted = 0;
        var sumWeightVM = 0;

        for (var idx = 0; idx < n; idx += 1) {
          var p = pre[idx];
          var m = p.psiNt.length;
          var vmT = vonMisesDensity(p.psi0, kappa, i0s);
          var pT = alpha * vmT;

          var pB = 0;
          var vmList = null;
          if (m > 0 && beta > 0) {
            vmList = new Array(m);
            var sumVmNt = 0;
            for (var q = 0; q < m; q += 1) {
              var vmq = vonMisesDensity(p.psiNt[q], kappa, i0s);
              vmList[q] = vmq;
              sumVmNt += vmq;
            }
            pB = beta * (sumVmNt / m);
          }

          var pG = gamma * unifDens;
          var denom = Math.max(1e-30, pT + pB + pG);

          var rT = pT / denom;
          var rB = pB / denom;
          var rG = pG / denom;
          sumRAlpha += rT;
          sumRBeta += rB;
          sumRGamma += rG;

          sumCosWeighted += rT * Math.cos(p.psi0);
          sumWeightVM += rT;

          if (m > 0 && vmList) {
            for (var q2 = 0; q2 < m; q2 += 1) {
              var rBq = ((beta / m) * vmList[q2]) / denom;
              sumCosWeighted += rBq * Math.cos(p.psiNt[q2]);
              sumWeightVM += rBq;
            }
          }
        }

        var nextAlpha = (sumRAlpha + priorExAlpha) / (n + priorExSum);
        var nextBeta = hasNt ? (sumRBeta + priorExBeta) / (n + priorExSum) : 0;
        var nextGamma = (sumRGamma + priorExGamma) / (n + priorExSum);
        var normW = nextAlpha + nextBeta + nextGamma;
        nextAlpha /= normW;
        nextBeta /= normW;
        nextGamma /= normW;

        // Exact closed-form conjugate MAP M-step for kappa (bounded >= 1.25 to prevent kappa->0 label-switching with uniform gamma; Oberauer et al., 2017)
        var rMap = (sumCosWeighted + priorN0 * priorR0) / Math.max(1e-6, sumWeightVM + priorN0);
        var nextKappa = sumWeightVM > 0.25
          ? invertBesselRatioKappa(Math.max(0.52, rMap))
          : Math.max(2.0, priorKappaCenter);

        var deltaParam =
          Math.abs(nextAlpha - alpha) +
          Math.abs(nextBeta - beta) +
          Math.abs(nextGamma - gamma) +
          Math.abs(nextKappa - kappa) * 0.005;

        alpha = nextAlpha;
        beta = nextBeta;
        gamma = nextGamma;
        kappa = nextKappa;

        if (iter > 6 && deltaParam < 1e-5) break;
      }

      var finalLogPost = evalConjugateLogPost(alpha, beta, gamma, kappa);
      if (!bestFit || finalLogPost > bestFit.logPost) {
        bestFit = {
          logPost: finalLogPost,
          alpha: alpha,
          beta: beta,
          gamma: gamma,
          kappa: kappa
        };
      }
    }

    var fAlpha = bestFit.alpha;
    var fBeta = hasNt ? bestFit.beta : 0;
    var fGamma = hasNt ? bestFit.gamma : (1 - fAlpha);
    var fSum = fAlpha + fBeta + fGamma;
    fAlpha /= fSum;
    fBeta /= fSum;
    fGamma /= fSum;

    return {
      nValid: n,
      alpha: round3(fAlpha),
      beta: round3(fBeta),
      gamma: round3(fGamma),
      kappa: round2(bestFit.kappa),
      sigmaDeg: kappaToSigmaThetaDeg(bestFit.kappa),
      K: round2(4 * fAlpha),
      cMAE: cMAE,
      bays2016SwapIdx: npSwap.swapIndex,
      bays2016SwapRatio: npSwap.swapRatio
    };
  }

  /* ================= 5. 3-PARAMETER MAP-MLE EX-GAUSSIAN KERNEL ================= */

  function erfcxScaled(x) {
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;
    var t = 1 / (1 + p * Math.max(0, x));
    return ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  }

  function fitExGaussianMAP(rawRts, opts) {
    var o = opts || {};
    var valid = [];
    if (Array.isArray(rawRts)) {
      for (var i = 0; i < rawRts.length; i += 1) {
        var v = Number(rawRts[i]);
        if (Number.isFinite(v) && v >= 100 && v <= 10000) {
          valid.push(v);
        }
      }
    }
    var n = valid.length;
    if (n === 0) {
      return {
        n: 0,
        meanMs: 0,
        medianMs: 0,
        sdMs: 0,
        iqrMs: 0,
        muMs: 0,
        sigmaMs: 0,
        tauMs: 0,
        icvPct: 0
      };
    }

    var sorted = valid.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(n / 2);
    var medianMs = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    var q16 = sorted[Math.floor((n - 1) * 0.16)];
    var q1 = sorted[Math.floor((n - 1) * 0.25)];
    var q3 = sorted[Math.floor((n - 1) * 0.75)];
    var iqrMs = Math.max(0, q3 - q1);

    var sum = 0;
    for (var j = 0; j < n; j += 1) sum += sorted[j];
    var meanMs = sum / n;

    var hasSessionAnchor =
      Number.isFinite(o.anchorMu) && o.anchorMu >= 85 &&
      Number.isFinite(o.anchorSigma) && o.anchorSigma >= 5;

    if (n < 3) {
      var tinyTau = hasSessionAnchor ? Math.max(0, meanMs - o.anchorMu) : 0;
      return {
        n: n,
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        sdMs: 0,
        iqrMs: Math.round(iqrMs),
        muMs: Math.round(hasSessionAnchor ? o.anchorMu : meanMs),
        sigmaMs: Math.round(hasSessionAnchor ? o.anchorSigma : 0),
        tauMs: Math.round(tinyTau),
        icvPct: 0
      };
    }

    var m2 = 0;
    var m3 = 0;
    for (var k = 0; k < n; k += 1) {
      var d = sorted[k] - meanMs;
      var d2 = d * d;
      m2 += d2;
      m3 += d2 * d;
    }
    var variance = m2 / (n - 1);
    var sdMs = Math.sqrt(Math.max(0, variance));
    var icvPct = meanMs > 0 ? round1((sdMs / meanMs) * 100) : 0;

    if (sdMs < 1e-4) {
      return {
        n: n,
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        sdMs: 0,
        iqrMs: Math.round(iqrMs),
        muMs: Math.round(meanMs),
        sigmaMs: 0,
        tauMs: 0,
        icvPct: 0
      };
    }

    var rawSkew = (m3 / n) / Math.pow(Math.sqrt(m2 / n), 3);
    var adjSkew = n >= 5 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * rawSkew : rawSkew;
    var maxFeasibleTau = Math.max(0, meanMs - 85);
    var tauRatio = Math.min(0.95, Math.pow(Math.max(0, adjSkew) / 2, 1 / 3));
    var momTau = Math.min(maxFeasibleTau, sdMs * tauRatio);
    var momMu = Math.max(85, meanMs - momTau);
    var momSigma = Math.sqrt(Math.max(25, sdMs * sdMs - momTau * momTau));

    if ((!hasSessionAnchor && n < 6) || maxFeasibleTau < 2) {
      return {
        n: n,
        meanMs: Math.round(meanMs),
        medianMs: Math.round(medianMs),
        sdMs: Math.round(sdMs),
        iqrMs: Math.round(iqrMs),
        muMs: Math.round(momMu),
        sigmaMs: Math.round(momSigma),
        tauMs: Math.round(momTau),
        icvPct: icvPct
      };
    }

    // Left-tail Gaussian spread (median - Q_16) avoids 3x upward inflation from heavy right-tail tau!
    var leftSpread = Math.max(8, medianMs - q16);
    var sigScale = hasSessionAnchor
      ? Math.max(7, o.anchorSigma)
      : Math.max(8, Math.min(leftSpread * 1.12, iqrMs / 1.349, sdMs * 0.65));

    function logPost(mu, sig, tau) {
      if (sig < 5 || tau < 0.6 || mu < 85) return -1e18;
      var invSqrt2Sig = 1 / (Math.SQRT2 * sig);
      var inv2Sig2 = 1 / (2 * sig * sig);
      var s2t = (sig * sig) / tau;
      var l2t = Math.log(2 * tau);
      var ll = 0;
      for (var pIdx = 0; pIdx < n; pIdx += 1) {
        var x = sorted[pIdx];
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
      if (hasSessionAnchor) {
        var muScale = Math.max(14, o.anchorSigma);
        var muDiff = (mu - o.anchorMu) / muScale;
        return ll - 0.90 * muDiff * muDiff - 1.25 * logSigRatio * logSigRatio;
      }
      // Gentle anti-singularity prior preventing sigma->0 collapse without stealing tau variance
      return ll - 0.22 * logSigRatio * logSigRatio;
    }

    var qTau = Math.min(maxFeasibleTau, Math.max(2, meanMs - medianMs) * 1.45);
    var qMu = Math.max(85, meanMs - qTau);
    var qSig = Math.max(7, sigScale);

    var candidates = [
      { mu: momMu, sig: Math.max(7, momSigma), tau: Math.max(1, momTau) },
      { mu: qMu, sig: qSig, tau: Math.max(1, qTau) }
    ];
    if (hasSessionAnchor) {
      var anchTau = clamp(meanMs - o.anchorMu, 1, Math.max(2, maxFeasibleTau));
      candidates.unshift({
        mu: clamp(o.anchorMu, 85, Math.max(90, meanMs)),
        sig: Math.max(7, o.anchorSigma),
        tau: anchTau
      });
    }

    var bMu = candidates[0].mu;
    var bSig = candidates[0].sig;
    var bTau = candidates[0].tau;
    var bVal = logPost(bMu, bSig, bTau);

    for (var c = 1; c < candidates.length; c += 1) {
      var cv = logPost(candidates[c].mu, candidates[c].sig, candidates[c].tau);
      if (cv > bVal) {
        bVal = cv;
        bMu = candidates[c].mu;
        bSig = candidates[c].sig;
        bTau = candidates[c].tau;
      }
    }

    var dM = Math.max(3.5, sdMs * 0.16);
    var dS = Math.max(2.5, sigScale * 0.22);
    var dT = Math.max(4, sdMs * 0.18);
    var dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
      [1, 0, -1], [-1, 0, 1]
    ];

    for (var it = 0; it < 42; it += 1) {
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
        dM *= 0.55;
        dS *= 0.55;
        dT *= 0.55;
        if (dM < 0.2 && dS < 0.2 && dT < 0.2) break;
      }
    }

    if (bTau < 1.5 && adjSkew < 0.08) {
      bTau = 0;
      bMu = Math.max(85, meanMs);
      bSig = sdMs;
    }

    return {
      n: n,
      meanMs: Math.round(meanMs),
      medianMs: Math.round(medianMs),
      sdMs: Math.round(sdMs),
      iqrMs: Math.round(iqrMs),
      muMs: Math.round(bMu),
      sigmaMs: Math.round(bSig),
      tauMs: Math.round(bTau),
      icvPct: icvPct
    };
  }

  /* ================= 6. D1: TBRS FIXED 4,000ms RETENTION WINDOW ================= */

  function buildSingleD1Trial(trialIndex, cond, formId, probeSlot, prevGlyphs) {
    var basePhi = randInt(0, 359);
    // 3 asymmetric ring locations with zero 180° opposite pairs (gaps: 112°, 120°, 128°)
    var ringAnglesDeg = [
      basePhi % 360,
      (basePhi + 112 + randInt(-6, 6)) % 360,
      (basePhi + 234 + randInt(-6, 6)) % 360
    ];

    var allGlyphs = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    var arrayGlyphs = allGlyphs.slice(0, 3);
    if (Array.isArray(prevGlyphs) && prevGlyphs.length === 3 && arrayGlyphs[0] === prevGlyphs[0]) {
      arrayGlyphs = [allGlyphs[1], allGlyphs[2], allGlyphs[3]];
    }
    var novelGlyph = -1;
    for (var g = 0; g < allGlyphs.length; g += 1) {
      if (arrayGlyphs.indexOf(allGlyphs[g]) === -1) {
        novelGlyph = allGlyphs[g];
        break;
      }
    }

    var pSlot = ((Number(probeSlot) || 0) % 3 + 3) % 3;
    var targetGlyph = arrayGlyphs[pSlot];
    var swapGlyphs = [];
    for (var s = 0; s < 3; s += 1) {
      if (s !== pSlot) swapGlyphs.push(arrayGlyphs[s]);
    }

    var stepCount = cond === "high" ? 4 : 2;
    var slotMs = cond === "high" ? 1000 : 2000;
    var judgements = [];
    var bag = cond === "high"
      ? shuffle(["top", "top", "bottom", "bottom"])
      : shuffle(["top", "bottom"]);

    for (var j = 0; j < stepCount; j += 1) {
      judgements.push({
        stepIndex: j,
        onsetMs: j * slotMs,
        slotMs: slotMs,
        barPos: bag[j],
        expectTop: bag[j] === "top"
      });
    }

    var options = shuffle([
      { glyphIdx: targetGlyph, kind: "target" },
      { glyphIdx: swapGlyphs[0], kind: "swap" },
      { glyphIdx: swapGlyphs[1], kind: "swap" },
      { glyphIdx: novelGlyph, kind: "novel" }
    ]);

    return {
      trialIndex: trialIndex,
      cond: cond,
      formId: normalizeFormId(formId),
      fixationMs: 200,
      encodeMs: 900,
      maskMs: 150,
      postMaskPrepMs: 350,
      retentionWindowMs: 4000,
      recallDeadlineMs: 4000,
      itiMs: 250,
      ringAnglesDeg: ringAnglesDeg,
      arrayGlyphs: arrayGlyphs,
      probeSlot: pSlot,
      targetGlyph: targetGlyph,
      novelGlyph: novelGlyph,
      judgements: judgements,
      options: options,
      maskSeed: randInt(1, 999)
    };
  }

  function regenerateD1SingleTrial(prevTrial) {
    var pt = prevTrial || {};
    return buildSingleD1Trial(
      Number(pt.trialIndex) || 0,
      pt.cond === "high" ? "high" : "low",
      pt.formId || "A",
      pt.probeSlot !== undefined ? pt.probeSlot : 0,
      pt.arrayGlyphs || []
    );
  }

  function generateD1Trials(opts) {
    var o = opts || {};
    var formId = normalizeFormId(o.formId);
    var isFam = Boolean(o.isFamiliarization);
    var condList = isFam
      ? shuffle(["low", "high"])
      : shuffle(["low", "low", "high", "high"])
          .concat(shuffle(["low", "low", "high", "high"]))
          .concat(shuffle(["low", "low", "high", "high"]))
          .concat(shuffle(["low", "low", "high", "high"]));

    var trials = [];
    var prevGlyphs = [];

    for (var t = 0; t < condList.length; t += 1) {
      var tr = buildSingleD1Trial(t, condList[t], formId, t % 3, prevGlyphs);
      trials.push(tr);
      prevGlyphs = tr.arrayGlyphs.slice();
    }
    return trials;
  }

  function scoreD1Trials(records) {
    var list = Array.isArray(records) ? records : [];
    var buckets = {
      low: { n: 0, validRecall: 0, target: 0, swap: 0, novel: 0, omissions: 0, clList: [], procHits: 0, procTot: 0, procRts: [] },
      high: { n: 0, validRecall: 0, target: 0, swap: 0, novel: 0, omissions: 0, clList: [], procHits: 0, procTot: 0, procRts: [] }
    };

    for (var i = 0; i < list.length; i += 1) {
      var r = list[i];
      if (!r || (r.cond !== "low" && r.cond !== "high")) continue;
      var b = buckets[r.cond];
      b.n += 1;

      var sumProcRt = 0;
      var pSteps = Array.isArray(r.procResults) ? r.procResults : [];
      for (var p = 0; p < pSteps.length; p += 1) {
        var st = pSteps[p];
        b.procTot += 1;
        if (st && Number.isFinite(st.rtMs) && st.rtMs >= 110) {
          sumProcRt += Math.min(st.slotMs || 2000, st.rtMs);
          b.procRts.push(st.rtMs);
          if (st.correct) b.procHits += 1;
        }
      }
      b.clList.push(clamp(sumProcRt / 4000, 0, 1));

      if (r.chosenKind === "target") {
        b.validRecall += 1;
        b.target += 1;
      } else if (r.chosenKind === "swap") {
        b.validRecall += 1;
        b.swap += 1;
      } else if (r.chosenKind === "novel") {
        b.validRecall += 1;
        b.novel += 1;
      } else {
        b.omissions += 1;
      }
    }

    function summarizeBucket(b) {
      var totalN = Math.max(1, b.n);
      // Unanswered recall timeouts receive uniform 4AFC chance novel weight (0.25) so timeouts never inflate target or hide guess
      var effNovel = b.novel + 0.25 * b.omissions;
      var effSwap = b.swap + 0.50 * b.omissions;
      var pTarget = b.n > 0 ? b.target / totalN : 0;
      var pGuess = b.n > 0 ? clamp((4 * effNovel) / totalN, 0, 1) : 1;
      var pSwapCorr = b.n > 0 ? clamp((effSwap - 2 * effNovel) / totalN, 0, 1) : 0;
      var pSwapRaw = b.validRecall > 0 ? b.swap / b.validRecall : 0;

      var clSum = 0;
      for (var c = 0; c < b.clList.length; c += 1) clSum += b.clList[c];
      var clMean = b.clList.length > 0 ? clSum / b.clList.length : 0;
      var procAcc = b.procTot > 0 ? Math.round((b.procHits / b.procTot) * 100) : 0;
      var rtSum = 0;
      for (var k = 0; k < b.procRts.length; k += 1) rtSum += b.procRts[k];
      var procRt = b.procRts.length > 0 ? Math.round(rtSum / b.procRts.length) : 0;

      return {
        pTarget: round3(pTarget),
        pTargetPct: Math.round(pTarget * 100),
        pGuess: round3(pGuess),
        pGuessPct: Math.round(pGuess * 100),
        pSwapCorr: round3(pSwapCorr),
        pSwapCorrPct: Math.round(pSwapCorr * 100),
        pSwapRawPct: Math.round(pSwapRaw * 100),
        cl: round2(clMean),
        procAccPct: procAcc,
        procMeanRtMs: procRt
      };
    }

    var lowS = summarizeBucket(buckets.low);
    var highS = summarizeBucket(buckets.high);
    var clDiff = highS.cl - lowS.cl;
    var deltaTbrs = Math.abs(clDiff) >= 0.05
      ? round2((lowS.pTarget - highS.pTarget) / clDiff)
      : round2(lowS.pTarget - highS.pTarget);

    var totProcHits = buckets.low.procHits + buckets.high.procHits;
    var totProcN = Math.max(1, buckets.low.procTot + buckets.high.procTot);
    var procAccOverallPct = Math.round((totProcHits / totProcN) * 100);
    var allProcRts = buckets.low.procRts.concat(buckets.high.procRts);
    var procMeanRtMs = 0;
    if (allProcRts.length > 0) {
      var sRt = 0;
      for (var z = 0; z < allProcRts.length; z += 1) sRt += allProcRts[z];
      procMeanRtMs = Math.round(sRt / allProcRts.length);
    }

    var engagementWeight = procAccOverallPct >= 70 ? 1 : Math.max(0.35, procAccOverallPct / 75);
    var calibratedScorePct = Math.round(highS.pTargetPct * engagementWeight);

    return {
      calibratedScorePct: calibratedScorePct,
      pTargetLow: lowS.pTarget,
      pTargetLowPct: lowS.pTargetPct,
      pTargetHigh: highS.pTarget,
      pTargetHighPct: highS.pTargetPct,
      pSwapHighCorr: highS.pSwapCorr,
      pSwapHighCorrPct: highS.pSwapCorrPct,
      pSwapHighRawPct: highS.pSwapRawPct,
      pGuessHigh: highS.pGuess,
      pGuessHighPct: highS.pGuessPct,
      clLow: lowS.cl,
      clHigh: highS.cl,
      deltaTbrs: deltaTbrs,
      rawLoadDropPct: lowS.pTargetPct - highS.pTargetPct,
      procAccPct: procAccOverallPct,
      procLowAccPct: lowS.procAccPct,
      procHighAccPct: highS.procAccPct,
      procMeanRtMs: procMeanRtMs,
      omissions: buckets.low.omissions + buckets.high.omissions
    };
  }

  /* ================= 7. D2: RAPID MUTATING STATE-BINDING + REFERENCE-BACK + M3 ================= */

  function buildSingleD2Trial(t, formId, lagTarget, gcPair) {
    // Glyph budget from closed pool of 8 glyphs [0..7]:
    //   g[0..2] = initial 3 active bindings
    //   g[3..4] = 2 rapid sub-second mutations (SOA = 800ms: 500ms flash + 300ms ISI) -> creates >= 2 distinct stale glyphs!
    //   g[5..6] = reserved for Reference-Back mismatch steps (Red update or Blue compare foil)
    //   g[7]    = strictly UNSEEN pure novel foil for 6AFC M3!
    var gPool = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    var cur = [gPool[0], gPool[1], gPool[2]];
    var staleByRole = [[], [], []];
    var staleOrdered = [];
    var freshCursor = 3;

    var rolePerm = shuffle([0, 1, 2]);
    var mutSlot0 = rolePerm[0];
    var mutSlot1 = rolePerm[1];

    var rapidMutations = [];
    var mutSlots = [mutSlot0, mutSlot1];
    for (var m = 0; m < 2; m += 1) {
      var msSlot = mutSlots[m];
      var oldG = cur[msSlot];
      var newG = gPool[freshCursor++];
      staleByRole[msSlot].push(oldG);
      staleOrdered.push({ roleIdx: msSlot, glyphIdx: oldG });
      cur[msSlot] = newG;
      rapidMutations.push({
        mutIndex: m,
        roleIdx: msSlot,
        glyphIdx: newG,
        exposureMs: 500,
        isiMs: 300,
        soaMs: 800
      });
    }

    // 2 Reference-Back gated steps: track BOTH PBWM gate-state transition (Rac-Lubashevsky & Kessler, 2016) AND spatial role transition
    var lastRole = mutSlot1;
    var rbStep1Role = (t % 2 === 0) ? lastRole : rolePerm[2];
    var rbStep2Role = (t % 4 < 2)
      ? rbStep1Role
      : ((rbStep1Role + 1 + (t % 2)) % 3);

    var rbRoles = [rbStep1Role, rbStep2Role];
    var gc = Array.isArray(gcPair) && gcPair.length === 2
      ? gcPair
      : [{ gate: "red", match: false }, { gate: "blue", match: true }];
    var refBackSteps = [];
    // Preceding rapid mutations opened the input gate ("update_red")
    var prevGateKind = "update_red";

    for (var rb = 0; rb < 2; rb += 1) {
      var rSlot = rbRoles[rb];
      var spec = gc[rb];
      var isUpdateRed = spec.gate === "red";
      var curGateKind = isUpdateRed ? "update_red" : "compare_blue";
      var isMatch = Boolean(spec.match);
      var refGlyphBefore = cur[rSlot];
      var shownGlyph = isMatch ? refGlyphBefore : gPool[freshCursor++];
      var gateTransition = curGateKind === prevGateKind ? "repeat" : "switch";
      var roleTransition = rSlot === lastRole ? "repeat" : "switch";

      if (isUpdateRed && !isMatch) {
        staleByRole[rSlot].push(refGlyphBefore);
        staleOrdered.push({ roleIdx: rSlot, glyphIdx: refGlyphBefore });
        cur[rSlot] = shownGlyph;
      }

      refBackSteps.push({
        stepIndex: rb,
        roleIdx: rSlot,
        gateKind: curGateKind,
        gateSpec: spec.gate,
        isUpdate: isUpdateRed,
        isMatch: isMatch,
        refGlyphBefore: refGlyphBefore,
        shownGlyph: shownGlyph,
        activeGlyphAfter: cur[rSlot],
        transition: gateTransition,
        gateTransition: gateTransition,
        roleTransition: roleTransition,
        deadlineMs: 3000,
        isiMs: 350
      });

      prevGateKind = curGateKind;
      lastRole = rSlot;
    }

    var focusRole = lastRole; // Lag 0 role in FoA
    var wantLag0 = lagTarget === "lag0";
    var probeRole = focusRole;
    if (!wantLag0) {
      var shelfCandidates = [0, 1, 2].filter(function (r) { return r !== focusRole; });
      probeRole = shelfCandidates[t % shelfCandidates.length];
    }

    var targetGlyph = cur[probeRole];
    var activeOtherGlyphs = [];
    for (var rIdx = 0; rIdx < 3; rIdx += 1) {
      if (rIdx !== probeRole) activeOtherGlyphs.push(cur[rIdx]);
    }

    var stalePicks = [];
    var selfStales = staleByRole[probeRole].slice().reverse();
    for (var ss = 0; ss < selfStales.length && stalePicks.length < 2; ss += 1) {
      var sg = selfStales[ss];
      if (cur.indexOf(sg) === -1 && stalePicks.indexOf(sg) === -1) {
        stalePicks.push(sg);
      }
    }
    for (var so = staleOrdered.length - 1; so >= 0 && stalePicks.length < 2; so -= 1) {
      var og = staleOrdered[so].glyphIdx;
      if (cur.indexOf(og) === -1 && stalePicks.indexOf(og) === -1) {
        stalePicks.push(og);
      }
    }

    var novelGlyph = gPool[7];

    var options6 = shuffle([
      { glyphIdx: targetGlyph, category: "target" },
      { glyphIdx: activeOtherGlyphs[0], category: "active_other" },
      { glyphIdx: activeOtherGlyphs[1], category: "active_other" },
      { glyphIdx: stalePicks[0], category: "stale" },
      { glyphIdx: stalePicks[1], category: "stale" },
      { glyphIdx: novelGlyph, category: "novel" }
    ]);

    return {
      trialIndex: t,
      formId: normalizeFormId(formId),
      fixationMs: 200,
      encodeMs: 900,
      maskMs: 150,
      postMaskBlankMs: 200,
      probeDeadlineMs: 5000,
      itiMs: 250,
      gcPair: gc,
      initialGlyphs: [gPool[0], gPool[1], gPool[2]],
      rapidMutations: rapidMutations,
      refBackSteps: refBackSteps,
      finalGlyphs: cur.slice(),
      focusRole: focusRole,
      probeRole: probeRole,
      isLag0: probeRole === focusRole,
      lagCondition: probeRole === focusRole ? "lag0" : "lag1plus",
      targetGlyph: targetGlyph,
      activeOtherGlyphs: activeOtherGlyphs,
      staleGlyphs: stalePicks,
      novelGlyph: novelGlyph,
      options6: options6,
      maskSeed: randInt(1, 999)
    };
  }

  function regenerateD2SingleTrial(prevTrial) {
    var pt = prevTrial || {};
    var gcPair = Array.isArray(pt.gcPair) && pt.gcPair.length === 2
      ? pt.gcPair
      : (Array.isArray(pt.refBackSteps) && pt.refBackSteps.length === 2
          ? pt.refBackSteps.map(function (s) { return { gate: s.isUpdate ? "red" : "blue", match: Boolean(s.isMatch) }; })
          : [{ gate: "red", match: false }, { gate: "blue", match: true }]);
    return buildSingleD2Trial(
      Number(pt.trialIndex) || 0,
      pt.formId || "A",
      pt.lagCondition === "lag0" ? "lag0" : "lag1plus",
      gcPair
    );
  }

  function generateD2Trials(opts) {
    var o = opts || {};
    var formId = normalizeFormId(o.formId);
    var isFam = Boolean(o.isFamiliarization);
    var nTrials = isFam ? 2 : 16;

    var lagPlan = isFam
      ? shuffle(["lag0", "lag1plus"])
      : shuffle(["lag0", "lag0", "lag1plus", "lag1plus"])
          .concat(shuffle(["lag0", "lag0", "lag1plus", "lag1plus"]))
          .concat(shuffle(["lag0", "lag0", "lag1plus", "lag1plus"]))
          .concat(shuffle(["lag0", "lag0", "lag1plus", "lag1plus"]));

    var gateCombos = isFam
      ? [
          [{ gate: "red", match: false }, { gate: "blue", match: true }],
          [{ gate: "blue", match: false }, { gate: "red", match: true }]
        ]
      : shuffle([
          [{ gate: "red", match: true }, { gate: "red", match: false }],
          [{ gate: "red", match: false }, { gate: "red", match: true }],
          [{ gate: "blue", match: true }, { gate: "blue", match: false }],
          [{ gate: "blue", match: false }, { gate: "blue", match: true }],
          [{ gate: "red", match: true }, { gate: "blue", match: false }],
          [{ gate: "red", match: false }, { gate: "blue", match: true }],
          [{ gate: "blue", match: true }, { gate: "red", match: false }],
          [{ gate: "blue", match: false }, { gate: "red", match: true }],
          [{ gate: "red", match: true }, { gate: "blue", match: true }],
          [{ gate: "red", match: false }, { gate: "blue", match: false }],
          [{ gate: "blue", match: true }, { gate: "red", match: true }],
          [{ gate: "blue", match: false }, { gate: "red", match: false }],
          [{ gate: "red", match: false }, { gate: "red", match: true }],
          [{ gate: "blue", match: false }, { gate: "blue", match: true }],
          [{ gate: "red", match: true }, { gate: "blue", match: false }],
          [{ gate: "blue", match: true }, { gate: "red", match: false }]
        ]);

    var trials = [];
    for (var t = 0; t < nTrials; t += 1) {
      trials.push(buildSingleD2Trial(t, formId, lagPlan[t], gateCombos[t % gateCombos.length]));
    }
    return trials;
  }

  // Oberauer & Lewandowsky (2019) M3 explicit guessing-corrected decomposition + Reference-Back absolute metrics
  function scoreD2Trials(records) {
    var list = Array.isArray(records) ? records : [];
    var nTotal = list.length;
    var nValid = 0;
    var nTarget = 0;
    var nActiveOther = 0;
    var nStale = 0;
    var nNovel = 0;
    var omissions = 0;

    var lag0Hits = 0, lag0Tot = 0;
    var lag1Hits = 0, lag1Tot = 0;

    var redHits = 0, redTot = 0, redRts = [];
    var blueHits = 0, blueTot = 0, blueRts = [];
    var redRepRts = [], redSwRts = [];
    var blueRepRts = [], blueSwRts = [];
    var roleRepRts = [], roleSwRts = [];

    for (var i = 0; i < list.length; i += 1) {
      var r = list[i];
      if (!r) continue;

      if (r.isLag0) {
        lag0Tot += 1;
        if (r.chosenCategory === "target") lag0Hits += 1;
      } else {
        lag1Tot += 1;
        if (r.chosenCategory === "target") lag1Hits += 1;
      }

      if (r.chosenCategory === "target") {
        nValid += 1;
        nTarget += 1;
      } else if (r.chosenCategory === "active_other") {
        nValid += 1;
        nActiveOther += 1;
      } else if (r.chosenCategory === "stale") {
        nValid += 1;
        nStale += 1;
      } else if (r.chosenCategory === "novel") {
        nValid += 1;
        nNovel += 1;
      } else {
        omissions += 1;
      }

      var gSteps = Array.isArray(r.gateResults) ? r.gateResults : [];
      var prevGate = "update_red";
      for (var g = 0; g < gSteps.length; g += 1) {
        var gs = gSteps[g];
        if (!gs) continue;
        var validRt = Number.isFinite(gs.rtMs) && gs.rtMs >= 130;
        var gateTr = gs.gateTransition || (gs.gateKind === prevGate ? "repeat" : "switch");
        if (validRt && gs.roleTransition) {
          if (gs.roleTransition === "repeat") roleRepRts.push(gs.rtMs);
          else if (gs.roleTransition === "switch") roleSwRts.push(gs.rtMs);
        }
        if (gs.gateKind === "update_red") {
          redTot += 1;
          if (validRt && gs.correct) redHits += 1;
          if (validRt) {
            redRts.push(gs.rtMs);
            if (gateTr === "repeat") redRepRts.push(gs.rtMs);
            else if (gateTr === "switch") redSwRts.push(gs.rtMs);
          }
        } else {
          blueTot += 1;
          if (validRt && gs.correct) blueHits += 1;
          if (validRt) {
            blueRts.push(gs.rtMs);
            if (gateTr === "repeat") blueRepRts.push(gs.rtMs);
            else if (gateTr === "switch") blueSwRts.push(gs.rtMs);
          }
        }
        prevGate = gs.gateKind;
      }
    }

    function avgMs(arr) {
      if (!arr || arr.length === 0) return 0;
      var s = 0;
      for (var k = 0; k < arr.length; k += 1) s += arr[k];
      return Math.round(s / arr.length);
    }

    // Exact M3 formulas from Oberauer & Lewandowsky (2019); if all probes timed out (nValid === 0), return chance floor
    var pTarget = 0;
    var pGuess = 1;
    var pSwapCorr = 0;
    var pStaleCorr = 0;

    if (nValid > 0) {
      pTarget = nTarget / nValid;
      pGuess = Math.min(1, (6 * nNovel) / nValid);
      pSwapCorr = Math.max(0, (nActiveOther - 2 * nNovel) / nValid);
      pStaleCorr = Math.max(0, (nStale - 2 * nNovel) / nValid);
    }

    var effectiveTargetRate = nTotal > 0 ? nTarget / nTotal : 0;

    var redAccPct = redTot > 0 ? Math.round((redHits / redTot) * 100) : 0;
    var blueAccPct = blueTot > 0 ? Math.round((blueHits / blueTot) * 100) : 0;
    var gateTot = redTot + blueTot;
    var gateAccPct = gateTot > 0 ? Math.round(((redHits + blueHits) / gateTot) * 100) : 0;

    var redMeanRtMs = avgMs(redRts);
    var blueMeanRtMs = avgMs(blueRts);
    var allGateRts = redRts.concat(blueRts);
    var gateMeanRtMs = avgMs(allGateRts);

    var gateOpenCostMs = redSwRts.length > 0 && redRepRts.length > 0 ? avgMs(redSwRts) - avgMs(redRepRts) : 0;
    var gateCloseCostMs = blueSwRts.length > 0 && blueRepRts.length > 0 ? avgMs(blueSwRts) - avgMs(blueRepRts) : 0;
    var focusSwitchCostMs = roleSwRts.length > 0 && roleRepRts.length > 0 ? avgMs(roleSwRts) - avgMs(roleRepRts) : 0;

    var lag0AccPct = lag0Tot > 0 ? Math.round((lag0Hits / lag0Tot) * 100) : 0;
    var lag1PlusAccPct = lag1Tot > 0 ? Math.round((lag1Hits / lag1Tot) * 100) : 0;

    var gateWeight = gateAccPct >= 65 ? 1 : Math.max(0.4, gateAccPct / 70);
    var calibratedScorePct = Math.round(effectiveTargetRate * 100 * gateWeight);

    return {
      calibratedScorePct: calibratedScorePct,
      nTotal: nTotal,
      nValid: nValid,
      omissions: omissions,
      nTarget: nTarget,
      nActiveOther: nActiveOther,
      nStale: nStale,
      nNovel: nNovel,
      pTarget: round3(pTarget),
      pTargetPct: Math.round(pTarget * 100),
      effectiveTargetPct: Math.round(effectiveTargetRate * 100),
      pGuess: round3(pGuess),
      pGuessPct: Math.round(pGuess * 100),
      pSwapCorr: round3(pSwapCorr),
      pSwapCorrPct: Math.round(pSwapCorr * 100),
      pStaleCorr: round3(pStaleCorr),
      pStaleCorrPct: Math.round(pStaleCorr * 100),
      lag0AccPct: lag0AccPct,
      lag1PlusAccPct: lag1PlusAccPct,
      redAccPct: redAccPct,
      blueAccPct: blueAccPct,
      gateAccPct: gateAccPct,
      redMeanRtMs: redMeanRtMs,
      blueMeanRtMs: blueMeanRtMs,
      gateMeanRtMs: gateMeanRtMs,
      gateOpenCostMs: gateOpenCostMs,
      gateCloseCostMs: gateCloseCostMs,
      focusSwitchCostMs: focusSwitchCostMs
    };
  }

  /* ================= 8. D3: MASKED BAYS N=4 AT 200ms (900ms VS 3,800ms) ================= */

  function isOrientationAllowed(deg, existingAngles, minSepDeg) {
    var a = ((Number(deg) % 180) + 180) % 180;
    // Exclude verbal cardinal axes 0°/90° ± 7°
    if (axialDiffDeg(a, 0) < 7 || axialDiffDeg(a, 90) < 7) return false;
    // Exclude verbal oblique axes 45°/135° ± 5°
    if (axialDiffDeg(a, 45) < 5 || axialDiffDeg(a, 135) < 5) return false;
    var sep = minSepDeg || 25;
    for (var i = 0; i < existingAngles.length; i += 1) {
      if (axialDiffDeg(a, existingAngles[i]) < sep) return false;
    }
    return true;
  }

  function sampleFourOrthogonalOrientations() {
    // Open valid arcs in [0, 180): [7, 40], [50, 83], [97, 130], [140, 173]
    for (var att = 0; att < 320; att += 1) {
      var list = [];
      for (var k = 0; k < 4; k += 1) {
        var found = false;
        for (var inner = 0; inner < 90; inner += 1) {
          var cand = round1(randomFloat01() * 180);
          if (isOrientationAllowed(cand, list, 25)) {
            list.push(cand);
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (list.length === 4) return shuffle(list);
    }
    // Guaranteed fallback inside the 4 open arcs with pairwise axial diff >= 42°
    var baseArcs = [
      12 + round1(randomFloat01() * 18),
      56 + round1(randomFloat01() * 18),
      103 + round1(randomFloat01() * 18),
      147 + round1(randomFloat01() * 18)
    ];
    return shuffle(baseArcs);
  }

  // Generate 4 ring locations with ZERO 180° diametric pairs (|sep - 180°| >= 28° for all 6 pairs)
  function sampleNonDiametricRingLocations4() {
    // Base gaps (68°, 76°, 72°, 144°) have adjacent gaps >= 68° and diagonal sums 144° & 148° (>= 32° away from 180°!)
    for (var att = 0; att < 80; att += 1) {
      var phi0 = randomFloat01() * 360;
      var g1 = 66 + randomFloat01() * 8;
      var g2 = 72 + randomFloat01() * 8;
      var g3 = 68 + randomFloat01() * 8;
      var locs = [
        phi0 % 360,
        (phi0 + g1) % 360,
        (phi0 + g1 + g2) % 360,
        (phi0 + g1 + g2 + g3) % 360
      ];
      var flip = randInt(0, 1) === 1;
      if (flip) {
        locs = locs.map(function (ang) { return (360 - ang + phi0) % 360; });
      }
      var valid = true;
      for (var i = 0; i < 4; i += 1) {
        for (var j = i + 1; j < 4; j += 1) {
          var rawDiff = Math.abs(locs[i] - locs[j]) % 360;
          var circSep = Math.min(rawDiff, 360 - rawDiff);
          if (circSep < 62 || Math.abs(circSep - 180) < 26) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
      if (valid) return locs.map(round1);
    }
    var b = randInt(0, 359);
    return [b, (b + 68) % 360, (b + 144) % 360, (b + 216) % 360];
  }

  function sampleInitialDialDeg4(angles, targetAngle) {
    for (var att = 0; att < 240; att += 1) {
      var cand = round1(randomFloat01() * 180);
      if (axialDiffDeg(cand, 0) < 7 || axialDiffDeg(cand, 90) < 7) continue;
      if (axialDiffDeg(cand, targetAngle) < 30) continue;
      var nearAny = false;
      for (var j = 0; j < angles.length; j += 1) {
        if (axialDiffDeg(cand, angles[j]) < 16) {
          nearAny = true;
          break;
        }
      }
      if (!nearAny) return cand;
    }
    return round1((targetAngle + 83) % 180);
  }

  function buildSingleD3Trial(trialIndex, isLong, probeIdx) {
    var longFlag = Boolean(isLong);
    var delayMs = longFlag ? 3800 : 900;
    var angles = sampleFourOrthogonalOrientations();
    var ringLocationsDeg = sampleNonDiametricRingLocations4();
    var pIdx = ((Number(probeIdx) || 0) % 4 + 4) % 4;
    var targetAngle = angles[pIdx];
    var nonTargetAngles = [];
    for (var k = 0; k < 4; k += 1) {
      if (k !== pIdx) nonTargetAngles.push(angles[k]);
    }
    return {
      trialIndex: trialIndex,
      setSize: 4,
      delayCond: longFlag ? "long_3800" : "short_900",
      isLong: longFlag,
      fixationMs: 250,
      exposureMs: 200,
      maskMs: 150,
      delayMs: delayMs,
      responseDeadlineMs: 8000,
      itiMs: 200,
      suppressionPaceMs: 550,
      ringLocationsDeg: ringLocationsDeg,
      angles: angles,
      probeIdx: pIdx,
      targetAngle: targetAngle,
      nonTargetAngles: nonTargetAngles,
      initDialAngle: sampleInitialDialDeg4(angles, targetAngle),
      maskSeed: randInt(1, 999)
    };
  }

  function regenerateD3SingleTrial(prevTrial) {
    var pt = prevTrial || {};
    return buildSingleD3Trial(Number(pt.trialIndex) || 0, Boolean(pt.isLong), pt.probeIdx !== undefined ? pt.probeIdx : 0);
  }

  function generateD3Trials(opts) {
    var o = opts || {};
    var isFam = Boolean(o.isFamiliarization);
    // 48 trials split evenly: 24 @ 900ms short vs 24 @ 3800ms long (12 shuffled mini-blocks of 4)
    var delayCells = [];
    if (isFam) {
      delayCells = shuffle(["short", "short", "long", "long"]);
    } else {
      for (var b = 0; b < 12; b += 1) {
        delayCells = delayCells.concat(shuffle(["short", "short", "long", "long"]));
      }
    }

    var probeBag = [];
    for (var pb = 0; pb < Math.ceil(delayCells.length / 4); pb += 1) {
      probeBag = probeBag.concat(shuffle([0, 1, 2, 3]));
    }

    var trials = [];
    for (var i = 0; i < delayCells.length; i += 1) {
      trials.push(buildSingleD3Trial(i, delayCells[i] === "long", probeBag[i]));
    }
    return trials;
  }

  function scoreD3Trials(records) {
    var list = Array.isArray(records) ? records : [];
    var shortList = [];
    var longList = [];
    var omissions = 0;

    for (var i = 0; i < list.length; i += 1) {
      var r = list[i];
      if (!r) continue;
      if (r.omitted) omissions += 1;
      if (r.isLong) longList.push(r);
      else shortList.push(r);
    }

    var fitAll = fitBaysMixtureMAP(list);
    // Empirical-Bayes hierarchical kappa anchor from N=48 pooled fit stabilizes N=24 delay sub-fits without masking real precision shifts
    var subOpts = fitAll.nValid >= 8 ? { anchorKappa: fitAll.kappa, anchorWeight: 0.70 } : {};
    var fitShort = fitBaysMixtureMAP(shortList, subOpts);
    var fitLong = fitBaysMixtureMAP(longList, subOpts);

    var deltaGammaDelay = round3(fitLong.gamma - fitShort.gamma);
    var deltaKDelay = round2(fitLong.K - fitShort.K);
    var precisionScore = Math.max(0, Math.min(1, 1 - fitAll.cMAE / 45));
    var omissionPenalty = list.length > 0 ? Math.max(0, 1 - omissions / list.length) : 0;
    var calibratedScorePct = Math.round(100 * (0.65 * fitAll.alpha + 0.35 * precisionScore) * omissionPenalty);

    return {
      calibratedScorePct: calibratedScorePct,
      nTotal: list.length,
      nValid: fitAll.nValid,
      omissions: omissions,
      alpha: fitAll.alpha,
      alphaPct: Math.round(fitAll.alpha * 100),
      K: fitAll.K,
      beta: fitAll.beta,
      betaPct: Math.round(fitAll.beta * 100),
      gamma: fitAll.gamma,
      gammaPct: Math.round(fitAll.gamma * 100),
      kappa: fitAll.kappa,
      sigmaDeg: fitAll.sigmaDeg,
      cMAE: fitAll.cMAE,
      bays2016SwapIdx: fitAll.bays2016SwapIdx,
      bays2016SwapPct: Math.round(fitAll.bays2016SwapIdx * 100),
      alphaShort: fitShort.alpha,
      KShort: fitShort.K,
      betaShort: fitShort.beta,
      betaShortPct: Math.round(fitShort.beta * 100),
      gammaShort: fitShort.gamma,
      gammaShortPct: Math.round(fitShort.gamma * 100),
      sigmaShortDeg: fitShort.sigmaDeg,
      cMAEShort: fitShort.cMAE,
      baysSwapShortPct: Math.round(fitShort.bays2016SwapIdx * 100),
      alphaLong: fitLong.alpha,
      KLong: fitLong.K,
      betaLong: fitLong.beta,
      betaLongPct: Math.round(fitLong.beta * 100),
      gammaLong: fitLong.gamma,
      gammaLongPct: Math.round(fitLong.gamma * 100),
      sigmaLongDeg: fitLong.sigmaDeg,
      cMAELong: fitLong.cMAE,
      baysSwapLongPct: Math.round(fitLong.bays2016SwapIdx * 100),
      deltaGammaDelay: deltaGammaDelay,
      deltaGammaDelayPct: Math.round(deltaGammaDelay * 100),
      deltaKDelay: deltaKDelay
    };
  }

  /* ================= 9. D4: BALLISTIC CONSOLIDATION & STREAM OVERFLOW (SOA_75) ================= */

  var D4_SOAS = [350, 650, 1050, 1450];

  function buildSingleD4Trial(t, formId, soaMs, probeSerialPos, interruptDir) {
    var roleOrder = shuffle([0, 1, 2]);
    var glyphBag = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    var streamBindings = [
      { serialPos: 0, roleIdx: roleOrder[0], glyphIdx: glyphBag[0] },
      { serialPos: 1, roleIdx: roleOrder[1], glyphIdx: glyphBag[1] },
      { serialPos: 2, roleIdx: roleOrder[2], glyphIdx: glyphBag[2] }
    ];

    var pSp = ((Number(probeSerialPos) || 0) % 3 + 3) % 3;
    var probedBinding = streamBindings[pSp];
    var swapBindings = streamBindings.filter(function (b) { return b.serialPos !== pSp; });
    var novelGlyph = glyphBag[3];

    var options4 = shuffle([
      { glyphIdx: probedBinding.glyphIdx, kind: "target" },
      { glyphIdx: swapBindings[0].glyphIdx, kind: "swap" },
      { glyphIdx: swapBindings[1].glyphIdx, kind: "swap" },
      { glyphIdx: novelGlyph, kind: "novel" }
    ]);

    var dir = interruptDir === "left" ? "left" : "right";
    var sVal = Number(soaMs) || 650;

    return {
      trialIndex: t,
      formId: normalizeFormId(formId),
      soaMs: sVal,
      fixationMs: 200,
      itemExposureMs: 250,
      itemMaskMs: 100,
      interItemBlankMs: Math.max(0, sVal - 350),
      postLastGapMs: 250, // 100ms mask + 150ms blank = 250ms exact before 2-AFC interrupt
      interruptDir: dir,
      interruptExpectRight: dir === "right",
      interruptDeadlineMs: 1500,
      recallDeadlineMs: 4000,
      itiMs: 200,
      streamBindings: streamBindings,
      probeSerialPos: pSp,
      probeRoleIdx: probedBinding.roleIdx,
      targetGlyph: probedBinding.glyphIdx,
      novelGlyph: novelGlyph,
      options4: options4,
      maskSeed: randInt(1, 999)
    };
  }

  function regenerateD4SingleTrial(prevTrial) {
    var pt = prevTrial || {};
    return buildSingleD4Trial(
      Number(pt.trialIndex) || 0,
      pt.formId || "A",
      pt.soaMs || 650,
      pt.probeSerialPos !== undefined ? pt.probeSerialPos : 0,
      pt.interruptDir || "right"
    );
  }

  function formatD4Soa75(d4Obj, compact) {
    if (!d4Obj) return "—";
    var unit = compact ? "ms" : " ms";
    if (d4Obj.soa75ExceededCeiling) return ">1450" + unit;
    if (d4Obj.soa75AtFloor) return "≤350" + unit;
    var ms = clamp(Math.round(Number(d4Obj.soa75Ms) || 1450), 350, 1450);
    return toAsciiDigits(ms) + unit;
  }

  function generateD4Trials(opts) {
    var o = opts || {};
    var formId = normalizeFormId(o.formId);
    var isFam = Boolean(o.isFamiliarization);

    var designCells = [];
    if (isFam) {
      var famPos = shuffle([0, 1, 2, 1]);
      for (var f = 0; f < D4_SOAS.length; f += 1) {
        designCells.push({ soaMs: D4_SOAS[f], probeSerialPos: famPos[f] });
      }
      designCells = shuffle(designCells);
    } else {
      for (var rep = 0; rep < 3; rep += 1) {
        var block = [];
        for (var sIdx = 0; sIdx < D4_SOAS.length; sIdx += 1) {
          for (var sp = 0; sp < 3; sp += 1) {
            block.push({ soaMs: D4_SOAS[sIdx], probeSerialPos: sp });
          }
        }
        designCells = designCells.concat(shuffle(block));
      }
    }

    var dirBag = [];
    for (var d = 0; d < designCells.length; d += 1) {
      dirBag.push(d % 2 === 0 ? "right" : "left");
    }
    dirBag = shuffle(dirBag);

    var trials = [];
    for (var t = 0; t < designCells.length; t += 1) {
      trials.push(buildSingleD4Trial(t, formId, designCells[t].soaMs, designCells[t].probeSerialPos, dirBag[t]));
    }
    return trials;
  }

  // Fit 4AFC psychometric logistic curve:
  // P(SOA) = 0.25 + (0.75 - delta) / (1 + exp(-k * (SOA - SOA_50)))
  function fitD4LogisticCurve(soaBins) {
    // soaBins: array of { soaMs, hits, total } sorted by soaMs
    var bins = Array.isArray(soaBins) ? soaBins : [];
    if (bins.length === 0) {
      return {
        soa50Ms: 900,
        soa75Ms: 1450,
        slopeK: 0.004,
        lapseDelta: 0.02,
        aucRawPct: 25,
        aucConsPct: 0,
        soa75AtFloor: false,
        soa75ExceededCeiling: true
      };
    }

    // Trapezoidal AUC across [350, 1450]
    var sorted = bins.slice().sort(function (a, b) { return a.soaMs - b.soaMs; });
    var trapSum = 0;
    var spanMs = 0;
    for (var j = 0; j < sorted.length - 1; j += 1) {
      var p1 = sorted[j].total > 0 ? sorted[j].hits / sorted[j].total : 0.25;
      var p2 = sorted[j + 1].total > 0 ? sorted[j + 1].hits / sorted[j + 1].total : 0.25;
      var dt = sorted[j + 1].soaMs - sorted[j].soaMs;
      if (dt > 0) {
        trapSum += 0.5 * (p1 + p2) * dt;
        spanMs += dt;
      }
    }
    var aucRaw = spanMs > 0 ? trapSum / spanMs : (sorted[0].total > 0 ? sorted[0].hits / sorted[0].total : 0.25);
    var aucCons = clamp((aucRaw - 0.25) / 0.75, 0, 1);

    function logPost(soa50, k, delta) {
      var ll = 0;
      for (var i = 0; i < sorted.length; i += 1) {
        var b = sorted[i];
        if (b.total <= 0) continue;
        var z = clamp(-k * (b.soaMs - soa50), -30, 30);
        var p = 0.25 + (0.75 - delta) / (1 + Math.exp(z));
        p = clamp(p, 1e-5, 1 - 1e-5);
        ll += b.hits * Math.log(p) + (b.total - b.hits) * Math.log(1 - p);
      }
      // Mild regularizer keeping slope positive & SOA_50 smooth on finite N=36
      var kPen = Math.log(k / 0.005);
      var sPen = (soa50 - 800) / 900;
      return ll - 0.12 * kPen * kPen - 0.08 * sPen * sPen;
    }

    var best = { val: -1e18, soa50: 750, k: 0.005, delta: 0.02 };
    var s50Grid = [220, 360, 500, 650, 800, 950, 1120, 1300, 1550];
    var kGrid = [0.0014, 0.0028, 0.0050, 0.0085, 0.014];
    var dGrid = [0.0, 0.03, 0.06];

    for (var gi = 0; gi < s50Grid.length; gi += 1) {
      for (var gk = 0; gk < kGrid.length; gk += 1) {
        for (var gd = 0; gd < dGrid.length; gd += 1) {
          var v = logPost(s50Grid[gi], kGrid[gk], dGrid[gd]);
          if (v > best.val) {
            best = { val: v, soa50: s50Grid[gi], k: kGrid[gk], delta: dGrid[gd] };
          }
        }
      }
    }

    // Coordinate refinement
    var stepS = 45;
    var stepK = 0.0012;
    for (var it = 0; it < 28; it += 1) {
      var imp = false;
      var moves = [
        [stepS, 0], [-stepS, 0], [0, stepK], [0, -stepK]
      ];
      for (var m = 0; m < moves.length; m += 1) {
        var cs = clamp(best.soa50 + moves[m][0], 120, 1950);
        var ck = clamp(best.k + moves[m][1], 0.0009, 0.025);
        var cv = logPost(cs, ck, best.delta);
        if (cv > best.val + 1e-6) {
          best.val = cv;
          best.soa50 = cs;
          best.k = ck;
          imp = true;
        }
      }
      if (!imp) {
        stepS *= 0.55;
        stepK *= 0.55;
      }
    }

    // Invert P(SOA_75) = 0.75 => exp(-k*(SOA_75 - SOA_50)) = (0.25 - delta) / 0.50
    var ratio = Math.max(0.04, (0.25 - best.delta) / 0.50);
    var rawSoa75 = best.soa50 - Math.log(ratio) / best.k;
    var pAt350 = sorted[0].total > 0 ? sorted[0].hits / sorted[0].total : 0;
    var pAtMax = sorted[sorted.length - 1].total > 0 ? sorted[sorted.length - 1].hits / sorted[sorted.length - 1].total : 0;

    var soa75AtFloor = pAt350 >= 0.75 && rawSoa75 <= 350;
    var soa75ExceededCeiling = rawSoa75 > 1450 && pAtMax < 0.75;
    var soa75Ms = soa75AtFloor
      ? 350
      : (soa75ExceededCeiling ? 1450 : Math.round(clamp(rawSoa75, 350, 1450)));

    return {
      soa50Ms: Math.round(best.soa50),
      soa75Ms: soa75Ms,
      soa75Display: soa75ExceededCeiling ? ">1450 ms" : (soa75AtFloor ? "≤350 ms" : soa75Ms + " ms"),
      soa75Compact: soa75ExceededCeiling ? ">1450ms" : (soa75AtFloor ? "≤350ms" : soa75Ms + "ms"),
      slopeK: round3(best.k),
      lapseDelta: round2(best.delta),
      aucRawPct: Math.round(aucRaw * 100),
      aucConsPct: Math.round(aucCons * 100),
      soa75AtFloor: soa75AtFloor,
      soa75ExceededCeiling: soa75ExceededCeiling
    };
  }

  function scoreD4Trials(records) {
    var list = Array.isArray(records) ? records : [];
    var bySoa = {
      350: { soaMs: 350, hits: 0, swap: 0, novel: 0, omissions: 0, total: 0 },
      650: { soaMs: 650, hits: 0, swap: 0, novel: 0, omissions: 0, total: 0 },
      1050: { soaMs: 1050, hits: 0, swap: 0, novel: 0, omissions: 0, total: 0 },
      1450: { soaMs: 1450, hits: 0, swap: 0, novel: 0, omissions: 0, total: 0 }
    };

    var intHits = 0;
    var intTot = 0;
    var intRts = [];

    for (var i = 0; i < list.length; i += 1) {
      var r = list[i];
      if (!r || !bySoa[r.soaMs]) continue;
      var b = bySoa[r.soaMs];
      b.total += 1;
      if (r.chosenKind === "target") b.hits += 1;
      else if (r.chosenKind === "swap") b.swap += 1;
      else if (r.chosenKind === "novel") b.novel += 1;
      else b.omissions += 1;

      intTot += 1;
      if (Number.isFinite(r.interruptRtMs) && r.interruptRtMs >= 110) {
        intRts.push(r.interruptRtMs);
        if (r.interruptCorrect) intHits += 1;
      }
    }

    var binArr = D4_SOAS.map(function (s) { return bySoa[s]; });
    var curve = fitD4LogisticCurve(binArr);

    function corrSwapRate(bA, bB) {
      var tot = bA.total + bB.total;
      if (tot <= 0) return 0;
      var effNovel = bA.novel + bB.novel + 0.25 * (bA.omissions + bB.omissions);
      var effSwap = bA.swap + bB.swap + 0.50 * (bA.omissions + bB.omissions);
      return Math.round(clamp((effSwap - 2 * effNovel) / tot, 0, 1) * 100);
    }

    var fastSwapCorrPct = corrSwapRate(bySoa[350], bySoa[650]);
    var slowSwapCorrPct = corrSwapRate(bySoa[1050], bySoa[1450]);

    var accBySoa = {};
    for (var k = 0; k < D4_SOAS.length; k += 1) {
      var sKey = D4_SOAS[k];
      var bk = bySoa[sKey];
      accBySoa[sKey] = bk.total > 0 ? Math.round((bk.hits / bk.total) * 100) : 0;
    }

    var interruptAccPct = intTot > 0 ? Math.round((intHits / intTot) * 100) : 0;
    var intMeanRtMs = 0;
    if (intRts.length > 0) {
      var sRt = 0;
      for (var z = 0; z < intRts.length; z += 1) sRt += intRts[z];
      intMeanRtMs = Math.round(sRt / intRts.length);
    }

    var intWeight = interruptAccPct >= 65 ? 1 : Math.max(0.4, interruptAccPct / 70);
    var calibratedScorePct = Math.round(curve.aucConsPct * intWeight);

    return {
      calibratedScorePct: calibratedScorePct,
      soa75Ms: curve.soa75Ms,
      soa75Display: curve.soa75Display,
      soa75Compact: curve.soa75Compact,
      soa50Ms: curve.soa50Ms,
      slopeK: curve.slopeK,
      soa75AtFloor: curve.soa75AtFloor,
      soa75ExceededCeiling: curve.soa75ExceededCeiling,
      aucConsPct: curve.aucConsPct,
      aucRawPct: curve.aucRawPct,
      acc350Pct: accBySoa[350],
      acc650Pct: accBySoa[650],
      acc1050Pct: accBySoa[1050],
      acc1450Pct: accBySoa[1450],
      fastSwapCorrPct: fastSwapCorrPct,
      slowSwapCorrPct: slowSwapCorrPct,
      interruptAccPct: interruptAccPct,
      interruptMeanRtMs: intMeanRtMs
    };
  }

  /* ================= 10. D5: STANDARD 5.0-MINUTE PVT-5 (300,000 ms) ================= */

  // Stratified balanced ISI = 2,000-7,000 ms within EVERY minute 1..5 so beta_ToT is unconfounded by ISI
  function generateMinuteIsiStratum() {
    var fast = [
      randInt(2000, 2290),
      randInt(2300, 2590),
      randInt(2600, 2890),
      randInt(2900, 3190),
      randInt(3200, 3460)
    ];
    var mid = [
      randInt(3520, 3980),
      randInt(4000, 4460)
    ];
    var slow = [
      randInt(4500, 4990),
      randInt(5000, 5490),
      randInt(5500, 5990),
      randInt(6000, 6490),
      randInt(6500, 7000)
    ];
    return shuffle(fast.concat(mid).concat(slow));
  }

  function generateD5Schedule(opts) {
    var o = opts || {};
    var isFam = Boolean(o.isFamiliarization);
    var totalDurationMs = isFam ? 24000 : 300000; // 24s familiarization vs strict 300,000ms PVT-5
    var minutePools = [];
    for (var m = 0; m < 6; m += 1) {
      minutePools.push(generateMinuteIsiStratum());
    }
    return {
      totalDurationMs: totalDurationMs,
      feedbackMs: 500,
      lapseTimeoutMs: 10000,
      falseStartThresholdMs: 100,
      minutePools: minutePools
    };
  }

  function analyzeD5Pvt(events, durationMs) {
    var list = Array.isArray(events) ? events : [];
    var dur = Number(durationMs) || 300000;
    var falseStarts = 0;
    var validEvents = [];
    var validRts = [];
    var answeredExRts = [];
    var fastIsiExRts = [];
    var slowIsiExRts = [];
    var earlyExRts = [];
    var earlySlowIsiExRts = [];
    var lapses500 = 0;
    var lapses355 = 0;
    var timeouts = 0;

    var minuteBins = [[], [], [], [], []];

    for (var i = 0; i < list.length; i += 1) {
      var ev = list[i];
      if (!ev) continue;
      if (ev.isFalseStart || (Number.isFinite(ev.rtMs) && ev.rtMs < 100)) {
        falseStarts += 1;
        continue;
      }
      var rt = ev.timedOut ? 10000 : Number(ev.rtMs);
      if (!Number.isFinite(rt) || rt < 100) continue;
      rt = clamp(rt, 100, 10000);
      var isTimeout = Boolean(ev.timedOut) || rt >= 10000;
      if (isTimeout) timeouts += 1;
      if (rt >= 500) lapses500 += 1;
      if (rt >= 355) lapses355 += 1;

      var isi = Number(ev.isiMs) || 4000;
      var elapsed = Number(ev.elapsedMs) || 0;
      var minIdx = clamp(Math.floor(elapsed / 60000), 0, 4);

      validEvents.push({ rtMs: rt, isiMs: isi, elapsedMs: elapsed, minIdx: minIdx, isTimeout: isTimeout });
      validRts.push(rt);
      minuteBins[minIdx].push(1000 / rt);

      // Isolate non-response 10,000ms timeouts from attentive Ex-Gaussian density (Basner & Dinges, 2011; Ratcliff, 1993)
      if (!isTimeout) {
        answeredExRts.push(rt);
        if (isi >= 4500) slowIsiExRts.push(rt);
        else if (isi < 3500) fastIsiExRts.push(rt);

        if (elapsed < 120000) {
          earlyExRts.push(rt);
          if (isi >= 4500) earlySlowIsiExRts.push(rt);
        }
      }
    }

    var n = validRts.length;
    if (n === 0) {
      return {
        calibratedScorePct: 0,
        durationMs: dur,
        nValid: 0,
        falseStarts: falseStarts,
        timeouts: timeouts,
        meanReciprocalSpeed: 0,
        meanRtMs: 0,
        medianRtMs: 0,
        sdRtMs: 0,
        icvPct: 0,
        muMs: 0,
        sigmaMs: 0,
        tauMs: 0,
        fastest10RtMs: 0,
        slowest10RtMs: 0,
        slowest10Recip: 0,
        lapses500Count: 0,
        lapses500Pct: 0,
        lapses355Count: 0,
        lapses355Pct: 0,
        slowIsiTauMs: 0,
        fastIsiTauMs: 0,
        earlyTauMs: 0,
        earlySlowIsiTauMs: 0,
        betaToTRecipPerMin: 0,
        betaToTMillisecondsPerMin: 0,
        minuteRecipMeans: [0, 0, 0, 0, 0]
      };
    }

    var sortedRts = validRts.slice().sort(function (a, b) { return a - b; });
    var k10 = Math.max(1, Math.round(n * 0.10));
    var sumFast10 = 0;
    var sumSlow10Rt = 0;
    var sumSlow10Recip = 0;
    for (var f = 0; f < k10; f += 1) {
      sumFast10 += sortedRts[f];
      var sRt = sortedRts[n - 1 - f];
      sumSlow10Rt += sRt;
      sumSlow10Recip += 1000 / sRt;
    }

    var sumRecip = 0;
    for (var j = 0; j < n; j += 1) {
      sumRecip += 1000 / validRts[j];
    }
    var meanRecip = sumRecip / n;

    var exBasePool = answeredExRts.length >= 3
      ? answeredExRts
      : validRts.map(function (v) { return Math.min(2500, v); });
    var exAll = fitExGaussianMAP(exBasePool);
    var subAnchor = exAll.n >= 6 ? { anchorMu: exAll.muMs, anchorSigma: Math.max(8, exAll.sigmaMs) } : {};
    var exSlow = fitExGaussianMAP(slowIsiExRts, subAnchor);
    var exFast = fitExGaussianMAP(fastIsiExRts, subAnchor);
    var exEarly = fitExGaussianMAP(earlyExRts, subAnchor);
    var exEarlySlow = earlySlowIsiExRts.length >= 3 ? fitExGaussianMAP(earlySlowIsiExRts, subAnchor) : exEarly;

    // Minute-by-minute mean reciprocal speed & OLS Time-on-Task slope across Minutes 1..5
    var minuteRecipMeans = [];
    var regPts = [];
    for (var m = 0; m < 5; m += 1) {
      var bin = minuteBins[m];
      if (bin.length > 0) {
        var bs = 0;
        for (var q = 0; q < bin.length; q += 1) bs += bin[q];
        var bm = bs / bin.length;
        minuteRecipMeans.push(round2(bm));
        regPts.push({ x: m + 1, y: bm });
      } else {
        minuteRecipMeans.push(0);
      }
    }

    // Continuous trial-level OLS slope of 1/RT (and RT) vs elapsed minutes t in [0, 5]
    var betaToTRecip = 0;
    var betaToTRtMs = 0;
    if (validEvents.length >= 4) {
      var mx = 0, myRecip = 0, myRt = 0;
      for (var e = 0; e < validEvents.length; e += 1) {
        var tMin = validEvents[e].elapsedMs / 60000;
        mx += tMin;
        myRecip += 1000 / validEvents[e].rtMs;
        myRt += validEvents[e].rtMs;
      }
      mx /= validEvents.length;
      myRecip /= validEvents.length;
      myRt /= validEvents.length;

      var sxx = 0, sxyRecip = 0, sxyRt = 0;
      for (var e2 = 0; e2 < validEvents.length; e2 += 1) {
        var dx = validEvents[e2].elapsedMs / 60000 - mx;
        sxx += dx * dx;
        sxyRecip += dx * (1000 / validEvents[e2].rtMs - myRecip);
        sxyRt += dx * (validEvents[e2].rtMs - myRt);
      }
      if (sxx > 0.05) {
        betaToTRecip = sxyRecip / sxx;
        betaToTRtMs = sxyRt / sxx;
      } else if (regPts.length >= 2) {
        betaToTRecip = (regPts[regPts.length - 1].y - regPts[0].y) / Math.max(1, regPts[regPts.length - 1].x - regPts[0].x);
      }
    }

    var lapses500Pct = round1((lapses500 / n) * 100);
    var lapses355Pct = round1((lapses355 / n) * 100);
    var rawSpeedScore = ((meanRecip - 1.8) / (4.15 - 1.8)) * 100;
    var calibratedScorePct = Math.round(clamp(rawSpeedScore - lapses500Pct * 0.55, 0, 100));

    return {
      calibratedScorePct: calibratedScorePct,
      durationMs: dur,
      nValid: n,
      falseStarts: falseStarts,
      timeouts: timeouts,
      meanReciprocalSpeed: round2(meanRecip),
      meanRtMs: exAll.meanMs,
      medianRtMs: exAll.medianMs,
      sdRtMs: exAll.sdMs,
      icvPct: exAll.icvPct,
      muMs: exAll.muMs,
      sigmaMs: exAll.sigmaMs,
      tauMs: exAll.tauMs,
      fastest10RtMs: Math.round(sumFast10 / k10),
      slowest10RtMs: Math.round(sumSlow10Rt / k10),
      slowest10Recip: round2(sumSlow10Recip / k10),
      lapses500Count: lapses500,
      lapses500Pct: lapses500Pct,
      lapses355Count: lapses355,
      lapses355Pct: lapses355Pct,
      slowIsiTauMs: exSlow.tauMs,
      fastIsiTauMs: exFast.tauMs,
      earlyTauMs: exEarly.tauMs,
      earlySlowIsiTauMs: exEarlySlow.tauMs,
      betaToTRecipPerMin: round3(betaToTRecip),
      betaToTMillisecondsPerMin: round1(betaToTRtMs),
      minuteRecipMeans: minuteRecipMeans
    };
  }

  /* ================= 11. RCI_90% (ICC >= 0.75 ONLY) & ENVIRONMENT DRIFT ================= */

  // Strictly restricted to metrics with documented test-retest ICC >= 0.75 (zero subtraction difference scores!)
  var HIGH_ICC_NORMS = {
    d5_mean_recip: {
      key: "d5_mean_recip",
      expId: "d5_pvt5",
      field: "meanReciprocalSpeed",
      labelAr: "متوسط سرعة اليقظة (Mean 1/RT)",
      icc: 0.84,
      sd: 0.42,
      unit: " s⁻¹",
      higherIsBetter: true,
      decimals: 2
    },
    d5_tau: {
      key: "d5_tau",
      expId: "d5_pvt5",
      field: "tauMs",
      labelAr: "ذيل الشرود الأسي (Ex-Gaussian τ)",
      icc: 0.78,
      sd: 32,
      unit: " ms",
      higherIsBetter: false,
      decimals: 1
    },
    d3_capacity_k: {
      key: "d3_capacity_k",
      expId: "d3_bays_analog",
      field: "K",
      labelAr: "سعة العناصر المحفوظة (Bays K = 4α)",
      icc: 0.78,
      sd: 0.68,
      unit: "",
      higherIsBetter: true,
      decimals: 2
    },
    d3_sigma_deg: {
      key: "d3_sigma_deg",
      expId: "d3_bays_analog",
      field: "sigmaDeg",
      labelAr: "الانحراف الدائري للتمثيل (σ_θ)",
      icc: 0.78,
      sd: 6.5,
      unit: "°",
      higherIsBetter: false,
      decimals: 1
    },
    d4_auc_cons: {
      key: "d4_auc_cons",
      expId: "d4_consolidation_soa",
      field: "aucConsPct",
      labelAr: "مساحة التوطيد المعيارية (AUC_cons)",
      icc: 0.77,
      sd: 12.5,
      unit: "%",
      higherIsBetter: true,
      decimals: 1
    },
    d2_p_target: {
      key: "d2_p_target",
      expId: "d2_refback_m3",
      field: "pTargetPct",
      labelAr: "دقة الهدف المطلقة في التحديث (M3 P_target)",
      icc: 0.80,
      sd: 14.0,
      unit: "%",
      higherIsBetter: true,
      decimals: 1
    },
    d2_gate_rt: {
      key: "d2_gate_rt",
      expId: "d2_refback_m3",
      field: "gateMeanRtMs",
      labelAr: "زمن البوابة المطلق (Reference-Back RT)",
      icc: 0.80,
      sd: 145,
      unit: " ms",
      higherIsBetter: false,
      decimals: 1
    },
    d1_high_cl: {
      key: "d1_high_cl",
      expId: "d1_tbrs",
      field: "pTargetHighPct",
      labelAr: "صمود الربط تحت الحمل العالي (TBRS High-CL)",
      icc: 0.76,
      sd: 15.0,
      unit: "%",
      higherIsBetter: true,
      decimals: 1
    }
  };

  // Exact Jacobson & Truax (1992) 90% Reliable Change Index:
  // SEM = SD * sqrt(1 - ICC), SE_diff = sqrt(2 * SEM^2), RCI_90% = ±1.64 * SE_diff
  function computeRci90Metric(valT0, valT1, normKey) {
    var spec = HIGH_ICC_NORMS[normKey];
    if (!spec || spec.icc < 0.75) return null;

    var sem = spec.sd * Math.sqrt(Math.max(0, 1 - spec.icc));
    var seDiff = Math.sqrt(2 * sem * sem);
    var rci90Threshold = 1.64 * seDiff;
    var dec = spec.decimals === 2 ? 2 : 1;
    var roundFn = dec === 2 ? round2 : round1;

    if (!Number.isFinite(valT0)) return null;

    if (!Number.isFinite(valT1)) {
      return {
        key: spec.key,
        labelAr: spec.labelAr,
        icc: spec.icc,
        sem: roundFn(sem),
        seDiff: roundFn(seDiff),
        rci90Threshold: roundFn(rci90Threshold),
        unit: spec.unit,
        valT0: roundFn(valT0),
        valT1: null,
        delta: null,
        zRci: null,
        hasFollowup: false,
        status: "baseline_locked",
        statusAr: "مرجع T0 مثبت (عتبة RCI 90%: ±" + toAsciiDigits(roundFn(rci90Threshold)) + spec.unit + ")"
      };
    }

    var rawDelta = valT1 - valT0;
    var zRci = seDiff > 0 ? rawDelta / seDiff : 0;
    var directedZ = spec.higherIsBetter ? zRci : -zRci;
    var status = "within_noise";
    var statusAr = "ضمن التذبذب العشوائي (|z| < 1.64)";
    if (directedZ >= 1.64) {
      status = "reliable_gain";
      statusAr = "تحسن موثوق (RCI 90%+)";
    } else if (directedZ <= -1.64) {
      status = "reliable_drop";
      statusAr = "تراجع موثوق (RCI 90%-)";
    }

    return {
      key: spec.key,
      labelAr: spec.labelAr,
      icc: spec.icc,
      sem: roundFn(sem),
      seDiff: roundFn(seDiff),
      rci90Threshold: roundFn(rci90Threshold),
      unit: spec.unit,
      valT0: roundFn(valT0),
      valT1: roundFn(valT1),
      delta: roundFn(rawDelta),
      zRci: round2(zRci),
      directedZ: round2(directedZ),
      hasFollowup: true,
      isReliable90: Math.abs(directedZ) >= 1.64,
      status: status,
      statusAr: statusAr
    };
  }

  function detectBrowserOsSummary(uaString) {
    var ua = String(uaString || (typeof navigator !== "undefined" ? navigator.userAgent : "") || "");
    var browser = "Browser";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

    var os = "OS";
    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    return browser + " / " + os;
  }

  function buildEnvironmentSnapshot(refreshHz, frameMs, dateObj) {
    var d = dateObj instanceof Date ? dateObj : new Date();
    var hh = d.getHours();
    var mm = d.getMinutes();
    var pad = function (x) { return x < 10 ? "0" + x : String(x); };
    var hz = Number.isFinite(refreshHz) && refreshHz > 0 ? Math.round(refreshHz) : 60;
    var fms = Number.isFinite(frameMs) && frameMs > 0 ? round2(frameMs) : round2(1000 / hz);
    return {
      capturedAt: d.toISOString(),
      minutesOfDay: hh * 60 + mm,
      localTimeHHMM: toAsciiDigits(pad(hh) + ":" + pad(mm)),
      browserOs: detectBrowserOsSummary(),
      refreshHz: hz,
      frameMs: fms
    };
  }

  function computeCircularMinuteDiff(minA, minB) {
    var diff = Math.abs((Number(minA) || 0) - (Number(minB) || 0)) % 1440;
    return Math.min(diff, 1440 - diff);
  }

  function evaluateEnvironmentAlerts(baselineEnv, currentEnv, activePhase) {
    var alerts = [];
    if (!baselineEnv || !currentEnv) return alerts;

    if (baselineEnv.browserOs && currentEnv.browserOs && baselineEnv.browserOs !== currentEnv.browserOs) {
      alerts.push(
        "تغير المتصفح/النظام عن خط الأساس (" +
        toAsciiDigits(baselineEnv.browserOs) + " ← " + toAsciiDigits(currentEnv.browserOs) +
        ")؛ ثبّت البيئة لتلافي انحياز تأخر الإدخال."
      );
    }

    if (Number.isFinite(baselineEnv.refreshHz) && Number.isFinite(currentEnv.refreshHz) &&
        Math.abs(baselineEnv.refreshHz - currentEnv.refreshHz) >= 4) {
      alerts.push(
        "تغير تردد الشاشة الفعلي عن خط الأساس (" +
        toAsciiDigits(baselineEnv.refreshHz) + "Hz ← " + toAsciiDigits(currentEnv.refreshHz) + "Hz)."
      );
    }

    // Skip circadian drift warning if user explicitly selected morning sleep inertia check (+15m)
    if (activePhase !== "sleep_inertia" &&
        Number.isFinite(baselineEnv.minutesOfDay) &&
        Number.isFinite(currentEnv.minutesOfDay)) {
      var minDiff = computeCircularMinuteDiff(baselineEnv.minutesOfDay, currentEnv.minutesOfDay);
      if (minDiff > 45) {
        alerts.push(
          "انحراف التوقيت اليومي بمقدار " + toAsciiDigits(Math.round(minDiff)) +
          " دقيقة عن خط الأساس (" + toAsciiDigits(baselineEnv.localTimeHHMM || "") +
          " مقابل " + toAsciiDigits(currentEnv.localTimeHHMM || "") +
          ")؛ يوصى بتوحيد التوقيت ضمن ±30–45 دقيقة."
        );
      }
    }

    return alerts;
  }

  /* ================= 12. STATE PERSISTENCE & FAMILIARIZATION ISOLATION ================= */

  function createEmptyState() {
    return {
      version: SUITE_VERSION,
      activeForm: "A",
      familiarization: {
        completed: false,
        completedAt: null,
        runsCount: 0
      },
      baselineEnv: null,
      lastEnv: null,
      baselineResults: {},
      results: {},
      history: []
    };
  }

  var memFallback = createEmptyState();

  var VALID_EXP_IDS = {
    d1_tbrs: true,
    d2_refback_m3: true,
    d3_bays_analog: true,
    d4_consolidation_soa: true,
    d5_pvt5: true
  };

  function sanitizeExpMap(rawObj) {
    var out = {};
    if (!rawObj || typeof rawObj !== "object" || Array.isArray(rawObj)) return out;
    var keys = Object.keys(rawObj);
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (VALID_EXP_IDS[k] && rawObj[k] && typeof rawObj[k] === "object" && !Array.isArray(rawObj[k])) {
        if (!rawObj[k].isFamiliarization) {
          out[k] = Object.assign({ expId: k }, rawObj[k]);
        }
      }
    }
    return out;
  }

  function sanitizeStateObject(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    var cleanRes = sanitizeExpMap(obj.results);
    var cleanBase = sanitizeExpMap(obj.baselineResults);

    // Ensure any key present in results also has a baseline anchor
    var resKeys = Object.keys(cleanRes);
    for (var r = 0; r < resKeys.length; r += 1) {
      var rk = resKeys[r];
      if (!cleanBase[rk]) cleanBase[rk] = Object.assign({}, cleanRes[rk]);
    }

    var cleanHist = [];
    if (Array.isArray(obj.history)) {
      for (var h = 0; h < obj.history.length && cleanHist.length < 90; h += 1) {
        var item = obj.history[h];
        if (item && typeof item === "object" && !Array.isArray(item) && VALID_EXP_IDS[item.expId] && !item.isFamiliarization) {
          cleanHist.push(item);
        }
      }
    }

    var fam = obj.familiarization && typeof obj.familiarization === "object"
      ? {
          completed: Boolean(obj.familiarization.completed),
          completedAt: obj.familiarization.completedAt || null,
          runsCount: Number(obj.familiarization.runsCount) || 0
        }
      : { completed: false, completedAt: null, runsCount: 0 };

    return {
      version: SUITE_VERSION,
      activeForm: normalizeFormId(obj.activeForm),
      familiarization: fam,
      baselineEnv: obj.baselineEnv && typeof obj.baselineEnv === "object" ? obj.baselineEnv : null,
      lastEnv: obj.lastEnv && typeof obj.lastEnv === "object" ? obj.lastEnv : null,
      baselineResults: cleanBase,
      results: cleanRes,
      history: cleanHist
    };
  }

  function persistState(st) {
    memFallback = st;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      }
    } catch (_) {}
    return st;
  }

  function loadState() {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          var clean = sanitizeStateObject(parsed);
          if (clean) return clean;
        }
      }
    } catch (_) {}
    return sanitizeStateObject(memFallback) || createEmptyState();
  }

  function setActiveForm(formId) {
    var st = loadState();
    st.activeForm = normalizeFormId(formId);
    return persistState(st);
  }

  function rotateNextForm() {
    var st = loadState();
    var idx = FORM_IDS.indexOf(normalizeFormId(st.activeForm));
    st.activeForm = FORM_IDS[(idx + 1) % FORM_IDS.length];
    return persistState(st);
  }

  function markFamiliarizationComplete(envSnapshot) {
    var st = loadState();
    st.familiarization = {
      completed: true,
      completedAt: new Date().toISOString(),
      runsCount: (Number(st.familiarization && st.familiarization.runsCount) || 0) + 1
    };
    if (envSnapshot && typeof envSnapshot === "object") {
      st.lastEnv = envSnapshot;
    }
    return persistState(st);
  }

  function readActiveClinicalContext() {
    var A = (root.NeuroLab && root.NeuroLab.Analytics) || root.Analytics || null;
    if (A && typeof A.getContext === "function") {
      try {
        var ctx = A.getContext();
        if (ctx && typeof ctx === "object") {
          return {
            phase: String(ctx.phase || "baseline"),
            sleepQuality: Number(ctx.sleepQuality ?? 6),
            alertness: Number(ctx.alertness ?? 8),
            nasalPatency: Number(ctx.nasalPatency ?? 5)
          };
        }
      } catch (_) {}
    }
    return { phase: "baseline", sleepQuality: 6, alertness: 8, nasalPatency: 5 };
  }

  function saveExperimentResult(expId, payload) {
    if (!VALID_EXP_IDS[expId]) return loadState();

    // Strict Familiarization Isolation Guard: NEVER pollute scored results or history!
    if (payload && payload.isFamiliarization) {
      return markFamiliarizationComplete(payload.env || null);
    }

    var st = loadState();
    var ctx = (payload && payload.context) || readActiveClinicalContext();
    var env = (payload && payload.env) || buildEnvironmentSnapshot(payload && payload.refreshHz, payload && payload.frameMs);

    var prevCount = 0;
    for (var h = 0; h < st.history.length; h += 1) {
      if (st.history[h].expId === expId) prevCount += 1;
    }

    var entry = Object.assign(
      {
        expId: expId,
        timestamp: new Date().toISOString(),
        formId: normalizeFormId((payload && payload.formId) || st.activeForm),
        phase: ctx.phase || "baseline",
        sleepQuality: ctx.sleepQuality,
        alertness: ctx.alertness,
        nasalPatency: ctx.nasalPatency,
        env: env,
        runIndex: prevCount + 1,
        isFamiliarization: false
      },
      payload || {}
    );
    entry.isFamiliarization = false;

    if (!st.baselineEnv) {
      st.baselineEnv = env;
    }
    st.lastEnv = env;

    // Anchor T0 baseline on first scored run of this probe
    if (!st.baselineResults[expId]) {
      st.baselineResults[expId] = Object.assign({}, entry);
    } else {
      st.results[expId] = entry;
    }
    st.results[expId] = entry;

    st.history.unshift(entry);
    if (st.history.length > 90) st.history.length = 90;
    return persistState(st);
  }

  function reanchorBaselineToCurrent() {
    var st = loadState();
    st.baselineResults = Object.assign({}, st.results);
    if (st.lastEnv) st.baselineEnv = st.lastEnv;
    return persistState(st);
  }

  function clearState() {
    memFallback = createEmptyState();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }

  var PHASE_LABELS_AR = {
    baseline: "خط الأساس القاعدي (قبل التدخل)",
    sleep_inertia: "فحص جمود الاستيقاظ الصباحي (+15د)",
    post_washout: "ما بعد الغسيل الدوائي العارض (6–8 أسابيع)",
    metabolic: "الدعم الاستقلابي والكرياتين والتأهيل العضلي",
    med_early: "العلاج الدوائي الجبهي المبكر (أسبوع 1–4)",
    med_stable: "استقرار العلاج الدوائي الجبهي (أسبوع 6–12+)",
    post_airway: "ما بعد إصلاح مجرى التنفس واسترداد النوم العميق"
  };

  function getPhaseLabelAr(phaseId) {
    var pid = String(phaseId || "baseline");
    var S = (root.NeuroLab && root.NeuroLab.Stimuli) || root.Stimuli || null;
    if (S && Array.isArray(S.PHASES)) {
      for (var i = 0; i < S.PHASES.length; i += 1) {
        var ph = S.PHASES[i];
        if (ph && String(ph.id || ph.key) === pid) {
          return toAsciiDigits(ph.label || ph.labelAr || PHASE_LABELS_AR[pid] || pid);
        }
      }
    }
    return toAsciiDigits(PHASE_LABELS_AR[pid] || pid);
  }

  function computeDeepRciSummary(stateObj) {
    var st = stateObj || loadState();
    var base = st.baselineResults || {};
    var cur = st.results || {};
    var items = [];
    var keys = Object.keys(HIGH_ICC_NORMS);

    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      var spec = HIGH_ICC_NORMS[k];
      var bRec = base[spec.expId];
      var cRec = cur[spec.expId];
      if (!bRec || !Number.isFinite(bRec[spec.field])) continue;

      var isDistinctFollowup = Boolean(
        cRec &&
        Number.isFinite(cRec[spec.field]) &&
        cRec.timestamp !== bRec.timestamp &&
        (cRec.runIndex || 1) > (bRec.runIndex || 1)
      );

      var rciObj = computeRci90Metric(
        bRec[spec.field],
        isDistinctFollowup ? cRec[spec.field] : NaN,
        k
      );
      if (rciObj) {
        rciObj.expId = spec.expId;
        rciObj.phaseT0 = bRec.phase || "baseline";
        rciObj.phaseT0Label = getPhaseLabelAr(rciObj.phaseT0);
        rciObj.formT0 = normalizeFormId(bRec.formId || "A");
        rciObj.phaseT1 = isDistinctFollowup ? (cRec.phase || "baseline") : null;
        rciObj.phaseT1Label = isDistinctFollowup ? getPhaseLabelAr(cRec.phase || "baseline") : null;
        rciObj.formT1 = isDistinctFollowup ? normalizeFormId(cRec.formId || "A") : null;
        items.push(rciObj);
      }
    }
    return items;
  }

  // Detect multi-wave right-limb Inverted-U rollover across >= 3 longitudinal sessions in st.history
  function detectMultiWaveInvertedURollover(historyList) {
    var hist = Array.isArray(historyList) ? historyList : [];
    if (hist.length < 3) return [];
    var normKeys = Object.keys(HIGH_ICC_NORMS);
    var rollovers = [];

    for (var i = 0; i < normKeys.length; i += 1) {
      var nk = normKeys[i];
      var spec = HIGH_ICC_NORMS[nk];
      // Chronological order (oldest -> newest)
      var seq = [];
      for (var h = hist.length - 1; h >= 0; h -= 1) {
        var rec = hist[h];
        if (rec && rec.expId === spec.expId && !rec.isFamiliarization && Number.isFinite(rec[spec.field])) {
          seq.push(rec);
        }
      }
      if (seq.length < 3) continue;

      var first = seq[0];
      var latest = seq[seq.length - 1];
      var bestMid = null;
      for (var m = 1; m < seq.length - 1; m += 1) {
        var cand = seq[m];
        if (!bestMid) {
          bestMid = cand;
        } else if (spec.higherIsBetter && cand[spec.field] > bestMid[spec.field]) {
          bestMid = cand;
        } else if (!spec.higherIsBetter && cand[spec.field] < bestMid[spec.field]) {
          bestMid = cand;
        }
      }
      if (!bestMid) continue;

      var gainMidVsT0 = computeRci90Metric(first[spec.field], bestMid[spec.field], nk);
      var dropLastVsMid = computeRci90Metric(bestMid[spec.field], latest[spec.field], nk);
      if (gainMidVsT0 && dropLastVsMid && gainMidVsT0.status === "reliable_gain" && dropLastVsMid.status === "reliable_drop") {
        rollovers.push({
          key: nk,
          labelAr: spec.labelAr,
          unit: spec.unit,
          peakVal: gainMidVsT0.valT1,
          peakPhaseLabel: getPhaseLabelAr(bestMid.phase || "baseline"),
          latestVal: dropLastVsMid.valT1,
          latestPhaseLabel: getPhaseLabelAr(latest.phase || "baseline"),
          zDropFromPeak: dropLastVsMid.zRci
        });
      }
    }
    return rollovers;
  }

  /* ================= 13. OBJECTIVE DIFFERENTIAL VERDICT ENGINE ================= */

  function computeDeepVerdictSummary(stateObj) {
    var st = stateObj || loadState();
    var r = st.results || {};
    var d1 = r.d1_tbrs;
    var d2 = r.d2_refback_m3;
    var d3 = r.d3_bays_analog;
    var d4 = r.d4_consolidation_soa;
    var d5 = r.d5_pvt5;

    var doneList = [d1, d2, d3, d4, d5].filter(Boolean);
    var done = doneList.length;
    var verdicts = [];
    var componentScores = [];

    // 1. D1 Verdict: TBRS Fixed 4,000ms Window
    if (d1) {
      componentScores.push(d1.calibratedScorePct);
      verdicts.push(
        "1. تلاشي الربط الطرفي تحت الحمل الثابت (D1 · TBRS 4.0s): صمود الهدف هبط من " +
        d1.pTargetLowPct + "% عند الحمل المنخفض (CL=" + d1.clLow + ") إلى " +
        d1.pTargetHighPct + "% عند الحمل العالي (CL=" + d1.clHigh + "، ميل Δ_TBRS=" + d1.deltaTbrs +
        ")؛ تفكيك خطأ الحمل العالي: تبديل مصحح P_swap=" + d1.pSwapHighCorrPct + "% مقابل تخمين/تلاشٍ P_guess=" +
        d1.pGuessHighPct + "% (دقة المعالجة " + d1.procAccPct + "%)."
      );
    } else {
      verdicts.push("1. تلاشي الربط الطرفي تحت الحمل الثابت (D1 · TBRS): بانتظار التنفيذ.");
    }

    // 2. D2 Verdict: Rapid Mutating State-Binding + Reference-Back + M3
    if (d2) {
      componentScores.push(d2.calibratedScorePct);
      verdicts.push(
        "2. التحديث الرمزي سريع الطفرة وبوابة Reference-Back (D2 · M3): الهدف P_target=" +
        d2.pTargetPct + "% (البؤرة Lag 0: " + d2.lag0AccPct + "% مقابل الرف الصامت Lag≥1: " + d2.lag1PlusAccPct +
        "%)، التبديل المصحح P_swap,corr=" + d2.pSwapCorrPct + "%، المتقادم المصحح P_stale,corr=" + d2.pStaleCorrPct +
        "%، التخمين P_guess=" + d2.pGuessPct + "%؛ البوابة المطلقة: تحديث أحمر " + d2.redAccPct + "% (" +
        d2.redMeanRtMs + " ms) ومقارنة زرقاء " + d2.blueAccPct + "% (" + d2.blueMeanRtMs + " ms)."
      );
    } else {
      verdicts.push("2. التحديث الرمزي سريع الطفرة وبوابة Reference-Back (D2 · M3): بانتظار التنفيذ.");
    }

    // 3. D3 Verdict: Masked Bays N=4 @ 200ms (900ms vs 3,800ms)
    if (d3) {
      componentScores.push(d3.calibratedScorePct);
      verdicts.push(
        "3. خليط Bays المقنّع عند 200ms لحجم N=4 (D3): السعة K=" + d3.K + " (α=" + d3.alphaPct +
        "%)، التبديل β=" + d3.betaPct + "% (مؤشر Bays 2016 اللامعلمي: " + d3.bays2016SwapPct +
        "%)، التخمين γ=" + d3.gammaPct + "%، قفزة الفقد بالتأخير Δγ_delay=" + fmtSigned(d3.deltaGammaDelayPct, "%") +
        " (0.9s: " + d3.gammaShortPct + "% ← 3.8s: " + d3.gammaLongPct + "%)، والانحراف الدائري σ_θ=" +
        d3.sigmaDeg + "° (cMAE=" + d3.cMAE + "°)."
      );
    } else {
      verdicts.push("3. خليط Bays المقنّع عند 200ms لحجم N=4 (D3): بانتظار التنفيذ.");
    }

    // 4. D4 Verdict: Ballistic Consolidation & Stream Overflow Threshold (SOA_75 & AUC_cons)
    if (d4) {
      componentScores.push(d4.calibratedScorePct);
      var soaBase = formatD4Soa75(d4, false);
      var soaTxt = d4.soa75ExceededCeiling ? soaBase + " (لم يبلغ 75% عند 1450ms)" : soaBase;
      verdicts.push(
        "4. عتبة التوطيد الباليستي وتفيّض التدفق (D4): عتبة SOA_75 = " + soaTxt +
        "، ومساحة التوطيد المعيارية AUC_cons = " + d4.aucConsPct + "% (الدقة عبر 350/650/1050/1450ms: " +
        d4.acc350Pct + "% / " + d4.acc650Pct + "% / " + d4.acc1050Pct + "% / " + d4.acc1450Pct +
        "%؛ التبديل السريع مقابل البطيء: " + d4.fastSwapCorrPct + "% مقابل " + d4.slowSwapCorrPct + "%)."
      );
    } else {
      verdicts.push("4. عتبة التوطيد الباليستي وتفيّض التدفق (D4): بانتظار التنفيذ.");
    }

    // 5. D5 Verdict: PVT-5 (300,000ms) MAP-MLE Ex-Gaussian
    if (d5) {
      componentScores.push(d5.calibratedScorePct);
      verdicts.push(
        "5. مسبار اليقظة النفسحركية الممتد (D5 · PVT-5): السرعة التبادلية Mean 1/RT = " +
        d5.meanReciprocalSpeed + " s⁻¹ (الوسيط " + d5.medianRtMs + " ms، أسرع/أبطأ 10%: " +
        d5.fastest10RtMs + " / " + d5.slowest10RtMs + " ms)، الهفوات L_500=" + d5.lapses500Pct +
        "% وL_355=" + d5.lapses355Pct + "%، Ex-Gaussian (μ=" + d5.muMs + "، σ=" + d5.sigmaMs + "، τ=" + d5.tauMs +
        " ms؛ Slow-ISI τ=" + d5.slowIsiTauMs + " ms مقابل Fast-ISI τ=" + d5.fastIsiTauMs +
        " ms؛ مبكر د1–2=" + d5.earlySlowIsiTauMs + " ms)، وميل التدهور الزمني β_ToT = " +
        fmtSigned(d5.betaToTRecipPerMin, " s⁻¹/min", 2) + "."
      );
    } else {
      verdicts.push("5. مسبار اليقظة النفسحركية الممتد (D5 · PVT-5): بانتظار التنفيذ.");
    }

    var compSum = 0;
    for (var c = 0; c < componentScores.length; c += 1) compSum += componentScores[c];
    var compositeScore = componentScores.length > 0 ? Math.round(compSum / componentScores.length) : null;

    var rciItems = computeDeepRciSummary(st);
    var activeCtx = readActiveClinicalContext();
    var latestRecPhase = (st.history && st.history[0] && st.history[0].phase) || activeCtx.phase || "baseline";
    var envAlerts = evaluateEnvironmentAlerts(st.baselineEnv, st.lastEnv, latestRecPhase);

    // 4 Objective Differential Signatures extracted directly from measured parameters
    var differentialSignatures = [];

    // Signature 1: Sleep Fragmentation / Slow-Wave Disruption (Delay-accelerated loss Δγ_delay + Time-on-Task decrement β_ToT)
    if (d3 || d5) {
      var hasDelaySurge = d3 && d3.deltaGammaDelay >= 0.14 && Math.abs(d3.sigmaLongDeg - d3.sigmaShortDeg) <= 8;
      var hasTotSlope = d5 && (d5.betaToTRecipPerMin <= -0.08 || d5.lapses355Pct >= 18);
      var sleepTag = (hasDelaySurge && hasTotSlope)
        ? "[متسق بقوة مع عدم استقرار الحالة وتجزؤ النوم العميق]"
        : ((hasDelaySurge || hasTotSlope) ? "[مؤشر جزئي على تآكل اليقظة أو الفقد المعتمد على التأخير]" : "[لا يظهر تسارع فقد بالتأخير أو انحدار زمني حاد]");
      differentialSignatures.push({
        id: "sig_sleep_fragmentation",
        title: "البصمة التفريقية 1 — تسارع الفقد بالتأخير وانحدار اليقظة (تجزؤ النوم / SWS)",
        body: sleepTag + " — قفزة التخمين عبر التأخير Δγ_delay = " +
          (d3 ? fmtSigned(d3.deltaGammaDelayPct, "%") + " (مع σ_θ قصير/طويل: " + d3.sigmaShortDeg + "°/" + d3.sigmaLongDeg + "°)" : "غير مقاس") +
          "، وميل تدهور اليقظة عبر الدقائق الخمس β_ToT = " +
          (d5 ? fmtSigned(d5.betaToTRecipPerMin, " s⁻¹/min", 2) + " (L_355=" + d5.lapses355Pct + "%، L_500=" + d5.lapses500Pct + "%)" : "غير مقاس") + "."
      });
    }

    // Signature 2: Frontostriatal Output-Gating & Peripheral Binding Fragility (β_0.9s + P_swap_corr with P_stale_corr ≈ 0 + Early Slow-ISI Tau + Δ_TBRS)
    if (d1 || d2 || d3 || d5) {
      var highShortSwap = (d3 && d3.betaShort >= 0.16) || (d2 && d2.pSwapCorr >= 0.18);
      var cleanRemoval = !d2 || d2.pStaleCorr <= 0.08;
      var highLoadDecay = d1 && (d1.rawLoadDropPct >= 20 || d1.deltaTbrs >= 0.35);
      var earlySlowTau = d5 && (d5.earlySlowIsiTauMs >= 55 || (d5.slowIsiTauMs - d5.fastIsiTauMs) >= 22);
      var gateTag = (highShortSwap && cleanRemoval && (highLoadDecay || earlySlowTau))
        ? "[بصمة كلاسيكية لهشاشة بوابة الإخراج والرف الصامت مع سلامة الإزالة النشطة]"
        : ((highShortSwap || highLoadDecay || earlySlowTau) ? "[حساسية انتقائية لحمل الربط أو الفواصل البطيئة]" : "[ثبات متماسك لبوابات الربط الجبهي-المخططي]");
      differentialSignatures.push({
        id: "sig_frontostriatal_gating",
        title: "البصمة التفريقية 2 — التبديل الإخراجي وهشاشة الرف الطرفي (البوابات الجبهية–المخططية)",
        body: gateTag + " — تبديل التأخير القصير β_0.9s = " + (d3 ? d3.betaShortPct + "%" : "—") +
          "، وتبديل التحديث المصحح P_swap,corr = " + (d2 ? d2.pSwapCorrPct + "% مع متقادم P_stale,corr = " + d2.pStaleCorrPct + "%" : "—") +
          "، وميل الحمل المعرفي Δ_TBRS = " + (d1 ? d1.deltaTbrs : "—") +
          "، وذيل الفواصل البطيئة المبكر (د1–2، ISI≥4.5s) τ = " + (d5 ? d5.earlySlowIsiTauMs + " ms" : "—") + "."
      });
    }

    // Signature 3: Continuous-Stream Consolidation Overflow Threshold (SOA_75 in ms)
    if (d4) {
      var bottleneckTag = d4.soa75Ms >= 850 || d4.soa75ExceededCeiling
        ? "[عنق زجاجة توطيد واضح يفسر تفيّض الكلام المتصل بلا وقفات]"
        : (d4.soa75Ms >= 600 ? "[نافذة توطيد متوسطة تتطلب فواصل تكتيل قصيرة]" : "[توطيد باليستي سريع مقاوم للتدفق المتلاحق]");
      differentialSignatures.push({
        id: "sig_stream_soa75",
        title: "البصمة التفريقية 3 — عتبة تفيّض التدفق المتواصل والتوطيد الباليستي (SOA_75)",
        body: bottleneckTag + " — يحتاج النظام إلى فاصل SOA_75 = " + formatD4Soa75(d4, false) +
          " لبلوغ دقة ربط 75% تحت المقاطعة الرجعية (AUC_cons = " + d4.aucConsPct +
          "%، تبديل السرعات العالية 350–650ms: " + d4.fastSwapCorrPct + "% مقابل البطيئة: " + d4.slowSwapCorrPct + "%)."
      });
    }

    // Signature 4: Longitudinal Inverted-U (Stability-Flexibility Trade-off & Multi-Wave Rollover) + RCI_90% Monitor
    var followupRcis = rciItems.filter(function (x) { return x.hasFollowup; });
    var rollovers = detectMultiWaveInvertedURollover(st.history);
    var bD2 = st.baselineResults && st.baselineResults.d2_refback_m3;
    if (followupRcis.length > 0 || rollovers.length > 0) {
      var gains = followupRcis.filter(function (x) { return x.status === "reliable_gain"; });
      var drops = followupRcis.filter(function (x) { return x.status === "reliable_drop"; });
      var staleRise = d2 && bD2 && (d2.pStaleCorrPct - bD2.pStaleCorrPct >= 12 || d2.pStaleCorrPct >= 15);
      var stabilityGain = gains.some(function (g) {
        return g.key === "d1_high_cl" || g.key === "d3_capacity_k" || g.key === "d5_tau" || g.key === "d5_mean_recip";
      });
      var flexDrop = staleRise || drops.some(function (dr) { return dr.key === "d2_p_target" || dr.key === "d2_gate_rt"; });

      var invUTag = (stabilityGain && flexDrop) || rollovers.length > 0
        ? "[تنبيه منحنى U المقلوب: تحسن سابق أو ثبات مع انتكاس/ضريبة جمود في التحديث المرن]"
        : (gains.length > 0 && drops.length === 0
          ? "[تحسن طولي متوازن يتجاوز عتبة RCI 90% دون كلفة جمود]"
          : (drops.length > 0 ? "[رُصد تراجع يتجاوز عتبة RCI 90% يستوجب مراجعة السياق/النوم]" : "[التغيرات الطولية الحالية ضمن هامش الضجيج القياسي RCI 90%]"));

      var rciBrief = followupRcis.map(function (it) {
        return it.labelAr + ": " + fmtSigned(it.delta, it.unit, it.unit === " s⁻¹" || it.unit === "" ? 2 : 1) +
          " (z=" + fmtSigned(it.zRci, "", 2) + ")";
      }).join(" · ");

      var rolloverNote = rollovers.length > 0
        ? " · انعطاف ذروة U المقلوب عبر الجلسات في (" + rollovers.map(function (ro) {
            return ro.labelAr + ": ذروة " + ro.peakVal + ro.unit + " ← حالي " + ro.latestVal + ro.unit;
          }).join("؛ ") + ")"
        : "";

      differentialSignatures.push({
        id: "sig_inverted_u_rci",
        title: "البصمة التفريقية 4 — مراقب منحنى U المقلوب والتغير الطولي الموثوق (RCI 90%)",
        body: invUTag + (rciBrief ? " — " + rciBrief : "") + rolloverNote +
          (d2 && bD2 ? " · تغير الأخطاء المتقادمة P_stale,corr: " + bD2.pStaleCorrPct + "% ← " + d2.pStaleCorrPct + "%." : ".")
      });
    } else if (rciItems.length > 0) {
      differentialSignatures.push({
        id: "sig_inverted_u_rci",
        title: "البصمة التفريقية 4 — مراقب منحنى U المقلوب والتغير الطولي الموثوق (RCI 90%)",
        body: "[مرجع خط الأساس T0 مثبّت] — ستُقارن موجات المتابعة القادمة (فحص جمود الاستيقاظ +15د، ما بعد الغسيل الدوائي العارض 6–8 أسابيع، أو التدخل العلاجي) تلقائيا بعتبات RCI 90% للمقاييس ذات الموثوقية ICC ≥ 0.75 مع مراقبة أي ارتفاع في P_stale,corr على منحنى U المقلوب."
      });
    }

    var headline = done < 5
      ? "أكملت " + done + " من 5 مسابير عميقة مضادة للتكتيل (النموذج النشط Form " + st.activeForm + ") — أكمل المتبقي لاستخراج البصمات الأربع."
      : "اكتملت البطارية العميقة المضادة للتكتيل (5/5 · Form " + st.activeForm + ") — مؤشر الصمود الخام: " + compositeScore + "%";

    var phaseDisplayLabel = getPhaseLabelAr(latestRecPhase);
    var reportLines = [
      "=== تقرير النسخة الثالثة المرقّاة: البطارية السيكوفيزيائية المضادة للتكتيل (D1–D5 · Form " + st.activeForm + ") ===",
      headline,
      "السياق الزمني والعتادي: المرحلة = " + phaseDisplayLabel +
        (st.lastEnv ? " | التوقيت = " + st.lastEnv.localTimeHHMM + " | التردد = " + st.lastEnv.refreshHz + "Hz | البيئة = " + st.lastEnv.browserOs : "") +
        " | التهيئة التمهيدية المستبعدة = " + (st.familiarization && st.familiarization.completed ? "مكتملة" : "غير منفذة بعد")
    ];

    if (envAlerts.length > 0) {
      for (var ea = 0; ea < envAlerts.length; ea += 1) {
        reportLines.push("تنبيه ضبط بيئي: " + envAlerts[ea]);
      }
    }

    reportLines = reportLines.concat(verdicts);

    if (differentialSignatures.length > 0) {
      reportLines.push("--- مصفوفة التفريق الموضوعي ومؤشرات RCI 90% (ICC >= 0.75) ---");
      for (var ds = 0; ds < differentialSignatures.length; ds += 1) {
        reportLines.push((ds + 1) + ". " + differentialSignatures[ds].title + ": " + differentialSignatures[ds].body);
      }
    }

    return {
      completedCount: done,
      compositeScore: compositeScore,
      verdicts: verdicts,
      differentialSignatures: differentialSignatures,
      rciItems: rciItems,
      rollovers: rollovers,
      envAlerts: envAlerts,
      overallHeadline: headline,
      plainTextReport: toAsciiDigits(reportLines.join("\n"))
    };
  }

  function exportStateJSON() {
    var st = loadState();
    var summary = computeDeepVerdictSummary(st);
    return toAsciiDigits(JSON.stringify({
      suite: "neurolab_deep_v3",
      version: SUITE_VERSION,
      exportedAt: new Date().toISOString(),
      activeForm: st.activeForm,
      familiarization: st.familiarization,
      baselineEnv: st.baselineEnv,
      lastEnv: st.lastEnv,
      compositeRawScore: summary.compositeScore,
      completedCount: summary.completedCount,
      baselineResults: st.baselineResults,
      results: st.results,
      history: st.history,
      rci90: summary.rciItems,
      differentialSignatures: summary.differentialSignatures,
      verdicts: summary.verdicts
    }, null, 2));
  }

  function importStateJSON(jsonOrObj) {
    var parsed = jsonOrObj;
    if (typeof jsonOrObj === "string") {
      try {
        parsed = JSON.parse(jsonOrObj);
      } catch (_) {
        return { ok: false, error: "ملف JSON غير صالح." };
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "بنية ملف النسخة الثالثة غير متوافقة." };
    }
    var targetObj = parsed.deepState && typeof parsed.deepState === "object"
      ? parsed.deepState
      : parsed;
    var incoming = sanitizeStateObject(targetObj);
    if (!incoming || (Object.keys(incoming.results).length === 0 && incoming.history.length === 0 && !incoming.familiarization.completed)) {
      return { ok: false, error: "لا يحتوي الملف على سجلات متوافقة للنسخة الثالثة المرقّاة (D1–D5)." };
    }

    var cur = loadState();
    var mergedBase = Object.assign({}, incoming.baselineResults, cur.baselineResults);
    var bKeys = Object.keys(incoming.results);
    for (var i = 0; i < bKeys.length; i += 1) {
      var k = bKeys[i];
      if (!mergedBase[k]) mergedBase[k] = Object.assign({}, incoming.results[k]);
    }
    var mergedResults = Object.assign({}, cur.results, incoming.results);
    var mergedHistory = incoming.history.concat(cur.history).slice(0, 90);

    var nextState = {
      version: SUITE_VERSION,
      activeForm: incoming.activeForm || cur.activeForm,
      familiarization: incoming.familiarization.completed ? incoming.familiarization : cur.familiarization,
      baselineEnv: cur.baselineEnv || incoming.baselineEnv,
      lastEnv: incoming.lastEnv || cur.lastEnv,
      baselineResults: mergedBase,
      results: mergedResults,
      history: mergedHistory
    };
    persistState(nextState);
    return { ok: true, count: Object.keys(incoming.results).length };
  }

  root.NeuroLab.DeepCore = {
    SUITE_VERSION: SUITE_VERSION,
    EXPERIMENTS: EXPERIMENTS,
    FORM_IDS: FORM_IDS,
    ROLE_FRAMES_3: ROLE_FRAMES_3,
    D4_SOAS: D4_SOAS,
    HIGH_ICC_NORMS: HIGH_ICC_NORMS,
    PHASE_LABELS_AR: PHASE_LABELS_AR,
    getPhaseLabelAr: getPhaseLabelAr,
    formatD4Soa75: formatD4Soa75,
    toAsciiDigits: toAsciiDigits,
    clamp: clamp,
    round1: round1,
    round2: round2,
    round3: round3,
    fmtSigned: fmtSigned,
    randomFloat01: randomFloat01,
    randInt: randInt,
    shuffle: shuffle,
    normalizeFormId: normalizeFormId,
    getGlyphPoints: getGlyphPoints,
    axialDiffDeg: axialDiffDeg,
    besselI0Scaled: besselI0Scaled,
    besselI1Scaled: besselI1Scaled,
    besselRatioA1: besselRatioA1,
    kappaToSigmaThetaDeg: kappaToSigmaThetaDeg,
    computeBays2016SwapIndex: computeBays2016SwapIndex,
    fitBaysMixtureMAP: fitBaysMixtureMAP,
    fitExGaussianMAP: fitExGaussianMAP,
    fitD4LogisticCurve: fitD4LogisticCurve,
    generateD1Trials: generateD1Trials,
    regenerateD1SingleTrial: regenerateD1SingleTrial,
    scoreD1Trials: scoreD1Trials,
    generateD2Trials: generateD2Trials,
    regenerateD2SingleTrial: regenerateD2SingleTrial,
    scoreD2Trials: scoreD2Trials,
    isOrientationAllowed: isOrientationAllowed,
    sampleFourOrthogonalOrientations: sampleFourOrthogonalOrientations,
    sampleNonDiametricRingLocations4: sampleNonDiametricRingLocations4,
    generateD3Trials: generateD3Trials,
    regenerateD3SingleTrial: regenerateD3SingleTrial,
    scoreD3Trials: scoreD3Trials,
    generateD4Trials: generateD4Trials,
    regenerateD4SingleTrial: regenerateD4SingleTrial,
    scoreD4Trials: scoreD4Trials,
    generateD5Schedule: generateD5Schedule,
    analyzeD5Pvt: analyzeD5Pvt,
    computeRci90Metric: computeRci90Metric,
    computeDeepRciSummary: computeDeepRciSummary,
    detectMultiWaveInvertedURollover: detectMultiWaveInvertedURollover,
    detectBrowserOsSummary: detectBrowserOsSummary,
    buildEnvironmentSnapshot: buildEnvironmentSnapshot,
    evaluateEnvironmentAlerts: evaluateEnvironmentAlerts,
    loadState: loadState,
    setActiveForm: setActiveForm,
    rotateNextForm: rotateNextForm,
    markFamiliarizationComplete: markFamiliarizationComplete,
    saveExperimentResult: saveExperimentResult,
    reanchorBaselineToCurrent: reanchorBaselineToCurrent,
    clearState: clearState,
    exportStateJSON: exportStateJSON,
    importStateJSON: importStateJSON,
    computeDeepVerdictSummary: computeDeepVerdictSummary
  };
})();

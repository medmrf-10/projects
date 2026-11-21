(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.NeuroLab = root.NeuroLab || {};

  var PHASES = [
    {
      id: "baseline",
      label: "خط الأساس القاعدي (قبل التدخل)",
      short: "خط الأساس",
      color: "#64748b"
    },
    {
      id: "metabolic",
      label: "الدعم الاستقلابي والكرياتين والتأهيل العضلي",
      short: "الاستقلابي والكرياتين",
      color: "#0284c7"
    },
    {
      id: "med_early",
      label: "العلاج الدوائي الجبهي المبكر (أسبوع 1–4)",
      short: "الدوائي المبكر",
      color: "#d97706"
    },
    {
      id: "med_stable",
      label: "استقرار العلاج الدوائي الجبهي (أسبوع 6–12+)",
      short: "استقرار الدواء",
      color: "#0f766e"
    },
    {
      id: "post_airway",
      label: "ما بعد إصلاح مجرى التنفس واسترداد النوم العميق",
      short: "بعد إصلاح النوم",
      color: "#10b981"
    }
  ];

  var PROBES = [
    {
      id: "isolation",
      order: 1,
      code: "P1 · ISO",
      title: "عزل التخزين المؤقت عن معالج التفكير",
      shortTitle: "العزل تحت المعالجة",
      shortLabel: "العزل تحت المعالجة",
      region: "القشرة الجبهية الظهرية الجانبية (DLPFC — قنوات HCN / Alpha-2A)",
      deficitName: "المسح الناتج عن المعالجة الجارية",
      deficit: "انمساح العناصر المحفوظة في الخلفية فور انشغال الذهن بحساب أو مقارنة منطقية",
      baseline: 13,
      baselineScore: 13,
      target: 80,
      norm: 80,
      normScore: 80,
      durationSec: 95,
      isControl: false,
      clinicalNote:
        "يقيس صمود المفردات المجردة في القناة الجبهية أثناء تنفيذ عملية حسابية أو علائقية؛ صعوده يدل على انغلاق قنوات التسريب الجبهية وتراجع المسح بالمعالجة.",
      instructions: [
        "شاهد 4 كلمات مجردة تظهر واحدة تلو الأخرى واحفظها بنفس ترتيب ظهورها دون تدوين خارجي.",
        "حل المسألة الحسابية أو المقارنة المنطقية التي تظهر فور اختفاء الكلمة الرابعة.",
        "اختر الكلمات الأربع بترتيبها الأصلي من لوحة المفردات، أو اضغط زر تبخر العنصر للخانة المفقودة."
      ],
      example:
        "مثال: تعرض الكلمات (وعد ← رتبة ← غرض ← كسب)، ثم تحل (7 × 4 - 9 = 19)، ثم تنقر الكلمات الأربع بترتيبها."
    },
    {
      id: "updating",
      order: 2,
      code: "P2 · UPD",
      title: "صمود الرف الجانبي وتحديث المتغيرات",
      shortTitle: "تحديث الرف الجانبي",
      shortLabel: "تحديث الرف الجانبي",
      region: "الحلقات الجبهية المخططية والتلفيف الجبهي السفلي (Frontostriatal + Left IFG)",
      deficitName: "تبخر المتغير المتروك والتصاق القيمة القديمة",
      deficit: "سقوط التحديث الأخير للمتغير الغائب عن البؤرة وبقاؤه عالقا في قيمته السابقة أو تبخره",
      baseline: 44,
      baselineScore: 44,
      target: 85,
      norm: 85,
      normScore: 85,
      durationSec: 110,
      isControl: false,
      clinicalNote:
        "يفصل جراحيا بين أخطاء التصاق القيمة القديمة (التداخل الاستباقي) وأخطاء التبخر الصرف في الرف الجانبي عند تتبع متغيرين أو 3 متغيرات.",
      instructions: [
        "احفظ القيم الابتدائية للمتغيرات المعروضة في بطاقة البداية ثم انتقل لعرض الخطوات.",
        "اقرأ كل خطوة جمع أو طرح وحدّث قيمة المتغير المقصود في ذهنك مع الاحتفاظ ببقية المتغيرات.",
        "أدخل في النهاية القيمة الأخيرة لكل متغير عبر لوحة الأرقام من 1 إلى 9 أو اضغط تبخر الرقم."
      ],
      example:
        "مثال: البداية (ألف = 5 ، باء = 2) ← أضف 3 إلى ألف (يصير 8) ← أضف 4 إلى باء (يصير 6) ← الجواب النهائي: ألف 8 وباء 6."
    },
    {
      id: "gating",
      order: 3,
      code: "P3 · GAT",
      title: "بوابة الإدخال وعقوبة التناوب اللحظي",
      shortTitle: "بوابة التناوب",
      shortLabel: "بوابة التناوب",
      region: "التلم الجبهي السفلي الأيسر وما قبل الحركية (Left IFS / Pre-SMA)",
      deficitName: "اختناق تبديل نمط الإدخال بين فئتين",
      deficit: "سقوط المدخلات لحظة القراءة عند تناوب فئتين مختلفتين مقابل سلامتها عند تكتلهما",
      baseline: 18,
      baselineScore: 18,
      target: 82,
      norm: 82,
      normScore: 82,
      durationSec: 95,
      isControl: false,
      clinicalNote:
        "يقارن السعة المتكتلة بالسعة المتناوبة لاستخراج عقوبة التناوب الصافية؛ انخفاض العقوبة يعكس مرونة بوابة التوجيه اللحظي.",
      instructions: [
        "شاهد سلسلة مختلطة من الكلمات المجردة والأرقام تظهر عنصرا تلو الآخر (متكتلة مرة ومتناوبة مرات).",
        "أدخل في المرحلة الأولى الأرقام وحدها مرتبة تصاعديا من الأصغر إلى الأكبر.",
        "أدخل في المرحلة الثانية الكلمات وحدها مرتبة عكسيا من الكلمة الأخيرة إلى الأولى."
      ],
      example:
        "مثال: لو ظهرت (شرط ← 8 ← أصل ← 3) تختار في مرحلة الأرقام (3 ثم 8)، ثم في مرحلة الكلمات (أصل ثم شرط)."
    },
    {
      id: "binding",
      order: 4,
      code: "P4 · BND",
      title: "ربط المؤشرات اللفظية بالعقد المنطقية",
      shortTitle: "ربط الاسم بالعقدة",
      shortLabel: "ربط الاسم بالعقدة",
      region: "القطب الجبهي والربط الجبهي الجداري (RLPFC / Role-Filler Binding)",
      deficitName: "تبخر الاسم اللفظي عن العقدة المحسوبة عند انقلاب القطبية",
      deficit: "استخراج الموقع المنطقي الصحيح للعنصر الفائز مع فقدان اسمه اللفظي أثناء حل المقارنة",
      baseline: 50,
      baselineScore: 50,
      target: 88,
      norm: 88,
      normScore: 88,
      durationSec: 90,
      isControl: false,
      clinicalNote:
        "يقيس ثبات اقتران اسم العلم بالعقدة المنطقية عند انقلاب جهة المقارنة دون إتاحة إعادة قراءة المقدمات السابقة.",
      instructions: [
        "اقرأ 3 جمل مقارنة بين 3 مسميات جملة بعد جملة؛ تختفي كل جملة فور الانتقال للتالية.",
        "استنتج في ذهنك الترتيب المنطقي للثلاثة مع إبقاء كل اسم مربوطا بموقعه.",
        "اختر الاسم المطلوب فور ظهور السؤال، أو اضغط الزر المخصص إن عرفت الموقع المنطقي وتبخر الاسم."
      ],
      example:
        "مثال: الفقه أضخم من النحو ← النحو أصغر من التفسير ← الفقه أصغر من التفسير؛ الأصغر حجما هو كتاب النحو."
    },
    {
      id: "vigilance",
      order: 5,
      code: "P5 · VIG",
      title: "عدّاد التسلسل الدوري ورصد النوم الموضعي",
      shortTitle: "عدّاد التسلسل واليقظة",
      shortLabel: "عدّاد التسلسل واليقظة",
      region: "الجزيرة الأمامية اليمنى وعدّاد التسلسل القطبي (rAI + RLPFC)",
      deficitName: "السهو التسلسلي واقتحام الشرود وهفوات النوم الموضعي",
      deficit: "اختلال عدّاد الدورات الرباعي تحت الرتابة وتراخي الاستجابة فوق 900 مللي ثانية",
      baseline: 56,
      baselineScore: 56,
      target: 90,
      norm: 90,
      normScore: 90,
      durationSec: 55,
      isControl: false,
      clinicalNote:
        "يرصد دقة عدّاد الدورات الداخلي وهفوات النوم الموضعي العصبوني وحوادث ضياع العدّاد باقتحام شبكة الوضع الافتراضي.",
      instructions: [
        "راقب الحلقة الضوئية التي تومض بانتظام وعدّ الومضات في ذهنك ضمن دورات رباعية متكررة (1، 2، 3، 4 ثم تعود 1).",
        "اضغط زر (خطوة 1 أو 2 أو 3) عند الومضات الثلاث الأولى، واضغط زر (إغلاق الدورة 4) عند الومضة الرابعة فقط.",
        "اضغط زر (ضاع العدّاد — أعد من 1) إن شرد ذهنك ونسيت رقم الومضة الحالية ليستأنف القياس من 1."
      ],
      example:
        "مثال دورة واحدة: ومضة 1 (خطوة عادية) ← ومضة 2 (خطوة عادية) ← ومضة 3 (خطوة عادية) ← ومضة 4 (إغلاق الدورة 4)."
    },
    {
      id: "control",
      order: 6,
      code: "C6 · CTL",
      title: "مرساة التحكم الضابطة للمحركات السليمة",
      shortTitle: "مرساة التحكم الضابطة",
      shortLabel: "مرساة التحكم الضابطة",
      region: "مخزن القواعد الأمامي والمسار البطني ثنائي الأبعاد (Rostral PFC + Ventral 2D)",
      deficitName: "مرجع ضابط سليم لعزل الإرهاق العام عن الخلل البنيوي",
      deficit: "فحص سلامة مكدس الاستدعاء الهرمي السببي وومضة التناسب البصري المسطح في 0.8 ثانية",
      baseline: 98,
      baselineScore: 98,
      target: 90,
      norm: 90,
      normScore: 90,
      durationSec: 75,
      isControl: true,
      clinicalNote:
        "يمثل خط التحكم الموجب السليم (98%)؛ ثباته عاليا مع صعود المناطق الخمس المتضررة يبرهن على ردم الفجوة العصبية انتقائيا.",
      instructions: [
        "في الجولتين الأوليين افتح 3 طبقات متداخلة لمكدس حسابي ثم عوّض الناتج صعودا من الفرع الثاني إلى الأصل.",
        "في الجولتين التاليتين التقط بعينيك تناسب الشكل المسطح خلال ومضة 0.8 ثانية قبل القناع البصري.",
        "اختر بعد فجوة الصمت الشكل المطابق تماما من بين الأشكال الأربعة المعروضة."
      ],
      example:
        "مثال المكدس: الأصل (10 ناقص الفرع الأول) ← الفرع الأول (3 ضرب الفرع الثاني) ← الفرع الثاني (1 + 1 = 2) ← الناتج 4."
    }
  ];

  // 128+ pure abstract non-imageable Arabic words
  var ABSTRACT_WORDS = [
    "شرط", "قصد", "عذر", "نفي", "سبب", "حكم", "أجل", "أصل",
    "فرع", "قيد", "وعد", "غرض", "كسب", "خطأ", "أثر", "وصف",
    "عهد", "ظن", "شك", "حزم", "صبر", "رشد", "عدل", "فضل",
    "علم", "فهم", "رأي", "عزم", "نصح", "إذن", "منع", "دفع",
    "رفع", "خفض", "جزم", "فرض", "ندب", "حظر", "عفو", "صفح",
    "لوم", "عتب", "مدح", "ذم", "صدق", "حق", "بطل", "ربح",
    "خسر", "دين", "قرض", "مهر", "إرث", "وقف", "نذر", "حلف",
    "فسخ", "عقد", "سلم", "صرف", "رهن", "ضمان", "كفل", "صلح",
    "قياس", "علة", "مانع", "ركن", "واجب", "مباح", "لازم", "متعد",
    "مطلق", "مقيد", "عام", "خاص", "مجمل", "مبين", "ظاهر", "نسخ",
    "توقف", "سبر", "طرد", "عكس", "نقض", "قلب", "فرق", "جمع",
    "حصر", "حد", "رسم", "جنس", "فصل", "نوع", "عرض", "ذات",
    "وضع", "ملك", "فعل", "شأن", "سمت", "نهج", "مسلك", "مذهب",
    "مقصد", "مناط", "مدار", "مآل", "مغزى", "مبنى", "معنى", "جدوى",
    "دلالة", "قرينة", "أمارة", "شبهة", "حجة", "برهان", "مسألة", "قضية",
    "مقدمة", "نتيجة", "مرتبة", "مهلة", "نسبة", "رتبة", "غاية", "حكمة"
  ];

  var BINDING_TRIADS = [
    {
      items: ["كتاب الفقه", "كتاب النحو", "كتاب التفسير"],
      more: "أضخم حجما من",
      less: "أصغر حجما من",
      askMax: "أي الكتب الثلاثة هو الأضخم حجما؟",
      askMin: "أي الكتب الثلاثة هو الأصغر حجما؟"
    },
    {
      items: ["علم الأصول", "علم المنطق", "علم البلاغة"],
      more: "أكثر مباحث من",
      less: "أقل مباحث من",
      askMax: "أي العلوم الثلاثة هو الأكثر مباحث؟",
      askMin: "أي العلوم الثلاثة هو الأقل مباحث؟"
    },
    {
      items: ["عقد الإجارة", "عقد الوكالة", "عقد المضاربة"],
      more: "أوسع شروطا من",
      less: "أضيق شروطا من",
      askMax: "أي العقود الثلاثة هو الأوسع شروطا؟",
      askMin: "أي العقود الثلاثة هو الأضيق شروطا؟"
    },
    {
      items: ["باب الطهارة", "باب الزكاة", "باب البيوع"],
      more: "أطول فصولا من",
      less: "أقصر فصولا من",
      askMax: "أي الأبواب الثلاثة هو الأطول فصولا؟",
      askMin: "أي الأبواب الثلاثة هو الأقصر فصولا؟"
    },
    {
      items: ["رسالة الأخلاق", "رسالة العقود", "رسالة القضاء"],
      more: "أقدم تدوينا من",
      less: "أحدث تدوينا من",
      askMax: "أي الرسائل الثلاث هي الأقدم تدوينا؟",
      askMin: "أي الرسائل الثلاث هي الأحدث تدوينا؟"
    },
    {
      items: ["معجم الألفاظ", "معجم المعاني", "معجم الفروق"],
      more: "أغزر شواهد من",
      less: "أندر شواهد من",
      askMax: "أي المعاجم الثلاثة هو الأغزر شواهد؟",
      askMin: "أي المعاجم الثلاثة هو الأندر شواهد؟"
    },
    {
      items: ["مبحث العموم", "مبحث القياس", "مبحث النسخ"],
      more: "أشد تفريعا من",
      less: "أخف تفريعا من",
      askMax: "أي المباحث الثلاثة هو الأشد تفريعا؟",
      askMin: "أي المباحث الثلاثة هو الأخف تفريعا؟"
    },
    {
      items: ["ديوان الحماسة", "ديوان الحكمة", "ديوان الوصف"],
      more: "أكبر أبياتا من",
      less: "أقل أبياتا من",
      askMax: "أي الدواوين الثلاثة هو الأكبر أبياتا؟",
      askMin: "أي الدواوين الثلاثة هو الأقل أبياتا؟"
    },
    {
      items: ["منهج السبر", "منهج الاستقراء", "منهج الترديد"],
      more: "أقوى حسما من",
      less: "أضعف حسما من",
      askMax: "أي المناهج الثلاثة هو الأقوى حسما؟",
      askMin: "أي المناهج الثلاثة هو الأضعف حسما؟"
    },
    {
      items: ["طبقة الشيوخ", "طبقة الأقران", "طبقة الأتباع"],
      more: "أعلى إسنادا من",
      less: "أنزل إسنادا من",
      askMax: "أي الطبقات الثلاث هي الأعلى إسنادا؟",
      askMin: "أي الطبقات الثلاث هي الأنزل إسنادا؟"
    },
    {
      items: ["سجل النفقات", "سجل الواردات", "سجل الودائع"],
      more: "أعلى رصيدا من",
      less: "أدنى رصيدا من",
      askMax: "أي السجلات الثلاثة هو الأعلى رصيدا؟",
      askMin: "أي السجلات الثلاثة هو الأدنى رصيدا؟"
    },
    {
      items: ["وحدة التحليل", "وحدة الفهرسة", "وحدة التدقيق"],
      more: "أسرع معالجة من",
      less: "أبطأ معالجة من",
      askMax: "أي الوحدات الثلاث هي الأسرع معالجة؟",
      askMin: "أي الوحدات الثلاث هي الأبطأ معالجة؟"
    },
    {
      items: ["شرط الأداء", "شرط الضمان", "شرط الخيار"],
      more: "أعم أثرا من",
      less: "أخص أثرا من",
      askMax: "أي الشروط الثلاثة هو الأعم أثرا؟",
      askMin: "أي الشروط الثلاثة هو الأخص أثرا؟"
    },
    {
      items: ["مختصر الفروع", "مختصر القواعد", "مختصر الآداب"],
      more: "أجزل عبارة من",
      less: "أوجز عبارة من",
      askMax: "أي المختصرات الثلاثة هو الأجزل عبارة؟",
      askMin: "أي المختصرات الثلاثة هو الأوجز عبارة؟"
    },
    {
      items: ["خطة الصيف", "خطة الشتاء", "خطة الربيع"],
      more: "أطول مدة من",
      less: "أقصر مدة من",
      askMax: "أي الخطط الثلاث هي الأطول مدة؟",
      askMin: "أي الخطط الثلاث هي الأقصر مدة؟"
    },
    {
      items: ["مسألة الإقالة", "مسألة الشفعة", "مسألة الحوالة"],
      more: "أكثر قيودا من",
      less: "أقل قيودا من",
      askMax: "أي المسائل الثلاث هي الأكثر قيودا؟",
      askMin: "أي المسائل الثلاث هي الأقل قيودا؟"
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

  function pickDistinctWords(count, excludeSet) {
    var used = excludeSet || {};
    var usedFirst = {};
    var usedLast = {};
    var pool = shuffle(ABSTRACT_WORDS);
    var picked = [];

    for (var i = 0; i < pool.length && picked.length < count; i += 1) {
      var w = pool[i];
      if (used[w]) continue;
      var first = w.charAt(0);
      var last = w.charAt(w.length - 1);
      if (usedFirst[first] || usedLast[last]) continue;
      used[w] = true;
      usedFirst[first] = true;
      usedLast[last] = true;
      picked.push(w);
    }

    // Fallback if count is large (e.g. 12 distractors)
    if (picked.length < count) {
      for (var k = 0; k < pool.length && picked.length < count; k += 1) {
        var w2 = pool[k];
        if (!used[w2]) {
          used[w2] = true;
          picked.push(w2);
        }
      }
    }
    return picked;
  }

  function buildMathProblem() {
    var a = randInt(4, 9);
    var b = randInt(3, 7);
    var prod = a * b;
    var addMode = Math.random() < 0.45;
    var c = addMode ? randInt(4, 14) : randInt(5, Math.min(16, prod - 6));
    var answer = addMode ? prod + c : prod - c;
    var prompt = addMode
      ? "اضرب " + a + " في " + b + " ثم أضف إلى الناتج " + c
      : "اضرب " + a + " في " + b + " ثم اطرح من الناتج " + c;

    var distractors = [];
    var candidates = [
      answer + 2,
      answer - 2,
      answer + 4,
      answer - 3,
      addMode ? prod - c : prod + c,
      (a + 1) * b - (addMode ? -c : c),
      answer + 6
    ];
    for (var i = 0; i < candidates.length && distractors.length < 3; i += 1) {
      var val = candidates[i];
      if (val > 2 && val !== answer && distractors.indexOf(val) === -1) {
        distractors.push(val);
      }
    }
    while (distractors.length < 3) {
      var extra = answer + randInt(-7, 8);
      if (extra > 2 && extra !== answer && distractors.indexOf(extra) === -1) {
        distractors.push(extra);
      }
    }

    var options = shuffle([String(answer)].concat(distractors.map(String)));
    return {
      prompt: prompt,
      options: options,
      answer: String(answer)
    };
  }

  function buildQuickLogicProblem(triad) {
    var ordered = shuffle(triad.items); // ordered[0] < ordered[1] < ordered[2]
    var minItem = ordered[0];
    var midItem = ordered[1];
    var maxItem = ordered[2];
    var askMin = Math.random() < 0.6;
    // Flipped phrasing to demand real relational processing
    var p1 = midItem + " " + triad.more + " " + minItem;
    var p2 = minItem + " " + triad.less + " " + maxItem;
    var p3 = midItem + " " + triad.less + " " + maxItem;
    var prompt =
      "إذا كان " +
      p1 +
      "، وكان " +
      p2 +
      "، وكان " +
      p3 +
      " — " +
      (askMin ? triad.askMin : triad.askMax);
    return {
      prompt: prompt,
      options: shuffle(ordered.slice()),
      answer: askMin ? minItem : maxItem
    };
  }

  function generateIsolationTrials(count) {
    var total = typeof count === "number" && count > 0 ? count : 4;
    var sessionUsedWords = {};
    var shuffledTriads = shuffle(BINDING_TRIADS);
    var trials = [];

    for (var t = 0; t < total; t += 1) {
      var targetWords = pickDistinctWords(4, sessionUsedWords);
      var localSet = {};
      for (var w = 0; w < targetWords.length; w += 1) {
        localSet[targetWords[w]] = true;
      }
      var extraDistractors = pickDistinctWords(8, Object.assign({}, sessionUsedWords, localSet));
      var pool = shuffle(targetWords.concat(extraDistractors));

      var isMath = t < Math.ceil(total / 2);
      var task = isMath
        ? buildMathProblem()
        : buildQuickLogicProblem(shuffledTriads[t % shuffledTriads.length]);

      trials.push({
        trialIndex: t,
        words: targetWords,
        distractorPool: pool,
        taskType: isMath ? "math" : "logic",
        taskPrompt: task.prompt,
        taskOptions: task.options,
        taskAnswer: task.answer
      });
    }
    return trials;
  }

  function buildConstrainedUpdatingTrial(trialIndex, vars, stepCount, semanticUnits) {
    for (var attempt = 0; attempt < 300; attempt += 1) {
      var digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
      var initial = {};
      var current = {};
      var historyByVar = {};

      for (var i = 0; i < vars.length; i += 1) {
        var v = vars[i];
        initial[v] = digits[i];
        current[v] = digits[i];
        historyByVar[v] = [];
      }

      // Build variable schedule ensuring every var is updated at least once, and first var is updated early & late
      var schedule = [];
      if (vars.length === 2) {
        schedule = attempt % 2 === 0 ? [vars[0], vars[1], vars[0], vars[1]] : [vars[0], vars[1], vars[1], vars[0]];
      } else {
        schedule = [vars[2], vars[0], vars[1], vars[0], vars[2]];
      }
      while (schedule.length < stepCount) {
        schedule.push(vars[schedule.length % vars.length]);
      }

      var steps = [];
      var ok = true;

      for (var s = 0; s < stepCount; s += 1) {
        var targetVar = schedule[s];
        var oldVal = current[targetVar];
        var candidates = [];

        for (var nextVal = 1; nextVal <= 9; nextVal += 1) {
          if (nextVal === oldVal) continue;
          var deltaCheck = Math.abs(nextVal - oldVal);
          if (deltaCheck < 1 || deltaCheck > 5) continue;

          // Avoid matching current values of other variables to keep error attribution clean
          var collision = false;
          for (var u = 0; u < vars.length; u += 1) {
            if (vars[u] !== targetVar && current[vars[u]] === nextVal) {
              collision = true;
              break;
            }
          }
          if (collision) continue;

          // If this is the last update for targetVar, ensure nextVal !== initial[targetVar]
          var futureUpdates = false;
          for (var f = s + 1; f < stepCount; f += 1) {
            if (schedule[f] === targetVar) {
              futureUpdates = true;
              break;
            }
          }
          if (!futureUpdates && nextVal === initial[targetVar]) continue;

          candidates.push(nextVal);
        }

        if (candidates.length === 0) {
          ok = false;
          break;
        }

        var chosen = candidates[randInt(0, candidates.length - 1)];
        var diff = chosen - oldVal;
        var op = diff > 0 ? "+" : "-";
        var absDelta = Math.abs(diff);

        historyByVar[targetVar].push(oldVal);
        current[targetVar] = chosen;

        var text = "";
        if (semanticUnits && semanticUnits[targetVar]) {
          var unit = semanticUnits[targetVar];
          text =
            op === "+"
              ? "زاد " + targetVar + " بمقدار " + absDelta + " " + unit
              : "نقص " + targetVar + " بمقدار " + absDelta + " " + unit;
        } else {
          text =
            op === "+"
              ? "أضف " + absDelta + " إلى " + targetVar
              : "اطرح " + absDelta + " من " + targetVar;
        }

        steps.push({
          varName: targetVar,
          op: op,
          delta: absDelta,
          text: text,
          snapshot: Object.assign({}, current)
        });
      }

      if (!ok) continue;

      // Final validation: all final values distinct & different from initial
      var seenFinal = {};
      var validFinal = true;
      for (var m = 0; m < vars.length; m += 1) {
        var vn = vars[m];
        var fv = current[vn];
        if (fv < 1 || fv > 9 || seenFinal[fv] || fv === initial[vn]) {
          validFinal = false;
          break;
        }
        seenFinal[fv] = true;
      }

      if (validFinal) {
        return {
          trialIndex: trialIndex,
          vars: vars.slice(),
          units: semanticUnits || null,
          initial: initial,
          steps: steps,
          final: current,
          historyByVar: historyByVar
        };
      }
    }

    // Deterministic safe fallback
    return {
      trialIndex: trialIndex,
      vars: ["ألف", "باء"],
      units: null,
      initial: { "ألف": 5, "باء": 2 },
      steps: [
        { varName: "ألف", op: "+", delta: 3, text: "أضف 3 إلى ألف", snapshot: { "ألف": 8, "باء": 2 } },
        { varName: "باء", op: "+", delta: 5, text: "أضف 5 إلى باء", snapshot: { "ألف": 8, "باء": 7 } },
        { varName: "ألف", op: "-", delta: 2, text: "اطرح 2 من ألف", snapshot: { "ألف": 6, "باء": 7 } },
        { varName: "باء", op: "-", delta: 3, text: "اطرح 3 من باء", snapshot: { "ألف": 6, "باء": 4 } }
      ],
      final: { "ألف": 6, "باء": 4 },
      historyByVar: { "ألف": [5, 8], "باء": [2, 7] }
    };
  }

  function generateUpdatingTrials(count) {
    var total = typeof count === "number" && count > 0 ? count : 4;
    var specs = [
      { vars: ["ألف", "باء"], steps: 4, units: null },
      { vars: ["ألف", "باء"], steps: 4, units: null },
      { vars: ["ألف", "باء", "جيم"], steps: 5, units: null },
      {
        vars: ["العمر", "السعر", "الوزن"],
        steps: 5,
        units: { "العمر": "سنوات", "السعر": "دنانير", "الوزن": "كيلو" }
      }
    ];
    var out = [];
    for (var i = 0; i < total; i += 1) {
      var sp = specs[i % specs.length];
      out.push(buildConstrainedUpdatingTrial(i, sp.vars, sp.steps, sp.units));
    }
    return out;
  }

  function pickNonConsecutiveDigits(count) {
    for (var attempt = 0; attempt < 80; attempt += 1) {
      var cand = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count);
      var sorted = cand.slice().sort(function (a, b) {
        return a - b;
      });
      var hasRun = false;
      if (count >= 3) {
        for (var i = 0; i < sorted.length - 2; i += 1) {
          if (sorted[i + 1] - sorted[i] === 1 && sorted[i + 2] - sorted[i + 1] === 1) {
            hasRun = true;
            break;
          }
        }
      }
      if (!hasRun) return cand;
    }
    return [8, 3, 6].slice(0, count);
  }

  function generateGatingTrials(count) {
    var total = typeof count === "number" && count > 0 ? count : 4;
    var usedWords = {};
    var blueprints = [
      { mode: "blocked", pairs: 3 },
      { mode: "alternating", pairs: 2 },
      { mode: "alternating", pairs: 3 },
      { mode: "alternating", pairs: 3 }
    ];

    var trials = [];
    for (var t = 0; t < total; t += 1) {
      var bp = blueprints[t % blueprints.length];
      var words = pickDistinctWords(bp.pairs, usedWords);
      var nums = pickNonConsecutiveDigits(bp.pairs);
      var sequence = [];

      if (bp.mode === "blocked") {
        for (var w = 0; w < words.length; w += 1) {
          sequence.push({ kind: "word", value: words[w] });
        }
        for (var n = 0; n < nums.length; n += 1) {
          sequence.push({ kind: "num", value: String(nums[n]) });
        }
      } else {
        for (var p = 0; p < bp.pairs; p += 1) {
          sequence.push({ kind: "word", value: words[p] });
          sequence.push({ kind: "num", value: String(nums[p]) });
        }
      }

      var expectedNumbersAsc = nums
        .slice()
        .sort(function (a, b) {
          return a - b;
        })
        .map(String);
      var expectedWordsRev = words.slice().reverse();

      var localExclude = Object.assign({}, usedWords);
      for (var u = 0; u < words.length; u += 1) {
        localExclude[words[u]] = true;
      }
      var extraWords = pickDistinctWords(9 - words.length, localExclude);
      var wordPool = shuffle(words.concat(extraWords));

      trials.push({
        trialIndex: t,
        mode: bp.mode,
        pairCount: bp.pairs,
        sequence: sequence,
        expectedNumbersAsc: expectedNumbersAsc,
        expectedWordsRev: expectedWordsRev,
        wordPool: wordPool
      });
    }
    return trials;
  }

  function generateBindingTrials(count) {
    var total = typeof count === "number" && count > 0 ? count : 5;
    var triads = shuffle(BINDING_TRIADS);
    var trials = [];

    for (var t = 0; t < total; t += 1) {
      var triad = triads[t % triads.length];
      // True latent order: minEntity < midEntity < maxEntity
      var latent = shuffle(triad.items);
      var minEntity = latent[0];
      var midEntity = latent[1];
      var maxEntity = latent[2];

      var polarity = t < 2 ? "linear" : "flipped";
      var askMin = t % 2 === 0;
      var premises = [];

      if (polarity === "linear") {
        if (Math.random() < 0.5) {
          premises = [
            maxEntity + " " + triad.more + " " + midEntity,
            midEntity + " " + triad.more + " " + minEntity,
            maxEntity + " " + triad.more + " " + minEntity
          ];
        } else {
          premises = [
            midEntity + " " + triad.less + " " + maxEntity,
            minEntity + " " + triad.less + " " + midEntity,
            minEntity + " " + triad.less + " " + maxEntity
          ];
        }
      } else {
        // Exact flipped polarity structure isolating Role-Filler Binding under polarity inversion
        if (t % 2 === 0) {
          premises = [
            midEntity + " " + triad.more + " " + minEntity,
            minEntity + " " + triad.less + " " + maxEntity,
            midEntity + " " + triad.less + " " + maxEntity
          ];
        } else {
          premises = [
            midEntity + " " + triad.less + " " + maxEntity,
            maxEntity + " " + triad.more + " " + minEntity,
            midEntity + " " + triad.more + " " + minEntity
          ];
        }
      }

      trials.push({
        trialIndex: t,
        polarity: polarity,
        entities: shuffle(latent.slice()),
        premises: premises,
        question: askMin ? triad.askMin : triad.askMax,
        answer: askMin ? minEntity : maxEntity,
        midEntity: midEntity
      });
    }
    return trials;
  }

  function generateVigilanceConfig() {
    return {
      totalPulses: 32,
      cycleLength: 4,
      baseIntervalMs: 1600,
      jitterMs: 80,
      flashDurationMs: 260,
      lapseThresholdMs: 900
    };
  }

  function buildStackControlTrial(trialIndex) {
    var leafA = randInt(1, 3);
    var leafB = randInt(1, 3);
    var leafSum = leafA + leafB; // 2..6
    var midFactor = randInt(2, 4);
    var midProd = midFactor * leafSum; // 4..24
    var rootAddMode = trialIndex % 2 === 1;
    var rootBase = rootAddMode ? randInt(4, 12) : midProd + randInt(3, 11);
    var answer = rootAddMode ? rootBase + midProd : rootBase - midProd;

    var frame1Text = rootAddMode
      ? "الأصل المعلّق: احفظ العدد " + rootBase + " وعملية الجمع (ستضيف إلى " + rootBase + " ناتج الفرع الأول)."
      : "الأصل المعلّق: احفظ العدد " + rootBase + " وعملية الطرح (ستطرح من " + rootBase + " ناتج الفرع الأول).";
    var frame2Text =
      "الفرع الأول المعلّق: احفظ العدد " + midFactor + " وعملية الضرب (ستضرب " + midFactor + " في ناتج الفرع الثاني).";
    var frame3Text = "الفرع الثاني المباشر: اجمع " + leafA + " مع " + leafB + ".";
    var closeText = "عوّض صعودا من الفرع الثاني إلى الفرع الأول ثم الأصل واختر النتيجة النهائية للأصل:";

    var distractorCandidates = [
      midProd,
      Math.abs(rootBase - leafSum),
      answer + midFactor,
      Math.max(1, answer - 2),
      answer + 3,
      rootBase + leafSum
    ];
    var distractors = [];
    for (var i = 0; i < distractorCandidates.length && distractors.length < 3; i += 1) {
      var d = distractorCandidates[i];
      if (d > 0 && d !== answer && distractors.indexOf(d) === -1) {
        distractors.push(d);
      }
    }
    while (distractors.length < 3) {
      var extra = answer + randInt(2, 7);
      if (distractors.indexOf(extra) === -1 && extra !== answer) {
        distractors.push(extra);
      }
    }

    return {
      trialIndex: trialIndex,
      kind: "stack",
      frame1Text: frame1Text,
      frame2Text: frame2Text,
      frame3Text: frame3Text,
      closeText: closeText,
      answer: answer,
      options: shuffle([answer].concat(distractors))
    };
  }

  function buildVisual2DControlTrial(trialIndex) {
    // Smooth 7-vertex non-symbolic 2D polygon around center (50, 50)
    var numVertices = 7;
    var baseAngles = [];
    var offsetAngle = randInt(0, 45) * (Math.PI / 180);
    for (var i = 0; i < numVertices; i += 1) {
      var ang = offsetAngle + (i * 2 * Math.PI) / numVertices + randInt(-6, 6) * (Math.PI / 180);
      baseAngles.push(ang);
    }
    var baseRadii = [];
    for (var r = 0; r < numVertices; r += 1) {
      baseRadii.push(randInt(24, 41));
    }

    function radiiToPoints(radii, angleTweaks) {
      var pts = [];
      for (var k = 0; k < numVertices; k += 1) {
        var a = baseAngles[k] + (angleTweaks ? angleTweaks[k] : 0);
        var rad = radii[k];
        var x = Math.round((50 + rad * Math.cos(a)) * 10) / 10;
        var y = Math.round((50 + rad * Math.sin(a)) * 10) / 10;
        pts.push([Math.max(8, Math.min(92, x)), Math.max(8, Math.min(92, y))]);
      }
      return pts;
    }

    var targetPoints = radiiToPoints(baseRadii, null);
    var foils = [];

    for (var f = 0; f < 3; f += 1) {
      var modRadii = baseRadii.slice();
      var tweaks = [0, 0, 0, 0, 0, 0, 0];
      var idx1 = (f * 2) % numVertices;
      var idx2 = (idx1 + 3) % numVertices;
      var delta1 = (f % 2 === 0 ? 1 : -1) * randInt(11, 14);
      var delta2 = (f % 2 === 0 ? -1 : 1) * randInt(11, 14);
      modRadii[idx1] = Math.max(15, Math.min(45, modRadii[idx1] + delta1));
      if (modRadii[idx1] === baseRadii[idx1]) {
        modRadii[idx1] = baseRadii[idx1] > 30 ? baseRadii[idx1] - 12 : baseRadii[idx1] + 12;
      }
      modRadii[idx2] = Math.max(15, Math.min(45, modRadii[idx2] + delta2));
      if (modRadii[idx2] === baseRadii[idx2]) {
        modRadii[idx2] = baseRadii[idx2] > 30 ? baseRadii[idx2] - 12 : baseRadii[idx2] + 12;
      }
      tweaks[idx1] = (f === 1 ? 0.14 : -0.12);
      foils.push(radiiToPoints(modRadii, tweaks));
    }

    var indexed = [
      { isTarget: true, points: targetPoints },
      { isTarget: false, points: foils[0] },
      { isTarget: false, points: foils[1] },
      { isTarget: false, points: foils[2] }
    ];
    var mixed = shuffle(indexed);
    var correctIndex = 0;
    var optionsPoints = [];
    for (var m = 0; m < mixed.length; m += 1) {
      optionsPoints.push(mixed[m].points);
      if (mixed[m].isTarget) correctIndex = m;
    }

    return {
      trialIndex: trialIndex,
      kind: "visual2d",
      flashMs: 800,
      maskMs: 360,
      delayMs: 2000,
      targetPoints: targetPoints,
      optionsPoints: optionsPoints,
      correctIndex: correctIndex
    };
  }

  function generateControlTrials() {
    return [
      buildStackControlTrial(0),
      buildStackControlTrial(1),
      buildVisual2DControlTrial(2),
      buildVisual2DControlTrial(3)
    ];
  }

  var Stimuli = {
    PHASES: PHASES,
    PROBES: PROBES,
    ABSTRACT_WORDS: ABSTRACT_WORDS,
    generateIsolationTrials: generateIsolationTrials,
    generateUpdatingTrials: generateUpdatingTrials,
    generateGatingTrials: generateGatingTrials,
    generateBindingTrials: generateBindingTrials,
    generateVigilanceConfig: generateVigilanceConfig,
    generateControlTrials: generateControlTrials
  };

  root.NeuroLab.Stimuli = Stimuli;
  root.Stimuli = Stimuli;
})();

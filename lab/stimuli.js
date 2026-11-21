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
      deficitName: "المسح الناتج عن المعالجة الجارية (TBRS Wipeout)",
      deficit: "انمساح المفردات المجردة في الخلفية فور انشغال القناة الجبهية بحساب أو استنتاج علائقي مقلوب",
      baseline: 13,
      baselineScore: 13,
      target: 80,
      norm: 80,
      normScore: 80,
      sem: 8.5,
      sDiff: 12.0,
      durationSec: 105,
      isControl: false,
      clinicalNote:
        "يطبق نموذج تقاسم الموارد الموقوت (TBRS — Barrouillet et al., 2007) ومعيار السعة المركبة (Conway et al., 2005): يقارن داخل الجلسة الواحدة بين سعة الحفظ المجرد الصافي بدون معالجة وبين البقاء بعد حساب أو استنتاج موقوت، مع فصل المسح الحقيقي عن إبدال الترتيب.",
      methodology:
        "يعرض جولة مرجعية صافية (4 مفردات مجردة منخفضة التصويرية متباعدة الجذور والمخارج يتبعها احتفاظ صامت) ثم 4 جولات مزدوجة الحمل بسقف زمني معاير للمعالجة (مسألتان حسابيتان من 6 خيارات ومسألتان علائقيتان مقلوبتا القطبية) مع بوابة تحقق من دقة المعالجة وفصل أخطاء المسح عن إبدال المواقع.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا: في كل جولة ستحفظ 4 مفردات مجردة بترتيبها، ثم تنفذ مهمة فاصلة واحدة، ثم تسترجع المفردات الأربع بالترتيب من الخانة 1 إلى 4.",
        "في الجولة الأولى الضابطة تحتفظ بالمفردات الأربع خلال صمت وجيز بلا حساب، وفي الجولات الأربع التالية تحل مسألة حسابية أو علائقية ضمن شريط الوقت المعاير دون إهمال صحة المسألة.",
        "في لوحة الاسترجاع انقر المفردات الأربع بترتيب ظهورها الأصلي، أو اضغط زر (تبخر العنصر) لأي خانة انمحت من الذهن."
      ],
      example:
        "مثال الهيكل: الحفظ (شرط ← غرض ← حكم ← عذر) ← المعالجة الفاصلة (7 × 4 - 9 = 19) ← الاسترجاع المرتب (1: شرط، 2: غرض، 3: حكم، 4: عذر)."
    },
    {
      id: "updating",
      order: 2,
      code: "P2 · UPD",
      title: "صمود الرف الجانبي وتحديث المتغيرات",
      shortTitle: "تحديث الرف الجانبي",
      shortLabel: "تحديث الرف الجانبي",
      region: "الحلقات الجبهية المخططية والتلفيف الجبهي السفلي (Frontostriatal + Left IFG)",
      deficitName: "هشاشة الرف الجانبي والتصاق القيمة القديمة (Proactive Interference)",
      deficit: "تفاوت صمود المتغير الموجود في بؤرة الانتباه اللحظية مقابل المتغيرات المنتظرة في الرف الجانبي",
      baseline: 44,
      baselineScore: 44,
      target: 85,
      norm: 85,
      normScore: 85,
      sem: 9.0,
      sDiff: 12.7,
      durationSec: 120,
      isControl: false,
      clinicalNote:
        "يطبق النموذج متمركز الدوائر للذاكرة العاملة (Oberauer, 2002) وكلفة تبديل البؤرة (Garavan, 1998): يعزل دقة المتغير النشط في البؤرة (Lag 0) عن صمود الرف الجانبي (Lag ≥ 1)، مع فصل متعامد رياضي بين التصاق القيمة القديمة وخلط المتغيرات والتبخر.",
      methodology:
        "ينفذ 5 جولات محكومة (جولتان بمتغيرين، وجولتان بثلاثة متغيرات مجردة، وجولة دلالية ثلاثية سريعة التفكك) بجدول تحديث عشوائي يدمج تكرار البؤرة وتبديلها لقياس كلفة التبديل بالمللي ثانية، وترتيب سؤال عشوائي يمنع تحيز الاسترجاع الثابت.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا: تُعرض القيم الابتدائية لجميع المتغيرات (من 1 إلى 9)، ثم تتوالى خطوات جمع أو طرح، وفي النهاية يُسأل عن القيمة النهائية لكل متغير بترتيب عشوائي.",
        "عند كل خطوة حدّث قيمة المتغير المذكور فقط في ذهنك وأبقِ المتغيرات الأخرى محفوظة في الرف الجانبي، ثم انتقل للخطوة التالية قبل انتهاء شريط الوقت.",
        "أدخل القيمة النهائية (1–9) لكل متغير يُسأل عنه، أو اضغط (تبخر الرقم في اللحظة الأخيرة) إن تلاشى العدد."
      ],
      example:
        "مثال الهيكل: البداية (ألف = 5، باء = 2) ← أضف 3 إلى ألف (8) ← أضف 4 إلى باء (6) ← اطرح 2 من ألف (6) ← الجواب النهائي: باء = 6، ألف = 6."
    },
    {
      id: "gating",
      order: 3,
      code: "P3 · GAT",
      title: "بوابة الإدخال وعقوبة التناوب اللحظي",
      shortTitle: "بوابة التناوب",
      shortLabel: "بوابة التناوب",
      region: "التلم الجبهي السفلي الأيسر وما قبل الحركية (Left IFS / Pre-SMA)",
      deficitName: "اختناق تبديل بوابة الإدخال بين فئتين (Input-Gating Bottleneck)",
      deficit: "تعطل التكتيل وسقوط المدخلات لحظة القراءة عند تناوب نمطين مختلفين مقابل سلامتها عند تكتلهما",
      baseline: 18,
      baselineScore: 18,
      target: 82,
      norm: 82,
      normScore: 82,
      sem: 8.2,
      sDiff: 11.6,
      durationSec: 110,
      isControl: false,
      clinicalNote:
        "يطبق نموذج بوابة الإدخال الجبهية المخططية (Chatham, Frank, & Badre, 2014؛ Kessler & Oberauer, 2014): يوازن اتجاه البدء (كلمات أولا مقابل أرقام أولا) لتحييد أثر الحداثة، ويستخرج عقوبة التناوب الطرحية الصافية.",
      methodology:
        "يعرض 5 جولات متوازنة الاتجاه بلا تلميح فئوي مسبق (جولتان متكتلتان من 6 عناصر باتجاهين متعاكسين، وجولة تناوب رباعية، وجولتا تناوب سداسيتان باتجاهين متعاكسين) مع أرقام خالية من المتتاليات الحسابية، ثم يفصل زمن التخطيط ودقة مسار الأرقام عن مسار الكلمات.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا (لا يبقى أي عنصر بلا دور): ستشاهد سلسلة تضم أرقاما وكلمات مجردة، ثم تخرج الأرقام كلها في المرحلة الأولى مرتبة تصاعديا، وتخرج الكلمات كلها في المرحلة الثانية مرتبة عكسيا.",
        "تظهر العناصر في مركز الشاشة واحدا تلو الآخر دون إعلان مسبق عن فئة العنصر القادم حتى تُختبر سرعة بوابة الفرز اللحظية.",
        "في المرحلة 1 انقر الأرقام من الأصغر إلى الأكبر، وفي المرحلة 2 انقر الكلمات من الأخيرة إلى الأولى، أو اضغط زر التبخر للخانة المفقودة."
      ],
      example:
        "مثال الهيكل: العرض (شرط ← 8 ← قصد ← 3) ← المخرج الأول للأرقام تصاعديا (3 ثم 8) ← المخرج الثاني للكلمات عكسيا (قصد ثم شرط)."
    },
    {
      id: "binding",
      order: 4,
      code: "P4 · BND",
      title: "ربط المؤشرات اللفظية بالعقد المنطقية",
      shortTitle: "ربط الاسم بالعقدة",
      shortLabel: "ربط الاسم بالعقدة",
      region: "القطب الجبهي والربط الجبهي الجداري (RLPFC / Role-Filler Binding)",
      deficitName: "انفكاك الاسم اللفظي عن العقدة المحسوبة عند انقلاب القطبية",
      deficit: "سلامة حساب البنية العلائقية مع تبخر اسم العلم الاعتباطي المعلّق على العقدة أثناء قلب القطبية",
      baseline: 50,
      baselineScore: 50,
      target: 88,
      norm: 88,
      normScore: 88,
      sem: 10.5,
      sDiff: 14.8,
      durationSec: 105,
      isControl: false,
      clinicalNote:
        "يطبق نماذج التكامل العلائقي في القطب الجبهي (Waltz et al., 1999؛ Halford et al., 1998) وانقلاب القطبية المعجمية (Clark, 1969): يحذف أي مقدمة زائدة تتيح الحل المختزل، ويختبر الاسترجاع من مصفوفة سداسية من نفس الحقل الدلالي مع تحقق بنيوي موضوعي من العقدة.",
      methodology:
        "ينفذ 6 سلاسل استنتاجية خالية من المقدمات الفائضة (سلسلتان خطيتان موحدتا القطبية، وسلسلتان ثلاثيتان مقلوبتا القطبية غير متسلسلتين، وسلسلتان رباعيتان من 3 مقدمات مقلوبة القطبية) مع 6 خيارات متجانسة دلاليا لمنع الحل بالحذف، وفحص تحقق بنيوي فوري عند الإبلاغ عن تبخر الاسم.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا: ستقرأ مقدمات مقارنة متتالية ضرورية جميعا للحل (تختفي كل جملة عند الانتقال)، ثم تُسأل عن صاحب رتبة محددة (الأعلى أو الأدنى أو الأوسط).",
        "اربط في ذهنك كل اسم بموقعه على محور الترتيب حتى لو انقلبت صيغة المقارنة بين الجمل (مثل أضخم وأصغر).",
        "اختر الاسم الصحيح من بين 6 مسميات من نفس المجال، وإن عرفت موقع العقدة المنطقي وتبخر اسمها اضغط زر (تبخر الاسم) وأجب عن سؤال التحقق البنيوي."
      ],
      example:
        "مثال الهيكل: (الفقه أصغر من التفسير) ← (الفقه أضخم من النحو) [لا توجد جملة ثالثة مكررة] ← الأصغر حجما من بين الكتب الستة هو: كتاب النحو."
    },
    {
      id: "vigilance",
      order: 5,
      code: "P5 · VIG",
      title: "عدّاد التسلسل الدوري ورصد النوم الموضعي",
      shortTitle: "عدّاد التسلسل واليقظة",
      shortLabel: "عدّاد التسلسل واليقظة",
      region: "الجزيرة الأمامية اليمنى وعدّاد التسلسل القطبي (rAI + RLPFC)",
      deficitName: "السهو التسلسلي وذيل الشرود الأسي وهفوات النوم الموضعي",
      deficit: "انطفاء عدّاد الدورات الرباعي على الطيار الآلي وتمدد الذيل الأسي للاستجابة (Ex-Gaussian Tau)",
      baseline: 56,
      baselineScore: 56,
      target: 90,
      norm: 90,
      normScore: 90,
      sem: 6.2,
      sDiff: 8.8,
      durationSec: 64,
      isControl: false,
      clinicalNote:
        "يدمج تتبع التسلسل القطبي بدون قرائن (Desrochers, Chatham, & Badre, 2015) مع المعيار الذهبي لليقظة الحركية (Basner & Dinges, 2011) وتفكيك التوزيع الأسي الغاوسي (Leth-Steensen et al., 2000): يحسب معامل الذيل الأسي للشرود (Tau) وتدهور الوقت ويعيد مزامنة الدورة ذاتيا لمنع تراكم خطأ الطور.",
      methodology:
        "يعرض 36 ومضة ضوئية (9 دورات رباعية) بفواصل غير إيقاعية متوازنة النصفين (1350–2250 مللي ثانية) لمنع المزامنة الحركية الآلية، مع التقاط لحظة اللمس الأولى (pointerdown) وعزل الاستجابات الاستباقية (<120ms) وتفكيك أخطاء تخطي الدورة على الطيار الآلي عن الإغلاق المبكر.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا: ستومض الحلقة الضوئية بفواصل زمنية غير إيقاعية؛ عدّ الومضات ذهنيا في دورات رباعية متكررة (1، 2، 3، 4 ثم تبدأ دورة جديدة من 1).",
        "اضغط فورا عند رؤية الومضة زر (خطوة 1 أو 2 أو 3) للومضات الثلاث الأولى، واضغط زر (إغلاق الدورة 4) عند الومضة الرابعة فقط لإعلان تمام الدورة.",
        "لا تضغط قبل ظهور الومضة؛ وإن شرد ذهنك وضاع الرقم اضغط (ضاع العدّاد — أعد من 1) لتبدأ الومضة القادمة من 1."
      ],
      example:
        "مثال دورة كاملة: ومضة 1 (خطوة) ← ومضة 2 (خطوة) ← ومضة 3 (خطوة) ← ومضة 4 (إغلاق الدورة 4) ← ومضة جديدة 1 (خطوة)."
    },
    {
      id: "control",
      order: 6,
      code: "C6 · CTL",
      title: "مرساة التحكم الضابطة للمحركات السليمة",
      shortTitle: "مرساة التحكم الضابطة",
      shortLabel: "مرساة التحكم الضابطة",
      region: "مخزن القواعد الأمامي والمسار البطني ثنائي الأبعاد (Rostral PFC + Ventral 2D)",
      deficitName: "مرجع الضبط السليم لعزل الإرهاق العام عن الخلل البؤري",
      deficit: "التحقق من سلامة مكدس الاستدعاء السببي والقاعدة الشرطية تحت المقاطعة والمخزن البصري المسطح (0.8s)",
      baseline: 98,
      baselineScore: 98,
      target: 90,
      norm: 90,
      normScore: 90,
      sem: 5.8,
      sDiff: 8.2,
      durationSec: 90,
      isControl: true,
      clinicalNote:
        "يطبق مبدأ التفكيك العصبي المزدوج (Shallice, 1988؛ Badre & D'Esposito, 2009؛ Luck & Vogel, 1997): يختبر 6 مهام سليمة مرجعيا (مكدس 3 طبقات، وقاعدة شرطية تقاطعها مسألة استرجاعية، و3 ومضات تناسب بصري صامت بغطاء تقنيع متعدد الاتجاهات) لفصل التحسن الانتقائي عن اليقظة العامة.",
      methodology:
        "يجمع 6 جولات عالية الدقة: جولتا مكدس هرمي من 3 طبقات بـ 6 خيارات، وجولة صمود قاعدة شرطية (IF-ELSE) مع متغير واحد ومقاطعة معجمية، و3 جولات للمخزن البصري الصامت (0.8 ثانية ومضة متزامنة الإطار + 0.4 ثانية قناع هندسي كثيف يلغي الأثر الشبكي + 2.2 ثانية احتفاظ صامت) تشمل المضلعات الملساء ونوافذ التناسب اللارمزية.",
      instructions: [
        "هيكل المخرجات المعلن مسبقا: يتكون هذا المسبار الضابط من 3 جولات قواعد ومكدس استنتاجي تليها 3 جولات التقاط بصري مسطح.",
        "في جولات المكدس والقاعدة الشرطية افتح الطبقات أو احفظ الشرط مع المتغير الواحد، وأجب عن المقاطعة العابرة إن ظهرت، ثم اختر النتيجة النهائية.",
        "في الجولات البصرية ثبّت نظرك على (+) والتقط التناسب الهندسي للشكل خلال ومضة 0.8 ثانية، ثم بعد القناع والصمت اختر المطابق الدقيق من 4 أشكال."
      ],
      example:
        "مثال القاعدة والمكدس: شرط (الزوجي × 2 والفردي - 1) مع مجموع (6) ← مقاطعة (الشهر قبل نوفمبر: أكتوبر) ← تطبيق الشرط على 6: الجواب 12."
    }
  ];

  // 136 strictly non-imageable, unambiguous abstract Arabic epistemic/logical/normative nouns
  // Purged of concrete homographs (no قلب، سلم، رسم، عقد، ملك، فرع، طرد، عين، باب، سهم، إلخ)
  var ABSTRACT_WORDS = [
    "شرط", "قصد", "عذر", "نفي", "سبب", "حكم", "أجل", "أصل",
    "قيد", "وعد", "غرض", "كسب", "خطأ", "أثر", "وصف", "عهد",
    "ظن", "شك", "حزم", "صبر", "رشد", "عدل", "فضل", "علم",
    "فهم", "رأي", "عزم", "نصح", "إذن", "منع", "دفع", "جزم",
    "فرض", "ندب", "حظر", "عفو", "صفح", "لوم", "عتب", "مدح",
    "ذم", "صدق", "بطل", "ربح", "خسر", "قرض", "مهر", "إرث",
    "نذر", "حلف", "فسخ", "رهن", "ضمان", "كفل", "صلح", "قياس",
    "علة", "مانع", "ركن", "واجب", "مباح", "لازم", "متعد", "مطلق",
    "مقيد", "عام", "خاص", "مجمل", "مبين", "ظاهر", "نسخ", "توقف",
    "سبر", "عكس", "نقض", "فرق", "حصر", "فصل", "نوع", "ذات",
    "شأن", "سمت", "نهج", "مسلك", "مذهب", "مقصد", "مناط", "مدار",
    "مآل", "مغزى", "مبنى", "معنى", "جدوى", "قرينة", "أمارة", "شبهة",
    "حجة", "برهان", "قضية", "رتبة", "مهلة", "نسبة", "غاية", "حكمة",
    "لزوم", "تعليل", "مفهوم", "منطوق", "تخصيص", "تعميم", "إحالة", "رجحان",
    "تعارض", "ترجيح", "تحقيق", "تنقيح", "ماهية", "كلية", "جزئية", "ضرورة",
    "إمكان", "ثبوت", "عدم", "حدوث", "بقاء", "زوال", "صحة", "فساد",
    "نفوذ", "وجوب", "حرمة", "كراهة", "رخصة", "عزيمة", "أداء", "تواتر"
  ];

  // 16 domain-coherent sets, each containing 6 distinct entities from the exact same semantic field
  // Prevents 3-option elimination cues and isolates true lexical role-filler binding
  var BINDING_TRIADS = [
    {
      items: ["كتاب الفقه", "كتاب النحو", "كتاب التفسير", "كتاب الحديث", "كتاب البلاغة", "كتاب العقيدة"],
      more: "أضخم حجما من",
      less: "أصغر حجما من",
      askMax: "أي الكتب المذكورة هو الأضخم حجما؟",
      askMin: "أي الكتب المذكورة هو الأصغر حجما؟",
      askMid: "أي الكتب الثلاثة المذكورة هو الأوسط حجما؟"
    },
    {
      items: ["علم الأصول", "علم المنطق", "علم المعاني", "علم الفرائض", "علم القراءات", "علم الاشتقاق"],
      more: "أكثر مباحث من",
      less: "أقل مباحث من",
      askMax: "أي العلوم المذكورة هو الأكثر مباحث؟",
      askMin: "أي العلوم المذكورة هو الأقل مباحث؟",
      askMid: "أي العلوم الثلاثة المذكورة هو الأوسط في عدد المباحث؟"
    },
    {
      items: ["عقد الإجارة", "عقد الوكالة", "عقد المضاربة", "عقد الكفالة", "عقد الجعالة", "عقد المزارعة"],
      more: "أوسع شروطا من",
      less: "أضيق شروطا من",
      askMax: "أي العقود المذكورة هو الأوسع شروطا؟",
      askMin: "أي العقود المذكورة هو الأضيق شروطا؟",
      askMid: "أي العقود الثلاثة المذكورة هو الأوسط في سعة الشروط؟"
    },
    {
      items: ["باب الطهارة", "باب الزكاة", "باب البيوع", "باب الوقف", "باب الشفعة", "باب القضاء"],
      more: "أطول فصولا من",
      less: "أقصر فصولا من",
      askMax: "أي الأبواب المذكورة هو الأطول فصولا؟",
      askMin: "أي الأبواب المذكورة هو الأقصر فصولا؟",
      askMid: "أي الأبواب الثلاثة المذكورة هو الأوسط طولا؟"
    },
    {
      items: ["رسالة الأخلاق", "رسالة العقود", "رسالة القضاء", "رسالة القياس", "رسالة الحدود", "رسالة السير"],
      more: "أقدم تدوينا من",
      less: "أحدث تدوينا من",
      askMax: "أي الرسائل المذكورة هي الأقدم تدوينا؟",
      askMin: "أي الرسائل المذكورة هي الأحدث تدوينا؟",
      askMid: "أي الرسائل الثلاث المذكورة هي الوسطى في زمن التدوين؟"
    },
    {
      items: ["معجم الألفاظ", "معجم المعاني", "معجم الفروق", "معجم الأبنية", "معجم الشواهد", "معجم المصطلح"],
      more: "أغزر شواهد من",
      less: "أندر شواهد من",
      askMax: "أي المعاجم المذكورة هو الأغزر شواهد؟",
      askMin: "أي المعاجم المذكورة هو الأندر شواهد؟",
      askMid: "أي المعاجم الثلاثة المذكورة هو الأوسط في غزارة الشواهد؟"
    },
    {
      items: ["مبحث العموم", "مبحث القياس", "مبحث النسخ", "مبحث المفهوم", "مبحث الإجماع", "مبحث التعارض"],
      more: "أشد تفريعا من",
      less: "أخف تفريعا من",
      askMax: "أي المباحث المذكورة هو الأشد تفريعا؟",
      askMin: "أي المباحث المذكورة هو الأخف تفريعا؟",
      askMid: "أي المباحث الثلاثة المذكورة هو الأوسط تفريعا؟"
    },
    {
      items: ["ديوان الحماسة", "ديوان الحكمة", "ديوان الوصف", "ديوان الرثاء", "ديوان الزهد", "ديوان الأمثال"],
      more: "أكبر أبياتا من",
      less: "أقل أبياتا من",
      askMax: "أي الدواوين المذكورة هو الأكبر أبياتا؟",
      askMin: "أي الدواوين المذكورة هو الأقل أبياتا؟",
      askMid: "أي الدواوين الثلاثة المذكورة هو الأوسط في عدد الأبيات؟"
    },
    {
      items: ["منهج السبر", "منهج الاستقراء", "منهج الترديد", "منهج التلازم", "منهج الاستدلال", "منهج التقسيم"],
      more: "أقوى حسما من",
      less: "أضعف حسما من",
      askMax: "أي المناهج المذكورة هو الأقوى حسما؟",
      askMin: "أي المناهج المذكورة هو الأضعف حسما؟",
      askMid: "أي المناهج الثلاثة المذكورة هو الأوسط قوة في الحسم؟"
    },
    {
      items: ["طبقة الشيوخ", "طبقة الأقران", "طبقة الأتباع", "طبقة الحفاظ", "طبقة النقاد", "طبقة الرواة"],
      more: "أعلى إسنادا من",
      less: "أنزل إسنادا من",
      askMax: "أي الطبقات المذكورة هي الأعلى إسنادا؟",
      askMin: "أي الطبقات المذكورة هي الأنزل إسنادا؟",
      askMid: "أي الطبقات الثلاث المذكورة هي الوسطى إسنادا؟"
    },
    {
      items: ["سجل النفقات", "سجل الواردات", "سجل الودائع", "سجل الأوقاف", "سجل العقود", "سجل العهدة"],
      more: "أعلى رصيدا من",
      less: "أدنى رصيدا من",
      askMax: "أي السجلات المذكورة هو الأعلى رصيدا؟",
      askMin: "أي السجلات المذكورة هو الأدنى رصيدا؟",
      askMid: "أي السجلات الثلاثة المذكورة هو الأوسط رصيدا؟"
    },
    {
      items: ["وحدة التحليل", "وحدة الفهرسة", "وحدة التدقيق", "وحدة التصنيف", "وحدة المراجعة", "وحدة التوثيق"],
      more: "أسرع معالجة من",
      less: "أبطأ معالجة من",
      askMax: "أي الوحدات المذكورة هي الأسرع معالجة؟",
      askMin: "أي الوحدات المذكورة هي الأبطأ معالجة؟",
      askMid: "أي الوحدات الثلاث المذكورة هي الوسطى سرعة؟"
    },
    {
      items: ["شرط الأداء", "شرط الضمان", "شرط الخيار", "شرط البراءة", "شرط التوثيق", "شرط الحلول"],
      more: "أعم أثرا من",
      less: "أخص أثرا من",
      askMax: "أي الشروط المذكورة هو الأعم أثرا؟",
      askMin: "أي الشروط المذكورة هو الأخص أثرا؟",
      askMid: "أي الشروط الثلاثة المذكورة هو الأوسط أثرا؟"
    },
    {
      items: ["مختصر الفروع", "مختصر القواعد", "مختصر الآداب", "مختصر الفروق", "مختصر الأحكام", "مختصر الأصول"],
      more: "أجزل عبارة من",
      less: "أوجز عبارة من",
      askMax: "أي المختصرات المذكورة هو الأجزل عبارة؟",
      askMin: "أي المختصرات المذكورة هو الأوجز عبارة؟",
      askMid: "أي المختصرات الثلاثة المذكورة هو الأوسط عبارة؟"
    },
    {
      items: ["خطة الصيف", "خطة الشتاء", "خطة الربيع", "خطة الخريف", "خطة المراجعة", "خطة التأسيس"],
      more: "أطول مدة من",
      less: "أقصر مدة من",
      askMax: "أي الخطط المذكورة هي الأطول مدة؟",
      askMin: "أي الخطط المذكورة هي الأقصر مدة؟",
      askMid: "أي الخطط الثلاث المذكورة هي الوسطى مدة؟"
    },
    {
      items: ["مسألة الإقالة", "مسألة الشفعة", "مسألة الحوالة", "مسألة المقاصة", "مسألة الإبراء", "مسألة الصلح"],
      more: "أكثر قيودا من",
      less: "أقل قيودا من",
      askMax: "أي المسائل المذكورة هي الأكثر قيودا؟",
      askMin: "أي المسائل المذكورة هي الأقل قيودا؟",
      askMid: "أي المسائل الثلاث المذكورة هي الوسطى في القيود؟"
    }
  ];

  var INTERRUPT_QUESTIONS = [
    {
      prompt: "سؤال مقاطعة فوري: ما الشهر الميلادي الذي يسبق شهر نوفمبر مباشرة؟",
      answer: "أكتوبر",
      options: ["أكتوبر", "سبتمبر", "ديسمبر", "أغسطس"]
    },
    {
      prompt: "سؤال مقاطعة فوري: ما اليوم الذي يسبق يوم الأربعاء مباشرة؟",
      answer: "الثلاثاء",
      options: ["الثلاثاء", "الخميس", "الاثنين", "الأحد"]
    },
    {
      prompt: "سؤال مقاطعة فوري: ما الشهر الهجري الذي يلي شهر شعبان مباشرة؟",
      answer: "رمضان",
      options: ["رمضان", "رجب", "شوال", "محرم"]
    },
    {
      prompt: "سؤال مقاطعة فوري: ما الفصل الذي يلي فصل الشتاء مباشرة؟",
      answer: "الربيع",
      options: ["الربيع", "الخريف", "الصيف", "الشتاء"]
    },
    {
      prompt: "سؤال مقاطعة فوري: ما الحرف الذي يلي حرف الفاء في الترتيب الهجائي (ف، ق، ك)؟",
      answer: "القاف",
      options: ["القاف", "الكاف", "الغين", "العين"]
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

  function normalizeArabicChar(ch) {
    if (ch === "أ" || ch === "إ" || ch === "آ") return "ا";
    if (ch === "ة") return "ه";
    if (ch === "ى") return "ي";
    return ch;
  }

  function extractConsonants(word) {
    var norm = String(word || "");
    var out = [];
    for (var i = 0; i < norm.length; i += 1) {
      var c = normalizeArabicChar(norm.charAt(i));
      if (c === "ا" || c === "و" || c === "ي" || c === " ") continue;
      if (out.indexOf(c) === -1) out.push(c);
    }
    return out;
  }

  function sharesTwoConsonants(wA, wB) {
    var cA = extractConsonants(wA);
    var cB = extractConsonants(wB);
    var shared = 0;
    for (var i = 0; i < cA.length; i += 1) {
      if (cB.indexOf(cA[i]) !== -1) shared += 1;
    }
    return shared >= 2;
  }

  function pickDistinctWords(count, excludeSet, strictPhonological) {
    var used = excludeSet || {};
    var enforceRootDisjoint = strictPhonological !== false;
    var usedFirst = {};
    var usedLast = {};
    var pool = shuffle(ABSTRACT_WORDS);
    var picked = [];

    for (var i = 0; i < pool.length && picked.length < count; i += 1) {
      var w = pool[i];
      if (used[w]) continue;
      // Tight articulatory duration control for targets (3..5 letters)
      if (enforceRootDisjoint && (w.length < 3 || w.length > 5)) continue;
      var first = normalizeArabicChar(w.charAt(0));
      var last = normalizeArabicChar(w.charAt(w.length - 1));
      if (usedFirst[first] || usedLast[last]) continue;

      if (enforceRootDisjoint) {
        var rootClash = false;
        for (var p = 0; p < picked.length; p += 1) {
          if (sharesTwoConsonants(w, picked[p])) {
            rootClash = true;
            break;
          }
        }
        if (rootClash) continue;
      }

      used[w] = true;
      usedFirst[first] = true;
      usedLast[last] = true;
      picked.push(w);
    }

    // Relax phonological constraint only if large distractor pool requested
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

  function buildMathProblem(optionCount) {
    var numOpts = typeof optionCount === "number" && optionCount >= 4 ? optionCount : 6;
    var a = randInt(4, 9);
    var b = randInt(3, 8);
    var prod = a * b;
    var addMode = Math.random() < 0.45;
    var c = addMode ? randInt(5, 14) : randInt(5, Math.min(16, prod - 6));
    var answer = addMode ? prod + c : prod - c;
    var prompt = addMode
      ? "اضرب " + a + " في " + b + " ثم أضف إلى الناتج " + c
      : "اضرب " + a + " في " + b + " ثم اطرح من الناتج " + c;

    // Diagnostically meaningful distractors: intermediate product, wrong sign, off-by-1/2, operand slip
    var candidates = [
      prod,
      addMode ? Math.max(3, prod - c) : prod + c,
      answer + 1,
      answer - 1,
      answer + 2,
      answer - 2,
      (a - 1) * b + (addMode ? c : -c),
      a * (b + 1) + (addMode ? c : -c),
      answer + 4,
      answer - 3
    ];
    var distractors = [];
    for (var i = 0; i < candidates.length && distractors.length < numOpts - 1; i += 1) {
      var val = candidates[i];
      if (val > 2 && val !== answer && distractors.indexOf(val) === -1) {
        distractors.push(val);
      }
    }
    while (distractors.length < numOpts - 1) {
      var extra = answer + randInt(-8, 9);
      if (extra > 2 && extra !== answer && distractors.indexOf(extra) === -1) {
        distractors.push(extra);
      }
    }

    var options = shuffle([String(answer)].concat(distractors.map(String)));
    return {
      prompt: prompt,
      options: options,
      answer: String(answer),
      deadlineMs: 10500
    };
  }

  function buildQuickLogicProblem(triad) {
    // Non-redundant 2-premise inverted-polarity transitive problem (zero redundant 3rd inequality!)
    var ordered = shuffle(triad.items).slice(0, 3); // ordered[0] < ordered[1] < ordered[2]
    var minItem = ordered[0];
    var midItem = ordered[1];
    var maxItem = ordered[2];
    var askMin = Math.random() < 0.5;

    // Scrambled non-chained pivot with polarity inversion: both premises MUST be integrated
    var variant = randInt(0, 1);
    var p1, p2;
    if (variant === 0) {
      p1 = midItem + " " + triad.less + " " + maxItem;
      p2 = midItem + " " + triad.more + " " + minItem;
    } else {
      p1 = minItem + " " + triad.less + " " + midItem;
      p2 = maxItem + " " + triad.more + " " + midItem;
    }
    if (Math.random() < 0.5) {
      var swapP = p1;
      p1 = p2;
      p2 = swapP;
    }

    var prompt =
      "إذا علمت أن " +
      p1 +
      "، وأن " +
      p2 +
      " — " +
      (askMin ? triad.askMin : triad.askMax);

    // 4 options (3 presented + 1 domain foil so guessing is 25% instead of 33%)
    var foil = triad.items.filter(function (x) {
      return ordered.indexOf(x) === -1;
    })[0];
    var opts = foil ? ordered.concat([foil]) : ordered.slice();

    return {
      prompt: prompt,
      options: shuffle(opts),
      answer: askMin ? minItem : maxItem,
      deadlineMs: 14500
    };
  }

  function generateIsolationTrials(count) {
    // Default: 5 trials = 1 pure unloaded calibration trial + 4 loaded trials (2 math + 2 logic)
    var total = typeof count === "number" && count > 0 ? count : 5;
    var sessionUsedWords = {};
    var shuffledTriads = shuffle(BINDING_TRIADS);
    var trials = [];

    for (var t = 0; t < total; t += 1) {
      var targetWords = pickDistinctWords(4, sessionUsedWords, true);
      var localSet = {};
      for (var w = 0; w < targetWords.length; w += 1) {
        localSet[targetWords[w]] = true;
      }
      var extraDistractors = pickDistinctWords(8, Object.assign({}, sessionUsedWords, localSet), false);
      var pool = shuffle(targetWords.concat(extraDistractors));

      // If count >= 5, trial 0 is pure immediate reference; remaining alternate math & logic
      var isPure = total >= 5 && t === 0;
      if (isPure) {
        trials.push({
          trialIndex: t,
          words: targetWords,
          distractorPool: pool,
          taskType: "pure",
          retentionMs: 2200,
          wordExposureMs: 900,
          wordIsiMs: 180,
          taskPrompt: "",
          taskOptions: [],
          taskAnswer: "",
          deadlineMs: 0
        });
      } else {
        var loadedIdx = total >= 5 ? t - 1 : t;
        var isMath = loadedIdx % 2 === 0;
        var task = isMath
          ? buildMathProblem(6)
          : buildQuickLogicProblem(shuffledTriads[loadedIdx % shuffledTriads.length]);

        trials.push({
          trialIndex: t,
          words: targetWords,
          distractorPool: pool,
          taskType: isMath ? "math" : "logic",
          retentionMs: 0,
          wordExposureMs: 900,
          wordIsiMs: 180,
          taskPrompt: task.prompt,
          taskOptions: task.options,
          taskAnswer: task.answer,
          deadlineMs: task.deadlineMs
        });
      }
    }
    return trials;
  }

  function buildRandomUpdatingSchedule(vars, stepCount) {
    // Generates randomized variable update schedules with guaranteed coverage,
    // peripheral lag >= 1, and controlled Focus-Repeat vs Focus-Switch transitions
    for (var tries = 0; tries < 80; tries += 1) {
      var sched = [];
      if (vars.length === 2 && stepCount === 4) {
        var perm2 = shuffle(vars);
        var templates2 = [
          [perm2[0], perm2[1], perm2[1], perm2[0]], // switch, repeat, switch
          [perm2[0], perm2[0], perm2[1], perm2[0]], // repeat, switch, switch
          [perm2[0], perm2[1], perm2[0], perm2[1]]  // pure alternating switch
        ];
        sched = templates2[randInt(0, templates2.length - 1)].slice();
      } else {
        var perm3 = shuffle(vars);
        var templates3 = [
          [perm3[0], perm3[1], perm3[1], perm3[2], perm3[0]], // includes 1 repeat + 3 switches, perm3[1] & perm3[2] peripheral at end
          [perm3[0], perm3[1], perm3[2], perm3[0], perm3[1]], // 4 switches, perm3[0] & perm3[1] updated twice
          [perm3[0], perm3[0], perm3[1], perm3[2], perm3[1]], // 1 repeat + 3 switches, perm3[0] long lag
          [perm3[0], perm3[1], perm3[2], perm3[2], perm3[0]]  // 1 repeat + 3 switches
        ];
        sched = templates3[randInt(0, templates3.length - 1)].slice();
        while (sched.length < stepCount) {
          sched.push(perm3[sched.length % perm3.length]);
        }
      }
      if (sched.length === stepCount) return sched;
    }
    return vars.length === 2
      ? [vars[0], vars[1], vars[1], vars[0]]
      : [vars[0], vars[1], vars[2], vars[0], vars[1]];
  }

  function buildConstrainedUpdatingTrial(trialIndex, vars, stepCount, semanticUnits) {
    for (var attempt = 0; attempt < 500; attempt += 1) {
      var digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      var initial = {};
      var current = {};
      var historyByVar = {};
      var lastStepUpdated = {};

      for (var i = 0; i < vars.length; i += 1) {
        var v = vars[i];
        initial[v] = digits[i];
        current[v] = digits[i];
        historyByVar[v] = [];
        lastStepUpdated[v] = -1;
      }

      var schedule = buildRandomUpdatingSchedule(vars, stepCount);
      var steps = [];
      var ok = true;

      for (var s = 0; s < stepCount; s += 1) {
        var targetVar = schedule[s];
        var isRepeatFocus = s > 0 && schedule[s] === schedule[s - 1];
        var oldVal = current[targetVar];
        var candidates = [];

        for (var nextVal = 1; nextVal <= 9; nextVal += 1) {
          if (nextVal === oldVal) continue;
          var deltaCheck = Math.abs(nextVal - oldVal);
          if (deltaCheck < 1 || deltaCheck > 5) continue;

          var collision = false;
          for (var u = 0; u < vars.length; u += 1) {
            if (vars[u] !== targetVar && current[vars[u]] === nextVal) {
              collision = true;
              break;
            }
          }
          if (collision) continue;

          var futureUpdates = false;
          for (var f = s + 1; f < stepCount; f += 1) {
            if (schedule[f] === targetVar) {
              futureUpdates = true;
              break;
            }
          }
          if (!futureUpdates && nextVal === initial[targetVar]) continue;
          if (!futureUpdates && historyByVar[targetVar].indexOf(nextVal) !== -1) continue;

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
        lastStepUpdated[targetVar] = s;

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
          stepIndex: s,
          varName: targetVar,
          transition: s === 0 ? "first" : isRepeatFocus ? "repeat" : "switch",
          op: op,
          delta: absDelta,
          prevVal: oldVal,
          newVal: chosen,
          text: text,
          snapshot: Object.assign({}, current)
        });
      }

      if (!ok) continue;

      // Validate distinct finals AND orthogonal stale-vs-swap sets (whenever attempt < 380)
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
      if (!validFinal) continue;

      if (attempt < 380) {
        var orthogonal = true;
        for (var a = 0; a < vars.length; a += 1) {
          var vA = vars[a];
          var staleSet = historyByVar[vA];
          for (var b = 0; b < vars.length; b += 1) {
            if (a === b) continue;
            if (staleSet.indexOf(current[vars[b]]) !== -1) {
              orthogonal = false;
              break;
            }
          }
          if (!orthogonal) break;
        }
        if (!orthogonal) continue;
      }

      // Compute focus lag per variable: 0 = in Focus of Attention on final step; >=1 = Peripheral Shelf
      var lagByVar = {};
      var peripheralVars = [];
      var inFocusVar = schedule[stepCount - 1];
      for (var lv = 0; lv < vars.length; lv += 1) {
        var vKey = vars[lv];
        var lag = (stepCount - 1) - lastStepUpdated[vKey];
        lagByVar[vKey] = lag;
        if (lag >= 1) peripheralVars.push(vKey);
      }

      // Randomize query order, probing peripheral shelf variables first on alternating trials
      var queryOrder = shuffle(vars);
      if (trialIndex % 2 === 0 && peripheralVars.length > 0) {
        var firstPeriph = peripheralVars[randInt(0, peripheralVars.length - 1)];
        queryOrder = [firstPeriph].concat(
          shuffle(vars.filter(function (x) { return x !== firstPeriph; }))
        );
      }

      return {
        trialIndex: trialIndex,
        vars: vars.slice(),
        queryOrder: queryOrder,
        inFocusVar: inFocusVar,
        lagByVar: lagByVar,
        units: semanticUnits || null,
        stepDeadlineMs: 8500,
        initDeadlineMs: 9500,
        initial: initial,
        steps: steps,
        final: current,
        historyByVar: historyByVar
      };
    }

    // Safe orthogonal fallback
    return {
      trialIndex: trialIndex,
      vars: ["ألف", "باء"],
      queryOrder: ["ألف", "باء"],
      inFocusVar: "باء",
      lagByVar: { "ألف": 1, "باء": 0 },
      units: null,
      stepDeadlineMs: 8500,
      initDeadlineMs: 9500,
      initial: { "ألف": 5, "باء": 2 },
      steps: [
        { stepIndex: 0, varName: "ألف", transition: "first", op: "+", delta: 3, prevVal: 5, newVal: 8, text: "أضف 3 إلى ألف", snapshot: { "ألف": 8, "باء": 2 } },
        { stepIndex: 1, varName: "باء", transition: "switch", op: "+", delta: 5, prevVal: 2, newVal: 7, text: "أضف 5 إلى باء", snapshot: { "ألف": 8, "باء": 7 } },
        { stepIndex: 2, varName: "ألف", transition: "switch", op: "-", delta: 2, prevVal: 8, newVal: 6, text: "اطرح 2 من ألف", snapshot: { "ألف": 6, "باء": 7 } },
        { stepIndex: 3, varName: "باء", transition: "switch", op: "-", delta: 3, prevVal: 7, newVal: 4, text: "اطرح 3 من باء", snapshot: { "ألف": 6, "باء": 4 } }
      ],
      final: { "ألف": 6, "باء": 4 },
      historyByVar: { "ألف": [5, 8], "باء": [2, 7] }
    };
  }

  function generateUpdatingTrials(count) {
    // Default: 5 trials (13 variable queries) for higher psychometric reliability
    var total = typeof count === "number" && count > 0 ? count : 5;
    var specs = [
      { vars: ["ألف", "باء"], steps: 4, units: null },
      { vars: ["ألف", "باء"], steps: 4, units: null },
      { vars: ["ألف", "باء", "جيم"], steps: 5, units: null },
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
    // Excludes consecutive runs (e.g. 4,5,6) AND constant-step arithmetic progressions (e.g. 2,4,6 or 3,6,9)
    for (var attempt = 0; attempt < 120; attempt += 1) {
      var cand = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count);
      var sorted = cand.slice().sort(function (a, b) {
        return a - b;
      });
      var hasPattern = false;
      if (count >= 3) {
        for (var i = 0; i < sorted.length - 2; i += 1) {
          var d1 = sorted[i + 1] - sorted[i];
          var d2 = sorted[i + 2] - sorted[i + 1];
          if (d1 === d2) {
            hasPattern = true;
            break;
          }
        }
      } else if (count === 2) {
        if (Math.abs(sorted[1] - sorted[0]) === 1) {
          hasPattern = true;
        }
      }
      if (!hasPattern) return cand;
    }
    return [8, 2, 5].slice(0, count);
  }

  function generateGatingTrials(count) {
    // 5 counterbalanced trials canceling modality recency bias (W-first vs N-first in both Blocked & Alternating)
    var total = typeof count === "number" && count > 0 ? count : 5;
    var usedWords = {};
    var blueprints = [
      { mode: "blocked", pairs: 3, startKind: "word" },
      { mode: "alternating", pairs: 2, startKind: "word" },
      { mode: "alternating", pairs: 3, startKind: "word" },
      { mode: "blocked", pairs: 3, startKind: "num" },
      { mode: "alternating", pairs: 3, startKind: "num" }
    ];

    var trials = [];
    for (var t = 0; t < total; t += 1) {
      var bp = blueprints[t % blueprints.length];
      var words = pickDistinctWords(bp.pairs, usedWords, true);
      var nums = pickNonConsecutiveDigits(bp.pairs);
      var sequence = [];

      if (bp.mode === "blocked") {
        if (bp.startKind === "word") {
          for (var w = 0; w < words.length; w += 1) sequence.push({ kind: "word", value: words[w] });
          for (var n = 0; n < nums.length; n += 1) sequence.push({ kind: "num", value: String(nums[n]) });
        } else {
          for (var n2 = 0; n2 < nums.length; n2 += 1) sequence.push({ kind: "num", value: String(nums[n2]) });
          for (var w2 = 0; w2 < words.length; w2 += 1) sequence.push({ kind: "word", value: words[w2] });
        }
      } else {
        for (var p = 0; p < bp.pairs; p += 1) {
          if (bp.startKind === "word") {
            sequence.push({ kind: "word", value: words[p] });
            sequence.push({ kind: "num", value: String(nums[p]) });
          } else {
            sequence.push({ kind: "num", value: String(nums[p]) });
            sequence.push({ kind: "word", value: words[p] });
          }
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
      var extraWords = pickDistinctWords(12 - words.length, localExclude, false);
      var wordPool = shuffle(words.concat(extraWords));

      trials.push({
        trialIndex: t,
        mode: bp.mode,
        startKind: bp.startKind,
        pairCount: bp.pairs,
        itemExposureMs: 950,
        itemIsiMs: 190,
        sequence: sequence,
        expectedNumbersAsc: expectedNumbersAsc,
        expectedWordsRev: expectedWordsRev,
        wordPool: wordPool
      });
    }
    return trials;
  }

  function findFirstPremiseMention(premises, entityName) {
    for (var i = 0; i < premises.length; i += 1) {
      if (premises[i].indexOf(entityName) !== -1) return i;
    }
    return 0;
  }

  function generateBindingTrials(count) {
    // 6 strictly non-redundant relational trials (zero redundant inequalities!)
    // Options always display all 6 same-domain entities (3-4 presented + 2-3 unpresented domain foils)
    var total = typeof count === "number" && count > 0 ? count : 6;
    var triads = shuffle(BINDING_TRIADS);
    var trials = [];

    // Interleaved condition blueprint: linear, flipped3, linear, flipped3, flipped4, flipped4
    var specs = [
      { polarity: "linear", entityCount: 3, targetRole: "min" },
      { polarity: "flipped", entityCount: 3, targetRole: "max" },
      { polarity: "linear", entityCount: 3, targetRole: "max" },
      { polarity: "flipped", entityCount: 3, targetRole: "mid" },
      { polarity: "flipped", entityCount: 4, targetRole: "min" },
      { polarity: "flipped", entityCount: 4, targetRole: "max" }
    ];

    for (var t = 0; t < total; t += 1) {
      var triad = triads[t % triads.length];
      var spec = specs[t % specs.length];
      var shuffledAll = shuffle(triad.items); // 6 domain items
      var presented = shuffledAll.slice(0, spec.entityCount); // latent ascending: presented[0] < presented[1] < ...
      var foils = shuffledAll.slice(spec.entityCount);

      var premises = [];
      var answer = "";
      var question = "";
      var oppositeEndEntity = "";

      if (spec.entityCount === 3) {
        var eMin = presented[0];
        var eMid = presented[1];
        var eMax = presented[2];

        if (spec.polarity === "linear") {
          // Chained consistent polarity (2 necessary premises, zero redundant link!)
          if (t % 4 === 0) {
            premises = [
              eMax + " " + triad.more + " " + eMid,
              eMid + " " + triad.more + " " + eMin
            ];
          } else {
            premises = [
              eMin + " " + triad.less + " " + eMid,
              eMid + " " + triad.less + " " + eMax
            ];
          }
        } else {
          // Scrambled non-chained pivot + Polarity Inversion (Johnson-Laird Figure 2/3)
          if (t % 2 === 1) {
            premises = [
              eMid + " " + triad.less + " " + eMax,
              eMid + " " + triad.more + " " + eMin
            ];
          } else {
            premises = [
              eMin + " " + triad.less + " " + eMid,
              eMax + " " + triad.more + " " + eMid
            ];
          }
          if (Math.random() < 0.5) {
            premises.reverse();
          }
        }

        if (spec.targetRole === "min") {
          question = triad.askMin;
          answer = eMin;
          oppositeEndEntity = eMax;
        } else if (spec.targetRole === "max") {
          question = triad.askMax;
          answer = eMax;
          oppositeEndEntity = eMin;
        } else {
          question = triad.askMid;
          answer = eMid;
          oppositeEndEntity = eMin;
        }
      } else {
        // 4-entity 3-premise non-redundant inverted-polarity chain: E0 < E1 < E2 < E3
        var n0 = presented[0];
        var n1 = presented[1];
        var n2 = presented[2];
        var n3 = presented[3];

        var rawPremises4 =
          t % 2 === 0
            ? [
                n2 + " " + triad.more + " " + n1,
                n1 + " " + triad.more + " " + n0,
                n2 + " " + triad.less + " " + n3
              ]
            : [
                n1 + " " + triad.less + " " + n2,
                n3 + " " + triad.more + " " + n2,
                n0 + " " + triad.less + " " + n1
              ];

        // Ensure target extreme appears in only ONE premise so structural check is 100% unambiguous
        premises = rawPremises4;
        if (spec.targetRole === "min") {
          question = triad.askMin;
          answer = n0;
          oppositeEndEntity = n3;
        } else {
          question = triad.askMax;
          answer = n3;
          oppositeEndEntity = n0;
        }
      }

      // Build objective structural verification question (for 2-step Lexical Pointer Decay check)
      var ansPremiseIdx = findFirstPremiseMention(premises, answer);
      var structuralLabels = ["المقدمة 1", "المقدمة 2", "المقدمة 3"].slice(0, premises.length);
      var structuralCheckPrompt =
        spec.targetRole === "mid"
          ? "تحقق بنيوي من العقدة المحورية: هل ذُكرت العقدة الوسطى في كلتا المقدمتين معا أم في مقدمة واحدة فقط؟"
          : "تحقق بنيوي من العقدة الفائزة (بدون اسمها): في أي مقدمة ورد ذكر هذه العقدة الطرفية؟";
      var structuralOptions =
        spec.targetRole === "mid"
          ? ["ذُكرت في كلتا المقدمتين (عقدة الربط)", "ذُكرت في مقدمة واحدة فقط"]
          : structuralLabels;
      var structuralAnswer =
        spec.targetRole === "mid"
          ? "ذُكرت في كلتا المقدمتين (عقدة الربط)"
          : structuralLabels[ansPremiseIdx];

      trials.push({
        trialIndex: t,
        polarity: spec.polarity,
        entityCount: spec.entityCount,
        targetRole: spec.targetRole,
        presentedEntities: presented,
        foilEntities: foils,
        entities: shuffle(shuffledAll), // all 6 domain options!
        premises: premises,
        question: question,
        answer: answer,
        oppositeEndEntity: oppositeEndEntity,
        midEntity: presented[1],
        structuralCheck: {
          prompt: structuralCheckPrompt,
          options: structuralOptions,
          answer: structuralAnswer
        }
      });
    }
    return trials;
  }

  function generateVigilanceConfig() {
    // 36 pulses = 9 full 4-beat cycles
    // Non-rhythmic stratified foreperiods (1350..2250 ms, mean 1750 ms) balanced across Halves 1 & 2
    // Abolishes cerebellar rhythmic tapping entrainment and enables clean Time-on-Task Vigilance Decrement
    var baseStrata = [
      1360, 1440, 1520, 1600, 1680, 1750, 1820, 1900, 1980,
      2060, 2140, 2220, 1400, 1560, 1720, 1860, 2020, 2180
    ];
    var half1 = shuffle(baseStrata);
    var half2 = shuffle(baseStrata);
    var intervalsMs = half1.concat(half2);

    return {
      totalPulses: 36,
      cycleLength: 4,
      baseIntervalMs: 1750,
      jitterMs: 430,
      intervalsMs: intervalsMs,
      flashDurationMs: 240,
      anticipationMs: 120,
      lapseThresholdMs: 900
    };
  }

  function buildStackControlTrial(trialIndex) {
    var leafA = randInt(1, 4);
    var leafB = randInt(1, 4);
    var leafSum = leafA + leafB; // 2..8
    var midFactor = randInt(2, 4);
    var midProd = midFactor * leafSum; // 4..32
    var rootAddMode = trialIndex % 2 === 1;
    var rootBase = rootAddMode ? randInt(4, 13) : midProd + randInt(3, 12);
    var answer = rootAddMode ? rootBase + midProd : rootBase - midProd;

    var frame1Text = rootAddMode
      ? "الأصل المعلّق: احفظ العدد " + rootBase + " وعملية الجمع (ستضيف إلى " + rootBase + " ناتج الفرع الأول)."
      : "الأصل المعلّق: احفظ العدد " + rootBase + " وعملية الطرح (ستطرح من " + rootBase + " ناتج الفرع الأول).";
    var frame2Text =
      "الفرع الأول المعلّق: احفظ العدد " + midFactor + " وعملية الضرب (ستضرب " + midFactor + " في ناتج الفرع الثاني).";
    var frame3Text = "الفرع الثاني المباشر: اجمع " + leafA + " مع " + leafB + ".";
    var closeText = "عوّض صعودا من الفرع الثاني إلى الفرع الأول ثم الأصل واختر النتيجة النهائية:";

    // 6 plausible options (16.7% chance rate instead of 25%)
    var distractorCandidates = [
      midProd,
      Math.max(1, Math.abs(rootBase - leafSum)),
      rootAddMode ? Math.max(1, rootBase - midProd) : rootBase + midProd,
      answer + midFactor,
      Math.max(1, answer - 2),
      answer + 2,
      rootBase + leafSum,
      answer + 4
    ];
    var distractors = [];
    for (var i = 0; i < distractorCandidates.length && distractors.length < 5; i += 1) {
      var d = distractorCandidates[i];
      if (d > 0 && d !== answer && distractors.indexOf(d) === -1) {
        distractors.push(d);
      }
    }
    while (distractors.length < 5) {
      var extra = answer + randInt(1, 9);
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

  function buildRuleInterruptControlTrial(trialIndex) {
    // Replicates Experiment 5b: IF-ELSE conditional rule + single active accumulator + semantic interruption
    var variant = randInt(0, 1);
    var baseAdd = randInt(3, 6);
    var dividend = randInt(13, 19);
    var divisor = 5;
    var rem = dividend % divisor;
    if (rem === 0) {
      dividend += 2;
      rem = dividend % divisor;
    }
    var accum = baseAdd + rem; // 4..10
    var isEven = accum % 2 === 0;

    var ruleText, answer, wrongBranchVal;
    if (variant === 0) {
      ruleText = "القاعدة الشرطية المحفوظة: إن كان المجموع زوجيا فاضربه في 2، وإن كان فرديا فاطرح منه 1.";
      answer = isEven ? accum * 2 : accum - 1;
      wrongBranchVal = isEven ? accum - 1 : accum * 2;
    } else {
      ruleText = "القاعدة الشرطية المحفوظة: إن كان المجموع زوجيا فاطرح منه 2، وإن كان فرديا فاضربه في 3.";
      answer = isEven ? accum - 2 : accum * 3;
      wrongBranchVal = isEven ? accum * 3 : Math.max(1, accum - 2);
    }

    var calcText =
      "احسب في ذهنك متغيرا واحدا فقط: اجمع " +
      baseAdd +
      " مع باقي قسمة " +
      dividend +
      " على " +
      divisor +
      " وأمسك الناتج في ذهنك.";

    var intr = INTERRUPT_QUESTIONS[randInt(0, INTERRUPT_QUESTIONS.length - 1)];
    var distractors = [];
    var cands = [wrongBranchVal, accum, answer + 2, Math.max(1, answer - 2), accum + baseAdd, answer + 4];
    for (var i = 0; i < cands.length && distractors.length < 5; i += 1) {
      var v = cands[i];
      if (v > 0 && v !== answer && distractors.indexOf(v) === -1) {
        distractors.push(v);
      }
    }
    while (distractors.length < 5) {
      var ex = answer + randInt(1, 7);
      if (ex !== answer && distractors.indexOf(ex) === -1) distractors.push(ex);
    }

    return {
      trialIndex: trialIndex,
      kind: "rule_interrupt",
      ruleText: ruleText,
      calcText: calcText,
      interruptPrompt: intr.prompt,
      interruptAnswer: intr.answer,
      interruptOptions: shuffle(intr.options),
      applyPrompt: "عد الآن إلى العدد الذي أمسكته قبل المقاطعة وطبّق عليه القاعدة الشرطية المحفوظة:",
      answer: answer,
      options: shuffle([answer].concat(distractors))
    };
  }

  function buildVisual2DPolygonTrial(trialIndex) {
    var numVertices = 7;
    var baseAngles = [];
    var offsetAngle = randInt(8, 42) * (Math.PI / 180);
    for (var i = 0; i < numVertices; i += 1) {
      var ang = offsetAngle + (i * 2 * Math.PI) / numVertices + randInt(-5, 5) * (Math.PI / 180);
      baseAngles.push(ang);
    }
    var baseRadii = [];
    for (var r = 0; r < numVertices; r += 1) {
      baseRadii.push(randInt(25, 40));
    }

    function radiiToPoints(radii, angleTweaks) {
      var pts = [];
      for (var k = 0; k < numVertices; k += 1) {
        var a = baseAngles[k] + (angleTweaks ? angleTweaks[k] : 0);
        var rad = radii[k];
        var x = Math.round((50 + rad * Math.cos(a)) * 10) / 10;
        var y = Math.round((50 + rad * Math.sin(a)) * 10) / 10;
        pts.push([Math.max(9, Math.min(91, x)), Math.max(9, Math.min(91, y))]);
      }
      return pts;
    }

    var targetPoints = radiiToPoints(baseRadii, null);
    var foils = [];

    // Controlled Z2xZ2 metric perturbations (~10-12 units) preserving global outline category
    for (var f = 0; f < 3; f += 1) {
      var modRadii = baseRadii.slice();
      var tweaks = [0, 0, 0, 0, 0, 0, 0];
      var idx1 = (f * 2 + 1) % numVertices;
      var idx2 = (idx1 + 3) % numVertices;
      var dir1 = f === 0 ? 1 : f === 1 ? -1 : 1;
      var dir2 = f === 0 ? -1 : f === 1 ? 1 : 1;
      var mag = randInt(9, 12);

      var cand1 = modRadii[idx1] + dir1 * mag;
      if (cand1 > 44 || cand1 < 17) cand1 = modRadii[idx1] - dir1 * mag;
      modRadii[idx1] = Math.max(17, Math.min(44, cand1));

      var cand2 = modRadii[idx2] + dir2 * mag;
      if (cand2 > 44 || cand2 < 17) cand2 = modRadii[idx2] - dir2 * mag;
      modRadii[idx2] = Math.max(17, Math.min(44, cand2));

      tweaks[idx1] = f === 1 ? 0.11 : -0.10;
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
      visualSubtype: "polygon",
      flashMs: 800,
      maskMs: 400,
      delayMs: 2200,
      maskSeed: randInt(100, 9999),
      targetPoints: targetPoints,
      optionsPoints: optionsPoints,
      correctIndex: correctIndex
    };
  }

  function buildVisual2DWindowTrial(trialIndex) {
    // Replicates dvsdVerification Experiment 13: Pure Non-Symbolic Z2xZ2 Asymmetric Proportion Window
    // All 4 options share the EXACT same verbal/directional topology (e.g. "vertical line slightly right, horizontal upper")
    // Differing ONLY in metric aspect ratio and partition cross-ratio by ~13%
    var rightSide = Math.random() < 0.5;
    var upperSide = Math.random() < 0.5;

    var baseW = randInt(58, 74);
    var baseH = randInt(56, 72);
    var splitX = rightSide ? randInt(58, 66) : randInt(34, 42); // % within frame
    var splitY = upperSide ? randInt(33, 41) : randInt(59, 67); // % within frame

    var dSplit = 11; // keeps all foils strictly on the SAME side of 50% center (identical verbal label!)
    var sXAlt = rightSide
      ? (splitX + dSplit <= 79 ? splitX + dSplit : splitX - dSplit)
      : (splitX - dSplit >= 21 ? splitX - dSplit : splitX + dSplit);
    var sYAlt = upperSide
      ? (splitY - dSplit >= 21 ? splitY - dSplit : splitY + dSplit)
      : (splitY + dSplit <= 79 ? splitY + dSplit : splitY - dSplit);

    // Z2 x Z2 factorial structure: (splitX vs sXAlt) x (splitY vs sYAlt)
    var specs = [
      { isTarget: true, w: baseW, h: baseH, sx: splitX, sy: splitY },
      { isTarget: false, w: baseW, h: baseH, sx: sXAlt, sy: splitY },
      { isTarget: false, w: baseW, h: baseH, sx: splitX, sy: sYAlt },
      { isTarget: false, w: baseW, h: baseH, sx: sXAlt, sy: sYAlt }
    ];

    var mixed = shuffle(specs);
    var correctIndex = 0;
    var optionsSpecs = [];
    for (var i = 0; i < mixed.length; i += 1) {
      optionsSpecs.push(mixed[i]);
      if (mixed[i].isTarget) correctIndex = i;
    }

    return {
      trialIndex: trialIndex,
      kind: "visual2d",
      visualSubtype: "window",
      flashMs: 800,
      maskMs: 400,
      delayMs: 2200,
      maskSeed: randInt(100, 9999),
      targetWindow: specs[0],
      optionsWindows: optionsSpecs,
      // Provide fallback polygon arrays so any external consumer inspecting targetPoints never breaks
      targetPoints: [[20, 20], [80, 20], [80, 80], [20, 80]],
      optionsPoints: [[], [], [], []],
      correctIndex: correctIndex
    };
  }

  function generateControlTrials() {
    // 6 precision-calibrated positive-control trials
    return [
      buildStackControlTrial(0),
      buildStackControlTrial(1),
      buildRuleInterruptControlTrial(2),
      buildVisual2DPolygonTrial(3),
      buildVisual2DWindowTrial(4),
      buildVisual2DPolygonTrial(5)
    ];
  }

  function generateWarmupTrial(probeId) {
    if (probeId === "isolation") {
      return {
        words: ["شرط", "قصد", "حكم"],
        distractorPool: shuffle(["شرط", "قصد", "حكم", "عذر", "مناط", "لزوم"]),
        taskPrompt: "اضرب 3 في 4 ثم اطرح من الناتج 2",
        taskOptions: shuffle(["10", "14", "12", "9"]),
        taskAnswer: "10"
      };
    }
    if (probeId === "updating") {
      return buildConstrainedUpdatingTrial(0, ["ألف", "باء"], 3, null);
    }
    if (probeId === "gating") {
      return {
        sequence: [
          { kind: "word", value: "غرض" },
          { kind: "num", value: "7" },
          { kind: "word", value: "عذر" },
          { kind: "num", value: "3" }
        ],
        expectedNumbersAsc: ["3", "7"],
        expectedWordsRev: ["عذر", "غرض"],
        wordPool: shuffle(["غرض", "عذر", "شرط", "مآل", "نهج", "وعد"])
      };
    }
    if (probeId === "binding") {
      return generateBindingTrials(2)[1];
    }
    if (probeId === "vigilance") {
      return {
        totalPulses: 8,
        cycleLength: 4,
        intervalsMs: [1550, 1850, 1450, 1950, 1650, 2050, 1500, 1800],
        flashDurationMs: 240,
        anticipationMs: 120,
        lapseThresholdMs: 900
      };
    }
    return buildStackControlTrial(0);
  }

  var Stimuli = {
    PHASES: PHASES,
    PROBES: PROBES,
    ABSTRACT_WORDS: ABSTRACT_WORDS,
    BINDING_TRIADS: BINDING_TRIADS,
    generateIsolationTrials: generateIsolationTrials,
    generateUpdatingTrials: generateUpdatingTrials,
    generateGatingTrials: generateGatingTrials,
    generateBindingTrials: generateBindingTrials,
    generateVigilanceConfig: generateVigilanceConfig,
    generateControlTrials: generateControlTrials,
    generateWarmupTrial: generateWarmupTrial
  };

  root.NeuroLab.Stimuli = Stimuli;
  root.Stimuli = Stimuli;
})();

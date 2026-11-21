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
      durationSec: 115,
      isControl: false,
      clinicalNote:
        "يطبق نموذج تقاسم الموارد الموقوت (TBRS — Barrouillet et al., 2007) ومعيار السعة المركبة (Conway et al., 2005): يوازن موضع جولتي السعة الصافية مقابل 4 جولات معالجة موقوتة مع تمويهات تداخل استباقي من الجولة السابقة لمنع التعرف السطحي بالألفة.",
      methodology:
        "يعرض 6 جولات متوازنة الترتيب (جولتان مرجعيتان صافيتان باحتفاظ صامت موازن زمنيا + جولتا حساب بشبكة خيارات عديمة التسريب + جولتا منطق مقلوب القطبية من 6 بدائل) مع زرع مفردتين من الجولة السابقة داخل لوحة الاسترجاع لمنع الحل بالألفة وفصل الحذف عن الإقحام وإبدال الترتيب.",
      instructions: [
        "احفظ 4 كلمات بالترتيب.",
        "حل المسألة الفاصلة بسرعة (أو انتظر الوقفة الصامتة).",
        "اختر الكلمات الأربع بترتيبها من 1 إلى 4."
      ],
      example:
        "شرط ← غرض ← حكم ← عذر  |  (7 × 4) − 9 = 19  |  1: شرط، 2: غرض، 3: حكم، 4: عذر"
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
      durationSec: 125,
      isControl: false,
      clinicalNote:
        "يطبق النموذج متمركز الدوائر للذاكرة العاملة (Oberauer, 2002) وكلفة تبديل البؤرة (Garavan, 1998): يوازن موقع تكرار البؤرة وتبديلها عبر خطوات الجولة، ويفصل متعامدا وبفارق لا يقل عن 2 بين القيم القديمة وزلات الحساب (±1) وخلط المتغيرات.",
      methodology:
        "ينفذ 5 جولات محكومة بفروق تحديث (≥2) تمنع تداخل زلات الحساب (±1) مع القيم القديمة، مع موازنة موضعية تامة بين خطوات تكرار البؤرة وتبديلها لعزل كلفة التبديل الصافية بالمللي ثانية.",
      instructions: [
        "احفظ الرقم الابتدائي لكل متغير.",
        "في كل خطوة حدّث المتغير المذكور فقط وأبقِ غيره في ذهنك.",
        "أدخل الرقم النهائي لكل متغير يُسأل عنه."
      ],
      example:
        "ألف = 5، باء = 2  ←  ألف + 3 (8)  ←  باء + 4 (6)  ←  ألف − 2 (6)"
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
      durationSec: 120,
      isControl: false,
      clinicalNote:
        "يطبق نموذج بوابة الإدخال الجبهية المخططية (Chatham, Frank, & Badre, 2014؛ Kessler & Oberauer, 2014): يوازن الجولات وفق تصميم ABBA المتناظر لتحييد أثر التدريب والإجهاد والحداثة، ويصحح الاسترجاع المرتب بالتتالي الجزئي (LCS) مع خصم التخمين.",
      methodology:
        "يعرض 6 جولات بتصميم ABBA متكافئ الموضع والاتجاه بلا تلميح فئوي مسبق (جولتا تناوب رباعيتان + جولتان متكتلتان سداسيتان + جولتا تناوب سداسيتان) مع تصحيح الترتيب التصاعدي والعكسي ضد إزاحة الخانات وتصحيح الإقحام العشوائي.",
      instructions: [
        "ستظهر أرقام وكلمات متعاقبة.",
        "أولا: اختر الأرقام من الأصغر للأكبر.",
        "ثانيا: اختر الكلمات عكسيا من الأخيرة للأولى."
      ],
      example:
        "شرط ← 8 ← قصد ← 3   ←   الأرقام: 3 ثم 8  |  الكلمات: قصد ثم شرط"
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
        "يطبق نماذج التكامل العلائقي في القطب الجبهي (Waltz et al., 1999؛ Halford et al., 1998) وانقلاب القطبية المعجمية (Clark, 1969): يحذف المقدمات الفائضة ويعشّي ترتيب الجمل ويحسم تبخر الاسم بفحص الموقع النحوي الدقيق (الطرف الأول مقابل الثاني في كل مقدمة).",
      methodology:
        "ينفذ 6 سلاسل استنتاجية معشّاة الترتيب خالية من المقدمات الفائضة وسط 6 بدائل متجانسة دلاليا، مع فحص بنيوي رباعي أو سداسي يحدد الطرف النحوي الدقيق للعقدة الفائزة داخل المقدمات لعزل تبخر الاسم عن أخطاء قلب القطبية.",
      instructions: [
        "اقرأ جمل المقارنة المتتالية واربط كل اسم بمرتبته.",
        "اختر صاحب المرتبة المطلوبة من البدائل الستة."
      ],
      example:
        "خطة الربيع أقصر من الصيف  ←  خطة الربيع أطول من الشتاء  ←  الأقصر: خطة الشتاء"
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
        "يدمج تتبع التسلسل القطبي بدون قرائن (Desrochers, Chatham, & Badre, 2015) مع المعيار الذهبي لليقظة الحركية (Basner & Dinges, 2011) وتقدير الأرجحية العظمى المنظم للتوزيع الأسي الغاوسي (MAP-MLE Ex-Gaussian Tau) مع عزل الارتداد الحركي عن الاستباق.",
      methodology:
        "يعرض 36 ومضة ضوئية (9 دورات رباعية) بفواصل غير إيقاعية متوازنة النصفين (1350–2250 مللي ثانية)، ويفصل بين الومضات الفائتة بنوم موضعي وبين تجاوز الطيار الآلي على العدّاد الواعي، مع تقدير MAP-MLE لمعامل Tau.",
      instructions: [
        "لكل إضاءة ضغطة واحدة فقط فور رؤيتها.",
        "أول 3 إضاءات ← اضغط الزر الأول (1–3).",
        "الإضاءة الرابعة ← اضغط الزر الثاني (الومضة 4 فقط)، ثم أعد من 1."
      ],
      example:
        "ضوء 1 (الأول) ← ضوء 2 (الأول) ← ضوء 3 (الأول) ← ضوء 4 (الثاني: 4 فقط) ← ضوء 1 (الأول)"
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
      durationSec: 95,
      isControl: true,
      clinicalNote:
        "يطبق مبدأ التفكيك العصبي المزدوج (Shallice, 1988؛ Badre & D'Esposito, 2009؛ Luck & Vogel, 1997): يختبر 6 مهام سليمة مرجعيا بتناظر زُمري تام (Z2×Z2) يمنع استخلاص النموذج الأوسط بصريا أو حسابيا وبفجوة احتفاظ 3.2 ثانية مطابقة للمرجع السريري.",
      methodology:
        "يجمع 6 جولات متناظرة البدائل: جولتا مكدس هرمي من 3 طبقات، وجولة قاعدة شرطية (IF-ELSE) تحت المقاطعة، و3 جولات للمخزن البصري الصامت (0.8 ثانية ومضة + 0.4 ثانية قناع متعدد الاتجاهات + 2.8 ثانية صمت = 3.2 ثانية احتفاظ) بتصميم Z2×Z2 متكافئ الزوايا.",
      instructions: [
        "جولات الأقواس: احفظ العملية الخارجية، ثم الداخلية، ثم احسب وعوّض رجوعا.",
        "جولة الشرط: احفظ الشرط والعدد، أجب عن المقاطعة، ثم طبّق الشرط على عددك.",
        "جولات الشكل: التقط الشكل خلال الومضة واختر المطابق بعد التوقف."
      ],
      example:
        "14 + [ ... ]  ←  3 × ( ... )  ←  4 + 2 = 6   ←   14 + (3 × 6) = 32"
    }
  ];

  // 160 strictly non-imageable, high-frequency, crystal-clear everyday 3-to-5-letter abstract Arabic nouns
  // Purged of ALL rare/archaic/juristic jargon AND ALL 2-letter foil leaks AND ALL concrete homographs
  var ABSTRACT_WORDS = [
    "شرط", "قصد", "عذر", "نفي", "سبب", "حكم", "أجل", "أصل",
    "وعد", "غرض", "كسب", "خطأ", "وصف", "عهد", "حزم", "صبر",
    "رشد", "عدل", "فضل", "فهم", "رأي", "عزم", "نصح", "إذن",
    "منع", "رفض", "هدف", "وقت", "فرق", "حرص", "عفو", "صفح",
    "لوم", "عتب", "مدح", "صدق", "ربح", "خسر", "جهد", "وعي",
    "ظلم", "أمن", "خوف", "أمل", "ثقة", "ندم", "قلق", "ملل",
    "شغف", "شكر", "صمت", "سعي", "عون", "غدر", "حزن", "أسف",
    "حذر", "لطف", "رفق", "كرم", "بخل", "شأن", "نهج", "طمع",
    "زهد", "حسد", "كسل", "قوة", "حجة", "همة", "شدة", "وفاء",
    "فكرة", "خطة", "غاية", "قيمة", "نسبة", "مهلة", "فرصة", "خبرة",
    "حاجة", "قدرة", "قرار", "نظام", "منهج", "مبدأ", "معنى", "مغزى",
    "جدوى", "رتبة", "ميزة", "عبرة", "حكمة", "فطنة", "يقين", "شكوك",
    "ظنون", "قبول", "خلاف", "جدال", "نقاش", "حوار", "نجاح", "تفوق",
    "تقدم", "تطور", "تأخر", "تردد", "تسرع", "تأمل", "قضية", "واجب",
    "حقوق", "مطلب", "مقصد", "مسعى", "مكسب", "ضمان", "أمان", "سلام",
    "وئام", "وفاق", "خصام", "نزاع", "جدية", "مشقة", "راحة", "هدوء",
    "بهجة", "سرور", "دهشة", "حيرة", "رغبة", "نشاط", "فتور", "غفلة",
    "يقظة", "جرأة", "هيبة", "قسوة", "غرور", "غيرة", "مودة", "تعاون",
    "تفاهم", "توافق", "تسامح", "إنصاف", "إخلاص", "إتقان", "إنجاز", "بساطة",
    "سهولة", "صعوبة", "مسألة", "مشكلة", "نتيجة", "فائدة", "منفعة", "مصلحة"
  ];

  // 16 domain-coherent sets with 100% everyday, crystal-clear entities and transparent scalar comparatives
  // Zero lexical rarity confounds (no literary/archaic adjectives) and zero real-world rank bias
  var BINDING_TRIADS = [
    {
      items: ["مشروع الشمال", "مشروع الجنوب", "مشروع الشرق", "مشروع الغرب", "مشروع الوسط", "مشروع الساحل"],
      more: "أكبر ميزانية من",
      less: "أصغر ميزانية من",
      askMax: "الأكبر ميزانية؟",
      askMin: "الأصغر ميزانية؟",
      askMid: "الأوسط ميزانية؟"
    },
    {
      items: ["خطة الصيف", "خطة الشتاء", "خطة الربيع", "خطة الخريف", "خطة البداية", "خطة المتابعة"],
      more: "أطول مدة من",
      less: "أقصر مدة من",
      askMax: "الأطول مدة؟",
      askMin: "الأقصر مدة؟",
      askMid: "الأوسط مدة؟"
    },
    {
      items: ["عقد الإيجار", "عقد الصيانة", "عقد التوريد", "عقد الشراكة", "عقد التأمين", "عقد التسويق"],
      more: "أكثر بنودا من",
      less: "أقل بنودا من",
      askMax: "الأكثر بنودا؟",
      askMin: "الأقل بنودا؟",
      askMid: "الأوسط بنودا؟"
    },
    {
      items: ["تقرير المبيعات", "تقرير الجودة", "تقرير الصيانة", "تقرير التدريب", "تقرير المشتريات", "تقرير المخزون"],
      more: "أكثر صفحات من",
      less: "أقل صفحات من",
      askMax: "الأكثر صفحات؟",
      askMin: "الأقل صفحات؟",
      askMid: "الأوسط صفحات؟"
    },
    {
      items: ["برنامج المحاسبة", "برنامج الأرشفة", "برنامج المراسلة", "برنامج الجدولة", "برنامج الحماية", "برنامج الفوترة"],
      more: "أسرع تشغيلا من",
      less: "أبطأ تشغيلا من",
      askMax: "الأسرع تشغيلا؟",
      askMin: "الأبطأ تشغيلا؟",
      askMid: "الأوسط سرعة؟"
    },
    {
      items: ["قسم التخطيط", "قسم المتابعة", "قسم التدريب", "قسم الجودة", "قسم التطوير", "قسم التنسيق"],
      more: "أكثر موظفين من",
      less: "أقل موظفين من",
      askMax: "الأكثر موظفين؟",
      askMin: "الأقل موظفين؟",
      askMid: "الأوسط موظفين؟"
    },
    {
      items: ["سجل النفقات", "سجل الواردات", "سجل الودائع", "سجل المبيعات", "سجل العقود", "سجل المدفوعات"],
      more: "أعلى رصيدا من",
      less: "أقل رصيدا من",
      askMax: "الأعلى رصيدا؟",
      askMin: "الأقل رصيدا؟",
      askMid: "الأوسط رصيدا؟"
    },
    {
      items: ["دورة الإدارة", "دورة المحاسبة", "دورة الترجمة", "دورة البرمجة", "دورة التصميم", "دورة التسويق"],
      more: "أغلى رسوما من",
      less: "أرخص رسوما من",
      askMax: "الأغلى رسوما؟",
      askMin: "الأرخص رسوما؟",
      askMid: "الأوسط رسوما؟"
    },
    {
      items: ["ملف الحسابات", "ملف الموارد", "ملف المشتريات", "ملف المخازن", "ملف الفواتير", "ملف العملاء"],
      more: "أقدم تاريخا من",
      less: "أحدث تاريخا من",
      askMax: "الأقدم تاريخا؟",
      askMin: "الأحدث تاريخا؟",
      askMid: "الأوسط تاريخا؟"
    },
    {
      items: ["وحدة التحليل", "وحدة الفهرسة", "وحدة التدقيق", "وحدة التصنيف", "وحدة المراجعة", "وحدة التوثيق"],
      more: "أسرع إنجازا من",
      less: "أبطأ إنجازا من",
      askMax: "الأسرع إنجازا؟",
      askMin: "الأبطأ إنجازا؟",
      askMid: "الأوسط سرعة؟"
    },
    {
      items: ["مقرر التاريخ", "مقرر الجغرافيا", "مقرر الفيزياء", "مقرر الكيمياء", "مقرر الأحياء", "مقرر الاقتصاد"],
      more: "أكثر دروسا من",
      less: "أقل دروسا من",
      askMax: "الأكثر دروسا؟",
      askMin: "الأقل دروسا؟",
      askMid: "الأوسط دروسا؟"
    },
    {
      items: ["فريق المبادرة", "فريق التطوير", "فريق المتابعة", "فريق الجودة", "فريق الإشراف", "فريق الدعم"],
      more: "أعلى نقاطا من",
      less: "أقل نقاطا من",
      askMax: "الأعلى نقاطا؟",
      askMin: "الأقل نقاطا؟",
      askMid: "الأوسط نقاطا؟"
    },
    {
      items: ["باقة الأعمال", "باقة الشركات", "باقة الأفراد", "باقة المكاتب", "باقة المتاجر", "باقة المؤسسات"],
      more: "أغلى اشتراكا من",
      less: "أرخص اشتراكا من",
      askMax: "الأغلى اشتراكا؟",
      askMin: "الأرخص اشتراكا؟",
      askMid: "الأوسط اشتراكا؟"
    },
    {
      items: ["فرع العاصمة", "فرع الميناء", "فرع الجامعة", "فرع المطار", "فرع الواحة", "فرع الهضبة"],
      more: "أعلى أرباحا من",
      less: "أقل أرباحا من",
      askMax: "الأعلى أرباحا؟",
      askMin: "الأقل أرباحا؟",
      askMid: "الأوسط أرباحا؟"
    },
    {
      items: ["كتاب المنطق", "كتاب البلاغة", "كتاب النحو", "كتاب الصرف", "كتاب العروض", "كتاب الأدب"],
      more: "أطول فصولا من",
      less: "أقصر فصولا من",
      askMax: "الأطول فصولا؟",
      askMin: "الأقصر فصولا؟",
      askMid: "الأوسط طولا؟"
    },
    {
      items: ["لجنة التنظيم", "لجنة التحكيم", "لجنة الاستقبال", "لجنة الإعلام", "لجنة المالية", "لجنة المتابعة"],
      more: "أكثر أعضاء من",
      less: "أقل أعضاء من",
      askMax: "الأكثر أعضاء؟",
      askMin: "الأقل أعضاء؟",
      askMid: "الأوسط أعضاء؟"
    }
  ];

  var INTERRUPT_QUESTIONS = [
    {
      prompt: "الشهر قبل نوفمبر؟",
      answer: "أكتوبر",
      options: ["أكتوبر", "سبتمبر", "ديسمبر", "أغسطس"]
    },
    {
      prompt: "اليوم قبل الأربعاء؟",
      answer: "الثلاثاء",
      options: ["الثلاثاء", "الخميس", "الاثنين", "الأحد"]
    },
    {
      prompt: "الشهر الهجري بعد شعبان؟",
      answer: "رمضان",
      options: ["رمضان", "رجب", "شوال", "محرم"]
    },
    {
      prompt: "الفصل بعد الشتاء؟",
      answer: "الربيع",
      options: ["الربيع", "الخريف", "الصيف", "الشتاء"]
    },
    {
      prompt: "الحرف بعد الفاء (ف، ق، ك)؟",
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

  function pickDistinctWords(count, excludeSet, strictPhonological, avoidRootList) {
    var used = excludeSet || {};
    var enforceRootDisjoint = strictPhonological !== false;
    var rootGuardList = Array.isArray(avoidRootList) ? avoidRootList.slice() : [];
    var usedFirst = {};
    var usedLast = {};
    var pool = shuffle(ABSTRACT_WORDS);
    var picked = [];

    for (var i = 0; i < pool.length && picked.length < count; i += 1) {
      var w = pool[i];
      if (used[w]) continue;
      if (w.length < 3 || w.length > 5) continue;
      var first = normalizeArabicChar(w.charAt(0));
      var last = normalizeArabicChar(w.charAt(w.length - 1));
      if (enforceRootDisjoint && (usedFirst[first] || usedLast[last])) continue;

      var rootClash = false;
      var checkAgainst = enforceRootDisjoint ? rootGuardList.concat(picked) : rootGuardList;
      for (var p = 0; p < checkAgainst.length; p += 1) {
        if (sharesTwoConsonants(w, checkAgainst[p])) {
          rootClash = true;
          break;
        }
      }
      if (rootClash) continue;

      used[w] = true;
      usedFirst[first] = true;
      usedLast[last] = true;
      picked.push(w);
    }

    // Fallback pass keeping strict root-disjointness against target words first
    if (picked.length < count) {
      for (var m = 0; m < pool.length && picked.length < count; m += 1) {
        var wMid = pool[m];
        if (used[wMid] || wMid.length < 3 || wMid.length > 5) continue;
        var clashTarget = false;
        for (var q = 0; q < rootGuardList.length; q += 1) {
          if (sharesTwoConsonants(wMid, rootGuardList[q])) {
            clashTarget = true;
            break;
          }
        }
        if (clashTarget) continue;
        used[wMid] = true;
        picked.push(wMid);
      }
    }

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

  // Translation-invariant 3-doublet numeric option lattice (Haladyna et al., 2002):
  // Places answer at a strictly uniform doublet k* in {0,1,2} and intra-doublet slot j* in {0,1}
  // Guarantees: (a) 3 odd + 3 even options, (b) adjacent +/-1 slip lure ALWAYS present,
  // (c) ZERO rank/spacing/cluster/parity leak (blind zero-prompt guessing = exact 1/6 = 16.67%!).
  function buildZeroLeakNumericOptions(answer, optionCount, asStrings) {
    var numOpts = typeof optionCount === "number" && optionCount === 4 ? 4 : 6;
    var ans = Math.round(Number(answer) || 20);
    var bigStep = Math.random() < 0.5 ? 4 : 6; // even spacing preserves parity symmetry across doublets
    var numDoublets = numOpts / 2; // 3 doublets for 6 options, 2 doublets for 4 options
    var maxBackSpan = (numDoublets - 1) * bigStep + 1;

    // If ans > maxBackSpan + 1 (true for all answers >= 15), uniform kStar never hits <= 1!
    var validK = [];
    for (var k = 0; k < numDoublets; k += 1) {
      for (var j = 0; j <= 1; j += 1) {
        var b0Cand = ans - k * bigStep - j;
        if (b0Cand >= 2) {
          validK.push({ b0: b0Cand });
        }
      }
    }
    var chosenAnchor = validK.length > 0
      ? validK[randInt(0, validK.length - 1)]
      : { b0: Math.max(2, ans - 1) };

    var b0 = chosenAnchor.b0;
    var vals = [];
    for (var d = 0; d < numDoublets; d += 1) {
      var base = b0 + d * bigStep;
      vals.push(base);
      vals.push(base + 1);
    }
    if (vals.indexOf(ans) === -1) {
      vals[0] = ans;
    }
    var mixed = shuffle(vals);
    return asStrings ? mixed.map(String) : mixed;
  }

  function buildMathProblem(optionCount) {
    var numOpts = typeof optionCount === "number" && optionCount === 4 ? 4 : 6;
    var a = randInt(5, 9);
    var b = randInt(4, 8);
    var prod = a * b; // 20..72
    var addMode = Math.random() < 0.5;
    // Keep answer >= 16 so 3-doublet lattice never hits lower boundary
    var maxSub = Math.min(14, prod - 16);
    var c = addMode ? randInt(5, 13) : randInt(4, Math.max(4, maxSub));
    var answer = addMode ? prod + c : prod - c;
    var prompt = addMode
      ? "(" + a + " × " + b + ") + " + c + " = ؟"
      : "(" + a + " × " + b + ") − " + c + " = ؟";

    var options = buildZeroLeakNumericOptions(answer, numOpts, true);
    return {
      prompt: prompt,
      options: options,
      answer: String(answer),
      deadlineMs: 8800
    };
  }

  function buildQuickLogicProblem(triad) {
    // Non-redundant 2-premise inverted-polarity transitive problem with all 6 domain options (16.7% chance)
    var shuffledDomain = shuffle(triad.items);
    var ordered = shuffledDomain.slice(0, 3); // ordered[0] < ordered[1] < ordered[2]
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

    var prompt = p1 + "  |  " + p2 + "  —  " + (askMin ? triad.askMin : triad.askMax);

    return {
      prompt: prompt,
      options: shuffle(shuffledDomain.slice()),
      answer: askMin ? minItem : maxItem,
      deadlineMs: 12500
    };
  }

  function buildSingleIsolationTrial(trialIndex, taskType, sessionUsedWords, priorTrialWords, triad) {
    var targetWords = pickDistinctWords(4, sessionUsedWords, true, priorTrialWords || []);
    var localExclude = Object.assign({}, sessionUsedWords);
    for (var w = 0; w < targetWords.length; w += 1) {
      localExclude[targetWords[w]] = true;
    }

    // Inject up to 2 Proactive-Interference lures from the immediately preceding trial (Keppel & Underwood, 1962)
    // Abolishes passive perirhinal familiarity ("I saw this word recently") so ONLY active DLPFC trial binding works
    var piLures = [];
    if (Array.isArray(priorTrialWords) && priorTrialWords.length >= 2) {
      var candPi = shuffle(priorTrialWords);
      for (var p = 0; p < candPi.length && piLures.length < 2; p += 1) {
        var lw = candPi[p];
        if (targetWords.indexOf(lw) === -1) {
          piLures.push(lw);
          localExclude[lw] = true;
        }
      }
    }

    var neededFresh = 12 - targetWords.length - piLures.length;
    var freshFoils = pickDistinctWords(neededFresh, localExclude, false, targetWords);
    var pool = shuffle(targetWords.concat(piLures).concat(freshFoils));

    if (taskType === "pure") {
      return {
        trialIndex: trialIndex,
        words: targetWords,
        priorLures: piLures,
        distractorPool: pool,
        taskType: "pure",
        retentionMs: 4200, // Duration-matched to loaded processing RT to isolate executive interference from passive time
        wordExposureMs: 900,
        wordIsiMs: 180,
        taskPrompt: "",
        taskOptions: [],
        taskAnswer: "",
        deadlineMs: 0
      };
    }

    var task = taskType === "math"
      ? buildMathProblem(6)
      : buildQuickLogicProblem(triad || BINDING_TRIADS[trialIndex % BINDING_TRIADS.length]);

    return {
      trialIndex: trialIndex,
      words: targetWords,
      priorLures: piLures,
      distractorPool: pool,
      taskType: taskType,
      retentionMs: 0,
      wordExposureMs: 900,
      wordIsiMs: 180,
      taskPrompt: task.prompt,
      taskOptions: task.options,
      taskAnswer: task.answer,
      deadlineMs: task.deadlineMs
    };
  }

  function generateIsolationTrials(count) {
    // Default: 6 counterbalanced trials = 2 Pure Unloaded + 2 Math + 2 Inverted-Logic
    // Counterbalances pure vs loaded serial positions so proactive interference & fatigue cancel out
    var total = typeof count === "number" && count > 0 ? count : 6;
    var sessionUsedWords = {};
    var shuffledTriads = shuffle(BINDING_TRIADS);
    var trials = [];

    var scheduleTypes;
    if (total === 6) {
      scheduleTypes = Math.random() < 0.5
        ? ["pure", "math", "logic", "pure", "logic", "math"]
        : ["math", "pure", "logic", "math", "pure", "logic"];
    } else if (total === 5) {
      scheduleTypes = Math.random() < 0.5
        ? ["pure", "math", "logic", "math", "logic"]
        : ["math", "logic", "pure", "math", "logic"];
    } else {
      scheduleTypes = [];
      for (var k = 0; k < total; k += 1) {
        scheduleTypes.push(k % 2 === 0 ? "math" : "logic");
      }
    }

    var prevWords = [];
    var logicCounter = 0;
    for (var t = 0; t < total; t += 1) {
      var tType = scheduleTypes[t];
      var triad = shuffledTriads[logicCounter % shuffledTriads.length];
      if (tType === "logic") logicCounter += 1;
      var tr = buildSingleIsolationTrial(t, tType, sessionUsedWords, prevWords, triad);
      trials.push(tr);
      prevWords = tr.words.slice();
    }
    return trials;
  }

  function buildRandomUpdatingSchedule(vars, stepCount, parityHint) {
    // Serial-position-balanced Focus-Repeat vs Focus-Switch schedules:
    // Every trial contains BOTH Focus-Repeats and Focus-Switches with matched mean step index
    var perm = shuffle(vars);
    if (vars.length === 2 && stepCount === 5) {
      // Template 0: repeat at steps (2,4) mean=3.0, switch at (1,3) mean=2.0
      // Template 1: repeat at steps (1,3) mean=2.0, switch at (2,4) mean=3.0 -> Exact 2.5 vs 2.5 balance!
      var useAlt2 = typeof parityHint === "number" ? parityHint % 2 === 1 : Math.random() < 0.5;
      return useAlt2
        ? [perm[0], perm[0], perm[1], perm[1], perm[0]]
        : [perm[0], perm[1], perm[1], perm[0], perm[0]];
    }
    if (vars.length === 2 && stepCount === 3) {
      return [perm[0], perm[1], perm[1]];
    }
    if (vars.length === 3 && stepCount === 6) {
      // Template 0: repeat at (2,5) mean=3.5, switch at (1,3,4) mean=2.67
      // Template 1: repeat at (1,4) mean=2.5, switch at (2,3,5) mean=3.33 -> Exact 3.0 vs 3.0 balance!
      var useAlt3 = typeof parityHint === "number" ? parityHint % 2 === 1 : Math.random() < 0.5;
      return useAlt3
        ? [perm[0], perm[0], perm[1], perm[2], perm[2], perm[1]]
        : [perm[0], perm[1], perm[1], perm[2], perm[0], perm[0]];
    }

    var out = [];
    for (var i = 0; i < stepCount; i += 1) {
      out.push(perm[i % perm.length]);
    }
    return out;
  }

  function buildConstrainedUpdatingTrial(trialIndex, vars, stepCount, semanticUnits) {
    for (var attempt = 0; attempt < 900; attempt += 1) {
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

      var schedule = buildRandomUpdatingSchedule(vars, stepCount, trialIndex + attempt);
      var steps = [];
      var ok = true;
      // Enforce |delta| >= 2 AND |final - stale| >= 2 on first 750 attempts (proven 100% feasible!)
      var enforceArithmeticMargin = attempt < 750;

      for (var s = 0; s < stepCount; s += 1) {
        var targetVar = schedule[s];
        var isRepeatFocus = s > 0 && schedule[s] === schedule[s - 1];
        var oldVal = current[targetVar];
        var candidates = [];

        var futureUpdates = false;
        for (var f = s + 1; f < stepCount; f += 1) {
          if (schedule[f] === targetVar) {
            futureUpdates = true;
            break;
          }
        }

        for (var nextVal = 1; nextVal <= 9; nextVal += 1) {
          if (nextVal === oldVal) continue;
          var deltaCheck = Math.abs(nextVal - oldVal);
          var minDelta = enforceArithmeticMargin ? 2 : 1;
          if (deltaCheck < minDelta || deltaCheck > 5) continue;

          var collision = false;
          for (var u = 0; u < vars.length; u += 1) {
            if (vars[u] !== targetVar && current[vars[u]] === nextVal) {
              collision = true;
              break;
            }
          }
          if (collision) continue;

          if (!futureUpdates) {
            if (nextVal === initial[targetVar]) continue;
            if (historyByVar[targetVar].indexOf(nextVal) !== -1) continue;
            if (enforceArithmeticMargin) {
              var nearStale = Math.abs(nextVal - oldVal) <= 1;
              for (var hs = 0; hs < historyByVar[targetVar].length; hs += 1) {
                if (Math.abs(nextVal - historyByVar[targetVar][hs]) <= 1) {
                  nearStale = true;
                  break;
                }
              }
              if (nearStale) continue;
            }
          }

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
          text = targetVar + (op === "+" ? "  + " : "  − ") + absDelta + " " + unit;
        } else {
          text = targetVar + (op === "+" ? "  + " : "  − ") + absDelta;
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

      var seenFinal = {};
      var validFinal = true;
      for (var m = 0; m < vars.length; m += 1) {
        var vn = vars[m];
        var fv = current[vn];
        if (fv < 1 || fv > 9 || seenFinal[fv] || fv === initial[vn] || historyByVar[vn].indexOf(fv) !== -1) {
          validFinal = false;
          break;
        }
        if (enforceArithmeticMargin) {
          for (var hIdx = 0; hIdx < historyByVar[vn].length; hIdx += 1) {
            if (Math.abs(fv - historyByVar[vn][hIdx]) <= 1) {
              validFinal = false;
              break;
            }
          }
          if (!validFinal) break;
        }
        seenFinal[fv] = true;
      }
      if (!validFinal) continue;

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
        isSemantic: Boolean(semanticUnits),
        stepDeadlineMs: 8500,
        initDeadlineMs: 9500,
        initial: initial,
        steps: steps,
        final: current,
        historyByVar: historyByVar
      };
    }

    // Dynamic arity-preserving orthogonal fallback (respects exact vars.length and semanticUnits!)
    if (vars.length === 3) {
      var v0 = vars[0], v1 = vars[1], v2 = vars[2];
      var fmt3 = function (vn, opSym, dVal) {
        if (semanticUnits && semanticUnits[vn]) {
          return vn + (opSym === "+" ? "  + " : "  − ") + dVal + " " + semanticUnits[vn];
        }
        return vn + (opSym === "+" ? "  + " : "  − ") + dVal;
      };
      var init3 = {}, fin3 = {}, hist3 = {}, lag3 = {};
      init3[v0] = 4; init3[v1] = 7; init3[v2] = 1;
      fin3[v0] = 2; fin3[v1] = 5; fin3[v2] = 8;
      hist3[v0] = [4, 9]; hist3[v1] = [7, 3]; hist3[v2] = [1, 4];
      lag3[v0] = 0; lag3[v1] = 2; lag3[v2] = 1;
      var s3 = [];
      var snapA = {}; snapA[v0] = 9; snapA[v1] = 7; snapA[v2] = 1;
      var snapB = {}; snapB[v0] = 9; snapB[v1] = 3; snapB[v2] = 1;
      var snapC = {}; snapC[v0] = 9; snapC[v1] = 5; snapC[v2] = 1;
      var snapD = {}; snapD[v0] = 9; snapD[v1] = 5; snapD[v2] = 4;
      var snapE = {}; snapE[v0] = 9; snapE[v1] = 5; snapE[v2] = 8;
      var snapF = {}; snapF[v0] = 2; snapF[v1] = 5; snapF[v2] = 8;
      s3.push({ stepIndex: 0, varName: v0, transition: "first", op: "+", delta: 5, prevVal: 4, newVal: 9, text: fmt3(v0, "+", 5), snapshot: snapA });
      s3.push({ stepIndex: 1, varName: v1, transition: "switch", op: "-", delta: 4, prevVal: 7, newVal: 3, text: fmt3(v1, "-", 4), snapshot: snapB });
      s3.push({ stepIndex: 2, varName: v1, transition: "repeat", op: "+", delta: 2, prevVal: 3, newVal: 5, text: fmt3(v1, "+", 2), snapshot: snapC });
      s3.push({ stepIndex: 3, varName: v2, transition: "switch", op: "+", delta: 3, prevVal: 1, newVal: 4, text: fmt3(v2, "+", 3), snapshot: snapD });
      s3.push({ stepIndex: 4, varName: v2, transition: "repeat", op: "+", delta: 4, prevVal: 4, newVal: 8, text: fmt3(v2, "+", 4), snapshot: snapE });
      s3.push({ stepIndex: 5, varName: v0, transition: "switch", op: "-", delta: 7, prevVal: 9, newVal: 2, text: fmt3(v0, "-", 7), snapshot: snapF });
      return {
        trialIndex: trialIndex,
        vars: vars.slice(),
        queryOrder: [v1, v2, v0],
        inFocusVar: v0,
        lagByVar: lag3,
        units: semanticUnits || null,
        isSemantic: Boolean(semanticUnits),
        stepDeadlineMs: 8500,
        initDeadlineMs: 9500,
        initial: init3,
        steps: s3,
        final: fin3,
        historyByVar: hist3
      };
    }

    var va = vars[0] || "ألف", vb = vars[1] || "باء";
    var fmt2 = function (vn, opSym, dVal) {
      if (semanticUnits && semanticUnits[vn]) {
        return vn + (opSym === "+" ? "  + " : "  − ") + dVal + " " + semanticUnits[vn];
      }
      return vn + (opSym === "+" ? "  + " : "  − ") + dVal;
    };
    var init2 = {}, fin2 = {}, hist2 = {}, lag2 = {};
    init2[va] = 4; init2[vb] = 1;
    fin2[va] = 2; fin2[vb] = 8;
    hist2[va] = [4, 7, 5]; hist2[vb] = [1, 5];
    lag2[va] = 1; lag2[vb] = 0;
    return {
      trialIndex: trialIndex,
      vars: [va, vb],
      queryOrder: [va, vb],
      inFocusVar: vb,
      lagByVar: lag2,
      units: semanticUnits || null,
      isSemantic: Boolean(semanticUnits),
      stepDeadlineMs: 8500,
      initDeadlineMs: 9500,
      initial: init2,
      steps: [
        { stepIndex: 0, varName: va, transition: "first", op: "+", delta: 3, prevVal: 4, newVal: 7, text: fmt2(va, "+", 3), snapshot: { "ألف": 7, "باء": 1 } },
        { stepIndex: 1, varName: va, transition: "repeat", op: "-", delta: 2, prevVal: 7, newVal: 5, text: fmt2(va, "-", 2), snapshot: { "ألف": 5, "باء": 1 } },
        { stepIndex: 2, varName: vb, transition: "switch", op: "+", delta: 4, prevVal: 1, newVal: 5, text: fmt2(vb, "+", 4), snapshot: { "ألف": 5, "باء": 5 } },
        { stepIndex: 3, varName: va, transition: "switch", op: "-", delta: 3, prevVal: 5, newVal: 2, text: fmt2(va, "-", 3), snapshot: { "ألف": 2, "باء": 5 } },
        { stepIndex: 4, varName: vb, transition: "switch", op: "+", delta: 3, prevVal: 5, newVal: 8, text: fmt2(vb, "+", 3), snapshot: { "ألف": 2, "باء": 8 } }
      ],
      final: fin2,
      historyByVar: hist2
    };
  }

  function generateUpdatingTrials(count) {
    // 5 trials (13 variable queries) with balanced Focus-Repeat vs Focus-Switch serial positions
    var total = typeof count === "number" && count > 0 ? count : 5;
    var specs = [
      { vars: ["ألف", "باء"], steps: 5, units: null },
      { vars: ["ألف", "باء"], steps: 5, units: null },
      { vars: ["ألف", "باء", "جيم"], steps: 6, units: null },
      { vars: ["ألف", "باء", "جيم"], steps: 6, units: null },
      {
        vars: ["العدد", "السعر", "الوزن"],
        steps: 6,
        units: { "العدد": "قطع", "السعر": "دنانير", "الوزن": "كيلو" }
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
    // 6 ABBA-counterbalanced trials:
    // Cancels BOTH modality recency (word-first vs num-first) AND linear trial-order practice/fatigue
    // Mean serial index of Blocked-6 === Mean serial index of Alternating-6 === 3.5!
    var total = typeof count === "number" && count > 0 ? count : 6;
    var usedWords = {};
    var abbaFlip = Math.random() < 0.5;
    var modFlip = Math.random() < 0.5;
    var kA = modFlip ? "num" : "word";
    var kB = modFlip ? "word" : "num";

    var blueprints = abbaFlip
      ? [
          { mode: "alternating", pairs: 2, startKind: kA },
          { mode: "blocked", pairs: 3, startKind: kA },
          { mode: "alternating", pairs: 3, startKind: kB },
          { mode: "alternating", pairs: 3, startKind: kA },
          { mode: "blocked", pairs: 3, startKind: kB },
          { mode: "alternating", pairs: 2, startKind: kB }
        ]
      : [
          { mode: "alternating", pairs: 2, startKind: kA },
          { mode: "alternating", pairs: 3, startKind: kA },
          { mode: "blocked", pairs: 3, startKind: kB },
          { mode: "blocked", pairs: 3, startKind: kA },
          { mode: "alternating", pairs: 3, startKind: kB },
          { mode: "alternating", pairs: 2, startKind: kB }
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
      var extraWords = pickDistinctWords(12 - words.length, localExclude, false, words);
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

  function buildExactSyntacticCheck(premiseRecords, targetEntity, targetRole) {
    // Builds a 100% non-deterministic, polarity-sensitive syntactic node check:
    // Every premise P_k has two distinct syntactic argument positions:
    //   left/first = "الطرف الأول في المقدمة k"
    //   right/second = "الطرف الثاني في المقدمة k"
    // Confusing the two entities inside the same premise (polarity error!) selects the WRONG side -> 0% false pass!
    var mentions = [];
    for (var i = 0; i < premiseRecords.length; i += 1) {
      if (premiseRecords[i].first === targetEntity) {
        mentions.push({ pIdx: i + 1, side: "الأول" });
      } else if (premiseRecords[i].second === targetEntity) {
        mentions.push({ pIdx: i + 1, side: "الثاني" });
      }
    }

    if (targetRole === "mid" || mentions.length >= 2) {
      var side1 = mentions[0] ? mentions[0].side : "الأول";
      var side2 = mentions[1] ? mentions[1].side : "الأول";
      var pA = mentions[0] ? mentions[0].pIdx : 1;
      var pB = mentions[1] ? mentions[1].pIdx : 2;
      var midOptions = [
        "الطرف الأول في المقدمة " + pA + " والطرف الأول في المقدمة " + pB,
        "الطرف الأول في المقدمة " + pA + " والطرف الثاني في المقدمة " + pB,
        "الطرف الثاني في المقدمة " + pA + " والطرف الأول في المقدمة " + pB,
        "الطرف الثاني في المقدمة " + pA + " والطرف الثاني في المقدمة " + pB
      ];
      return {
        prompt: "موقعا الإجابة في الجملتين:",
        options: midOptions,
        answer: "الطرف " + side1 + " في المقدمة " + pA + " والطرف " + side2 + " في المقدمة " + pB
      };
    }

    var allSlotOptions = [];
    for (var k = 1; k <= premiseRecords.length; k += 1) {
      allSlotOptions.push("الطرف الأول في المقدمة " + k);
      allSlotOptions.push("الطرف الثاني في المقدمة " + k);
    }
    var m0 = mentions[0] || { pIdx: 1, side: "الأول" };
    return {
      prompt: "موقع الإجابة في الجمل:",
      options: allSlotOptions,
      answer: "الطرف " + m0.side + " في المقدمة " + m0.pIdx
    };
  }

  function generateBindingTrials(count) {
    // 6 strictly non-redundant relational trials with shuffled condition order,
    // shuffled premise order across ALL 3-entity and 4-entity chains, and exact syntactic-slot verification
    var total = typeof count === "number" && count > 0 ? count : 6;
    var triads = shuffle(BINDING_TRIADS);
    var trials = [];

    var baseSpecs = [
      { polarity: "linear", entityCount: 3, targetRole: "min", dirHint: "more" },
      { polarity: "linear", entityCount: 3, targetRole: "max", dirHint: "less" },
      { polarity: "flipped", entityCount: 3, targetRole: "min", dirHint: "mixed" },
      { polarity: "flipped", entityCount: 3, targetRole: "mid", dirHint: "mixed" },
      { polarity: "flipped", entityCount: 4, targetRole: "min", dirHint: "mixed" },
      { polarity: "flipped", entityCount: 4, targetRole: "max", dirHint: "mixed" }
    ];
    var specs = total === 6 ? shuffle(baseSpecs) : baseSpecs;

    for (var t = 0; t < total; t += 1) {
      var triad = triads[t % triads.length];
      var spec = specs[t % specs.length];
      var shuffledAll = shuffle(triad.items); // 6 domain items
      var presented = shuffledAll.slice(0, spec.entityCount); // latent ascending: presented[0] < presented[1] < ...
      var foils = shuffledAll.slice(spec.entityCount);

      var premiseObjs = [];
      var answer = "";
      var question = "";
      var oppositeEndEntity = "";

      if (spec.entityCount === 3) {
        var eMin = presented[0];
        var eMid = presented[1];
        var eMax = presented[2];

        if (spec.polarity === "linear") {
          // Uniform comparator polarity across both premises, with randomized comparator & randomized premise order!
          var useMore = Math.random() < 0.5;
          if (useMore) {
            premiseObjs = [
              { first: eMax, second: eMid, text: eMax + " " + triad.more + " " + eMid },
              { first: eMid, second: eMin, text: eMid + " " + triad.more + " " + eMin }
            ];
          } else {
            premiseObjs = [
              { first: eMin, second: eMid, text: eMin + " " + triad.less + " " + eMid },
              { first: eMid, second: eMax, text: eMid + " " + triad.less + " " + eMax }
            ];
          }
          premiseObjs = shuffle(premiseObjs);
        } else {
          // Scrambled non-chained pivot + Polarity Inversion (one premise uses `more`, the other uses `less`)
          var useMidFirst = Math.random() < 0.5;
          var pH = useMidFirst
            ? { first: eMid, second: eMax, firstIsHigher: false, text: eMid + " " + triad.less + " " + eMax }
            : { first: eMax, second: eMid, firstIsHigher: true, text: eMax + " " + triad.more + " " + eMid };
          var pL = useMidFirst
            ? { first: eMid, second: eMin, firstIsHigher: true, text: eMid + " " + triad.more + " " + eMin }
            : { first: eMin, second: eMid, firstIsHigher: false, text: eMin + " " + triad.less + " " + eMid };
          premiseObjs = shuffle([pH, pL]);
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
        // 4-entity 3-premise non-redundant inverted-polarity chain: n0 < n1 < n2 < n3
        // Randomize argument sides for each link while guaranteeing >=1 `more` and >=1 `less`, then shuffle all 3 premises!
        var n0 = presented[0];
        var n1 = presented[1];
        var n2 = presented[2];
        var n3 = presented[3];

        var s01 = Math.random() < 0.5;
        var s12 = Math.random() < 0.5;
        var s23 = Math.random() < 0.5;
        if (s01 === s12 && s12 === s23) {
          s12 = !s12; // Guarantee true polarity inversion (both `more` and `less` present!)
        }

        var link01 = s01
          ? { first: n0, second: n1, firstIsHigher: false, text: n0 + " " + triad.less + " " + n1 }
          : { first: n1, second: n0, firstIsHigher: true, text: n1 + " " + triad.more + " " + n0 };
        var link12 = s12
          ? { first: n1, second: n2, firstIsHigher: false, text: n1 + " " + triad.less + " " + n2 }
          : { first: n2, second: n1, firstIsHigher: true, text: n2 + " " + triad.more + " " + n1 };
        var link23 = s23
          ? { first: n2, second: n3, firstIsHigher: false, text: n2 + " " + triad.less + " " + n3 }
          : { first: n3, second: n2, firstIsHigher: true, text: n3 + " " + triad.more + " " + n2 };

        premiseObjs = shuffle([link01, link12, link23]);

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

      var premises = premiseObjs.map(function (p) { return p.text; });
      var structuralCheck;
      if (spec.entityCount === 3 && spec.targetRole === "mid") {
        // Exact 2x2 uniform space in Premise 1: (First vs Second) x (Higher vs Lower in Premise 1) -> 25% each!
        var isFirstP1 = premiseObjs[0].first === answer;
        var p1Side = isFirstP1 ? "الأول" : "الثاني";
        var isHigherInP1 = isFirstP1 ? Boolean(premiseObjs[0].firstIsHigher) : !premiseObjs[0].firstIsHigher;
        var rankInP1 = isHigherInP1 ? "الأعلى رتبة فيها" : "الأدنى رتبة فيها";
        var trueMidDesc = "الطرف " + p1Side + " في المقدمة 1 (" + rankInP1 + ")";
        structuralCheck = {
          prompt: "موقع الإجابة وحكمها في الجملة 1:",
          options: [
            "الطرف الأول في المقدمة 1 (الأعلى رتبة فيها)",
            "الطرف الأول في المقدمة 1 (الأدنى رتبة فيها)",
            "الطرف الثاني في المقدمة 1 (الأعلى رتبة فيها)",
            "الطرف الثاني في المقدمة 1 (الأدنى رتبة فيها)"
          ],
          answer: trueMidDesc
        };
      } else {
        structuralCheck = buildExactSyntacticCheck(premiseObjs, answer, spec.targetRole);
      }

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
        structuralCheck: structuralCheck
      });
    }
    return trials;
  }

  function generateVigilanceConfig() {
    // 36 pulses = 9 full 4-beat cycles
    // Non-rhythmic stratified foreperiods (1360..2220 ms, mean 1765 ms) balanced across Halves 1 & 2
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
      bounceGuardMs: 220,
      lapseThresholdMs: 850
    };
  }

  function buildStackControlTrial(trialIndex) {
    // Keep answer >= 16 so 3-doublet zero-leak options NEVER clamp at lower bound
    var leafA = randInt(2, 5);
    var leafB = randInt(2, 4);
    var leafSum = leafA + leafB; // 4..9
    var midFactor = randInt(2, 4);
    var midProd = midFactor * leafSum; // 8..36
    var rootAddMode = trialIndex % 2 === 1;
    var rootBase = rootAddMode ? randInt(8, 16) : midProd + randInt(16, 26);
    var answer = rootAddMode ? rootBase + midProd : rootBase - midProd; // always >= 16!

    var frame1Text = rootBase + (rootAddMode ? " + [ ... ]" : " − [ ... ]");
    var frame2Text = midFactor + " × ( ... )";
    var frame3Text = leafA + " + " + leafB;
    var closeText = "الناتج الكلي = ؟";

    return {
      trialIndex: trialIndex,
      kind: "stack",
      frame1Text: frame1Text,
      frame2Text: frame2Text,
      frame3Text: frame3Text,
      closeText: closeText,
      answer: answer,
      options: buildZeroLeakNumericOptions(answer, 6, false)
    };
  }

  function buildRuleInterruptControlTrial(trialIndex) {
    // Replicates Experiment 5b: IF-ELSE conditional rule + single active accumulator + semantic interruption
    // Balanced parity output (even -> even, odd -> odd, answer >= 16) + zero-leak 3-doublet options
    var variant = randInt(0, 1);
    var baseAdd = randInt(8, 12);
    var divisor = 5;
    var rem = randInt(1, 4);
    var dividend = 15 + rem; // 16..19, dividend % 5 = rem
    var accum = baseAdd + rem; // 9..16 (balanced odd/even!)
    var isEven = accum % 2 === 0;

    var ruleText, answer;
    if (variant === 0) {
      ruleText = "زوجي ← × 2   |   فردي ← + 8";
      answer = isEven ? accum * 2 : accum + 8; // even->even (20..32), odd->odd (17..23), ALWAYS >= 17!
    } else {
      ruleText = "زوجي ← + 6   |   فردي ← × 3";
      answer = isEven ? accum + 6 : accum * 3; // even->even (16..22), odd->odd (27..45)!
    }

    var calcText = baseAdd + " + (باقي " + dividend + " ÷ " + divisor + ")";

    var intr = INTERRUPT_QUESTIONS[randInt(0, INTERRUPT_QUESTIONS.length - 1)];

    return {
      trialIndex: trialIndex,
      kind: "rule_interrupt",
      ruleText: ruleText,
      calcText: calcText,
      interruptPrompt: intr.prompt,
      interruptAnswer: intr.answer,
      interruptOptions: shuffle(intr.options),
      applyPrompt: "طبّق الشرط على عددك:",
      answer: answer,
      options: buildZeroLeakNumericOptions(answer, 6, false)
    };
  }

  function buildVisual2DPolygonTrial(trialIndex) {
    // True Group-Symmetric Z2 x Z2 Polygon Orbit (eliminates Posner-Keele prototype extraction leak!):
    // Generates {A0, A1} x {B0, B1} on two disjoint vertex-pair axes and selects targetCorner uniformly in {0..3}
    // Every choice has identical pairwise distances to the other 3 choices -> blind guessing = exact 25.0%!
    var numVertices = 7;
    var baseAngles = [];
    var offsetAngle = randInt(8, 42) * (Math.PI / 180);
    for (var i = 0; i < numVertices; i += 1) {
      var ang = offsetAngle + (i * 2 * Math.PI) / numVertices + randInt(-4, 4) * (Math.PI / 180);
      baseAngles.push(ang);
    }

    // Keep base radii in [21, 31] so +deltaR (10..12) stays strictly within [21, 43] without boundary clamping!
    var baseRadii = [];
    for (var r = 0; r < numVertices; r += 1) {
      baseRadii.push(randInt(21, 31));
    }

    var v0 = randInt(0, numVertices - 1);
    var aIdx1 = v0;
    var aIdx2 = (v0 + 3) % numVertices;
    var bIdx1 = (v0 + 2) % numVertices;
    var bIdx2 = (v0 + 5) % numVertices;

    var magA = randInt(10, 12);
    var magB = randInt(10, 12);

    function buildStatePoints(bitA, bitB) {
      var radii = baseRadii.slice();
      var tweaks = [0, 0, 0, 0, 0, 0, 0];
      if (bitA === 1) {
        radii[aIdx1] += magA;
        radii[aIdx2] = Math.max(15, radii[aIdx2] - (magA - 2));
        tweaks[aIdx1] = 0.10;
      }
      if (bitB === 1) {
        radii[bIdx1] += magB;
        radii[bIdx2] = Math.max(15, radii[bIdx2] - (magB - 2));
        tweaks[bIdx1] = -0.10;
      }
      var pts = [];
      for (var k = 0; k < numVertices; k += 1) {
        var a = baseAngles[k] + tweaks[k];
        var rad = radii[k];
        var x = Math.round((50 + rad * Math.cos(a)) * 10) / 10;
        var y = Math.round((50 + rad * Math.sin(a)) * 10) / 10;
        pts.push([Math.max(8, Math.min(92, x)), Math.max(8, Math.min(92, y))]);
      }
      return pts;
    }

    var orbit = [
      buildStatePoints(0, 0),
      buildStatePoints(1, 0),
      buildStatePoints(0, 1),
      buildStatePoints(1, 1)
    ];
    var targetCorner = randInt(0, 3);
    var indexed = [];
    for (var c = 0; c < 4; c += 1) {
      indexed.push({ isTarget: c === targetCorner, points: orbit[c] });
    }

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
      delayMs: 2800, // 400ms mask + 2800ms silent retention = exact 3200ms (3.2s) clinical benchmark
      maskSeed: randInt(100, 9999),
      targetPoints: orbit[targetCorner],
      optionsPoints: optionsPoints,
      correctIndex: correctIndex
    };
  }

  function buildVisual2DWindowTrial(trialIndex) {
    // True Group-Symmetric Z2 x Z2 Asymmetric Proportion Window (dvsdVerification Experiment 13):
    // All 4 options share the EXACT same verbal quadrant topology, AND targetCorner is chosen uniformly in {0..3}
    // Eliminates inner-corner bias so blind guessing without watching the flash = exact 25.0%!
    var rightSide = Math.random() < 0.5;
    var upperSide = Math.random() < 0.5;

    var baseW = randInt(58, 74);
    var baseH = randInt(56, 72);
    var dSplit = 12;

    var xInner = rightSide ? randInt(56, 63) : randInt(37, 44);
    var xOuter = rightSide ? xInner + dSplit : xInner - dSplit; // strictly on same side of 50%!
    var yInner = upperSide ? randInt(36, 43) : randInt(57, 64);
    var yOuter = upperSide ? yInner - dSplit : yInner + dSplit; // strictly on same side of 50%!

    var rawCorners = [
      { w: baseW, h: baseH, sx: xInner, sy: yInner },
      { w: baseW, h: baseH, sx: xOuter, sy: yInner },
      { w: baseW, h: baseH, sx: xInner, sy: yOuter },
      { w: baseW, h: baseH, sx: xOuter, sy: yOuter }
    ];
    var targetCorner = randInt(0, 3);
    var specs = [];
    for (var c = 0; c < 4; c += 1) {
      specs.push({
        isTarget: c === targetCorner,
        w: rawCorners[c].w,
        h: rawCorners[c].h,
        sx: rawCorners[c].sx,
        sy: rawCorners[c].sy
      });
    }

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
      delayMs: 2800, // 400ms mask + 2800ms silent retention = exact 3.2s post-flash retention
      maskSeed: randInt(100, 9999),
      targetWindow: specs[targetCorner],
      optionsWindows: optionsSpecs,
      targetPoints: [[20, 20], [80, 20], [80, 80], [20, 80]],
      optionsPoints: [[], [], [], []],
      correctIndex: correctIndex
    };
  }

  function generateControlTrials() {
    // 6 precision-calibrated positive-control trials (3 Rostral/DLPFC Stack+Rule, 3 Ventral 2D 0.8s+3.2s)
    var frontalBlock = shuffle([
      buildStackControlTrial(0),
      buildStackControlTrial(1),
      buildRuleInterruptControlTrial(2)
    ]);
    var visualBlock = shuffle([
      buildVisual2DPolygonTrial(3),
      buildVisual2DWindowTrial(4),
      Math.random() < 0.5 ? buildVisual2DPolygonTrial(5) : buildVisual2DWindowTrial(5)
    ]);
    var combined = frontalBlock.concat(visualBlock);
    for (var i = 0; i < combined.length; i += 1) {
      combined[i].trialIndex = i;
    }
    return combined;
  }

  function generateWarmupTrial(probeId) {
    if (probeId === "isolation") {
      return {
        words: ["شرط", "قصد", "حكم", "عذر"],
        distractorPool: shuffle(["شرط", "قصد", "حكم", "عذر", "فكرة", "خطة", "وقت", "يقين"]),
        taskPrompt: "(5 × 4) + 3 = ؟",
        taskOptions: buildZeroLeakNumericOptions(23, 4, true),
        taskAnswer: "23"
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
        wordPool: shuffle(["غرض", "عذر", "شرط", "هدف", "نهج", "وعد"])
      };
    }
    if (probeId === "binding") {
      var bList = generateBindingTrials(6);
      for (var i = 0; i < bList.length; i += 1) {
        if (bList[i].polarity === "flipped" && bList[i].entityCount === 3 && bList[i].targetRole !== "mid") {
          return bList[i];
        }
      }
      return bList[0];
    }
    if (probeId === "vigilance") {
      return {
        totalPulses: 4,
        cycleLength: 4,
        intervalsMs: [1450, 1700, 1400, 1650],
        flashDurationMs: 240,
        anticipationMs: 120,
        bounceGuardMs: 220,
        lapseThresholdMs: 850
      };
    }
    return buildVisual2DWindowTrial(0);
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

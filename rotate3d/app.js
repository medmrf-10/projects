/* ==========================================================================
   مِدار 3D — Application Controller
   Consumes window.Rotate3DEngine from ./engine3d.js
   Zero external dependencies · Pure ASCII numerals · Zero HTML tables
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    theme: 'midar3d_theme_v1',
    lang: 'midar3d_lang_v1',
    history: 'midar3d_history_v1'
  };

  const DEFAULT_LEVELS = [
    { level: 1, minCubes: 7, maxCubes: 8, minAngle: 30, maxAngle: 65, nameAr: 'تأسيسي', nameEn: 'Foundation' },
    { level: 2, minCubes: 8, maxCubes: 9, minAngle: 55, maxAngle: 100, nameAr: 'متوسط مبكر', nameEn: 'Early Intermediate' },
    { level: 3, minCubes: 9, maxCubes: 10, minAngle: 85, maxAngle: 140, nameAr: 'قياسي (شيبرد–ميتزلر)', nameEn: 'Standard (Shepard-Metzler)' },
    { level: 4, minCubes: 10, maxCubes: 11, minAngle: 115, maxAngle: 170, nameAr: 'متقدم', nameEn: 'Advanced' },
    { level: 5, minCubes: 11, maxCubes: 12, minAngle: 45, maxAngle: 180, nameAr: 'خبير', nameEn: 'Expert' }
  ];

  const I18N = {
    ar: {
      pageTitle: 'مِدار 3D — مختبر التدوير الذهني ثلاثي الأبعاد',
      appTitle: 'مِدار <span class="num" dir="ltr">3D</span>',
      appSubtitle: 'مختبر التدوير الذهني ثلاثي الأبعاد',
      themeLight: 'فاتح',
      themeDark: 'داكن',
      langSwitch: 'EN',
      tabTrain: 'تدريب',
      tabTest: 'اختبار',
      tabCompare: 'مقارنة',
      tabHistory: 'سجلي',
      urlChallengeTag: 'رابط تحدٍّ مشترك',
      startSharedChallenge: 'ابدأ نفس التحدي الآن',
      dismiss: 'تجاهل',
      formatLabel: 'النمط',
      formatPairShort: 'شكلان 3D',
      formatQuadShort: 'اختيار من 4',
      formatPairFull: 'شكلان 3D (نفس / مختلف)',
      formatQuadFull: 'اختيار من 4 (AZTest)',
      difficultyLabel: 'المستوى',
      adaptiveShort: 'تكيّفي',
      adaptiveFull: 'تكيّفي تلقائي',
      adaptiveDesc: 'يتدرّج تلقائياً حسب أدائك',
      levelWord: 'المستوى',
      cubesWord: 'مكعبات',
      currentLevel: 'المستوى',
      accuracy: 'الدقة',
      streak: 'السلسلة',
      saveTraining: 'حفظ في السجل',
      untimedCalm: 'تدريب هادئ بلا وقت',
      orbitUnlocked: 'اسحب للتدوير 3D',
      refFigure: 'الشكل المرجعي',
      targetFigure: 'الشكل المقارَن',
      dragHint: 'اسحب للتدوير',
      optionWord: 'خيار',
      pickOption: 'اختيار',
      promptPair: 'هل الشكل المقارَن هو نفس المجسم بعد تدويره ثلاثي الأبعاد أم معكوس مرآوياً؟',
      promptQuad: 'أيُّ شكلٍ من الخيارات الأربعة يطابق الشكل المرجعي بالتدوير ثلاثي الأبعاد فقط؟',
      sameFigureBtn: 'نفس المجسم (دوران)',
      sameFigureSub: 'يطابقه بالتدوير ثلاثي الأبعاد',
      diffFigureBtn: 'مختلف (معكوس مرآوياً)',
      diffFigureSub: 'صورة مرآوية لا تطابقه بالدوران',
      sameShort: 'نفس المجسم',
      diffShort: 'معكوس مرآوياً',
      verdictCorrect: 'إجابة صحيحة',
      verdictWrong: 'إجابة خاطئة',
      verdictTimeout: 'انتهى الوقت',
      explainSame: 'هذان الشكلان يمثلان نفس المجسم تماماً؛ يمكن مطابقتهما بدوران ثلاثي الأبعاد مباشر.',
      explainDiff: 'الشكل المقارَن صورة مرآوية (متعاكس يدوياً) ولا يمكن مطابقته بأي دوران ثلاثي الأبعاد.',
      explainQuadCorrect: 'الخيار الصحيح يطابق المجسم المرجعي بدوران ثلاثي الأبعاد، بينما الخيارات الثلاثة الأخرى معكوسة مرآوياً.',
      anglePrefix: 'زاوية الدوران:',
      timePrefix: 'الزمن:',
      nextQuestion: 'السؤال التالي',
      watchLiveRotation: 'شاهد الدوران الحي',
      playingRotation: 'جارٍ التدوير الحي...',
      toggleAnchor: 'تمييز الطرف المرجعي',
      resetView: 'إعادة الزاوية',
      orbitTip: 'اسحب أي مجسم بإصبعك أو الفأرة لتدويره بحرّية وملاحظة اتجاه الذراع الطرفية.',
      testSetupTitle: 'إعداد الاختبار القياسي',
      testSetupDesc: 'تقييم دقيق بأسلوب شيبرد–ميتزلر مع تحليل زوايا الدوران ورمز مشاركة للمقارنة.',
      questionCountLabel: 'عدد الأسئلة',
      timerLabel: 'الوقت',
      timerNone: 'بلا وقت',
      timer3m: '3 دقائق',
      timer5m: '5 دقائق',
      playerNameOptional: 'اسم المتدرب (اختياري)',
      defaultPlayer1: 'اللاعب 1',
      defaultPlayer2: 'اللاعب 2',
      seedLabel: 'رمز مجموعة الأسئلة (Seed)',
      newSeed: 'رمز جديد',
      startTest: 'ابدأ الاختبار',
      exitTest: 'إنهاء',
      questionWord: 'السؤال',
      scoreLabel: 'النقاط',
      performanceScore: 'نقاط الأداء',
      correctAnswers: 'الإجابات الصحيحة',
      totalTime: 'الزمن الكلي',
      avgTimePerQ: 'متوسط / وسيط السؤال',
      medianShort: 'الوسيط',
      meanShort: 'المتوسط',
      levelProgress: 'تقدّم المستوى',
      angleCurveTitle: 'منحنى شيبرد–ميتزلر لزوايا الدوران',
      angleCurveDesc: 'الدقة ووسيط زمن الاستجابة عبر نطاقات زوايا الدوران الثلاثية الأبعاد.',
      bandSmall: 'زوايا صغيرة',
      bandMedium: 'زوايا متوسطة',
      bandLarge: 'زوايا كبيرة',
      shareAndCompare: 'المشاركة والمقارنة',
      copySameTestLink: 'نسخ رابط نفس الاختبار',
      copyResultCode: 'نسخ رمز النتيجة (M3D)',
      compareWithOther: 'قارن مع لاعب آخر',
      newTestBtn: 'اختبار جديد',
      reviewTitle: 'مراجعة الأسئلة بالدوران الحي',
      filterAll: 'الكل',
      filterWrong: 'الخاطئة فقط',
      filterCorrect: 'الصحيحة',
      filterTests: 'اختبارات',
      filterCompares: 'مقارنات',
      yourChoice: 'إجابتك',
      correctChoice: 'الصحيح',
      replay3dBtn: 'عرض الدوران 3D',
      noFilterItems: 'لا توجد عناصر ضمن هذا التصنيف.',
      comparePassMode: 'على نفس الهاتف (بالتناوب)',
      compareRemoteMode: 'على جهازَين (رابط + رمز النتيجة)',
      passSetupTitle: 'مقارنة مباشرة على نفس الجهاز',
      passSetupDesc: 'يخوض اللاعبان نفس المجسمات ثلاثية الأبعاد وبنفس الزوايا والترتيب تماماً للمقارنة العادلة.',
      player1Label: 'اسم اللاعب 1',
      player2Label: 'اسم اللاعب 2',
      startRoundPrefix: 'ابدأ جولة',
      handoffDonePrefix: 'أنهى',
      handoffDoneSuffix: 'جولته بنجاح',
      handoffPassPrefix: 'سلّم الجهاز الآن إلى',
      handoffPassSuffix: 'لبدء نفس المجسمات والزوايا تماماً دون كشف النتائج.',
      cancelMatch: 'إلغاء المقارنة',
      remoteStep1Title: '1. شارك رابط نفس التحدي',
      remoteStep1Desc: 'أرسل هذا الرابط إلى الجهاز الثاني ليحصل كلاكما على نفس المجسمات والزوايا بالضبط.',
      copyChallengeLink: 'نسخ رابط التحدي',
      playThisChallenge: 'ابدأ جولتي الآن',
      remoteStep2Title: '2. الصق رمزَي النتيجة للمقارنة',
      remoteStep2Desc: 'بعد إنهاء الاختبار على كل جهاز، انسخ رمز النتيجة (<span class="num" dir="ltr">M3D-...</span>) وألصقه هنا.',
      codeALabel: 'رمز نتيجة اللاعب الأول',
      codeBLabel: 'رمز نتيجة اللاعب الثاني',
      compareNow: 'عرض المقارنة المباشرة',
      fillMyLastResult: 'تعبئة آخر اختبار لي',
      codeErrorBoth: 'الرجاء إدخال رمزَي النتيجة معاً للمقارنة.',
      codeErrorInvalidA: 'رمز نتيجة اللاعب الأول غير صالح أو ناقص.',
      codeErrorInvalidB: 'رمز نتيجة اللاعب الثاني غير صالح أو ناقص.',
      noLastTestYet: 'أنهِ اختباراً واحداً على الأقل لتعبئة رمزك تلقائياً.',
      h2hTitle: 'لوحة المقارنة المباشرة',
      winnerLabel: 'الأعلى أداءً:',
      tieLabel: 'تعادل تام في الأداء',
      exactSameSeed: 'نفس التحدي والمجسمات بالضبط',
      differentSeedNotice: 'تنبيه: الرمزان من مجموعتَي أسئلة مختلفتين؛ المقارنة إحصائية عامة.',
      angleBandsCompare: 'مقارنة الأداء حسب زوايا الدوران',
      agreementTitle: 'تطابق الإجابات سؤالاً بسؤال',
      bothCorrect: 'أصابها كلاهما',
      onlyP1: 'أصابها الأول فقط',
      onlyP2: 'أصابها الثاني فقط',
      bothWrong: 'أخطأ فيها كلاهما',
      newMatchBtn: 'جولة مقارنة جديدة',
      historyTitle: 'سجل الأداء والتقدّم',
      historySessions: 'إجمالي الجلسات',
      historyBestScore: 'أعلى نقاط',
      historyAvgAcc: 'متوسط الدقة',
      historyBestLevel: 'أعلى مستوى',
      trendTitle: 'منحنى تطوّر الدقة والنقاط',
      trendNeedTwo: 'أكمل اختبارين على الأقل لعرض منحنى التقدّم الزمني.',
      historyEmptyTitle: 'لا توجد جلسات محفوظة بعد',
      historyEmptyDesc: 'أكمل اختباراً قياسياً أو جولة مقارنة لتظهر نتائجك ومنحنى تطوّرك هنا محلياً.',
      goToTest: 'ابدأ أول اختبار',
      viewDetails: 'عرض التفاصيل',
      replaySeed: 'إعادة نفس الرمز',
      clearHistory: 'مسح السجل',
      confirmClearHistory: 'تأكيد المسح النهائي',
      cancelWord: 'إلغاء',
      typeTest: 'اختبار قياسي',
      typeCompare: 'مقارنة ثنائية',
      typeTrain: 'جلسة تدريب',
      toastCopiedLink: 'تم نسخ رابط التحدي بنجاح',
      toastCopiedCode: 'تم نسخ رمز النتيجة بنجاح',
      toastCopyFallback: 'انسخ النص المحدد يدوياً',
      toastSavedTrain: 'تم حفظ جلسة التدريب في السجل',
      toastHistoryCleared: 'تم مسح السجل المحلي',
      toastFilledCode: 'تمت تعبئة رمز آخر اختبار لك',
      replayModalTitlePrefix: 'مراجعة السؤال',
      noDataDash: '—',
      engineMissing: 'تعذّر تحميل محرك المجسمات ثلاثية الأبعاد.'
    },
    en: {
      pageTitle: 'Midar 3D — 3D Mental Rotation Lab',
      appTitle: 'Midar <span class="num" dir="ltr">3D</span>',
      appSubtitle: '3D Mental Rotation Lab',
      themeLight: 'Light',
      themeDark: 'Dark',
      langSwitch: 'عربي',
      tabTrain: 'Train',
      tabTest: 'Test',
      tabCompare: 'Compare',
      tabHistory: 'History',
      urlChallengeTag: 'Shared Challenge Link',
      startSharedChallenge: 'Start This Challenge Now',
      dismiss: 'Dismiss',
      formatLabel: 'Format',
      formatPairShort: '2 Figures 3D',
      formatQuadShort: '4-Choice',
      formatPairFull: '2 Figures 3D (Same / Mirror)',
      formatQuadFull: '4-Choice (AZTest Style)',
      difficultyLabel: 'Level',
      adaptiveShort: 'Adaptive',
      adaptiveFull: 'Auto Adaptive',
      adaptiveDesc: 'Adjusts smoothly to your accuracy',
      levelWord: 'Level',
      cubesWord: 'cubes',
      currentLevel: 'Level',
      accuracy: 'Accuracy',
      streak: 'Streak',
      saveTraining: 'Save to History',
      untimedCalm: 'Untimed calm practice',
      orbitUnlocked: 'Drag to Orbit 3D',
      refFigure: 'Reference Figure',
      targetFigure: 'Comparison Figure',
      dragHint: 'Drag to orbit',
      optionWord: 'Option',
      pickOption: 'Select',
      promptPair: 'Is the comparison figure the SAME 3D object rotated, or a MIRROR image?',
      promptQuad: 'Which of the 4 figures matches the reference by pure 3D rotation?',
      sameFigureBtn: 'Same Figure (Rotated)',
      sameFigureSub: 'Matches via 3D rigid rotation',
      diffFigureBtn: 'Different (Mirrored)',
      diffFigureSub: 'Chiral mirror cannot align',
      sameShort: 'Same (Rotated)',
      diffShort: 'Mirror Image',
      verdictCorrect: 'Correct Answer',
      verdictWrong: 'Incorrect Answer',
      verdictTimeout: 'Time Up',
      explainSame: 'Both figures are the exact same 3D polycube related by a rigid rotation.',
      explainDiff: 'The comparison figure is a chiral mirror enantiomorph that no 3D rotation can align.',
      explainQuadCorrect: 'The highlighted option matches by 3D rotation; the other three are mirror enantiomorphs.',
      anglePrefix: 'Rotation angle:',
      timePrefix: 'Time:',
      nextQuestion: 'Next Question',
      watchLiveRotation: 'Watch Live Rotation',
      playingRotation: 'Animating 3D...',
      toggleAnchor: 'Highlight Reference Tip',
      resetView: 'Reset View',
      orbitTip: 'Drag any figure with touch or mouse to inspect how the end-arm aligns or flips.',
      testSetupTitle: 'Standard Test Setup',
      testSetupDesc: 'Shepard-Metzler assessment with angle-curve insights and shareable result codes.',
      questionCountLabel: 'Questions',
      timerLabel: 'Timer',
      timerNone: 'Untimed',
      timer3m: '3 min',
      timer5m: '5 min',
      playerNameOptional: 'Player Name (optional)',
      defaultPlayer1: 'Player 1',
      defaultPlayer2: 'Player 2',
      seedLabel: 'Session Seed',
      newSeed: 'New Seed',
      startTest: 'Start Test',
      exitTest: 'Exit',
      questionWord: 'Question',
      scoreLabel: 'Score',
      performanceScore: 'Performance Score',
      correctAnswers: 'Correct Answers',
      totalTime: 'Total Time',
      avgTimePerQ: 'Median / Mean Time',
      medianShort: 'Median',
      meanShort: 'Mean',
      levelProgress: 'Level Progress',
      angleCurveTitle: 'Shepard-Metzler Angle Curve',
      angleCurveDesc: 'Accuracy and median response time across 3D rotation angle bands.',
      bandSmall: 'Small Angles',
      bandMedium: 'Medium Angles',
      bandLarge: 'Large Angles',
      shareAndCompare: 'Share & Compare',
      copySameTestLink: 'Copy Same Test Link',
      copyResultCode: 'Copy Result Code (M3D)',
      compareWithOther: 'Compare With Another Player',
      newTestBtn: 'New Test',
      reviewTitle: 'Question Review with Live 3D Replay',
      filterAll: 'All',
      filterWrong: 'Missed Only',
      filterCorrect: 'Correct',
      filterTests: 'Tests',
      filterCompares: 'Matches',
      yourChoice: 'Picked',
      correctChoice: 'Correct',
      replay3dBtn: '3D Replay',
      noFilterItems: 'No items match this filter.',
      comparePassMode: 'Same Device (Pass & Play)',
      compareRemoteMode: 'Two Devices (Link + Code)',
      passSetupTitle: 'Pass-and-Play 2-Player Match',
      passSetupDesc: 'Both players solve the exact same seeded 3D figures and angles in order.',
      player1Label: 'Player 1 Name',
      player2Label: 'Player 2 Name',
      startRoundPrefix: 'Start Round:',
      handoffDonePrefix: 'Finished:',
      handoffDoneSuffix: '',
      handoffPassPrefix: 'Hand the device to',
      handoffPassSuffix: 'to play the exact same 3D shapes & angles with scores hidden.',
      cancelMatch: 'Cancel Match',
      remoteStep1Title: '1. Share the Exact Challenge Link',
      remoteStep1Desc: 'Send this link to the second device so both players get identical 3D figures.',
      copyChallengeLink: 'Copy Challenge Link',
      playThisChallenge: 'Play My Round Now',
      remoteStep2Title: '2. Paste Both Result Codes',
      remoteStep2Desc: 'After each player finishes, paste both <span class="num" dir="ltr">M3D-...</span> result codes below.',
      codeALabel: 'Player 1 Result Code',
      codeBLabel: 'Player 2 Result Code',
      compareNow: 'Compare Side-by-Side',
      fillMyLastResult: 'Fill My Latest Test',
      codeErrorBoth: 'Please paste both result codes to compare.',
      codeErrorInvalidA: 'Player 1 result code is invalid or incomplete.',
      codeErrorInvalidB: 'Player 2 result code is invalid or incomplete.',
      noLastTestYet: 'Finish at least one test to auto-fill your result code.',
      h2hTitle: 'Head-to-Head Comparison',
      winnerLabel: 'Top Performance:',
      tieLabel: 'Exact Tie',
      exactSameSeed: 'Exact Same Seeded Figures',
      differentSeedNotice: 'Note: Codes came from different seeds; statistical comparison shown.',
      angleBandsCompare: 'Rotation Angle Band Comparison',
      agreementTitle: 'Question-by-Question Agreement',
      bothCorrect: 'Both Correct',
      onlyP1: 'Player 1 Only',
      onlyP2: 'Player 2 Only',
      bothWrong: 'Both Missed',
      newMatchBtn: 'New Comparison Match',
      historyTitle: 'Session History & Progress',
      historySessions: 'Total Sessions',
      historyBestScore: 'Best Score',
      historyAvgAcc: 'Average Accuracy',
      historyBestLevel: 'Highest Level',
      trendTitle: 'Accuracy & Score Trend',
      trendNeedTwo: 'Complete at least 2 tests to plot your progress trend.',
      historyEmptyTitle: 'No Saved Sessions Yet',
      historyEmptyDesc: 'Complete a Standard Test or 2-Player Comparison to track your progress locally.',
      goToTest: 'Start First Test',
      viewDetails: 'View Details',
      replaySeed: 'Replay Seed',
      clearHistory: 'Clear History',
      confirmClearHistory: 'Confirm Clear All',
      cancelWord: 'Cancel',
      typeTest: 'Standard Test',
      typeCompare: '2-Player Match',
      typeTrain: 'Training Session',
      toastCopiedLink: 'Challenge link copied',
      toastCopiedCode: 'Result code copied',
      toastCopyFallback: 'Copy the highlighted text manually',
      toastSavedTrain: 'Training session saved to history',
      toastHistoryCleared: 'Local history cleared',
      toastFilledCode: 'Loaded your latest test code',
      replayModalTitlePrefix: 'Review Question',
      noDataDash: '—',
      engineMissing: 'Failed to load 3D rotation engine.'
    }
  };

  /* ------------------------------------------------------------------------
     Utility Helpers (Pure ASCII Numerals, Safe Escaping, Time Formatting)
     ------------------------------------------------------------------------ */

  function getEngine() {
    return window.Rotate3DEngine || null;
  }

  function getLevels() {
    const eng = getEngine();
    return eng && Array.isArray(eng.LEVELS) && eng.LEVELS.length ? eng.LEVELS : DEFAULT_LEVELS;
  }

  function t(key) {
    const dict = I18N[state.lang] || I18N.ar;
    return dict[key] !== undefined ? dict[key] : key;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toAsciiDigits(str) {
    return String(str).replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
  }

  function numSpan(val, extraClass) {
    const cls = extraClass ? `num ${extraClass}` : 'num';
    return `<span class="${cls}" dir="ltr">${escapeHtml(toAsciiDigits(val))}</span>`;
  }

  function pad2(n) {
    const v = Math.max(0, Math.floor(Number(n) || 0));
    return v < 10 ? '0' + v : String(v);
  }

  function formatClock(totalSeconds) {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }

  function formatMs(ms) {
    const val = Math.max(0, Number(ms) || 0);
    if (val === 0) return '0.0s';
    if (val < 60000) {
      return `${(val / 1000).toFixed(1)}s`;
    }
    const totalSec = Math.round(val / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }

  function formatPct(acc) {
    const n = Number(acc);
    if (!Number.isFinite(n)) return '0.0%';
    const clamped = Math.max(0, Math.min(100, n));
    return `${clamped.toFixed(1)}%`;
  }

  function normalizePctNumber(acc) {
    const n = Number(acc);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function formatDateAscii(ts) {
    const d = new Date(ts || Date.now());
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function getLevelMeta(lvl) {
    const levels = getLevels();
    const n = Number(lvl);
    return levels.find((item) => item.level === n) || levels[0];
  }

  function formatLevelLabel(lvl) {
    if (lvl === 'adaptive') return t('adaptiveShort');
    const meta = getLevelMeta(lvl);
    const name = state.lang === 'ar' ? meta.nameAr : meta.nameEn;
    return `${t('levelWord')} ${numSpan(meta.level)} · ${escapeHtml(name)}`;
  }

  function formatFormatLabel(fmt) {
    return fmt === 'quad' ? t('formatQuadShort') : t('formatPairShort');
  }

  function formatTimerLabel(sec) {
    const s = Number(sec) || 0;
    if (s <= 0) return t('timerNone');
    if (s === 180) return t('timer3m');
    if (s === 300) return t('timer5m');
    return `${Math.round(s / 60)}m`;
  }

  function sanitizeSeed(raw) {
    const eng = getEngine();
    const cleaned = toAsciiDigits(String(raw || '').trim().toUpperCase()).replace(/[^A-Z0-9-]/g, '');
    if (cleaned.length >= 3) return cleaned.slice(0, 16);
    return eng && typeof eng.createSeedCode === 'function' ? eng.createSeedCode() : 'SM-1024';
  }

  function sanitizePlayerName(raw, fallbackKey) {
    const trimmed = String(raw || '').trim();
    return trimmed ? trimmed.slice(0, 24) : t(fallbackKey);
  }

  function computeFallbackScore(results, startLevel) {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    const accuracy = total ? (correct / total) * 100 : 0;
    const rts = results.map((r) => Number(r.rtMs) || 0).filter((v) => v > 0);
    const totalMs = rts.reduce((a, b) => a + b, 0);
    const meanMs = rts.length ? Math.round(totalMs / rts.length) : 0;
    const sorted = [...rts].sort((a, b) => a - b);
    const medianMs = sorted.length
      ? sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : 0;
    const speedFactor = medianMs > 0 ? Math.max(0.55, Math.min(1.35, 6500 / medianMs)) : 1;
    const sLvl = Number(startLevel) || 3;
    const score = Math.round(accuracy * 8 * speedFactor * (1 + (sLvl - 1) * 0.08));
    let nextLevel = sLvl;
    if (accuracy >= 85 && sLvl < 5) nextLevel = sLvl + 1;
    else if (accuracy < 55 && sLvl > 1) nextLevel = sLvl - 1;

    const bands = {};
    ['small', 'medium', 'large'].forEach((b) => {
      const subset = results.filter((r) => r.angleBand === b);
      const bTotal = subset.length;
      const bCorrect = subset.filter((r) => r.correct).length;
      const bRts = subset.map((r) => Number(r.rtMs) || 0).filter((v) => v > 0).sort((a, b2) => a - b2);
      const bMedian = bRts.length
        ? bRts.length % 2
          ? bRts[Math.floor(bRts.length / 2)]
          : Math.round((bRts[bRts.length / 2 - 1] + bRts[bRts.length / 2]) / 2)
        : 0;
      bands[b] = {
        correct: bCorrect,
        total: bTotal,
        accuracy: bTotal ? (bCorrect / bTotal) * 100 : 0,
        medianMs: bMedian
      };
    });

    return {
      score,
      accuracy,
      correct,
      total,
      totalMs,
      medianMs,
      meanMs,
      startLevel: sLvl,
      nextLevel,
      bands
    };
  }

  function safeComputeScore(results, startLevel) {
    const eng = getEngine();
    const numericStart = startLevel === 'adaptive' ? 2 : Number(startLevel) || 3;
    if (eng && typeof eng.computeScore === 'function') {
      try {
        const res = eng.computeScore(results, numericStart);
        if (res && typeof res.score === 'number') {
          return normalizeScoreObject(res, results, numericStart);
        }
      } catch (_err) {
        // fallback below
      }
    }
    return computeFallbackScore(results, numericStart);
  }

  function normalizeScoreObject(raw, results, numericStart) {
    const fb = computeFallbackScore(results || [], numericStart);
    const acc = normalizePctNumber(raw.accuracy !== undefined ? raw.accuracy : fb.accuracy);
    const normBand = (key) => {
      const b = raw.bands && raw.bands[key] ? raw.bands[key] : fb.bands[key];
      return {
        correct: Number(b.correct) || 0,
        total: Number(b.total) || 0,
        accuracy: normalizePctNumber(b.accuracy),
        medianMs: Number(b.medianMs) || 0
      };
    };
    return {
      score: Math.round(Number(raw.score) || 0),
      accuracy: acc,
      correct: Number(raw.correct !== undefined ? raw.correct : fb.correct) || 0,
      total: Number(raw.total !== undefined ? raw.total : fb.total) || 0,
      totalMs: Math.round(Number(raw.totalMs !== undefined ? raw.totalMs : fb.totalMs) || 0),
      medianMs: Math.round(Number(raw.medianMs !== undefined ? raw.medianMs : fb.medianMs) || 0),
      meanMs: Math.round(Number(raw.meanMs !== undefined ? raw.meanMs : fb.meanMs) || 0),
      startLevel: Number(raw.startLevel || numericStart) || numericStart,
      nextLevel: Number(raw.nextLevel || fb.nextLevel) || numericStart,
      bands: {
        small: normBand('small'),
        medium: normBand('medium'),
        large: normBand('large')
      }
    };
  }

  function buildBitmask(results) {
    return (results || []).map((r) => (r && r.correct ? '1' : '0')).join('');
  }

  function safeEncodeResultCode(run) {
    const eng = getEngine();
    const bitmask = buildBitmask(run.results);
    const payload = {
      name: run.playerName,
      seed: run.seed,
      format: run.format,
      level: run.level,
      count: run.count,
      timerSec: run.timerSec || 0,
      score: run.metrics.score,
      accuracy: Number(run.metrics.accuracy.toFixed(1)),
      correct: run.metrics.correct,
      total: run.metrics.total,
      totalMs: run.metrics.totalMs,
      medianMs: run.metrics.medianMs,
      meanMs: run.metrics.meanMs,
      startLevel: run.metrics.startLevel,
      nextLevel: run.metrics.nextLevel,
      bitmask,
      bands: run.metrics.bands
    };
    if (eng && typeof eng.encodeResultCode === 'function') {
      return eng.encodeResultCode(payload);
    }
    return '';
  }

  function safeDecodeResultCode(codeStr) {
    const trimmed = String(codeStr || '').trim();
    if (!trimmed) return null;
    const eng = getEngine();
    if (eng && typeof eng.decodeResultCode === 'function') {
      const decoded = eng.decodeResultCode(trimmed);
      if (!decoded || typeof decoded !== 'object') return null;
      return normalizeDecodedRun(decoded, trimmed);
    }
    return null;
  }

  function normalizeDecodedRun(obj, rawCode) {
    const total = Number(obj.total || obj.count || 0);
    if (!obj.seed || total <= 0) return null;
    const bitsStr = typeof obj.bitmask === 'string'
      ? obj.bitmask
      : typeof obj.bits === 'string'
        ? obj.bits
        : Array.isArray(obj.results)
          ? obj.results.map((r) => (r ? '1' : '0')).join('')
          : '';
    const normBand = (key) => {
      const b = obj.bands && obj.bands[key] ? obj.bands[key] : { correct: 0, total: 0, accuracy: 0, medianMs: 0 };
      return {
        correct: Number(b.correct) || 0,
        total: Number(b.total) || 0,
        accuracy: normalizePctNumber(b.accuracy),
        medianMs: Number(b.medianMs) || 0
      };
    };
    const results = [];
    for (let i = 0; i < total; i++) {
      const isOk = bitsStr[i] === '1';
      results.push({
        index: i,
        correct: isOk,
        isCorrect: isOk,
        rtMs: 0,
        timedOut: false,
        fromCodeOnly: true
      });
    }
    return {
      playerName: String(obj.name || obj.playerName || t('defaultPlayer1')),
      seed: sanitizeSeed(obj.seed),
      format: obj.format === 'quad' ? 'quad' : 'pair',
      level: obj.level === 'adaptive' ? 'adaptive' : (Number(obj.level) || Number(obj.startLevel) || 3),
      count: total,
      timerSec: Number(obj.timerSec) || 0,
      metrics: {
        score: Math.round(Number(obj.score) || 0),
        accuracy: normalizePctNumber(obj.accuracy !== undefined ? obj.accuracy : (total ? (Number(obj.correct) / total) * 100 : 0)),
        correct: Number(obj.correct) || 0,
        total,
        totalMs: Math.round(Number(obj.totalMs) || 0),
        medianMs: Math.round(Number(obj.medianMs) || 0),
        meanMs: Math.round(Number(obj.meanMs) || 0),
        startLevel: Number(obj.startLevel || (obj.level === 'adaptive' ? 2 : obj.level) || 3),
        nextLevel: Number(obj.nextLevel || obj.startLevel || 3),
        bands: {
          small: normBand('small'),
          medium: normBand('medium'),
          large: normBand('large')
        }
      },
      results,
      resultCode: rawCode,
      trials: null
    };
  }

  function buildChallengeUrl(cfg) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('seed', sanitizeSeed(cfg.seed));
    url.searchParams.set('format', cfg.format === 'quad' ? 'quad' : 'pair');
    url.searchParams.set('level', String(cfg.level));
    url.searchParams.set('count', String(cfg.count));
    url.searchParams.set('timer', String(Number(cfg.timerSec) || 0));
    return url.toString();
  }

  async function copyText(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(successMsg);
        return true;
      }
    } catch (_err) {
      // fallback below
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_err) {
      ok = false;
    }
    document.body.removeChild(ta);
    showToast(ok ? successMsg : t('toastCopyFallback'));
    return ok;
  }

  /* ------------------------------------------------------------------------
     Application State
     ------------------------------------------------------------------------ */

  const state = {
    lang: 'ar',
    theme: 'light',
    activeTab: 'train',
    toastTimer: null,
    urlChallenge: null,
    lastTestRun: null,
    history: [],
    historyFilter: 'all',
    confirmClearHistory: false,

    train: {
      format: 'pair',
      difficulty: 'adaptive',
      adaptiveLevel: 1,
      adaptiveMissStreak: 0,
      seed: '',
      trialIndex: 0,
      sameStreak: 0,
      lastSameVal: null,
      currentTrial: null,
      trialStartMs: 0,
      answered: false,
      lastAnswer: null,
      showAnchor: false,
      animating: false,
      streak: 0,
      history: [],
      viewports: []
    },

    testConfig: {
      format: 'pair',
      level: 3,
      count: 12,
      timerSec: 0,
      seed: ''
    },

    compareConfig: {
      subMode: 'pass',
      format: 'pair',
      level: 3,
      count: 8,
      timerSec: 0,
      seed: ''
    },

    runner: {
      active: false,
      mode: 'test', // 'test' | 'pass-p1' | 'pass-p2' | 'remote-self'
      config: null,
      playerName: '',
      trials: [],
      currentIndex: 0,
      trialStartMs: 0,
      sessionStartMs: 0,
      timerId: null,
      locked: false,
      results: [],
      viewports: []
    },

    passMatch: {
      p1Name: '',
      p2Name: '',
      config: null,
      trials: [],
      p1Run: null,
      p2Run: null
    },

    activeTestResult: null,
    activeTestFilter: 'all',
    activeCompareMatch: null,

    replay: {
      open: false,
      trial: null,
      showAnchor: true,
      viewports: []
    }
  };

  /* ------------------------------------------------------------------------
     DOM References
     ------------------------------------------------------------------------ */

  const dom = {};

  function cacheDom() {
    const ids = [
      'btnLangToggle', 'langToggleLabel', 'btnThemeToggle', 'themeIconSun', 'themeIconMoon', 'themeToggleLabel',
      'tabBtnTrain', 'tabBtnTest', 'tabBtnCompare', 'tabBtnHistory',
      'panelTrain', 'panelTest', 'panelCompare', 'panelHistory',
      'urlChallengeBanner', 'urlChallengeSeed', 'urlChallengeDesc', 'btnStartUrlChallenge', 'btnDismissUrlChallenge',
      'trainFormatSeg', 'trainLevelPills', 'trainLevelReadout', 'trainAccReadout', 'trainStreakReadout', 'btnSaveTrainSession',
      'trainQuestionPrompt', 'trainCalmBadge', 'trainOrbitBadge',
      'trainPairGrid', 'trainRefBox', 'trainTargetBox', 'trainRefHint', 'trainTargetHint', 'trainRefCanvas', 'trainTargetCanvas',
      'trainQuadLayout', 'trainQuadRefHint', 'trainQuadRefCanvas', 'trainQuadOptionsGrid',
      'trainDecisionRow', 'btnTrainSame', 'btnTrainDiff',
      'trainRevealPanel', 'trainVerdictTitle', 'trainAngleBadge', 'trainRtBadge', 'trainVerdictExplain',
      'btnTrainNext', 'btnTrainAnimate', 'btnTrainAnchor', 'btnTrainResetView', 'trainRevealTip',
      'testSetupView', 'testFormatSeg', 'testLevelGrid', 'testCountSeg', 'testTimerSeg',
      'testPlayerName', 'testSeedInput', 'btnTestNewSeed', 'btnStartTest',
      'testRunnerView', 'runnerPlayerBadge', 'runnerProgressText', 'runnerSeedBadge',
      'runnerTimerReadout', 'btnCancelTest', 'runnerProgressFill', 'runnerQuestionPrompt',
      'runnerPairGrid', 'runnerRefCanvas', 'runnerTargetCanvas',
      'runnerQuadLayout', 'runnerQuadRefCanvas', 'runnerQuadOptionsGrid',
      'runnerDecisionRow', 'btnRunnerSame', 'btnRunnerDiff',
      'testResultsView',
      'compareModeSeg', 'comparePassSetup', 'p1NameInput', 'p2NameInput',
      'cmpFormatSeg', 'cmpLevelPills', 'cmpCountSeg', 'cmpTimerSeg', 'cmpSeedInput', 'btnCmpNewSeed', 'btnStartPassP1',
      'compareHandoffView', 'handoffTitle', 'handoffDesc', 'handoffMeta', 'btnStartPassP2', 'btnAbortHandoff',
      'compareRemoteView', 'remoteShareUrl', 'btnCopyRemoteUrl', 'btnPlayRemoteSelf', 'btnRemoteNewSeed',
      'codeInputA', 'codeInputB', 'remoteCodeError', 'btnCompareCodes', 'btnUseLastTestCode',
      'compareResultsView',
      'historyContent',
      'replayModal', 'replayModalTitle', 'replayModalSubtitle', 'btnCloseReplayModal', 'replayVerdictStrip',
      'replayPairGrid', 'replayRefCanvas', 'replayTargetCanvas',
      'replayQuadLayout', 'replayQuadRefCanvas', 'replayQuadOptionsGrid',
      'btnReplayAnimate', 'btnReplayAnchor', 'btnReplayReset',
      'appToast'
    ];
    ids.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  /* ------------------------------------------------------------------------
     Toast, Persistence, Viewport Lifecycle
     ------------------------------------------------------------------------ */

  function showToast(msg) {
    if (!dom.appToast) return;
    dom.appToast.textContent = toAsciiDigits(msg);
    dom.appToast.classList.remove('hidden');
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      dom.appToast.classList.add('hidden');
    }, 2400);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.history);
      const parsed = raw ? JSON.parse(raw) : [];
      state.history = Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      state.history = [];
    }
  }

  function persistHistory() {
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history.slice(0, 60)));
    } catch (_err) {
      // ignore storage quota errors
    }
  }

  function addHistoryEntry(entry) {
    state.history.unshift(entry);
    if (state.history.length > 60) state.history.length = 60;
    persistHistory();
  }

  function destroyPool(pool) {
    if (!Array.isArray(pool)) return;
    pool.forEach((vp) => {
      if (vp && typeof vp.destroy === 'function') {
        try { vp.destroy(); } catch (_err) { /* noop */ }
      }
    });
    pool.length = 0;
  }

  function resizePool(pool) {
    if (!Array.isArray(pool)) return;
    pool.forEach((vp) => {
      if (vp && typeof vp.resize === 'function') {
        try { vp.resize(); } catch (_err) { /* noop */ }
      }
    });
  }

  function setPoolTheme(pool, theme) {
    if (!Array.isArray(pool)) return;
    pool.forEach((vp) => {
      if (vp && typeof vp.setTheme === 'function') {
        try { vp.setTheme(theme); } catch (_err) { /* noop */ }
      }
    });
  }

  function createVp(canvas, opts) {
    const eng = getEngine();
    if (!eng || typeof eng.createViewport !== 'function' || !canvas) return null;
    return eng.createViewport(canvas, {
      theme: state.theme,
      interactive: Boolean(opts && opts.interactive),
      showAnchor: Boolean(opts && opts.showAnchor)
    });
  }

  function scheduleResizeAll() {
    requestAnimationFrame(() => {
      resizePool(state.train.viewports);
      resizePool(state.runner.viewports);
      resizePool(state.replay.viewports);
    });
  }

  /* ------------------------------------------------------------------------
     Theme & Language Switching
     ------------------------------------------------------------------------ */

  function applyTheme(theme) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme;
    try { localStorage.setItem(STORAGE_KEYS.theme, state.theme); } catch (_e) { /* noop */ }

    const isDark = state.theme === 'dark';
    dom.themeIconSun.classList.toggle('hidden', !isDark);
    dom.themeIconMoon.classList.toggle('hidden', isDark);
    dom.themeToggleLabel.textContent = isDark ? t('themeLight') : t('themeDark');

    setPoolTheme(state.train.viewports, state.theme);
    setPoolTheme(state.runner.viewports, state.theme);
    setPoolTheme(state.replay.viewports, state.theme);
  }

  function applyLanguage(lang) {
    const prevLang = state.lang;
    state.lang = lang === 'en' ? 'en' : 'ar';
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('pageTitle');
    try { localStorage.setItem(STORAGE_KEYS.lang, state.lang); } catch (_e) { /* noop */ }

    dom.langToggleLabel.textContent = t('langSwitch');
    dom.themeToggleLabel.textContent = state.theme === 'dark' ? t('themeLight') : t('themeDark');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val.indexOf('<span') !== -1) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Update neutral default names if unchanged
    const prevP1 = I18N[prevLang] ? I18N[prevLang].defaultPlayer1 : 'اللاعب 1';
    const prevP2 = I18N[prevLang] ? I18N[prevLang].defaultPlayer2 : 'اللاعب 2';
    dom.testPlayerName.placeholder = t('defaultPlayer1');
    if (dom.p1NameInput.value === prevP1 || !dom.p1NameInput.value.trim()) {
      dom.p1NameInput.value = t('defaultPlayer1');
    }
    if (dom.p2NameInput.value === prevP2 || !dom.p2NameInput.value.trim()) {
      dom.p2NameInput.value = t('defaultPlayer2');
    }

    renderTestLevelCards();
    updatePassStartButtonLabel();
    updateTrainHeaderUI();
    updateTrainPromptAndRevealText();
    updateRemoteUrlPreview();
    if (state.urlChallenge) renderUrlChallengeBanner();
    if (state.runner.active) updateRunnerLabels();
    if (state.activeTestResult && !dom.testResultsView.classList.contains('hidden')) {
      renderTestResultsDashboard(state.activeTestResult);
    }
    if (state.activeCompareMatch && !dom.compareResultsView.classList.contains('hidden')) {
      renderComparisonDashboard(state.activeCompareMatch);
    }
    if (state.activeTab === 'history') {
      renderHistoryView();
    }
  }

  /* ------------------------------------------------------------------------
     Tab Navigation
     ------------------------------------------------------------------------ */

  function switchTab(tab) {
    if (state.runner.active && tab !== 'test') {
      stopRunnerCleanly();
    }

    state.activeTab = tab;
    const map = {
      train: [dom.tabBtnTrain, dom.panelTrain],
      test: [dom.tabBtnTest, dom.panelTest],
      compare: [dom.tabBtnCompare, dom.panelCompare],
      history: [dom.tabBtnHistory, dom.panelHistory]
    };

    Object.keys(map).forEach((key) => {
      const [btn, panel] = map[key];
      const active = key === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      panel.classList.toggle('hidden', !active);
    });

    if (tab === 'train') {
      if (!state.train.currentTrial) {
        loadNextTrainTrial();
      } else {
        scheduleResizeAll();
      }
    } else if (tab === 'compare') {
      updateRemoteUrlPreview();
    } else if (tab === 'history') {
      renderHistoryView();
    }
  }

  /* ------------------------------------------------------------------------
     TAB 1: PROGRESSIVE GUIDED TRAINING
     ------------------------------------------------------------------------ */

  function getTrainEffectiveLevel() {
    return state.train.difficulty === 'adaptive' ? state.train.adaptiveLevel : Number(state.train.difficulty) || 1;
  }

  function updateTrainHeaderUI() {
    const effLvl = getTrainEffectiveLevel();
    const meta = getLevelMeta(effLvl);
    const name = state.lang === 'ar' ? meta.nameAr : meta.nameEn;
    dom.trainLevelReadout.innerHTML = `${numSpan(meta.level)} · ${escapeHtml(name)}`;
    const total = state.train.history.length;
    const correct = state.train.history.filter((h) => h.correct).length;
    dom.trainAccReadout.textContent = `${correct} / ${total}`;
    dom.trainStreakReadout.textContent = String(state.train.streak);
    dom.btnSaveTrainSession.classList.toggle('hidden', total < 3);
  }

  function updateTrainPromptAndRevealText() {
    const trial = state.train.currentTrial;
    if (!trial) return;
    dom.trainQuestionPrompt.textContent = trial.format === 'quad' ? t('promptQuad') : t('promptPair');

    if (state.train.answered && state.train.lastAnswer) {
      const ans = state.train.lastAnswer;
      dom.trainVerdictTitle.textContent = ans.correct ? t('verdictCorrect') : t('verdictWrong');
      dom.trainAngleBadge.innerHTML = `${t('anglePrefix')} ${numSpan(trial.angleDeg + '°')}`;
      dom.trainRtBadge.innerHTML = `${t('timePrefix')} ${numSpan(formatMs(ans.rtMs))}`;
      if (trial.format === 'quad') {
        dom.trainVerdictExplain.textContent = t('explainQuadCorrect');
      } else {
        dom.trainVerdictExplain.textContent = trial.isSame ? t('explainSame') : t('explainDiff');
      }
    }
  }

  function pickTrainForceSame() {
    if (state.train.format !== 'pair') return undefined;
    if (state.train.sameStreak >= 2 && state.train.lastSameVal !== null) {
      return !state.train.lastSameVal;
    }
    return undefined;
  }

  function loadNextTrainTrial() {
    const eng = getEngine();
    if (!eng || typeof eng.generateTrial !== 'function') {
      showToast(t('engineMissing'));
      return;
    }

    const level = getTrainEffectiveLevel();
    const forceSame = pickTrainForceSame();
    const trial = eng.generateTrial({
      seed: state.train.seed,
      index: state.train.trialIndex,
      level,
      format: state.train.format,
      forceSame
    });

    state.train.trialIndex += 1;
    state.train.currentTrial = trial;
    state.train.answered = false;
    state.train.lastAnswer = null;
    state.train.showAnchor = false;
    state.train.animating = false;
    state.train.trialStartMs = performance.now();

    if (trial.format === 'pair') {
      if (state.train.lastSameVal === trial.isSame) {
        state.train.sameStreak += 1;
      } else {
        state.train.lastSameVal = trial.isSame;
        state.train.sameStreak = 1;
      }
    }

    destroyPool(state.train.viewports);

    // Reset reveal & UI state
    dom.trainRevealPanel.classList.add('hidden');
    dom.trainRevealPanel.classList.remove('is-correct', 'is-wrong');
    dom.trainOrbitBadge.classList.add('hidden');
    dom.trainCalmBadge.classList.remove('hidden');
    dom.btnTrainAnchor.classList.remove('active');
    dom.btnTrainAnchor.setAttribute('aria-pressed', 'false');
    dom.btnTrainAnimate.disabled = false;
    const animSpan = dom.btnTrainAnimate.querySelector('span');
    if (animSpan) animSpan.textContent = t('watchLiveRotation');
    dom.btnTrainSame.disabled = false;
    dom.btnTrainDiff.disabled = false;
    dom.btnTrainSame.classList.remove('chosen-correct', 'chosen-wrong');
    dom.btnTrainDiff.classList.remove('chosen-correct', 'chosen-wrong');

    dom.trainRefHint.classList.add('hidden');
    dom.trainTargetHint.classList.add('hidden');
    dom.trainQuadRefHint.classList.add('hidden');
    dom.trainRefBox.querySelector('.canvas-wrap').classList.remove('interactive', 'state-correct', 'state-wrong');
    dom.trainTargetBox.querySelector('.canvas-wrap').classList.remove('interactive', 'state-correct', 'state-wrong');

    if (trial.format === 'pair') {
      dom.trainPairGrid.classList.remove('hidden');
      dom.trainDecisionRow.classList.remove('hidden');
      dom.trainQuadLayout.classList.add('hidden');

      const refVp = createVp(dom.trainRefCanvas, { interactive: false, showAnchor: false });
      const tgtVp = createVp(dom.trainTargetCanvas, { interactive: false, showAnchor: false });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.train.viewports.push(refVp);
      }
      if (tgtVp) {
        tgtVp.setFigure(trial.targetCubes, trial.targetQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.train.viewports.push(tgtVp);
      }
    } else {
      dom.trainPairGrid.classList.add('hidden');
      dom.trainDecisionRow.classList.add('hidden');
      dom.trainQuadLayout.classList.remove('hidden');

      const refVp = createVp(dom.trainQuadRefCanvas, { interactive: false, showAnchor: false });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.train.viewports.push(refVp);
      }

      dom.trainQuadOptionsGrid.innerHTML = '';
      (trial.options || []).forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'quad-option-card clickable';
        card.dataset.optIndex = String(idx);
        card.innerHTML = `
          <div class="quad-opt-head">
            <span class="quad-opt-badge num" dir="ltr">${idx + 1}</span>
            <span class="viewport-hint hidden" data-opt-hint>${escapeHtml(t('dragHint'))}</span>
          </div>
          <div class="quad-opt-canvas-wrap">
            <canvas aria-label="${escapeHtml(t('optionWord'))} ${idx + 1}"></canvas>
          </div>
          <button type="button" class="quad-opt-pick-btn">${escapeHtml(t('pickOption'))} ${numSpan(idx + 1)}</button>
        `;
        const canvas = card.querySelector('canvas');
        const pickBtn = card.querySelector('.quad-opt-pick-btn');
        const onPick = () => {
          if (!state.train.answered) submitTrainAnswer(idx);
        };
        pickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onPick();
        });
        card.addEventListener('click', () => {
          if (!state.train.answered) onPick();
        });
        dom.trainQuadOptionsGrid.appendChild(card);

        const optVp = createVp(canvas, { interactive: false, showAnchor: false });
        if (optVp) {
          optVp.setFigure(opt.cubes, opt.quat, { showAnchor: false, anchorIndex: trial.anchorIndex });
          state.train.viewports.push(optVp);
        }
      });
    }

    updateTrainHeaderUI();
    updateTrainPromptAndRevealText();
    scheduleResizeAll();
  }

  function submitTrainAnswer(choice) {
    const trial = state.train.currentTrial;
    if (!trial || state.train.answered) return;

    const rtMs = Math.max(80, Math.round(performance.now() - state.train.trialStartMs));
    const isCorrect = trial.format === 'quad'
      ? Number(choice) === Number(trial.correctOptionIndex)
      : Boolean(choice) === Boolean(trial.isSame);

    state.train.answered = true;
    state.train.lastAnswer = { choice, correct: isCorrect, rtMs };
    state.train.history.push({
      index: state.train.history.length,
      trialId: trial.id,
      level: trial.level,
      angleDeg: trial.angleDeg,
      angleBand: trial.angleBand,
      correct: isCorrect,
      isCorrect,
      rtMs,
      timeMs: rtMs,
      userChoice: choice,
      expectedChoice: trial.format === 'quad' ? trial.correctOptionIndex : trial.isSame
    });

    if (isCorrect) {
      state.train.streak += 1;
      state.train.adaptiveMissStreak = 0;
      if (state.train.difficulty === 'adaptive' && state.train.streak > 0 && state.train.streak % 2 === 0 && state.train.adaptiveLevel < 5) {
        state.train.adaptiveLevel += 1;
      }
    } else {
      state.train.streak = 0;
      state.train.adaptiveMissStreak += 1;
      if (state.train.difficulty === 'adaptive' && state.train.adaptiveMissStreak >= 2 && state.train.adaptiveLevel > 1) {
        state.train.adaptiveLevel -= 1;
        state.train.adaptiveMissStreak = 0;
      }
    }

    // Highlight user selection
    if (trial.format === 'pair') {
      dom.btnTrainSame.disabled = true;
      dom.btnTrainDiff.disabled = true;
      const chosenBtn = choice ? dom.btnTrainSame : dom.btnTrainDiff;
      const rightBtn = trial.isSame ? dom.btnTrainSame : dom.btnTrainDiff;
      chosenBtn.classList.add(isCorrect ? 'chosen-correct' : 'chosen-wrong');
      if (!isCorrect) rightBtn.classList.add('chosen-correct');

      const refWrap = dom.trainRefBox.querySelector('.canvas-wrap');
      const tgtWrap = dom.trainTargetBox.querySelector('.canvas-wrap');
      refWrap.classList.add('interactive');
      tgtWrap.classList.add('interactive', isCorrect ? 'state-correct' : 'state-wrong');
      dom.trainRefHint.classList.remove('hidden');
      dom.trainTargetHint.classList.remove('hidden');
    } else {
      dom.trainQuadRefHint.classList.remove('hidden');
      const refWrap = dom.trainQuadLayout.querySelector('.canvas-wrap');
      if (refWrap) refWrap.classList.add('interactive');
      const cards = dom.trainQuadOptionsGrid.querySelectorAll('.quad-option-card');
      cards.forEach((card, idx) => {
        card.classList.remove('clickable');
        card.classList.add('locked');
        const btn = card.querySelector('.quad-opt-pick-btn');
        if (btn) btn.disabled = true;
        const hint = card.querySelector('[data-opt-hint]');
        if (hint) hint.classList.remove('hidden');
        if (idx === trial.correctOptionIndex) {
          card.classList.add('opt-correct');
        } else if (idx === choice && !isCorrect) {
          card.classList.add('opt-wrong');
        }
      });
    }

    // Unlock interactive 3D orbit on ALL visible canvases immediately
    state.train.viewports.forEach((vp) => {
      if (vp && typeof vp.setInteractive === 'function') vp.setInteractive(true);
    });

    dom.trainCalmBadge.classList.add('hidden');
    dom.trainOrbitBadge.classList.remove('hidden');
    dom.trainRevealPanel.classList.remove('hidden', 'is-correct', 'is-wrong');
    dom.trainRevealPanel.classList.add(isCorrect ? 'is-correct' : 'is-wrong');

    updateTrainHeaderUI();
    updateTrainPromptAndRevealText();
  }

  function setTrainAnchorHighlight(enabled) {
    state.train.showAnchor = Boolean(enabled);
    dom.btnTrainAnchor.classList.toggle('active', state.train.showAnchor);
    dom.btnTrainAnchor.setAttribute('aria-pressed', state.train.showAnchor ? 'true' : 'false');
    state.train.viewports.forEach((vp) => {
      if (vp && typeof vp.setShowAnchor === 'function') {
        vp.setShowAnchor(state.train.showAnchor);
      }
    });
  }

  function playTrainLiveRotation() {
    const trial = state.train.currentTrial;
    if (!trial || !state.train.answered || !state.train.viewports.length) return;

    const refVp = state.train.viewports[0];
    if (!refVp) return;

    // Turn on anchor tip highlight so user tracks end-arm motion clearly
    setTrainAnchorHighlight(true);

    // Reset all other viewports instantly to their canonical target view so alignment is crystal-clear
    for (let i = 1; i < state.train.viewports.length; i++) {
      if (state.train.viewports[i] && typeof state.train.viewports[i].resetView === 'function') {
        state.train.viewports[i].resetView(0);
      }
    }

    const destQuat = trial.format === 'quad'
      ? trial.options[trial.correctOptionIndex].quat
      : trial.targetQuat;

    // Reset reference to refQuat, then SLERP smoothly into destQuat
    refVp.setFigure(trial.cubes, trial.refQuat, {
      showAnchor: true,
      anchorIndex: trial.anchorIndex
    });

    dom.btnTrainAnimate.disabled = true;
    const labelSpan = dom.btnTrainAnimate.querySelector('span');
    if (labelSpan) labelSpan.textContent = t('playingRotation');

    requestAnimationFrame(() => {
      if (typeof refVp.animateToQuat === 'function') {
        refVp.animateToQuat(destQuat, 1300, () => {
          dom.btnTrainAnimate.disabled = false;
          if (labelSpan) labelSpan.textContent = t('watchLiveRotation');
        });
      } else {
        dom.btnTrainAnimate.disabled = false;
        if (labelSpan) labelSpan.textContent = t('watchLiveRotation');
      }
    });
  }

  function resetTrainViewports() {
    state.train.viewports.forEach((vp) => {
      if (vp && typeof vp.resetView === 'function') vp.resetView();
    });
  }

  function saveCurrentTrainSession() {
    if (state.train.history.length < 3) return;
    const metrics = safeComputeScore(state.train.history, getTrainEffectiveLevel());
    addHistoryEntry({
      id: 'tr-' + Date.now(),
      type: 'train',
      createdAt: Date.now(),
      playerName: t('defaultPlayer1'),
      seed: state.train.seed,
      format: state.train.format,
      level: state.train.difficulty,
      count: state.train.history.length,
      timerSec: 0,
      metrics
    });
    showToast(t('toastSavedTrain'));
  }

  /* ------------------------------------------------------------------------
     TAB 2: STANDARD TEST SETUP & SHARED RUNNER
     ------------------------------------------------------------------------ */

  function renderTestLevelCards() {
    if (!dom.testLevelGrid) return;
    const levels = getLevels();
    const current = String(state.testConfig.level);

    let html = `
      <button type="button" class="level-card-btn ${current === 'adaptive' ? 'active' : ''}" data-level="adaptive">
        <span class="level-card-head">${escapeHtml(t('adaptiveFull'))}</span>
        <span class="level-card-sub">${escapeHtml(t('adaptiveDesc'))}</span>
      </button>
    `;

    levels.forEach((lv) => {
      const name = state.lang === 'ar' ? lv.nameAr : lv.nameEn;
      const active = current === String(lv.level);
      html += `
        <button type="button" class="level-card-btn ${active ? 'active' : ''}" data-level="${lv.level}">
          <span class="level-card-head">${escapeHtml(t('levelWord'))} ${numSpan(lv.level)} · ${escapeHtml(name)}</span>
          <span class="level-card-sub">${numSpan(lv.minCubes + '–' + lv.maxCubes)} ${escapeHtml(t('cubesWord'))} · ${numSpan(lv.minAngle + '°–' + lv.maxAngle + '°')}</span>
        </button>
      `;
    });

    dom.testLevelGrid.innerHTML = html;
    dom.testLevelGrid.querySelectorAll('.level-card-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-level');
        state.testConfig.level = val === 'adaptive' ? 'adaptive' : Number(val);
        renderTestLevelCards();
      });
    });
  }

  function startRunnerSession({ mode, config, playerName, trialsOverride }) {
    const eng = getEngine();
    if (!eng || typeof eng.generateSession !== 'function') {
      showToast(t('engineMissing'));
      return;
    }

    stopRunnerCleanly();

    const cleanCfg = {
      seed: sanitizeSeed(config.seed),
      format: config.format === 'quad' ? 'quad' : 'pair',
      level: config.level === 'adaptive' ? 'adaptive' : (Number(config.level) || 3),
      count: Math.max(4, Math.min(30, Number(config.count) || 12)),
      timerSec: Math.max(0, Number(config.timerSec) || 0)
    };

    const trials = Array.isArray(trialsOverride) && trialsOverride.length
      ? trialsOverride
      : eng.generateSession({
          seed: cleanCfg.seed,
          count: cleanCfg.count,
          level: cleanCfg.level,
          format: cleanCfg.format
        });

    state.runner.active = true;
    state.runner.mode = mode;
    state.runner.config = cleanCfg;
    state.runner.playerName = playerName || t('defaultPlayer1');
    state.runner.trials = trials;
    state.runner.currentIndex = 0;
    state.runner.results = [];
    state.runner.locked = false;
    state.runner.sessionStartMs = Date.now();

    // Switch to panelTest to show the distraction-free runner cleanly
    state.activeTab = 'test';
    [
      [dom.tabBtnTrain, dom.panelTrain, false],
      [dom.tabBtnTest, dom.panelTest, mode === 'test' || mode === 'remote-self'],
      [dom.tabBtnCompare, dom.panelCompare, mode === 'pass-p1' || mode === 'pass-p2'],
      [dom.tabBtnHistory, dom.panelHistory, false]
    ].forEach(([btn, panel, markActive]) => {
      btn.classList.toggle('active', markActive);
      btn.setAttribute('aria-selected', markActive ? 'true' : 'false');
      panel.classList.add('hidden');
    });
    dom.panelTest.classList.remove('hidden');

    dom.testSetupView.classList.add('hidden');
    dom.testResultsView.classList.add('hidden');
    dom.testRunnerView.classList.remove('hidden');

    updateRunnerTimerDisplay();
    state.runner.timerId = setInterval(updateRunnerTimerDisplay, 250);

    renderRunnerTrial();
  }

  function stopRunnerCleanly() {
    if (state.runner.timerId) {
      clearInterval(state.runner.timerId);
      state.runner.timerId = null;
    }
    destroyPool(state.runner.viewports);
    state.runner.active = false;
    state.runner.locked = false;
  }

  function updateRunnerLabels() {
    if (!state.runner.active) return;
    const total = state.runner.trials.length;
    const cur = Math.min(total, state.runner.currentIndex + 1);
    dom.runnerPlayerBadge.textContent = state.runner.playerName;
    dom.runnerProgressText.innerHTML = `${escapeHtml(t('questionWord'))} ${numSpan(cur + ' / ' + total)}`;
    dom.runnerSeedBadge.textContent = state.runner.config.seed;
    dom.runnerProgressFill.style.width = `${Math.round(((cur - 1) / Math.max(1, total)) * 100)}%`;
    const trial = state.runner.trials[state.runner.currentIndex];
    if (trial) {
      dom.runnerQuestionPrompt.textContent = trial.format === 'quad' ? t('promptQuad') : t('promptPair');
    }
  }

  function updateRunnerTimerDisplay() {
    if (!state.runner.active) return;
    const elapsedSec = Math.floor((Date.now() - state.runner.sessionStartMs) / 1000);
    const limit = state.runner.config.timerSec;
    if (limit > 0) {
      const remaining = Math.max(0, limit - elapsedSec);
      dom.runnerTimerReadout.textContent = formatClock(remaining);
      dom.runnerTimerReadout.classList.toggle('urgent', remaining <= 30);
      if (remaining <= 0) {
        finalizeRunnerTimeout();
      }
    } else {
      dom.runnerTimerReadout.textContent = formatClock(elapsedSec);
      dom.runnerTimerReadout.classList.remove('urgent');
    }
  }

  function renderRunnerTrial() {
    const trial = state.runner.trials[state.runner.currentIndex];
    if (!trial) {
      finishRunnerSession();
      return;
    }

    state.runner.locked = false;
    state.runner.trialStartMs = performance.now();
    destroyPool(state.runner.viewports);
    updateRunnerLabels();

    dom.btnRunnerSame.disabled = false;
    dom.btnRunnerDiff.disabled = false;

    if (trial.format === 'pair') {
      dom.runnerPairGrid.classList.remove('hidden');
      dom.runnerDecisionRow.classList.remove('hidden');
      dom.runnerQuadLayout.classList.add('hidden');

      const refVp = createVp(dom.runnerRefCanvas, { interactive: false, showAnchor: false });
      const tgtVp = createVp(dom.runnerTargetCanvas, { interactive: false, showAnchor: false });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.runner.viewports.push(refVp);
      }
      if (tgtVp) {
        tgtVp.setFigure(trial.targetCubes, trial.targetQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.runner.viewports.push(tgtVp);
      }
    } else {
      dom.runnerPairGrid.classList.add('hidden');
      dom.runnerDecisionRow.classList.add('hidden');
      dom.runnerQuadLayout.classList.remove('hidden');

      const refVp = createVp(dom.runnerQuadRefCanvas, { interactive: false, showAnchor: false });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: false, anchorIndex: trial.anchorIndex });
        state.runner.viewports.push(refVp);
      }

      dom.runnerQuadOptionsGrid.innerHTML = '';
      (trial.options || []).forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'quad-option-card clickable';
        card.innerHTML = `
          <div class="quad-opt-head">
            <span class="quad-opt-badge num" dir="ltr">${idx + 1}</span>
          </div>
          <div class="quad-opt-canvas-wrap">
            <canvas aria-label="${escapeHtml(t('optionWord'))} ${idx + 1}"></canvas>
          </div>
          <button type="button" class="quad-opt-pick-btn">${escapeHtml(t('pickOption'))} ${numSpan(idx + 1)}</button>
        `;
        const canvas = card.querySelector('canvas');
        const btn = card.querySelector('.quad-opt-pick-btn');
        const pick = () => submitRunnerAnswer(idx);
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          pick();
        });
        card.addEventListener('click', pick);
        dom.runnerQuadOptionsGrid.appendChild(card);

        const optVp = createVp(canvas, { interactive: false, showAnchor: false });
        if (optVp) {
          optVp.setFigure(opt.cubes, opt.quat, { showAnchor: false, anchorIndex: trial.anchorIndex });
          state.runner.viewports.push(optVp);
        }
      });
    }

    scheduleResizeAll();
  }

  function submitRunnerAnswer(choice) {
    if (!state.runner.active || state.runner.locked) return;
    const trial = state.runner.trials[state.runner.currentIndex];
    if (!trial) return;

    state.runner.locked = true;
    const rtMs = Math.max(80, Math.round(performance.now() - state.runner.trialStartMs));
    const isCorrect = trial.format === 'quad'
      ? Number(choice) === Number(trial.correctOptionIndex)
      : Boolean(choice) === Boolean(trial.isSame);

    state.runner.results.push({
      index: state.runner.currentIndex,
      trialId: trial.id,
      level: trial.level,
      angleDeg: trial.angleDeg,
      angleBand: trial.angleBand,
      correct: isCorrect,
      isCorrect,
      rtMs,
      timeMs: rtMs,
      userChoice: choice,
      expectedChoice: trial.format === 'quad' ? trial.correctOptionIndex : trial.isSame,
      timedOut: false
    });

    state.runner.currentIndex += 1;
    dom.runnerProgressFill.style.width = `${Math.round((state.runner.currentIndex / Math.max(1, state.runner.trials.length)) * 100)}%`;

    setTimeout(() => {
      if (!state.runner.active) return;
      if (state.runner.currentIndex >= state.runner.trials.length) {
        finishRunnerSession();
      } else {
        renderRunnerTrial();
      }
    }, 90);
  }

  function finalizeRunnerTimeout() {
    if (!state.runner.active) return;
    while (state.runner.currentIndex < state.runner.trials.length) {
      const trial = state.runner.trials[state.runner.currentIndex];
      state.runner.results.push({
        index: state.runner.currentIndex,
        trialId: trial.id,
        level: trial.level,
        angleDeg: trial.angleDeg,
        angleBand: trial.angleBand,
        correct: false,
        isCorrect: false,
        rtMs: 0,
        timeMs: 0,
        userChoice: null,
        expectedChoice: trial.format === 'quad' ? trial.correctOptionIndex : trial.isSame,
        timedOut: true
      });
      state.runner.currentIndex += 1;
    }
    finishRunnerSession();
  }

  function finishRunnerSession() {
    const mode = state.runner.mode;
    const cfg = { ...state.runner.config };
    const playerName = state.runner.playerName;
    const trials = state.runner.trials.slice();
    const results = state.runner.results.slice();
    const elapsedMs = Math.max(500, Date.now() - state.runner.sessionStartMs);

    stopRunnerCleanly();
    dom.testRunnerView.classList.add('hidden');

    const metrics = safeComputeScore(results, cfg.level);
    if (!metrics.totalMs) metrics.totalMs = elapsedMs;

    const run = {
      id: 'run-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: 'test',
      createdAt: Date.now(),
      playerName,
      seed: cfg.seed,
      format: cfg.format,
      level: cfg.level,
      count: trials.length,
      timerSec: cfg.timerSec,
      metrics,
      results,
      trials
    };
    run.resultCode = safeEncodeResultCode(run);

    if (mode === 'pass-p1') {
      state.passMatch.p1Run = run;
      showPassHandoffScreen();
      return;
    }

    if (mode === 'pass-p2') {
      state.passMatch.p2Run = run;
      const matchObj = {
        id: 'cmp-' + Date.now(),
        type: 'compare',
        createdAt: Date.now(),
        seed: cfg.seed,
        sameSeed: true,
        format: cfg.format,
        level: cfg.level,
        count: trials.length,
        p1: state.passMatch.p1Run,
        p2: run,
        trials
      };
      state.activeCompareMatch = matchObj;
      addHistoryEntry(stripTrialsForStorage(matchObj));
      showCompareResultsView(matchObj);
      return;
    }

    // Standard Test or Remote Self
    state.lastTestRun = run;
    state.activeTestResult = run;
    state.activeTestFilter = 'all';
    addHistoryEntry(stripTrialsForStorage(run));

    dom.testSetupView.classList.add('hidden');
    dom.testResultsView.classList.remove('hidden');
    renderTestResultsDashboard(run);
  }

  function stripTrialsForStorage(entry) {
    if (entry.type === 'compare') {
      return {
        id: entry.id,
        type: 'compare',
        createdAt: entry.createdAt,
        seed: entry.seed,
        sameSeed: entry.sameSeed,
        format: entry.format,
        level: entry.level,
        count: entry.count,
        p1: {
          playerName: entry.p1.playerName,
          seed: entry.p1.seed,
          format: entry.p1.format,
          level: entry.p1.level,
          count: entry.p1.count,
          timerSec: entry.p1.timerSec,
          metrics: entry.p1.metrics,
          results: entry.p1.results,
          resultCode: entry.p1.resultCode
        },
        p2: {
          playerName: entry.p2.playerName,
          seed: entry.p2.seed,
          format: entry.p2.format,
          level: entry.p2.level,
          count: entry.p2.count,
          timerSec: entry.p2.timerSec,
          metrics: entry.p2.metrics,
          results: entry.p2.results,
          resultCode: entry.p2.resultCode
        }
      };
    }
    return {
      id: entry.id,
      type: entry.type || 'test',
      createdAt: entry.createdAt,
      playerName: entry.playerName,
      seed: entry.seed,
      format: entry.format,
      level: entry.level,
      count: entry.count,
      timerSec: entry.timerSec,
      metrics: entry.metrics,
      results: entry.results,
      resultCode: entry.resultCode
    };
  }

  function ensureTrialsForRun(run) {
    if (Array.isArray(run.trials) && run.trials.length === run.count) {
      return run.trials;
    }
    const eng = getEngine();
    if (!eng || typeof eng.generateSession !== 'function') return [];
    const regenerated = eng.generateSession({
      seed: run.seed,
      count: run.count,
      level: run.level,
      format: run.format
    });
    run.trials = regenerated;
    return regenerated;
  }

  /* ------------------------------------------------------------------------
     SVG CHARTS (Shepard–Metzler Angle Curve & History Trend)
     ------------------------------------------------------------------------ */

  function buildAngleCurveSvg(bands) {
    const items = [
      { key: 'small', label: t('bandSmall'), range: '30°–65°', data: bands.small },
      { key: 'medium', label: t('bandMedium'), range: '66°–120°', data: bands.medium },
      { key: 'large', label: t('bandLarge'), range: '121°–180°', data: bands.large }
    ];

    const W = 560;
    const H = 190;
    const padL = 44;
    const padR = 44;
    const padT = 26;
    const padB = 42;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxRt = Math.max(4000, ...items.map((it) => it.data.medianMs || 0));

    const colStep = plotW / 3;
    const barW = 54;
    const points = [];
    let barsSvg = '';
    let xLabelsSvg = '';
    let dotsSvg = '';

    items.forEach((it, idx) => {
      const cx = padL + colStep * idx + colStep / 2;
      const acc = it.data.total > 0 ? Math.max(0, Math.min(100, it.data.accuracy)) : 0;
      const barH = (acc / 100) * plotH;
      const barY = padT + plotH - barH;

      barsSvg += `
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${barY.toFixed(1)}" width="${barW}" height="${Math.max(2, barH).toFixed(1)}" rx="6" fill="var(--accent)" opacity="${it.data.total > 0 ? '0.82' : '0.2'}"></rect>
        <text x="${cx.toFixed(1)}" y="${Math.max(14, barY - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${it.data.total > 0 ? Math.round(acc) + '%' : '—'}</text>
      `;

      if (it.data.total > 0 && it.data.medianMs > 0) {
        const rtY = padT + plotH - (it.data.medianMs / maxRt) * plotH;
        points.push(`${cx.toFixed(1)},${rtY.toFixed(1)}`);
        dotsSvg += `
          <circle cx="${cx.toFixed(1)}" cy="${rtY.toFixed(1)}" r="5" fill="var(--amber)" stroke="var(--surface)" stroke-width="2"></circle>
          <text x="${cx.toFixed(1)}" y="${Math.min(padT + plotH - 4, rtY + 16).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--amber)">${(it.data.medianMs / 1000).toFixed(1)}s</text>
        `;
      }

      xLabelsSvg += `
        <text x="${cx.toFixed(1)}" y="${H - 20}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">${escapeHtml(it.range)}</text>
        <text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${escapeHtml(it.label)}</text>
      `;
    });

    const polylineSvg = points.length >= 2
      ? `<polyline fill="none" stroke="var(--amber)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}"></polyline>`
      : '';

    return `
      <div class="chart-svg-wrap" dir="ltr">
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t('angleCurveTitle'))}">
          <line x1="${padL}" y1="${padT}" x2="${W - padR}" y2="${padT}" stroke="var(--border)" stroke-dasharray="3 3"></line>
          <line x1="${padL}" y1="${padT + plotH / 2}" x2="${W - padR}" y2="${padT + plotH / 2}" stroke="var(--border)" stroke-dasharray="3 3"></line>
          <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--border-strong)"></line>
          <text x="${padL - 6}" y="${padT + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">100%</text>
          <text x="${padL - 6}" y="${padT + plotH / 2 + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">50%</text>
          <text x="${padL - 6}" y="${padT + plotH + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">0%</text>
          <text x="${W - padR + 6}" y="${padT + 4}" text-anchor="start" font-size="10" fill="var(--amber)">${(maxRt / 1000).toFixed(1)}s</text>
          <text x="${W - padR + 6}" y="${padT + plotH + 4}" text-anchor="start" font-size="10" fill="var(--amber)">0s</text>
          ${barsSvg}
          ${polylineSvg}
          ${dotsSvg}
          ${xLabelsSvg}
        </svg>
      </div>
    `;
  }

  function buildHistoryTrendSvg(testEntries) {
    const recent = testEntries.slice(0, 12).reverse();
    if (recent.length < 2) {
      return `<p class="section-desc">${escapeHtml(t('trendNeedTwo'))}</p>`;
    }
    const W = 560;
    const H = 165;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const stepX = plotW / Math.max(1, recent.length - 1);

    const accPts = [];
    let nodes = '';
    recent.forEach((entry, i) => {
      const x = padL + stepX * i;
      const acc = Math.max(0, Math.min(100, normalizePctNumber(entry.metrics && entry.metrics.accuracy)));
      const y = padT + plotH - (acc / 100) * plotH;
      accPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      nodes += `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"></circle>
        <text x="${x.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--text-soft)">#${i + 1}</text>
      `;
    });

    return `
      <div class="chart-svg-wrap" dir="ltr">
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t('trendTitle'))}">
          <line x1="${padL}" y1="${padT}" x2="${W - padR}" y2="${padT}" stroke="var(--border)" stroke-dasharray="3 3"></line>
          <line x1="${padL}" y1="${padT + plotH / 2}" x2="${W - padR}" y2="${padT + plotH / 2}" stroke="var(--border)" stroke-dasharray="3 3"></line>
          <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--border-strong)"></line>
          <text x="${padL - 6}" y="${padT + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">100%</text>
          <text x="${padL - 6}" y="${padT + plotH / 2 + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">50%</text>
          <text x="${padL - 6}" y="${padT + plotH + 4}" text-anchor="end" font-size="10" fill="var(--text-soft)">0%</text>
          <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${accPts.join(' ')}"></polyline>
          ${nodes}
        </svg>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     TEST RESULTS DASHBOARD (AZTest-Style — Card Grid Layout)
     ------------------------------------------------------------------------ */

  function formatChoiceText(format, choice, timedOut) {
    if (timedOut || choice === null || choice === undefined) return t('verdictTimeout');
    if (format === 'quad') return `${t('optionWord')} ${Number(choice) + 1}`;
    return choice ? t('sameShort') : t('diffShort');
  }

  function renderTestResultsDashboard(run) {
    const m = run.metrics;
    const shareUrl = buildChallengeUrl(run);
    const trials = ensureTrialsForRun(run);
    const arrowDir = state.lang === 'ar' ? '←' : '→';
    const levelTransition = m.startLevel === m.nextLevel
      ? `${t('levelWord')} ${numSpan(m.startLevel)}`
      : `${t('levelWord')} ${numSpan(m.startLevel)} ${arrowDir} ${numSpan(m.nextLevel)}`;

    const filter = state.activeTestFilter || 'all';
    const filteredResults = (run.results || []).filter((r) => {
      if (filter === 'wrong') return !r.correct;
      if (filter === 'correct') return r.correct;
      return true;
    });

    const reviewHtml = filteredResults.length
      ? filteredResults.map((r) => {
          const idx = r.index;
          const tr = trials[idx];
          const angle = r.angleDeg || (tr && tr.angleDeg) || 0;
          const pickedStr = formatChoiceText(run.format, r.userChoice, r.timedOut);
          const expectedStr = formatChoiceText(run.format, r.expectedChoice, false);
          return `
            <div class="review-item ${r.correct ? 'item-correct' : 'item-wrong'}">
              <div class="review-item-main">
                <div class="review-item-top">
                  <strong>${escapeHtml(t('questionWord'))} ${numSpan(idx + 1)}</strong>
                  <span class="badge ${r.correct ? 'badge-success' : 'badge-danger'}">${escapeHtml(r.correct ? t('verdictCorrect') : (r.timedOut ? t('verdictTimeout') : t('verdictWrong')))}</span>
                  <span class="badge badge-neutral">${numSpan(angle + '°')}</span>
                  <span class="badge badge-neutral">${numSpan(formatMs(r.rtMs))}</span>
                </div>
                <div class="review-item-detail">
                  ${escapeHtml(t('yourChoice'))}: <strong>${escapeHtml(pickedStr)}</strong> · ${escapeHtml(t('correctChoice'))}: <strong>${escapeHtml(expectedStr)}</strong>
                </div>
              </div>
              ${tr ? `<button type="button" class="btn btn-outline btn-sm" data-replay-idx="${idx}">${escapeHtml(t('replay3dBtn'))}</button>` : ''}
            </div>
          `;
        }).join('')
      : `<p class="section-desc">${escapeHtml(t('noFilterItems'))}</p>`;

    dom.testResultsView.innerHTML = `
      <div class="card hero-result-card">
        <div class="hero-score-row">
          <div>
            <div class="hero-score-label">${escapeHtml(t('performanceScore'))} · ${escapeHtml(run.playerName)}</div>
            <div class="hero-score-value num" dir="ltr">${m.score}</div>
          </div>
          <div class="arena-meta">
            <span class="badge badge-accent">${levelTransition}</span>
            <span class="badge badge-neutral">${escapeHtml(formatFormatLabel(run.format))}</span>
            <span class="seed-chip num" dir="ltr">${escapeHtml(run.seed)}</span>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('scoreLabel'))}</span>
            <span class="kpi-value">${numSpan(m.score)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('accuracy'))}</span>
            <span class="kpi-value">${numSpan(formatPct(m.accuracy))}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('correctAnswers'))}</span>
            <span class="kpi-value">${numSpan(m.correct + ' / ' + m.total)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('totalTime'))}</span>
            <span class="kpi-value">${numSpan(formatMs(m.totalMs))}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('avgTimePerQ'))}</span>
            <span class="kpi-value">${numSpan(formatMs(m.medianMs))}</span>
            <span class="kpi-sub">${escapeHtml(t('meanShort'))}: ${numSpan(formatMs(m.meanMs))}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('levelProgress'))}</span>
            <span class="kpi-value">${levelTransition}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">${escapeHtml(t('angleCurveTitle'))}</h3>
        <p class="section-desc" style="margin-bottom:10px">${escapeHtml(t('angleCurveDesc'))}</p>
        ${buildAngleCurveSvg(m.bands)}
        <div class="band-cards-grid">
          ${renderBandMiniCard(t('bandSmall'), '30°–65°', m.bands.small)}
          ${renderBandMiniCard(t('bandMedium'), '66°–120°', m.bands.medium)}
          ${renderBandMiniCard(t('bandLarge'), '121°–180°', m.bands.large)}
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">${escapeHtml(t('shareAndCompare'))}</h3>
        <div class="share-code-box">
          <code class="result-code-text num" dir="ltr">${escapeHtml(run.resultCode)}</code>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="btnCopyTestLink">${escapeHtml(t('copySameTestLink'))}</button>
          <button type="button" class="btn btn-accent-soft" id="btnCopyTestCode">${escapeHtml(t('copyResultCode'))}</button>
          <button type="button" class="btn btn-outline" id="btnJumpCompareWithRun">${escapeHtml(t('compareWithOther'))}</button>
          <button type="button" class="btn btn-ghost" id="btnReturnTestSetup">${escapeHtml(t('newTestBtn'))}</button>
        </div>
      </div>

      <div class="card">
        <div class="review-head">
          <h3 class="card-title" style="margin:0">${escapeHtml(t('reviewTitle'))}</h3>
          <div class="segmented" id="testReviewFilterSeg">
            <button type="button" class="seg-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">${escapeHtml(t('filterAll'))}</button>
            <button type="button" class="seg-btn ${filter === 'wrong' ? 'active' : ''}" data-filter="wrong">${escapeHtml(t('filterWrong'))}</button>
            <button type="button" class="seg-btn ${filter === 'correct' ? 'active' : ''}" data-filter="correct">${escapeHtml(t('filterCorrect'))}</button>
          </div>
        </div>
        <div class="review-list">${reviewHtml}</div>
      </div>
    `;

    dom.testResultsView.querySelector('#btnCopyTestLink').addEventListener('click', () => {
      copyText(shareUrl, t('toastCopiedLink'));
    });
    dom.testResultsView.querySelector('#btnCopyTestCode').addEventListener('click', () => {
      copyText(run.resultCode, t('toastCopiedCode'));
    });
    dom.testResultsView.querySelector('#btnJumpCompareWithRun').addEventListener('click', () => {
      state.compareConfig.subMode = 'remote';
      state.compareConfig.seed = run.seed;
      state.compareConfig.format = run.format;
      state.compareConfig.level = run.level;
      state.compareConfig.count = run.count;
      state.compareConfig.timerSec = run.timerSec || 0;
      dom.cmpSeedInput.value = run.seed;
      syncSegmentedActive(dom.cmpFormatSeg, run.format);
      syncSegmentedActive(dom.cmpLevelPills, String(run.level));
      syncSegmentedActive(dom.cmpCountSeg, String(run.count));
      syncSegmentedActive(dom.cmpTimerSeg, String(run.timerSec || 0));
      dom.codeInputA.value = run.resultCode;
      setCompareSubMode('remote');
      switchTab('compare');
    });
    dom.testResultsView.querySelector('#btnReturnTestSetup').addEventListener('click', () => {
      dom.testResultsView.classList.add('hidden');
      dom.testSetupView.classList.remove('hidden');
      const eng = getEngine();
      if (eng && typeof eng.createSeedCode === 'function') {
        state.testConfig.seed = eng.createSeedCode();
        dom.testSeedInput.value = state.testConfig.seed;
      }
    });

    dom.testResultsView.querySelectorAll('#testReviewFilterSeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTestFilter = btn.getAttribute('data-filter') || 'all';
        renderTestResultsDashboard(run);
      });
    });

    dom.testResultsView.querySelectorAll('[data-replay-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-replay-idx'));
        const tr = trials[idx];
        const res = run.results[idx];
        if (tr) {
          openReplayModal(tr, idx, {
            singleRun: {
              playerName: run.playerName,
              correct: res ? res.correct : false,
              pickedText: res ? formatChoiceText(run.format, res.userChoice, res.timedOut) : ''
            }
          });
        }
      });
    });
  }

  function renderBandMiniCard(title, range, band) {
    const hasData = band && band.total > 0;
    return `
      <div class="band-card">
        <span class="band-card-title">${escapeHtml(title)}</span>
        <span class="band-card-range">${numSpan(range)}</span>
        <span class="band-card-metric">${hasData ? numSpan(formatPct(band.accuracy)) : t('noDataDash')}</span>
        <span class="band-card-sub">${hasData ? numSpan(band.correct + '/' + band.total) + ' · ' + numSpan(formatMs(band.medianMs)) : numSpan('0/0')}</span>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     TAB 3: 2-PLAYER HEAD-TO-HEAD COMPARISON
     ------------------------------------------------------------------------ */

  function updatePassStartButtonLabel() {
    if (!dom.btnStartPassP1) return;
    const p1 = sanitizePlayerName(dom.p1NameInput.value, 'defaultPlayer1');
    dom.btnStartPassP1.textContent = `${t('startRoundPrefix')} ${p1}`;
  }

  function setCompareSubMode(mode) {
    state.compareConfig.subMode = mode === 'remote' ? 'remote' : 'pass';
    dom.compareModeSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-value') === state.compareConfig.subMode);
    });
    dom.compareHandoffView.classList.add('hidden');
    dom.compareResultsView.classList.add('hidden');
    dom.comparePassSetup.classList.toggle('hidden', state.compareConfig.subMode !== 'pass');
    dom.compareRemoteView.classList.toggle('hidden', state.compareConfig.subMode !== 'remote');
    if (state.compareConfig.subMode === 'remote') {
      updateRemoteUrlPreview();
    }
  }

  function updateRemoteUrlPreview() {
    if (!dom.remoteShareUrl) return;
    dom.remoteShareUrl.textContent = buildChallengeUrl(state.compareConfig);
  }

  function startPassAndPlayP1() {
    const p1Name = sanitizePlayerName(dom.p1NameInput.value, 'defaultPlayer1');
    const p2Name = sanitizePlayerName(dom.p2NameInput.value, 'defaultPlayer2');
    const seed = sanitizeSeed(dom.cmpSeedInput.value || state.compareConfig.seed);
    state.compareConfig.seed = seed;
    dom.cmpSeedInput.value = seed;

    const cfg = {
      seed,
      format: state.compareConfig.format,
      level: state.compareConfig.level,
      count: state.compareConfig.count,
      timerSec: state.compareConfig.timerSec
    };

    const eng = getEngine();
    const trials = eng.generateSession({
      seed: cfg.seed,
      count: cfg.count,
      level: cfg.level,
      format: cfg.format
    });

    state.passMatch = {
      p1Name,
      p2Name,
      config: cfg,
      trials,
      p1Run: null,
      p2Run: null
    };

    startRunnerSession({
      mode: 'pass-p1',
      config: cfg,
      playerName: p1Name,
      trialsOverride: trials
    });
  }

  function showPassHandoffScreen() {
    switchTab('compare');
    dom.comparePassSetup.classList.add('hidden');
    dom.compareRemoteView.classList.add('hidden');
    dom.compareResultsView.classList.add('hidden');
    dom.compareHandoffView.classList.remove('hidden');

    const { p1Name, p2Name, config } = state.passMatch;
    dom.handoffTitle.textContent = `${t('handoffDonePrefix')} ${p1Name} ${t('handoffDoneSuffix')}`.trim();
    dom.handoffDesc.textContent = `${t('handoffPassPrefix')} ${p2Name} ${t('handoffPassSuffix')}`;
    dom.handoffMeta.innerHTML = `
      <span class="seed-chip num" dir="ltr">${escapeHtml(config.seed)}</span>
      <span class="badge badge-neutral">${escapeHtml(formatFormatLabel(config.format))}</span>
      <span class="badge badge-neutral">${numSpan(config.count)} ${escapeHtml(t('questionCountLabel'))}</span>
      <span class="badge badge-neutral">${escapeHtml(formatTimerLabel(config.timerSec))}</span>
    `;
    dom.btnStartPassP2.textContent = `${t('startRoundPrefix')} ${p2Name}`;
  }

  function startPassAndPlayP2() {
    if (!state.passMatch || !state.passMatch.config || !state.passMatch.trials.length) return;
    startRunnerSession({
      mode: 'pass-p2',
      config: state.passMatch.config,
      playerName: state.passMatch.p2Name,
      trialsOverride: state.passMatch.trials
    });
  }

  function showCompareResultsView(matchObj) {
    switchTab('compare');
    dom.comparePassSetup.classList.add('hidden');
    dom.compareRemoteView.classList.add('hidden');
    dom.compareHandoffView.classList.add('hidden');
    dom.compareResultsView.classList.remove('hidden');
    renderComparisonDashboard(matchObj);
  }

  function handleCompareTwoCodes() {
    dom.remoteCodeError.classList.add('hidden');
    const rawA = dom.codeInputA.value.trim();
    const rawB = dom.codeInputB.value.trim();
    if (!rawA || !rawB) {
      dom.remoteCodeError.textContent = t('codeErrorBoth');
      dom.remoteCodeError.classList.remove('hidden');
      return;
    }
    const runA = safeDecodeResultCode(rawA);
    if (!runA) {
      dom.remoteCodeError.textContent = t('codeErrorInvalidA');
      dom.remoteCodeError.classList.remove('hidden');
      return;
    }
    const runB = safeDecodeResultCode(rawB);
    if (!runB) {
      dom.remoteCodeError.textContent = t('codeErrorInvalidB');
      dom.remoteCodeError.classList.remove('hidden');
      return;
    }

    const sameSeed = runA.seed === runB.seed && runA.format === runB.format && runA.count === runB.count;
    const trials = sameSeed ? ensureTrialsForRun(runA) : [];
    const matchObj = {
      id: 'cmp-' + Date.now(),
      type: 'compare',
      createdAt: Date.now(),
      seed: runA.seed,
      sameSeed,
      format: runA.format,
      level: runA.level,
      count: runA.count,
      p1: runA,
      p2: runB,
      trials
    };
    state.activeCompareMatch = matchObj;
    addHistoryEntry(stripTrialsForStorage(matchObj));
    showCompareResultsView(matchObj);
  }

  function determineWinner(p1, p2) {
    if (p1.metrics.score !== p2.metrics.score) return p1.metrics.score > p2.metrics.score ? 1 : 2;
    if (p1.metrics.accuracy !== p2.metrics.accuracy) return p1.metrics.accuracy > p2.metrics.accuracy ? 1 : 2;
    if (p1.metrics.totalMs !== p2.metrics.totalMs) return p1.metrics.totalMs < p2.metrics.totalMs ? 1 : 2;
    return 0;
  }

  function renderCmpBarRow(label, v1Text, v2Text, n1, n2, lowerIsBetter) {
    const maxVal = Math.max(1, Number(n1) || 0, Number(n2) || 0);
    const w1 = Math.max(6, Math.round(((Number(n1) || 0) / maxVal) * 100));
    const w2 = Math.max(6, Math.round(((Number(n2) || 0) / maxVal) * 100));
    const p1Better = lowerIsBetter ? (n1 > 0 && (n2 <= 0 || n1 < n2)) : (n1 > n2);
    const p2Better = lowerIsBetter ? (n2 > 0 && (n1 <= 0 || n2 < n1)) : (n2 > n1);

    return `
      <div class="cmp-metric-row">
        <div class="cmp-metric-top">
          <span class="${p1Better ? 'h2h-p1' : ''}">${numSpan(v1Text)}</span>
          <span>${escapeHtml(label)}</span>
          <span class="${p2Better ? 'h2h-p2' : ''}">${numSpan(v2Text)}</span>
        </div>
        <div class="cmp-bars-pair">
          <div class="cmp-bar-track"><div class="cmp-bar-fill-p1" style="width:${w1}%"></div></div>
          <div class="cmp-bar-track"><div class="cmp-bar-fill-p2" style="width:${w2}%"></div></div>
        </div>
      </div>
    `;
  }

  function renderComparisonDashboard(match) {
    const p1 = match.p1;
    const p2 = match.p2;
    const winner = determineWinner(p1, p2);
    const winnerText = winner === 0
      ? t('tieLabel')
      : `${t('winnerLabel')} ${winner === 1 ? p1.playerName : p2.playerName}`;

    const trials = match.sameSeed
      ? (Array.isArray(match.trials) && match.trials.length ? match.trials : ensureTrialsForRun(p1))
      : [];

    // Agreement counts
    let bothOk = 0;
    let only1 = 0;
    let only2 = 0;
    let bothMiss = 0;
    const minLen = Math.min(p1.results.length, p2.results.length);
    const qRowsHtml = [];

    if (match.sameSeed && minLen > 0) {
      for (let i = 0; i < minLen; i++) {
        const r1 = p1.results[i];
        const r2 = p2.results[i];
        const ok1 = Boolean(r1 && r1.correct);
        const ok2 = Boolean(r2 && r2.correct);
        if (ok1 && ok2) bothOk += 1;
        else if (ok1 && !ok2) only1 += 1;
        else if (!ok1 && ok2) only2 += 1;
        else bothMiss += 1;

        const tr = trials[i];
        const angle = (r1 && r1.angleDeg) || (tr && tr.angleDeg) || 0;
        qRowsHtml.push(`
          <div class="review-item ${ok1 && ok2 ? 'item-correct' : (!ok1 && !ok2 ? 'item-wrong' : '')}">
            <div class="review-item-main">
              <div class="review-item-top">
                <strong>${escapeHtml(t('questionWord'))} ${numSpan(i + 1)}</strong>
                ${angle ? `<span class="badge badge-neutral">${numSpan(angle + '°')}</span>` : ''}
                <span class="badge ${ok1 ? 'badge-success' : 'badge-danger'}">${escapeHtml(p1.playerName)}: ${escapeHtml(ok1 ? t('verdictCorrect') : t('verdictWrong'))}${r1 && r1.rtMs ? ' · ' + numSpan(formatMs(r1.rtMs)) : ''}</span>
                <span class="badge ${ok2 ? 'badge-success' : 'badge-danger'}">${escapeHtml(p2.playerName)}: ${escapeHtml(ok2 ? t('verdictCorrect') : t('verdictWrong'))}${r2 && r2.rtMs ? ' · ' + numSpan(formatMs(r2.rtMs)) : ''}</span>
              </div>
            </div>
            ${tr ? `<button type="button" class="btn btn-outline btn-sm" data-cmp-replay="${i}">${escapeHtml(t('replay3dBtn'))}</button>` : ''}
          </div>
        `);
      }
    }

    const bandsHtml = ['small', 'medium', 'large'].map((bKey) => {
      const label = bKey === 'small' ? t('bandSmall') : bKey === 'medium' ? t('bandMedium') : t('bandLarge');
      const range = bKey === 'small' ? '30°–65°' : bKey === 'medium' ? '66°–120°' : '121°–180°';
      const b1 = p1.metrics.bands[bKey] || { correct: 0, total: 0, accuracy: 0, medianMs: 0 };
      const b2 = p2.metrics.bands[bKey] || { correct: 0, total: 0, accuracy: 0, medianMs: 0 };
      return `
        <div class="band-card">
          <span class="band-card-title">${escapeHtml(label)}</span>
          <span class="band-card-range">${numSpan(range)}</span>
          <span class="band-card-sub"><strong class="h2h-p1">${escapeHtml(p1.playerName)}:</strong> ${b1.total ? numSpan(formatPct(b1.accuracy)) : t('noDataDash')}</span>
          <span class="band-card-sub"><strong class="h2h-p2">${escapeHtml(p2.playerName)}:</strong> ${b2.total ? numSpan(formatPct(b2.accuracy)) : t('noDataDash')}</span>
        </div>
      `;
    }).join('');

    dom.compareResultsView.innerHTML = `
      <div class="card h2h-banner">
        <div class="h2h-winner-row">
          <div>
            <h2 class="section-title">${escapeHtml(t('h2hTitle'))}</h2>
            <p class="section-desc">${escapeHtml(winnerText)}</p>
          </div>
          <div class="arena-meta">
            <span class="badge ${match.sameSeed ? 'badge-success' : 'badge-amber'}">${escapeHtml(match.sameSeed ? t('exactSameSeed') : t('differentSeedNotice'))}</span>
            <span class="seed-chip num" dir="ltr">${escapeHtml(match.seed)}</span>
          </div>
        </div>

        <div class="h2h-players-strip">
          <div class="h2h-player-card ${winner === 1 ? 'is-winner' : ''}">
            <span class="h2h-player-name h2h-p1">${escapeHtml(p1.playerName)}</span>
            <span class="h2h-player-score num" dir="ltr">${p1.metrics.score}</span>
            <span class="kpi-sub">${numSpan(formatPct(p1.metrics.accuracy))} · ${numSpan(p1.metrics.correct + '/' + p1.metrics.total)} · ${numSpan(formatMs(p1.metrics.totalMs))}</span>
          </div>
          <div class="h2h-player-card ${winner === 2 ? 'is-winner' : ''}">
            <span class="h2h-player-name h2h-p2">${escapeHtml(p2.playerName)}</span>
            <span class="h2h-player-score num" dir="ltr">${p2.metrics.score}</span>
            <span class="kpi-sub">${numSpan(formatPct(p2.metrics.accuracy))} · ${numSpan(p2.metrics.correct + '/' + p2.metrics.total)} · ${numSpan(formatMs(p2.metrics.totalMs))}</span>
          </div>
        </div>

        <div class="cmp-metrics-list">
          ${renderCmpBarRow(t('scoreLabel'), String(p1.metrics.score), String(p2.metrics.score), p1.metrics.score, p2.metrics.score, false)}
          ${renderCmpBarRow(t('accuracy'), formatPct(p1.metrics.accuracy), formatPct(p2.metrics.accuracy), p1.metrics.accuracy, p2.metrics.accuracy, false)}
          ${renderCmpBarRow(t('correctAnswers'), `${p1.metrics.correct}/${p1.metrics.total}`, `${p2.metrics.correct}/${p2.metrics.total}`, p1.metrics.correct, p2.metrics.correct, false)}
          ${renderCmpBarRow(t('totalTime'), formatMs(p1.metrics.totalMs), formatMs(p2.metrics.totalMs), p1.metrics.totalMs, p2.metrics.totalMs, true)}
          ${renderCmpBarRow(t('medianShort'), formatMs(p1.metrics.medianMs), formatMs(p2.metrics.medianMs), p1.metrics.medianMs, p2.metrics.medianMs, true)}
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">${escapeHtml(t('angleBandsCompare'))}</h3>
        <div class="band-cards-grid">${bandsHtml}</div>
      </div>

      ${match.sameSeed && qRowsHtml.length ? `
        <div class="card">
          <h3 class="card-title">${escapeHtml(t('agreementTitle'))}</h3>
          <div class="agreement-pills">
            <div class="agreement-stat"><span>${escapeHtml(t('bothCorrect'))}</span>${numSpan(bothOk, 'badge badge-success')}</div>
            <div class="agreement-stat"><span>${escapeHtml(t('onlyP1'))}</span>${numSpan(only1, 'badge badge-accent')}</div>
            <div class="agreement-stat"><span>${escapeHtml(t('onlyP2'))}</span>${numSpan(only2, 'badge badge-amber')}</div>
            <div class="agreement-stat"><span>${escapeHtml(t('bothWrong'))}</span>${numSpan(bothMiss, 'badge badge-danger')}</div>
          </div>
          <div class="review-list">${qRowsHtml.join('')}</div>
        </div>
      ` : ''}

      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="btnNewCompareMatch">${escapeHtml(t('newMatchBtn'))}</button>
        ${p1.resultCode ? `<button type="button" class="btn btn-outline btn-sm" id="btnCopyP1Code">${escapeHtml(p1.playerName)} · M3D</button>` : ''}
        ${p2.resultCode ? `<button type="button" class="btn btn-outline btn-sm" id="btnCopyP2Code">${escapeHtml(p2.playerName)} · M3D</button>` : ''}
      </div>
    `;

    dom.compareResultsView.querySelector('#btnNewCompareMatch').addEventListener('click', () => {
      const eng = getEngine();
      if (eng && typeof eng.createSeedCode === 'function') {
        state.compareConfig.seed = eng.createSeedCode();
        dom.cmpSeedInput.value = state.compareConfig.seed;
      }
      setCompareSubMode(state.compareConfig.subMode);
    });

    const btnP1 = dom.compareResultsView.querySelector('#btnCopyP1Code');
    if (btnP1) btnP1.addEventListener('click', () => copyText(p1.resultCode, t('toastCopiedCode')));
    const btnP2 = dom.compareResultsView.querySelector('#btnCopyP2Code');
    if (btnP2) btnP2.addEventListener('click', () => copyText(p2.resultCode, t('toastCopiedCode')));

    dom.compareResultsView.querySelectorAll('[data-cmp-replay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cmp-replay'));
        const tr = trials[idx];
        if (!tr) return;
        const r1 = p1.results[idx];
        const r2 = p2.results[idx];
        openReplayModal(tr, idx, {
          compareRuns: [
            { playerName: p1.playerName, correct: Boolean(r1 && r1.correct) },
            { playerName: p2.playerName, correct: Boolean(r2 && r2.correct) }
          ]
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     TAB 4: LOCAL HISTORY & PROGRESS TREND
     ------------------------------------------------------------------------ */

  function renderHistoryView() {
    if (!dom.historyContent) return;

    if (!state.history.length) {
      dom.historyContent.innerHTML = `
        <div class="card history-empty">
          <h2 class="section-title">${escapeHtml(t('historyEmptyTitle'))}</h2>
          <p class="section-desc">${escapeHtml(t('historyEmptyDesc'))}</p>
          <button type="button" class="btn btn-primary" id="btnHistoryGoTest">${escapeHtml(t('goToTest'))}</button>
        </div>
      `;
      const goBtn = dom.historyContent.querySelector('#btnHistoryGoTest');
      if (goBtn) goBtn.addEventListener('click', () => switchTab('test'));
      return;
    }

    const soloRuns = state.history.filter((e) => e.type !== 'compare' && e.metrics);
    const allScores = state.history.map((e) => {
      if (e.type === 'compare') return Math.max(e.p1.metrics.score, e.p2.metrics.score);
      return e.metrics ? e.metrics.score : 0;
    });
    const bestScore = allScores.length ? Math.max(...allScores) : 0;
    const avgAcc = soloRuns.length
      ? soloRuns.reduce((sum, e) => sum + normalizePctNumber(e.metrics.accuracy), 0) / soloRuns.length
      : (state.history[0].p1 ? normalizePctNumber(state.history[0].p1.metrics.accuracy) : 0);
    const bestLevel = state.history.reduce((mx, e) => {
      const lv = e.type === 'compare'
        ? Math.max(e.p1.metrics.nextLevel || 1, e.p2.metrics.nextLevel || 1)
        : (e.metrics && e.metrics.nextLevel) || 1;
      return Math.max(mx, lv);
    }, 1);

    const filter = state.historyFilter || 'all';
    const visible = state.history.filter((e) => {
      if (filter === 'test') return e.type === 'test' || e.type === 'train';
      if (filter === 'compare') return e.type === 'compare';
      return true;
    });

    const cardsHtml = visible.length
      ? visible.map((entry) => {
          const dateStr = formatDateAscii(entry.createdAt);
          if (entry.type === 'compare') {
            return `
              <div class="history-card">
                <div class="history-card-top">
                  <div class="arena-meta">
                    <span class="badge badge-accent">${escapeHtml(t('typeCompare'))}</span>
                    <span class="seed-chip num" dir="ltr">${escapeHtml(entry.seed)}</span>
                    <span class="badge badge-neutral">${escapeHtml(formatFormatLabel(entry.format))}</span>
                  </div>
                  <span class="kpi-sub">${numSpan(dateStr)}</span>
                </div>
                <div class="history-card-metrics">
                  <span><strong class="h2h-p1">${escapeHtml(entry.p1.playerName)}:</strong> ${numSpan(entry.p1.metrics.score)} (${numSpan(formatPct(entry.p1.metrics.accuracy))})</span>
                  <span><strong class="h2h-p2">${escapeHtml(entry.p2.playerName)}:</strong> ${numSpan(entry.p2.metrics.score)} (${numSpan(formatPct(entry.p2.metrics.accuracy))})</span>
                </div>
                <div class="btn-row">
                  <button type="button" class="btn btn-outline btn-sm" data-hist-open="${escapeHtml(entry.id)}">${escapeHtml(t('viewDetails'))}</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-hist-replay="${escapeHtml(entry.id)}">${escapeHtml(t('replaySeed'))}</button>
                </div>
              </div>
            `;
          }
          const badgeLabel = entry.type === 'train' ? t('typeTrain') : t('typeTest');
          return `
            <div class="history-card">
              <div class="history-card-top">
                <div class="arena-meta">
                  <span class="badge ${entry.type === 'train' ? 'badge-neutral' : 'badge-success'}">${escapeHtml(badgeLabel)}</span>
                  <strong>${escapeHtml(entry.playerName || t('defaultPlayer1'))}</strong>
                  <span class="seed-chip num" dir="ltr">${escapeHtml(entry.seed)}</span>
                  <span class="badge badge-neutral">${escapeHtml(formatFormatLabel(entry.format))}</span>
                </div>
                <span class="kpi-sub">${numSpan(dateStr)}</span>
              </div>
              <div class="history-card-metrics">
                <span>${escapeHtml(t('scoreLabel'))}: <strong>${numSpan(entry.metrics.score)}</strong></span>
                <span>${escapeHtml(t('accuracy'))}: <strong>${numSpan(formatPct(entry.metrics.accuracy))}</strong></span>
                <span>${escapeHtml(t('correctAnswers'))}: <strong>${numSpan(entry.metrics.correct + '/' + entry.metrics.total)}</strong></span>
                <span>${escapeHtml(t('totalTime'))}: <strong>${numSpan(formatMs(entry.metrics.totalMs))}</strong></span>
              </div>
              <div class="btn-row">
                ${entry.type === 'test' ? `<button type="button" class="btn btn-outline btn-sm" data-hist-open="${escapeHtml(entry.id)}">${escapeHtml(t('viewDetails'))}</button>` : ''}
                ${entry.resultCode ? `<button type="button" class="btn btn-ghost btn-sm" data-hist-code="${escapeHtml(entry.id)}">M3D</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-hist-replay="${escapeHtml(entry.id)}">${escapeHtml(t('replaySeed'))}</button>
              </div>
            </div>
          `;
        }).join('')
      : `<p class="section-desc">${escapeHtml(t('noFilterItems'))}</p>`;

    dom.historyContent.innerHTML = `
      <div class="card">
        <div class="section-head">
          <div>
            <h2 class="section-title">${escapeHtml(t('historyTitle'))}</h2>
          </div>
          <div class="btn-row">
            ${state.confirmClearHistory ? `
              <button type="button" class="btn btn-danger-outline btn-sm" id="btnConfirmClearHist">${escapeHtml(t('confirmClearHistory'))}</button>
              <button type="button" class="btn btn-ghost btn-sm" id="btnCancelClearHist">${escapeHtml(t('cancelWord'))}</button>
            ` : `
              <button type="button" class="btn btn-ghost btn-sm" id="btnAskClearHist">${escapeHtml(t('clearHistory'))}</button>
            `}
          </div>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('historySessions'))}</span>
            <span class="kpi-value">${numSpan(state.history.length)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('historyBestScore'))}</span>
            <span class="kpi-value">${numSpan(bestScore)}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('historyAvgAcc'))}</span>
            <span class="kpi-value">${numSpan(formatPct(avgAcc))}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">${escapeHtml(t('historyBestLevel'))}</span>
            <span class="kpi-value">${escapeHtml(t('levelWord'))} ${numSpan(bestLevel)}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">${escapeHtml(t('trendTitle'))}</h3>
        ${buildHistoryTrendSvg(soloRuns)}
      </div>

      <div class="card">
        <div class="review-head">
          <h3 class="card-title" style="margin:0">${escapeHtml(t('tabHistory'))}</h3>
          <div class="segmented" id="historyFilterSeg">
            <button type="button" class="seg-btn ${filter === 'all' ? 'active' : ''}" data-hfilter="all">${escapeHtml(t('filterAll'))}</button>
            <button type="button" class="seg-btn ${filter === 'test' ? 'active' : ''}" data-hfilter="test">${escapeHtml(t('filterTests'))}</button>
            <button type="button" class="seg-btn ${filter === 'compare' ? 'active' : ''}" data-hfilter="compare">${escapeHtml(t('filterCompares'))}</button>
          </div>
        </div>
        <div class="history-list">${cardsHtml}</div>
      </div>
    `;

    const askBtn = dom.historyContent.querySelector('#btnAskClearHist');
    if (askBtn) askBtn.addEventListener('click', () => { state.confirmClearHistory = true; renderHistoryView(); });
    const cancelBtn = dom.historyContent.querySelector('#btnCancelClearHist');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { state.confirmClearHistory = false; renderHistoryView(); });
    const confirmBtn = dom.historyContent.querySelector('#btnConfirmClearHist');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        state.history = [];
        state.confirmClearHistory = false;
        persistHistory();
        showToast(t('toastHistoryCleared'));
        renderHistoryView();
      });
    }

    dom.historyContent.querySelectorAll('#historyFilterSeg .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.historyFilter = btn.getAttribute('data-hfilter') || 'all';
        renderHistoryView();
      });
    });

    dom.historyContent.querySelectorAll('[data-hist-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-hist-open');
        const entry = state.history.find((e) => e.id === id);
        if (!entry) return;
        if (entry.type === 'compare') {
          state.activeCompareMatch = entry;
          showCompareResultsView(entry);
        } else {
          state.activeTestResult = entry;
          state.activeTestFilter = 'all';
          switchTab('test');
          dom.testSetupView.classList.add('hidden');
          dom.testRunnerView.classList.add('hidden');
          dom.testResultsView.classList.remove('hidden');
          renderTestResultsDashboard(entry);
        }
      });
    });

    dom.historyContent.querySelectorAll('[data-hist-code]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-hist-code');
        const entry = state.history.find((e) => e.id === id);
        if (entry && entry.resultCode) copyText(entry.resultCode, t('toastCopiedCode'));
      });
    });

    dom.historyContent.querySelectorAll('[data-hist-replay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-hist-replay');
        const entry = state.history.find((e) => e.id === id);
        if (!entry) return;
        startRunnerSession({
          mode: 'test',
          config: {
            seed: entry.seed,
            format: entry.format,
            level: entry.level,
            count: entry.count,
            timerSec: entry.timerSec || 0
          },
          playerName: sanitizePlayerName(dom.testPlayerName.value, 'defaultPlayer1')
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     LIVE 3D REPLAY MODAL (Test Review & Comparison)
     ------------------------------------------------------------------------ */

  function openReplayModal(trial, index, contextInfo) {
    closeReplayModal();
    state.replay.open = true;
    state.replay.trial = trial;
    state.replay.showAnchor = true;

    dom.replayModalTitle.innerHTML = `${escapeHtml(t('replayModalTitlePrefix'))} ${numSpan(index + 1)}`;
    const truthText = trial.format === 'quad'
      ? `${t('correctChoice')}: ${t('optionWord')} ${trial.correctOptionIndex + 1}`
      : (trial.isSame ? t('sameFigureBtn') : t('diffFigureBtn'));
    dom.replayModalSubtitle.innerHTML = `${escapeHtml(truthText)} · ${escapeHtml(t('anglePrefix'))} ${numSpan(trial.angleDeg + '°')}`;

    const badges = [];
    if (contextInfo && contextInfo.singleRun) {
      const sr = contextInfo.singleRun;
      badges.push(`<span class="badge ${sr.correct ? 'badge-success' : 'badge-danger'}">${escapeHtml(sr.playerName)}: ${escapeHtml(sr.pickedText)}</span>`);
    } else if (contextInfo && Array.isArray(contextInfo.compareRuns)) {
      contextInfo.compareRuns.forEach((cr) => {
        badges.push(`<span class="badge ${cr.correct ? 'badge-success' : 'badge-danger'}">${escapeHtml(cr.playerName)}: ${escapeHtml(cr.correct ? t('verdictCorrect') : t('verdictWrong'))}</span>`);
      });
    }
    badges.push(`<span class="badge badge-accent">${escapeHtml(t('levelWord'))} ${numSpan(trial.level)}</span>`);
    dom.replayVerdictStrip.innerHTML = badges.join('');

    dom.btnReplayAnchor.classList.add('active');
    dom.btnReplayAnchor.setAttribute('aria-pressed', 'true');
    dom.replayModal.classList.remove('hidden');

    if (trial.format === 'pair') {
      dom.replayPairGrid.classList.remove('hidden');
      dom.replayQuadLayout.classList.add('hidden');
      dom.replayPairGrid.querySelectorAll('.canvas-wrap').forEach((w) => w.classList.add('interactive'));

      const refVp = createVp(dom.replayRefCanvas, { interactive: true, showAnchor: true });
      const tgtVp = createVp(dom.replayTargetCanvas, { interactive: true, showAnchor: true });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: true, anchorIndex: trial.anchorIndex });
        state.replay.viewports.push(refVp);
      }
      if (tgtVp) {
        tgtVp.setFigure(trial.targetCubes, trial.targetQuat, { showAnchor: true, anchorIndex: trial.anchorIndex });
        state.replay.viewports.push(tgtVp);
      }
    } else {
      dom.replayPairGrid.classList.add('hidden');
      dom.replayQuadLayout.classList.remove('hidden');

      const refVp = createVp(dom.replayQuadRefCanvas, { interactive: true, showAnchor: true });
      if (refVp) {
        refVp.setFigure(trial.cubes, trial.refQuat, { showAnchor: true, anchorIndex: trial.anchorIndex });
        state.replay.viewports.push(refVp);
      }

      dom.replayQuadOptionsGrid.innerHTML = '';
      (trial.options || []).forEach((opt, idx) => {
        const isRight = idx === trial.correctOptionIndex;
        const card = document.createElement('div');
        card.className = `quad-option-card ${isRight ? 'opt-correct' : ''}`;
        card.innerHTML = `
          <div class="quad-opt-head">
            <span class="quad-opt-badge num" dir="ltr">${idx + 1}</span>
            ${isRight ? `<span class="badge badge-success">${escapeHtml(t('correctChoice'))}</span>` : ''}
          </div>
          <div class="quad-opt-canvas-wrap">
            <canvas></canvas>
          </div>
        `;
        const canvas = card.querySelector('canvas');
        dom.replayQuadOptionsGrid.appendChild(card);
        const optVp = createVp(canvas, { interactive: true, showAnchor: true });
        if (optVp) {
          optVp.setFigure(opt.cubes, opt.quat, { showAnchor: true, anchorIndex: trial.anchorIndex });
          state.replay.viewports.push(optVp);
        }
      });
    }

    scheduleResizeAll();
  }

  function closeReplayModal() {
    destroyPool(state.replay.viewports);
    state.replay.open = false;
    state.replay.trial = null;
    if (dom.replayModal) dom.replayModal.classList.add('hidden');
  }

  function playReplayModalRotation() {
    const trial = state.replay.trial;
    if (!trial || !state.replay.viewports.length) return;
    const refVp = state.replay.viewports[0];
    if (!refVp) return;

    state.replay.showAnchor = true;
    dom.btnReplayAnchor.classList.add('active');
    dom.btnReplayAnchor.setAttribute('aria-pressed', 'true');
    state.replay.viewports.forEach((vp, i) => {
      if (vp && typeof vp.setShowAnchor === 'function') vp.setShowAnchor(true);
      if (i > 0 && vp && typeof vp.resetView === 'function') vp.resetView(0);
    });

    const destQuat = trial.format === 'quad'
      ? trial.options[trial.correctOptionIndex].quat
      : trial.targetQuat;

    refVp.setFigure(trial.cubes, trial.refQuat, {
      showAnchor: true,
      anchorIndex: trial.anchorIndex
    });

    requestAnimationFrame(() => {
      if (typeof refVp.animateToQuat === 'function') {
        refVp.animateToQuat(destQuat, 1300);
      }
    });
  }

  /* ------------------------------------------------------------------------
     URL CHALLENGE DEEP-LINK PARSING
     ------------------------------------------------------------------------ */

  function parseUrlChallenge() {
    const params = new URLSearchParams(window.location.search);
    const seedRaw = params.get('seed');
    if (!seedRaw || !seedRaw.trim()) return null;

    const format = params.get('format') === 'quad' ? 'quad' : 'pair';
    const rawLevel = params.get('level');
    let level = 3;
    if (rawLevel === 'adaptive') {
      level = 'adaptive';
    } else if (rawLevel !== null) {
      const n = Number(rawLevel);
      if (n >= 1 && n <= 5) level = Math.round(n);
    }
    const rawCount = Number(params.get('count'));
    const count = Number.isFinite(rawCount) && rawCount >= 4 && rawCount <= 30 ? Math.round(rawCount) : 12;
    const rawTimer = Number(params.get('timer'));
    const timerSec = Number.isFinite(rawTimer) && rawTimer >= 0 && rawTimer <= 1800 ? Math.round(rawTimer) : 0;

    return {
      seed: sanitizeSeed(seedRaw),
      format,
      level,
      count,
      timerSec
    };
  }

  function renderUrlChallengeBanner() {
    const ch = state.urlChallenge;
    if (!ch) {
      dom.urlChallengeBanner.classList.add('hidden');
      return;
    }
    dom.urlChallengeSeed.textContent = ch.seed;
    dom.urlChallengeDesc.innerHTML = `${escapeHtml(formatFormatLabel(ch.format))} · ${formatLevelLabel(ch.level)} · ${numSpan(ch.count)} ${escapeHtml(t('questionCountLabel'))} · ${escapeHtml(formatTimerLabel(ch.timerSec))}`;
    dom.urlChallengeBanner.classList.remove('hidden');
  }

  /* ------------------------------------------------------------------------
     EVENT WIRING
     ------------------------------------------------------------------------ */

  function bindSegmented(container, onChange) {
    if (!container) return;
    container.querySelectorAll('button[data-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button[data-value]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.getAttribute('data-value'));
      });
    });
  }

  function bindEvents() {
    // Header toggles
    dom.btnThemeToggle.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
    dom.btnLangToggle.addEventListener('click', () => {
      applyLanguage(state.lang === 'ar' ? 'en' : 'ar');
    });

    // Main tabs
    [dom.tabBtnTrain, dom.tabBtnTest, dom.tabBtnCompare, dom.tabBtnHistory].forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // URL Challenge Banner
    dom.btnStartUrlChallenge.addEventListener('click', () => {
      if (!state.urlChallenge) return;
      dom.urlChallengeBanner.classList.add('hidden');
      startRunnerSession({
        mode: 'remote-self',
        config: state.urlChallenge,
        playerName: sanitizePlayerName(dom.testPlayerName.value, 'defaultPlayer1')
      });
    });
    dom.btnDismissUrlChallenge.addEventListener('click', () => {
      state.urlChallenge = null;
      dom.urlChallengeBanner.classList.add('hidden');
    });

    // Training controls
    bindSegmented(dom.trainFormatSeg, (val) => {
      state.train.format = val === 'quad' ? 'quad' : 'pair';
      loadNextTrainTrial();
    });
    bindSegmented(dom.trainLevelPills, (val) => {
      state.train.difficulty = val === 'adaptive' ? 'adaptive' : Number(val);
      loadNextTrainTrial();
    });

    dom.btnTrainSame.addEventListener('click', () => submitTrainAnswer(true));
    dom.btnTrainDiff.addEventListener('click', () => submitTrainAnswer(false));
    dom.btnTrainNext.addEventListener('click', loadNextTrainTrial);
    dom.btnTrainAnimate.addEventListener('click', playTrainLiveRotation);
    dom.btnTrainAnchor.addEventListener('click', () => setTrainAnchorHighlight(!state.train.showAnchor));
    dom.btnTrainResetView.addEventListener('click', resetTrainViewports);
    dom.btnSaveTrainSession.addEventListener('click', saveCurrentTrainSession);

    // Test setup controls
    bindSegmented(dom.testFormatSeg, (val) => { state.testConfig.format = val === 'quad' ? 'quad' : 'pair'; });
    bindSegmented(dom.testCountSeg, (val) => { state.testConfig.count = Number(val) || 12; });
    bindSegmented(dom.testTimerSeg, (val) => { state.testConfig.timerSec = Number(val) || 0; });

    dom.btnTestNewSeed.addEventListener('click', () => {
      const eng = getEngine();
      state.testConfig.seed = eng && eng.createSeedCode ? eng.createSeedCode() : 'SM-2048';
      dom.testSeedInput.value = state.testConfig.seed;
    });
    dom.testSeedInput.addEventListener('input', () => {
      state.testConfig.seed = dom.testSeedInput.value;
    });
    dom.btnStartTest.addEventListener('click', () => {
      state.testConfig.seed = sanitizeSeed(dom.testSeedInput.value);
      dom.testSeedInput.value = state.testConfig.seed;
      startRunnerSession({
        mode: 'test',
        config: state.testConfig,
        playerName: sanitizePlayerName(dom.testPlayerName.value, 'defaultPlayer1')
      });
    });

    // Active runner buttons
    dom.btnRunnerSame.addEventListener('click', () => submitRunnerAnswer(true));
    dom.btnRunnerDiff.addEventListener('click', () => submitRunnerAnswer(false));
    dom.btnCancelTest.addEventListener('click', () => {
      const wasCompare = state.runner.mode === 'pass-p1' || state.runner.mode === 'pass-p2';
      stopRunnerCleanly();
      dom.testRunnerView.classList.add('hidden');
      if (wasCompare) {
        switchTab('compare');
        setCompareSubMode('pass');
      } else {
        dom.testSetupView.classList.remove('hidden');
      }
    });

    // Compare controls
    bindSegmented(dom.compareModeSeg, (val) => setCompareSubMode(val));
    bindSegmented(dom.cmpFormatSeg, (val) => {
      state.compareConfig.format = val === 'quad' ? 'quad' : 'pair';
      updateRemoteUrlPreview();
    });
    bindSegmented(dom.cmpLevelPills, (val) => {
      state.compareConfig.level = val === 'adaptive' ? 'adaptive' : Number(val);
      updateRemoteUrlPreview();
    });
    bindSegmented(dom.cmpCountSeg, (val) => {
      state.compareConfig.count = Number(val) || 8;
      updateRemoteUrlPreview();
    });
    bindSegmented(dom.cmpTimerSeg, (val) => {
      state.compareConfig.timerSec = Number(val) || 0;
      updateRemoteUrlPreview();
    });

    dom.p1NameInput.addEventListener('input', updatePassStartButtonLabel);
    dom.cmpSeedInput.addEventListener('input', () => {
      state.compareConfig.seed = dom.cmpSeedInput.value;
      updateRemoteUrlPreview();
    });
    dom.btnCmpNewSeed.addEventListener('click', () => {
      const eng = getEngine();
      state.compareConfig.seed = eng && eng.createSeedCode ? eng.createSeedCode() : 'SM-3096';
      dom.cmpSeedInput.value = state.compareConfig.seed;
      updateRemoteUrlPreview();
    });
    dom.btnStartPassP1.addEventListener('click', startPassAndPlayP1);
    dom.btnStartPassP2.addEventListener('click', startPassAndPlayP2);
    dom.btnAbortHandoff.addEventListener('click', () => setCompareSubMode('pass'));

    // Remote compare controls
    dom.btnCopyRemoteUrl.addEventListener('click', () => {
      copyText(buildChallengeUrl(state.compareConfig), t('toastCopiedLink'));
    });
    dom.btnRemoteNewSeed.addEventListener('click', () => {
      const eng = getEngine();
      state.compareConfig.seed = eng && eng.createSeedCode ? eng.createSeedCode() : 'SM-5120';
      dom.cmpSeedInput.value = state.compareConfig.seed;
      updateRemoteUrlPreview();
    });
    dom.btnPlayRemoteSelf.addEventListener('click', () => {
      startRunnerSession({
        mode: 'remote-self',
        config: state.compareConfig,
        playerName: sanitizePlayerName(dom.testPlayerName.value, 'defaultPlayer1')
      });
    });
    dom.btnCompareCodes.addEventListener('click', handleCompareTwoCodes);
    dom.btnUseLastTestCode.addEventListener('click', () => {
      const latest = state.lastTestRun || state.history.find((e) => e.type === 'test' && e.resultCode);
      if (!latest || !latest.resultCode) {
        showToast(t('noLastTestYet'));
        return;
      }
      if (!dom.codeInputA.value.trim()) {
        dom.codeInputA.value = latest.resultCode;
      } else {
        dom.codeInputB.value = latest.resultCode;
      }
      showToast(t('toastFilledCode'));
    });

    // Replay modal controls
    dom.btnCloseReplayModal.addEventListener('click', closeReplayModal);
    dom.replayModal.addEventListener('click', (e) => {
      if (e.target === dom.replayModal) closeReplayModal();
    });
    dom.btnReplayAnimate.addEventListener('click', playReplayModalRotation);
    dom.btnReplayAnchor.addEventListener('click', () => {
      state.replay.showAnchor = !state.replay.showAnchor;
      dom.btnReplayAnchor.classList.toggle('active', state.replay.showAnchor);
      dom.btnReplayAnchor.setAttribute('aria-pressed', state.replay.showAnchor ? 'true' : 'false');
      state.replay.viewports.forEach((vp) => {
        if (vp && typeof vp.setShowAnchor === 'function') vp.setShowAnchor(state.replay.showAnchor);
      });
    });
    dom.btnReplayReset.addEventListener('click', () => {
      state.replay.viewports.forEach((vp) => {
        if (vp && typeof vp.resetView === 'function') vp.resetView();
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (state.replay.open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeReplayModal();
        }
        return;
      }

      if (state.runner.active) {
        const trial = state.runner.trials[state.runner.currentIndex];
        if (!trial) return;
        if (trial.format === 'pair') {
          if (e.key === '1' || e.key === 'ArrowRight') { e.preventDefault(); submitRunnerAnswer(true); }
          else if (e.key === '2' || e.key === 'ArrowLeft') { e.preventDefault(); submitRunnerAnswer(false); }
        } else if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          submitRunnerAnswer(Number(e.key) - 1);
        }
        return;
      }

      if (state.activeTab === 'train' && state.train.currentTrial) {
        if (!state.train.answered) {
          if (state.train.currentTrial.format === 'pair') {
            if (e.key === '1' || e.key === 'ArrowRight') { e.preventDefault(); submitTrainAnswer(true); }
            else if (e.key === '2' || e.key === 'ArrowLeft') { e.preventDefault(); submitTrainAnswer(false); }
          } else if (['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            submitTrainAnswer(Number(e.key) - 1);
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadNextTrainTrial();
        }
      }
    });

    // Responsive canvas resizing
    let resizeDebounce = null;
    window.addEventListener('resize', () => {
      if (resizeDebounce) clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(scheduleResizeAll, 80);
    });
  }

  /* ------------------------------------------------------------------------
     INITIALIZATION
     ------------------------------------------------------------------------ */

  function init() {
    cacheDom();
    loadHistory();

    const eng = getEngine();
    const mkSeed = () => (eng && typeof eng.createSeedCode === 'function' ? eng.createSeedCode() : 'SM-4829');

    state.train.seed = mkSeed();
    state.testConfig.seed = mkSeed();
    state.compareConfig.seed = mkSeed();

    // Check URL deep link parameters
    const urlChallenge = parseUrlChallenge();
    if (urlChallenge) {
      state.urlChallenge = urlChallenge;
      state.testConfig = { ...urlChallenge };
      state.compareConfig = {
        ...state.compareConfig,
        ...urlChallenge
      };
    }

    dom.testSeedInput.value = state.testConfig.seed;
    dom.cmpSeedInput.value = state.compareConfig.seed;

    // Saved preferences
    let savedTheme = 'light';
    let savedLang = 'ar';
    try {
      savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
      savedLang = localStorage.getItem(STORAGE_KEYS.lang) || 'ar';
    } catch (_err) {
      // ignore
    }

    bindEvents();
    applyTheme(savedTheme);
    applyLanguage(savedLang);

    // Sync compare/test segmented UI if URL deep-linked
    if (urlChallenge) {
      syncSegmentedActive(dom.testFormatSeg, urlChallenge.format);
      syncSegmentedActive(dom.testCountSeg, String(urlChallenge.count));
      syncSegmentedActive(dom.testTimerSeg, String(urlChallenge.timerSec));
      syncSegmentedActive(dom.cmpFormatSeg, urlChallenge.format);
      syncSegmentedActive(dom.cmpLevelPills, String(urlChallenge.level));
      syncSegmentedActive(dom.cmpCountSeg, String(urlChallenge.count));
      syncSegmentedActive(dom.cmpTimerSeg, String(urlChallenge.timerSec));
      renderTestLevelCards();
      renderUrlChallengeBanner();
    }

    updateRemoteUrlPreview();
    switchTab('train');
  }

  function syncSegmentedActive(container, value) {
    if (!container) return;
    container.querySelectorAll('button[data-value]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-value') === String(value));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

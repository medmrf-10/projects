"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createLabSandbox() {
  const localStore = new Map();
  const sessionStore = new Map();

  const makeStorage = (backing) => ({
    getItem(k) {
      return backing.has(String(k)) ? backing.get(String(k)) : null;
    },
    setItem(k, v) {
      backing.set(String(k), String(v));
    },
    removeItem(k) {
      backing.delete(String(k));
    },
    clear() {
      backing.clear();
    }
  });

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    TypeError,
    Map,
    Set,
    Promise,
    Uint8Array,
    Uint32Array,
    Float64Array,
    TextEncoder,
    TextDecoder,
    Buffer,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (bin) => Buffer.from(bin, "binary").toString("base64"),
    atob: (b64) => Buffer.from(b64, "base64").toString("binary"),
    crypto: require("node:crypto").webcrypto,
    performance: { now: () => Date.now() },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile" },
    localStorage: makeStorage(localStore),
    sessionStorage: makeStorage(sessionStore)
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  const labDir = path.resolve(__dirname, "..");
  const files = [
    "stimuli.js",
    "analytics.js",
    "falsify-core.js",
    "deep-core.js",
    "repo-sync.js"
  ];
  for (const file of files) {
    const code = fs.readFileSync(path.join(labDir, file), "utf8");
    vm.runInContext(code, ctx, { filename: file });
  }
  return sandbox;
}

const VALID_PAT = "pat_zme_mock_0123456789_testValidTokenValue99";

test("1. Canonical zme LabLongitudinalLog.md & psychoIndex.md pass strict Obsidian vault validation", () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;

  const zmeLogPath = "/Users/macm1pro/Desktop/zme/ALL/health/psycho/LabLongitudinalLog.md";
  const zmeIndexPath = "/Users/macm1pro/Desktop/zme/ALL/health/psycho/psychoIndex.md";

  if (fs.existsSync(zmeLogPath)) {
    const content = fs.readFileSync(zmeLogPath, "utf8");
    const check = RS.validateObsidianMarkdown(content);
    assert.equal(check.ok, true, "Vault errors: " + check.errors.join("; "));
  }
  if (fs.existsSync(zmeIndexPath)) {
    const idxContent = fs.readFileSync(zmeIndexPath, "utf8");
    assert.match(idxContent, /\[\[LabLongitudinalLog\]\]/);
  }
});

test("2. UTF-8 <-> Base64 codec handles Arabic, math symbols, and >40KB payloads without stack overflow", () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;

  const sample = "نتيجة اليقظة 3.69 s⁻¹ · τ=27 ms · Δ=+13% · زاوية 14.5° — يوم 2026-11-24\n";
  const large = sample.repeat(900); // > 65 KB
  assert.ok(Buffer.byteLength(large, "utf8") > 65536);

  const encoded = RS.utf8ToBase64(large);
  const decoded = RS.base64ToUtf8(encoded);
  assert.equal(decoded, large);
  assert.equal(RS.base64ToUtf8(""), "");
});

test("3. Sanitizer neutralizes angle brackets, pipes, backticks, bullets, Hindi numerals, and BiDi marks", () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;

  const hostile = "\u200F- ملاحظة <script>alert(1)</script> عتبة <350 ms أو > 1450 ms | جدول `كود` رقم ٢٠٢٦/١١/٢٤ *نجمة*";
  const clean = RS.sanitizeVaultText(hostile, true);

  assert.equal(/[<>|`]/.test(clean), false, "Forbidden chars remained: " + clean);
  assert.equal(/[\u0660-\u0669\u06F0-\u06F9]/.test(clean), false, "Hindi digits remained: " + clean);
  assert.match(clean, /أقل من 350 ms/);
  assert.match(clean, /فوق 1450 ms/);
  assert.match(clean, /2026\/11\/24/);
});

test("4. Config & token validation handles Bearer prefix, non-ASCII paste, traversal, and missing .md", () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;

  assert.equal(RS.cleanToken("  Bearer   " + VALID_PAT + "\u200F\n"), VALID_PAT);
  assert.equal(RS.cleanToken("token pat_mock_abcdefghij1234567890"), "pat_mock_abcdefghij1234567890");

  assert.equal(RS.validateConfig({ token: "" }, true).needsToken, true);
  assert.equal(RS.validateConfig({ token: "رمز_عربي_بالخطأ_في_الحافظة_12345" }, true).isAuthError, true);
  assert.equal(RS.validateConfig({ token: VALID_PAT, filePath: "ALL/../escape.md" }, true).ok, false);
  assert.equal(RS.validateConfig({ token: VALID_PAT, filePath: "ALL/health/psycho/" }, true).ok, false);
  assert.equal(RS.validateConfig({ token: VALID_PAT, filePath: "ALL/health/psycho/data.json" }, true).ok, false);
  assert.equal(RS.validateConfig({ token: VALID_PAT, owner: "bad/owner" }, true).ok, false);
  assert.equal(RS.validateConfig({ token: VALID_PAT }, true).ok, true);
});

test("5. Familiarization runs are strictly excluded and empty local state refuses empty commits", async () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;
  const DC = env.NeuroLab.DeepCore;

  RS.saveConfig({ token: VALID_PAT });
  let networkCalls = 0;
  RS.setTransportForTest(async () => {
    networkCalls += 1;
    return { status: 200, body: "{}" };
  });

  // Familiarization run must NOT count as a scored result
  DC.saveExperimentResult("d1_tbrs", {
    isFamiliarization: true,
    pTargetHighPct: 80
  });

  assert.equal(RS.collectAllLocalEntries().length, 0);
  const emptyRes = await RS.pushToRepo();
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.status, "empty_local");
  assert.equal(networkCalls, 0);
});

test("6. Multi-day longitudinal saving (404 create -> Day 1 -> Day 2 -> Day 3), cross-day deltas, and strict Obsidian lint", async () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;
  const DC = env.NeuroLab.DeepCore;
  const A = env.NeuroLab.Analytics;
  const FC = env.NeuroLab.FalsifyCore;

  RS.saveConfig({ token: VALID_PAT, dayCondition: "normal" });

  // Simulated GitHub remote state
  let remoteDoc = null;
  let remoteSha = null;
  let putCalls = [];

  RS.setTransportForTest(async (req) => {
    if (req.method === "GET") {
      if (remoteDoc === null) {
        return { status: 404, body: JSON.stringify({ message: "Not Found" }) };
      }
      return {
        status: 200,
        body: JSON.stringify({
          type: "file",
          sha: remoteSha,
          size: Buffer.byteLength(remoteDoc, "utf8"),
          content: RS.utf8ToBase64(remoteDoc)
        })
      };
    }
    if (req.method === "PUT") {
      const payload = JSON.parse(req.body);
      putCalls.push(payload);
      if (remoteSha === null) {
        assert.equal("sha" in payload, false, "Initial 404 creation must omit sha");
      } else {
        assert.equal(payload.sha, remoteSha, "Subsequent update must pass existing sha");
      }
      remoteDoc = RS.base64ToUtf8(payload.content);
      remoteSha = "sha_commit_" + putCalls.length;
      return {
        status: putCalls.length === 1 ? 201 : 200,
        body: JSON.stringify({
          content: { sha: remoteSha },
          commit: { sha: "commit_full_sha_000" + putCalls.length }
        })
      };
    }
    throw new Error("Unexpected HTTP method");
  });

  // --- DAY 1: 2026-11-24 ---
  DC.saveExperimentResult("d2_refback_m3", {
    timestamp: "2026-11-24T08:15:00.000Z",
    formId: "A",
    phase: "baseline",
    dayCondition: "normal",
    calibratedScorePct: 50,
    pTargetPct: 50,
    lag0AccPct: 50,
    lag1PlusAccPct: 50,
    pSwapCorrPct: 25,
    pStaleCorrPct: 25,
    pGuessPct: 0,
    redAccPct: 88,
    redMeanRtMs: 1792,
    blueAccPct: 81,
    blueMeanRtMs: 1533,
    notes: "قياس خط الأساس الصباحي <تجربة>"
  });

  DC.saveExperimentResult("d4_consolidation_soa", {
    timestamp: "2026-11-24T08:25:00.000Z",
    formId: "A",
    phase: "baseline",
    dayCondition: "normal",
    calibratedScorePct: 35,
    soa75Ms: 1450,
    soa75ExceededCeiling: true,
    aucConsPct: 35,
    aucRawPct: 42,
    acc350Pct: 33,
    acc650Pct: 44,
    acc1050Pct: 44,
    acc1450Pct: 67,
    fastSwapCorrPct: 22,
    slowSwapCorrPct: 11,
    interruptAccPct: 92,
    interruptMeanRtMs: 880
  });

  DC.saveExperimentResult("d5_pvt5", {
    timestamp: "2026-11-24T08:35:00.000Z",
    formId: "A",
    phase: "baseline",
    dayCondition: "normal",
    calibratedScorePct: 81,
    meanReciprocalSpeed: 3.69,
    medianRtMs: 268,
    fastest10RtMs: 233,
    slowest10RtMs: 345,
    lapses500Pct: 0,
    lapses355Pct: 1.7,
    falseStarts: 2,
    muMs: 247,
    sigmaMs: 14,
    tauMs: 27,
    slowIsiTauMs: 13,
    fastIsiTauMs: 32,
    earlySlowIsiTauMs: 9,
    betaToTRecipPerMin: -0.01
  });

  const resDay1 = await RS.pushToRepo({ nowEpochMs: Date.parse("2026-11-24T08:40:00Z") });
  assert.equal(resDay1.ok, true);
  assert.equal(resDay1.status, "pushed");
  assert.equal(resDay1.addedCount, 3);
  assert.equal(resDay1.totalDays, 1);
  assert.equal(putCalls.length, 1);
  assert.equal(RS.getSyncStats().unsyncedCount, 0);

  // Double-clicking Save immediately after must be 100% idempotent (0 PUT calls!)
  const resDup = await RS.pushToRepo({ nowEpochMs: Date.parse("2026-11-24T08:41:00Z") });
  assert.equal(resDup.ok, true);
  assert.equal(resDup.status, "up_to_date");
  assert.equal(resDup.addedCount, 0);
  assert.equal(putCalls.length, 1);

  // Even if local syncedFingerprints cache is wiped, remote runKey detection keeps it idempotent!
  RS.saveConfig({ syncedFingerprints: {} });
  const resRemoteDedup = await RS.pushToRepo({ nowEpochMs: Date.parse("2026-11-24T08:42:00Z") });
  assert.equal(resRemoteDedup.ok, true);
  assert.equal(resRemoteDedup.status, "up_to_date");
  assert.equal(putCalls.length, 1);

  // --- DAY 2: 2026-11-25 (Improvement across days + V2 & Falsify probes) ---
  RS.saveConfig({ dayCondition: "rested" });
  DC.saveExperimentResult("d2_refback_m3", {
    timestamp: "2026-11-25T09:10:00.000Z",
    formId: "B",
    phase: "metabolic",
    dayCondition: "rested",
    calibratedScorePct: 63,
    pTargetPct: 63,
    lag0AccPct: 75,
    lag1PlusAccPct: 50,
    pSwapCorrPct: 25,
    pStaleCorrPct: 12,
    pGuessPct: 0,
    redAccPct: 94,
    redMeanRtMs: 1520,
    blueAccPct: 88,
    blueMeanRtMs: 1410
  });
  DC.saveExperimentResult("d5_pvt5", {
    timestamp: "2026-11-25T09:20:00.000Z",
    formId: "B",
    phase: "metabolic",
    dayCondition: "rested",
    calibratedScorePct: 86,
    meanReciprocalSpeed: 3.85,
    medianRtMs: 258,
    fastest10RtMs: 224,
    slowest10RtMs: 320,
    lapses500Pct: 0,
    lapses355Pct: 0,
    falseStarts: 1,
    muMs: 240,
    sigmaMs: 13,
    tauMs: 19,
    slowIsiTauMs: 11,
    fastIsiTauMs: 22,
    earlySlowIsiTauMs: 8,
    betaToTRecipPerMin: 0.02
  });
  A.recordProbeResult({
    id: "rec_updating_day2",
    timestamp: Date.parse("2026-11-25T09:30:00.000Z"),
    probeId: "updating",
    score: 58,
    rtMeanMs: 1420,
    phase: "metabolic",
    sleepQuality: 8,
    alertness: 9,
    nasalPatency: 7,
    notes: "تحسن ملحوظ في الرف الجانبي"
  });
  FC.saveExperimentResult("f1_crossmodal", {
    timestamp: "2026-11-25T09:40:00.000Z",
    phase: "metabolic",
    svPct: 88,
    vvPct: 50,
    ssPct: 94,
    vsPct: 88
  });

  const resDay2 = await RS.pushToRepo({ nowEpochMs: Date.parse("2026-11-25T09:45:00Z") });
  assert.equal(resDay2.ok, true);
  assert.equal(resDay2.addedCount, 4);
  assert.equal(resDay2.totalDays, 2);
  assert.equal(resDay2.totalRuns, 7);
  assert.equal(putCalls.length, 2);

  // --- DAY 3: 2026-11-27 from a SECOND fresh device (empty localStorage!) + user manual section ---
  remoteDoc += "\n## ملاحظات المراجعة السريرية\n1. ملاحظة يدوية أضافها محمد في أوبسيديان للمراجعة مع الطبيب.\n";

  const envDevice2 = createLabSandbox();
  const RS2 = envDevice2.NeuroLab.RepoSync;
  const DC2 = envDevice2.NeuroLab.DeepCore;
  RS2.saveConfig({ token: VALID_PAT, dayCondition: "post_exercise" });
  RS2.setTransportForTest(async (req) => {
    if (req.method === "GET") {
      return {
        status: 200,
        body: JSON.stringify({
          type: "file",
          sha: remoteSha,
          size: Buffer.byteLength(remoteDoc, "utf8"),
          content: RS2.utf8ToBase64(remoteDoc)
        })
      };
    }
    if (req.method === "PUT") {
      const payload = JSON.parse(req.body);
      putCalls.push(payload);
      remoteDoc = RS2.base64ToUtf8(payload.content);
      remoteSha = "sha_commit_" + putCalls.length;
      return {
        status: 200,
        body: JSON.stringify({ commit: { sha: "commit_day3_sha" } })
      };
    }
    throw new Error("Unexpected");
  });

  DC2.saveExperimentResult("d3_bays_analog", {
    timestamp: "2026-11-27T10:05:00.000Z",
    formId: "C",
    phase: "metabolic",
    dayCondition: "post_exercise",
    calibratedScorePct: 79,
    K: 3.18,
    alphaPct: 80,
    betaPct: 12,
    gammaPct: 8,
    sigmaDeg: 13.4,
    betaShortPct: 10,
    deltaGammaDelayPct: 2,
    cMAE: 14.1
  });

  const resDay3 = await RS2.pushToRepo({
    includeDailyCheckin: true,
    nowEpochMs: Date.parse("2026-11-27T10:10:00Z")
  });
  assert.equal(resDay3.ok, true);
  assert.equal(resDay3.addedCount, 2); // D3 + Daily Check-in
  assert.equal(resDay3.totalDays, 3);
  assert.equal(resDay3.totalRuns, 9);

  // Strict Obsidian Vault validation on the full 3-day merged Markdown!
  const lint = RS2.validateObsidianMarkdown(remoteDoc);
  assert.equal(lint.ok, true, "Obsidian lint failed: " + lint.errors.join("; "));

  // Verify day headings, cross-day trajectory deltas, sanitized <350 ms, and preserved manual section
  assert.match(remoteDoc, /## سجل يوم \*\*2026-11-27\*\*/);
  assert.match(remoteDoc, /## سجل يوم \*\*2026-11-25\*\*/);
  assert.match(remoteDoc, /## سجل يوم \*\*2026-11-24\*\*/);
  assert.match(remoteDoc, /مقارنة التغير عبر الأيام للمسابير المتكررة/);
  assert.match(remoteDoc, /مسبار \*\*D2 · M3-RB\*\*: انتقل من \*\*50%\*\* في \*\*2026-11-24\*\* إلى \*\*63%\*\* في \*\*2026-11-25\*\* بفارق \*\*\+13%\*\*/);
  assert.match(remoteDoc, /فوق 1450 ms/);
  assert.match(remoteDoc, /## ملاحظات المراجعة السريرية/);
  assert.match(remoteDoc, /ملاحظة يدوية أضافها محمد في أوبسيديان/);

  // --- DAY 4: Cross-Device Restore (pullFromRepo onto a brand-new 3rd device!) ---
  const envDevice3 = createLabSandbox();
  const RS3 = envDevice3.NeuroLab.RepoSync;
  RS3.saveConfig({ token: VALID_PAT });
  RS3.setTransportForTest(async () => ({
    status: 200,
    body: JSON.stringify({
      type: "file",
      sha: remoteSha,
      size: Buffer.byteLength(remoteDoc, "utf8"),
      content: RS3.utf8ToBase64(remoteDoc)
    })
  }));

  const pullRes1 = await RS3.pullFromRepo();
  assert.equal(pullRes1.ok, true);
  assert.equal(pullRes1.totalDays, 3);
  assert.equal(pullRes1.importedTotal, 9); // 6 Deep + 1 V2 + 1 Falsify + 1 Daily Check-in

  const restoredDeep = envDevice3.NeuroLab.DeepCore.loadState();
  assert.equal(restoredDeep.results.d2_refback_m3.pTargetPct, 63); // Latest Day 2 score!
  assert.equal(restoredDeep.baselineResults.d2_refback_m3.pTargetPct, 50); // Anchor T0 Day 1 score!
  assert.equal(restoredDeep.results.d3_bays_analog.K, 3.18);
  assert.equal(restoredDeep.results.d3_bays_analog.dayCondition, "post_exercise");
  assert.equal(restoredDeep.history.length, 6);

  // Verify zero "undefined"/"NaN" in DeepCore verdicts and active RCI 90% followup after pullFromRepo!
  const restoredVerdict = envDevice3.NeuroLab.DeepCore.computeDeepVerdictSummary();
  assert.equal(/undefined|NaN/.test(restoredVerdict.plainTextReport), false, "Verdict had undefined/NaN: " + restoredVerdict.plainTextReport);
  const d5MeanRci = restoredVerdict.rciItems.find((x) => x.key === "d5_mean_recip");
  assert.equal(Boolean(d5MeanRci && d5MeanRci.hasFollowup), true, "RCI 90% followup did not activate after multi-day pull!");

  // Pulling a second time must import 0 duplicates!
  const pullRes2 = await RS3.pullFromRepo();
  assert.equal(pullRes2.ok, true);
  assert.equal(pullRes2.importedTotal, 0);
  assert.equal(envDevice3.NeuroLab.DeepCore.loadState().history.length, 6);
});

test("7. Automatic 409 SHA conflict retry, >1MB git blob fallback, read-only PAT warning, and double-click mutex", async () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;
  const DC = env.NeuroLab.DeepCore;
  RS.saveConfig({ token: VALID_PAT });

  // 7a. Read-only token warning in testConnection
  RS.setTransportForTest(async () => ({
    status: 200,
    body: JSON.stringify({ permissions: { push: false } })
  }));
  const roConn = await RS.testConnection();
  assert.equal(roConn.ok, false);
  assert.equal(roConn.status, "warning");

  // 7b. >1MB empty content fallback to /git/blobs/:sha + two 409 conflicts before 200 success + concurrent mutex
  DC.saveExperimentResult("d1_tbrs", {
    timestamp: "2026-11-28T07:00:00.000Z",
    pTargetHighPct: 75,
    pTargetLowPct: 88,
    deltaTbrs: 0.5,
    calibratedScorePct: 75
  });

  const existingMd =
    "# السجل الطولي للبطارية النفس-فيزيائية (**LabLongitudinalLog**)\n\n" +
    "## سجل يوم **2026-11-20**\n" +
    "1. قياس سابق محفوظ مسبقاً:\n" +
    "\t1. السياق اليومي: المرحلة **خط الأساس القاعدي**.\n";

  let putAttempts = 0;
  RS.setTransportForTest(async (req) => {
    if (req.method === "GET" && req.url.includes("/git/blobs/")) {
      return {
        status: 200,
        body: JSON.stringify({ content: RS.utf8ToBase64(existingMd) })
      };
    }
    if (req.method === "GET") {
      return {
        status: 200,
        body: JSON.stringify({
          type: "file",
          sha: "sha_v" + putAttempts,
          size: 1250000,
          content: "" // Simulate >1MB Contents API response
        })
      };
    }
    if (req.method === "PUT") {
      putAttempts += 1;
      if (putAttempts <= 2) {
        return { status: 409, body: JSON.stringify({ message: "Conflict" }) };
      }
      return {
        status: 200,
        body: JSON.stringify({ commit: { sha: "resolved_after_409_sha" } })
      };
    }
    throw new Error("Unexpected");
  });

  // Fire two concurrent pushToRepo() calls (simulating rapid mobile double-tap)
  const [r1, r2] = await Promise.all([RS.pushToRepo(), RS.pushToRepo()]);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.commitSha, "resolved_after_409_sha");
  assert.equal(putAttempts, 3); // 2 conflicts + 1 success (NOT 6 from duplicate parallel loops!)
});

test("8. Chronological merge safety: pulling older remote runs onto a device with a newer local run preserves Latest and T0", async () => {
  const devOld = createLabSandbox();
  devOld.NeuroLab.RepoSync.saveConfig({ token: VALID_PAT });
  devOld.NeuroLab.DeepCore.saveExperimentResult("d1_tbrs", {
    timestamp: "2026-11-23T08:00:00.000Z",
    localDateYmd: "2026-11-23",
    localTimeHm: "09:00",
    formId: "A",
    phase: "baseline",
    dayCondition: "normal",
    calibratedScorePct: 70,
    pTargetHighPct: 70,
    pTargetLowPct: 85,
    deltaTbrs: 0.55
  });
  devOld.NeuroLab.DeepCore.saveExperimentResult("d1_tbrs", {
    timestamp: "2026-11-25T08:00:00.000Z",
    localDateYmd: "2026-11-25",
    localTimeHm: "09:00",
    formId: "B",
    phase: "metabolic",
    dayCondition: "rested",
    calibratedScorePct: 80,
    pTargetHighPct: 80,
    pTargetLowPct: 90,
    deltaTbrs: 0.4
  });
  devOld.NeuroLab.Analytics.finalizeBatteryRun(
    "bat_full_nov25",
    { isolation: 50, updating: 45, gating: 100, binding: 83, vigilance: 88, control: 96 },
    { timestamp: Date.parse("2026-11-25T08:30:00Z"), phase: "metabolic", dayCondition: "rested", notes: "بطارية كاملة" }
  );

  let remoteMd = "";
  devOld.NeuroLab.RepoSync.setTransportForTest(async (req) => {
    if (req.method === "GET") return { status: 404, body: "{}" };
    remoteMd = devOld.NeuroLab.RepoSync.base64ToUtf8(JSON.parse(req.body).content);
    return { status: 201, body: JSON.stringify({ commit: { sha: "sha_old" } }) };
  });
  await devOld.NeuroLab.RepoSync.pushToRepo();

  // New device records a NEWER run on 2026-11-29 BEFORE pulling remote history!
  const devNew = createLabSandbox();
  devNew.NeuroLab.RepoSync.saveConfig({ token: VALID_PAT });
  devNew.NeuroLab.DeepCore.saveExperimentResult("d1_tbrs", {
    timestamp: "2026-11-29T08:00:00.000Z",
    localDateYmd: "2026-11-29",
    localTimeHm: "09:00",
    formId: "C",
    phase: "med_stable",
    dayCondition: "treatment_followup",
    calibratedScorePct: 92,
    pTargetHighPct: 92,
    pTargetLowPct: 96,
    deltaTbrs: 0.16
  });

  devNew.NeuroLab.RepoSync.setTransportForTest(async () => ({
    status: 200,
    body: JSON.stringify({ type: "file", sha: "s1", size: remoteMd.length, content: devNew.NeuroLab.RepoSync.utf8ToBase64(remoteMd) })
  }));
  await devNew.NeuroLab.RepoSync.pullFromRepo();

  const st = devNew.NeuroLab.DeepCore.loadState();
  assert.equal(st.results.d1_tbrs.pTargetHighPct, 92, "Latest 2026-11-29 run must NOT be overwritten by older remote run!");
  assert.equal(st.baselineResults.d1_tbrs.pTargetHighPct, 70, "T0 baseline must adopt earliest 2026-11-23 run!");
  assert.equal(st.history.length, 3);
  assert.equal(devNew.NeuroLab.Analytics.loadState().batteryRuns.length, 1, "Full V2 batteryRun must be restored on pullFromRepo!");
  assert.equal(devNew.NeuroLab.Analytics.loadState().batteryRuns[0].dayCondition, "rested");
});

test("9. Multi-day Analytics V2 probes preserve per-day dayCondition and midnight timezone localDateYmd", async () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;
  const A = env.NeuroLab.Analytics;
  RS.saveConfig({ token: VALID_PAT, dayCondition: "sleep_inertia" });

  // Day 1 V2 probe recorded under sleep_inertia around midnight boundary (23:30 UTC -> 2026-11-25 00:30 UTC+1)
  A.recordProbeResult({
    id: "rec_p2_midnight",
    timestamp: Date.parse("2026-11-24T23:30:00.000Z"),
    localDateYmd: "2026-11-25",
    localTimeHm: "00:30",
    probeId: "updating",
    score: 35,
    phase: "sleep_inertia",
    dayCondition: "sleep_inertia"
  });

  // Next day user changes global dayCondition to post_exercise and records P5
  RS.saveConfig({ dayCondition: "post_exercise" });
  A.recordProbeResult({
    id: "rec_p5_nextday",
    timestamp: Date.parse("2026-11-26T16:00:00.000Z"),
    localDateYmd: "2026-11-26",
    localTimeHm: "17:00",
    probeId: "vigilance",
    score: 88,
    phase: "metabolic",
    dayCondition: "post_exercise"
  });

  const entries = RS.collectAllLocalEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].dayYmd, "2026-11-25");
  assert.equal(entries[0].timeHm, "00:30");
  assert.equal(entries[0].conditionId, "sleep_inertia");
  assert.equal(entries[1].dayYmd, "2026-11-26");
  assert.equal(entries[1].conditionId, "post_exercise");

  const merged = RS.mergeEntriesIntoMarkdown("", entries, Date.parse("2026-11-26T17:05:00Z"));
  assert.equal(merged.validation.ok, true);
  assert.match(merged.updatedDocument, /## سجل يوم \*\*2026-11-25\*\*[\s\S]*الساعة \*\*00:30\*\*[\s\S]*الحالة اليومية \*\*جمود استيقاظ صباحي\*\*/);
  assert.match(merged.updatedDocument, /## سجل يوم \*\*2026-11-26\*\*[\s\S]*الساعة \*\*17:00\*\*[\s\S]*الحالة اليومية \*\*بعد مشي أو رياضة\*\*/);
});

test("10. Hand-edited Obsidian Markdown: nested space-indented grandchildren, manual day notes, and ### subheadings", () => {
  const env = createLabSandbox();
  const RS = env.NeuroLab.RepoSync;

  const handEdited =
    "# السجل الطولي للبطارية النفس-فيزيائية (**LabLongitudinalLog**)\n\n" +
    "## منهجية التدوين والمزامنة عبر الأيام\n" +
    "1. يوثق هذا السجل نتائج الفحوص.\n\n" +
    "## سجل يوم **2026-11-24**\n" +
    "1. ملاحظة صباحية يدوية أضافها محمد في أوبسيديان:\n" +
    "    1. شعور بنعاس صباحي خفيف:\n" +
    "        1. استمر عشرين دقيقة بعد الاستيقاظ.\n" +
    "        2. تحسن تدريجياً بعد شرب الماء.\n\n" +
    "## ملاحظات المراجعة السريرية\n" +
    "### أسئلة فحص النوم\n" +
    "1. هل يلزم تخطيط نوم ليلي كامل؟\n\n" +
    "### ملاحظات المكملات\n" +
    "1. متابعة الاستجابة بعد أسبوعين.\n";

  const incoming = [{
    runKey: "v3-d5-morn",
    suiteKind: "deep_v3",
    suiteLabelAr: "النسخة العميقة",
    probeKey: "d5_pvt5",
    probeCode: "D5 · PVT-5",
    probeTitleAr: "اليقظة المستدامة خمس دقائق",
    epochMs: Date.parse("2026-11-24T06:30:00Z"),
    timestampIso: "2026-11-24T06:30:00.000Z",
    dayYmd: "2026-11-24",
    timeHm: "07:30",
    phaseId: "sleep_inertia",
    phaseLabel: "جمود الاستيقاظ الصباحي",
    conditionId: "sleep_inertia",
    conditionLabel: "جمود استيقاظ صباحي",
    formId: "A",
    headlineVal: "3.15 s⁻¹",
    numericMetric: 3.15,
    metricUnit: " s⁻¹",
    metricPrefix: "",
    higherIsBetter: true,
    contextLine: "السياق اليومي: المرحلة **جمود الاستيقاظ الصباحي** بمعرف **sleep_inertia**، الحالة اليومية **جمود استيقاظ صباحي**.",
    mainMetricsLine: "المؤشرات الرئيسية: السرعة التبادلية **3.15 s⁻¹**.",
    subMetricsLine: "",
    noteText: ""
  }];

  const merged = RS.mergeEntriesIntoMarkdown(handEdited, incoming, Date.parse("2026-11-24T06:35:00Z"));
  assert.equal(merged.validation.ok, true, "Validation errors: " + merged.validation.errors.join("; "));
  assert.equal(merged.totalRuns, 1, "Manual day note must not inflate scored measurement count!");
  assert.match(merged.updatedDocument, /ضمن مرحلة \*\*جمود الاستيقاظ الصباحي\*\* وحالة \*\*جمود استيقاظ صباحي\*\*/);
  assert.match(merged.updatedDocument, /\t1\. شعور بنعاس صباحي خفيف:\n\t\t1\. استمر عشرين دقيقة بعد الاستيقاظ\.\n\t\t2\. تحسن تدريجياً بعد شرب الماء\./);
  assert.match(merged.updatedDocument, /### أسئلة فحص النوم\n1\. هل يلزم/);
  assert.match(merged.updatedDocument, /### ملاحظات المكملات\n1\. متابعة/);

  // Direct validator negative checks: catch bad child numbering & English-start RTL violations
  const badDepth = "# عنوان عربي\n\n## قسم تجريبي\n1. عنصر أول:\n\t1. فرع أول.\n\t1. فرع مكرر بالخطأ.\n";
  assert.equal(RS.validateObsidianMarkdown(badDepth).ok, false);
  const badRtl = "# عنوان عربي\n\n## قسم تجريبي\n1. English start breaks RTL.\n";
  assert.equal(RS.validateObsidianMarkdown(badRtl).ok, false);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const RepoSyncNode = require("../repo-sync.js");

const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function startStaticLabServer(labRoot) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const safeFile = path.resolve(labRoot, "." + rel);
      if (!safeFile.startsWith(labRoot) || !fs.existsSync(safeFile) || fs.statSync(safeFile).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(safeFile).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(fs.readFileSync(safeFile));
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function startMockGitHubCorsServer() {
  // Mirrors GitHub's exact Access-Control-Allow-Headers proved via live curl preflight!
  const EXACT_GITHUB_ALLOWED_HEADERS =
    "Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, Accept-Encoding, X-GitHub-OTP, X-Requested-With, User-Agent, X-GitHub-Api-Version, Idempotency-Key";
  const allowedLower = new Set(
    EXACT_GITHUB_ALLOWED_HEADERS.split(",").map((s) => s.trim().toLowerCase()).concat(["accept", "accept-language", "content-language"])
  );

  const state = {
    files: new Map(),
    preflightErrors: [],
    puts: []
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE");
      res.setHeader("Access-Control-Allow-Headers", EXACT_GITHUB_ALLOWED_HEADERS);

      if (req.method === "OPTIONS") {
        const reqHeaders = String(req.headers["access-control-request-headers"] || "")
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean);
        for (const h of reqHeaders) {
          if (!allowedLower.has(h)) {
            state.preflightErrors.push("Disallowed CORS header requested: " + h);
            res.writeHead(403);
            res.end("CORS Disallowed Header: " + h);
            return;
          }
        }
        res.writeHead(204);
        res.end();
        return;
      }

      const auth = String(req.headers["authorization"] || "");
      if (!auth.startsWith("Bearer pat_zme_mock_")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Bad credentials" }));
        return;
      }

      const parsedUrl = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && parsedUrl.pathname === "/repos/medmrf-10/zme") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ full_name: "medmrf-10/zme", permissions: { push: true } }));
        return;
      }

      const contentsPrefix = "/repos/medmrf-10/zme/contents/";
      if (parsedUrl.pathname.startsWith(contentsPrefix)) {
        const fileKey = decodeURIComponent(parsedUrl.pathname.slice(contentsPrefix.length));
        if (req.method === "GET") {
          const cur = state.files.get(fileKey);
          if (!cur) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Not Found" }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            type: "file",
            sha: cur.sha,
            size: Buffer.byteLength(cur.content, "utf8"),
            content: Buffer.from(cur.content, "utf8").toString("base64")
          }));
          return;
        }

        if (req.method === "PUT") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            const payload = JSON.parse(body);
            const cur = state.files.get(fileKey);
            if (cur && payload.sha !== cur.sha) {
              res.writeHead(409, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ message: "SHA conflict" }));
              return;
            }
            const decoded = Buffer.from(payload.content, "base64").toString("utf8");
            const nextSha = "blob_sha_" + (state.puts.length + 1);
            const commitSha = "deadbeef" + String(state.puts.length + 1).padStart(6, "0");
            state.files.set(fileKey, { sha: nextSha, content: decoded });
            state.puts.push({ fileKey, message: payload.message, decoded });
            res.writeHead(cur ? 200 : 201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              content: { sha: nextSha },
              commit: { sha: commitSha }
            }));
          });
          return;
        }
      }

      res.writeHead(404);
      res.end("Unknown route");
    });

    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port, state });
    });
  });
}

function launchHeadlessChrome(userDataDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      "--user-data-dir=" + userDataDir,
      "about:blank"
    ];
    const proc = spawn(CHROME_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderrBuf = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Chrome DevTools startup timeout: " + stderrBuf));
    }, 10000);

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString("utf8");
      const m = stderrBuf.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, wsUrl: m[1] });
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async evalInPage(sessionId, expression) {
    const res = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    );
    if (res.exceptionDetails) {
      throw new Error("Page exception: " + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }
}

test("Real Headless Chrome E2E: 360px mobile layout, modal over Arena, CORS preflight, and multi-day repo push", async (t) => {
  if (!fs.existsSync(CHROME_BIN)) {
    t.skip("Google Chrome binary not found");
    return;
  }

  const labRoot = path.resolve(__dirname, "..");
  const labSrv = await startStaticLabServer(labRoot);
  const ghSrv = await startMockGitHubCorsServer();
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "neurolab-e2e-"));

  let chromeObj = null;
  try {
    chromeObj = await launchHeadlessChrome(tmpProfile);
    const ws = new WebSocket(chromeObj.wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    const cdp = new CdpSession(ws);

    const { targetId } = await cdp.send("Target.createTarget", {
      url: `http://127.0.0.1:${labSrv.port}/index.html`
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    // Set 360x800 narrow mobile portrait viewport
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    }, sessionId);

    // Deterministic bootstrap polling (never race external font/network latency)
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      ready = await cdp.evalInPage(
        sessionId,
        `Boolean(window.NeuroLab && window.NeuroLab.RepoSync && window.NeuroLab.DeepCore && window.NeuroLab.Engine && document.getElementById("topRepoSaveBtn"))`
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    assert.equal(ready, true, "NeuroLab bootstrap did not initialize within timeout");

    // Verify zero runtime exceptions
    const runtimeExceptions = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
    assert.equal(runtimeExceptions.length, 0, "Uncaught exceptions on load: " + JSON.stringify(runtimeExceptions));

    // Point RepoSync to our cross-origin mock GitHub API server (different port = real browser CORS preflight!)
    await cdp.evalInPage(
      sessionId,
      `window.NeuroLab.RepoSync.setTransportForTest(null, "http://127.0.0.1:${ghSrv.port}"); true;`
    );

    // Check BOTH 360px AND ultra-narrow 320px horizontal overflow across all 5 views in light & dark mode
    for (const vw of [360, 320]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vw,
        height: 800,
        deviceScaleFactor: 2,
        mobile: true
      }, sessionId);

      const overflowReport = await cdp.evalInPage(sessionId, `
        (async function () {
          const views = ["dashboard", "falsify", "deep", "trends", "data"];
          const issues = [];
          for (const theme of ["light", "dark"]) {
            document.documentElement.setAttribute("data-theme", theme);
            for (const v of views) {
              const tab = document.querySelector('.view-tabs [data-view="' + v + '"]');
              tab.click();
              await new Promise((r) => setTimeout(r, 35));
              const docW = document.documentElement.scrollWidth;
              const winW = window.innerWidth;
              if (docW > winW + 1) {
                issues.push("${vw}px/" + theme + "/" + v + ": scrollWidth=" + docW + " > innerWidth=" + winW);
              }
            }
          }
          return issues;
        })()
      `);
      assert.deepEqual(overflowReport, [], vw + "px mobile overflow detected: " + overflowReport.join(", "));
    }

    // Restore 360x800 mobile viewport for interactive flow
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    }, sessionId);

    // Phase 1 E2E: Multi-day runs + Modal session-only PAT (rememberToken=false) + Modal condition/note propagation!
    const arenaModalFlow = await cdp.evalInPage(sessionId, `
      (async function () {
        const DC = window.NeuroLab.DeepCore;
        const RS = window.NeuroLab.RepoSync;

        // Day 1 result (normal condition)
        DC.saveExperimentResult("d1_tbrs", {
          timestamp: "2026-11-23T08:00:00.000Z",
          localDateYmd: "2026-11-23",
          localTimeHm: "09:00",
          formId: "A",
          phase: "baseline",
          dayCondition: "normal",
          calibratedScorePct: 75,
          pTargetHighPct: 75,
          pTargetLowPct: 88,
          deltaTbrs: 0.5,
          pSwapHighCorrPct: 25,
          pGuessHighPct: 0,
          clLow: 0.33,
          clHigh: 0.58,
          procAccPct: 90,
          procMeanRtMs: 615
        });

        // Day 2 result (recorded with default condition before opening modal)
        DC.saveExperimentResult("d2_refback_m3", {
          timestamp: "2026-11-24T09:00:00.000Z",
          localDateYmd: "2026-11-24",
          localTimeHm: "10:00",
          formId: "B",
          phase: "metabolic",
          dayCondition: "normal",
          calibratedScorePct: 63,
          pTargetPct: 63,
          lag0AccPct: 75,
          lag1PlusAccPct: 50,
          pSwapCorrPct: 25,
          pStaleCorrPct: 12,
          pGuessPct: 0,
          redAccPct: 94,
          redMeanRtMs: 1510,
          blueAccPct: 88,
          blueMeanRtMs: 1400
        });

        RS.refreshUi();
        const badgeBefore = document.querySelector("#topRepoSaveBtn .repo-badge")?.textContent;

        // Click topbar Save button with no token -> must open #repoSyncModal
        document.getElementById("topRepoSaveBtn").click();
        const modal = document.getElementById("repoSyncModal");
        const modalOpened = modal && !modal.hidden;

        // Uncheck rememberToken (session-only mode!), set sleep_inertia + session note, and submit
        document.getElementById("modalRepoRemember").checked = false;
        document.getElementById("modalDayCondition").value = "sleep_inertia";
        document.getElementById("modalRepoToken").value = "pat_zme_mock_0123456789_e2eBrowserTest99";
        document.getElementById("modalSessionNote").value = "اختبار متصفح حقيقي عبر الأيام";
        document.getElementById("repoSyncModalForm").requestSubmit();

        for (let i = 0; i < 50; i++) {
          if (modal.hidden) break;
          await new Promise((r) => setTimeout(r, 50));
        }

        const rawLocalCfg = JSON.parse(localStorage.getItem("neurolab_repo_sync_cfg_v1") || "{}");
        const sessionTok = sessionStorage.getItem("neurolab_repo_sync_tok_session_v1") || "";
        const statsAfter = RS.getSyncStats();
        const topBtnSynced = document.getElementById("topRepoSaveBtn").classList.contains("is-synced");

        document.querySelector('.view-tabs [data-view="trends"]').click();
        const crossDayItemsCount = document.querySelectorAll("#crossDayTrendsMount .cross-day-item").length;

        return {
          badgeBefore,
          modalOpened,
          modalClosedAfterPush: modal.hidden,
          persistedLocalToken: rawLocalCfg.token || "",
          sessionTokenPresent: sessionTok.startsWith("pat_zme_mock_"),
          unsyncedAfter: statsAfter.unsyncedCount,
          syncedAfter: statsAfter.syncedCount,
          topBtnSynced,
          crossDayItemsCount
        };
      })()
    `);

    assert.equal(arenaModalFlow.badgeBefore, "2");
    assert.equal(arenaModalFlow.modalOpened, true);
    assert.equal(arenaModalFlow.modalClosedAfterPush, true);
    assert.equal(arenaModalFlow.persistedLocalToken, "", "PAT leaked into localStorage when rememberToken=false!");
    assert.equal(arenaModalFlow.sessionTokenPresent, true, "PAT missing from sessionStorage when rememberToken=false!");
    assert.equal(arenaModalFlow.unsyncedAfter, 0);
    assert.equal(arenaModalFlow.syncedAfter, 2);
    assert.equal(arenaModalFlow.topBtnSynced, true);
    assert.equal(arenaModalFlow.crossDayItemsCount, 2);

    // Verify ZERO CORS preflight header violations in real Chrome!
    assert.deepEqual(ghSrv.state.preflightErrors, [], "CORS preflight errors: " + ghSrv.state.preflightErrors.join("; "));
    assert.equal(ghSrv.state.puts.length, 1);

    const committedMd = ghSrv.state.puts[0].decoded;
    const mdCheck = RepoSyncNode.validateObsidianMarkdown(committedMd);
    assert.equal(mdCheck.ok, true, "Committed Markdown failed Obsidian lint: " + mdCheck.errors.join("; "));
    assert.match(committedMd, /## سجل يوم \*\*2026-11-24\*\*/);
    assert.match(committedMd, /## سجل يوم \*\*2026-11-23\*\*/);
    assert.match(committedMd, /الحالة اليومية \*\*جمود استيقاظ صباحي\*\*/);
    assert.match(committedMd, /الملاحظة السياقية: اختبار متصفح حقيقي عبر الأيام\./);

    // Phase 2 E2E: Complete an ACTUAL single probe (P4 · binding) end-to-end inside #arenaOverlay,
    // verify inline Arena session-tagging bar + Enter key isolation + one-tap Save from Arena completion screen!
    const arenaCompletionResult = await cdp.evalInPage(sessionId, `
      (async function () {
        window.NeuroLab.Engine.startSingleProbe("binding");
        const arena = document.getElementById("arenaOverlay");
        // Click Start inside Arena intro
        for (let w = 0; w < 20; w++) {
          const startBtn = arena.querySelector("#btnStartProbeNow, .btn-primary");
          if (startBtn) { startBtn.click(); break; }
          await new Promise((r) => setTimeout(r, 30));
        }

        // Complete all trials of P4 binding until #btnProbeSaveRepo appears on completion screen
        for (let step = 0; step < 60; step++) {
          if (document.getElementById("btnProbeSaveRepo")) break;
          const optBtn = arena.querySelector("[data-choice], .choice-btn, .option-btn, .arena-choice-btn, #arenaStage button:not(#btnProbeSaveRepo)");
          if (optBtn) optBtn.click();
          await new Promise((r) => setTimeout(r, 60));
        }

        const onCompletionScreen = Boolean(document.getElementById("btnProbeSaveRepo"));
        const arenaCondSel = arena.querySelector(".js-arena-condition-select");
        const arenaNoteInp = arena.querySelector(".js-arena-note-input");

        // Focus note input inside Arena and press Enter -> must NOT close #arenaOverlay!
        arenaNoteInp.focus();
        arenaNoteInp.value = "ملاحظة من شاشة النتيجة مباشرة";
        arenaNoteInp.dispatchEvent(new Event("input", { bubbles: true }));
        arenaNoteInp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        const arenaStillOpenAfterEnter = !arena.hidden && Boolean(document.getElementById("btnProbeSaveRepo"));

        // Change session condition right on Arena completion screen
        arenaCondSel.value = "post_exercise";
        arenaCondSel.dispatchEvent(new Event("change", { bubbles: true }));

        // Check zero horizontal overflow inside #arenaOverlay at 360px
        const arenaOverflow = arena.scrollWidth > window.innerWidth + 1;

        // Click #btnProbeSaveRepo directly on Arena completion screen (using session token!)
        document.getElementById("btnProbeSaveRepo").click();
        for (let i = 0; i < 50; i++) {
          if (window.NeuroLab.RepoSync.getSyncStats().unsyncedCount === 0) break;
          await new Promise((r) => setTimeout(r, 50));
        }

        const saveBtnSynced = document.getElementById("btnProbeSaveRepo").classList.contains("is-synced");
        document.getElementById("btnDoneProbe").click();

        return {
          onCompletionScreen,
          arenaStillOpenAfterEnter,
          arenaOverflow,
          saveBtnSynced,
          arenaClosedOnDone: arena.hidden
        };
      })()
    `);

    assert.equal(arenaCompletionResult.onCompletionScreen, true, "Did not reach Arena probe completion screen");
    assert.equal(arenaCompletionResult.arenaStillOpenAfterEnter, true, "Enter inside Arena note input prematurely closed Arena!");
    assert.equal(arenaCompletionResult.arenaOverflow, false, "Horizontal overflow inside Arena completion screen");
    assert.equal(arenaCompletionResult.saveBtnSynced, true, "Arena Save button did not transition to is-synced");
    assert.equal(arenaCompletionResult.arenaClosedOnDone, true);
    assert.equal(ghSrv.state.puts.length, 2);
    assert.match(ghSrv.state.puts[1].decoded, /P4 · BND/);
    assert.match(ghSrv.state.puts[1].decoded, /الحالة اليومية \*\*بعد مشي أو رياضة\*\*/);
    assert.match(ghSrv.state.puts[1].decoded, /الملاحظة السياقية: ملاحظة من شاشة النتيجة مباشرة\./);

    // Phase 3 E2E: Wipe local data & token, verify Modal z-index & Enter-key guard over Deep V3 Arena, then test Pull-from-Repo!
    const phase3Result = await cdp.evalInPage(sessionId, `
      (async function () {
        const RS = window.NeuroLab.RepoSync;
        const A = window.NeuroLab.Analytics;
        const DC = window.NeuroLab.DeepCore;

        A.clearAllData();
        DC.clearState();
        RS.clearLocalCheckins();
        RS.clearToken();
        RS.saveConfig({ syncedFingerprints: {} });

        const arena = document.getElementById("arenaOverlay");
        document.querySelector('.view-tabs [data-view="deep"]').click();
        const deepSaveBtnExists = Boolean(document.getElementById("btnSyncDeepRepo"));
        document.querySelector('.view-tabs [data-view="falsify"]').click();
        const falsifySaveBtnExists = Boolean(document.getElementById("btnSyncFalsifyRepo"));

        window.NeuroLab.Deep.startExperiment("d1_tbrs");
        for (let w = 0; w < 30; w++) {
          if (document.getElementById("btnDeepStart")) break;
          await new Promise((r) => setTimeout(r, 40));
        }
        const arenaZ = Number(getComputedStyle(arena).zIndex || 0);

        RS.openSetupModal({ saveAfterConfig: false });
        const modal = document.getElementById("repoSyncModal");
        const modalZ = Number(getComputedStyle(modal).zIndex || 0);

        const tokenInput = document.getElementById("modalRepoToken");
        tokenInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        const introStillPresent = Boolean(document.getElementById("btnDeepStart"));

        RS.closeSetupModal();
        window.NeuroLab.Deep.abort();

        // Pull from Repo (#btnDataPullRepo) and verify full submetrics, dayCondition, notes, and zero "undefined" in verdict report!
        document.querySelector('.view-tabs [data-view="data"]').click();
        document.getElementById("repoTokenInput").value = "pat_zme_mock_0123456789_e2eBrowserTest99";
        document.getElementById("btnDataPullRepo").click();

        for (let i = 0; i < 40; i++) {
          if (DC.loadState().history.length >= 2) break;
          await new Promise((r) => setTimeout(r, 50));
        }

        const deepVerdict = DC.computeDeepVerdictSummary().plainTextReport;
        const d2Restored = DC.loadState().results.d2_refback_m3;
        const v2Restored = A.loadState().records;

        return {
          deepSaveBtnExists,
          falsifySaveBtnExists,
          modalAboveArena: modalZ > arenaZ,
          introStillPresent,
          restoredHistoryCount: DC.loadState().history.length,
          restoredV2Count: v2Restored.length,
          d2Condition: d2Restored && d2Restored.dayCondition,
          d2RedRtMs: d2Restored && d2Restored.redMeanRtMs,
          verdictHasUndefined: deepVerdict.includes("undefined") || deepVerdict.includes("NaN")
        };
      })()
    `);

    assert.equal(phase3Result.deepSaveBtnExists, true);
    assert.equal(phase3Result.falsifySaveBtnExists, true);
    assert.equal(phase3Result.modalAboveArena, true);
    assert.equal(phase3Result.introStillPresent, true);
    assert.equal(phase3Result.restoredHistoryCount, 2);
    assert.equal(phase3Result.restoredV2Count, 1);
    assert.equal(phase3Result.d2Condition, "sleep_inertia");
    assert.equal(phase3Result.d2RedRtMs, 1510);
    assert.equal(phase3Result.verdictHasUndefined, false, "Restored DeepCore verdict contained undefined/NaN!");

    ws.close();
  } finally {
    if (chromeObj && chromeObj.proc) {
      chromeObj.proc.kill("SIGKILL");
    }
    labSrv.server.close();
    ghSrv.server.close();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
});

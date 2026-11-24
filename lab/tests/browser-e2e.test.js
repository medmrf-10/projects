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

    // Wait for page bootstrap & scripts
    await new Promise((r) => setTimeout(r, 700));

    // Verify zero runtime exceptions
    const runtimeExceptions = cdp.events.filter((e) => e.method === "Runtime.exceptionThrown");
    assert.equal(runtimeExceptions.length, 0, "Uncaught exceptions on load: " + JSON.stringify(runtimeExceptions));

    // Point RepoSync to our cross-origin mock GitHub API server (different port = real browser CORS preflight!)
    await cdp.evalInPage(
      sessionId,
      `window.NeuroLab.RepoSync.setTransportForTest(null, "http://127.0.0.1:${ghSrv.port}"); true;`
    );

    // Check 360px horizontal overflow across all 5 views in light & dark mode
    const overflowReport = await cdp.evalInPage(sessionId, `
      (async function () {
        const views = ["dashboard", "falsify", "deep", "trends", "data"];
        const issues = [];
        for (const theme of ["light", "dark"]) {
          document.documentElement.setAttribute("data-theme", theme);
          for (const v of views) {
            const tab = document.querySelector('.view-tabs [data-view="' + v + '"]');
            tab.click();
            await new Promise((r) => setTimeout(r, 40));
            const docW = document.documentElement.scrollWidth;
            const winW = window.innerWidth;
            if (docW > winW + 1) {
              issues.push(theme + "/" + v + ": scrollWidth=" + docW + " > innerWidth=" + winW);
            }
          }
        }
        return issues;
      })()
    `);
    assert.deepEqual(overflowReport, [], "360px mobile overflow detected: " + overflowReport.join(", "));

    // Simulate recording Day 1 & Day 2 runs and opening Deep V3 completion screen inside Arena!
    const arenaModalFlow = await cdp.evalInPage(sessionId, `
      (async function () {
        const DC = window.NeuroLab.DeepCore;
        const RS = window.NeuroLab.RepoSync;

        // Day 1 result
        DC.saveExperimentResult("d1_tbrs", {
          timestamp: "2026-11-23T08:00:00.000Z",
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

        // Day 2 result
        DC.saveExperimentResult("d2_refback_m3", {
          timestamp: "2026-11-24T09:00:00.000Z",
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

        // Fill PAT token inside modal and submit form -> triggers real cross-origin browser fetch OPTIONS + GET + PUT!
        document.getElementById("modalRepoToken").value = "pat_zme_mock_0123456789_e2eBrowserTest99";
        document.getElementById("modalSessionNote").value = "اختبار متصفح حقيقي عبر الأيام";
        document.getElementById("repoSyncModalForm").requestSubmit();

        // Wait for async push completion
        for (let i = 0; i < 40; i++) {
          if (modal.hidden) break;
          await new Promise((r) => setTimeout(r, 50));
        }

        const statsAfter = RS.getSyncStats();
        const topBtnSynced = document.getElementById("topRepoSaveBtn").classList.contains("is-synced");

        // Switch to Trends tab and inspect Cross-Day card
        document.querySelector('.view-tabs [data-view="trends"]').click();
        const crossDayItemsCount = document.querySelectorAll("#crossDayTrendsMount .cross-day-item").length;

        return {
          badgeBefore,
          modalOpened,
          modalClosedAfterPush: modal.hidden,
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

    // Phase 2 E2E: Wipe local data & token, run Arena completion screen, verify Modal z-index & Enter-key guard over Arena, then test Pull-from-Repo!
    const phase2Result = await cdp.evalInPage(sessionId, `
      (async function () {
        const RS = window.NeuroLab.RepoSync;
        const A = window.NeuroLab.Analytics;
        const DC = window.NeuroLab.DeepCore;

        // Clear local records & token to simulate fresh session inside Arena
        A.clearAllData();
        DC.clearState();
        RS.clearLocalCheckins();
        RS.clearToken();
        RS.saveConfig({ syncedFingerprints: {} });

        // Launch V2 single probe intro inside #arenaOverlay, then record & render result screen
        window.NeuroLab.Engine.startSingleProbe("updating");
        const arena = document.getElementById("arenaOverlay");
        const arenaOpenOnIntro = !arena.hidden;

        // Simulate finishing a Deep V3 probe right inside Arena or triggering Engine probe completion:
        // Close intro, launch Falsify or Deep intro, and test Arena result screen via Falsify / Deep / Engine
        window.NeuroLab.Engine.abort();

        // Trigger a real V2 record + open Arena result screen via a fast synthetic probe or check Falsify/Deep toolbar buttons
        document.querySelector('.view-tabs [data-view="deep"]').click();
        const deepSaveBtnExists = Boolean(document.getElementById("btnSyncDeepRepo"));
        document.querySelector('.view-tabs [data-view="falsify"]').click();
        const falsifySaveBtnExists = Boolean(document.getElementById("btnSyncFalsifyRepo"));

        // Open Arena via Deep.startExperiment, wait for VSync calibration if needed, then inspect z-index stacking when modal opens over Arena
        window.NeuroLab.Deep.startExperiment("d1_tbrs");
        for (let w = 0; w < 30; w++) {
          if (document.getElementById("btnDeepStart")) break;
          await new Promise((r) => setTimeout(r, 40));
        }
        const arenaZ = Number(getComputedStyle(arena).zIndex || 0);

        // Open setup modal while Arena is active
        RS.openSetupModal({ saveAfterConfig: false });
        const modal = document.getElementById("repoSyncModal");
        const modalZ = Number(getComputedStyle(modal).zIndex || 0);

        // Dispatch Enter key inside modal input -> must NOT trigger #btnDeepStart in Arena underneath!
        const tokenInput = document.getElementById("modalRepoToken");
        tokenInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        const introStillPresent = Boolean(document.getElementById("btnDeepStart"));

        RS.closeSetupModal();
        window.NeuroLab.Deep.abort();

        // Configure token in Data tab and click Pull from Repo (#btnDataPullRepo) to restore Day 1 & Day 2 from GitHub!
        document.querySelector('.view-tabs [data-view="data"]').click();
        document.getElementById("repoTokenInput").value = "pat_zme_mock_0123456789_e2eBrowserTest99";
        document.getElementById("btnDataPullRepo").click();

        for (let i = 0; i < 40; i++) {
          if (DC.loadState().history.length >= 2) break;
          await new Promise((r) => setTimeout(r, 50));
        }

        return {
          arenaOpenOnIntro,
          deepSaveBtnExists,
          falsifySaveBtnExists,
          modalAboveArena: modalZ > arenaZ,
          introStillPresent,
          restoredHistoryCount: DC.loadState().history.length
        };
      })()
    `);

    assert.equal(phase2Result.arenaOpenOnIntro, true);
    assert.equal(phase2Result.deepSaveBtnExists, true);
    assert.equal(phase2Result.falsifySaveBtnExists, true);
    assert.equal(phase2Result.modalAboveArena, true);
    assert.equal(phase2Result.introStillPresent, true);
    assert.equal(phase2Result.restoredHistoryCount, 2);

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

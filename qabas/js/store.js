(function () {
  "use strict";

  const DB_NAME = "qabas_studio_v1";
  const DB_VERSION = 1;
  const DB_STORE = "workspace";
  const DB_KEY = "state";
  const LS_KEY = "qabas_studio_v1_state";
  const LOCAL_SERVER_FALLBACK = "http://127.0.0.1:8765";
  const PERSIST_DEBOUNCE_MS = 400;
  const MAX_UNDO_DEPTH = 50;
  const MAX_SNAPSHOTS = 40;

  const VALID_BLOCK_TYPES = new Set(["h2", "h3", "p", "quote", "note"]);
  const VALID_INSERTION_TYPES = new Set(["p", "h3", "note"]);

  const INDIC_DIGITS_RE = /[٠-٩۰-۹]/g;
  const BIDI_MARKS_RE = /[\u200f\u200e\u061c\ufeff]/g;
  const TASHKEEL_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

  // ==================== Fallback Safe Arabic Utilities ====================
  function fallbackToEasternDigits(str) {
    return String(str == null ? "" : str).replace(INDIC_DIGITS_RE, function (ch) {
      const code = ch.charCodeAt(0);
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
      if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
      return ch;
    });
  }

  function toEasternDigits(str) {
    const U = window.QabasUtils;
    if (U && typeof U.toEasternDigits === "function") {
      return U.toEasternDigits(String(str == null ? "" : str));
    }
    return fallbackToEasternDigits(str);
  }

  function normalizeForSearch(str) {
    const U = window.QabasUtils;
    if (U && typeof U.normalizeForSearch === "function") {
      return U.normalizeForSearch(String(str == null ? "" : str));
    }
    return fallbackToEasternDigits(String(str == null ? "" : str).normalize("NFC"))
      .toLowerCase()
      .replace(BIDI_MARKS_RE, "")
      .replace(TASHKEEL_RE, "")
      .replace(/\u0640/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanTextRules(str, opts) {
    const options = opts || {};
    const U = window.QabasUtils;
    if (U && typeof U.cleanTextRules === "function") {
      return U.cleanTextRules(String(str == null ? "" : str), options);
    }
    let out = fallbackToEasternDigits(String(str == null ? "" : str).normalize("NFC")).replace(
      BIDI_MARKS_RE,
      ""
    );
    if (options.stripTashkeel) {
      out = out.replace(TASHKEEL_RE, "");
    }
    if (options.escapeAngles !== false) {
      out = out.replace(/</g, "«").replace(/>/g, "»");
    }
    out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    return out.trim();
  }

  // Live text sanitizer that preserves trailing space while typing in inputs/textareas
  function sanitizeLiveText(str) {
    return toEasternDigits(String(str == null ? "" : str).normalize("NFC"))
      .replace(BIDI_MARKS_RE, "")
      .replace(/</g, "«")
      .replace(/>/g, "»");
  }

  // Strict sanitizer for exported Markdown / copied text:
  // NFC normalized, 0-9 digits only, zero < > angle brackets, zero Markdown tables
  function sanitizeExportText(str) {
    let out = cleanTextRules(String(str == null ? "" : str), { escapeAngles: true });
    out = toEasternDigits(out.normalize("NFC"))
      .replace(BIDI_MARKS_RE, "")
      .replace(/</g, "«")
      .replace(/>/g, "»");

    if (out.indexOf("|") !== -1) {
      const cleanedLines = [];
      const lines = out.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Strip Markdown table separator lines such as |---|---|
        if (/^\|?[\s:-]+\|[\s|:-]*$/.test(trimmed)) {
          continue;
        }
        // Convert pipe-delimited table rows into clean dash-separated prose
        if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
          const cells = trimmed
            .slice(1, -1)
            .split("|")
            .map(function (c) {
              return c.trim();
            })
            .filter(Boolean);
          if (cells.length) {
            cleanedLines.push("- " + cells.join(" — "));
          }
          continue;
        }
        cleanedLines.push(line);
      }
      out = cleanedLines.join("\n");
    }

    return out.replace(/\n{3,}/g, "\n\n").trim();
  }

  function countWords(str) {
    const U = window.QabasUtils;
    if (U && typeof U.countWords === "function") {
      return U.countWords(String(str == null ? "" : str));
    }
    const s = String(str == null ? "" : str).trim();
    return s ? s.split(/\s+/).length : 0;
  }

  function uid(prefix) {
    const p = prefix || "blk";
    const U = window.QabasUtils;
    if (U && typeof U.uid === "function") {
      return U.uid(p);
    }
    return (
      p +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 6)
    );
  }

  function defaultPrefs() {
    return {
      theme: "frozen",
      font: "plex",
      fontSize: 19,
      lineHeight: 1.92,
      width: "medium",
      wpm: 130,
      copyFormat: "plain",
      qualityFilter: "clean",
      activeTab: "topics",
      activeDocId: "T01",
      activeCustomId: null,
      splitMode: false,
      focusMode: false,
      multiSelect: false,
    };
  }

  function defaultAnnotation() {
    return {
      editedText: null,
      note: "",
      highlight: "",
      bookmarked: false,
      hidden: false,
      updatedAt: null,
    };
  }

  function deepCloneBlocks(blocks) {
    if (!Array.isArray(blocks)) return [];
    return blocks.map(function (b) {
      return {
        id: b && b.id ? String(b.id) : uid("blk"),
        type: b && VALID_BLOCK_TYPES.has(b.type) ? b.type : "p",
        text: sanitizeLiveText(b && b.text != null ? b.text : ""),
        originalText: sanitizeLiveText(
          b && b.originalText != null ? b.originalText : b && b.text != null ? b.text : ""
        ),
        sourceRef: sanitizeLiveText(b && b.sourceRef ? b.sourceRef : ""),
        sourceParaId: b && b.sourceParaId ? String(b.sourceParaId) : null,
        sourceDocId: b && b.sourceDocId ? String(b.sourceDocId) : null,
        hidden: Boolean(b && b.hidden),
      };
    });
  }

  function formatSourceRef(meta) {
    if (!meta) return "";
    if (meta.id) return String(meta.id);
    const docTitle = cleanTextRules(meta.docTitle || "", { escapeAngles: true });
    const secTitle = cleanTextRules(meta.sectionTitle || "", { escapeAngles: true });
    if (docTitle && secTitle && docTitle !== secTitle) {
      return docTitle + " — " + secTitle;
    }
    return docTitle || secTitle || "";
  }

  function formatCitationFromSourceRef(sourceRef) {
    if (!sourceRef) return "";
    const raw = String(sourceRef).trim();
    if (!raw) return "";

    const meta = paragraphsById.get(raw);
    if (meta) {
      const dTitle = sanitizeExportText(meta.docTitle || "");
      const sTitle = sanitizeExportText(meta.sectionTitle || "");
      if (dTitle && sTitle && dTitle !== sTitle) {
        return dTitle + " — " + sTitle;
      }
      return dTitle || sTitle;
    }

    const secEntry = sectionsById.get(raw);
    if (secEntry) {
      const dTitle = sanitizeExportText(secEntry.doc.title || "");
      const sTitle = sanitizeExportText(secEntry.section.title || "");
      return dTitle && sTitle && dTitle !== sTitle ? dTitle + " — " + sTitle : dTitle || sTitle;
    }

    const chEntry = chaptersById.get(raw);
    if (chEntry) {
      const dTitle = sanitizeExportText(chEntry.doc.title || "");
      const cTitle = sanitizeExportText(chEntry.chapter.title || "");
      return dTitle && cTitle && dTitle !== cTitle ? dTitle + " — " + cTitle : dTitle || cTitle;
    }

    const doc = docsById.get(raw);
    if (doc) {
      return sanitizeExportText(doc.title || raw);
    }

    return sanitizeExportText(raw);
  }

  // ==================== Internal Store State & Indexes ====================
  const listeners = Object.create(null);

  const docsById = new Map();
  const paragraphsById = new Map();
  const chaptersById = new Map();
  const sectionsById = new Map();
  const docParagraphIds = new Map();
  const editedNormCache = new Map();
  let searchIndex = [];

  const selectionSet = new Set();

  let idbPromise = null;
  let serverAvailable = false;
  let apiBaseUrl = "";
  let persistTimer = null;
  let dirtyPersist = false;
  let stateUpdatedAt = 0;
  let initPromise = null;

  const state = {
    prefs: defaultPrefs(),
    readDocs: {},
    annotations: {},
    docInsertions: {},
    customLessons: [],
    selection: [],
  };

  const undoStacks = Object.create(null);
  const redoStacks = Object.create(null);

  // ==================== Event Emitter ====================
  function on(event, fn) {
    if (!event || typeof fn !== "function") return function () {};
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return function () {
      off(event, fn);
    };
  }

  function off(event, fn) {
    const arr = listeners[event];
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
  }

  function emit(event, payload) {
    const arr = listeners[event];
    if (!arr || !arr.length) return;
    const copy = arr.slice();
    for (let i = 0; i < copy.length; i++) {
      try {
        copy[i](payload);
      } catch (err) {
        console.error("[QabasStore] Event listener error (" + event + "):", err);
      }
    }
  }

  // ==================== Corpus Indexing (<15ms Search) ====================
  function buildCorpusIndexes() {
    const topics = Array.isArray(window.QABAS_TOPICS) ? window.QABAS_TOPICS : [];
    const lessons = Array.isArray(window.QABAS_LESSONS) ? window.QABAS_LESSONS : [];

    Store.topics = topics;
    Store.lessons = lessons;

    docsById.clear();
    paragraphsById.clear();
    chaptersById.clear();
    sectionsById.clear();
    docParagraphIds.clear();
    searchIndex = [];

    // 1. Index 12 Topic Books
    for (let t = 0; t < topics.length; t++) {
      const book = topics[t];
      if (!book || !book.id) continue;
      docsById.set(book.id, book);
      const pIds = [];
      const chapters = Array.isArray(book.chapters) ? book.chapters : [];

      for (let c = 0; c < chapters.length; c++) {
        const ch = chapters[c];
        if (!ch) continue;
        chaptersById.set(ch.id, { doc: book, chapter: ch });
        const subtopics = Array.isArray(ch.subtopics) ? ch.subtopics : [];

        for (let s = 0; s < subtopics.length; s++) {
          const sub = subtopics[s];
          if (!sub) continue;
          sectionsById.set(sub.id, {
            doc: book,
            chapter: ch,
            section: sub,
            kind: "topic",
          });

          const normHeading = normalizeForSearch(
            (book.title || "") + " " + (ch.title || "") + " " + (sub.title || "")
          );
          const paras = Array.isArray(sub.paragraphs) ? sub.paragraphs : [];

          for (let p = 0; p < paras.length; p++) {
            const para = paras[p];
            if (!para || !para.id) continue;
            pIds.push(para.id);

            const meta = {
              id: para.id,
              docId: book.id,
              docKind: "topic",
              docTitle: book.title || "",
              chapterId: ch.id || null,
              chapterTitle: ch.title || "",
              sectionId: sub.id || null,
              sectionTitle: sub.title || "",
              text: para.text || "",
              words: typeof para.words === "number" ? para.words : countWords(para.text || ""),
              qScore: typeof para.qScore === "number" ? para.qScore : 100,
              qTier: para.qTier || "high",
            };
            paragraphsById.set(para.id, meta);

            searchIndex.push({
              order: searchIndex.length,
              paraId: para.id,
              docId: book.id,
              docKind: "topic",
              docTitle: meta.docTitle,
              chapterId: meta.chapterId,
              chapterTitle: meta.chapterTitle,
              sectionId: meta.sectionId,
              sectionTitle: meta.sectionTitle,
              words: meta.words,
              qTier: meta.qTier,
              docQTier: book.qTier || "high",
              normHeading: normHeading,
              normOrigText: normalizeForSearch(meta.text),
            });
          }
        }
      }
      docParagraphIds.set(book.id, pIds);
    }

    // 2. Index 67 Standalone Lessons
    for (let l = 0; l < lessons.length; l++) {
      const lesson = lessons[l];
      if (!lesson || !lesson.id) continue;
      docsById.set(lesson.id, lesson);
      const pIds = [];
      const sections = Array.isArray(lesson.sections) ? lesson.sections : [];

      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        if (!sec) continue;
        sectionsById.set(sec.id, {
          doc: lesson,
          chapter: null,
          section: sec,
          kind: "lesson",
        });

        const normHeading = normalizeForSearch(
          (lesson.title || "") + " " + (sec.title || "")
        );
        const paras = Array.isArray(sec.paragraphs) ? sec.paragraphs : [];

        for (let p = 0; p < paras.length; p++) {
          const para = paras[p];
          if (!para || !para.id) continue;
          pIds.push(para.id);

          const meta = {
            id: para.id,
            docId: lesson.id,
            docKind: "lesson",
            docTitle: lesson.title || "",
            chapterId: null,
            chapterTitle: "",
            sectionId: sec.id || null,
            sectionTitle: sec.title || "",
            text: para.text || "",
            words: typeof para.words === "number" ? para.words : countWords(para.text || ""),
            qScore: typeof para.qScore === "number" ? para.qScore : 100,
            qTier: para.qTier || "high",
          };
          paragraphsById.set(para.id, meta);

          searchIndex.push({
            order: searchIndex.length,
            paraId: para.id,
            docId: lesson.id,
            docKind: "lesson",
            docTitle: meta.docTitle,
            chapterId: null,
            chapterTitle: "",
            sectionId: meta.sectionId,
            sectionTitle: meta.sectionTitle,
            words: meta.words,
            qTier: meta.qTier,
            docQTier: lesson.qTier || "high",
            normHeading: normHeading,
            normOrigText: normalizeForSearch(meta.text),
          });
        }
      }
      docParagraphIds.set(lesson.id, pIds);
    }
  }

  function rebuildEditedNormCache() {
    editedNormCache.clear();
    const keys = Object.keys(state.annotations || {});
    for (let i = 0; i < keys.length; i++) {
      const pid = keys[i];
      const ann = state.annotations[pid];
      if (ann && typeof ann.editedText === "string") {
        editedNormCache.set(pid, normalizeForSearch(ann.editedText));
      }
    }
  }

  function getNormalizedEditedText(paraId, editedText) {
    let cached = editedNormCache.get(paraId);
    if (cached === undefined) {
      cached = normalizeForSearch(editedText);
      editedNormCache.set(paraId, cached);
    }
    return cached;
  }

  // ==================== State Hydration & Serialization ====================
  function normalizeCustomLesson(raw, index) {
    const idxNum = typeof index === "number" ? index + 1 : 1;
    const now = Date.now();
    const id = raw && raw.id ? String(raw.id) : uid("cst");
    const blocks = deepCloneBlocks(raw && Array.isArray(raw.blocks) ? raw.blocks : []);
    const snapshots = Array.isArray(raw && raw.snapshots)
      ? raw.snapshots.slice(-MAX_SNAPSHOTS).map(function (sn, sIdx) {
          return {
            id: sn && sn.id ? String(sn.id) : uid("snp"),
            label: cleanTextRules(
              sn && sn.label ? sn.label : "نقطة استعادة " + (sIdx + 1),
              { escapeAngles: true }
            ),
            createdAt: Number(sn && sn.createdAt) || now,
            title: sanitizeLiveText(sn && sn.title ? sn.title : raw && raw.title ? raw.title : ""),
            subtitle: sanitizeLiveText(sn && sn.subtitle ? sn.subtitle : ""),
            versionLabel: sanitizeLiveText(
              sn && sn.versionLabel ? sn.versionLabel : "النسخة 1"
            ),
            includeNotesInMd: sn && typeof sn.includeNotesInMd === "boolean" ? sn.includeNotesInMd : true,
            wordCount: Number(sn && sn.wordCount) || 0,
            blockCount: Array.isArray(sn && sn.blocks) ? sn.blocks.length : 0,
            blocks: deepCloneBlocks(sn && Array.isArray(sn.blocks) ? sn.blocks : []),
          };
        })
      : [];

    return {
      id: id,
      title: sanitizeLiveText(
        raw && raw.title ? raw.title : "نسخة مخصصة " + idxNum
      ),
      subtitle: sanitizeLiveText(raw && raw.subtitle ? raw.subtitle : ""),
      sourceDocId: raw && raw.sourceDocId ? String(raw.sourceDocId) : null,
      sourceTitle: sanitizeLiveText(raw && raw.sourceTitle ? raw.sourceTitle : ""),
      versionLabel: sanitizeLiveText(
        raw && raw.versionLabel ? raw.versionLabel : "النسخة 1"
      ),
      createdAt: Number(raw && raw.createdAt) || now,
      updatedAt: Number(raw && raw.updatedAt) || now,
      includeNotesInMd:
        raw && typeof raw.includeNotesInMd === "boolean" ? raw.includeNotesInMd : true,
      blocks: blocks,
      snapshots: snapshots,
    };
  }

  function hydrateState(raw) {
    if (!raw || typeof raw !== "object") return false;

    const basePrefs = defaultPrefs();
    if (raw.prefs && typeof raw.prefs === "object") {
      const p = raw.prefs;
      if (typeof p.theme === "string" && p.theme) basePrefs.theme = p.theme;
      if (typeof p.font === "string" && p.font) basePrefs.font = p.font;
      if (typeof p.fontSize === "number" && isFinite(p.fontSize)) {
        basePrefs.fontSize = Math.max(14, Math.min(34, p.fontSize));
      }
      if (typeof p.lineHeight === "number" && isFinite(p.lineHeight)) {
        basePrefs.lineHeight = Math.max(1.3, Math.min(2.6, p.lineHeight));
      }
      if (typeof p.width === "string" && p.width) basePrefs.width = p.width;
      if (typeof p.wpm === "number" && isFinite(p.wpm)) {
        basePrefs.wpm = Math.max(60, Math.min(350, p.wpm));
      }
      if (typeof p.copyFormat === "string" && p.copyFormat) {
        basePrefs.copyFormat = p.copyFormat;
      }
      if (typeof p.qualityFilter === "string" && (p.qualityFilter === "clean" || p.qualityFilter === "high" || p.qualityFilter === "all")) {
        basePrefs.qualityFilter = p.qualityFilter;
      }
      if (typeof p.activeTab === "string" && p.activeTab) {
        basePrefs.activeTab = p.activeTab;
      }
      if (typeof p.activeDocId === "string" && p.activeDocId) {
        basePrefs.activeDocId = p.activeDocId;
      }
      basePrefs.activeCustomId = p.activeCustomId ? String(p.activeCustomId) : null;
      basePrefs.splitMode = Boolean(p.splitMode);
      basePrefs.focusMode = Boolean(p.focusMode);
      basePrefs.multiSelect = Boolean(p.multiSelect);
    }

    const nextReadDocs = {};
    if (raw.readDocs && typeof raw.readDocs === "object") {
      Object.keys(raw.readDocs).forEach(function (k) {
        if (raw.readDocs[k]) nextReadDocs[k] = true;
      });
    }

    const nextAnnotations = {};
    if (raw.annotations && typeof raw.annotations === "object") {
      Object.keys(raw.annotations).forEach(function (pid) {
        const a = raw.annotations[pid];
        if (!a || typeof a !== "object") return;
        const origMeta = paragraphsById.get(pid);
        let edited =
          a.editedText !== null && a.editedText !== undefined
            ? cleanTextRules(String(a.editedText), { escapeAngles: true })
            : null;
        if (origMeta && edited === origMeta.text) {
          edited = null;
        }
        const note = a.note ? cleanTextRules(String(a.note), { escapeAngles: true }) : "";
        const highlight = a.highlight ? String(a.highlight).replace(/^hl-/, "") : "";
        const bookmarked = Boolean(a.bookmarked);
        const hidden = Boolean(a.hidden);

        if (edited !== null || note || highlight || bookmarked || hidden) {
          nextAnnotations[pid] = {
            editedText: edited,
            note: note,
            highlight: highlight,
            bookmarked: bookmarked,
            hidden: hidden,
            updatedAt: Number(a.updatedAt) || Date.now(),
          };
        }
      });
    }

    const nextInsertions = {};
    if (raw.docInsertions && typeof raw.docInsertions === "object") {
      Object.keys(raw.docInsertions).forEach(function (did) {
        const list = raw.docInsertions[did];
        if (!Array.isArray(list) || !list.length) return;
        const cleanedList = list
          .filter(function (it) {
            return it && typeof it === "object";
          })
          .map(function (it) {
            return {
              id: it.id ? String(it.id) : uid("ins"),
              afterParaId: it.afterParaId ? String(it.afterParaId) : null,
              type: VALID_INSERTION_TYPES.has(it.type) ? it.type : "p",
              text: cleanTextRules(String(it.text || ""), { escapeAngles: true }),
            };
          });
        if (cleanedList.length) {
          nextInsertions[did] = cleanedList;
        }
      });
    }

    const nextCustom = Array.isArray(raw.customLessons)
      ? raw.customLessons.map(function (cl, idx) {
          return normalizeCustomLesson(cl, idx);
        })
      : [];

    if (docsById.size > 0 && !docsById.has(basePrefs.activeDocId)) {
      basePrefs.activeDocId =
        (Store.topics[0] && Store.topics[0].id) ||
        (Store.lessons[0] && Store.lessons[0].id) ||
        "T01";
    }

    if (
      basePrefs.activeCustomId &&
      !nextCustom.some(function (c) {
        return c.id === basePrefs.activeCustomId;
      })
    ) {
      basePrefs.activeCustomId = nextCustom[0] ? nextCustom[0].id : null;
    } else if (!basePrefs.activeCustomId && nextCustom.length > 0) {
      basePrefs.activeCustomId = nextCustom[0].id;
    }

    state.prefs = basePrefs;
    state.readDocs = nextReadDocs;
    state.annotations = nextAnnotations;
    state.docInsertions = nextInsertions;
    state.customLessons = nextCustom;
    state.selection = [];
    selectionSet.clear();

    stateUpdatedAt = Number(raw.updatedAt) || Date.now();
    rebuildEditedNormCache();
    return true;
  }

  function serializeWorkspacePayload() {
    return {
      app: "qabas-studio",
      version: 1,
      updatedAt: stateUpdatedAt || Date.now(),
      prefs: state.prefs,
      readDocs: state.readDocs,
      annotations: state.annotations,
      docInsertions: state.docInsertions,
      customLessons: state.customLessons,
    };
  }

  // ==================== Dual Persistence: IndexedDB + localStorage + Server ====================
  function openIdb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve) {
      if (typeof indexedDB === "undefined" || !indexedDB) {
        resolve(null);
        return;
      }
      let settled = false;
      const timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 900);

      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (ev) {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE);
          }
        };
        req.onsuccess = function (ev) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(ev.target.result);
          }
        };
        req.onerror = function () {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        };
        req.onblocked = function () {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        };
      } catch (_err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    });
    return idbPromise;
  }

  async function readFromIdb() {
    const db = await openIdb();
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(DB_STORE, "readonly");
        const store = tx.objectStore(DB_STORE);
        const req = store.get(DB_KEY);
        req.onsuccess = function () {
          resolve(req.result && typeof req.result === "object" ? req.result : null);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (_err) {
        resolve(null);
      }
    });
  }

  async function writeToIdb(payload) {
    const db = await openIdb();
    if (!db) return false;
    return new Promise(function (resolve) {
      try {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        store.put(payload, DB_KEY);
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          resolve(false);
        };
        tx.onabort = function () {
          resolve(false);
        };
      } catch (_err) {
        resolve(false);
      }
    });
  }

  function readFromLocalStorage() {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function writeToLocalStorage(payload) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      return true;
    } catch (_err) {
      return false;
    }
  }

  async function loadBrowserState() {
    const idbData = await readFromIdb();
    const lsData = readFromLocalStorage();
    if (idbData && lsData) {
      return (lsData.updatedAt || 0) > (idbData.updatedAt || 0) ? lsData : idbData;
    }
    return idbData || lsData || null;
  }

  async function saveBrowserState(payload) {
    const lsOk = writeToLocalStorage(payload);
    const idbOk = await writeToIdb(payload);
    return idbOk || lsOk;
  }

  async function fetchJsonWithTimeout(url, options, timeoutMs) {
    if (typeof fetch !== "function") return null;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs || 1500);

    try {
      const fetchOpts = Object.assign({}, options || {});
      if (ctrl) fetchOpts.signal = ctrl.signal;
      const res = await fetch(url, fetchOpts);
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch (_err) {
      clearTimeout(timer);
      return null;
    }
  }

  function getCandidateApiBases() {
    if (typeof window === "undefined" || !window.location) return [];
    const proto = window.location.protocol;
    const host = window.location.hostname || "";
    const port = window.location.port;

    if (host.endsWith(".github.io") || host.endsWith(".pages.dev") || host.endsWith(".netlify.app")) {
      return [];
    }
    if (proto === "file:") {
      return [LOCAL_SERVER_FALLBACK];
    }
    if (host === "127.0.0.1" || host === "localhost") {
      return port === "8765" ? [""] : ["", LOCAL_SERVER_FALLBACK];
    }
    if (proto === "http:" || proto === "https:") {
      return [""];
    }
    return [];
  }

  async function pushStateToServer(payload) {
    if (!serverAvailable) return false;
    const res = await fetchJsonWithTimeout(
      apiBaseUrl + "/api/state",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      3500
    );
    return Boolean(res && res.ok);
  }

  function setSyncStatus(nextStatus) {
    Store.syncStatus = nextStatus;
    emit("sync", {
      status: nextStatus,
      serverAvailable: serverAvailable,
      updatedAt: stateUpdatedAt,
    });
  }

  async function flushPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (!dirtyPersist) return true;
    dirtyPersist = false;

    const payload = serializeWorkspacePayload();
    await saveBrowserState(payload);

    if (serverAvailable) {
      const ok = await pushStateToServer(payload);
      if (ok) {
        setSyncStatus("local-disk");
        return true;
      }
      setSyncStatus("error");
      return false;
    } else {
      setSyncStatus("browser-only");
      return true;
    }
  }

  function schedulePersist(immediate) {
    stateUpdatedAt = Date.now();
    dirtyPersist = true;

    if (Store.syncStatus !== "saving") {
      setSyncStatus("saving");
    }

    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    if (immediate) {
      return flushPersist();
    }

    persistTimer = setTimeout(function () {
      flushPersist();
    }, PERSIST_DEBOUNCE_MS);
    return Promise.resolve(true);
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", function () {
      if (!dirtyPersist) return;
      const payload = serializeWorkspacePayload();
      writeToLocalStorage(payload);
      if (
        serverAvailable &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function" &&
        typeof Blob !== "undefined"
      ) {
        try {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          navigator.sendBeacon(apiBaseUrl + "/api/state", blob);
        } catch (_err) {
          // Ignore unload beacon errors
        }
      }
    });
  }

  // ==================== Store Initialization ====================
  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async function () {
      setSyncStatus("checking");
      buildCorpusIndexes();

      const localData = await loadBrowserState();

      serverAvailable = false;
      apiBaseUrl = "";
      let serverData = null;

      const candidates = getCandidateApiBases();
      for (let i = 0; i < candidates.length; i++) {
        const base = candidates[i];
        const statusRes = await fetchJsonWithTimeout(base + "/api/status", null, 1100);
        if (statusRes && statusRes.ok && statusRes.mode === "local-disk") {
          serverAvailable = true;
          apiBaseUrl = base;
          if (statusRes.hasSavedState) {
            const stateRes = await fetchJsonWithTimeout(base + "/api/state", null, 2000);
            if (stateRes && stateRes.ok && stateRes.state && typeof stateRes.state === "object") {
              serverData = stateRes.state;
            }
          }
          break;
        }
      }

      if (serverAvailable) {
        if (serverData && (!localData || (serverData.updatedAt || 0) >= (localData.updatedAt || 0))) {
          hydrateState(serverData);
          await saveBrowserState(serializeWorkspacePayload());
        } else if (localData) {
          hydrateState(localData);
          await pushStateToServer(serializeWorkspacePayload());
        } else {
          hydrateState({});
        }
        setSyncStatus("local-disk");
      } else {
        if (localData) {
          hydrateState(localData);
        } else {
          hydrateState({});
        }
        setSyncStatus("browser-only");
      }

      emit("prefs", state.prefs);
      emit("ready", state);
      emit("change", { type: "init" });
      return Store;
    })();

    return initPromise;
  }

  // ==================== Corpus Lookups & Fast Search ====================
  function getDoc(docId) {
    if (!docId) return null;
    if (docsById.size === 0 && (window.QABAS_TOPICS || window.QABAS_LESSONS)) {
      buildCorpusIndexes();
    }
    return docsById.get(String(docId)) || null;
  }

  function getParagraphMeta(paraId) {
    if (!paraId) return null;
    if (paragraphsById.size === 0 && (window.QABAS_TOPICS || window.QABAS_LESSONS)) {
      buildCorpusIndexes();
    }
    return paragraphsById.get(String(paraId)) || null;
  }

  function getEffectiveParagraphText(paraId) {
    if (!paraId) return "";
    const ann = state.annotations[paraId];
    if (ann && ann.editedText !== null && ann.editedText !== undefined) {
      return ann.editedText;
    }
    const meta = getParagraphMeta(paraId);
    return meta ? meta.text : "";
  }

  function search(query, opts) {
    const options = opts || {};
    const scope = options.scope || "all";
    const filterDocId = options.docId || null;
    const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : 120;

    if (searchIndex.length === 0 && (window.QABAS_TOPICS || window.QABAS_LESSONS)) {
      buildCorpusIndexes();
    }

    const normQuery = normalizeForSearch(query || "");
    if (!normQuery) {
      return { total: 0, items: [] };
    }

    const tokens = normQuery.split(" ").filter(Boolean);
    if (!tokens.length) {
      return { total: 0, items: [] };
    }

    const tCount = tokens.length;
    const rawMatches = [];
    const hasAnnotations = Object.keys(state.annotations).length > 0;
    const qMode = (opts && opts.qualityFilter) || state.prefs.qualityFilter || "clean";

    // 1. Search Corpus Paragraphs (Topics & Lessons)
    if (scope !== "custom") {
      for (let i = 0; i < searchIndex.length; i++) {
        const entry = searchIndex[i];

        if (filterDocId && entry.docId !== filterDocId) continue;
        if (scope === "topics" && entry.docKind !== "topic") continue;
        if (scope === "lessons" && entry.docKind !== "lesson") continue;

        const ann = hasAnnotations ? state.annotations[entry.paraId] : null;
        if (ann && ann.hidden) continue;

        const hasEdit = ann && typeof ann.editedText === "string";
        if (!hasEdit && qMode !== "all") {
          if (entry.docKind === "lesson" && qMode === "clean" && entry.docQTier === "low") continue;
          if (entry.docKind === "lesson" && qMode === "high" && entry.docQTier !== "high") continue;
          if (qMode === "clean" && entry.qTier === "low") continue;
          if (qMode === "high" && entry.qTier !== "high") continue;
        }
        const normBody = hasEdit
          ? getNormalizedEditedText(entry.paraId, ann.editedText)
          : entry.normOrigText;

        let allInBody = true;
        let matchedAll = true;

        for (let t = 0; t < tCount; t++) {
          const tok = tokens[t];
          if (normBody.indexOf(tok) === -1) {
            allInBody = false;
            if (entry.normHeading.indexOf(tok) === -1) {
              matchedAll = false;
              break;
            }
          }
        }

        if (!matchedAll) continue;

        let score = allInBody ? 50 : 25;
        if (tCount > 1 && normBody.indexOf(normQuery) !== -1) {
          score += 60;
        }
        if (entry.normHeading.indexOf(tokens[0]) !== -1) {
          score += 15;
        }

        rawMatches.push({
          isCustom: false,
          score: score,
          order: entry.order,
          entry: entry,
          hasEdit: hasEdit,
        });
      }
    }

    // 2. Search Custom Lessons
    if ((scope === "all" || scope === "custom") && !filterDocId) {
      for (let c = 0; c < state.customLessons.length; c++) {
        const cl = state.customLessons[c];
        if (!cl || !Array.isArray(cl.blocks)) continue;
        const normHeader = normalizeForSearch((cl.title || "") + " " + (cl.subtitle || ""));

        for (let b = 0; b < cl.blocks.length; b++) {
          const blk = cl.blocks[b];
          if (!blk || blk.hidden || !blk.text) continue;
          const normBlk = normalizeForSearch(blk.text);
          if (!normBlk) continue;

          let allInBlk = true;
          let matchedAll = true;
          for (let t = 0; t < tCount; t++) {
            const tok = tokens[t];
            if (normBlk.indexOf(tok) === -1) {
              allInBlk = false;
              if (normHeader.indexOf(tok) === -1) {
                matchedAll = false;
                break;
              }
            }
          }
          if (!matchedAll) continue;

          let score = allInBlk ? 55 : 28;
          if (tCount > 1 && normBlk.indexOf(normQuery) !== -1) {
            score += 60;
          }

          rawMatches.push({
            isCustom: true,
            score: score,
            order: 1000000 + c * 1000 + b,
            customLesson: cl,
            block: blk,
          });
        }
      }
    }

    rawMatches.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });

    const total = rawMatches.length;
    const sliced = rawMatches.slice(0, limit);
    const U = window.QabasUtils;

    const items = sliced.map(function (m) {
      let cachedSnippet = null;
      if (m.isCustom) {
        const txt = m.block.text || "";
        return {
          kind: "custom",
          isCustom: true,
          id: m.block.id,
          blockId: m.block.id,
          paraId: m.block.sourceParaId || null,
          customId: m.customLesson.id,
          docId: m.customLesson.id,
          docKind: "custom",
          docTitle: m.customLesson.title || "نسخة مخصصة",
          chapterId: null,
          chapterTitle: "",
          sectionId: null,
          sectionTitle: m.customLesson.versionLabel || "نسخة مخصصة",
          breadcrumb: "نسخة مخصصة › " + (m.customLesson.title || "بدون عنوان"),
          text: txt,
          get snippetHtml() {
            if (cachedSnippet === null) {
              cachedSnippet =
                U && typeof U.highlightMatches === "function"
                  ? U.highlightMatches(txt, query, 160)
                  : txt;
            }
            return cachedSnippet;
          },
          words: countWords(txt),
          score: m.score,
        };
      }

      const e = m.entry;
      const effText = getEffectiveParagraphText(e.paraId);
      const words = m.hasEdit ? countWords(effText) : e.words;
      return {
        kind: e.docKind,
        isCustom: false,
        id: e.paraId,
        paraId: e.paraId,
        docId: e.docId,
        docKind: e.docKind,
        docTitle: e.docTitle,
        chapterId: e.chapterId,
        chapterTitle: e.chapterTitle,
        sectionId: e.sectionId,
        sectionTitle: e.sectionTitle,
        breadcrumb: e.chapterTitle
          ? e.docTitle + " › " + e.chapterTitle + " › " + e.sectionTitle
          : e.docTitle + " › " + e.sectionTitle,
        text: effText,
        get snippetHtml() {
          if (cachedSnippet === null) {
            cachedSnippet =
              U && typeof U.highlightMatches === "function"
                ? U.highlightMatches(effText, query, 160)
                : effText;
          }
          return cachedSnippet;
        },
        words: words,
        score: m.score,
      };
    });

    return { total: total, items: items };
  }

  // ==================== Preferences & Read State ====================
  function updatePrefs(patch) {
    if (!patch || typeof patch !== "object") return state.prefs;
    const next = Object.assign({}, state.prefs);

    if ("theme" in patch && patch.theme) next.theme = String(patch.theme);
    if ("font" in patch && patch.font) next.font = String(patch.font);
    if ("fontSize" in patch && isFinite(Number(patch.fontSize))) {
      next.fontSize = Math.max(14, Math.min(34, Number(patch.fontSize)));
    }
    if ("lineHeight" in patch && isFinite(Number(patch.lineHeight))) {
      next.lineHeight = Math.max(1.3, Math.min(2.6, Number(patch.lineHeight)));
    }
    if ("width" in patch && patch.width) next.width = String(patch.width);
    if ("wpm" in patch && isFinite(Number(patch.wpm))) {
      next.wpm = Math.max(60, Math.min(350, Number(patch.wpm)));
    }
    if ("copyFormat" in patch && patch.copyFormat) {
      next.copyFormat = String(patch.copyFormat);
    }
    if ("qualityFilter" in patch && (patch.qualityFilter === "clean" || patch.qualityFilter === "high" || patch.qualityFilter === "all")) {
      next.qualityFilter = String(patch.qualityFilter);
    }
    if ("activeTab" in patch && patch.activeTab) {
      next.activeTab = String(patch.activeTab);
    }
    if ("activeDocId" in patch && patch.activeDocId) {
      next.activeDocId = String(patch.activeDocId);
    }
    if ("activeCustomId" in patch) {
      next.activeCustomId = patch.activeCustomId ? String(patch.activeCustomId) : null;
    }
    if ("splitMode" in patch) next.splitMode = Boolean(patch.splitMode);
    if ("focusMode" in patch) next.focusMode = Boolean(patch.focusMode);
    if ("multiSelect" in patch) next.multiSelect = Boolean(patch.multiSelect);

    state.prefs = next;
    schedulePersist();
    emit("prefs", state.prefs);
    emit("change", { type: "prefs", prefs: state.prefs });
    return state.prefs;
  }

  function toggleReadDoc(docId, forceBool) {
    if (!docId) return false;
    const id = String(docId);
    const shouldRead =
      typeof forceBool === "boolean" ? forceBool : !state.readDocs[id];
    if (shouldRead) {
      state.readDocs[id] = true;
    } else {
      delete state.readDocs[id];
    }
    schedulePersist();
    emit("change", { type: "readDocs", docId: id, isRead: shouldRead });
    return shouldRead;
  }

  // ==================== Non-Destructive Original Doc Annotations & Insertions ====================
  function getAnnotation(paraId) {
    if (!paraId) return defaultAnnotation();
    const ann = state.annotations[paraId];
    return ann ? Object.assign({}, ann) : defaultAnnotation();
  }

  function saveParagraphAnnotation(paraId, patch) {
    if (!paraId || !patch || typeof patch !== "object") return null;
    const pid = String(paraId);
    const meta = getParagraphMeta(pid);
    const prev = state.annotations[pid] || defaultAnnotation();
    const next = {
      editedText: prev.editedText,
      note: prev.note || "",
      highlight: prev.highlight || "",
      bookmarked: Boolean(prev.bookmarked),
      hidden: Boolean(prev.hidden),
      updatedAt: Date.now(),
    };

    if ("editedText" in patch) {
      if (patch.editedText === null || patch.editedText === undefined) {
        next.editedText = null;
      } else {
        const cleaned = cleanTextRules(String(patch.editedText), { escapeAngles: true });
        next.editedText = meta && cleaned === meta.text ? null : cleaned;
      }
    }

    if ("note" in patch) {
      next.note = cleanTextRules(String(patch.note || ""), { escapeAngles: true });
    }

    if ("highlight" in patch) {
      next.highlight = String(patch.highlight || "").replace(/^hl-/, "");
    }

    if ("bookmarked" in patch) {
      next.bookmarked = Boolean(patch.bookmarked);
    }

    if ("hidden" in patch) {
      next.hidden = Boolean(patch.hidden);
    }

    if (next.editedText !== null) {
      editedNormCache.set(pid, normalizeForSearch(next.editedText));
    } else {
      editedNormCache.delete(pid);
    }

    const isEmpty =
      next.editedText === null &&
      !next.note &&
      !next.highlight &&
      !next.bookmarked &&
      !next.hidden;

    if (isEmpty) {
      delete state.annotations[pid];
    } else {
      state.annotations[pid] = next;
    }

    schedulePersist();
    const result = state.annotations[pid] || null;
    emit("annotationChanged", {
      paraId: pid,
      docId: meta ? meta.docId : null,
      annotation: result,
    });
    emit("change", { type: "annotation", paraId: pid });
    return result;
  }

  function revertParagraph(paraId) {
    if (!paraId) return false;
    const pid = String(paraId);
    const cur = state.annotations[pid];
    if (!cur) return false;

    saveParagraphAnnotation(pid, { editedText: null, hidden: false });
    return true;
  }

  function revertAllInDoc(docId) {
    if (!docId) return 0;
    const did = String(docId);
    const pIds = docParagraphIds.get(did) || [];
    let revertedCount = 0;

    for (let i = 0; i < pIds.length; i++) {
      const pid = pIds[i];
      const cur = state.annotations[pid];
      if (!cur) continue;
      if (cur.editedText !== null || cur.hidden) {
        revertedCount++;
        cur.editedText = null;
        cur.hidden = false;
        cur.updatedAt = Date.now();
        editedNormCache.delete(pid);
        if (!cur.note && !cur.highlight && !cur.bookmarked) {
          delete state.annotations[pid];
        }
      }
    }

    if (state.docInsertions[did] && state.docInsertions[did].length) {
      revertedCount += state.docInsertions[did].length;
      delete state.docInsertions[did];
    }

    if (revertedCount > 0) {
      schedulePersist();
      emit("annotationChanged", { docId: did, revertedAll: true });
      emit("change", { type: "revertAllInDoc", docId: did });
    }
    return revertedCount;
  }

  function getDocEditCount(docId) {
    if (!docId) return 0;
    const did = String(docId);
    const pIds = docParagraphIds.get(did) || [];
    let count = 0;

    for (let i = 0; i < pIds.length; i++) {
      const ann = state.annotations[pIds[i]];
      if (ann && (ann.editedText !== null || ann.hidden)) {
        count++;
      }
    }

    if (Array.isArray(state.docInsertions[did])) {
      count += state.docInsertions[did].length;
    }
    return count;
  }

  function splitDocParagraph(docId, paraId, beforeText, afterText) {
    let did = docId;
    let pid = paraId;
    let bRaw = beforeText;
    let aRaw = afterText;

    // Defensive support if called with 3 args (paraId, beforeText, afterText)
    if (arguments.length === 3) {
      pid = docId;
      bRaw = paraId;
      aRaw = beforeText;
      const m = getParagraphMeta(pid);
      did = m ? m.docId : null;
    }

    if (!did || !pid) return null;
    const bClean = cleanTextRules(String(bRaw || ""), { escapeAngles: true });
    const aClean = cleanTextRules(String(aRaw || ""), { escapeAngles: true });
    if (!bClean || !aClean) return null;

    saveParagraphAnnotation(pid, { editedText: bClean });

    const list = Array.isArray(state.docInsertions[did])
      ? state.docInsertions[did]
      : (state.docInsertions[did] = []);

    const newIns = {
      id: uid("ins"),
      afterParaId: String(pid),
      type: "p",
      text: aClean,
    };

    // Place right at the beginning of insertions anchored to pid so order is [beforeText, afterText, ...]
    const firstAfterIdx = list.findIndex(function (it) {
      return it.afterParaId === String(pid);
    });
    if (firstAfterIdx !== -1) {
      list.splice(firstAfterIdx, 0, newIns);
    } else {
      list.push(newIns);
    }

    schedulePersist();
    emit("annotationChanged", { docId: String(did), paraId: String(pid), insertion: newIns });
    emit("change", { type: "splitDocParagraph", docId: String(did), paraId: String(pid) });
    return newIns;
  }

  function addDocInsertion(docId, afterParaId, type, text) {
    if (!docId) return null;
    const did = String(docId);
    const insType = VALID_INSERTION_TYPES.has(type) ? type : "p";
    const cleaned = cleanTextRules(String(text || ""), { escapeAngles: true });

    if (!Array.isArray(state.docInsertions[did])) {
      state.docInsertions[did] = [];
    }

    const ins = {
      id: uid("ins"),
      afterParaId: afterParaId ? String(afterParaId) : null,
      type: insType,
      text: cleaned,
    };

    state.docInsertions[did].push(ins);
    schedulePersist();
    emit("annotationChanged", { docId: did, insertion: ins });
    emit("change", { type: "addDocInsertion", docId: did });
    return ins;
  }

  function updateDocInsertion(docId, insId, text, type) {
    if (!docId || !insId) return null;
    const did = String(docId);
    const list = state.docInsertions[did];
    if (!Array.isArray(list)) return null;

    const target = list.find(function (it) {
      return it.id === String(insId);
    });
    if (!target) return null;

    if (text && typeof text === "object") {
      if ("text" in text) {
        target.text = cleanTextRules(String(text.text || ""), { escapeAngles: true });
      }
      if ("type" in text && VALID_INSERTION_TYPES.has(text.type)) {
        target.type = text.type;
      }
    } else {
      target.text = cleanTextRules(String(text == null ? "" : text), { escapeAngles: true });
      if (type && VALID_INSERTION_TYPES.has(type)) {
        target.type = type;
      }
    }

    schedulePersist();
    emit("annotationChanged", { docId: did, insertion: target });
    emit("change", { type: "updateDocInsertion", docId: did });
    return target;
  }

  function deleteDocInsertion(docId, insId) {
    if (!docId || !insId) return false;
    const did = String(docId);
    const list = state.docInsertions[did];
    if (!Array.isArray(list)) return false;

    const beforeLen = list.length;
    state.docInsertions[did] = list.filter(function (it) {
      return it.id !== String(insId);
    });
    if (state.docInsertions[did].length === 0) {
      delete state.docInsertions[did];
    }

    const changed = beforeLen !== (state.docInsertions[did] ? state.docInsertions[did].length : 0);
    if (changed) {
      schedulePersist();
      emit("annotationChanged", { docId: did, deletedInsertionId: String(insId) });
      emit("change", { type: "deleteDocInsertion", docId: did });
    }
    return changed;
  }

  function getAllBookmarkedAndAnnotated(filterHighlight) {
    if (searchIndex.length === 0 && (window.QABAS_TOPICS || window.QABAS_LESSONS)) {
      buildCorpusIndexes();
    }

    const filterKey = String(filterHighlight || "all")
      .trim()
      .replace(/^hl-/, "");
    const results = [];

    for (let i = 0; i < searchIndex.length; i++) {
      const pid = searchIndex[i].paraId;
      const ann = state.annotations[pid];
      if (!ann) continue;

      const meta = paragraphsById.get(pid);
      if (!meta) continue;

      const isEdited = ann.editedText !== null && ann.editedText !== meta.text;
      const hasNote = Boolean(ann.note && ann.note.trim());
      const hasHighlight = Boolean(ann.highlight);
      const isBookmarked = Boolean(ann.bookmarked);

      if (!isBookmarked && !hasHighlight && !hasNote && !isEdited) {
        continue;
      }

      if (filterKey && filterKey !== "all") {
        if (
          filterKey === "bookmarked" ||
          filterKey === "bookmark" ||
          filterKey === "favorites"
        ) {
          if (!isBookmarked) continue;
        } else if (filterKey === "edited" || filterKey === "modified") {
          if (!isEdited) continue;
        } else if (filterKey === "note" || filterKey === "notes") {
          if (!hasNote) continue;
        } else if (ann.highlight !== filterKey) {
          continue;
        }
      }

      const effText = getEffectiveParagraphText(pid);
      results.push({
        id: pid,
        paraId: pid,
        docId: meta.docId,
        docKind: meta.docKind,
        docTitle: meta.docTitle,
        chapterId: meta.chapterId,
        chapterTitle: meta.chapterTitle,
        sectionId: meta.sectionId,
        sectionTitle: meta.sectionTitle,
        originalText: meta.text,
        text: effText,
        effectiveText: effText,
        words: countWords(effText),
        annotation: Object.assign({}, ann),
        editedText: ann.editedText,
        isEdited: isEdited,
        note: ann.note || "",
        highlight: ann.highlight || "",
        bookmarked: isBookmarked,
        hidden: Boolean(ann.hidden),
        updatedAt: ann.updatedAt || 0,
      });
    }

    return results;
  }

  // ==================== Multi-Selection ====================
  function isSelected(paraId) {
    return selectionSet.has(String(paraId || ""));
  }

  function toggleSelect(paraId) {
    if (!paraId) return false;
    const pid = String(paraId);
    if (selectionSet.has(pid)) {
      selectionSet.delete(pid);
      state.selection = state.selection.filter(function (id) {
        return id !== pid;
      });
    } else {
      selectionSet.add(pid);
      state.selection.push(pid);
    }
    emit("selection", state.selection);
    emit("change", { type: "selection", selection: state.selection });
    return selectionSet.has(pid);
  }

  function selectRange(paraIdsArray, selectBool) {
    if (!Array.isArray(paraIdsArray) || !paraIdsArray.length) return state.selection;
    const shouldSelect = selectBool !== false;

    if (shouldSelect) {
      for (let i = 0; i < paraIdsArray.length; i++) {
        const pid = String(paraIdsArray[i] || "");
        if (pid && !selectionSet.has(pid)) {
          selectionSet.add(pid);
          state.selection.push(pid);
        }
      }
    } else {
      const removeSet = new Set(
        paraIdsArray.map(function (id) {
          return String(id || "");
        })
      );
      removeSet.forEach(function (id) {
        selectionSet.delete(id);
      });
      state.selection = state.selection.filter(function (id) {
        return !removeSet.has(id);
      });
    }

    emit("selection", state.selection);
    emit("change", { type: "selection", selection: state.selection });
    return state.selection;
  }

  function clearSelection() {
    if (!state.selection.length && selectionSet.size === 0) return;
    state.selection = [];
    selectionSet.clear();
    emit("selection", state.selection);
    emit("change", { type: "selection", selection: state.selection });
  }

  // ==================== Custom Lesson Studio Helpers ====================
  function getCustomLesson(customId) {
    const targetId =
      customId ||
      state.prefs.activeCustomId ||
      (state.customLessons[0] && state.customLessons[0].id) ||
      null;
    if (!targetId) return null;
    return (
      state.customLessons.find(function (c) {
        return c.id === String(targetId);
      }) || null
    );
  }

  function ensureDraftCustomLesson(customId) {
    let cl = getCustomLesson(customId);
    let wasCreated = false;
    if (!cl) {
      const now = Date.now();
      const num = state.customLessons.length + 1;
      cl = {
        id: uid("cst"),
        title: "مسودة مخصصة " + num,
        subtitle: "فقرات ومباحث ملتقطة من المكتبة",
        sourceDocId: null,
        sourceTitle: "",
        versionLabel: "النسخة 1",
        createdAt: now,
        updatedAt: now,
        includeNotesInMd: true,
        blocks: [],
        snapshots: [],
      };
      state.customLessons.push(cl);
      state.prefs.activeCustomId = cl.id;
      wasCreated = true;
    }
    return { cl: cl, wasCreated: wasCreated };
  }

  function dropSingleEmptyStarterBlock(cl) {
    if (
      cl &&
      cl.blocks.length === 1 &&
      !cl.blocks[0].text.trim() &&
      !cl.blocks[0].sourceRef
    ) {
      cl.blocks = [];
    }
  }

  function isParagraphQualityAllowed(paraOrId, modeOverride) {
    const qMode = modeOverride || state.prefs.qualityFilter || "clean";
    if (qMode === "all") return true;

    const pid = typeof paraOrId === "string" ? paraOrId : paraOrId && paraOrId.id;
    if (pid) {
      const ann = state.annotations[pid];
      if (ann && typeof ann.editedText === "string") return true;
    }

    let qTier = paraOrId && typeof paraOrId === "object" ? paraOrId.qTier : null;
    if (!qTier && pid) {
      const meta = paragraphsById.get(pid);
      qTier = meta ? meta.qTier : "high";
    }
    if (!qTier) qTier = "high";

    if (qMode === "high") return qTier === "high";
    return qTier !== "low";
  }

  function isDocQualityAllowed(docOrId, modeOverride) {
    const qMode = modeOverride || state.prefs.qualityFilter || "clean";
    if (qMode === "all") return true;
    const doc = typeof docOrId === "string" ? getDoc(docOrId) : docOrId;
    if (!doc) return false;
    if (doc.kind === "topic") {
      return qMode === "high" ? (doc.highParagraphCount || 1) > 0 : (doc.cleanParagraphCount || 1) > 0;
    }
    const tier = doc.qTier || "high";
    if (qMode === "high") return tier === "high";
    return tier !== "low";
  }

  function getDocVisibleStats(docOrId, modeOverride) {
    const qMode = modeOverride || state.prefs.qualityFilter || "clean";
    const doc = typeof docOrId === "string" ? getDoc(docOrId) : docOrId;
    if (!doc) return { paragraphs: 0, words: 0, filteredOutCount: 0 };
    if (qMode === "all") {
      return {
        paragraphs: doc.paragraphCount || 0,
        words: doc.wordCount || 0,
        filteredOutCount: 0,
      };
    }
    if (qMode === "high" && typeof doc.highParagraphCount === "number") {
      return {
        paragraphs: doc.highParagraphCount,
        words: doc.highWords || 0,
        filteredOutCount: Math.max(0, (doc.paragraphCount || 0) - doc.highParagraphCount),
      };
    }
    if (typeof doc.cleanParagraphCount === "number") {
      return {
        paragraphs: doc.cleanParagraphCount,
        words: doc.cleanWords || 0,
        filteredOutCount: doc.lowParagraphCount || 0,
      };
    }
    return {
      paragraphs: doc.paragraphCount || 0,
      words: doc.wordCount || 0,
      filteredOutCount: 0,
    };
  }

  function buildParagraphAndInsertionBlocks(docId, para) {
    const out = [];
    if (!isParagraphQualityAllowed(para)) return out;
    const meta = getParagraphMeta(para.id);
    const ann = state.annotations[para.id];
    const effText = getEffectiveParagraphText(para.id);

    out.push({
      id: uid("blk"),
      type: "p",
      text: effText,
      originalText: para.text || effText,
      sourceRef: formatSourceRef(meta),
      sourceParaId: para.id,
      sourceDocId: docId,
      hidden: Boolean(ann && ann.hidden),
    });

    if (ann && ann.note && ann.note.trim()) {
      out.push({
        id: uid("blk"),
        type: "note",
        text: ann.note.trim(),
        originalText: ann.note.trim(),
        sourceRef: formatSourceRef(meta),
        sourceParaId: para.id,
        sourceDocId: docId,
        hidden: false,
      });
    }

    const docIns = state.docInsertions[docId];
    if (Array.isArray(docIns) && docIns.length) {
      for (let i = 0; i < docIns.length; i++) {
        const ins = docIns[i];
        if (ins.afterParaId === para.id && ins.text) {
          out.push({
            id: uid("blk"),
            type: VALID_BLOCK_TYPES.has(ins.type) ? ins.type : "p",
            text: ins.text,
            originalText: ins.text,
            sourceRef: meta ? cleanTextRules(meta.docTitle, { escapeAngles: true }) : "",
            sourceParaId: null,
            sourceDocId: docId,
            hidden: false,
          });
        }
      }
    }

    return out;
  }

  // ==================== Undo / Redo Stacks (Depth 50) ====================
  function createUndoFrame(cl) {
    return {
      title: cl.title,
      subtitle: cl.subtitle,
      versionLabel: cl.versionLabel,
      includeNotesInMd: cl.includeNotesInMd !== false,
      blocks: deepCloneBlocks(cl.blocks),
    };
  }

  function applyUndoFrame(cl, frame) {
    cl.title = frame.title;
    cl.subtitle = frame.subtitle;
    cl.versionLabel = frame.versionLabel;
    cl.includeNotesInMd = frame.includeNotesInMd !== false;
    cl.blocks = deepCloneBlocks(frame.blocks);
    cl.updatedAt = Date.now();
  }

  function pushUndo(customId) {
    const cl = getCustomLesson(customId);
    if (!cl) return false;
    const cid = cl.id;
    if (!undoStacks[cid]) undoStacks[cid] = [];

    const frame = createUndoFrame(cl);
    const stack = undoStacks[cid];

    if (stack.length > 0) {
      const prev = stack[stack.length - 1];
      if (JSON.stringify(prev) === JSON.stringify(frame)) {
        return false;
      }
    }

    stack.push(frame);
    if (stack.length > MAX_UNDO_DEPTH) {
      stack.shift();
    }
    redoStacks[cid] = [];
    return true;
  }

  function canUndo(customId) {
    const cl = getCustomLesson(customId);
    if (!cl) return false;
    return Boolean(undoStacks[cl.id] && undoStacks[cl.id].length > 0);
  }

  function canRedo(customId) {
    const cl = getCustomLesson(customId);
    if (!cl) return false;
    return Boolean(redoStacks[cl.id] && redoStacks[cl.id].length > 0);
  }

  function undoCustom(customId) {
    const cl = getCustomLesson(customId);
    if (!cl || !canUndo(cl.id)) return false;
    const cid = cl.id;

    if (!redoStacks[cid]) redoStacks[cid] = [];
    redoStacks[cid].push(createUndoFrame(cl));
    if (redoStacks[cid].length > MAX_UNDO_DEPTH) {
      redoStacks[cid].shift();
    }

    const prevFrame = undoStacks[cid].pop();
    applyUndoFrame(cl, prevFrame);

    schedulePersist();
    emit("customChanged", { customId: cid, action: "undo" });
    emit("change", { type: "undoCustom", customId: cid });
    return true;
  }

  function redoCustom(customId) {
    const cl = getCustomLesson(customId);
    if (!cl || !canRedo(cl.id)) return false;
    const cid = cl.id;

    if (!undoStacks[cid]) undoStacks[cid] = [];
    undoStacks[cid].push(createUndoFrame(cl));
    if (undoStacks[cid].length > MAX_UNDO_DEPTH) {
      undoStacks[cid].shift();
    }

    const nextFrame = redoStacks[cid].pop();
    applyUndoFrame(cl, nextFrame);

    schedulePersist();
    emit("customChanged", { customId: cid, action: "redo" });
    emit("change", { type: "redoCustom", customId: cid });
    return true;
  }

  // ==================== Custom Lesson Creation & Mutation ====================
  function createBlankCustomLesson(title, subtitle) {
    const now = Date.now();
    const num = state.customLessons.length + 1;
    const cleanTitle =
      cleanTextRules(String(title || ""), { escapeAngles: true }) ||
      "نسخة مخصصة " + num;
    const cleanSubtitle = cleanTextRules(String(subtitle || ""), {
      escapeAngles: true,
    });

    const cl = {
      id: uid("cst"),
      title: cleanTitle,
      subtitle: cleanSubtitle,
      sourceDocId: null,
      sourceTitle: "",
      versionLabel: "النسخة 1",
      createdAt: now,
      updatedAt: now,
      includeNotesInMd: true,
      blocks: [
        {
          id: uid("blk"),
          type: "p",
          text: "",
          originalText: "",
          sourceRef: "",
          sourceParaId: null,
          sourceDocId: null,
          hidden: false,
        },
      ],
      snapshots: [],
    };

    state.customLessons.push(cl);
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "create" });
    emit("prefs", state.prefs);
    emit("change", { type: "createBlankCustomLesson", customId: cl.id });
    return cl;
  }

  function forkDocToCustom(docId, opts) {
    const doc = getDoc(docId);
    if (!doc) return null;

    const options = opts || {};
    const sectionId = options.sectionId ? String(options.sectionId) : null;
    const chapterSet =
      Array.isArray(options.chapterIds) && options.chapterIds.length
        ? new Set(options.chapterIds.map(String))
        : null;
    const sectionSet =
      Array.isArray(options.sectionIds) && options.sectionIds.length
        ? new Set(options.sectionIds.map(String))
        : null;

    const blocks = [];
    let singleSectionTitle = "";

    if (doc.kind === "topic") {
      const chapters = Array.isArray(doc.chapters) ? doc.chapters : [];
      for (let c = 0; c < chapters.length; c++) {
        const ch = chapters[c];
        if (!ch) continue;

        if (sectionId) {
          const matchesCh = ch.id === sectionId;
          const matchesSub = (ch.subtopics || []).some(function (s) {
            return s.id === sectionId;
          });
          if (!matchesCh && !matchesSub) continue;
        } else if (chapterSet && !chapterSet.has(ch.id)) {
          continue;
        }

        const isSingleSubtopicFork =
          Boolean(sectionId) && ch.id !== sectionId;
        const chapterSubBlocks = [];

        const subtopics = Array.isArray(ch.subtopics) ? ch.subtopics : [];
        for (let s = 0; s < subtopics.length; s++) {
          const sub = subtopics[s];
          if (!sub) continue;
          if (sectionId && ch.id !== sectionId && sub.id !== sectionId) {
            continue;
          }
          if (sectionSet && !sectionSet.has(sub.id)) {
            continue;
          }

          if (sectionId && sub.id === sectionId) {
            singleSectionTitle = sub.title || "";
          }

          const subParaBlocks = [];
          const paras = Array.isArray(sub.paragraphs) ? sub.paragraphs : [];
          for (let p = 0; p < paras.length; p++) {
            const pBlocks = buildParagraphAndInsertionBlocks(doc.id, paras[p]);
            for (let k = 0; k < pBlocks.length; k++) {
              subParaBlocks.push(pBlocks[k]);
            }
          }
          if (!subParaBlocks.length) continue;

          chapterSubBlocks.push({
            id: uid("blk"),
            type: isSingleSubtopicFork ? "h2" : "h3",
            text: cleanTextRules(sub.title || "", { escapeAngles: true }),
            originalText: cleanTextRules(sub.title || "", { escapeAngles: true }),
            sourceRef: sub.id || ch.id || doc.id,
            sourceParaId: null,
            sourceDocId: doc.id,
            hidden: false,
          });
          for (let m = 0; m < subParaBlocks.length; m++) {
            chapterSubBlocks.push(subParaBlocks[m]);
          }
        }

        if (chapterSubBlocks.length) {
          if (!isSingleSubtopicFork) {
            blocks.push({
              id: uid("blk"),
              type: "h2",
              text: cleanTextRules(ch.title || "", { escapeAngles: true }),
              originalText: cleanTextRules(ch.title || "", { escapeAngles: true }),
              sourceRef: ch.id || doc.id,
              sourceParaId: null,
              sourceDocId: doc.id,
              hidden: false,
            });
          }
          for (let cb = 0; cb < chapterSubBlocks.length; cb++) {
            blocks.push(chapterSubBlocks[cb]);
          }
        }
      }
    } else {
      const allowedSecs = sectionSet || chapterSet;
      const sections = Array.isArray(doc.sections) ? doc.sections : [];
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        if (!sec) continue;
        if (sectionId && sec.id !== sectionId && !allowedSecs) continue;
        if (allowedSecs && !allowedSecs.has(sec.id)) continue;

        if (sectionId && sec.id === sectionId) {
          singleSectionTitle = sec.title || "";
        }

        const secParaBlocks = [];
        const paras = Array.isArray(sec.paragraphs) ? sec.paragraphs : [];
        for (let p = 0; p < paras.length; p++) {
          const pBlocks = buildParagraphAndInsertionBlocks(doc.id, paras[p]);
          for (let k = 0; k < pBlocks.length; k++) {
            secParaBlocks.push(pBlocks[k]);
          }
        }
        if (!secParaBlocks.length) continue;

        blocks.push({
          id: uid("blk"),
          type: "h2",
          text: cleanTextRules(sec.title || "", { escapeAngles: true }),
          originalText: cleanTextRules(sec.title || "", { escapeAngles: true }),
          sourceRef: sec.id || doc.id,
          sourceParaId: null,
          sourceDocId: doc.id,
          hidden: false,
        });
        for (let m = 0; m < secParaBlocks.length; m++) {
          blocks.push(secParaBlocks[m]);
        }
      }
    }

    const defaultTitle = singleSectionTitle
      ? "نسخة مخصصة: " + singleSectionTitle
      : "نسخة مخصصة: " + doc.title;
    const cleanTitle =
      cleanTextRules(String(options.customTitle || ""), { escapeAngles: true }) ||
      cleanTextRules(defaultTitle, { escapeAngles: true });

    const now = Date.now();
    const cl = {
      id: uid("cst"),
      title: cleanTitle,
      subtitle: cleanTextRules("مستنسخة من: " + doc.title, { escapeAngles: true }),
      sourceDocId: doc.id,
      sourceTitle: cleanTextRules(doc.title || "", { escapeAngles: true }),
      versionLabel: "النسخة 1",
      createdAt: now,
      updatedAt: now,
      includeNotesInMd: true,
      blocks: blocks,
      snapshots: [],
    };

    state.customLessons.push(cl);
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "fork" });
    emit("prefs", state.prefs);
    emit("change", { type: "forkDocToCustom", customId: cl.id });
    return cl;
  }

  function createCustomFromSelection(title, paraIdsOverride) {
    const ids =
      Array.isArray(paraIdsOverride) && paraIdsOverride.length
        ? paraIdsOverride
        : state.selection.slice();
    if (!ids.length) return null;

    const blocks = [];
    const docTitlesSet = new Set();
    let firstDocId = null;

    for (let i = 0; i < ids.length; i++) {
      const pid = String(ids[i]);
      const meta = getParagraphMeta(pid);
      const effText = getEffectiveParagraphText(pid);
      if (!effText) continue;

      if (meta) {
        if (!firstDocId) firstDocId = meta.docId;
        if (meta.docTitle) docTitlesSet.add(meta.docTitle);
      }

      blocks.push({
        id: uid("blk"),
        type: "p",
        text: effText,
        originalText: meta ? meta.text : effText,
        sourceRef: formatSourceRef(meta),
        sourceParaId: pid,
        sourceDocId: meta ? meta.docId : null,
        hidden: false,
      });
    }

    if (!blocks.length) return null;

    const cleanTitle =
      cleanTextRules(String(title || ""), { escapeAngles: true }) ||
      "نسخة مخصصة من " + blocks.length + " فقرات مختارة";

    let subtitle = "";
    if (docTitlesSet.size === 1) {
      subtitle = "مختارات من: " + Array.from(docTitlesSet)[0];
    } else if (docTitlesSet.size > 1) {
      subtitle = "مختارات مجمعة من " + docTitlesSet.size + " مصادر";
    }

    const now = Date.now();
    const cl = {
      id: uid("cst"),
      title: cleanTitle,
      subtitle: cleanTextRules(subtitle, { escapeAngles: true }),
      sourceDocId: docTitlesSet.size === 1 ? firstDocId : null,
      sourceTitle: docTitlesSet.size === 1 ? Array.from(docTitlesSet)[0] : "",
      versionLabel: "النسخة 1",
      createdAt: now,
      updatedAt: now,
      includeNotesInMd: true,
      blocks: blocks,
      snapshots: [],
    };

    state.customLessons.push(cl);
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "createFromSelection" });
    emit("prefs", state.prefs);
    emit("change", { type: "createCustomFromSelection", customId: cl.id });
    return cl;
  }

  function appendParagraphToCustom(paraId, customId) {
    if (!paraId) return null;
    const pid = String(paraId);
    const meta = getParagraphMeta(pid);
    const effText = getEffectiveParagraphText(pid);
    if (!meta && !effText) return null;

    const ensured = ensureDraftCustomLesson(customId);
    const cl = ensured.cl;
    if (!ensured.wasCreated) {
      pushUndo(cl.id);
      dropSingleEmptyStarterBlock(cl);
    }

    const blk = {
      id: uid("blk"),
      type: "p",
      text: effText,
      originalText: meta ? meta.text : effText,
      sourceRef: formatSourceRef(meta),
      sourceParaId: pid,
      sourceDocId: meta ? meta.docId : null,
      hidden: false,
    };

    cl.blocks.push(blk);
    cl.updatedAt = Date.now();
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", {
      customId: cl.id,
      action: "appendParagraph",
      blockId: blk.id,
    });
    if (ensured.wasCreated) emit("prefs", state.prefs);
    emit("change", { type: "appendParagraphToCustom", customId: cl.id });
    return cl;
  }

  function appendSectionToCustom(docId, sectionId, customId) {
    if (!sectionId && !docId) return null;
    if (sectionsById.size === 0 && (window.QABAS_TOPICS || window.QABAS_LESSONS)) {
      buildCorpusIndexes();
    }

    const sid = sectionId ? String(sectionId) : "";
    const secEntry = sid ? sectionsById.get(sid) : null;
    const chEntry = !secEntry && sid ? chaptersById.get(sid) : null;

    if (!secEntry && !chEntry) {
      // Fallback: if only docId was valid, fork/append whole doc
      const docOnly = getDoc(docId);
      if (!docOnly) return null;
      return forkDocToCustom(docOnly.id);
    }

    const ensured = ensureDraftCustomLesson(customId);
    const cl = ensured.cl;
    if (!ensured.wasCreated) {
      pushUndo(cl.id);
      dropSingleEmptyStarterBlock(cl);
    }

    if (secEntry) {
      const doc = secEntry.doc;
      const sec = secEntry.section;
      const ch = secEntry.chapter;

      cl.blocks.push({
        id: uid("blk"),
        type: secEntry.kind === "topic" ? "h3" : "h2",
        text: cleanTextRules(sec.title || "", { escapeAngles: true }),
        originalText: cleanTextRules(sec.title || "", { escapeAngles: true }),
        sourceRef: sec.id || (ch ? ch.id : doc.id),
        sourceParaId: null,
        sourceDocId: doc.id,
        hidden: false,
      });

      const paras = Array.isArray(sec.paragraphs) ? sec.paragraphs : [];
      for (let p = 0; p < paras.length; p++) {
        const pBlocks = buildParagraphAndInsertionBlocks(doc.id, paras[p]);
        for (let k = 0; k < pBlocks.length; k++) {
          cl.blocks.push(pBlocks[k]);
        }
      }
    } else if (chEntry) {
      const doc = chEntry.doc;
      const ch = chEntry.chapter;

      cl.blocks.push({
        id: uid("blk"),
        type: "h2",
        text: cleanTextRules(ch.title || "", { escapeAngles: true }),
        originalText: cleanTextRules(ch.title || "", { escapeAngles: true }),
        sourceRef: ch.id || doc.id,
        sourceParaId: null,
        sourceDocId: doc.id,
        hidden: false,
      });

      const subtopics = Array.isArray(ch.subtopics) ? ch.subtopics : [];
      for (let s = 0; s < subtopics.length; s++) {
        const sub = subtopics[s];
        cl.blocks.push({
          id: uid("blk"),
          type: "h3",
          text: cleanTextRules(sub.title || "", { escapeAngles: true }),
          originalText: cleanTextRules(sub.title || "", { escapeAngles: true }),
          sourceRef: sub.id || ch.id || doc.id,
          sourceParaId: null,
          sourceDocId: doc.id,
          hidden: false,
        });
        const paras = Array.isArray(sub.paragraphs) ? sub.paragraphs : [];
        for (let p = 0; p < paras.length; p++) {
          const pBlocks = buildParagraphAndInsertionBlocks(doc.id, paras[p]);
          for (let k = 0; k < pBlocks.length; k++) {
            cl.blocks.push(pBlocks[k]);
          }
        }
      }
    }

    cl.updatedAt = Date.now();
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "appendSection" });
    if (ensured.wasCreated) emit("prefs", state.prefs);
    emit("change", { type: "appendSectionToCustom", customId: cl.id });
    return cl;
  }

  function appendSelectionToCustom(customId) {
    if (!state.selection.length) return null;
    const ids = state.selection.slice();

    const ensured = ensureDraftCustomLesson(customId);
    const cl = ensured.cl;
    if (!ensured.wasCreated) {
      pushUndo(cl.id);
      dropSingleEmptyStarterBlock(cl);
    }

    for (let i = 0; i < ids.length; i++) {
      const pid = String(ids[i]);
      const meta = getParagraphMeta(pid);
      const effText = getEffectiveParagraphText(pid);
      if (!effText) continue;

      cl.blocks.push({
        id: uid("blk"),
        type: "p",
        text: effText,
        originalText: meta ? meta.text : effText,
        sourceRef: formatSourceRef(meta),
        sourceParaId: pid,
        sourceDocId: meta ? meta.docId : null,
        hidden: false,
      });
    }

    cl.updatedAt = Date.now();
    state.prefs.activeCustomId = cl.id;

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "appendSelection" });
    if (ensured.wasCreated) emit("prefs", state.prefs);
    emit("change", { type: "appendSelectionToCustom", customId: cl.id });
    return cl;
  }

  function duplicateCustomLesson(customId) {
    const src = getCustomLesson(customId);
    if (!src) return null;

    const now = Date.now();
    const clonedBlocks = deepCloneBlocks(src.blocks).map(function (b) {
      b.id = uid("blk");
      return b;
    });

    const copy = {
      id: uid("cst"),
      title: cleanTextRules(src.title + " (نسخة)", { escapeAngles: true }),
      subtitle: src.subtitle || "",
      sourceDocId: src.sourceDocId || null,
      sourceTitle: src.sourceTitle || "",
      versionLabel: src.versionLabel || "النسخة 1",
      createdAt: now,
      updatedAt: now,
      includeNotesInMd: src.includeNotesInMd !== false,
      blocks: clonedBlocks,
      snapshots: [],
    };

    const idx = state.customLessons.findIndex(function (c) {
      return c.id === src.id;
    });
    if (idx !== -1) {
      state.customLessons.splice(idx + 1, 0, copy);
    } else {
      state.customLessons.push(copy);
    }
    state.prefs.activeCustomId = copy.id;

    schedulePersist();
    emit("customChanged", { customId: copy.id, action: "duplicate" });
    emit("prefs", state.prefs);
    emit("change", { type: "duplicateCustomLesson", customId: copy.id });
    return copy;
  }

  function deleteCustomLesson(customId) {
    if (!customId) return false;
    const cid = String(customId);
    const idx = state.customLessons.findIndex(function (c) {
      return c.id === cid;
    });
    if (idx === -1) return false;

    state.customLessons.splice(idx, 1);
    delete undoStacks[cid];
    delete redoStacks[cid];

    if (state.prefs.activeCustomId === cid) {
      const nextLesson =
        state.customLessons[idx] || state.customLessons[idx - 1] || null;
      state.prefs.activeCustomId = nextLesson ? nextLesson.id : null;
    }

    schedulePersist();
    emit("customChanged", { customId: cid, action: "delete" });
    emit("prefs", state.prefs);
    emit("change", { type: "deleteCustomLesson", customId: cid });
    return true;
  }

  function updateCustomMeta(customId, patch) {
    const cl = getCustomLesson(customId);
    if (!cl || !patch || typeof patch !== "object") return null;

    if ("title" in patch) {
      cl.title = sanitizeLiveText(patch.title);
    }
    if ("subtitle" in patch) {
      cl.subtitle = sanitizeLiveText(patch.subtitle);
    }
    if ("versionLabel" in patch) {
      cl.versionLabel = sanitizeLiveText(patch.versionLabel);
    }
    if ("includeNotesInMd" in patch) {
      cl.includeNotesInMd = Boolean(patch.includeNotesInMd);
    }

    cl.updatedAt = Date.now();
    schedulePersist();
    emit("customChanged", {
      customId: cl.id,
      action: "meta",
      metaOnly: true,
    });
    emit("change", { type: "updateCustomMeta", customId: cl.id });
    return cl;
  }

  function updateCustomBlocks(customId, mutatorFn, recordUndo) {
    const cl = getCustomLesson(customId);
    if (!cl || typeof mutatorFn !== "function") return null;

    const shouldRecordUndo = recordUndo !== false;
    if (shouldRecordUndo) {
      pushUndo(cl.id);
    }

    const res = mutatorFn(cl.blocks, cl);
    if (Array.isArray(res)) {
      cl.blocks = res;
    }

    cl.blocks = cl.blocks.map(function (b) {
      return {
        id: b && b.id ? String(b.id) : uid("blk"),
        type: b && VALID_BLOCK_TYPES.has(b.type) ? b.type : "p",
        text: sanitizeLiveText(b && b.text != null ? b.text : ""),
        originalText: sanitizeLiveText(
          b && b.originalText != null ? b.originalText : b && b.text != null ? b.text : ""
        ),
        sourceRef: sanitizeLiveText(b && b.sourceRef ? b.sourceRef : ""),
        sourceParaId: b && b.sourceParaId ? String(b.sourceParaId) : null,
        sourceDocId: b && b.sourceDocId ? String(b.sourceDocId) : null,
        hidden: Boolean(b && b.hidden),
      };
    });

    cl.updatedAt = Date.now();
    schedulePersist();
    emit("customChanged", {
      customId: cl.id,
      action: shouldRecordUndo ? "blocks" : "typing",
      inlineTyping: !shouldRecordUndo,
    });
    emit("change", { type: "updateCustomBlocks", customId: cl.id });
    return cl;
  }

  function replaceCustomFromMarkdown(customId, rawMarkdown) {
    const cl = getCustomLesson(customId);
    if (!cl) return null;

    pushUndo(cl.id);

    // Map existing blocks by normalized exact text to preserve sourceRef & originalText across raw-markdown edits
    const prevByText = new Map();
    for (let i = 0; i < cl.blocks.length; i++) {
      const oldBlk = cl.blocks[i];
      const key = (oldBlk.text || "").trim();
      if (key && !prevByText.has(key)) {
        prevByText.set(key, oldBlk);
      }
    }

    const sanitized = sanitizeExportText(String(rawMarkdown || ""));
    const lines = sanitized.split("\n");
    const newBlocks = [];
    let paraBuf = [];
    let consumedTopH1 = false;

    function attachPreservedMeta(btype, btext) {
      const prev = prevByText.get(btext);
      return {
        id: prev ? prev.id : uid("blk"),
        type: btype,
        text: btext,
        originalText: prev ? prev.originalText : btext,
        sourceRef: prev ? prev.sourceRef : "",
        sourceParaId: prev ? prev.sourceParaId : null,
        sourceDocId: prev ? prev.sourceDocId : null,
        hidden: false,
      };
    }

    function flushParaBuf() {
      if (!paraBuf.length) return;
      const joined = paraBuf.join("\n").trim();
      paraBuf = [];
      if (!joined) return;

      if (/^\*\*ملاحظة تحريرية\*\*\s*:/.test(joined)) {
        const noteText = joined.replace(/^\*\*ملاحظة تحريرية\*\*\s*:\s*/, "").trim();
        if (noteText) {
          newBlocks.push(attachPreservedMeta("note", noteText));
        }
        return;
      }

      if (
        joined.startsWith("«") &&
        joined.endsWith("»") &&
        joined.length > 2 &&
        joined.slice(1, -1).indexOf("»") === -1
      ) {
        const quoteInner = joined.slice(1, -1).trim();
        if (quoteInner) {
          newBlocks.push(attachPreservedMeta("quote", quoteInner));
        }
        return;
      }

      newBlocks.push(attachPreservedMeta("p", joined));
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushParaBuf();
        continue;
      }

      if (
        !consumedTopH1 &&
        newBlocks.length === 0 &&
        paraBuf.length === 0 &&
        /^#\s+/.test(trimmed)
      ) {
        consumedTopH1 = true;
        const h1Title = trimmed.replace(/^#\s+/, "").trim();
        if (h1Title) cl.title = h1Title;
        continue;
      }

      if (/^###+\s+/.test(trimmed)) {
        flushParaBuf();
        const h3Text = trimmed.replace(/^###+\s+/, "").trim();
        if (h3Text) newBlocks.push(attachPreservedMeta("h3", h3Text));
      } else if (/^##\s+/.test(trimmed)) {
        flushParaBuf();
        const h2Text = trimmed.replace(/^##\s+/, "").trim();
        if (h2Text) newBlocks.push(attachPreservedMeta("h2", h2Text));
      } else if (/^#\s+/.test(trimmed)) {
        flushParaBuf();
        const hText = trimmed.replace(/^#\s+/, "").trim();
        if (hText) newBlocks.push(attachPreservedMeta("h2", hText));
      } else {
        paraBuf.push(line);
      }
    }

    flushParaBuf();

    cl.blocks = newBlocks;
    cl.updatedAt = Date.now();

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "replaceMarkdown" });
    emit("change", { type: "replaceCustomFromMarkdown", customId: cl.id });
    return cl;
  }

  // ==================== Snapshots ====================
  function saveSnapshot(customId, label) {
    const cl = getCustomLesson(customId);
    if (!cl) return null;
    if (!Array.isArray(cl.snapshots)) cl.snapshots = [];

    const visibleWords = cl.blocks
      .filter(function (b) {
        return !b.hidden;
      })
      .reduce(function (sum, b) {
        return sum + countWords(b.text || "");
      }, 0);

    const num = cl.snapshots.length + 1;
    const cleanLabel =
      cleanTextRules(String(label || ""), { escapeAngles: true }) ||
      "نقطة استعادة " + num;

    const snap = {
      id: uid("snp"),
      label: cleanLabel,
      createdAt: Date.now(),
      title: cl.title,
      subtitle: cl.subtitle,
      versionLabel: cl.versionLabel,
      includeNotesInMd: cl.includeNotesInMd !== false,
      wordCount: visibleWords,
      blockCount: cl.blocks.length,
      blocks: deepCloneBlocks(cl.blocks),
    };

    cl.snapshots.push(snap);
    if (cl.snapshots.length > MAX_SNAPSHOTS) {
      cl.snapshots.shift();
    }
    cl.updatedAt = Date.now();

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "saveSnapshot" });
    emit("change", { type: "saveSnapshot", customId: cl.id });
    return snap;
  }

  function restoreSnapshot(customId, snapId) {
    const cl = getCustomLesson(customId);
    if (!cl || !snapId || !Array.isArray(cl.snapshots)) return false;

    const snap = cl.snapshots.find(function (s) {
      return s.id === String(snapId);
    });
    if (!snap) return false;

    pushUndo(cl.id);

    cl.title = snap.title || cl.title;
    cl.subtitle = snap.subtitle != null ? snap.subtitle : cl.subtitle;
    cl.versionLabel = snap.versionLabel || cl.versionLabel;
    cl.includeNotesInMd = snap.includeNotesInMd !== false;
    cl.blocks = deepCloneBlocks(snap.blocks);
    cl.updatedAt = Date.now();

    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "restoreSnapshot" });
    emit("change", { type: "restoreSnapshot", customId: cl.id });
    return true;
  }

  function deleteSnapshot(customId, snapId) {
    const cl = getCustomLesson(customId);
    if (!cl || !snapId || !Array.isArray(cl.snapshots)) return false;

    const before = cl.snapshots.length;
    cl.snapshots = cl.snapshots.filter(function (s) {
      return s.id !== String(snapId);
    });
    if (cl.snapshots.length === before) return false;

    cl.updatedAt = Date.now();
    schedulePersist();
    emit("customChanged", { customId: cl.id, action: "deleteSnapshot" });
    emit("change", { type: "deleteSnapshot", customId: cl.id });
    return true;
  }

  // ==================== Strict Formatting, Copy & Export ====================
  function formatParagraphForCopy(paraId, mode) {
    if (!paraId) return "";
    const pid = String(paraId);
    const fmt = mode || state.prefs.copyFormat || "plain";
    const meta = getParagraphMeta(pid);
    const body = sanitizeExportText(getEffectiveParagraphText(pid));
    if (!body) return "";

    if (fmt === "citation") {
      if (!meta) return "«" + body + "»";
      const docTitle = sanitizeExportText(meta.docTitle);
      const secTitle = sanitizeExportText(meta.sectionTitle);
      const chTitle = sanitizeExportText(meta.chapterTitle);
      const refParts = [docTitle];
      if (chTitle && chTitle !== docTitle) refParts.push(chTitle);
      if (secTitle && secTitle !== chTitle && secTitle !== docTitle) {
        refParts.push(secTitle);
      }
      return "«" + body + "»\n— " + refParts.join(" ، ");
    }

    if (fmt === "markdown") {
      if (!meta) return body;
      const heading = sanitizeExportText(meta.sectionTitle || meta.docTitle);
      const docTitle = sanitizeExportText(meta.docTitle);
      const chTitle = sanitizeExportText(meta.chapterTitle);
      const sourceLine = chTitle ? docTitle + " — " + chTitle : docTitle;
      return "### " + heading + "\n\n" + body + "\n\n**المصدر**: " + sourceLine;
    }

    return body;
  }

  function exportDocText(docId, format) {
    const doc = getDoc(docId);
    if (!doc) return "";
    const isPlain = format === "plain" || format === "txt";
    const lines = [];

    const docTitle = sanitizeExportText(doc.title || "");
    lines.push(isPlain ? docTitle : "# " + docTitle);

    const insByAnchor = new Map();
    const docIns = state.docInsertions[doc.id] || [];
    for (let i = 0; i < docIns.length; i++) {
      const ins = docIns[i];
      const key = ins.afterParaId || "__top__";
      if (!insByAnchor.has(key)) insByAnchor.set(key, []);
      insByAnchor.get(key).push(ins);
    }

    function appendAnchoredInsertions(anchorKey) {
      const list = insByAnchor.get(anchorKey);
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const ins = list[i];
        const txt = sanitizeExportText(ins.text || "");
        if (!txt) continue;
        if (ins.type === "h3") {
          lines.push("", isPlain ? txt : "### " + txt);
        } else if (ins.type === "note") {
          lines.push(
            "",
            isPlain ? "ملاحظة تحريرية: " + txt : "**ملاحظة تحريرية**: " + txt
          );
        } else {
          lines.push("", txt);
        }
      }
    }

    appendAnchoredInsertions("__top__");

    if (doc.kind === "topic") {
      const chapters = Array.isArray(doc.chapters) ? doc.chapters : [];
      for (let c = 0; c < chapters.length; c++) {
        const ch = chapters[c];
        const chTitle = sanitizeExportText(ch.title || "");
        if (chTitle) {
          lines.push("", isPlain ? chTitle : "## " + chTitle);
        }
        const subtopics = Array.isArray(ch.subtopics) ? ch.subtopics : [];
        for (let s = 0; s < subtopics.length; s++) {
          const sub = subtopics[s];
          const subTitle = sanitizeExportText(sub.title || "");
          if (subTitle) {
            lines.push("", isPlain ? subTitle : "### " + subTitle);
          }
          const paras = Array.isArray(sub.paragraphs) ? sub.paragraphs : [];
          for (let p = 0; p < paras.length; p++) {
            const para = paras[p];
            if (!isParagraphQualityAllowed(para)) continue;
            const ann = state.annotations[para.id];
            if (!ann || !ann.hidden) {
              const pText = sanitizeExportText(getEffectiveParagraphText(para.id));
              if (pText) lines.push("", pText);
            }
            appendAnchoredInsertions(para.id);
          }
        }
      }
    } else {
      const sections = Array.isArray(doc.sections) ? doc.sections : [];
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const secTitle = sanitizeExportText(sec.title || "");
        if (secTitle) {
          lines.push("", isPlain ? secTitle : "## " + secTitle);
        }
        const paras = Array.isArray(sec.paragraphs) ? sec.paragraphs : [];
        for (let p = 0; p < paras.length; p++) {
          const para = paras[p];
          if (!isParagraphQualityAllowed(para)) continue;
          const ann = state.annotations[para.id];
          if (!ann || !ann.hidden) {
            const pText = sanitizeExportText(getEffectiveParagraphText(para.id));
            if (pText) lines.push("", pText);
          }
          appendAnchoredInsertions(para.id);
        }
      }
    }

    return sanitizeExportText(lines.join("\n")) + "\n";
  }

  function exportCustomText(customId, opts) {
    const cl = getCustomLesson(customId);
    if (!cl) return "";

    const options = opts || {};
    const format = options.format || "markdown";
    const isPlain = format === "plain" || format === "txt";
    const includeNotes =
      typeof options.includeNotes === "boolean"
        ? options.includeNotes
        : cl.includeNotesInMd !== false;
    const includeCitations = Boolean(options.includeCitations);
    const includeHeader = options.includeHeader !== false;

    const lines = [];

    if (includeHeader) {
      const title = sanitizeExportText(cl.title || "نسخة مخصصة بدون عنوان");
      const subtitle = sanitizeExportText(cl.subtitle || "");
      lines.push(isPlain ? title : "# " + title);
      if (subtitle) {
        lines.push("", subtitle);
      }
    }

    const blocks = Array.isArray(cl.blocks) ? cl.blocks : [];
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if (!blk || blk.hidden) continue;

      const btext = sanitizeExportText(blk.text || "");
      if (!btext) continue;

      const btype = blk.type || "p";
      if (btype === "note") {
        if (!includeNotes) continue;
        lines.push(
          "",
          isPlain ? "ملاحظة تحريرية: " + btext : "**ملاحظة تحريرية**: " + btext
        );
      } else if (btype === "h2") {
        lines.push("", isPlain ? btext : "## " + btext);
      } else if (btype === "h3") {
        lines.push("", isPlain ? btext : "### " + btext);
      } else if (btype === "quote") {
        const inner = btext.replace(/^[«"]+|[»"]+$/g, "").trim();
        let formatted = "«" + inner + "»";
        if (includeCitations && blk.sourceRef) {
          formatted += "\n— المصدر: " + formatCitationFromSourceRef(blk.sourceRef);
        }
        lines.push("", formatted);
      } else {
        let formatted = btext;
        if (includeCitations && blk.sourceRef) {
          formatted += "\n— المصدر: " + formatCitationFromSourceRef(blk.sourceRef);
        }
        lines.push("", formatted);
      }
    }

    return sanitizeExportText(lines.join("\n")) + "\n";
  }

  function exportWorkspaceJson() {
    const payload = serializeWorkspacePayload();
    payload.exportedAt = new Date().toISOString();
    return JSON.stringify(payload, null, 2);
  }

  function importWorkspaceJson(jsonStr) {
    try {
      let parsed = jsonStr;
      if (typeof jsonStr === "string") {
        if (!jsonStr.trim()) return false;
        parsed = JSON.parse(jsonStr);
      }
      if (!parsed || typeof parsed !== "object") return false;

      const targetState =
        parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;

      const hasKnownField =
        "prefs" in targetState ||
        "customLessons" in targetState ||
        "annotations" in targetState ||
        "readDocs" in targetState ||
        "docInsertions" in targetState;
      if (!hasKnownField) return false;

      Object.keys(undoStacks).forEach(function (k) {
        delete undoStacks[k];
      });
      Object.keys(redoStacks).forEach(function (k) {
        delete redoStacks[k];
      });

      const ok = hydrateState(targetState);
      if (!ok) return false;

      schedulePersist(true);
      emit("prefs", state.prefs);
      emit("selection", state.selection);
      emit("annotationChanged", { imported: true });
      emit("customChanged", { action: "import" });
      emit("change", { type: "importWorkspaceJson" });
      return true;
    } catch (_err) {
      return false;
    }
  }

  // ==================== Public Store Contract ====================
  const Store = {
    topics: Array.isArray(window.QABAS_TOPICS) ? window.QABAS_TOPICS : [],
    lessons: Array.isArray(window.QABAS_LESSONS) ? window.QABAS_LESSONS : [],
    docsById: docsById,
    paragraphsById: paragraphsById,
    state: state,
    syncStatus: "checking",
    undoStacks: undoStacks,
    redoStacks: redoStacks,

    init: init,
    on: on,
    off: off,
    emit: emit,

    getDoc: getDoc,
    getParagraphMeta: getParagraphMeta,
    isParagraphQualityAllowed: isParagraphQualityAllowed,
    isDocQualityAllowed: isDocQualityAllowed,
    getDocVisibleStats: getDocVisibleStats,
    search: search,

    updatePrefs: updatePrefs,
    toggleReadDoc: toggleReadDoc,
    getAnnotation: getAnnotation,
    getEffectiveParagraphText: getEffectiveParagraphText,
    saveParagraphAnnotation: saveParagraphAnnotation,
    revertParagraph: revertParagraph,
    revertAllInDoc: revertAllInDoc,
    getDocEditCount: getDocEditCount,
    splitDocParagraph: splitDocParagraph,
    addDocInsertion: addDocInsertion,
    updateDocInsertion: updateDocInsertion,
    deleteDocInsertion: deleteDocInsertion,
    getAllBookmarkedAndAnnotated: getAllBookmarkedAndAnnotated,

    toggleSelect: toggleSelect,
    selectRange: selectRange,
    clearSelection: clearSelection,
    isSelected: isSelected,

    getCustomLesson: getCustomLesson,
    createBlankCustomLesson: createBlankCustomLesson,
    forkDocToCustom: forkDocToCustom,
    createCustomFromSelection: createCustomFromSelection,
    appendParagraphToCustom: appendParagraphToCustom,
    appendSectionToCustom: appendSectionToCustom,
    appendSelectionToCustom: appendSelectionToCustom,
    duplicateCustomLesson: duplicateCustomLesson,
    deleteCustomLesson: deleteCustomLesson,
    updateCustomMeta: updateCustomMeta,

    pushUndo: pushUndo,
    undoCustom: undoCustom,
    redoCustom: redoCustom,
    canUndo: canUndo,
    canRedo: canRedo,

    updateCustomBlocks: updateCustomBlocks,
    replaceCustomFromMarkdown: replaceCustomFromMarkdown,

    saveSnapshot: saveSnapshot,
    restoreSnapshot: restoreSnapshot,
    deleteSnapshot: deleteSnapshot,

    formatParagraphForCopy: formatParagraphForCopy,
    exportDocText: exportDocText,
    exportCustomText: exportCustomText,
    exportWorkspaceJson: exportWorkspaceJson,
    importWorkspaceJson: importWorkspaceJson,
    forceSync: flushPersist,
  };

  window.QabasStore = Store;
})();

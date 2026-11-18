(function () {
  "use strict";

  const BLOCK_TYPES = [
    { value: "p", label: "فقرة متنية" },
    { value: "h2", label: "عنوان باب رئيسي" },
    { value: "h3", label: "عنوان مبحث فرعي" },
    { value: "quote", label: "شاهد مقتبس" },
    { value: "note", label: "ملاحظة إلقاء / إنتاج" },
  ];

  const BLOCK_PLACEHOLDERS = {
    p: "اكتب نص الفقرة المتنية أو صياغتك الخاصة هنا...",
    h2: "عنوان الباب الرئيسي...",
    h3: "عنوان المبحث أو المحور الفرعي...",
    quote: "نص الآية أو الحديث أو الشاهد المقتبس...",
    note: "ملاحظة إلقاء أو توجيه إنتاجي (مثال: وقفة تأمل، خفض الصوت، سؤال تفاعلي)...",
  };

  const state = {
    containerEl: null,
    initialized: false,
    storeBound: false,
    activeCustomId: null,
    editorMode: "blocks", // 'blocks' | 'raw' | 'preview'
    rawDraftText: "",
    rawDirty: false,
    rawForCustomId: null,
    openDiffIds: new Set(),
    pendingDeleteId: null,
    pendingDeleteTimer: null,
    isInlineTyping: false,
    suppressStoreEcho: false,
    typingSession: {
      targetKey: null,
      lastAt: 0,
    },
    drag: {
      blockId: null,
      overBlockId: null,
      placeAfter: true,
    },
  };

  // ==================== Safe Helpers & Fallbacks ====================

  function toEasternDigits(str) {
    if (window.QabasUtils && typeof window.QabasUtils.toEasternDigits === "function") {
      return window.QabasUtils.toEasternDigits(String(str == null ? "" : str));
    }
    return String(str == null ? "" : str)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  }

  function formatNum(n) {
    if (window.QabasUtils && typeof window.QabasUtils.formatNum === "function") {
      return toEasternDigits(window.QabasUtils.formatNum(n));
    }
    return Number(n || 0).toLocaleString("en-US");
  }

  function escapeHtml(str) {
    if (window.QabasUtils && typeof window.QabasUtils.escapeHtml === "function") {
      return window.QabasUtils.escapeHtml(String(str == null ? "" : str));
    }
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function countWords(str) {
    if (window.QabasUtils && typeof window.QabasUtils.countWords === "function") {
      return window.QabasUtils.countWords(String(str || ""));
    }
    const trimmed = String(str || "").trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function formatDuration(words, wpm) {
    const rate = Number(wpm) || 130;
    if (window.QabasUtils && typeof window.QabasUtils.formatDuration === "function") {
      return toEasternDigits(window.QabasUtils.formatDuration(words, rate));
    }
    const count = Number(words) || 0;
    if (count <= 0) return "0 د";
    const mins = Math.round(count / rate);
    if (mins < 1) return "أقل من دقيقة";
    if (mins < 60) return `${mins} د`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} س ${rem} د` : `${hrs} س`;
  }

  function uid(prefix = "blk") {
    if (window.QabasUtils && typeof window.QabasUtils.uid === "function") {
      return window.QabasUtils.uid(prefix);
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function cleanText(str, opts = {}) {
    let out = String(str == null ? "" : str);
    if (window.QabasUtils && typeof window.QabasUtils.cleanTextRules === "function") {
      out = window.QabasUtils.cleanTextRules(out, opts);
    } else {
      out = out.normalize("NFC");
      out = toEasternDigits(out);
      out = out.replace(/[\u200f\u200e\u061c\ufeff]/g, "");
      if (opts.stripTashkeel) {
        out = out.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
      }
      if (opts.escapeAngles) {
        out = out.replace(/</g, "«").replace(/>/g, "»");
      }
      out = out
        .replace(/[ \t]+/g, " ")
        .replace(/\s+([،؛؟.:!])/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    return out;
  }

  function stripTashkeelPreservingLines(str) {
    const lines = String(str == null ? "" : str)
      .normalize("NFC")
      .replace(/[\u200f\u200e\u061c\ufeff]/g, "")
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .split("\n")
      .map((ln) => ln.replace(/[ \t]{2,}/g, " ").trim());
    return toEasternDigits(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim());
  }

  function normalizeSpacingAndDigits(str) {
    let out = cleanText(str, { stripTashkeel: false, escapeAngles: true });
    out = out
      .normalize("NFC")
      .replace(/[\u200f\u200e\u061c\ufeff]/g, "")
      .replace(/</g, "«")
      .replace(/>/g, "»");
    out = toEasternDigits(out);
    out = out
      .split("\n")
      .map((ln) =>
        ln
          .replace(/[ \t]+/g, " ")
          .replace(/\s+([،؛؟.!:])/g, "$1")
          .replace(/([،؛؟])(?=[^\s»)"'\n])/g, "$1 ")
          .trim()
      )
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return out;
  }

  function computeDiffHtml(originalText, currentText) {
    if (window.QabasUtils && typeof window.QabasUtils.computeWordDiffHtml === "function") {
      return window.QabasUtils.computeWordDiffHtml(originalText || "", currentText || "");
    }
    return `<del class="diff-del">${escapeHtml(originalText || "")}</del> <ins class="diff-ins">${escapeHtml(currentText || "")}</ins>`;
  }

  function notify(msg, type = "success") {
    if (window.QabasApp && typeof window.QabasApp.toast === "function") {
      window.QabasApp.toast(toEasternDigits(msg), type);
    }
  }

  // ==================== Zero-Specificity Fallback Layout CSS ====================

  function injectFallbackStyles() {
    if (document.getElementById("qabas-studio-fallback-css")) return;
    const style = document.createElement("style");
    style.id = "qabas-studio-fallback-css";
    style.textContent = `
      :where(.studio-shell-inner) {
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
      }
      :where(.studio-empty-card) {
        border: 1px dashed var(--border-strong, var(--border, #2F3336));
        background: var(--surface-1, var(--surface, #141414));
        border-radius: 8px;
        padding: 36px 24px;
        text-align: center;
        max-width: 720px;
        margin: 16px auto;
      }
      :where(.studio-empty-kicker) {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        color: var(--accent, #1D9BF0);
        border: 1px solid var(--border, #2F3336);
        border-radius: 9999px;
        padding: 3px 12px;
        margin-bottom: 12px;
      }
      :where(.studio-empty-title) {
        font-size: 21px;
        font-weight: 700;
        margin: 0 0 10px;
        color: var(--text, #E7E9EA);
      }
      :where(.studio-empty-desc) {
        font-size: 14px;
        line-height: 1.8;
        color: var(--text-muted, var(--muted, #8B98A5));
        margin: 0 auto 22px;
        max-width: 580px;
      }
      :where(.studio-empty-actions) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
      }
      :where(.studio-header) {
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid var(--border, #2F3336);
        background: var(--surface, #141414);
        border-radius: 8px;
        padding: 14px 16px;
      }
      :where(.studio-selector-bar) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border, #2F3336);
      }
      :where(.studio-selector-group),
      :where(.studio-selector-actions) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      :where(.studio-lesson-select) {
        min-width: 220px;
        max-width: 100%;
        padding: 6px 12px;
        font-size: 13px;
        font-family: inherit;
        font-weight: 600;
        color: var(--text, #E7E9EA);
        background: var(--surface-2, #191919);
        border: 1px solid var(--border, #2F3336);
        border-radius: 8px;
        outline: none;
      }
      :where(.studio-meta-inputs) {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      :where(.studio-origin-row) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted, #8B98A5);
      }
      :where(.studio-title-input) {
        width: 100%;
        font-family: inherit;
        font-size: 21px;
        font-weight: 700;
        color: var(--text, #E7E9EA);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 6px 8px;
        outline: none;
      }
      :where(.studio-title-input:focus) {
        border-color: var(--accent, #1D9BF0);
        background: var(--surface-2, #191919);
      }
      :where(.studio-subtitle-input) {
        width: 100%;
        font-family: inherit;
        font-size: 14px;
        color: var(--muted, #8B98A5);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 5px 8px;
        outline: none;
      }
      :where(.studio-subtitle-input:focus) {
        color: var(--text, #E7E9EA);
        border-color: var(--border, #2F3336);
        background: var(--surface-2, #191919);
      }
      :where(.studio-metrics-bar) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--border, #2F3336);
      }
      :where(.studio-bar-row) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      :where(.studio-stats-cluster),
      :where(.studio-tools-cluster),
      :where(.studio-export-cluster) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      :where(.studio-mode-switcher) {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 3px;
        border: 1px solid var(--border, #2F3336);
        border-radius: 9999px;
        background: var(--surface-2, #191919);
      }
      :where(.studio-notes-toggle) {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted, #8B98A5);
        padding: 4px 10px;
        border: 1px solid var(--border, #2F3336);
        border-radius: 9999px;
        cursor: pointer;
        user-select: none;
      }
      :where(.studio-blocks-list) {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      :where(.studio-block) {
        display: flex;
        align-items: stretch;
        gap: 10px;
        border: 1px solid var(--border, #2F3336);
        background: var(--surface, #141414);
        border-radius: 8px;
        padding: 10px 12px;
        transition: border-color 0.14s ease, opacity 0.14s ease;
      }
      :where(.studio-block.type-h2) {
        border-right: 3px solid var(--accent, #1D9BF0);
      }
      :where(.studio-block.type-h3) {
        border-right: 3px solid var(--emerald, #00BA7C);
      }
      :where(.studio-block.type-quote) {
        border-right: 3px solid #2DD4BF;
      }
      :where(.studio-block.type-note) {
        border-right: 3px solid var(--amber, #F59E0B);
      }
      :where(.studio-block.is-muted) {
        opacity: 0.52;
      }
      :where(.studio-block.is-dragging) {
        opacity: 0.4;
        border-style: dashed;
      }
      :where(.studio-block.drag-over) {
        border-color: var(--accent, #1D9BF0);
      }
      :where(.block-gutter) {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 30px;
        padding-top: 2px;
      }
      :where(.drag-handle) {
        cursor: grab;
        color: var(--muted, #8B98A5);
        font-size: 14px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 6px;
        user-select: none;
      }
      :where(.block-index-badge) {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted, #8B98A5);
      }
      :where(.move-btn) {
        background: transparent;
        border: 1px solid var(--border, #2F3336);
        color: var(--muted, #8B98A5);
        border-radius: 6px;
        font-size: 12px;
        width: 24px;
        height: 22px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
      }
      :where(.move-btn:disabled) {
        opacity: 0.32;
        cursor: default;
      }
      :where(.block-main) {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      :where(.block-top-bar) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      :where(.block-meta-side),
      :where(.block-tools-side) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
      }
      :where(.type-select) {
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--text, #E7E9EA);
        background: var(--surface-2, #191919);
        border: 1px solid var(--border, #2F3336);
        border-radius: 9999px;
        padding: 3px 10px;
        outline: none;
        cursor: pointer;
      }
      :where(.source-ref-chip) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: inherit;
        font-size: 12px;
        color: var(--accent, #1D9BF0);
        background: transparent;
        border: 1px solid var(--border, #2F3336);
        border-radius: 9999px;
        padding: 2px 9px;
        cursor: pointer;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      :where(.block-word-chip) {
        font-size: 12px;
        color: var(--muted, #8B98A5);
        padding: 2px 6px;
      }
      :where(.block-editor-area) {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      :where(.block-textarea) {
        width: 100%;
        resize: none;
        overflow: hidden;
        font-family: inherit;
        font-size: var(--reader-font-size, 19px);
        line-height: var(--reader-line-height, 1.92);
        color: var(--text, #E7E9EA);
        background: var(--surface-2, #191919);
        border: 1px solid var(--border, #2F3336);
        border-radius: 8px;
        padding: 10px 12px;
        outline: none;
      }
      :where(.studio-block.type-h2 .block-textarea) {
        font-size: calc(var(--reader-font-size, 19px) * 1.16);
        font-weight: 700;
      }
      :where(.studio-block.type-h3 .block-textarea) {
        font-size: calc(var(--reader-font-size, 19px) * 1.05);
        font-weight: 700;
      }
      :where(.studio-block.type-note .block-textarea) {
        font-size: 14px;
        line-height: 1.75;
      }
      :where(.block-textarea:focus) {
        border-color: var(--accent, #1D9BF0);
      }
      :where(.studio-add-bottom-bar) {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px;
        border: 1px dashed var(--border, #2F3336);
        border-radius: 8px;
      }
      :where(.studio-raw-editor) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        border: 1px solid var(--border, #2F3336);
        background: var(--surface, #141414);
        border-radius: 8px;
        padding: 14px;
      }
      :where(.raw-markdown-textarea) {
        width: 100%;
        min-height: 440px;
        resize: vertical;
        font-family: inherit;
        font-size: var(--reader-font-size, 18px);
        line-height: var(--reader-line-height, 1.9);
        color: var(--text, #E7E9EA);
        background: var(--surface-2, #191919);
        border: 1px solid var(--border, #2F3336);
        border-radius: 8px;
        padding: 14px;
        outline: none;
      }
      :where(.raw-markdown-textarea:focus) {
        border-color: var(--accent, #1D9BF0);
      }
      :where(.studio-preview-pane) {
        display: flex;
        flex-direction: column;
        gap: 14px;
        border: 1px solid var(--border, #2F3336);
        background: var(--surface, #141414);
        border-radius: 8px;
        padding: 22px 24px;
      }
      :where(.studio-preview-item) {
        position: relative;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid transparent;
      }
      :where(.studio-preview-item:hover) {
        border-color: var(--border, #2F3336);
        background: var(--surface-2, #191919);
      }
      :where(.studio-preview-item-bar) {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        margin-bottom: 4px;
      }
      :where(.studio-preview-h2) {
        font-size: calc(var(--reader-font-size, 19px) * 1.28);
        font-weight: 700;
        color: var(--accent, #1D9BF0);
        margin: 8px 0 4px;
      }
      :where(.studio-preview-h3) {
        font-size: calc(var(--reader-font-size, 19px) * 1.12);
        font-weight: 700;
        color: var(--emerald, #00BA7C);
        margin: 6px 0 2px;
      }
      :where(.studio-preview-quote) {
        border-right: 3px solid #2DD4BF;
        padding-right: 14px;
        font-size: var(--reader-font-size, 19px);
        line-height: var(--reader-line-height, 1.92);
      }
      :where(.studio-preview-note) {
        border: 1px dashed var(--amber, #F59E0B);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
        color: var(--amber, #F59E0B);
      }
    `;
    document.head.appendChild(style);
  }

  // ==================== Store Access & Calculations ====================

  function getStore() {
    return window.QabasStore || null;
  }

  function getCustomLessons() {
    const S = getStore();
    return (S && S.state && Array.isArray(S.state.customLessons) && S.state.customLessons) || [];
  }

  function findCustomLesson(customId) {
    const list = getCustomLessons();
    if (!list.length) return null;
    if (customId) {
      const exact = list.find((c) => c.id === customId);
      if (exact) return exact;
    }
    const S = getStore();
    const prefId = S && S.state && S.state.prefs && S.state.prefs.activeCustomId;
    if (prefId) {
      const fromPref = list.find((c) => c.id === prefId);
      if (fromPref) return fromPref;
    }
    if (state.activeCustomId) {
      const fromLocal = list.find((c) => c.id === state.activeCustomId);
      if (fromLocal) return fromLocal;
    }
    return list[0] || null;
  }

  function computeLessonMetrics(lesson) {
    const S = getStore();
    const wpm = (S && S.state && S.state.prefs && Number(S.state.prefs.wpm)) || 130;
    if (!lesson || !Array.isArray(lesson.blocks)) {
      return {
        activeWords: 0,
        spokenWords: 0,
        activeBlocks: 0,
        hiddenBlocks: 0,
        totalBlocks: 0,
        durationText: formatDuration(0, wpm),
      };
    }

    let activeWords = 0;
    let spokenWords = 0;
    let activeBlocks = 0;
    let hiddenBlocks = 0;

    for (let i = 0; i < lesson.blocks.length; i++) {
      const b = lesson.blocks[i];
      if (!b) continue;
      if (b.hidden) {
        hiddenBlocks += 1;
        continue;
      }
      activeBlocks += 1;
      const wc = countWords(b.text || "");
      activeWords += wc;
      if (b.type !== "note") {
        spokenWords += wc;
      } else if (lesson.includeNotesInMd !== false) {
        // Production notes are counted in activeWords, while speaking time focuses on spoken text
      }
    }

    const effectiveSpoken = spokenWords > 0 ? spokenWords : activeWords;
    return {
      activeWords,
      spokenWords: effectiveSpoken,
      activeBlocks,
      hiddenBlocks,
      totalBlocks: lesson.blocks.length,
      durationText: formatDuration(effectiveSpoken, wpm),
    };
  }

  function resolveBlockSourceRef(block) {
    if (!block) return null;
    const S = getStore();
    const sourceRef = block.sourceRef;
    const directDocId = block.sourceDocId || null;
    const directParaId = block.sourceParaId || null;

    if (!sourceRef && !directDocId && !directParaId) return null;

    if (typeof sourceRef === "string" || (!sourceRef && (directDocId || directParaId))) {
      const raw = String(sourceRef || "").trim();

      if (directParaId && S && typeof S.getParagraphMeta === "function") {
        const pMeta = S.getParagraphMeta(directParaId);
        if (pMeta) {
          const disp = raw || `${truncateLabel(pMeta.docTitle || pMeta.docId, 24)} · ${truncateLabel(pMeta.sectionTitle || "", 22)}`;
          return {
            docId: directDocId || pMeta.docId,
            targetId: directParaId,
            label: toEasternDigits(truncateLabel(disp, 38)),
            tooltip: toEasternDigits(
              `${pMeta.docTitle || pMeta.docId}${pMeta.sectionTitle ? " — " + pMeta.sectionTitle : ""} (${directParaId})`
            ),
          };
        }
      }

      if (directDocId) {
        const dObj = S && typeof S.getDoc === "function" ? S.getDoc(directDocId) : null;
        const disp = raw || (dObj ? dObj.title : directDocId);
        return {
          docId: directDocId,
          targetId: directParaId || null,
          label: toEasternDigits(truncateLabel(disp, 38)),
          tooltip: toEasternDigits(raw || (dObj ? dObj.title : directDocId)),
        };
      }

      if (!raw) return null;

      if (S && typeof S.getParagraphMeta === "function") {
        const meta = S.getParagraphMeta(raw);
        if (meta) {
          const shortDoc = truncateLabel(meta.docTitle || meta.docId, 26);
          const shortSec = meta.sectionTitle ? truncateLabel(meta.sectionTitle, 24) : "";
          return {
            docId: meta.docId,
            targetId: meta.id,
            label: toEasternDigits(shortSec ? `${shortDoc} · ${shortSec}` : shortDoc),
            tooltip: toEasternDigits(
              `${meta.docTitle || meta.docId}${meta.sectionTitle ? " — " + meta.sectionTitle : ""} (${meta.id})`
            ),
          };
        }
      }

      const idMatch = raw.match(/^([TL]\d{2})(?:-[CS]\d{2}(?:-[SP]\d{2})*)?/);
      if (idMatch) {
        const docId = idMatch[1];
        const targetId = idMatch[0];
        const doc = S && typeof S.getDoc === "function" ? S.getDoc(docId) : null;
        const labelText =
          raw.length > targetId.length
            ? raw
            : doc
            ? `${truncateLabel(doc.title, 28)} (${targetId})`
            : targetId;
        return {
          docId,
          targetId: targetId !== docId ? targetId : null,
          label: toEasternDigits(labelText),
          tooltip: toEasternDigits(doc ? `${doc.title} — ${raw}` : raw),
        };
      }

      return {
        docId: null,
        targetId: null,
        label: toEasternDigits(truncateLabel(raw, 36)),
        tooltip: toEasternDigits(raw),
      };
    }

    if (typeof sourceRef === "object") {
      const paraId = directParaId || sourceRef.paraId || sourceRef.id || sourceRef.targetId || null;
      const sectionId = sourceRef.sectionId || sourceRef.chapterId || null;
      let docId = directDocId || sourceRef.docId || null;
      if (!docId && typeof paraId === "string" && paraId.includes("-")) {
        docId = paraId.split("-")[0];
      }
      if (!docId && typeof sectionId === "string" && sectionId.includes("-")) {
        docId = sectionId.split("-")[0];
      }

      const meta =
        paraId && S && typeof S.getParagraphMeta === "function"
          ? S.getParagraphMeta(paraId)
          : null;
      const doc =
        !meta && docId && S && typeof S.getDoc === "function" ? S.getDoc(docId) : null;

      const docTitle = sourceRef.docTitle || (meta && meta.docTitle) || (doc && doc.title) || docId || "";
      const secTitle = sourceRef.sectionTitle || (meta && meta.sectionTitle) || "";
      const explicitLabel = sourceRef.label || "";
      const builtLabel = explicitLabel
        ? truncateLabel(explicitLabel, 36)
        : secTitle
        ? `${truncateLabel(docTitle, 22)} · ${truncateLabel(secTitle, 22)}`
        : truncateLabel(docTitle || paraId || "مرجع المصدر", 34);

      return {
        docId: docId || (meta && meta.docId) || null,
        targetId: paraId || sectionId || null,
        label: toEasternDigits(builtLabel),
        tooltip: toEasternDigits(
          `${docTitle}${secTitle ? " — " + secTitle : ""}${paraId ? " (" + paraId + ")" : ""}`
        ),
      };
    }

    return null;
  }

  function truncateLabel(str, maxLen) {
    const clean = String(str || "").trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, Math.max(8, maxLen - 1)).trimEnd() + "…";
  }

  function isBlockModifiedFromOriginal(block) {
    if (!block || typeof block.originalText !== "string") return false;
    const orig = block.originalText.trim();
    if (!orig) return false;
    return orig !== String(block.text || "").trim();
  }

  // ==================== Export & Markdown Builders ====================

  function sanitizeExportOutput(rawText, isMarkdown) {
    let out = String(rawText == null ? "" : rawText).normalize("NFC");
    out = out.replace(/[\u200f\u200e\u061c\ufeff]/g, "");
    out = toEasternDigits(out);
    if (isMarkdown) {
      // Convert any leading markdown '>' blockquotes to Arabic guillemets «...»
      // so exported .md has zero '<' or '>' angle brackets per global rule.
      out = out
        .split("\n")
        .map((line) => {
          const bq = line.match(/^\s*>\s+(.*)$/);
          if (bq) {
            const inner = bq[1].replace(/^[«"]+|[»"]+$/g, "").trim();
            return inner ? `«${inner}»` : "";
          }
          return line;
        })
        .join("\n");
    }
    out = out.replace(/</g, "«").replace(/>/g, "»");
    out = out.replace(/\n{3,}/g, "\n\n").trim();
    return out ? out + "\n" : "";
  }

  function buildFallbackExport(lesson, format = "markdown", includeNotesOverride = null) {
    if (!lesson) return "";
    const includeNotes =
      typeof includeNotesOverride === "boolean"
        ? includeNotesOverride
        : lesson.includeNotesInMd !== false;
    const isMd = format === "markdown";
    const parts = [];
    const title = (lesson.title || "نسخة مخصصة").trim();
    const subtitle = (lesson.subtitle || "").trim();

    if (isMd) {
      parts.push(`# ${title}`);
      if (subtitle) parts.push(subtitle);
    } else {
      parts.push(title);
      if (subtitle) parts.push(subtitle);
    }

    (lesson.blocks || []).forEach((b) => {
      if (!b || b.hidden) return;
      const text = String(b.text || "").trim();
      if (!text) return;
      const bType = b.type || "p";
      if (bType === "note" && !includeNotes) return;

      if (isMd) {
        if (bType === "h2") {
          parts.push(`## ${text.replace(/^#+\s*/, "")}`);
        } else if (bType === "h3") {
          parts.push(`### ${text.replace(/^#+\s*/, "")}`);
        } else if (bType === "quote") {
          const stripped = text.replace(/^[«"]+|[»"]+$/g, "").trim();
          parts.push(`«${stripped}»`);
        } else if (bType === "note") {
          parts.push(`**ملاحظة تحريرية**: ${text}`);
        } else {
          parts.push(text);
        }
      } else {
        if (bType === "h2" || bType === "h3") {
          parts.push(text.replace(/^#+\s*/, ""));
        } else if (bType === "quote") {
          const stripped = text.replace(/^[«"]+|[»"]+$/g, "").trim();
          parts.push(`«${stripped}»`);
        } else if (bType === "note") {
          parts.push(`ملاحظة تحريرية: ${text}`);
        } else {
          parts.push(text);
        }
      }
    });

    return sanitizeExportOutput(parts.join("\n\n"), isMd);
  }

  function getExportContent(lesson, format = "markdown", forceIncludeNotes = null) {
    if (!lesson) return "";
    const S = getStore();
    const includeNotes =
      typeof forceIncludeNotes === "boolean"
        ? forceIncludeNotes
        : lesson.includeNotesInMd !== false;

    if (S && typeof S.exportCustomText === "function") {
      try {
        const exported = S.exportCustomText(lesson.id, {
          format: format,
          includeNotes: includeNotes,
          includeCitations: false,
        });
        if (typeof exported === "string" && exported.trim()) {
          return sanitizeExportOutput(exported, format === "markdown");
        }
      } catch (_err) {
        // Fallback to local builder
      }
    }
    return buildFallbackExport(lesson, format, includeNotes);
  }

  function buildRawMarkdownDraft(lesson) {
    if (!lesson) return "";
    const S = getStore();
    const cleanTitle = toEasternDigits(
      String(lesson.title || "نسخة مخصصة")
        .normalize("NFC")
        .replace(/[\u200f\u200e\u061c\ufeff]/g, "")
        .trim()
    );
    if (S && typeof S.exportCustomText === "function") {
      try {
        const bodyOnly = S.exportCustomText(lesson.id, {
          format: "markdown",
          includeNotes: true,
          includeCitations: false,
          includeHeader: false,
        });
        if (typeof bodyOnly === "string") {
          const normBody = toEasternDigits(
            bodyOnly.normalize("NFC").replace(/[\u200f\u200e\u061c\ufeff]/g, "").trim()
          );
          return normBody ? `# ${cleanTitle}\n\n${normBody}` : `# ${cleanTitle}\n\n`;
        }
      } catch (_err) {
        // Fallback below
      }
    }
    return buildFallbackExport({ ...lesson, subtitle: "" }, "markdown", true).trimEnd();
  }

  function applyRawMarkdownToStore(lessonId, rawMarkdown) {
    const S = getStore();
    if (!S || !lessonId) return false;
    const cleaned = toEasternDigits(
      String(rawMarkdown || "")
        .normalize("NFC")
        .replace(/[\u200f\u200e\u061c\ufeff]/g, "")
    );

    if (typeof S.replaceCustomFromMarkdown === "function") {
      S.replaceCustomFromMarkdown(lessonId, cleaned);
      state.rawDirty = false;
      return true;
    }

    // Defensive fallback parser if replaceCustomFromMarkdown is unavailable
    const lines = cleaned.split(/\r?\n/);
    let nextTitle = null;
    const parsedBlocks = [];
    let paraBuf = [];

    function flushBuf() {
      if (!paraBuf.length) return;
      const joined = paraBuf.join("\n").trim();
      paraBuf = [];
      if (!joined) return;
      const noteMatch = joined.match(/^\[(?:ملاحظة|ملاحظة إلقاء)\s*:?\s*([\s\S]*?)\]$/);
      if (noteMatch) {
        parsedBlocks.push({
          id: uid("blk"),
          type: "note",
          text: noteMatch[1].trim(),
          originalText: null,
          sourceRef: null,
          hidden: false,
        });
      } else if (
        (joined.startsWith("«") && joined.endsWith("»")) ||
        joined.startsWith("> ")
      ) {
        parsedBlocks.push({
          id: uid("blk"),
          type: "quote",
          text: joined.replace(/^>\s*/, "").replace(/^«|»$/g, "").trim(),
          originalText: null,
          sourceRef: null,
          hidden: false,
        });
      } else {
        parsedBlocks.push({
          id: uid("blk"),
          type: "p",
          text: joined,
          originalText: null,
          sourceRef: null,
          hidden: false,
        });
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.startsWith("# ") && nextTitle === null && parsedBlocks.length === 0 && paraBuf.length === 0) {
        nextTitle = ln.slice(2).trim();
      } else if (ln.startsWith("## ")) {
        flushBuf();
        parsedBlocks.push({
          id: uid("blk"),
          type: "h2",
          text: ln.slice(3).trim(),
          originalText: null,
          sourceRef: null,
          hidden: false,
        });
      } else if (ln.startsWith("### ")) {
        flushBuf();
        parsedBlocks.push({
          id: uid("blk"),
          type: "h3",
          text: ln.slice(4).trim(),
          originalText: null,
          sourceRef: null,
          hidden: false,
        });
      } else if (!ln.trim()) {
        flushBuf();
      } else {
        paraBuf.push(ln);
      }
    }
    flushBuf();

    if (nextTitle && typeof S.updateCustomMeta === "function") {
      S.updateCustomMeta(lessonId, { title: nextTitle });
    }
    if (typeof S.updateCustomBlocks === "function") {
      S.updateCustomBlocks(
        lessonId,
        (blocks) => {
          blocks.splice(0, blocks.length, ...parsedBlocks);
          return blocks;
        },
        true
      );
    }
    state.rawDirty = false;
    return true;
  }

  function makeSafeFilename(title, ext) {
    const base = toEasternDigits(String(title || "نسخة-مخصصة").normalize("NFC"))
      .replace(/[\u200f\u200e\u061c\ufeff]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    return `${base || "qabas-custom"}.${ext}`;
  }

  function buildPrintHtml(lesson) {
    const includeNotes = lesson.includeNotesInMd !== false;
    const chunks = [];
    (lesson.blocks || []).forEach((b) => {
      if (!b || b.hidden) return;
      const txt = toEasternDigits(String(b.text || "").trim());
      if (!txt) return;
      const safe = escapeHtml(txt).replace(/\n/g, "<br>");
      const bType = b.type || "p";
      if (bType === "note" && !includeNotes) return;

      if (bType === "h2") {
        chunks.push(`<h2>${safe}</h2>`);
      } else if (bType === "h3") {
        chunks.push(`<h3>${safe}</h3>`);
      } else if (bType === "quote") {
        chunks.push(`<blockquote>«${safe.replace(/^«|»$/g, "")}»</blockquote>`);
      } else if (bType === "note") {
        chunks.push(`<div class="print-note"><strong>ملاحظة إلقاء:</strong> ${safe}</div>`);
      } else {
        chunks.push(`<p>${safe}</p>`);
      }
    });
    return chunks.join("\n");
  }

  // ==================== Auto-Growing Textarea & Undo Batching ====================

  function autoGrowTextarea(ta) {
    if (!ta) return;
    ta.style.height = "auto";
    const minH = ta.classList.contains("raw-markdown-textarea") ? 420 : 54;
    const nextH = Math.max(minH, ta.scrollHeight + 2);
    ta.style.height = `${nextH}px`;
  }

  function resizeAllTextareas() {
    if (!state.containerEl) return;
    state.containerEl.querySelectorAll(".block-textarea").forEach((ta) => {
      autoGrowTextarea(ta);
    });
  }

  function recordTypingUndoIfNeeded(customId, targetKey) {
    const S = getStore();
    if (!S || !customId) return;
    const now = Date.now();
    const isNewBatch =
      state.typingSession.targetKey !== targetKey ||
      now - state.typingSession.lastAt > 1400;
    state.typingSession.targetKey = targetKey;
    state.typingSession.lastAt = now;
    if (isNewBatch && typeof S.pushUndo === "function") {
      S.pushUndo(customId);
    }
  }

  function resetTypingSession() {
    state.typingSession.targetKey = null;
    state.typingSession.lastAt = 0;
  }

  function withSilentStoreMutation(fn) {
    state.suppressStoreEcho = true;
    try {
      return fn();
    } finally {
      state.suppressStoreEcho = false;
    }
  }

  // ==================== Lightweight Header & Block Stats Refresh ====================

  function refreshHeaderStats() {
    if (!state.containerEl) return;
    const lesson = findCustomLesson(state.activeCustomId);
    if (!lesson) return;

    const S = getStore();
    const metrics = computeLessonMetrics(lesson);

    const wordsEl = state.containerEl.querySelector('[data-studio-stat="words"]');
    if (wordsEl) {
      wordsEl.textContent = `${formatNum(metrics.activeWords)} كلمة فعالة`;
    }

    const blocksEl = state.containerEl.querySelector('[data-studio-stat="blocks"]');
    if (blocksEl) {
      blocksEl.textContent =
        metrics.hiddenBlocks > 0
          ? `${formatNum(metrics.activeBlocks)} فقرة (${formatNum(metrics.hiddenBlocks)} مخفية)`
          : `${formatNum(metrics.activeBlocks)} فقرة`;
    }

    const durEl = state.containerEl.querySelector('[data-studio-stat="duration"]');
    if (durEl) {
      durEl.textContent = `مدة الإلقاء: ${metrics.durationText}`;
    }

    const undoBtn = state.containerEl.querySelector('[data-studio-action="undo"]');
    if (undoBtn && S && typeof S.canUndo === "function") {
      undoBtn.disabled = !S.canUndo(lesson.id);
    }

    const redoBtn = state.containerEl.querySelector('[data-studio-action="redo"]');
    if (redoBtn && S && typeof S.canRedo === "function") {
      redoBtn.disabled = !S.canRedo(lesson.id);
    }

    const splitBtn = state.containerEl.querySelector('[data-studio-action="toggle-split"]');
    if (splitBtn && S && S.state && S.state.prefs) {
      const isSplit = !!S.state.prefs.splitMode;
      splitBtn.classList.toggle("is-active", isSplit);
    }

    const snapsBtn = state.containerEl.querySelector('[data-studio-action="open-snapshots"]');
    if (snapsBtn) {
      const snapCount = Array.isArray(lesson.snapshots) ? lesson.snapshots.length : 0;
      snapsBtn.textContent =
        snapCount > 0
          ? `نقاط الاستعادة (${formatNum(snapCount)})`
          : "نقاط الاستعادة";
    }

    // Update current option label inside selector dropdown without resetting focus
    const selectEl = state.containerEl.querySelector('[data-studio-role="lesson-select"]');
    if (selectEl) {
      const opt = Array.from(selectEl.options).find((o) => o.value === lesson.id);
      if (opt) {
        const titleLabel = (lesson.title || "نسخة بدون عنوان").trim() || "نسخة بدون عنوان";
        opt.textContent = toEasternDigits(`${titleLabel} (${formatNum(metrics.activeWords)} كلمة)`);
      }
    }
  }

  function refreshSingleBlockInlineMeta(blockEl, block) {
    if (!blockEl || !block) return;
    const wcEl = blockEl.querySelector('[data-block-role="word-count"]');
    if (wcEl) {
      const wc = countWords(block.text || "");
      wcEl.textContent = block.hidden
        ? `${formatNum(wc)} كلمة · مخفية مؤقتاً`
        : `${formatNum(wc)} كلمة`;
    }

    const diffSlot = blockEl.querySelector('[data-block-role="orig-tools"]');
    const modified = isBlockModifiedFromOriginal(block);
    if (diffSlot) {
      if (modified) {
        const isOpen = state.openDiffIds.has(block.id);
        diffSlot.innerHTML = `
          <button type="button" class="act-btn act-btn-accent ${isOpen ? "is-active" : ""}" data-block-action="toggle-diff" title="عرض الفروق الكلمية مع النص الأصلي">مقارنة بالأصل</button>
          <button type="button" class="act-btn" data-block-action="restore-original" title="استعادة صياغة الفقرة الأصلية">استعادة الأصل</button>
        `;
      } else {
        diffSlot.innerHTML = "";
      }
    }

    const diffView = blockEl.querySelector('[data-block-role="diff-container"]');
    if (diffView) {
      if (modified && state.openDiffIds.has(block.id)) {
        diffView.hidden = false;
        diffView.innerHTML = `
          <div style="font-size:12px; color:var(--muted, #8B98A5); margin-bottom:4px;">مقارنة بالنص الأصلي (الأحمر محذوف · الأخضر مضاف):</div>
          <div>${computeDiffHtml(block.originalText || "", block.text || "")}</div>
        `;
      } else {
        diffView.hidden = true;
        diffView.innerHTML = "";
      }
    }
  }

  // ==================== HTML Renderers ====================

  function renderEmptyStateHtml() {
    return `
      <div class="studio-shell-inner">
        <div class="studio-empty studio-empty-card">
          <span class="studio-empty-kicker">استوديو النسخ المخصصة والإعداد الإلقائي</span>
          <h2 class="studio-empty-title">أنشئ نسختك الخاصة وعدّل الفقرات بحرية تامة</h2>
          <p class="studio-empty-desc">
            يتيح لك الاستوديو استنساخ أي كتاب موضوعي أو مجلس مستقل، أو التقاط فقرات مختارة جنباً إلى جنب، مع تقسيم الفقرات ودمجها وإعادة ترتيبها بالسحب والإفلات وحساب زمن الإلقاء وتصديرها بصيغ متعددة دون المساس بالنص الأصلي للموسوعة.
          </p>
          <div class="studio-empty-actions">
            <button type="button" class="btn btn-pill btn-primary" data-studio-action="create-blank">+ إنشاء نسخة مخصصة فارغة</button>
            <button type="button" class="btn btn-pill btn-emerald" data-studio-action="fork-doc">استنساخ درس كامل أو أبواب من المكتبة</button>
            <button type="button" class="btn btn-pill btn-ghost" data-studio-action="open-split-builder">فتح العرض المزدوج لالتقاط الفقرات جنباً إلى جنب</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHeaderHtml(lesson, allLessons) {
    const S = getStore();
    const isSplit = !!(S && S.state && S.state.prefs && S.state.prefs.splitMode);
    const canUndo = !!(S && typeof S.canUndo === "function" && S.canUndo(lesson.id));
    const canRedo = !!(S && typeof S.canRedo === "function" && S.canRedo(lesson.id));
    const metrics = computeLessonMetrics(lesson);
    const snapCount = Array.isArray(lesson.snapshots) ? lesson.snapshots.length : 0;
    const includeNotes = lesson.includeNotesInMd !== false;
    const isConfirmingDelete = state.pendingDeleteId === lesson.id;

    const optionsHtml = allLessons
      .map((cl) => {
        const m = cl.id === lesson.id ? metrics : computeLessonMetrics(cl);
        const label = (cl.title || "نسخة بدون عنوان").trim() || "نسخة بدون عنوان";
        const selected = cl.id === lesson.id ? "selected" : "";
        return `<option value="${escapeHtml(cl.id)}" ${selected}>${escapeHtml(
          toEasternDigits(`${label} (${formatNum(m.activeWords)} كلمة)`)
        )}</option>`;
      })
      .join("");

    let originHtml = "";
    if (lesson.sourceDocId || lesson.sourceTitle) {
      const srcDoc =
        lesson.sourceDocId && S && typeof S.getDoc === "function"
          ? S.getDoc(lesson.sourceDocId)
          : null;
      const srcLabel = lesson.sourceTitle || (srcDoc && srcDoc.title) || lesson.sourceDocId;
      originHtml = `
        <div class="studio-origin-row">
          <span>المصدر الأصلي:</span>
          ${
            lesson.sourceDocId
              ? `<button type="button" class="source-ref-chip" data-studio-action="jump-origin-doc" data-origin-doc="${escapeHtml(
                  lesson.sourceDocId
                )}" title="فتح الدرس الأصلي في القارئ">${escapeHtml(toEasternDigits(srcLabel))} ↗</button>`
              : `<span class="stat-chip">${escapeHtml(toEasternDigits(srcLabel))}</span>`
          }
          <span class="stat-chip">${formatNum(allLessons.length)} نسخ محفوظة</span>
        </div>
      `;
    }

    const deleteControlHtml = isConfirmingDelete
      ? `
        <button type="button" class="btn btn-pill btn-danger" data-studio-action="confirm-delete-custom" title="تأكيد حذف هذه النسخة المخصصة نهائياً">تأكيد الحذف النهائي</button>
        <button type="button" class="btn btn-pill btn-ghost" data-studio-action="cancel-delete-custom">تراجع</button>
      `
      : `<button type="button" class="btn btn-pill btn-danger" data-studio-action="delete-custom" title="حذف هذه النسخة المخصصة">حذف النسخة</button>`;

    return `
      <header class="studio-header">
        <div class="studio-selector-bar">
          <div class="studio-selector-group">
            <select class="studio-lesson-select" data-studio-role="lesson-select" aria-label="اختر النسخة المخصصة">
              ${optionsHtml}
            </select>
          </div>
          <div class="studio-selector-actions">
            <button type="button" class="btn btn-pill btn-primary" data-studio-action="create-blank">+ نسخة جديدة</button>
            <button type="button" class="btn btn-pill btn-ghost" data-studio-action="fork-doc">استنساخ من درس</button>
            <button type="button" class="btn btn-pill btn-ghost" data-studio-action="duplicate-custom" title="إنشاء فرع جديد مستقل من هذه النسخة">تكرار النسخة كفرع جديد</button>
            <button type="button" class="btn btn-pill btn-ghost" data-studio-action="open-snapshots">${
              snapCount > 0 ? `نقاط الاستعادة (${formatNum(snapCount)})` : "نقاط الاستعادة"
            }</button>
            ${deleteControlHtml}
          </div>
        </div>

        <div class="studio-meta-inputs">
          ${originHtml}
          <input
            type="text"
            class="studio-title-input"
            data-studio-role="title-input"
            value="${escapeHtml(toEasternDigits(lesson.title || ""))}"
            placeholder="عنوان النسخة المخصصة..."
            aria-label="عنوان النسخة المخصصة"
          />
          <input
            type="text"
            class="studio-subtitle-input"
            data-studio-role="subtitle-input"
            value="${escapeHtml(toEasternDigits(lesson.subtitle || ""))}"
            placeholder="الوصف أو الهدف الإلقائي والجمهور المستهدف (اختياري)..."
            aria-label="وصف النسخة المخصصة"
          />
        </div>

        <div class="studio-metrics-bar">
          <div class="studio-bar-row">
            <div class="studio-stats-cluster">
              <span class="stat-chip" data-studio-stat="words">${formatNum(metrics.activeWords)} كلمة فعالة</span>
              <span class="stat-chip" data-studio-stat="blocks">${
                metrics.hiddenBlocks > 0
                  ? `${formatNum(metrics.activeBlocks)} فقرة (${formatNum(metrics.hiddenBlocks)} مخفية)`
                  : `${formatNum(metrics.activeBlocks)} فقرة`
              }</span>
              <span class="stat-chip" data-studio-stat="duration">مدة الإلقاء: ${metrics.durationText}</span>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="undo" title="تراجع (Cmd/Ctrl+Z)" ${
                canUndo ? "" : "disabled"
              }>↶ تراجع</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="redo" title="إعادة (Cmd/Ctrl+Shift+Z)" ${
                canRedo ? "" : "disabled"
              }>↷ إعادة</button>
            </div>

            <div class="studio-tools-cluster">
              <div class="studio-mode-switcher" role="tablist" aria-label="وضع التحرير والمعاينة">
                <button type="button" class="btn btn-pill ${
                  state.editorMode === "blocks" ? "btn-primary is-active" : "btn-ghost"
                }" data-studio-mode="blocks">محرر الفقرات البنيوي</button>
                <button type="button" class="btn btn-pill ${
                  state.editorMode === "raw" ? "btn-primary is-active" : "btn-ghost"
                }" data-studio-mode="raw">محرر Markdown الشامل</button>
                <button type="button" class="btn btn-pill ${
                  state.editorMode === "preview" ? "btn-primary is-active" : "btn-ghost"
                }" data-studio-mode="preview">معاينة القراءة الصافية</button>
              </div>
            </div>
          </div>

          <div class="studio-bar-row">
            <div class="studio-tools-cluster">
              <button type="button" class="btn btn-pill btn-ghost ${
                isSplit ? "is-active" : ""
              }" data-studio-action="toggle-split" title="فتح المصدر والنسخة المخصصة جنباً إلى جنب">العرض المزدوج (المصدر + المحرر)</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="strip-tashkeel" title="إزالة الحركات التشكيلية من جميع كتل هذه النسخة مع إمكانية التراجع">إزالة التشكيل من النسخة</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="normalize-text" title="توحيد المسافات وعلامات الترقيم والأرقام المشرقية 0-9">ضبط المسافات والأرقام المشرقية</button>
            </div>

            <div class="studio-export-cluster">
              <label class="studio-notes-toggle" title="تضمين كتل ملاحظات الإلقاء والإنتاج عند النسخ والتصدير">
                <input type="checkbox" data-studio-role="include-notes-cb" ${includeNotes ? "checked" : ""} />
                <span>تضمين الملاحظات الإنتاجية</span>
              </label>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="copy-md">نسخ النسخة كاملة (Markdown)</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="copy-txt">نسخ نص صافٍ</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="download-md">تنزيل .md</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="download-txt">تنزيل .txt</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="print-pdf">طباعة / PDF</button>
              <button type="button" class="btn btn-pill btn-emerald" data-studio-action="teleprompter">وضع الإلقاء</button>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function renderSingleBlockHtml(block, index, totalBlocks) {
    const bType = block.type || "p";
    const isHidden = !!block.hidden;
    const isModified = isBlockModifiedFromOriginal(block);
    const isDiffOpen = isModified && state.openDiffIds.has(block.id);
    const refInfo = resolveBlockSourceRef(block);
    const words = countWords(block.text || "");
    const placeholder = BLOCK_PLACEHOLDERS[bType] || BLOCK_PLACEHOLDERS.p;

    const typeOptionsHtml = BLOCK_TYPES.map((opt) => {
      const sel = opt.value === bType ? "selected" : "";
      return `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    }).join("");

    let refChipHtml = "";
    if (refInfo) {
      if (refInfo.docId) {
        refChipHtml = `
          <button
            type="button"
            class="source-ref-chip"
            data-block-action="jump-source"
            data-ref-doc="${escapeHtml(refInfo.docId)}"
            data-ref-target="${escapeHtml(refInfo.targetId || "")}"
            title="${escapeHtml(refInfo.tooltip || "الانتقال إلى الفقرة الأصلية في القارئ")}"
          >
            <span>${escapeHtml(refInfo.label)}</span>
            <span aria-hidden="true">↗</span>
          </button>
        `;
      } else {
        refChipHtml = `<span class="source-ref-chip" title="${escapeHtml(refInfo.tooltip || "")}">${escapeHtml(refInfo.label)}</span>`;
      }
    }

    const origToolsHtml = isModified
      ? `
        <button type="button" class="act-btn act-btn-accent ${
          isDiffOpen ? "is-active" : ""
        }" data-block-action="toggle-diff" title="عرض الفروق الكلمية مع النص الأصلي">مقارنة بالأصل</button>
        <button type="button" class="act-btn" data-block-action="restore-original" title="استعادة صياغة الفقرة الأصلية">استعادة الأصل</button>
      `
      : "";

    const diffHtml = isDiffOpen
      ? `
        <div class="para-diff-view" data-block-role="diff-container">
          <div style="font-size:12px; color:var(--text-muted, var(--muted, #8B98A5)); margin-bottom:4px;">مقارنة بالنص الأصلي (الأحمر محذوف · الأخضر مضاف):</div>
          <div>${computeDiffHtml(block.originalText || "", block.text || "")}</div>
        </div>
      `
      : `<div class="para-diff-view" data-block-role="diff-container" hidden></div>`;

    return `
      <article
        class="studio-block type-${escapeHtml(bType)}${isHidden ? " is-muted" : ""}"
        data-block-id="${escapeHtml(block.id)}"
        data-block-index="${index}"
      >
        <div class="block-gutter">
          <span class="drag-handle" draggable="true" title="اسحب لإعادة ترتيب الفقرة" aria-label="مقبض السحب">⋮⋮</span>
          <span class="block-index-badge">${index + 1}</span>
          <button type="button" class="move-btn" data-block-action="move-up" title="تحريك للأعلى" ${
            index === 0 ? "disabled" : ""
          }>↑</button>
          <button type="button" class="move-btn" data-block-action="move-down" title="تحريك للأسفل" ${
            index === totalBlocks - 1 ? "disabled" : ""
          }>↓</button>
        </div>

        <div class="block-main">
          <div class="block-top-bar">
            <div class="block-meta-side">
              <select class="type-select" data-block-role="type-select" aria-label="نوع الكتلة">
                ${typeOptionsHtml}
              </select>
              ${refChipHtml}
              <span class="block-word-chip" data-block-role="word-count">${
                isHidden ? `${formatNum(words)} كلمة · مخفية مؤقتاً` : `${formatNum(words)} كلمة`
              }</span>
            </div>

            <div class="block-tools-side">
              <span data-block-role="orig-tools" style="display:inline-flex; gap:5px; flex-wrap:wrap;">${origToolsHtml}</span>
              <button type="button" class="act-btn" data-block-action="split" title="تقسيم الكتلة إلى كتلتين عند موضع المؤشر داخل النص">✂ تقسيم عند المؤشر</button>
              <button type="button" class="act-btn" data-block-action="merge-next" title="دمج هذه الكتلة مع الكتلة التي تليها" ${
                index >= totalBlocks - 1 ? "disabled" : ""
              }>⊕ دمج مع التالي</button>
              <button type="button" class="act-btn ${
                isHidden ? "act-btn-accent is-active" : ""
              }" data-block-action="toggle-hidden" title="إخفاء مؤقت من زمن الإلقاء والتصدير دون حذف الفقرة">${
                isHidden ? "إظهار الفقرة" : "إخفاء مؤقت"
              }</button>
              <button type="button" class="act-btn act-btn-emerald" data-block-action="insert-p-below" title="إدراج فقرة متنية جديدة أسفل هذه الكتلة">+ فقرة أسفله</button>
              <button type="button" class="act-btn" data-block-action="insert-h3-below" title="إدراج عنوان مبحث فرعي أسفل هذه الكتلة">+ عنوان أسفله</button>
              <button type="button" class="act-btn act-btn-danger" data-block-action="delete-block" title="حذف هذه الكتلة">× حذف</button>
            </div>
          </div>

          <div class="block-editor-area">
            <textarea
              class="block-textarea"
              data-block-role="textarea"
              rows="1"
              placeholder="${escapeHtml(placeholder)}"
            >${escapeHtml(block.text || "")}</textarea>
            ${diffHtml}
          </div>
        </div>
      </article>
    `;
  }

  function renderBlocksModeHtml(lesson) {
    const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];

    if (!blocks.length) {
      return `
        <div class="studio-blocks-list">
          <div class="studio-empty-card" style="margin: 8px 0;">
            <h3 style="margin: 0 0 8px; font-size: 17px;">هذه النسخة المخصصة فارغة حالياً</h3>
            <p style="margin: 0 0 16px; color: var(--muted, #8B98A5); font-size: 14px;">
              ابدأ بإضافة فقرة جديدة أو عنوان باب، أو افتح العرض المزدوج لالتقاط الفقرات والمباحث بنقرة واحدة من كتب الموسوعة ومجالسها.
            </p>
            <div class="studio-empty-actions">
              <button type="button" class="btn btn-pill btn-primary" data-studio-action="append-new-block" data-new-type="p">+ إضافة فقرة متنية</button>
              <button type="button" class="btn btn-pill btn-ghost" data-studio-action="append-new-block" data-new-type="h2">+ إضافة عنوان باب رئيسي</button>
              <button type="button" class="btn btn-pill btn-emerald" data-studio-action="open-split-builder">التقاط فقرات عبر العرض المزدوج</button>
            </div>
          </div>
        </div>
      `;
    }

    const cardsHtml = blocks
      .map((b, idx) => renderSingleBlockHtml(b, idx, blocks.length))
      .join("");

    return `
      <div class="studio-blocks-list" data-studio-role="blocks-list">
        ${cardsHtml}
        <div class="studio-add-bottom-bar">
          <button type="button" class="btn btn-pill btn-primary" data-studio-action="append-new-block" data-new-type="p">+ فقرة متنية في النهاية</button>
          <button type="button" class="btn btn-pill btn-ghost" data-studio-action="append-new-block" data-new-type="h2">+ عنوان باب رئيسي</button>
          <button type="button" class="btn btn-pill btn-ghost" data-studio-action="append-new-block" data-new-type="h3">+ عنوان مبحث فرعي</button>
          <button type="button" class="btn btn-pill btn-ghost" data-studio-action="append-new-block" data-new-type="quote">+ شاهد مقتبس</button>
          <button type="button" class="btn btn-pill btn-ghost" data-studio-action="append-new-block" data-new-type="note">+ ملاحظة إلقاء</button>
        </div>
      </div>
    `;
  }

  function renderRawModeHtml(lesson) {
    if (state.rawForCustomId !== lesson.id || (!state.rawDirty && !state.rawDraftText)) {
      state.rawDraftText = buildRawMarkdownDraft(lesson);
      state.rawForCustomId = lesson.id;
      state.rawDirty = false;
    }
    const rawWords = countWords(state.rawDraftText);

    return `
      <div class="studio-raw-editor">
        <div class="studio-bar-row">
          <div style="font-size: 13px; color: var(--muted, #8B98A5);">
            حرّر النص الكامل كملف Markdown واحد (<code>#</code> للعنوان، <code>##</code> للباب، <code>###</code> للمبحث، وسطر فارغ بين الفقرات).
          </div>
          <div class="studio-tools-cluster">
            <span class="stat-chip" data-studio-role="raw-word-chip">${formatNum(rawWords)} كلمة في المحرر</span>
            <span class="stat-chip" data-studio-role="raw-sync-status">${
              state.rawDirty ? "تعديلات جاهزة للمزامنة" : "متزامن مع الفقرات ✓"
            }</span>
            <button type="button" class="btn btn-pill btn-ghost" data-studio-action="reset-raw-md" title="إعادة تحميل النص من البطاقات الحالية">إعادة التوليد</button>
            <button type="button" class="btn btn-pill btn-primary" data-studio-action="apply-raw-md" title="تطبيق تعديلات Markdown على كتل النسخة (Cmd/Ctrl+Enter)">تطبيق ومزامنة فورية</button>
            <button type="button" class="btn btn-pill btn-emerald" data-studio-action="apply-raw-and-blocks">مزامنة والعودة للفقرات</button>
          </div>
        </div>
        <textarea
          class="raw-markdown-textarea"
          data-studio-role="raw-textarea"
          spellcheck="false"
          placeholder="# عنوان النسخة المخصصة&#10;&#10;## الباب الأول&#10;&#10;نص الفقرة الأولى..."
        >${escapeHtml(state.rawDraftText)}</textarea>
      </div>
    `;
  }

  function renderPreviewModeHtml(lesson) {
    const includeNotes = lesson.includeNotesInMd !== false;
    const visibleBlocks = (lesson.blocks || []).filter((b) => {
      if (!b || b.hidden) return false;
      if ((b.type || "p") === "note" && !includeNotes) return false;
      return String(b.text || "").trim().length > 0;
    });

    if (!visibleBlocks.length) {
      return `
        <div class="studio-preview-surface studio-preview-pane">
          <div style="text-align: center; color: var(--text-muted, var(--muted, #8B98A5)); padding: 28px 12px;">
            لا توجد فقرات مفعّلة للمعاينة حالياً (تحقق من عدم إخفاء جميع الفقرات مؤقتاً).
          </div>
        </div>
      `;
    }

    const bodyHtml = visibleBlocks
      .map((b) => {
        const bType = b.type || "p";
        const cleanTxt = toEasternDigits(String(b.text || "").trim());
        const safeHtml = escapeHtml(cleanTxt).replace(/\n/g, "<br>");

        let innerContent = "";
        if (bType === "h2") {
          innerContent = `<h2 class="studio-preview-h2">${safeHtml}</h2>`;
        } else if (bType === "h3") {
          innerContent = `<h3 class="studio-preview-h3">${safeHtml}</h3>`;
        } else if (bType === "quote") {
          innerContent = `<blockquote class="studio-preview-quote para-text">«${safeHtml.replace(
            /^«|»$/g,
            ""
          )}»</blockquote>`;
        } else if (bType === "note") {
          innerContent = `<div class="studio-preview-note"><strong>ملاحظة إلقاء / إنتاج:</strong> ${safeHtml}</div>`;
        } else {
          innerContent = `<div class="para-text">${safeHtml}</div>`;
        }

        return `
          <div class="studio-preview-item" data-preview-block-id="${escapeHtml(b.id)}">
            <div class="studio-preview-item-bar">
              <button type="button" class="act-btn" data-studio-action="preview-copy-block" data-target-block="${escapeHtml(
                b.id
              )}">نسخ الفقرة</button>
              <button type="button" class="act-btn" data-studio-action="preview-edit-block" data-target-block="${escapeHtml(
                b.id
              )}">تحرير في البطاقات</button>
            </div>
            ${innerContent}
          </div>
        `;
      })
      .join("");

    return `
      <div class="studio-preview-surface studio-preview-pane">
        <div style="border-bottom: 1px solid var(--border, #2F3336); padding-bottom: 14px; margin-bottom: 4px;">
          <h1 style="margin: 0 0 6px; font-size: 24px;">${escapeHtml(
            toEasternDigits(lesson.title || "نسخة مخصصة")
          )}</h1>
          ${
            lesson.subtitle
              ? `<p style="margin: 0; color: var(--text-muted, var(--muted, #8B98A5)); font-size: 14px;">${escapeHtml(
                  toEasternDigits(lesson.subtitle)
                )}</p>`
              : ""
          }
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  // ==================== Core Render Entry ====================

  function render(customId = null, focusOpts = null) {
    if (!state.containerEl) return;
    ensureStoreListeners();

    // Protect caret & undo buffer if an external listener triggers render() synchronously while typing
    if (state.isInlineTyping && (!customId || customId === state.activeCustomId)) {
      refreshHeaderStats();
      return;
    }

    const S = getStore();
    const allLessons = getCustomLessons();

    if (!allLessons.length) {
      state.activeCustomId = null;
      state.rawDraftText = "";
      state.rawDirty = false;
      state.containerEl.innerHTML = renderEmptyStateHtml();
      return;
    }

    const lesson = findCustomLesson(customId);
    if (!lesson) {
      state.containerEl.innerHTML = renderEmptyStateHtml();
      return;
    }

    const switchedLesson = state.activeCustomId !== lesson.id;
    state.activeCustomId = lesson.id;

    if (switchedLesson) {
      state.pendingDeleteId = null;
      resetTypingSession();
      if (state.editorMode === "raw") {
        state.rawDraftText = buildRawMarkdownDraft(lesson);
        state.rawForCustomId = lesson.id;
        state.rawDirty = false;
      }
    }

    // Keep prefs.activeCustomId aligned silently if unset or pointing to deleted lesson
    if (
      S &&
      S.state &&
      S.state.prefs &&
      S.state.prefs.activeCustomId !== lesson.id &&
      typeof S.updatePrefs === "function"
    ) {
      withSilentStoreMutation(() => {
        S.updatePrefs({ activeCustomId: lesson.id });
      });
    }

    const prevScrollTop = state.containerEl.scrollTop;

    let stageBodyHtml = "";
    if (state.editorMode === "raw") {
      stageBodyHtml = renderRawModeHtml(lesson);
    } else if (state.editorMode === "preview") {
      stageBodyHtml = renderPreviewModeHtml(lesson);
    } else {
      stageBodyHtml = renderBlocksModeHtml(lesson);
    }

    state.containerEl.innerHTML = `
      <div class="studio-shell-inner">
        ${renderHeaderHtml(lesson, allLessons)}
        ${stageBodyHtml}
      </div>
    `;

    if (state.editorMode === "blocks") {
      resizeAllTextareas();
    }

    if (!switchedLesson && prevScrollTop > 0) {
      state.containerEl.scrollTop = prevScrollTop;
    }

    if (focusOpts) {
      applyPostRenderFocus(focusOpts);
    }
  }

  function applyPostRenderFocus(focusOpts) {
    if (!state.containerEl || !focusOpts) return;
    requestAnimationFrame(() => {
      if (!state.containerEl) return;
      if (focusOpts.focusTitle) {
        const titleInp = state.containerEl.querySelector('[data-studio-role="title-input"]');
        if (titleInp) {
          titleInp.focus();
          titleInp.select();
        }
        return;
      }
      if (focusOpts.blockId) {
        const blockEl = state.containerEl.querySelector(
          `.studio-block[data-block-id="${CSS.escape(focusOpts.blockId)}"]`
        );
        if (!blockEl) return;
        const ta = blockEl.querySelector(".block-textarea");
        if (ta) {
          ta.focus();
          const pos =
            typeof focusOpts.caretPos === "number"
              ? Math.max(0, Math.min(ta.value.length, focusOpts.caretPos))
              : ta.value.length;
          ta.setSelectionRange(pos, pos);
          ta._lastCaretStart = pos;
          blockEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });
  }

  // ==================== Block & Studio Operations ====================

  function createNewBlankLesson() {
    const S = getStore();
    if (!S || typeof S.createBlankCustomLesson !== "function") return;
    flushPendingRawIfNeeded();

    const res = withSilentStoreMutation(() =>
      S.createBlankCustomLesson("نسخة مخصصة جديدة", "")
    );
    const createdId =
      typeof res === "string"
        ? res
        : (res && res.id) || (S.state && S.state.prefs && S.state.prefs.activeCustomId);

    const createdLesson = findCustomLesson(createdId);
    if (
      createdLesson &&
      (!Array.isArray(createdLesson.blocks) || createdLesson.blocks.length === 0) &&
      typeof S.updateCustomBlocks === "function"
    ) {
      withSilentStoreMutation(() => {
        S.updateCustomBlocks(
          createdLesson.id,
          (blocks) => {
            blocks.push({
              id: uid("blk"),
              type: "p",
              text: "",
              originalText: null,
              sourceRef: null,
              hidden: false,
            });
            return blocks;
          },
          false
        );
      });
    }

    state.editorMode = "blocks";
    if (window.QabasApp && typeof window.QabasApp.openStudio === "function") {
      window.QabasApp.openStudio(createdLesson ? createdLesson.id : createdId);
    } else {
      render(createdLesson ? createdLesson.id : createdId);
    }
    applyPostRenderFocus({ focusTitle: true });
    notify("أُنشئت نسخة مخصصة جديدة جاهزة للتحرير", "success");
  }

  function flushPendingRawIfNeeded() {
    if (
      state.editorMode === "raw" &&
      state.rawDirty &&
      state.rawForCustomId &&
      findCustomLesson(state.rawForCustomId)
    ) {
      withSilentStoreMutation(() => {
        applyRawMarkdownToStore(state.rawForCustomId, state.rawDraftText);
      });
      notify("تمت مزامنة تعديلات Markdown تلقائياً", "info");
    }
  }

  function switchEditorMode(nextMode) {
    if (!nextMode || nextMode === state.editorMode) return;
    const lesson = findCustomLesson(state.activeCustomId);
    if (!lesson) return;

    if (state.editorMode === "raw" && state.rawDirty) {
      withSilentStoreMutation(() => {
        applyRawMarkdownToStore(lesson.id, state.rawDraftText);
      });
      notify("تمت مزامنة تعديلات Markdown مع الفقرات", "success");
    }

    state.editorMode = nextMode;
    if (nextMode === "raw") {
      state.rawDraftText = buildRawMarkdownDraft(lesson);
      state.rawForCustomId = lesson.id;
      state.rawDirty = false;
    }
    render(lesson.id);
  }

  function handleUndo() {
    const S = getStore();
    const lesson = findCustomLesson(state.activeCustomId);
    if (!S || !lesson || typeof S.undoCustom !== "function") return;
    if (typeof S.canUndo === "function" && !S.canUndo(lesson.id)) return;

    resetTypingSession();
    withSilentStoreMutation(() => {
      S.undoCustom(lesson.id);
    });
    if (state.editorMode === "raw") {
      const refreshed = findCustomLesson(lesson.id);
      state.rawDraftText = buildRawMarkdownDraft(refreshed);
      state.rawDirty = false;
    }
    render(lesson.id);
    notify("تم التراجع عن آخر خطوة", "info");
  }

  function handleRedo() {
    const S = getStore();
    const lesson = findCustomLesson(state.activeCustomId);
    if (!S || !lesson || typeof S.redoCustom !== "function") return;
    if (typeof S.canRedo === "function" && !S.canRedo(lesson.id)) return;

    resetTypingSession();
    withSilentStoreMutation(() => {
      S.redoCustom(lesson.id);
    });
    if (state.editorMode === "raw") {
      const refreshed = findCustomLesson(lesson.id);
      state.rawDraftText = buildRawMarkdownDraft(refreshed);
      state.rawDirty = false;
    }
    render(lesson.id);
    notify("تمت إعادة الخطوة", "info");
  }

  function sanitizeAllLessonBlocks(mode) {
    const S = getStore();
    const lesson = findCustomLesson(state.activeCustomId);
    if (!S || !lesson) return;

    if (state.editorMode === "raw" && state.rawDirty) {
      withSilentStoreMutation(() => {
        applyRawMarkdownToStore(lesson.id, state.rawDraftText);
      });
    }

    const transformFn =
      mode === "strip-tashkeel" ? stripTashkeelPreservingLines : normalizeSpacingAndDigits;

    resetTypingSession();
    withSilentStoreMutation(() => {
      if (typeof S.updateCustomBlocks === "function") {
        S.updateCustomBlocks(
          lesson.id,
          (blocks) => {
            blocks.forEach((b) => {
              if (b && typeof b.text === "string") {
                b.text = transformFn(b.text);
              }
            });
            return blocks;
          },
          true
        );
      }
      if (typeof S.updateCustomMeta === "function") {
        S.updateCustomMeta(lesson.id, {
          title: lesson.title ? transformFn(lesson.title) : lesson.title,
          subtitle: lesson.subtitle ? transformFn(lesson.subtitle) : lesson.subtitle,
        });
      }
    });

    const updated = findCustomLesson(lesson.id);
    if (state.editorMode === "raw" && updated) {
      state.rawDraftText = buildRawMarkdownDraft(updated);
      state.rawDirty = false;
    }

    render(lesson.id);
    notify(
      mode === "strip-tashkeel"
        ? "تمت إزالة التشكيل من جميع نصوص النسخة (يمكنك التراجع بـ ↶)"
        : "تم ضبط المسافات وعلامات الترقيم وتوحيد الأرقام المشرقية 0-9",
      "success"
    );
  }

  function splitBlockAtCursor(blockEl, lesson) {
    const S = getStore();
    if (!S || !blockEl || !lesson) return;
    const blockId = blockEl.getAttribute("data-block-id");
    const ta = blockEl.querySelector(".block-textarea");
    if (!ta || !blockId) return;

    const fullText = ta.value || "";
    const caret =
      typeof ta.selectionStart === "number" && document.activeElement === ta
        ? ta.selectionStart
        : typeof ta._lastCaretStart === "number"
        ? ta._lastCaretStart
        : -1;

    if (caret <= 0 || caret >= fullText.length) {
      ta.focus();
      notify("ضع المؤشر داخل النص في الموضع المراد تقسيم الفقرة عنده", "info");
      return;
    }

    const beforePart = fullText.slice(0, caret).trimEnd();
    const afterPart = fullText.slice(caret).trimStart();

    if (!beforePart || !afterPart) {
      ta.focus();
      notify("لا يمكن التقسيم عند طرف فارغ؛ ضع المؤشر بين جملتين أو كلمتين", "info");
      return;
    }

    const newBlockId = uid("blk");
    resetTypingSession();

    withSilentStoreMutation(() => {
      S.updateCustomBlocks(
        lesson.id,
        (blocks) => {
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx === -1) return blocks;
          const cur = blocks[idx];
          const secondType =
            cur.type === "h2" || cur.type === "h3" ? "p" : cur.type || "p";
          cur.text = beforePart;
          blocks.splice(idx + 1, 0, {
            id: newBlockId,
            type: secondType,
            text: afterPart,
            originalText: afterPart,
            sourceRef: cur.sourceRef || "",
            sourceParaId: cur.sourceParaId || null,
            sourceDocId: cur.sourceDocId || null,
            hidden: !!cur.hidden,
          });
          return blocks;
        },
        true
      );
    });

    render(lesson.id, { blockId: newBlockId, caretPos: 0 });
    notify("تم تقسيم الفقرة عند موضع المؤشر", "success");
  }

  function mergeBlockWithNext(blockId, lesson) {
    const S = getStore();
    if (!S || !lesson || !blockId) return;
    const idx = (lesson.blocks || []).findIndex((b) => b.id === blockId);
    if (idx === -1 || idx >= lesson.blocks.length - 1) return;

    const firstLen = String(lesson.blocks[idx].text || "").trimEnd().length;
    resetTypingSession();

    withSilentStoreMutation(() => {
      S.updateCustomBlocks(
        lesson.id,
        (blocks) => {
          const i = blocks.findIndex((b) => b.id === blockId);
          if (i === -1 || i >= blocks.length - 1) return blocks;
          const current = blocks[i];
          const next = blocks[i + 1];
          const t1 = String(current.text || "").trim();
          const t2 = String(next.text || "").trim();
          current.text = t1 && t2 ? `${t1} ${t2}` : t1 || t2;
          if (!current.sourceRef && next.sourceRef) {
            current.sourceRef = next.sourceRef;
          }
          if (!current.sourceParaId && next.sourceParaId) {
            current.sourceParaId = next.sourceParaId;
          }
          if (!current.sourceDocId && next.sourceDocId) {
            current.sourceDocId = next.sourceDocId;
          }
          blocks.splice(i + 1, 1);
          return blocks;
        },
        true
      );
    });

    render(lesson.id, { blockId, caretPos: firstLen > 0 ? firstLen + 1 : 0 });
    notify("تم دمج الفقرة مع الفقرة التالية", "success");
  }

  function moveBlockByDelta(blockId, delta, lesson) {
    const S = getStore();
    if (!S || !lesson || !blockId) return;
    resetTypingSession();

    let moved = false;
    withSilentStoreMutation(() => {
      S.updateCustomBlocks(
        lesson.id,
        (blocks) => {
          const idx = blocks.findIndex((b) => b.id === blockId);
          const targetIdx = idx + delta;
          if (idx === -1 || targetIdx < 0 || targetIdx >= blocks.length) return blocks;
          const [item] = blocks.splice(idx, 1);
          blocks.splice(targetIdx, 0, item);
          moved = true;
          return blocks;
        },
        true
      );
    });

    if (moved) {
      render(lesson.id, { blockId });
    }
  }

  function insertBlockRelative(afterBlockId, newType, lesson) {
    const S = getStore();
    if (!S || !lesson) return;
    const newId = uid("blk");
    resetTypingSession();

    withSilentStoreMutation(() => {
      S.updateCustomBlocks(
        lesson.id,
        (blocks) => {
          const newBlk = {
            id: newId,
            type: newType || "p",
            text: "",
            originalText: "",
            sourceRef: "",
            sourceParaId: null,
            sourceDocId: null,
            hidden: false,
          };
          if (!afterBlockId) {
            blocks.push(newBlk);
            return blocks;
          }
          const idx = blocks.findIndex((b) => b.id === afterBlockId);
          if (idx === -1) {
            blocks.push(newBlk);
          } else {
            blocks.splice(idx + 1, 0, newBlk);
          }
          return blocks;
        },
        true
      );
    });

    render(lesson.id, { blockId: newId, caretPos: 0 });
  }

  function deleteSingleBlock(blockId, lesson) {
    const S = getStore();
    if (!S || !lesson || !blockId) return;
    resetTypingSession();
    state.openDiffIds.delete(blockId);

    let neighborId = null;
    const oldIdx = (lesson.blocks || []).findIndex((b) => b.id === blockId);
    if (oldIdx > 0 && lesson.blocks[oldIdx - 1]) {
      neighborId = lesson.blocks[oldIdx - 1].id;
    } else if (oldIdx === 0 && lesson.blocks[1]) {
      neighborId = lesson.blocks[1].id;
    }

    withSilentStoreMutation(() => {
      S.updateCustomBlocks(
        lesson.id,
        (blocks) => {
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx !== -1) blocks.splice(idx, 1);
          return blocks;
        },
        true
      );
    });

    render(lesson.id, neighborId ? { blockId: neighborId } : null);
    notify("حُذفت الكتلة (اضغط ↶ للتراجع إن شئت)", "info");
  }

  // ==================== Delegated Event Handlers ====================

  function bindContainerEvents(container) {
    // Track caret position accurately on block textareas before button clicks steal focus
    const rememberCaret = (e) => {
      const ta = e.target && e.target.closest && e.target.closest(".block-textarea");
      if (ta && typeof ta.selectionStart === "number") {
        ta._lastCaretStart = ta.selectionStart;
      }
    };
    container.addEventListener("keyup", rememberCaret);
    container.addEventListener("mouseup", rememberCaret);
    container.addEventListener("select", rememberCaret);
    container.addEventListener("focusout", rememberCaret);

    // Click delegation
    container.addEventListener("click", async (e) => {
      const S = getStore();
      const U = window.QabasUtils;

      // 1. Mode switcher buttons
      const modeBtn = e.target.closest("[data-studio-mode]");
      if (modeBtn) {
        switchEditorMode(modeBtn.getAttribute("data-studio-mode"));
        return;
      }

      // 2. Studio-level actions
      const studioBtn = e.target.closest("[data-studio-action]");
      if (studioBtn) {
        const action = studioBtn.getAttribute("data-studio-action");
        const lesson = findCustomLesson(state.activeCustomId);

        if (action === "create-blank") {
          createNewBlankLesson();
          return;
        }

        if (action === "fork-doc") {
          flushPendingRawIfNeeded();
          const fallbackDocId =
            (lesson && lesson.sourceDocId) ||
            (S && S.state && S.state.prefs && S.state.prefs.activeDocId) ||
            "T01";
          if (window.QabasApp && typeof window.QabasApp.openForkModal === "function") {
            window.QabasApp.openForkModal(fallbackDocId);
          } else if (S && typeof S.forkDocToCustom === "function") {
            const forked = S.forkDocToCustom(fallbackDocId, {});
            if (forked) render(forked.id || forked);
          }
          return;
        }

        if (action === "open-split-builder") {
          flushPendingRawIfNeeded();
          if (window.QabasApp && typeof window.QabasApp.toggleSplitMode === "function") {
            window.QabasApp.toggleSplitMode(true);
          }
          return;
        }

        if (action === "toggle-split") {
          flushPendingRawIfNeeded();
          if (window.QabasApp && typeof window.QabasApp.toggleSplitMode === "function") {
            window.QabasApp.toggleSplitMode();
          }
          return;
        }

        if (!lesson) return;

        if (action === "duplicate-custom") {
          flushPendingRawIfNeeded();
          if (S && typeof S.duplicateCustomLesson === "function") {
            const dup = withSilentStoreMutation(() => S.duplicateCustomLesson(lesson.id));
            const dupId = typeof dup === "string" ? dup : dup && dup.id;
            if (window.QabasApp && typeof window.QabasApp.openStudio === "function") {
              window.QabasApp.openStudio(dupId || lesson.id);
            } else {
              render(dupId || lesson.id);
            }
            notify("تم تكرار النسخة كفرع جديد مستقل", "success");
          }
          return;
        }

        if (action === "open-snapshots") {
          flushPendingRawIfNeeded();
          if (window.QabasApp && typeof window.QabasApp.openSnapshotsModal === "function") {
            window.QabasApp.openSnapshotsModal(lesson.id);
          }
          return;
        }

        if (action === "delete-custom") {
          clearTimeout(state.pendingDeleteTimer);
          state.pendingDeleteId = lesson.id;
          state.pendingDeleteTimer = setTimeout(() => {
            if (state.pendingDeleteId === lesson.id) {
              state.pendingDeleteId = null;
              render(lesson.id);
            }
          }, 5000);
          render(lesson.id);
          return;
        }

        if (action === "cancel-delete-custom") {
          clearTimeout(state.pendingDeleteTimer);
          state.pendingDeleteId = null;
          render(lesson.id);
          return;
        }

        if (action === "confirm-delete-custom") {
          clearTimeout(state.pendingDeleteTimer);
          state.pendingDeleteId = null;
          if (S && typeof S.deleteCustomLesson === "function") {
            S.deleteCustomLesson(lesson.id);
          }
          const remaining = getCustomLessons();
          const nextId = remaining[0] ? remaining[0].id : null;
          if (S && typeof S.updatePrefs === "function") {
            S.updatePrefs({ activeCustomId: nextId });
          }
          if (window.QabasApp && typeof window.QabasApp.syncActiveStage === "function") {
            window.QabasApp.syncActiveStage();
          } else {
            render(nextId);
          }
          notify("تم حذف النسخة المخصصة", "info");
          return;
        }

        if (action === "jump-origin-doc") {
          const docId = studioBtn.getAttribute("data-origin-doc");
          if (docId && window.QabasApp && typeof window.QabasApp.navigateToDoc === "function") {
            window.QabasApp.navigateToDoc(docId, null);
          }
          return;
        }

        if (action === "undo") {
          handleUndo();
          return;
        }

        if (action === "redo") {
          handleRedo();
          return;
        }

        if (action === "strip-tashkeel") {
          sanitizeAllLessonBlocks("strip-tashkeel");
          return;
        }

        if (action === "normalize-text") {
          sanitizeAllLessonBlocks("normalize-text");
          return;
        }

        if (action === "append-new-block") {
          const newType = studioBtn.getAttribute("data-new-type") || "p";
          insertBlockRelative(null, newType, lesson);
          return;
        }

        if (action === "apply-raw-md") {
          const rawTa = container.querySelector('[data-studio-role="raw-textarea"]');
          const rawVal = rawTa ? rawTa.value : state.rawDraftText;
          withSilentStoreMutation(() => {
            applyRawMarkdownToStore(lesson.id, rawVal);
          });
          const refreshed = findCustomLesson(lesson.id);
          state.rawDraftText = buildRawMarkdownDraft(refreshed);
          state.rawDirty = false;
          render(lesson.id);
          notify("تم تطبيق ومزامنة نص Markdown بنجاح", "success");
          return;
        }

        if (action === "apply-raw-and-blocks") {
          const rawTa = container.querySelector('[data-studio-role="raw-textarea"]');
          const rawVal = rawTa ? rawTa.value : state.rawDraftText;
          withSilentStoreMutation(() => {
            applyRawMarkdownToStore(lesson.id, rawVal);
          });
          state.editorMode = "blocks";
          render(lesson.id);
          notify("تمت مزامنة نص Markdown والانتقال لمحرر الفقرات", "success");
          return;
        }

        if (action === "reset-raw-md") {
          state.rawDraftText = buildRawMarkdownDraft(lesson);
          state.rawDirty = false;
          render(lesson.id);
          notify("أُعيد تحميل نص Markdown من الكتل الحالية", "info");
          return;
        }

        if (action === "preview-copy-block") {
          const blkId = studioBtn.getAttribute("data-target-block");
          const blk = (lesson.blocks || []).find((b) => b.id === blkId);
          if (blk && U && typeof U.copyText === "function") {
            await U.copyText(toEasternDigits(String(blk.text || "").trim()));
            const origLabel = studioBtn.textContent;
            studioBtn.textContent = "تم النسخ ✓";
            setTimeout(() => {
              if (studioBtn.isConnected) studioBtn.textContent = origLabel;
            }, 1200);
            notify("تم نسخ الفقرة إلى الحافظة", "success");
          }
          return;
        }

        if (action === "preview-edit-block") {
          const blkId = studioBtn.getAttribute("data-target-block");
          state.editorMode = "blocks";
          render(lesson.id, blkId ? { blockId: blkId } : null);
          return;
        }

        if (action === "copy-md") {
          flushPendingRawIfNeeded();
          const refreshed = findCustomLesson(lesson.id);
          const md = getExportContent(refreshed, "markdown");
          if (U && typeof U.copyText === "function") {
            await U.copyText(md);
          }
          notify("تم نسخ النسخة كاملة بصيغة Markdown", "success");
          return;
        }

        if (action === "copy-txt") {
          flushPendingRawIfNeeded();
          const refreshed = findCustomLesson(lesson.id);
          const txt = getExportContent(refreshed, "plain");
          if (U && typeof U.copyText === "function") {
            await U.copyText(txt);
          }
          notify("تم نسخ النص الصافي للنسخة كاملة", "success");
          return;
        }

        if (action === "download-md") {
          flushPendingRawIfNeeded();
          const refreshed = findCustomLesson(lesson.id);
          const md = getExportContent(refreshed, "markdown");
          if (U && typeof U.downloadTextFile === "function") {
            U.downloadTextFile(
              makeSafeFilename(refreshed.title, "md"),
              md,
              "text/markdown;charset=utf-8"
            );
          }
          notify("تم تنزيل ملف Markdown (.md)", "success");
          return;
        }

        if (action === "download-txt") {
          flushPendingRawIfNeeded();
          const refreshed = findCustomLesson(lesson.id);
          const txt = getExportContent(refreshed, "plain");
          if (U && typeof U.downloadTextFile === "function") {
            U.downloadTextFile(
              makeSafeFilename(refreshed.title, "txt"),
              txt,
              "text/plain;charset=utf-8"
            );
          }
          notify("تم تنزيل الملف النصي (.txt)", "success");
          return;
        }

        if (action === "print-pdf") {
          flushPendingRawIfNeeded();
          const refreshed = findCustomLesson(lesson.id);
          const m = computeLessonMetrics(refreshed);
          const printSub = [
            refreshed.subtitle ? toEasternDigits(refreshed.subtitle) : "",
            `${formatNum(m.activeWords)} كلمة · مدة الإلقاء المقدرة: ${m.durationText}`,
          ]
            .filter(Boolean)
            .join(" — ");
          const htmlBody = buildPrintHtml(refreshed);
          if (U && typeof U.openPrintView === "function") {
            U.openPrintView(toEasternDigits(refreshed.title || "نسخة مخصصة"), printSub, htmlBody);
          } else {
            window.print();
          }
          return;
        }

        if (action === "teleprompter") {
          flushPendingRawIfNeeded();
          if (window.QabasApp && typeof window.QabasApp.openTeleprompter === "function") {
            window.QabasApp.openTeleprompter({ customId: lesson.id });
          }
          return;
        }
      }

      // 3. Block-level actions
      const blockBtn = e.target.closest("[data-block-action]");
      if (blockBtn) {
        const bAction = blockBtn.getAttribute("data-block-action");
        const blockEl = blockBtn.closest(".studio-block");
        const lesson = findCustomLesson(state.activeCustomId);
        if (!blockEl || !lesson) return;
        const blockId = blockEl.getAttribute("data-block-id");

        if (bAction === "jump-source") {
          const refDoc = blockBtn.getAttribute("data-ref-doc");
          const refTarget = blockBtn.getAttribute("data-ref-target") || null;
          if (refDoc && window.QabasApp && typeof window.QabasApp.navigateToDoc === "function") {
            window.QabasApp.navigateToDoc(refDoc, refTarget);
          }
          return;
        }

        if (bAction === "move-up") {
          moveBlockByDelta(blockId, -1, lesson);
          return;
        }

        if (bAction === "move-down") {
          moveBlockByDelta(blockId, 1, lesson);
          return;
        }

        if (bAction === "split") {
          splitBlockAtCursor(blockEl, lesson);
          return;
        }

        if (bAction === "merge-next") {
          mergeBlockWithNext(blockId, lesson);
          return;
        }

        if (bAction === "toggle-diff") {
          if (state.openDiffIds.has(blockId)) {
            state.openDiffIds.delete(blockId);
          } else {
            state.openDiffIds.add(blockId);
          }
          const blk = (lesson.blocks || []).find((b) => b.id === blockId);
          refreshSingleBlockInlineMeta(blockEl, blk);
          return;
        }

        if (bAction === "restore-original") {
          resetTypingSession();
          state.openDiffIds.delete(blockId);
          withSilentStoreMutation(() => {
            S.updateCustomBlocks(
              lesson.id,
              (blocks) => {
                const target = blocks.find((b) => b.id === blockId);
                if (target && typeof target.originalText === "string") {
                  target.text = target.originalText;
                }
                return blocks;
              },
              true
            );
          });
          render(lesson.id, { blockId });
          notify("تمت استعادة النص الأصلي للفقرة", "info");
          return;
        }

        if (bAction === "toggle-hidden") {
          resetTypingSession();
          withSilentStoreMutation(() => {
            S.updateCustomBlocks(
              lesson.id,
              (blocks) => {
                const target = blocks.find((b) => b.id === blockId);
                if (target) target.hidden = !target.hidden;
                return blocks;
              },
              true
            );
          });
          render(lesson.id);
          return;
        }

        if (bAction === "insert-p-below") {
          insertBlockRelative(blockId, "p", lesson);
          return;
        }

        if (bAction === "insert-h3-below") {
          insertBlockRelative(blockId, "h3", lesson);
          return;
        }

        if (bAction === "delete-block") {
          deleteSingleBlock(blockId, lesson);
          return;
        }
      }
    });

    // Change delegation (selects & checkboxes)
    container.addEventListener("change", (e) => {
      const S = getStore();
      if (!S) return;

      // Switch active custom lesson from selector bar
      if (e.target.matches('[data-studio-role="lesson-select"]')) {
        flushPendingRawIfNeeded();
        const nextId = e.target.value;
        if (window.QabasApp && typeof window.QabasApp.openStudio === "function") {
          window.QabasApp.openStudio(nextId);
        } else {
          S.updatePrefs({ activeCustomId: nextId });
          render(nextId);
        }
        return;
      }

      // Toggle includeNotesInMd
      if (e.target.matches('[data-studio-role="include-notes-cb"]')) {
        const lesson = findCustomLesson(state.activeCustomId);
        if (!lesson || typeof S.updateCustomMeta !== "function") return;
        const checked = !!e.target.checked;
        withSilentStoreMutation(() => {
          S.updateCustomMeta(lesson.id, { includeNotesInMd: checked });
        });
        if (state.editorMode === "preview") {
          render(lesson.id);
        } else {
          refreshHeaderStats();
        }
        return;
      }

      // Change block type
      if (e.target.matches('[data-block-role="type-select"]')) {
        const blockEl = e.target.closest(".studio-block");
        const lesson = findCustomLesson(state.activeCustomId);
        if (!blockEl || !lesson) return;
        const blockId = blockEl.getAttribute("data-block-id");
        const nextType = e.target.value;
        resetTypingSession();

        withSilentStoreMutation(() => {
          S.updateCustomBlocks(
            lesson.id,
            (blocks) => {
              const target = blocks.find((b) => b.id === blockId);
              if (target) target.type = nextType;
              return blocks;
            },
            true
          );
        });

        blockEl.classList.remove("type-p", "type-h2", "type-h3", "type-quote", "type-note");
        blockEl.classList.add(`type-${nextType}`);
        const ta = blockEl.querySelector(".block-textarea");
        if (ta) {
          ta.placeholder = BLOCK_PLACEHOLDERS[nextType] || BLOCK_PLACEHOLDERS.p;
          autoGrowTextarea(ta);
        }
        refreshHeaderStats();
      }
    });

    // Input delegation (live saving without losing caret focus!)
    container.addEventListener("input", (e) => {
      const S = getStore();
      if (!S) return;
      const lesson = findCustomLesson(state.activeCustomId);
      if (!lesson) return;

      // 1. Title input
      if (e.target.matches('[data-studio-role="title-input"]')) {
        const nextTitle = e.target.value;
        state.isInlineTyping = true;
        try {
          withSilentStoreMutation(() => {
            if (typeof S.updateCustomMeta === "function") {
              S.updateCustomMeta(lesson.id, { title: nextTitle });
            }
          });
        } finally {
          state.isInlineTyping = false;
        }
        refreshHeaderStats();
        return;
      }

      // 2. Subtitle input
      if (e.target.matches('[data-studio-role="subtitle-input"]')) {
        const nextSub = e.target.value;
        state.isInlineTyping = true;
        try {
          withSilentStoreMutation(() => {
            if (typeof S.updateCustomMeta === "function") {
              S.updateCustomMeta(lesson.id, { subtitle: nextSub });
            }
          });
        } finally {
          state.isInlineTyping = false;
        }
        refreshHeaderStats();
        return;
      }

      // 3. Block textarea (no full list re-render!)
      if (e.target.matches('[data-block-role="textarea"]')) {
        const ta = e.target;
        const blockEl = ta.closest(".studio-block");
        if (!blockEl) return;
        const blockId = blockEl.getAttribute("data-block-id");
        const nextText = ta.value;
        ta._lastCaretStart = ta.selectionStart;

        autoGrowTextarea(ta);

        state.isInlineTyping = true;
        let updatedBlockRef = null;
        try {
          recordTypingUndoIfNeeded(lesson.id, `blk:${blockId}`);
          withSilentStoreMutation(() => {
            if (typeof S.updateCustomBlocks === "function") {
              S.updateCustomBlocks(
                lesson.id,
                (blocks) => {
                  const target = blocks.find((b) => b.id === blockId);
                  if (target) {
                    target.text = nextText;
                    updatedBlockRef = target;
                  }
                  return blocks;
                },
                false
              );
            }
          });
        } finally {
          state.isInlineTyping = false;
        }

        const freshLesson = findCustomLesson(lesson.id);
        const liveBlk =
          updatedBlockRef ||
          (freshLesson && (freshLesson.blocks || []).find((b) => b.id === blockId));
        if (liveBlk) {
          refreshSingleBlockInlineMeta(blockEl, liveBlk);
        }
        refreshHeaderStats();
        return;
      }

      // 4. Raw Markdown textarea
      if (e.target.matches('[data-studio-role="raw-textarea"]')) {
        state.rawDraftText = e.target.value;
        state.rawForCustomId = lesson.id;
        state.rawDirty = true;

        const wcChip = container.querySelector('[data-studio-role="raw-word-chip"]');
        if (wcChip) {
          wcChip.textContent = `${formatNum(countWords(state.rawDraftText))} كلمة في المحرر`;
        }
        const syncChip = container.querySelector('[data-studio-role="raw-sync-status"]');
        if (syncChip) {
          syncChip.textContent = "تعديلات جاهزة للمزامنة ●";
        }
      }
    });

    // Drag & Drop reordering on .drag-handle -> .studio-block
    container.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) return;
      const blockEl = handle.closest(".studio-block");
      if (!blockEl) return;

      const blockId = blockEl.getAttribute("data-block-id");
      state.drag.blockId = blockId;
      state.drag.overBlockId = null;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", blockId);
        if (typeof e.dataTransfer.setDragImage === "function") {
          e.dataTransfer.setDragImage(blockEl, 28, 20);
        }
      }

      requestAnimationFrame(() => {
        blockEl.classList.add("is-dragging");
      });
    });

    container.addEventListener("dragover", (e) => {
      if (!state.drag.blockId) return;
      const overBlock = e.target.closest(".studio-block");
      if (!overBlock) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

      const overId = overBlock.getAttribute("data-block-id");
      container.querySelectorAll(".studio-block.drag-over").forEach((el) => {
        if (el !== overBlock) el.classList.remove("drag-over");
      });

      if (overId !== state.drag.blockId) {
        overBlock.classList.add("drag-over");
        const rect = overBlock.getBoundingClientRect();
        state.drag.overBlockId = overId;
        state.drag.placeAfter = e.clientY > rect.top + rect.height / 2;
      }
    });

    container.addEventListener("dragleave", (e) => {
      const overBlock = e.target.closest(".studio-block");
      if (overBlock && !overBlock.contains(e.relatedTarget)) {
        overBlock.classList.remove("drag-over");
      }
    });

    container.addEventListener("drop", (e) => {
      if (!state.drag.blockId) return;
      e.preventDefault();

      const draggedId = state.drag.blockId;
      const dropBlock = e.target.closest(".studio-block");
      const targetId =
        (dropBlock && dropBlock.getAttribute("data-block-id")) || state.drag.overBlockId;
      const placeAfter = state.drag.placeAfter;

      cleanupDragVisuals(container);

      if (!targetId || targetId === draggedId) return;
      const S = getStore();
      const lesson = findCustomLesson(state.activeCustomId);
      if (!S || !lesson || typeof S.updateCustomBlocks !== "function") return;

      resetTypingSession();
      let reordered = false;
      withSilentStoreMutation(() => {
        S.updateCustomBlocks(
          lesson.id,
          (blocks) => {
            const fromIdx = blocks.findIndex((b) => b.id === draggedId);
            if (fromIdx === -1) return blocks;
            const [movedItem] = blocks.splice(fromIdx, 1);
            const targetIdx = blocks.findIndex((b) => b.id === targetId);
            if (targetIdx === -1) {
              blocks.splice(fromIdx, 0, movedItem);
              return blocks;
            }
            const insertAt = placeAfter ? targetIdx + 1 : targetIdx;
            blocks.splice(insertAt, 0, movedItem);
            reordered = true;
            return blocks;
          },
          true
        );
      });

      if (reordered) {
        render(lesson.id, { blockId: draggedId });
        notify("أُعيد ترتيب الفقرة", "info");
      }
    });

    container.addEventListener("dragend", () => {
      cleanupDragVisuals(container);
    });
  }

  function cleanupDragVisuals(container) {
    state.drag.blockId = null;
    state.drag.overBlockId = null;
    if (!container) return;
    container.querySelectorAll(".studio-block.is-dragging, .studio-block.drag-over").forEach((el) => {
      el.classList.remove("is-dragging", "drag-over");
    });
  }

  function bindGlobalStudioShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!state.containerEl || state.containerEl.hidden) return;

      // Ignore when any modal or teleprompter overlay is open
      const openModal = document.querySelector(
        ".modal-backdrop:not([hidden]), .teleprompter-overlay:not([hidden])"
      );
      if (openModal) return;

      const activeEl = document.activeElement;
      const insideStudio = state.containerEl.contains(activeEl);
      const S = getStore();
      const isStudioPrimaryTab =
        S && S.state && S.state.prefs && S.state.prefs.activeTab === "studio" && !S.state.prefs.splitMode;

      // Cmd/Ctrl + Enter inside raw markdown editor -> apply immediately
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        activeEl &&
        activeEl.matches &&
        activeEl.matches('[data-studio-role="raw-textarea"]')
      ) {
        e.preventDefault();
        const lesson = findCustomLesson(state.activeCustomId);
        if (lesson) {
          withSilentStoreMutation(() => {
            applyRawMarkdownToStore(lesson.id, activeEl.value);
          });
          const refreshed = findCustomLesson(lesson.id);
          state.rawDraftText = buildRawMarkdownDraft(refreshed);
          state.rawDirty = false;
          render(lesson.id);
          notify("تم تطبيق ومزامنة نص Markdown بنجاح", "success");
        }
        return;
      }

      // Undo / Redo shortcuts inside Studio (when in blocks/preview mode, or studio tab active)
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const keyLower = e.key.toLowerCase();
        const isRawFocused =
          activeEl &&
          activeEl.matches &&
          activeEl.matches('[data-studio-role="raw-textarea"]');
        if (isRawFocused) return; // Keep native browser undo while editing unsynced raw markdown

        // Do not hijack undo if user is typing inside reader inline editor or sidebar search
        const inOtherInput =
          !insideStudio &&
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.isContentEditable);
        if (inOtherInput) return;

        if (!insideStudio && !isStudioPrimaryTab) return;

        if (keyLower === "z" && !e.shiftKey) {
          const lesson = findCustomLesson(state.activeCustomId);
          if (lesson && S && typeof S.canUndo === "function" && S.canUndo(lesson.id)) {
            e.preventDefault();
            handleUndo();
          }
          return;
        }

        if ((keyLower === "z" && e.shiftKey) || keyLower === "y") {
          const lesson = findCustomLesson(state.activeCustomId);
          if (lesson && S && typeof S.canRedo === "function" && S.canRedo(lesson.id)) {
            e.preventDefault();
            handleRedo();
          }
        }
      }
    });

    window.addEventListener("resize", () => {
      if (state.containerEl && !state.containerEl.hidden && state.editorMode === "blocks") {
        resizeAllTextareas();
      }
    });
  }

  function ensureStoreListeners() {
    if (state.storeBound) return;
    const S = getStore();
    if (!S || typeof S.on !== "function") return;
    state.storeBound = true;

    S.on("customChanged", () => {
      if (state.suppressStoreEcho || state.isInlineTyping) return;
      if (!state.containerEl || state.containerEl.hidden) return;
      const prefId = S.state && S.state.prefs && S.state.prefs.activeCustomId;
      render(prefId || state.activeCustomId);
    });

    S.on("prefs", () => {
      if (state.suppressStoreEcho || state.isInlineTyping) return;
      if (!state.containerEl || state.containerEl.hidden) return;
      refreshHeaderStats();
      requestAnimationFrame(() => {
        if (state.editorMode === "blocks") resizeAllTextareas();
      });
    });
  }

  // ==================== Public Module API ====================

  function init(containerEl) {
    state.containerEl = containerEl || document.getElementById("studioView");
    if (!state.containerEl) return;

    injectFallbackStyles();
    ensureStoreListeners();

    if (!state.initialized) {
      state.initialized = true;
      bindContainerEvents(state.containerEl);
      bindGlobalStudioShortcuts();
    }
  }

  window.QabasStudio = {
    init,
    render,
    refreshHeaderStats,
  };
})();

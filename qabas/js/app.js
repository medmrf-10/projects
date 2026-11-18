(function () {
  "use strict";

  const state = {
    sidebarFilter: "",
    searchScope: "all",
    searchDebounce: null,
    forkContext: { docId: "T01", sectionId: null },
    tp: {
      active: false,
      items: [],
      currentIndex: 0,
      fontSize: 28,
      autoScrollTimer: null,
      clockTimer: null,
      startedAt: 0,
    },
  };

  function el(id) {
    return document.getElementById(id);
  }

  function toast(msg, type = "success") {
    const stack = el("toastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `toast-item toast-${type}`;
    item.textContent = window.QabasUtils
      ? window.QabasUtils.toEasternDigits(String(msg))
      : String(msg);
    stack.appendChild(item);
    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(8px)";
      setTimeout(() => item.remove(), 220);
    }, 2600);
  }

  function applyAppearancePrefs() {
    const prefs = window.QabasStore.state.prefs;
    const html = document.documentElement;
    html.setAttribute("data-theme", prefs.theme || "frozen");
    html.setAttribute("data-font", prefs.font || "plex");
    html.setAttribute("data-width", prefs.width || "medium");
    html.style.setProperty("--reader-font-size", `${prefs.fontSize || 19}px`);
    html.style.setProperty("--reader-line-height", String(prefs.lineHeight || 1.92));

    const shell = el("appShell");
    if (shell) {
      shell.classList.toggle("is-split-mode", !!prefs.splitMode);
      shell.classList.toggle("is-focus-mode", !!prefs.focusMode);
    }

    const splitBtn = el("splitModeBtn");
    if (splitBtn) splitBtn.classList.toggle("is-active", !!prefs.splitMode);
    const focusBtn = el("focusModeBtn");
    if (focusBtn) focusBtn.classList.toggle("is-active", !!prefs.focusMode);

    // Update appearance popover active pills
    document.querySelectorAll("[data-set-theme]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-set-theme") === prefs.theme);
    });
    document.querySelectorAll("[data-set-font]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-set-font") === prefs.font);
    });
    document.querySelectorAll("[data-set-width]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-set-width") === prefs.width);
    });
    document.querySelectorAll("[data-set-copy]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-set-copy") === prefs.copyFormat);
    });
    const qMode = prefs.qualityFilter || "clean";
    document.querySelectorAll("[data-set-quality]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-set-quality") === qMode);
    });
    const qBtn = el("qualityFilterBtn");
    const qLbl = el("qualityFilterLabel");
    if (qBtn && qLbl) {
      qBtn.classList.toggle("is-active", qMode !== "all");
      if (qMode === "clean") {
        qLbl.textContent = "الصافي فقط ✓";
      } else if (qMode === "high") {
        qLbl.textContent = "الممتاز فقط ★";
      } else {
        qLbl.textContent = "عرض الكل";
      }
    }

    const fsVal = el("fontSizeVal");
    const fsRange = el("fontSizeRange");
    if (fsVal) fsVal.textContent = String(prefs.fontSize || 19);
    if (fsRange) fsRange.value = String(prefs.fontSize || 19);

    const lhVal = el("lineHeightVal");
    const lhRange = el("lineHeightRange");
    if (lhVal) lhVal.textContent = Number(prefs.lineHeight || 1.92).toFixed(2);
    if (lhRange) lhRange.value = String(prefs.lineHeight || 1.92);
  }

  function updateSyncBadge() {
    const badge = el("syncBadge");
    if (!badge) return;
    const status = window.QabasStore.syncStatus;
    badge.className = "sync-badge";
    if (status === "local-disk") {
      badge.classList.add("is-synced");
      badge.textContent = "حفظ محلي مباشر";
    } else if (status === "saving") {
      badge.classList.add("is-saving");
      badge.textContent = "جارٍ الحفظ...";
    } else if (status === "browser-only") {
      badge.classList.add("is-synced");
      badge.textContent = "حفظ تلقائي بالمتصفح";
    } else if (status === "error") {
      badge.textContent = "محفوظ بالمتصفح";
    } else {
      badge.textContent = "متصل";
    }
  }

  function updateTopCounts() {
    const U = window.QabasUtils;
    const S = window.QabasStore;
    const visTopics = S.topics.filter((t) => S.isDocQualityAllowed(t));
    const visLessons = S.lessons.filter((l) => S.isDocQualityAllowed(l));
    if (el("topicsCountBadge")) el("topicsCountBadge").textContent = U.formatNum(visTopics.length);
    if (el("lessonsCountBadge")) el("lessonsCountBadge").textContent = U.formatNum(visLessons.length);
    if (el("customCountBadge")) el("customCountBadge").textContent = U.formatNum(S.state.customLessons.length);
    const bmCount = S.getAllBookmarkedAndAnnotated("all").length;
    if (el("bookmarksCountBadge")) el("bookmarksCountBadge").textContent = U.formatNum(bmCount);
  }

  function renderSidebar() {
    const U = window.QabasUtils;
    const S = window.QabasStore;
    const prefs = S.state.prefs;
    const tab = prefs.activeTab || "topics";
    const listEl = el("docListContainer");
    const headingEl = el("sidebarHeading");
    if (!listEl || !headingEl) return;

    const qNorm = U.normalizeForSearch(state.sidebarFilter || "");

    if (tab === "studio" && !prefs.splitMode) {
      headingEl.textContent = `نسخي المخصصة (${U.formatNum(S.state.customLessons.length)})`;
      const items = S.state.customLessons.filter((cl) => {
        if (!qNorm) return true;
        return U.normalizeForSearch(`${cl.title} ${cl.subtitle || ""}`).includes(qNorm);
      });
      if (!items.length) {
        listEl.innerHTML = `
          <div style="padding: 16px; color: var(--muted); font-size: 13px; text-align: center;">
            لا توجد نسخ مخصصة مطابقة بعد.
            <div style="margin-top: 10px;">
              <button class="btn btn-pill btn-primary" data-sidebar-new-custom="1">+ إنشاء نسخة جديدة</button>
            </div>
          </div>`;
        return;
      }
      listEl.innerHTML = items
        .map((cl, idx) => {
          const isActive = cl.id === prefs.activeCustomId;
          const words = (cl.blocks || [])
            .filter((b) => !b.hidden)
            .reduce((acc, b) => acc + U.countWords(b.text || ""), 0);
          return `
            <button class="doc-item ${isActive ? "is-active" : ""}" data-select-custom="${U.escapeHtml(cl.id)}">
              <span class="doc-num">${idx + 1}</span>
              <span class="doc-info">
                <span class="doc-title">${U.escapeHtml(cl.title || "نسخة بدون عنوان")}</span>
                <span class="doc-meta">${U.formatNum(words)} كلمة · ${U.formatDuration(words, prefs.wpm)}</span>
              </span>
            </button>`;
        })
        .join("");
      return;
    }

    // Default: show Topics or Lessons (if bookmarks tab, show whichever activeDocId belongs to)
    const showLessons =
      tab === "lessons" ||
      (tab !== "topics" && String(prefs.activeDocId || "").startsWith("L"));
    const rawList = showLessons ? S.lessons : S.topics;
    const sourceList = rawList.filter((d) => S.isDocQualityAllowed(d));
    headingEl.textContent = showLessons
      ? `المجالس الصافية (${U.formatNum(sourceList.length)})`
      : `الكتب الموضوعية (${U.formatNum(sourceList.length)})`;

    const filtered = sourceList.filter((d) => {
      if (!qNorm) return true;
      return U.normalizeForSearch(d.title).includes(qNorm) || String(d.num).includes(qNorm);
    });

    listEl.innerHTML = filtered
      .map((d) => {
        const isActive = d.id === prefs.activeDocId;
        const isRead = !!S.state.readDocs[d.id];
        const edits = S.getDocEditCount(d.id);
        const vis = S.getDocVisibleStats(d);
        const subLabel =
          d.kind === "topic"
            ? `${d.chapterCount} أبواب · ${U.formatNum(vis.words)} كلمة`
            : `${d.sectionCount} محاور · ${U.formatNum(vis.words)} كلمة`;
        return `
          <button class="doc-item ${isActive ? "is-active" : ""} ${isRead ? "is-read" : ""}" data-select-doc="${d.id}">
            <span class="doc-num">${d.num}</span>
            <span class="doc-info">
              <span class="doc-title">${U.escapeHtml(d.title)}</span>
              <span class="doc-meta">
                ${subLabel}
                ${d.qTier === "low" ? ` · <span style="color:var(--rose);">تفريغ خام</span>` : ""}
                ${edits > 0 ? ` · <strong>${edits} تعديل</strong>` : ""}
                ${isRead ? ` · ✓ مقروء` : ""}
              </span>
            </span>
          </button>`;
      })
      .join("");
  }

  function syncActiveStage() {
    const S = window.QabasStore;
    const prefs = S.state.prefs;
    const tab = prefs.activeTab || "topics";

    document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tab);
    });

    const readerView = el("readerView");
    const studioView = el("studioView");
    const bookmarksView = el("bookmarksView");
    const sidebarToc = el("sidebarToc");

    applyAppearancePrefs();
    updateTopCounts();
    renderSidebar();

    if (prefs.splitMode) {
      // Split-Screen Builder: Reader (source) on Right + Studio (custom version) on Left!
      readerView.hidden = false;
      studioView.hidden = false;
      bookmarksView.hidden = true;
      if (sidebarToc) sidebarToc.hidden = true;

      const docId = prefs.activeDocId || "T01";
      window.QabasReader.renderDoc(docId);
      window.QabasStudio.render(prefs.activeCustomId);
      return;
    }

    if (tab === "studio") {
      readerView.hidden = true;
      studioView.hidden = false;
      bookmarksView.hidden = true;
      if (sidebarToc) sidebarToc.hidden = true;
      window.QabasStudio.render(prefs.activeCustomId);
    } else if (tab === "bookmarks") {
      readerView.hidden = true;
      studioView.hidden = true;
      bookmarksView.hidden = false;
      if (sidebarToc) sidebarToc.hidden = true;
      window.QabasReader.renderBookmarks("all");
    } else {
      readerView.hidden = false;
      studioView.hidden = true;
      bookmarksView.hidden = true;
      if (sidebarToc) sidebarToc.hidden = !!prefs.focusMode;

      let docId = prefs.activeDocId;
      if (tab === "topics" && (!docId || !docId.startsWith("T") || !S.isDocQualityAllowed(docId))) {
        const firstTopic = S.topics.find((t) => S.isDocQualityAllowed(t)) || S.topics[0];
        docId = firstTopic ? firstTopic.id : "T01";
        S.updatePrefs({ activeDocId: docId });
      } else if (tab === "lessons" && (!docId || !docId.startsWith("L") || !S.isDocQualityAllowed(docId))) {
        const firstLesson = S.lessons.find((l) => S.isDocQualityAllowed(l)) || S.lessons[0];
        docId = firstLesson ? firstLesson.id : "L01";
        S.updatePrefs({ activeDocId: docId });
      }
      window.QabasReader.renderDoc(docId);
    }
  }

  function navigateToDoc(docId, targetElementId = null) {
    const S = window.QabasStore;
    const doc = S.getDoc(docId);
    if (!doc) return;
    const nextTab = S.state.prefs.splitMode
      ? S.state.prefs.activeTab
      : doc.kind === "lesson"
      ? "lessons"
      : "topics";
    S.updatePrefs({ activeDocId: docId, activeTab: nextTab });
    syncActiveStage();
    el("sidebarNav")?.classList.remove("is-open");
    if (targetElementId) {
      setTimeout(() => {
        window.QabasReader.scrollToTarget(targetElementId);
      }, 60);
    } else {
      el("readerView")?.scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openStudio(customId = null) {
    const S = window.QabasStore;
    const id =
      customId ||
      S.state.prefs.activeCustomId ||
      (S.state.customLessons[0] && S.state.customLessons[0].id) ||
      null;
    if (S.state.prefs.splitMode) {
      S.updatePrefs({ activeCustomId: id });
    } else {
      S.updatePrefs({ activeTab: "studio", activeCustomId: id });
    }
    syncActiveStage();
  }

  function toggleSplitMode(forceBool) {
    const S = window.QabasStore;
    const next = typeof forceBool === "boolean" ? forceBool : !S.state.prefs.splitMode;
    if (next && !S.state.customLessons.length) {
      const created = S.createBlankCustomLesson(
        "نسخة مخصصة مختارة",
        "التقط الفقرات والمباحث مباشرة من العمود الأيمن وعدّلها بحرية هنا"
      );
      S.updatePrefs({ splitMode: true, activeCustomId: created.id });
    } else {
      const activeCustomId =
        S.state.prefs.activeCustomId ||
        (S.state.customLessons[0] && S.state.customLessons[0].id) ||
        null;
      S.updatePrefs({ splitMode: next, activeCustomId });
    }
    syncActiveStage();
    toast(
      next
        ? "فُعّل العرض المزدوج: اختر أي فقرة من اليمين واضغط «+ للنسخة»"
        : "أُغلق العرض المزدوج",
      "info"
    );
  }

  function renderSelectionBar() {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const sel = S.state.selection || [];
    const bar = el("selectionBar");
    const shell = el("appShell");
    if (!bar) return;
    if (!sel.length) {
      bar.hidden = true;
      shell?.classList.remove("has-selection");
      return;
    }
    bar.hidden = false;
    shell?.classList.add("has-selection");
    let totalWords = 0;
    sel.forEach((pid) => {
      totalWords += U.countWords(S.getEffectiveParagraphText(pid));
    });
    el("selectionCountLabel").textContent = `${U.formatNum(sel.length)} فقرات محددة`;
    el("selectionWordsLabel").textContent = `${U.formatNum(totalWords)} كلمة · ${U.formatDuration(totalWords, S.state.prefs.wpm)}`;
  }

  // ==================== Global Search Modal ====================
  function openSearchModal(initialQuery = "") {
    const modal = el("searchModal");
    if (!modal) return;
    modal.hidden = false;
    const inp = el("globalSearchInput");
    if (inp) {
      if (initialQuery) inp.value = initialQuery;
      inp.focus();
      inp.select();
      runGlobalSearch();
    }
  }

  function runGlobalSearch() {
    const U = window.QabasUtils;
    const S = window.QabasStore;
    const inp = el("globalSearchInput");
    const listEl = el("searchResultsList");
    const metaEl = el("searchMetaLine");
    if (!inp || !listEl || !metaEl) return;

    const q = inp.value.trim();
    if (q.length < 2) {
      metaEl.textContent =
        "اكتب حرفين أو أكثر للبحث الفوري عبر 12 كتاباً موضوعياً و 67 مجلساً ونسخك المخصصة.";
      listEl.innerHTML = "";
      return;
    }

    const t0 = performance.now();
    const res = S.search(q, { scope: state.searchScope, limit: 100 });
    const elapsed = Math.max(1, Math.round(performance.now() - t0));

    metaEl.textContent = `عُثر على ${U.formatNum(res.total)} نتيجة مطابقة في ${elapsed} مللي ثانية (يُعرض أول ${U.formatNum(res.items.length)}):`;

    if (!res.items.length) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--muted);">لا توجد فقرات مطابقة لعبارة البحث. جرّب جذر الكلمة أو عبارة أقصر.</div>`;
      return;
    }

    listEl.innerHTML = res.items
      .map((hit) => {
        const snippetHtml = U.highlightMatches(hit.text, q, 190);
        if (hit.kind === "custom") {
          return `
            <div class="search-hit-card">
              <div class="hit-breadcrumb">نسخة مخصصة · <strong>${U.escapeHtml(hit.docTitle)}</strong></div>
              <div class="hit-snippet">${snippetHtml}</div>
              <div class="hit-actions">
                <button class="btn btn-pill btn-primary" data-hit-open-custom="${U.escapeHtml(hit.customId)}">فتح في الاستوديو</button>
                <button class="btn btn-pill btn-ghost" data-hit-copy-raw="${U.escapeHtml(hit.text)}">نسخ</button>
              </div>
            </div>`;
        }
        return `
          <div class="search-hit-card">
            <div class="hit-breadcrumb">
              <span>${hit.docKind === "topic" ? "كتاب موضوعي" : "مجلس مستقل"}</span> ·
              <strong>${U.escapeHtml(hit.docTitle)}</strong> ·
              <span>${U.escapeHtml(hit.sectionTitle || "")}</span>
              <span class="stat-chip">${U.formatNum(hit.words)} كلمة</span>
            </div>
            <div class="hit-snippet">${snippetHtml}</div>
            <div class="hit-actions">
              <button class="btn btn-pill btn-primary" data-hit-jump-doc="${hit.docId}" data-hit-jump-para="${hit.paraId}">الانتقال للفقرة</button>
              <button class="btn btn-pill btn-ghost" data-hit-copy-para="${hit.paraId}">نسخ الفقرة</button>
              <button class="btn btn-pill btn-emerald" data-hit-add-custom="${hit.paraId}">+ أضف للنسخة المخصصة</button>
            </div>
          </div>`;
      })
      .join("");
  }

  // ==================== Fork Lesson / Book Modal ====================
  function openForkModal(docId, preselectedSectionId = null) {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const targetDocId = docId || S.state.prefs.activeDocId || "T01";
    const doc = S.getDoc(targetDocId);
    if (!doc) return;

    state.forkContext = { docId: doc.id, sectionId: preselectedSectionId || null };

    const allowedLessons = S.lessons.filter((l) => S.isDocQualityAllowed(l) || l.id === doc.id);
    const allDocsOptions = [
      ...S.topics.map((t) => `<option value="${t.id}" ${t.id === doc.id ? "selected" : ""}>كتاب ${t.num}: ${U.escapeHtml(t.title)}</option>`),
      ...allowedLessons.map((l) => `<option value="${l.id}" ${l.id === doc.id ? "selected" : ""}>${U.escapeHtml(l.title)}</option>`),
    ].join("");

    renderForkModalContent(doc, preselectedSectionId, allDocsOptions);
    el("forkModal").hidden = false;
  }

  function renderForkModalContent(doc, preselectedSectionId, allDocsOptionsHtml) {
    const U = window.QabasUtils;
    const body = el("forkModalBody");
    if (!body) return;

    let defaultTitle = `نسخة مخصصة: ${doc.title}`;
    let unitsHtml = "";

    if (doc.kind === "topic") {
      unitsHtml = doc.chapters
        .map((ch) => {
          const checked = !preselectedSectionId || ch.id === preselectedSectionId || ch.subtopics.some((s) => s.id === preselectedSectionId);
          return `
            <label class="fork-check-row" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border); border-radius:8px; margin-bottom:6px; cursor:pointer;">
              <input type="checkbox" class="fork-unit-cb" value="${ch.id}" ${checked ? "checked" : ""} />
              <span style="flex:1;">${U.escapeHtml(ch.title)}</span>
              <span class="stat-chip">${U.formatNum(ch.wordCount)} كلمة</span>
            </label>`;
        })
        .join("");
    } else {
      unitsHtml = doc.sections
        .map((sec) => {
          const checked = !preselectedSectionId || sec.id === preselectedSectionId;
          if (preselectedSectionId && sec.id === preselectedSectionId) {
            defaultTitle = `نسخة مخصصة: ${sec.title}`;
          }
          return `
            <label class="fork-check-row" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border); border-radius:8px; margin-bottom:6px; cursor:pointer;">
              <input type="checkbox" class="fork-unit-cb" value="${sec.id}" ${checked ? "checked" : ""} />
              <span style="flex:1;">${U.escapeHtml(sec.title)}</span>
              <span class="stat-chip">${U.formatNum(sec.wordCount)} كلمة</span>
            </label>`;
        })
        .join("");
    }

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; margin-bottom:5px; font-weight:600;">المصدر المراد استنساخه:</label>
          <select id="forkSourceSelect" class="sidebar-search-input" style="width:100%;">${allDocsOptionsHtml}</select>
        </div>
        <div>
          <label style="display:block; margin-bottom:5px; font-weight:600;">عنوان النسخة المخصصة الجديدة:</label>
          <input id="forkCustomTitleInput" type="text" class="sidebar-search-input" style="width:100%;" value="${U.escapeHtml(defaultTitle)}" />
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-weight:600;">اختر الأبواب أو المحاور المراد تضمينها:</label>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-pill btn-ghost" id="forkCheckAllBtn">تحديد الكل</button>
              <button type="button" class="btn btn-pill btn-ghost" id="forkUncheckAllBtn">إلغاء الكل</button>
            </div>
          </div>
          <div style="max-height: 240px; overflow-y: auto; padding-left: 4px;">
            ${unitsHtml}
          </div>
        </div>
      </div>`;

    el("forkSourceSelect")?.addEventListener("change", (ev) => {
      const nextDoc = window.QabasStore.getDoc(ev.target.value);
      if (nextDoc) {
        state.forkContext = { docId: nextDoc.id, sectionId: null };
        openForkModal(nextDoc.id, null);
      }
    });
    el("forkCheckAllBtn")?.addEventListener("click", () => {
      body.querySelectorAll(".fork-unit-cb").forEach((cb) => (cb.checked = true));
    });
    el("forkUncheckAllBtn")?.addEventListener("click", () => {
      body.querySelectorAll(".fork-unit-cb").forEach((cb) => (cb.checked = false));
    });
  }

  // ==================== Snapshots Modal ====================
  function openSnapshotsModal(customId) {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const cid = customId || S.state.prefs.activeCustomId;
    const cl = S.state.customLessons.find((c) => c.id === cid);
    if (!cl) return;

    const modal = el("snapshotsModal");
    const body = el("snapshotsModalBody");
    if (!modal || !body) return;

    const snaps = cl.snapshots || [];
    body.innerHTML = `
      <div style="margin-bottom: 14px; display: flex; gap: 8px;">
        <input id="newSnapshotLabelInput" type="text" class="sidebar-search-input" style="flex:1;" placeholder="اسم نقطة الاستعادة (مثال: قبل الاختصار للإلقاء)..." />
        <button id="createSnapshotNowBtn" class="btn btn-pill btn-primary" data-snap-cid="${U.escapeHtml(cl.id)}">+ حفظ نقطة الآن</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow-y:auto;">
        ${
          snaps.length
            ? snaps
                .slice()
                .reverse()
                .map(
                  (sn) => `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--border); border-radius:8px;">
                  <div>
                    <strong>${U.escapeHtml(sn.label || "نقطة استعادة")}</strong>
                    <div style="font-size:12px; color:var(--muted);">${U.formatNum((sn.blocks || []).length)} فقرة · ${U.toEasternDigits(new Date(sn.createdAt || Date.now()).toLocaleString("en-GB"))}</div>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-pill btn-primary" data-restore-snap="${U.escapeHtml(sn.id)}" data-snap-cid="${U.escapeHtml(cl.id)}">استعادة</button>
                    <button class="btn btn-pill btn-danger-ghost" data-delete-snap="${U.escapeHtml(sn.id)}" data-snap-cid="${U.escapeHtml(cl.id)}">حذف</button>
                  </div>
                </div>`
                )
                .join("")
            : `<div style="padding:18px; text-align:center; color:var(--muted);">لم تحفظ نقاط استعادة لهذه النسخة بعد. يمكنك حفظ نقطة استعادة قبل إجراء تعديلات كبيرة للرجوع إليها متى شئت.</div>`
        }
      </div>`;
    modal.hidden = false;
  }

  // ==================== Teleprompter / Presentation Mode ====================
  function openTeleprompter(opts = {}) {
    const S = window.QabasStore;
    const U = window.QabasUtils;
    const items = [];
    let title = "";

    if (opts.customId) {
      const cl = S.state.customLessons.find((c) => c.id === opts.customId);
      if (!cl) return;
      title = cl.title || "نسخة مخصصة";
      (cl.blocks || []).forEach((b) => {
        if (!b.hidden && (b.text || "").trim()) {
          items.push({ type: b.type || "p", text: b.text.trim() });
        }
      });
    } else {
      const doc = S.getDoc(opts.docId || S.state.prefs.activeDocId || "T01");
      if (!doc) return;
      title = doc.title;
      if (doc.kind === "topic") {
        doc.chapters.forEach((ch) => {
          const chItems = [];
          ch.subtopics.forEach((sub) => {
            const subParas = sub.paragraphs.filter((p) => {
              const ann = S.state.annotations[p.id];
              return S.isParagraphQualityAllowed(p) && !(ann && ann.hidden);
            });
            if (!subParas.length) return;
            chItems.push({ type: "h3", text: sub.title });
            subParas.forEach((p) => {
              chItems.push({ type: "p", text: S.getEffectiveParagraphText(p.id) });
            });
          });
          if (chItems.length) {
            items.push({ type: "h2", text: ch.title });
            items.push(...chItems);
          }
        });
      } else {
        doc.sections.forEach((sec) => {
          const secParas = sec.paragraphs.filter((p) => {
            const ann = S.state.annotations[p.id];
            return S.isParagraphQualityAllowed(p) && !(ann && ann.hidden);
          });
          if (!secParas.length) return;
          items.push({ type: "h2", text: sec.title });
          secParas.forEach((p) => {
            items.push({ type: "p", text: S.getEffectiveParagraphText(p.id) });
          });
        });
      }
    }

    if (!items.length) {
      toast("لا توجد فقرات قابلة للعرض في وضع الإلقاء", "info");
      return;
    }

    state.tp.active = true;
    state.tp.items = items;
    state.tp.currentIndex = 0;
    state.tp.startedAt = Date.now();
    stopTpAutoScroll();

    el("tpTitle").textContent = title;
    const overlay = el("teleprompterOverlay");
    overlay.hidden = false;
    renderTeleprompterStage();

    clearInterval(state.tp.clockTimer);
    state.tp.clockTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - state.tp.startedAt) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      if (el("tpTimerBadge")) el("tpTimerBadge").textContent = `${mm}:${ss}`;
    }, 1000);
  }

  function renderTeleprompterStage() {
    const U = window.QabasUtils;
    const stage = el("tpStage");
    if (!stage) return;
    stage.style.fontSize = `${state.tp.fontSize}px`;
    stage.innerHTML = state.tp.items
      .map((it, idx) => {
        const cls =
          idx === state.tp.currentIndex
            ? "is-current"
            : idx < state.tp.currentIndex
            ? "is-past"
            : "";
        return `<div class="tp-item tp-${it.type} ${cls}" data-tp-idx="${idx}">${U.escapeHtml(it.text)}</div>`;
      })
      .join("");
    updateTpHighlight();
  }

  function updateTpHighlight() {
    const stage = el("tpStage");
    if (!stage) return;
    const idx = state.tp.currentIndex;
    stage.querySelectorAll(".tp-item").forEach((node, i) => {
      node.classList.toggle("is-current", i === idx);
      node.classList.toggle("is-past", i < idx);
    });
    const activeNode = stage.querySelector(`.tp-item[data-tp-idx="${idx}"]`);
    activeNode?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el("tpProgressBadge")) {
      el("tpProgressBadge").textContent = `${idx + 1} / ${state.tp.items.length}`;
    }
  }

  function stepTeleprompter(delta) {
    if (!state.tp.active) return;
    const next = Math.max(0, Math.min(state.tp.items.length - 1, state.tp.currentIndex + delta));
    state.tp.currentIndex = next;
    updateTpHighlight();
  }

  function stopTpAutoScroll() {
    if (state.tp.autoScrollTimer) {
      clearInterval(state.tp.autoScrollTimer);
      state.tp.autoScrollTimer = null;
    }
    if (el("tpPlayScrollBtn")) el("tpPlayScrollBtn").textContent = "تمرير تلقائي ▶";
  }

  function closeTeleprompter() {
    state.tp.active = false;
    stopTpAutoScroll();
    clearInterval(state.tp.clockTimer);
    if (el("teleprompterOverlay")) el("teleprompterOverlay").hidden = true;
  }

  // ==================== Event Bindings ====================
  function bindGlobalEvents() {
    const S = window.QabasStore;
    const U = window.QabasUtils;

    // Navigation Tabs
    document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextTab = btn.getAttribute("data-tab");
        if (S.state.prefs.splitMode && (nextTab === "bookmarks" || nextTab === "studio")) {
          S.updatePrefs({ splitMode: false, activeTab: nextTab });
        } else {
          S.updatePrefs({ activeTab: nextTab });
        }
        syncActiveStage();
      });
    });

    // Mobile Sidebar
    el("mobileMenuBtn")?.addEventListener("click", () => {
      el("sidebarNav")?.classList.toggle("is-open");
    });
    el("closeSidebarMobileBtn")?.addEventListener("click", () => {
      el("sidebarNav")?.classList.remove("is-open");
    });

    // Sidebar filter & selection
    el("sidebarFilterInput")?.addEventListener("input", (e) => {
      state.sidebarFilter = e.target.value;
      renderSidebar();
    });

    el("docListContainer")?.addEventListener("click", (e) => {
      const docBtn = e.target.closest("[data-select-doc]");
      if (docBtn) {
        navigateToDoc(docBtn.getAttribute("data-select-doc"));
        return;
      }
      const customBtn = e.target.closest("[data-select-custom]");
      if (customBtn) {
        openStudio(customBtn.getAttribute("data-select-custom"));
        el("sidebarNav")?.classList.remove("is-open");
        return;
      }
      if (e.target.closest("[data-sidebar-new-custom]")) {
        const created = S.createBlankCustomLesson("نسخة مخصصة جديدة", "");
        openStudio(created.id);
      }
    });

    // Topbar actions
    el("qualityFilterBtn")?.addEventListener("click", () => {
      const cur = S.state.prefs.qualityFilter || "clean";
      const next = cur === "clean" ? "high" : cur === "high" ? "all" : "clean";
      S.updatePrefs({ qualityFilter: next });
      syncActiveStage();
      if (next === "clean") {
        toast("الفلتر النشط: الصافي فقط (تم إخفاء جميع الفقرات والمجالس الرديئة)", "success");
      } else if (next === "high") {
        toast("الفلتر النشط: النصوص الممتازة المحررة فقط", "info");
      } else {
        toast("الفلتر النشط: عرض الكل بما في ذلك التفريغ الخام", "info");
      }
    });
    el("openSearchBtn")?.addEventListener("click", () => openSearchModal());
    el("splitModeBtn")?.addEventListener("click", () => toggleSplitMode());
    el("focusModeBtn")?.addEventListener("click", () => {
      S.updatePrefs({ focusMode: !S.state.prefs.focusMode, splitMode: false });
      syncActiveStage();
    });

    // Appearance Popover
    el("appearanceBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const pop = el("appearancePopover");
      if (pop) pop.hidden = !pop.hidden;
    });
    el("appearancePopover")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const th = e.target.closest("[data-set-theme]");
      if (th) S.updatePrefs({ theme: th.getAttribute("data-set-theme") });
      const fn = e.target.closest("[data-set-font]");
      if (fn) S.updatePrefs({ font: fn.getAttribute("data-set-font") });
      const wd = e.target.closest("[data-set-width]");
      if (wd) S.updatePrefs({ width: wd.getAttribute("data-set-width") });
      const cp = e.target.closest("[data-set-copy]");
      if (cp) S.updatePrefs({ copyFormat: cp.getAttribute("data-set-copy") });
      const ql = e.target.closest("[data-set-quality]");
      if (ql) {
        S.updatePrefs({ qualityFilter: ql.getAttribute("data-set-quality") });
        syncActiveStage();
        return;
      }
      const stepBtn = e.target.closest("[data-step-font]");
      if (stepBtn) {
        const delta = Number(stepBtn.getAttribute("data-step-font"));
        const next = Math.max(15, Math.min(28, (S.state.prefs.fontSize || 19) + delta));
        S.updatePrefs({ fontSize: next });
      }
      applyAppearancePrefs();
    });
    el("fontSizeRange")?.addEventListener("input", (e) => {
      S.updatePrefs({ fontSize: Number(e.target.value) });
      applyAppearancePrefs();
    });
    el("lineHeightRange")?.addEventListener("input", (e) => {
      S.updatePrefs({ lineHeight: Number(e.target.value) });
      applyAppearancePrefs();
    });
    document.addEventListener("click", () => {
      const pop = el("appearancePopover");
      if (pop && !pop.hidden) pop.hidden = true;
    });

    // Backup Modal
    el("openBackupModalBtn")?.addEventListener("click", () => {
      el("appearancePopover").hidden = true;
      el("backupModal").hidden = false;
    });
    el("exportWorkspaceBtn")?.addEventListener("click", () => {
      const jsonStr = S.exportWorkspaceJson();
      U.downloadTextFile("qabas_workspace_backup.json", jsonStr, "application/json;charset=utf-8");
      toast("تم تنزيل حزمة النسخ الاحتياطي بنجاح");
    });
    el("importWorkspaceInput")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = S.importWorkspaceJson(String(reader.result || ""));
        if (ok) {
          el("backupModal").hidden = true;
          syncActiveStage();
          toast("تم استيراد حزمة مساحة العمل بنجاح");
        } else {
          toast("تعذر قراءة ملف الحزمة", "error");
        }
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    });

    // Modal closing
    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-close-modal]");
      if (closeBtn) {
        const mid = closeBtn.getAttribute("data-close-modal");
        if (el(mid)) el(mid).hidden = true;
        return;
      }
      if (e.target.classList && e.target.classList.contains("modal-backdrop")) {
        e.target.hidden = true;
      }
    });

    // Global Search Modal controls
    el("globalSearchInput")?.addEventListener("input", () => {
      clearTimeout(state.searchDebounce);
      state.searchDebounce = setTimeout(runGlobalSearch, 90);
    });
    el("searchScopeGroup")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-search-scope]");
      if (!btn) return;
      state.searchScope = btn.getAttribute("data-search-scope");
      el("searchScopeGroup")
        .querySelectorAll("[data-search-scope]")
        .forEach((b) => b.classList.toggle("is-active", b === btn));
      runGlobalSearch();
    });
    el("searchResultsList")?.addEventListener("click", async (e) => {
      const jumpBtn = e.target.closest("[data-hit-jump-doc]");
      if (jumpBtn) {
        el("searchModal").hidden = true;
        navigateToDoc(
          jumpBtn.getAttribute("data-hit-jump-doc"),
          jumpBtn.getAttribute("data-hit-jump-para")
        );
        return;
      }
      const openCustomBtn = e.target.closest("[data-hit-open-custom]");
      if (openCustomBtn) {
        el("searchModal").hidden = true;
        openStudio(openCustomBtn.getAttribute("data-hit-open-custom"));
        return;
      }
      const copyParaBtn = e.target.closest("[data-hit-copy-para]");
      if (copyParaBtn) {
        const txt = S.formatParagraphForCopy(copyParaBtn.getAttribute("data-hit-copy-para"));
        await U.copyText(txt);
        toast("تم نسخ الفقرة إلى الحافظة");
        return;
      }
      const copyRawBtn = e.target.closest("[data-hit-copy-raw]");
      if (copyRawBtn) {
        await U.copyText(copyRawBtn.getAttribute("data-hit-copy-raw"));
        toast("تم النسخ إلى الحافظة");
        return;
      }
      const addCustomBtn = e.target.closest("[data-hit-add-custom]");
      if (addCustomBtn) {
        const cl = S.appendParagraphToCustom(addCustomBtn.getAttribute("data-hit-add-custom"));
        updateTopCounts();
        if (S.state.prefs.splitMode || S.state.prefs.activeTab === "studio") {
          window.QabasStudio.render(cl.id);
        }
        toast(`أُضيفت الفقرة إلى «${cl.title}»`);
      }
    });

    // Confirm Fork Modal
    el("confirmForkBtn")?.addEventListener("click", () => {
      const docId = state.forkContext.docId;
      const doc = S.getDoc(docId);
      if (!doc) return;
      const customTitle = (el("forkCustomTitleInput")?.value || "").trim() || `نسخة مخصصة: ${doc.title}`;
      const selectedUnits = Array.from(document.querySelectorAll("#forkModalBody .fork-unit-cb:checked")).map(
        (cb) => cb.value
      );
      if (!selectedUnits.length) {
        toast("يرجى اختيار باب أو محور واحد على الأقل", "error");
        return;
      }
      const created =
        doc.kind === "topic"
          ? S.forkDocToCustom(docId, { chapterIds: selectedUnits, customTitle })
          : S.forkDocToCustom(docId, { sectionIds: selectedUnits, sectionId: selectedUnits.length === 1 ? selectedUnits[0] : null, customTitle });
      el("forkModal").hidden = true;
      openStudio(created.id);
      toast(`تم إنشاء النسخة المخصصة «${created.title}»`);
    });

    // Snapshots Modal actions
    el("snapshotsModalBody")?.addEventListener("click", (e) => {
      const createBtn = e.target.closest("#createSnapshotNowBtn");
      if (createBtn) {
        const cid = createBtn.getAttribute("data-snap-cid");
        const label = (el("newSnapshotLabelInput")?.value || "").trim() || "نقطة حفظ يدوية";
        S.saveSnapshot(cid, label);
        openSnapshotsModal(cid);
        toast("تم حفظ نقطة الاستعادة");
        return;
      }
      const restoreBtn = e.target.closest("[data-restore-snap]");
      if (restoreBtn) {
        const cid = restoreBtn.getAttribute("data-snap-cid");
        S.restoreSnapshot(cid, restoreBtn.getAttribute("data-restore-snap"));
        el("snapshotsModal").hidden = true;
        window.QabasStudio.render(cid);
        toast("تمت استعادة النسخة المحفوظة بنجاح");
        return;
      }
      const delBtn = e.target.closest("[data-delete-snap]");
      if (delBtn) {
        const cid = delBtn.getAttribute("data-snap-cid");
        S.deleteSnapshot(cid, delBtn.getAttribute("data-delete-snap"));
        openSnapshotsModal(cid);
      }
    });

    // Floating Selection Bar actions
    el("selCopyPlainBtn")?.addEventListener("click", async () => {
      const text = S.state.selection.map((pid) => S.formatParagraphForCopy(pid, "plain")).join("\n\n");
      await U.copyText(text);
      toast(`تم نسخ ${S.state.selection.length} فقرات صافية`);
    });
    el("selCopyCitedBtn")?.addEventListener("click", async () => {
      const text = S.state.selection.map((pid) => S.formatParagraphForCopy(pid, "citation")).join("\n\n");
      await U.copyText(text);
      toast(`تم نسخ ${S.state.selection.length} فقرات مع عناوينها`);
    });
    el("selNewCustomBtn")?.addEventListener("click", () => {
      const created = S.createCustomFromSelection("نسخة مخصصة من الفقرات المختارة");
      if (created) {
        S.clearSelection();
        openStudio(created.id);
        toast("أُنشئت نسخة مخصصة جديدة من الفقرات المحددة");
      }
    });
    el("selAppendCustomBtn")?.addEventListener("click", () => {
      const targetId =
        S.state.prefs.activeCustomId ||
        (S.state.customLessons[0] && S.state.customLessons[0].id) ||
        null;
      const cl = S.appendSelectionToCustom(targetId);
      if (cl) {
        S.clearSelection();
        if (S.state.prefs.splitMode || S.state.prefs.activeTab === "studio") {
          window.QabasStudio.render(cl.id);
        }
        toast(`أُلحقت الفقرات المحددة بـ «${cl.title}»`);
      }
    });
    el("selDownloadMdBtn")?.addEventListener("click", () => {
      const md =
        "# مقتطفات مختارة من شرح قبس النور المبين\n\n" +
        S.state.selection.map((pid) => S.formatParagraphForCopy(pid, "markdown")).join("\n\n") +
        "\n";
      U.downloadTextFile("qabas_selected_excerpts.md", md);
      toast("تم تنزيل ملف الفقرات المحددة");
    });
    el("selClearBtn")?.addEventListener("click", () => {
      S.clearSelection();
    });

    // Teleprompter controls
    el("tpCloseBtn")?.addEventListener("click", closeTeleprompter);
    el("tpPrevBtn")?.addEventListener("click", () => stepTeleprompter(-1));
    el("tpNextBtn")?.addEventListener("click", () => stepTeleprompter(1));
    el("tpFontPlusBtn")?.addEventListener("click", () => {
      state.tp.fontSize = Math.min(46, state.tp.fontSize + 2);
      if (el("tpStage")) el("tpStage").style.fontSize = `${state.tp.fontSize}px`;
    });
    el("tpFontMinusBtn")?.addEventListener("click", () => {
      state.tp.fontSize = Math.max(18, state.tp.fontSize - 2);
      if (el("tpStage")) el("tpStage").style.fontSize = `${state.tp.fontSize}px`;
    });
    el("tpPlayScrollBtn")?.addEventListener("click", () => {
      if (state.tp.autoScrollTimer) {
        stopTpAutoScroll();
      } else {
        el("tpPlayScrollBtn").textContent = "إيقاف مؤقت ⏸";
        state.tp.autoScrollTimer = setInterval(() => {
          if (state.tp.currentIndex < state.tp.items.length - 1) {
            stepTeleprompter(1);
          } else {
            stopTpAutoScroll();
          }
        }, 5500);
      }
    });
    el("tpStage")?.addEventListener("click", (e) => {
      const node = e.target.closest("[data-tp-idx]");
      if (node) {
        state.tp.currentIndex = Number(node.getAttribute("data-tp-idx"));
        updateTpHighlight();
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;

      if (state.tp.active) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeTeleprompter();
        } else if (e.key === "ArrowDown" || e.key === " " || e.key === "j") {
          e.preventDefault();
          stepTeleprompter(1);
        } else if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          stepTeleprompter(-1);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal();
        return;
      }

      if (e.key === "Escape") {
        ["searchModal", "forkModal", "snapshotsModal", "backupModal"].forEach((mid) => {
          if (el(mid) && !el(mid).hidden) el(mid).hidden = true;
        });
        return;
      }

      if (!isEditing) {
        if (e.key === "/") {
          e.preventDefault();
          openSearchModal();
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          S.updatePrefs({ focusMode: !S.state.prefs.focusMode, splitMode: false });
          syncActiveStage();
        } else if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          toggleSplitMode();
        }
      }
    });

    // Store Subscriptions
    S.on("sync", updateSyncBadge);
    S.on("selection", () => {
      renderSelectionBar();
      document.querySelectorAll(".para-card[data-para-id]").forEach((card) => {
        const pid = card.getAttribute("data-para-id");
        const sel = S.isSelected(pid);
        card.classList.toggle("is-selected", sel);
        const cb = card.querySelector(".para-checkbox");
        if (cb) cb.checked = sel;
      });
    });
    S.on("customChanged", () => {
      updateTopCounts();
      if (S.state.prefs.activeTab === "studio" && !S.state.prefs.splitMode) {
        renderSidebar();
      }
    });
    S.on("annotationChanged", () => {
      updateTopCounts();
      renderSidebar();
    });
  }

  async function init() {
    await window.QabasStore.init();
    window.QabasReader.init(el("readerView"), el("bookmarksView"), el("tocList"));
    window.QabasStudio.init(el("studioView"));
    bindGlobalEvents();
    updateSyncBadge();
    renderSelectionBar();
    syncActiveStage();
  }

  window.QabasApp = {
    init,
    toast,
    navigateToDoc,
    openStudio,
    toggleSplitMode,
    openSearchModal,
    openForkModal,
    openSnapshotsModal,
    openTeleprompter,
    syncActiveStage,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
